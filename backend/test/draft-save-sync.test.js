import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/drafts.js', import.meta.url), 'utf8');
class Element {
  constructor() { this.value = ''; this.disabled = false; this.hidden = false; this.textContent = ''; this.children = []; this.style = {}; this.attributes = {}; this.classes = new Set(); this.classList = { toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name), contains: name => this.classes.has(name) }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attributes[key] = value; }
  querySelectorAll() { return []; }
}
function harness() {
  const elements = new Map();
  const ui = new Proxy({}, { get(_, key) { if (!elements.has(key)) elements.set(key, new Element()); return elements.get(key); } });
  let submit;
  ui.draftForm.addEventListener = (_, handler) => { submit = handler; };
  ui.draftForm.querySelectorAll = () => [ui.processCode, ui.draftConsecutive, ui.draftObjective];
  ui.documentsSection.querySelectorAll = () => [ui.saveDocumentsButton];
  ui.draftName.value = 'Procedimiento de prueba';
  ui.processCode.value = 'DE'; ui.draftConsecutive.value = '1';
  const pending = [], sent = [];
  const activity = { uid: 'a', tipo: 'Actividad', actividad: 'Revisar A', responsable: 'Asesor' };
  const context = {
    ui, document: { createElementNS: () => new Element() },
    currentDraft: { id: 'isolated', revision: 1, status: 'borrador', code: 'DE-P-001' }, currentUserRole: 'elaborador',
    currentPayload: { fields: { objetivo: 'Original' } }, textFields: [['draftObjective', 'objetivo']],
    normRows: [{ norma: 'Original' }], activityRows: [activity], annexRows: [{ documento: 'Original' }], changeRows: [{ fecha: '2015-01-01' }],
    normativityConfirmedMissingTypes: [], annexesNotApplicable: false, flowReviewVersion: 1, draftEditorGeneration: 1, lastFlowReviewPassed: false, flowReviewPending: false, flowReviewRequestId: 0,
    saveInFlight: false, confirmedSave: null, dirty: true, flowZoom: 100, flowIntrinsicWidth: 0, flowIntrinsicHeight: 0,
    confirmRepeatedApprovalNames: () => true, syncProcedureNameValidity() {}, approvalRoleValue: () => 'Asesor',
    request(path, options) { sent.push({ path, body: structuredClone(options.body) }); return new Promise((resolve, reject) => pending.push({ resolve, reject })); },
    procedureConsecutive: () => 1, syncProcedureCode() {}, refreshProcedureProgress() {}, loadDrafts: async () => {},
    handleRequestError(error, node) { node.textContent = error.message; }, errorText: error => error.message,
    displayActivityNumber: () => '1'
  };
  vm.createContext(context);
  const rendering = source.slice(source.indexOf('function svgNode('), source.indexOf('\nfunction errorText('));
  vm.runInContext(rendering, context);
  vm.runInContext(source.slice(source.indexOf("function syncFlowReviewButton()"), source.indexOf("function showFlowReview(")), context);
  vm.runInContext(source.slice(source.indexOf('function syncSaveControls('), source.indexOf('\nasync function openAssignedProcedure(')), context);
  vm.runInContext(source.slice(source.indexOf('ui.draftForm.addEventListener("submit",'), source.indexOf('\nui.draftName.addEventListener')), context);
  function edit(value) { activity.actividad = value; context.markDirty(); }
  function save() { return submit({ preventDefault() {} }); }
  function succeed(index = pending.length - 1) {
    pending[index].resolve({ procedure: { id: 'isolated', revision: index + 2, status: 'borrador', processCode: 'DE', code: 'DE-P-001', payload: structuredClone(sent[index].body.payload) } });
  }
  function svgText(node = ui.flowSvg) { return [node.textContent, ...node.children.map(child => svgText(child))].join(' '); }
  return { context, ui, activity, pending, sent, edit, save, succeed, svgText };
}

