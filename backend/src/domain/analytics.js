const PRODUCTIVITY_EVENT_TYPES = Object.freeze([
  "procedure_draft_created",
  "procedure_submitted_for_review",
  "procedure_evaluation_started",
  "procedure_returned_for_corrections",
  "procedure_favorable_concept_issued"
]);
const ALLOWED_PERIODS = new Set([7, 30, 90, 365]);
const ALLOWED_ROLES = new Set(["elaborador", "evaluador", "administrador"]);

export class AnalyticsError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function filtersFrom(input = {}, { allowInstitutionalFilters = true } = {}) {
  const periodDays = Number(input.periodDays ?? 30);
  const processCode = String(input.processCode || "");
  const role = String(input.role || "");
  if (!ALLOWED_PERIODS.has(periodDays)) throw new AnalyticsError("invalid_analytics_period");
  if (!allowInstitutionalFilters && (processCode || role)) throw new AnalyticsError("invalid_analytics_filter");
  if (processCode && !/^[A-Z]{2,3}$/.test(processCode)) throw new AnalyticsError("invalid_analytics_process");
  if (role && !ALLOWED_ROLES.has(role)) throw new AnalyticsError("invalid_analytics_role");
  return { periodDays, processCode: processCode || null, role: role || null };
}

function emptyCounts() {
  return Object.fromEntries(PRODUCTIVITY_EVENT_TYPES.map(type => [type, 0]));
}

function buildProductivity(rows, groupKey, groupDetails = () => ({})) {
  const entries = new Map();
  for (const row of rows) {
    const key = groupKey(row);
    if (!entries.has(key)) entries.set(key, { ...groupDetails(row), ...emptyCounts() });
    entries.get(key)[row.eventType] = Number(row.count);
  }
  return [...entries.values()];
}

function usageFromRows(rows) {
  const usage = { totalLogins: 0, activeUsers: 0, lastLogin: null, byDay: [] };
  const days = new Map();
  for (const row of rows) {
    if (row.day) {
      days.set(row.day, Number(row.count));
      continue;
    }
    usage.totalLogins = Number(row.totalLogins || 0);
    usage.activeUsers = Number(row.activeUsers || 0);
    usage.lastLogin = row.lastLogin || null;
  }
  usage.byDay = [...days.entries()].map(([day, count]) => ({ day, count }));
  return usage;
}

async function queryAnalytics(pool, { periodDays, processCode, role, evaluatorId = null }) {
  const productivityParams = evaluatorId
    ? [periodDays, PRODUCTIVITY_EVENT_TYPES, evaluatorId]
    : [periodDays, PRODUCTIVITY_EVENT_TYPES, processCode, role];
  const productivityWhere = evaluatorId
    ? `ae.created_at >= now() - ($1::int * interval '1 day')
       AND ae.event_type = ANY($2::text[])
       AND p.assigned_evaluator_id = $3
       AND EXISTS (SELECT 1 FROM user_processes up WHERE up.user_id = $3 AND up.process_code = p.process_code)`
    : `ae.created_at >= now() - ($1::int * interval '1 day')
       AND ae.event_type = ANY($2::text[])
       AND ($3::text IS NULL OR p.process_code = $3)
       AND ($4::text IS NULL OR u.role = $4)`;
  const productivityJoins = `FROM audit_events ae
       JOIN procedures p ON ae.entity_type = 'procedure' AND p.id = ae.entity_id
       LEFT JOIN app_users u ON u.id = ae.actor_user_id`;
  const usageParams = evaluatorId ? [periodDays, evaluatorId] : [periodDays, role];
  const usageWhere = evaluatorId
    ? `s.created_at >= now() - ($1::int * interval '1 day') AND s.user_id = $2`
    : `s.created_at >= now() - ($1::int * interval '1 day') AND ($2::text IS NULL OR u.role = $2)`;
  const usageJoins = "FROM app_sessions s JOIN app_users u ON u.id = s.user_id";
  const [totalsResult, dailyResult, processResult, usageTotalsResult, usageDailyResult] = await Promise.all([
    pool.query(`SELECT ae.event_type AS "eventType", count(*)::int AS count ${productivityJoins} WHERE ${productivityWhere} GROUP BY ae.event_type`, productivityParams),
    pool.query(`SELECT to_char(ae.created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS day, ae.event_type AS "eventType", count(*)::int AS count ${productivityJoins} WHERE ${productivityWhere} GROUP BY day, ae.event_type ORDER BY day DESC`, productivityParams),
    pool.query(`SELECT p.process_code AS "processCode", p.name AS "processName", ae.event_type AS "eventType", count(*)::int AS count ${productivityJoins} WHERE ${productivityWhere} GROUP BY p.process_code, p.name, ae.event_type ORDER BY p.name, ae.event_type`, productivityParams),
    pool.query(`SELECT count(*)::int AS "totalLogins", count(DISTINCT s.user_id)::int AS "activeUsers", max(s.created_at) AS "lastLogin" ${usageJoins} WHERE ${usageWhere}`, usageParams),
    pool.query(`SELECT to_char(s.created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS day, count(*)::int AS count ${usageJoins} WHERE ${usageWhere} GROUP BY day ORDER BY day DESC`, usageParams)
  ]);
  const totals = emptyCounts();
  for (const row of totalsResult.rows) totals[row.eventType] = Number(row.count);
  const byDay = buildProductivity(dailyResult.rows, row => row.day, row => ({ day: row.day }));
  const byProcess = buildProductivity(processResult.rows, row => row.processCode, row => ({ processCode: row.processCode, processName: row.processName }));
  const usage = usageFromRows([...usageTotalsResult.rows, ...usageDailyResult.rows]);
  return { totals, byDay, byProcess, usage };
}

export async function getAdminAnalytics(pool, input = {}) {
  const filters = filtersFrom(input);
  const analytics = await queryAnalytics(pool, filters);
  return { periodDays: filters.periodDays, filters: { processCode: filters.processCode, role: filters.role }, ...analytics };
}

export async function getEvaluatorAnalytics(pool, evaluator, input = {}) {
  if (!evaluator?.id) throw new AnalyticsError("invalid_evaluator", 403);
  const filters = filtersFrom(input, { allowInstitutionalFilters: false });
  const analytics = await queryAnalytics(pool, { ...filters, evaluatorId: evaluator.id });
  return { periodDays: filters.periodDays, filters: { processCode: null, role: null }, ...analytics };
}
