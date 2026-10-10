const ids = [
  "loginView", "loginForm", "loginUsername", "loginPassword", "loginOtp", "loginMessage",
  "workspace", "sessionControls", "sessionIdentity", "notificationCenter", "notificationBell", "notificationPopover", "notificationCount", "emptyNotifications", "notificationList", "markAllNotificationsRead", "logoutButton", "welcomeText",
  "pageHeading", "analyticsButton", "analyticsSection", "backFromAnalytics", "refreshAnalytics", "analyticsFilters", "analyticsPeriod", "analyticsProcess", "analyticsRole", "analyticsMessage", "analyticsMetrics", "analyticsByDay", "analyticsByProcess", "emptyAnalyticsDays", "emptyAnalyticsProcesses",
  "passwordRequired", "draftWorkspace", "draftForm", "editorTitle", "editorStatus", "submitReviewButton", "submitReviewDialog", "submitReviewForm", "reviewEvaluatorSelect", "submitReviewMessage", "cancelSubmitReview", "confirmSubmitReview",
  "evaluatorInbox", "evaluatorDraftCount", "evaluatorInboxMessage", "emptyEvaluatorInbox", "evaluatorDraftList", "refreshEvaluatorInbox", "evaluatorDetail", "evaluatorDetailTitle", "evaluatorDetailStatus", "backToEvaluatorInbox", "startEvaluationButton",
  "evaluationWorkspace", "evaluationProgress", "evaluationScore", "evaluationLevel", "evaluationVariableResults", "evaluationCriteriaGroups", "evaluationConcept", "evaluationMessage", "saveEvaluationButton", "returnEvaluationButton", "unfavorableEvaluationButton", "favorableEvaluationButton",
  "returnedEvaluation", "returnedEvaluationSummary", "returnedEvaluationConcept", "returnedFindings", "saveEvaluationResponses", "returnedEvaluationMessage",
  "draftName", "processCode", "draftConsecutive", "draftCode", "draftCodeStatus", "draftObjective", "draftScope", "draftDefinitions", "draftConditions", "saveDraftButton", "editorMessage",
  "newDraftButton", "addNormButton", "normsList", "emptyNorms", "addBoundaryButton", "addActivityButton", "addDecisionButton", "addConnectorButton", "activitiesList", "emptyActivities", "reviewFlowButton", "flowReviewResult", "refreshDraftsButton", "draftCount", "listMessage", "emptyDrafts",
  "draftList", "flowSection", "flowSummary", "showFlowEvidence", "refreshFlowButton", "flowCanvas", "flowSvg",
  "zoomOutButton", "zoomInButton", "fitFlowButton", "resetFlowZoomButton", "flowZoomValue",
  "documentsSection", "annexApplicability", "addAnnexButton", "annexNotApplicableMessage", "emptyAnnexes", "annexesList",
  "addChangeButton", "emptyChanges", "changesList", "draftPreparedBy", "draftPreparedName", "draftReviewedBy", "draftReviewedName",
  "draftApprovedBy", "draftApprovedName", "roleSeparationMessage", "saveDocumentsButton", "documentsMessage",
  "previewButton", "previewDialog", "previewState", "previewContent", "printPreviewButton", "closePreviewButton", "methodTooltip"
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
  invalid_procedure_code: "Indica un consecutivo entre 1 y 999 para generar el código del procedimiento.",
  procedure_code_taken: "El código ya está asignado a otro procedimiento. Elige otro consecutivo.",
  procedure_code_locked: "El código queda fijo después de enviar el procedimiento a evaluación.",
  draft_not_found: "El borrador ya no está disponible.",
  draft_locked: "Este procedimiento ya no se puede editar desde esta pantalla.",
  draft_conflict: "El borrador cambió en otra sesión. Vuelve a abrirlo antes de guardar.",
  processes_unavailable: "No se pudieron cargar los procesos.",
  procedure_unavailable: "No se pudo completar la operación.",
  request_too_large: "El contenido supera el tamaño permitido.",
  submission_incomplete: "Completa los requisitos pendientes antes de enviar.",
  evaluator_unavailable: "No hay un Evaluador activo asignado a este proceso. Contacta al administrador.",
  invalid_revision: "El borrador cambió. Actualízalo y vuelve a intentar.",
  invalid_evaluation: "Revisa los datos de la evaluación.",
  evaluation_incomplete: "Completa los criterios, las observaciones y los ajustes requeridos.",
  evaluation_concept_required: "Escribe el concepto técnico antes de decidir.",
  evaluation_favorable_conditions_unmet: "El concepto favorable exige al menos 90 puntos, ningún incumplimiento crítico y ningún hallazgo abierto.",
  evaluation_no_findings: "No hay criterios incumplidos para devolver.",
  evaluation_meets_favorable_threshold: "La evaluación cumple las condiciones del concepto favorable.",
  invalid_evaluation_decision: "La decisión de evaluación no es válida.",
  invalid_evaluation_response: "Revisa las respuestas a los hallazgos.",
  correction_responses_required: "Responde los hallazgos pendientes antes de reenviar.",
  notification_not_found: "La notificación ya no está disponible. Actualiza la lista.",
  invalid_analytics_period: "Selecciona un periodo válido.",
  invalid_analytics_process: "Selecciona un proceso válido.",
  invalid_analytics_role: "Selecciona un rol válido."
};

