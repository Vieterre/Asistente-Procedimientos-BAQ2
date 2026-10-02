import { createInterface } from "node:readline/promises";
import { createAppServer } from "../server.js";

const useRunningService = process.argv.length === 3 && process.argv[2] === "--running-service";
if (process.argv.length > 2 && !useRunningService) {
  console.error("Uso: check-admin-login.js [--running-service]");
  process.exit(1);
}

const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const username = String(process.env.ADMIN_USERNAME || "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!process.stdin.isTTY || !(username || email) || !password || (!useRunningService && !process.env.MFA_ENCRYPTION_KEY)) {
  console.error("Se requiere una consola interactiva, ADMIN_USERNAME o ADMIN_EMAIL, ADMIN_PASSWORD y, para la prueba local, MFA_ENCRYPTION_KEY.");
  process.exit(1);
}

const prompt = createInterface({ input: process.stdin, output: process.stdout });
let otp;
try {
  otp = (await prompt.question("Codigo actual de 6 digitos del autenticador: ")).trim();
} finally {
  prompt.close();
}

if (!/^\d{6}$/.test(otp)) {
  console.error("El codigo debe tener 6 digitos.");
  process.exit(1);
}

const server = useRunningService ? null : createAppServer({ secureCookies: false });
let cookie;
let csrfToken;
let loggedOut = false;
let baseUrl;
try {
  if (server) {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
  }
  baseUrl = server ? `http://127.0.0.1:${server.address().port}` : "http://127.0.0.1:3000";
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: username || undefined, email: username ? undefined : email, password, otp })
  });
  if (!login.ok) {
    const failure = await login.json().catch(() => ({}));
    if (login.status === 401 && failure.error === "invalid_credentials") {
      throw new Error("Usuario o contraseña del Administrador incorrectos.");
    }
    if (login.status === 401 && failure.error === "mfa_required") {
      throw new Error("El codigo del autenticador no coincide o ya vencio.");
    }
    throw new Error(`Inicio de sesion rechazado (HTTP ${login.status}).`);
  }

  const body = await login.json();
  cookie = login.headers.get("set-cookie")?.split(";")[0];
  csrfToken = body.csrfToken;
  if (!cookie || !csrfToken || body.user?.role !== "administrador" ||
      (username ? body.user.username !== username : body.user.email !== email)) {
    throw new Error("La respuesta de inicio de sesion esta incompleta.");
  }

  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
  if (!me.ok || (username ? (await me.json()).user?.username !== username : (await me.json()).user?.email !== email)) {
    throw new Error("No se pudo consultar la sesion.");
  }

  const logout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { cookie, "x-csrf-token": csrfToken }
  });
  if (!logout.ok) throw new Error("No se pudo cerrar la sesion.");
  loggedOut = true;

  const afterLogout = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
  if (afterLogout.status !== 401) throw new Error("La sesion sigue activa despues del cierre.");

  console.log("ACCESO_VALIDADO: inicio, consulta y cierre de sesion correctos.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (!loggedOut && cookie && csrfToken) {
    try {
      await fetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
        headers: { cookie, "x-csrf-token": csrfToken }
      });
    } catch {
      console.error("No se pudo confirmar el cierre de la sesion de prueba.");
    }
  }
  if (server?.listening) await new Promise(resolve => server.close(resolve));
}
