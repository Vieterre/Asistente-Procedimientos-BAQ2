export const ROLES = Object.freeze({
  ADMIN: "administrador",
  ELABORADOR: "elaborador",
  EVALUADOR: "evaluador"
});

export const ROLE_LABELS = Object.freeze({
  [ROLES.ADMIN]: "Administrador",
  [ROLES.ELABORADOR]: "Elaborador",
  [ROLES.EVALUADOR]: "Evaluador"
});

export function isKnownRole(role) {
  return Object.values(ROLES).includes(role);
}
