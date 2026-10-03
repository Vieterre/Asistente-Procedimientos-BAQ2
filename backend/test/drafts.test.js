import test from "node:test";
import assert from "node:assert/strict";
import { createAppServer } from "../src/server.js";
import { createDraft, getAssignedProcedure, getOwnDraft, listAssignedProcedures, listOwnDrafts, listProcessEvaluators, startAssignedEvaluation, submitOwnDraft, updateOwnDraft } from "../src/domain/drafts.js";
import { reviewFlow, reviewFlowCompleteness } from "../src/domain/flow-review.js";
import { hashToken } from "../src/security/auth.js";

const author = { id: "11111111-1111-4111-8111-111111111111", role: "elaborador", mustChangePassword: false };
const other = { id: "22222222-2222-4222-8222-222222222222", role: "elaborador", mustChangePassword: false };
const draftId = "33333333-3333-4333-8333-333333333333";

test("flow review detects missing boundaries, broken routes, and duplicate identifiers", () => {
  const broken = reviewFlow([
    { uid: "start", tipo: "Inicio" },
    { uid: "choice", tipo: "Decisión", decisionSi: "end", decisionNo: "missing" },
    { uid: "connector", tipo: "Conector", connectorDestino: "" },
    { uid: "end", tipo: "Fin" }
  ]);
  assert.ok(broken.some(issue => issue.index === 1 && issue.message === "Ruta No: el destino no es válido."));
  assert.ok(broken.some(issue => issue.index === 2 && issue.message === "Destino del conector: selecciona un destino."));
  assert.deepEqual(reviewFlow([{ uid: "same", tipo: "Inicio" }, { uid: "same", tipo: "Fin" }]), [
    { index: 1, message: "El identificador del elemento está repetido." }
  ]);
  assert.equal(reviewFlow([{ uid: "start", tipo: "Inicio" }]).length, 1);
  assert.deepEqual(reviewFlow([{ uid: "start", tipo: "Inicio" }, { uid: "end", tipo: "Fin" }]), []);
});

test("flow review rejects identical decision routes and cycles without an exit", () => {
  const activities = [
    { uid: "start", tipo: "Inicio" },
    { uid: "choice", tipo: "Decisión", decisionSi: "loop", decisionNo: "loop" },
    { uid: "loop", tipo: "Conector", connectorId: "A", connectorDestino: "choice" },
    { uid: "end", tipo: "Fin" }
  ];
  const issues = reviewFlow(activities);
  assert.ok(issues.some(issue => issue.message === "Las rutas Sí y No deben tener destinos diferentes."));
  assert.ok(issues.some(issue => issue.message === "Hay un ciclo sin salida hacia Fin."));
  assert.ok(issues.some(issue => issue.index === 3 && issue.message === "No se puede alcanzar este elemento desde Inicio."));
  activities[1].decisionNo = "end";
  assert.ok(reviewFlow(activities).every(issue => issue.severity === "warning"));
});

test("flow review checks the negative route and required control details", () => {
  const activities = [
    { uid: "start", tipo: "Inicio" },
    { uid: "choice", tipo: "Decisión", decisionSi: "end", decisionNo: "control" },
    { uid: "control", tipo: "Actividad", tieneControl: true },
    { uid: "end", tipo: "Fin" }
  ];
  let issues = reviewFlow(activities);
  assert.ok(issues.some(issue => issue.index === 1 && issue.message.includes("ruta No")));
  assert.ok(issues.some(issue => issue.index === 2 && issue.message.includes("campos obligatorios")));
  activities.splice(2, 0, { uid: "correction", tipo: "Actividad" });
  activities[1].decisionNo = "correction";
  Object.assign(activities[3], {
    controlResponsable: "Profesional", controlPeriodicidad: "Cada trámite", controlAccion: "Verifica",
    controlEjecucion: "Compara", controlDesviacion: "Devuelve", controlEvidencia: "Registro"
  });
  issues = reviewFlow(activities);
  assert.ok(issues.every(issue => issue.severity === "warning"));
  assert.ok(issues.some(issue => issue.message.includes("no reconvergen")));
});

test("flow review rejects missing or duplicate connector labels", () => {
  const activities = [
    { uid: "start", tipo: "Inicio" },
    { uid: "one", tipo: "Conector", connectorId: "A", connectorDestino: "two" },
    { uid: "two", tipo: "Conector", connectorId: " a ", connectorDestino: "end" },
    { uid: "end", tipo: "Fin" }
  ];
  assert.ok(reviewFlow(activities).some(issue => issue.index === 2 && issue.message === "El identificador del conector está repetido."));
  activities[2].connectorId = "";
  assert.ok(reviewFlow(activities).some(issue => issue.index === 2 && issue.message === "El conector necesita un identificador."));
  activities[2].connectorId = "B";
  assert.deepEqual(reviewFlow(activities), []);
});

