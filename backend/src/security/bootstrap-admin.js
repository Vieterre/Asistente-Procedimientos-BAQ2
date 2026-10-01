import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "./passwords.js";
import { decryptSecret, encryptSecret, generateTotpSecret, verifyTotp } from "./mfa.js";

function validateIdentity(email, displayName) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedName = String(displayName || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
    throw new Error("El correo del administrador no es valido.");
  }
  if (!normalizedName) throw new Error("El nombre del administrador es obligatorio.");
  return { email: normalizedEmail, displayName: normalizedName };
}

async function withAdminLock(pool, action) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(5802001, 3)");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findAdmin(client) {
  const result = await client.query(
    `SELECT id, email, display_name, password_hash, active, mfa_enabled, mfa_secret_ciphertext
     FROM app_users WHERE role = 'administrador' LIMIT 2 FOR UPDATE`
  );
  if (result.rows.length > 1) throw new Error("Ya existen administradores. El alta inicial no esta disponible.");
  return result.rows[0] || null;
}

function assertPendingAdmin(row, email, password) {
  if (row.active || row.mfa_enabled || !row.mfa_secret_ciphertext) {
    throw new Error("Ya existe un administrador. El alta inicial solo se permite una vez.");
  }
  if (row.email !== email || !verifyPassword(password, row.password_hash)) {
    throw new Error("Los datos no coinciden con el alta inicial pendiente.");
  }
}

export async function prepareBootstrapAdmin(pool, { email, displayName, password, mfaEncryptionKey }) {
  const identity = validateIdentity(email, displayName);
  const passwordHash = hashPassword(password);
  return withAdminLock(pool, async client => {
    const existing = await findAdmin(client);
    if (existing) {
      assertPendingAdmin(existing, identity.email, password);
      return {
        id: existing.id,
        email: existing.email,
        mfaSecret: decryptSecret(existing.mfa_secret_ciphertext, mfaEncryptionKey),
        resumed: true
      };
    }

    const userId = randomUUID();
    const mfaSecret = generateTotpSecret();
    const ciphertext = encryptSecret(mfaSecret, mfaEncryptionKey);
    await client.query(
      `INSERT INTO app_users (id, email, display_name, role, password_hash, active, mfa_enabled, mfa_secret_ciphertext)
       VALUES ($1, $2, $3, 'administrador', $4, FALSE, FALSE, $5)`,
      [userId, identity.email, identity.displayName, passwordHash, ciphertext]
    );
    await client.query(
      `INSERT INTO audit_events (id, event_type, entity_type, entity_id, reason)
       VALUES ($1, 'admin_bootstrap_pending', 'app_user', $2, 'Alta inicial pendiente de confirmacion MFA')`,
      [randomUUID(), userId]
    );
    return { id: userId, email: identity.email, mfaSecret, resumed: false };
  });
}

export async function confirmBootstrapAdmin(pool, { email, password, mfaEncryptionKey, mfaCode }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return withAdminLock(pool, async client => {
    const existing = await findAdmin(client);
    if (!existing) throw new Error("No existe un alta inicial pendiente.");
    assertPendingAdmin(existing, normalizedEmail, password);
    const secret = decryptSecret(existing.mfa_secret_ciphertext, mfaEncryptionKey);
    if (!verifyTotp(secret, mfaCode)) {
      throw new Error("El codigo de la aplicacion autenticadora no es valido. El administrador sigue inactivo.");
    }
    await client.query(
      `UPDATE app_users SET active = TRUE, mfa_enabled = TRUE, updated_at = now()
       WHERE id = $1 AND active = FALSE AND mfa_enabled = FALSE`,
      [existing.id]
    );
    await client.query(
      `INSERT INTO audit_events (id, event_type, entity_type, entity_id, reason)
       VALUES ($1, 'admin_bootstrap', 'app_user', $2, 'Alta inicial del administrador y MFA confirmado')`,
      [randomUUID(), existing.id]
    );
    return { id: existing.id, email: existing.email, displayName: existing.display_name };
  });
}
