import test from "node:test";
import assert from "node:assert/strict";
import {
  EVALUATION_CRITERIA,
  EVALUATION_GROUPS,
  evaluationIsFavorable,
  evaluationMetrics,
  missingCorrectionResponses,
  sanitizeEvaluationCriteria,
  validateEvaluation
} from "../src/domain/evaluation-rubric.js";
import { decideAssignedEvaluation, saveAssignedEvaluation, saveAuthorEvaluationResponses } from "../src/domain/evaluations.js";
import { PROCEDURE_STATUS } from "../src/domain/workflow.js";
import { createAppServer } from "../src/server.js";
import { hashToken } from "../src/security/auth.js";

const procedureId = "11111111-1111-4111-8111-111111111111";
const evaluator = { id: "22222222-2222-4222-8222-222222222222", role: "evaluador", active: true };
const author = { id: "33333333-3333-4333-8333-333333333333", role: "elaborador", active: true };

function criteriaWith(result = "Cumple") {
  return Object.fromEntries(EVALUATION_CRITERIA.map(criterion => [criterion.id, {
    result, observation: "Revisión documentada", adjustment: result === "No cumple" ? "Ajustar el procedimiento" : "",
    findingStatus: result === "No cumple" ? "Pendiente" : "Cerrado", response: ""
  }]));
}

function evaluationPool() {
  const calls = [];
  const procedure = {
    id: procedureId, version: "1.0", status: PROCEDURE_STATUS.IN_REVIEW,
    assigned_evaluator_id: evaluator.id, created_by_user_id: author.id,
    process_code: "PD", name: "Procedimiento de prueba"
  };
  const evaluation = {
    id: "44444444-4444-4444-8444-444444444444", status: PROCEDURE_STATUS.IN_REVIEW,
    score: null, critical_failures: 0, open_findings: 0, concept: "",
    criteria_payload: { submittedRevision: 4 }, created_at: new Date(), updated_at: new Date()
  };
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
      if (sql.startsWith("SELECT p.id")) return { rows: params[1] === evaluator.id ? [{ ...procedure }] : [] };
      if (sql.startsWith("SELECT id, version, status FROM procedures")) return { rows: params[1] === author.id ? [{ ...procedure }] : [] };
      if (sql.startsWith("SELECT id, status, score")) return { rows: [{ ...evaluation }] };
      if (sql.startsWith("SELECT id, status, criteria_payload FROM evaluations")) return { rows: [{ ...evaluation }] };
      if (sql.startsWith("UPDATE evaluations") && sql.includes("RETURNING")) {
        Object.assign(evaluation, {
          score: params[1], critical_failures: params[2], open_findings: params[3],
          concept: params[4], criteria_payload: JSON.parse(params[5])
        });
        return { rows: [{ ...evaluation }] };
      }
      if (sql.startsWith("UPDATE evaluations") && sql.includes("criteria_payload = $2")) {
        evaluation.criteria_payload = JSON.parse(params[1]);
        return { rows: [] };
      }
      if (sql.startsWith("UPDATE evaluations")) {
        evaluation.status = params[1];
        return { rows: [] };
      }
      if (sql.startsWith("UPDATE procedures")) {
        procedure.status = params[1];
        return { rows: [] };
      }
      if (sql.startsWith("INSERT INTO audit_events") || sql.startsWith("INSERT INTO user_notifications")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  };
  return { calls, procedure, evaluation, connect: async () => client };
}

test("original evaluation rubric has 31 criteria, nine variables, and 100 percent total weight", () => {
  assert.equal(EVALUATION_CRITERIA.length, 31);
  assert.equal(EVALUATION_GROUPS.length, 9);
  assert.equal(EVALUATION_GROUPS.reduce((total, group) => total + group.weight, 0), 100);
  assert.equal(new Set(EVALUATION_CRITERIA.map(criterion => criterion.id)).size, 31);
});

test("weighted score, critical findings, and initial-version No aplica are calculated on the server", () => {
  const criteria = criteriaWith();
  assert.deepEqual([evaluationMetrics(criteria, "1.0").score, evaluationMetrics(criteria, "1.0").complete], [100, true]);
  criteria.con1 = { result: "No cumple", observation: "Falta control", adjustment: "Definir control", findingStatus: "Pendiente" };
  const metrics = evaluationMetrics(criteria, "1.0");
  assert.equal(metrics.score, 93.3);
  assert.equal(metrics.criticalFailures, 1);
  assert.equal(metrics.openFindings, 1);
  assert.equal(evaluationIsFavorable(metrics), false);
  criteria.cam1.result = "No aplica";
  criteria.cam4.result = "No aplica";
  assert.equal(sanitizeEvaluationCriteria(criteria, "1.0").issues.length, 0);
  assert.equal(sanitizeEvaluationCriteria(criteria, "2.0").issues.length, 2);
});

