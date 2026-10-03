import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDatabase, createPool } from "./db/pool.js";
import { AuthError, SESSION_COOKIE, changePassword, cookieOptions, getSession, hashToken, loginUser, parseCookies, revokeSession } from "./security/auth.js";
import { ACTIONS, canPerform } from "./domain/permissions.js";
import { UserManagementError, createAccount, listAccounts, resetAccountPassword, setAccountActive } from "./security/admin-users.js";
import { clientIp } from "./security/client-ip.js";
import { DraftError, createDraft, getOwnDraft, listOwnDrafts, updateOwnDraft } from "./domain/drafts.js";
import { reviewFlow } from "./domain/flow-review.js";

const rootDir = join(fileURLToPath(new URL("../..", import.meta.url)));
const accountAssets = {
  "/accounts": ["accounts.html", "text/html; charset=utf-8"],
  "/accounts.css": ["accounts.css", "text/css; charset=utf-8"],
  "/accounts.js": ["accounts.js", "text/javascript; charset=utf-8"]
};
const draftAssets = {
  "/drafts": ["drafts.html", "text/html; charset=utf-8"],
  "/drafts.css": ["drafts.css", "text/css; charset=utf-8"],
  "/drafts.js": ["drafts.js", "text/javascript; charset=utf-8"]
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

export function createAppServer({ poolFactory = createPool, secureCookies, trustLoopbackProxy = process.env.TRUST_LOOPBACK_PROXY === "1" } = {}) {
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
        const attemptKey = clientIp(req, { trustLoopbackProxy }) || "unknown";
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
          const session = await loginUser(pool, { ...body, request: req, clientAddress: attemptKey });
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

      if (url.pathname === "/api/processes" && req.method === "GET") {
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
          if (!canPerform(session.user, ACTIONS.CREATE_PROCEDURE)) {
            sendJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          const result = await pool.query(
            `SELECT p.code, p.name FROM processes p WHERE p.active = TRUE
             AND ($2 OR EXISTS (SELECT 1 FROM user_processes up
                                WHERE up.user_id = $1 AND up.process_code = p.code))
             ORDER BY p.name, p.code`,
            [session.user.id, session.user.role === "administrador"]
          );
          sendJson(res, 200, { ok: true, processes: result.rows });
        } catch (error) {
          if (error instanceof DraftError) sendJson(res, error.status, { ok: false, error: error.code });
          else sendJson(res, 503, { ok: false, error: "processes_unavailable" });
        } finally {
          await pool?.end();
        }
        return;
      }

      const draftId = /^\/api\/procedures\/([0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12})$/.exec(url.pathname)?.[1];
      if ((url.pathname === "/api/procedures" && ["GET", "POST"].includes(req.method)) ||
          (url.pathname === "/api/procedures/flow-review" && req.method === "POST") ||
          (draftId && ["GET", "PUT"].includes(req.method))) {
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
          if (req.method !== "GET") {
            const csrfToken = String(req.headers["x-csrf-token"] || "");
            if (!csrfToken || hashToken(csrfToken) !== session.csrfTokenHash) {
              sendJson(res, 403, { ok: false, error: "csrf_failed" });
              return;
            }
          }
          if (url.pathname === "/api/procedures/flow-review") {
            if (!["elaborador", "administrador"].includes(session.user.role)) {
              sendJson(res, 403, { ok: false, error: "forbidden" });
              return;
            }
            const body = await readJson(req, 1_048_576);
            sendJson(res, 200, { ok: true, issues: reviewFlow(body?.activities) });
          } else if (url.pathname === "/api/procedures" && req.method === "GET") {
            sendJson(res, 200, { ok: true, procedures: await listOwnDrafts(pool, session.user) });
          } else if (url.pathname === "/api/procedures") {
            const body = await readJson(req, 1_048_576);
            sendJson(res, 201, { ok: true, procedure: await createDraft(pool, session.user, body || {}) });
          } else if (req.method === "GET") {
            sendJson(res, 200, { ok: true, procedure: await getOwnDraft(pool, session.user, draftId) });
          } else {
            const body = await readJson(req, 1_048_576);
            sendJson(res, 200, { ok: true, procedure: await updateOwnDraft(pool, session.user, draftId, body || {}) });
          }
        } catch (error) {
          if (error.message === "request_too_large" || error.message === "invalid_json") {
            sendJson(res, 400, { ok: false, error: error.message });
          } else if (error instanceof DraftError) {
            sendJson(res, error.status, { ok: false, error: error.code });
          } else {
            sendJson(res, 503, { ok: false, error: "procedure_unavailable" });
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

      const privateAssets = { ...accountAssets, ...draftAssets };
      if (req.method === "GET" && Object.hasOwn(privateAssets, url.pathname)) {
        const [filename, contentType] = privateAssets[url.pathname];
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
