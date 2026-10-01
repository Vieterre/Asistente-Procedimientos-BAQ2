import pg from "pg";

const { Pool } = pg;

export function databaseUrl() {
  return process.env.DATABASE_URL || "";
}

export function createPool(options = {}) {
  const connectionString = options.connectionString ?? databaseUrl();
  if (!connectionString) {
    throw new Error("DATABASE_URL no esta configurada.");
  }

  return new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 5000)
  });
}

export async function checkDatabase(pool) {
  const result = await pool.query(`
    SELECT
      to_regclass('app_users') IS NOT NULL AS users_ready,
      to_regclass('procedures') IS NOT NULL AS procedures_ready,
      to_regclass('schema_migrations') IS NOT NULL AS migrations_ready
  `);
  const row = result.rows[0];
  if (!row?.users_ready || !row?.procedures_ready || !row?.migrations_ready) {
    return false;
  }
  const migration = await pool.query(
    "SELECT 1 FROM schema_migrations WHERE version = $1",
    ["001_initial_schema"]
  );
  return migration.rows.length === 1;
}
