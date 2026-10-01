import { createPool } from "../db/pool.js";
import { confirmBootstrapAdmin, prepareBootstrapAdmin } from "../security/bootstrap-admin.js";
import { createInterface } from "node:readline/promises";

const email = process.env.ADMIN_EMAIL;
const displayName = process.env.ADMIN_NAME || "Administrador institucional";
const password = process.env.ADMIN_PASSWORD;

if (!email || !password || !process.env.MFA_ENCRYPTION_KEY) {
  console.error("Configure ADMIN_EMAIL, ADMIN_PASSWORD y MFA_ENCRYPTION_KEY antes de crear el primer administrador.");
  process.exit(1);
}

if (!process.stdin.isTTY) {
  console.error("El alta inicial requiere una consola interactiva para confirmar MFA.");
  process.exit(1);
}

const pool = createPool();
try {
  const pending = await prepareBootstrapAdmin(pool, {
    email,
    displayName,
    password,
    mfaEncryptionKey: process.env.MFA_ENCRYPTION_KEY
  });
  console.log(pending.resumed ? "Se retomo el alta pendiente." : "Alta pendiente creada; todavia no tiene acceso.");
  console.log("En el autenticador, agregue una cuenta con clave de configuracion manual (basada en tiempo).");
  console.log(`Nombre de la cuenta: Asistente de Procedimientos (${pending.email})`);
  console.log("Clave secreta: no la comparta ni capture esta pantalla.");
  console.log(pending.mfaSecret);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  let mfaCode;
  try {
    mfaCode = await prompt.question("Codigo de 6 digitos del autenticador: ");
  } finally {
    prompt.close();
  }
  const admin = await confirmBootstrapAdmin(pool, {
    email,
    password,
    mfaEncryptionKey: process.env.MFA_ENCRYPTION_KEY,
    mfaCode
  });
  console.log(`Administrador inicial creado y MFA confirmado: ${admin.email}`);
} finally {
  await pool.end();
}
