import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../public/drafts.js", import.meta.url), "utf8");
const procedure = { id: "44444444-4444-4444-8444-444444444444", name: "Formular el plan", revision: 7, canReassign: true };

function contextForRefresh(refresh) {
  class Element {
    constructor() { this.hidden = false; this.open = false; this.disabled = false; this.value = ""; this.children = []; this.listeners = {}; }
    replaceChildren(...children) { this.children = children; }
    reset() {} showModal() { this.open = true; }
    close() { this.open = false; this.listeners.close?.(); }
    addEventListener(name, callback) { this.listeners[name] = callback; }
  }
  const ids = ["reassignmentDialog", "reassignmentForm", "reassignmentTarget", "reassignmentReason", "reassignmentSummary", "reassignmentMessage", "confirmReassignment", "cancelReassignment", "consultationMessage", "consultationSection", "consultationProcess", "consultationStatus"];
  const calls = [];
  const context = {
    currentUserRole: "administrador", consultationRequestVersion: 0, URLSearchParams,
    ui: Object.fromEntries(ids.map(id => [id, new Element()])),
    document: { createElement: () => new Element() }, errorMessages: {},
    setMessage(element, text, success = false) { element.textContent = text; element.success = success; },
    handleRequestError(error, element) {
      element.textContent = error.code || "request_failed";
      if (error.code === "unauthenticated") {
        context.currentUserRole = ""; context.ui.consultationSection.hidden = true;
      }
    },
    renderConsultationList(procedures) { context.renderedProcedures = procedures; },
    async request(url, options) {
      calls.push({ url, options });
      if (url.startsWith("/api/admin/consultation/")) return refresh(context);
      if (options?.method === "POST") return { reassignment: { responsibleUserId: "next", revision: 8 } };
      return { revision: 7, candidates: [{ id: "next", displayName: "Nueva responsable" }] };
    }
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("async function loadConsultationList("), source.indexOf("\nfunction showConsultation(")), context);
  vm.runInContext(source.slice(source.indexOf("let reassignmentRequestVersion"), source.indexOf("ui.consultationButton.addEventListener('click'")), context);
  return { context, calls };
}

async function submit(context) {
  await context.openReassignment(procedure);
  context.ui.reassignmentTarget.value = "next";
  context.ui.reassignmentReason.value = "Cambio de equipo";
  return context.submitReassignment({ preventDefault() {} });
}

test("saved reassignment reports a failed list refresh without claiming the view is current", async () => {
  const { context, calls } = contextForRefresh(() => { throw Object.assign(new Error("service unavailable"), { code: "request_failed", status: 503 }); });
  await submit(context);
  assert.equal(calls.filter(call => call.options?.method === "POST").length, 1);
  assert.equal(context.ui.reassignmentDialog.open, false);
  assert.match(context.ui.consultationMessage.textContent, /reasignación se guardó/i);
  assert.match(context.ui.consultationMessage.textContent, /no se pudo actualizar el listado/i);
  assert.match(context.ui.consultationMessage.textContent, /Actualizar/);
  assert.equal(context.ui.consultationMessage.success, false);
});

test("saved reassignment confirms success after the refreshed list is rendered", async () => {
  const refreshed = [{ ...procedure, revision: 8, authorName: "Nueva responsable" }];
  const { context } = contextForRefresh(() => ({ procedures: refreshed, processes: [] }));
  await submit(context);
  assert.equal(context.renderedProcedures, refreshed);
  assert.match(context.ui.consultationMessage.textContent, /Procedimiento reasignado/);
  assert.equal(context.ui.consultationMessage.success, true);
});

test("session loss while refreshing is not overwritten by reassignment success", async () => {
  const { context } = contextForRefresh(() => { throw Object.assign(new Error("expired"), { code: "unauthenticated" }); });
  await submit(context);
  assert.equal(context.currentUserRole, "");
  assert.equal(context.ui.consultationMessage.textContent, "unauthenticated");
  assert.notEqual(context.ui.consultationMessage.success, true);
});

test("an obsolete refresh does not overwrite a newer consultation request", async () => {
  let finishRefresh;
  const { context } = contextForRefresh(() => new Promise(resolve => { finishRefresh = resolve; }));
  const pending = submit(context);
  while (!finishRefresh) await Promise.resolve();
  context.consultationRequestVersion++;
  context.ui.consultationMessage.textContent = "Consultando otra selección";
  finishRefresh({ procedures: [], processes: [] });
  await pending;
  assert.equal(context.ui.consultationMessage.textContent, "Consultando otra selección");
  assert.equal(context.renderedProcedures, undefined);
});
