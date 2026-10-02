import test from "node:test";
import assert from "node:assert/strict";
import { createAppServer } from "../src/server.js";
import { createAccount, resetAccountPassword } from "../src/security/admin-users.js";
import { hashToken, loginUser } from "../src/security/auth.js";
import { hashPassword, verifyPassword } from "../src/security/passwords.js";

const adminId = "11111111-1111-4111-8111-111111111111";
const newUserId = "22222222-2222-4222-8222-222222222222";

test("administrator creates a username account with no email and a one-time password", async () => {
  const calls = [];
  let savedHash;
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.startsWith("SELECT role, active FROM app_users")) {
        return { rows: [{ role: "administrador", active: true }] };
      }
      if (sql.startsWith("INSERT INTO app_users")) {
        savedHash = params[4];
        return { rows: [{
          id: newUserId,
          username: params[1],
          email: null,
          display_name: params[2],
          role: params[3],
          active: true,
          mfa_enabled: false,
          must_change_password: true
        }] };
      }
      if (sql.startsWith("INSERT INTO audit_events")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  };
  const pool = { async connect() { return client; } };
  const result = await createAccount(pool, {
    actor: { id: adminId, role: "administrador" },
    username: "Usuario001",
    displayName: "Elaborador de prueba",
    role: "elaborador"
  });

  assert.equal(result.user.username, "usuario001");
  assert.equal(result.user.email, null);
  assert.equal(result.user.mustChangePassword, true);
  assert.match(result.initialPassword, /^[A-Za-z0-9]{20}$/);
  assert.equal(verifyPassword(result.initialPassword, savedHash), true);
  assert.equal(calls.filter(call => call.sql.startsWith("INSERT INTO audit_events")).length, 1);
  assert.equal(calls.at(-1).sql, "COMMIT");
});

test("account creation rejects administrator roles and malformed usernames", async () => {
  const pool = { async connect() { throw new Error("should not connect"); } };
  for (const details of [
    { username: "usuario001", displayName: "Admin", role: "administrador" },
    { username: "x@alcaldia.gov.co", displayName: "Usuario", role: "elaborador" }
  ]) {
    await assert.rejects(createAccount(pool, { actor: { id: adminId }, ...details }), {
      code: "invalid_user_details",
      status: 400
    });
  }
});

