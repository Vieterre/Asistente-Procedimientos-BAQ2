import test from "node:test";
import assert from "node:assert/strict";
import { ACTIONS, canPerform } from "../src/domain/permissions.js";
import { ROLES } from "../src/domain/roles.js";
import { PROCEDURE_STATUS } from "../src/domain/workflow.js";

const admin = { id: "u-admin", role: ROLES.ADMIN, active: true, processCodes: [] };
const author = { id: "u-author", role: ROLES.ELABORADOR, active: true, processCodes: ["DE"] };
const evaluator = { id: "u-eval", role: ROLES.EVALUADOR, active: true, processCodes: ["DE"] };

test("inactive users cannot perform any protected action", () => {
  const inactiveAdmin = { ...admin, active: false };
  assert.equal(canPerform(inactiveAdmin, ACTIONS.MANAGE_USERS), false);
});

test("users with a temporary password cannot perform protected actions", () => {
  assert.equal(canPerform({ ...admin, mustChangePassword: true }, ACTIONS.MANAGE_USERS), false);
  assert.equal(canPerform({ ...author, mustChangePassword: true }, ACTIONS.CREATE_PROCEDURE), false);
});

test("administrator cannot deactivate the last active administrator", () => {
  assert.equal(
    canPerform(admin, ACTIONS.DEACTIVATE_USER, {
      targetUser: admin,
      activeAdminCount: 1
    }),
    false
  );
  assert.equal(
    canPerform(admin, ACTIONS.DEACTIVATE_USER, {
      targetUser: admin,
      activeAdminCount: 2
    }),
    true
  );
});

test("elaborador can edit only own draft or returned procedure", () => {
  assert.equal(
    canPerform(author, ACTIONS.EDIT_PROCEDURE, {
      procedure: { createdByUserId: author.id, status: PROCEDURE_STATUS.DRAFT }
    }),
    true
  );
  assert.equal(
    canPerform(author, ACTIONS.EDIT_PROCEDURE, {
      procedure: { createdByUserId: author.id, status: PROCEDURE_STATUS.IN_REVIEW }
    }),
    false
  );
});

test("elaborador can submit only a complete owned draft with an assigned evaluator", () => {
  const procedure = {
    createdByUserId: author.id,
    status: PROCEDURE_STATUS.DRAFT,
    isComplete: true,
    assignedEvaluatorId: evaluator.id
  };
  assert.equal(canPerform(author, ACTIONS.SUBMIT_FOR_REVIEW, { procedure }), true);
  assert.equal(canPerform(author, ACTIONS.SUBMIT_FOR_REVIEW, { procedure: { ...procedure, isComplete: false } }), false);
  assert.equal(canPerform(author, ACTIONS.SUBMIT_FOR_REVIEW, { procedure: { ...procedure, assignedEvaluatorId: null } }), false);
  assert.equal(canPerform(author, ACTIONS.SUBMIT_FOR_REVIEW, { procedure: { ...procedure, createdByUserId: "u-other" } }), false);
  assert.equal(canPerform(author, ACTIONS.SUBMIT_FOR_REVIEW, { procedure: { ...procedure, status: PROCEDURE_STATUS.IN_REVIEW } }), false);
});

test("elaborador cannot generate branded PDF", () => {
  assert.equal(
    canPerform(author, ACTIONS.GENERATE_BRANDED_PDF, {
      procedure: { createdByUserId: author.id, status: PROCEDURE_STATUS.FAVORABLE }
    }),
    false
  );
});

test("administrator can generate branded PDF only for favorable procedures", () => {
  assert.equal(
    canPerform(admin, ACTIONS.GENERATE_BRANDED_PDF, {
      procedure: { status: PROCEDURE_STATUS.DRAFT }
    }),
    false
  );
  assert.equal(
    canPerform(admin, ACTIONS.GENERATE_BRANDED_PDF, {
      procedure: { status: PROCEDURE_STATUS.FAVORABLE }
    }),
    true
  );
});

test("evaluator cannot create, edit, or review unassigned procedures", () => {
  assert.equal(canPerform(evaluator, ACTIONS.CREATE_PROCEDURE), false);
  assert.equal(
    canPerform(evaluator, ACTIONS.UPDATE_EVALUATION, {
      procedure: {
        status: PROCEDURE_STATUS.IN_REVIEW,
        assignedEvaluatorId: "other",
        processCode: "DE"
      }
    }),
    false
  );
});

test("evaluator can issue favorable concept only when all criteria are satisfied", () => {
  const procedure = {
    status: PROCEDURE_STATUS.IN_REVIEW,
    assignedEvaluatorId: evaluator.id,
    processCode: "DE"
  };
  assert.equal(
    canPerform(evaluator, ACTIONS.ISSUE_FAVORABLE_CONCEPT, {
      procedure,
      evaluation: { complete: true, score: 90, criticalFailures: 0, openFindings: 0 }
    }),
    true
  );
  assert.equal(
    canPerform(evaluator, ACTIONS.ISSUE_FAVORABLE_CONCEPT, {
      procedure,
      evaluation: { complete: true, score: 89.99, criticalFailures: 0, openFindings: 0 }
    }),
    false
  );
});
