const ids = [
  "loginView", "loginForm", "loginUsername", "loginPassword", "loginOtp", "loginMessage",
  "workspace", "sessionControls", "sessionIdentity", "logoutButton", "welcomeText",
  "passwordRequired", "draftWorkspace", "draftForm", "editorTitle", "editorStatus",
  "draftName", "processCode", "draftObjective", "draftScope", "draftDefinitions", "draftConditions", "saveDraftButton", "editorMessage",
  "newDraftButton", "addNormButton", "normsList", "emptyNorms", "addBoundaryButton", "addActivityButton", "addDecisionButton", "addConnectorButton", "activitiesList", "emptyActivities", "reviewFlowButton", "flowReviewResult", "refreshDraftsButton", "draftCount", "listMessage", "emptyDrafts",
  "draftList", "flowSection", "flowSummary", "refreshFlowButton", "flowSvg"
];
const ui = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
const csrfKey = "drafts_csrf";
const errorMessages = {
  invalid_credentials: "Nombre de usuario o contraseña incorrectos.",
  mfa_required: "El código del autenticador no coincide o ya venció.",
  mfa_not_configured: "El autenticador no está disponible. Contacta al administrador.",
  too_many_attempts: "Demasiados intentos. Espera 15 minutos.",
  unauthenticated: "La sesión terminó. Ingresa de nuevo.",
  csrf_failed: "La sesión cambió. Ingresa de nuevo.",
  password_change_required: "Cambia primero la contraseña en Cuentas.",
  forbidden: "Esta cuenta no tiene permiso para gestionar borradores.",
  invalid_draft: "Revisa el nombre del procedimiento.",
  invalid_process: "Selecciona un proceso activo.",
  draft_not_found: "El borrador ya no está disponible.",
  draft_locked: "Este procedimiento ya no se puede editar desde esta pantalla.",
  draft_conflict: "El borrador cambió en otra sesión. Vuelve a abrirlo antes de guardar.",
  processes_unavailable: "No se pudieron cargar los procesos.",
  procedure_unavailable: "No se pudo completar la operación.",
  request_too_large: "El contenido supera el tamaño permitido."
};

let csrfToken = "";
let currentDraft = null;
let currentPayload = {};
let dirty = false;
let flowReviewVersion = 0;
let normRows = [];
let activityRows = [];
const textFields = [
  ["draftObjective", "objetivo"],
  ["draftScope", "alcance"],
  ["draftDefinitions", "definiciones"],
  ["draftConditions", "condiciones"]
];
const normFields = [
  ["norma", "Norma"], ["anio", "Año"], ["descripcion", "Descripción"],
  ["articulo", "Artículo / sección"], ["entidad", "Entidad emisora"]
];
const activityFields = [
  ["actividad", "Actividad", "input"],
  ["descripcion", "Descripción", "textarea"],
  ["responsable", "Responsable", "input"],
  ["evidencia", "Registro / evidencia", "input"],
  ["sistema", "Sistema / herramienta", "input"]
];
const controlActions = ["Analiza", "Aprueba", "Autoriza", "Compara", "Comprueba", "Concilia", "Confirma", "Contrasta", "Controla", "Evalúa", "Inspecciona", "Revisa", "Supervisa", "Valida", "Verifica"];
const controlFields = [
  ["controlResponsable", "Responsable del control", "input"],
  ["controlPeriodicidad", "Periodicidad", "input"],
  ["controlEjecucion", "Ejecución del control", "textarea"],
  ["controlDesviacion", "Tratamiento de desviaciones", "textarea"],
  ["controlEvidencia", "Evidencia del control", "textarea"]
];

function markDirty() {
  dirty = true;
  flowReviewVersion += 1;
  setMessage(ui.editorMessage, "");
  ui.flowReviewResult.replaceChildren();
  ui.flowReviewResult.hidden = true;
}

function showFlowReview(issues) {
  const result = ui.flowReviewResult;
  result.replaceChildren();
  const summary = document.createElement("p");
  summary.textContent = issues.length ? `${issues.length} observación${issues.length === 1 ? "" : "es"} en el flujo.` : "Las rutas y los nodos del flujo son coherentes.";
  result.append(summary);
  if (issues.length) {
    const list = document.createElement("ul");
    for (const issue of issues) {
      const item = document.createElement("li");
      item.textContent = (Number.isInteger(issue.index) ? `Elemento ${issue.index + 1}: ` : "") + issue.message;
      list.append(item);
    }
    result.append(list);
  }
  result.hidden = false;
}

