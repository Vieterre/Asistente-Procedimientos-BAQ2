const ui = Object.fromEntries([
  "loginView", "loginForm", "loginUsername", "loginPassword", "loginOtp", "loginMessage",
  "workspace", "sessionControls", "sessionIdentity", "logoutButton", "welcomeText",
  "passwordSection", "passwordIntro", "passwordForm", "currentPassword", "newPassword",
  "confirmPassword", "passwordMessage", "adminWorkspace", "createForm", "newUsername",
  "displayName", "newRole", "createMessage", "usersCount", "usersMessage", "usersBody",
  "mfaEnrollmentSection", "beginMfaEnrollmentButton", "mfaEnrollmentMessage", "mfaEnrollmentDetails", "mfaEnrollmentSecret", "confirmMfaEnrollmentForm", "mfaEnrollmentCode",
  "refreshUsersButton", "credentialDialog", "issuedUsername", "issuedPassword",
  "copyPasswordButton", "closeCredentialButton", "doneCredentialButton", "credentialMessage",
  "processDialog", "processTitle", "processOptions", "processMessage", "saveProcessButton",
  "closeProcessButton", "cancelProcessButton", "backupAdministratorSection", "createBackupAdministratorButton",
  "backupAdministratorMessage", "backupAdministratorDialog", "backupAdministratorForm", "backupAdministratorUsername",
  "backupAdministratorName", "backupAdministratorAcknowledgement", "backupAdministratorDialogMessage",
  "closeBackupAdministratorButton", "cancelBackupAdministratorButton"
].map(id => [id, document.getElementById(id)]));

let csrfToken = "";
let currentUser = null;
let processAccount = null;

const errors = {
  invalid_credentials: "Nombre de usuario o contraseña incorrectos.",
  mfa_required: "El código del autenticador no coincide o ya venció.",
  mfa_not_configured: "El autenticador no está disponible. Contacta al administrador.",
  mfa_setup_not_allowed: "El segundo factor ya está configurado o esta cuenta no puede configurarlo ahora.",
  mfa_enrollment_unavailable: "No fue posible configurar el segundo factor. Inténtalo de nuevo.",
  too_many_attempts: "Demasiados intentos. Espera 15 minutos.",
  unauthenticated: "La sesión terminó. Ingresa de nuevo.",
  csrf_failed: "La sesión cambió. Ingresa de nuevo.",
  password_length_invalid: "La nueva contraseña debe tener entre 15 y 256 caracteres.",
  password_unchanged: "Elige una contraseña distinta de la actual.",
  invalid_user_details: "Revisa el nombre de usuario, el nombre completo y el rol.",
  username_taken: "Ese nombre de usuario ya está en uso.",
  user_not_found: "El usuario ya no existe.",
  inactive_user: "Activa el usuario antes de restablecer su contraseña.",
  last_admin: "No se puede desactivar al último administrador activo.",
  admin_reset_not_supported: "La contraseña del administrador se cambia desde su propia sesión.",
  backup_administrator_not_available: "Ya existe una cuenta suplente o esta cuenta no es la Administración titular.",
  mfa_configuration_unavailable: "No fue posible preparar el segundo factor. Inténtalo de nuevo o contacta al responsable técnico.",
  invalid_process_assignment: "Selecciona procesos activos y vuelve a intentarlo.",
  invalid_process_assignment_target: "Solo se pueden asignar procesos a cuentas de Elaborador o Evaluador."
};

function message(node, value, success = false) {
  node.textContent = value;
  node.classList.toggle("success", success);
  node.hidden = !value;
}

function errorText(error) {
  return errors[error.code] || (error.status === 503
    ? "El servicio no está disponible. Inténtalo de nuevo."
    : "No se pudo completar la operación.");
}

async function request(path, { method = "GET", body, csrf = false } = {}) {
  const headers = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  if (csrf) headers["X-CSRF-Token"] = csrfToken;
  const response = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    cache: "no-store",
    body: body ? JSON.stringify(body) : undefined
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || "request_failed");
    error.code = result.error;
    error.status = response.status;
    throw error;
  }
  return result;
}

function clearSession() {
  csrfToken = "";
  currentUser = null;
  sessionStorage.removeItem("account_csrf");
  ui.workspace.hidden = true;
  ui.sessionControls.hidden = true;
  ui.loginView.hidden = false;
  ui.loginPassword.value = "";
  ui.loginOtp.value = "";
  ui.passwordForm.reset();
  hideCredential();
  hideProcessDialog();
  hideBackupAdministratorDialog();
}