let csrfToken = "";
let currentDraft = null;
let currentUserRole = "";
let currentPayload = {};
let evaluationRubric = null;
let currentEvaluation = null;
let returnedEvaluation = null;
let returnedResponsesDirty = false;
let dirty = false;
let flowReviewVersion = 0;
let flowZoom = 100;
let notificationTimer = null;
let flowIntrinsicWidth = 760;
let flowIntrinsicHeight = 500;
let normRows = [];
let activityRows = [];
const collapsedActivityUids = new Set();
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
const responsibilityRoleGroups = [
  { level: "Directivo", cargos: ["Jefe de Oficina", "Director", "Tesorero Distrital", "Secretario de despacho", "Gerente", "Secretario Local de Salud"] },
  { level: "Asesor", cargos: ["Asesor"] },
  { level: "Profesional", cargos: ["Profesional Universitario", "Profesional Universitario Área salud", "Profesional Especializado", "Corregidor", "Líder de Proyecto", "Inspector de Policía Urbano Categoría Especial y 1a Categoría", "Comandante", "Comisario de familia"] },
  { level: "Técnico", cargos: ["Técnico Operativo", "Técnico Área Salud", "Inspector de Tránsito y Transporte", "Subcomandante de Bomberos", "Técnico Administrativo"] },
  { level: "Asistencial", cargos: ["Auxiliar Administrativo", "Auxiliar de Servicios Generales", "Secretario", "Auxiliar área salud", "Bombero", "Sargento de Bomberos", "Cabo Bombero", "Teniente de Bombero", "Operario", "Secretaria Ejecutiva"] }
];
const responsibilityRoleNames = new Set(responsibilityRoleGroups.flatMap(group => group.cargos));
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
  draftName: "Use un verbo de acción específico y verificable, un solo objeto y, cuando sea necesario, un complemento que precise el alcance. Máximo 12 palabras, mayúscula solo en la primera letra y sin punto final.",
  processCode: "Seleccione el proceso organizacional. La aplicación utilizará su código para construir y validar automáticamente el código del procedimiento.",
  draftConsecutive: "Corresponde al número consecutivo del procedimiento dentro del proceso. La aplicación lo completa a tres dígitos: 1 se convierte en 001.",
  draftCode: "Se genera con la estructura: CÓDIGO DEL PROCESO + P (Procedimiento) + CONSECUTIVO. Ejemplo: MM-GD-SE-P-006.",
  draftObjective: "Explique para qué existe el procedimiento y qué resultado pretende lograr. Debe ser claro, específico y coherente con el proceso. Ejemplo: Establecer los lineamientos para planificar un trabajo de auditoría basado en riesgos.",
  draftScope: "Delimite el procedimiento indicando dónde inicia y dónde finaliza. Puede incluir áreas, usuarios, límites, exclusiones, ámbito territorial o temporal.",
  draftDefinitions: "Registre los términos, siglas y conceptos en orden alfabético. Escriba cada término seguido de dos puntos y su definición. Ejemplo: PAA: Plan Anual de Auditoría.",
  draftConditions: "Reglas, políticas operativas, restricciones, condiciones previas o criterios que aplican transversalmente al procedimiento y no corresponden a una actividad específica.",
  annexApplicability: "Elija No aplica solo si este procedimiento no utiliza documentos anexos. Cambiar a No aplica elimina las filas de anexos tras confirmación.",
  draftPreparedBy: "Cargo que prepara o actualiza técnicamente el procedimiento. Debe ser distinto de quien revisa y aprueba.",
  draftReviewedBy: "Cargo que verifica coherencia, suficiencia y cumplimiento. Debe ser distinto de quien elabora y aprueba.",
  draftApprovedBy: "Cargo directivo que autoriza formalmente la versión.",
  draftPreparedName: "Nombre de la persona que elaboró, si ya se conoce.",
  draftReviewedName: "Nombre de la persona que revisó, si ya se conoce.",
  draftApprovedName: "Nombre de la persona que aprobó, si ya se conoce."
};
const normHelp = {
  "Tipo": "Seleccione Interna cuando la norma o lineamiento sea expedido por la organización, y Externa cuando provenga de una autoridad u organismo externo.",
  "Norma": "Nombre y número completo de la norma, resolución, decreto, acuerdo, circular, política, guía o estándar aplicable.",
  "Año": "Año de expedición o versión vigente del documento normativo.",
  "Descripción": "Describa brevemente el objeto o asunto regulado. Ejemplo: Por el cual se actualiza el Modelo Integrado de Planeación y Gestión.",
  "Artículo / sección": "Artículo, numeral, capítulo o sección específica que soporta el procedimiento.",
  "Entidad emisora": "Autoridad, entidad, dependencia u organismo que expide la norma o lineamiento."
};
const activityHelp = {
  "Nombre": "Nombre corto y concreto de la actividad. Ejemplo: Revisar solicitud documental.",
  "Evento que inicia el procedimiento": "La ayuda cambia según el tipo seleccionado. Para Inicio registre el evento activador y para Fin el resultado o condición de cierre.",
  "Resultado o condición de cierre": "La ayuda cambia según el tipo seleccionado. Para Inicio registre el evento activador y para Fin el resultado o condición de cierre.",
  "Actividad": "Nombre corto y concreto de la actividad. Ejemplo: Revisar solicitud documental.",
  "Descripción": "La ayuda cambia según el tipo seleccionado. Para Inicio registre el evento activador y para Fin el resultado o condición de cierre.",
  "Responsable": "Seleccione de la lista el cargo o rol que ejecuta la actividad. Este rol alimenta los carriles del flujograma.",
  "Registro / evidencia": "Opcional. Soporte que demuestra la ejecución de la actividad: formato, correo, acta, registro de sistema, informe, etc.",
  "Sistema / herramienta": "Opcional. Aplicativo, plataforma, archivo, herramienta tecnológica o medio utilizado.",
  "Pregunta de decisión": "La decisión es un elemento de bifurcación del flujo que evalúa una condición y determina la ruta que debe seguir el procedimiento de acuerdo con el resultado obtenido.",
  "Punto de control": "Marque Sí solo cuando la actividad o decisión incorpore una verificación crítica asociada a un riesgo o requisito. Una decisión puede tener o no punto de control.",
  "Ruta Sí": "Seleccione la actividad o destino que sigue cuando la condición se cumple.",
  "Ruta No": "La ruta No debe conducir primero a una actividad que modifique, corrija o complemente la información. Solo después de ese ajuste puede repetirse el punto de control.",
  "Identificador": "El Conector permite continuar el flujo en otro punto o evitar cruces de líneas.",
  "Continuar el flujo en": "El Conector permite continuar el flujo en otro punto o evitar cruces de líneas.",
  "Propósito del control": "Seleccione la acción que mejor representa el propósito del control. El verbo orienta su identificación, pero no determina por sí solo que la actividad constituya un punto de control.",
  "Responsable del control": "Seleccione de la lista el cargo o rol que ejecuta la actividad. Este rol alimenta los carriles del flujograma.",
  "Periodicidad": "Frecuencia con la que se ejecuta el control: por cada trámite, diariamente, mensual, por cada auditoría, etc.",
  "Ejecución del control": "Describa cómo se realiza la verificación: qué se revisa, contra qué criterio y qué acción ejecuta el responsable.",
  "Tratamiento de desviaciones": "Indique qué ocurre cuando el control identifica incumplimientos o desviaciones: devolver, corregir, escalar, solicitar ajustes, etc.",
  "Evidencia del control": "Soporte que demuestra que el control fue ejecutado: correo, firma, formato aprobado, registro del sistema, acta, entre otros."
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
    if (label.nextElementSibling?.classList.contains("help-tip")) continue;
    const text = label.closest(".norm-row") ? normHelp[label.textContent.trim()]
      : label.closest(".activity-row") ? activityHelp[label.textContent.trim()]
      : label.closest(".annex-row") ? annexHelp[label.textContent.trim()]
      : label.closest(".change-row") ? changeHelp[label.textContent.trim()]
      : helpById[label.htmlFor];
    if (!text) continue;
    const help = document.createElement("span");
    help.className = "help-tip";
    help.tabIndex = 0;
    help.textContent = "i";
    help.dataset.tip = text;
    help.setAttribute("role", "button");
    help.setAttribute("aria-label", `Ayuda para ${label.textContent.trim()}`);
    label.after(help);
  }
}

function setupMethodTooltip() {
  const tooltip = ui.methodTooltip;
  if (!tooltip) return;
  const close = () => {
    tooltip.classList.remove("visible");
    tooltip.setAttribute("aria-hidden", "true");
  };
  const show = source => {
    const message = source?.dataset?.tip;
    if (!message) return;
    tooltip.textContent = message;
    tooltip.classList.add("visible");
    tooltip.setAttribute("aria-hidden", "false");
    const rect = source.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 24);
    const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.left));
    const top = Math.min(window.innerHeight - 24, rect.bottom + 8);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };
  document.addEventListener("pointerover", event => {
    const source = event.target.closest(".help-tip");
    if (source) show(source);
  });
  document.addEventListener("pointerout", event => {
    if (event.target.closest(".help-tip")) close();
  });
  document.addEventListener("focusin", event => {
    const source = event.target.closest(".help-tip");
    if (source) show(source);
  });
  document.addEventListener("focusout", event => {
    if (event.target.closest(".help-tip")) close();
  });
  window.addEventListener("scroll", close, true);
}