test("completion requires each result, observation, and adjustment for failed criteria", () => {
  const criteria = criteriaWith();
  criteria.obj1.result = "";
  criteria.obj2.observation = "";
  criteria.con1 = { result: "No cumple", observation: "Hallazgo", adjustment: "", findingStatus: "Pendiente", response: "" };
  assert.deepEqual(validateEvaluation(criteria, "1.0"), [
    "Falta evaluar el criterio obj1.",
    "Falta la observación del criterio obj2.",
    "Falta el ajuste requerido para el criterio con1."
  ]);
  assert.deepEqual(missingCorrectionResponses(criteria), ["con1"]);
});

test("assigned evaluator saves criteria and concept; another evaluator cannot edit", async () => {
  const pool = evaluationPool();
  const saved = await saveAssignedEvaluation(pool, evaluator, procedureId, { criteria: criteriaWith(), concept: "  Favorable  " });
  assert.equal(saved.score, 100);
  assert.equal(saved.concept, "Favorable");
  assert.equal(saved.metrics.answered, 31);
  assert.ok(pool.calls.some(call => call.sql.includes("JOIN user_processes") && call.sql.includes("FOR UPDATE OF p")));
  assert.ok(pool.calls.some(call => call.sql.startsWith("INSERT INTO audit_events")));
  await assert.rejects(saveAssignedEvaluation(pool, { ...evaluator, id: "other" }, procedureId, {
    criteria: criteriaWith(), concept: "Otro"
  }), { code: "draft_not_found", status: 404 });
});

test("favorable concept is atomic and rejects incomplete or critical evaluations", async () => {
  const pool = evaluationPool();
  await saveAssignedEvaluation(pool, evaluator, procedureId, { criteria: criteriaWith(), concept: "Concepto técnico" });
  const decision = await decideAssignedEvaluation(pool, evaluator, procedureId, { decision: "favorable" });
  assert.equal(decision.status, PROCEDURE_STATUS.FAVORABLE);
  assert.equal(pool.procedure.status, PROCEDURE_STATUS.FAVORABLE);
  assert.equal(pool.evaluation.status, PROCEDURE_STATUS.FAVORABLE);
  assert.ok(pool.calls.some(call => call.sql.startsWith("INSERT INTO user_notifications") && call.params[3] === "procedure_favorable_concept_issued"));

  const critical = evaluationPool();
  const criteria = criteriaWith();
  criteria.con1 = { result: "No cumple", observation: "Incumple", adjustment: "Ajustar", findingStatus: "Pendiente" };
  await saveAssignedEvaluation(critical, evaluator, procedureId, { criteria, concept: "Debe corregir" });
  await assert.rejects(decideAssignedEvaluation(critical, evaluator, procedureId, { decision: "favorable" }), { code: "evaluation_favorable_conditions_unmet" });
  assert.equal(critical.procedure.status, PROCEDURE_STATUS.IN_REVIEW);

  const incomplete = evaluationPool();
  const partial = criteriaWith();
  partial.obj2.result = "";
  await saveAssignedEvaluation(incomplete, evaluator, procedureId, { criteria: partial, concept: "Prueba incompleta" });
  await assert.rejects(decideAssignedEvaluation(incomplete, evaluator, procedureId, { decision: "favorable" }), { code: "evaluation_incomplete" });
  assert.equal(incomplete.procedure.status, PROCEDURE_STATUS.IN_REVIEW);
});

test("returning findings lets the author answer before a new review", async () => {
  const pool = evaluationPool();
  const criteria = criteriaWith();
  criteria.act1 = { result: "No cumple", observation: "La secuencia no es clara", adjustment: "Reordenar actividades", findingStatus: "Pendiente", response: "" };
  await saveAssignedEvaluation(pool, evaluator, procedureId, { criteria, concept: "Solicito ajuste de secuencia" });
  const decision = await decideAssignedEvaluation(pool, evaluator, procedureId, { decision: "devolver" });
  assert.equal(decision.status, PROCEDURE_STATUS.RETURNED);
  assert.equal(pool.procedure.status, PROCEDURE_STATUS.RETURNED);
  const answer = await saveAuthorEvaluationResponses(pool, author, procedureId, { act1: "Reordené las actividades" });
  assert.equal(answer.missingResponses, 0);
  assert.equal(pool.evaluation.criteria_payload.criteria.act1.response, "Reordené las actividades");
  await assert.rejects(saveAuthorEvaluationResponses(pool, evaluator, procedureId, { act1: "Otro" }), { code: "forbidden" });
});

