import { checkDatabase, createPool } from "../db/pool.js";

const pool = createPool();

try {
  const ok = await checkDatabase(pool);
  if (!ok) {
    throw new Error("PostgreSQL responde, pero faltan tablas o migraciones.");
  }
  console.log("Conexion y esquema PostgreSQL correctos.");
} finally {
  await pool.end();
}
