import { ACTIONS, canPerform } from "./permissions.js";
import { PROCEDURE_STATUS } from "./workflow.js";
import { DraftError } from "./drafts.js";

const columns = `p.id, p.code, p.name, p.process_code, p.status, p.version, p.revision,
  p.updated_at, pr.name AS process_name, author.display_name AS author_name,
  evaluator.display_name AS evaluator_name`;
const joins = `FROM procedures p JOIN processes pr ON pr.code = p.process_code
  JOIN app_users author ON author.id = p.created_by_user_id
  LEFT JOIN app_users evaluator ON evaluator.id = p.assigned_evaluator_id`;
function requireAdministrator(user) {
  if (!canPerform(user, ACTIONS.CONSULT_ALL_PROCEDURES)) throw new DraftError("forbidden", 403);
}
function present(row, detail = false) {
  return { id: row.id, code: row.code, name: row.name, processCode: row.process_code,
    processName: row.process_name, status: row.status, version: row.version, revision: row.revision,
    updatedAt: row.updated_at, authorName: row.author_name, evaluatorName: row.evaluator_name || null,
    ...(detail ? { payload: row.current_payload } : {}) };
}
export async function listAdminConsultation(pool, user, { processCode = "", status = "" } = {}) {
  requireAdministrator(user);
  if ((processCode && !/^[A-Z]{2,3}$/.test(processCode)) ||
      (status && !Object.values(PROCEDURE_STATUS).includes(status))) {
    throw new DraftError("invalid_consultation_filter", 400);
  }
  const procedures = await pool.query(`SELECT ${columns} ${joins}
    WHERE ($1::text IS NULL OR p.process_code = $1) AND ($2::text IS NULL OR p.status = $2)
    ORDER BY p.updated_at DESC, p.name, p.id`, [processCode || null, status || null]);
  // Include inactive processes too: historic procedures remain available for consultation.
  const processes = await pool.query("SELECT code, name FROM processes ORDER BY name, code");
  return { procedures: procedures.rows.map(row => present(row)), processes: processes.rows };
}
export async function getAdminConsultation(pool, user, id) {
  requireAdministrator(user);
  const result = await pool.query(`SELECT ${columns}, p.current_payload ${joins} WHERE p.id = $1`, [id]);
  if (!result.rows[0]) throw new DraftError("draft_not_found", 404);
  return present(result.rows[0], true);
}
