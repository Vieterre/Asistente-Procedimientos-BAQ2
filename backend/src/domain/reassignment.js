import { randomUUID } from "node:crypto";
import { ACTIONS, canPerform } from "./permissions.js";
import { DraftError } from "./drafts.js";

const uuid = /^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/;

function requireAdministrator(user) {
  if (!canPerform(user, ACTIONS.CONSULT_ALL_PROCEDURES)) throw new DraftError("forbidden", 403);
}

export async function listReassignmentCandidates(pool, user, procedureId) {
  requireAdministrator(user);
  const found = await pool.query(
    `SELECT id, process_code, status, revision,
            COALESCE(responsible_user_id, created_by_user_id) AS responsible_user_id
       FROM procedures WHERE id = $1`, [procedureId]
  );
  const procedure = found.rows[0];
  if (!procedure) throw new DraftError("draft_not_found", 404);
  if (!canPerform(user, ACTIONS.REASSIGN_PROCEDURE, { procedure })) {
    throw new DraftError("reassignment_locked", 409);
  }
  const candidates = await pool.query(
    `SELECT u.id, u.display_name AS "displayName"
       FROM app_users u JOIN user_processes up ON up.user_id = u.id
      WHERE u.role = 'elaborador' AND u.active = TRUE
        AND up.process_code = $1 AND u.id <> $2
      ORDER BY u.display_name, u.id`,
    [procedure.process_code, procedure.responsible_user_id]
  );
  return { candidates: candidates.rows, revision: procedure.revision };
}

export async function reassignProcedure(pool, user, procedureId, { responsibleUserId, reason, revision } = {}) {
  requireAdministrator(user);
  if (typeof responsibleUserId !== "string" || !uuid.test(responsibleUserId)) {
    throw new DraftError("invalid_responsible_user", 400);
  }
  const cleanReason = typeof reason === "string" ? reason.trim() : "";
  if (!cleanReason || cleanReason.length > 2000) throw new DraftError("reassignment_reason_required", 400);
  if (!Number.isSafeInteger(revision) || revision < 1) throw new DraftError("invalid_revision", 400);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT id, name, process_code, status, revision,
              COALESCE(responsible_user_id, created_by_user_id) AS responsible_user_id
         FROM procedures WHERE id = $1 FOR UPDATE`, [procedureId]
    );
    const procedure = found.rows[0];
    if (!procedure) throw new DraftError("draft_not_found", 404);
    if (!canPerform(user, ACTIONS.REASSIGN_PROCEDURE, { procedure })) throw new DraftError("reassignment_locked", 409);
    if (procedure.revision !== revision) throw new DraftError("draft_conflict", 409);
    if (procedure.responsible_user_id.toLowerCase() === responsibleUserId.toLowerCase()) {
      throw new DraftError("responsible_user_unchanged", 409);
    }
    // Lock the account before checking membership. A joined locking SELECT can
    // retain a user_processes row from its pre-wait snapshot after a concurrent
    // process removal commits; this separate statement uses a fresh snapshot.
    const eligible = await client.query(
      `SELECT u.id, u.display_name FROM app_users u
        WHERE u.id = $1 AND u.role = 'elaborador' AND u.active = TRUE
        FOR SHARE OF u`,
      [responsibleUserId]
    );
    if (!eligible.rows[0]) throw new DraftError("responsible_user_unavailable", 409);
    const target = eligible.rows[0];
    const membership = await client.query(
      "SELECT 1 FROM user_processes WHERE user_id = $1 AND process_code = $2",
      [target.id, procedure.process_code]
    );
    if (!membership.rows.length) throw new DraftError("responsible_user_unavailable", 409);
    const updated = await client.query(
      `UPDATE procedures SET responsible_user_id = $2, revision = revision + 1, updated_at = now()
        WHERE id = $1 RETURNING id, revision, updated_at`, [procedureId, target.id]
    );
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, event_type, entity_type, entity_id, reason, metadata)
       VALUES ($1, $2, 'procedure_responsibility_reassigned', 'procedure', $3, $4, $5::jsonb)`,
      [randomUUID(), user.id, procedureId, cleanReason, JSON.stringify({
        previousResponsibleUserId: procedure.responsible_user_id,
        responsibleUserId: target.id, revision: updated.rows[0].revision
      })]
    );
    for (const recipient of [procedure.responsible_user_id, target.id]) {
      const message = recipient === target.id
        ? `Ahora eres responsable de «${procedure.name}». Motivo: ${cleanReason}`
        : `«${procedure.name}» fue reasignado a ${target.display_name}. Motivo: ${cleanReason}`;
      await client.query(
        `INSERT INTO user_notifications (id, recipient_user_id, procedure_id, event_type, title, message)
         VALUES ($1, $2, $3, 'procedure_responsibility_reassigned', $4, $5)`,
        [randomUUID(), recipient, procedureId, "Cambio de elaborador responsable", message]
      );
    }
    await client.query("COMMIT");
    return { ...updated.rows[0], responsibleUserId: target.id, responsibleName: target.display_name };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
