import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { listReassignmentCandidates, reassignProcedure } from "../src/domain/reassignment.js";
import { ACTIONS, canPerform } from "../src/domain/permissions.js";
import { PROCEDURE_STATUS } from "../src/domain/workflow.js";
import { createAppServer } from "../src/server.js";
import { hashToken } from "../src/security/auth.js";

const admin = { id: "11111111-1111-4111-8111-111111111111", role: "administrador", active: true };
const oldId = "22222222-2222-4222-8222-222222222222";
const nextId = "33333333-3333-4333-8333-333333333333";
const id = "44444444-4444-4444-8444-444444444444";
const details = { responsibleUserId: nextId, reason: "Cambio de responsable de la dependencia", revision: 7 };

function fakePool({ status = "borrador", eligible = true, failNotification = false } = {}) {
  const calls = [];
  const procedure = { id, name: "Formular el plan institucional", process_code: "DE", status,
    revision: 7, responsible_user_id: oldId, created_by_user_id: oldId, version: "2.0",
    current_payload: { fields: { objetivo: "Conservar contenido" } }, assigned_evaluator_id: admin.id };
  const target = { id: nextId, display_name: "Nueva responsable", displayName: "Nueva responsable" };
  let snapshot;
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql === "BEGIN") { snapshot = structuredClone(procedure); return { rows: [] }; }
      if (sql === "ROLLBACK") { Object.assign(procedure, snapshot); return { rows: [] }; }
      if (sql === "COMMIT") return { rows: [] };
      if (sql.startsWith("SELECT id, ")) return { rows: [{ ...procedure }] };
      if (sql.includes("FROM app_users u")) return { rows: eligible ? [target] : [] };
      if (sql.startsWith("UPDATE procedures SET responsible_user_id")) {
        procedure.responsible_user_id = params[1]; procedure.revision++;
        return { rows: [{ id, revision: procedure.revision, updated_at: new Date() }] };
      }
      if (sql.startsWith("INSERT INTO user_notifications") && failNotification) throw new Error("notification insert failed");
      if (sql.startsWith("INSERT INTO")) return { rows: [] };
      throw new Error(`Unexpected SQL ${sql}`);
    },
    release() { calls.push({ sql: "RELEASE" }); }
  };
  return { calls, procedure, query: client.query, connect: async () => client, end: async () => {} };
}

test("only active administrators can reassign, only in draft or returned states", async () => {
  for (const status of Object.values(PROCEDURE_STATUS)) {
    assert.equal(canPerform(admin, ACTIONS.REASSIGN_PROCEDURE, { procedure: { status } }),
      [PROCEDURE_STATUS.DRAFT, PROCEDURE_STATUS.RETURNED].includes(status));
  }
  for (const user of [null, { ...admin, role: "elaborador" }, { ...admin, role: "evaluador" },
    { ...admin, active: false }, { ...admin, mustChangePassword: true }]) {
    const pool = fakePool();
    await assert.rejects(reassignProcedure(pool, user, id, details), { code: "forbidden" });
    await assert.rejects(listReassignmentCandidates(pool, user, id), { code: "forbidden" });
    assert.equal(pool.calls.length, 0);
  }
});

test("reassignment preserves original creator, content, version, state and evaluator", async () => {
  for (const status of [PROCEDURE_STATUS.DRAFT, PROCEDURE_STATUS.RETURNED]) {
    const pool = fakePool({ status });
    const before = structuredClone(pool.procedure);
    const result = await reassignProcedure(pool, admin, id, details);
    assert.equal(result.responsibleUserId, nextId);
    assert.equal(pool.procedure.responsible_user_id, nextId);
    assert.equal(pool.procedure.revision, 8);
    for (const key of ["created_by_user_id", "current_payload", "status", "version", "assigned_evaluator_id"]) {
      assert.deepEqual(pool.procedure[key], before[key]);
    }
    const audit = pool.calls.find(call => call.sql.startsWith("INSERT INTO audit_events"));
    assert.equal(audit.params[1], admin.id); assert.equal(audit.params[3], details.reason);
    assert.deepEqual(JSON.parse(audit.params[4]), { previousResponsibleUserId: oldId, responsibleUserId: nextId, revision: 8 });
    assert.deepEqual(pool.calls.filter(call => call.sql.startsWith("INSERT INTO user_notifications")).map(call => call.params[1]), [oldId, nextId]);
    assert.deepEqual(pool.calls.slice(-2).map(call => call.sql), ["COMMIT", "RELEASE"]);
  }
});