function renderNorms() {
  ui.emptyNorms.hidden = normRows.length > 0;
  ui.normsList.replaceChildren(...normRows.map((norm, index) => {
    const row = document.createElement("div");
    row.className = "norm-row";
    const heading = document.createElement("div");
    heading.className = "norm-heading";
    const title = document.createElement("h4");
    title.textContent = "Norma " + (index + 1);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary-button";
    remove.textContent = "Eliminar";
    remove.setAttribute("aria-label", "Eliminar norma " + (index + 1));
    remove.addEventListener("click", () => {
      if (!window.confirm("¿Eliminar esta norma del borrador?")) return;
      normRows.splice(index, 1);
      renderNorms();
      markDirty();
    });
    heading.append(title, remove);
    row.append(heading);

    const grid = document.createElement("div");
    grid.className = "norm-grid";
    const typeField = document.createElement("div");
    typeField.className = "field";
    const typeLabel = document.createElement("label");
    const typeInput = document.createElement("select");
    typeInput.id = "normType" + index;
    typeLabel.htmlFor = typeInput.id;
    typeLabel.textContent = "Tipo";
    for (const value of ["Externa", "Interna"]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      typeInput.append(option);
    }
    typeInput.value = norm.tipo === "Interna" ? "Interna" : "Externa";
    typeInput.addEventListener("change", () => { norm.tipo = typeInput.value; markDirty(); });
    typeField.append(typeLabel, typeInput);
    grid.append(typeField);

    for (const [key, labelText] of normFields) {
      const field = document.createElement("div");
      field.className = "field" + (key === "descripcion" ? " norm-wide" : "");
      const label = document.createElement("label");
      const input = key === "descripcion" ? document.createElement("textarea") : document.createElement("input");
      input.id = "norm" + key + index;
      input.value = typeof norm[key] === "string" ? norm[key] : "";
      input.maxLength = key === "descripcion" ? 10000 : key === "anio" ? 4 : 500;
      if (key === "anio") input.inputMode = "numeric";
      label.htmlFor = input.id;
      label.textContent = labelText;
      input.addEventListener("input", () => { norm[key] = input.value; markDirty(); });
      field.append(label, input);
      grid.append(field);
    }
    row.append(grid);
    return row;
  }));
}

function destinationField(activity, index, key, labelText) {
  const field = document.createElement("div");
  field.className = "field";
  const label = document.createElement("label");
  const select = document.createElement("select");
  select.id = key + index;
  label.htmlFor = select.id;
  label.textContent = labelText;
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecciona un destino";
  select.append(placeholder);
  for (const target of activityRows) {
    if (target === activity || target.tipo === "Inicio") continue;
    const option = document.createElement("option");
    option.value = target.uid;
    option.textContent = target.actividad || target.descripcion || target.tipo;
    select.append(option);
  }
  select.value = activity[key] || "";
  select.addEventListener("change", () => { activity[key] = select.value; markDirty(); });
  field.append(label, select);
  return field;
}

function nextConnectorId() {
  const used = new Set(activityRows.filter(activity => activity.tipo === "Conector")
    .map(activity => String(activity.connectorId || "").toUpperCase()));
  for (let code = 65; code <= 90; code += 1) {
    const letter = String.fromCharCode(code);
    if (!used.has(letter)) return letter;
  }
  let number = 1;
  while (used.has("C" + number)) number += 1;
  return "C" + number;
}

function boundaryRecord(type) {
  return { uid: crypto.randomUUID(), tipo: type, actividad: type, descripcion: "", tieneControl: false };
}

function completeBoundaries() {
  let added = false;
  if (!activityRows.some(activity => activity.tipo === "Inicio")) {
    activityRows.unshift(boundaryRecord("Inicio"));
    added = true;
  }
  if (!activityRows.some(activity => activity.tipo === "Fin")) {
    activityRows.push(boundaryRecord("Fin"));
    added = true;
  }
  renderActivities();
  if (added) markDirty();
}

function moveActivity(index, direction) {
  const target = index + direction;
  if (target < 0 || target >= activityRows.length || ["Inicio", "Fin"].includes(activityRows[index]?.tipo) || ["Inicio", "Fin"].includes(activityRows[target]?.tipo)) return;
  [activityRows[index], activityRows[target]] = [activityRows[target], activityRows[index]];
  renderActivities();
  markDirty();
  ui.activitiesList.querySelectorAll(".activity-row")[target]?.querySelector(direction < 0 ? '[data-move="up"]' : '[data-move="down"]')?.focus();
}

