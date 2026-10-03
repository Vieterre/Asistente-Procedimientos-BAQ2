const ids = [
  "loginView", "loginForm", "loginUsername", "loginPassword", "loginOtp", "loginMessage",
  "workspace", "sessionControls", "sessionIdentity", "notificationCenter", "notificationBell", "notificationPopover", "notificationCount", "emptyNotifications", "notificationList", "markAllNotificationsRead", "logoutButton", "welcomeText",
  "pageHeading", "analyticsButton", "analyticsSection", "backFromAnalytics", "refreshAnalytics", "analyticsFilters", "analyticsPeriod", "analyticsProcess", "analyticsRole", "analyticsMessage", "analyticsMetrics", "analyticsByDay", "analyticsByProcess", "emptyAnalyticsDays", "emptyAnalyticsProcesses",
  "passwordRequired", "draftWorkspace", "draftForm", "editorTitle", "editorStatus", "submitReviewButton", "submitReviewDialog", "submitReviewForm", "reviewEvaluatorSelect", "submitReviewMessage", "cancelSubmitReview", "confirmSubmitReview",
  "evaluatorInbox", "evaluatorDraftCount", "evaluatorInboxMessage", "emptyEvaluatorInbox", "evaluatorDraftList", "refreshEvaluatorInbox", "evaluatorDetail", "evaluatorDetailTitle", "evaluatorDetailStatus", "backToEvaluatorInbox", "startEvaluationButton",
  "draftName", "processCode", "draftObjective", "draftScope", "draftDefinitions", "draftConditions", "saveDraftButton", "editorMessage",
  "newDraftButton", "addNormButton", "normsList", "emptyNorms", "addBoundaryButton", "addActivityButton", "addDecisionButton", "addConnectorButton", "activitiesList", "emptyActivities", "reviewFlowButton", "flowReviewResult", "refreshDraftsButton", "draftCount", "listMessage", "emptyDrafts",
  "draftList", "flowSection", "flowSummary", "showFlowEvidence", "refreshFlowButton", "flowCanvas", "flowSvg",
  "zoomOutButton", "zoomInButton", "fitFlowButton", "resetFlowZoomButton", "flowZoomValue",
  "documentsSection", "annexApplicability", "addAnnexButton", "annexNotApplicableMessage", "emptyAnnexes", "annexesList",
  "addChangeButton", "emptyChanges", "changesList", "draftPreparedBy", "draftPreparedName", "draftReviewedBy", "draftReviewedName",
  "draftApprovedBy", "draftApprovedName", "roleSeparationMessage", "saveDocumentsButton", "documentsMessage",
  "previewButton", "previewDialog", "previewState", "previewContent", "printPreviewButton", "closePreviewButton"
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
  request_too_large: "El contenido supera el tamaño permitido.",
  submission_incomplete: "Completa los requisitos pendientes antes de enviar.",
  evaluator_unavailable: "No hay un Evaluador activo asignado a este proceso. Contacta al administrador.",
  invalid_revision: "El borrador cambió. Actualízalo y vuelve a intentar.",
  notification_not_found: "La notificación ya no está disponible. Actualiza la lista.",
  invalid_analytics_period: "Selecciona un periodo válido.",
  invalid_analytics_process: "Selecciona un proceso válido.",
  invalid_analytics_role: "Selecciona un rol válido."
};

