export function reviewFlow(activities) {
  if (!Array.isArray(activities) || activities.length > 500 || activities.some(item => item === null || typeof item !== "object" || Array.isArray(item))) {
    return [{ index: null, message: "El flujo no tiene un formato válido." }];
  }

  const issues = [];
  const ids = new Set();
  for (const [index, item] of activities.entries()) {
    if (typeof item.uid !== "string" || !item.uid.trim()) {
      issues.push({ index, message: "Falta el identificador del elemento." });
    } else if (ids.has(item.uid)) {
      issues.push({ index, message: "El identificador del elemento está repetido." });
    } else {
      ids.add(item.uid);
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
  }

  return issues;
}
