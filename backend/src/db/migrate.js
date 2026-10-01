import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { createPool } from "./pool.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(currentDir, "../../db/schema.sql");

export async function runMigrations(pool = createPool()) {
  const schema = await readFile(schemaPath, "utf8");
  const checksum = createHash("sha256").update(schema).digest("hex");
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

    const applied = await client.query(
      "SELECT checksum FROM schema_migrations WHERE version = $1",
      ["001_initial_schema"]
    );
    if (applied.rows.length) {
      if (applied.rows[0].checksum !== checksum) {
        throw new Error("La migracion 001 ya se aplico con un contenido diferente.");
      }
      await client.query("COMMIT");
      return false;
    }

    await client.query(schema);
    await client.query(
      "INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)",
      ["001_initial_schema", checksum]
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