let csrfToken = "";
let currentDraft = null;
let currentUserRole = "";
let currentPayload = {};
let dirty = false;
let flowReviewVersion = 0;
let flowZoom = 100;
let notificationTimer = null;
let flowIntrinsicWidth = 760;
let flowIntrinsicHeight = 500;
let normRows = [];
let activityRows = [];
let annexRows = [];
let changeRows = [];
let annexesNotApplicable = false;
let processNames = new Map();
const processGroupDefinitions = [
  { label: "MACROPROCESOS – PROCESOS MISIONALES · DESARROLLO ECONÓMICO", codes: ["PD", "GT"] },
  { label: "MACROPROCESOS – PROCESOS ESTRATÉGICOS", codes: ["DE", "GC", "TIC", "GF"] },
  { label: "MACROPROCESOS – PROCESOS DE APOYO", codes: ["GCT", "GI", "GD", "GH", "GJ"] },
  { label: "MACROPROCESOS – PROCESOS DE EVALUACIÓN", codes: ["EI", "GDI"] }
];
const textFields = [
  ["draftObjective", "objetivo"],
  ["draftScope", "alcance"],
  ["draftDefinitions", "definiciones"],
  ["draftConditions", "condiciones"],
  ["draftPreparedBy", "elaboro"], ["draftPreparedName", "elaboroNombre"],
  ["draftReviewedBy", "reviso"], ["draftReviewedName", "revisoNombre"],
  ["draftApprovedBy", "aprobo"], ["draftApprovedName", "aproboNombre"]
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
const annexTypes = ["Formato", "Instructivo", "Manual", "Guía", "Guía técnica", "Matriz", "Base de datos", "Documento relacionado", "Otro"];
const helpById = {
  draftName: "Use un verbo de acción específico y verificable, un objeto y un complemento cuando sea necesario. Evite un nombre demasiado largo.",
  processCode: "Seleccione el proceso organizacional al que pertenece el procedimiento.",
  draftObjective: "Explique para qué existe el procedimiento y qué resultado pretende lograr.",
  draftScope: "Indique dónde inicia y finaliza; precise áreas, usuarios, límites o exclusiones.",
  draftDefinitions: "Registre términos y siglas en orden alfabético. Escriba cada término seguido de dos puntos y su definición.",
  draftConditions: "Registre reglas o restricciones que aplican a todo el procedimiento y no a una actividad específica.",
  annexApplicability: "Elija No aplica solo si este procedimiento no utiliza documentos anexos. Cambiar a No aplica elimina las filas de anexos tras confirmación.",
  draftPreparedBy: "Cargo que prepara o actualiza técnicamente el procedimiento. Debe ser distinto de quien revisa y aprueba.",
  draftReviewedBy: "Cargo que verifica coherencia, suficiencia y cumplimiento. Debe ser distinto de quien elabora y aprueba.",
  draftApprovedBy: "Cargo directivo que autoriza formalmente la versión.",
  draftPreparedName: "Nombre de la persona que elaboró, si ya se conoce.",
  draftReviewedName: "Nombre de la persona que revisó, si ya se conoce.",
  draftApprovedName: "Nombre de la persona que aprobó, si ya se conoce."
};
const normHelp = {
  "Tipo": "Interna si procede de la organización; Externa si proviene de otra autoridad u organismo.",
  "Norma": "Escriba el nombre y número completo de la norma, resolución, política o guía aplicable.",
  "Año": "Año de expedición o de la versión vigente.",
  "Descripción": "Resuma el objeto o asunto regulado por la norma.",
  "Artículo / sección": "Indique el artículo, numeral o sección que sustenta este procedimiento.",
  "Entidad emisora": "Autoridad, entidad o dependencia que expide la norma."
};
const activityHelp = {
  "Nombre": "Para Inicio registre un nombre breve; para Fin, el nombre del resultado o cierre.",
  "Evento que inicia el procedimiento": "Describa el hecho o condición que activa el procedimiento.",
  "Resultado o condición de cierre": "Describa el producto o condición con la que termina el procedimiento.",
  "Actividad": "Use un nombre corto y concreto para la acción o tarea.",
  "Descripción": "Describa qué se hace, cómo se hace y el resultado esperado.",
  "Responsable": "Cargo o rol que ejecuta la actividad; se utilizará para el carril del flujograma.",
  "Registro / evidencia": "Soporte opcional de la ejecución: correo, formato, acta o registro de sistema.",
  "Sistema / herramienta": "Aplicativo, archivo o medio utilizado para ejecutar la actividad.",
  "Pregunta de decisión": "Plantee una condición concreta que pueda responderse Sí o No.",
  "Punto de control": "Marque esta opción solo si la actividad incorpora una verificación crítica frente a un riesgo o requisito.",
  "Ruta Sí": "Seleccione la actividad o destino cuando la condición se cumple.",
  "Ruta No": "Si se repite un control, dirija primero esta ruta a una actividad que corrija o complemente la información.",
  "Identificador": "Código corto y único para reconocer el conector.",
  "Continuar el flujo en": "Seleccione el elemento donde continúa el flujo después del conector.",
  "Propósito del control": "El verbo orienta la acción, pero por sí solo no convierte la actividad en un punto de control.",
  "Responsable del control": "Rol que ejecuta o verifica el control; puede coincidir con el responsable de la actividad.",
  "Periodicidad": "Frecuencia del control: por trámite, diariamente, mensualmente, por auditoría, etc.",
  "Ejecución del control": "Explique qué se revisa, contra qué criterio y cómo se realiza la verificación.",
  "Tratamiento de desviaciones": "Indique qué ocurre ante un incumplimiento: devolver, corregir, escalar o solicitar ajustes.",
  "Evidencia del control": "Soporte que demuestra la ejecución del control: firma, correo, acta o registro."
};
const annexHelp = {
  "Documento": "Nombre completo del documento que complementa o soporta el procedimiento.",
  "Tipo": "Elija la tipología adecuada; Matriz organiza datos tabulares y Guía técnica orienta una labor especializada.",
  "Código / referencia": "Código, enlace interno, número de formato o referencia que identifica el documento.",
  "Observación": "Explique para qué se utiliza este documento dentro del procedimiento."
};
const changeHelp = {
  "Versión": "Número de la versión registrada. Una modificación menor avanza al decimal; una mayor, al siguiente entero.",
  "Fecha": "Fecha de aprobación o actualización de esta versión, entre el 1 de enero de 2024 y hoy.",
  "Razón de la actualización": "Describa concretamente qué cambió y por qué se actualizó el procedimiento."
};

function installMethodHelps(root) {
  for (const label of root.querySelectorAll("label[for]")) {
    if (label.nextElementSibling?.classList.contains("method-help")) continue;
    const text = label.closest(".norm-row") ? normHelp[label.textContent.trim()]
      : label.closest(".activity-row") ? activityHelp[label.textContent.trim()]
      : label.closest(".annex-row") ? annexHelp[label.textContent.trim()]
      : label.closest(".change-row") ? changeHelp[label.textContent.trim()]
      : helpById[label.htmlFor];
    if (!text) continue;
    const details = document.createElement("details");
    details.className = "method-help";
    const summary = document.createElement("summary");
    summary.textContent = "i";
    summary.title = "Ayuda metodológica";
    summary.setAttribute("aria-label", `Ayuda para ${label.textContent.trim()}`);
    const explanation = document.createElement("p");
    explanation.textContent = text;
    details.append(summary, explanation);
    label.classList.add("method-label");
    label.after(details);
  }
}

function showRoleSeparation() {
  const roles = [ui.draftPreparedBy, ui.draftReviewedBy, ui.draftApprovedBy].map(input => input.value.trim().toLocaleLowerCase("es-CO")).filter(Boolean);
  const repeated = roles.length > new Set(roles).size;
  setMessage(ui.roleSeparationMessage, repeated ? "Elaboró, Revisó y Aprobó deben corresponder a cargos distintos." : "");
}

function markDirty() {
  dirty = true;
  flowReviewVersion += 1;
  setMessage(ui.editorMessage, "");
  ui.flowReviewResult.replaceChildren();
  ui.flowReviewResult.hidden = true;
}

function showFlowReview(issues, completenessIssues = []) {
  const result = ui.flowReviewResult;
  result.replaceChildren();
  const errors = issues.filter(issue => issue.severity !== "warning");
  const warnings = issues.filter(issue => issue.severity === "warning");
  const summary = document.createElement("p");
  summary.textContent = errors.length
    ? `${errors.length} observación${errors.length === 1 ? "" : "es"} por corregir en el flujo.${warnings.length ? ` ${warnings.length} aviso${warnings.length === 1 ? "" : "s"} adicional${warnings.length === 1 ? "" : "es"}.` : ""}`
    : `Las rutas y los nodos del flujo son coherentes.${warnings.length ? ` ${warnings.length} aviso${warnings.length === 1 ? "" : "s"} para revisar.` : ""}`;
  result.append(summary);
  if (issues.length) {
    const list = document.createElement("ul");
    for (const issue of issues) {
      const item = document.createElement("li");
      item.textContent = (issue.severity === "warning" ? "Aviso: " : "") + (Number.isInteger(issue.index) ? `Elemento ${issue.index + 1}: ` : "") + issue.message;
      list.append(item);
    }
    result.append(list);
  }
  if (completenessIssues.length) {
    const heading = document.createElement("p");
    heading.textContent = `${completenessIssues.length} campo${completenessIssues.length === 1 ? "" : "s"} por completar antes de publicar:`;
    result.append(heading);
    const list = document.createElement("ul");
    for (const issue of completenessIssues) {
      const item = document.createElement("li");
      item.textContent = `Elemento ${issue.index + 1}: ${issue.message}`;
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
  installMethodHelps(ui.normsList);
}

function todayLocal() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function recordField(record, index, section, key, labelText, kind = "input", options = []) {
  const field = document.createElement("div");
  field.className = "field" + (["observacion", "razon"].includes(key) ? " record-wide" : "");
  const label = document.createElement("label");
  const input = document.createElement(kind === "textarea" ? "textarea" : kind === "select" ? "select" : "input");
  input.id = `${section}${key}${index}`;
  label.htmlFor = input.id;
  label.textContent = labelText;
  if (kind === "select") {
    const values = options.includes(record[key]) ? options : record[key] ? [...options, record[key]] : ["", ...options];
    for (const value of values) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value || "Selecciona un tipo";
      input.append(option);
    }
  } else if (kind === "date") {
    input.type = "date";
    input.min = "2024-01-01";
    input.max = todayLocal();
  } else {
    input.maxLength = kind === "textarea" ? 10000 : 500;
  }
  input.value = typeof record[key] === "string" ? record[key] : "";
  input.addEventListener(kind === "select" || kind === "date" ? "change" : "input", () => {
    if (kind === "date" && input.value) {
      const corrected = input.value < input.min ? input.min : input.value > input.max ? input.max : input.value;
      if (corrected !== input.value) {
        input.value = corrected;
        setMessage(ui.documentsMessage, "La fecha se ajustó al rango permitido: desde 2024 hasta hoy.");
      }
    }
    record[key] = input.value;
    markDirty();
  });
  field.append(label, input);
  return field;
}

function renderAnnexes() {
  ui.annexApplicability.value = annexesNotApplicable ? "no_aplica" : "aplica";
  ui.addAnnexButton.disabled = annexesNotApplicable;
  ui.annexNotApplicableMessage.hidden = !annexesNotApplicable;
  ui.emptyAnnexes.hidden = annexesNotApplicable || annexRows.length > 0;
  ui.annexesList.hidden = annexesNotApplicable;
  ui.annexesList.replaceChildren(...annexRows.map((annex, index) => {
    const row = document.createElement("div");
    row.className = "record-row annex-row";
    const heading = document.createElement("div");
    heading.className = "section-heading";
    const title = document.createElement("h4");
    title.textContent = "Anexo " + (index + 1);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary-button";
    remove.textContent = "Eliminar";
    remove.setAttribute("aria-label", "Eliminar anexo " + (index + 1));
    remove.addEventListener("click", () => {
      if (!window.confirm("¿Eliminar este anexo del borrador?")) return;
      annexRows.splice(index, 1);
      renderAnnexes();
      markDirty();
    });
    heading.append(title, remove);
    const grid = document.createElement("div");
    grid.className = "record-grid";
    for (const [key, label, kind] of [["documento", "Documento", "input"], ["tipo", "Tipo", "select"], ["codigo", "Código / referencia", "input"], ["observacion", "Observación", "textarea"]]) {
      grid.append(recordField(annex, index, "annex", key, label, kind, kind === "select" ? annexTypes : []));
    }
    row.append(heading, grid);
    return row;
  }));
  installMethodHelps(ui.annexesList);
}

function renderChanges() {
  ui.emptyChanges.hidden = changeRows.length > 0;
  ui.changesList.replaceChildren(...changeRows.map((change, index) => {
    const row = document.createElement("div");
    row.className = "record-row change-row";
    const heading = document.createElement("div");
    heading.className = "section-heading";
    const title = document.createElement("h4");
    title.textContent = "Cambio " + (index + 1);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary-button";
    remove.textContent = "Eliminar";
    remove.setAttribute("aria-label", "Eliminar cambio " + (index + 1));
    remove.addEventListener("click", () => {
      if (!window.confirm("¿Eliminar este cambio del borrador?")) return;
      changeRows.splice(index, 1);
      renderChanges();
      markDirty();
    });
    heading.append(title, remove);
    const grid = document.createElement("div");
    grid.className = "record-grid";
    for (const [key, label, kind] of [["version", "Versión", "input"], ["fecha", "Fecha", "date"], ["razon", "Razón de la actualización", "textarea"]]) {
      grid.append(recordField(change, index, "change", key, label, kind));
    }
    row.append(heading, grid);
    return row;
  }));
  installMethodHelps(ui.changesList);
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
  installMethodHelps(ui.activitiesList);
  renderFlow();
}

function svgNode(tag, attributes = {}, content) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (content !== undefined) node.textContent = content;
  return node;
}

function setFlowZoom(value) {
  flowZoom = Math.max(35, Math.min(180, Math.round(Number(value) || 100)));
  ui.flowSvg.style.width = Math.round(flowIntrinsicWidth * flowZoom / 100) + "px";
  ui.flowSvg.style.height = Math.round(flowIntrinsicHeight * flowZoom / 100) + "px";
  ui.flowZoomValue.textContent = flowZoom + "%";
  ui.zoomOutButton.disabled = flowZoom <= 35;
  ui.zoomInButton.disabled = flowZoom >= 180;
}

function fitFlow() {
  const available = Math.max(320, ui.flowCanvas.clientWidth - 32);
  setFlowZoom(Math.min(100, Math.floor(available / flowIntrinsicWidth * 100)));
  ui.flowCanvas.scrollTo({ left: 0, top: 0, behavior: "smooth" });
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
  const showEvidence = ui.showFlowEvidence.checked;

  const roles = [...new Set(activityRows.filter(item => !["Inicio", "Fin", "Conector"].includes(item.tipo))
    .flatMap(item => {
      const names = String(item.responsable || "").split(";").map(role => role.trim()).filter(Boolean);
      return names.length ? names : ["Sin responsable"];
    }))];
  if (!roles.length) roles.push("Sin responsable");
  const laneWidth = showEvidence ? 360 : 260;
  const rowHeight = showEvidence ? 168 : 132;
  const width = Math.max(760, roles.length * laneWidth + 160);
  const height = 150 + activityRows.length * rowHeight;
  flowIntrinsicWidth = width;
  flowIntrinsicHeight = height;
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
    return [item.uid, { x: center, y: 118 + index * rowHeight, index, item }];
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
    const evidence = String(item.evidencia || item.controlEvidencia || "").trim();
    if (showEvidence && evidence && !["Inicio", "Conector", "Fin"].includes(item.tipo)) {
      const record = svgNode("g");
      record.append(svgNode("title", {}, `Registro / evidencia: ${evidence}`));
      record.append(svgNode("line", { x1: x + 65, y1: y + 43, x2: x + 65, y2: y + 57, class: "flow-record-link" }));
      record.append(svgNode("path", { d: `M ${x + 30} ${y + 57} h 130 v 54 q -16 -7 -32 0 q -16 7 -32 0 q -16 -7 -33 0 q -16 7 -33 0 z`, class: "flow-record" }));
      record.append(svgNode("text", { x: x + 95, y: y + 73, class: "flow-record-caption", "text-anchor": "middle" }, "REGISTRO / EVIDENCIA"));
      const lines = flowLines(evidence, 20);
      lines.forEach((line, lineIndex) => record.append(svgNode("text", { x: x + 95, y: y + 88 + lineIndex * 11, class: "flow-record-text", "text-anchor": "middle" }, line)));
      svg.append(record);
    }
  }
  setFlowZoom(flowZoom);
}

