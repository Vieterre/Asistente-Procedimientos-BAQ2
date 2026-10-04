export const PROCEDURE_STATUS = Object.freeze({
  DRAFT: "borrador",
  SUBMITTED: "enviado_a_evaluacion",
  IN_REVIEW: "en_evaluacion",
  RETURNED: "devuelto_para_ajustes",
  CORRECTED: "subsanado",
  FAVORABLE: "concepto_favorable",
  UNFAVORABLE: "concepto_no_favorable",
  REOPENED: "reabierto_por_administrador"
});

export function isEditableByAuthorStatus(status) {
  return [PROCEDURE_STATUS.DRAFT, PROCEDURE_STATUS.RETURNED].includes(status);
}

export function isAssignedReviewStatus(status) {
  return [
    PROCEDURE_STATUS.SUBMITTED,
    PROCEDURE_STATUS.IN_REVIEW,
    PROCEDURE_STATUS.CORRECTED,
    PROCEDURE_STATUS.RETURNED,
    PROCEDURE_STATUS.UNFAVORABLE
  ].includes(status);
}

export function isApproved(status) {
  return status === PROCEDURE_STATUS.FAVORABLE;
}

export function favorableEvaluationAllowed(evaluation) {
  return Boolean(
    evaluation &&
      evaluation.complete === true &&
      Number(evaluation.score) >= 90 &&
      Number(evaluation.criticalFailures) === 0 &&
      Number(evaluation.openFindings) === 0
  );
}