test("invalid reason, target and revision are rejected before opening a transaction", async () => {
  for (const change of [{ reason: " " }, { reason: "a".repeat(2001) }, { responsibleUserId: "bad" },
    { revision: 0 }, { revision: "7" }]) {
    const pool = fakePool();
    await assert.rejects(reassignProcedure(pool, admin, id, { ...details, ...change }));
    assert.equal(pool.calls.length, 0);
  }
});

test("locked states, stale revisions, same account and ineligible accounts cannot be reassigned", async () => {
  const cases = [
    [fakePool({ status: PROCEDURE_STATUS.IN_REVIEW }), details, "reassignment_locked"],
    [fakePool({ status: PROCEDURE_STATUS.APPROVED }), details, "reassignment_locked"],
    [fakePool(), { ...details, revision: 6 }, "draft_conflict"],
    [fakePool(), { ...details, responsibleUserId: oldId }, "responsible_user_unchanged"],
    [fakePool({ eligible: false }), details, "responsible_user_unavailable"]
  ];
  for (const [pool, input, code] of cases) {
    await assert.rejects(reassignProcedure(pool, admin, id, input), { code });
    assert.equal(pool.procedure.responsible_user_id, oldId);
    assert.ok(!pool.calls.some(call => call.sql.startsWith("UPDATE procedures")));
    assert.deepEqual(pool.calls.slice(-2).map(call => call.sql), ["ROLLBACK", "RELEASE"]);
  }
});

test("audit and notifications fail atomically with the responsibility change", async () => {
  const pool = fakePool({ failNotification: true });
  await assert.rejects(reassignProcedure(pool, admin, id, details), /notification insert failed/);
  assert.equal(pool.procedure.responsible_user_id, oldId);
  assert.equal(pool.procedure.revision, 7);
  assert.ok(!pool.calls.some(call => call.sql === "COMMIT"));
});

test("candidate list is read only and excludes accounts outside the process, inactive accounts and current responsible", async () => {
  const pool = fakePool();
  const result = await listReassignmentCandidates(pool, admin, id);
  assert.equal(result.revision, 7); assert.equal(result.candidates[0].id, nextId);
  const call = pool.calls.at(-1);
  assert.match(call.sql, /u.role = 'elaborador' AND u.active = TRUE/);
  assert.match(call.sql, /up.process_code = \$1 AND u.id <> \$2/);
  assert.deepEqual(call.params, ["DE", oldId]);
  assert.ok(pool.calls.every(call => call.sql.trim().startsWith("SELECT")));
});

test("ownership follows responsible account while existing procedures retain creator access", () => {
  const procedure = { createdByUserId: oldId, responsibleUserId: nextId, status: "borrador" };
  assert.equal(canPerform({ id: oldId, role: "elaborador" }, ACTIONS.EDIT_PROCEDURE, { procedure }), false);
  assert.equal(canPerform({ id: nextId, role: "elaborador" }, ACTIONS.EDIT_PROCEDURE, { procedure }), true);
  delete procedure.responsibleUserId;
  assert.equal(canPerform({ id: oldId, role: "elaborador" }, ACTIONS.EDIT_PROCEDURE, { procedure }), true);
});

