import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("activity, decision, and control responsibility groups match the original catalog", async () => {
  const [original, draftsScript, draftsHtml] = await Promise.all([
    readFile(join(root, "index.html"), "utf8"),
    readFile(join(root, "backend/public/drafts.js"), "utf8"),
    readFile(join(root, "backend/public/drafts.html"), "utf8")
  ]);
  const originalBlock = original.match(/const RESPONSIBILITY_ROLES=\[([\s\S]*?)\n\];/)?.[1];
  const actualBlock = draftsScript.match(/const responsibilityRoleGroups = \[([\s\S]*?)\n\];/)?.[1];
  assert.ok(originalBlock);
  assert.ok(actualBlock);

  const expectedGroups = [];
  for (const [, level, cargo] of originalBlock.matchAll(/\{level:"([^"]+)",cargo:"([^"]+)"\}/g)) {
    let group = expectedGroups.find(([label]) => label === level);
    if (!group) expectedGroups.push(group = [level, []]);
    group[1].push(cargo);
  }
  const actualGroups = [...actualBlock.matchAll(/\{ level: "([^"]+)", cargos: \[([^\]]+)\] \}/g)].map(([, level, cargos]) => [
    level,
    [...cargos.matchAll(/"([^"]+)"/g)].map(([, cargo]) => cargo)
  ]);

  assert.equal(expectedGroups.flatMap(([, cargos]) => cargos).length, 30);
  assert.deepEqual(actualGroups, expectedGroups);
  assert.match(draftsScript, /createResponsibilityField\(activity, index, "responsable", "Responsable", "decisionResponsible"\)/);
  assert.match(draftsScript, /createResponsibilityField\(activity, index, key, labelText, "activityResponsible"\)/);
  assert.match(draftsScript, /createResponsibilityField\(activity, index, key, labelText, "controlResponsible"\)/);
  assert.match(draftsScript, /otherOption\.textContent = "Otro — ¿Cuál\?"/);
  assert.match(draftsScript, /value && !responsibilityRoleNames\.has\(value\)/);
  assert.match(draftsScript, /inputId === "draftApprovedBy"\) populateApprovalRoleSelect\(ui\[inputId\], value, \["Directivo"\]\)/);
  assert.match(draftsScript, /Valor guardado anteriormente/);
  for (const id of ["draftPreparedBy", "draftReviewedBy", "draftApprovedBy"]) {
    assert.match(draftsHtml, new RegExp(`<select id="${id}"><\\/select>`));
  }
  assert.doesNotMatch(draftsHtml, /<datalist id="roleOptions"/);
});