function renderActivities() {
  ui.emptyActivities.hidden = activityRows.length > 0;
  ui.addBoundaryButton.hidden = activityRows.some(activity => activity.tipo === "Inicio") && activityRows.some(activity => activity.tipo === "Fin");
  ui.activitiesList.replaceChildren(...activityRows.map((activity, index) => {
    const row = document.createElement("div");
    row.className = "activity-row";
    const heading = document.createElement("div");
    heading.className = "activity-heading";
    const title = document.createElement("h4");
    title.textContent = activity.tipo === "Actividad" ? "Actividad " + (index + 1)
      : activity.tipo === "Conector" ? "Conector " + String(activity.connectorId || "")
      : String(activity.tipo || "Elemento del flujo");
    heading.append(title);
    const editable = activity.tipo === "Actividad" || (["Decisión", "Conector"].includes(activity.tipo) && !activity.tieneControl);
    if (!["Inicio", "Fin"].includes(activity.tipo)) {
      const actions = document.createElement("div");
      actions.className = "activity-actions";
      for (const [direction, symbol, labelText] of [[-1, "↑", "Subir"], [1, "↓", "Bajar"]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary-button move-button";
        button.dataset.move = direction < 0 ? "up" : "down";
        button.textContent = symbol;
        button.title = labelText;
        button.setAttribute("aria-label", `${labelText} ${activity.tipo.toLowerCase()} ${index + 1}`);
        button.disabled = ["Inicio", "Fin"].includes(activityRows[index + direction]?.tipo) || index + direction < 0 || index + direction >= activityRows.length;
        button.addEventListener("click", () => moveActivity(index, direction));
        actions.append(button);
      }
      heading.append(actions);
    }
    if (editable) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary-button";
      remove.textContent = "Eliminar";
      remove.setAttribute("aria-label", "Eliminar actividad " + (index + 1));
      remove.addEventListener("click", () => {
        if (activityRows.some(other => other !== activity && [other.decisionSi, other.decisionNo, other.connectorDestino].includes(activity.uid))) {
          window.alert("Esta actividad es destino de una ruta. Cambia primero esa ruta.");
          return;
        }
        if (!window.confirm("¿Eliminar esta actividad del borrador?")) return;
        activityRows.splice(index, 1);
        renderActivities();
        markDirty();
      });
      heading.querySelector(".activity-actions")?.append(remove);
    }
    row.append(heading);
    if (["Inicio", "Fin"].includes(activity.tipo)) {
      const grid = document.createElement("div");
      grid.className = "activity-grid";
      for (const [key, labelText, kind] of [["actividad", "Nombre", "input"], ["descripcion", activity.tipo === "Inicio" ? "Evento que inicia el procedimiento" : "Resultado o condición de cierre", "textarea"]]) {
        const field = document.createElement("div");
        field.className = "field" + (key === "descripcion" ? " activity-wide" : "");
        const label = document.createElement("label");
        const input = document.createElement(kind);
        input.id = "boundary" + key + index;
        input.value = typeof activity[key] === "string" ? activity[key] : "";
        input.maxLength = kind === "textarea" ? 10000 : 500;
        label.htmlFor = input.id;
        label.textContent = labelText;
        input.addEventListener("input", () => { activity[key] = input.value; markDirty(); });
        field.append(label, input);
        grid.append(field);
      }
      row.append(grid);
      return row;
    }
    if (!editable) {
      const summary = document.createElement("p");
      summary.className = "activity-summary";
      summary.textContent = String(activity.actividad || activity.descripcion || "Sin nombre");
      row.append(summary);
      return row;
    }
    if (activity.tipo === "Conector") {
      const idField = document.createElement("div");
      idField.className = "field";
      const idLabel = document.createElement("label");
      const idInput = document.createElement("input");
      idInput.id = "connectorId" + index;
      idInput.value = String(activity.connectorId || "");
      idInput.readOnly = true;
      idLabel.htmlFor = idInput.id;
      idLabel.textContent = "Identificador";
      idField.append(idLabel, idInput);
      row.append(idField, destinationField(activity, index, "connectorDestino", "Continuar el flujo en"));
      return row;
    }
    if (activity.tipo === "Decisión") {
      const questionField = document.createElement("div");
      questionField.className = "field";
      const questionLabel = document.createElement("label");
      const question = document.createElement("textarea");
      question.id = "decisionQuestion" + index;
      questionLabel.htmlFor = question.id;
      questionLabel.textContent = "Pregunta de decisión";
      question.value = typeof activity.descripcion === "string" ? activity.descripcion : "";
      question.maxLength = 10000;
      question.addEventListener("input", () => {
        activity.descripcion = question.value;
        activity.actividad = question.value;
        markDirty();
      });
      questionField.append(questionLabel, question);
      row.append(questionField);
      const responsibleField = document.createElement("div");
      responsibleField.className = "field";
      const responsibleLabel = document.createElement("label");
      const responsible = document.createElement("input");
      responsible.id = "decisionResponsible" + index;
      responsibleLabel.htmlFor = responsible.id;
      responsibleLabel.textContent = "Responsable";
      responsible.value = typeof activity.responsable === "string" ? activity.responsable : "";
      responsible.maxLength = 500;
      responsible.addEventListener("input", () => { activity.responsable = responsible.value; markDirty(); });
      responsibleField.append(responsibleLabel, responsible);
      row.append(responsibleField);
      const routes = document.createElement("div");
      routes.className = "activity-grid";
      routes.append(destinationField(activity, index, "decisionSi", "Ruta Sí"));
      routes.append(destinationField(activity, index, "decisionNo", "Ruta No"));
      row.append(routes);
      return row;
    }
    const grid = document.createElement("div");
    grid.className = "activity-grid";
    for (const [key, labelText, kind] of activityFields) {
      const field = document.createElement("div");
      field.className = "field" + (key === "descripcion" ? " activity-wide" : "");
      const label = document.createElement("label");
      const input = document.createElement(kind);
      input.id = "activity" + key + index;
      input.value = typeof activity[key] === "string" ? activity[key] : "";
      input.maxLength = kind === "textarea" ? 10000 : 500;
      label.htmlFor = input.id;
      label.textContent = labelText;
      input.addEventListener("input", () => { activity[key] = input.value; markDirty(); });
      field.append(label, input);
      grid.append(field);
    }
    row.append(grid);
    const controlField = document.createElement("div");
    controlField.className = "field control-toggle";
    const controlLabel = document.createElement("label");
    const controlCheckbox = document.createElement("input");
    controlCheckbox.type = "checkbox";
    controlCheckbox.id = "activityControl" + index;
    controlCheckbox.checked = activity.tieneControl === true;
    controlLabel.htmlFor = controlCheckbox.id;
    controlLabel.textContent = "Punto de control";
    controlCheckbox.addEventListener("change", () => {
      activity.tieneControl = controlCheckbox.checked;
      renderActivities();
      markDirty();
    });
    controlField.append(controlCheckbox, controlLabel);
    row.append(controlField);
    if (activity.tieneControl === true) {
      const details = document.createElement("div");
      details.className = "control-details";
      const actionField = document.createElement("div");
      actionField.className = "field";
      const actionLabel = document.createElement("label");
      const actionSelect = document.createElement("select");
      actionSelect.id = "controlAction" + index;
      actionLabel.htmlFor = actionSelect.id;
      actionLabel.textContent = "Propósito del control";
      const emptyAction = document.createElement("option");
      emptyAction.value = "";
      emptyAction.textContent = "Selecciona una acción";
      actionSelect.append(emptyAction);
      const selectedAction = String(activity.controlAccion || "");
      for (const action of selectedAction && !controlActions.includes(selectedAction) ? [...controlActions, selectedAction] : controlActions) {
        const option = document.createElement("option");
        option.value = action;
        option.textContent = action;
        actionSelect.append(option);
      }
      actionSelect.value = selectedAction;
      actionSelect.addEventListener("change", () => { activity.controlAccion = actionSelect.value; markDirty(); });
      actionField.append(actionLabel, actionSelect);
      details.append(actionField);
      for (const [key, labelText, kind] of controlFields) {
        const field = document.createElement("div");
        field.className = "field" + (kind === "textarea" ? " control-wide" : "");
        const label = document.createElement("label");
        const input = document.createElement(kind);
        input.id = key + index;
        input.value = typeof activity[key] === "string" ? activity[key] : "";
        input.maxLength = kind === "textarea" ? 10000 : 500;
        label.htmlFor = input.id;
        label.textContent = labelText;
        input.addEventListener("input", () => {
          activity[key] = input.value;
          if (key === "controlResponsable") delete activity.controlResponsableOtro;
          markDirty();
        });
        field.append(label, input);
        details.append(field);
      }
      row.append(details);
    }
    return row;
  }));
  renderFlow();
}