function showRoleSeparation() {
  const roles = [ui.draftPreparedBy, ui.draftReviewedBy, ui.draftApprovedBy].map(input => input.value.trim().toLocaleLowerCase("es-CO")).filter(Boolean);
  const repeated = roles.length > new Set(roles).size;
  setMessage(ui.roleSeparationMessage, repeated ? "Elaboró, Revisó y Aprobó deben corresponder a cargos distintos." : "");
}

function populateApprovalRoleSelect(select, selected = "", allowedLevels = null) {
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Seleccione un cargo";
  const options = [placeholder];
  const groups = responsibilityRoleGroups.filter(group => !allowedLevels || allowedLevels.includes(group.level));
  const allowedRoles = new Set(groups.flatMap(group => group.cargos));
  for (const group of groups) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.level;
    for (const cargo of group.cargos) optgroup.append(new Option(cargo, cargo));
    options.push(optgroup);
  }
  if (selected && !allowedRoles.has(selected)) {
    const savedGroup = document.createElement("optgroup");
    savedGroup.label = "Valor guardado anteriormente";
    savedGroup.append(new Option("Conservar: " + selected, selected));
    options.push(savedGroup);
  }
  select.replaceChildren(...options);
  select.value = selected;
}

function suggestNextChangeVersion(changes, fallback = "1.0") {
  const validVersion = /^\d+\.\d+$/;
  const highest = [...(Array.isArray(changes) ? changes : [])]
    .map(change => String(change?.version || "").trim())
    .filter(version => validVersion.test(version))
    .reduce((currentHighest, version) => {
      if (!currentHighest) return version;
      const [major, minor] = version.split(".").map(Number);
      const [highestMajor, highestMinor] = currentHighest.split(".").map(Number);
      return major > highestMajor || (major === highestMajor && minor > highestMinor) ? version : currentHighest;
    }, "");
  const fallbackVersion = String(fallback || "").trim();
  const base = highest || (validVersion.test(fallbackVersion) ? fallbackVersion : "1.0");
  const [major, minor] = base.split(".").map(Number);
  return `${major}.${minor + 1}`;
}

function procedureCode(processCode, consecutive) {
  const value = String(consecutive ?? "").trim();
  if (!/^[0-9]{1,3}$/.test(value)) return "";
  const number = Number(value);
  if (!processCode || number < 1 || number > 999) return "";
  return `${processCode}-P-${String(number).padStart(3, "0")}`;
}

function procedureConsecutive(code, processCode) {
  const match = new RegExp(`^${String(processCode || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-P-([0-9]{3})$`).exec(String(code || ""));
  return match ? String(Number(match[1])) : "";
}

function syncProcedureCode() {
  const code = procedureCode(ui.processCode.value, ui.draftConsecutive.value);
  ui.draftCode.value = code;
  const codeLocked = Boolean(currentDraft?.code && currentDraft.status !== "borrador");
  ui.draftCodeStatus.textContent = codeLocked
    ? "El código permanece fijo después del envío a evaluación."
    : code ? "Código generado automáticamente." : "Selecciona el proceso e indica un consecutivo entre 1 y 999.";
}

