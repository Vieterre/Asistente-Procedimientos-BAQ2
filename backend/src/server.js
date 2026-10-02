import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDatabase, createPool } from "./db/pool.js";
import { AuthError, SESSION_COOKIE, changePassword, cookieOptions, getSession, hashToken, loginUser, parseCookies, revokeSession } from "./security/auth.js";
import { ACTIONS, canPerform } from "./domain/permissions.js";
import { UserManagementError, createAccount, listAccounts, resetAccountPassword, setAccountActive } from "./security/admin-users.js";

const rootDir = join(fileURLToPath(new URL("../..", import.meta.url)));
const accountAssets = {
  "/accounts": ["accounts.html", "text/html; charset=utf-8"],
  "/accounts.css": ["accounts.css", "text/css; charset=utf-8"],
  "/accounts.js": ["accounts.js", "text/javascript; charset=utf-8"]
};
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

function securityHeaders(extra = {}) {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    ...(process.env.NODE_ENV === "production" ? { "Strict-Transport-Security": "max-age=31536000" } : {}),
    ...extra
  };
}

function sendJson(res, status, payload, extra = {}) {
  res.writeHead(status, securityHeaders({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extra
  }));
  res.end(JSON.stringify(payload));
}

async function readJson(req, maxBytes = 16_384) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new Error("request_too_large");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("invalid_json");
  }
}

