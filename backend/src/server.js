import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDatabase, createPool } from "./db/pool.js";

const rootDir = join(fileURLToPath(new URL("../..", import.meta.url)));
const port = Number(process.env.PORT || 3000);

function securityHeaders(extra = {}) {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    ...extra
  };
}

export function createAppServer() {
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
          pool = createPool();
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

      if (url.pathname === "/" || url.pathname === "/index.html") {
        const body = await readFile(join(rootDir, "index.html"));
        res.writeHead(200, securityHeaders({ "Content-Type": "text/html; charset=utf-8" }));
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
  createAppServer().listen(port, () => {
    console.log(`Asistente disponible en http://localhost:${port}`);
  });
}
