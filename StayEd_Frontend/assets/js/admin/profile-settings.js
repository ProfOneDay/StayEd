// Must run first, before anything else on this page executes.
Guards.admin();

// Admin Profile Settings now shares the exact same markup/flow as the
// teacher page (components/profile/danger-zone.html, the inline-edit
// Account Information grid, the Security section + Change Password modal
// via assets/js/core/profile-security.js) -- this file is the admin-only
// behavior layer on top of that shared shell: it talks to the admin-only
// PUT /admin/profile and POST /admin/self/deactivate endpoints instead of
// the teacher ones, and otherwise mirrors assets/js/teacher/profile-settings.js.
class AdminProfileSettingsPage {
  static async init() {
    this.populateFromUser();

    this.bindSections();

    ProfileAvatar.bindUpload("Admin");

    this.bindProfileEditing();

    this.bindForm();

    this.bindDangerZone();

    this.playEntrance();

    await this.restoreAccountSettings();
  }

  static playEntrance() {
    const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;

    document.querySelectorAll("[data-animate-cards]").forEach((group) => {
      if (REDUCE) {
        group.classList.add("is-inview");
        return;
      }
      requestAnimationFrame(() =>
        requestAnimationFrame(() => group.classList.add("is-inview")),
      );
    });
  }

  static initialsOf(name) {
    return String(name || "")
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  static formatJoinDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  static populateFromUser() {
    const user = Auth.user() || {};

    const fullName =
      user.full_name ||
      [user.first_name, user.last_name].filter(Boolean).join(" ") ||
      "Admin";

    const initials = this.initialsOf(fullName);

    this.set("#profileDisplayName", fullName);

    ProfileAvatar.render(user.avatar || "", initials, "Admin");

    const first = document.getElementById("profileFirstName");
    const last = document.getElementById("profileLastName");
    const email = document.getElementById("profileEmailDisplay");
    const phone = document.getElementById("profilePhoneDisplay");
    const empId = document.getElementById("profileEmpIdDisplay");

    if (first) first.value = user.first_name || "";
    if (last) last.value = user.last_name || "";
    if (email) email.value = user.email || "";
    if (phone) phone.value = user.phone || "";
    if (empId) empId.value = user.employee_id || "—";

    const joinDate = this.formatJoinDate(user.join_date);
    document
      .querySelectorAll("[data-profile-joindate-echo]")
      .forEach((el) => {
        el.textContent = joinDate;
      });
    document.querySelectorAll("[data-profile-empid-echo]").forEach((el) => {
      el.textContent = user.employee_id || "—";
    });
  }

  static bindSections() {
    document.querySelectorAll("[data-settings-toggle]").forEach((header) => {
      header.addEventListener("click", () => {
        header.closest(".st-settings-section")?.classList.toggle("is-open");
      });
    });
  }

  static bindProfileEditing() {
    const form = document.getElementById("profileInfoForm");
    const editButton = document.querySelector("[data-profile-edit]");
    const cancelButton = document.querySelector("[data-profile-cancel]");
    if (!form || !editButton) return;

    editButton.addEventListener("click", () => this.setProfileEditMode(true));
    cancelButton?.addEventListener("click", () => this.cancelProfileEditing());
  }

  static setProfileEditMode(editing) {
    const form = document.getElementById("profileInfoForm");
    const editButton = document.querySelector("[data-profile-edit]");
    const actions = document.querySelector("[data-profile-edit-actions]");
    const editableFields = Array.from(document.querySelectorAll("[data-profile-editable]"));
    if (!form) return;

    if (editing) {
      this.profileEditSnapshot = Object.fromEntries(
        editableFields.map((field) => [field.id, field.value]),
      );
    }

    form.classList.toggle("is-editing", editing);
    editableFields.forEach((field) => {
      field.readOnly = !editing;
      field.setAttribute("aria-readonly", editing ? "false" : "true");
    });

    if (editButton) editButton.hidden = editing;
    if (actions) actions.hidden = !editing;

    if (editing) {
      editableFields[0]?.focus();
      editableFields[0]?.select?.();
    }
  }

  static cancelProfileEditing() {
    const form = document.getElementById("profileInfoForm");
    const snapshot = this.profileEditSnapshot || {};

    Object.entries(snapshot).forEach(([id, value]) => {
      const field = document.getElementById(id);
      if (field) field.value = value;
    });

    window.UnsavedChanges?.clear(form);
    this.setProfileEditMode(false);
    this.profileEditSnapshot = null;
  }

  static bindForm() {
    const form = document.getElementById("profileInfoForm");

    window.UnsavedChanges?.track(form);

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.classList.contains("is-editing")) return;

      const firstName = document.getElementById("profileFirstName")?.value.trim();
      const lastName = document.getElementById("profileLastName")?.value.trim();
      const email = document.getElementById("profileEmailDisplay")?.value.trim();
      const phone = document.getElementById("profilePhoneDisplay")?.value.trim();

      if (!firstName || !lastName || !email) {
        Toast?.error("First Name, Last Name, and Email are required.");
        return;
      }

      try {
        const fullName = `${firstName} ${lastName}`.trim();
        const response = await API.put("/admin/profile", { fullName, phone, email });

        Auth.updateUser({
          full_name: response.data.fullName,
          email: response.data.email,
          phone: response.data.phone,
        });

        window.UnsavedChanges?.clear(form);
        this.populateFromUser();
        this.setProfileEditMode(false);
        this.profileEditSnapshot = null;
        Layout?.restoreUser?.();
        Toast?.success("Profile information saved.");
      } catch (error) {
        console.error("[AdminProfileSettings] Update profile failed", error);
        Toast?.error(error?.data?.message || "Unable to save profile information.");
      }
    });
  }

  static bindDangerZone() {
    document.querySelector("[data-deactivate-account]")?.addEventListener("click", () => {
      if (!window.Modal) return;

      Modal.show({
        title: "Deactivate Account",
        message:
          "Are you sure you want to deactivate your account? You'll immediately lose access to administrative tools. Contact another division admin to reactivate.",
        confirmLabel: "Deactivate",
        asyncConfirm: true,
        onConfirm: async () => {
          try {
            await API.post("/admin/self/deactivate", {});
            Toast?.success("Account deactivated. Signing you out…");
            setTimeout(() => Auth.logout(), 1200);
          } catch (error) {
            console.error("[AdminProfileSettings] Deactivate self failed", error);
            Toast?.error(error?.data?.message || "Unable to deactivate your account.");
            throw error;
          }
        },
      });
    });
  }

  static async restoreAccountSettings() {
    try {
      const settings = await API.getSettings();
      if (Object.prototype.hasOwnProperty.call(settings, "avatar")) {
        Auth.updateUser({ avatar: settings.avatar || "" });
        ProfileAvatar.render(
          settings.avatar || "",
          ProfileAvatar.currentInitials("Admin"),
          "Admin",
        );
        Layout?.restoreUser?.();
      }
    } catch (error) {
      console.error("[AdminProfileSettings] Unable to load account settings", error);
    }
  }

  static set(selector, value) {
    const el = document.querySelector(selector);
    if (el && value !== undefined && value !== null) {
      el.textContent = value;
    }
  }
}

(function bootAdminProfileSettings() {
  let started = false;
  const start = () => {
    if (!started) {
      started = true;
      AdminProfileSettingsPage.init();
    }
  };
  document.addEventListener("components:loaded", start);
  document.addEventListener("DOMContentLoaded", () => setTimeout(start, 400));
})();

window.AdminProfileSettingsPage = AdminProfileSettingsPage;
