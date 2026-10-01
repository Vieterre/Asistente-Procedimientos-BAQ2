import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/security/passwords.js";

test("password hashes verify the original password", () => {
  const hash = hashPassword("ClaveInicialSegura2026");
  assert.equal(verifyPassword("ClaveInicialSegura2026", hash), true);
});

test("password hashes reject a different password", () => {
  const hash = hashPassword("ClaveInicialSegura2026");
  assert.equal(verifyPassword("OtraClaveSegura2026", hash), false);
});

test("short bootstrap passwords are rejected", () => {
  assert.throws(() => hashPassword("corta"), /minimo 12 caracteres/);
});