test('successive saves retain the control object and render the last saved edit', async () => {
  const h = harness(); const originalRows = h.context.activityRows;
  h.edit('Revisar B'); let saving = h.save(); h.succeed(); await saving;
  assert.equal(h.context.activityRows, originalRows);
  assert.equal(h.context.activityRows[0], h.activity);
  assert.match(h.svgText(), /Revisar B/);
  h.edit('Revisar C'); assert.equal(h.ui.documentsMessage.textContent, 'Hay cambios pendientes.'); saving = h.save(); h.succeed(); await saving;
  assert.equal(h.sent[1].body.payload.activities[0].actividad, 'Revisar C');
  assert.equal(h.sent[1].body.revision, 2);
  assert.match(h.svgText(), /Revisar C/);
  assert.equal(h.context.dirty, false);
  assert.equal(h.ui.documentsMessage.textContent, 'Guardado. Flujograma actualizado.');
  assert.equal(h.ui.headerSaveMessage.hidden, true);
  assert.equal(h.ui.headerSaveLabel.textContent, 'Guardado exitoso');
  assert.equal(h.ui.saveDraftButton.classList.contains('is-saved'), true);
  h.context.syncSaveControls();
  assert.equal(h.ui.headerSaveLabel.textContent, 'Guardado exitoso');
  h.edit('Nueva edición pendiente');
  assert.equal(h.ui.headerSaveLabel.textContent, 'Guardar cambios');
  assert.equal(h.ui.saveDraftButton.classList.contains('is-saved'), false);
});

test('edits during a pending save survive in every row collection and remain dirty', async () => {
  const h = harness(); const objective = h.ui.draftObjective;
  const saving = h.save();
  assert.equal(h.ui.saveDraftButton.disabled, true);
  assert.equal(h.ui.saveDocumentsButton.disabled, true);
  assert.equal(h.ui.saveDocumentsButton.textContent, 'Guardando…');
  assert.equal(h.ui.headerSaveLabel.textContent, 'Guardando…');
  assert.equal(h.ui.headerSaveMessage.hidden, true);
  assert.equal(h.ui.draftForm.attributes['aria-busy'], 'true');
  h.edit('Revisar pendiente'); objective.value = 'Objetivo posterior';
  h.context.normRows[0].norma = 'Nueva'; h.context.annexRows[0].documento = 'Nuevo'; h.context.changeRows[0].fecha = '2016-01-01';
  h.ui.draftConsecutive.value = '2';
  h.succeed(); await saving;
  assert.equal(h.sent[0].body.payload.activities[0].actividad, 'Revisar A');
  assert.equal(h.ui.draftObjective, objective);
  assert.equal(objective.value, 'Objetivo posterior');
  assert.equal(h.ui.draftConsecutive.value, '2');
  assert.equal(h.context.normRows[0].norma, 'Nueva');
  assert.equal(h.context.annexRows[0].documento, 'Nuevo');
  assert.equal(h.context.changeRows[0].fecha, '2016-01-01');
  assert.equal(h.context.dirty, true);
  assert.match(h.svgText(), /Revisar pendiente/);
  assert.match(h.ui.documentsMessage.textContent, /Hay cambios pendientes/);
  assert.equal(h.ui.saveDraftButton.classList.contains('is-saved'), false);
  assert.equal(h.ui.headerSaveLabel.textContent, 'Guardar cambios');
  assert.equal(h.ui.headerSaveMessage.hidden, true);
  const second = h.save(); h.succeed(); await second;
  assert.equal(h.sent[1].body.payload.fields.objetivo, 'Objetivo posterior');
  assert.equal(h.sent[1].body.payload.activities[0].actividad, 'Revisar pendiente');
  assert.equal(h.context.dirty, false);
});

test('duplicate submits send one request; failures preserve input and permit retry', async () => {
  const h = harness(); const saving = h.save(); await h.save();
  assert.equal(h.sent.length, 1);
  h.edit('Revisar sin perder');
  h.pending[0].reject(new Error('Sin conexión')); await saving;
  assert.equal(h.context.activityRows[0], h.activity);
  assert.equal(h.activity.actividad, 'Revisar sin perder');
  assert.equal(h.context.dirty, true);
  assert.match(h.ui.documentsMessage.textContent, /Sin conexión/);
  assert.equal(h.ui.saveDraftButton.classList.contains('is-saved'), false);
  assert.equal(h.ui.headerSaveMessage.textContent, h.ui.documentsMessage.textContent);
  assert.equal(h.ui.saveDraftButton.disabled, false);
  assert.equal(h.ui.saveDocumentsButton.disabled, false);
  const retry = h.save(); h.succeed(); await retry;
  assert.equal(h.sent[1].body.payload.activities[0].actividad, 'Revisar sin perder');
});