function setMessage(node, text, success = false) {
  node.textContent = text;
  node.classList.toggle("success", success);
  node.hidden = !text;
}

function errorText(error) {
  if (error.code === "submission_incomplete" && Array.isArray(error.details)) {
    return `${errorMessages.submission_incomplete}\n${error.details.map(issue => `• ${issue}`).join("\n")}`;
  }
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

async function refreshNotifications() {
  try {
    const { notifications, unreadCount } = await request("/api/notifications");
    ui.notificationCount.textContent = unreadCount > 99 ? "99+" : String(unreadCount || "");
    ui.notificationCount.hidden = unreadCount < 1;
    ui.notificationBell.setAttribute("aria-label", unreadCount ? `Notificaciones, ${unreadCount} sin leer` : "Notificaciones");
    ui.markAllNotificationsRead.hidden = unreadCount < 1;
    ui.emptyNotifications.hidden = notifications.length > 0;
    ui.notificationList.replaceChildren(...notifications.map(notification => {
      const item = document.createElement("li");
      item.className = notification.readAt ? "notification-item" : "notification-item unread";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "notification-open";
      const title = document.createElement("strong");
      title.textContent = notification.title;
      const message = document.createElement("span");
      message.textContent = notification.message;
      const date = document.createElement("small");
      const timestamp = new Date(notification.createdAt);
      date.textContent = Number.isNaN(timestamp.valueOf()) ? "" : timestamp.toLocaleString("es-CO");
      button.append(title, message, date);
      button.addEventListener("click", () => openNotification(notification));
      item.append(button);
      return item;
    }));
  } catch (error) {
    if (["unauthenticated", "csrf_failed", "password_change_required"].includes(error.code)) {
      handleRequestError(error, ui.listMessage);
    }
  }
}

async function openNotification(notification) {
  try {
    await request(`/api/notifications/${encodeURIComponent(notification.id)}/read`, { method: "POST", csrf: true });
    await refreshNotifications();
    ui.notificationPopover.hidden = true;
    ui.notificationBell.setAttribute("aria-expanded", "false");
    if (notification.eventType === "procedure_submitted_for_review" && currentUserRole === "evaluador") {
      hideAnalytics();
      await openAssignedProcedure(notification.procedureId);
    } else if (notification.eventType === "procedure_evaluation_started" && ["elaborador", "administrador"].includes(currentUserRole)) {
      hideAnalytics();
      await openDraft(notification.procedureId);
    }
  } catch (error) {
    handleRequestError(error, currentUserRole === "evaluador" ? ui.evaluatorInboxMessage : ui.listMessage);
  }
}

const analyticsEventLabels = [
  ["procedure_draft_created", "Borradores creados"],
  ["procedure_draft_updated", "Ediciones guardadas"],
  ["procedure_submitted_for_review", "Envíos a revisión"],
  ["procedure_evaluation_started", "Evaluaciones iniciadas"]
];

function renderAnalytics(analytics) {
  ui.analyticsMetrics.replaceChildren(...analyticsEventLabels.map(([key, label]) => {
    const metric = document.createElement("div");
    metric.className = "analytics-metric";
    const value = document.createElement("strong");
    value.textContent = String(analytics.totals[key] || 0);
    const caption = document.createElement("span");
    caption.textContent = label;
    metric.append(value, caption);
    return metric;
  }));

  ui.analyticsByDay.replaceChildren(...analytics.byDay.map(row => {
    const tr = document.createElement("tr");
    const date = document.createElement("th");
    date.scope = "row";
    date.textContent = row.day;
    tr.append(date);
    for (const [key] of analyticsEventLabels) {
      const cell = document.createElement("td");
      cell.textContent = String(row[key] || 0);
      tr.append(cell);
    }
    return tr;
  }));
  ui.emptyAnalyticsDays.hidden = analytics.byDay.length > 0;

  ui.analyticsByProcess.replaceChildren(...analytics.byProcess.map(row => {
    const tr = document.createElement("tr");
    const process = document.createElement("th");
    process.scope = "row";
    process.textContent = `${row.processName} (${row.processCode})`;
    tr.append(process);
    for (const [key] of analyticsEventLabels) {
      const cell = document.createElement("td");
      cell.textContent = String(row[key] || 0);
      tr.append(cell);
    }
    return tr;
  }));
  ui.emptyAnalyticsProcesses.hidden = analytics.byProcess.length > 0;
  setMessage(ui.analyticsMessage, `Eventos del backend durante los últimos ${analytics.periodDays} días.`, true);
}

async function loadAnalytics() {
  setMessage(ui.analyticsMessage, "Consultando actividad...");
  const query = new URLSearchParams({
    periodDays: ui.analyticsPeriod.value,
    processCode: ui.analyticsProcess.value,
    role: ui.analyticsRole.value
  });
  try {
    const { analytics } = await request(`/api/admin/analytics?${query}`);
    renderAnalytics(analytics);
  } catch (error) {
    handleRequestError(error, ui.analyticsMessage);
  }
}

function showAnalytics() {
  if (currentUserRole !== "administrador") return;
  ui.notificationPopover.hidden = true;
  ui.notificationBell.setAttribute("aria-expanded", "false");
  ui.analyticsSection.hidden = false;
  ui.pageHeading.hidden = true;
  ui.draftWorkspace.hidden = true;
  ui.evaluatorInbox.hidden = true;
  ui.evaluatorDetail.hidden = true;
  ui.flowSection.hidden = true;
  ui.documentsSection.hidden = true;
  loadAnalytics();
}

function hideAnalytics() {
  ui.analyticsSection.hidden = true;
  ui.pageHeading.hidden = false;
  ui.evaluatorInbox.hidden = currentUserRole !== "evaluador";
  ui.draftWorkspace.hidden = currentUserRole === "evaluador";
  ui.documentsSection.hidden = currentUserRole === "evaluador";
  ui.flowSection.hidden = currentUserRole === "evaluador";
  if (currentUserRole !== "evaluador") renderFlow();
}

function clearSession() {
  flowReviewVersion += 1;
  clearInterval(notificationTimer);
  notificationTimer = null;
  csrfToken = "";
  sessionStorage.removeItem(csrfKey);
  currentDraft = null;
  currentUserRole = "";
  currentPayload = {};
  normRows = [];
  renderNorms();
  activityRows = [];
  renderActivities();
  annexRows = [];
  changeRows = [];
  annexesNotApplicable = false;
  renderAnnexes();
  renderChanges();
  for (const [inputId] of textFields) ui[inputId].value = "";
  showRoleSeparation();
  setMessage(ui.documentsMessage, "");
  dirty = false;
  ui.workspace.hidden = true;
  ui.analyticsSection.hidden = true;
  ui.pageHeading.hidden = false;
  ui.analyticsButton.hidden = true;
  ui.notificationPopover.hidden = true;
  ui.notificationBell.setAttribute("aria-expanded", "false");
  ui.notificationCount.hidden = true;
  ui.notificationList.replaceChildren();
  ui.previewButton.hidden = true;
  ui.submitReviewButton.hidden = true;
  ui.submitReviewButton.disabled = true;
  ui.evaluatorInbox.hidden = true;
  ui.evaluatorDetail.hidden = true;
  if (ui.previewDialog.open) ui.previewDialog.close();
  ui.documentsSection.hidden = true;
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
  clearInterval(notificationTimer);
  notificationTimer = null;
  ui.loginView.hidden = true;
  ui.workspace.hidden = false;
  ui.sessionControls.hidden = false;
  ui.sessionIdentity.textContent = user.username || user.displayName;
  ui.welcomeText.textContent = user.displayName + " · " + user.role;
  ui.passwordRequired.hidden = !user.mustChangePassword;
  ui.documentsSection.hidden = true;
  ui.analyticsSection.hidden = true;
  ui.pageHeading.hidden = false;
  ui.analyticsButton.hidden = user.role !== "administrador";
  ui.notificationPopover.hidden = true;
  ui.notificationBell.setAttribute("aria-expanded", "false");
  currentUserRole = user.role;
  ui.evaluatorInbox.hidden = true;
  ui.evaluatorDetail.hidden = true;
  ui.previewButton.hidden = true;
  ui.submitReviewButton.hidden = user.role !== "elaborador";
  ui.submitReviewButton.disabled = true;

  if (user.mustChangePassword) {
    ui.draftWorkspace.hidden = true;
    return;
  }
  await refreshNotifications();
  if (!currentUserRole) return;
  notificationTimer = setInterval(() => {
    if (!document.hidden) refreshNotifications();
  }, 60_000);
  if (user.role === "evaluador") {
    ui.draftWorkspace.hidden = true;
    ui.evaluatorInbox.hidden = false;
    await loadEvaluatorInbox();
    return;
  }
  if (!["elaborador", "administrador"].includes(user.role)) {
    ui.draftWorkspace.hidden = true;
    setMessage(ui.listMessage, errorMessages.forbidden);
    return;
  }

  ui.draftWorkspace.hidden = false;
  ui.documentsSection.hidden = false;
  ui.previewButton.hidden = false;
  applyDraftEditability();
  await loadProcesses();
  await loadDrafts();
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
    processNames = new Map(processes.map(process => [process.code, process.name]));
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Selecciona un proceso";
    const groups = buildProcessOptionGroups(processes);
    ui.processCode.replaceChildren(placeholder, ...groups);
    if (currentUserRole === "administrador") {
      const allProcesses = document.createElement("option");
      allProcesses.value = "";
      allProcesses.textContent = "Todos los procesos";
      ui.analyticsProcess.replaceChildren(allProcesses, ...groups.map(group => group.cloneNode(true)));
    }
    ui.processCode.disabled = Boolean(currentDraft);
  } catch (error) {
    handleRequestError(error, ui.editorMessage);
  }
}

