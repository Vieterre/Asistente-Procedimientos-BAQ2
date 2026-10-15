const ids = [
  "loginView", "loginForm", "loginUsername", "loginPassword", "loginOtp", "loginMessage",
  "workspace", "sessionControls", "sessionIdentity", "notificationCenter", "notificationBell", "notificationPopover", "notificationCount", "emptyNotifications", "notificationList", "markAllNotificationsRead", "logoutButton", "welcomeText",
  "pageHeading", "analyticsButton", "analyticsSection", "analyticsTitle", "analyticsScope", "backFromAnalytics", "refreshAnalytics", "analyticsFilters", "analyticsPeriod", "analyticsProcess", "analyticsRole", "analyticsProcessField", "analyticsRoleField", "analyticsByProcessSection", "exportAnalyticsButton", "analyticsMessage", "analyticsMetrics", "analyticsByDay", "analyticsByProcess", "emptyAnalyticsDays", "emptyAnalyticsProcesses", "analyticsLogins", "emptyAnalyticsLogins", "analyticsUsageMetrics",
  "institutionalReportsButton", "institutionalReportsSection", "institutionalReportsCount", "institutionalReportsMessage", "emptyInstitutionalReports", "institutionalReportsList", "backFromInstitutionalReports", "refreshInstitutionalReports",
  "passwordRequired", "draftWorkspace", "editorSection", "editorHeading", "draftForm", "editorTitle", "editorStatus", "submitReviewButton", "submitReviewDialog", "submitReviewForm", "reviewEvaluatorSelect", "submitReviewMessage", "cancelSubmitReview", "confirmSubmitReview",
  "evaluatorInbox", "evaluatorDraftCount", "evaluatorInboxMessage", "emptyEvaluatorInbox", "evaluatorDraftList", "refreshEvaluatorInbox", "evaluatorDetail", "evaluatorDetailTitle", "evaluatorDetailStatus", "backToEvaluatorInbox", "startEvaluationButton",
  "evaluationWorkspace", "evaluationProgress", "evaluationScore", "evaluationLevel", "evaluationVariableResults", "evaluationCriteriaGroups", "evaluationAutoConcept", "evaluationConcept", "evaluationDecisionHint", "evaluationMessage", "exportEvaluationReportButton", "saveEvaluationButton", "returnEvaluationButton", "favorableEvaluationButton",
  "returnedEvaluation", "returnedEvaluationSummary", "returnedEvaluationConcept", "returnedFindings", "saveEvaluationResponses", "returnedEvaluationMessage",
  "adminApprovalSection", "adminApprovalSummary", "adminApprovalObservation", "returnAdminApprovalButton", "approveAdminApprovalButton", "adminApprovalMessage", "adminApprovalQueue", "adminApprovalCount", "adminApprovalQueueMessage", "emptyAdminApprovalQueue", "adminApprovalQueueList", "refreshAdminApprovalQueue",
  "draftName", "draftNameStatus", "processCode", "draftConsecutive", "draftCode", "draftCodeStatus", "draftObjective", "draftScope", "draftDefinitions", "draftDefinitionsStatus", "draftConditions", "saveDraftButton", "reloadDraftButton", "editorMessage",
  "procedureProgress", "newDraftButton", "addNormButton", "normsList", "emptyNorms", "normReview", "addBoundaryButton", "addActivityButton", "addDecisionButton", "addConnectorButton", "activitiesList", "emptyActivities", "reviewFlowButton", "flowReviewResult", "refreshDraftsButton", "draftCount", "listMessage", "emptyDrafts",
  "draftList", "ownedDraftsSection", "flowSection", "flowSummary", "refreshFlowButton", "flowCanvas", "flowSvg",
  "zoomOutButton", "zoomInButton", "fitFlowButton", "resetFlowZoomButton", "flowZoomValue",
  "documentsSection", "annexApplicability", "addAnnexButton", "annexNotApplicableMessage", "emptyAnnexes", "annexesList",
  "addChangeButton", "emptyChanges", "changesMessage", "changesList", "draftPreparedBy", "draftPreparedOther", "draftPreparedName", "draftReviewedBy", "draftReviewedOther", "draftReviewedName",
  "draftApprovedBy", "draftApprovedName", "roleSeparationMessage", "saveDocumentsButton", "documentsMessage",
  "previewButton", "previewDialog", "previewTitle", "previewState", "previewContent", "printPreviewButton", "closePreviewButton", "methodTooltip"
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
  procedure_name_taken: "El nombre ya está registrado en otro procedimiento. Elige un nombre distinto.",
  procedure_code_locked: "El código queda fijo después de enviar el procedimiento a evaluación.",
  invalid_preparer_role: "Los cargos directivos no pueden figurar en Elaboró. Selecciona un cargo no directivo.",
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
  evaluation_favorable_conditions_unmet: "El concepto favorable exige que todos los criterios estén completos y cumplan, sin ningún resultado No cumple.",
  invalid_admin_approval_decision: "La decisión administrativa no es válida.",
  admin_return_observation_required: "Escribe la observación administrativa antes de devolver el procedimiento.",
  administrative_approval_conditions_unmet: "El visto bueno solo está disponible para un concepto técnico favorable completo.",
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
let previewBranding = "standard";
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
let normativityConfirmedMissingTypes = [];
let lastFlowReviewPassed = false;
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
const nonDirectiveRoleLevels = responsibilityRoleGroups.filter(group => group.level !== "Directivo").map(group => group.level);
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
  draftApprovedName: "Nombre obligatorio de la persona que aprueba formalmente la versión."
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

function approvalOtherInput(select) {
  const otherInputIds = {
    draftPreparedBy: "draftPreparedOther",
    draftReviewedBy: "draftReviewedOther"
  };
  return ui[otherInputIds[select?.id]];
}

function approvalRoleValue(select) {
  const selected = String(select?.value || "").trim();
  return selected === "__otro__" ? String(approvalOtherInput(select)?.value || "").trim() : selected;
}

function normalizedApprovalName(value) {
  return String(value || "").trim().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLocaleLowerCase("es-CO");
}

function repeatedApprovalNames() {
  const names = [
    ["Elaboró", ui.draftPreparedName.value],
    ["Revisó", ui.draftReviewedName.value],
    ["Aprobó", ui.draftApprovedName.value]
  ];
  const grouped = new Map();
  for (const [role, value] of names) {
    const normalized = normalizedApprovalName(value);
    if (!normalized) continue;
    const record = grouped.get(normalized) || { name: String(value).trim(), roles: [] };
    record.roles.push(role);
    grouped.set(normalized, record);
  }
  return [...grouped.values()].filter(record => record.roles.length > 1);
}

function repeatedApprovalNamesMessage() {
  return repeatedApprovalNames().map(record =>
    `El nombre “${record.name}” se repite en ${record.roles.join(" y ")}. Confirma que corresponde a la misma persona.`
  ).join(" ");
}

function confirmRepeatedApprovalNames() {
  const message = repeatedApprovalNamesMessage();
  return !message || window.confirm(`${message} ¿Deseas conservar los nombres repetidos?`);
}

function syncApprovalOther(select, selectedOther) {
  const otherInput = approvalOtherInput(select);
  if (!otherInput) return;
  const isOther = select.value === "__otro__";
  otherInput.hidden = !isOther;
  otherInput.previousElementSibling.hidden = !isOther;
  if (isOther && selectedOther !== undefined) otherInput.value = selectedOther;
  if (!isOther) otherInput.value = "";
}

function showRoleSeparation() {
  const roles = [ui.draftPreparedBy, ui.draftReviewedBy, ui.draftApprovedBy].map(approvalRoleValue).map(value => value.toLocaleLowerCase("es-CO")).filter(Boolean);
  const repeated = roles.length > new Set(roles).size;
  const messages = [];
  if (repeated) messages.push("Elaboró, Revisó y Aprobó deben corresponder a cargos distintos.");
  const repeatedNames = repeatedApprovalNamesMessage();
  if (repeatedNames) messages.push(repeatedNames);
  if (approvalRoleValue(ui.draftApprovedBy) && !activityTextIsFilled(ui.draftApprovedName.value)) {
    messages.push("Debe establecer el nombre del directivo responsable de la aprobación.");
  }
  setMessage(ui.roleSeparationMessage, messages.join(" "));
  ui.roleSeparationMessage.classList.toggle("is-warning", messages.length > 0);
}

function populateApprovalRoleSelect(select, selected = "", allowedLevels = null, allowOther = false) {
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
  if (allowOther) options.push(new Option("Otro — ¿Cuál?", "__otro__"));
  if (selected && !allowedRoles.has(selected)) {
    if (allowOther) {
      select.replaceChildren(...options);
      select.value = "__otro__";
      syncApprovalOther(select, selected);
      return;
    }
    const savedGroup = document.createElement("optgroup");
    savedGroup.label = "Valor guardado anteriormente";
    savedGroup.append(new Option("Conservar: " + selected, selected));
    options.push(savedGroup);
  }
  select.replaceChildren(...options);
  select.value = selected;
  syncApprovalOther(select);
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

function changeLogWarnings(changes) {
  const warnings = [];
  const versionPattern = /^(\d+)\.(\d+)$/;
  const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const dateLabel = value => {
    const [year, month, day] = String(value).split("-").map(Number);
    return Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day) && monthNames[month - 1]
      ? `${day} de ${monthNames[month - 1]} de ${year}`
      : value;
  };
  let previousVersion = null;
  let previousDate = "";
  for (const [index, change] of (Array.isArray(changes) ? changes : []).entries()) {
    const version = String(change?.version || "").trim();
    const date = String(change?.fecha || "").trim();
    const versionMatch = version.match(versionPattern);
    if (version && !versionMatch) warnings.push(`Inconsistencia de versión en el cambio ${index + 1}: use el formato mayor.menor, por ejemplo 1.0.`);
    if (versionMatch) {
      const currentVersion = versionMatch.slice(1).map(Number);
      if (previousVersion && (currentVersion[0] < previousVersion[0] || (currentVersion[0] === previousVersion[0] && currentVersion[1] <= previousVersion[1]))) {
        warnings.push(`Inconsistencia de versión en el cambio ${index + 1}: ${version} no es posterior a ${previousVersion.join(".")}. Verifique el orden o confirme que corresponde a un historial excepcional.`);
      }
      previousVersion = currentVersion;
    }
    if (date && previousDate && date < previousDate) warnings.push(`Inconsistencia de fecha en el cambio ${index + 1}: ${dateLabel(date)} es anterior a ${dateLabel(previousDate)}. Revise la cronología.`);
    if (date) previousDate = date;
  }
  return warnings;
}

function syncChangeLogWarnings() {
  setMessage(ui.changesMessage, changeLogWarnings(changeRows).join(" "));
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

const genericProcedureVerbs = new Set(["gestionar", "administrar", "realizar"]);
const procedureTypeWords = new Set(["procedimiento", "proceso", "tramite", "instructivo", "formato"]);
const genericProcedureObjects = new Set(["informe", "informes", "contrato", "contratos", "solicitud", "solicitudes", "documento", "documentos", "registro", "registros"]);

function normalizeProcedureWord(value) {
  return String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es-CO");
}

function procedureNameIssues(value) {
  const name = String(value || "").trim();
  if (!name) return ["Escribe el nombre del procedimiento."];
  const words = name.match(/[\p{L}\p{N}]+/gu) || [];
  const normalizedWords = words.map(normalizeProcedureWord);
  const issues = [];
  if (words.length > 12) issues.push("El nombre puede tener máximo 12 palabras.");
  if (words.length < 2) issues.push("Incluye el objeto sobre el que actúa el procedimiento.");
  if (!/^[a-zñ]+(?:ar|er|ir)$/i.test(normalizedWords[0] || "")) {
    issues.push("Inicia con un verbo específico en infinitivo, por ejemplo: Formular, Elaborar, Supervisar o Evaluar.");
  } else if (genericProcedureVerbs.has(normalizedWords[0])) {
    issues.push("No uses verbos genéricos como Gestionar, Administrar o Realizar.");
  }
  if (procedureTypeWords.has(normalizedWords.find(word => procedureTypeWords.has(word)))) {
    issues.push("No incluyas Procedimiento, Proceso, Trámite, Instructivo ni Formato en el nombre.");
  }
  if (words.length === 2 && genericProcedureObjects.has(normalizedWords[1])) {
    issues.push("Precisa el complemento del objeto genérico, por ejemplo el tipo o alcance de la solicitud.");
  }
  if (/\.$/.test(name)) issues.push("No uses punto final en el nombre.");
  if (/^\p{Ll}/u.test(name) || words.slice(1).some(word => /^\p{Lu}\p{Ll}/u.test(word))) {
    issues.push("Usa mayúscula solo en la primera letra; conserva las siglas institucionales en mayúscula.");
  }
  return issues;
}

function syncProcedureNameValidity() {
  const issues = procedureNameIssues(ui.draftName.value);
  const message = issues[0] || "Nombre con estructura válida.";
  // El aviso metodológico orienta mientras se edita; el bloqueo ocurre al enviar a evaluación.
  ui.draftName.setCustomValidity("");
  ui.draftName.setAttribute("aria-invalid", String(Boolean(issues.length)));
  ui.draftNameStatus.textContent = message;
  ui.draftNameStatus.classList.toggle("is-invalid", Boolean(issues.length));
  return issues;
}

function definitionEntries(value) {
  return String(value || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const split = line.indexOf(":");
    return split > 0 ? { term: line.slice(0, split).trim(), line } : null;
  }).filter(Boolean);
}

function alphabeticalDefinitionSuggestion(value) {
  const entries = definitionEntries(value);
  if (entries.length < 2) return null;
  const collator = new Intl.Collator("es-CO", { sensitivity: "base" });
  const suggested = [...entries].sort((left, right) => collator.compare(left.term, right.term));
  return entries.every((entry, index) => entry.line === suggested[index].line) ? null : suggested.map(entry => entry.term);
}

function syncDefinitionsAlphabeticalSuggestion() {
  const suggestedTerms = alphabeticalDefinitionSuggestion(ui.draftDefinitions.value);
  const message = suggestedTerms
    ? `Sugerencia: ordene las definiciones alfabéticamente así: ${suggestedTerms.join(", ")}.`
    : "Registre cada término seguido de dos puntos y su definición.";
  ui.draftDefinitions.setAttribute("aria-invalid", String(Boolean(suggestedTerms)));
  ui.draftDefinitionsStatus.textContent = message;
  ui.draftDefinitionsStatus.classList.toggle("is-warning", Boolean(suggestedTerms));
  return suggestedTerms;
}

function definitionsAreComplete(value) {
  const entries = String(value || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return entries.length > 0 && entries.every(line => {
    const separator = line.indexOf(":");
    return separator > 0 && Boolean(line.slice(separator + 1).trim());
  }) && !alphabeticalDefinitionSuggestion(value);
}

const normTypes = ["Interna", "Externa"];

function normRowIsComplete(norm) {
  return Boolean(norm) && normTypes.includes(norm.tipo) && normFields.every(([key]) => activityTextIsFilled(norm[key]));
}

function normTypeLabel(types) {
  return types.map(type => `norma ${type.toLocaleLowerCase("es-CO")}`).join(" y ");
}

function normativityState() {
  const incomplete = normRows.some(norm => !normRowIsComplete(norm));
  const registeredTypes = new Set(normRows.filter(normRowIsComplete).map(norm => norm.tipo));
  const missingTypes = normTypes.filter(type => !registeredTypes.has(type));
  const confirmations = new Set(normativityConfirmedMissingTypes.filter(type => normTypes.includes(type)));
  const pendingConfirmation = missingTypes.filter(type => !confirmations.has(type));
  return { incomplete, missingTypes, pendingConfirmation, complete: !incomplete && pendingConfirmation.length === 0 };
}

function renderNormativityReview() {
  const state = normativityState();
  ui.normReview.replaceChildren();
  ui.normReview.hidden = false;
  if (state.incomplete) {
    ui.normReview.className = "norm-review norm-review-warning";
    ui.normReview.textContent = "Completa o elimina las normas incompletas antes de validar la normatividad.";
    return;
  }
  if (!state.missingTypes.length) {
    ui.normReview.className = "norm-review norm-review-success";
    ui.normReview.textContent = "Normatividad validada: hay registros internos y externos completos.";
    return;
  }
  if (!state.pendingConfirmation.length) {
    ui.normReview.className = "norm-review norm-review-success";
    ui.normReview.textContent = `Normatividad validada: se confirmó la ausencia de ${normTypeLabel(state.missingTypes)} aplicable.`;
    return;
  }
  ui.normReview.className = "norm-review norm-review-warning";
  const text = document.createElement("p");
  text.textContent = `No se identifica ${normTypeLabel(state.missingTypes)}. Revisa la fuente normativa antes de validar esta sección.`;
  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.className = "secondary-button";
  confirm.textContent = "Confirmar revisión de normatividad";
  confirm.addEventListener("click", () => {
    const categories = normTypeLabel(state.missingTypes);
    if (!window.confirm(`No se registra ${categories}. Confirma que revisaste la normatividad y que no existen registros internos o externos pendientes para este procedimiento.`)) return;
    normativityConfirmedMissingTypes = [...state.missingTypes];
    renderNormativityReview();
    markDirty();
  });
  ui.normReview.append(text, confirm);
}

function documentSectionIsComplete() {
  const annexesComplete = annexesNotApplicable || (annexRows.length > 0 && annexRows.every(annex =>
    annex && ["documento", "tipo", "codigo", "observacion"].every(key => activityTextIsFilled(annex[key]))));
  const changesComplete = changeRows.length > 0 && changeRows.every(change =>
    change && ["version", "fecha", "razon"].every(key => activityTextIsFilled(change[key])));
  const roles = [ui.draftPreparedBy, ui.draftReviewedBy, ui.draftApprovedBy]
    .map(approvalRoleValue)
    .map(value => value.toLocaleLowerCase("es-CO"));
  return annexesComplete && changesComplete && roles.every(Boolean) &&
    activityTextIsFilled(ui.draftApprovedName.value) && new Set(roles).size === roles.length;
}

function refreshProcedureProgress() {
  if (!ui.procedureProgress) return;
  const state = {
    identification: procedureNameIssues(ui.draftName.value).length === 0 && Boolean(procedureCode(ui.processCode.value, ui.draftConsecutive.value)),
    context: [ui.draftObjective.value, ui.draftScope.value, ui.draftConditions.value].every(activityTextIsFilled) && definitionsAreComplete(ui.draftDefinitions.value),
    norms: normativityState().complete,
    activities: activityRows.some(activity => activity?.tipo === "Actividad") && activityRows.every(activityRowIsComplete),
    flow: lastFlowReviewPassed,
    documents: documentSectionIsComplete()
  };
  for (const [section, complete] of Object.entries(state)) {
    const check = ui.procedureProgress.querySelector(`[data-progress-state="${section}"]`);
    if (!check) continue;
    check.classList.toggle("is-complete", complete);
    check.setAttribute("aria-label", complete ? "Cumple las reglas" : "Pendiente de reglas");
    check.title = complete ? "Cumple las reglas" : "Pendiente de reglas";
  }
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
  lastFlowReviewPassed = false;
  setMessage(ui.editorMessage, "");
  ui.flowReviewResult.replaceChildren();
  ui.flowReviewResult.hidden = true;
  refreshProcedureProgress();
}

function showFlowReview(issues, completenessIssues = []) {
  const result = ui.flowReviewResult;
  result.replaceChildren();
  const errors = issues.filter(issue => issue.severity !== "warning");
  const warnings = issues.filter(issue => issue.severity === "warning");
  lastFlowReviewPassed = errors.length === 0 && completenessIssues.length === 0;
  const summary = document.createElement("p");
  summary.className = errors.length || completenessIssues.length ? "flow-review-summary flow-review-errors" : warnings.length ? "flow-review-summary flow-review-warnings" : "flow-review-summary flow-review-ok";
  const blockingSummary = [
    errors.length ? `${errors.length} observación${errors.length === 1 ? "" : "es"} por corregir en el flujo` : "",
    completenessIssues.length ? `${completenessIssues.length} campo${completenessIssues.length === 1 ? "" : "s"} obligatorio${completenessIssues.length === 1 ? "" : "s"} por completar` : ""
  ].filter(Boolean).join(". ");
  summary.textContent = blockingSummary
    ? `${blockingSummary}.${warnings.length ? ` ${warnings.length} aviso${warnings.length === 1 ? "" : "s"} adicional${warnings.length === 1 ? "" : "es"}.` : ""}`
    : `Las rutas y los nodos del flujo son coherentes.${warnings.length ? ` ${warnings.length} aviso${warnings.length === 1 ? "" : "s"} para revisar.` : ""}`;
  result.append(summary);
  if (issues.length) {
    const list = document.createElement("ul");
    for (const issue of issues) {
      const item = document.createElement("li");
      item.textContent = (issue.severity === "warning" ? "Aviso: " : "") + (Number.isInteger(issue.index) ? `Elemento ${issue.index + 1}: ` : "") + issue.message;
      if (Number.isInteger(issue.index)) {
        const focus = document.createElement("button");
        focus.type = "button";
        focus.className = "flow-review-focus";
        focus.textContent = "Ir al elemento";
        focus.addEventListener("click", () => focusFlowItem(issue.index));
        item.append(" ", focus);
      }
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
      if (Number.isInteger(issue.index)) {
        const focus = document.createElement("button");
        focus.type = "button";
        focus.className = "flow-review-focus";
        focus.textContent = "Ir al elemento";
        focus.addEventListener("click", () => focusFlowItem(issue.index));
        item.append(" ", focus);
      }
      list.append(item);
    }
    result.append(list);
  }
  result.hidden = false;
  refreshProcedureProgress();
}

async function restoreFlowReviewState() {
  const version = flowReviewVersion;
  try {
    const { issues, completenessIssues } = await request("/api/procedures/flow-review", {
      method: "POST", csrf: true,
      body: { activities: activityRows.map(activity => ({ ...activity })) }
    });
    if (version !== flowReviewVersion) return;
    lastFlowReviewPassed = issues.every(issue => issue.severity === "warning") && completenessIssues.length === 0;
    refreshProcedureProgress();
  } catch {
    if (version !== flowReviewVersion) return;
    lastFlowReviewPassed = false;
    refreshProcedureProgress();
  }
}

function focusFlowItem(index) {
  const activity = activityRows[index];
  if (!activity) return;
  collapsedActivityUids.delete(activity.uid);
  renderActivities();
  const row = ui.activitiesList.querySelectorAll(".activity-row")[index];
  if (!row) return;
  row.scrollIntoView({ behavior: "smooth", block: "center" });
  row.querySelector("input, select, textarea, button")?.focus({ preventScroll: true });
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
  renderNormativityReview();
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
    if (section === "change") syncChangeLogWarnings();
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
  syncChangeLogWarnings();
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

function activityNameStartsWithInfinitive(value) {
  const firstWord = String(value || "").trim().split(/\s+/)[0] || "";
  const normalized = firstWord.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CO");
  return /^[a-z]+(?:ar|er|ir)$/.test(normalized);
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
  return activityTextIsFilled(activity.actividad) && activityNameStartsWithInfinitive(activity.actividad) && activityTextIsFilled(activity.descripcion) && responsible && controlComplete;
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
      const nameRule = key === "actividad" ? document.createElement("p") : null;
      const syncNameRule = () => {
        if (!nameRule) return;
        const invalid = activityTextIsFilled(input.value) && !activityNameStartsWithInfinitive(input.value);
        input.setAttribute("aria-invalid", String(invalid));
        nameRule.textContent = invalid ? "Inicie con un verbo en infinitivo, por ejemplo: Recibir y radicar." : "Use un verbo en infinitivo que exprese la acción.";
        nameRule.className = "field-hint" + (invalid ? " is-warning" : "");
      };
      input.addEventListener("input", () => {
        activity[key] = input.value;
        syncNameRule();
        markDirty();
      });
      field.append(label, input);
      if (nameRule) {
        syncNameRule();
        field.append(nameRule);
      }
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

function flowLines(value, maxLength = 22, maxLines = 2) {
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
  if (Number.isFinite(maxLines) && lines.length > maxLines) return [...lines.slice(0, Math.max(0, maxLines - 1)), lines[maxLines - 1].slice(0, maxLength - 1) + "…"];
  return lines.length ? lines : ["Sin nombre"];
}

function decisionLayout(item) {
  const lines = flowLines(String(item?.descripcion || item?.actividad || "Decisión"), 16, Infinity);
  const longestLine = Math.max(...lines.map(line => line.length), 1);
  return {
    lines,
    halfWidth: Math.max(77, longestLine * 4.5 + 20),
    halfHeight: Math.max(44, lines.length * 9 + 18)
  };
}

function rectangularNodeLayout(item) {
  const lines = flowLines(String(item?.actividad || item?.tipo || "Sin nombre"), 24, Infinity);
  const hasControl = item?.tieneControl === true;
  return {
    lines,
    halfWidth: 102,
    halfHeight: Math.max(42, lines.length * 8.5 + 20 + (hasControl ? 14 : 0)),
    textOffset: hasControl ? -7 : 0
  };
}

function flowNodeHalfHeight(item) {
  return item?.tipo === "Decisión" ? decisionLayout(item).halfHeight : item?.tipo === "Conector" ? 27 : rectangularNodeLayout(item).halfHeight;
}

function flowNodeHalfWidth(item) {
  return item?.tipo === "Decisión" ? decisionLayout(item).halfWidth : item?.tipo === "Conector" ? 28 : rectangularNodeLayout(item).halfWidth;
}

function flowEvidenceFor(item, showEvidence) {
  const evidence = String(item?.evidencia || item?.controlEvidencia || "").trim();
  return showEvidence && evidence && !["Inicio", "Conector", "Fin"].includes(item?.tipo) ? evidence : "";
}

function flowNodeExitY(item, y, showEvidence) {
  return y + flowNodeHalfHeight(item) + (flowEvidenceFor(item, showEvidence) ? 82 : 28);
}

function flowLinksFor(items) {
  const indexById = new Map(items.map((item, index) => [item.uid, index]));
  const outerRouteCount = { left: 0, right: 0 };
  const links = [];
  for (const [index, item] of items.entries()) {
    const destinations = item.tipo === "Decisión" ? [[item.decisionSi, "Sí"], [item.decisionNo, "No"]]
      : item.tipo === "Conector" ? [[item.connectorDestino, ""]]
      : item.tipo === "Fin" ? [] : [[items[index + 1]?.uid, ""]];
    for (const [targetId, label] of destinations) {
      const targetIndex = indexById.get(targetId);
      if (targetIndex === undefined) continue;
      const side = label === "No" || targetIndex <= index ? "left" : "right";
      const outer = Boolean(label) || item.tipo === "Conector" || targetIndex <= index || targetIndex > index + 1;
      links.push({ item, index, targetId, targetIndex, label, side, outer, routeIndex: null });
    }
  }
  for (const side of ["left", "right"]) {
    const outerLinks = links.filter(link => link.outer && link.side === side)
      .sort((first, second) => first.targetIndex - second.targetIndex || second.index - first.index);
    outerLinks.forEach((link, routeIndex) => { link.routeIndex = routeIndex; });
    outerRouteCount[side] = outerLinks.length;
  }
  return { links, outerRouteCount };
}

function renderFlow() {
  const svg = ui.flowSvg;
  svg.replaceChildren();
  ui.flowSection.hidden = activityRows.length === 0;
  if (!activityRows.length) return;
  const showEvidence = true;

  const roles = [...new Set(activityRows.filter(item => !["Inicio", "Fin", "Conector"].includes(item.tipo))
    .flatMap(item => {
      const names = String(item.responsable || "").split(";").map(role => role.trim()).filter(Boolean);
      return names.length ? names : ["Sin responsable"];
    }))];
  if (!roles.length) roles.push("Sin responsable");
  const singleOperationalResponsible = roles.length === 1 && roles[0] !== "Sin responsable";
  const laneWidth = showEvidence ? 360 : 260;
  const rowHeight = showEvidence ? 168 : 132;
  const { links: flowLinks, outerRouteCount } = flowLinksFor(activityRows);
  const routeGap = 30;
  const leftMargin = Math.max(80, 60 + outerRouteCount.left * routeGap);
  const rightMargin = Math.max(80, 60 + outerRouteCount.right * routeGap);
  const width = Math.max(760, leftMargin + roles.length * laneWidth + rightMargin);
  const itemHeights = activityRows.map(item => {
    return Math.max(rowHeight, flowNodeHalfHeight(item) * 2 + (flowEvidenceFor(item, showEvidence) ? 136 : 44));
  });
  const height = 118 + itemHeights.reduce((total, itemHeight) => total + itemHeight, 0) + 32;
  flowIntrinsicWidth = width;
  flowIntrinsicHeight = height;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  ui.flowSummary.textContent = `${activityRows.length} elementos · ${roles.length} responsable${roles.length === 1 ? "" : "s"}`;
  if (singleOperationalResponsible) ui.flowSummary.textContent += " · Aviso: revise la concentración de responsabilidades.";
  ui.flowSummary.classList.toggle("is-warning", singleOperationalResponsible);
  const title = svgNode("title", {}, "Flujograma del borrador abierto");
  const defs = svgNode("defs");
  for (const [id, color] of [["flowArrow", "#607b84"], ["flowYes", "#168064"], ["flowNo", "#bd5140"]]) {
    const marker = svgNode("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, orient: "auto-start-reverse" });
    marker.append(svgNode("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color }));
    defs.append(marker);
  }
  svg.append(title, defs);
  for (const [index, role] of roles.entries()) {
    const x = leftMargin + index * laneWidth;
    svg.append(svgNode("rect", { x, y: 0, width: laneWidth, height, class: `flow-lane${index % 2 ? " alt" : ""}` }));
    svg.append(svgNode("rect", { x, y: 0, width: laneWidth, height: 68, class: "flow-lane-header" }));
    const label = svgNode("text", { x: x + laneWidth / 2, y: 31, "text-anchor": "middle", fill: "#fff", "font-size": 13, "font-weight": 700 }, flowLines(role, 28)[0]);
    label.append(svgNode("title", {}, role));
    svg.append(label);
  }

  let nextY = 118;
  const positions = new Map(activityRows.map((item, index) => {
    const itemRoles = String(item.responsable || "").split(";").map(role => role.trim()).filter(Boolean);
    if (!itemRoles.length) itemRoles.push("Sin responsable");
    const lanes = itemRoles.map(role => roles.indexOf(role)).filter(lane => lane >= 0);
    const center = ["Inicio", "Fin", "Conector"].includes(item.tipo) ? width / 2
      : lanes.length ? leftMargin + (Math.min(...lanes) + Math.max(...lanes) + 1) * laneWidth / 2 : leftMargin + laneWidth / 2;
    const y = nextY + itemHeights[index] / 2;
    nextY += itemHeights[index];
    return [item.uid, { x: center, y, index, item }];
  }));

  for (const link of flowLinks) {
    const source = positions.get(link.item.uid);
    const target = positions.get(link.targetId);
    if (!source || !target) continue;
    const branch = link.label === "Sí" ? "yes" : link.label === "No" ? "no" : link.item.tipo === "Conector" ? "connector" : "";
    const side = link.side === "left" ? -1 : 1;
    let points;
    if (link.outer) {
      const fromX = source.x + side * flowNodeHalfWidth(link.item);
      const toX = target.x + side * flowNodeHalfWidth(target.item);
      const rail = side < 0
        ? leftMargin - 24 - link.routeIndex * routeGap
        : leftMargin + roles.length * laneWidth + 24 + link.routeIndex * routeGap;
      points = `${fromX},${source.y} ${rail},${source.y} ${rail},${target.y} ${toX},${target.y}`;
    } else {
      const sourceBottomY = source.y + flowNodeHalfHeight(link.item);
      const sourceExitY = flowNodeExitY(link.item, source.y, showEvidence);
      const targetTopY = target.y - flowNodeHalfHeight(target.item) - 4;
      points = `${source.x},${sourceBottomY} ${source.x},${sourceExitY} ${target.x},${sourceExitY} ${target.x},${targetTopY}`;
    }
    const edge = svgNode("polyline", { points, class: `flow-edge ${branch}`, "marker-end": `url(#${link.label === "Sí" ? "flowYes" : link.label === "No" ? "flowNo" : "flowArrow"})` });
    edge.append(svgNode("title", {}, `${link.item.actividad || link.item.tipo} → ${target.item.actividad || target.item.tipo}${link.label ? ` (${link.label})` : ""}`));
    svg.append(edge);
    if (link.label) svg.append(svgNode("text", { x: source.x + side * (flowNodeHalfWidth(link.item) + 20), y: source.y - 9, class: `flow-route-label ${branch}`, "text-anchor": "middle" }, link.label));
  }

  for (const [index, item] of activityRows.entries()) {
    const position = positions.get(item.uid);
    if (!position) continue;
    const { x, y } = position;
    const group = svgNode("g");
    group.append(svgNode("title", {}, `${item.tipo}: ${item.actividad || item.descripcion || "Sin nombre"}${item.responsable ? ` · ${item.responsable}` : ""}`));
    const layout = item.tipo === "Decisión" ? decisionLayout(item) : item.tipo === "Conector" ? null : rectangularNodeLayout(item);
    if (item.tipo === "Decisión") group.append(svgNode("polygon", { points: `${x},${y - layout.halfHeight} ${x + layout.halfWidth},${y} ${x},${y + layout.halfHeight} ${x - layout.halfWidth},${y}`, class: "flow-node decision" }));
    else if (item.tipo === "Conector") group.append(svgNode("circle", { cx: x, cy: y, r: 27, class: "flow-node connector" }));
    else group.append(svgNode("rect", { x: x - layout.halfWidth, y: y - layout.halfHeight, width: layout.halfWidth * 2, height: layout.halfHeight * 2, rx: ["Inicio", "Fin"].includes(item.tipo) ? 28 : 5, class: `flow-node${["Inicio", "Fin"].includes(item.tipo) ? " boundary" : ""}${item.tieneControl ? " control" : ""}` }));
    const textValue = item.tipo === "Conector" ? String(item.connectorId || "?") : item.tipo === "Decisión" ? String(item.descripcion || item.actividad || "Decisión") : String(item.actividad || item.tipo);
    const lines = layout ? layout.lines : flowLines(textValue, 24);
    const textOffset = layout?.textOffset || 0;
    lines.forEach((line, lineIndex) => group.append(svgNode("text", { x, y: y + textOffset + (lineIndex - (lines.length - 1) / 2) * 17 + 5, class: "flow-text", "text-anchor": "middle" }, line)));
    const activityNumber = displayActivityNumber(item, index);
    if (activityNumber) {
      group.append(svgNode("circle", { cx: x - 90, cy: y - 30, r: 13, class: "flow-activity-number" }));
      group.append(svgNode("text", { x: x - 90, y: y - 26, class: "flow-activity-number-text", "text-anchor": "middle" }, activityNumber));
    }
    if (item.tieneControl) group.append(svgNode("text", { x, y: y + flowNodeHalfHeight(item) - 11, class: "flow-note", "text-anchor": "middle" }, "CONTROL"));
    svg.append(group);
    const evidence = flowEvidenceFor(item, showEvidence);
    if (evidence) {
      const record = svgNode("g");
      record.append(svgNode("title", {}, `Registro / evidencia: ${evidence}`));
      const nodeBottom = flowNodeHalfHeight(item);
      record.append(svgNode("line", { x1: x + 65, y1: y + nodeBottom + 1, x2: x + 65, y2: y + nodeBottom + 15, class: "flow-record-link" }));
      record.append(svgNode("path", { d: `M ${x + 30} ${y + nodeBottom + 15} h 130 v 54 q -16 -7 -32 0 q -16 7 -32 0 q -16 -7 -33 0 q -16 7 -33 0 z`, class: "flow-record" }));
      record.append(svgNode("text", { x: x + 95, y: y + nodeBottom + 31, class: "flow-record-caption", "text-anchor": "middle" }, "REGISTRO / EVIDENCIA"));
      const lines = flowLines(evidence, 20);
      lines.forEach((line, lineIndex) => record.append(svgNode("text", { x: x + 95, y: y + nodeBottom + 46 + lineIndex * 11, class: "flow-record-text", "text-anchor": "middle" }, line)));
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
  if (["procedure_code_taken", "procedure_name_taken"].includes(error.code) && error.details && typeof error.details === "object" &&
      typeof error.details.code === "string" && typeof error.details.name === "string") {
    return error.code === "procedure_code_taken"
      ? `El código ${error.details.code} ya está asignado al procedimiento “${error.details.name}”.`
      : `El nombre “${error.details.name}” ya está registrado con el código ${error.details.code || "sin código"}.`;
  }
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
    } else if (["procedure_evaluation_started", "procedure_returned_for_corrections", "procedure_favorable_concept_issued", "procedure_unfavorable_concept_issued", "procedure_formally_approved", "procedure_returned_by_administration"].includes(notification.eventType) && currentUserRole === "elaborador") {
      hideAnalytics();
      await openDraft(notification.procedureId);
    }
  } catch (error) {
    handleRequestError(error, currentUserRole === "evaluador" ? ui.evaluatorInboxMessage : ui.listMessage);
  }
}

const analyticsEventLabels = [
  ["procedure_draft_created", "Procedimientos iniciados"],
  ["procedure_submitted_for_review", "Envíos a evaluación"],
  ["procedure_evaluation_started", "Evaluaciones iniciadas"],
  ["procedure_returned_for_corrections", "Devoluciones"],
  ["procedure_favorable_concept_issued", "Conceptos favorables"]
];

let currentAnalytics = null;

function escapeXml(value) {
  return String(value ?? "").replace(/[<>&'\"]/g, character => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;"
  })[character]);
}

function columnName(index) {
  let name = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  }
  return name;
}

function spreadsheetCell(value, reference, heading = false) {
  const style = heading ? ' s="1"' : "";
  if (typeof value === "number") return `<c r="${reference}"${style}><v>${value}</v></c>`;
  return `<c r="${reference}" t="inlineStr"${style}><is><t>${escapeXml(value)}</t></is></c>`;
}

function spreadsheetSheet(rows) {
  const body = rows.map((row, rowIndex) => {
    const heading = row.kind === "heading";
    const cells = row.values.map((value, columnIndex) => spreadsheetCell(value, `${columnName(columnIndex)}${rowIndex + 1}`, heading)).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  }
  return (value ^ 0xffffffff) >>> 0;
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value, true);
}

function workbookBlob(files) {
  const encoder = new TextEncoder();
  const localChunks = [];
  const directoryChunks = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const filename = encoder.encode(name);
    const data = encoder.encode(content);
    const checksum = crc32(data);
    const local = new Uint8Array(30 + filename.length + data.length);
    const localView = new DataView(local.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint32(localView, 14, checksum);
    writeUint32(localView, 18, data.length);
    writeUint32(localView, 22, data.length);
    writeUint16(localView, 26, filename.length);
    local.set(filename, 30);
    local.set(data, 30 + filename.length);
    localChunks.push(local);

    const directory = new Uint8Array(46 + filename.length);
    const directoryView = new DataView(directory.buffer);
    writeUint32(directoryView, 0, 0x02014b50);
    writeUint16(directoryView, 4, 20);
    writeUint16(directoryView, 6, 20);
    writeUint32(directoryView, 16, checksum);
    writeUint32(directoryView, 20, data.length);
    writeUint32(directoryView, 24, data.length);
    writeUint16(directoryView, 28, filename.length);
    writeUint32(directoryView, 42, offset);
    directory.set(filename, 46);
    directoryChunks.push(directory);
    offset += local.length;
  }
  const directorySize = directoryChunks.reduce((total, chunk) => total + chunk.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 8, directoryChunks.length);
  writeUint16(endView, 10, directoryChunks.length);
  writeUint32(endView, 12, directorySize);
  writeUint32(endView, 16, offset);
  return new Blob([...localChunks, ...directoryChunks, end], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

function analyticsWorkbook(analytics) {
  const period = `${analytics.periodDays} día${analytics.periodDays === 1 ? "" : "s"}`;
  const process = ui.analyticsProcess.options[ui.analyticsProcess.selectedIndex]?.text || "Todos los procesos";
  const role = ui.analyticsRole.options[ui.analyticsRole.selectedIndex]?.text || "Todos los roles";
  const metricRows = analyticsEventLabels.map(([key, label]) => [label, Number(analytics.totals[key] || 0)]);
  const productivityRows = [
    { kind: "heading", values: ["Indicadores de productividad", "Cantidad"] },
    ...metricRows.map(values => ({ values })),
    { values: [] },
    { kind: "heading", values: ["Actividad por día", "Iniciados", "Envíos", "Evaluaciones", "Devoluciones", "Favorables"] },
    ...analytics.byDay.map(row => ({ values: [row.day, ...analyticsEventLabels.map(([key]) => Number(row[key] || 0))] })),
    { values: [] },
    { kind: "heading", values: ["Proceso", "Procedimiento", "Iniciados", "Envíos", "Evaluaciones", "Devoluciones", "Favorables"] },
    ...analytics.byProcess.map(row => ({ values: [`${row.processName} (${row.processCode})`, row.procedureName, ...analyticsEventLabels.map(([key]) => Number(row[key] || 0))] }))
  ];
  const usageRows = [
    { kind: "heading", values: ["Uso del sistema", "Valor"] },
    { values: ["Ingresos del periodo", Number(analytics.usage.totalLogins || 0)] },
    { values: ["Usuarios con ingreso", Number(analytics.usage.activeUsers || 0)] },
    { values: ["Último ingreso", analytics.usage.lastLogin ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(analytics.usage.lastLogin)) : "Sin registro"] },
    { values: [] },
    { kind: "heading", values: ["Tendencia de ingresos", "Ingresos"] },
    ...analytics.usage.byDay.map(row => ({ values: [row.day, Number(row.count || 0)] }))
  ];
  const summaryRows = [
    { kind: "heading", values: ["Informe de analítica institucional", ""] },
    { values: ["Periodo", `Últimos ${period}`] },
    { values: ["Proceso", process] },
    { values: ["Rol", role] },
    { values: ["Generado", new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date())] },
    { values: [] },
    { kind: "heading", values: ["Indicador", "Cantidad"] },
    ...metricRows.map(values => ({ values })),
    { values: ["Ingresos del periodo", Number(analytics.usage.totalLogins || 0)] },
    { values: ["Usuarios con ingreso", Number(analytics.usage.activeUsers || 0)] }
  ];
  const filterRows = [
    { kind: "heading", values: ["Filtros aplicados", "Valor"] },
    { values: ["Periodo", `Últimos ${period}`] },
    { values: ["Proceso", process] },
    { values: ["Rol", role] },
    { values: ["Fuente", "Actividad institucional registrada por el sistema"] }
  ];
  const sheets = [
    ["Resumen", summaryRows],
    ["Productividad", productivityRows],
    ["Usabilidad", usageRows],
    ["Filtros aplicados", filterRows]
  ];
  return workbookBlob({
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([name], index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="D9EAF7"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf xfId="0"/><xf fontId="1" fillId="1" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`,
    ...Object.fromEntries(sheets.map(([name, rows], index) => [`xl/worksheets/sheet${index + 1}.xml`, spreadsheetSheet(rows)]))
  });
}

function downloadAnalyticsWorkbook() {
  if (!currentAnalytics || currentUserRole !== "administrador") return;
  const link = document.createElement("a");
  const url = URL.createObjectURL(analyticsWorkbook(currentAnalytics));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  link.href = url;
  link.download = `analitica-institucional-${today}.xlsx`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderAnalytics(analytics) {
  currentAnalytics = analytics;
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
    const procedure = document.createElement("td");
    procedure.textContent = row.procedureName;
    tr.append(procedure);
    for (const [key] of analyticsEventLabels) {
      const cell = document.createElement("td");
      cell.textContent = String(row[key] || 0);
      tr.append(cell);
    }
    return tr;
  }));
  ui.emptyAnalyticsProcesses.hidden = analytics.byProcess.length > 0;
  ui.analyticsLogins.replaceChildren(...analytics.usage.byDay.map(row => {
    const tr = document.createElement("tr");
    const date = document.createElement("th");
    date.scope = "row";
    date.textContent = row.day;
    const count = document.createElement("td");
    count.textContent = String(row.count || 0);
    tr.append(date, count);
    return tr;
  }));
  ui.emptyAnalyticsLogins.hidden = analytics.usage.byDay.length > 0;
  const lastLogin = analytics.usage.lastLogin
    ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(analytics.usage.lastLogin))
    : "Sin registro";
  const usageLabels = currentUserRole === "evaluador"
    ? [["Ingresos del periodo", analytics.usage.totalLogins], ["Días con ingreso", analytics.usage.byDay.length], ["Último ingreso", lastLogin]]
    : [["Ingresos del periodo", analytics.usage.totalLogins], ["Usuarios con ingreso", analytics.usage.activeUsers], ["Último ingreso", lastLogin]];
  ui.analyticsUsageMetrics.replaceChildren(...usageLabels.map(([label, value]) => {
    const metric = document.createElement("div");
    metric.className = "analytics-metric";
    const strong = document.createElement("strong");
    strong.textContent = String(value);
    const caption = document.createElement("span");
    caption.textContent = label;
    metric.append(strong, caption);
    return metric;
  }));
  setMessage(ui.analyticsMessage, `Datos reales registrados durante los últimos ${analytics.periodDays} días.`, true);
}

async function loadAnalytics() {
  setMessage(ui.analyticsMessage, "Consultando actividad...");
  const query = new URLSearchParams({ periodDays: ui.analyticsPeriod.value });
  const endpoint = currentUserRole === "evaluador" ? "/api/evaluator/analytics" : "/api/admin/analytics";
  if (currentUserRole === "administrador") {
    query.set("processCode", ui.analyticsProcess.value);
    query.set("role", ui.analyticsRole.value);
  }
  try {
    const { analytics } = await request(`${endpoint}?${query}`);
    renderAnalytics(analytics);
  } catch (error) {
    handleRequestError(error, ui.analyticsMessage);
  }
}

async function loadAnalyticsProcesses() {
  try {
    const { processes } = await request("/api/admin/analytics/processes");
    const selected = ui.analyticsProcess.value;
    const allProcesses = document.createElement("option");
    allProcesses.value = "";
    allProcesses.textContent = "Todos los procesos";
    ui.analyticsProcess.replaceChildren(allProcesses, ...buildProcessOptionGroups(processes));
    ui.analyticsProcess.value = processes.some(process => process.code === selected) ? selected : "";
  } catch (error) {
    handleRequestError(error, ui.analyticsMessage);
  }
}

function describeAnalyticsProcedureTable() {
  const section = ui.analyticsByProcess.closest("section");
  section.querySelector("h3").textContent = "Actividad por procedimiento";
  const labels = ["Proceso", "Procedimiento", "Iniciados", "Envíos", "Evaluaciones", "Devoluciones", "Favorables"];
  const headerRow = section.querySelector("thead tr");
  while (headerRow.children.length < labels.length) headerRow.append(document.createElement("th"));
  [...headerRow.children].forEach((header, index) => {
    header.textContent = labels[index];
  });
  ui.emptyAnalyticsProcesses.textContent = "No hay eventos por procedimiento para estos filtros.";
}

async function showAnalytics() {
  if (!["administrador", "evaluador"].includes(currentUserRole)) return;
  const evaluatorView = currentUserRole === "evaluador";
  ui.analyticsTitle.textContent = evaluatorView ? "D1 · Mi analítica" : "D1 · Analítica";
  ui.analyticsScope.textContent = evaluatorView
    ? "Autocontrol de actividad y uso, limitado estrictamente a tus procedimientos asignados."
    : "Actividad institucional registrada por el backend. No incluye datos locales del prototipo ni actividad anterior a su captura.";
  for (const field of [ui.analyticsProcessField, ui.analyticsRoleField, ui.analyticsByProcessSection]) field.hidden = evaluatorView;
  ui.exportAnalyticsButton.hidden = evaluatorView;
  ui.notificationPopover.hidden = true;
  ui.notificationBell.setAttribute("aria-expanded", "false");
  ui.analyticsSection.hidden = false;
  ui.institutionalReportsSection.hidden = true;
  ui.pageHeading.hidden = true;
  ui.draftWorkspace.hidden = true;
  ui.evaluatorInbox.hidden = true;
  ui.evaluatorDetail.hidden = true;
  ui.flowSection.hidden = true;
  ui.documentsSection.hidden = true;
  if (!evaluatorView) {
    describeAnalyticsProcedureTable();
    await loadAnalyticsProcesses();
  }
  await loadAnalytics();
}

function hideAnalytics() {
  ui.analyticsSection.hidden = true;
  ui.pageHeading.hidden = false;
  ui.evaluatorInbox.hidden = currentUserRole !== "evaluador";
  ui.draftWorkspace.hidden = currentUserRole === "evaluador";
  ui.editorSection.hidden = currentUserRole !== "elaborador";
  ui.ownedDraftsSection.hidden = currentUserRole !== "elaborador";
  ui.documentsSection.hidden = currentUserRole !== "elaborador";
  ui.flowSection.hidden = currentUserRole !== "elaborador";
  if (currentUserRole === "elaborador") renderFlow();
}

function renderInstitutionalReports(reports) {
  ui.institutionalReportsCount.textContent = `${reports.length} procedimiento${reports.length === 1 ? "" : "s"} favorable${reports.length === 1 ? "" : "s"}`;
  ui.emptyInstitutionalReports.hidden = reports.length > 0;
  ui.institutionalReportsList.replaceChildren(...reports.map(report => {
    const item = document.createElement("li");
    item.className = "draft-item";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "draft-open";
    const info = document.createElement("span");
    info.className = "draft-info";
    const name = document.createElement("strong");
    name.textContent = report.name;
    const details = document.createElement("small");
    details.textContent = `${report.code || "Código pendiente"} · ${report.processCode} · versión ${report.version || "1.0"}`;
    const action = document.createElement("span");
    action.className = "draft-status";
    action.textContent = "Generar PDF institucional";
    info.append(name, details);
    button.append(info, action);
    button.addEventListener("click", () => openInstitutionalReport(report.id));
    item.append(button);
    return item;
  }));
}

async function loadInstitutionalReports() {
  setMessage(ui.institutionalReportsMessage, "Consultando procedimientos aprobados formalmente...");
  try {
    const { reports } = await request("/api/admin/institutional-reports");
    renderInstitutionalReports(reports);
    setMessage(ui.institutionalReportsMessage, reports.length ? "Selecciona un procedimiento aprobado formalmente para generar su PDF institucional." : "", Boolean(reports.length));
  } catch (error) {
    handleRequestError(error, ui.institutionalReportsMessage);
  }
}

function showInstitutionalReports() {
  if (currentUserRole !== "administrador") return;
  ui.notificationPopover.hidden = true;
  ui.notificationBell.setAttribute("aria-expanded", "false");
  ui.analyticsSection.hidden = true;
  ui.institutionalReportsSection.hidden = false;
  ui.pageHeading.hidden = true;
  ui.draftWorkspace.hidden = true;
  ui.evaluatorInbox.hidden = true;
  ui.evaluatorDetail.hidden = true;
  ui.flowSection.hidden = true;
  ui.documentsSection.hidden = true;
  loadInstitutionalReports();
}

function hideInstitutionalReports() {
  ui.institutionalReportsSection.hidden = true;
  ui.pageHeading.hidden = false;
  ui.draftWorkspace.hidden = currentUserRole === "evaluador";
  ui.editorSection.hidden = currentUserRole !== "elaborador";
  ui.ownedDraftsSection.hidden = currentUserRole !== "elaborador";
  ui.documentsSection.hidden = currentUserRole !== "elaborador";
  ui.flowSection.hidden = currentUserRole !== "elaborador";
  if (currentUserRole === "elaborador") renderFlow();
}

async function openInstitutionalReport(id) {
  if (dirty && !window.confirm("Hay cambios sin guardar. ¿Descartarlos y abrir este procedimiento?")) return;
  try {
    const { procedure, branding } = await request(`/api/reports/procedures/${encodeURIComponent(id)}`);
    populateDraft(procedure);
    ui.institutionalReportsSection.hidden = true;
    ui.pageHeading.hidden = false;
    ui.draftWorkspace.hidden = false;
    ui.editorSection.hidden = true;
    ui.documentsSection.hidden = true;
    ui.flowSection.hidden = true;
    showPreview({ branding });
  } catch (error) {
    handleRequestError(error, ui.institutionalReportsMessage);
  }
}

function clearSession() {
  flowReviewVersion += 1;
  lastFlowReviewPassed = false;
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
  previewBranding = "standard";
  ui.evaluationWorkspace.hidden = true;
  ui.returnedEvaluation.hidden = true;
  normRows = [];
  normativityConfirmedMissingTypes = [];
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
  ui.institutionalReportsSection.hidden = true;
  ui.pageHeading.hidden = false;
  ui.analyticsButton.hidden = true;
  ui.institutionalReportsButton.hidden = true;
  ui.notificationPopover.hidden = true;
  ui.notificationBell.setAttribute("aria-expanded", "false");
  ui.notificationCount.hidden = true;
  ui.notificationList.replaceChildren();
  ui.institutionalReportsList.replaceChildren();
  ui.previewButton.hidden = true;
  ui.submitReviewButton.hidden = true;
  ui.submitReviewButton.disabled = true;
  ui.reloadDraftButton.hidden = true;
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
  ui.institutionalReportsSection.hidden = true;
  ui.pageHeading.hidden = false;
  ui.analyticsButton.hidden = !["administrador", "evaluador"].includes(user.role);
  ui.institutionalReportsButton.hidden = user.role !== "administrador";
  ui.notificationPopover.hidden = true;
  ui.notificationBell.setAttribute("aria-expanded", "false");
  currentUserRole = user.role;
  ui.evaluatorInbox.hidden = true;
  ui.evaluatorDetail.hidden = true;
  ui.previewButton.hidden = true;
  ui.submitReviewButton.hidden = user.role !== "elaborador";
  ui.submitReviewButton.disabled = true;
  const authorWorkspace = user.role === "elaborador";
  ui.editorSection.hidden = !authorWorkspace;
  ui.editorHeading.hidden = !authorWorkspace;
  ui.procedureProgress.hidden = !authorWorkspace;
  ui.draftForm.hidden = !authorWorkspace;
  ui.returnedEvaluation.hidden = true;
  ui.ownedDraftsSection.hidden = !authorWorkspace;

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
  if (user.role === "administrador") {
    ui.draftWorkspace.hidden = false;
    await loadAdminApprovalQueue();
    return;
  }
  if (user.role !== "elaborador") {
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
  pendiente_visto_bueno_administrativo: "Pendiente de visto bueno administrativo",
  aprobado_formalmente: "Aprobado formalmente / vigente",
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
  let completed = 0;
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
      const criterionComplete = evaluationCriterionComplete(criterion);
      if (record.result) { answered += 1; groupAnswered += 1; }
      if (criterionComplete) completed += 1;
      if (!notApplicable) applicable += 1;
      if (criterionComplete && record.result === "Cumple") passed += 1;
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
  const complete = completed === evaluationCriteriaList().length;
  return { answered, completed, complete, total: evaluationCriteriaList().length, failures, criticalFailures, openFindings, score,
    level: !complete ? "Pendiente" : score <= 39 ? "Bajo" : score < 90 ? "Medio" : "Alto", groups };
}

function synchronizeEvaluationDecisionButtons(favorableReady, returnReady) {
  const apply = () => {
    ui.favorableEvaluationButton.disabled = !favorableReady;
    ui.returnEvaluationButton.disabled = !returnReady;
    ui.favorableEvaluationButton.classList.toggle("is-ready", favorableReady);
    ui.returnEvaluationButton.classList.toggle("is-ready", returnReady);
  };
  apply();
  requestAnimationFrame(apply);
}

function refreshEvaluationSummary() {
  const metrics = localEvaluationMetrics();
  if (!metrics) return;
  ui.evaluationProgress.textContent = `${metrics.completed} de ${metrics.total} criterios validados · ${metrics.failures} incumplidos · ${metrics.criticalFailures} críticos`;
  ui.evaluationScore.textContent = `${metrics.score.toFixed(1)}%`;
  ui.evaluationLevel.textContent = metrics.level;
  // The decision buttons must follow the active evaluation form, which was already
  // authorized when it was rendered. The server remains the final workflow guard.
  const editable = currentUserRole === "evaluador" && !ui.evaluationWorkspace.hidden && !ui.evaluationConcept.disabled;
  const favorableReady = editable && metrics.complete && metrics.failures === 0;
  const returnReady = editable && metrics.complete && metrics.failures > 0;
  synchronizeEvaluationDecisionButtons(favorableReady, returnReady);
  const missing = metrics.total - metrics.completed;
  let decisionHint = "";
  if (editable && missing > 0) {
    decisionHint = `Faltan ${missing} criterio(s) por completar. Cada criterio debe tener resultado y observación; todo “No cumple” requiere además el ajuste solicitado.`;
  } else if (returnReady) {
    decisionHint = `La evaluación está completa y tiene ${metrics.failures} incumplimiento(s). Ya puedes emitir el concepto no favorable y devolver para ajustes.`;
  } else if (favorableReady) {
    decisionHint = "La evaluación está completa y todos los criterios cumplen. Ya puedes emitir el concepto favorable.";
  }
  ui.evaluationDecisionHint.textContent = decisionHint;
  ui.evaluationDecisionHint.hidden = !decisionHint;
  const automaticConcept = automaticEvaluationConcept(metrics);
  ui.evaluationAutoConcept.hidden = !automaticConcept;
  ui.evaluationAutoConcept.textContent = automaticConcept;
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
    result.textContent = `${group.state.completed}/${group.total} · ${group.score.toFixed(1)}% · peso ${group.weight}%`;
    const toggle = document.createElement("span");
    toggle.className = "evaluation-variable-toggle";
    toggle.setAttribute("aria-hidden", "true");
    toggle.textContent = group.state.className === "group-complete" ? "✓" : "+";
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
    details.querySelector(".evaluation-group-score").textContent = `${group.state.completed}/${group.total} · ${group.score.toFixed(1)}%`;
    details.querySelector(".evaluation-group-progress-fill").style.width = `${Math.round(group.state.completed / group.total * 100)}%`;
  });
}

function automaticEvaluationConcept(metrics) {
  if (!currentEvaluation || !evaluationRubric) return "";
  if (metrics.complete && metrics.failures === 0) {
    return "Con base en la verificación técnica y metodológica realizada, el procedimiento cumple los criterios aplicables para su aprobación.";
  }
  const failed = evaluationRubric.groups.flatMap(group => group.criteria
    .filter(criterion => currentEvaluation.criteria[criterion.id]?.result === "No cumple")
    .map(criterion => ({ ...criterion, groupName: group.name })));
  if (!failed.length) return "";
  return ["Hallazgos que requieren ajuste:", ...failed.map((criterion, index) => {
    const record = currentEvaluation.criteria[criterion.id] || {};
    return `${index + 1}. ${criterion.groupName}: ${criterion.question}\nObservación: ${record.observation || "Sin detalle registrado."}\nAjuste requerido: ${record.adjustment || "Sin detalle registrado."}`;
  })].join("\n\n");
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
        response.textContent = `Acción realizada por el Elaborador: ${record.response}`;
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
  ui.evaluationConcept.value = currentEvaluation.conceptComplement || "";
  ui.evaluationConcept.disabled = !editable;
  ui.exportEvaluationReportButton.hidden = currentUserRole !== "evaluador";
  for (const button of [ui.saveEvaluationButton, ui.returnEvaluationButton, ui.favorableEvaluationButton]) button.hidden = !editable;
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
  ui.returnedEvaluation.hidden = !returnedEvaluation || !["devuelto_para_ajustes", "concepto_favorable", "concepto_no_favorable", "pendiente_visto_bueno_administrativo", "aprobado_formalmente"].includes(currentDraft?.status);
  if (ui.returnedEvaluation.hidden) return;
  const editable = currentUserRole === "elaborador" && currentDraft.status === "devuelto_para_ajustes";
  ui.returnedEvaluationSummary.textContent = `${statusLabel(currentDraft.status)} · ${Number(returnedEvaluation.score || 0).toFixed(1)}%`;
  const administrativeObservation = String(currentDraft?.adminApprovalObservation || "").trim();
  ui.returnedEvaluationConcept.textContent = [
    returnedEvaluation.concept ? `Concepto técnico: ${returnedEvaluation.concept}` : "",
    administrativeObservation ? `Observación administrativa: ${administrativeObservation}` : ""
  ].filter(Boolean).join("\n\n");
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
    response.placeholder = "Describe de manera concreta qué corregiste.";
    response.addEventListener("input", () => { record.response = response.value; returnedResponsesDirty = true; });
    evaluationField(grid, "Acción realizada", response);
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

function renderAdminApproval() {
  const visible = currentUserRole === "administrador" && currentDraft?.status === "pendiente_visto_bueno_administrativo";
  ui.adminApprovalSection.hidden = !visible;
  if (!visible) return;
  const score = Number(returnedEvaluation?.score || 0).toFixed(1);
  ui.adminApprovalSummary.textContent = `Concepto técnico favorable del Evaluador · ${score}% · pendiente de decisión administrativa.`;
  ui.adminApprovalObservation.value = "";
  setMessage(ui.adminApprovalMessage, "");
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

function renderAdminApprovalQueue(procedures) {
  ui.adminApprovalQueue.hidden = currentUserRole !== "administrador";
  if (currentUserRole !== "administrador") return;
  ui.adminApprovalCount.textContent = `${procedures.length} procedimiento${procedures.length === 1 ? "" : "s"}`;
  ui.emptyAdminApprovalQueue.hidden = procedures.length > 0;
  ui.adminApprovalQueueList.replaceChildren(...procedures.map(procedure => {
    const item = document.createElement("li");
    item.className = "draft-item";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "draft-open";
    const info = document.createElement("span");
    info.className = "draft-info";
    const name = document.createElement("strong");
    name.textContent = procedure.name;
    const details = document.createElement("small");
    details.textContent = `${procedure.code || "Código pendiente"} · ${procedure.processCode} · concepto técnico favorable`;
    const status = document.createElement("span");
    status.className = "draft-status";
    status.textContent = "Revisar visto bueno";
    info.append(name, details);
    button.append(info, status);
    button.addEventListener("click", () => openAdministrativeApproval(procedure.id));
    item.append(button);
    return item;
  }));
}

async function loadAdminApprovalQueue() {
  if (currentUserRole !== "administrador") return;
  try {
    const { procedures } = await request("/api/admin/pending-approvals");
    renderAdminApprovalQueue(procedures);
    setMessage(ui.adminApprovalQueueMessage, "");
  } catch (error) {
    handleRequestError(error, ui.adminApprovalQueueMessage);
  }
}

async function openDraft(id, discardChanges = false) {
  if (!discardChanges && dirty && !window.confirm("Hay cambios sin guardar. ¿Descartarlos y abrir este procedimiento?")) return false;
  setMessage(ui.listMessage, "");

  try {
    const { procedure } = await request("/api/procedures/" + encodeURIComponent(id));
    if (procedure.evaluation) await loadEvaluationRubric();
    populateDraft(procedure);
    ui.evaluatorInbox.hidden = true;
    ui.evaluatorDetail.hidden = true;
    ui.draftWorkspace.hidden = false;
    syncProcedureNameValidity();
    syncDefinitionsAlphabeticalSuggestion();
    ui.draftName.focus();
    return true;
  } catch (error) {
    handleRequestError(error, ui.listMessage);
    return false;
  }
}

async function openAdministrativeApproval(id, discardChanges = false) {
  if (currentUserRole !== "administrador") return false;
  if (!discardChanges && dirty && !window.confirm("Hay cambios sin guardar. ¿Descartarlos y abrir este procedimiento?")) return false;
  setMessage(ui.adminApprovalQueueMessage, "");
  try {
    await loadEvaluationRubric();
    const { procedure, evaluation } = await request(`/api/admin/procedures/${encodeURIComponent(id)}/final-approval`);
    procedure.evaluation = evaluation;
    populateDraft(procedure);
    ui.evaluatorInbox.hidden = true;
    ui.evaluatorDetail.hidden = true;
    ui.editorSection.hidden = false;
    ui.draftWorkspace.hidden = false;
    ui.adminApprovalSection.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  } catch (error) {
    handleRequestError(error, ui.adminApprovalQueueMessage);
    return false;
  }
}

async function reloadCurrentDraft() {
  if (!currentDraft) return;
  if (!window.confirm("Se reemplazarán los cambios que están en pantalla por la última versión guardada. ¿Desea continuar?")) return;
  const id = currentDraft.id;
  ui.reloadDraftButton.disabled = true;
  try {
    if (await openDraft(id, true)) {
      ui.reloadDraftButton.hidden = true;
      setMessage(ui.editorMessage, "Se cargó la última versión guardada. Puedes revisar y volver a editar.", true);
      await loadDrafts();
    }
  } finally {
    ui.reloadDraftButton.disabled = false;
  }
}

function populateDraft(procedure) {
  flowReviewVersion += 1;
  lastFlowReviewPassed = false;
  currentDraft = procedure;
  returnedEvaluation = procedure.evaluation || null;
  returnedResponsesDirty = false;
  currentPayload = procedure.payload && typeof procedure.payload === "object" && !Array.isArray(procedure.payload) ? procedure.payload : {};
  normativityConfirmedMissingTypes = Array.isArray(currentPayload.settings?.normativityConfirmedMissingTypes)
    ? currentPayload.settings.normativityConfirmedMissingTypes.filter(type => normTypes.includes(type))
    : [];
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
    if (inputId === "draftPreparedBy") populateApprovalRoleSelect(ui[inputId], value, nonDirectiveRoleLevels, true);
    else if (inputId === "draftReviewedBy") populateApprovalRoleSelect(ui[inputId], value, null, true);
    else if (inputId === "draftApprovedBy") populateApprovalRoleSelect(ui[inputId], value, ["Directivo"]);
    else ui[inputId].value = value;
  }
  syncProcedureNameValidity();
  syncDefinitionsAlphabeticalSuggestion();
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
  ui.reloadDraftButton.hidden = true;
  dirty = false;
  setMessage(ui.editorMessage, "");
  ui.flowReviewResult.hidden = true;
  ui.flowReviewResult.replaceChildren();
  renderReturnedEvaluation();
  renderAdminApproval();
  applyDraftEditability();
  refreshProcedureProgress();
  void restoreFlowReviewState();
}

function applyDraftEditability() {
  const administrativeDecision = currentUserRole === "administrador" && Boolean(currentDraft?.adminApprovalByUserId);
  const editable = ["elaborador", "administrador"].includes(currentUserRole) &&
    (!currentDraft || ["borrador", "devuelto_para_ajustes"].includes(currentDraft.status)) && !administrativeDecision;
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
  lastFlowReviewPassed = false;
  currentDraft = null;
  returnedEvaluation = null;
  returnedResponsesDirty = false;
  ui.returnedEvaluation.hidden = true;
  currentPayload = { fields: {}, norms: [], activities: [], annexes: [], changes: [], settings: {} };
  normRows = [];
  normativityConfirmedMissingTypes = [];
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
  populateApprovalRoleSelect(ui.draftPreparedBy, "", nonDirectiveRoleLevels, true);
  populateApprovalRoleSelect(ui.draftReviewedBy, "", null, true);
  populateApprovalRoleSelect(ui.draftApprovedBy, "", ["Directivo"]);
  for (const [inputId] of textFields) ui[inputId].value = "";
  showRoleSeparation();
  syncProcedureCode();
  ui.processCode.disabled = false;
  ui.editorTitle.textContent = "Nuevo borrador";
  ui.editorStatus.textContent = "Borrador no guardado";
  ui.saveDraftButton.textContent = "Guardar borrador";
  ui.saveDocumentsButton.textContent = "Guardar borrador";
  ui.reloadDraftButton.hidden = true;
  dirty = false;
  setMessage(ui.editorMessage, "");
  ui.flowReviewResult.hidden = true;
  ui.flowReviewResult.replaceChildren();
  syncProcedureNameValidity();
  syncDefinitionsAlphabeticalSuggestion();
  applyDraftEditability();
  refreshProcedureProgress();
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
window.addEventListener("beforeunload", event => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = "";
});
ui.processCode.addEventListener("change", () => {
  syncProcedureCode();
  refreshProcedureProgress();
});
ui.draftConsecutive.addEventListener("input", () => {
  syncProcedureCode();
  refreshProcedureProgress();
});
for (const inputId of ["draftPreparedBy", "draftReviewedBy", "draftApprovedBy"]) {
  ui[inputId].addEventListener("change", () => {
    syncApprovalOther(ui[inputId]);
    showRoleSeparation();
    refreshProcedureProgress();
  });
}
for (const inputId of ["draftPreparedOther", "draftReviewedOther"]) {
  ui[inputId].addEventListener("input", () => {
    showRoleSeparation();
    refreshProcedureProgress();
  });
}
for (const inputId of ["draftPreparedName", "draftReviewedName", "draftApprovedName"]) {
  ui[inputId].addEventListener("input", () => {
    showRoleSeparation();
    refreshProcedureProgress();
  });
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
ui.procedureProgress.addEventListener("click", event => {
  const button = event.target.closest("button[data-progress-target]");
  const target = button?.dataset.progressTarget;
  if (!target) return;
  document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  if (!confirmRepeatedApprovalNames()) return;
  const button = ui.saveDraftButton;
  button.disabled = true;

  const name = ui.draftName.value.trim();
  syncProcedureNameValidity();
  const fields = currentPayload.fields && typeof currentPayload.fields === "object" && !Array.isArray(currentPayload.fields)
    ? currentPayload.fields
    : {};
  const updatedFields = { ...fields, nombre: name };
  for (const [inputId, fieldId] of textFields) updatedFields[fieldId] = ui[inputId].value;
  updatedFields.elaboro = approvalRoleValue(ui.draftPreparedBy);
  updatedFields.reviso = approvalRoleValue(ui.draftReviewedBy);
  updatedFields.aprobo = approvalRoleValue(ui.draftApprovedBy);
  const payload = {
    ...currentPayload,
    fields: updatedFields,
    norms: normRows.map(norm => ({ ...norm })),
    activities: activityRows.map(activity => ({ ...activity })),
    annexes: annexRows.map(annex => ({ ...annex })),
    changes: changeRows.map(change => ({ ...change })),
    settings: {
      ...(currentPayload.settings && typeof currentPayload.settings === "object" && !Array.isArray(currentPayload.settings) ? currentPayload.settings : {}),
      annexesNotApplicable,
      normativityConfirmedMissingTypes: [...normativityConfirmedMissingTypes]
    }
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
    normativityConfirmedMissingTypes = Array.isArray(currentPayload.settings?.normativityConfirmedMissingTypes)
      ? currentPayload.settings.normativityConfirmedMissingTypes.filter(type => normTypes.includes(type))
      : [];
    normRows = Array.isArray(currentPayload.norms) ? currentPayload.norms.map(norm => ({ ...norm })) : [];
    activityRows = Array.isArray(currentPayload.activities) ? currentPayload.activities.map(activity => ({ ...activity })) : [];
    renderFlow();
    annexRows = Array.isArray(currentPayload.annexes) ? currentPayload.annexes.map(annex => ({ ...annex })) : [];
    changeRows = Array.isArray(currentPayload.changes) ? currentPayload.changes.map(change => ({ ...change })) : [];
    annexesNotApplicable = currentPayload.settings?.annexesNotApplicable === true;
    renderNormativityReview();
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
    ui.reloadDraftButton.hidden = true;
    dirty = false;
    applyDraftEditability();
    refreshProcedureProgress();
    setMessage(ui.editorMessage, "Borrador guardado.", true);
    setMessage(ui.documentsMessage, "Borrador guardado.", true);
    await loadDrafts();
  } catch (error) {
    if (error.code === "draft_conflict" && currentDraft) {
      ui.reloadDraftButton.hidden = false;
      const message = "El borrador cambió en otra sesión. Tus cambios siguen en pantalla; recarga la última versión para compararlos antes de continuar.";
      setMessage(ui.editorMessage, message);
      setMessage(ui.documentsMessage, message);
    } else {
      handleRequestError(error, ui.editorMessage);
      if (!["unauthenticated", "csrf_failed", "password_change_required"].includes(error.code)) {
        setMessage(ui.documentsMessage, errorText(error));
      }
    }
  } finally {
    button.disabled = false;
  }
});

ui.draftName.addEventListener("input", () => syncProcedureNameValidity());
ui.draftDefinitions.addEventListener("input", () => syncDefinitionsAlphabeticalSuggestion());

ui.reloadDraftButton.addEventListener("click", reloadCurrentDraft);

ui.newDraftButton.addEventListener("click", newDraft);
async function saveReturnedResponses() {
  if (!currentDraft || !returnedEvaluation || currentDraft.status !== "devuelto_para_ajustes") return;
  const responses = Object.fromEntries(Object.entries(returnedEvaluation.criteria)
    .filter(([, record]) => record.result === "No cumple")
    .map(([id, record]) => [id, { action: record.response || "" }]));
  const result = await request(`/api/procedures/${encodeURIComponent(currentDraft.id)}/evaluation-responses`, {
    method: "PUT", csrf: true, body: { responses }
  });
  returnedResponsesDirty = false;
  setMessage(ui.returnedEvaluationMessage, result.missingResponses
    ? `Respuestas guardadas. Faltan ${result.missingResponses} hallazgo(s) con acción pendiente.`
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
  if (!normativityState().complete) {
    setMessage(ui.editorMessage, "Completa las normas registradas o confirma la revisión de las categorías interna y externa antes de enviar.");
    ui.normReview.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  setMessage(ui.submitReviewMessage, "");
  try {
    if (currentDraft.status === "devuelto_para_ajustes" && returnedEvaluation) {
      const missing = Object.values(returnedEvaluation.criteria).filter(record => record.result === "No cumple" && !String(record.response || "").trim());
      if (missing.length) {
        setMessage(ui.editorMessage, `Completa la acción realizada de ${missing.length} hallazgo(s) antes de reenviar.`);
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
    conceptComplement: evaluation.conceptComplement,
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
  const label = decision === "devolver" ? "emitir concepto no favorable y devolver para ajustes" : "emitir concepto favorable";
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
ui.favorableEvaluationButton.addEventListener("click", () => submitEvaluationDecision("favorable"));

async function submitAdministrativeApproval(decision) {
  if (!currentDraft || currentDraft.status !== "pendiente_visto_bueno_administrativo") return;
  const observation = ui.adminApprovalObservation.value.trim();
  if (decision === "devolver" && !observation) {
    setMessage(ui.adminApprovalMessage, errorMessages.admin_return_observation_required);
    ui.adminApprovalObservation.focus();
    return;
  }
  const label = decision === "aprobar"
    ? "dar el visto bueno y aprobar formalmente"
    : "devolver el procedimiento para ajustes";
  if (!window.confirm(`¿Confirmas ${label}?`)) return;
  const buttons = [ui.returnAdminApprovalButton, ui.approveAdminApprovalButton];
  buttons.forEach(button => { button.disabled = true; });
  try {
    const id = currentDraft.id;
    await request(`/api/admin/procedures/${encodeURIComponent(id)}/final-approval`, {
      method: "POST", csrf: true, body: { decision, observation }
    });
    currentDraft = null;
    currentEvaluation = null;
    ui.adminApprovalSection.hidden = true;
    ui.editorSection.hidden = true;
    await loadAdminApprovalQueue();
    setMessage(ui.adminApprovalQueueMessage, decision === "aprobar"
      ? "Visto bueno registrado. El procedimiento quedó aprobado formalmente y vigente."
      : "Devolución administrativa registrada y notificada.", true);
  } catch (error) {
    handleRequestError(error, ui.adminApprovalMessage);
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}

ui.returnAdminApprovalButton.addEventListener("click", () => submitAdministrativeApproval("devolver"));
ui.approveAdminApprovalButton.addEventListener("click", () => submitAdministrativeApproval("aprobar"));

function evaluationReportConcept(metrics) {
  const automatic = automaticEvaluationConcept(metrics);
  const complement = String(ui.evaluationConcept.value || currentEvaluation?.conceptComplement || "").trim();
  if (automatic && complement) return `${automatic}\n\nComplemento del evaluador:\n${complement}`;
  if (automatic) return automatic;
  if (complement) return complement;
  return "La evaluación está en curso. Aún no hay un concepto técnico definitivo.";
}

function evaluationReportCell(value) {
  const cell = document.createElement("td");
  cell.textContent = String(value || "Sin información registrada.");
  return cell;
}

function buildEvaluationReport() {
  const metrics = localEvaluationMetrics();
  if (!metrics || !currentDraft || !evaluationRubric) return null;
  const report = document.createElement("article");
  report.className = "evaluation-pdf-report";
  const title = document.createElement("h1");
  title.textContent = "INFORME DE EVALUACIÓN DE ADECUACIÓN";
  const process = ui.processCode.selectedOptions[0]?.textContent || processNames.get(currentDraft.processCode) || currentDraft.processCode || "Proceso pendiente";
  const meta = document.createElement("dl");
  meta.className = "evaluation-pdf-meta";
  const metadata = [
    ["Procedimiento", currentDraft.name || "Sin nombre"],
    ["Código y versión", `${currentDraft.code || "Código pendiente"} · versión ${currentDraft.version || "1.0"}`],
    ["Proceso", process],
    ["Evaluador", ui.sessionIdentity.textContent || "Sin identificar"],
    ["Estado", statusLabel(currentDraft.status)],
    ["Resultado", `${metrics.score.toFixed(1)}% · ${metrics.level} · ${metrics.completed}/${metrics.total} criterios validados`],
    ["Generado", new Date().toLocaleString("es-CO")]
  ];
  for (const [label, value] of metadata) {
    const term = document.createElement("dt");
    term.textContent = label;
    const definition = document.createElement("dd");
    definition.textContent = value;
    meta.append(term, definition);
  }
  const conceptTitle = document.createElement("h2");
  conceptTitle.textContent = "Concepto técnico";
  const concept = document.createElement("p");
  concept.className = "evaluation-pdf-concept";
  concept.textContent = evaluationReportConcept(metrics);
  const criteriaTitle = document.createElement("h2");
  criteriaTitle.textContent = "Detalle de criterios";
  const table = document.createElement("table");
  const headers = ["N.º", "Variable", "Criterio", "Resultado", "Observación", "Ajuste requerido", "Respuesta del elaborador", "Estado"];
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach(header => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = header;
    headRow.append(cell);
  });
  head.append(headRow);
  const body = document.createElement("tbody");
  let number = 0;
  for (const group of evaluationRubric.groups) {
    for (const criterion of group.criteria) {
      number += 1;
      const record = currentEvaluation.criteria[criterion.id] || {};
      const response = record.response ? `Acción: ${record.response}` : "";
      const row = document.createElement("tr");
      [number, group.name, criterion.question, record.result || "Pendiente", record.observation, record.adjustment, response, record.findingStatus || "Pendiente"]
        .forEach(value => row.append(evaluationReportCell(value)));
      body.append(row);
    }
  }
  table.append(head, body);
  const changeControlTitle = document.createElement("h2");
  changeControlTitle.textContent = "Control de cambios";
  report.append(title, meta, conceptTitle, concept, criteriaTitle, table, changeControlTitle, changeControlReport());
  return report;
}

function exportEvaluationReport() {
  const report = buildEvaluationReport();
  if (!report) return;
  const popup = window.open("", "_blank");
  if (!popup) {
    setMessage(ui.evaluationMessage, "El navegador bloqueó la ventana de exportación. Permite las ventanas emergentes e inténtalo de nuevo.");
    return;
  }
  const stylesheetUrl = new URL("/drafts.css", window.location.origin).href;
  popup.document.open();
  popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe de evaluación</title><link rel="stylesheet" href="${stylesheetUrl}"></head><body></body></html>`);
  popup.document.close();
  popup.document.title = `Informe de evaluación - ${currentDraft.code || "procedimiento"}`;
  popup.document.body.append(report);
  const stylesheet = popup.document.querySelector('link[rel="stylesheet"]');
  let printed = false;
  const print = () => {
    if (printed) return;
    printed = true;
    popup.focus();
    popup.print();
  };
  stylesheet?.addEventListener("load", print, { once: true });
  stylesheet?.addEventListener("error", print, { once: true });
  window.setTimeout(print, 1_500);
}

ui.exportEvaluationReportButton.addEventListener("click", exportEvaluationReport);
function reportTable(headers, records, valuesForRecord, { variant = "", columnWidths = [] } = {}) {
  const table = document.createElement("table");
  table.className = "preview-report-table";
  table.dataset.columns = String(headers.length);
  if (variant) table.dataset.variant = variant;
  if (columnWidths.length === headers.length) {
    const colgroup = document.createElement("colgroup");
    columnWidths.forEach(width => {
      const col = document.createElement("col");
      col.style.width = width;
      colgroup.append(col);
    });
    table.append(colgroup);
  }
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

function reportConditionList(value) {
  const entries = String(value || "").split(/\r?\n+/).flatMap(line =>
    line.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || []
  ).map(entry => entry.trim().replace(/^(?:[-*]|\d+[.)])\s*/, "")).filter(Boolean);
  if (!entries.length) return document.createTextNode("Sin información registrada.");
  const list = document.createElement("ol");
  list.className = "preview-condition-list";
  for (const entry of entries) {
    const item = document.createElement("li");
    item.textContent = entry;
    list.append(item);
  }
  return list;
}

function reportParagraphs(value) {
  const block = document.createElement("div");
  block.className = "preview-text-block";
  const paragraphs = String(value || "").split(/\r?\n+/).map(paragraph => paragraph.trim()).filter(Boolean);
  for (const paragraph of paragraphs.length ? paragraphs : ["Sin información registrada."]) {
    const item = document.createElement("p");
    item.className = "preview-paragraph";
    item.textContent = paragraph;
    block.append(item);
  }
  return block;
}

function dateOnly(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

function versioningDate(changes, version, approvedAt = "") {
  const formalApprovalDate = dateOnly(approvedAt);
  if (formalApprovalDate) return formalApprovalDate;
  const datedChanges = (Array.isArray(changes) ? changes : []).filter(change =>
    change && typeof change === "object" && String(change.fecha || "").trim()
  );
  const normalizedVersion = String(version || "").trim();
  const matchingChanges = normalizedVersion
    ? datedChanges.filter(change => String(change.version || "").trim() === normalizedVersion)
    : [];
  return (matchingChanges.at(-1) || datedChanges.at(-1))?.fecha || "";
}

function reportChangeRows(changes, version, approvedAt) {
  const formalApprovalDate = dateOnly(approvedAt);
  const normalizedVersion = String(version || "").trim();
  return (Array.isArray(changes) ? changes : []).map(change => {
    if (!change || typeof change !== "object" || String(change.version || "").trim() !== normalizedVersion) return change;
    return { ...change, fecha: formalApprovalDate || "Pendiente de aprobación formal" };
  });
}

function workflowDate(value, pendingLabel) {
  return dateOnly(value) || pendingLabel;
}

function approvalReportCell(name, role, date) {
  return [
    `Nombre: ${String(name || "").trim() || "Sin información registrada."}`,
    `Cargo: ${String(role || "").trim() || "Sin información registrada."}`,
    `Fecha: ${String(date || "").trim() || "Sin información registrada."}`
  ].join("\n");
}

function changeControlReport() {
  const content = document.createElement("div");
  content.className = "preview-change-control";
  const reportVersion = currentDraft?.version || changeRows.at(-1)?.version || "";
  const updates = reportTable(["VERSIÓN", "FECHA", "RAZÓN DE LA ACTUALIZACIÓN"], reportChangeRows(changeRows, reportVersion, currentDraft?.approvedAt), row => [row.version, row.fecha, row.razon], {
    variant: "change-control",
    columnWidths: ["33.33%", "33.33%", "33.34%"]
  });
  const approvals = reportTable(["ELABORÓ", "REVISÓ", "APROBÓ"], [{}], () => [
    approvalReportCell(ui.draftPreparedName.value, approvalRoleValue(ui.draftPreparedBy), workflowDate(currentDraft?.submittedForReviewAt, "Pendiente de envío a revisión")),
    approvalReportCell(ui.draftReviewedName.value, approvalRoleValue(ui.draftReviewedBy), workflowDate(currentDraft?.technicalReviewedAt, "Pendiente de concepto técnico")),
    approvalReportCell(ui.draftApprovedName.value, approvalRoleValue(ui.draftApprovedBy), workflowDate(currentDraft?.approvedAt, "Pendiente de visto bueno administrativo"))
  ], { variant: "approval-signatures", columnWidths: ["33.33%", "33.33%", "33.34%"] });
  content.append(updates, approvals);
  return content;
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

function showPreview({ branding = "standard" } = {}) {
  previewBranding = branding === "institutional" ? "institutional" : "standard";
  const institutional = previewBranding === "institutional";
  const content = ui.previewContent;
  const process = ui.processCode.selectedOptions[0]?.textContent || "Sin proceso seleccionado";
  const header = document.createElement("header");
  header.className = "preview-document-header";
  if (!institutional) header.classList.add("standard");
  const agency = document.createElement("div");
  agency.className = "preview-agency-mark";
  const agencyLogo = document.createElement("img");
  agencyLogo.src = "/institutional-logo.png";
  agencyLogo.alt = "Alcaldía de Barranquilla";
  agency.append(agencyLogo);
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
  const reportCode = currentDraft?.code || ui.draftCode.value || "Sin código asignado";
  const reportVersion = currentDraft?.version || changeRows.at(-1)?.version || "1.0";
  const reportStatus = statusLabel(currentDraft?.status || "borrador");
  for (const [label, value] of [["Código", reportCode], ["Versión", reportVersion], ["Estado", reportStatus]]) {
    const cell = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = label;
    const text = document.createElement("span");
    text.textContent = value;
    cell.append(strong, text);
    meta.append(cell);
  }
  if (institutional) {
    header.classList.add("institutional");
    const procedure = document.createElement("div");
    procedure.className = "preview-institutional-procedure";
    for (const [className, text] of [
      ["preview-institutional-label", "Procedimiento"],
      ["preview-institutional-name", name.textContent],
      ["preview-institutional-process", `Proceso: ${process}`]
    ]) {
      const row = document.createElement("div");
      row.className = className;
      row.textContent = text;
      procedure.append(row);
    }
    const institutionalMeta = document.createElement("div");
    institutionalMeta.className = "preview-institutional-meta";
    const reportDate = versioningDate(changeRows, reportVersion, currentDraft?.approvedAt) || "Pendiente de aprobación formal";
    for (const value of [`Código: ${reportCode}`, `Versión: ${reportVersion}`, `Fecha: ${reportDate}`]) {
      const row = document.createElement("div");
      row.textContent = value;
      institutionalMeta.append(row);
    }
    header.append(agency, procedure, institutionalMeta);
  } else {
    header.append(title, meta);
  }

  const definitions = ui.draftDefinitions.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const split = line.indexOf(":");
    return split > 0 ? [line.slice(0, split).trim(), line.slice(split + 1).trim()] : ["Definición", line];
  });
  const definitionTable = reportTable(["Término", "Definición"], definitions, row => row, {
    variant: "definitions",
    columnWidths: ["32%", "68%"]
  });
  const destinations = new Map(activityRows.map(activity => [activity.uid, activity.actividad || activity.tipo || "Destino"]));
  const showEvidence = activityRows.some(activity => String(activity.evidencia || activity.controlEvidencia || "").trim());
  const showSystem = activityRows.some(activity => String(activity.sistema || "").trim());
  const activityHeaders = ["N.º", "Tipo", "Actividad", "Descripción / rutas", "Responsable", "Punto de control"];
  if (showEvidence) activityHeaders.push("Registro / evidencia");
  if (showSystem) activityHeaders.push("Sistema / herramienta");
  const activityColumnWidths = showEvidence && showSystem
    ? ["4%", "7%", "13%", "27%", "12%", "20%", "9%", "8%"]
    : showEvidence || showSystem
      ? ["4%", "7%", "15%", "30%", "13%", "20%", "11%"]
      : ["4%", "7%", "16%", "31%", "15%", "27%"];
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
  }, { variant: "activities", columnWidths: activityColumnWidths });
  const report = document.createElement("article");
  report.className = "preview-report";
  report.append(header,
    reportSection("1", "Objetivo", reportParagraphs(ui.draftObjective.value)),
    reportSection("2", "Alcance", reportParagraphs(ui.draftScope.value)),
    reportSection("3", "Términos y definiciones", definitionTable),
    reportSection("4", "Condiciones generales", reportConditionList(ui.draftConditions.value)),
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
    reportSection("9", "Control de cambios", changeControlReport()));
  content.replaceChildren(report);
  ui.previewTitle.textContent = institutional ? "Reporte institucional" : "Reporte del procedimiento";
  ui.printPreviewButton.textContent = institutional ? "Imprimir o guardar PDF institucional" : "Imprimir o guardar como PDF";
  const state = !currentDraft ? "Vista de un borrador no guardado." : dirty ? "Vista con cambios sin guardar." : `Borrador guardado · revisión ${currentDraft.revision}.`;
  ui.previewState.textContent = institutional ? `Reporte institucional autorizado. ${state}` : state;
  ui.previewDialog.showModal();
  ui.previewDialog.scrollTop = 0;
  ui.previewContent.scrollTop = 0;
  requestAnimationFrame(fitPreviewDiagram);
}

function printableReportTitle() {
  const code = String(ui.draftCode.value || "").trim();
  const name = String(ui.draftName.value || "").trim();
  return [code || "Procedimiento", name].filter(Boolean).join(" - ");
}

async function printPreviewReport() {
  const report = ui.previewContent.querySelector(".preview-report");
  if (!report) return;
  const previousTitle = document.title;
  let restoreTimer;
  const printRoot = document.createElement("div");
  printRoot.className = "print-report-root";
  printRoot.append(report.cloneNode(true));
  const cleanup = () => {
    document.documentElement.classList.remove("printing-report");
    printRoot.remove();
  };
  const restoreTitle = () => {
    document.title = previousTitle;
    if (restoreTimer) window.clearTimeout(restoreTimer);
    cleanup();
  };
  document.title = printableReportTitle();
  window.addEventListener("afterprint", restoreTitle, { once: true });
  restoreTimer = window.setTimeout(restoreTitle, 60_000);
  document.body.append(printRoot);
  document.documentElement.classList.add("printing-report");
  ui.previewDialog.scrollTop = 0;
  ui.previewContent.scrollTop = 0;
  window.scrollTo(0, 0);
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.print();
}

ui.previewButton.addEventListener("click", showPreview);
ui.analyticsButton.addEventListener("click", showAnalytics);
ui.exportAnalyticsButton.addEventListener("click", downloadAnalyticsWorkbook);
ui.backFromAnalytics.addEventListener("click", hideAnalytics);
ui.refreshAnalytics.addEventListener("click", loadAnalytics);
ui.institutionalReportsButton.addEventListener("click", showInstitutionalReports);
ui.backFromInstitutionalReports.addEventListener("click", hideInstitutionalReports);
ui.refreshInstitutionalReports.addEventListener("click", loadInstitutionalReports);
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
ui.printPreviewButton.addEventListener("click", printPreviewReport);
ui.refreshDraftsButton.addEventListener("click", loadDrafts);
ui.refreshAdminApprovalQueue.addEventListener("click", loadAdminApprovalQueue);
ui.refreshFlowButton.addEventListener("click", renderFlow);
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
populateApprovalRoleSelect(ui.draftPreparedBy, "", nonDirectiveRoleLevels, true);
populateApprovalRoleSelect(ui.draftReviewedBy, "", null, true);
populateApprovalRoleSelect(ui.draftApprovedBy, "", ["Directivo"]);
installMethodHelps(document);
setupMethodTooltip();
if (csrfToken) request("/api/auth/me").then(({ user }) => startSession(user)).catch(clearSession);
