import test from "node:test";
import assert from "node:assert/strict";
import { bootstrapAdmin } from "../src/security/bootstrap-admin.js";
import { verifyPassword } from "../src/security/passwords.js";
import { decryptSecret, generateTotpSecret, totpCode, verifyTotp } from "../src/security/mfa.js";

const mfaEncryptionKey = "test-only-mfa-encryption-key-with-enough-length";

function fakePool(existingAdmin = false) {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT 1 FROM app_users")) {
        return { rows: existingAdmin ? [{}] : [] };
      }
      return { rows: [] };
    },
    release() {
      calls.push({ sql: "RELEASE" });
    }
  };
  return { calls, connect: async () => client };
}

test("first administrator is inserted with a hash and an audit event", async () => {
  const pool = fakePool();
  const mfaSecret = generateTotpSecret();
  const admin = await bootstrapAdmin(pool, {
    email: " Admin@Entidad.gov.co ",
    displayName: " Administrador ",
    password: "una-clave-segura-para-prueba",
    mfaEncryptionKey,
    mfaSecret,
    mfaCode: totpCode(mfaSecret)
  });
  assert.equal(admin.email, "admin@entidad.gov.co");
  const userInsert = pool.calls.find(call => call.sql.startsWith("INSERT INTO app_users"));
  assert.equal(userInsert.params[1], admin.email);
  assert.equal(verifyPassword("una-clave-segura-para-prueba", userInsert.params[3]), true);
  assert.equal(decryptSecret(userInsert.params[4], mfaEncryptionKey), mfaSecret);
  assert.equal(verifyTotp(mfaSecret, totpCode(mfaSecret)), true);
  assert.ok(pool.calls.some(call => call.sql.startsWith("INSERT INTO audit_events")));
  assert.deepEqual(pool.calls.slice(-2).map(call => call.sql), ["COMMIT", "RELEASE"]);
});

test("bootstrap refuses a second administrator and rolls back", async () => {
  const pool = fakePool(true);
  const mfaSecret = generateTotpSecret();
  await assert.rejects(
    bootstrapAdmin(pool, {
      email: "segundo@entidad.gov.co",
      displayName: "Segundo",
      password: "una-clave-segura-para-prueba",
      mfaEncryptionKey,
      mfaSecret,
      mfaCode: totpCode(mfaSecret)
    }),
    /solo se permite una vez/
  );
  assert.ok(!pool.calls.some(call => call.sql.startsWith("INSERT INTO app_users")));
  assert.deepEqual(pool.calls.slice(-2).map(call => call.sql), ["ROLLBACK", "RELEASE"]);
});

test("bootstrap does not connect to the database when MFA confirmation fails", async () => {
  const pool = fakePool();
  const mfaSecret = generateTotpSecret();
  await assert.rejects(
    bootstrapAdmin(pool, {
      email: "admin@entidad.gov.co",
      displayName: "Administrador",
      password: "una-clave-segura-para-prueba",
      mfaEncryptionKey,
      mfaSecret,
      mfaCode: "000000"
    }),
    /no es valido/
  );
  assert.equal(pool.calls.length, 0);
});
