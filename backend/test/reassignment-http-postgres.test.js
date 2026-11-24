import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../src/db/migrate.js";
import { EVALUATION_CRITERIA } from "../src/domain/evaluation-rubric.js";
import { createAppServer } from "../src/server.js";
import { SESSION_COOKIE } from "../src/security/auth.js";
import { encryptSecret, generateTotpSecret, totpCode } from "../src/security/mfa.js";
import { hashPassword } from "../src/security/passwords.js";

const document = {
  fields: {
    objetivo: "Revisar el plan institucional", alcance: "Desde la solicitud hasta la revisión",
    definiciones: "Plan: documento institucional", condiciones: "Aplicar la normativa vigente",
    elaboro: "Profesional", reviso: "Jefe", aprobo: "Director", aproboNombre: "Directora de prueba"
  },
  norms: [], annexes: [],
  settings: { annexesNotApplicable: true, normativityConfirmedMissingTypes: ["Interna", "Externa"] },
  changes: [{ version: "1.0", fecha: "2026-11-23", razon: "Creación" }],
  activities: [
    { uid: "s", tipo: "Inicio", descripcion: "Solicitud recibida" },
    { uid: "a", tipo: "Actividad", actividad: "Revisar solicitud", descripcion: "Verifica la información",
      responsable: "Profesional", tieneControl: true, controlResponsable: "Profesional",
      controlPeriodicidad: "Por solicitud", controlAccion: "Verifica", controlEjecucion: "Compara",
      controlDesviacion: "Solicita ajuste", controlEvidencia: "Lista" },
    { uid: "d", tipo: "Decisión", actividad: "¿Cumple?", descripcion: "¿Cumple?",
      responsable: "Profesional", decisionSi: "f", decisionNo: "b" },
    { uid: "b", tipo: "Actividad", actividad: "Ajustar solicitud", descripcion: "Completa los requisitos",
      responsable: "Profesional" },
    { uid: "f", tipo: "Fin", descripcion: "Solicitud revisada" }
  ]
};

