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
  assert.deepEqual(statements.slice(-2), ["COMMIT", "RELEASE"]);
});

test("repeated migration leaves an applied schema alone", async () => {
  const first = fakePool();
  await runMigrations(first);
  const checksum = first.calls.find(call => call.sql.startsWith("INSERT INTO schema_migrations")).params[1];
  const secondMigrationChecksum = first.calls
    .filter(call => call.sql.startsWith("INSERT INTO schema_migrations"))[1].params[1];
  const thirdMigrationChecksum = first.calls
    .filter(call => call.sql.startsWith("INSERT INTO schema_migrations"))[2].params[1];
  const second = fakePool({
    appliedChecksums: {
      "001_initial_schema": checksum,
      "002_sessions": secondMigrationChecksum,
      "003_admin_mfa": thirdMigrationChecksum
    }
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