test("complete failing review can issue a non-favorable concept", async () => {
  const pool = evaluationPool();
  await saveAssignedEvaluation(pool, evaluator, procedureId, { criteria: criteriaWith("No cumple"), concept: "No satisface los criterios" });
  const decision = await decideAssignedEvaluation(pool, evaluator, procedureId, { decision: "no_favorable" });
  assert.equal(decision.status, PROCEDURE_STATUS.UNFAVORABLE);
  assert.equal(decision.metrics.score, 0);
  assert.ok(pool.calls.some(call => call.sql.startsWith("INSERT INTO user_notifications") && call.params[3] === "procedure_unfavorable_concept_issued"));
});

test("evaluation HTTP routes require a session, CSRF, and the assigned evaluator", async () => {
  const pool = evaluationPool();
  const token = "evaluator-session";
  const authorToken = "author-session";
  const csrf = "evaluation-csrf";
  const sessions = new Map([
    [hashToken(token), { session_id: procedureId, csrf_token_hash: hashToken(csrf), id: evaluator.id, username: "eval", display_name: "Evaluator", role: "evaluador", must_change_password: false }],
    [hashToken(authorToken), { session_id: procedureId, csrf_token_hash: hashToken(csrf), id: author.id, username: "author", display_name: "Author", role: "elaborador", must_change_password: false }]
  ]);
  const poolFactory = () => ({
    connect: pool.connect,
    async query(sql, params) {
      if (sql.includes("FROM app_sessions s")) return { rows: [sessions.get(params[0])].filter(Boolean) };
      if (sql.startsWith("UPDATE app_sessions SET last_seen_at")) return { rows: [] };
      if (sql.startsWith("SELECT p.id")) return { rows: [{ ...pool.procedure, revision: 4, current_payload: {} }] };
      if (sql.startsWith("SELECT p.version")) return { rows: [{ ...pool.evaluation, version: pool.procedure.version }] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async end() {}
  });
  const server = createAppServer({ poolFactory, secureCookies: false });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const url = `${base}/api/evaluator/procedures/${procedureId}/evaluation`;
  const body = JSON.stringify({ criteria: criteriaWith(), concept: "Aprobado" });
  try {
    assert.equal((await fetch(`${base}/api/evaluator/rubric`)).status, 401);
    const rubric = await fetch(`${base}/api/evaluator/rubric`, { headers: { cookie: `__Host-asistente_session=${authorToken}` } });
    assert.equal(rubric.status, 200);
    assert.equal((await rubric.json()).rubric.groups.length, 9);
    assert.equal((await fetch(url, { method: "PUT", headers: { "content-type": "application/json" }, body })).status, 401);
    assert.equal((await fetch(url, { method: "PUT", headers: { cookie: `__Host-asistente_session=${token}`, "content-type": "application/json" }, body })).status, 403);
    assert.equal((await fetch(url, { method: "PUT", headers: { cookie: `__Host-asistente_session=${authorToken}`, "x-csrf-token": csrf, "content-type": "application/json" }, body })).status, 403);
    const response = await fetch(url, { method: "PUT", headers: { cookie: `__Host-asistente_session=${token}`, "x-csrf-token": csrf, "content-type": "application/json" }, body });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).evaluation.score, 100);
    const detail = await fetch(`${base}/api/evaluator/procedures/${procedureId}`, { headers: { cookie: `__Host-asistente_session=${token}` } });
    assert.equal(detail.status, 200);
    assert.equal((await detail.json()).evaluation.criteria.obj1.result, "Cumple");
    pool.procedure.status = PROCEDURE_STATUS.RETURNED;
    pool.evaluation.status = PROCEDURE_STATUS.RETURNED;
    pool.evaluation.criteria_payload.criteria.act1 = {
      result: "No cumple", observation: "Hallazgo", adjustment: "Corregir", findingStatus: "Pendiente", response: ""
    };
    const responseUrl = `${base}/api/procedures/${procedureId}/evaluation-responses`;
    const responseBody = JSON.stringify({ responses: { act1: "Se corrigió la secuencia" } });
    assert.equal((await fetch(responseUrl, { method: "PUT", headers: { cookie: `__Host-asistente_session=${authorToken}`, "content-type": "application/json" }, body: responseBody })).status, 403);
    assert.equal((await fetch(responseUrl, { method: "PUT", headers: { cookie: `__Host-asistente_session=${token}`, "x-csrf-token": csrf, "content-type": "application/json" }, body: responseBody })).status, 403);
    const authorResponse = await fetch(responseUrl, { method: "PUT", headers: { cookie: `__Host-asistente_session=${authorToken}`, "x-csrf-token": csrf, "content-type": "application/json" }, body: responseBody });
    assert.equal(authorResponse.status, 200);
    assert.equal((await authorResponse.json()).missingResponses, 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
