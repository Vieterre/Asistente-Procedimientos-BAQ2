import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "./passwords.js";
import { decryptSecret, encryptSecret, generateTotpSecret, makeOtpAuthUri, verifyTotp } from "./mfa.js";
import { readServiceCredential } from "./service-credentials.js";

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
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    mfaEnabled: row.mfa_enabled,
    mustChangePassword: row.must_change_password
  };
}

async function createSession(pool, row, request, ipAddress) {
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
      ipAddress ?? request.socket.remoteAddress ?? ""
    ]
  );
  return { token, csrfToken };
}

export async function loginUser(pool, { username, email, password, otp, request, clientAddress, mfaEncryptionKey = process.env.MFA_ENCRYPTION_KEY || readServiceCredential("mfa_key") }) {
  const identifier = String(username ?? email ?? "").trim().toLowerCase();
  const allowLegacyEmail = process.env.ALLOW_LEGACY_EMAIL_LOGIN === "1";
  const result = await pool.query(
    `SELECT id, username, email, display_name, role, password_hash, active,
            must_change_password, mfa_enabled, mfa_secret_ciphertext
     FROM app_users WHERE username = $1 OR (email = $1 AND $2) LIMIT 1`,
    [identifier, allowLegacyEmail]
  );
  const row = result.rows[0];
  if (!row || row.active !== true || !verifyPassword(password, row.password_hash)) {
    throw new AuthError();
  }
  if (row.role === "administrador") {
    if (!row.mfa_enabled || !row.mfa_secret_ciphertext) {
      if (!row.must_change_password) throw new AuthError("mfa_not_configured", 503);
    } else {
      let secret;
      try {
        secret = decryptSecret(row.mfa_secret_ciphertext, mfaEncryptionKey);
      } catch {
        throw new AuthError("mfa_not_configured", 503);
      }
      if (!verifyTotp(secret, otp)) throw new AuthError("mfa_required", 401);
    }
  }
  const session = await createSession(pool, row, request, clientAddress);
  return { user: publicUser(row), ...session };
}

export async function getSession(pool, token) {
  if (!token) return null;
  const result = await pool.query(
    `SELECT s.id AS session_id, s.csrf_token_hash, u.id, u.username, u.email,
            u.display_name, u.role, u.mfa_enabled, u.must_change_password
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

export async function beginAdministratorMfaEnrollment(pool, { userId, mfaEncryptionKey = process.env.MFA_ENCRYPTION_KEY || readServiceCredential("mfa_key") }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT username, role, active, must_change_password, mfa_enabled, mfa_secret_ciphertext
         FROM app_users WHERE id = $1 FOR UPDATE`,
      [userId]
    );
    const user = result.rows[0];
    if (user?.role !== "administrador" || user.active !== true || user.must_change_password !== true || user.mfa_enabled === true) {
      throw new AuthError("mfa_setup_not_allowed", 403);
    }
    let secret;
    try {
      secret = user.mfa_secret_ciphertext
        ? decryptSecret(user.mfa_secret_ciphertext, mfaEncryptionKey)
        : generateTotpSecret();
      if (!user.mfa_secret_ciphertext) {
        await client.query(
          "UPDATE app_users SET mfa_secret_ciphertext = $2, updated_at = now() WHERE id = $1",
          [userId, encryptSecret(secret, mfaEncryptionKey)]
        );
      }
    } catch {
      throw new AuthError("mfa_not_configured", 503);
    }
    await client.query("COMMIT");
    return { secret, uri: makeOtpAuthUri({ secret, email: user.username, issuer: "Asistente de Procedimientos" }) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function confirmAdministratorMfaEnrollment(pool, { userId, code, mfaEncryptionKey = process.env.MFA_ENCRYPTION_KEY || readServiceCredential("mfa_key") }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT role, active, must_change_password, mfa_enabled, mfa_secret_ciphertext
         FROM app_users WHERE id = $1 FOR UPDATE`,
      [userId]
    );
    const user = result.rows[0];
    if (user?.role !== "administrador" || user.active !== true || user.must_change_password !== true || user.mfa_enabled === true || !user.mfa_secret_ciphertext) {
      throw new AuthError("mfa_setup_not_allowed", 403);
    }
    let secret;
    try {
      secret = decryptSecret(user.mfa_secret_ciphertext, mfaEncryptionKey);
    } catch {
      throw new AuthError("mfa_not_configured", 503);
    }
    if (!verifyTotp(secret, code)) throw new AuthError("mfa_required", 401);
    await client.query("UPDATE app_users SET mfa_enabled = TRUE, updated_at = now() WHERE id = $1", [userId]);
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, event_type, entity_type, entity_id)
       VALUES ($1, $2, 'administrator_mfa_enrolled', 'app_user', $2)`,
      [randomUUID(), userId]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeSession(pool, token) {
  if (!token) return;
  await pool.query(
    "UPDATE app_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
    [hashToken(token)]
  );
}

export async function changePassword(pool, { userId, currentPassword, newPassword }) {
  if (typeof newPassword !== "string" || newPassword.length < 15 || newPassword.length > 256) {
    throw new AuthError("password_length_invalid", 400);
  }
  if (currentPassword === newPassword) throw new AuthError("password_unchanged", 400);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "SELECT password_hash, active, role, mfa_enabled, mfa_secret_ciphertext FROM app_users WHERE id = $1 FOR UPDATE",
      [userId]
    );
    const user = result.rows[0];
    if (!user?.active || !verifyPassword(currentPassword, user.password_hash)) {
      throw new AuthError();
    }
    if (user.role === "administrador" && (!user.mfa_enabled || !user.mfa_secret_ciphertext)) {
      throw new AuthError("mfa_setup_required", 403);
    }
    await client.query(
      "UPDATE app_users SET password_hash = $2, must_change_password = FALSE, updated_at = now() WHERE id = $1",
      [userId, hashPassword(newPassword)]
    );
    await client.query(
      "UPDATE app_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
      [userId]
    );
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, event_type, entity_type, entity_id)
       VALUES ($1, $2, 'password_changed', 'app_user', $2)`,
      [randomUUID(), userId]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
