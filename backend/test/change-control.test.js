import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("a new change row suggests the next decimal version from saved history", async () => {
  const script = await readFile(join(root, "backend/public/drafts.js"), "utf8");
  const helper = script.match(/function suggestNextChangeVersion\(changes, fallback = "1\.0"\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(helper);
  const suggest = runInNewContext(`(${helper})`);
  assert.equal(suggest([{ version: "1.0" }]), "1.1");
  assert.equal(suggest([{ version: "1.0" }, { version: "1.1" }]), "1.2");
  assert.equal(suggest([{ version: "1.0" }, { version: "" }]), "1.1");
  assert.equal(suggest([{ version: "1.0" }, { version: "2.0" }, { version: "1.0" }]), "2.1");
  assert.equal(suggest([{ version: "2.9" }, { version: "2.10" }]), "2.11");
  assert.equal(suggest([], "2.0"), "2.1");
  assert.match(script, /const fallbackVersion = String\(currentPayload\.fields\?\.version \|\| "1\.0"\)/);
});

test("the change log keeps its three required fields and warns about chronology", async () => {
  const [html, frontend, backend] = await Promise.all([
    readFile(join(root, "backend/public/drafts.html"), "utf8"),
    readFile(join(root, "backend/public/drafts.js"), "utf8"),
    readFile(join(root, "backend/src/domain/drafts.js"), "utf8")
  ]);
  assert.match(frontend, /\[\["version", "Versión", "input"\], \["fecha", "Fecha", "date"\], \["razon", "Razón de la actualización", "textarea"\]\]/);
  assert.match(frontend, /suggestNextChangeVersion\(changeRows, fallbackVersion\)/);
  assert.doesNotMatch(backend, /Cada versión del control de cambios debe ser única\./);
  assert.match(html, /id="changesMessage"/);
  assert.match(frontend, /syncChangeLogWarnings\(\)/);
  const warningHelper = frontend.match(/function changeLogWarnings\(changes\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(warningHelper);
  const warn = runInNewContext(`(${warningHelper})`);
  assert.deepEqual(Array.from(warn([
    { version: "1.0", fecha: "2024-11-23" },
    { version: "2.0", fecha: "2024-02-12" },
    { version: "1.0", fecha: "2026-10-11" }
  ])), [
    "Inconsistencia de fecha en el cambio 2: 12 de febrero de 2024 es anterior a 23 de noviembre de 2024. Revise la cronología.",
    "Inconsistencia de versión en el cambio 3: 1.0 no es posterior a 2.0. Verifique el orden o confirme que corresponde a un historial excepcional."
  ]);
});