export function createAppServer({ poolFactory = createPool, secureCookies } = {}) {
  const loginAttempts = new Map();
  const cookiesAreSecure = secureCookies ?? process.env.NODE_ENV === "production";

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

      if (url.pathname === "/health") {
        res.writeHead(200, securityHeaders({ "Content-Type": "application/json; charset=utf-8" }));
        res.end(JSON.stringify({ ok: true, service: "asistente-procedimientos" }));
        return;
      }

      if (url.pathname === "/health/db") {
        let pool;
        try {
          pool = poolFactory();
          const ok = await checkDatabase(pool);
          res.writeHead(ok ? 200 : 503, securityHeaders({ "Content-Type": "application/json; charset=utf-8" }));
          res.end(JSON.stringify({ ok }));
        } catch (error) {
          res.writeHead(503, securityHeaders({ "Content-Type": "application/json; charset=utf-8" }));
          res.end(JSON.stringify({ ok: false, error: "database_unavailable" }));
        } finally {
          await pool?.end();
        }
        return;
      }

      if (url.pathname === "/api/auth/login" && req.method === "POST") {
        const attemptKey = req.socket.remoteAddress || "unknown";
        const now = Date.now();
        const previous = loginAttempts.get(attemptKey) || { count: 0, startedAt: now };
        if (now - previous.startedAt > 15 * 60 * 1000) {
          previous.count = 0;
          previous.startedAt = now;
        }
        if (previous.count >= 10) {
          sendJson(res, 429, { ok: false, error: "too_many_attempts" }, { "Retry-After": "900" });
          return;
        }

        let pool;
        try {
          const body = await readJson(req);
          pool = poolFactory();
          const session = await loginUser(pool, { ...body, request: req });
          loginAttempts.delete(attemptKey);
          sendJson(res, 200, { ok: true, user: session.user, csrfToken: session.csrfToken }, {
            "Set-Cookie": `${SESSION_COOKIE}=${session.token}; ${cookieOptions({ secure: cookiesAreSecure })}`
          });
        } catch (error) {
          previous.count += 1;
          loginAttempts.set(attemptKey, previous);
          if (error.message === "request_too_large" || error.message === "invalid_json") {
            sendJson(res, 400, { ok: false, error: error.message });
          } else if (error instanceof AuthError) {
            sendJson(res, error.status, { ok: false, error: error.code });
          } else {
            sendJson(res, 503, { ok: false, error: "authentication_unavailable" });
          }
        } finally {
          await pool?.end();
        }
        return;
      }

      if (url.pathname === "/api/auth/me" && req.method === "GET") {
        let pool;
        try {
          pool = poolFactory();
          const session = await getSession(pool, parseCookies(req.headers.cookie)[SESSION_COOKIE]);
          if (!session) {
            sendJson(res, 401, { ok: false, error: "unauthenticated" });
            return;
          }
          sendJson(res, 200, { ok: true, user: session.user });
        } catch {
          sendJson(res, 503, { ok: false, error: "authentication_unavailable" });
        } finally {
          await pool?.end();
        }
        return;
      }

      if (url.pathname === "/api/auth/logout" && req.method === "POST") {
        let pool;
        try {
          pool = poolFactory();
          const cookies = parseCookies(req.headers.cookie);
          const token = cookies[SESSION_COOKIE];
          const session = await getSession(pool, token);
          const csrfToken = String(req.headers["x-csrf-token"] || "");
          if (!session || !csrfToken || hashToken(csrfToken) !== session.csrfTokenHash) {
            sendJson(res, 403, { ok: false, error: "csrf_failed" });
            return;
          }
          await revokeSession(pool, token);
          sendJson(res, 200, { ok: true }, {
            "Set-Cookie": `${SESSION_COOKIE}=; ${cookieOptions({ secure: cookiesAreSecure, maxAge: 0 })}`
          });
        } catch {
          sendJson(res, 503, { ok: false, error: "authentication_unavailable" });
        } finally {
          await pool?.end();
        }
        return;
      }

      if (url.pathname === "/api/auth/password" && req.method === "POST") {
        let pool;
        try {
          pool = poolFactory();
          const session = await getSession(pool, parseCookies(req.headers.cookie)[SESSION_COOKIE]);
          if (!session) {
            sendJson(res, 401, { ok: false, error: "unauthenticated" });
            return;
          }
          const csrfToken = String(req.headers["x-csrf-token"] || "");
          if (!csrfToken || hashToken(csrfToken) !== session.csrfTokenHash) {
            sendJson(res, 403, { ok: false, error: "csrf_failed" });
            return;
          }
          const body = await readJson(req);
          await changePassword(pool, {
            userId: session.user.id,
            currentPassword: body.currentPassword,
            newPassword: body.newPassword
          });
          sendJson(res, 200, { ok: true }, {
            "Set-Cookie": `${SESSION_COOKIE}=; ${cookieOptions({ secure: cookiesAreSecure, maxAge: 0 })}`
          });
        } catch (error) {
          if (error.message === "request_too_large" || error.message === "invalid_json") {
            sendJson(res, 400, { ok: false, error: error.message });
          } else if (error instanceof AuthError) {
            sendJson(res, error.status, { ok: false, error: error.code });
          } else {
            sendJson(res, 503, { ok: false, error: "password_change_unavailable" });
          }
        } finally {
          await pool?.end();
        }
        return;
      }

      const accountAction = /^\/api\/admin\/users\/([0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12})\/(deactivate|reactivate|reset-password)$/.exec(url.pathname);
      const accountCreation = url.pathname === "/api/admin/users" && req.method === "POST";
      if ((url.pathname === "/api/admin/users" && req.method === "GET") ||
          accountCreation || (accountAction && req.method === "POST")) {
        let pool;
        try {
          pool = poolFactory();
          const session = await getSession(pool, parseCookies(req.headers.cookie)[SESSION_COOKIE]);
          if (!session) {
            sendJson(res, 401, { ok: false, error: "unauthenticated" });
            return;
          }
          if (session.user.mustChangePassword) {
            sendJson(res, 403, { ok: false, error: "password_change_required" });
            return;
          }
          if (!canPerform(session.user, ACTIONS.MANAGE_USERS)) {
            sendJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          if (accountAction || accountCreation) {
            const csrfToken = String(req.headers["x-csrf-token"] || "");
            if (!csrfToken || hashToken(csrfToken) !== session.csrfTokenHash) {
              sendJson(res, 403, { ok: false, error: "csrf_failed" });
              return;
            }
            if (accountCreation) {
              const body = await readJson(req);
              sendJson(res, 201, { ok: true, ...await createAccount(pool, {
                actor: session.user,
                username: body.username,
                displayName: body.displayName,
                role: body.role
              }) });
            } else if (accountAction[2] === "reset-password") {
              sendJson(res, 200, { ok: true, ...await resetAccountPassword(pool, {
                actor: session.user,
                targetId: accountAction[1]
              }) });
            } else {
              const user = await setAccountActive(pool, {
                actor: session.user,
                targetId: accountAction[1],
                active: accountAction[2] === "reactivate"
              });
              sendJson(res, 200, { ok: true, user });
            }
          } else {
            sendJson(res, 200, { ok: true, users: await listAccounts(pool) });
          }
        } catch (error) {
          if (error.message === "request_too_large" || error.message === "invalid_json") {
            sendJson(res, 400, { ok: false, error: error.message });
          } else if (error instanceof UserManagementError) {
            sendJson(res, error.status, { ok: false, error: error.code });
          } else {
            sendJson(res, 503, { ok: false, error: "user_management_unavailable" });
          }
        } finally {
          await pool?.end();
        }
        return;
      }

      if (url.pathname === "/" || url.pathname === "/index.html") {
        const body = await readFile(join(rootDir, "index.html"));
        res.writeHead(200, securityHeaders({ "Content-Type": "text/html; charset=utf-8" }));
        res.end(body);
        return;
      }

      if (req.method === "GET" && Object.hasOwn(accountAssets, url.pathname)) {
        const [filename, contentType] = accountAssets[url.pathname];
        const body = await readFile(join(rootDir, "backend/public", filename));
        res.writeHead(200, securityHeaders({
          "Content-Type": contentType,
          "Cache-Control": "no-store",
          "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
        }));
        res.end(body);
        return;
      }

      res.writeHead(404, securityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
      res.end("No encontrado");
    } catch (error) {
      res.writeHead(404, securityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
      res.end("No encontrado");
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createAppServer().listen(port, host, () => {
    console.log(`Asistente disponible en http://${host}:${port}`);
  });
}
