import { randomUUID } from "node:crypto";
import { ACTIONS, canPerform } from "./permissions.js";
import { PROCEDURE_STATUS } from "./workflow.js";
import { ROLES } from "./roles.js";

export class DraftError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function validPayload(payload) {
  return payload !== null && typeof payload === "object" && !Array.isArray(payload);
}

function validateDraft({ name, payload }) {
  if (typeof name !== "string" || !name.trim() || name.trim().length > 200 || !validPayload(payload)) {
    throw new DraftError("invalid_draft", 400);
  }
  return name.trim();
}

function publicDraft(row, includePayload = false) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    processCode: row.process_code,
    version: row.version,
    status: row.status,
    revision: row.revision,
    updatedAt: row.updated_at,
    ...(includePayload ? { payload: row.current_payload } : {})
  };
}

export async function listOwnDrafts(pool, user) {
  if (!canPerform(user, ACTIONS.CREATE_PROCEDURE)) throw new DraftError("forbidden", 403);
  const result = await pool.query(
    `SELECT id, code, name, process_code, version, status, revision, updated_at
     FROM procedures p WHERE created_by_user_id = $1
       AND ($2 OR EXISTS (SELECT 1 FROM user_processes up
                          WHERE up.user_id = $1 AND up.process_code = p.process_code))
     ORDER BY updated_at DESC`,
    [user.id, user.role === ROLES.ADMIN]
  );
  return result.rows.map(row => publicDraft(row));
}

export async function getOwnDraft(pool, user, id) {
  if (!canPerform(user, ACTIONS.CREATE_PROCEDURE)) throw new DraftError("forbidden", 403);
  const result = await pool.query(
    `SELECT id, code, name, process_code, version, status, revision, updated_at, current_payload
     FROM procedures p WHERE id = $1 AND created_by_user_id = $2
       AND ($3 OR EXISTS (SELECT 1 FROM user_processes up
                          WHERE up.user_id = $2 AND up.process_code = p.process_code))`,
    [id, user.id, user.role === ROLES.ADMIN]
  );
  if (!result.rows[0]) throw new DraftError("draft_not_found", 404);
  return publicDraft(result.rows[0], true);
}

export async function createDraft(pool, user, { name, processCode, payload }) {
  if (!canPerform(user, ACTIONS.CREATE_PROCEDURE)) throw new DraftError("forbidden", 403);
  const cleanName = validateDraft({ name, payload });
  if (typeof processCode !== "string" || !/^[A-Z]{2,3}$/.test(processCode)) {
    throw new DraftError("invalid_process", 400);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const process = await client.query(
      `SELECT 1 FROM processes p WHERE p.code = $1 AND p.active = TRUE
       AND ($3 OR EXISTS (SELECT 1 FROM user_processes up
                          WHERE up.user_id = $2 AND up.process_code = p.code))`,
      [processCode, user.id, user.role === ROLES.ADMIN]
    );
    if (!process.rows.length) throw new DraftError("invalid_process", 400);
    const result = await client.query(
      `INSERT INTO procedures (id, name, process_code, status, created_by_user_id, current_payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, code, name, process_code, version, status, revision, updated_at, current_payload`,
      [randomUUID(), cleanName, processCode, PROCEDURE_STATUS.DRAFT, user.id, JSON.stringify(payload)]
    );
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, event_type, entity_type, entity_id)
       VALUES ($1, $2, 'procedure_draft_created', 'procedure', $3)`,
      [randomUUID(), user.id, result.rows[0].id]
    );
    await client.query("COMMIT");
    return publicDraft(result.rows[0], true);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOwnDraft(pool, user, id, { name, payload, revision }) {
  const cleanName = validateDraft({ name, payload });
  if (!Number.isSafeInteger(revision) || revision < 1) throw new DraftError("invalid_revision", 400);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT id, status, created_by_user_id, revision
       FROM procedures p WHERE id = $1 AND created_by_user_id = $2
         AND ($3 OR EXISTS (SELECT 1 FROM user_processes up
                            WHERE up.user_id = $2 AND up.process_code = p.process_code))
       FOR UPDATE`,
      [id, user.id, user.role === ROLES.ADMIN]
    );
    const procedure = found.rows[0];
    if (!procedure) throw new DraftError("draft_not_found", 404);
    if (!canPerform(user, ACTIONS.EDIT_PROCEDURE, { procedure: { status: procedure.status, createdByUserId: procedure.created_by_user_id } })) {
      throw new DraftError("draft_locked", 403);
    }
    if (procedure.revision !== revision) throw new DraftError("draft_conflict", 409);
    const result = await client.query(
      `UPDATE procedures SET name = $2, current_payload = $3::jsonb, revision = revision + 1, updated_at = now()
       WHERE id = $1 RETURNING id, code, name, process_code, version, status, revision, updated_at, current_payload`,
      [id, cleanName, JSON.stringify(payload)]
    );
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, event_type, entity_type, entity_id)
       VALUES ($1, $2, 'procedure_draft_updated', 'procedure', $3)`,
      [randomUUID(), user.id, id]
    );
    await client.query("COMMIT");
    return publicDraft(result.rows[0], true);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
