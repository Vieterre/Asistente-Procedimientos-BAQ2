import { randomUUID } from "node:crypto";
import { ACTIONS, canPerform } from "./permissions.js";
import { PROCEDURE_STATUS } from "./workflow.js";
import { ROLES } from "./roles.js";
import { reviewFlow, reviewFlowCompleteness } from "./flow-review.js";
import { EVALUATION_RUBRIC_VERSION, missingCorrectionResponses } from "./evaluation-rubric.js";

export class DraftError extends Error {
  constructor(code, status, details) {
    super(code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const PROCEDURE_CODE_PATTERN = /^[A-Z]{2,3}-P-\d{3}$/;
const NORM_TYPES = ["Interna", "Externa"];
const GENERIC_PROCEDURE_VERBS = new Set(["gestionar", "administrar", "realizar"]);
const PROCEDURE_TYPE_WORDS = new Set(["procedimiento", "proceso", "tramite", "instructivo", "formato"]);
const GENERIC_PROCEDURE_OBJECTS = new Set(["informe", "informes", "contrato", "contratos", "solicitud", "solicitudes", "documento", "documentos", "registro", "registros"]);

function normalizedWord(value) {
  return String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es-CO");
}

function procedureNameWords(value) {
  return String(value || "").trim().match(/[\p{L}\p{N}]+/gu) || [];
}

export function procedureNameIssues(value) {
  const name = String(value || "").trim();
  if (!name) return ["Escribe el nombre del procedimiento."];

  const words = procedureNameWords(name);
  const normalizedWords = words.map(normalizedWord);
  const issues = [];
  if (words.length > 12) issues.push("El nombre puede tener máximo 12 palabras.");
  if (words.length < 2) issues.push("Incluye el objeto sobre el que actúa el procedimiento.");
  if (!/^[a-zñ]+(?:ar|er|ir)$/i.test(normalizedWords[0] || "")) {
    issues.push("Inicia con un verbo específico en infinitivo, por ejemplo: Formular, Elaborar, Supervisar o Evaluar.");
  } else if (GENERIC_PROCEDURE_VERBS.has(normalizedWords[0])) {
    issues.push("No uses verbos genéricos como Gestionar, Administrar o Realizar.");
  }
  if (PROCEDURE_TYPE_WORDS.has(normalizedWords.find(word => PROCEDURE_TYPE_WORDS.has(word)))) {
    issues.push("No incluyas Procedimiento, Proceso, Trámite, Instructivo ni Formato en el nombre.");
  }
  if (words.length === 2 && GENERIC_PROCEDURE_OBJECTS.has(normalizedWords[1])) {
    issues.push("Precisa el complemento del objeto genérico, por ejemplo el tipo o alcance de la solicitud.");
  }
  if (/\.$/.test(name)) issues.push("No uses punto final en el nombre.");
  if (/^\p{Ll}/u.test(name) || words.slice(1).some(word => /^\p{Lu}\p{Ll}/u.test(word))) {
    issues.push("Usa mayúscula solo en la primera letra; conserva las siglas institucionales en mayúscula.");
  }
  return issues;
}

function procedureCode(processCode, consecutive) {
  if (consecutive === undefined || consecutive === null || String(consecutive).trim() === "") return null;
  const value = String(consecutive).trim();
  if (!/^\d{1,3}$/.test(value) || Number(value) < 1 || Number(value) > 999) {
    throw new DraftError("invalid_procedure_code", 400);
  }
  return `${processCode}-P-${String(Number(value)).padStart(3, "0")}`;
}

function traceActor(user) {
  return String(user.displayName || user.username || user.id || "Elaborador").trim();
}

function recordResubmissionTrace(record, user, iteration) {
  if (record?.result !== "No cumple" || !record.response) return;
  const trace = Array.isArray(record.trace) ? structuredClone(record.trace).slice(-39) : [];
  trace.push({
    action: "Reenvío a evaluación",
    at: new Date().toISOString(),
    actor: traceActor(user),
    role: user.role,
    iteration
  });
  record.trace = trace;
}

function definitionIssues(value) {
  const entries = String(value || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!entries.length) return [];
  const parsed = entries.map(line => {
    const separator = line.indexOf(":");
    return separator > 0 && line.slice(separator + 1).trim() ? { term: line.slice(0, separator).trim(), line } : null;
  });
  if (parsed.some(entry => !entry)) return ["Registra cada definición con el término, dos puntos y su definición."];
  const collator = new Intl.Collator("es-CO", { sensitivity: "base" });
  const ordered = [...parsed].sort((left, right) => collator.compare(left.term, right.term));
  if (!parsed.every((entry, index) => entry.line === ordered[index].line)) {
    return ["Ordena las definiciones alfabéticamente antes de enviar."];
  }
  return [];
}

function submissionIssues(name, payload, code) {
  const fields = payload.fields && typeof payload.fields === "object" && !Array.isArray(payload.fields) ? payload.fields : {};
  const issues = [];
  for (const [key, label] of [["objetivo", "Objetivo"], ["alcance", "Alcance"], ["definiciones", "Definiciones"], ["condiciones", "Condiciones generales"]]) {
    if (typeof fields[key] !== "string" || !fields[key].trim()) issues.push(`Completa ${label.toLocaleLowerCase("es-CO")}.`);
  }
  issues.push(...definitionIssues(fields.definiciones));
  const norms = Array.isArray(payload.norms) ? payload.norms : [];
  const registeredNormTypes = new Set();
  norms.forEach((norm, index) => {
    if (!norm || !NORM_TYPES.includes(norm.tipo) || ["norma", "anio", "descripcion", "articulo", "entidad"].some(key => typeof norm[key] !== "string" || !norm[key].trim())) {
      issues.push(`Completa todos los datos de la norma ${index + 1}.`);
    } else {
      registeredNormTypes.add(norm.tipo);
    }
  });
  const settings = payload.settings && typeof payload.settings === "object" && !Array.isArray(payload.settings) ? payload.settings : {};
  const confirmedMissingNormTypes = new Set(Array.isArray(settings.normativityConfirmedMissingTypes)
    ? settings.normativityConfirmedMissingTypes.filter(type => NORM_TYPES.includes(type))
    : []);
  const pendingNormConfirmations = NORM_TYPES.filter(type => !registeredNormTypes.has(type) && !confirmedMissingNormTypes.has(type));
  if (pendingNormConfirmations.length) {
    issues.push(`Confirma la revisión de ${pendingNormConfirmations.map(type => `la normatividad ${type.toLocaleLowerCase("es-CO")}`).join(" y ")} antes de enviar.`);
  }
  const activities = Array.isArray(payload.activities) ? payload.activities : [];
  const flowIssues = reviewFlow(activities).filter(issue => issue.severity !== "warning");
  const completeness = reviewFlowCompleteness(activities);
  if (flowIssues.length) issues.push("Corrige las observaciones del flujo antes de enviar.");
  if (completeness.length) issues.push("Completa los datos obligatorios de las actividades y decisiones.");
  if (!activities.length) issues.push("Registra las actividades del procedimiento.");
  const annexesNotApplicable = settings.annexesNotApplicable === true;
  const annexes = Array.isArray(payload.annexes) ? payload.annexes : [];
  if (!annexesNotApplicable && !annexes.length) issues.push("Registra al menos un documento anexo o confirma No aplica.");
  annexes.forEach((annex, index) => {
    if (!annexesNotApplicable && (!annex || ["documento", "tipo", "codigo", "observacion"].some(key => typeof annex[key] !== "string" || !annex[key].trim()))) {
      issues.push(`Completa todos los datos del anexo ${index + 1}.`);
    }
  });
  const changes = Array.isArray(payload.changes) ? payload.changes : [];
  if (!changes.length) issues.push("Registra el control de cambios inicial.");
  changes.forEach((change, index) => {
    if (!change || ["version", "fecha", "razon"].some(key => typeof change[key] !== "string" || !change[key].trim())) {
      issues.push(`Completa todos los datos del cambio ${index + 1}.`);
    }
  });
  const roles = [fields.elaboro, fields.reviso, fields.aprobo];
  if (roles.some(role => typeof role !== "string" || !role.trim()) || new Set(roles.map(role => String(role).trim().toLocaleLowerCase("es-CO"))).size !== roles.length) {
    issues.push("Completa Elaboró, Revisó y Aprobó con cargos distintos.");
  }
  issues.push(...procedureNameIssues(name));
  if (!PROCEDURE_CODE_PATTERN.test(String(code || ""))) issues.push("Genera el código del procedimiento antes de enviarlo.");
  return issues;
}

function validPayload(payload) {
  return payload !== null && typeof payload === "object" && !Array.isArray(payload);
}

function validateDraft({ name, payload }) {
  const cleanName = typeof name === "string" ? name.trim() : "";
  const issues = [];
  if (cleanName.length > 200) issues.push("El nombre supera la longitud permitida.");
  if (!validPayload(payload)) issues.push("El contenido del borrador no es válido.");
  if (issues.length) throw new DraftError("invalid_draft", 400, issues);
  return cleanName;
}

function publicDraft(row, includePayload = false) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    processCode: row.process_code,
    assignedEvaluatorId: row.assigned_evaluator_id || null,
    version: row.version,
    status: row.status,
    revision: row.revision,
    updatedAt: row.updated_at,
    ...(includePayload ? { payload: row.current_payload } : {})
  };
}

export async function listOwnDrafts(pool, user) {
  if (!canPerform(user, ACTIONS.CREATE_PROCEDURE)) throw new DraftError("forbidden", 403);
  const result = await pool.query(
    `SELECT id, code, name, process_code, version, status, revision, updated_at
     FROM procedures p WHERE created_by_user_id = $1
       AND ($2 OR EXISTS (SELECT 1 FROM user_processes up
                          WHERE up.user_id = $1 AND up.process_code = p.process_code))
     ORDER BY updated_at DESC`,
    [user.id, user.role === ROLES.ADMIN]
  );
  return result.rows.map(row => publicDraft(row));
}

export async function getOwnDraft(pool, user, id) {
  if (!canPerform(user, ACTIONS.CREATE_PROCEDURE)) throw new DraftError("forbidden", 403);
  const result = await pool.query(
    `SELECT id, code, name, process_code, version, status, revision, updated_at, current_payload
     FROM procedures p WHERE id = $1 AND created_by_user_id = $2
       AND ($3 OR EXISTS (SELECT 1 FROM user_processes up
                          WHERE up.user_id = $2 AND up.process_code = p.process_code))`,
    [id, user.id, user.role === ROLES.ADMIN]
  );
  if (!result.rows[0]) throw new DraftError("draft_not_found", 404);
  return publicDraft(result.rows[0], true);
}

export async function listInstitutionalReports(pool, user) {
  if (user.role !== ROLES.ADMIN || !canPerform(user, ACTIONS.GENERATE_BRANDED_PDF, {
    procedure: { status: PROCEDURE_STATUS.FAVORABLE }
  })) {
    throw new DraftError("forbidden", 403);
  }
  const result = await pool.query(
    `SELECT id, code, name, process_code, version, status, revision, updated_at
       FROM procedures
      WHERE status = $1
      ORDER BY updated_at DESC, name`,
    [PROCEDURE_STATUS.FAVORABLE]
  );
  return result.rows.map(row => publicDraft(row));
}

export async function getProcedureReport(pool, user, id) {
  const result = await pool.query(
    `SELECT p.id, p.code, p.name, p.process_code, p.version, p.status, p.revision,
            p.updated_at, p.current_payload, p.created_by_user_id, p.assigned_evaluator_id,
            EXISTS (SELECT 1 FROM user_processes up
                     WHERE up.user_id = p.created_by_user_id AND up.process_code = p.process_code) AS author_process_access,
            EXISTS (SELECT 1 FROM user_processes up
                     WHERE up.user_id = $2 AND up.process_code = p.process_code) AS evaluator_process_access
       FROM procedures p
      WHERE p.id = $1`,
    [id, user.id]
  );
  const row = result.rows[0];
  if (!row) throw new DraftError("draft_not_found", 404);

  const procedure = {
    status: row.status,
    processCode: row.process_code,
    createdByUserId: row.created_by_user_id,
    assignedEvaluatorId: row.assigned_evaluator_id
  };
  const institutional = user.role === ROLES.ADMIN;
  const action = institutional ? ACTIONS.GENERATE_BRANDED_PDF : ACTIONS.GENERATE_UNBRANDED_PDF;
  const permissionUser = user.role === ROLES.EVALUADOR && row.evaluator_process_access
    ? { ...user, processCodes: [row.process_code] }
    : user;
  const authorHasAccess = user.role !== ROLES.ELABORADOR || row.author_process_access;
  if (!authorHasAccess || !canPerform(permissionUser, action, { procedure })) {
    throw new DraftError("forbidden", 403);
  }
  return {
    procedure: publicDraft(row, true),
    branding: institutional ? "institutional" : "standard"
  };
}

export async function createDraft(pool, user, { name, processCode, consecutive, payload }) {
  if (!canPerform(user, ACTIONS.CREATE_PROCEDURE)) throw new DraftError("forbidden", 403);
  const cleanName = validateDraft({ name, payload });
  if (typeof processCode !== "string" || !/^[A-Z]{2,3}$/.test(processCode)) {
    throw new DraftError("invalid_process", 400);
  }
  const code = procedureCode(processCode, consecutive);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const process = await client.query(
      `SELECT 1 FROM processes p WHERE p.code = $1 AND p.active = TRUE
       AND ($3 OR EXISTS (SELECT 1 FROM user_processes up
                          WHERE up.user_id = $2 AND up.process_code = p.code))`,
      [processCode, user.id, user.role === ROLES.ADMIN]
    );
    if (!process.rows.length) throw new DraftError("invalid_process", 400);
    const result = await client.query(
      `INSERT INTO procedures (id, name, code, process_code, status, created_by_user_id, current_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING id, code, name, process_code, version, status, revision, updated_at, current_payload`,
      [randomUUID(), cleanName, code, processCode, PROCEDURE_STATUS.DRAFT, user.id, JSON.stringify(payload)]
    );
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, event_type, entity_type, entity_id)
       VALUES ($1, $2, 'procedure_draft_created', 'procedure', $3)`,
      [randomUUID(), user.id, result.rows[0].id]
    );
    await client.query("COMMIT");
    return publicDraft(result.rows[0], true);
  } catch (error) {
    await client.query("ROLLBACK");
    if (error?.code === "23505" && error?.constraint === "procedures_code_unique") {
      throw new DraftError("procedure_code_taken", 409);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOwnDraft(pool, user, id, { name, consecutive, payload, revision }) {
  const cleanName = validateDraft({ name, payload });
  if (!Number.isSafeInteger(revision) || revision < 1) throw new DraftError("invalid_revision", 400);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT id, status, code, process_code, created_by_user_id, revision
       FROM procedures p WHERE id = $1 AND created_by_user_id = $2
         AND ($3 OR EXISTS (SELECT 1 FROM user_processes up
                            WHERE up.user_id = $2 AND up.process_code = p.process_code))
       FOR UPDATE`,
      [id, user.id, user.role === ROLES.ADMIN]
    );
    const procedure = found.rows[0];
    if (!procedure) throw new DraftError("draft_not_found", 404);
    if (!canPerform(user, ACTIONS.EDIT_PROCEDURE, { procedure: { status: procedure.status, createdByUserId: procedure.created_by_user_id } })) {
      throw new DraftError("draft_locked", 403);
    }
    if (procedure.revision !== revision) throw new DraftError("draft_conflict", 409);
    const code = consecutive === undefined ? procedure.code : procedureCode(procedure.process_code, consecutive);
    if (procedure.status !== PROCEDURE_STATUS.DRAFT && procedure.code && code !== procedure.code) {
      throw new DraftError("procedure_code_locked", 409);
    }
    const result = await client.query(
      `UPDATE procedures SET name = $2, code = $3, current_payload = $4::jsonb, revision = revision + 1, updated_at = now()
       WHERE id = $1 RETURNING id, code, name, process_code, version, status, revision, updated_at, current_payload`,
      [id, cleanName, code, JSON.stringify(payload)]
    );
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, event_type, entity_type, entity_id)
       VALUES ($1, $2, 'procedure_draft_updated', 'procedure', $3)`,
      [randomUUID(), user.id, id]
    );
    await client.query("COMMIT");
    return publicDraft(result.rows[0], true);
  } catch (error) {
    await client.query("ROLLBACK");
    if (error?.code === "23505" && error?.constraint === "procedures_code_unique") {
      throw new DraftError("procedure_code_taken", 409);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function listProcessEvaluators(pool, user, processCode) {
  if (![ROLES.ELABORADOR, ROLES.ADMIN].includes(user.role) || !/^[A-Z]{2,3}$/.test(String(processCode || ""))) {
    throw new DraftError("forbidden", 403);
  }
  const process = await pool.query(
    `SELECT 1 FROM processes p WHERE p.code = $1 AND p.active = TRUE
       AND ($3 OR EXISTS (SELECT 1 FROM user_processes up WHERE up.user_id = $2 AND up.process_code = p.code))`,
    [processCode, user.id, user.role === ROLES.ADMIN]
  );
  if (!process.rows.length) throw new DraftError("invalid_process", 400);
  const result = await pool.query(
    `SELECT u.id, u.display_name AS "displayName"
       FROM app_users u JOIN user_processes up ON up.user_id = u.id
      WHERE u.role = 'evaluador' AND u.active = TRUE AND u.must_change_password = FALSE
        AND up.process_code = $1
      ORDER BY u.display_name, u.id`,
    [processCode]
  );
  return result.rows;
}

export async function submitOwnDraft(pool, user, id, { evaluatorId, revision }) {
  if (!Number.isSafeInteger(revision) || revision < 1) throw new DraftError("invalid_revision", 400);
  if (typeof evaluatorId !== "string" || !/^[0-9a-fA-F-]{36}$/.test(evaluatorId)) throw new DraftError("evaluator_unavailable", 400);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT p.id, p.code, p.name, p.process_code, p.version, p.status, p.revision,
              p.current_payload, p.created_by_user_id, p.assigned_evaluator_id
         FROM procedures p WHERE p.id = $1 AND p.created_by_user_id = $2
           AND EXISTS (SELECT 1 FROM user_processes up WHERE up.user_id = $2 AND up.process_code = p.process_code)
         FOR UPDATE`,
      [id, user.id]
    );
    const procedure = found.rows[0];
    if (!procedure) throw new DraftError("draft_not_found", 404);
    if (procedure.revision !== revision) throw new DraftError("draft_conflict", 409);
    const issues = submissionIssues(procedure.name, procedure.current_payload, procedure.code);
    let nextEvaluationPayload = { rubricVersion: EVALUATION_RUBRIC_VERSION, iteration: 1 };
    if (procedure.status === PROCEDURE_STATUS.RETURNED) {
      const previous = await client.query(
        `SELECT id, status, criteria_payload FROM evaluations WHERE procedure_id = $1
          ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`,
        [id]
      );
      const stored = previous.rows[0]?.criteria_payload;
      const criteria = stored?.criteria && typeof stored.criteria === "object" ? stored.criteria : stored;
      const missingResponses = missingCorrectionResponses(criteria);
      if (previous.rows[0]?.status !== PROCEDURE_STATUS.RETURNED ||
          !criteria || typeof criteria !== "object" || Array.isArray(criteria) || missingResponses.length) {
        throw new DraftError("correction_responses_required", 400, missingResponses);
      }
      const copiedCriteria = structuredClone(criteria);
      const nextIteration = Number(stored?.iteration || 1) + 1;
      for (const record of Object.values(copiedCriteria)) {
        if (record?.result === "No cumple" && record.response) {
          record.findingStatus = "Respondido";
          recordResubmissionTrace(record, user, nextIteration);
        }
      }
      nextEvaluationPayload = {
        ...nextEvaluationPayload,
        iteration: nextIteration,
        previousEvaluationId: previous.rows[0].id,
        criteria: copiedCriteria
      };
    }
    const evaluator = await client.query(
      `SELECT 1 FROM app_users u JOIN user_processes up ON up.user_id = u.id
        WHERE u.id = $1 AND u.role = 'evaluador' AND u.active = TRUE
          AND u.must_change_password = FALSE AND up.process_code = $2`,
      [evaluatorId, procedure.process_code]
    );
    const permissionContext = {
      procedure: {
        status: procedure.status,
        createdByUserId: procedure.created_by_user_id,
        assignedEvaluatorId: evaluator.rows.length ? evaluatorId : null,
        isComplete: issues.length === 0
      }
    };
    if (!evaluator.rows.length) throw new DraftError("evaluator_unavailable", 400);
    if (!canPerform(user, ACTIONS.SUBMIT_FOR_REVIEW, permissionContext)) {
      if (issues.length) throw new DraftError("submission_incomplete", 400, issues);
      throw new DraftError("draft_locked", 403);
    }
    const updated = await client.query(
      `UPDATE procedures SET status = $2, assigned_evaluator_id = $3,
              revision = revision + 1, updated_at = now()
        WHERE id = $1
        RETURNING id, code, name, process_code, version, status, revision, updated_at,
                  current_payload, assigned_evaluator_id`,
      [id, PROCEDURE_STATUS.SUBMITTED, evaluatorId]
    );
    await client.query(
      `INSERT INTO evaluations (id, procedure_id, evaluator_id, status, criteria_payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [randomUUID(), id, evaluatorId, PROCEDURE_STATUS.SUBMITTED,
        JSON.stringify({ ...nextEvaluationPayload, submittedRevision: updated.rows[0].revision })]
    );
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, event_type, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'procedure_submitted_for_review', 'procedure', $3, $4::jsonb)`,
      [randomUUID(), user.id, id, JSON.stringify({ evaluatorId, revision: updated.rows[0].revision })]
    );
    await client.query(
      `INSERT INTO user_notifications (id, recipient_user_id, procedure_id, event_type, title, message)
       VALUES ($1, $2, $3, 'procedure_submitted_for_review', $4, $5)`,
      [randomUUID(), evaluatorId, id, "Nuevo procedimiento para revisión", `«${procedure.name}» fue enviado a tu bandeja de evaluación.`]
    );
    await client.query("COMMIT");
    return publicDraft(updated.rows[0], true);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listAssignedProcedures(pool, user) {
  if (user.role !== ROLES.EVALUADOR) throw new DraftError("forbidden", 403);
  const result = await pool.query(
    `SELECT p.id, p.code, p.name, p.process_code, p.version, p.status, p.revision,
            p.updated_at, p.current_payload, p.assigned_evaluator_id
       FROM procedures p JOIN user_processes up ON up.process_code = p.process_code AND up.user_id = $1
      WHERE p.assigned_evaluator_id = $1 AND p.status IN ($2, $3, $4, $5, $6, $7)
      ORDER BY p.updated_at DESC`,
    [user.id, PROCEDURE_STATUS.SUBMITTED, PROCEDURE_STATUS.IN_REVIEW, PROCEDURE_STATUS.CORRECTED,
      PROCEDURE_STATUS.RETURNED, PROCEDURE_STATUS.FAVORABLE, PROCEDURE_STATUS.UNFAVORABLE]
  );
  return result.rows.map(row => publicDraft(row));
}

