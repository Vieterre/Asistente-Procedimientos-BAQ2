import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
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
    await t.test("process removal committed while reassignment waits invalidates the target", async () => {
      const concurrent = await createDraft(app, previous, {
        name: "Formular el plan de prueba de retiro", processCode: "DE", consecutive: "3", payload
      });
      const removal = await owner.connect();
      let pending;
      try {
        await removal.query("BEGIN");
        const removalPid = (await removal.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
        // Use the same account-first locking order as setAccountProcessAssignments.
        await removal.query("SELECT id FROM app_users WHERE id = $1 FOR UPDATE", [next.id]);
        await removal.query("DELETE FROM user_processes WHERE user_id = $1 AND process_code = 'DE'", [next.id]);
        pending = reassign(concurrent).then(value => ({ value }), error => ({ error }));
        let blocked = false;
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
          blocked = (await owner.query(
            "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))) AS waiting",
            [removalPid]
          )).rows[0].waiting;
          if (blocked) break;
          await delay(20);
        }
        assert.equal(blocked, true, "reassignment must be waiting on the target account lock before removal commits");
        await removal.query("COMMIT");
        const result = await pending;
        assert.equal(result.error?.code, "responsible_user_unavailable");
        const row = (await owner.query("SELECT responsible_user_id, revision FROM procedures WHERE id = $1", [concurrent.id])).rows[0];
        assert.equal(row.responsible_user_id, null);
        assert.equal(row.revision, concurrent.revision);
        const events = await owner.query(
          "SELECT id FROM audit_events WHERE entity_id = $1 AND event_type = 'procedure_responsibility_reassigned'",
          [concurrent.id]
        );
        assert.equal(events.rows.length, 0);
      } finally {
        await removal.query("ROLLBACK");
        removal.release();
        if (pending) await pending;
        await owner.query("INSERT INTO user_processes (user_id, process_code) VALUES ($1, 'DE') ON CONFLICT DO NOTHING", [next.id]);
      }
    });
    await t.test("returned procedure transfers A to B to C without letting former editors save or answer findings", async () => {
      const third = { id: randomUUID(), role: "elaborador", active: true, displayName: "Tercero" };
      await owner.query(`INSERT INTO app_users (id, username, display_name, role, active, password_hash)
        VALUES ($1, 'testuserthird', $2, 'elaborador', TRUE, 'isolated-test-no-login')`, [third.id, third.displayName]);
      await owner.query("INSERT INTO user_processes (user_id, process_code) VALUES ($1, 'DE')", [third.id]);
      let returned = await createDraft(app, previous, {
        name: "Formular el plan con transferencia sucesiva", processCode: "DE", consecutive: "4", payload
      });
      returned = await submitOwnDraft(app, previous, returned.id, { evaluatorId: evaluator.id, revision: returned.revision });
      await startAssignedEvaluation(app, evaluator, returned.id);
      const criteria = Object.fromEntries(EVALUATION_CRITERIA.map(criterion => [criterion.id, {
        result: "Cumple", observation: "Revisado", findingStatus: "Cerrado"
      }]));
      criteria.con1 = { result: "No cumple", observation: "Precisar alcance", adjustment: "Ajustar alcance", findingStatus: "Pendiente" };
      await saveAssignedEvaluation(app, evaluator, returned.id, { criteria, concept: "Requiere ajustes" });
      await decideAssignedEvaluation(app, evaluator, returned.id, { decision: "devolver" });
      await saveAuthorEvaluationResponses(app, previous, returned.id, { con1: "Respuesta del elaborador A" });
      const snapshotA = await getOwnDraft(app, previous, returned.id);
      await reassign(snapshotA);
      await assert.rejects(updateOwnDraft(app, previous, returned.id, {
        name: snapshotA.name, payload, revision: snapshotA.revision
      }), { code: "draft_not_found" });
      await assert.rejects(saveAuthorEvaluationResponses(app, previous, returned.id, { con1: "Intento anterior A" }), { code: "draft_not_found" });
      assert.equal(await getOwnEvaluationFeedback(app, previous, returned.id), null);
      const snapshotB = await getOwnDraft(app, next, returned.id);
      assert.equal((await getOwnEvaluationFeedback(app, next, returned.id)).criteria.con1.response, "Respuesta del elaborador A");
      await saveAuthorEvaluationResponses(app, next, returned.id, { con1: "Respuesta del elaborador B" });
      const beforeSecond = (await owner.query("SELECT * FROM procedures WHERE id=$1", [returned.id])).rows[0];
      const evaluationBefore = (await owner.query("SELECT * FROM evaluations WHERE procedure_id=$1", [returned.id])).rows;
      await reassign(snapshotB, third.id);
      for (const former of [previous, next]) {
        await assert.rejects(getOwnDraft(app, former, returned.id), { code: "draft_not_found" });
        await assert.rejects(updateOwnDraft(app, former, returned.id, {
          name: snapshotB.name, payload, revision: snapshotB.revision
        }), { code: "draft_not_found" });
        await assert.rejects(saveAuthorEvaluationResponses(app, former, returned.id, { con1: "Intento anterior" }), { code: "draft_not_found" });
        await assert.rejects(getProcedureReport(app, former, returned.id), { code: "forbidden" });
        assert.equal(await getOwnEvaluationFeedback(app, former, returned.id), null);
        assert.ok(!(await listOwnDrafts(app, former)).some(row => row.id === returned.id));
      }
      const afterSecond = (await owner.query("SELECT * FROM procedures WHERE id=$1", [returned.id])).rows[0];
      for (const key of ["created_by_user_id", "code", "version", "status", "current_payload", "assigned_evaluator_id", "technical_reviewed_at"]) {
        assert.deepEqual(afterSecond[key], beforeSecond[key]);
      }
      assert.equal(afterSecond.created_by_user_id, previous.id);
      assert.equal(afterSecond.responsible_user_id, third.id);
      assert.deepEqual((await owner.query("SELECT * FROM evaluations WHERE procedure_id=$1", [returned.id])).rows, evaluationBefore);
      assert.equal((await getOwnEvaluationFeedback(app, third, returned.id)).criteria.con1.response, "Respuesta del elaborador B");
      await saveAuthorEvaluationResponses(app, third, returned.id, { con1: "Respuesta del elaborador C" });
      const finalFeedback = await getOwnEvaluationFeedback(app, third, returned.id);
      assert.deepEqual(finalFeedback.criteria.con1.trace.filter(entry => entry.action === "Respuesta del Elaborador").map(entry => entry.actor),
        [previous.displayName, next.displayName, third.displayName]);
      const current = await getOwnDraft(app, third, returned.id);
      await updateOwnDraft(app, third, current.id, { name: current.name, payload: current.payload, revision: current.revision });
      const events = (await owner.query(`SELECT metadata FROM audit_events
        WHERE entity_id=$1 AND event_type='procedure_responsibility_reassigned' ORDER BY created_at, id`, [returned.id])).rows;
      assert.deepEqual(events.map(row => [row.metadata.previousResponsibleUserId, row.metadata.responsibleUserId]),
        [[previous.id, next.id], [next.id, third.id]]);
    });
    await t.test("target deactivation committed while reassignment waits rejects the change", async () => {
      const concurrent = await createDraft(app, previous, {
        name: "Formular el plan ante desactivación concurrente", processCode: "DE", consecutive: "5", payload
      });
      const deactivation = await owner.connect();
      let pending;
      try {
        await deactivation.query("BEGIN");
        const blockerPid = (await deactivation.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
        await deactivation.query("UPDATE app_users SET active=FALSE WHERE id=$1", [next.id]);
        pending = reassign(concurrent).then(value => ({ value }), error => ({ error }));
        let blocked = false;
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
          blocked = (await owner.query(
            "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))) AS waiting", [blockerPid]
          )).rows[0].waiting;
          if (blocked) break;
          await delay(20);
        }
        assert.equal(blocked, true, "reassignment must wait on the target update before deactivation commits");
        await deactivation.query("COMMIT");
        assert.equal((await pending).error?.code, "responsible_user_unavailable");
        const row = (await owner.query("SELECT responsible_user_id, revision FROM procedures WHERE id=$1", [concurrent.id])).rows[0];
        assert.equal(row.responsible_user_id, null);
        assert.equal(row.revision, concurrent.revision);
        assert.equal((await owner.query("SELECT id FROM user_notifications WHERE procedure_id=$1", [concurrent.id])).rows.length, 0);
      } finally {
        await deactivation.query("ROLLBACK");
        deactivation.release();
        if (pending) await pending;
        await owner.query("UPDATE app_users SET active=TRUE WHERE id=$1", [next.id]);
      }
    });
    await t.test("administrator, evaluator, nonmember and nonexistent targets or procedures fail without writes", async () => {
      const untouched = await createDraft(app, previous, {
        name: "Formular el plan para validar destinos", processCode: "DE", consecutive: "6", payload
      });
      const before = (await owner.query("SELECT * FROM procedures WHERE id=$1", [untouched.id])).rows[0];
      for (const targetId of [admin.id, evaluator.id, outside.id, randomUUID()]) {
        await assert.rejects(reassign(untouched, targetId), { code: "responsible_user_unavailable", status: 409 });
      }
      await assert.rejects(reassign({ id: randomUUID(), revision: 1 }), { code: "draft_not_found", status: 404 });
      await assert.rejects(listReassignmentCandidates(app, admin, randomUUID()), { code: "draft_not_found", status: 404 });
      assert.deepEqual((await owner.query("SELECT * FROM procedures WHERE id=$1", [untouched.id])).rows[0], before);
      assert.equal((await owner.query("SELECT id FROM user_notifications WHERE procedure_id=$1", [untouched.id])).rows.length, 0);
      assert.equal((await owner.query("SELECT id FROM audit_events WHERE entity_id=$1 AND event_type='procedure_responsibility_reassigned'", [untouched.id])).rows.length, 0);
      assert.equal((await app.query("SELECT 1 AS usable")).rows[0].usable, 1);
    });
    await t.test("database audit failure rolls responsibility, revision and notifications back", async () => {
      const untouched = await createDraft(app, previous, {
        name: "Formular el plan con auditoría fallida", processCode: "DE", consecutive: "7", payload
      });
      const before = (await owner.query("SELECT * FROM procedures WHERE id=$1", [untouched.id])).rows[0];
      await owner.query(`CREATE FUNCTION ${schema}.reject_reassignment_audit() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.event_type='procedure_responsibility_reassigned' AND NEW.entity_id='${untouched.id}'::uuid THEN
            RAISE EXCEPTION 'isolated audit failure';
          END IF;
          RETURN NEW;
        END $$`);
      await owner.query(`CREATE TRIGGER reject_reassignment_audit BEFORE INSERT ON audit_events
        FOR EACH ROW EXECUTE FUNCTION ${schema}.reject_reassignment_audit()`);
      try {
        await assert.rejects(reassign(untouched), { code: "P0001", message: "isolated audit failure" });
        assert.deepEqual((await owner.query("SELECT * FROM procedures WHERE id=$1", [untouched.id])).rows[0], before);
        assert.equal((await owner.query("SELECT id FROM audit_events WHERE entity_id=$1 AND event_type='procedure_responsibility_reassigned'", [untouched.id])).rows.length, 0);
        assert.equal((await owner.query("SELECT id FROM user_notifications WHERE procedure_id=$1", [untouched.id])).rows.length, 0);
        assert.equal((await app.query("SELECT 1 AS usable")).rows[0].usable, 1);
      } finally {
        await owner.query("DROP TRIGGER reject_reassignment_audit ON audit_events");
        await owner.query(`DROP FUNCTION ${schema}.reject_reassignment_audit()`);
      }
      assert.equal((await reassign(untouched)).responsibleUserId, next.id);
    });
    await t.test("failure of second notification rolls back first notification, audit and responsibility", async () => {
      const untouched = await createDraft(app, previous, {
        name: "Formular el plan con notificación fallida", processCode: "DE", consecutive: "8", payload
      });
      const before = (await owner.query("SELECT * FROM procedures WHERE id=$1", [untouched.id])).rows[0];
      await owner.query(`CREATE FUNCTION ${schema}.reject_second_reassignment_notice() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.event_type='procedure_responsibility_reassigned' AND NEW.procedure_id='${untouched.id}'::uuid
            AND NEW.recipient_user_id='${next.id}'::uuid THEN
            RAISE EXCEPTION 'isolated second notification failure';
          END IF;
          RETURN NEW;
        END $$`);
      await owner.query(`CREATE TRIGGER reject_second_reassignment_notice BEFORE INSERT ON user_notifications
        FOR EACH ROW EXECUTE FUNCTION ${schema}.reject_second_reassignment_notice()`);
      try {
        await assert.rejects(reassign(untouched), { code: "P0001", message: "isolated second notification failure" });
        assert.deepEqual((await owner.query("SELECT * FROM procedures WHERE id=$1", [untouched.id])).rows[0], before);
        assert.equal((await owner.query("SELECT id FROM audit_events WHERE entity_id=$1 AND event_type='procedure_responsibility_reassigned'", [untouched.id])).rows.length, 0);
        assert.equal((await owner.query("SELECT id FROM user_notifications WHERE procedure_id=$1", [untouched.id])).rows.length, 0);
        assert.equal((await app.query("SELECT 1 AS usable")).rows[0].usable, 1);
      } finally {
        await owner.query("DROP TRIGGER reject_second_reassignment_notice ON user_notifications");
        await owner.query(`DROP FUNCTION ${schema}.reject_second_reassignment_notice()`);
      }
      assert.equal((await reassign(untouched)).responsibleUserId, next.id);
      assert.equal((await owner.query("SELECT id FROM user_notifications WHERE procedure_id=$1", [untouched.id])).rows.length, 2);
    });
  } finally {
    await app?.end();
    await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await owner.query(`DROP ROLE IF EXISTS ${role}`);
    await owner.end();
  }
});
