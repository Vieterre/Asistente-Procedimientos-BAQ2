import test from "node:test";
import assert from "node:assert/strict";
import { checkDatabase } from "../src/db/pool.js";

test("database check requires tables and the initial migration", async () => {
  const pool = {
    async query(sql) {
      if (sql.includes("to_regclass")) {
        return { rows: [{ users_ready: true, procedures_ready: true, migrations_ready: true }] };
      }
      return { rows: [{ "?column?": 1 }] };
    }
  };
  assert.equal(await checkDatabase(pool), true);
});

test("database check rejects an incomplete schema", async () => {
  const pool = {
    async query() {
      return { rows: [{ users_ready: true, procedures_ready: false, migrations_ready: true }] };
    }
  };
  assert.equal(await checkDatabase(pool), false);
});