function buildProcessOptionGroups(processes) {
  const byCode = new Map(processes.map(process => [process.code, process]));
  const used = new Set();
  const groups = processGroupDefinitions.map(group => {
    const options = group.codes.flatMap(code => {
      const process = byCode.get(code);
      if (!process) return [];
      used.add(code);
      const option = document.createElement("option");
      option.value = code;
      option.textContent = `${process.name} (${code})`;
      return [option];
    });
    if (!options.length) return null;
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label;
    optgroup.append(...options);
    return optgroup;
  }).filter(Boolean);
  const otherProcesses = processes.filter(process => !used.has(process.code));
  if (otherProcesses.length) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = "Otros procesos";
    for (const process of otherProcesses) {
      const option = document.createElement("option");
      option.value = process.code;
      option.textContent = `${process.name} (${process.code})`;
      optgroup.append(option);
    }
    groups.push(optgroup);
  }
  return groups;
}

async function loadDrafts() {
  try {
    const { procedures } = await request("/api/procedures");
    renderDrafts(procedures);
  } catch (error) {
    handleRequestError(error, ui.listMessage);
  }
}

const procedureStatusLabels = {
  borrador: "Borrador",
  enviado_a_evaluacion: "Enviado a evaluación",
  en_evaluacion: "En evaluación",
  devuelto_para_ajustes: "Devuelto para ajustes",
  subsanado: "Subsanado",
  concepto_favorable: "Concepto favorable",
  concepto_no_favorable: "Concepto no favorable",
  reabierto_por_administrador: "Reabierto por administración"
};