test("HTTP reassignment requires authentication, administrator role and CSRF", async () => {
  const pool = fakePool(); let role = "administrador", authenticated = true;
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    if (sql.includes("FROM app_sessions s")) return { rows: authenticated ? [{ ...admin, role,
      session_id: id, csrf_token_hash: hashToken("test-csrf"), must_change_password: false }] : [] };
    if (sql.startsWith("UPDATE app_sessions")) return { rows: [] };
    return originalQuery(sql, params);
  };
  const server = createAppServer({ poolFactory: () => pool });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/admin/procedures/${id}/responsibility`;
  const headers = { cookie: "__Host-asistente_session=test-session", "Content-Type": "application/json", "X-CSRF-Token": "test-csrf" };
  try {
    authenticated = false;
    assert.equal((await fetch(url, { headers })).status, 401);
    authenticated = true;
    for (const otherRole of ["elaborador", "evaluador"]) {
      role = otherRole;
      assert.equal((await fetch(url, { headers })).status, 403);
      assert.equal((await fetch(url, { method: "POST", headers, body: JSON.stringify(details) })).status, 403);
    }
    role = "administrador";
    assert.equal((await fetch(url, { method: "POST", headers: { ...headers, "X-CSRF-Token": "bad" }, body: JSON.stringify(details) })).status, 403);
    assert.equal((await fetch(url, { headers })).status, 200);
    const result = await fetch(url, { method: "POST", headers, body: JSON.stringify(details) });
    assert.equal(result.status, 200); assert.equal((await result.json()).reassignment.responsibleUserId, nextId);
    assert.equal((await fetch(url, { method: "POST", headers, body: JSON.stringify(details) })).status, 409);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

function dialogContext(request) {
  class Element {
    constructor() { this.children = []; this.open = false; this.disabled = false; this.value = ""; }
    replaceChildren(...nodes) { this.children = nodes; }
    reset() {} addEventListener() {} showModal() { this.open = true; } close() { this.open = false; }
  }
  const ids = ["reassignmentDialog", "reassignmentForm", "reassignmentTarget", "reassignmentReason", "reassignmentSummary", "reassignmentMessage", "reassignmentMessage", "confirmReassignment", "cancelReassignment", "consultationMessage"];
  const context = { currentUserRole: "administrador", document: { createElement: () => new Element() },
    ui: Object.fromEntries(ids.map(key => [key, new Element()])), request, setMessage: (element, message) => { element.textContent = message; },
    errorMessages: {}, handleRequestError: (error, element) => { element.textContent = error.code; }, loadConsultationList: async () => {} };
  vm.createContext(context);
  const source = readFileSync(new URL("../public/drafts.js", import.meta.url), "utf8");
  vm.runInContext(source.slice(source.indexOf("let reassignmentRequestVersion"), source.indexOf("ui.consultationButton.addEventListener('click'")), context);
  return context;
}

test("dialog sends selected account, required reason and exact revision without editing content", async () => {
  const calls = [];
  const context = dialogContext(async (url, options) => { calls.push({ url, options }); return { revision: 7, candidates: [{ id: nextId, displayName: "Nueva responsable" }] }; });
  await context.openReassignment({ id, name: "Formular el plan", revision: 7, canReassign: true });
  assert.equal(context.ui.confirmReassignment.disabled, false);
  context.ui.reassignmentTarget.value = nextId; context.ui.reassignmentReason.value = " Cambio de equipo ";
  await context.submitReassignment({ preventDefault() {} });
  assert.equal(calls[1].options.method, "POST"); assert.equal(calls[1].options.csrf, true);
  assert.equal(JSON.stringify(calls[1].options.body), JSON.stringify({ responsibleUserId: nextId, reason: "Cambio de equipo", revision: 7 }));
  assert.equal(context.ui.reassignmentDialog.open, false);
});

test("dialog refuses stale revisions and ignores a delayed response after closing", async () => {
  const stale = dialogContext(async () => ({ revision: 8, candidates: [] }));
  await stale.openReassignment({ id, revision: 7, canReassign: true });
  assert.equal(stale.ui.confirmReassignment.disabled, true);
  let finish;
  const delayed = dialogContext(() => new Promise(resolve => { finish = resolve; }));
  const opening = delayed.openReassignment({ id, revision: 7, canReassign: true });
  delayed.ui.reassignmentDialog.open = false;
  finish({ revision: 7, candidates: [{ id: nextId, displayName: "Nueva responsable" }] });
  await opening;
  assert.equal(delayed.ui.confirmReassignment.disabled, true);
});
