import test from "node:test";
import assert from "node:assert/strict";
import { createAppServer } from "../src/server.js";
import { hashToken } from "../src/security/auth.js";
import { getAccountProcessAssignments, listAccounts, setAccountActive, setAccountProcessAssignments } from "../src/security/admin-users.js";

const actor = { id: "11111111-1111-4111-8111-111111111111", role: "administrador" };
const targetId = "22222222-2222-4222-8222-222222222222";

function account(overrides = {}) {
  return {
    id: targetId,
    username: "usuario001",
    email: "usuario@entidad.gov.co",
    display_name: "Usuario de prueba",
    role: "elaborador",
    active: true,
    mfa_enabled: false,
    must_change_password: false,
    mfa_secret_ciphertext: null,
    password_hash: "never-expose-this",
    ...overrides
  };
}

function fakeDatabase({ actorActive = true, target = account(), activeAdminCount = 1 } = {}) {
  const state = { target, revoked: false, audited: false, committed: false, rolledBack: false };
  const client = {
    async query(sql, params) {
      if (sql === "BEGIN" || sql.startsWith("SELECT pg_advisory_xact_lock")) return { rows: [] };
      if (sql === "COMMIT") {
        state.committed = true;
        return { rows: [] };
      }
      if (sql === "ROLLBACK") {
        state.rolledBack = true;
        return { rows: [] };
      }
      if (sql.startsWith("SELECT role, active FROM app_users")) {
        return { rows: [{ role: "administrador", active: actorActive }] };
      }
      if (sql.includes("FROM app_users WHERE id = $1 FOR UPDATE")) return { rows: [state.target] };
      if (sql.startsWith("SELECT count(*) AS count")) return { rows: [{ count: String(activeAdminCount) }] };
      if (sql.startsWith("UPDATE app_users")) {
        state.target = { ...state.target, active: params[1] };
        return { rows: [state.target] };
      }
      if (sql.startsWith("UPDATE app_sessions SET revoked_at")) {
        state.revoked = true;
        return { rows: [] };
      }
      if (sql.startsWith("INSERT INTO audit_events")) {
        state.audited = params[2];
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  };
  return { pool: { async connect() { return client; } }, state };
}

test("account listing never returns password hashes or MFA secrets", async () => {
  const users = await listAccounts({
    async query() { return { rows: [account()] }; }
  });
  assert.deepEqual(users, [{
    id: targetId,
    username: "usuario001",
    email: "usuario@entidad.gov.co",
    displayName: "Usuario de prueba",
    role: "elaborador",
    active: true,
    mfaEnabled: false,
    mustChangePassword: false,
    processCodes: []
  }]);
});

test("account process assignments list only active processes and existing inactive grants", async () => {
  const calls = [];
  const assignments = await getAccountProcessAssignments({
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT id, role FROM app_users")) return { rows: [{ id: targetId, role: "evaluador" }] };
      return { rows: [
        { code: "PD", name: "Desarrollo", active: true, assigned: true },
        { code: "DE", name: "Economico", active: true, assigned: false },
        { code: "IN", name: "Inactivo", active: false, assigned: true }
      ] };
    }
  }, { targetId });
  assert.deepEqual(assignments.processCodes, ["PD", "IN"]);
  assert.match(calls[1].sql, /p\.active = TRUE OR EXISTS/);
});

test("process assignment replacement is atomic, audited, and accepts only active grants", async () => {
  const state = { processCodes: ["PD"], committed: false, rolledBack: false, audited: false };
  const client = {
    async query(sql, params) {
      if (sql === "BEGIN") return { rows: [] };
      if (sql === "COMMIT") { state.committed = true; return { rows: [] }; }
      if (sql === "ROLLBACK") { state.rolledBack = true; return { rows: [] }; }
      if (sql.startsWith("SELECT role, active FROM app_users")) return { rows: [{ role: "administrador", active: true }] };
      if (sql.startsWith("SELECT id, role FROM app_users")) return { rows: [{ id: targetId, role: "evaluador" }] };
      if (sql.startsWith("SELECT process_code FROM user_processes")) return { rows: state.processCodes.map(process_code => ({ process_code })) };
      if (sql.startsWith("SELECT code, active FROM processes")) return { rows: params[0].map(code => ({ code, active: code !== "IN" })) };
      if (sql.startsWith("DELETE FROM user_processes")) { state.processCodes = []; return { rows: [] }; }
      if (sql.startsWith("INSERT INTO user_processes")) { state.processCodes = params[1]; return { rows: [] }; }
      if (sql.startsWith("INSERT INTO audit_events")) { state.audited = JSON.parse(params[3]); return { rows: [] }; }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  };
  const pool = { async connect() { return client; } };
  const result = await setAccountProcessAssignments(pool, { actor, targetId, processCodes: ["DE", "PD"] });
  assert.deepEqual(result.processCodes, ["DE", "PD"]);
  assert.deepEqual(state.processCodes, ["DE", "PD"]);
  assert.deepEqual(state.audited, { processCodes: ["DE", "PD"] });
  assert.equal(state.committed, true);
  assert.equal(state.rolledBack, false);

  await assert.rejects(setAccountProcessAssignments(pool, { actor, targetId, processCodes: ["IN"] }), {
    code: "invalid_process_assignment", status: 400
  });
  assert.equal(state.rolledBack, true);
});

test("process assignment rejects duplicate codes and administrator targets", async () => {
  const pool = {
    async connect() {
      return {
        async query(sql) {
          if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [] };
          if (sql.startsWith("SELECT role, active FROM app_users")) return { rows: [{ role: "administrador", active: true }] };
          if (sql.startsWith("SELECT id, role FROM app_users")) return { rows: [{ id: targetId, role: "administrador" }] };
          throw new Error(`Unexpected SQL: ${sql}`);
        },
        release() {}
      };
    }
  };
  await assert.rejects(setAccountProcessAssignments(pool, { actor, targetId, processCodes: ["PD", "PD"] }), {
    code: "invalid_process_assignment", status: 400
  });
  await assert.rejects(setAccountProcessAssignments(pool, { actor, targetId, processCodes: [] }), {
    code: "invalid_process_assignment_target", status: 409
  });
});

test("deactivation revokes sessions and writes an audit event atomically", async () => {
  const { pool, state } = fakeDatabase();
  const result = await setAccountActive(pool, { actor, targetId, active: false });
  assert.equal(result.active, false);
  assert.equal(state.revoked, true);
  assert.equal(state.audited, "user_deactivated");
  assert.equal(state.committed, true);
});

test("reactivation does not revive old sessions", async () => {
  const { pool, state } = fakeDatabase({ target: account({ active: false }) });
  const result = await setAccountActive(pool, { actor, targetId, active: true });
  assert.equal(result.active, true);
  assert.equal(state.revoked, false);
  assert.equal(state.audited, "user_reactivated");
  assert.equal(state.committed, true);
});

test("the last active administrator cannot be deactivated", async () => {
  const { pool, state } = fakeDatabase({
    target: account({ role: "administrador", mfa_enabled: true, mfa_secret_ciphertext: "ciphertext" })
  });
  await assert.rejects(setAccountActive(pool, { actor, targetId, active: false }), {
    code: "last_active_admin",
    status: 409
  });
  assert.equal(state.rolledBack, true);
  assert.equal(state.audited, false);
});

test("a pending administrator cannot be activated without MFA", async () => {
  const { pool, state } = fakeDatabase({ target: account({ role: "administrador", active: false }) });
  await assert.rejects(setAccountActive(pool, { actor, targetId, active: true }), {
    code: "admin_mfa_required",
    status: 409
  });
  assert.equal(state.rolledBack, true);
  assert.equal(state.target.active, false);
});

test("administrator status is checked again inside the mutation transaction", async () => {
  const { pool, state } = fakeDatabase({ actorActive: false });
  await assert.rejects(setAccountActive(pool, { actor, targetId, active: false }), {
    code: "forbidden",
    status: 403
  });
  assert.equal(state.rolledBack, true);
  assert.equal(state.revoked, false);
});

test("admin user endpoints require a live administrator session and CSRF for changes", async () => {
  const token = "test-session-token";
  const csrf = "test-csrf-token";
  const user = account({ id: actor.id, role: "administrador", mfa_enabled: true });
  let role = "administrador";
  const poolFactory = () => ({
    async query(sql, params) {
      if (sql.includes("FROM app_sessions s")) {
        return { rows: params[0] === hashToken(token) ? [{
          session_id: "33333333-3333-4333-8333-333333333333",
          csrf_token_hash: hashToken(csrf),
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          role
        }] : [] };
      }
      if (sql.startsWith("UPDATE app_sessions SET last_seen_at")) return { rows: [] };
      if (sql.includes("FROM app_users u ORDER BY u.created_at")) return { rows: [user] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async end() {}
  });
  const server = createAppServer({ poolFactory, secureCookies: false });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = `__Host-asistente_session=${token}`;
  try {
    const anonymous = await fetch(`${baseUrl}/api/admin/users`);
    assert.equal(anonymous.status, 401);

    role = "elaborador";
    const forbidden = await fetch(`${baseUrl}/api/admin/users`, { headers: { cookie } });
    assert.equal(forbidden.status, 403);

    role = "administrador";
    const allowed = await fetch(`${baseUrl}/api/admin/users`, { headers: { cookie } });
    assert.equal(allowed.status, 200);
    assert.equal((await allowed.json()).users[0].email, user.email);

    const mutation = await fetch(`${baseUrl}/api/admin/users/${targetId}/deactivate`, {
      method: "POST",
      headers: { cookie }
    });
    assert.equal(mutation.status, 403);
    assert.equal((await mutation.json()).error, "csrf_failed");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("process assignment endpoint requires admin access and CSRF, then saves evaluator grants", async () => {
  const token = "process-session-token";
  const csrf = "process-csrf-token";
  const state = { role: "administrador", processCodes: [], audited: false };
  const client = {
    async query(sql, params) {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.startsWith("SELECT role, active FROM app_users")) return { rows: [{ role: "administrador", active: true }] };
      if (sql.startsWith("SELECT id, role FROM app_users WHERE id = $1 FOR UPDATE")) return { rows: [{ id: targetId, role: "evaluador" }] };
      if (sql.startsWith("SELECT process_code FROM user_processes")) return { rows: state.processCodes.map(process_code => ({ process_code })) };
      if (sql.startsWith("SELECT code, active FROM processes")) return { rows: params[0].map(code => ({ code, active: true })) };
      if (sql.startsWith("DELETE FROM user_processes")) { state.processCodes = []; return { rows: [] }; }
      if (sql.startsWith("INSERT INTO user_processes")) { state.processCodes = params[1]; return { rows: [] }; }
      if (sql.startsWith("INSERT INTO audit_events")) { state.audited = true; return { rows: [] }; }
      throw new Error(`Unexpected client SQL: ${sql}`);
    },
    release() {}
  };
  const poolFactory = () => ({
    async query(sql, params) {
      if (sql.includes("FROM app_sessions s")) return { rows: params[0] === hashToken(token) ? [{
        session_id: "33333333-3333-4333-8333-333333333333", csrf_token_hash: hashToken(csrf),
        id: actor.id, email: null, display_name: "Administrador", role: state.role, must_change_password: false
      }] : [] };
      if (sql.startsWith("UPDATE app_sessions SET last_seen_at")) return { rows: [] };
      if (sql.startsWith("SELECT id, role FROM app_users WHERE id = $1")) return { rows: [{ id: targetId, role: "evaluador" }] };
      if (sql.startsWith("SELECT p.code, p.name, p.active")) return { rows: [
        { code: "PD", name: "Desarrollo", active: true, assigned: false }
      ] };
      throw new Error(`Unexpected pool SQL: ${sql}`);
    },
    async connect() { return client; },
    async end() {}
  });
  const server = createAppServer({ poolFactory, secureCookies: false });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/admin/users/${targetId}/processes`;
  const cookie = `__Host-asistente_session=${token}`;
  try {
    assert.equal((await fetch(url)).status, 401);
    const listed = await fetch(url, { headers: { cookie } });
    assert.equal(listed.status, 200);
    assert.deepEqual((await listed.json()).processes.map(process => process.code), ["PD"]);

    const noCsrf = await fetch(url, {
      method: "PUT", headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ processCodes: ["PD"] })
    });
    assert.equal(noCsrf.status, 403);

    const saved = await fetch(url, {
      method: "PUT", headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" },
      body: JSON.stringify({ processCodes: ["PD"] })
    });
    assert.equal(saved.status, 200);
    assert.deepEqual((await saved.json()).processCodes, ["PD"]);
    assert.deepEqual(state.processCodes, ["PD"]);
    assert.equal(state.audited, true);

    state.role = "evaluador";
    const forbidden = await fetch(url, {
      method: "PUT", headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" },
      body: JSON.stringify({ processCodes: [] })
    });
    assert.equal(forbidden.status, 403);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("an authenticated administrator can deactivate a user through HTTP", async () => {
  const token = "test-session-token";
  const csrf = "test-csrf-token";
  const { pool, state } = fakeDatabase();
  const poolFactory = () => ({
    ...pool,
    async query(sql, params) {
      if (sql.includes("FROM app_sessions s")) {
        return { rows: params[0] === hashToken(token) ? [{
          session_id: "33333333-3333-4333-8333-333333333333",
          csrf_token_hash: hashToken(csrf),
          id: actor.id,
          email: "admin@entidad.gov.co",
          display_name: "Administrador",
          role: actor.role
        }] : [] };
      }
      if (sql.startsWith("UPDATE app_sessions SET last_seen_at")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async end() {}
  });
  const server = createAppServer({ poolFactory, secureCookies: false });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${baseUrl}/api/admin/users/${targetId}/deactivate`, {
      method: "POST",
      headers: {
        cookie: `__Host-asistente_session=${token}`,
        "x-csrf-token": csrf
      }
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user.active, false);
    assert.equal(state.revoked, true);
    assert.equal(state.audited, "user_deactivated");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