function statusLabel(status) {
  return procedureStatusLabels[status] || status || "Borrador";
}

async function loadEvaluatorInbox() {
  try {
    const { procedures } = await request("/api/evaluator/inbox");
    ui.evaluatorDraftCount.textContent = `${procedures.length} procedimiento${procedures.length === 1 ? "" : "s"}`;
    ui.emptyEvaluatorInbox.hidden = procedures.length > 0;
    ui.evaluatorDraftList.replaceChildren(...procedures.map(procedure => {
      const item = document.createElement("li");
      item.className = "draft-item";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "draft-open";
      const info = document.createElement("span");
      info.className = "draft-info";
      const name = document.createElement("strong");
      name.textContent = procedure.name;
      const detail = document.createElement("small");
      detail.textContent = `${procedure.processCode} · ${statusLabel(procedure.status)}`;
      const status = document.createElement("span");
      status.className = "draft-status";
      status.textContent = "Revisar";
      info.append(name, detail);
      button.append(info, status);
      button.addEventListener("click", () => openAssignedProcedure(procedure.id));
      item.append(button);
      return item;
    }));
    setMessage(ui.evaluatorInboxMessage, "");
  } catch (error) {
    handleRequestError(error, ui.evaluatorInboxMessage);
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
    status.textContent = statusLabel(draft.status);

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
    populateDraft(procedure);
    ui.evaluatorInbox.hidden = true;
    ui.evaluatorDetail.hidden = true;
    ui.draftWorkspace.hidden = false;
    ui.draftName.focus();
  } catch (error) {
    handleRequestError(error, ui.listMessage);
  }
}

