import test from "node:test";
import assert from "node:assert/strict";
import { createAppServer } from "../src/server.js";

test("health endpoint returns service status", async () => {
  const server = createAppServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.service, "asistente-procedimientos");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("database health endpoint fails safely when database credentials are missing", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousPgUser = process.env.PGUSER;
  const previousPgPassword = process.env.PGPASSWORD;
  const previousPgDatabase = process.env.PGDATABASE;
  delete process.env.DATABASE_URL;
  delete process.env.PGUSER;
  delete process.env.PGPASSWORD;
  delete process.env.PGDATABASE;

  const server = createAppServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health/db`);
    const payload = await response.json();
    assert.equal(response.status, 503);
    assert.equal(payload.ok, false);
    assert.equal(payload.error, "database_unavailable");
  } finally {
    if (previousDatabaseUrl) process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousPgUser) process.env.PGUSER = previousPgUser;
    if (previousPgPassword) process.env.PGPASSWORD = previousPgPassword;
    if (previousPgDatabase) process.env.PGDATABASE = previousPgDatabase;
    await new Promise(resolve => server.close(resolve));
  }
});

test("server does not expose project files", async () => {
  const server = createAppServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const home = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /<html/i);
    for (const path of ["/.env.example", "/backend/db/schema.sql", "/package.json"]) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      assert.equal(response.status, 404);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("private consoles serve only their own assets with a restrictive policy", async () => {
  const server = createAppServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    for (const [path, type] of [
      ["/accounts", "text/html"],
      ["/accounts.css", "text/css"],
      ["/accounts.js", "text/javascript"],
      ["/drafts", "text/html"],
      ["/drafts.css", "text/css"],
      ["/drafts.js", "text/javascript"]
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), new RegExp(type));
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.match(response.headers.get("content-security-policy"), /default-src 'none'/);
      assert.ok((await response.text()).length > 100);
    }
    const draftHtml = await (await fetch(base + "/drafts")).text();
    assert.match(draftHtml, /id="flowSvg"/);
    assert.match(draftHtml, /id="refreshFlowButton"/);
    assert.match(draftHtml, /id="showFlowEvidence"/);
    for (const id of ["documentsSection", "annexApplicability", "addAnnexButton", "annexesList", "addChangeButton", "changesList", "saveDocumentsButton", "submitReviewButton", "submitReviewDialog", "reviewEvaluatorSelect", "evaluatorInbox", "evaluatorDraftList", "evaluatorDetail", "startEvaluationButton"]) {
      assert.match(draftHtml, new RegExp(`id="${id}"`));
    }
    for (const id of ["flowCanvas", "zoomOutButton", "zoomInButton", "fitFlowButton", "resetFlowZoomButton", "flowZoomValue", "previewButton", "previewDialog", "previewContent", "printPreviewButton"]) {
      assert.match(draftHtml, new RegExp(`id="${id}"`));
    }
    assert.match(draftHtml, /id="sessionControls"[^]*id="submitReviewButton"[^]*id="previewButton"[^]*id="logoutButton"/);
    const draftScript = await (await fetch(base + "/drafts.js")).text();
    assert.match(draftScript, /ui\.previewButton\.hidden = false/);
    assert.match(draftScript, /ui\.submitReviewButton\.hidden = currentUserRole !== "elaborador"/);
    assert.match(draftScript, /ui\.submitReviewButton\.disabled = !canSubmit/);
    assert.match(draftScript, /ui\.showFlowEvidence\.addEventListener\("change", renderFlow\)/);
    const draftCss = await (await fetch(base + "/drafts.css")).text();
    assert.match(draftCss, /\.site-header\{position:sticky;top:0/);
    assert.match(draftScript, /item\.evidencia \|\| item\.controlEvidencia/);
    assert.match(draftScript, /ui\.fitFlowButton\.addEventListener\("click", fitFlow\)/);
    assert.match(draftScript, /installMethodHelps\(document\)/);
    assert.match(draftScript, /\/api\/procedures\/\$\{encodeURIComponent\(currentDraft\.id\)\}\/submit/);
    assert.match(draftScript, /\/api\/evaluator\/inbox/);
    assert.match(draftCss, /\.header-submit-button/);
    for (const path of ["/accounts.map", "/backend/public/accounts.js", "/drafts.map", "/backend/public/drafts.js"]) {
      assert.equal((await fetch(base + path)).status, 404);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
