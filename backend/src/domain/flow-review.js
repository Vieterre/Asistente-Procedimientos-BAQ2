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

  let nextIndex = 0;
  const indices = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const cycles = [];
  function visit(id) {
    indices.set(id, nextIndex);
    lowLinks.set(id, nextIndex++);
    stack.push(id);
    onStack.add(id);
    for (const target of edges.get(id)) {
      if (!reachable.has(target)) continue;
      if (!indices.has(target)) {
        visit(target);
        lowLinks.set(id, Math.min(lowLinks.get(id), lowLinks.get(target)));
      } else if (onStack.has(target)) {
        lowLinks.set(id, Math.min(lowLinks.get(id), indices.get(target)));
      }
    }
    if (lowLinks.get(id) !== indices.get(id)) return;
    const component = [];
    let current;
    do {
      current = stack.pop();
      onStack.delete(current);
      component.push(current);
    } while (current !== id);
    if (component.length > 1 || edges.get(id).includes(id)) cycles.push(component);
  }
  for (const id of reachable) if (!indices.has(id)) visit(id);
  if (cycles.some(component => component.every(id => !canReachEnd.has(id)))) {
    issues.push({ index: null, message: "Hay un ciclo sin salida hacia Fin." });
  }
  for (const component of cycles.filter(group => group.some(id => canReachEnd.has(id)))) {
    const index = Math.min(...component.map(id => activities.findIndex(item => item.uid === id)));
    issues.push({ index, message: "Esta ruta regresa a una actividad anterior; confirme su condición de salida.", severity: "warning" });
  }
  for (const [index, item] of activities.entries()) {
    if (item.tipo !== "Decisión" || item.decisionSi === item.decisionNo || !byId.has(item.decisionSi) || !byId.has(item.decisionNo)) continue;
    const yesReach = walk(item.decisionSi, edges);
    const noReach = walk(item.decisionNo, edges);
    if (![...yesReach].some(id => id !== end.uid && noReach.has(id))) {
      issues.push({ index, message: "Las rutas Sí y No no reconvergen antes de Fin; confirme si representan resultados independientes.", severity: "warning" });
    }
  }

  return issues;
}

export function reviewFlowCompleteness(activities) {
  if (!Array.isArray(activities)) return [];
  const missing = value => typeof value !== "string" || !value.trim();
  const vague = value => /^(varios|todos|quien corresponda|n\/?a|no aplica)$/i.test(String(value || "").trim());
  const issues = [];
  for (const [index, item] of activities.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    if (["Inicio", "Fin"].includes(item.tipo) && missing(item.descripcion)) {
      issues.push({ index, message: item.tipo === "Inicio" ? "Describe el evento que inicia el procedimiento." : "Describe el resultado o condición de cierre." });
    }
    if (item.tipo === "Actividad") {
      if (missing(item.actividad)) issues.push({ index, message: "Escribe el nombre de la actividad." });
      if (missing(item.descripcion)) issues.push({ index, message: "Describe la actividad." });
    }
    if (item.tipo === "Decisión" && missing(item.descripcion)) {
      issues.push({ index, message: "Escribe la pregunta o condición de la decisión." });
    }
    if (["Actividad", "Decisión"].includes(item.tipo)) {
      if (missing(item.responsable)) issues.push({ index, message: "Indica un responsable." });
      else if (item.responsableOtro && vague(item.responsable)) issues.push({ index, message: "Especifica el cargo o rol responsable." });
    }
    if (item.tieneControl && item.controlResponsableOtro && vague(item.controlResponsable)) {
      issues.push({ index, message: "Especifica el responsable del control." });
    }
  }
  return issues;
}