test('a late response cannot replace a different editor session', async () => {
  const h = harness(); const saving = h.save();
  h.context.draftEditorGeneration++;
  h.context.currentDraft = { id: 'different', revision: 9 };
  h.context.activityRows = [{ uid: 'other', actividad: 'Otro procedimiento' }];
  h.succeed(); await saving;
  assert.equal(h.context.currentDraft.id, 'different');
  assert.equal(h.ui.saveDraftButton.classList.contains('is-saved'), false);
  assert.equal(h.context.activityRows[0].actividad, 'Otro procedimiento');
  assert.equal(h.context.saveInFlight, false);
});


test('failed creation restores the process selector and retains the new draft', async () => {
  const h = harness(); h.context.currentDraft = null;
  const saving = h.save();
  assert.equal(h.ui.processCode.disabled, true);
  h.edit('Crear sin perder');
  h.pending[0].reject(new Error('Sin conexión')); await saving;
  assert.equal(h.context.currentDraft, null);
  assert.equal(h.ui.processCode.disabled, false);
  assert.equal(h.activity.actividad, 'Crear sin perder');
  assert.equal(h.ui.saveDocumentsButton.textContent, 'Guardar borrador');
});

test('revision conflicts keep local edits and expose reload without claiming success', async () => {
  const h = harness(); const saving = h.save(); h.edit('Conservar revisión local');
  h.pending[0].reject(Object.assign(new Error('conflict'), { code: 'draft_conflict' })); await saving;
  assert.equal(h.context.currentDraft.revision, 1);
  assert.equal(h.activity.actividad, 'Conservar revisión local');
  assert.equal(h.context.dirty, true);
  assert.equal(h.ui.reloadDraftButton.hidden, false);
  assert.match(h.ui.documentsMessage.textContent, /Tus cambios siguen en pantalla/);
  assert.equal(h.ui.saveDraftButton.classList.contains('is-saved'), false);
  assert.equal(h.ui.headerSaveMessage.textContent, h.ui.documentsMessage.textContent);
});


test('saving an unchanged reviewed flow preserves its green review indicator', async () => {
  const h = harness(); h.context.lastFlowReviewPassed = true; h.context.syncFlowReviewButton();
  assert.equal(h.ui.reviewFlowButton.classList.contains('is-reviewed'), true);
  const saving = h.save(); h.succeed(); await saving;
  assert.equal(h.ui.reviewFlowButton.classList.contains('is-reviewed'), true);
  h.edit('Cambio del flujo');
  assert.equal(h.ui.reviewFlowButton.classList.contains('is-reviewed'), false);
});

test('routine save feedback is absent below Activities while errors remain visible', () => {
  const h = harness();
  for (const text of ['Guardando…','Hay cambios pendientes.','Guardado. Flujograma actualizado.','Guardado lo enviado. Hay cambios pendientes; el flujograma muestra lo que está en pantalla.']) {
    h.context.setMessage(h.ui.documentsMessage, text, text.startsWith('Guardado'));
    assert.equal(h.ui.editorMessage.hidden, true);
    assert.equal(h.ui.editorMessage.textContent, '');
    assert.equal(h.ui.documentsMessage.textContent, text);
    assert.equal(h.ui.saveStatusAnnouncement.textContent, text);
  }
  h.context.setMessage(h.ui.editorMessage, 'Corrige las fallas del flujo.');
  assert.equal(h.ui.editorMessage.hidden, false);
  assert.equal(h.ui.editorMessage.textContent, 'Corrige las fallas del flujo.');
  assert.equal(h.ui.saveStatusAnnouncement.textContent, '');
});
