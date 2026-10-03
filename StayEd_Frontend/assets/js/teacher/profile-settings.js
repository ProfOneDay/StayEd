const PROFILE_SETTINGS_REDUCE_MOTION = matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

class ProfileSettingsPage {
  static async init() {
    if (window.Guards) Guards.teacher();

    this.populateFromUser();

    this.bindSections();

    this.bindForms();

    this.bindAvatarUpload();

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

    this.renderAvatar(user.avatar || "", initials);

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

  static renderAvatar(avatar, initials = "T") {
    const photo = document.querySelector("[data-profile-photo]");
    if (!photo) return;

    photo.innerHTML = "";
    if (avatar) {
      const image = document.createElement("img");
      image.src = avatar;
      image.alt = "Profile photo";
      photo.appendChild(image);
    } else {
      photo.textContent = initials || "T";
    }

    const removeButton = document.querySelector("[data-remove-photo]");
    if (removeButton) removeButton.hidden = !avatar;
  }

  static bindAvatarUpload() {
    const input = document.querySelector("[data-profile-photo-input]");
    const button = document.querySelector("[data-change-photo]");
    const removeButton = document.querySelector("[data-remove-photo]");
    if (!input || !button) return;

    button.addEventListener("click", () => input.click());
    removeButton?.addEventListener("click", () => this.confirmRemoveAvatar());

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;

      const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
      if (!allowed.has(file.type)) {
        Toast?.error("Choose a JPG, PNG, or WEBP image.");
        return;
      }

      const maxBytes = 2 * 1024 * 1024;
      if (file.size > maxBytes) {
        Toast?.error("Profile photo must be 2 MB or smaller.");
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => Toast?.error("Unable to read that image.");
      reader.onload = () => this.previewAvatar(String(reader.result || ""), file);
      reader.readAsDataURL(file);
    });
  }

  static previewAvatar(dataUrl, file) {
    if (!dataUrl || !window.Modal) return;

    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    Modal.show({
      title: "Update Profile Photo",
      size: "sm",
      confirmLabel: "Save Photo",
      asyncConfirm: true,
      message: `
        <div class="st-avatar-preview-dialog">
          <img src="${dataUrl}" alt="Selected profile photo preview">
          <div>
            <strong>${this.escapeHtml(file.name)}</strong>
            <p>${sizeKb} KB · Preview before saving</p>
          </div>
        </div>
      `,
      onConfirm: async () => {
        try {
          const result = await API.updateAvatar(dataUrl);
          const avatar = result.avatar || dataUrl;
          const user = Auth.updateUser({ avatar });
          const name = user.full_name || [user.first_name, user.last_name].filter(Boolean).join(" ") || "Teacher";
          const initials = name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
          this.renderAvatar(avatar, initials);
          Layout?.restoreUser?.();
          Toast?.success("Profile photo updated.");
        } catch (error) {
          console.error("[ProfileSettings] Avatar upload failed", error);
          Toast?.error(error?.data?.message || error?.message || "Unable to update profile photo.");
          throw error;
        }
      },
    });
  }

  static confirmRemoveAvatar() {
    const user = Auth.user() || {};
    if (!user.avatar) return;

    const remove = async () => {
      try {
        await API.updateAvatar(null);
        const updatedUser = Auth.updateUser({ avatar: "" });
        const name =
          updatedUser.full_name ||
          [updatedUser.first_name, updatedUser.last_name].filter(Boolean).join(" ") ||
          "Teacher";
        const initials = name
          .split(" ")
          .filter(Boolean)
          .map((part) => part[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();

        this.renderAvatar("", initials);
        Layout?.restoreUser?.();
        App?.restoreUser?.();
        Toast?.success("Profile photo removed.");
      } catch (error) {
        console.error("[ProfileSettings] Avatar removal failed", error);
        Toast?.error(
          error?.data?.message || error?.message || "Unable to remove profile photo.",
        );
        throw error;
      }
    };

    if (window.Modal) {
      Modal.show({
        title: "Remove Profile Photo",
        size: "sm",
        confirmLabel: "Remove Photo",
        asyncConfirm: true,
        message:
          "Remove your current profile photo? Your initials will be shown instead.",
        onConfirm: remove,
      });
      return;
    }

    if (window.confirm("Remove your current profile photo?")) remove();
  }

  static escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

    const passwordForm = document.getElementById("passwordForm");

    window.UnsavedChanges?.track(passwordForm);

    passwordForm?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const current = document.getElementById("currentPassword").value;
      const next = document.getElementById("newPassword").value;
      const confirm = document.getElementById("confirmNewPassword").value;

      if (!current || !next) {
        Toast?.error("Please fill in your current and new password.");

        return;
      }

      if (next.length < 12) {
        Toast?.error("New password must be at least 12 characters.");

        return;
      }

      if (next !== confirm) {
        Toast?.error("New password and confirmation do not match.");

        return;
      }

      try {
        await Auth.changePassword({
          current_password: current,
          password: next,
        });

        Toast?.success("Password updated successfully.");
        event.target.reset();
        window.UnsavedChanges?.clear(passwordForm);
      } catch (error) {
        console.error(error);
        Toast?.error(error.message || "Unable to update password.");
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
        const user = Auth.user() || {};
        const name =
          user.full_name ||
          [user.first_name, user.last_name].filter(Boolean).join(" ") ||
          "Teacher";
        const initials = name
          .split(" ")
          .filter(Boolean)
          .map((part) => part[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();
        this.renderAvatar(settings.avatar || "", initials);
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