function svgNode(tag, attributes = {}, content) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (content !== undefined) node.textContent = content;
  return node;
}

function flowLines(value, maxLength = 22) {
  const chunks = String(value || "").match(/\S+|\s+/g) || [];
  const lines = [];
  let line = "";
  for (let chunk of chunks) {
    if (!chunk.trim()) continue;
    if (line && (line + " " + chunk).length > maxLength) { lines.push(line); line = ""; }
    while (chunk.length > maxLength) {
      if (line) { lines.push(line); line = ""; }
      lines.push(chunk.slice(0, maxLength));
      chunk = chunk.slice(maxLength);
    }
    line = line ? line + " " + chunk : chunk;
  }
  if (line) lines.push(line);
  if (lines.length > 2) return [lines[0], lines[1].slice(0, maxLength - 1) + "…"];
  return lines.length ? lines : ["Sin nombre"];
}

function renderFlow() {
  const svg = ui.flowSvg;
  svg.replaceChildren();
  ui.flowSection.hidden = activityRows.length === 0;
  if (!activityRows.length) return;

  const roles = [...new Set(activityRows.filter(item => !["Inicio", "Fin", "Conector"].includes(item.tipo))
    .flatMap(item => {
      const names = String(item.responsable || "").split(";").map(role => role.trim()).filter(Boolean);
      return names.length ? names : ["Sin responsable"];
    }))];
  if (!roles.length) roles.push("Sin responsable");
  const laneWidth = 260;
  const width = Math.max(760, roles.length * laneWidth + 160);
  const height = 150 + activityRows.length * 132;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  ui.flowSummary.textContent = `${activityRows.length} elementos · ${roles.length} responsable${roles.length === 1 ? "" : "s"}`;
  const title = svgNode("title", {}, "Flujograma del borrador abierto");
  const defs = svgNode("defs");
  for (const [id, color] of [["flowArrow", "#607b84"], ["flowYes", "#168064"], ["flowNo", "#bd5140"]]) {
    const marker = svgNode("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, orient: "auto-start-reverse" });
    marker.append(svgNode("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color }));
    defs.append(marker);
  }
  svg.append(title, defs);
  for (const [index, role] of roles.entries()) {
    const x = 80 + index * laneWidth;
    svg.append(svgNode("rect", { x, y: 0, width: laneWidth, height, class: `flow-lane${index % 2 ? " alt" : ""}` }));
    svg.append(svgNode("rect", { x, y: 0, width: laneWidth, height: 68, class: "flow-lane-header" }));
    const label = svgNode("text", { x: x + laneWidth / 2, y: 31, "text-anchor": "middle", fill: "#fff", "font-size": 13, "font-weight": 700 }, flowLines(role, 28)[0]);
    label.append(svgNode("title", {}, role));
    svg.append(label);
  }

  const positions = new Map(activityRows.map((item, index) => {
    const itemRoles = String(item.responsable || "").split(";").map(role => role.trim()).filter(Boolean);
    if (!itemRoles.length) itemRoles.push("Sin responsable");
    const lanes = itemRoles.map(role => roles.indexOf(role)).filter(lane => lane >= 0);
    const center = ["Inicio", "Fin", "Conector"].includes(item.tipo) ? width / 2
      : lanes.length ? 80 + (Math.min(...lanes) + Math.max(...lanes) + 1) * laneWidth / 2 : 80 + laneWidth / 2;
    return [item.uid, { x: center, y: 118 + index * 132, index, item }];
  }));

  for (const [index, item] of activityRows.entries()) {
    const source = positions.get(item.uid);
    if (!source) continue;
    const links = item.tipo === "Decisión" ? [[item.decisionSi, "Sí"], [item.decisionNo, "No"]]
      : item.tipo === "Conector" ? [[item.connectorDestino, ""]]
      : item.tipo === "Fin" ? [] : [[activityRows[index + 1]?.uid, ""]];
    for (const [id, label] of links) {
      const target = positions.get(id);
      if (!target) continue;
      const branch = label === "Sí" ? "yes" : label === "No" ? "no" : item.tipo === "Conector" ? "connector" : "";
      const outer = label || item.tipo === "Conector" || target.index <= index || target.index > index + 1;
      const side = label === "No" || target.index <= index ? -1 : 1;
      let points;
      if (outer) {
        const fromX = source.x + side * (item.tipo === "Conector" ? 27 : item.tipo === "Decisión" ? 77 : 102);
        const toX = target.x + side * (target.item.tipo === "Conector" ? 28 : 104);
        const rail = side < 0 ? 35 : width - 35;
        points = `${fromX},${source.y} ${rail},${source.y} ${rail},${target.y} ${toX},${target.y}`;
      } else {
        const mid = (source.y + target.y) / 2;
        points = `${source.x},${source.y + 42} ${source.x},${mid} ${target.x},${mid} ${target.x},${target.y - 46}`;
      }
      const edge = svgNode("polyline", { points, class: `flow-edge ${branch}`, "marker-end": `url(#${label === "Sí" ? "flowYes" : label === "No" ? "flowNo" : "flowArrow"})` });
      edge.append(svgNode("title", {}, `${item.actividad || item.tipo} → ${target.item.actividad || target.item.tipo}${label ? ` (${label})` : ""}`));
      svg.append(edge);
      if (label) svg.append(svgNode("text", { x: source.x + side * 91, y: source.y - 9, class: `flow-route-label ${branch}`, "text-anchor": "middle" }, label));
    }
  }

  for (const item of activityRows) {
    const position = positions.get(item.uid);
    if (!position) continue;
    const { x, y } = position;
    const group = svgNode("g");
    group.append(svgNode("title", {}, `${item.tipo}: ${item.actividad || item.descripcion || "Sin nombre"}${item.responsable ? ` · ${item.responsable}` : ""}`));
    if (item.tipo === "Decisión") group.append(svgNode("polygon", { points: `${x},${y - 44} ${x + 77},${y} ${x},${y + 44} ${x - 77},${y}`, class: "flow-node decision" }));
    else if (item.tipo === "Conector") group.append(svgNode("circle", { cx: x, cy: y, r: 27, class: "flow-node connector" }));
    else group.append(svgNode("rect", { x: x - 102, y: y - 42, width: 204, height: 84, rx: ["Inicio", "Fin"].includes(item.tipo) ? 28 : 5, class: `flow-node${["Inicio", "Fin"].includes(item.tipo) ? " boundary" : ""}${item.tieneControl ? " control" : ""}` }));
    const textValue = item.tipo === "Conector" ? String(item.connectorId || "?") : item.tipo === "Decisión" ? String(item.descripcion || item.actividad || "Decisión") : String(item.actividad || item.tipo);
    const lines = flowLines(textValue, item.tipo === "Decisión" ? 15 : 24);
    lines.forEach((line, lineIndex) => group.append(svgNode("text", { x, y: y + (lineIndex - (lines.length - 1) / 2) * 17 + 5, class: "flow-text", "text-anchor": "middle" }, line)));
    if (item.tieneControl) group.append(svgNode("text", { x, y: y + 32, class: "flow-note", "text-anchor": "middle" }, "CONTROL"));
    svg.append(group);
  }
}

function setMessage(node, text, success = false) {
  node.textContent = text;
  node.classList.toggle("success", success);
  node.hidden = !text;
}

function errorText(error) {
  return errorMessages[error.code] || (error.status === 503
    ? "El servicio no está disponible. Inténtalo de nuevo."
    : "No se pudo completar la operación.");
}

async function request(path, { method = "GET", body, csrf = false } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (csrf) headers["X-CSRF-Token"] = csrfToken;

  const response = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    cache: "no-store",
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || "request_failed");
    error.code = result.error;
    error.status = response.status;
    throw error;
  }
  return result;
}

function clearSession() {
  flowReviewVersion += 1;
  csrfToken = "";
  sessionStorage.removeItem(csrfKey);
  currentDraft = null;
  currentPayload = {};
  normRows = [];
  renderNorms();
  activityRows = [];
  renderActivities();
  dirty = false;
  ui.workspace.hidden = true;
  ui.sessionControls.hidden = true;
  ui.loginView.hidden = false;
  ui.loginPassword.value = "";
  ui.loginOtp.value = "";
  ui.draftForm.reset();
  ui.flowReviewResult.replaceChildren();
  ui.flowReviewResult.hidden = true;
  setMessage(ui.loginMessage, "");
}

async function startSession(user) {
  ui.loginView.hidden = true;
  ui.workspace.hidden = false;
  ui.sessionControls.hidden = false;
  ui.sessionIdentity.textContent = user.username || user.displayName;
  ui.welcomeText.textContent = user.displayName + " · " + user.role;
  ui.passwordRequired.hidden = !user.mustChangePassword;

  if (user.mustChangePassword) {
    ui.draftWorkspace.hidden = true;
    return;
  }
  if (!["elaborador", "administrador"].includes(user.role)) {
    ui.draftWorkspace.hidden = true;
    setMessage(ui.listMessage, errorMessages.forbidden);
    return;
  }

  ui.draftWorkspace.hidden = false;
  await Promise.all([loadProcesses(), loadDrafts()]);
}

function handleRequestError(error, node) {
  if (["unauthenticated", "csrf_failed", "password_change_required"].includes(error.code)) {
    clearSession();
    setMessage(ui.loginMessage, errorText(error));
    return;
  }
  setMessage(node, errorText(error));
}

async function loadProcesses() {
  try {
    const { processes } = await request("/api/processes");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Selecciona un proceso";
    const options = processes.map(process => {
      const option = document.createElement("option");
      option.value = process.code;
      option.textContent = process.name + " (" + process.code + ")";
      return option;
    });
    ui.processCode.replaceChildren(placeholder, ...options);
    ui.processCode.disabled = Boolean(currentDraft);
  } catch (error) {
    handleRequestError(error, ui.editorMessage);
  }
}

async function loadDrafts() {
  try {
    const { procedures } = await request("/api/procedures");
    renderDrafts(procedures);
  } catch (error) {
    handleRequestError(error, ui.listMessage);
  }
}

function renderDrafts(drafts) {
  ui.draftCount.textContent = drafts.length + " procedimiento" + (drafts.length === 1 ? "" : "s");
  ui.emptyDrafts.hidden = drafts.length > 0;
  ui.draftList.replaceChildren(...drafts.map(draft => {
    const item = document.createElement("li");
    item.className = "draft-item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "draft-open";

    const info = document.createElement("span");
    info.className = "draft-info";
    const name = document.createElement("strong");
    name.textContent = draft.name;
    const details = document.createElement("small");
    const updatedAt = new Date(draft.updatedAt);
    const date = Number.isNaN(updatedAt.valueOf()) ? "" : updatedAt.toLocaleString("es-CO");
    details.textContent = draft.processCode + (date ? " · " + date : "");

    const status = document.createElement("span");
    status.className = "draft-status";
    status.textContent = draft.status;

    info.append(name, details);
    button.append(info, status);
    button.addEventListener("click", () => openDraft(draft.id));
    item.append(button);
    return item;
  }));
}

async function openDraft(id) {
  if (dirty && !window.confirm("Hay cambios sin guardar. ¿Descartarlos y abrir este procedimiento?")) return;
  setMessage(ui.listMessage, "");

  try {
    const { procedure } = await request("/api/procedures/" + encodeURIComponent(id));
    flowReviewVersion += 1;
    currentDraft = procedure;
    currentPayload = procedure.payload && typeof procedure.payload === "object" && !Array.isArray(procedure.payload)
      ? procedure.payload
      : {};
    normRows = Array.isArray(currentPayload.norms)
      ? currentPayload.norms.map(norm => norm && typeof norm === "object" && !Array.isArray(norm) ? { ...norm } : {})
      : [];
    renderNorms();
    activityRows = Array.isArray(currentPayload.activities)
      ? currentPayload.activities.map(activity => activity && typeof activity === "object" && !Array.isArray(activity) ? { ...activity, uid: activity.uid || crypto.randomUUID() } : { uid: crypto.randomUUID() })
      : [];
    renderActivities();
    ui.draftName.value = procedure.name;
    for (const [inputId, fieldId] of textFields) {
      ui[inputId].value = typeof currentPayload.fields?.[fieldId] === "string"
        ? currentPayload.fields[fieldId]
        : "";
    }
    ui.processCode.value = procedure.processCode;
    ui.processCode.disabled = true;
    ui.editorTitle.textContent = "Editar borrador";
    ui.editorStatus.textContent = procedure.status + " · revisión " + procedure.revision;
    ui.saveDraftButton.textContent = "Guardar cambios";
    dirty = false;
    setMessage(ui.editorMessage, "");
    ui.flowReviewResult.hidden = true;
    ui.flowReviewResult.replaceChildren();
    ui.draftName.focus();
  } catch (error) {
    handleRequestError(error, ui.listMessage);
  }
}

function newDraft() {
  if (dirty && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
  flowReviewVersion += 1;
  currentDraft = null;
  currentPayload = { fields: {}, norms: [], activities: [], annexes: [], changes: [], settings: {} };
  normRows = [];
  renderNorms();
  activityRows = [boundaryRecord("Inicio"), boundaryRecord("Fin")];
  renderActivities();
  ui.draftForm.reset();
  ui.processCode.disabled = false;
  ui.editorTitle.textContent = "Nuevo borrador";
  ui.editorStatus.textContent = "Borrador no guardado";
  ui.saveDraftButton.textContent = "Guardar borrador";
  dirty = false;
  setMessage(ui.editorMessage, "");
  ui.flowReviewResult.hidden = true;
  ui.flowReviewResult.replaceChildren();
  ui.draftName.focus();
}

ui.loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  setMessage(ui.loginMessage, "");
  const button = ui.loginForm.querySelector('button[type="submit"]');
  button.disabled = true;

  try {
    const result = await request("/api/auth/login", {
      method: "POST",
      body: {
        username: ui.loginUsername.value.trim(),
        password: ui.loginPassword.value,
        otp: ui.loginOtp.value.trim()
      }
    });
    csrfToken = result.csrfToken;
    sessionStorage.setItem(csrfKey, csrfToken);
    ui.loginPassword.value = "";
    ui.loginOtp.value = "";
    await startSession(result.user);
  } catch (error) {
    setMessage(ui.loginMessage, errorText(error));
    ui.loginOtp.value = "";
  } finally {
    button.disabled = false;
  }
});

