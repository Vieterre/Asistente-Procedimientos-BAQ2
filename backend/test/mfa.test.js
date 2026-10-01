import test from "node:test";
import assert from "node:assert/strict";
import { decryptSecret, encryptSecret, generateTotpSecret, totpCode, verifyTotp } from "../src/security/mfa.js";

test("TOTP accepts the current code and rejects a wrong code", () => {
  const secret = generateTotpSecret();
  const timestamp = 1_760_000_000_000;
  const code = totpCode(secret, timestamp);
  assert.equal(code.length, 6);
  assert.equal(verifyTotp(secret, code, timestamp), true);
  assert.equal(verifyTotp(secret, "000000", timestamp), code === "000000");
});

test("MFA secret encryption can be reversed only with the configured key", () => {
  const key = "test-only-mfa-encryption-key-with-enough-length";
  const payload = encryptSecret("SECRET123", key);
  assert.equal(decryptSecret(payload, key), "SECRET123");
  assert.throws(() => decryptSecret(payload, "wrong-key-with-enough-length-xxxxxxxx"));
});