const connectionString = process.env.CIVICFLOW_TEST_DATABASE_URL;
test("HTTP and PostgreSQL: sign-in, reassignment and both rounds of administrative review",
  { skip: !connectionString }, async t => {
    const suffix = randomUUID().replaceAll("-", "");
    const schema = `http_test_${suffix}`;
    const role = `http_app_${suffix}`;
    function databaseUrl(options) {
      const url = new URL(connectionString);
      url.searchParams.set("options", options);
      return url.toString();
    }
    // The dedicated schema is the sole search path, including for migrations and seeding.
    const owner = new pg.Pool({ connectionString: databaseUrl(`-c search_path=${schema}`) });
    let server;
    let createdSchema = false;
    let createdRole = false;
    const previousMfaKey = process.env.MFA_ENCRYPTION_KEY;
    const testKey = randomUUID();
    const adminSecret = generateTotpSecret();
    const password = randomUUID();
    try {
      await owner.query(`CREATE SCHEMA ${schema}`);
      createdSchema = true;
      assert.equal((await owner.query("SELECT current_schema() AS name")).rows[0].name, schema);
      await runMigrations(owner);
      await owner.query(`CREATE ROLE ${role} NOLOGIN`);
      createdRole = true;
      await owner.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
      const grants = await readFile(new URL("../../deploy/grant-drafts-production.sql", import.meta.url), "utf8");
      await owner.query(grants.replaceAll("public.", `${schema}.`).replaceAll("asistente_app_prod", role));
      process.env.MFA_ENCRYPTION_KEY = testKey;
      const users = {};
      for (const [name, accountRole] of Object.entries({
        admin: "administrador", previous: "elaborador", next: "elaborador", evaluator: "evaluador"
      })) {
        const id = randomUUID();
        const admin = accountRole === "administrador";
        await owner.query(
          `INSERT INTO app_users (id, username, display_name, role, password_hash, mfa_enabled, mfa_secret_ciphertext)
           VALUES ($1, $2, $2, $3, $4, $5, $6)`,
          [id, name, accountRole, hashPassword(password), admin, admin ? encryptSecret(adminSecret, testKey) : null]
        );
        await owner.query("INSERT INTO user_processes (user_id, process_code) VALUES ($1, 'DE')", [id]);
        users[name] = { id };
      }
      const appUrl = databaseUrl(`-c search_path=${schema} -c role=${role}`);
      server = createAppServer({ poolFactory: () => new pg.Pool({ connectionString: appUrl }), secureCookies: true });
      const listening = once(server, "listening");
      server.listen(0, "127.0.0.1");
      await listening;
      const base = `http://127.0.0.1:${server.address().port}`;
      async function request(user, method, path, { body, status = 200, error, csrf = user?.csrf } = {}) {
        const headers = {};
        if (user?.cookie) headers.cookie = user.cookie;
        if (csrf && method !== "GET") headers["x-csrf-token"] = csrf;
        if (body) headers["content-type"] = "application/json";
        const response = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
        const data = await response.json();
        assert.equal(response.status, status, `${method} ${path}: ${data.error || response.status}`);
        assert.equal(data.ok, status < 400);
        if (error) assert.equal(data.error, error);
        return { data, headers: response.headers };
      }

      await t.test("all four accounts open distinct sessions and administrator login requires MFA", async () => {
        await request(null, "POST", "/api/auth/login", {
          body: { username: "admin", password }, status: 401, error: "mfa_required"
        });
        for (const [name, user] of Object.entries(users)) {
          const body = { username: name, password };
          if (name === "admin") body.otp = totpCode(adminSecret);
          const { data, headers } = await request(null, "POST", "/api/auth/login", { body });
          const cookie = headers.get("set-cookie");
          assert.ok(cookie?.startsWith(`${SESSION_COOKIE}=`));
          for (const flag of ["HttpOnly", "Secure", "SameSite=Lax"]) assert.ok(cookie.split("; ").includes(flag));
          user.cookie = cookie.split(";")[0];
          user.csrf = data.csrfToken;
          assert.ok(user.csrf);
          assert.equal((await request(user, "GET", "/api/auth/me")).data.user.id, user.id);
        }
        assert.equal(new Set(Object.values(users).map(user => user.cookie)).size, 4);
      });
      const { admin, previous, next, evaluator } = users;
      const name = "Formular el plan institucional";
      const draft = (await request(previous, "POST", "/api/procedures", {
        body: { name, processCode: "DE", consecutive: "1", payload: document }, status: 201
      })).data.procedure;
      const own = `/api/procedures/${draft.id}`;
      const responsibility = `/api/admin/procedures/${draft.id}/responsibility`;
      const approval = `/api/admin/procedures/${draft.id}/final-approval`;
      const assigned = `/api/evaluator/procedures/${draft.id}`;
      await t.test("administrator transfers once and role, CSRF and revision checks apply over HTTP", async () => {
        const candidates = (await request(admin, "GET", responsibility)).data;
        assert.deepEqual(candidates.candidates.map(user => user.id), [next.id]);
        assert.equal(candidates.revision, draft.revision);
        const body = { responsibleUserId: next.id, reason: "Cambio de equipo", revision: draft.revision };
        await request(null, "GET", responsibility, { status: 401, error: "unauthenticated" });
        await request(previous, "POST", responsibility, { body, status: 403, error: "forbidden" });
        await request(admin, "POST", responsibility, { body, csrf: null, status: 403, error: "csrf_failed" });
        const result = (await request(admin, "POST", responsibility, { body })).data.reassignment;
        assert.equal(result.responsibleUserId, next.id);
        assert.equal(result.revision, draft.revision + 1);
        await request(admin, "POST", responsibility, { body, status: 409, error: "draft_conflict" });
        const detail = (await request(admin, "GET", `/api/admin/consultation/procedures/${draft.id}`)).data.procedure;
        assert.equal(detail.createdByUserId, previous.id);
        assert.equal(detail.responsibleUserId, next.id);
        assert.deepEqual(detail.payload, document);
      });
      await t.test("existing sessions immediately reflect changed responsibility and notifications", async () => {
        const body = { name, payload: document, revision: draft.revision };
        await request(previous, "GET", own, { status: 404, error: "draft_not_found" });
        await request(previous, "PUT", own, { body, status: 404, error: "draft_not_found" });
        assert.deepEqual((await request(previous, "GET", "/api/procedures")).data.procedures, []);
        assert.deepEqual((await request(next, "GET", "/api/procedures")).data.procedures.map(p => p.id), [draft.id]);
        const detail = (await request(next, "GET", own)).data.procedure;
        const saved = (await request(next, "PUT", own, { body: { ...body, revision: detail.revision } })).data.procedure;
        assert.equal(saved.revision, detail.revision + 1);
        for (const user of [previous, next]) {
          const { notifications } = (await request(user, "GET", "/api/notifications")).data;
          const notices = notifications.filter(n => n.procedureId === draft.id && n.eventType === "procedure_responsibility_reassigned");
          assert.equal(notices.length, 1);
        }
      });
      async function submitAndReview() {
        const revision = (await request(next, "GET", own)).data.procedure.revision;
        await request(next, "POST", own + "/submit", { body: { evaluatorId: evaluator.id, revision } });
        await request(evaluator, "POST", assigned + "/start");
        const criteria = Object.fromEntries(EVALUATION_CRITERIA.map(({ id }) => [
          id, { result: "Cumple", observation: "Verificado", findingStatus: "Cerrado" }
        ]));
        await request(evaluator, "PUT", assigned + "/evaluation", { body: { criteria, concept: "Favorable" } });
        const result = await request(evaluator, "POST", assigned + "/decision", { body: { decision: "favorable" } });
        assert.equal(result.data.decision.status, "pendiente_visto_bueno_administrativo");
        assert.deepEqual((await request(admin, "GET", "/api/admin/pending-approvals")).data.procedures.map(p => p.id), [draft.id]);
      }
      await t.test("administrator can return a favorable evaluation with a recorded observation", async () => {
        await submitAndReview();
        await request(admin, "GET", responsibility, { status: 409, error: "reassignment_locked" });
        await request(admin, "POST", approval, {
          body: { decision: "devolver" }, status: 400, error: "admin_return_observation_required"
        });
        const observation = "Precisar el alcance del plan.";
        const result = await request(admin, "POST", approval, { body: { decision: "devolver", observation } });
        assert.equal(result.data.decision.status, "devuelto_para_ajustes");
        const detail = (await request(next, "GET", own)).data.procedure;
        assert.equal(detail.adminApprovalObservation, observation);
        assert.equal(detail.adminApprovalByUserId, admin.id);
        assert.deepEqual((await request(admin, "GET", "/api/admin/pending-approvals")).data.procedures, []);
        assert.ok((await request(admin, "GET", responsibility)).data.candidates.some(user => user.id === previous.id));
      });
      await t.test("second technical review enables formal approval and the approved version stays locked", async () => {
        const detail = (await request(next, "GET", own)).data.procedure;
        const revised = structuredClone(detail.payload);
        revised.fields.alcance = "Desde la solicitud del plan anual hasta la aprobación de su revisión.";
        await request(next, "PUT", own, { body: { name, revision: detail.revision, payload: revised } });
        await submitAndReview();
        const result = await request(admin, "POST", approval, { body: { decision: "aprobar" } });
        assert.equal(result.data.decision.status, "aprobado_formalmente");
        await request(admin, "POST", approval, {
          body: { decision: "devolver", observation: "Revisar nuevamente." }, status: 403, error: "draft_locked"
        });
        await request(admin, "GET", responsibility, { status: 409, error: "reassignment_locked" });
        const locked = (await request(next, "GET", own)).data.procedure;
        assert.equal(locked.status, "aprobado_formalmente");
        assert.equal(locked.revision, result.data.decision.procedure.revision);
        assert.deepEqual(locked.payload, revised);
      });
      await t.test("sign-out revokes the administrator session", async () => {
        await request(admin, "POST", "/api/auth/logout");
        await request(admin, "GET", responsibility, { status: 401, error: "unauthenticated" });
      });
    } finally {
      if (previousMfaKey === undefined) delete process.env.MFA_ENCRYPTION_KEY;
      else process.env.MFA_ENCRYPTION_KEY = previousMfaKey;
      try {
        if (server?.listening) await new Promise(resolve => server.close(resolve));
        if (createdSchema) await owner.query(`DROP SCHEMA ${schema} CASCADE`);
        if (createdRole) await owner.query(`DROP ROLE ${role}`);
      } finally {
        await owner.end();
      }
    }
  });
