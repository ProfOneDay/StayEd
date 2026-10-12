// Must run first, before anything else on this page executes.
Guards.superAdmin();

let admins = [];
let newAdminTempPassword = "";
let newAdminPasswordVisible = false;
let resetAdminId = null;
let resetAdminTempPassword = "";
let resetAdminPasswordVisible = false;

function esc(value) {
  const div = document.createElement("div");
  div.textContent = value == null ? "" : String(value);
  return div.innerHTML;
}

function openAdminModal(id) {
  const modal = document.getElementById(id);
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeAdminModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

document.getElementById("openCreateAdmin").addEventListener("click", () => {
  openAdminModal("modal-create-admin");
  document.getElementById("newAdminFirstName").focus();
});

document.querySelectorAll("[data-close-admin-modal]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".overlay[aria-hidden='false']").forEach((overlay) => closeAdminModal(overlay.id));
  });
});

document.querySelectorAll(".overlay[id^='modal-']").forEach((overlay) => {
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeAdminModal(overlay.id);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.querySelectorAll(".overlay[aria-hidden='false']").forEach((overlay) => closeAdminModal(overlay.id));
  }
});

// Single source of truth for the title, used both for the live label shown
// next to the toggles AND for what actually gets saved -- the title can
// never drift from what the toggles say, because it's never typed in, only
// ever computed from them.
function computeTitle(canManageClcs, canManageUsers, isSuperAdmin) {
  if (isSuperAdmin) return "Super Admin";
  if (canManageClcs && canManageUsers) return "Supervisor";
  if (canManageClcs) return "Head Admin – CLC Management";
  if (canManageUsers) return "Head Admin – User Management";
  return "Staff";
}

async function loadAdmins() {
  try {
    const response = await API.get("/admin/admins");
    admins = response.data || [];
  } catch (error) {
    console.error("[ManageAdmins] Failed to load admins", error);
    Utils.toast(error?.data?.message || "Unable to load admin accounts.", "error");
    admins = [];
  }
  renderTable();
}

function toggleCell(id, field, checked, disabled) {
  return `
    <label class="st-toggle">
      <input type="checkbox" data-admin-field="${field}" data-admin-id="${id}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}>
      <span class="st-toggle-track"><span class="st-toggle-thumb"></span></span>
    </label>
  `;
}

// Super Admin implies both scoped permissions regardless of their own
// toggle state (see admin_permission_required's bypass in authz.py) -- so
// when it's on, force the other two to show checked and lock them, instead
// of letting the table display a misleading "Super Admin" row with CLC/User
// management looking switched off.
function syncSuperAdminLock(row) {
  const superCheckbox = row.querySelector('[data-admin-field="isSuperAdmin"]');
  const clcsCheckbox = row.querySelector('[data-admin-field="canManageClcs"]');
  const usersCheckbox = row.querySelector('[data-admin-field="canManageUsers"]');

  if (superCheckbox.checked) {
    clcsCheckbox.checked = true;
    usersCheckbox.checked = true;
  }
  clcsCheckbox.disabled = superCheckbox.checked;
  usersCheckbox.disabled = superCheckbox.checked;
}

// How many OTHER admins (besides `id`) are currently a super admin, per
// the last loaded/saved state -- not the live unsaved toggle state of
// other rows, which each only take effect once their own Save is clicked.
function otherSuperAdminCount(id) {
  return admins.filter((a) => a.id !== id && a.isSuperAdmin).length;
}

function rowToggleState(row) {
  return {
    canManageClcs: row.querySelector('[data-admin-field="canManageClcs"]').checked,
    canManageUsers: row.querySelector('[data-admin-field="canManageUsers"]').checked,
    isSuperAdmin: row.querySelector('[data-admin-field="isSuperAdmin"]').checked,
  };
}

