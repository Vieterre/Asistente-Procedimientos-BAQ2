import test from "node:test";
import assert from "node:assert/strict";
import { confirmBootstrapAdmin, prepareBootstrapAdmin } from "../src/security/bootstrap-admin.js";
import { verifyPassword } from "../src/security/passwords.js";
import { decryptSecret, totpCode } from "../src/security/mfa.js";

const mfaEncryptionKey = "test-only-mfa-encryption-key-with-enough-length";
const credentials = {
  email: " Admin@Entidad.gov.co ",
  displayName: " Administrador ",
  password: "una-clave-segura-para-prueba",
  mfaEncryptionKey
};

function fakePool() {
  const calls = [];
  let row = null;
  let snapshot = null;
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql === "BEGIN") snapshot = row ? { ...row } : null;
      if (sql === "ROLLBACK") row = snapshot;
      if (sql.includes("FROM app_users WHERE role")) return { rows: row ? [{ ...row }] : [] };
      if (sql.startsWith("INSERT INTO app_users")) {
        row = {
          id: params[0],
          email: params[1],
          display_name: params[2],
          password_hash: params[3],
          active: false,
          mfa_enabled: false,
          mfa_secret_ciphertext: params[4]
        };
      }
      if (sql.startsWith("UPDATE app_users SET active")) {
        row.active = true;
        row.mfa_enabled = true;
      }
      return { rows: [] };
    },
    release() {
      calls.push({ sql: "RELEASE" });
    }
  };
  return { calls, get user() { return row; }, connect: async () => client };
}

test("bootstrap stays inactive until MFA is confirmed and records both steps", async () => {
  const pool = fakePool();
  const pending = await prepareBootstrapAdmin(pool, credentials);
  assert.equal(pending.email, "admin@entidad.gov.co");
  assert.equal(pending.resumed, false);
  assert.equal(pool.user.active, false);
  assert.equal(pool.user.mfa_enabled, false);
  assert.equal(verifyPassword(credentials.password, pool.user.password_hash), true);
  assert.equal(decryptSecret(pool.user.mfa_secret_ciphertext, mfaEncryptionKey), pending.mfaSecret);

  const admin = await confirmBootstrapAdmin(pool, {
    ...credentials,
    mfaCode: totpCode(pending.mfaSecret)
  });
  assert.equal(admin.id, pending.id);
  assert.equal(pool.user.active, true);
  assert.equal(pool.user.mfa_enabled, true);
  assert.equal(pool.calls.filter(call => call.sql.startsWith("INSERT INTO audit_events")).length, 2);
});

test("interrupted bootstrap resumes with the same MFA secret and no second user", async () => {
  const pool = fakePool();
  const first = await prepareBootstrapAdmin(pool, credentials);
  const resumed = await prepareBootstrapAdmin(pool, credentials);
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.id, first.id);
  assert.equal(resumed.mfaSecret, first.mfaSecret);
  assert.equal(pool.calls.filter(call => call.sql.startsWith("INSERT INTO app_users")).length, 1);
});

test("wrong MFA code leaves the pending administrator inactive", async () => {
  const pool = fakePool();
  await prepareBootstrapAdmin(pool, credentials);
  await assert.rejects(
    confirmBootstrapAdmin(pool, { ...credentials, mfaCode: "not-a-code" }),
    /sigue inactivo/
  );
  assert.equal(pool.user.active, false);
  assert.equal(pool.calls.slice(-2).map(call => call.sql).join(","), "ROLLBACK,RELEASE");
});

test("pending bootstrap rejects different credentials", async () => {
  const pool = fakePool();
  await prepareBootstrapAdmin(pool, credentials);
  await assert.rejects(
    prepareBootstrapAdmin(pool, { ...credentials, password: "una-clave-distinta-para-prueba" }),
    /no coinciden/
  );
  await assert.rejects(
    prepareBootstrapAdmin(pool, { ...credentials, email: "otro@entidad.gov.co" }),
    /no coinciden/
  );
  assert.equal(pool.user.active, false);
});

test("bootstrap cannot run again after an active administrator exists", async () => {
  const pool = fakePool();
  const pending = await prepareBootstrapAdmin(pool, credentials);
  await confirmBootstrapAdmin(pool, { ...credentials, mfaCode: totpCode(pending.mfaSecret) });
  await assert.rejects(prepareBootstrapAdmin(pool, credentials), /solo se permite una vez/);
  assert.equal(pool.calls.filter(call => call.sql.startsWith("INSERT INTO app_users")).length, 1);
});
