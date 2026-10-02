const ui = Object.fromEntries([
  "loginView", "loginForm", "loginUsername", "loginPassword", "loginOtp", "loginMessage",
  "workspace", "sessionControls", "sessionIdentity", "logoutButton", "welcomeText",
  "passwordSection", "passwordIntro", "passwordForm", "currentPassword", "newPassword",
  "confirmPassword", "passwordMessage", "adminWorkspace", "createForm", "newUsername",
  "displayName", "newRole", "createMessage", "usersCount", "usersMessage", "usersBody",
  "refreshUsersButton", "credentialDialog", "issuedUsername", "issuedPassword",
  "copyPasswordButton", "closeCredentialButton", "doneCredentialButton", "credentialMessage"
].map(id => [id, document.getElementById(id)]));

let csrfToken = "";
let currentUser = null;

const errors = {
  invalid_credentials: "Nombre de usuario o contraseña incorrectos.",
  mfa_required: "El código del autenticador no coincide o ya venció.",
  mfa_not_configured: "El autenticador no está disponible. Contacta al administrador.",
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
  admin_reset_not_supported: "La contraseña del administrador se cambia desde su propia sesión."
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
}

function showSession(user) {
  currentUser = user;
  ui.loginView.hidden = true;
  ui.workspace.hidden = false;
  ui.sessionControls.hidden = false;
  ui.sessionIdentity.textContent = user.username || user.displayName;
  ui.welcomeText.textContent = `${user.displayName} · ${user.role}`;
  ui.passwordSection.classList.toggle("required", Boolean(user.mustChangePassword));
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
  cell(row, user.role);
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
  message(ui.credentialMessage, "");
  ui.credentialDialog.showModal();
}

function hideCredential() {
  if (ui.credentialDialog.open) ui.credentialDialog.close();
  ui.issuedUsername.textContent = "";
  ui.issuedPassword.textContent = "";
  message(ui.credentialMessage, "");
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

ui.refreshUsersButton.addEventListener("click", refreshUsers);
ui.closeCredentialButton.addEventListener("click", hideCredential);
ui.doneCredentialButton.addEventListener("click", hideCredential);
ui.credentialDialog.addEventListener("close", hideCredential);
ui.copyPasswordButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(ui.issuedPassword.textContent);
    message(ui.credentialMessage, "Contraseña copiada.", true);
  } catch {
    message(ui.credentialMessage, "No se pudo copiar. Selecciona la contraseña manualmente.");
  }
});

csrfToken = sessionStorage.getItem("account_csrf") || "";
if (csrfToken) {
  request("/api/auth/me").then(result => showSession(result.user)).catch(() => clearSession());
}
