import { ROLES } from "./roles.js";
import {
  PROCEDURE_STATUS,
  favorableEvaluationAllowed,
  isApproved,
  isAssignedReviewStatus,
  isEditableByAuthorStatus
} from "./workflow.js";

export const ACTIONS = Object.freeze({
  MANAGE_USERS: "manage_users",
  DEACTIVATE_USER: "deactivate_user",
  REACTIVATE_USER: "reactivate_user",
  ASSIGN_PROCESSES: "assign_processes",
  VIEW_ADMIN_ANALYTICS: "view_admin_analytics",
  CONFIGURE_SYSTEM: "configure_system",
  CREATE_PROCEDURE: "create_procedure",
  EDIT_PROCEDURE: "edit_procedure",
  SUBMIT_FOR_REVIEW: "submit_for_review",
  READ_ASSIGNED_PROCEDURE: "read_assigned_procedure",
  START_EVALUATION: "start_evaluation",
  UPDATE_EVALUATION: "update_evaluation",
  RETURN_FOR_CORRECTIONS: "return_for_corrections",
  ISSUE_FAVORABLE_CONCEPT: "issue_favorable_concept",
  REOPEN_APPROVED_VERSION: "reopen_approved_version",
  GENERATE_UNBRANDED_PDF: "generate_unbranded_pdf",
  GENERATE_BRANDED_PDF: "generate_branded_pdf"
});

function active(user) {
  return Boolean(user && user.active !== false && user.mustChangePassword !== true);
}

function ownsProcedure(user, procedure) {
  return Boolean(user?.id && procedure?.createdByUserId && user.id === procedure.createdByUserId);
}

function assignedToEvaluation(user, procedure) {
  return Boolean(user?.id && procedure?.assignedEvaluatorId && user.id === procedure.assignedEvaluatorId);
}

function hasProcessAccess(user, procedure) {
  if (!procedure?.processCode) return false;
  if (!Array.isArray(user?.processCodes) || user.processCodes.length === 0) return false;
  return user.processCodes.includes(procedure.processCode);
}

function canAdminDeactivate(targetUser, context) {
  if (!targetUser?.id || targetUser.role !== ROLES.ADMIN) return true;
  const activeAdminCount = Number(context?.activeAdminCount ?? 0);
  return activeAdminCount > 1;
}

export function canPerform(user, action, context = {}) {
  if (!active(user)) return false;

  const { procedure, evaluation, targetUser } = context;

  if (user.role === ROLES.ADMIN) {
    if (action === ACTIONS.DEACTIVATE_USER) return canAdminDeactivate(targetUser, context);
    if (action === ACTIONS.GENERATE_BRANDED_PDF) return isApproved(procedure?.status);
    return [
      ACTIONS.MANAGE_USERS,
      ACTIONS.REACTIVATE_USER,
      ACTIONS.ASSIGN_PROCESSES,
      ACTIONS.VIEW_ADMIN_ANALYTICS,
      ACTIONS.CONFIGURE_SYSTEM,
      ACTIONS.REOPEN_APPROVED_VERSION,
      ACTIONS.GENERATE_UNBRANDED_PDF,
      ACTIONS.CREATE_PROCEDURE,
      ACTIONS.EDIT_PROCEDURE
    ].includes(action);
  }

  if (user.role === ROLES.ELABORADOR) {
    if (action === ACTIONS.CREATE_PROCEDURE) return true;
    if (action === ACTIONS.EDIT_PROCEDURE) {
      return ownsProcedure(user, procedure) && isEditableByAuthorStatus(procedure?.status);
    }
    if (action === ACTIONS.SUBMIT_FOR_REVIEW) {
      return (
        ownsProcedure(user, procedure) &&
        isEditableByAuthorStatus(procedure?.status) &&
        Boolean(procedure?.isComplete) &&
        Boolean(procedure?.assignedEvaluatorId)
      );
    }
    if (action === ACTIONS.GENERATE_UNBRANDED_PDF) return ownsProcedure(user, procedure);
    return false;
  }

  if (user.role === ROLES.EVALUADOR) {
    if (!assignedToEvaluation(user, procedure) || !hasProcessAccess(user, procedure)) return false;
    if (action === ACTIONS.READ_ASSIGNED_PROCEDURE) return isAssignedReviewStatus(procedure?.status) || isApproved(procedure?.status);
    if (action === ACTIONS.START_EVALUATION) {
      return [PROCEDURE_STATUS.SUBMITTED, PROCEDURE_STATUS.CORRECTED].includes(procedure?.status);
    }
    if (action === ACTIONS.UPDATE_EVALUATION || action === ACTIONS.RETURN_FOR_CORRECTIONS) {
      return procedure?.status === PROCEDURE_STATUS.IN_REVIEW;
    }
    if (action === ACTIONS.ISSUE_FAVORABLE_CONCEPT) {
      return procedure?.status === PROCEDURE_STATUS.IN_REVIEW && favorableEvaluationAllowed(evaluation);
    }
    return false;
  }

  return false;
}
