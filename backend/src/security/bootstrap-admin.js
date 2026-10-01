import { randomUUID } from "node:crypto";
import { hashPassword } from "./passwords.js";
import { encryptSecret, verifyTotp } from "./mfa.js";

export async function bootstrapAdmin(pool, { email, displayName, password, mfaEncryptionKey, mfaSecret, mfaCode }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedName = String(displayName || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
    throw new Error("El correo del administrador no es valido.");
  }
  if (!normalizedName) {
    throw new Error("El nombre del administrador es obligatorio.");
  }
  if (!mfaSecret || !verifyTotp(mfaSecret, mfaCode)) {
    throw new Error("El codigo de la aplicacion autenticadora no es valido. No se creo el administrador.");
  }
  const mfaSecretCiphertext = encryptSecret(mfaSecret, mfaEncryptionKey);
  const passwordHash = hashPassword(password);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(5802001, 3)");
    const existing = await client.query(
      "SELECT 1 FROM app_users WHERE role = $1 LIMIT 1",
      ["administrador"]
    );
    if (existing.rows.length) {
      throw new Error("Ya existe un administrador. El alta inicial solo se permite una vez.");
    }

    const userId = randomUUID();
    await client.query(
      `INSERT INTO app_users (id, email, display_name, role, password_hash, active, mfa_enabled, mfa_secret_ciphertext)
       VALUES ($1, $2, $3, 'administrador', $4, TRUE, TRUE, $5)`,
      [userId, normalizedEmail, normalizedName, passwordHash, mfaSecretCiphertext]
    );
    await client.query(
      `INSERT INTO audit_events (id, event_type, entity_type, entity_id, reason)
       VALUES ($1, 'admin_bootstrap', 'app_user', $2, 'Alta inicial del administrador')`,
      [randomUUID(), userId]
    );
    await client.query("COMMIT");
    return {
      id: userId,
      email: normalizedEmail,
      displayName: normalizedName
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
