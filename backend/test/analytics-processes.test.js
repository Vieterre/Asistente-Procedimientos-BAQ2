import test from "node:test";
import assert from "node:assert/strict";
import { createAppServer } from "../src/server.js";
import { hashToken } from "../src/security/auth.js";

test("analytics process catalog is available only to administration", async () => {
  const token = "analytics-process-catalog";
  let role = "elaborador";
  const poolFactory = () => ({
    async query(sql, params) {
      if (sql.includes("FROM app_sessions s")) return { rows: params[0] === hashToken(token) ? [{
        session_id: "33333333-3333-4333-8333-333333333333", csrf_token_hash: hashToken("csrf"),
        id: "11111111-1111-4111-8111-111111111111", username: "user", email: null,
        display_name: "User", role, must_change_password: false
      }] : [] };
      if (sql.startsWith("UPDATE app_sessions SET last_seen_at")) return { rows: [] };
      if (sql.includes("FROM processes p WHERE p.active = TRUE")) return { rows: [{ code: "GD", name: "Gestión Documental" }] };
      throw new Error("Unexpected SQL: " + sql);
    },
    async end() {}
  });
  const server = createAppServer({ poolFactory, secureCookies: false });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/admin/analytics/processes`;
  const headers = { cookie: `__Host-asistente_session=${token}` };
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers })).status, 403);
    role = "administrador";
    const response = await fetch(url, { headers });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).processes, [{ code: "GD", name: "Gestión Documental" }]);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
