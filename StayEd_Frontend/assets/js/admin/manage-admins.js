// Must run first, before anything else on this page executes.
Guards.superAdmin();

let admins = [];

function esc(value) {
  const div = document.createElement("div");
  div.textContent = value == null ? "" : String(value);
  return div.innerHTML;
}

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
        <div style="font-weight:700">${esc(a.name)}</div>
        <div style="font-size:0.8125rem;color:var(--muted)">${esc(a.email)}</div>
      </td>
      <td><span data-admin-title-label="${a.id}" style="display:inline-block;width:280px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle">${esc(computeTitle(a.canManageClcs, a.canManageUsers, a.isSuperAdmin))}</span></td>
      <td>${toggleCell(a.id, "canManageClcs", a.canManageClcs || a.isSuperAdmin, a.isSuperAdmin)}</td>
      <td>${toggleCell(a.id, "canManageUsers", a.canManageUsers || a.isSuperAdmin, a.isSuperAdmin)}</td>
      <td>${toggleCell(a.id, "isSuperAdmin", a.isSuperAdmin)}</td>
      <td><button class="st-btn st-btn-outline st-btn-xs" data-admin-save="${a.id}">Save</button></td>
    </tr>
  `,
    )
    .join("");

  tbody.querySelectorAll("[data-admin-save]").forEach((btn) => {
    btn.addEventListener("click", () => saveAdmin(Number(btn.dataset.adminSave)));
  });

  // Keep the title label live as the toggles change, before Save is even
  // clicked -- it should never show a title that doesn't match what's
  // currently switched on in that same row.
  tbody.querySelectorAll("[data-admin-row]").forEach((row) => {
    const id = row.dataset.adminRow;
    const label = row.querySelector(`[data-admin-title-label="${id}"]`);
    row.querySelectorAll("[data-admin-field]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
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

document.addEventListener("DOMContentLoaded", loadAdmins);
