export const EVALUATION_RUBRIC_VERSION = 1;

export const EVALUATION_GROUPS = Object.freeze([
  { id: "objetivo", name: "Objetivo", weight: 8, description: "Claridad, finalidad y coherencia del objetivo.", criteria: [
    ["obj1", "¿El objetivo inicia con un verbo en infinitivo?"],
    ["obj2", "¿Explica el propósito del procedimiento y lo que se quiere lograr con él?"],
    ["obj3", "¿Define la importancia de documentar el procedimiento?"],
    ["obj4", "¿El objetivo está relacionado con el título y las actividades del procedimiento?", true]
  ] },
  { id: "alcance", name: "Alcance", weight: 8, description: "Inicio, fin y límites de aplicación del procedimiento.", criteria: [
    ["alc1", "¿Especifica claramente el inicio del procedimiento?", true],
    ["alc2", "¿Especifica claramente el final del procedimiento y la actividad con que finaliza?", true],
    ["alc3", "¿Establece claramente los límites del procedimiento, como ámbito, tiempo, territorio, responsables o montos?"]
  ] },
  { id: "marco_legal", name: "Marco legal", weight: 8, description: "Normas internas y externas aplicables y correctamente citadas.", criteria: [
    ["leg1", "¿Se describen los decretos, resoluciones, circulares y reglamentos internos aplicables?"],
    ["leg2", "¿Se identifican las disposiciones externas aplicables, incluidos artículos o secciones específicas?"],
    ["leg3", "¿Las normas se presentan en un orden lógico de relevancia?"],
    ["leg4", "¿Las normas se citan con precisión: nombre, descripción, año, artículo o sección y entidad emisora?"]
  ] },
  { id: "definiciones", name: "Definiciones", weight: 8, description: "Términos, siglas y abreviaturas necesarios para la comprensión.", criteria: [
    ["def1", "¿Las definiciones incluidas están relacionadas con las actividades del procedimiento?"],
    ["def2", "¿Las definiciones están organizadas en orden alfabético?"],
    ["def3", "¿Se incluyen las siglas y abreviaturas utilizadas en el procedimiento?"]
  ] },
  { id: "actividades", name: "Actividades", weight: 20, description: "Secuencia, responsables, redacción y tiempos de ejecución.", criteria: [
    ["act1", "¿Las actividades siguen una secuencia lógica y clara que garantiza orden, coherencia, trazabilidad y cumplimiento del objetivo?", true],
    ["act2", "¿Cada actividad tiene un responsable definido?", true],
    ["act3", "¿Los nombres de las actividades inician con un verbo en infinitivo?"],
    ["act4", "¿Se incluyen tiempos o plazos cuando aplican?"]
  ] },
  { id: "controles", name: "Puntos de control", weight: 20, description: "Identificación y diseño completo de verificaciones críticas.", criteria: [
    ["con1", "¿El procedimiento cuenta con puntos de control cuando son necesarios?", true],
    ["con2", "¿Los puntos de control están asociados a actividades que verifican, validan, comparan, autorizan o aseguran criterios previamente establecidos?", true],
    ["con3", "¿Cada punto de control define responsable, periodicidad, propósito, ejecución, actuación ante desviaciones y evidencia?", true]
  ] },
  { id: "flujograma", name: "Flujograma", weight: 8, description: "Correspondencia visual, simbología y comprensión global.", criteria: [
    ["flu1", "¿El flujograma representa de manera lógica la secuencia de las actividades?", true],
    ["flu2", "¿La simbología empleada corresponde a Inicio, Actividad, Decisión, Conector, Fin y elementos complementarios definidos?"],
    ["flu3", "¿El flujograma facilita la visualización global del procedimiento y sus actividades?"]
  ] },
  { id: "cambios", name: "Control de cambios", weight: 12, description: "Trazabilidad de versiones, fechas y responsables.", criteria: [
    ["cam1", "¿Se describe de manera lógica el cambio que origina la nueva versión?", false, true],
    ["cam2", "¿Se registra la fecha en que se realizan los cambios?"],
    ["cam3", "¿Se identifican personas diferentes para elaborar, revisar y aprobar, cuando corresponde?", true],
    ["cam4", "¿La redacción del cambio permite identificar qué se modificó y facilita su revisión y aprobación?", false, true]
  ] },
  { id: "formatos", name: "Formatos", weight: 8, description: "Documentos y formatos vinculados al procedimiento.", criteria: [
    ["for1", "¿Se definieron formatos o registros para los puntos de control, cuando aplica?"],
    ["for2", "¿Se describen los formatos utilizados en las actividades, cuando aplica?"],
    ["for3", "¿Los códigos, referencias o vínculos de los formatos permiten identificarlos y consultarlos correctamente?"]
  ] }
].map(group => Object.freeze({
  ...group,
  criteria: Object.freeze(group.criteria.map(([id, question, critical = false, newProcedureNotApplicable = false], index) => Object.freeze({
    id, question, critical, newProcedureNotApplicable, order: index + 1, groupId: group.id, groupName: group.name
  })))
})));

