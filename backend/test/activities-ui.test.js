import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("activity editor has per-item collapse and a color key for flow elements", async () => {
  const [html, script, css] = await Promise.all([
    readFile(join(root, "backend/public/drafts.html"), "utf8"),
    readFile(join(root, "backend/public/drafts.js"), "utf8"),
    readFile(join(root, "backend/public/drafts.css"), "utf8")
  ]);

  assert.match(html, /aria-label="Leyenda de colores de Actividades"/);
  for (const label of ["Actividad", "Decisión", "Conector", "Punto de control"]) {
    assert.match(html, new RegExp(`activity-swatch-[a-z-]+[^>]*><\\/span>${label}`));
  }
  assert.match(script, /const collapsedActivityUids = new Set\(\)/);
  assert.match(script, /collapse\.textContent = isCollapsed \? "Expandir" : "Contraer"/);
  assert.match(script, /collapse\.setAttribute\("aria-expanded", String\(!isCollapsed\)\)/);
  assert.match(script, /summary\.className = "activity-collapsed-summary"/);
  assert.match(script, /isCollapsed \? "is-collapsed" : ""/);
  for (const colorClass of ["decision-row", "connector-row", "control-row"]) {
    assert.match(css, new RegExp(`\\.activity-row\\.${colorClass}`));
  }
});
