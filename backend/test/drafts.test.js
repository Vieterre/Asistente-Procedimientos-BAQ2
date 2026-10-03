import test from "node:test";
import assert from "node:assert/strict";
import { createAppServer } from "../src/server.js";
import { createDraft, getOwnDraft, listOwnDrafts, updateOwnDraft } from "../src/domain/drafts.js";
import { hashToken } from "../src/security/auth.js";

const author = { id: "11111111-1111-4111-8111-111111111111", role: "elaborador", mustChangePassword: false };
const other = { id: "22222222-2222-4222-8222-222222222222", role: "elaborador", mustChangePassword: false };
const draftId = "33333333-3333-4333-8333-333333333333";
const row = {
  id: draftId, code: null, name: "Borrador", process_code: "DE", version: "1.0",
  status: "borrador", revision: 1, updated_at: new Date(), current_payload: { fields: { nombre: "Borrador" } }
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
  assert.equal(calls.find(call => call.sql.startsWith("INSERT INTO procedures")).params[1], "Borrador");
  assert.deepEqual(calls.slice(-2).map(call => call.sql.startsWith("INSERT INTO audit_events") ? "AUDIT" : call.sql), ["AUDIT", "COMMIT"]);
});

test("draft creation rejects bad data and inactive processes", async () => {
  const noConnect = { connect: async () => { throw new Error("should not connect"); } };
  await assert.rejects(createDraft(noConnect, author, { name: "", processCode: "DE", payload: {} }), { code: "invalid_draft" });
  await assert.rejects(createDraft(noConnect, author, { name: "Ok", processCode: "??", payload: {} }), { code: "invalid_process" });
  await assert.rejects(createDraft(noConnect, { ...author, mustChangePassword: true }, { name: "Ok", processCode: "DE", payload: {} }), { code: "forbidden" });
  let rolledBack = false;
  const pool = { connect: async () => ({
    async query(sql) {
      if (sql === "BEGIN") return { rows: [] };
      if (sql === "ROLLBACK") { rolledBack = true; return { rows: [] }; }
      if (sql.startsWith("SELECT 1 FROM processes")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  }) };
  await assert.rejects(createDraft(pool, author, { name: "Ok", processCode: "DE", payload: {} }), { code: "invalid_process" });
  assert.equal(rolledBack, true);
});

test("list and detail are scoped to the owner", async () => {
  const queries = [];
  const pool = { async query(sql, params) {
    queries.push({ sql, params });
    return { rows: params.includes(author.id) ? [row] : [] };
  } };
  assert.equal((await listOwnDrafts(pool, author))[0].payload, undefined);
  assert.deepEqual((await getOwnDraft(pool, author, draftId)).payload, row.current_payload);
  await assert.rejects(getOwnDraft(pool, other, draftId), { code: "draft_not_found", status: 404 });
  assert.ok(queries.every(call => call.sql.includes("created_by_user_id") &&
    (call.params.includes(author.id) || call.params.includes(other.id))));
});

test("update rejects another author, locked status, and stale revision", async () => {
  let status = "borrador";
  let revision = 2;
  const calls = [];
  const pool = { connect: async () => ({
    async query(sql, params) {
      calls.push(sql);
      if (["BEGIN", "ROLLBACK", "COMMIT"].includes(sql)) return { rows: [] };
      if (sql.startsWith("SELECT id, status")) return { rows: params[1] === author.id ? [{ id: draftId, status, created_by_user_id: author.id, revision }] : [] };
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
        fields: { nombre: "Nuevo", objetivo: "Objetivo", alcance: "Alcance", definiciones: "Definiciones", condiciones: "Condiciones" },
        activities: [{ actividad: "Inicio" }]
      },
      revision: 1
    }) });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).procedure.revision, 2);
    const reopened = await fetch(`${base}/${procedure.id}`, { headers });
    const reopenedPayload = (await reopened.json()).procedure.payload;
    assert.deepEqual(reopenedPayload.fields, { nombre: "Nuevo", objetivo: "Objetivo", alcance: "Alcance", definiciones: "Definiciones", condiciones: "Condiciones" });
    assert.deepEqual(reopenedPayload.activities, [{ actividad: "Inicio" }]);
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
  const poolFactory = () => ({
    async query(sql, params) {
      if (sql.includes("FROM app_sessions s")) return { rows: params[0] === hashToken(token) ? [{
        session_id: draftId, csrf_token_hash: hashToken("csrf"), id: userId,
        username: "author1", email: null, display_name: "Author", role,
        must_change_password: mustChangePassword
      }] : [] };
      if (sql.startsWith("UPDATE app_sessions SET last_seen_at")) return { rows: [] };
      if (sql.startsWith("SELECT code, name FROM processes")) {
        catalogReads += 1;
        return { rows: [{ code: "DE", name: "Desarrollo economico" }] };
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
    assert.deepEqual((await response.json()).processes, [{ code: "DE", name: "Desarrollo economico" }]);
    role = "evaluador";
    assert.equal((await fetch(url, { headers: { cookie } })).status, 403);
    assert.equal(catalogReads, 1);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