test("flow review rejects unknown node types and deleted destinations", () => {
  const activities = [
    { uid: "start", tipo: "Inicio" },
    { uid: "choice", tipo: "Decisión", decisionSi: "end", decisionNo: "removed" },
    { uid: "unknown", tipo: "Tarea" },
    { uid: "end", tipo: "Fin" }
  ];
  const issues = reviewFlow(activities);
  assert.ok(issues.some(issue => issue.index === 1 && issue.message === "Ruta No: el destino no es válido."));
  assert.ok(issues.some(issue => issue.index === 2 && issue.message === "El tipo de elemento no es válido."));
});

test("flow review accepts a correction loop with an exit but rejects a closed loop", () => {
  const activities = [
    { uid: "start", tipo: "Inicio" },
    { uid: "correction", tipo: "Actividad" },
    { uid: "choice", tipo: "Decisión", decisionSi: "end", decisionNo: "correction" },
    { uid: "end", tipo: "Fin" }
  ];
  const review = reviewFlow(activities);
  assert.ok(review.every(issue => issue.severity === "warning"));
  assert.ok(review.some(issue => issue.message.includes("condición de salida")));
  activities[2].decisionSi = "correction";
  const issues = reviewFlow(activities);
  assert.ok(issues.some(issue => issue.message === "Las rutas Sí y No deben tener destinos diferentes."));
  assert.ok(issues.some(issue => issue.message === "Hay un ciclo sin salida hacia Fin."));
});

test("flow review does not warn when decision branches reconverge", () => {
  const activities = [
    { uid: "start", tipo: "Inicio" },
    { uid: "choice", tipo: "Decisión", decisionSi: "yes", decisionNo: "no" },
    { uid: "yes", tipo: "Conector", connectorId: "A", connectorDestino: "join" },
    { uid: "no", tipo: "Actividad" },
    { uid: "join", tipo: "Actividad" },
    { uid: "end", tipo: "Fin" }
  ];
  assert.deepEqual(reviewFlow(activities), []);
});

test("flow completeness is separate from graph coherence", () => {
  const activities = [
    { uid: "start", tipo: "Inicio", descripcion: "Solicitud recibida" },
    { uid: "plan", tipo: "Actividad", actividad: "PLANIFICAR", descripcion: "", responsable: "Planeación" },
    { uid: "choice", tipo: "Decisión", descripcion: "¿Todo bien?", responsable: "", decisionSi: "end", decisionNo: "plan" },
    { uid: "end", tipo: "Fin", descripcion: "" }
  ];
  assert.ok(reviewFlow(activities).every(issue => issue.severity === "warning"));
  assert.deepEqual(reviewFlowCompleteness(activities), [
    { index: 1, message: "Describe la actividad." },
    { index: 2, message: "Indica un responsable." },
    { index: 3, message: "Describe el resultado o condición de cierre." }
  ]);
  activities[1].descripcion = "Elabora el plan";
  activities[2].responsable = "Profesional";
  activities[3].descripcion = "Plan aprobado";
  assert.deepEqual(reviewFlowCompleteness(activities), []);
});

test("flow completeness rejects vague custom responsibilities", () => {
  assert.deepEqual(reviewFlowCompleteness([
    { tipo: "Actividad", actividad: "Revisar", descripcion: "Compara los datos", responsable: "Todos", responsableOtro: true,
      tieneControl: true, controlResponsable: "N/A", controlResponsableOtro: true }
  ]), [
    { index: 0, message: "Especifica el cargo o rol responsable." },
    { index: 0, message: "Especifica el responsable del control." }
  ]);
});

const row = {
  id: draftId, code: null, name: "Borrador", process_code: "DE", version: "1.0",
  status: "borrador", revision: 1, updated_at: new Date(), current_payload: { fields: { nombre: "Borrador" } }
};

