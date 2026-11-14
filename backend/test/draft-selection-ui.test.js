import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/drafts.js', import.meta.url), 'utf8');
class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.className = ''; this.hidden = false; this.textContent = ''; this.listeners = {}; this.scrollHeight = 0; this.clientHeight = 0; this.scrollTop = 0; this.offsetTop = 0; this.offsetHeight = 80; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener(event, handler) { this.listeners[event] = handler; }
  focus() {}
  descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
  querySelectorAll(selector) {
    if (selector === 'button[data-draft-id]') return this.descendants().filter(node => node.tag === 'button' && node.dataset.draftId);
    return [];
  }
  querySelector(selector) { return this.descendants().find(node => node.className.split(' ').includes(selector.slice(1))); }
}
const drafts = ['a', 'b'].map(id => ({ id, name: 'Revisar solicitud ' + id, code: 'DE-P-00' + (id === 'a' ? 1 : 2), processCode: 'DE', updatedAt: '2026-11-14T12:00:00Z', status: 'borrador' }));
function setup() {
  const pending = [];
  const ui = new Proxy({}, { get(target, key) { return target[key] ||= new Element(); } });
  const context = { ui, currentDraft: null, saveInFlight: false, dirty: false, window: { confirm: () => true }, document: { createElement: tag => new Element(tag) }, statusLabel: () => 'Borrador', setMessage() {}, handleRequestError() {}, syncProcedureNameValidity() {}, syncDefinitionsAlphabeticalSuggestion() {}, request() { return new Promise((resolve, reject) => pending.push({ resolve, reject })); } };
  context.populateDraft = procedure => { context.currentDraft = procedure; };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function syncActiveDraftSelection('), source.indexOf('\nfunction renderAdminApprovalQueue(')), context);
  vm.runInContext(source.slice(source.indexOf('async function openDraft('), source.indexOf('\nasync function openAdministrativeApproval(')), context);
  context.renderDrafts(drafts);
  const buttons = () => ui.draftList.querySelectorAll('button[data-draft-id]');
  const active = () => buttons().filter(button => button.attributes['aria-current'] === 'true').map(button => button.dataset.draftId);
  async function open(index) { const done = context.openDraft(drafts[index].id); pending.at(-1).resolve({ procedure: drafts[index] }); return done; }
  return { context, ui, pending, buttons, active, open };
}

test('opening a draft marks exactly that record and keeps its workflow status separate', async () => {
  const h = setup();
  assert.deepEqual(h.active(), []);
  await h.open(0);
  assert.deepEqual(h.active(), ['a']);
  const badge = h.buttons()[0].querySelector('.draft-active-label');
  assert.equal(badge.textContent, 'Abierto');
  assert.equal(badge.hidden, false);
  assert.equal(h.buttons()[0].querySelector('.draft-status').textContent, 'Borrador');
  assert.equal(h.buttons()[1].querySelector('.draft-active-label').hidden, true);
});

test('pending, failed and canceled openings retain the loaded draft until another opens successfully', async () => {
  const h = setup(); await h.open(0);
  h.context.dirty = true; h.context.window.confirm = () => false;
  const requests = h.pending.length;
  assert.equal(await h.context.openDraft('b'), false);
  assert.equal(h.pending.length, requests);
  assert.deepEqual(h.active(), ['a']);
  h.context.dirty = false;
  const failed = h.context.openDraft('b');
  assert.deepEqual(h.active(), ['a']);
  h.pending.at(-1).reject(new Error('Example failure'));
  assert.equal(await failed, false);
  assert.deepEqual(h.active(), ['a']);
  const opened = h.context.openDraft('b');
  assert.deepEqual(h.active(), ['a']);
  h.pending.at(-1).resolve({ procedure: drafts[1] });
  assert.equal(await opened, true);
  assert.deepEqual(h.active(), ['b']);
});

test('list refreshes retain selection by record identity after saving, renaming or reordering', async () => {
  const h = setup(); await h.open(1);
  h.context.currentDraft = { ...drafts[1], name: 'Nombre actualizado', revision: 2 };
  h.context.renderDrafts([h.context.currentDraft, drafts[0]]);
  assert.deepEqual(h.active(), ['b']);
  h.context.renderDrafts([drafts[0], h.context.currentDraft]);
  assert.deepEqual(h.active(), ['b']);
  h.context.currentDraft = null;
  h.context.syncActiveDraftSelection();
  assert.deepEqual(h.active(), []);
  assert.ok(h.buttons().every(button => button.querySelector('.draft-active-label').hidden));
});

test('a long list scrolls only its own viewport to keep the open record visible', async () => {
  const h = setup();
  h.ui.draftList.scrollHeight = 1200; h.ui.draftList.clientHeight = 300;
  h.buttons()[1].offsetTop = 700;
  await h.open(1);
  assert.equal(h.ui.draftList.scrollTop, 480);
  h.context.renderDrafts([drafts[1], drafts[0]]);
  assert.equal(h.ui.draftList.scrollTop, 0);
  assert.deepEqual(h.active(), ['b']);
});
