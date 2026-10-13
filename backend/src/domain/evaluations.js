import { randomUUID } from "node:crypto";
import { ACTIONS, canPerform } from "./permissions.js";
import { PROCEDURE_STATUS, favorableEvaluationAllowed } from "./workflow.js";
import { ROLES } from "./roles.js";
import {
  EVALUATION_GROUPS,
  EVALUATION_RUBRIC_VERSION,
  blankEvaluationCriteria,
  evaluationMetrics,
  missingCorrectionResponses,
  sanitizeEvaluationCriteria,
  technicalConcept,
  validateEvaluation
} from "./evaluation-rubric.js";
import { DraftError } from "./drafts.js";

const TRACE_LIMIT = 40;

function actorLabel(user) {
  const name = String(user?.displayName || user?.username || "").trim();
  if (name) return name;
  if (user?.role === ROLES.EVALUADOR) return "Evaluador";
  if (user?.role === ROLES.ELABORADOR) return "Elaborador";
  return "Usuario";
}

function findingTrace(record) {
  if (!Array.isArray(record?.trace)) return [];
  return record.trace
    .filter(entry => entry && typeof entry === "object" && typeof entry.action === "string")
    .slice(-TRACE_LIMIT)
    .map(entry => ({ ...entry }));
}

function appendFindingTrace(record, action, user, iteration, detail = {}) {
  record.trace = [...findingTrace(record), {
    action,
    at: new Date().toISOString(),
    actor: actorLabel(user),
    role: user.role,
    iteration,
    ...detail
  }].slice(-TRACE_LIMIT);
}

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
    concept: technicalConcept(criteria, version, row.concept || ""),
    conceptComplement: row.concept || "",
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
        AND p.status IN ($3, $4, $5, $6)`,
    [procedureId, user.id, PROCEDURE_STATUS.RETURNED, PROCEDURE_STATUS.PENDING_ADMIN_APPROVAL,
      PROCEDURE_STATUS.APPROVED, PROCEDURE_STATUS.UNFAVORABLE]
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
    const iteration = Number(existing.criteria_payload?.iteration || 1);
    for (const [id, record] of Object.entries(normalized.criteria)) {
      const previous = previousCriteria[id] || {};
      record.response = previous.response || "";
      record.trace = findingTrace(previous);
      const hasPreviousRequest = record.trace.some(entry => entry.action === "Ajuste solicitado");
      const adjustmentRequested = record.result === "No cumple" && (
        previous.result !== "No cumple" ||
        previous.observation !== record.observation ||
        previous.adjustment !== record.adjustment ||
        !hasPreviousRequest
      );
      if (adjustmentRequested) {
        record.response = "";
        record.findingStatus = "Pendiente";
        appendFindingTrace(record, "Ajuste solicitado", user, iteration, {
          observation: record.observation,
          adjustment: record.adjustment
        });
      } else if (previous.result === "No cumple" && record.result !== "No cumple") {
        record.findingStatus = "Cerrado";
        appendFindingTrace(record, "Hallazgo cerrado", user, iteration, {
          result: record.result,
          findingStatus: record.findingStatus
        });
      } else if (previous.result === "No cumple" && previous.response &&
        previous.findingStatus !== record.findingStatus) {
        appendFindingTrace(record, "Verificación del ajuste", user, iteration, {
          result: record.result,
          findingStatus: record.findingStatus
        });
      }
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
    const iteration = Number(evaluation.criteria_payload?.iteration || 1);
    const allowedIds = new Set(Object.keys(criteria));
    if (Object.keys(responses).some(id => !allowedIds.has(id))) throw new DraftError("invalid_evaluation_response", 400);
    for (const [id, responseInput] of Object.entries(responses)) {
      const response = typeof responseInput === "string" ? responseInput : responseInput?.action;
      if (typeof response !== "string" || response.length > 5000) {
        throw new DraftError("invalid_evaluation_response", 400);
      }
      if (criteria[id].result === "No cumple") {
        const normalizedResponse = response.trim();
        const wasComplete = Boolean(String(criteria[id].response || "").trim());
        const isComplete = Boolean(normalizedResponse);
        if (normalizedResponse !== String(criteria[id].response || "")) {
          criteria[id].response = normalizedResponse;
          if (isComplete) {
            criteria[id].findingStatus = "Respondido";
            appendFindingTrace(criteria[id], "Respuesta del Elaborador", user, iteration, {
              response: normalizedResponse
            });
          } else if (wasComplete) {
            criteria[id].findingStatus = "Pendiente";
            appendFindingTrace(criteria[id], "Respuesta retirada", user, iteration);
          } else {
            criteria[id].findingStatus = "Pendiente";
          }
        }
      }
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
  if (!["devolver", "favorable"].includes(decision)) throw new DraftError("invalid_evaluation_decision", 400);
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
      evaluation: { complete: metrics.complete, score: metrics.score, failures: metrics.failures, criticalFailures: metrics.criticalFailures, openFindings: metrics.openFindings }
    };
    const currentUser = { ...user, processCodes: [procedure.process_code] };
    if (!canPerform(currentUser, ACTIONS.UPDATE_EVALUATION, permissionContext)) throw new DraftError("draft_locked", 403);
    const issues = validateEvaluation(criteria, procedure.version);
    if (issues.length) throw new DraftError("evaluation_incomplete", 400, issues);
    if (decision === "devolver" && metrics.failures === 0) throw new DraftError("evaluation_no_findings", 400);
    const action = decision === "favorable" ? ACTIONS.ISSUE_FAVORABLE_CONCEPT : ACTIONS.RETURN_FOR_CORRECTIONS;
    if (!canPerform(currentUser, action, permissionContext)) {
      throw new DraftError(decision === "favorable" ? "evaluation_favorable_conditions_unmet" : "draft_locked", decision === "favorable" ? 400 : 403);
    }

    const evaluationStatus = decision === "devolver" ? PROCEDURE_STATUS.RETURNED : PROCEDURE_STATUS.FAVORABLE;
    const nextStatus = decision === "devolver" ? PROCEDURE_STATUS.RETURNED : PROCEDURE_STATUS.PENDING_ADMIN_APPROVAL;
    await client.query(
      `UPDATE evaluations SET status = $2, score = $3, critical_failures = $4,
              open_findings = $5, updated_at = now()
        WHERE id = $1`,
      [existing.id, evaluationStatus, metrics.score, metrics.criticalFailures, metrics.openFindings]
    );
    await client.query(
      `UPDATE procedures SET status = $2, updated_at = now() WHERE id = $1`,
      [procedureId, nextStatus]
    );
    const eventType = decision === "devolver" ? "procedure_returned_for_corrections" : "procedure_favorable_concept_issued";
    const title = decision === "devolver" ? "Procedimiento devuelto para ajustes" : "Concepto favorable emitido";
    const message = decision === "devolver"
      ? `«${procedure.name}» fue devuelto con ${metrics.failures} criterio(s) por ajustar.`
      : `La evaluación de «${procedure.name}» finalizó con ${metrics.score.toFixed(1)}% y quedó pendiente del visto bueno administrativo.`;
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

export async function listPendingAdministrativeApprovals(pool, user) {
  if (user.role !== ROLES.ADMIN) throw new DraftError("forbidden", 403);
  const result = await pool.query(
    `SELECT id, code, name, process_code, version, status, revision, updated_at,
            admin_approval_observation, admin_approval_by_user_id, admin_approval_at
       FROM procedures
      WHERE status = $1
      ORDER BY updated_at ASC, name`,
    [PROCEDURE_STATUS.PENDING_ADMIN_APPROVAL]
  );
  return result.rows.map(row => ({
    id: row.id,
    code: row.code,
    name: row.name,
    processCode: row.process_code,
    version: row.version,
    status: row.status,
    revision: row.revision,
    updatedAt: row.updated_at
  }));
}

export async function getAdministrativeApprovalProcedure(pool, user, procedureId) {
  if (user.role !== ROLES.ADMIN) throw new DraftError("forbidden", 403);
  const result = await pool.query(
    `SELECT p.id, p.code, p.name, p.process_code, p.version, p.status, p.revision, p.updated_at,
            p.current_payload, p.assigned_evaluator_id, p.admin_approval_observation,
            p.admin_approval_by_user_id, p.admin_approval_at,
            e.id AS evaluation_id, e.status AS evaluation_status, e.score,
            e.critical_failures, e.open_findings, e.concept, e.criteria_payload,
            e.created_at AS evaluation_created_at, e.updated_at AS evaluation_updated_at
       FROM procedures p
       JOIN LATERAL (
         SELECT id, status, score, critical_failures, open_findings, concept, criteria_payload, created_at, updated_at
           FROM evaluations WHERE procedure_id = p.id
          ORDER BY created_at DESC, id DESC LIMIT 1
       ) e ON TRUE
      WHERE p.id = $1`,
    [procedureId]
  );
  const row = result.rows[0];
  if (!row) throw new DraftError("draft_not_found", 404);
  return {
    procedure: {
      id: row.id,
      code: row.code,
      name: row.name,
      processCode: row.process_code,
      assignedEvaluatorId: row.assigned_evaluator_id || null,
      version: row.version,
      status: row.status,
      revision: row.revision,
      updatedAt: row.updated_at,
      adminApprovalObservation: row.admin_approval_observation || "",
      adminApprovalByUserId: row.admin_approval_by_user_id || null,
      adminApprovalAt: row.admin_approval_at || null,
      payload: row.current_payload
    },
    evaluation: publicEvaluation({
      id: row.evaluation_id,
      status: row.evaluation_status,
      score: row.score,
      critical_failures: row.critical_failures,
      open_findings: row.open_findings,
      concept: row.concept,
      criteria_payload: row.criteria_payload,
      created_at: row.evaluation_created_at,
      updated_at: row.evaluation_updated_at
    }, row.version)
  };
}

export async function decideAdministrativeApproval(pool, user, procedureId, { decision, observation } = {}) {
  if (user.role !== ROLES.ADMIN) throw new DraftError("forbidden", 403);
  if (!["aprobar", "devolver"].includes(decision)) throw new DraftError("invalid_admin_approval_decision", 400);
  const cleanObservation = typeof observation === "string" ? observation.trim() : "";
  if (cleanObservation.length > 5000) throw new DraftError("invalid_admin_approval_observation", 400);
  if (decision === "devolver" && !cleanObservation) throw new DraftError("admin_return_observation_required", 400);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT p.id, p.name, p.version, p.status, p.created_by_user_id, p.assigned_evaluator_id,
              e.id AS evaluation_id, e.status AS evaluation_status, e.criteria_payload
         FROM procedures p
         JOIN LATERAL (
           SELECT id, status, criteria_payload FROM evaluations WHERE procedure_id = p.id
            ORDER BY created_at DESC, id DESC LIMIT 1
         ) e ON TRUE
        WHERE p.id = $1 FOR UPDATE OF p`,
      [procedureId]
    );
    const procedure = found.rows[0];
    if (!procedure) throw new DraftError("draft_not_found", 404);
    if (!canPerform(user, decision === "aprobar" ? ACTIONS.ISSUE_FINAL_APPROVAL : ACTIONS.RETURN_FROM_ADMIN_APPROVAL, {
      procedure: { status: procedure.status }
    })) throw new DraftError("draft_locked", 403);
    const metrics = evaluationMetrics(criteriaFromPayload(procedure.criteria_payload), procedure.version);
    if (decision === "aprobar" && (procedure.evaluation_status !== PROCEDURE_STATUS.FAVORABLE || !favorableEvaluationAllowed({
      complete: metrics.complete, score: metrics.score, failures: metrics.failures,
      criticalFailures: metrics.criticalFailures, openFindings: metrics.openFindings
    }))) throw new DraftError("administrative_approval_conditions_unmet", 400);

    const nextStatus = decision === "aprobar" ? PROCEDURE_STATUS.APPROVED : PROCEDURE_STATUS.RETURNED;
    const updated = await client.query(
      `UPDATE procedures
          SET status = $2,
              approved_payload = CASE WHEN $2 = $3 THEN current_payload ELSE NULL END,
              approved_at = CASE WHEN $2 = $3 THEN now() ELSE NULL END,
              admin_approval_observation = $4,
              admin_approval_by_user_id = $5,
              admin_approval_at = now(),
              revision = revision + 1,
              updated_at = now()
        WHERE id = $1
        RETURNING id, code, name, process_code, version, status, revision, updated_at`,
      [procedureId, nextStatus, PROCEDURE_STATUS.APPROVED, cleanObservation || null, user.id]
    );
    const eventType = decision === "aprobar" ? "procedure_formally_approved" : "procedure_returned_by_administration";
    const title = decision === "aprobar" ? "Procedimiento aprobado formalmente" : "Procedimiento devuelto por Administración";
    const message = decision === "aprobar"
      ? `«${procedure.name}» recibió el visto bueno administrativo y quedó vigente.`
      : `Administración devolvió «${procedure.name}» para ajustes: ${cleanObservation}`;
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, event_type, entity_type, entity_id, reason, metadata)
       VALUES ($1, $2, $3, 'procedure', $4, $5, $6::jsonb)`,
      [randomUUID(), user.id, eventType, procedureId, cleanObservation || null,
        JSON.stringify({ evaluationId: procedure.evaluation_id, decision })]
    );
    for (const recipientId of new Set([procedure.created_by_user_id, procedure.assigned_evaluator_id].filter(Boolean))) {
      await client.query(
        `INSERT INTO user_notifications (id, recipient_user_id, procedure_id, event_type, title, message)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), recipientId, procedureId, eventType, title, message]
      );
    }
    await client.query("COMMIT");
    return { status: nextStatus, procedure: updated.rows[0], observation: cleanObservation };
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