ui.draftForm.addEventListener("input", markDirty);
ui.draftForm.addEventListener("change", markDirty);
ui.addNormButton.addEventListener("click", () => {
  normRows.push({ tipo: "Externa", norma: "", anio: "", descripcion: "", articulo: "", entidad: "" });
  renderNorms();
  markDirty();
  ui.normsList.lastElementChild?.querySelector("input")?.focus();
});
function addFlowItem(record) {
  const endIndex = activityRows.findIndex(activity => activity.tipo === "Fin");
  activityRows.splice(endIndex < 0 ? activityRows.length : endIndex, 0, record);
  renderActivities();
  markDirty();
  ui.activitiesList.querySelectorAll(".activity-row")[endIndex < 0 ? activityRows.length - 1 : endIndex]?.querySelector("input,textarea")?.focus();
}
ui.addActivityButton.addEventListener("click", () => addFlowItem({
  uid: crypto.randomUUID(), tipo: "Actividad", n: activityRows.filter(activity => activity.tipo === "Actividad").length + 1,
  actividad: "", descripcion: "", responsable: "", evidencia: "", sistema: "", tieneControl: false
}));
ui.addDecisionButton.addEventListener("click", () => addFlowItem({
  uid: crypto.randomUUID(), tipo: "Decisión", actividad: "", descripcion: "", responsable: "",
  decisionSi: "", decisionNo: "", tieneControl: false
}));
ui.addBoundaryButton.addEventListener("click", completeBoundaries);
ui.addConnectorButton.addEventListener("click", () => {
  const connectorId = nextConnectorId();
  addFlowItem({
    uid: crypto.randomUUID(), tipo: "Conector", connectorId, actividad: "Conector " + connectorId,
    descripcion: "", connectorDestino: "", tieneControl: false
  });
});