test("duplicate usernames are rejected without returning a password", async () => {
  let rolledBack = false;
  const client = {
    async query(sql) {
      if (sql === "BEGIN") return { rows: [] };
      if (sql === "ROLLBACK") {
        rolledBack = true;
        return { rows: [] };
      }
      if (sql.startsWith("SELECT role, active FROM app_users")) {
        return { rows: [{ role: "administrador", active: true }] };
      }
      if (sql.startsWith("INSERT INTO app_users")) {
        const error = new Error("duplicate key");
        error.code = "23505";
        throw error;
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  };
  await assert.rejects(createAccount({ async connect() { return client; } }, {
    actor: { id: adminId }, username: "usuario001", displayName: "Usuario", role: "elaborador"
  }), { code: "username_taken", status: 409 });
  assert.equal(rolledBack, true);
});

test("HTTP account creation requires administrator and CSRF, and returns the initial password once", async () => {
  const token = "admin-session-token";
  const csrf = "admin-csrf-token";
  let role = "elaborador";
  let savedHash;
  const client = {
    async query(sql, params) {
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (sql.startsWith("SELECT role, active FROM app_users")) {
        return { rows: [{ role: "administrador", active: true }] };
      }
      if (sql.startsWith("INSERT INTO app_users")) {
        savedHash = params[4];
        return { rows: [{
          id: newUserId,
          username: params[1],
          email: null,
          display_name: params[2],
          role: params[3],
          active: true,
          mfa_enabled: false,
          must_change_password: true
        }] };
      }
      if (sql.startsWith("INSERT INTO audit_events")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  };
  const poolFactory = () => ({
    async query(sql, params) {
      if (sql.includes("FROM app_sessions s")) {
        return { rows: params[0] === hashToken(token) ? [{
          session_id: "33333333-3333-4333-8333-333333333333",
          csrf_token_hash: hashToken(csrf),
          id: adminId,
          username: "admin001",
          email: "admin@entidad.gov.co",
          display_name: "Administrador",
          role,
          must_change_password: false
        }] : [] };
      }
      if (sql.startsWith("UPDATE app_sessions SET last_seen_at")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async connect() { return client; },
    async end() {}
  });
  const server = createAppServer({ poolFactory, secureCookies: false });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/admin/users`;
  const cookie = `__Host-asistente_session=${token}`;
  const body = JSON.stringify({ username: "usuario001", displayName: "Usuario", role: "elaborador" });
  try {
    const forbidden = await fetch(url, {
      method: "POST", headers: { cookie, "content-type": "application/json" }, body
    });
    assert.equal(forbidden.status, 403);
    role = "administrador";

    const noCsrf = await fetch(url, {
      method: "POST", headers: { cookie, "content-type": "application/json" }, body
    });
    assert.equal(noCsrf.status, 403);

    const created = await fetch(url, {
      method: "POST", headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" }, body
    });
    assert.equal(created.status, 201);
    assert.equal(created.headers.get("cache-control"), "no-store");
    const payload = await created.json();
    assert.equal(payload.user.email, null);
    assert.equal(payload.user.mustChangePassword, true);
    assert.equal(verifyPassword(payload.initialPassword, savedHash), true);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("username login works and email login is disabled by default", async () => {
  const previous = process.env.ALLOW_LEGACY_EMAIL_LOGIN;
  delete process.env.ALLOW_LEGACY_EMAIL_LOGIN;
  const password = "clave-de-prueba-larga";
  const user = {
    id: newUserId,
    username: "usuario001",
    email: "antiguo@entidad.gov.co",
    display_name: "Usuario",
    role: "elaborador",
    active: true,
    must_change_password: false,
    password_hash: hashPassword(password)
  };
  const pool = {
    async query(sql, params) {
      if (sql.includes("FROM app_users WHERE username")) {
        return { rows: params[0] === user.username || (params[0] === user.email && params[1]) ? [user] : [] };
      }
      if (sql.startsWith("INSERT INTO app_sessions")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  const details = { password, request: { headers: {}, socket: { remoteAddress: "127.0.0.1" } } };
  try {
    const result = await loginUser(pool, { ...details, username: user.username });
    assert.equal(result.user.username, user.username);
    await assert.rejects(loginUser(pool, { ...details, email: user.email }), { code: "invalid_credentials" });
    process.env.ALLOW_LEGACY_EMAIL_LOGIN = "1";
    const legacy = await loginUser(pool, { ...details, email: user.email });
    assert.equal(legacy.user.username, user.username);
  } finally {
    if (previous === undefined) delete process.env.ALLOW_LEGACY_EMAIL_LOGIN;
    else process.env.ALLOW_LEGACY_EMAIL_LOGIN = previous;
  }
});

test("administrator reset rotates a non-admin password and revokes sessions", async () => {
  let savedHash;
  let revoked = false;
  let audited = false;
  const client = {
    async query(sql, params) {
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (sql.startsWith("SELECT role, active FROM app_users")) {
        return { rows: [{ role: "administrador", active: true }] };
      }
      if (sql.startsWith("SELECT id, role, active FROM app_users")) {
        return { rows: [{ id: newUserId, role: "elaborador", active: true }] };
      }
      if (sql.startsWith("UPDATE app_users SET password_hash")) {
        savedHash = params[1];
        return { rows: [] };
      }
      if (sql.startsWith("UPDATE app_sessions SET revoked_at")) {
        revoked = true;
        return { rows: [] };
      }
      if (sql.startsWith("INSERT INTO audit_events")) {
        audited = true;
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  };
  const result = await resetAccountPassword({ async connect() { return client; } }, {
    actor: { id: adminId }, targetId: newUserId
  });
  assert.match(result.initialPassword, /^[A-Za-z0-9]{20}$/);
  assert.equal(verifyPassword(result.initialPassword, savedHash), true);
  assert.equal(revoked, true);
  assert.equal(audited, true);
});

test("HTTP password reset requires administrator and CSRF", async () => {
  const token = "admin-session-token";
  const csrf = "admin-csrf-token";
  let role = "elaborador";
  let savedHash;
  let revoked = false;
  const client = {
    async query(sql, params) {
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (sql.startsWith("SELECT role, active FROM app_users")) {
        return { rows: [{ role: "administrador", active: true }] };
      }
      if (sql.startsWith("SELECT id, role, active FROM app_users")) {
        return { rows: [{ id: newUserId, role: "elaborador", active: true }] };
      }
      if (sql.startsWith("UPDATE app_users SET password_hash")) {
        savedHash = params[1];
        return { rows: [] };
      }
      if (sql.startsWith("UPDATE app_sessions SET revoked_at")) {
        revoked = true;
        return { rows: [] };
      }
      if (sql.startsWith("INSERT INTO audit_events")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  };
  const poolFactory = () => ({
    async query(sql, params) {
      if (sql.includes("FROM app_sessions s")) {
        return { rows: params[0] === hashToken(token) ? [{
          session_id: "33333333-3333-4333-8333-333333333333",
          csrf_token_hash: hashToken(csrf),
          id: adminId,
          username: "admin001",
          email: null,
          display_name: "Administrador",
          role,
          must_change_password: false
        }] : [] };
      }
      if (sql.startsWith("UPDATE app_sessions SET last_seen_at")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async connect() { return client; },
    async end() {}
  });
  const server = createAppServer({ poolFactory, secureCookies: false });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/admin/users/${newUserId}/reset-password`;
  const cookie = `__Host-asistente_session=${token}`;
  try {
    const forbidden = await fetch(url, { method: "POST", headers: { cookie, "x-csrf-token": csrf } });
    assert.equal(forbidden.status, 403);
    role = "administrador";
    const noCsrf = await fetch(url, { method: "POST", headers: { cookie } });
    assert.equal(noCsrf.status, 403);
    const success = await fetch(url, { method: "POST", headers: { cookie, "x-csrf-token": csrf } });
    assert.equal(success.status, 200);
    assert.equal(success.headers.get("cache-control"), "no-store");
    const body = await success.json();
    assert.equal(verifyPassword(body.initialPassword, savedHash), true);
    assert.equal(revoked, true);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("administrator password cannot be reset through ordinary user management", async () => {
  let updated = false;
  const client = {
    async query(sql) {
      if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [] };
      if (sql.startsWith("SELECT role, active FROM app_users")) {
        return { rows: [{ role: "administrador", active: true }] };
      }
      if (sql.startsWith("SELECT id, role, active FROM app_users")) {
        return { rows: [{ id: newUserId, role: "administrador", active: true }] };
      }
      if (sql.startsWith("UPDATE app_users")) updated = true;
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  };
  await assert.rejects(resetAccountPassword({ async connect() { return client; } }, {
    actor: { id: adminId }, targetId: newUserId
  }), { code: "admin_reset_not_supported", status: 403 });
  assert.equal(updated, false);
});

test("users can change their password, which revokes the old session", async () => {
  const token = "test-session-token";
  const csrf = "test-csrf-token";
  const oldPassword = "clave-inicial-de-prueba";
  const newPassword = "una frase de acceso larga y nueva";
  let passwordHash = hashPassword(oldPassword);
  let mustChange = true;
  let revoked = false;
  const client = {
    async query(sql, params) {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.startsWith("SELECT password_hash, active FROM app_users")) {
        return { rows: [{ password_hash: passwordHash, active: true }] };
      }
      if (sql.startsWith("UPDATE app_users SET password_hash")) {
        passwordHash = params[1];
        mustChange = false;
        return { rows: [] };
      }
      if (sql.startsWith("UPDATE app_sessions SET revoked_at")) {
        revoked = true;
        return { rows: [] };
      }
      if (sql.startsWith("INSERT INTO audit_events")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  };
  const poolFactory = () => ({
    async query(sql, params) {
      if (sql.includes("FROM app_sessions s")) {
        return { rows: revoked || params[0] !== hashToken(token) ? [] : [{
          session_id: "33333333-3333-4333-8333-333333333333",
          csrf_token_hash: hashToken(csrf),
          id: newUserId,
          username: "usuario001",
          email: null,
          display_name: "Usuario",
          role: "elaborador",
          must_change_password: mustChange
        }] };
      }
      if (sql.startsWith("UPDATE app_sessions SET last_seen_at")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async connect() { return client; },
    async end() {}
  });
  const server = createAppServer({ poolFactory, secureCookies: false });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = `__Host-asistente_session=${token}`;
  try {
    const noCsrf = await fetch(`${baseUrl}/api/auth/password`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: oldPassword, newPassword })
    });
    assert.equal(noCsrf.status, 403);

    const wrongOld = await fetch(`${baseUrl}/api/auth/password`, {
      method: "POST",
      headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: "incorrecta", newPassword })
    });
    assert.equal(wrongOld.status, 401);
    assert.equal(revoked, false);

    const tooShort = await fetch(`${baseUrl}/api/auth/password`, {
      method: "POST",
      headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: oldPassword, newPassword: "corta" })
    });
    assert.equal(tooShort.status, 400);
    assert.equal(revoked, false);

    const changed = await fetch(`${baseUrl}/api/auth/password`, {
      method: "POST",
      headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: oldPassword, newPassword })
    });
    assert.equal(changed.status, 200);
    assert.equal(verifyPassword(newPassword, passwordHash), true);
    assert.equal(mustChange, false);
    assert.equal(revoked, true);
    const oldSession = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    assert.equal(oldSession.status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