function populateDraft(procedure) {
  flowReviewVersion += 1;
  currentDraft = procedure;
  currentPayload = procedure.payload && typeof procedure.payload === "object" && !Array.isArray(procedure.payload) ? procedure.payload : {};
  normRows = Array.isArray(currentPayload.norms) ? currentPayload.norms.map(norm => norm && typeof norm === "object" && !Array.isArray(norm) ? { ...norm } : {}) : [];
  renderNorms();
  activityRows = Array.isArray(currentPayload.activities) ? currentPayload.activities.map(activity => activity && typeof activity === "object" && !Array.isArray(activity) ? { ...activity, uid: activity.uid || crypto.randomUUID() } : { uid: crypto.randomUUID() }) : [];
  renderActivities();
  annexRows = Array.isArray(currentPayload.annexes) ? currentPayload.annexes.map(annex => annex && typeof annex === "object" && !Array.isArray(annex) ? { ...annex } : {}) : [];
  changeRows = Array.isArray(currentPayload.changes) ? currentPayload.changes.map(change => change && typeof change === "object" && !Array.isArray(change) ? { ...change } : {}) : [];
  annexesNotApplicable = currentPayload.settings?.annexesNotApplicable === true;
  renderAnnexes();
  renderChanges();
  setMessage(ui.documentsMessage, "");
  ui.draftName.value = procedure.name;
  for (const [inputId, fieldId] of textFields) ui[inputId].value = typeof currentPayload.fields?.[fieldId] === "string" ? currentPayload.fields[fieldId] : "";
  showRoleSeparation();
  const option = document.createElement("option");
  option.value = procedure.processCode;
  option.textContent = `${processNames.get(procedure.processCode) || procedure.processCode} (${procedure.processCode})`;
  ui.processCode.replaceChildren(option);
  ui.processCode.value = procedure.processCode;
  ui.editorTitle.textContent = "Editar borrador";
  ui.editorStatus.textContent = `${statusLabel(procedure.status)} · revisión ${procedure.revision}`;
  ui.saveDraftButton.textContent = "Guardar cambios";
  ui.saveDocumentsButton.textContent = "Guardar cambios";
  dirty = false;
  setMessage(ui.editorMessage, "");
  ui.flowReviewResult.hidden = true;
  ui.flowReviewResult.replaceChildren();
  applyDraftEditability();
}

function applyDraftEditability() {
  const editable = ["elaborador", "administrador"].includes(currentUserRole) && (!currentDraft || ["borrador", "devuelto_para_ajustes"].includes(currentDraft.status));
  for (const control of ui.draftForm.querySelectorAll("input, select, textarea, button")) control.disabled = !editable;
  for (const control of ui.documentsSection.querySelectorAll("input, select, textarea, button")) control.disabled = !editable;
  ui.saveDraftButton.hidden = !editable;
  ui.saveDocumentsButton.hidden = !editable;
  ui.newDraftButton.disabled = !editable;
  const canSubmit = currentDraft && ["borrador", "devuelto_para_ajustes"].includes(currentDraft.status);
  ui.submitReviewButton.hidden = currentUserRole !== "elaborador";
  ui.submitReviewButton.disabled = !canSubmit;
  ui.submitReviewButton.title = canSubmit ? "Enviar este borrador guardado para revisión" : "Abre un borrador guardado para habilitar el envío";
  ui.previewButton.hidden = currentUserRole !== "elaborador" && currentUserRole !== "administrador" && currentUserRole !== "evaluador";
}

async function openAssignedProcedure(id) {
  try {
    const { procedure } = await request(`/api/evaluator/procedures/${encodeURIComponent(id)}`);
    populateDraft(procedure);
    ui.processCode.disabled = true;
    ui.draftWorkspace.hidden = true;
    ui.evaluatorInbox.hidden = true;
    ui.evaluatorDetail.hidden = false;
    ui.evaluatorDetailTitle.textContent = procedure.name;
    ui.evaluatorDetailStatus.textContent = `${procedure.processCode} · ${statusLabel(procedure.status)} · revisión ${procedure.revision}`;
    ui.startEvaluationButton.hidden = procedure.status !== "enviado_a_evaluacion" && procedure.status !== "subsanado";
    ui.previewButton.hidden = false;
  } catch (error) {
    handleRequestError(error, ui.evaluatorInboxMessage);
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
  annexRows = [];
  changeRows = [{ version: "1.0", fecha: todayLocal(), razon: "Creación inicial del procedimiento" }];
  annexesNotApplicable = false;
  renderAnnexes();
  renderChanges();
  setMessage(ui.documentsMessage, "");
  ui.draftForm.reset();
  for (const [inputId] of textFields) ui[inputId].value = "";
  showRoleSeparation();
  ui.processCode.disabled = false;
  ui.editorTitle.textContent = "Nuevo borrador";
  ui.editorStatus.textContent = "Borrador no guardado";
  ui.saveDraftButton.textContent = "Guardar borrador";
  ui.saveDocumentsButton.textContent = "Guardar borrador";
  dirty = false;
  setMessage(ui.editorMessage, "");
  ui.flowReviewResult.hidden = true;
  ui.flowReviewResult.replaceChildren();
  applyDraftEditability();
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
for (const inputId of ["draftPreparedBy", "draftPreparedName", "draftReviewedBy", "draftReviewedName", "draftApprovedBy", "draftApprovedName"]) {
  ui[inputId].addEventListener("input", markDirty);
}
for (const inputId of ["draftPreparedBy", "draftReviewedBy", "draftApprovedBy"]) {
  ui[inputId].addEventListener("input", showRoleSeparation);
}
ui.annexApplicability.addEventListener("change", () => {
  if (ui.annexApplicability.value === "no_aplica") {
    if (!window.confirm("Confirma que este procedimiento no contiene anexos? Los anexos registrados se eliminarán de esta sección.")) {
      ui.annexApplicability.value = annexesNotApplicable ? "no_aplica" : "aplica";
      return;
    }
    annexRows = [];
    annexesNotApplicable = true;
  } else {
    annexesNotApplicable = false;
  }
  renderAnnexes();
  markDirty();
});
ui.addAnnexButton.addEventListener("click", () => {
  if (annexesNotApplicable) return;
  annexRows.push({ documento: "", tipo: "Formato", codigo: "", observacion: "" });
  renderAnnexes();
  markDirty();
  ui.annexesList.lastElementChild?.querySelector("input")?.focus();
});
ui.addChangeButton.addEventListener("click", () => {
  changeRows.push({ version: String(currentPayload.fields?.version || "1.0"), fecha: todayLocal(), razon: "" });
  renderChanges();
  markDirty();
  ui.changesList.lastElementChild?.querySelector("input")?.focus();
});
ui.saveDocumentsButton.addEventListener("click", () => ui.draftForm.requestSubmit());
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
    const { issues, completenessIssues } = await request("/api/procedures/flow-review", {
      method: "POST", csrf: true,
      body: { activities: activityRows.map(activity => ({ ...activity })) }
    });
    if (version === flowReviewVersion) showFlowReview(issues, completenessIssues);
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
    activities: activityRows.map(activity => ({ ...activity })),
    annexes: annexRows.map(annex => ({ ...annex })),
    changes: changeRows.map(change => ({ ...change })),
    settings: { ...(currentPayload.settings && typeof currentPayload.settings === "object" && !Array.isArray(currentPayload.settings) ? currentPayload.settings : {}), annexesNotApplicable }
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
    annexRows = Array.isArray(currentPayload.annexes) ? currentPayload.annexes.map(annex => ({ ...annex })) : [];
    changeRows = Array.isArray(currentPayload.changes) ? currentPayload.changes.map(change => ({ ...change })) : [];
    annexesNotApplicable = currentPayload.settings?.annexesNotApplicable === true;
    renderAnnexes();
    renderChanges();
    ui.processCode.value = currentDraft.processCode;
    ui.processCode.disabled = true;
    ui.editorTitle.textContent = "Editar borrador";
    ui.editorStatus.textContent = currentDraft.status + " · revisión " + currentDraft.revision;
    ui.saveDraftButton.textContent = "Guardar cambios";
    ui.saveDocumentsButton.textContent = "Guardar cambios";
    dirty = false;
    applyDraftEditability();
    setMessage(ui.editorMessage, "Borrador guardado.", true);
    setMessage(ui.documentsMessage, "Borrador guardado.", true);
    await loadDrafts();
  } catch (error) {
    handleRequestError(error, ui.editorMessage);
    if (!["unauthenticated", "csrf_failed", "password_change_required"].includes(error.code)) {
      setMessage(ui.documentsMessage, errorText(error));
    }
  } finally {
    button.disabled = false;
  }
});

