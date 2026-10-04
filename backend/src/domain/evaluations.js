import { randomUUID } from "node:crypto";
import { ACTIONS, canPerform } from "./permissions.js";
import { PROCEDURE_STATUS } from "./workflow.js";
import { ROLES } from "./roles.js";
import {
  EVALUATION_GROUPS,
  EVALUATION_RUBRIC_VERSION,
  blankEvaluationCriteria,
  evaluationIsFavorable,
  evaluationMetrics,
  missingCorrectionResponses,
  sanitizeEvaluationCriteria,
  validateEvaluation
} from "./evaluation-rubric.js";
import { DraftError } from "./drafts.js";

function criteriaFromPayload(payload) {
  const parsed = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const source = parsed.criteria && typeof parsed.criteria === "object" && !Array.isArray(parsed.criteria) ? parsed.criteria : {};
  return { ...blankEvaluationCriteria(), ...source };
}

function publicEvaluation(row, version) {
  const criteriaPayload = row.criteria_payload && typeof row.criteria_payload === "object" && !Array.isArray(row.criteria_payload) ? row.criteria_payload : {};
  const criteria = criteriaFromPayload(criteriaPayload);
  return {
    id: row.id,
    status: row.status,
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    criticalFailures: Number(row.critical_failures || 0),
    openFindings: Number(row.open_findings || 0),
    concept: row.concept || "",
    criteria,
    rubricVersion: Number(criteriaPayload.rubricVersion || EVALUATION_RUBRIC_VERSION),
    iteration: Number(criteriaPayload.iteration || 1),
    submittedRevision: Number(criteriaPayload.submittedRevision || 0),
    metrics: evaluationMetrics(criteria, version),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function assignedEvaluationRow(client, procedureId, evaluatorId) {
  const result = await client.query(
    `SELECT id, status, score, critical_failures, open_findings, concept, criteria_payload, created_at, updated_at
       FROM evaluations
      WHERE procedure_id = $1 AND evaluator_id = $2
      ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`,
    [procedureId, evaluatorId]
  );
  return result.rows[0] || null;
}

export async function getAssignedEvaluation(pool, user, procedureId) {
  if (user.role !== ROLES.EVALUADOR) throw new DraftError("forbidden", 403);
  const result = await pool.query(
    `SELECT p.version, p.status AS procedure_status,
            e.id, e.status, e.score, e.critical_failures, e.open_findings, e.concept,
            e.criteria_payload, e.created_at, e.updated_at
       FROM procedures p
       JOIN user_processes up ON up.process_code = p.process_code AND up.user_id = $2
       JOIN LATERAL (
         SELECT id, status, score, critical_failures, open_findings, concept,
                criteria_payload, created_at, updated_at
           FROM evaluations WHERE procedure_id = p.id AND evaluator_id = $2
          ORDER BY created_at DESC, id DESC LIMIT 1
       ) e ON TRUE
      WHERE p.id = $1 AND p.assigned_evaluator_id = $2`,
    [procedureId, user.id]
  );
  if (!result.rows[0]) throw new DraftError("draft_not_found", 404);
  return publicEvaluation(result.rows[0], result.rows[0].version);
}

export async function getOwnEvaluationFeedback(pool, user, procedureId) {
  const result = await pool.query(
    `SELECT p.version, e.id, e.status, e.score, e.critical_failures, e.open_findings,
            e.concept, e.criteria_payload, e.created_at, e.updated_at
       FROM procedures p
       JOIN LATERAL (
         SELECT id, status, score, critical_failures, open_findings, concept,
                criteria_payload, created_at, updated_at
           FROM evaluations WHERE procedure_id = p.id
          ORDER BY created_at DESC, id DESC LIMIT 1
       ) e ON TRUE
      WHERE p.id = $1 AND p.created_by_user_id = $2
        AND p.status IN ($3, $4, $5)`,
    [procedureId, user.id, PROCEDURE_STATUS.RETURNED, PROCEDURE_STATUS.FAVORABLE, PROCEDURE_STATUS.UNFAVORABLE]
  );
  return result.rows[0] ? publicEvaluation(result.rows[0], result.rows[0].version) : null;
}

export async function saveAssignedEvaluation(pool, user, procedureId, { criteria: inputCriteria, concept } = {}) {
  if (user.role !== ROLES.EVALUADOR) throw new DraftError("forbidden", 403);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT p.id, p.version, p.status, p.assigned_evaluator_id, p.process_code
         FROM procedures p JOIN user_processes up ON up.process_code = p.process_code AND up.user_id = $2
        WHERE p.id = $1 AND p.assigned_evaluator_id = $2 FOR UPDATE OF p`,
      [procedureId, user.id]
    );
    const procedure = found.rows[0];
    if (!procedure) throw new DraftError("draft_not_found", 404);
    if (!canPerform({ ...user, processCodes: [procedure.process_code] }, ACTIONS.UPDATE_EVALUATION, { procedure: {
      status: procedure.status, assignedEvaluatorId: procedure.assigned_evaluator_id, processCode: procedure.process_code
    } })) throw new DraftError("draft_locked", 403);

    const existing = await assignedEvaluationRow(client, procedureId, user.id);
    if (!existing || existing.status !== PROCEDURE_STATUS.IN_REVIEW) throw new DraftError("draft_locked", 403);
    const normalized = sanitizeEvaluationCriteria(inputCriteria, procedure.version);
    if (normalized.issues.length) throw new DraftError("invalid_evaluation", 400, normalized.issues);
    if (typeof concept !== "string" || concept.length > 5000) throw new DraftError("invalid_evaluation", 400);
    const previousCriteria = criteriaFromPayload(existing.criteria_payload);
    for (const [id, record] of Object.entries(normalized.criteria)) {
      record.response = previousCriteria[id]?.response || "";
    }
    const metrics = evaluationMetrics(normalized.criteria, procedure.version);
    const previousPayload = existing.criteria_payload && typeof existing.criteria_payload === "object" ? existing.criteria_payload : {};
    const criteriaPayload = {
      ...previousPayload,
      rubricVersion: EVALUATION_RUBRIC_VERSION,
      criteria: normalized.criteria
    };
    const updated = await client.query(
      `UPDATE evaluations
          SET score = $2, critical_failures = $3, open_findings = $4, concept = $5,
              criteria_payload = $6::jsonb, updated_at = now()
        WHERE id = $1
        RETURNING id, status, score, critical_failures, open_findings, concept, criteria_payload, created_at, updated_at`,
      [existing.id, metrics.score, metrics.criticalFailures, metrics.openFindings, concept.trim(), JSON.stringify(criteriaPayload)]
    );
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, event_type, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'procedure_evaluation_updated', 'procedure', $3, $4::jsonb)`,
      [randomUUID(), user.id, procedureId, JSON.stringify({ answered: metrics.answered, score: metrics.score })]
    );
    await client.query("COMMIT");
    return publicEvaluation({ ...updated.rows[0], version: procedure.version }, procedure.version);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function saveAuthorEvaluationResponses(pool, user, procedureId, responses) {
  if (user.role !== ROLES.ELABORADOR) throw new DraftError("forbidden", 403);
  if (!responses || typeof responses !== "object" || Array.isArray(responses)) throw new DraftError("invalid_evaluation_response", 400);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT id, version, status FROM procedures p
        WHERE p.id = $1 AND p.created_by_user_id = $2
          AND EXISTS (SELECT 1 FROM user_processes up WHERE up.user_id = $2 AND up.process_code = p.process_code)
        FOR UPDATE`,
      [procedureId, user.id]
    );
    const procedure = found.rows[0];
    if (!procedure) throw new DraftError("draft_not_found", 404);
    if (procedure.status !== PROCEDURE_STATUS.RETURNED) throw new DraftError("draft_locked", 403);
    const result = await client.query(
      `SELECT id, status, criteria_payload FROM evaluations
        WHERE procedure_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`,
      [procedureId]
    );
    const evaluation = result.rows[0];
    if (!evaluation || evaluation.status !== PROCEDURE_STATUS.RETURNED) throw new DraftError("draft_locked", 403);
    const criteria = criteriaFromPayload(evaluation.criteria_payload);
    const allowedIds = new Set(Object.keys(criteria));
    if (Object.keys(responses).some(id => !allowedIds.has(id))) throw new DraftError("invalid_evaluation_response", 400);
    for (const [id, response] of Object.entries(responses)) {
      if (typeof response !== "string" || response.length > 5000) throw new DraftError("invalid_evaluation_response", 400);
      if (criteria[id].result === "No cumple") criteria[id].response = response.trim();
    }
    const criteriaPayload = { ...evaluation.criteria_payload, criteria };
    await client.query(
      `UPDATE evaluations SET criteria_payload = $2::jsonb, updated_at = now() WHERE id = $1`,
      [evaluation.id, JSON.stringify(criteriaPayload)]
    );
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, event_type, entity_type, entity_id)
       VALUES ($1, $2, 'procedure_evaluation_response_saved', 'procedure', $3)`,
      [randomUUID(), user.id, procedureId]
    );
    await client.query("COMMIT");
    return { missingResponses: missingCorrectionResponses(criteria).length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function decideAssignedEvaluation(pool, user, procedureId, { decision } = {}) {
  if (user.role !== ROLES.EVALUADOR) throw new DraftError("forbidden", 403);
  if (!["devolver", "favorable", "no_favorable"].includes(decision)) throw new DraftError("invalid_evaluation_decision", 400);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT p.id, p.name, p.version, p.status, p.assigned_evaluator_id, p.created_by_user_id, p.process_code
         FROM procedures p JOIN user_processes up ON up.process_code = p.process_code AND up.user_id = $2
        WHERE p.id = $1 AND p.assigned_evaluator_id = $2 FOR UPDATE OF p`,
      [procedureId, user.id]
    );
    const procedure = found.rows[0];
    if (!procedure) throw new DraftError("draft_not_found", 404);
    const existing = await assignedEvaluationRow(client, procedureId, user.id);
    if (!existing) throw new DraftError("draft_not_found", 404);
    const criteriaPayload = existing.criteria_payload && typeof existing.criteria_payload === "object" ? existing.criteria_payload : {};
    const criteria = criteriaFromPayload(criteriaPayload);
    const metrics = evaluationMetrics(criteria, procedure.version);
    const permissionContext = {
      procedure: { status: procedure.status, assignedEvaluatorId: procedure.assigned_evaluator_id, processCode: procedure.process_code },
      evaluation: { complete: metrics.complete, score: metrics.score, criticalFailures: metrics.criticalFailures, openFindings: metrics.openFindings }
    };
    const currentUser = { ...user, processCodes: [procedure.process_code] };
    if (!canPerform(currentUser, ACTIONS.UPDATE_EVALUATION, permissionContext)) throw new DraftError("draft_locked", 403);
    const issues = validateEvaluation(criteria, procedure.version);
    if (issues.length) throw new DraftError("evaluation_incomplete", 400, issues);
    if (!String(existing.concept || "").trim()) throw new DraftError("evaluation_concept_required", 400);
    if (decision === "devolver" && metrics.failures === 0) throw new DraftError("evaluation_no_findings", 400);
    if (decision === "no_favorable" && evaluationIsFavorable(metrics)) throw new DraftError("evaluation_meets_favorable_threshold", 400);
    const action = decision === "favorable" ? ACTIONS.ISSUE_FAVORABLE_CONCEPT
      : decision === "no_favorable" ? ACTIONS.ISSUE_UNFAVORABLE_CONCEPT
      : ACTIONS.RETURN_FOR_CORRECTIONS;
    if (!canPerform(currentUser, action, permissionContext)) {
      throw new DraftError(decision === "favorable" ? "evaluation_favorable_conditions_unmet" : "draft_locked", decision === "favorable" ? 400 : 403);
    }

    const nextStatus = decision === "devolver" ? PROCEDURE_STATUS.RETURNED
      : decision === "favorable" ? PROCEDURE_STATUS.FAVORABLE
      : PROCEDURE_STATUS.UNFAVORABLE;
    await client.query(
      `UPDATE evaluations SET status = $2, score = $3, critical_failures = $4,
              open_findings = $5, updated_at = now()
        WHERE id = $1`,
      [existing.id, nextStatus, metrics.score, metrics.criticalFailures, metrics.openFindings]
    );
    await client.query(
      `UPDATE procedures SET status = $2, updated_at = now() WHERE id = $1`,
      [procedureId, nextStatus]
    );
    const eventType = decision === "devolver" ? "procedure_returned_for_corrections"
      : decision === "favorable" ? "procedure_favorable_concept_issued"
      : "procedure_unfavorable_concept_issued";
    const title = decision === "devolver" ? "Procedimiento devuelto para ajustes"
      : decision === "favorable" ? "Concepto favorable emitido"
      : "Concepto no favorable emitido";
    const message = decision === "devolver"
      ? `«${procedure.name}» fue devuelto con ${metrics.failures} criterio(s) por ajustar.`
      : `La evaluación de «${procedure.name}» finalizó con ${metrics.score.toFixed(1)}%: ${title.toLocaleLowerCase("es-CO")}.`;
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, event_type, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'procedure', $4, $5::jsonb)`,
      [randomUUID(), user.id, eventType, procedureId, JSON.stringify({ evaluationId: existing.id, score: metrics.score, failures: metrics.failures, criticalFailures: metrics.criticalFailures })]
    );
    await client.query(
      `INSERT INTO user_notifications (id, recipient_user_id, procedure_id, event_type, title, message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomUUID(), procedure.created_by_user_id, procedureId, eventType, title, message]
    );
    await client.query("COMMIT");
    return { status: nextStatus, metrics, evaluationId: existing.id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function evaluationRubric() {
  return {
    version: EVALUATION_RUBRIC_VERSION,
    groups: EVALUATION_GROUPS.map(group => ({
      id: group.id, name: group.name, weight: group.weight, description: group.description,
      criteria: group.criteria.map(({ id, question, critical, newProcedureNotApplicable, order }) => ({ id, question, critical, newProcedureNotApplicable, order }))
    }))
  };
}
