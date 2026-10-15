import test from "node:test";
import assert from "node:assert/strict";
import { AnalyticsError, getAdminAnalytics, getEvaluatorAnalytics } from "../src/domain/analytics.js";

const PRODUCTIVITY_EVENTS = [
  "procedure_draft_created",
  "procedure_submitted_for_review",
  "procedure_evaluation_started",
  "procedure_returned_for_corrections",
  "procedure_favorable_concept_issued"
];

function analyticsPool(calls) {
  return { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.includes("FROM app_sessions") && sql.includes("GROUP BY day")) return { rows: [{ day: "2026-10-03", count: 3 }] };
    if (sql.includes("FROM app_sessions")) return { rows: [{ totalLogins: 3, activeUsers: 2, lastLogin: "2026-10-03T12:00:00.000Z" }] };
    if (sql.includes("GROUP BY day")) return { rows: [{ day: "2026-10-03", eventType: "procedure_draft_created", count: 2 }] };
    if (sql.includes("GROUP BY p.process_code")) return { rows: [{ processCode: "PD", processName: "Gestión del Desarrollo Económico", procedureName: "Impulsar el desarrollo económico", eventType: "procedure_draft_created", count: 2 }] };
    return { rows: [{ eventType: "procedure_draft_created", count: 2 }] };
  } };
}

test("admin analytics returns the complete productivity flow and real session use", async () => {
  const calls = [];
  const result = await getAdminAnalytics(analyticsPool(calls), { periodDays: "30", processCode: "PD", role: "elaborador" });
  assert.equal(result.periodDays, 30);
  assert.deepEqual(result.filters, { processCode: "PD", role: "elaborador" });
  assert.equal(result.totals.procedure_draft_created, 2);
  assert.equal(result.totals.procedure_returned_for_corrections, 0);
  assert.equal(result.totals.procedure_favorable_concept_issued, 0);
  assert.equal(result.byDay[0].procedure_draft_created, 2);
  assert.equal(result.byProcess[0].processName, "Gestión del Desarrollo Económico");
  assert.equal(result.byProcess[0].procedureName, "Impulsar el desarrollo económico");
  assert.deepEqual(result.usage, {
    totalLogins: 3, activeUsers: 2, lastLogin: "2026-10-03T12:00:00.000Z", byDay: [{ day: "2026-10-03", count: 3 }]
  });
  assert.equal(calls.length, 5);
  for (const call of calls.filter(call => call.sql.includes("FROM audit_events ae"))) {
    assert.deepEqual(call.params, [30, PRODUCTIVITY_EVENTS, "PD", "elaborador"]);
    assert.match(call.sql, /u\.role = \$4/);
  }
});

test("evaluator analytics only queries procedures assigned to that evaluator and their current processes", async () => {
  const calls = [];
  const evaluatorId = "11111111-1111-4111-8111-111111111111";
  const result = await getEvaluatorAnalytics(analyticsPool(calls), { id: evaluatorId }, { periodDays: "7" });
  assert.equal(result.periodDays, 7);
  assert.equal(result.filters.processCode, null);
  assert.equal(result.usage.activeUsers, 2);
  for (const call of calls.filter(call => call.sql.includes("FROM audit_events ae"))) {
    assert.deepEqual(call.params, [7, PRODUCTIVITY_EVENTS, evaluatorId]);
    assert.match(call.sql, /p\.assigned_evaluator_id = \$3/);
    assert.match(call.sql, /user_processes up/);
  }
  for (const call of calls.filter(call => call.sql.includes("FROM app_sessions"))) {
    assert.deepEqual(call.params, [7, evaluatorId]);
    assert.match(call.sql, /s\.user_id = \$2/);
  }
});

test("analytics rejects unsupported filters before querying data", async () => {
  let queried = false;
  const pool = { async query() { queried = true; return { rows: [] }; } };
  await assert.rejects(getAdminAnalytics(pool, { periodDays: "10" }), { code: "invalid_analytics_period" });
  await assert.rejects(getAdminAnalytics(pool, { periodDays: "365" }), { code: "invalid_analytics_period" });
  await assert.rejects(getAdminAnalytics(pool, { processCode: "PD; DROP TABLE" }), { code: "invalid_analytics_process" });
  await assert.rejects(getAdminAnalytics(pool, { role: "root" }), { code: "invalid_analytics_role" });
  await assert.rejects(getEvaluatorAnalytics(pool, { id: "a" }, { processCode: "PD" }), { code: "invalid_analytics_filter" });
  assert.equal(queried, false);
  assert.ok(new AnalyticsError("invalid_filter") instanceof Error);
});

test("analytics accepts the operational periods in days", async () => {
  for (const periodDays of [1, 7, 15, 30, 60, 90]) {
    const result = await getAdminAnalytics(analyticsPool([]), { periodDays: String(periodDays) });
    assert.equal(result.periodDays, periodDays);
  }
});
