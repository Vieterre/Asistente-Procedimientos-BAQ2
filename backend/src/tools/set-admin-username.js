import { randomUUID } from "node:crypto";
import { createPool } from "../db/pool.js";

const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const username = String(process.env.ADMIN_USERNAME || "").trim().toLowerCase();
if (!email || !/^[a-z][a-z0-9]{3,31}$/.test(username)) {
  console.error("Configure ADMIN_EMAIL y un ADMIN_USERNAME valido (4 a 32 letras o numeros).");
  process.exit(1);
}

const pool = createPool();
let client;
try {
  client = await pool.connect();
  await client.query("BEGIN");
  const result = await client.query(
    `SELECT id, username, active, mfa_enabled FROM app_users
     WHERE email = $1 AND role = 'administrador' FOR UPDATE`,
    [email]
  );
  const admin = result.rows[0];
  if (!admin?.active || !admin.mfa_enabled) throw new Error("No existe un administrador activo con MFA para ese correo.");
  if (admin.username && admin.username !== username) throw new Error("El administrador ya tiene otro nombre de usuario.");
  if (!admin.username) {
    await client.query("UPDATE app_users SET username = $2, updated_at = now() WHERE id = $1", [admin.id, username]);
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, event_type, entity_type, entity_id)
       VALUES ($1, $2, 'admin_username_assigned', 'app_user', $2)`,
      [randomUUID(), admin.id]
    );
  }
  await client.query("COMMIT");
  console.log(`Nombre de usuario del Administrador: ${username}`);
} catch (error) {
  if (client) await client.query("ROLLBACK");
  console.error(error.code === "23505" ? "El nombre de usuario ya esta ocupado." : error.message);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