ui.newDraftButton.addEventListener("click", newDraft);
ui.submitReviewButton.addEventListener("click", async () => {
  if (!currentDraft) return;
  if (dirty) {
    setMessage(ui.editorMessage, "Guarda los cambios antes de enviar el procedimiento.");
    return;
  }
  setMessage(ui.submitReviewMessage, "");
  ui.reviewEvaluatorSelect.replaceChildren(new Option("Cargando evaluadores...", ""));
  try {
    const { evaluators } = await request(`/api/evaluators?processCode=${encodeURIComponent(currentDraft.processCode)}`);
    if (!evaluators.length) {
      setMessage(ui.editorMessage, errorMessages.evaluator_unavailable);
      return;
    }
    ui.reviewEvaluatorSelect.replaceChildren(new Option("Selecciona un Evaluador", ""), ...evaluators.map(evaluator => new Option(evaluator.displayName, evaluator.id)));
    ui.submitReviewDialog.showModal();
  } catch (error) {
    setMessage(ui.editorMessage, errorText(error));
  }
});
ui.cancelSubmitReview.addEventListener("click", () => ui.submitReviewDialog.close());
ui.submitReviewForm.addEventListener("submit", async event => {
  event.preventDefault();
  const evaluatorId = ui.reviewEvaluatorSelect.value;
  const evaluatorName = ui.reviewEvaluatorSelect.selectedOptions[0]?.textContent;
  if (!currentDraft || !evaluatorId) return;
  if (!window.confirm(`¿Enviar “${currentDraft.name}” para revisión de ${evaluatorName}? El borrador quedará bloqueado durante la revisión.`)) return;
  ui.confirmSubmitReview.disabled = true;
  setMessage(ui.submitReviewMessage, "");
  try {
    const { procedure } = await request(`/api/procedures/${encodeURIComponent(currentDraft.id)}/submit`, {
      method: "POST", csrf: true, body: { evaluatorId, revision: currentDraft.revision }
    });
    currentDraft = procedure;
    ui.editorStatus.textContent = `${statusLabel(procedure.status)} · revisión ${procedure.revision}`;
    dirty = false;
    applyDraftEditability();
    setMessage(ui.editorMessage, `Enviado a ${evaluatorName}. El procedimiento quedó bloqueado para revisión.`, true);
    ui.submitReviewDialog.close();
    await loadDrafts();
  } catch (error) {
    setMessage(ui.submitReviewMessage, errorText(error));
  } finally {
    ui.confirmSubmitReview.disabled = false;
  }
});
ui.refreshEvaluatorInbox.addEventListener("click", loadEvaluatorInbox);
ui.backToEvaluatorInbox.addEventListener("click", () => {
  ui.evaluatorDetail.hidden = true;
  ui.evaluatorInbox.hidden = false;
  ui.previewButton.hidden = true;
});
ui.startEvaluationButton.addEventListener("click", async () => {
  if (!currentDraft) return;
  ui.startEvaluationButton.disabled = true;
  try {
    const { procedure } = await request(`/api/evaluator/procedures/${encodeURIComponent(currentDraft.id)}/start`, { method: "POST", csrf: true, body: {} });
    currentDraft = procedure;
    ui.evaluatorDetailStatus.textContent = `${procedure.processCode} · ${statusLabel(procedure.status)} · revisión ${procedure.revision}`;
    ui.startEvaluationButton.hidden = true;
    setMessage(ui.evaluatorInboxMessage, "Evaluación iniciada.", true);
    await loadEvaluatorInbox();
  } catch (error) {
    handleRequestError(error, ui.evaluatorInboxMessage);
  } finally {
    ui.startEvaluationButton.disabled = false;
  }
});
function reportTable(headers, records, valuesForRecord) {
  const table = document.createElement("table");
  table.className = "preview-report-table";
  const thead = document.createElement("thead");
  const header = document.createElement("tr");
  headers.forEach(label => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    header.append(cell);
  });
  thead.append(header);
  const tbody = document.createElement("tbody");
  if (!records.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = headers.length;
    cell.textContent = "Sin información registrada.";
    row.append(cell);
    tbody.append(row);
  } else {
    records.forEach((record, index) => {
      const row = document.createElement("tr");
      valuesForRecord(record, index).forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value || "";
        row.append(cell);
      });
      tbody.append(row);
    });
  }
  table.append(thead, tbody);
  return table;
}

function reportSection(number, title, content) {
  const section = document.createElement("section");
  section.className = "preview-report-section";
  const heading = document.createElement("h3");
  heading.textContent = `${number}. ${title.toLocaleUpperCase("es-CO")}`;
  section.append(heading, content);
  return section;
}