function renderTable() {
  document.getElementById("adminCount").textContent = `${admins.length} admin${admins.length === 1 ? "" : "s"}`;

  const tbody = document.getElementById("adminsTbody");
  tbody.innerHTML = admins
    .map(
      (a) => `
    <tr data-admin-row="${a.id}">
      <td>
        <div class="st-text-strong">${esc(a.name)}</div>
        <div class="st-text-muted">${esc(a.email)}</div>
      </td>
      <td><span data-admin-title-label="${a.id}" class="st-admin-title-label st-truncate">${esc(computeTitle(a.canManageClcs, a.canManageUsers, a.isSuperAdmin))}</span></td>
      <td>${toggleCell(a.id, "canManageClcs", a.canManageClcs || a.isSuperAdmin, a.isSuperAdmin)}</td>
      <td>${toggleCell(a.id, "canManageUsers", a.canManageUsers || a.isSuperAdmin, a.isSuperAdmin)}</td>
      <td>${toggleCell(a.id, "isSuperAdmin", a.isSuperAdmin)}</td>
      <td>
        <div class="st-admin-row-actions">
          <button class="st-btn st-btn-outline st-btn-xs" data-admin-save="${a.id}">Save</button>
          <button class="st-btn st-btn-outline st-btn-xs" data-admin-reset-password="${a.id}">Reset password</button>
          <button class="st-btn st-btn-danger st-btn-xs" data-admin-remove="${a.id}">Remove</button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");

  tbody.querySelectorAll("[data-admin-save]").forEach((btn) => {
    btn.addEventListener("click", () => saveAdmin(Number(btn.dataset.adminSave)));
  });
  tbody.querySelectorAll("[data-admin-reset-password]").forEach((btn) => {
    btn.addEventListener("click", () => openResetAdmin(Number(btn.dataset.adminResetPassword)));
  });
  tbody.querySelectorAll("[data-admin-remove]").forEach((btn) => {
    btn.addEventListener("click", () => openRemoveAdmin(Number(btn.dataset.adminRemove)));
  });

  // Keep the title label live as the toggles change, before Save is even
  // clicked -- it should never show a title that doesn't match what's
  // currently switched on in that same row.
  tbody.querySelectorAll("[data-admin-row]").forEach((row) => {
    const id = row.dataset.adminRow;
    const label = row.querySelector(`[data-admin-title-label="${id}"]`);
    row.querySelectorAll("[data-admin-field]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        // There must always be at least one super admin -- if unchecking
        // this one would leave zero, snap it back on and explain why
        // instead of letting it go through.
        if (checkbox.dataset.adminField === "isSuperAdmin" && !checkbox.checked) {
          if (otherSuperAdminCount(Number(id)) === 0) {
            checkbox.checked = true;
            Utils.toast("There should always be at least one super admin.", "warning");
          }
        }

        syncSuperAdminLock(row);
        const state = rowToggleState(row);
        label.textContent = computeTitle(state.canManageClcs, state.canManageUsers, state.isSuperAdmin);
      });
    });
  });
}

async function saveAdmin(id) {
  const row = document.querySelector(`[data-admin-row="${id}"]`);
  if (!row) return;

  const state = rowToggleState(row);
  const payload = {
    adminTitle: computeTitle(state.canManageClcs, state.canManageUsers, state.isSuperAdmin),
    ...state,
  };

  try {
    const response = await API.put(`/admin/admins/${id}/permissions`, payload);
    const updated = response.data;
    const index = admins.findIndex((a) => a.id === id);
    if (index !== -1) admins[index] = updated;
    Utils.toast("Admin permissions updated.", "success");

    // Demoting the admin you're logged in as right now is still allowed
    // (you just stay logged in on a now-stale token until next login) --
    // but worth a heads-up since the UI won't otherwise explain why their
    // own access didn't seem to change until they log out and back in.
    if (id === Auth.id()) {
      Utils.toast("This takes effect next time you log in.", "info");
    }
  } catch (error) {
    console.error("[ManageAdmins] Failed to update admin", error);
    Utils.toast(error?.data?.message || "Unable to update this admin.", "error");
    renderTable();
  }
}

function openResetAdmin(id) {
  const admin = admins.find((item) => item.id === id);
  if (!admin) {
    Utils.toast("Admin account not found.", "error");
    return;
  }
  resetAdminId = id;
  document.getElementById("resetAdminName").textContent = admin.name;
  openAdminModal("modal-reset-admin");
}

document.getElementById("confirmResetAdmin").addEventListener("click", async (event) => {
  if (resetAdminId == null) return;
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const response = await API.post(`/admin/admins/${resetAdminId}/reset-password`, {});
    const admin = admins.find((item) => item.id === resetAdminId);
    resetAdminTempPassword = response.temp_password;
    resetAdminPasswordVisible = false;
    document.getElementById("resetAdminResultName").textContent = admin?.name || "Admin";
    document.getElementById("resetAdminTempPassword").value = resetAdminTempPassword;
    document.getElementById("resetAdminTempPassword").type = "password";
    document.getElementById("toggleResetAdminPassword").querySelector("span").textContent = "visibility";
    document.getElementById("toggleResetAdminPassword").setAttribute("aria-label", "Show temporary password");
    document.getElementById("toggleResetAdminPassword").title = "Show password";
    closeAdminModal("modal-reset-admin");
    openAdminModal("modal-admin-password-reset");
  } catch (error) {
    console.error("[ManageAdmins] Failed to reset admin password", error);
    Utils.toast(error?.data?.message || "Unable to reset this admin's password.", "error");
  } finally {
    button.disabled = false;
  }
});

let removeAdminId = null;

function openRemoveAdmin(id) {
  const admin = admins.find((item) => item.id === id);
  if (!admin) {
    Utils.toast("Admin account not found.", "error");
    return;
  }
  removeAdminId = id;
  document.getElementById("removeAdminName").textContent = admin.name;
  openAdminModal("modal-remove-admin");
}

document.getElementById("confirmRemoveAdmin").addEventListener("click", async (event) => {
  if (removeAdminId == null) return;
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await API.delete(`/admin/admins/${removeAdminId}`);
    closeAdminModal("modal-remove-admin");
    removeAdminId = null;
    await loadAdmins();
    Utils.toast("Admin account removed. Historical records were retained.", "success");
  } catch (error) {
    console.error("[ManageAdmins] Failed to remove admin account", error);
    Utils.toast(error?.data?.message || "Unable to remove this admin account.", "error");
  } finally {
    button.disabled = false;
  }
});

document.getElementById("toggleResetAdminPassword").addEventListener("click", (event) => {
  resetAdminPasswordVisible = !resetAdminPasswordVisible;
  event.currentTarget.querySelector("span").textContent = resetAdminPasswordVisible ? "visibility_off" : "visibility";
  event.currentTarget.setAttribute("aria-label", resetAdminPasswordVisible ? "Hide temporary password" : "Show temporary password");
  event.currentTarget.title = resetAdminPasswordVisible ? "Hide password" : "Show password";
  document.getElementById("resetAdminTempPassword").type = resetAdminPasswordVisible ? "text" : "password";
});

document.getElementById("copyResetAdminPassword").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(resetAdminTempPassword);
    Utils.toast("Temporary password copied.", "success");
  } catch (error) {
    console.error("[ManageAdmins] Unable to copy reset admin password", error);
    Utils.toast("Unable to copy the temporary password.", "error");
  }
});

document.getElementById("adminCreateForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;

  const firstName = document.getElementById("newAdminFirstName").value.trim();
  const middleName = document.getElementById("newAdminMiddleName").value.trim();
  const lastName = document.getElementById("newAdminLastName").value.trim();
  const email = document.getElementById("newAdminEmail").value.trim();
  const phone = document.getElementById("newAdminPhone").value.trim();
  const submitButton = document.getElementById("createAdminSubmit");
  if (!firstName || !lastName || !email) {
    Utils.toast("First name, last name, and email are required.", "warning");
    return;
  }

  submitButton.disabled = true;
  try {
    const response = await API.post("/admin/users", {
      role: "admin",
      firstName,
      middleName,
      lastName,
      email,
      phone,
    });

    newAdminTempPassword = response.temp_password;
    newAdminPasswordVisible = false;
    document.getElementById("adminTempPassword").value = newAdminTempPassword;
    document.getElementById("adminTempPassword").type = "password";
    document.getElementById("toggleAdminTempPassword").querySelector("span").textContent = "visibility";
    document.getElementById("toggleAdminTempPassword").setAttribute("aria-label", "Show temporary password");
    document.getElementById("toggleAdminTempPassword").title = "Show password";
    document.getElementById("adminCreateResultName").textContent = response.data.name;
    form.reset();
    closeAdminModal("modal-create-admin");
    openAdminModal("modal-admin-created");
    await loadAdmins();
    Utils.toast("Admin account created. Assign their access below.", "success");
  } catch (error) {
    console.error("[ManageAdmins] Failed to create admin account", error);
    Utils.toast(error?.data?.message || "Unable to create this admin account.", "error");
  } finally {
    submitButton.disabled = false;
  }
});

document.getElementById("toggleAdminTempPassword").addEventListener("click", (event) => {
  newAdminPasswordVisible = !newAdminPasswordVisible;
  event.currentTarget.querySelector("span").textContent = newAdminPasswordVisible ? "visibility_off" : "visibility";
  event.currentTarget.setAttribute("aria-label", newAdminPasswordVisible ? "Hide temporary password" : "Show temporary password");
  event.currentTarget.title = newAdminPasswordVisible ? "Hide password" : "Show password";
  document.getElementById("adminTempPassword").type = newAdminPasswordVisible ? "text" : "password";
});

document.getElementById("copyAdminTempPassword").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(newAdminTempPassword);
    Utils.toast("Temporary password copied.", "success");
  } catch (error) {
    console.error("[ManageAdmins] Unable to copy temporary password", error);
    Utils.toast("Unable to copy the temporary password.", "error");
  }
});

document.addEventListener("DOMContentLoaded", loadAdmins);