ui.reviewFlowButton.addEventListener("click", async () => {
  const button = ui.reviewFlowButton;
  const version = flowReviewVersion;
  button.disabled = true;
  try {
    const { issues } = await request("/api/procedures/flow-review", {
      method: "POST", csrf: true,
      body: { activities: activityRows.map(activity => ({ ...activity })) }
    });
    if (version === flowReviewVersion) showFlowReview(issues);
  } catch (error) {
    if (version === flowReviewVersion) showFlowReview([{ index: null, message: errorText(error) }]);
  } finally {
    button.disabled = false;
  }
});

ui.draftForm.addEventListener("submit", async event => {
  event.preventDefault();
  setMessage(ui.editorMessage, "");
  const button = ui.saveDraftButton;
  button.disabled = true;

  const name = ui.draftName.value.trim();
  const fields = currentPayload.fields && typeof currentPayload.fields === "object" && !Array.isArray(currentPayload.fields)
    ? currentPayload.fields
    : {};
  const updatedFields = { ...fields, nombre: name };
  for (const [inputId, fieldId] of textFields) updatedFields[fieldId] = ui[inputId].value;
  const payload = {
    ...currentPayload,
    fields: updatedFields,
    norms: normRows.map(norm => ({ ...norm })),
    activities: activityRows.map(activity => ({ ...activity }))
  };
  const body = { name, processCode: ui.processCode.value, payload };

  try {
    const result = currentDraft
      ? await request("/api/procedures/" + encodeURIComponent(currentDraft.id), {
          method: "PUT",
          body: { name, payload, revision: currentDraft.revision },
          csrf: true
        })
      : await request("/api/procedures", { method: "POST", body, csrf: true });

    currentDraft = result.procedure;
    currentPayload = result.procedure.payload;
    normRows = Array.isArray(currentPayload.norms) ? currentPayload.norms.map(norm => ({ ...norm })) : [];
    activityRows = Array.isArray(currentPayload.activities) ? currentPayload.activities.map(activity => ({ ...activity })) : [];
    renderFlow();
    ui.processCode.value = currentDraft.processCode;
    ui.processCode.disabled = true;
    ui.editorTitle.textContent = "Editar borrador";
    ui.editorStatus.textContent = currentDraft.status + " · revisión " + currentDraft.revision;
    ui.saveDraftButton.textContent = "Guardar cambios";
    dirty = false;
    setMessage(ui.editorMessage, "Borrador guardado.", true);
    await loadDrafts();
  } catch (error) {
    handleRequestError(error, ui.editorMessage);
  } finally {
    button.disabled = false;
  }
});

ui.newDraftButton.addEventListener("click", newDraft);
ui.refreshDraftsButton.addEventListener("click", loadDrafts);
ui.refreshFlowButton.addEventListener("click", renderFlow);
ui.logoutButton.addEventListener("click", async () => {
  ui.logoutButton.disabled = true;
  try {
    await request("/api/auth/logout", { method: "POST", csrf: true });
    clearSession();
  } catch (error) {
    handleRequestError(error, ui.listMessage);
  } finally {
    ui.logoutButton.disabled = false;
  }
});

csrfToken = sessionStorage.getItem(csrfKey) || "";
if (csrfToken) request("/api/auth/me").then(({ user }) => startSession(user)).catch(clearSession);
