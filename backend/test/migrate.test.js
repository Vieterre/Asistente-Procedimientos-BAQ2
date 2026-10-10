import test from "node:test";
import assert from "node:assert/strict";
import { runMigrations } from "../src/db/migrate.js";

function fakePool({ appliedChecksums = {}, failSchema = false } = {}) {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT checksum FROM schema_migrations")) {
        const checksum = appliedChecksums[params[0]];
        return { rows: checksum ? [{ checksum }] : [] };
      }
      if (failSchema && sql.startsWith("CREATE TABLE app_users")) {
        throw new Error("schema failed");
      }
      return { rows: [] };
    },
    release() {
      calls.push({ sql: "RELEASE" });
    }
  };
  return { calls, connect: async () => client };
}

test("initial migration is transactional and records its checksum", async () => {
  const pool = fakePool();
  assert.equal(await runMigrations(pool), true);
  const statements = pool.calls.map(call => call.sql);
  assert.equal(statements[0], "BEGIN");
  assert.ok(statements.some(sql => sql.startsWith("CREATE TABLE app_users")));
  const recorded = pool.calls.find(call => call.sql.startsWith("INSERT INTO schema_migrations"));
  assert.equal(recorded.params[0], "001_initial_schema");
  assert.match(recorded.params[1], /^[a-f0-9]{64}$/);
  assert.ok(pool.calls.some(call => call.sql.includes("procedure_unfavorable_concept_issued")));
  assert.ok(pool.calls.some(call => call.sql.startsWith("INSERT INTO schema_migrations") && call.params[0] === "007_evaluation_notifications"));
  assert.ok(pool.calls.some(call => call.sql.includes("procedures_code_unique")));
  assert.ok(pool.calls.some(call => call.sql.startsWith("INSERT INTO schema_migrations") && call.params[0] === "008_procedure_codes"));
  assert.deepEqual(statements.slice(-2), ["COMMIT", "RELEASE"]);
});

test("repeated migration leaves an applied schema alone", async () => {
  const first = fakePool();
  await runMigrations(first);
  const appliedChecksums = Object.fromEntries(first.calls
    .filter(call => call.sql.startsWith("INSERT INTO schema_migrations"))
    .map(call => call.params));
  const second = fakePool({
    appliedChecksums
  });
  assert.equal(await runMigrations(second), false);
  assert.ok(!second.calls.some(call => call.sql.startsWith("CREATE TABLE app_users")));
  assert.deepEqual(second.calls.slice(-2).map(call => call.sql), ["COMMIT", "RELEASE"]);
});

test("migration rolls back on schema errors or changed contents", async () => {
  for (const options of [
    { failSchema: true },
    { appliedChecksums: { "001_initial_schema": "different" } }
  ]) {
    const pool = fakePool(options);
    await assert.rejects(runMigrations(pool));
    assert.deepEqual(pool.calls.slice(-2).map(call => call.sql), ["ROLLBACK", "RELEASE"]);
  }
});