function displayActivityNumber(activity, index) {
  if (activity?.tipo !== "Actividad") return "";
  return String(activityRows.slice(0, index + 1).filter(item => item?.tipo === "Actividad").length);
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

function confirmDeletion(kind, value) {
  const label = String(value || "").trim();
  const messages = {
    norma: label
      ? `¿Está seguro de eliminar el registro de normatividad “${label}”? Esta acción no se puede deshacer.`
      : "¿Está seguro de eliminar este registro de normatividad? Esta acción no se puede deshacer.",
    actividad: label
      ? `¿Está seguro de eliminar la actividad “${label}”? Esta acción no se puede deshacer.`
      : "¿Está seguro de eliminar este registro de actividad? Esta acción no se puede deshacer.",
    anexo: label
      ? `¿Está seguro de eliminar el documento anexo “${label}”? Esta acción no se puede deshacer.`
      : "¿Está seguro de eliminar este documento anexo? Esta acción no se puede deshacer.",
    cambio: label
      ? `¿Está seguro de eliminar el cambio de versión “${label}”? Esta acción no se puede deshacer.`
      : "¿Está seguro de eliminar este registro de cambio? Esta acción no se puede deshacer."
  };
  return window.confirm(messages[kind]);
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
      if (!confirmDeletion("norma", norm.norma)) return;
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
      if (!confirmDeletion("anexo", annex.documento)) return;
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
      if (!confirmDeletion("cambio", change.version)) return;
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

function createResponsibilityField(activity, index, key, labelText, idPrefix) {
  const field = document.createElement("div");
  field.className = "field";
  const label = document.createElement("label");
  const select = document.createElement("select");
  const otherInput = document.createElement("input");
  const otherFlag = key === "controlResponsable" ? "controlResponsableOtro" : "responsableOtro";
  const value = typeof activity[key] === "string" ? activity[key] : "";
  const isOther = activity[otherFlag] === true || (value && !responsibilityRoleNames.has(value));

  select.id = idPrefix + index;
  label.htmlFor = select.id;
  label.textContent = labelText;
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecciona un cargo";
  select.append(placeholder);
  for (const group of responsibilityRoleGroups) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.level;
    for (const cargo of group.cargos) {
      const option = document.createElement("option");
      option.value = cargo;
      option.textContent = cargo;
      optgroup.append(option);
    }
    select.append(optgroup);
  }
  const otherOption = document.createElement("option");
  otherOption.value = "__otro__";
  otherOption.textContent = "Otro — ¿Cuál?";
  select.append(otherOption);
  select.value = isOther ? "__otro__" : value;

  otherInput.id = idPrefix + "Other" + index;
  otherInput.maxLength = 500;
  otherInput.placeholder = "Especifica el cargo, dependencia o actor";
  otherInput.setAttribute("aria-label", labelText + " — otro cargo, dependencia o actor");
  otherInput.value = isOther ? value : "";
  otherInput.hidden = !isOther;
  if (isOther) activity[otherFlag] = true;
  select.addEventListener("change", () => {
    if (select.value === "__otro__") {
      if (activity[otherFlag] !== true) activity[key] = "";
      activity[otherFlag] = true;
      otherInput.hidden = false;
      otherInput.value = activity[key] || "";
      otherInput.focus();
    } else {
      activity[key] = select.value;
      delete activity[otherFlag];
      otherInput.value = "";
      otherInput.hidden = true;
    }
    markDirty();
  });
  otherInput.addEventListener("input", () => {
    activity[key] = otherInput.value;
    markDirty();
  });
  field.append(label, select, otherInput);
  return field;
}

function activityTextIsFilled(value) {
  return String(value ?? "").trim().length > 0;
}

function activityResponsibilityIsComplete(activity, key, otherKey) {
  const value = String(activity[key] ?? "").trim();
  if (!value) return false;
  if (activity[otherKey] !== true) return true;
  const normalized = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return !/^(varios|todos|quien corresponda|n\/?a|no aplica)$/.test(normalized);
}

function activityRowIsComplete(activity) {
  if (!activity) return false;
  if (["Inicio", "Fin"].includes(activity.tipo)) return activityTextIsFilled(activity.descripcion);
  if (activity.tipo === "Conector") return activityTextIsFilled(activity.connectorId) && activityTextIsFilled(activity.connectorDestino);
  const responsible = activityResponsibilityIsComplete(activity, "responsable", "responsableOtro");
  if (activity.tipo === "Decisión") {
    return activityTextIsFilled(activity.descripcion) && responsible && activityTextIsFilled(activity.decisionSi) &&
      activityTextIsFilled(activity.decisionNo) && activity.decisionSi !== activity.decisionNo;
  }
  const controlComplete = activity.tieneControl !== true || (
    activityResponsibilityIsComplete(activity, "controlResponsable", "controlResponsableOtro") &&
    [activity.controlPeriodicidad, activity.controlAccion, activity.controlEjecucion, activity.controlDesviacion, activity.controlEvidencia].every(activityTextIsFilled)
  );
  return activityTextIsFilled(activity.actividad) && activityTextIsFilled(activity.descripcion) && responsible && controlComplete;
}

function renderActivities() {
  ui.emptyActivities.hidden = activityRows.length > 0;
  ui.addBoundaryButton.hidden = activityRows.some(activity => activity.tipo === "Inicio") && activityRows.some(activity => activity.tipo === "Fin");
  ui.activitiesList.replaceChildren(...activityRows.map((activity, index) => {
    const row = document.createElement("div");
    const isBoundary = ["Inicio", "Fin"].includes(activity.tipo);
    const isCollapsed = !isBoundary && collapsedActivityUids.has(activity.uid);
    row.className = [
      "activity-row",
      isCollapsed ? "is-collapsed" : "",
      activity.tipo === "Decisión" ? "decision-row" : "",
      activity.tipo === "Conector" ? "connector-row" : "",
      activity.tieneControl === true ? "control-row" : ""
    ].filter(Boolean).join(" ");
    const heading = document.createElement("div");
    heading.className = "activity-heading";
    const title = document.createElement("h4");
    title.textContent = activity.tipo === "Actividad" ? "Actividad " + displayActivityNumber(activity, index)
      : activity.tipo === "Conector" ? "Conector " + String(activity.connectorId || "")
      : String(activity.tipo || "Elemento del flujo");
    heading.append(title);
    const editable = activity.tipo === "Actividad" || (["Decisión", "Conector"].includes(activity.tipo) && !activity.tieneControl);
    if (!isBoundary) {
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
      const collapse = document.createElement("button");
      collapse.type = "button";
      collapse.className = "secondary-button collapse-button";
      collapse.dataset.collapseUid = activity.uid;
      collapse.textContent = isCollapsed ? "Expandir" : "Contraer";
      collapse.setAttribute("aria-expanded", String(!isCollapsed));
      collapse.addEventListener("click", () => {
        if (collapsedActivityUids.has(activity.uid)) collapsedActivityUids.delete(activity.uid);
        else collapsedActivityUids.add(activity.uid);
        renderActivities();
        [...ui.activitiesList.querySelectorAll("[data-collapse-uid]")]
          .find(button => button.dataset.collapseUid === activity.uid)?.focus();
      });
      actions.append(collapse);
      heading.append(actions);
    }
    if (editable) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary-button";
      remove.textContent = "Eliminar";
      remove.setAttribute("aria-label", `Eliminar ${activity.tipo.toLocaleLowerCase("es-CO")} ${displayActivityNumber(activity, index) || "del flujo"}`);
      remove.addEventListener("click", () => {
        if (activityRows.some(other => other !== activity && [other.decisionSi, other.decisionNo, other.connectorDestino].includes(activity.uid))) {
          window.alert("Esta actividad es destino de una ruta. Cambia primero esa ruta.");
          return;
        }
        if (!confirmDeletion("actividad", activity.actividad || activity.descripcion)) return;
        activityRows.splice(index, 1);
        renderActivities();
        markDirty();
      });
      heading.querySelector(".activity-actions")?.append(remove);
    }
    row.append(heading);
    if (isCollapsed) {
      const summary = document.createElement("div");
      summary.className = "activity-collapsed-summary";
      const description = document.createElement("strong");
      description.textContent = String(activity.tipo === "Decisión"
        ? activity.descripcion || "Decisión sin pregunta"
        : activity.tipo === "Conector"
          ? activity.connectorId ? `Conector ${activity.connectorId}` : activity.actividad || "Conector sin identificador"
          : activity.actividad || activity.descripcion || "Actividad sin nombre");
      summary.append(description);
      const responsibleLabel = document.createElement("span");
      responsibleLabel.textContent = `Responsable: ${activity.responsable || "Responsable pendiente"}`;
      summary.append(responsibleLabel);
      const complete = activityRowIsComplete(activity);
      const completion = document.createElement("span");
      completion.className = `activity-completion-tag${complete ? "" : " pending"}`;
      completion.textContent = complete ? "Completa" : "Pendiente";
      summary.append(completion);
      if (activity.tieneControl === true) {
        const control = document.createElement("span");
        control.className = "activity-summary-tag control-summary-tag";
        control.textContent = "Punto de control";
        summary.append(control);
      }
      row.append(summary);
      return row;
    }
    if (isBoundary) {
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
      row.append(createResponsibilityField(activity, index, "responsable", "Responsable", "decisionResponsible"));
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
      if (key === "responsable") {
        grid.append(createResponsibilityField(activity, index, key, labelText, "activityResponsible"));
        continue;
      }
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
        if (key === "controlResponsable") {
          details.append(createResponsibilityField(activity, index, key, labelText, "controlResponsible"));
          continue;
        }
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
  if (Array.isArray(error.details) && error.details.length) {
    const details = error.code === "correction_responses_required"
      ? `${error.details.length} criterio(s): ${error.details.join(", ")}`
      : error.details.slice(0, 4).join("\n");
    return `${errorMessages[error.code] || "Revisa los datos."}\n${details}`;
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
    error.details = result.details;
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
    } else if (["procedure_evaluation_started", "procedure_returned_for_corrections", "procedure_favorable_concept_issued", "procedure_unfavorable_concept_issued"].includes(notification.eventType) && ["elaborador", "administrador"].includes(currentUserRole)) {
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
  currentEvaluation = null;
  returnedEvaluation = null;
  returnedResponsesDirty = false;
  ui.evaluationWorkspace.hidden = true;
  ui.returnedEvaluation.hidden = true;
  normRows = [];
  renderNorms();
  collapsedActivityUids.clear();
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
  ui.evaluationWorkspace.hidden = true;
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
    syncProcedureCode();
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

async function loadEvaluationRubric() {
  if (!evaluationRubric) {
    const result = await request("/api/evaluator/rubric");
    evaluationRubric = result.rubric;
  }
  return evaluationRubric;
}

function evaluationCriteriaList() {
  return evaluationRubric?.groups.flatMap(group => group.criteria) || [];
}

function evaluationCriterionComplete(criterion) {
  const record = currentEvaluation?.criteria?.[criterion.id] || {};
  if (!record.result) return false;
  if (record.result === "No aplica") {
    return criterion.newProcedureNotApplicable && /^0*1(?:\.0+)*$/.test(String(currentDraft?.version || "1.0"));
  }
  if (!String(record.observation || "").trim()) return false;
  return record.result === "Cumple" || (record.result === "No cumple" && Boolean(String(record.adjustment || "").trim()));
}

function evaluationGroupState(group) {
  const completed = group.criteria.filter(evaluationCriterionComplete).length;
  const answered = group.criteria.filter(criterion => currentEvaluation?.criteria?.[criterion.id]?.result).length;
  if (completed === group.criteria.length) return { className: "group-complete", label: "Completa", completed };
  if (answered) return { className: "group-progress", label: "En proceso", completed };
  return { className: "group-pending", label: "Pendiente", completed };
}

function localEvaluationMetrics() {
  if (!evaluationRubric || !currentEvaluation) return null;
  let answered = 0;
  let failures = 0;
  let criticalFailures = 0;
  let openFindings = 0;
  let weighted = 0;
  const groups = evaluationRubric.groups.map(group => {
    let applicable = 0;
    let passed = 0;
    let groupAnswered = 0;
    for (const criterion of group.criteria) {
      const record = currentEvaluation.criteria[criterion.id] || {};
      const notApplicable = record.result === "No aplica" && criterion.newProcedureNotApplicable && /^0*1(?:\.0+)*$/.test(String(currentDraft?.version || "1.0"));
      if (record.result) { answered += 1; groupAnswered += 1; }
      if (!notApplicable) applicable += 1;
      if (record.result === "Cumple") passed += 1;
      if (record.result === "No cumple") {
        failures += 1;
        if (criterion.critical) criticalFailures += 1;
        if (record.findingStatus !== "Cerrado") openFindings += 1;
      }
    }
    const score = applicable ? passed / applicable * 100 : 100;
    weighted += score * group.weight / 100;
    return { id: group.id, name: group.name, weight: group.weight, answered: groupAnswered, total: group.criteria.length,
      score: Math.round(score * 10) / 10, state: evaluationGroupState(group) };
  });
  const score = Math.round(weighted * 10) / 10;
  const complete = answered === evaluationCriteriaList().length;
  return { answered, total: evaluationCriteriaList().length, failures, criticalFailures, openFindings, score,
    level: !complete ? "Pendiente" : score <= 39 ? "Bajo" : score < 90 ? "Medio" : "Alto", groups };
}

function refreshEvaluationSummary() {
  const metrics = localEvaluationMetrics();
  if (!metrics) return;
  ui.evaluationProgress.textContent = `${metrics.answered} de ${metrics.total} criterios evaluados · ${metrics.failures} incumplidos · ${metrics.criticalFailures} críticos`;
  ui.evaluationScore.textContent = `${metrics.score.toFixed(1)}%`;
  ui.evaluationLevel.textContent = metrics.level;
  ui.evaluationVariableResults.replaceChildren(...metrics.groups.map(group => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `evaluation-variable-result ${group.state.className}`;
    const name = document.createElement("strong");
    name.textContent = group.name;
    const state = document.createElement("span");
    state.className = "evaluation-group-status";
    state.textContent = group.state.label;
    const result = document.createElement("span");
    result.className = "evaluation-variable-score";
    result.textContent = `${group.answered}/${group.total} · ${group.score.toFixed(1)}% · peso ${group.weight}%`;
    const toggle = document.createElement("span");
    toggle.className = "evaluation-variable-toggle";
    toggle.setAttribute("aria-hidden", "true");
    toggle.textContent = "+";
    item.append(name, toggle, state, result);
    item.addEventListener("click", () => {
      const details = [...ui.evaluationCriteriaGroups.children].find(element => element.dataset.groupId === group.id);
      if (!details) return;
      details.open = true;
      details.scrollIntoView({ behavior: "smooth", block: "start" });
      details.querySelector("summary")?.focus({ preventScroll: true });
    });
    return item;
  }));
  metrics.groups.forEach(group => {
    const details = [...ui.evaluationCriteriaGroups.children].find(element => element.dataset.groupId === group.id);
    if (!details) return;
    details.className = `evaluation-group ${group.state.className}`;
    details.querySelector(".evaluation-group-status").textContent = group.state.label;
    details.querySelector(".evaluation-group-score").textContent = `${group.answered}/${group.total} · ${group.score.toFixed(1)}%`;
    details.querySelector(".evaluation-group-progress-fill").style.width = `${Math.round(group.state.completed / group.total * 100)}%`;
  });
}

function evaluationField(grid, text, control) {
  const field = document.createElement("div");
  field.className = "field";
  const label = document.createElement("label");
  label.htmlFor = control.id;
  label.textContent = text;
  field.append(label, control);
  grid.append(field);
  return control;
}

function renderEvaluationWorkspace() {
  const visible = Boolean(currentEvaluation && evaluationRubric && currentDraft?.status !== "enviado_a_evaluacion" && currentDraft?.status !== "subsanado");
  ui.evaluationWorkspace.hidden = !visible;
  if (!visible) return;
  const editable = currentDraft.status === "en_evaluacion";
  ui.evaluationCriteriaGroups.replaceChildren(...evaluationRubric.groups.map((group, groupIndex) => {
    const details = document.createElement("details");
    details.className = "evaluation-group";
    details.dataset.groupId = group.id;
    details.open = groupIndex === 0;
    const heading = document.createElement("summary");
    const toggle = document.createElement("span");
    toggle.className = "evaluation-group-toggle";
    toggle.setAttribute("aria-hidden", "true");
    const title = document.createElement("strong");
    title.textContent = `${groupIndex + 1}. ${group.name}`;
    const weight = document.createElement("span");
    weight.className = "evaluation-group-weight";
    weight.textContent = `${group.weight}%`;
    const progress = document.createElement("span");
    progress.className = "evaluation-group-progress";
    const status = document.createElement("span");
    status.className = "evaluation-group-status";
    const track = document.createElement("span");
    track.className = "evaluation-group-progress-track";
    const fill = document.createElement("span");
    fill.className = "evaluation-group-progress-fill";
    track.append(fill);
    const score = document.createElement("span");
    score.className = "evaluation-group-score";
    progress.append(status, track, score);
    heading.append(toggle, title, weight, progress);
    const description = document.createElement("p");
    description.className = "evaluation-group-description";
    description.textContent = group.description;
    details.append(heading, description);
    group.criteria.forEach(criterion => {
      const record = currentEvaluation.criteria[criterion.id] || (currentEvaluation.criteria[criterion.id] = {
        result: "", evidence: "", observation: "", adjustment: "", findingStatus: "Pendiente", response: ""
      });
      const card = document.createElement("div");
      card.className = `evaluation-criterion${record.result === "No cumple" ? " failed" : record.result === "Cumple" ? " passed" : record.result === "No aplica" ? " na" : ""}`;
      const question = document.createElement("h4");
      question.textContent = criterion.question;
      if (criterion.critical) {
        const tag = document.createElement("span");
        tag.className = "critical-tag";
        tag.textContent = "Crítico";
        question.append(tag);
      }
      const grid = document.createElement("div");
      grid.className = "evaluation-criterion-grid";
      const result = document.createElement("select");
      result.id = `evalResult-${criterion.id}`;
      const options = [["", "Selecciona resultado"], ["Cumple", "Cumple"], ["No cumple", "No cumple"]];
      if (criterion.newProcedureNotApplicable && /^0*1(?:\.0+)*$/.test(String(currentDraft.version || "1.0"))) options.push(["No aplica", "No aplica"]);
      result.replaceChildren(...options.map(([value, label]) => new Option(label, value)));
      result.value = record.result || "";
      result.disabled = !editable;
      const observation = document.createElement("textarea");
      observation.id = `evalObservation-${criterion.id}`;
      observation.maxLength = 5000;
      observation.value = record.observation || "";
      observation.disabled = !editable;
      observation.placeholder = "Explica la evidencia y el motivo del resultado.";
      const adjustment = document.createElement("textarea");
      adjustment.id = `evalAdjustment-${criterion.id}`;
      adjustment.maxLength = 5000;
      adjustment.value = record.adjustment || "";
      adjustment.disabled = !editable;
      adjustment.placeholder = "Acción concreta cuando el criterio no cumple.";
      adjustment.required = record.result === "No cumple";
      const findingStatus = document.createElement("select");
      findingStatus.id = `evalFinding-${criterion.id}`;
      findingStatus.replaceChildren(...["Pendiente", "Respondido", "Subsanado", "Cerrado"].map(value => new Option(value, value)));
      findingStatus.value = record.findingStatus || "Pendiente";
      findingStatus.disabled = !editable;
      evaluationField(grid, "Resultado", result);
      evaluationField(grid, "Observación", observation);
      evaluationField(grid, "Ajuste requerido", adjustment);
      evaluationField(grid, "Estado del hallazgo", findingStatus);
      if (record.response) {
        const response = document.createElement("p");
        response.className = "field-hint";
        response.textContent = `Respuesta del Elaborador: ${record.response}`;
        grid.append(response);
      }
      result.addEventListener("change", () => {
        const oldDefault = standardEvaluationObservation(criterion.question, record.result);
        record.result = result.value;
        if (!record.observation || record.observation === oldDefault) {
          record.observation = standardEvaluationObservation(criterion.question, result.value);
          observation.value = record.observation;
        }
        if (["Cumple", "No aplica"].includes(result.value)) record.findingStatus = "Cerrado";
        else if (result.value === "No cumple" && record.findingStatus === "Cerrado") record.findingStatus = "Pendiente";
        findingStatus.value = record.findingStatus;
        adjustment.required = result.value === "No cumple";
        card.className = `evaluation-criterion${result.value === "No cumple" ? " failed" : result.value === "Cumple" ? " passed" : result.value === "No aplica" ? " na" : ""}`;
        refreshEvaluationSummary();
      });
      observation.addEventListener("input", () => { record.observation = observation.value; refreshEvaluationSummary(); });
      adjustment.addEventListener("input", () => { record.adjustment = adjustment.value; refreshEvaluationSummary(); });
      findingStatus.addEventListener("change", () => { record.findingStatus = findingStatus.value; refreshEvaluationSummary(); });
      card.append(question, grid);
      details.append(card);
    });
    return details;
  }));
  ui.evaluationConcept.value = currentEvaluation.concept || "";
  ui.evaluationConcept.disabled = !editable;
  for (const button of [ui.saveEvaluationButton, ui.returnEvaluationButton, ui.unfavorableEvaluationButton, ui.favorableEvaluationButton]) button.hidden = !editable;
  setMessage(ui.evaluationMessage, "");
  refreshEvaluationSummary();
}

function standardEvaluationObservation(question, result) {
  if (result === "No aplica") return "No aplica por tratarse de un procedimiento nuevo.";
  if (!["Cumple", "No cumple"].includes(result)) return "";
  const statement = question.replace(/^¿/, "").replace(/\?$/, "").trim();
  return result === "Cumple" ? `Se verifica el cumplimiento del criterio: ${statement}.` : `No se evidencia el cumplimiento del criterio: ${statement}.`;
}

function renderReturnedEvaluation() {
  ui.returnedEvaluation.hidden = !returnedEvaluation || !["devuelto_para_ajustes", "concepto_favorable", "concepto_no_favorable"].includes(currentDraft?.status);
  if (ui.returnedEvaluation.hidden) return;
  const editable = currentDraft.status === "devuelto_para_ajustes";
  ui.returnedEvaluationSummary.textContent = `${statusLabel(currentDraft.status)} · ${Number(returnedEvaluation.score || 0).toFixed(1)}%`;
  ui.returnedEvaluationConcept.textContent = returnedEvaluation.concept ? `Concepto técnico: ${returnedEvaluation.concept}` : "";
  const questions = new Map(evaluationCriteriaList().map(criterion => [criterion.id, criterion.question]));
  const failed = Object.entries(returnedEvaluation.criteria || {}).filter(([, record]) => record.result === "No cumple");
  ui.returnedFindings.replaceChildren(...failed.map(([id, record]) => {
    const item = document.createElement("div");
    item.className = "returned-finding";
    const title = document.createElement("h4");
    title.textContent = questions.get(id) || id;
    const observation = document.createElement("p");
    observation.textContent = `Observación: ${record.observation || "Sin detalle"}`;
    const adjustment = document.createElement("p");
    adjustment.textContent = `Ajuste requerido: ${record.adjustment || "Sin detalle"}`;
    item.append(title, observation, adjustment);
    const grid = document.createElement("div");
    const response = document.createElement("textarea");
    response.id = `authorResponse-${id}`;
    response.maxLength = 5000;
    response.value = record.response || "";
    response.disabled = !editable;
    response.addEventListener("input", () => { record.response = response.value; returnedResponsesDirty = true; });
    evaluationField(grid, "Respuesta del Elaborador", response);
    item.append(grid);
    return item;
  }));
  if (!failed.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No se registraron criterios incumplidos.";
    ui.returnedFindings.append(empty);
  }
  ui.saveEvaluationResponses.hidden = !editable;
  setMessage(ui.returnedEvaluationMessage, "");
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
      detail.textContent = `${procedure.code || "Código pendiente"} · ${procedure.processCode} · ${statusLabel(procedure.status)}`;
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
    details.textContent = `${draft.code || "Código pendiente"} · ${draft.processCode}` + (date ? " · " + date : "");

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
    if (procedure.evaluation) await loadEvaluationRubric();
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
  returnedEvaluation = procedure.evaluation || null;
  returnedResponsesDirty = false;
  currentPayload = procedure.payload && typeof procedure.payload === "object" && !Array.isArray(procedure.payload) ? procedure.payload : {};
  normRows = Array.isArray(currentPayload.norms) ? currentPayload.norms.map(norm => norm && typeof norm === "object" && !Array.isArray(norm) ? { ...norm } : {}) : [];
  renderNorms();
  collapsedActivityUids.clear();
  activityRows = Array.isArray(currentPayload.activities) ? currentPayload.activities.map(activity => activity && typeof activity === "object" && !Array.isArray(activity) ? { ...activity, uid: activity.uid || crypto.randomUUID() } : { uid: crypto.randomUUID() }) : [];
  renderActivities();
  annexRows = Array.isArray(currentPayload.annexes) ? currentPayload.annexes.map(annex => annex && typeof annex === "object" && !Array.isArray(annex) ? { ...annex } : {}) : [];
  changeRows = Array.isArray(currentPayload.changes) ? currentPayload.changes.map(change => change && typeof change === "object" && !Array.isArray(change) ? { ...change } : {}) : [];
  annexesNotApplicable = currentPayload.settings?.annexesNotApplicable === true;
  renderAnnexes();
  renderChanges();
  setMessage(ui.documentsMessage, "");
  ui.draftName.value = procedure.name;
  for (const [inputId, fieldId] of textFields) {
    const value = typeof currentPayload.fields?.[fieldId] === "string" ? currentPayload.fields[fieldId] : "";
    if (inputId === "draftPreparedBy" || inputId === "draftReviewedBy") populateApprovalRoleSelect(ui[inputId], value);
    else if (inputId === "draftApprovedBy") populateApprovalRoleSelect(ui[inputId], value, ["Directivo"]);
    else ui[inputId].value = value;
  }
  showRoleSeparation();
  const option = document.createElement("option");
  option.value = procedure.processCode;
  option.textContent = `${processNames.get(procedure.processCode) || procedure.processCode} (${procedure.processCode})`;
  ui.processCode.replaceChildren(option);
  ui.processCode.value = procedure.processCode;
  ui.draftConsecutive.value = procedureConsecutive(procedure.code, procedure.processCode);
  syncProcedureCode();
  ui.editorTitle.textContent = "Editar borrador";
  ui.editorStatus.textContent = `${statusLabel(procedure.status)} · revisión ${procedure.revision}`;
  ui.saveDraftButton.textContent = "Guardar cambios";
  ui.saveDocumentsButton.textContent = "Guardar cambios";
  dirty = false;
  setMessage(ui.editorMessage, "");
  ui.flowReviewResult.hidden = true;
  ui.flowReviewResult.replaceChildren();
  renderReturnedEvaluation();
  applyDraftEditability();
}

function applyDraftEditability() {
  const editable = ["elaborador", "administrador"].includes(currentUserRole) && (!currentDraft || ["borrador", "devuelto_para_ajustes"].includes(currentDraft.status));
  for (const control of ui.draftForm.querySelectorAll("input, select, textarea, button")) control.disabled = !editable;
  ui.draftCode.disabled = false;
  ui.draftConsecutive.disabled = !editable || Boolean(currentDraft?.code && currentDraft.status !== "borrador");
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
    await loadEvaluationRubric();
    const { procedure, evaluation } = await request(`/api/evaluator/procedures/${encodeURIComponent(id)}`);
    populateDraft(procedure);
    currentEvaluation = evaluation;
    ui.processCode.disabled = true;
    ui.draftWorkspace.hidden = true;
    ui.evaluatorInbox.hidden = true;
    ui.evaluatorDetail.hidden = false;
    ui.evaluatorDetailTitle.textContent = procedure.name;
    ui.evaluatorDetailStatus.textContent = `${procedure.code || "Código pendiente"} · ${procedure.processCode} · ${statusLabel(procedure.status)} · revisión ${procedure.revision}`;
    ui.startEvaluationButton.hidden = procedure.status !== "enviado_a_evaluacion" && procedure.status !== "subsanado";
    ui.previewButton.hidden = false;
    renderEvaluationWorkspace();
  } catch (error) {
    handleRequestError(error, ui.evaluatorInboxMessage);
  }
}

function newDraft() {
  if (dirty && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
  flowReviewVersion += 1;
  currentDraft = null;
  returnedEvaluation = null;
  returnedResponsesDirty = false;
  ui.returnedEvaluation.hidden = true;
  currentPayload = { fields: {}, norms: [], activities: [], annexes: [], changes: [], settings: {} };
  normRows = [];
  renderNorms();
  collapsedActivityUids.clear();
  activityRows = [boundaryRecord("Inicio"), boundaryRecord("Fin")];
  renderActivities();
  annexRows = [];
  changeRows = [{ version: "1.0", fecha: todayLocal(), razon: "Creación inicial del procedimiento" }];
  annexesNotApplicable = false;
  renderAnnexes();
  renderChanges();
  setMessage(ui.documentsMessage, "");
  ui.draftForm.reset();
  populateApprovalRoleSelect(ui.draftPreparedBy);
  populateApprovalRoleSelect(ui.draftReviewedBy);
  populateApprovalRoleSelect(ui.draftApprovedBy, "", ["Directivo"]);
  for (const [inputId] of textFields) ui[inputId].value = "";
  showRoleSeparation();
  syncProcedureCode();
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
ui.processCode.addEventListener("change", syncProcedureCode);
ui.draftConsecutive.addEventListener("input", syncProcedureCode);
for (const inputId of ["draftPreparedBy", "draftReviewedBy", "draftApprovedBy"]) {
  ui[inputId].addEventListener("change", showRoleSeparation);
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
  const fallbackVersion = String(currentPayload.fields?.version || "1.0");
  changeRows.push({ version: suggestNextChangeVersion(changeRows, fallbackVersion), fecha: todayLocal(), razon: "" });
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
  const body = { name, processCode: ui.processCode.value, consecutive: ui.draftConsecutive.value, payload };

  try {
    const result = currentDraft
      ? await request("/api/procedures/" + encodeURIComponent(currentDraft.id), {
          method: "PUT",
          body: { name, consecutive: ui.draftConsecutive.value, payload, revision: currentDraft.revision },
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
    ui.draftConsecutive.value = procedureConsecutive(currentDraft.code, currentDraft.processCode);
    syncProcedureCode();
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
async function saveReturnedResponses() {
  if (!currentDraft || !returnedEvaluation || currentDraft.status !== "devuelto_para_ajustes") return;
  const responses = Object.fromEntries(Object.entries(returnedEvaluation.criteria)
    .filter(([, record]) => record.result === "No cumple")
    .map(([id, record]) => [id, record.response || ""]));
  const result = await request(`/api/procedures/${encodeURIComponent(currentDraft.id)}/evaluation-responses`, {
    method: "PUT", csrf: true, body: { responses }
  });
  returnedResponsesDirty = false;
  setMessage(ui.returnedEvaluationMessage, result.missingResponses
    ? `Respuestas guardadas. Faltan ${result.missingResponses} hallazgo(s) por responder.`
    : "Respuestas guardadas.", true);
  return result;
}

ui.saveEvaluationResponses.addEventListener("click", async () => {
  ui.saveEvaluationResponses.disabled = true;
  try {
    await saveReturnedResponses();
  } catch (error) {
    handleRequestError(error, ui.returnedEvaluationMessage);
  } finally {
    ui.saveEvaluationResponses.disabled = false;
  }
});

ui.submitReviewButton.addEventListener("click", async () => {
  if (!currentDraft) return;
  if (dirty) {
    setMessage(ui.editorMessage, "Guarda los cambios antes de enviar el procedimiento.");
    return;
  }
  setMessage(ui.submitReviewMessage, "");
  try {
    if (currentDraft.status === "devuelto_para_ajustes" && returnedEvaluation) {
      const missing = Object.values(returnedEvaluation.criteria).filter(record => record.result === "No cumple" && !String(record.response || "").trim());
      if (missing.length) {
        setMessage(ui.editorMessage, `Responde ${missing.length} hallazgo(s) antes de reenviar.`);
        ui.returnedEvaluation.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }
      if (returnedResponsesDirty) await saveReturnedResponses();
    }
    const { issues, completenessIssues } = await request("/api/procedures/flow-review", {
      method: "POST", csrf: true,
      body: { activities: activityRows.map(activity => ({ ...activity })) }
    });
    showFlowReview(issues, completenessIssues);
    const blockingIssues = issues.filter(issue => issue.severity !== "warning");
    if (blockingIssues.length || completenessIssues.length) {
      setMessage(ui.editorMessage, "Corrige las fallas del flujo y los campos obligatorios antes de enviar a evaluación.");
      ui.flowReviewResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }

    ui.reviewEvaluatorSelect.replaceChildren(new Option("Cargando evaluadores...", ""));
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
    renderReturnedEvaluation();
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
  ui.evaluationWorkspace.hidden = true;
  ui.evaluatorInbox.hidden = false;
  ui.flowSection.hidden = true;
  ui.previewButton.hidden = true;
});
ui.startEvaluationButton.addEventListener("click", async () => {
  if (!currentDraft) return;
  ui.startEvaluationButton.disabled = true;
  try {
    const id = currentDraft.id;
    await request(`/api/evaluator/procedures/${encodeURIComponent(id)}/start`, { method: "POST", csrf: true, body: {} });
    await openAssignedProcedure(id);
    setMessage(ui.evaluationMessage, "Evaluación iniciada. Puedes registrar los criterios.", true);
    await loadEvaluatorInbox();
  } catch (error) {
    handleRequestError(error, ui.evaluatorInboxMessage);
  } finally {
    ui.startEvaluationButton.disabled = false;
  }
});

async function saveCurrentEvaluation() {
  if (!currentDraft || !currentEvaluation || currentDraft.status !== "en_evaluacion") return;
  const { evaluation } = await request(`/api/evaluator/procedures/${encodeURIComponent(currentDraft.id)}/evaluation`, {
    method: "PUT", csrf: true,
    body: { criteria: currentEvaluation.criteria, concept: ui.evaluationConcept.value }
  });
  Object.assign(currentEvaluation, {
    status: evaluation.status,
    score: evaluation.score,
    criticalFailures: evaluation.criticalFailures,
    openFindings: evaluation.openFindings,
    concept: evaluation.concept,
    metrics: evaluation.metrics,
    updatedAt: evaluation.updatedAt
  });
  refreshEvaluationSummary();
  setMessage(ui.evaluationMessage, "Evaluación guardada.", true);
  return evaluation;
}

ui.saveEvaluationButton.addEventListener("click", async () => {
  ui.saveEvaluationButton.disabled = true;
  try {
    await saveCurrentEvaluation();
  } catch (error) {
    handleRequestError(error, ui.evaluationMessage);
  } finally {
    ui.saveEvaluationButton.disabled = false;
  }
});

async function submitEvaluationDecision(decision) {
  if (!currentDraft || currentDraft.status !== "en_evaluacion") return;
  const label = decision === "devolver" ? "devolver para ajustes"
    : decision === "favorable" ? "emitir concepto favorable" : "emitir concepto no favorable";
  if (!window.confirm(`¿Confirmas ${label} para este procedimiento?`)) return;
  try {
    const id = currentDraft.id;
    await saveCurrentEvaluation();
    await request(`/api/evaluator/procedures/${encodeURIComponent(id)}/decision`, {
      method: "POST", csrf: true, body: { decision }
    });
    await openAssignedProcedure(id);
    await loadEvaluatorInbox();
    setMessage(ui.evaluationMessage, "Decisión registrada y notificada al Elaborador.", true);
  } catch (error) {
    handleRequestError(error, ui.evaluationMessage);
  }
}

ui.returnEvaluationButton.addEventListener("click", () => submitEvaluationDecision("devolver"));
ui.unfavorableEvaluationButton.addEventListener("click", () => submitEvaluationDecision("no_favorable"));
ui.favorableEvaluationButton.addEventListener("click", () => submitEvaluationDecision("favorable"));
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

function previewFitScale(viewportWidth, contentWidth) {
  const available = Number(viewportWidth);
  const total = Number(contentWidth);
  if (!Number.isFinite(available) || !Number.isFinite(total) || available <= 0 || total <= 0) return 1;
  return Math.max(0.05, Math.min(1, available / total));
}

function createPreviewDiagramControls(diagram, svg) {
  const sourceWidth = Number(svg.getAttribute("width")) || svg.viewBox?.baseVal.width || 0;
  let zoom = 1;
  const toolbar = document.createElement("div");
  toolbar.className = "preview-diagram-toolbar";
  const group = document.createElement("div");
  group.className = "preview-diagram-tools";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Controles de zoom del flujograma");
  const fitButton = document.createElement("button");
  fitButton.type = "button";
  fitButton.className = "secondary-button preview-fit-button";
  fitButton.textContent = "Ajustar al ancho";
  fitButton.addEventListener("click", fitToWidth);
  const zoomOut = document.createElement("button");
  zoomOut.type = "button";
  zoomOut.className = "secondary-button preview-zoom-button";
  zoomOut.textContent = "−";
  zoomOut.title = "Reducir el flujograma";
  zoomOut.setAttribute("aria-label", "Reducir el flujograma");
  zoomOut.addEventListener("click", () => { zoom = Math.max(0.05, zoom / 1.15); applyZoom(); });
  const zoomValue = document.createElement("output");
  zoomValue.className = "preview-zoom-value";
  zoomValue.setAttribute("aria-live", "polite");
  const zoomIn = document.createElement("button");
  zoomIn.type = "button";
  zoomIn.className = "secondary-button preview-zoom-button";
  zoomIn.textContent = "+";
  zoomIn.title = "Ampliar el flujograma";
  zoomIn.setAttribute("aria-label", "Ampliar el flujograma");
  zoomIn.addEventListener("click", () => { zoom = Math.min(1.8, zoom * 1.15); applyZoom(); });
  group.append(fitButton, zoomOut, zoomValue, zoomIn);
  toolbar.append(group);

  function applyZoom() {
    if (sourceWidth > 0) svg.style.width = `${Math.round(sourceWidth * zoom)}px`;
    zoomValue.textContent = `${Math.round(zoom * 100)}%`;
    zoomOut.disabled = zoom <= 0.05;
    zoomIn.disabled = zoom >= 1.8;
  }

  function fitToWidth() {
    zoom = previewFitScale(diagram.clientWidth - 30, sourceWidth);
    applyZoom();
    diagram.scrollTo({ left: 0, top: 0 });
  }

  applyZoom();
  return { toolbar, fitToWidth };
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
  for (const [label, value] of [["Código", ui.draftCode.value || "Pendiente"], ["Versión", changeRows.at(-1)?.version || "1.0"], ["Estado", currentDraft?.status || "Borrador"]]) {
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
    const row = [displayActivityNumber(activity, index), activity.tipo || "", activity.actividad || "", description.join("\n"), activity.responsable || "", control];
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
  let fitPreviewDiagram = () => {};
  renderFlow();
  if (activityRows.length) {
    const svg = ui.flowSvg.cloneNode(true);
    svg.removeAttribute("id");
    svg.removeAttribute("style");
    const controls = createPreviewDiagramControls(diagram, svg);
    flowSection.append(controls.toolbar);
    fitPreviewDiagram = controls.fitToWidth;
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
  requestAnimationFrame(fitPreviewDiagram);
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
populateApprovalRoleSelect(ui.draftPreparedBy);
populateApprovalRoleSelect(ui.draftReviewedBy);
populateApprovalRoleSelect(ui.draftApprovedBy, "", ["Directivo"]);
installMethodHelps(document);
setupMethodTooltip();
if (csrfToken) request("/api/auth/me").then(({ user }) => startSession(user)).catch(clearSession);
