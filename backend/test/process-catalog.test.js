import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("database process catalog matches the original form codes and labels", async () => {
  const [original, seed, canonical, draftsScript] = await Promise.all([
    readFile(join(root, "index.html"), "utf8"),
    readFile(join(root, "backend/db/migrations/005_draft_revision.sql"), "utf8"),
    readFile(join(root, "backend/db/migrations/006_user_notifications.sql"), "utf8"),
    readFile(join(root, "backend/public/drafts.js"), "utf8")
  ]);
  const originalBlock = original.match(/const processGroups = \[([\s\S]*?)\n\];/)?.[1];
  assert.ok(originalBlock);
  const expected = [...originalBlock.matchAll(/\["([A-Z]{2,3})","([^"]+)"\]/g)].map(([, code, name]) => [code, name]);
  const expectedGroups = [...originalBlock.matchAll(/\{group:"([^"]+)",items:\[([\s\S]*?)\]\}/g)].map(([, label, items]) => [
    label,
    [...items.matchAll(/\["([A-Z]{2,3})","[^"]+"\]/g)].map(([, code]) => code)
  ]);
  const groupDefinitions = draftsScript.match(/const processGroupDefinitions = \[([\s\S]*?)\n\];/)?.[1];
  assert.ok(groupDefinitions);
  const actualGroups = [...groupDefinitions.matchAll(/\{ label: "([^"]+)", codes: \[([^\]]+)\] \}/g)].map(([, label, codes]) => [
    label,
    [...codes.matchAll(/"([A-Z]{2,3})"/g)].map(([, code]) => code)
  ]);
  const seeded = [...seed.matchAll(/\('([A-Z]{2,3})', '([^']+)'\)/g)].map(([, code]) => code);
  const actual = [...canonical.matchAll(/\('([A-Z]{2,3})', '([^']+)'\)/g)].map(([, code, name]) => [code, name]);
  assert.equal(expected.length, 13);
  assert.deepEqual(seeded.sort(), expected.map(([code]) => code).sort());
  assert.deepEqual(actual, expected);
  assert.deepEqual(actualGroups, expectedGroups);
});
