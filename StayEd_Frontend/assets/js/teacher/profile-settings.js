const PROFILE_SETTINGS_REDUCE_MOTION = matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

class ProfileSettingsPage {
  static async init() {
    if (window.Guards) Guards.teacher();

    this.populateFromUser();

    this.bindSections();

    this.bindForms();

    ProfileAvatar.bindUpload("Teacher");

    this.bindProfileEditing();

    this.bindDangerZone();

    this.playEntrance();

    await this.restoreAccountSettings();
  }

  // Cards/sections settle in once on load using the page's shared motion
  // tokens. Profile Settings no longer includes the old Quick Stats counter.
  static playEntrance() {
    document.querySelectorAll("[data-animate-cards]").forEach((group) => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => group.classList.add("is-inview")),
      );
    });
  }

  static populateFromUser() {
    const user = (window.Auth && Auth.user && Auth.user()) || {};

    const name =
      user.full_name ||
      [user.first_name, user.last_name].filter(Boolean).join(" ") ||
      "Teacher";

    const initials = name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    this.set("[data-settings-name]", name);

    ProfileAvatar.render(user.avatar || "", initials, "Teacher");

    const first = document.getElementById("settingsFirstName");
    const last = document.getElementById("settingsLastName");
    const email = document.getElementById("settingsEmail");
    const mobile = document.getElementById("settingsMobile");
    const clcInput = document.getElementById("settingsClcAssign");

    if (first && user.first_name) first.value = user.first_name;
    if (last && user.last_name) last.value = user.last_name;
    if (email && user.email) email.value = user.email;
    if (mobile) mobile.value = user.phone || "";
    // A teacher can be assigned more than one CLC (e.g. a cluster
    // coordinator) -- show all of them, not just the single most-recently-
    // assigned one `user.school` used to be limited to.
    const schoolsText =
      user.schools && user.schools.length ? user.schools.join(", ") : user.school || "";
    if (clcInput) {
      clcInput.value = schoolsText;
      clcInput.title = schoolsText;
    }

    this.set("[data-settings-employee-id]", user.employee_id || "—");
    this.set("[data-settings-clc]", schoolsText || "—");
    this.set(
      "[data-settings-join-date]",
      user.join_date
        ? new Date(user.join_date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "—",
    );
  }

  static bindSections() {
    document.querySelectorAll("[data-settings-toggle]").forEach((header) => {
      header.addEventListener("click", () => {
        const section = header.closest(".st-settings-section");

        section?.classList.toggle("is-open");
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
    const editableFields = Array.from(
      document.querySelectorAll("[data-profile-editable]"),
    );
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

  static bindForms() {
    const profileForm = document.getElementById("profileInfoForm");

    window.UnsavedChanges?.track(profileForm);

    profileForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!profileForm.classList.contains("is-editing")) return;

      const firstName = document.getElementById("settingsFirstName")?.value.trim();
      const lastName = document.getElementById("settingsLastName")?.value.trim();

      if (!firstName || !lastName) {
        Toast?.error("First Name and Last Name are required.");
        return;
      }

      try {
        await Auth.updateProfile({
          first_name: firstName,
          last_name: lastName,
          phone: document.getElementById("settingsMobile")?.value.trim(),
        });

        window.UnsavedChanges?.clear(profileForm);
        this.populateFromUser();
        this.setProfileEditMode(false);
        this.profileEditSnapshot = null;
        Layout?.restoreUser?.();
        App?.restoreUser?.();
        Toast?.success("Profile information saved.");
      } catch (error) {
        console.error(error);
        Toast?.error(error.message || "Unable to save profile information.");
      }
    });
  }

  static bindDangerZone() {
    document
      .querySelector("[data-deactivate-account]")
      ?.addEventListener("click", () => {
        if (!window.Modal) return;

        Modal.show({
          title: "Deactivate Account",

          message:
            "Are you sure you want to deactivate your account? You will lose access to administrative tools until it is reactivated by a Division Administrator.",

          onConfirm: () => {
            Toast?.success("Deactivation request submitted.");
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
          ProfileAvatar.currentInitials("Teacher"),
          "Teacher",
        );
        Layout?.restoreUser?.();
      }
    } catch (error) {
      console.error("[ProfileSettings] Unable to load account settings", error);
    }
  }

  static set(selector, value) {
    const el = document.querySelector(selector);
    if (el && value !== undefined && value !== null) {
      el.textContent = value;
    }
  }
}

(function bootProfileSettings() {
  let started = false;
  const start = () => {
    if (!started) {
      started = true;
      ProfileSettingsPage.init();
    }
  };
  document.addEventListener("components:loaded", start);
  document.addEventListener("DOMContentLoaded", () => setTimeout(start, 400));
})();

window.ProfileSettingsPage = ProfileSettingsPage;
