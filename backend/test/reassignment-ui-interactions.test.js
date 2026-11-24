import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../public/drafts.js", import.meta.url), "utf8");
const procedure = { id: "44444444-4444-4444-8444-444444444444", name: "Formular el plan institucional", revision: 7, canReassign: true };
const nextId = "33333333-3333-4333-8333-333333333333";
const available = { revision: 7, candidates: [{ id: nextId, displayName: "Nueva responsable" }] };
const flushEvents = () => new Promise(resolve => setImmediate(resolve));

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function interactionContext(request = async () => available) {
  class Element {
    constructor() {
      this.open = false; this.disabled = false; this.hidden = false; this.value = "";
      this.children = []; this.listeners = new Map(); this.textContent = "";
    }
    addEventListener(name, handler) { this.listeners.set(name, handler); }
    replaceChildren(...children) { this.children = children; }
    reset() { this.onReset?.(); }
    showModal() { this.open = true; }
    close() {
      if (!this.open) return;
      this.open = false;
      // Native dialog closure queues a close event rather than calling it inline.
      setImmediate(() => this.listeners.get("close")?.());
    }
    click() { if (!this.disabled) return this.listeners.get("click")?.({}); }
    requestCancel() {
      const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      this.listeners.get("cancel")?.(event);
      if (!event.defaultPrevented) this.close();
      return event;
    }
  }
  const ids = ["reassignmentDialog", "reassignmentForm", "reassignmentTarget", "reassignmentReason", "reassignmentSummary", "reassignmentMessage", "cancelReassignment", "confirmReassignment", "consultationMessage", "consultationSection"];
  const calls = [], errors = [];
  const context = {
    currentUserRole: "administrador", ui: Object.fromEntries(ids.map(id => [id, new Element()])),
    document: { createElement: () => new Element() }, errors, refreshCount: 0,
    errorMessages: { reassignment_reason_required: "Escribe el motivo de la reasignación." },
    setMessage(element, text, success = false) { element.textContent = text; element.success = success; },
    handleRequestError(error, element) {
      errors.push(error);
      if (["unauthenticated", "csrf_failed", "password_change_required"].includes(error.code)) {
        context.currentUserRole = "";
        context.ui.consultationSection.hidden = true;
        context.ui.reassignmentDialog.close();
      }
      element.textContent = error.code || "request_failed";
    },
    async loadConsultationList() { context.refreshCount++; return true; },
    async request(url, options) { calls.push({ url, options }); return request(url, options); }
  };
  context.ui.reassignmentForm.onReset = () => {
    context.ui.reassignmentTarget.value = ""; context.ui.reassignmentReason.value = "";
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("let reassignmentRequestVersion"), source.indexOf("ui.consultationButton.addEventListener('click'")), context);
  return { context, calls, ui: context.ui };
}

async function prepare(context, draft = procedure) {
  await context.openReassignment(draft);
  context.ui.reassignmentTarget.value = nextId;
  context.ui.reassignmentReason.value = "Traslado del responsable";
}

function submit(context) {
  return context.submitReassignment({ preventDefault() {} });
}

test("cancel while candidates load closes without posting and discards the late response", async () => {
  const pending = deferred();
  const { context, calls, ui } = interactionContext(() => pending.promise);
  const opening = context.openReassignment(procedure);
  assert.equal(ui.confirmReassignment.disabled, true);
  assert.equal(ui.cancelReassignment.disabled, false);
  ui.cancelReassignment.click();
  await flushEvents();
  pending.resolve(available);
  await opening;
  await submit(context);
  assert.equal(ui.reassignmentDialog.open, false);
  assert.equal(ui.confirmReassignment.disabled, true);
  assert.equal(ui.reassignmentTarget.children.length, 0);
  assert.equal(calls.filter(call => call.options?.method === "POST").length, 0);
});

test("a canceled candidate request cannot replace the next procedure's choices", async () => {
  const pending = deferred();
  let getCount = 0;
  const { context, ui } = interactionContext(() => ++getCount === 1 ? pending.promise
    : { revision: 12, candidates: [{ id: "new-choice", displayName: "Responsable del segundo procedimiento" }] });
  const first = context.openReassignment(procedure);
  ui.reassignmentDialog.requestCancel();
  await flushEvents();
  await context.openReassignment({ ...procedure, id: "second", name: "Formular el segundo plan", revision: 12 });
  pending.resolve(available);
  await first;
  assert.equal(ui.reassignmentDialog.open, true);
  assert.match(ui.reassignmentSummary.textContent, /segundo plan/);
  assert.equal(ui.reassignmentTarget.children[1].value, "new-choice");
  assert.equal(ui.confirmReassignment.disabled, false);
});

test("double submission sends once and both cancel button and Escape are blocked during saving", async () => {
  const pending = deferred();
  const { context, calls, ui } = interactionContext((url, options) => options?.method === "POST" ? pending.promise : available);
  await prepare(context);
  const first = submit(context);
  await submit(context);
  assert.equal(calls.filter(call => call.options?.method === "POST").length, 1);
  assert.equal(ui.confirmReassignment.disabled, true);
  assert.equal(ui.cancelReassignment.disabled, true);
  ui.cancelReassignment.click();
  assert.equal(ui.reassignmentDialog.open, true);
  assert.equal(ui.reassignmentDialog.requestCancel().defaultPrevented, true);
  assert.equal(ui.reassignmentDialog.open, true);
  pending.resolve({ reassignment: { responsibleUserId: nextId, revision: 8 } });
  await first;
  await flushEvents();
  assert.equal(ui.reassignmentDialog.open, false);
  assert.equal(ui.cancelReassignment.disabled, false);
  assert.equal(context.refreshCount, 1);
  assert.equal(ui.consultationMessage.success, true);
  assert.equal(context.errors.length, 0);
});

