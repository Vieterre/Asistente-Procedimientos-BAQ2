import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("activity editor has per-item collapse and a color key for flow elements", async () => {
  const [html, script, css] = await Promise.all([
    readFile(join(root, "backend/public/drafts.html"), "utf8"),
    readFile(join(root, "backend/public/drafts.js"), "utf8"),
    readFile(join(root, "backend/public/drafts.css"), "utf8")
  ]);

  assert.match(html, /aria-label="Leyenda de colores de Actividades"/);
  for (const label of ["Actividad", "Decisión", "Conector", "Punto de control"]) {
    assert.match(html, new RegExp(`activity-swatch-[a-z-]+[^>]*><\\/span>${label}`));
  }
  assert.match(script, /const collapsedActivityUids = new Set\(\)/);
  assert.match(script, /collapse\.textContent = isCollapsed \? "Expandir" : "Contraer"/);
  assert.match(script, /collapse\.setAttribute\("aria-expanded", String\(!isCollapsed\)\)/);
  assert.match(script, /summary\.className = "activity-collapsed-summary"/);
  assert.match(script, /function activityRowIsComplete\(activity\)/);
  assert.match(script, /completion\.textContent = complete \? "Completa" : "Pendiente"/);
  assert.match(script, /activity\.decisionSi !== activity\.decisionNo/);
  for (const requiredControlField of ["controlPeriodicidad", "controlAccion", "controlEjecucion", "controlDesviacion", "controlEvidencia"]) {
    assert.ok(script.includes(requiredControlField), `collapsed completeness should require ${requiredControlField}`);
  }
  assert.match(css, /\.activity-completion-tag\.pending/);
  assert.match(script, /isCollapsed \? "is-collapsed" : ""/);
  for (const colorClass of ["decision-row", "connector-row", "control-row"]) {
    assert.match(css, new RegExp(`\\.activity-row\\.${colorClass}`));
  }
});

test("collapsed activity status follows the original required-field rules", async () => {
  const script = await readFile(join(root, "backend/public/drafts.js"), "utf8");
  const helperSource = script.match(/function activityTextIsFilled[\s\S]*?(?=\nfunction renderActivities\(\))/)?.[0];
  assert.ok(helperSource, "activity completeness helpers should be present");
  const isComplete = runInNewContext(`${helperSource}\nactivityRowIsComplete`);

  const activity = { tipo: "Actividad", actividad: "Revisar", descripcion: "Verificar la solicitud", responsable: "Profesional" };
  assert.equal(isComplete(activity), true);
  assert.equal(isComplete({ ...activity, responsable: " " }), false);
  assert.equal(isComplete({ ...activity, responsable: "Todos", responsableOtro: true }), false);
  assert.equal(isComplete({ ...activity, responsable: "Coordinador de área", responsableOtro: true }), true);

  const decision = { tipo: "Decisión", descripcion: "¿Cumple los criterios?", responsable: "Profesional", decisionSi: "aprobar", decisionNo: "corregir" };
  assert.equal(isComplete(decision), true);
  assert.equal(isComplete({ ...decision, decisionNo: "aprobar" }), false);
  assert.equal(isComplete({ ...decision, decisionNo: "" }), false);
  assert.equal(isComplete({ ...decision, descripcion: "" }), false);

  const connector = { tipo: "Conector", connectorId: "A", connectorDestino: "fin" };
  assert.equal(isComplete(connector), true);
  assert.equal(isComplete({ ...connector, connectorDestino: " " }), false);

  const controlled = {
    ...activity,
    tieneControl: true,
    controlResponsable: "Profesional",
    controlPeriodicidad: "Por cada solicitud",
    controlAccion: "Verifica",
    controlEjecucion: "Compara los datos",
    controlDesviacion: "Devuelve para ajuste",
    controlEvidencia: "Registro de revisión"
  };
  assert.equal(isComplete(controlled), true);
  for (const field of ["controlResponsable", "controlPeriodicidad", "controlAccion", "controlEjecucion", "controlDesviacion", "controlEvidencia"]) {
    assert.equal(isComplete({ ...controlled, [field]: " " }), false, `${field} is required`);
  }
  assert.equal(isComplete({ ...controlled, controlResponsable: "N/A", controlResponsableOtro: true }), false);
});