export async function getAssignedProcedure(pool, user, id) {
  if (user.role !== ROLES.EVALUADOR) throw new DraftError("forbidden", 403);
  const result = await pool.query(
    `SELECT p.id, p.code, p.name, p.process_code, p.version, p.status, p.revision,
            p.updated_at, p.current_payload, p.assigned_evaluator_id
       FROM procedures p JOIN user_processes up ON up.process_code = p.process_code AND up.user_id = $2
      WHERE p.id = $1 AND p.assigned_evaluator_id = $2
        AND p.status IN ($3, $4, $5, $6, $7, $8)`,
    [id, user.id, PROCEDURE_STATUS.SUBMITTED, PROCEDURE_STATUS.IN_REVIEW, PROCEDURE_STATUS.CORRECTED,
      PROCEDURE_STATUS.RETURNED, PROCEDURE_STATUS.FAVORABLE, PROCEDURE_STATUS.UNFAVORABLE]
  );
  if (!result.rows[0]) throw new DraftError("draft_not_found", 404);
  return publicDraft(result.rows[0], true);
}

export async function startAssignedEvaluation(pool, user, id) {
  if (user.role !== ROLES.EVALUADOR) throw new DraftError("forbidden", 403);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT p.id, p.status, p.assigned_evaluator_id, p.created_by_user_id, p.name
         FROM procedures p JOIN user_processes up ON up.process_code = p.process_code AND up.user_id = $2
        WHERE p.id = $1 AND p.assigned_evaluator_id = $2 FOR UPDATE OF p`,
      [id, user.id]
    );
    const procedure = found.rows[0];
    if (!procedure) throw new DraftError("draft_not_found", 404);
    if (![PROCEDURE_STATUS.SUBMITTED, PROCEDURE_STATUS.CORRECTED].includes(procedure.status)) {
      throw new DraftError("draft_locked", 403);
    }
    const result = await client.query(
      `UPDATE procedures SET status = $2, revision = revision + 1, updated_at = now()
        WHERE id = $1 RETURNING id, code, name, process_code, version, status, revision, updated_at, current_payload, assigned_evaluator_id`,
      [id, PROCEDURE_STATUS.IN_REVIEW]
    );
    await client.query(
      `UPDATE evaluations SET status = $2, updated_at = now()
        WHERE id = (SELECT id FROM evaluations WHERE procedure_id = $1 AND evaluator_id = $3 ORDER BY created_at DESC LIMIT 1)`,
      [id, PROCEDURE_STATUS.IN_REVIEW, user.id]
    );
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, event_type, entity_type, entity_id)
       VALUES ($1, $2, 'procedure_evaluation_started', 'procedure', $3)`,
      [randomUUID(), user.id, id]
    );
    await client.query(
      `INSERT INTO user_notifications (id, recipient_user_id, procedure_id, event_type, title, message)
       VALUES ($1, $2, $3, 'procedure_evaluation_started', $4, $5)`,
      [randomUUID(), procedure.created_by_user_id, id, "La evaluación comenzó", `El Evaluador inició la revisión de «${procedure.name}».`]
    );
    await client.query("COMMIT");
    return publicDraft(result.rows[0], true);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
