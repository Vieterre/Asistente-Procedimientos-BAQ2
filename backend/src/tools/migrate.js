import { createPool } from "../db/pool.js";
import { runMigrations } from "../db/migrate.js";

const pool = createPool();

try {
  const applied = await runMigrations(pool);
  console.log(applied ? "Migraciones aplicadas correctamente." : "Migraciones ya aplicadas; esquema sin cambios.");
} finally {
  await pool.end();
}
