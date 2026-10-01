import { createPool } from "../db/pool.js";
import { bootstrapAdmin } from "../security/bootstrap-admin.js";

const email = process.env.ADMIN_EMAIL;
const displayName = process.env.ADMIN_NAME || "Administrador institucional";
const password = process.env.ADMIN_PASSWORD;

if (!email || !password || !process.env.MFA_ENCRYPTION_KEY) {
  console.error("Configure ADMIN_EMAIL, ADMIN_PASSWORD y MFA_ENCRYPTION_KEY antes de crear el primer administrador.");
  process.exit(1);
}

const pool = createPool();
try {
  const admin = await bootstrapAdmin(pool, {
    email,
    displayName,
    password,
    mfaEncryptionKey: process.env.MFA_ENCRYPTION_KEY
  });
  console.log(`Administrador inicial creado: ${admin.email}`);
  console.log("Configura este URI en una aplicacion autenticadora y no lo compartas:");
  console.log(admin.mfaSetupUri);
} finally {
  await pool.end();
}
