import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/drafts.js', import.meta.url), 'utf8');
function report(role, status, saved = true) {
  const ui = Object.fromEntries(Object.entries({ draftPreparedName: 'Elaboradora', draftReviewedName: 'Revisor', draftApprovedName: 'Aprobadora', draftPreparedBy: 'Profesional', draftReviewedBy: 'Jefe', draftApprovedBy: 'Director' }).map(([key, value]) => [key, { value }]));
  const currentDraft = saved ? { status, version: '1.0', submittedForReviewAt: '2026-10-01T12:00:00Z', technicalReviewedAt: '2026-10-02T12:00:00Z', approvedAt: '2026-10-03T12:00:00Z' } : null;
  const context = {
    ui, currentDraft, currentUserRole: role, changeRows: [{ version: '1.0', fecha: '2026-10-01', razon: 'Creación' }],
    approvalRoleValue: select => select.value,
    document: { createElement: () => ({ children: [], append(...nodes) { this.children.push(...nodes); } }) },
    reportTable: (headers, rows, values, options) => ({ headers, rows: rows.map(values), options })
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function dateOnly('), source.indexOf('\nfunction previewFitScale(')), context);
  return context.changeControlReport().children;
}

test('author draft reports omit all three signature dates while retaining names, roles and change control', () => {
  for (const saved of [true, false]) {
    const [changes, approvals] = report('elaborador', 'borrador', saved);
    assert.equal(approvals.rows[0].length, 3);
    for (const cell of approvals.rows[0]) {
      assert.match(cell, /Nombre:/);
      assert.match(cell, /Cargo:/);
      assert.doesNotMatch(cell, /Fecha:|Pendiente de/);
    }
    assert.ok(changes.headers.includes('FECHA'));
    assert.equal(changes.rows.length, 1);
  }
});

test('reviewed, submitted and approved reports retain milestone dates and other roles keep their report dates', () => {
  for (const role of ['elaborador', 'evaluador', 'administrador']) {
    for (const status of ['borrador', 'enviado_a_evaluacion', 'en_evaluacion', 'devuelto_para_ajustes', 'subsanado', 'concepto_favorable', 'pendiente_visto_bueno_administrativo', 'aprobado_formalmente']) {
      if (role === 'elaborador' && status === 'borrador') continue;
      const [, approvals] = report(role, status);
      approvals.rows[0].forEach((cell, index) => assert.ok(cell.includes(`Fecha: 2026-10-0${index + 1}`), `${role}: ${status}`));
    }
  }
});
