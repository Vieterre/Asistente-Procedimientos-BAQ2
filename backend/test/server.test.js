import test from "node:test";
import assert from "node:assert/strict";
import { createAppServer } from "../src/server.js";
import { hashToken } from "../src/security/auth.js";

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
    const accountsHtml = await (await fetch(base + "/accounts")).text();
    assert.match(accountsHtml, /<form id="loginForm" method="post"/);
    const accountsScript = await (await fetch(base + "/accounts.js")).text();
    for (const id of ["processDialog", "processTitle", "processOptions", "processMessage", "saveProcessButton", "closeProcessButton", "cancelProcessButton"]) {
      assert.match(accountsHtml, new RegExp(`id="${id}"`));
      assert.match(accountsScript, new RegExp(`"${id}"`));
    }
    assert.match(accountsHtml, /Procesos asignados/);
    assert.match(accountsScript, /\/api\/admin\/users\/\$\{encodeURIComponent\(user\.id\)\}\/processes/);
    assert.match(accountsScript, /method: "PUT", csrf: true, body: \{ processCodes \}/);
    const draftHtml = await (await fetch(base + "/drafts")).text();
    assert.match(draftHtml, /<form id="loginForm" method="post"/);
    const draftScript = await (await fetch(base + "/drafts.js")).text();
    const draftIds = draftScript.match(/const ids = \[([\s\S]*?)\];/)?.[1];
    assert.ok(draftIds);
    const declaredIds = [...draftIds.matchAll(/"([A-Za-z][A-Za-z0-9]*)"/g)].map(([, id]) => id);
    const htmlIds = new Set([...draftHtml.matchAll(/\bid="([A-Za-z][A-Za-z0-9]*)"/g)].map(([, id]) => id));
    assert.deepEqual(declaredIds.filter(id => !htmlIds.has(id)), []);
    assert.match(draftHtml, /id="flowSvg"/);
    assert.match(draftHtml, /id="refreshFlowButton"/);
    assert.match(draftHtml, /id="showFlowEvidence"/);
    for (const id of ["documentsSection", "annexApplicability", "addAnnexButton", "annexesList", "addChangeButton", "changesList", "saveDocumentsButton", "submitReviewButton", "submitReviewDialog", "reviewEvaluatorSelect", "evaluatorInbox", "evaluatorDraftList", "evaluatorDetail", "startEvaluationButton"]) {
      assert.match(draftHtml, new RegExp(`id="${id}"`));
    }
    for (const id of ["flowCanvas", "zoomOutButton", "zoomInButton", "fitFlowButton", "resetFlowZoomButton", "flowZoomValue", "previewButton", "previewDialog", "previewContent", "printPreviewButton"]) {
      assert.match(draftHtml, new RegExp(`id="${id}"`));
    }
    for (const id of ["notificationBell", "notificationPopover", "notificationCount", "markAllNotificationsRead", "analyticsButton", "analyticsSection", "analyticsPeriod", "analyticsProcess", "analyticsRole", "analyticsByDay", "analyticsByProcess"]) {
      assert.match(draftHtml, new RegExp(`id="${id}"`));
    }
    assert.match(draftHtml, /Reglas metodológicas del modelado/);
    assert.match(draftHtml, /Guía para clasificar el cambio y asignar la versión/);
    assert.match(draftHtml, /Siguiente número entero \(p\. ej\., 4\.0\)/);
    assert.match(draftHtml, /id="sessionControls"[^]*id="submitReviewButton"[^]*id="previewButton"[^]*id="logoutButton"/);
    assert.match(draftScript, /ui\.previewButton\.hidden = false/);
    assert.match(draftScript, /ui\.submitReviewButton\.hidden = currentUserRole !== "elaborador"/);
    assert.match(draftScript, /ui\.submitReviewButton\.disabled = !canSubmit/);
    assert.match(draftScript, /\/api\/notifications\/read-all/);
    assert.match(draftScript, /\/api\/admin\/analytics\?/);
    assert.match(draftScript, /user\.role !== "administrador"/);
    assert.match(draftScript, /60_000/);
    assert.match(draftScript, /processGroupDefinitions = \[/);
    assert.match(draftScript, /buildProcessOptionGroups\(processes\)/);
    assert.match(draftScript, /processNames\.get\(procedure\.processCode\)/);
    assert.match(draftScript, /ui\.showFlowEvidence\.addEventListener\("change", renderFlow\)/);
    const draftCss = await (await fetch(base + "/drafts.css")).text();
    assert.match(draftCss, /\.site-header\{position:sticky;top:0/);
    assert.match(draftScript, /item\.evidencia \|\| item\.controlEvidencia/);
    assert.match(draftScript, /ui\.fitFlowButton\.addEventListener\("click", fitFlow\)/);
    assert.match(draftScript, /installMethodHelps\(document\)/);
    assert.match(draftScript, /\/api\/procedures\/\$\{encodeURIComponent\(currentDraft\.id\)\}\/submit/);
    assert.match(draftScript, /\/api\/evaluator\/inbox/);
    assert.match(draftCss, /\.header-submit-button/);
    assert.match(draftCss, /\.notification-popover/);
    for (const path of ["/accounts.map", "/backend/public/accounts.js", "/drafts.map", "/backend/public/drafts.js"]) {
      assert.equal((await fetch(base + path)).status, 404);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("notifications use session and CSRF, and analytics stays administrator-only", async () => {
  const token = "new-features-session";
  const csrf = "new-features-csrf";
  const userId = "11111111-1111-4111-8111-111111111111";
  const notificationId = "22222222-2222-4222-8222-222222222222";
  let role = "elaborador";
  const calls = [];
  const poolFactory = () => ({
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("FROM app_sessions s")) return { rows: params[0] === hashToken(token) ? [{
        session_id: "33333333-3333-4333-8333-333333333333", csrf_token_hash: hashToken(csrf), id: userId,
        username: "author", email: null, display_name: "Author", role, must_change_password: false
      }] : [] };
      if (sql.startsWith("UPDATE app_sessions SET last_seen_at")) return { rows: [] };
      if (sql.startsWith("SELECT n.id")) return { rows: [{
        id: notificationId, procedureId: "44444444-4444-4444-8444-444444444444",
        eventType: "procedure_evaluation_started", title: "La evaluación comenzó",
        message: "La revisión inició.", createdAt: "2026-10-03T12:00:00.000Z", readAt: null, unreadCount: 1
      }] };
      if (sql.startsWith("UPDATE user_notifications SET read_at = COALESCE")) return { rows: [{ id: notificationId }] };
      if (sql.startsWith("UPDATE user_notifications SET read_at = now()")) return { rowCount: 1, rows: [] };
      if (sql.includes("FROM audit_events ae")) return { rows: [] };
      throw new Error("Unexpected SQL: " + sql);
    },
    async end() {}
  });
  const server = createAppServer({ poolFactory, secureCookies: false });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { cookie: `__Host-asistente_session=${token}` };
  try {
    assert.equal((await fetch(`${base}/api/notifications`)).status, 401);
    const list = await fetch(`${base}/api/notifications`, { headers });
    assert.equal(list.status, 200);
    assert.equal((await list.json()).unreadCount, 1);
    const deniedWrite = await fetch(`${base}/api/notifications/${notificationId}/read`, { method: "POST", headers });
    assert.equal(deniedWrite.status, 403);
    const read = await fetch(`${base}/api/notifications/${notificationId}/read`, { method: "POST", headers: { ...headers, "x-csrf-token": csrf } });
    assert.equal(read.status, 200);
    assert.equal(calls.find(call => call.sql.startsWith("UPDATE user_notifications SET read_at = COALESCE")).params[1], userId);
    assert.equal((await fetch(`${base}/api/notifications/read-all`, { method: "POST", headers })).status, 403);
    const readAll = await fetch(`${base}/api/notifications/read-all`, { method: "POST", headers: { ...headers, "x-csrf-token": csrf } });
    assert.equal(readAll.status, 200);
    assert.equal((await readAll.json()).updated, 1);

    assert.equal((await fetch(`${base}/api/admin/analytics`, { headers })).status, 403);
    role = "administrador";
    const analytics = await fetch(`${base}/api/admin/analytics?periodDays=7`, { headers });
    assert.equal(analytics.status, 200);
    assert.equal((await analytics.json()).analytics.periodDays, 7);
    assert.equal(calls.filter(call => call.sql.includes("FROM audit_events ae")).length, 3);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