function showPreview() {
  const content = ui.previewContent;
  const process = ui.processCode.selectedOptions[0]?.textContent || "Sin proceso seleccionado";
  const header = document.createElement("header");
  header.className = "preview-document-header";
  const agency = document.createElement("div");
  agency.className = "preview-agency-mark";
  agency.textContent = "AP";
  const title = document.createElement("div");
  title.className = "preview-document-title";
  const titleLabel = document.createElement("strong");
  titleLabel.textContent = "PROCEDIMIENTO";
  const name = document.createElement("h2");
  name.textContent = ui.draftName.value.trim() || "Nombre del procedimiento";
  const processLabel = document.createElement("span");
  processLabel.textContent = process;
  title.append(titleLabel, name, processLabel);
  const meta = document.createElement("div");
  meta.className = "preview-document-meta";
  for (const [label, value] of [["Código", ui.processCode.value || "Pendiente"], ["Versión", changeRows.at(-1)?.version || "1.0"], ["Estado", currentDraft?.status || "Borrador"]]) {
    const cell = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = label;
    const text = document.createElement("span");
    text.textContent = value;
    cell.append(strong, text);
    meta.append(cell);
  }
  header.append(agency, title, meta);

  const definitions = ui.draftDefinitions.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const split = line.indexOf(":");
    return split > 0 ? [line.slice(0, split).trim(), line.slice(split + 1).trim()] : ["Definición", line];
  });
  const definitionTable = reportTable(["Término", "Definición"], definitions, row => row);
  const destinations = new Map(activityRows.map(activity => [activity.uid, activity.actividad || activity.tipo || "Destino"]));
  const showEvidence = activityRows.some(activity => String(activity.evidencia || activity.controlEvidencia || "").trim());
  const showSystem = activityRows.some(activity => String(activity.sistema || "").trim());
  const activityHeaders = ["N.º", "Tipo", "Actividad", "Descripción / rutas", "Responsable", "Punto de control"];
  if (showEvidence) activityHeaders.push("Registro / evidencia");
  if (showSystem) activityHeaders.push("Sistema / herramienta");
  const activityTable = reportTable(activityHeaders, activityRows, (activity, index) => {
    const description = [activity.descripcion || ""];
    if (activity.tipo === "Decisión") description.push(`Sí → ${destinations.get(activity.decisionSi) || "Sin destino"}`, `No → ${destinations.get(activity.decisionNo) || "Sin destino"}`);
    if (activity.tipo === "Conector") description.push(`Conector ${activity.connectorId || ""} → ${destinations.get(activity.connectorDestino) || "Sin destino"}`);
    const control = activity.tieneControl ? [
      ["Responsable", activity.controlResponsable], ["Periodicidad", activity.controlPeriodicidad],
      ["Propósito", activity.controlAccion], ["Ejecución", activity.controlEjecucion],
      ["Desviación", activity.controlDesviacion], ["Evidencia", activity.controlEvidencia]
    ].filter(([, value]) => String(value || "").trim()).map(([label, value]) => `${label}: ${value}`).join("\n") || "Control sin detalle" : "No aplica";
    const row = [String(index + 1), activity.tipo || "", activity.actividad || "", description.join("\n"), activity.responsable || "", control];
    if (showEvidence) row.push(activity.evidencia || activity.controlEvidencia || "");
    if (showSystem) row.push(activity.sistema || "");
    return row;
  });
  const approvals = reportTable(["Elaboró", "Revisó", "Aprobó"], [{}], () => [
    [ui.draftPreparedBy.value, ui.draftPreparedName.value && `Nombre: ${ui.draftPreparedName.value}`].filter(Boolean).join("\n"),
    [ui.draftReviewedBy.value, ui.draftReviewedName.value && `Nombre: ${ui.draftReviewedName.value}`].filter(Boolean).join("\n"),
    [ui.draftApprovedBy.value, ui.draftApprovedName.value && `Nombre: ${ui.draftApprovedName.value}`].filter(Boolean).join("\n")
  ]);
  const report = document.createElement("article");
  report.className = "preview-report";
  report.append(header,
    reportSection("1", "Objetivo", document.createTextNode(ui.draftObjective.value || "Sin información registrada.")),
    reportSection("2", "Alcance", document.createTextNode(ui.draftScope.value || "Sin información registrada.")),
    reportSection("3", "Términos y definiciones", definitionTable),
    reportSection("4", "Condiciones generales", document.createTextNode(ui.draftConditions.value || "Sin información registrada.")),
    reportSection("5", "Normatividad", reportTable(["Tipo", "Norma", "Año", "Descripción de la norma", "Artículo / sección", "Entidad emisora"], normRows, row => [row.tipo, row.norma, row.anio, row.descripcion, row.articulo, row.entidad])),
    reportSection("6", "Descripción del procedimiento", activityTable));

  const flowSection = document.createElement("section");
  flowSection.className = "preview-report-section preview-report-flow";
  const flowHeading = document.createElement("h3");
  flowHeading.textContent = "7. FLUJOGRAMA";
  flowSection.append(flowHeading);
  const diagram = document.createElement("div");
  diagram.className = "preview-diagram";
  renderFlow();
  if (activityRows.length) {
    const svg = ui.flowSvg.cloneNode(true);
    svg.removeAttribute("id");
    svg.removeAttribute("style");
    diagram.append(svg);
  } else diagram.textContent = "Sin actividades registradas.";
  flowSection.append(diagram);
  report.append(flowSection,
    reportSection("8", "Documentos anexos", reportTable(["Documento", "Tipo", "Código / referencia", "Observación"], annexesNotApplicable ? [] : annexRows, row => [row.documento, row.tipo, row.codigo, row.observacion])),
    reportSection("9", "Control de cambios", reportTable(["Versión", "Fecha", "Razón de la actualización"], changeRows, row => [row.version, row.fecha, row.razon])),
    approvals);
  content.replaceChildren(report);
  ui.previewState.textContent = !currentDraft ? "Vista de un borrador no guardado." : dirty ? "Vista con cambios sin guardar." : `Borrador guardado · revisión ${currentDraft.revision}.`;
  ui.previewDialog.showModal();
}

ui.previewButton.addEventListener("click", showPreview);
ui.analyticsButton.addEventListener("click", showAnalytics);
ui.backFromAnalytics.addEventListener("click", hideAnalytics);
ui.refreshAnalytics.addEventListener("click", loadAnalytics);
ui.analyticsFilters.addEventListener("submit", event => {
  event.preventDefault();
  loadAnalytics();
});
ui.notificationBell.addEventListener("click", () => {
  const open = ui.notificationPopover.hidden;
  ui.notificationPopover.hidden = !open;
  ui.notificationBell.setAttribute("aria-expanded", String(open));
  if (open) refreshNotifications();
});
ui.markAllNotificationsRead.addEventListener("click", async () => {
  ui.markAllNotificationsRead.disabled = true;
  try {
    await request("/api/notifications/read-all", { method: "POST", csrf: true });
    await refreshNotifications();
  } catch (error) {
    handleRequestError(error, currentUserRole === "evaluador" ? ui.evaluatorInboxMessage : ui.listMessage);
  } finally {
    ui.markAllNotificationsRead.disabled = false;
  }
});
document.addEventListener("click", event => {
  if (!ui.notificationCenter.contains(event.target)) {
    ui.notificationPopover.hidden = true;
    ui.notificationBell.setAttribute("aria-expanded", "false");
  }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && currentUserRole) refreshNotifications();
});
ui.closePreviewButton.addEventListener("click", () => ui.previewDialog.close());
ui.printPreviewButton.addEventListener("click", () => window.print());
ui.refreshDraftsButton.addEventListener("click", loadDrafts);
ui.refreshFlowButton.addEventListener("click", renderFlow);
ui.showFlowEvidence.addEventListener("change", renderFlow);
ui.zoomOutButton.addEventListener("click", () => setFlowZoom(flowZoom - 10));
ui.zoomInButton.addEventListener("click", () => setFlowZoom(flowZoom + 10));
ui.fitFlowButton.addEventListener("click", fitFlow);
ui.resetFlowZoomButton.addEventListener("click", () => setFlowZoom(100));
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
installMethodHelps(document);
if (csrfToken) request("/api/auth/me").then(({ user }) => startSession(user)).catch(clearSession);
