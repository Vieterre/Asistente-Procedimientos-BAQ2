import { randomUUID } from "node:crypto";
import { hashPassword } from "../security/passwords.js";

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const email = process.env.ADMIN_EMAIL;
const displayName = process.env.ADMIN_NAME || "Administrador institucional";
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error("Uso: ADMIN_EMAIL=correo@entidad.gov.co ADMIN_PASSWORD='clave-segura' node backend/src/tools/create-admin-sql.js");
  process.exit(1);
}

const userId = randomUUID();
const passwordHash = hashPassword(password);

console.log(`INSERT INTO app_users (id, email, display_name, role, password_hash, active, mfa_enabled)
VALUES (${sqlString(userId)}, ${sqlString(email.toLowerCase())}, ${sqlString(displayName)}, 'administrador', ${sqlString(passwordHash)}, TRUE, FALSE)
ON CONFLICT (email) DO NOTHING;`);
