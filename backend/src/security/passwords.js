import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const HASH_ALGORITHM = "pbkdf2_sha256";
const ITERATIONS = 210000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

export function hashPassword(password, salt = randomBytes(16).toString("base64url")) {
  if (typeof password !== "string" || password.length < 12) {
    throw new Error("La clave inicial debe tener minimo 12 caracteres.");
  }

  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("base64url");
  return `${HASH_ALGORITHM}$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [algorithm, iterationsValue, salt, expectedHash] = String(storedHash || "").split("$");
  if (algorithm !== HASH_ALGORITHM || !iterationsValue || !salt || !expectedHash) return false;

  const derived = pbkdf2Sync(
    String(password || ""),
    salt,
    Number(iterationsValue),
    KEY_LENGTH,
    DIGEST
  ).toString("base64url");

  const expected = Buffer.from(expectedHash);
  const actual = Buffer.from(derived);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
