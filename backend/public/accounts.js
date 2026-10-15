const ui = Object.fromEntries([
  "loginView", "loginForm", "loginUsername", "loginPassword", "loginOtp", "loginMessage",
  "workspace", "sessionControls", "sessionIdentity", "logoutButton", "welcomeText",
  "passwordSection", "passwordIntro", "passwordForm", "currentPassword", "newPassword",
  "confirmPassword", "passwordMessage", "adminWorkspace", "createForm", "newUsername",
  "displayName", "newRole", "createMessage", "usersCount", "usersMessage", "usersBody",
  "mfaEnrollmentSection", "beginMfaEnrollmentButton", "mfaEnrollmentMessage", "mfaEnrollmentDetails", "mfaEnrollmentSecret", "confirmMfaEnrollmentForm", "mfaEnrollmentCode",
  "refreshUsersButton", "exportUsersButton", "credentialDialog", "issuedUsername", "issuedPassword",
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
let currentUsers = [];

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
    currentUsers = users;
    ui.usersBody.replaceChildren(...currentUsers.map(userRow));
    ui.usersCount.textContent = `${currentUsers.length} usuario${currentUsers.length === 1 ? "" : "s"}`;
    const administrators = currentUsers.filter(user => user.role === "administrador");
    const currentAdministrator = administrators.find(user => user.id === currentUser?.id);
    ui.backupAdministratorSection.hidden = !(currentAdministrator?.administratorType === "titular" && administrators.length === 1);
  } catch (error) {
    sessionExpired(error, ui.usersMessage);
  }
}

function escapeXml(value) {
  return String(value ?? "").replace(/[<>&'\"]/g, character => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;"
  })[character]);
}

function accountColumnName(index) {
  let name = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  }
  return name;
}

function accountSpreadsheetCell(value, reference, heading = false) {
  const style = heading ? ' s="1"' : "";
  if (typeof value === "number") return `<c r="${reference}"${style}><v>${value}</v></c>`;
  return `<c r="${reference}" t="inlineStr"${style}><is><t>${escapeXml(value)}</t></is></c>`;
}

function accountSpreadsheetSheet(rows, widths = []) {
  const columns = widths.length
    ? `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const body = rows.map((row, rowIndex) => {
    const cells = row.values.map((value, columnIndex) => accountSpreadsheetCell(value, `${accountColumnName(columnIndex)}${rowIndex + 1}`, row.kind === "heading")).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${columns}<sheetData>${body}</sheetData></worksheet>`;
}

function accountCrc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  }
  return (value ^ 0xffffffff) >>> 0;
}

function writeAccountUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeAccountUint32(view, offset, value) {
  view.setUint32(offset, value, true);
}

function accountWorkbookBlob(files) {
  const encoder = new TextEncoder();
  const localChunks = [];
  const directoryChunks = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const filename = encoder.encode(name);
    const data = encoder.encode(content);
    const checksum = accountCrc32(data);
    const local = new Uint8Array(30 + filename.length + data.length);
    const localView = new DataView(local.buffer);
    writeAccountUint32(localView, 0, 0x04034b50);
    writeAccountUint16(localView, 4, 20);
    writeAccountUint32(localView, 14, checksum);
    writeAccountUint32(localView, 18, data.length);
    writeAccountUint32(localView, 22, data.length);
    writeAccountUint16(localView, 26, filename.length);
    local.set(filename, 30);
    local.set(data, 30 + filename.length);
    localChunks.push(local);
    const directory = new Uint8Array(46 + filename.length);
    const directoryView = new DataView(directory.buffer);
    writeAccountUint32(directoryView, 0, 0x02014b50);
    writeAccountUint16(directoryView, 4, 20);
    writeAccountUint16(directoryView, 6, 20);
    writeAccountUint32(directoryView, 16, checksum);
    writeAccountUint32(directoryView, 20, data.length);
    writeAccountUint32(directoryView, 24, data.length);
    writeAccountUint16(directoryView, 28, filename.length);
    writeAccountUint32(directoryView, 42, offset);
    directory.set(filename, 46);
    directoryChunks.push(directory);
    offset += local.length;
  }
  const directorySize = directoryChunks.reduce((total, chunk) => total + chunk.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeAccountUint32(endView, 0, 0x06054b50);
  writeAccountUint16(endView, 8, directoryChunks.length);
  writeAccountUint16(endView, 10, directoryChunks.length);
  writeAccountUint32(endView, 12, directorySize);
  writeAccountUint32(endView, 16, offset);
  return new Blob([...localChunks, ...directoryChunks, end], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

function accountRoleLabel(user) {
  return user.role === "administrador" ? "Administración" : user.role === "evaluador" ? "Evaluador" : "Elaborador";
}

function accountDate(value) {
  return value
    ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date(value))
    : "Sin registro";
}

function accountsWorkbook(users) {
  const totalsByRole = ["elaborador", "evaluador", "administrador"].map(role => {
    const roleUsers = users.filter(user => user.role === role);
    return [accountRoleLabel({ role }), roleUsers.length, roleUsers.filter(user => user.active).length, roleUsers.filter(user => !user.active).length];
  });
  const detailRows = users.map(user => ({ values: [
    user.username || "Sin asignar",
    user.displayName,
    accountRoleLabel(user),
    user.role === "administrador" ? (user.administratorType === "titular" ? "Titular" : "Suplente") : "No aplica",
    user.active ? "Activo" : "Inactivo",
    user.role === "administrador" ? "No aplica" : (user.processCodes?.join(", ") || "Sin procesos"),
    accountDate(user.createdAt),
    accountDate(user.lastAccess),
    user.mfaEnabled ? "Configurado" : "No configurado",
    user.mustChangePassword ? "Cambio pendiente" : "Vigente"
  ] }));
  const summaryRows = [
    { kind: "heading", values: ["Reporte institucional de cuentas", ""] },
    { values: ["Generado", accountDate(new Date())] },
    { values: ["Total de cuentas", users.length] },
    { values: ["Cuentas activas", users.filter(user => user.active).length] },
    { values: ["Cuentas inactivas", users.filter(user => !user.active).length] },
    { values: [] },
    { kind: "heading", values: ["Rol", "Total", "Activas", "Inactivas"] },
    ...totalsByRole.map(values => ({ values }))
  ];
  const sheets = [
    ["Resumen", summaryRows, [28, 24, 14, 14]],
    ["Cuentas", [{ kind: "heading", values: ["Usuario", "Nombre completo", "Rol", "Administración", "Estado", "Procesos asignados", "Fecha de creación", "Último acceso", "Segundo factor", "Contraseña"] }, ...detailRows], [20, 32, 17, 18, 14, 30, 22, 22, 19, 19]]
  ];
  return accountWorkbookBlob({
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([name], index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173C42"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf xfId="0"/><xf fontId="1" fillId="1" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`,
    ...Object.fromEntries(sheets.map(([name, rows, widths], index) => [`xl/worksheets/sheet${index + 1}.xml`, accountSpreadsheetSheet(rows, widths)]))
  });
}

function downloadAccountsWorkbook() {
  if (currentUser?.role !== "administrador") return;
  const link = document.createElement("a");
  const url = URL.createObjectURL(accountsWorkbook(currentUsers));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  link.href = url;
  link.download = `cuentas-institucionales-${today}.xlsx`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
ui.exportUsersButton.addEventListener("click", downloadAccountsWorkbook);
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