function showSession(user) {
  currentUser = user;
  ui.loginView.hidden = true;
  ui.workspace.hidden = false;
  ui.sessionControls.hidden = false;
  ui.sessionIdentity.textContent = user.username || user.displayName;
  ui.welcomeText.textContent = `${user.displayName} · ${user.role}`;
  ui.passwordSection.classList.toggle("required", Boolean(user.mustChangePassword));
  ui.mfaEnrollmentSection.hidden = !(user.role === "administrador" && user.mustChangePassword && !user.mfaEnabled);
  ui.mfaEnrollmentDetails.hidden = true;
  ui.mfaEnrollmentSecret.textContent = "";
  ui.passwordIntro.textContent = user.mustChangePassword
    ? "Debes cambiar la contraseña temporal para continuar. Usa al menos 15 caracteres."
    : "Usa al menos 15 caracteres. Al cambiarla, se cerrarán tus sesiones.";
  ui.adminWorkspace.hidden = user.role !== "administrador" || Boolean(user.mustChangePassword);
  message(ui.loginMessage, "");
  message(ui.passwordMessage, "");
  if (!ui.adminWorkspace.hidden) refreshUsers();
}

function sessionExpired(error, node) {
  if (error.code === "unauthenticated" || error.code === "csrf_failed") {
    clearSession();
    message(ui.loginMessage, errorText(error));
    return true;
  }
  message(node, errorText(error));
  return false;
}

async function refreshUsers() {
  message(ui.usersMessage, "");
  try {
    const { users } = await request("/api/admin/users");
    ui.usersBody.replaceChildren(...users.map(userRow));
    ui.usersCount.textContent = `${users.length} usuario${users.length === 1 ? "" : "s"}`;
    const administrators = users.filter(user => user.role === "administrador");
    const currentAdministrator = administrators.find(user => user.id === currentUser?.id);
    ui.backupAdministratorSection.hidden = !(currentAdministrator?.administratorType === "titular" && administrators.length === 1);
  } catch (error) {
    sessionExpired(error, ui.usersMessage);
  }
}

function cell(row, content) {
  const td = document.createElement("td");
  if (content instanceof Node) td.append(content);
  else td.textContent = content;
  row.append(td);
  return td;
}

function actionButton(label, action, danger = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (danger) button.className = "danger";
  button.addEventListener("click", action);
  return button;
}

function userRow(user) {
  const row = document.createElement("tr");
  const username = document.createElement("strong");
  username.textContent = user.username || "Sin asignar";
  cell(row, username);
  cell(row, user.displayName);
  cell(row, user.administratorType ? `Administración ${user.administratorType}` : user.role);
  const processCodes = Array.isArray(user.processCodes) ? user.processCodes : [];
  cell(row, processCodes.length ? processCodes.join(", ") : "Sin procesos");
  const status = document.createElement("span");
  status.className = `state${user.active ? "" : " inactive"}`;
  status.textContent = user.active ? "Activo" : "Inactivo";
  cell(row, status);
  const passwordState = document.createElement("span");
  passwordState.className = `state${user.mustChangePassword ? " pending" : ""}`;
  passwordState.textContent = user.mustChangePassword ? "Cambio pendiente" : "Vigente";
  cell(row, passwordState);
  const actions = document.createElement("div");
  actions.className = "row-actions";
  if (user.role !== "administrador") {
    actions.append(actionButton("Asignar procesos", () => editAccountProcesses(user)));
    if (user.active) actions.append(actionButton("Restablecer clave", () => resetPassword(user)));
    actions.append(actionButton(user.active ? "Desactivar" : "Activar", () => setActive(user), user.active));
  }
  cell(row, actions);
  return row;
}

async function setActive(user) {
  const verb = user.active ? "desactivar" : "activar";
  if (!window.confirm(`¿Deseas ${verb} a ${user.username || user.displayName}?`)) return;
  try {
    await request(`/api/admin/users/${user.id}/${user.active ? "deactivate" : "reactivate"}`, { method: "POST", csrf: true });
    await refreshUsers();
  } catch (error) {
    sessionExpired(error, ui.usersMessage);
  }
}

async function resetPassword(user) {
  if (!window.confirm(`¿Restablecer la contraseña de ${user.username}? Sus sesiones se cerrarán.`)) return;
  try {
    const result = await request(`/api/admin/users/${user.id}/reset-password`, { method: "POST", csrf: true });
    showCredential(user.username, result.initialPassword);
    await refreshUsers();
  } catch (error) {
    sessionExpired(error, ui.usersMessage);
  }
}

