import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/drafts.js', import.meta.url), 'utf8');
const versionHelper = source.slice(source.indexOf('function latestDocumentVersion('), source.indexOf('\nfunction suggestNextChangeVersion('));
const latestVersion = vm.runInNewContext(`${versionHelper}\nlatestDocumentVersion`);

test('document versions come from the highest change, compared by major and minor rather than row order or decimals', () => {
  for (const [versions, expected] of [
    [['1.0', '3.0', '4.0', '5.0'], '5.0'],
    [['1.0', '5.0', '3.0', ''], '5.0'],
    [['1.9', '1.10', '1.2'], '1.10'],
    [['9.9', '10.0', '2.0'], '10.0'],
    [['1.0', ' 5.2 ', 'invalid'], '5.2']
  ]) {
    const changes = versions.map(version => ({ version }));
    const before = JSON.stringify(changes);
    assert.equal(latestVersion(changes, '1.0'), expected);
    assert.equal(JSON.stringify(changes), before);
  }
  assert.equal(latestVersion([null, {}, { version: '' }, { version: 'invalid' }], ' 3.2 '), '3.2');
  assert.equal(latestVersion(undefined, '4.0'), '4.0');
  assert.equal(latestVersion([], 'invalid'), '1.0');
  assert.equal(latestVersion([]), '1.0');
});

class Element {
  constructor(tag = 'div') {
    this.tag = tag; this.children = []; this.textContent = ''; this.value = '';
    this.className = ''; this.style = {}; this.dataset = {}; this.selectedOptions = [];
    this.classList = { add: (...names) => { this.className += ' ' + names.join(' '); }, remove() {} };
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  querySelector(selector) { return this.children.find(node => node.className.split(' ').includes(selector.slice(1))) || this.children.map(node => node.querySelector(selector)).find(Boolean) || null; }
  cloneNode() {
    const clone = Object.assign(new Element(this.tag), { className: this.className, textContent: this.textContent, dataset: { ...this.dataset } });
    clone.children = this.children.map(node => node.cloneNode(true));
    return clone;
  }
  showModal() {}
}
function collect(node) { return [node, ...node.children.flatMap(collect)]; }
function reportHarness() {
  const elements = new Map();
  const ui = new Proxy({}, { get(_, key) { if (!elements.has(key)) elements.set(key, new Element()); return elements.get(key); } });
  ui.draftName.value = 'Procedimiento de prueba';
  const changes = ['1.0', '3.0', '4.0', '5.0'].map((version, i) => ({ version, fecha: `2026-11-${10 + i}`, razon: `Cambio ${version}` }));
  const context = {
    ui, currentDraft: { version: '1.0', status: 'borrador', revision: 12 }, currentPayload: { fields: { version: '1.0' } },
    currentUserRole: 'elaborador', changeRows: changes, activityRows: [], normRows: [], annexRows: [], annexesNotApplicable: false,
    dirty: false, previewBranding: 'standard', approvalRoleValue: select => select.value, statusLabel: status => status,
    renderFlow() {}, requestAnimationFrame: callback => callback(),
    document: { title: 'Borradores', createElement: tag => new Element(tag), body: new Element('body'), documentElement: new Element('html') },
    window: { addEventListener() {}, setTimeout() {}, scrollTo() {}, print() { context.printed = true; } }
  };
  vm.createContext(context);
  vm.runInContext(versionHelper, context);
  vm.runInContext(source.slice(source.indexOf('function reportTable('), source.indexOf('\nfunction previewFitScale(')), context);
  vm.runInContext(source.slice(source.indexOf('function showPreview('), source.indexOf('\nlet consultationRequestVersion')), context);
  return { context, ui, changes };
}

test('standard and institutional previews and their PDF copies agree on the latest version and preserve historic change dates', async () => {
  for (const branding of ['standard', 'institutional']) {
    const { context, ui, changes } = reportHarness();
    const original = JSON.stringify(changes);
    context.showPreview({ branding });
    const nodes = collect(ui.previewContent);
    const header = nodes.find(node => node.tag === 'header');
    const headerText = collect(header).map(node => node.textContent).join(' ');
    assert.match(headerText, branding === 'institutional' ? /Versión: 5\.0/ : /Versión 5\.0/);
    const control = nodes.find(node => node.dataset.variant === 'change-control');
    const rows = control.children.find(node => node.tag === 'tbody').children;
    assert.deepEqual(rows.map(row => row.children[1].textContent), ['2026-11-10', '2026-11-11', '2026-11-12', 'Pendiente de aprobación formal']);
    await context.printPreviewReport();
    const printed = context.document.body.children[0];
    assert.equal(context.printed, true);
    assert.equal(collect(printed).map(node => node.textContent).join('\n'), nodes.map(node => node.textContent).join('\n'));
    assert.equal(JSON.stringify(changes), original);
    assert.equal(context.currentDraft.version, '1.0', 'reporting must not change stored procedure metadata');
    assert.equal(context.currentDraft.revision, 12, 'the save revision is not the document version');
  }
});

test('preview reflects local change edits and falls back to metadata only for procedures without a valid history', () => {
  const { context, ui, changes } = reportHarness();
  changes.push({ version: '5.1', fecha: '2026-11-20', razon: 'Edición local' }, { version: '' });
  context.dirty = true;
  context.showPreview();
  assert.match(collect(ui.previewContent.querySelector('.preview-document-meta')).map(node => node.textContent).join(' '), /Versión 5\.1/);
  assert.equal(context.currentPayload.fields.version, '1.0');
  context.changeRows = [];
  context.currentDraft.version = '2.3';
  context.showPreview();
  assert.match(collect(ui.previewContent.querySelector('.preview-document-meta')).map(node => node.textContent).join(' '), /Versión 2\.3/);
});

test('the evaluation PDF identifies the same document version as its change control', () => {
  const { context } = reportHarness();
  Object.assign(context, {
    evaluationRubric: { groups: [] }, processNames: new Map(),
    localEvaluationMetrics: () => ({ score: 100, completed: 0, total: 0, level: 'Completo' }),
    evaluationReportConcept: () => 'Concepto técnico'
  });
  vm.runInContext(source.slice(source.indexOf('function evaluationReportCell('), source.indexOf('\nfunction exportEvaluationReport(')), context);
  const report = context.buildEvaluationReport();
  assert.match(collect(report.querySelector('.evaluation-pdf-meta')).map(node => node.textContent).join(' '), /versión 5\.0/);
});