export const EVALUATION_CRITERIA = Object.freeze(EVALUATION_GROUPS.flatMap(group => group.criteria));
const criterionById = new Map(EVALUATION_CRITERIA.map(criterion => [criterion.id, criterion]));
const results = new Set(["", "Cumple", "No cumple", "No aplica"]);
export const FINDING_STATUSES = Object.freeze(["Pendiente", "Respondido", "Subsanado", "Cerrado"]);

export function allowsNotApplicable(criterion, version) {
  return Boolean(criterion?.newProcedureNotApplicable && /^0*1(?:\.0+)*$/.test(String(version || "1.0")));
}

export function blankEvaluationCriteria() {
  return Object.fromEntries(EVALUATION_CRITERIA.map(({ id }) => [id, {
    result: "", evidence: "", observation: "", adjustment: "", findingStatus: "Pendiente", response: ""
  }]));
}

export function sanitizeEvaluationCriteria(input, version) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { criteria: blankEvaluationCriteria(), issues: ["La matriz de criterios no tiene un formato válido."] };
  const issues = [];
  for (const key of Object.keys(input)) if (!criterionById.has(key)) issues.push("La matriz contiene un criterio desconocido.");
  const criteria = blankEvaluationCriteria();
  for (const criterion of EVALUATION_CRITERIA) {
    const value = input[criterion.id];
    if (value === undefined) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      issues.push(`El criterio ${criterion.id} no tiene un formato válido.`);
      continue;
    }
    const result = typeof value.result === "string" ? value.result : "";
    if (!results.has(result) || (result === "No aplica" && !allowsNotApplicable(criterion, version))) {
      issues.push(`El resultado del criterio ${criterion.id} no es válido.`);
      continue;
    }
    const record = criteria[criterion.id];
    record.result = result;
    for (const key of ["evidence", "observation", "adjustment", "response"]) {
      if (value[key] === undefined) continue;
      if (typeof value[key] !== "string" || value[key].length > 5000) {
        issues.push(`El campo ${key} del criterio ${criterion.id} no es válido.`);
        continue;
      }
      record[key] = value[key].trim();
    }
    if (value.findingStatus !== undefined) {
      if (!FINDING_STATUSES.includes(value.findingStatus)) issues.push(`El estado del hallazgo ${criterion.id} no es válido.`);
      else record.findingStatus = value.findingStatus;
    }
  }
  return { criteria, issues };
}

export function evaluationMetrics(criteria, version) {
  let answered = 0;
  let failures = 0;
  let criticalFailures = 0;
  let openFindings = 0;
  let weightedScore = 0;
  const groups = EVALUATION_GROUPS.map(group => {
    let applicable = 0;
    let passed = 0;
    let groupAnswered = 0;
    for (const criterion of group.criteria) {
      const record = criteria?.[criterion.id] || {};
      const notApplicable = record.result === "No aplica" && allowsNotApplicable(criterion, version);
      if (record.result) {
        answered += 1;
        groupAnswered += 1;
      }
      if (!notApplicable) applicable += 1;
      if (record.result === "Cumple") passed += 1;
      if (record.result === "No cumple") {
        failures += 1;
        if (criterion.critical) criticalFailures += 1;
        if (record.findingStatus !== "Cerrado") openFindings += 1;
      }
    }
    const score = applicable ? passed / applicable * 100 : 100;
    weightedScore += score * group.weight / 100;
    return { id: group.id, name: group.name, weight: group.weight, answered: groupAnswered, total: group.criteria.length, score: Math.round(score * 10) / 10 };
  });
  const score = Math.round(weightedScore * 10) / 10;
  const complete = answered === EVALUATION_CRITERIA.length;
  const level = !complete ? "Pendiente" : score <= 39 ? "Bajo" : score < 90 ? "Medio" : "Alto";
  const decision = !complete ? "Evaluación pendiente" : score < 40 ? "No cumple" : score < 90 || criticalFailures > 0 ? "Requiere ajustes" : "Cumple";
  return { answered, total: EVALUATION_CRITERIA.length, failures, criticalFailures, openFindings, score, level, decision, complete, groups };
}

export function validateEvaluation(criteria, version) {
  const issues = [];
  for (const criterion of EVALUATION_CRITERIA) {
    const record = criteria?.[criterion.id] || {};
    if (!record.result) {
      issues.push(`Falta evaluar el criterio ${criterion.id}.`);
      continue;
    }
    if (record.result === "No aplica" && allowsNotApplicable(criterion, version)) continue;
    if (!record.observation) issues.push(`Falta la observación del criterio ${criterion.id}.`);
    if (record.result === "No cumple" && !record.adjustment) issues.push(`Falta el ajuste requerido para el criterio ${criterion.id}.`);
  }
  return issues;
}

export function missingCorrectionResponses(criteria) {
  return EVALUATION_CRITERIA.filter(criterion => {
    const record = criteria?.[criterion.id] || {};
    return record.result === "No cumple" && !String(record.response || "").trim();
  }).map(criterion => criterion.id);
}

export function evaluationIsFavorable(metrics) {
  return Boolean(metrics?.complete && Number(metrics.score) >= 90 && Number(metrics.criticalFailures) === 0 && Number(metrics.openFindings) === 0);
}
