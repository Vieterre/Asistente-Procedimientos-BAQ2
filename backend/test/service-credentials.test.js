import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPool } from "../src/db/pool.js";
import { loginUser } from "../src/security/auth.js";
import { encryptSecret, generateTotpSecret, totpCode } from "../src/security/mfa.js";
import { hashPassword } from "../src/security/passwords.js";

test("service credentials supply the database password and MFA key", async () => {
  const directory = mkdtempSync(join(tmpdir(), "asistente-credentials-"));
  const previous = Object.fromEntries(
    ["CREDENTIALS_DIRECTORY", "PGPASSWORD", "MFA_ENCRYPTION_KEY"].map(key => [key, process.env[key]])
  );
  const pgPassword = "test-only-password with a trailing space ";
  const mfaKey = "test-only-mfa-encryption-key-with-enough-length";
  const loginPassword = "test-only-admin-password";
  const secret = generateTotpSecret();
  let pool;
  try {
    writeFileSync(join(directory, "pg_password"), pgPassword);
    writeFileSync(join(directory, "mfa_key"), mfaKey);
    process.env.CREDENTIALS_DIRECTORY = directory;
    delete process.env.PGPASSWORD;
    delete process.env.MFA_ENCRYPTION_KEY;

    pool = createPool({ connectionString: "", database: "asistente_test", user: "asistente_user" });
    assert.equal(pool.options.password, pgPassword);

    let sessionCreated = false;
    const admin = {
      id: "11111111-1111-4111-8111-111111111111",
      username: "admin001",
      email: null,
      display_name: "Administrador",
      role: "administrador",
      active: true,
      must_change_password: false,
      password_hash: hashPassword(loginPassword),
      mfa_enabled: true,
      mfa_secret_ciphertext: encryptSecret(secret, mfaKey)
    };
    const fakePool = {
      async query(sql) {
        if (sql.includes("FROM app_users WHERE username")) return { rows: [admin] };
        if (sql.startsWith("INSERT INTO app_sessions")) {
          sessionCreated = true;
          return { rows: [] };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }
    };
    const login = await loginUser(fakePool, {
      username: admin.username,
      password: loginPassword,
      otp: totpCode(secret),
      request: { headers: {}, socket: { remoteAddress: "127.0.0.1" } }
    });
    assert.equal(login.user.username, admin.username);
    assert.equal(sessionCreated, true);
  } finally {
    await pool?.end();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    unlinkSync(join(directory, "pg_password"));
    unlinkSync(join(directory, "mfa_key"));
    rmdirSync(directory);
  }
});

test("private service listens on loopback and receives secrets as credentials", () => {
  const unit = readFileSync(new URL("../../deploy/asistente-procedimientos-test.service", import.meta.url), "utf8");
  assert.match(unit, /^DynamicUser=yes$/m);
  assert.match(unit, /^Environment=HOST=127\.0\.0\.1$/m);
  assert.match(unit, /^LoadCredential=pg_password:/m);
  assert.match(unit, /^LoadCredential=mfa_key:/m);
  assert.doesNotMatch(unit, /^Environment=.*(?:PASSWORD|ENCRYPTION_KEY)/m);
});