const evaluator = { id: "44444444-4444-4444-8444-444444444444", role: "evaluador", mustChangePassword: false };
const completePayload = {
  fields: { objetivo: "Resolver solicitudes", alcance: "Desde recepción hasta respuesta", definiciones: "Solicitud: petición recibida", condiciones: "Aplicar la normativa vigente", elaboro: "Profesional", reviso: "Jefe", aprobo: "Director" },
  norms: [{ tipo: "Interna", norma: "Manual", anio: "2026", descripcion: "Regula el trámite", articulo: "1", entidad: "Entidad" }],
  activities: [
    { uid: "start", tipo: "Inicio", descripcion: "Solicitud recibida" },
    { uid: "work", tipo: "Actividad", actividad: "Revisar solicitud", descripcion: "Verifica la información", responsable: "Profesional" },
    { uid: "end", tipo: "Fin", descripcion: "Solicitud revisada" }
  ],
  annexes: [], changes: [{ version: "1.0", fecha: "2026-10-03", razon: "Creación inicial" }],
  settings: { annexesNotApplicable: true }
};

test("author creates an audited draft for an active process", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (["BEGIN", "COMMIT"].includes(sql)) return { rows: [] };
      if (sql.startsWith("SELECT 1 FROM processes")) return { rows: [{ "?column?": 1 }] };
      if (sql.startsWith("INSERT INTO procedures")) return { rows: [row] };
      if (sql.startsWith("INSERT INTO audit_events")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  };
  const result = await createDraft({ connect: async () => client }, author, {
    name: " Borrador ", processCode: "DE", payload: row.current_payload
  });
  assert.equal(result.name, "Borrador");
  assert.equal(result.revision, 1);
  const processCheck = calls.find(call => call.sql.startsWith("SELECT 1 FROM processes"));
  assert.deepEqual(processCheck.params, ["DE", author.id, false]);
  assert.match(processCheck.sql, /user_processes/);
  assert.equal(calls.find(call => call.sql.startsWith("INSERT INTO procedures")).params[1], "Borrador");
  assert.deepEqual(calls.slice(-2).map(call => call.sql.startsWith("INSERT INTO audit_events") ? "AUDIT" : call.sql), ["AUDIT", "COMMIT"]);
});

