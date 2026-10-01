import { createHash, randomBytes, randomUUID } from "node:crypto";
import { verifyPassword } from "./passwords.js";
import { decryptSecret, verifyTotp } from "./mfa.js";

export const SESSION_COOKIE = "__Host-asistente_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export class AuthError extends Error {
  constructor(code = "invalid_credentials", status = 401) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function parseCookies(header = "") {
  return Object.fromEntries(
    header.split(";").map(part => part.trim().split("=")).filter(([name, value]) => name && value)
  );
}

export function cookieOptions({ secure = process.env.NODE_ENV === "production", maxAge = SESSION_TTL_MS / 1000 } = {}) {
  return `Path=/; Max-Age=${Math.floor(maxAge)}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role
  };
}

async function createSession(pool, row, request) {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO app_sessions (id, user_id, token_hash, csrf_token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, '')::inet)`,
    [
      randomUUID(),
      row.id,
      hashToken(token),
      hashToken(csrfToken),
      new Date(Date.now() + SESSION_TTL_MS),
      String(request.headers["user-agent"] || "").slice(0, 500),
      request.socket.remoteAddress || ""
    ]
  );
  return { token, csrfToken };
}

export async function loginUser(pool, { email, password, otp, request }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const result = await pool.query(
    `SELECT id, email, display_name, role, password_hash, active, mfa_enabled, mfa_secret_ciphertext
     FROM app_users WHERE email = $1 LIMIT 1`,
    [normalizedEmail]
  );
  const row = result.rows[0];
  if (!row || row.active !== true || !verifyPassword(password, row.password_hash)) {
    throw new AuthError();
  }
  if (row.role === "administrador") {
    if (!row.mfa_enabled || !row.mfa_secret_ciphertext) throw new AuthError("mfa_not_configured", 503);
    let secret;
    try {
      secret = decryptSecret(row.mfa_secret_ciphertext);
    } catch {
      throw new AuthError("mfa_not_configured", 503);
    }
    if (!verifyTotp(secret, otp)) throw new AuthError("mfa_required", 401);
  }
  const session = await createSession(pool, row, request);
  return { user: publicUser(row), ...session };
}

export async function getSession(pool, token) {
  if (!token) return null;
  const result = await pool.query(
    `SELECT s.id AS session_id, s.csrf_token_hash, u.id, u.email, u.display_name, u.role
     FROM app_sessions s
     JOIN app_users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
       AND u.active = TRUE
     LIMIT 1`,
    [hashToken(token)]
  );
  const row = result.rows[0];
  if (!row) return null;
  await pool.query("UPDATE app_sessions SET last_seen_at = now() WHERE id = $1", [row.session_id]);
  return {
    sessionId: row.session_id,
    csrfTokenHash: row.csrf_token_hash,
    user: publicUser(row)
  };
}

export async function revokeSession(pool, token) {
  if (!token) return;
  await pool.query(
    "UPDATE app_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
    [hashToken(token)]
  );
}
