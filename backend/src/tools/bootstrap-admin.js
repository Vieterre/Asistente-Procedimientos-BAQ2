import { createPool } from "../db/pool.js";
import { bootstrapAdmin } from "../security/bootstrap-admin.js";
import { generateTotpSecret } from "../security/mfa.js";
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

const mfaSecret = generateTotpSecret();
console.log("En el autenticador, agregue una cuenta con clave de configuracion manual (basada en tiempo).");
console.log(`Nombre de la cuenta: Asistente de Procedimientos (${email})`);
console.log("Clave secreta: no la comparta ni capture esta pantalla.");
console.log(mfaSecret);
const prompt = createInterface({ input: process.stdin, output: process.stdout });
let mfaCode;
try {
  mfaCode = await prompt.question("Codigo de 6 digitos del autenticador: ");
} finally {
  prompt.close();
}

const pool = createPool();
try {
  const admin = await bootstrapAdmin(pool, {
    email,
    displayName,
    password,
    mfaEncryptionKey: process.env.MFA_ENCRYPTION_KEY,
    mfaSecret,
    mfaCode
  });
  console.log(`Administrador inicial creado y MFA confirmado: ${admin.email}`);
} finally {
  await pool.end();
}
