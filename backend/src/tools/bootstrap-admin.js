import { createPool } from "../db/pool.js";
import { bootstrapAdmin } from "../security/bootstrap-admin.js";

const email = process.env.ADMIN_EMAIL;
const displayName = process.env.ADMIN_NAME || "Administrador institucional";
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error("Configure ADMIN_EMAIL y ADMIN_PASSWORD antes de crear el primer administrador.");
  process.exit(1);
}

const pool = createPool();
try {
  const admin = await bootstrapAdmin(pool, { email, displayName, password });
  console.log(`Administrador inicial creado: ${admin.email}`);
} finally {
  await pool.end();
}
