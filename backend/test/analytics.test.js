import test from "node:test";
import assert from "node:assert/strict";
import { AnalyticsError, getAdminAnalytics } from "../src/domain/analytics.js";

test("admin analytics returns only backend workflow events with zero-filled event categories", async () => {
  const calls = [];
  const pool = { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.includes("GROUP BY day")) return { rows: [
      { day: "2026-10-03", eventType: "procedure_draft_created", count: 2 }
    ] };
    if (sql.includes("GROUP BY p.process_code")) return { rows: [
      { processCode: "PD", processName: "Gestión del Desarrollo Económico", eventType: "procedure_draft_created", count: 2 }
    ] };
    return { rows: [{ eventType: "procedure_draft_created", count: 2 }] };
  } };

  const result = await getAdminAnalytics(pool, { periodDays: "30", processCode: "PD", role: "elaborador" });
  assert.equal(result.periodDays, 30);
  assert.deepEqual(result.filters, { processCode: "PD", role: "elaborador" });
  assert.equal(result.totals.procedure_draft_created, 2);
  assert.equal(result.totals.procedure_submitted_for_review, 0);
  assert.equal(result.byDay[0].procedure_draft_created, 2);
  assert.equal(result.byProcess[0].processName, "Gestión del Desarrollo Económico");
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.deepEqual(call.params, [30, [
      "procedure_draft_created", "procedure_draft_updated",
      "procedure_submitted_for_review", "procedure_evaluation_started"
    ], "PD", "elaborador"]);
    assert.match(call.sql, /u\.role = \$4/);
  }
});

test("admin analytics rejects unsupported filters before querying data", async () => {
  let queried = false;
  const pool = { async query() { queried = true; return { rows: [] }; } };
  await assert.rejects(getAdminAnalytics(pool, { periodDays: "10" }), { code: "invalid_analytics_period" });
  await assert.rejects(getAdminAnalytics(pool, { processCode: "PD; DROP TABLE" }), { code: "invalid_analytics_process" });
  await assert.rejects(getAdminAnalytics(pool, { role: "root" }), { code: "invalid_analytics_role" });
  assert.equal(queried, false);
  assert.ok(new AnalyticsError("invalid_filter") instanceof Error);
});
