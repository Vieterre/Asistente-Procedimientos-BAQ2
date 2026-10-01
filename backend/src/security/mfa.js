import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encryptionKey(keyMaterial) {
  if (typeof keyMaterial !== "string" || keyMaterial.length < 32) {
    throw new Error("MFA_ENCRYPTION_KEY debe tener al menos 32 caracteres.");
  }
  return createHash("sha256").update(keyMaterial).digest();
}

export function generateTotpSecret() {
  let bits = "";
  for (const byte of randomBytes(20)) bits += byte.toString(2).padStart(8, "0");
  let secret = "";
  for (let index = 0; index < bits.length; index += 5) {
    secret += BASE32_ALPHABET[Number.parseInt(bits.slice(index, index + 5), 2)];
  }
  return secret;
}

function decodeBase32(value) {
  const normalized = String(value).replace(/=+$/u, "").toUpperCase().replace(/\s+/gu, "");
  let bits = "";
  for (const char of normalized) {
    const position = BASE32_ALPHABET.indexOf(char);
    if (position < 0) throw new Error("Secreto MFA invalido.");
    bits += position.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

export function totpCode(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 30000);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secret, candidate, timestamp = Date.now()) {
  const supplied = String(candidate || "");
  if (!/^\d{6}$/u.test(supplied)) return false;
  for (const offset of [-30000, 0, 30000]) {
    const expected = Buffer.from(totpCode(secret, timestamp + offset));
    const actual = Buffer.from(supplied);
    if (timingSafeEqual(expected, actual)) return true;
  }
  return false;
}

export function encryptSecret(secret, keyMaterial = process.env.MFA_ENCRYPTION_KEY) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(keyMaterial), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(value => value.toString("base64url")).join(".");
}

export function decryptSecret(payload, keyMaterial = process.env.MFA_ENCRYPTION_KEY) {
  const [ivValue, tagValue, encryptedValue] = String(payload || "").split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Secreto MFA cifrado invalido.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(keyMaterial), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

export function makeOtpAuthUri({ secret, email, issuer }) {
  const label = `${issuer}:${email}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
