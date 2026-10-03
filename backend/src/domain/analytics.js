const EVENT_TYPES = Object.freeze([
  "procedure_draft_created",
  "procedure_draft_updated",
  "procedure_submitted_for_review",
  "procedure_evaluation_started"
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

function filtersFrom(input = {}) {
  const periodDays = Number(input.periodDays ?? 30);
  const processCode = String(input.processCode || "");
  const role = String(input.role || "");
  if (!ALLOWED_PERIODS.has(periodDays)) throw new AnalyticsError("invalid_analytics_period");
  if (processCode && !/^[A-Z]{2,3}$/.test(processCode)) throw new AnalyticsError("invalid_analytics_process");
  if (role && !ALLOWED_ROLES.has(role)) throw new AnalyticsError("invalid_analytics_role");
  return { periodDays, processCode: processCode || null, role: role || null };
}

export async function getAdminAnalytics(pool, input = {}) {
  const filters = filtersFrom(input);
  const params = [filters.periodDays, EVENT_TYPES, filters.processCode, filters.role];
  const where = `ae.created_at >= now() - ($1::int * interval '1 day')
       AND ae.event_type = ANY($2::text[])
       AND ($3::text IS NULL OR p.process_code = $3)
       AND ($4::text IS NULL OR u.role = $4)`;
  const joins = `FROM audit_events ae
       LEFT JOIN procedures p ON ae.entity_type = 'procedure' AND p.id = ae.entity_id
       LEFT JOIN app_users u ON u.id = ae.actor_user_id`;
  const [totalsResult, dailyResult, processResult] = await Promise.all([
    pool.query(
      `SELECT ae.event_type AS "eventType", count(*)::int AS count ${joins}
        WHERE ${where} GROUP BY ae.event_type`,
      params
    ),
    pool.query(
      `SELECT to_char(ae.created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS day,
              ae.event_type AS "eventType", count(*)::int AS count ${joins}
        WHERE ${where}
        GROUP BY day, ae.event_type ORDER BY day DESC`,
      params
    ),
    pool.query(
      `SELECT p.process_code AS "processCode", p.name AS "processName",
              ae.event_type AS "eventType", count(*)::int AS count ${joins}
        WHERE ${where} AND p.process_code IS NOT NULL
        GROUP BY p.process_code, p.name, ae.event_type
        ORDER BY p.name, ae.event_type`,
      params
    )
  ]);
  const emptyCounts = () => Object.fromEntries(EVENT_TYPES.map(type => [type, 0]));
  const totals = emptyCounts();
  for (const row of totalsResult.rows) totals[row.eventType] = Number(row.count);
  const byDayMap = new Map();
  for (const row of dailyResult.rows) {
    if (!byDayMap.has(row.day)) byDayMap.set(row.day, { day: row.day, ...emptyCounts() });
    byDayMap.get(row.day)[row.eventType] = Number(row.count);
  }
  const byProcessMap = new Map();
  for (const row of processResult.rows) {
    const key = row.processCode;
    if (!byProcessMap.has(key)) byProcessMap.set(key, {
      processCode: key, processName: row.processName, ...emptyCounts()
    });
    byProcessMap.get(key)[row.eventType] = Number(row.count);
  }
  return {
    periodDays: filters.periodDays,
    filters: { processCode: filters.processCode, role: filters.role },
    totals,
    byDay: [...byDayMap.values()],
    byProcess: [...byProcessMap.values()]
  };
}
