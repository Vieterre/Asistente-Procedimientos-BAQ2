import { randomUUID } from "node:crypto";
import { ACTIONS, canPerform } from "../domain/permissions.js";
import { ROLES } from "../domain/roles.js";

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
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    active: row.active,
    mfaEnabled: row.mfa_enabled
  };
}

export async function listAccounts(pool) {
  const result = await pool.query(
    `SELECT id, email, display_name, role, active, mfa_enabled
     FROM app_users ORDER BY created_at, id`
  );
  return result.rows.map(publicAccount);
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
      `SELECT id, email, display_name, role, active, mfa_enabled, mfa_secret_ciphertext
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
       RETURNING id, email, display_name, role, active, mfa_enabled`,
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
