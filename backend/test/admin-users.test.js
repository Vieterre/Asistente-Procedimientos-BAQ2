import test from "node:test";
import assert from "node:assert/strict";
import { createAppServer } from "../src/server.js";
import { hashToken } from "../src/security/auth.js";
import { listAccounts, setAccountActive } from "../src/security/admin-users.js";

const actor = { id: "11111111-1111-4111-8111-111111111111", role: "administrador" };
const targetId = "22222222-2222-4222-8222-222222222222";

function account(overrides = {}) {
  return {
    id: targetId,
    email: "usuario@entidad.gov.co",
    display_name: "Usuario de prueba",
    role: "elaborador",
    active: true,
    mfa_enabled: false,
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
    email: "usuario@entidad.gov.co",
    displayName: "Usuario de prueba",
    role: "elaborador",
    active: true,
    mfaEnabled: false
  }]);
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
      if (sql.includes("FROM app_users ORDER BY created_at")) return { rows: [user] };
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