test("draft creation rejects bad data and processes without access", async () => {
  const noConnect = { connect: async () => { throw new Error("should not connect"); } };
  await assert.rejects(createDraft(noConnect, author, { name: "", processCode: "DE", payload: {} }), { code: "invalid_draft" });
  await assert.rejects(createDraft(noConnect, author, { name: "Ok", processCode: "??", payload: {} }), { code: "invalid_process" });
  await assert.rejects(createDraft(noConnect, { ...author, mustChangePassword: true }, { name: "Ok", processCode: "DE", payload: {} }), { code: "forbidden" });
  let rolledBack = false;
  let assigned = false;
  const pool = { connect: async () => ({
    async query(sql, params) {
      if (sql === "BEGIN") return { rows: [] };
      if (sql === "ROLLBACK") { rolledBack = true; return { rows: [] }; }
      if (sql.startsWith("SELECT 1 FROM processes")) {
        assert.deepEqual(params, ["DE", author.id, false]);
        assert.match(sql, /user_processes/);
        return { rows: assigned ? [{ "?column?": 1 }] : [] };
      }
      if (sql.startsWith("INSERT INTO procedures") || sql.startsWith("INSERT INTO audit_events")) return { rows: [row] };
      if (sql === "COMMIT") return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  }) };
  await assert.rejects(createDraft(pool, author, { name: "Ok", processCode: "DE", payload: {} }), { code: "invalid_process" });
  assert.equal(rolledBack, true);
  assigned = true;
  assert.equal((await createDraft(pool, author, { name: "Ok", processCode: "DE", payload: {} })).status, "borrador");
});

test("list and detail are scoped to the owner", async () => {
  const queries = [];
  let assigned = true;
  const pool = { async query(sql, params) {
    queries.push({ sql, params });
    return { rows: params.includes(author.id) && (assigned || params.at(-1) === true) ? [row] : [] };
  } };
  assert.equal((await listOwnDrafts(pool, author))[0].payload, undefined);
  assert.deepEqual((await getOwnDraft(pool, author, draftId)).payload, row.current_payload);
  assigned = false;
  assert.deepEqual(await listOwnDrafts(pool, author), []);
  await assert.rejects(getOwnDraft(pool, author, draftId), { code: "draft_not_found" });
  assert.equal((await listOwnDrafts(pool, { ...author, role: "administrador" })).length, 1);
  await assert.rejects(getOwnDraft(pool, other, draftId), { code: "draft_not_found", status: 404 });
  assert.ok(queries.every(call => call.sql.includes("created_by_user_id") &&
    (call.params.includes(author.id) || call.params.includes(other.id))));
  assert.ok(queries.every(call => call.sql.includes("user_processes")));
});

test("update rejects another author, locked status, and stale revision", async () => {
  let status = "borrador";
  let revision = 2;
  let assigned = true;
  const calls = [];
  const pool = { connect: async () => ({
    async query(sql, params) {
      calls.push(sql);
      if (["BEGIN", "ROLLBACK", "COMMIT"].includes(sql)) return { rows: [] };
      if (sql.startsWith("SELECT id, status")) return { rows: params[1] === author.id && assigned ? [{ id: draftId, status, created_by_user_id: author.id, revision }] : [] };
      if (sql.startsWith("UPDATE procedures")) return { rows: [{ ...row, revision: revision + 1 }] };
      if (sql.startsWith("INSERT INTO audit_events")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  }) };
  const details = { name: "Nuevo", payload: { fields: {} }, revision: 1 };
  await assert.rejects(updateOwnDraft(pool, other, draftId, details), { code: "draft_not_found" });
  status = "en_evaluacion";
  await assert.rejects(updateOwnDraft(pool, author, draftId, details), { code: "draft_locked" });
  status = "borrador";
  await assert.rejects(updateOwnDraft(pool, author, draftId, details), { code: "draft_conflict", status: 409 });
  assert.equal(calls.filter(sql => sql.startsWith("UPDATE procedures")).length, 0);
  details.revision = 2;
  assert.equal((await updateOwnDraft(pool, author, draftId, details)).revision, 3);
  assigned = false;
  await assert.rejects(updateOwnDraft(pool, author, draftId, details), { code: "draft_not_found" });
  assert.ok(calls.some(sql => sql.startsWith("SELECT id, status") && sql.includes("user_processes")));
});

test("author can submit a complete draft to an evaluator assigned to its process", async () => {
  const calls = [];
  const procedure = { ...row, process_code: "PD", revision: 4, current_payload: completePayload, created_by_user_id: author.id };
  const pool = { connect: async () => ({
    async query(sql, params) {
      calls.push({ sql, params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
      if (sql.startsWith("SELECT p.id")) return { rows: [procedure] };
      if (sql.startsWith("SELECT 1 FROM app_users")) return { rows: [{ "?column?": 1 }] };
      if (sql.startsWith("UPDATE procedures")) return { rows: [{ ...procedure, status: "enviado_a_evaluacion", revision: 5, assigned_evaluator_id: evaluator.id }] };
      if (sql.startsWith("INSERT INTO evaluations") || sql.startsWith("INSERT INTO audit_events") || sql.startsWith("INSERT INTO user_notifications")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  }) };
  const submitted = await submitOwnDraft(pool, author, draftId, { evaluatorId: evaluator.id, revision: 4 });
  assert.equal(submitted.status, "enviado_a_evaluacion");
  assert.equal(submitted.assignedEvaluatorId, evaluator.id);
  assert.deepEqual(calls.slice(-5).map(({ sql }) => sql === "COMMIT" ? "COMMIT" : sql.startsWith("INSERT INTO evaluations") ? "EVALUATION" : sql.startsWith("INSERT INTO audit_events") ? "AUDIT" : sql.startsWith("INSERT INTO user_notifications") ? "NOTIFICATION" : "UPDATE"), ["UPDATE", "EVALUATION", "AUDIT", "NOTIFICATION", "COMMIT"]);
  const notification = calls.find(call => call.sql.startsWith("INSERT INTO user_notifications"));
  assert.equal(notification.params[1], evaluator.id);
  assert.equal(notification.params[2], draftId);
});

test("evaluator choices require process access and include only eligible assigned evaluators", async () => {
  const calls = [];
  const pool = { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith("SELECT 1 FROM processes")) return { rows: [{ "?column?": 1 }] };
    if (sql.startsWith("SELECT u.id, u.display_name")) return { rows: [{ id: evaluator.id, displayName: "Evaluador de prueba" }] };
    throw new Error(`Unexpected SQL: ${sql}`);
  } };
  assert.deepEqual(await listProcessEvaluators(pool, author, "DE"), [{ id: evaluator.id, displayName: "Evaluador de prueba" }]);
  assert.deepEqual(calls[0].params, ["DE", author.id, false]);
  assert.match(calls[1].sql, /u\.role = 'evaluador'/);
  assert.match(calls[1].sql, /u\.active = TRUE/);
  assert.match(calls[1].sql, /u\.must_change_password = FALSE/);
  assert.match(calls[1].sql, /up\.process_code = \$1/);
  await assert.rejects(listProcessEvaluators(pool, { ...author, role: "evaluador" }, "DE"), { code: "forbidden" });
  await assert.rejects(listProcessEvaluators(pool, author, "INVALID"), { code: "forbidden" });
});

test("submission rejects incomplete drafts, stale revisions, and evaluators outside the process", async () => {
  const procedure = { ...row, process_code: "PD", revision: 4, current_payload: { ...completePayload, fields: {} }, created_by_user_id: author.id };
  let evaluatorAssigned = true;
  const pool = { connect: async () => ({
    async query(sql) {
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
      if (sql.startsWith("SELECT p.id")) return { rows: [procedure] };
      if (sql.startsWith("SELECT 1 FROM app_users")) return { rows: evaluatorAssigned ? [{ "?column?": 1 }] : [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  }) };
  await assert.rejects(submitOwnDraft(pool, author, draftId, { evaluatorId: evaluator.id, revision: 4 }), error => {
    assert.equal(error.code, "submission_incomplete");
    assert.ok(error.details.length > 0);
    return true;
  });
  procedure.current_payload = {
    ...completePayload,
    changes: [...completePayload.changes, { version: "1.0", fecha: "2026-10-03", razon: "Actualización" }]
  };
  await assert.rejects(submitOwnDraft(pool, author, draftId, { evaluatorId: evaluator.id, revision: 4 }), error => {
    assert.equal(error.code, "submission_incomplete");
    assert.ok(error.details.includes("Cada versión del control de cambios debe ser única."));
    return true;
  });
  procedure.current_payload = completePayload;
  evaluatorAssigned = false;
  await assert.rejects(submitOwnDraft(pool, author, draftId, { evaluatorId: evaluator.id, revision: 4 }), { code: "evaluator_unavailable" });
  evaluatorAssigned = true;
  await assert.rejects(submitOwnDraft(pool, author, draftId, { evaluatorId: evaluator.id, revision: 3 }), { code: "draft_conflict", status: 409 });
});

test("evaluator inbox and start action are limited to assigned processes", async () => {
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      return { rows: [{ ...row, process_code: "PD", status: "enviado_a_evaluacion", assigned_evaluator_id: evaluator.id }] };
    },
    async connect() {
      return {
        async query(sql, params) {
          if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
          if (sql.startsWith("SELECT p.id")) return { rows: [{ id: draftId, status: "enviado_a_evaluacion", assigned_evaluator_id: evaluator.id, created_by_user_id: author.id, name: "Borrador de prueba" }] };
          if (sql.startsWith("UPDATE procedures")) return { rows: [{ ...row, process_code: "PD", status: "en_evaluacion", assigned_evaluator_id: evaluator.id }] };
          if (sql.startsWith("INSERT INTO user_notifications")) {
            queries.push({ sql, params });
            return { rows: [] };
          }
          if (sql.startsWith("UPDATE evaluations") || sql.startsWith("INSERT INTO audit_events")) return { rows: [] };
          throw new Error(`Unexpected SQL: ${sql}`);
        },
        release() {}
      };
    }
  };
  assert.equal((await listAssignedProcedures(pool, evaluator))[0].status, "enviado_a_evaluacion");
  assert.match(queries[0].sql, /assigned_evaluator_id = \$1/);
  assert.equal((await getAssignedProcedure(pool, evaluator, draftId)).payload, row.current_payload);
  assert.equal((await startAssignedEvaluation(pool, evaluator, draftId)).status, "en_evaluacion");
  const authorNotice = queries.find(call => call.sql.startsWith("INSERT INTO user_notifications"));
  assert.equal(authorNotice.params[1], author.id);
  await assert.rejects(listAssignedProcedures(pool, author), { code: "forbidden" });
});

test("draft HTTP routes require session, password change, and CSRF", async () => {
  const token = "test-session";
  const csrf = "test-csrf";
  let mustChange = false;
  const poolFactory = () => ({
    async query(sql, params) {
      if (sql.includes("FROM app_sessions s")) return { rows: params[0] === hashToken(token) ? [{
        session_id: draftId, csrf_token_hash: hashToken(csrf), id: author.id,
        username: "author1", email: null, display_name: "Author", role: "elaborador",
        must_change_password: mustChange
      }] : [] };
      if (sql.startsWith("UPDATE app_sessions SET last_seen_at")) return { rows: [] };
      if (sql.startsWith("SELECT id, code, name")) return { rows: [row] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async end() {}
  });
  const server = createAppServer({ poolFactory, secureCookies: false });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/procedures`;
  const cookie = `__Host-asistente_session=${token}`;
  try {
    assert.equal((await fetch(url)).status, 401);
    mustChange = true;
    assert.equal((await fetch(url, { headers: { cookie } })).status, 403);
    mustChange = false;
    const list = await fetch(url, { headers: { cookie } });
    assert.equal(list.status, 200);
    assert.equal((await list.json()).procedures[0].name, "Borrador");
    const write = await fetch(url, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}" });
    assert.equal(write.status, 403);
    const invalid = await fetch(url, { method: "POST", headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" }, body: "{}" });
    assert.equal(invalid.status, 400);
    const reviewUrl = `${url}/flow-review`;
    const reviewBody = JSON.stringify({ activities: [{ uid: "start", tipo: "Inicio" }, { uid: "end", tipo: "Fin" }] });
    assert.equal((await fetch(reviewUrl, { method: "POST", headers: { "content-type": "application/json" }, body: reviewBody })).status, 401);
    assert.equal((await fetch(reviewUrl, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: reviewBody })).status, 403);
    const review = await fetch(reviewUrl, { method: "POST", headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" }, body: reviewBody });
    assert.equal(review.status, 200);
    const reviewResult = await review.json();
    assert.deepEqual(reviewResult.issues, []);
    assert.deepEqual(reviewResult.completenessIssues, [
      { index: 0, message: "Describe el evento que inicia el procedimiento." },
      { index: 1, message: "Describe el resultado o condición de cierre." }
    ]);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("evaluator inbox HTTP route requires an authenticated evaluator", async () => {
  const evaluatorToken = "evaluator-session";
  const authorToken = "author-session";
  const sessions = new Map([
    [hashToken(evaluatorToken), { session_id: draftId, csrf_token_hash: hashToken("eval-csrf"), id: evaluator.id, username: "reviewer", display_name: "Evaluador", role: "evaluador", must_change_password: false }],
    [hashToken(authorToken), { session_id: draftId, csrf_token_hash: hashToken("author-csrf"), id: author.id, username: "author1", display_name: "Author", role: "elaborador", must_change_password: false }]
  ]);
  const poolFactory = () => ({
    async query(sql, params) {
      if (sql.includes("FROM app_sessions s")) return { rows: [sessions.get(params[0])].filter(Boolean) };
      if (sql.startsWith("UPDATE app_sessions SET last_seen_at")) return { rows: [] };
      if (sql.startsWith("SELECT p.id")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async end() {}
  });
  const server = createAppServer({ poolFactory, secureCookies: false });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/evaluator/inbox`;
  try {
    assert.equal((await fetch(url)).status, 401);
    const evaluatorResponse = await fetch(url, { headers: { cookie: `__Host-asistente_session=${evaluatorToken}` } });
    assert.equal(evaluatorResponse.status, 200);
    assert.deepEqual((await evaluatorResponse.json()).procedures, []);
    const authorResponse = await fetch(url, { headers: { cookie: `__Host-asistente_session=${authorToken}` } });
    assert.equal(authorResponse.status, 403);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("draft HTTP routes create, read, and update with a live author session", async () => {
  const token = "draft-session";
  const csrf = "draft-csrf";
  let saved = null;
  const client = {
    async query(sql, params) {
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
      if (sql.startsWith("SELECT 1 FROM processes")) return { rows: [{ "?column?": 1 }] };
      if (sql.startsWith("INSERT INTO procedures")) {
        saved = { ...row, id: params[0], name: params[1], process_code: params[2], current_payload: JSON.parse(params[5]) };
        return { rows: [saved] };
      }
      if (sql.startsWith("SELECT id, status")) return { rows: [saved && {
        id: saved.id, status: saved.status, created_by_user_id: author.id, revision: saved.revision
      }].filter(Boolean) };
      if (sql.startsWith("UPDATE procedures")) {
        saved = { ...saved, name: params[1], current_payload: JSON.parse(params[2]), revision: saved.revision + 1 };
        return { rows: [saved] };
      }
      if (sql.startsWith("INSERT INTO audit_events")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  };
  const poolFactory = () => ({
    async query(sql, params) {
      if (sql.includes("FROM app_sessions s")) return { rows: params[0] === hashToken(token) ? [{
        session_id: draftId, csrf_token_hash: hashToken(csrf), id: author.id,
        username: "author1", email: null, display_name: "Author", role: "elaborador",
        must_change_password: false
      }] : [] };
      if (sql.startsWith("UPDATE app_sessions SET last_seen_at")) return { rows: [] };
      if (sql.startsWith("SELECT id, code, name")) return { rows: saved ? [saved] : [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async connect() { return client; },
    async end() {}
  });
  const server = createAppServer({ poolFactory, secureCookies: false });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/procedures`;
  const headers = { cookie: `__Host-asistente_session=${token}`, "x-csrf-token": csrf, "content-type": "application/json" };
  try {
    const created = await fetch(base, { method: "POST", headers, body: JSON.stringify({ name: "Borrador", processCode: "DE", payload: { fields: { nombre: "Borrador" } } }) });
    assert.equal(created.status, 201);
    const procedure = (await created.json()).procedure;
    assert.equal(procedure.status, "borrador");
    assert.equal(procedure.revision, 1);
    const detail = await fetch(`${base}/${procedure.id}`, { headers });
    assert.equal((await detail.json()).procedure.payload.fields.nombre, "Borrador");
    const updated = await fetch(`${base}/${procedure.id}`, { method: "PUT", headers, body: JSON.stringify({
      name: "Nuevo",
      payload: {
        fields: { nombre: "Nuevo", objetivo: "Objetivo", alcance: "Alcance", definiciones: "Definiciones", condiciones: "Condiciones",
          elaboro: "Profesional Universitario", elaboroNombre: "Persona A", reviso: "Jefe de Oficina", revisoNombre: "Persona B",
          aprobo: "Director", aproboNombre: "Persona C" },
        norms: [
          { tipo: "Externa", norma: "Norma de prueba", anio: "2026", descripcion: "Texto ficticio", articulo: "1", entidad: "Entidad de prueba" },
          { tipo: "Interna", norma: "Regla de prueba", anio: "2025", descripcion: "Otro texto", articulo: "2", entidad: "Otra entidad" }
        ],
        annexes: [
          { documento: "Formato de solicitud", tipo: "Formato", codigo: "F-01", observacion: "Registra la solicitud" },
          { documento: "Matriz de seguimiento", tipo: "Matriz", codigo: "M-02", observacion: "Consolida los casos" }
        ],
        changes: [
          { version: "1.0", fecha: "2026-10-03", razon: "Creación inicial" },
          { version: "1.1", fecha: "2026-10-03", razon: "Corrección de texto" }
        ],
        settings: { annexesNotApplicable: false, showEvidenceFlow: true },
        activities: [
          { uid: "start", tipo: "Inicio", actividad: "Solicitud recibida", descripcion: "Radicacion de prueba" },
          { uid: "step", tipo: "Actividad", n: 1, actividad: "Revisar solicitud", descripcion: "Texto de prueba", responsable: "Profesional", evidencia: "Formato de prueba", sistema: "Sistema de prueba", tieneControl: true,
            controlResponsable: "Profesional", controlPeriodicidad: "Cada vez", controlAccion: "Verifica", controlEjecucion: "Compara datos", controlDesviacion: "Devuelve", controlEvidencia: "Registro de prueba" },
          { uid: "decision", tipo: "Decisión", actividad: "¿Está completo?", descripcion: "¿Está completo?", responsable: "Profesional", decisionSi: "end", decisionNo: "step", tieneControl: false },
          { uid: "connector", tipo: "Conector", connectorId: "A", actividad: "Conector A", connectorDestino: "step", tieneControl: false },
          { uid: "end", tipo: "Fin", actividad: "Solicitud cerrada", descripcion: "Respuesta de prueba" }
        ]
      },
      revision: 1
    }) });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).procedure.revision, 2);
    const reopened = await fetch(`${base}/${procedure.id}`, { headers });
    const reopenedPayload = (await reopened.json()).procedure.payload;
    assert.deepEqual(reopenedPayload.fields, { nombre: "Nuevo", objetivo: "Objetivo", alcance: "Alcance", definiciones: "Definiciones", condiciones: "Condiciones",
      elaboro: "Profesional Universitario", elaboroNombre: "Persona A", reviso: "Jefe de Oficina", revisoNombre: "Persona B",
      aprobo: "Director", aproboNombre: "Persona C" });
    assert.equal(reopenedPayload.annexes.length, 2);
    assert.equal(reopenedPayload.annexes[0].codigo, "F-01");
    assert.equal(reopenedPayload.annexes[1].tipo, "Matriz");
    assert.equal(reopenedPayload.changes.length, 2);
    assert.equal(reopenedPayload.changes[1].version, "1.1");
    assert.deepEqual(reopenedPayload.settings, { annexesNotApplicable: false, showEvidenceFlow: true });
    assert.equal(reopenedPayload.activities.length, 5);
    assert.equal(reopenedPayload.activities[1].responsable, "Profesional");
    assert.equal(reopenedPayload.activities[1].evidencia, "Formato de prueba");
    assert.equal(reopenedPayload.activities[1].tieneControl, true);
    assert.equal(reopenedPayload.activities[1].controlAccion, "Verifica");
    assert.equal(reopenedPayload.activities[1].controlDesviacion, "Devuelve");
    assert.equal(reopenedPayload.activities[2].decisionSi, "end");
    assert.equal(reopenedPayload.activities[2].decisionNo, "step");
    assert.equal(reopenedPayload.activities[3].connectorId, "A");
    assert.equal(reopenedPayload.activities[3].connectorDestino, "step");
    assert.deepEqual(reopenedPayload.activities[0], { uid: "start", tipo: "Inicio", actividad: "Solicitud recibida", descripcion: "Radicacion de prueba" });
    assert.deepEqual(reopenedPayload.activities[4], { uid: "end", tipo: "Fin", actividad: "Solicitud cerrada", descripcion: "Respuesta de prueba" });
    assert.equal(reopenedPayload.norms.length, 2);
    assert.equal(reopenedPayload.norms[0].norma, "Norma de prueba");
    assert.equal(reopenedPayload.norms[1].tipo, "Interna");
    const conflict = await fetch(`${base}/${procedure.id}`, { method: "PUT", headers, body: JSON.stringify({ name: "Viejo", payload: {}, revision: 1 }) });
    assert.equal(conflict.status, 409);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});


test("active process catalog requires an authenticated procedure author", async () => {
  const token = "process-session";
  const userId = "11111111-1111-4111-8111-111111111111";
  let role = "elaborador";
  let mustChangePassword = false;
  let catalogReads = 0;
  let assigned = true;
  const poolFactory = () => ({
    async query(sql, params) {
      if (sql.includes("FROM app_sessions s")) return { rows: params[0] === hashToken(token) ? [{
        session_id: draftId, csrf_token_hash: hashToken("csrf"), id: userId,
        username: "author1", email: null, display_name: "Author", role,
        must_change_password: mustChangePassword
      }] : [] };
      if (sql.startsWith("UPDATE app_sessions SET last_seen_at")) return { rows: [] };
      if (sql.startsWith("SELECT p.code, p.name FROM processes")) {
        catalogReads += 1;
        assert.deepEqual(params, [userId, role === "administrador"]);
        assert.match(sql, /user_processes/);
        if (role === "administrador") return { rows: [
          ["PD", "Gestión del Desarrollo Económico"], ["GT", "Gestión del Turismo"], ["DE", "Direccionamiento Estratégico y Planeación"],
          ["GC", "Gestión de la Comunicación"], ["TIC", "Gestión de las Tecnologías e Información"], ["GF", "Gestión de Recursos Financieros"],
          ["GCT", "Gestión de la Contratación"], ["GI", "Gestión de la Infraestructura Física"], ["GD", "Gestión Documental"],
          ["GH", "Gestión Humana y SST"], ["GJ", "Gestión Jurídica"], ["EI", "Evaluación Independiente"], ["GDI", "Gestión Disciplinaria"]
        ].map(([code, name]) => ({ code, name })) };
        return { rows: assigned ? [{ code: "PD", name: "Gestión del Desarrollo Económico" }] : [] };
      }
      throw new Error("Unexpected SQL: " + sql);
    },
    async end() {}
  });
  const server = createAppServer({ poolFactory, secureCookies: false });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = "http://127.0.0.1:" + server.address().port + "/api/processes";
  const cookie = "__Host-asistente_session=" + token;
  try {
    assert.equal((await fetch(url)).status, 401);
    mustChangePassword = true;
    assert.equal((await fetch(url, { headers: { cookie } })).status, 403);
    mustChangePassword = false;
    const response = await fetch(url, { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).processes, [{ code: "PD", name: "Gestión del Desarrollo Económico" }]);
    assigned = false;
    const unassigned = await fetch(url, { headers: { cookie } });
    assert.deepEqual((await unassigned.json()).processes, []);
    role = "administrador";
    const adminCatalog = await fetch(url, { headers: { cookie } });
    assert.equal((await adminCatalog.json()).processes.length, 13);
    role = "evaluador";
    assert.equal((await fetch(url, { headers: { cookie } })).status, 403);
    assert.equal(catalogReads, 3);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