test("sending for evaluation reviews flow errors before opening the evaluator selector", async () => {
  const script = await readFile(join(root, "backend/public/drafts.js"), "utf8");
  const handler = script.match(/ui\.submitReviewButton\.addEventListener\("click", async \(\) => \{[\s\S]*?(?=\nui\.cancelSubmitReview)/)?.[0];
  assert.ok(handler, "submit action handler should be present");
  assert.match(handler, /request\("\/api\/procedures\/flow-review"/);
  assert.match(handler, /showFlowReview\(issues, completenessIssues\)/);
  assert.match(handler, /issue\.severity !== "warning"/);
  assert.match(handler, /blockingIssues\.length \|\| completenessIssues\.length/);
  assert.match(handler, /Corrige las fallas del flujo y los campos obligatorios antes de enviar a evaluación/);
  assert.ok(handler.indexOf("blockingIssues.length || completenessIssues.length") < handler.indexOf("/api/evaluators?processCode="),
    "flow errors should stop the flow before fetching evaluators");
});

test("preview flowchart fits the available width and keeps accessible zoom controls", async () => {
  const [script, css] = await Promise.all([
    readFile(join(root, "backend/public/drafts.js"), "utf8"),
    readFile(join(root, "backend/public/drafts.css"), "utf8")
  ]);
  const helperSource = script.match(/function previewFitScale\([\s\S]*?(?=\nfunction createPreviewDiagramControls\()/)?.[0];
  assert.ok(helperSource, "preview fit helper should be present");
  const fitScale = runInNewContext(`${helperSource}\npreviewFitScale`);
  assert.equal(fitScale(900, 1800), 0.5);
  assert.equal(fitScale(1200, 1000), 1);
  assert.equal(fitScale(0, 1000), 1);
  assert.match(script, /fitButton\.textContent = "Ajustar al ancho"/);
  assert.match(script, /zoomOut\.setAttribute\("aria-label", "Reducir el flujograma"\)/);
  assert.match(script, /zoomIn\.setAttribute\("aria-label", "Ampliar el flujograma"\)/);
  assert.match(script, /requestAnimationFrame\(fitPreviewDiagram\)/);
  assert.match(css, /\.preview-diagram-toolbar/);
  assert.match(css, /@media print\{\.preview-diagram-toolbar\{display:none!important\}\}/);
  assert.match(css, /\.preview-diagram svg\{height:auto\}/);
});

test("reference-aligned editor keeps generated codes, confirmation prompts, helps, and boundary numbering", async () => {
  const [html, script, css] = await Promise.all([
    readFile(join(root, "backend/public/drafts.html"), "utf8"),
    readFile(join(root, "backend/public/drafts.js"), "utf8"),
    readFile(join(root, "backend/public/drafts.css"), "utf8")
  ]);

  for (const id of ["draftConsecutive", "draftCode", "draftCodeStatus", "methodTooltip"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /Registre normas, lineamientos, políticas, procedimientos internos o requisitos externos que deban cumplirse durante la ejecución del procedimiento/);
  assert.match(script, /function procedureCode\(processCode, consecutive\)/);
  assert.match(script, /return `\$\{processCode\}-P-\$\{String\(number\)\.padStart\(3, "0"\)\}`/);
  assert.match(script, /function displayActivityNumber\(activity, index\)/);
  assert.match(script, /activity\?\.tipo !== "Actividad"/);
  assert.match(script, /const row = \[displayActivityNumber\(activity, index\)/);
  assert.match(script, /function confirmDeletion\(kind, value\)/);
  assert.match(script, /¿Está seguro de eliminar el registro de normatividad/);
  assert.match(script, /¿Está seguro de eliminar la actividad/);
  assert.match(script, /Esta acción no se puede deshacer/);
  assert.match(script, /function setupMethodTooltip\(\)/);
  assert.match(script, /CÓDIGO DEL PROCESO \+ P \(Procedimiento\) \+ CONSECUTIVO/);
  assert.match(script, /Nombre y número completo de la norma, resolución, decreto, acuerdo, circular, política, guía o estándar aplicable/);
  assert.match(css, /\.method-tooltip\.visible\{display:block\}/);
  assert.match(css, /\.help-tip\{/);
});
