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
    mustChangePassword: row.must_change_password,
    processCodes: row.process_codes || []
  };
}

export async function listAccounts(pool) {
  const result = await pool.query(
    `SELECT u.id, u.username, u.email, u.display_name, u.role, u.active, u.mfa_enabled,
            u.must_change_password,
            COALESCE((SELECT array_agg(up.process_code ORDER BY up.process_code)
                      FROM user_processes up WHERE up.user_id = u.id), ARRAY[]::text[]) AS process_codes
       FROM app_users u ORDER BY u.created_at, u.id`
  );
  return result.rows.map(publicAccount);
}

function validateProcessCodes(processCodes) {
  if (!Array.isArray(processCodes) || processCodes.length > 100 ||
      processCodes.some(code => typeof code !== "string" || !/^[A-Z]{2,3}$/.test(code)) ||
      new Set(processCodes).size !== processCodes.length) {
    throw new UserManagementError("invalid_process_assignment", 400);
  }
  return [...processCodes].sort();
}

function validateProcessTarget(row) {
  if (!row) throw new UserManagementError("user_not_found", 404);
  if (![ROLES.ELABORADOR, ROLES.EVALUADOR].includes(row.role)) {
    throw new UserManagementError("invalid_process_assignment_target", 409);
  }
}

export async function getAccountProcessAssignments(pool, { targetId }) {
  const targetResult = await pool.query(
    "SELECT id, role FROM app_users WHERE id = $1",
    [targetId]
  );
  const target = targetResult.rows[0];
  validateProcessTarget(target);

  const result = await pool.query(
    `SELECT p.code, p.name, p.active,
            EXISTS (SELECT 1 FROM user_processes up
                    WHERE up.user_id = $1 AND up.process_code = p.code) AS assigned
       FROM processes p
      WHERE p.active = TRUE OR EXISTS (
        SELECT 1 FROM user_processes up WHERE up.user_id = $1 AND up.process_code = p.code
      )
      ORDER BY p.name, p.code`,
    [targetId]
  );
  return {
    processes: result.rows,
    processCodes: result.rows.filter(process => process.assigned).map(process => process.code)
  };
}

export async function setAccountProcessAssignments(pool, { actor, targetId, processCodes }) {
  const requestedCodes = validateProcessCodes(processCodes);
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
      "SELECT id, role FROM app_users WHERE id = $1 FOR UPDATE",
      [targetId]
    );
    const target = targetResult.rows[0];
    validateProcessTarget(target);

    const currentResult = await client.query(
      "SELECT process_code FROM user_processes WHERE user_id = $1 ORDER BY process_code",
      [targetId]
    );
    const currentCodes = currentResult.rows.map(row => row.process_code).sort();
    const processResult = await client.query(
      "SELECT code, active FROM processes WHERE code = ANY($1::text[])",
      [requestedCodes]
    );
    const available = new Map(processResult.rows.map(process => [process.code, process.active]));
    const currentSet = new Set(currentCodes);
    if (requestedCodes.some(code => !available.has(code) || (!available.get(code) && !currentSet.has(code)))) {
      throw new UserManagementError("invalid_process_assignment", 400);
    }

    if (JSON.stringify(currentCodes) !== JSON.stringify(requestedCodes)) {
      await client.query("DELETE FROM user_processes WHERE user_id = $1", [targetId]);
      if (requestedCodes.length) {
        await client.query(
          `INSERT INTO user_processes (user_id, process_code)
           SELECT $1, selected.process_code FROM unnest($2::text[]) AS selected(process_code)`,
          [targetId, requestedCodes]
        );
      }
      await client.query(
        `INSERT INTO audit_events (id, actor_user_id, event_type, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'user_processes_updated', 'app_user', $3, $4::jsonb)`,
        [randomUUID(), actor.id, targetId, JSON.stringify({ processCodes: requestedCodes })]
      );
    }

    await client.query("COMMIT");
    return { processCodes: requestedCodes };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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