function showCredential(username, password) {
  ui.issuedUsername.textContent = username;
  ui.issuedPassword.textContent = password;
  ui.copyPasswordButton.textContent = "Copiar contraseña";
  message(ui.credentialMessage, "");
  ui.credentialDialog.showModal();
}

function hideCredential() {
  if (ui.credentialDialog.open) ui.credentialDialog.close();
  ui.issuedUsername.textContent = "";
  ui.issuedPassword.textContent = "";
  message(ui.credentialMessage, "");
}

function hideProcessDialog() {
  if (ui.processDialog.open) ui.processDialog.close();
  processAccount = null;
  ui.processOptions.replaceChildren();
  message(ui.processMessage, "");
}

function hideBackupAdministratorDialog() {
  if (ui.backupAdministratorDialog.open) ui.backupAdministratorDialog.close();
  ui.backupAdministratorForm.reset();
  message(ui.backupAdministratorDialogMessage, "");
}

function processOption(process, assignedCodes) {
  const label = document.createElement("label");
  label.className = "process-option";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = process.code;
  checkbox.checked = assignedCodes.includes(process.code);
  checkbox.disabled = !process.active && !checkbox.checked;
  const name = document.createElement("span");
  name.textContent = `${process.name} (${process.code})${process.active ? "" : " · Inactivo"}`;
  label.append(checkbox, name);
  return label;
}

async function editAccountProcesses(user) {
  message(ui.usersMessage, "");
  try {
    const result = await request(`/api/admin/users/${encodeURIComponent(user.id)}/processes`);
    processAccount = user;
    ui.processTitle.textContent = `Procesos de ${user.username || user.displayName}`;
    const assignedCodes = result.processCodes || [];
    ui.processOptions.replaceChildren(...result.processes.map(process => processOption(process, assignedCodes)));
    message(ui.processMessage, "");
    ui.processDialog.showModal();
  } catch (error) {
    sessionExpired(error, ui.usersMessage);
  }
}

async function saveAccountProcesses() {
  if (!processAccount) return;
  ui.saveProcessButton.disabled = true;
  message(ui.processMessage, "");
  try {
    const processCodes = [...ui.processOptions.querySelectorAll("input:checked")].map(input => input.value);
    await request(`/api/admin/users/${encodeURIComponent(processAccount.id)}/processes`, {
      method: "PUT", csrf: true, body: { processCodes }
    });
    hideProcessDialog();
    message(ui.usersMessage, "Asignación de procesos actualizada.", true);
    await refreshUsers();
  } catch (error) {
    sessionExpired(error, ui.processMessage);
  } finally {
    ui.saveProcessButton.disabled = false;
  }
}

ui.loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  message(ui.loginMessage, "");
  const button = ui.loginForm.querySelector("button[type=submit]");
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
    sessionStorage.setItem("account_csrf", csrfToken);
    ui.loginPassword.value = "";
    ui.loginOtp.value = "";
    showSession(result.user);
  } catch (error) {
    message(ui.loginMessage, errorText(error));
    ui.loginOtp.value = "";
  } finally {
    button.disabled = false;
  }
});

ui.passwordForm.addEventListener("submit", async event => {
  event.preventDefault();
  message(ui.passwordMessage, "");
  if (ui.newPassword.value !== ui.confirmPassword.value) {
    message(ui.passwordMessage, "Las contraseñas nuevas no coinciden.");
    return;
  }
  const button = ui.passwordForm.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    await request("/api/auth/password", {
      method: "POST", csrf: true,
      body: { currentPassword: ui.currentPassword.value, newPassword: ui.newPassword.value }
    });
    clearSession();
    message(ui.loginMessage, "Contraseña actualizada. Ingresa de nuevo.", true);
  } catch (error) {
    if (error.code === "invalid_credentials") message(ui.passwordMessage, "La contraseña actual no coincide.");
    else sessionExpired(error, ui.passwordMessage);
  } finally {
    button.disabled = false;
  }
});

ui.createForm.addEventListener("submit", async event => {
  event.preventDefault();
  message(ui.createMessage, "");
  const button = ui.createForm.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const result = await request("/api/admin/users", {
      method: "POST", csrf: true,
      body: { username: ui.newUsername.value.trim(), displayName: ui.displayName.value.trim(), role: ui.newRole.value }
    });
    ui.createForm.reset();
    showCredential(result.user.username, result.initialPassword);
    await refreshUsers();
  } catch (error) {
    sessionExpired(error, ui.createMessage);
  } finally {
    button.disabled = false;
  }
});

