export function reviewFlow(activities) {
  if (!Array.isArray(activities) || activities.length > 500 || activities.some(item => item === null || typeof item !== "object" || Array.isArray(item))) {
    return [{ index: null, message: "El flujo no tiene un formato válido." }];
  }

  const issues = [];
  const ids = new Set();
  const byId = new Map();
  const connectorIds = new Set();
  const allowedTypes = new Set(["Inicio", "Fin", "Actividad", "Decisión", "Conector"]);
  for (const [index, item] of activities.entries()) {
    if (!allowedTypes.has(item.tipo)) {
      issues.push({ index, message: "El tipo de elemento no es válido." });
    }
    if (typeof item.uid !== "string" || !item.uid.trim()) {
      issues.push({ index, message: "Falta el identificador del elemento." });
    } else if (ids.has(item.uid)) {
      issues.push({ index, message: "El identificador del elemento está repetido." });
    } else {
      ids.add(item.uid);
      byId.set(item.uid, item);
    }
    if (item.tipo === "Conector") {
      const connectorId = typeof item.connectorId === "string" ? item.connectorId.trim().toUpperCase() : "";
      if (!connectorId) issues.push({ index, message: "El conector necesita un identificador." });
      else if (connectorIds.has(connectorId)) issues.push({ index, message: "El identificador del conector está repetido." });
      else connectorIds.add(connectorId);
    }
  }

  for (const type of ["Inicio", "Fin"]) {
    const count = activities.filter(item => item.tipo === type).length;
    if (count !== 1) issues.push({ index: null, message: `Debe haber exactamente un elemento ${type}.` });
  }

  for (const [index, item] of activities.entries()) {
    const routes = item.tipo === "Decisión"
      ? [["decisionSi", "Ruta Sí"], ["decisionNo", "Ruta No"]]
      : item.tipo === "Conector" ? [["connectorDestino", "Destino del conector"]] : [];
    for (const [key, label] of routes) {
      const target = item[key];
      if (typeof target !== "string" || !target.trim()) {
        issues.push({ index, message: `${label}: selecciona un destino.` });
      } else if (target === item.uid || !ids.has(target) || activities.find(node => node.uid === target)?.tipo === "Inicio") {
        issues.push({ index, message: `${label}: el destino no es válido.` });
      }
    }
    if (item.tipo === "Decisión" && item.decisionSi && item.decisionSi === item.decisionNo) {
      issues.push({ index, message: "Las rutas Sí y No deben tener destinos diferentes." });
    }
    if (item.tipo === "Decisión" && byId.get(item.decisionNo)?.tieneControl === true) {
      issues.push({ index, message: "La ruta No debe pasar por una actividad de corrección antes de llegar a un punto de control." });
    }
    if (item.tieneControl === true) {
      const required = ["controlResponsable", "controlPeriodicidad", "controlAccion", "controlEjecucion", "controlDesviacion", "controlEvidencia"];
      if (required.some(key => typeof item[key] !== "string" || !item[key].trim())) {
        issues.push({ index, message: "El punto de control tiene campos obligatorios incompletos." });
      }
    }
  }

  const start = activities.find(item => item.tipo === "Inicio");
  const end = activities.find(item => item.tipo === "Fin");
  if (!start || !end || ids.size !== activities.length) return issues;
  if (activities[0] !== start || activities.at(-1) !== end) {
    issues.push({ index: null, message: "Inicio debe ser el primer elemento y Fin el último." });
  }

  const edges = new Map(activities.map(item => [item.uid, []]));
  for (const [index, item] of activities.entries()) {
    const targets = item.tipo === "Decisión" ? [item.decisionSi, item.decisionNo]
      : item.tipo === "Conector" ? [item.connectorDestino]
      : item.tipo === "Fin" ? [] : [activities[index + 1]?.uid];
    edges.set(item.uid, targets.filter(target => byId.has(target) && target !== start.uid));
  }
  const walk = (origin, graph) => {
    const seen = new Set();
    const pending = [origin];
    while (pending.length) {
      const id = pending.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      pending.push(...graph.get(id));
    }
    return seen;
  };
  const reachable = walk(start.uid, edges);
  const reverse = new Map(activities.map(item => [item.uid, []]));
  for (const [source, targets] of edges) for (const target of targets) reverse.get(target).push(source);
  const canReachEnd = walk(end.uid, reverse);
  for (const [index, item] of activities.entries()) {
    if (!reachable.has(item.uid)) issues.push({ index, message: "No se puede alcanzar este elemento desde Inicio." });
    else if (!canReachEnd.has(item.uid)) issues.push({ index, message: "Este elemento no tiene una ruta hacia Fin." });
  }

  const visiting = new Set();
  const visited = new Set();
  let trappedCycle = false;
  function visit(id) {
    if (visiting.has(id)) { trappedCycle = true; return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const target of edges.get(id)) {
      if (reachable.has(target) && !canReachEnd.has(target)) visit(target);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const item of activities) {
    if (reachable.has(item.uid) && !canReachEnd.has(item.uid)) visit(item.uid);
  }
  if (trappedCycle) issues.push({ index: null, message: "Hay un ciclo sin salida hacia Fin." });

  return issues;
}
