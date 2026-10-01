import test from "node:test";
import assert from "node:assert/strict";
import { createAppServer } from "../src/server.js";
import { hashPassword } from "../src/security/passwords.js";
import { hashToken, SESSION_COOKIE } from "../src/security/auth.js";

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
        if (sql.includes("FROM app_users WHERE email")) return { rows: [user] };
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
