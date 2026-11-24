import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { runMigrations } from "../src/db/migrate.js";
import { checkDatabase } from "../src/db/pool.js";
import { createDraft, getOwnDraft, getProcedureReport, listOwnDrafts, startAssignedEvaluation, submitOwnDraft, updateOwnDraft } from "../src/domain/drafts.js";
import { getOwnEvaluationFeedback, saveAuthorEvaluationResponses, saveAssignedEvaluation, decideAssignedEvaluation, decideAdministrativeApproval } from "../src/domain/evaluations.js";
import { getAdminConsultation } from "../src/domain/admin-consultation.js";
import { listReassignmentCandidates, reassignProcedure } from "../src/domain/reassignment.js";
import { EVALUATION_CRITERIA } from "../src/domain/evaluation-rubric.js";

// Opt in only with a disposable database that allows isolated schema/role creation.
// Never falls back to DATABASE_URL or production service credentials.
const connectionString = process.env.CIVICFLOW_TEST_DATABASE_URL;
test("PostgreSQL: migration, restricted grants and complete reassigned workflow", { skip: !connectionString }, async t => {
  const suffix = randomUUID().replaceAll("-", "");
  const schema = `reassignment_${suffix}`, role = `reassignment_app_${suffix}`;
  const owner = new pg.Pool({ connectionString, options: `-c search_path=${schema},public` });
  let app;
  const admin = { id: randomUUID(), role: "administrador", active: true };
  const previous = { id: randomUUID(), role: "elaborador", active: true, displayName: "Anterior" };
  const next = { id: randomUUID(), role: "elaborador", active: true, displayName: "Actual" };
  const evaluator = { id: randomUUID(), role: "evaluador", active: true };
  const inactive = { id: randomUUID(), role: "elaborador", active: false };
  const outside = { id: randomUUID(), role: "elaborador", active: true };
  const payload = {
    fields: { objetivo: "Resolver solicitudes", alcance: "Desde la recepción hasta la respuesta",
      definiciones: "Solicitud: petición recibida", condiciones: "Aplicar la normativa vigente",
      elaboro: "Profesional", elaboroNombre: "Nombre original del documento", reviso: "Jefe", aprobo: "Director", aproboNombre: "Directora" },
    norms: [{ tipo: "Interna", norma: "Manual", anio: "2026", descripcion: "Regula el trámite", articulo: "1", entidad: "Entidad" }],
    activities: [
      { uid: "s", tipo: "Inicio", descripcion: "Solicitud recibida" },
      { uid: "a", tipo: "Actividad", actividad: "Revisar solicitud", descripcion: "Verifica la información", responsable: "Profesional", tieneControl: true,
        controlResponsable: "Profesional", controlPeriodicidad: "Por solicitud", controlAccion: "Verifica", controlEjecucion: "Compara", controlDesviacion: "Solicita ajuste", controlEvidencia: "Lista" },
      { uid: "d", tipo: "Decisión", actividad: "¿Cumple?", descripcion: "¿Cumple?", responsable: "Profesional", decisionSi: "f", decisionNo: "b" },
      { uid: "b", tipo: "Actividad", actividad: "Ajustar solicitud", descripcion: "Completa los requisitos", responsable: "Profesional" },
      { uid: "f", tipo: "Fin", descripcion: "Solicitud revisada" }
    ],
    annexes: [], changes: [{ version: "1.0", fecha: "2026-11-23", razon: "Creación" }],
    settings: { annexesNotApplicable: true, normativityConfirmedMissingTypes: ["Externa"] }
  };
  const reassign = (procedure, target = next.id) => reassignProcedure(app, admin, procedure.id,
    { responsibleUserId: target, reason: "Cambio de equipo", revision: procedure.revision });
  try {
    await owner.query(`CREATE SCHEMA ${schema}`);
    await runMigrations(owner);
    assert.equal(await runMigrations(owner), false);
    await owner.query(`CREATE ROLE ${role} NOLOGIN`);
    await owner.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
    const grants = await readFile(new URL("../../deploy/grant-drafts-production.sql", import.meta.url), "utf8");
    await owner.query(grants.replaceAll("public.", `${schema}.`).replaceAll("asistente_app_prod", role));
    app = new pg.Pool({ connectionString, options: `-c search_path=${schema},public -c role=${role}` });
    assert.equal(await checkDatabase(app), true);
    for (const [i, user] of [admin, previous, next, evaluator, inactive, outside].entries()) {
      await owner.query(`INSERT INTO app_users (id, username, display_name, role, active, password_hash)
        VALUES ($1, $2, $3, $4, $5, 'isolated-test-no-login')`,
      [user.id, `testuser${i}`, user.displayName || `Cuenta ${i}`, user.role, user.active]);
      if (user !== outside) await owner.query("INSERT INTO user_processes (user_id, process_code) VALUES ($1, 'DE')", [user.id]);
    }
    let draft;
    await t.test("new nullable field leaves existing ownership and immutable creator intact", async () => {
      draft = await createDraft(app, previous, { name: "Formular el plan institucional", processCode: "DE", consecutive: "1", payload });
      const row = (await owner.query("SELECT * FROM procedures WHERE id = $1", [draft.id])).rows[0];
      assert.equal(row.responsible_user_id, null); assert.equal(row.created_by_user_id, previous.id);
      assert.equal((await getOwnDraft(app, previous, draft.id)).id, draft.id);
      const candidates = await listReassignmentCandidates(app, admin, draft.id);
      assert.deepEqual(candidates.candidates.map(user => user.id), [next.id]);
      await assert.rejects(reassign(draft, inactive.id), { code: "responsible_user_unavailable" });
      await assert.rejects(reassign(draft, outside.id), { code: "responsible_user_unavailable" });
    });
    await t.test("only the new responsible can list, read, edit or export after reassignment", async () => {
      const before = (await owner.query("SELECT * FROM procedures WHERE id=$1", [draft.id])).rows[0];
      const change = await reassign(draft);
      assert.equal(change.revision, draft.revision + 1);
      const after = (await owner.query("SELECT * FROM procedures WHERE id=$1", [draft.id])).rows[0];
      for (const key of ["created_by_user_id", "code", "version", "status", "current_payload", "created_at", "approved_at"]) assert.deepEqual(after[key], before[key]);
      assert.equal((await listOwnDrafts(app, previous)).length, 0);
      assert.equal((await listOwnDrafts(app, next)).length, 1);
      await assert.rejects(getOwnDraft(app, previous, draft.id), { code: "draft_not_found" });
      await assert.rejects(updateOwnDraft(app, previous, draft.id, { name: draft.name, payload, revision: draft.revision }), { code: "draft_not_found" });
      await assert.rejects(getProcedureReport(app, previous, draft.id), { code: "forbidden" });
      assert.equal((await getProcedureReport(app, next, draft.id)).procedure.id, draft.id);
      draft = await updateOwnDraft(app, next, draft.id, { name: draft.name, payload, revision: change.revision });
      const detail = await getAdminConsultation(app, admin, draft.id);
      assert.equal(detail.authorName, "Actual"); assert.equal(detail.creatorName, "Anterior");
      const audit = (await owner.query("SELECT * FROM audit_events WHERE event_type='procedure_responsibility_reassigned' AND entity_id=$1", [draft.id])).rows;
      assert.equal(audit.length, 1); assert.equal(audit[0].metadata.previousResponsibleUserId, previous.id);
    });
    await t.test("new responsible submits and receives evaluation notifications", async () => {
      draft = await submitOwnDraft(app, next, draft.id, { evaluatorId: evaluator.id, revision: draft.revision });
      await assert.rejects(reassign(draft), { code: "reassignment_locked" });
      await startAssignedEvaluation(app, evaluator, draft.id);
      const notice = (await owner.query("SELECT recipient_user_id FROM user_notifications WHERE procedure_id=$1 AND event_type='procedure_evaluation_started'", [draft.id])).rows[0];
      assert.equal(notice.recipient_user_id, next.id);
      const criteria = Object.fromEntries(EVALUATION_CRITERIA.map(criterion => [criterion.id, { result: "Cumple", observation: "Revisado", findingStatus: "Cerrado" }]));
      criteria.con1 = { result: "No cumple", observation: "Precisar alcance", adjustment: "Ajustar alcance", findingStatus: "Pendiente" };
      await saveAssignedEvaluation(app, evaluator, draft.id, { criteria, concept: "Ajustar alcance" });
      await decideAssignedEvaluation(app, evaluator, draft.id, { decision: "devolver" });
      assert.ok(await getOwnEvaluationFeedback(app, next, draft.id));
      assert.equal(await getOwnEvaluationFeedback(app, previous, draft.id), null);
      await assert.rejects(saveAuthorEvaluationResponses(app, previous, draft.id, { con1: "Ajustado" }), { code: "draft_not_found" });
      await saveAuthorEvaluationResponses(app, next, draft.id, { con1: "Alcance ajustado" });
      draft = await getOwnDraft(app, next, draft.id);
    });
    await t.test("returned procedure can transfer back and complete technical and administrative review", async () => {
      await reassign(draft, previous.id);
      draft = await getOwnDraft(app, previous, draft.id);
      assert.equal((await getOwnEvaluationFeedback(app, previous, draft.id)).criteria.con1.response, "Alcance ajustado");
      draft = await submitOwnDraft(app, previous, draft.id, { evaluatorId: evaluator.id, revision: draft.revision });
      await startAssignedEvaluation(app, evaluator, draft.id);
      const criteria = Object.fromEntries(EVALUATION_CRITERIA.map(criterion => [criterion.id, { result: "Cumple", observation: "Verificado", findingStatus: "Cerrado" }]));
      await saveAssignedEvaluation(app, evaluator, draft.id, { criteria, concept: "Favorable" });
      await decideAssignedEvaluation(app, evaluator, draft.id, { decision: "favorable" });
      await decideAdministrativeApproval(app, admin, draft.id, { decision: "aprobar" });
      draft = await getOwnDraft(app, previous, draft.id);
      assert.equal(draft.status, "aprobado_formalmente");
      await assert.rejects(reassign(draft), { code: "reassignment_locked" });
      const notice = (await owner.query("SELECT recipient_user_id FROM user_notifications WHERE procedure_id=$1 AND event_type='procedure_formally_approved'", [draft.id])).rows;
      assert.deepEqual(new Set(notice.map(row => row.recipient_user_id)), new Set([previous.id, evaluator.id]));
    });
    await t.test("two simultaneous reassignment decisions cannot overwrite each other", async () => {
      const concurrent = await createDraft(app, previous, { name: "Formular el plan de prueba concurrente", processCode: "DE", consecutive: "2", payload });
      const results = await Promise.allSettled([reassign(concurrent), reassign(concurrent)]);
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
      assert.equal(results.find(result => result.status === "rejected").reason.code, "draft_conflict");
      const events = await owner.query("SELECT id FROM audit_events WHERE entity_id=$1 AND event_type='procedure_responsibility_reassigned'", [concurrent.id]);
      assert.equal(events.rows.length, 1);
    });
  } finally {
    await app?.end();
    await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await owner.query(`DROP ROLE IF EXISTS ${role}`);
    await owner.end();
  }
});