ui.createBackupAdministratorButton.addEventListener("click", () => {
  message(ui.backupAdministratorMessage, "");
  message(ui.backupAdministratorDialogMessage, "");
  ui.backupAdministratorDialog.showModal();
});

ui.backupAdministratorForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = ui.backupAdministratorForm.querySelector("button[type=submit]");
  button.disabled = true;
  message(ui.backupAdministratorDialogMessage, "");
  try {
    const result = await request("/api/admin/backup-administrator", {
      method: "POST", csrf: true,
      body: { username: ui.backupAdministratorUsername.value.trim(), displayName: ui.backupAdministratorName.value.trim() }
    });
    hideBackupAdministratorDialog();
    showCredential(result.user.username, result.initialPassword);
    message(ui.backupAdministratorMessage, "Administrador suplente creado. Entrega las credenciales por un canal seguro.", true);
    await refreshUsers();
  } catch (error) {
    sessionExpired(error, ui.backupAdministratorDialogMessage);
  } finally {
    button.disabled = false;
  }
});

ui.logoutButton.addEventListener("click", async () => {
  ui.logoutButton.disabled = true;
  try {
    await request("/api/auth/logout", { method: "POST", csrf: true });
    clearSession();
  } catch (error) {
    sessionExpired(error, ui.passwordMessage);
  } finally {
    ui.logoutButton.disabled = false;
  }
});

ui.beginMfaEnrollmentButton.addEventListener("click", async () => {
  ui.beginMfaEnrollmentButton.disabled = true;
  message(ui.mfaEnrollmentMessage, "");
  try {
    const result = await request("/api/auth/mfa/enrollment", { method: "POST", csrf: true });
    ui.mfaEnrollmentSecret.textContent = result.enrollment.secret;
    ui.mfaEnrollmentDetails.hidden = false;
    message(ui.mfaEnrollmentMessage, "Configura la clave en tu aplicación de autenticación y confirma el código.", true);
  } catch (error) {
    sessionExpired(error, ui.mfaEnrollmentMessage);
  } finally {
    ui.beginMfaEnrollmentButton.disabled = false;
  }
});

ui.confirmMfaEnrollmentForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = ui.confirmMfaEnrollmentForm.querySelector("button[type=submit]");
  button.disabled = true;
  message(ui.mfaEnrollmentMessage, "");
  try {
    await request("/api/auth/mfa/enrollment/confirm", {
      method: "POST", csrf: true, body: { code: ui.mfaEnrollmentCode.value.trim() }
    });
    currentUser.mfaEnabled = true;
    ui.mfaEnrollmentSection.hidden = true;
    ui.passwordIntro.textContent = "Segundo factor confirmado. Ahora cambia la contraseña temporal para continuar.";
    message(ui.passwordMessage, "Segundo factor confirmado. Cambia ahora la contraseña temporal.", true);
  } catch (error) {
    sessionExpired(error, ui.mfaEnrollmentMessage);
  } finally {
    button.disabled = false;
  }
});

ui.refreshUsersButton.addEventListener("click", refreshUsers);
ui.closeCredentialButton.addEventListener("click", hideCredential);
ui.doneCredentialButton.addEventListener("click", hideCredential);
ui.credentialDialog.addEventListener("close", hideCredential);
ui.copyPasswordButton.addEventListener("click", async () => {
  try {
    const credentials = [
      `Usuario: ${ui.issuedUsername.textContent}`,
      `Contraseña: ${ui.issuedPassword.textContent}`
    ].join("\n");
    await navigator.clipboard.writeText(credentials);
    message(ui.credentialMessage, "Credenciales copiadas.", true);
  } catch {
    message(ui.credentialMessage, "No se pudo copiar. Selecciona la contraseña manualmente.");
  }
});
ui.saveProcessButton.addEventListener("click", saveAccountProcesses);
ui.closeProcessButton.addEventListener("click", hideProcessDialog);
ui.cancelProcessButton.addEventListener("click", hideProcessDialog);
ui.processDialog.addEventListener("close", () => {
  processAccount = null;
  ui.processOptions.replaceChildren();
  message(ui.processMessage, "");
});
ui.closeBackupAdministratorButton.addEventListener("click", hideBackupAdministratorDialog);
ui.cancelBackupAdministratorButton.addEventListener("click", hideBackupAdministratorDialog);
ui.backupAdministratorDialog.addEventListener("close", hideBackupAdministratorDialog);

csrfToken = sessionStorage.getItem("account_csrf") || "";
if (csrfToken) {
  request("/api/auth/me").then(result => showSession(result.user)).catch(() => clearSession());
}

