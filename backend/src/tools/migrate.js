import { createPool } from "../db/pool.js";
import { runMigrations } from "../db/migrate.js";

const pool = createPool();

try {
  const applied = await runMigrations(pool);
  console.log(applied ? "Migracion aplicada correctamente." : "Migracion ya aplicada; esquema sin cambios.");
} finally {
  await pool.end();
}
