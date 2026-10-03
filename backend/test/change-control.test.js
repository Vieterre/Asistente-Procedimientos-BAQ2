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
  assert.equal(suggest([], "2.0"), "2.1");
  assert.match(script, /const fallbackVersion = String\(currentPayload\.fields\?\.version \|\| "1\.0"\)/);
});

test("the change log keeps its three required fields and rejects duplicate versions at submission", async () => {
  const [html, frontend, backend] = await Promise.all([
    readFile(join(root, "backend/public/drafts.html"), "utf8"),
    readFile(join(root, "backend/public/drafts.js"), "utf8"),
    readFile(join(root, "backend/src/domain/drafts.js"), "utf8")
  ]);
  assert.match(frontend, /\[\["version", "Versión", "input"\], \["fecha", "Fecha", "date"\], \["razon", "Razón de la actualización", "textarea"\]\]/);
  assert.match(frontend, /suggestNextChangeVersion\(changeRows, fallbackVersion\)/);
  assert.match(backend, /Cada versión del control de cambios debe ser única\./);
});
