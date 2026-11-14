import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/drafts.js', import.meta.url), 'utf8');
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.attributes = {}; this.textContent = ''; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
}
function draw(roles) {
  const context = { document: { createElementNS: (_, tag) => new Element(tag) } };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function svgNode('), source.indexOf('\nfunction errorText(')), context);
  const items = [
    { uid: 'start', tipo: 'Inicio', actividad: 'Inicio' },
    ...roles.map((role, index) => ({ uid: 'work' + index, tipo: 'Actividad', actividad: 'Revisar solicitud', responsable: role })),
    { uid: 'end', tipo: 'Fin', actividad: 'Fin' }
  ];
  const original = JSON.stringify(items);
  const svg = new Element('svg');
  const layout = context.drawProcedureFlow(svg, items);
  assert.equal(JSON.stringify(items), original, 'rendering must preserve saved responsibilities');
  return { svg, layout };
}

test('every lane retains its complete responsible name, including long unbroken names', () => {
  const roles = [
    'Gerente de Control Interno de Gestión',
    'Comité Institucional de Coordinación de Control Interno',
    'Comité Institucional de Gestión y Desempeño',
    'Responsable ' + 'W'.repeat(120)
  ];
  const { svg } = draw(roles);
  const headers = svg.children.filter(node => node.attributes.class === 'flow-lane-header');
  const labels = svg.children.filter(node => node.tag === 'text' && node.attributes['aria-label']);
  assert.equal(labels.length, roles.length);
  assert.ok(Number(headers[0].attributes.height) > 68);
  assert.ok(headers.every(node => node.attributes.height === headers[0].attributes.height));
  labels.forEach((label, index) => {
    assert.equal(label.attributes['aria-label'], roles[index]);
    const spans = label.children.filter(node => node.tag === 'tspan');
    assert.equal(spans.map(node => node.textContent).join('').replace(/\s/g, ''), roles[index].replace(/\s/g, ''));
    assert.ok(spans.every(node => !node.textContent.includes('…')));
    assert.ok(spans.every(node => node.textContent.length * 13 <= 328));
    assert.ok(spans.every(node => Number(node.attributes.y) > 13 && Number(node.attributes.y) + 4 < Number(headers[index].attributes.height)));
  });
});

test('growing lane headers moves all diagram nodes and routes together without overlap', () => {
  const short = draw(['Asesor', 'Director']);
  const long = draw(['Comité Institucional de Coordinación de Control Interno y Seguimiento Institucional', 'Director']);
  const headerHeight = chart => Number(chart.svg.children.find(node => node.attributes.class === 'flow-lane-header').attributes.height);
  assert.equal(headerHeight(short), 68);
  const delta = headerHeight(long) - headerHeight(short);
  assert.ok(delta > 0);
  assert.equal(long.layout.height - short.layout.height, delta);
  const nodeRects = chart => chart.svg.children.filter(node => node.tag === 'g').flatMap(node => node.children).filter(node => node.tag === 'rect' && node.attributes.class?.startsWith('flow-node'));
  const before = nodeRects(short), after = nodeRects(long);
  assert.equal(after.length, before.length);
  after.forEach((node, index) => {
    assert.equal(Number(node.attributes.y) - Number(before[index].attributes.y), delta);
    assert.ok(Number(node.attributes.y) > headerHeight(long));
  });
  const routes = chart => chart.svg.children.filter(node => node.tag === 'polyline').map(node => node.attributes.points.split(/[, ]/).map(Number));
  const oldRoutes = routes(short), newRoutes = routes(long);
  newRoutes.forEach((route, index) => route.forEach((value, coordinate) => assert.equal(value - oldRoutes[index][coordinate], coordinate % 2 ? delta : 0)));
});
