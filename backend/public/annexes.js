const summary = document.querySelector("#rubricSummary");
const groupsContainer = document.querySelector("#rubricGroups");

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;"
  })[character]);
}

function renderRubric({ version, totalCriteria, groups }) {
  const totalWeight = groups.reduce((total, group) => total + Number(group.weight || 0), 0);
  summary.innerHTML = `<div class="summary-metric"><strong>${totalCriteria}</strong><span>Criterios</span></div><div class="summary-metric"><strong>${groups.length}</strong><span>Variables</span></div><div class="summary-metric"><strong>${totalWeight}%</strong><span>Ponderación total</span></div><p>Versión de rúbrica: ${escapeHtml(version)}</p>`;
  groupsContainer.innerHTML = groups.map(group => `<details class="rubric-group"><summary><span class="group-toggle" aria-hidden="true"></span><span><strong>${escapeHtml(group.name)}</strong><small>${escapeHtml(group.description)}</small></span><b>${group.weight}%</b></summary><ol>${group.criteria.map(criterion => `<li><span>${escapeHtml(criterion.question)}</span>${criterion.critical ? '<em class="critical-tag">Crítico</em>' : ""}${criterion.newProcedureNotApplicable ? '<em class="applicability-tag">No aplica en versión 1.0</em>' : ""}</li>`).join("")}</ol></details>`).join("");
}

async function loadRubric() {
  try {
    const response = await fetch("/api/reference/evaluation-rubric", { headers: { Accept: "application/json" } });
    const payload = await response.json();
    if (!response.ok || !payload.ok || !Array.isArray(payload.groups)) throw new Error("rubric_unavailable");
    renderRubric(payload);
  } catch {
    summary.innerHTML = "<p class=\"load-error\">No fue posible cargar los criterios en este momento. Actualiza la página para intentarlo nuevamente.</p>";
  }
}

loadRubric();
