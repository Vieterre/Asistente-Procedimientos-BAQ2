import pg from "pg";
import { readServiceCredential } from "../security/service-credentials.js";

const { Pool } = pg;

export function databaseUrl() {
  return process.env.DATABASE_URL || "";
}

export function createPool(options = {}) {
  const connectionString = options.connectionString ?? databaseUrl();
  const connection = connectionString ? { connectionString } : {
    host: options.host ?? process.env.PGHOST ?? "127.0.0.1",
    port: Number(options.port ?? process.env.PGPORT ?? 5432),
    database: options.database ?? process.env.PGDATABASE,
    user: options.user ?? process.env.PGUSER,
    password: options.password ?? (process.env.PGPASSWORD || readServiceCredential("pg_password"))
  };
  if (!connectionString && (!connection.database || !connection.user || !connection.password)) {
    throw new Error("Configure DATABASE_URL o PGDATABASE, PGUSER y PGPASSWORD.");
  }

  return new Pool({
    ...connection,
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
      to_regclass('schema_migrations') IS NOT NULL AS migrations_ready,
      to_regclass('app_sessions') IS NOT NULL AS sessions_ready,
      to_regclass('user_notifications') IS NOT NULL AS notifications_ready
  `);
  const row = result.rows[0];
  if (!row?.users_ready || !row?.procedures_ready || !row?.migrations_ready || !row?.sessions_ready || !row?.notifications_ready) {
    return false;
  }
  const migration = await pool.query(
    "SELECT 1 FROM schema_migrations WHERE version = $1",
    ["001_initial_schema"]
  );
  const secondMigration = await pool.query(
    "SELECT 1 FROM schema_migrations WHERE version = $1",
    ["002_sessions"]
  );
  const thirdMigration = await pool.query(
    "SELECT 1 FROM schema_migrations WHERE version = $1",
    ["003_admin_mfa"]
  );
  const fourthMigration = await pool.query(
    "SELECT 1 FROM schema_migrations WHERE version = $1",
    ["004_usernames"]
  );
  const fifthMigration = await pool.query(
    "SELECT 1 FROM schema_migrations WHERE version = $1",
    ["005_draft_revision"]
  );
  const sixthMigration = await pool.query(
    "SELECT 1 FROM schema_migrations WHERE version = $1",
    ["006_user_notifications"]
  );
  const seventhMigration = await pool.query(
    "SELECT 1 FROM schema_migrations WHERE version = $1",
    ["007_evaluation_notifications"]
  );
  return [migration, secondMigration, thirdMigration, fourthMigration, fifthMigration, sixthMigration, seventhMigration].every(result => result.rows.length === 1);
}