test("a revision conflict prevents retry until cancellation and fresh explicit selection", async () => {
  let revision = 7, postCount = 0;
  const { context, calls, ui } = interactionContext((url, options) => {
    if (options?.method !== "POST") return { ...available, revision };
    if (++postCount === 1) throw Object.assign(new Error("conflict"), { code: "draft_conflict", status: 409 });
    return { reassignment: { responsibleUserId: nextId, revision: 9 } };
  });
  await prepare(context);
  await submit(context);
  assert.equal(ui.reassignmentDialog.open, true);
  assert.equal(ui.confirmReassignment.disabled, true);
  assert.equal(ui.cancelReassignment.disabled, false);
  assert.equal(ui.reassignmentMessage.textContent, "draft_conflict");
  await submit(context);
  assert.equal(postCount, 1);
  ui.cancelReassignment.click();
  await flushEvents();
  revision = 8;
  await context.openReassignment({ ...procedure, revision });
  assert.equal(ui.reassignmentReason.value, "");
  assert.equal(ui.reassignmentTarget.value, "");
  ui.reassignmentTarget.value = nextId; ui.reassignmentReason.value = "Nueva decisión con el listado vigente";
  await submit(context);
  await flushEvents();
  const posts = calls.filter(call => call.options?.method === "POST");
  assert.equal(posts.length, 2);
  assert.equal(posts[1].options.body.revision, 8);
  assert.equal(ui.reassignmentDialog.open, false);
});

test("a transient POST error preserves selected account and reason and allows a controlled retry", async () => {
  let postCount = 0;
  const { context, calls, ui } = interactionContext((url, options) => {
    if (options?.method !== "POST") return available;
    if (++postCount === 1) throw Object.assign(new Error("unavailable"), { code: "request_failed", status: 503 });
    return { reassignment: { responsibleUserId: nextId } };
  });
  await prepare(context);
  await submit(context);
  assert.equal(ui.reassignmentDialog.open, true);
  assert.equal(ui.confirmReassignment.disabled, false);
  assert.equal(ui.cancelReassignment.disabled, false);
  assert.equal(ui.reassignmentTarget.value, nextId);
  assert.equal(ui.reassignmentReason.value, "Traslado del responsable");
  assert.equal(context.refreshCount, 0);
  await submit(context);
  await flushEvents();
  assert.equal(calls.filter(call => call.options?.method === "POST").length, 2);
  assert.equal(context.refreshCount, 1);
  assert.equal(ui.consultationMessage.success, true);
});

test("session expiry during POST closes the modal and cannot announce success or refresh protected data", async () => {
  const { context, ui } = interactionContext((url, options) => {
    if (options?.method === "POST") throw Object.assign(new Error("expired"), { code: "unauthenticated", status: 401 });
    return available;
  });
  await prepare(context);
  await submit(context);
  await flushEvents();
  assert.equal(context.currentUserRole, "");
  assert.equal(ui.reassignmentDialog.open, false);
  assert.equal(ui.consultationSection.hidden, true);
  assert.equal(context.refreshCount, 0);
  assert.notEqual(ui.consultationMessage.success, true);
  assert.equal(ui.cancelReassignment.disabled, false);
});

test("a late POST response from the previous session cannot close a newly opened reassignment", async () => {
  const pending = deferred();
  const { context, ui } = interactionContext((url, options) => options?.method === "POST" ? pending.promise : available);
  await prepare(context);
  const posting = submit(context);
  // Simulate session clearing, then a new authenticated session and user action.
  context.currentUserRole = ""; ui.reassignmentDialog.close();
  await flushEvents();
  context.currentUserRole = "administrador";
  await context.openReassignment({ ...procedure, id: "next-session-procedure", name: "Formular otro plan" });
  pending.resolve({ reassignment: { responsibleUserId: nextId, revision: 8 } });
  await posting;
  assert.equal(ui.reassignmentDialog.open, true);
  assert.match(ui.reassignmentSummary.textContent, /otro plan/);
  assert.equal(ui.confirmReassignment.disabled, false);
  assert.equal(context.refreshCount, 0);
  assert.notEqual(ui.consultationMessage.success, true);
});

test("no eligible candidates and a blank reason never produce a reassignment POST", async () => {
  const empty = interactionContext(async () => ({ revision: 7, candidates: [] }));
  await empty.context.openReassignment(procedure);
  assert.equal(empty.ui.confirmReassignment.disabled, true);
  assert.match(empty.ui.reassignmentMessage.textContent, /No hay otros elaboradores activos/);
  await submit(empty.context);
  assert.equal(empty.calls.filter(call => call.options?.method === "POST").length, 0);
  const normal = interactionContext();
  await prepare(normal.context);
  normal.ui.reassignmentReason.value = "   ";
  await submit(normal.context);
  assert.match(normal.ui.reassignmentMessage.textContent, /Escribe el motivo/);
  assert.equal(normal.calls.filter(call => call.options?.method === "POST").length, 0);
  assert.equal(normal.ui.confirmReassignment.disabled, false);
  assert.equal(normal.ui.cancelReassignment.disabled, false);
});

test("non-administrators and locked procedure cards cannot open the reassignment dialog", async () => {
  for (const role of ["elaborador", "evaluador", ""]) {
    const { context, calls, ui } = interactionContext();
    context.currentUserRole = role;
    await context.openReassignment(procedure);
    assert.equal(calls.length, 0); assert.equal(ui.reassignmentDialog.open, false);
  }
  const { context, calls, ui } = interactionContext();
  await context.openReassignment({ ...procedure, canReassign: false });
  assert.equal(calls.length, 0); assert.equal(ui.reassignmentDialog.open, false);
});
