import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { createPool } from "./pool.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(currentDir, "../../db/schema.sql");
const migrationsDir = join(currentDir, "../../db/migrations");

export async function runMigrations(pool = createPool()) {
  const schema = await readFile(schemaPath, "utf8");
  const secondMigration = await readFile(join(migrationsDir, "002_sessions.sql"), "utf8");
  const thirdMigration = await readFile(join(migrationsDir, "003_admin_mfa.sql"), "utf8");
  const fourthMigration = await readFile(join(migrationsDir, "004_usernames.sql"), "utf8");
  const fifthMigration = await readFile(join(migrationsDir, "005_draft_revision.sql"), "utf8");
  const migrations = [
    ["001_initial_schema", schema],
    ["002_sessions", secondMigration],
    ["003_admin_mfa", thirdMigration],
    ["004_usernames", fourthMigration],
    ["005_draft_revision", fifthMigration]
  ];
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(5802001, 2)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    let appliedAny = false;
    for (const [version, sql] of migrations) {
      const checksum = createHash("sha256").update(sql).digest("hex");
      const applied = await client.query(
        "SELECT checksum FROM schema_migrations WHERE version = $1",
        [version]
      );
      if (applied.rows.length) {
        if (applied.rows[0].checksum !== checksum) {
          throw new Error(`La migracion ${version} ya se aplico con un contenido diferente.`);
        }
        continue;
      }

      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)",
        [version, checksum]
      );
      appliedAny = true;
    }
    await client.query("COMMIT");
    return appliedAny;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
