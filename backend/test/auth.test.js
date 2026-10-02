import test from "node:test";
import assert from "node:assert/strict";
import { createAppServer } from "../src/server.js";
import { hashPassword } from "../src/security/passwords.js";
import { hashToken, loginUser } from "../src/security/auth.js";
import { encryptSecret, generateTotpSecret, totpCode } from "../src/security/mfa.js";

test("login, session lookup, and logout are protected", async () => {
  const passwordHash = hashPassword("una-clave-segura-para-prueba");
  const state = { tokenHash: "", csrfHash: "", revoked: false };
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "elaborador@entidad.gov.co",
    display_name: "Elaborador de prueba",
    role: "elaborador",
    password_hash: passwordHash,
    active: true,
    mfa_enabled: false,
    mfa_secret_ciphertext: null
  };

  function poolFactory() {
    return {
      async query(sql, params) {
        if (sql.includes("FROM app_users WHERE username")) return { rows: [user] };
        if (sql.startsWith("INSERT INTO app_sessions")) {
          state.tokenHash = params[2];
          state.csrfHash = params[3];
          return { rows: [] };
        }
        if (sql.includes("FROM app_sessions s")) {
          return {
            rows: state.revoked ? [] : [{
              session_id: "22222222-2222-4222-8222-222222222222",
              csrf_token_hash: state.csrfHash,
              id: user.id,
              email: user.email,
              display_name: user.display_name,
              role: user.role
            }]
          };
        }
        if (sql.startsWith("UPDATE app_sessions SET last_seen_at")) return { rows: [] };
        if (sql.startsWith("UPDATE app_sessions SET revoked_at")) {
          state.revoked = true;
          return { rows: [] };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
      async end() {}
    };
  }

  const server = createAppServer({ poolFactory, secureCookies: false });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: user.email, password: "una-clave-segura-para-prueba" })
    });
    const loginPayload = await login.json();
    const cookie = login.headers.get("set-cookie").split(";")[0];
    assert.equal(login.status, 200);
    assert.equal(loginPayload.user.email, user.email);
    assert.equal(state.tokenHash.length, 64);

    const me = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
      headers: { cookie }
    });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.role, "elaborador");

    const logoutWithoutCsrf = await fetch(`http://127.0.0.1:${port}/api/auth/logout`, {
      method: "POST",
      headers: { cookie }
    });
    assert.equal(logoutWithoutCsrf.status, 403);

    const logout = await fetch(`http://127.0.0.1:${port}/api/auth/logout`, {
      method: "POST",
      headers: { cookie, "x-csrf-token": loginPayload.csrfToken }
    });
    assert.equal(logout.status, 200);
    assert.equal(hashToken(loginPayload.csrfToken), state.csrfHash);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("administrator login requires the matching MFA code before creating a session", async () => {
  const mfaEncryptionKey = "test-only-mfa-encryption-key-with-enough-length";
  const secret = generateTotpSecret();
  const password = "una-clave-segura-para-prueba";
  const user = {
    id: "33333333-3333-4333-8333-333333333333",
    email: "admin@entidad.gov.co",
    display_name: "Administrador",
    role: "administrador",
    password_hash: hashPassword(password),
    active: true,
    mfa_enabled: true,
    mfa_secret_ciphertext: encryptSecret(secret, mfaEncryptionKey)
  };
  const calls = [];
  const pool = {
    async query(sql) {
      calls.push(sql);
      if (sql.includes("FROM app_users WHERE username")) return { rows: [user] };
      if (sql.startsWith("INSERT INTO app_sessions")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  const details = {
    email: user.email,
    password,
    request: { headers: {}, socket: { remoteAddress: "127.0.0.1" } },
    mfaEncryptionKey
  };

  await assert.rejects(loginUser(pool, { ...details, otp: "not-a-code" }), { code: "mfa_required" });
  assert.equal(calls.filter(sql => sql.startsWith("INSERT INTO app_sessions")).length, 0);

  const result = await loginUser(pool, { ...details, otp: totpCode(secret) });
  assert.equal(result.user.role, "administrador");
  assert.equal(calls.filter(sql => sql.startsWith("INSERT INTO app_sessions")).length, 1);
});

test("administrator HTTP login, session lookup, and logout require MFA", async () => {
  const previousKey = process.env.MFA_ENCRYPTION_KEY;
  const mfaEncryptionKey = "test-only-mfa-encryption-key-with-enough-length";
  process.env.MFA_ENCRYPTION_KEY = mfaEncryptionKey;
  const secret = generateTotpSecret();
  const password = "una-clave-segura-para-prueba";
  const user = {
    id: "44444444-4444-4444-8444-444444444444",
    email: "admin@entidad.gov.co",
    display_name: "Administrador",
    role: "administrador",
    password_hash: hashPassword(password),
    active: true,
    mfa_enabled: true,
    mfa_secret_ciphertext: encryptSecret(secret, mfaEncryptionKey)
  };
  const state = { tokenHash: "", csrfHash: "", revoked: false, sessionsCreated: 0 };
  const poolFactory = () => ({
    async query(sql, params) {
      if (sql.includes("FROM app_users WHERE username")) return { rows: [user] };
      if (sql.startsWith("INSERT INTO app_sessions")) {
        state.tokenHash = params[2];
        state.csrfHash = params[3];
        state.sessionsCreated += 1;
        return { rows: [] };
      }
      if (sql.includes("FROM app_sessions s")) {
        return { rows: state.revoked || params[0] !== state.tokenHash ? [] : [{
          session_id: "55555555-5555-4555-8555-555555555555",
          csrf_token_hash: state.csrfHash,
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          role: user.role
        }] };
      }
      if (sql.startsWith("UPDATE app_sessions SET last_seen_at")) return { rows: [] };
      if (sql.startsWith("UPDATE app_sessions SET revoked_at")) {
        state.revoked = true;
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async end() {}
  });
  const server = createAppServer({ poolFactory, secureCookies: false });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const validCode = totpCode(secret);
    const invalidCode = validCode === "000000" ? "111111" : "000000";
    const rejected = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: user.email, password, otp: invalidCode })
    });
    assert.equal(rejected.status, 401);
    assert.equal(state.sessionsCreated, 0);

    const accepted = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: user.email, password, otp: validCode })
    });
    assert.equal(accepted.status, 200);
    const loginBody = await accepted.json();
    const cookie = accepted.headers.get("set-cookie").split(";")[0];
    assert.equal(state.sessionsCreated, 1);
    assert.equal(loginBody.user.role, "administrador");

    const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.email, user.email);

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { cookie, "x-csrf-token": loginBody.csrfToken }
    });
    assert.equal(logout.status, 200);

    const afterLogout = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    assert.equal(afterLogout.status, 401);
  } finally {
    if (previousKey === undefined) delete process.env.MFA_ENCRYPTION_KEY;
    else process.env.MFA_ENCRYPTION_KEY = previousKey;
    await new Promise(resolve => server.close(resolve));
  }
});
