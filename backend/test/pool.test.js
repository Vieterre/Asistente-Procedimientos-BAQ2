import test from "node:test";
import assert from "node:assert/strict";
import { checkDatabase, createPool } from "../src/db/pool.js";

test("database pool accepts separate PostgreSQL credentials", async () => {
  const pool = createPool({
    connectionString: "",
    host: "127.0.0.1",
    port: 5432,
    database: "asistente_procedimientos",
    user: "asistente_user",
    password: "test-only-secret"
  });
  try {
    assert.equal(pool.options.host, "127.0.0.1");
    assert.equal(pool.options.database, "asistente_procedimientos");
    assert.equal(pool.options.user, "asistente_user");
  } finally {
    await pool.end();
  }
});

test("database check requires tables and the initial migration", async () => {
  const pool = {
    async query(sql) {
      if (sql.includes("to_regclass")) {
        return { rows: [{ users_ready: true, procedures_ready: true, migrations_ready: true, sessions_ready: true }] };
      }
      return { rows: [{ "?column?": 1 }] };
    }
  };
  assert.equal(await checkDatabase(pool), true);
});

test("database check rejects an incomplete schema", async () => {
  const pool = {
    async query() {
      return { rows: [{ users_ready: true, procedures_ready: false, migrations_ready: true, sessions_ready: true }] };
    }
  };
  assert.equal(await checkDatabase(pool), false);
});
