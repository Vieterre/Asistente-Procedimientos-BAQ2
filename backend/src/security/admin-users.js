import { randomInt, randomUUID } from "node:crypto";
import { ACTIONS, canPerform } from "../domain/permissions.js";
import { ROLES } from "../domain/roles.js";
import { hashPassword } from "./passwords.js";

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function initialPassword() {
  return Array.from({ length: 20 }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join("");
}

export class UserManagementError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function publicAccount(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    active: row.active,
    mfaEnabled: row.mfa_enabled,
    mustChangePassword: row.must_change_password
  };
}

export async function listAccounts(pool) {
  const result = await pool.query(
    `SELECT id, username, email, display_name, role, active, mfa_enabled, must_change_password
     FROM app_users ORDER BY created_at, id`
  );
  return result.rows.map(publicAccount);
}

export async function createAccount(pool, { actor, username, displayName, role }) {
  const normalizedUsername = String(username || "").trim().toLowerCase();
  const normalizedName = String(displayName || "").trim();
  if (!/^[a-z][a-z0-9]{3,31}$/.test(normalizedUsername) || !normalizedName || normalizedName.length > 120 ||
      ![ROLES.ELABORADOR, ROLES.EVALUADOR].includes(role)) {
    throw new UserManagementError("invalid_user_details", 400);
  }

  const password = initialPassword();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const actorResult = await client.query(
      "SELECT role, active FROM app_users WHERE id = $1 FOR UPDATE",
      [actor.id]
    );
    if (actorResult.rows[0]?.role !== ROLES.ADMIN || actorResult.rows[0]?.active !== true) {
      throw new UserManagementError("forbidden", 403);
    }
    const result = await client.query(
      `INSERT INTO app_users (id, username, email, display_name, role, password_hash, active, must_change_password)
       VALUES ($1, $2, NULL, $3, $4, $5, TRUE, TRUE)
       RETURNING id, username, email, display_name, role, active, mfa_enabled, must_change_password`,
      [randomUUID(), normalizedUsername, normalizedName, role, hashPassword(password)]
    );
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, event_type, entity_type, entity_id)
       VALUES ($1, $2, 'user_created', 'app_user', $3)`,
      [randomUUID(), actor.id, result.rows[0].id]
    );
    await client.query("COMMIT");
    return { user: publicAccount(result.rows[0]), initialPassword: password };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") throw new UserManagementError("username_taken", 409);
    throw error;
  } finally {
    client.release();
  }
}

export async function resetAccountPassword(pool, { actor, targetId }) {
  const password = initialPassword();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const actorResult = await client.query(
      "SELECT role, active FROM app_users WHERE id = $1 FOR UPDATE",
      [actor.id]
    );
    if (actorResult.rows[0]?.role !== ROLES.ADMIN || actorResult.rows[0]?.active !== true) {
      throw new UserManagementError("forbidden", 403);
    }
    const targetResult = await client.query(
      "SELECT id, role, active FROM app_users WHERE id = $1 FOR UPDATE",
      [targetId]
    );
    const target = targetResult.rows[0];
    if (!target) throw new UserManagementError("user_not_found", 404);
    if (target.role === ROLES.ADMIN) throw new UserManagementError("admin_reset_not_supported", 403);
    if (!target.active) throw new UserManagementError("inactive_user", 409);

    await client.query(
      "UPDATE app_users SET password_hash = $2, must_change_password = TRUE, updated_at = now() WHERE id = $1",
      [targetId, hashPassword(password)]
    );
    await client.query(
      "UPDATE app_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
      [targetId]
    );
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, event_type, entity_type, entity_id)
       VALUES ($1, $2, 'password_reset_by_admin', 'app_user', $3)`,
      [randomUUID(), actor.id, targetId]
    );
    await client.query("COMMIT");
    return { initialPassword: password };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setAccountActive(pool, { actor, targetId, active }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(5802001, 1)");
    const actorResult = await client.query(
      "SELECT role, active FROM app_users WHERE id = $1 FOR UPDATE",
      [actor.id]
    );
    if (actorResult.rows[0]?.role !== ROLES.ADMIN || actorResult.rows[0]?.active !== true) {
      throw new UserManagementError("forbidden", 403);
    }
    const result = await client.query(
      `SELECT id, username, email, display_name, role, active, mfa_enabled, mfa_secret_ciphertext,
              must_change_password
       FROM app_users WHERE id = $1 FOR UPDATE`,
      [targetId]
    );
    const target = result.rows[0];
    if (!target) throw new UserManagementError("user_not_found", 404);
    if (target.active === active) {
      await client.query("COMMIT");
      return publicAccount(target);
    }

    if (active && target.role === ROLES.ADMIN && (!target.mfa_enabled || !target.mfa_secret_ciphertext)) {
      throw new UserManagementError("admin_mfa_required", 409);
    }
    if (!active) {
      const count = target.role === ROLES.ADMIN
        ? Number((await client.query(
          "SELECT count(*) AS count FROM app_users WHERE role = 'administrador' AND active = TRUE"
        )).rows[0].count)
        : 0;
      if (!canPerform(actor, ACTIONS.DEACTIVATE_USER, { targetUser: target, activeAdminCount: count })) {
        throw new UserManagementError("last_active_admin", 409);
      }
    }

    const updated = await client.query(
      `UPDATE app_users
       SET active = $2, deactivated_at = CASE WHEN $2 THEN NULL ELSE now() END,
           deactivated_by = CASE WHEN $2 THEN NULL ELSE $3::uuid END, updated_at = now()
       WHERE id = $1
       RETURNING id, username, email, display_name, role, active, mfa_enabled, must_change_password`,
      [targetId, active, actor.id]
    );
    if (!active) {
      await client.query(
        "UPDATE app_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
        [targetId]
      );
    }
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, event_type, entity_type, entity_id)
       VALUES ($1, $2, $3, 'app_user', $4)`,
      [randomUUID(), actor.id, active ? "user_reactivated" : "user_deactivated", targetId]
    );
    await client.query("COMMIT");
    return publicAccount(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "P0001") throw new UserManagementError("last_active_admin", 409);
    throw error;
  } finally {
    client.release();
  }
}
