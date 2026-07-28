class ProfileSettingsPage {
  static PREFS_KEY = "stayed_user_prefs";

  static async init() {
    if (window.Guards) Guards.teacher();

    this.populateFromUser();

    this.bindSections();

    this.bindForms();

    this.bindToggles();

    this.bindTheme();

    this.bindFontScale();

    this.bindDangerZone();

    this.restorePreferences();
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

    const photo = document.querySelector("[data-profile-photo]");

    if (photo) photo.textContent = initials;

    const first = document.getElementById("settingsFirstName");
    const last = document.getElementById("settingsLastName");
    const email = document.getElementById("settingsEmail");

    if (first && user.first_name) first.value = user.first_name;
    if (last && user.last_name) last.value = user.last_name;
    if (email && user.email) email.value = user.email;

    document
      .querySelector("[data-change-photo]")
      ?.addEventListener("click", () => {
        Toast?.info(
          "Photo upload will be available once connected to the server.",
        );
      });
  }

  static bindSections() {
    document.querySelectorAll("[data-settings-toggle]").forEach((header) => {
      header.addEventListener("click", () => {
        const section = header.closest(".st-settings-section");

        section?.classList.toggle("is-open");
      });
    });
  }

  static bindForms() {
    const profileForm = document.getElementById("profileInfoForm");

    window.UnsavedChanges?.track(profileForm);

    profileForm?.addEventListener("submit", (event) => {
      event.preventDefault();

      window.UnsavedChanges?.clear(profileForm);

      Toast?.success("Profile information saved.");
    });

    const passwordForm = document.getElementById("passwordForm");

    window.UnsavedChanges?.track(passwordForm);

    passwordForm?.addEventListener("submit", (event) => {
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

      Toast?.success("Password updated successfully.");

      event.target.reset();

      window.UnsavedChanges?.clear(passwordForm);
    });

    document
      .querySelector("[data-save-preferences]")
      ?.addEventListener("click", () => {
        Toast?.success("System preferences saved.");
      });
  }

  static bindToggles() {
    document
      .querySelectorAll("[data-settings-toggle-pref]")
      .forEach((toggle) => {
        toggle.addEventListener("change", () => {
          this.savePreference(
            toggle.dataset.settingsTogglePref,
            toggle.checked,
          );

          Toast?.success("Preference updated.");
        });
      });
  }

  static bindTheme() {
    document.querySelectorAll("[data-theme-option]").forEach((option) => {
      option.addEventListener("click", () => {
        document
          .querySelectorAll("[data-theme-option]")
          .forEach((o) => o.classList.remove("is-selected"));

        option.classList.add("is-selected");

        this.savePreference("theme", option.dataset.themeOption);

        Toast?.info(
          `Theme set to ${option.dataset.themeOption}. Full theming support is coming soon.`,
        );
      });
    });
  }

  static bindFontScale() {
    const slider = document.querySelector("[data-font-scale]");
    const display = document.querySelector("[data-font-scale-value]");

    if (!slider) return;

    slider.addEventListener("input", () => {
      if (display) display.textContent = `${slider.value}%`;

      document.documentElement.style.setProperty(
        "--st-font-scale",
        slider.value / 100,
      );
    });

    slider.addEventListener("change", () => {
      this.savePreference("font-scale", slider.value);
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

  static savePreference(key, value) {
    let prefs = {};

    try {
      prefs = JSON.parse(localStorage.getItem(this.PREFS_KEY) || "{}");
    } catch {
      prefs = {};
    }

    prefs[key] = value;

    try {
      localStorage.setItem(this.PREFS_KEY, JSON.stringify(prefs));
    } catch {}
  }

  static restorePreferences() {
    let prefs = {};

    try {
      prefs = JSON.parse(localStorage.getItem(this.PREFS_KEY) || "{}");
    } catch {
      prefs = {};
    }

    Object.entries(prefs).forEach(([key, value]) => {
      const toggle = document.querySelector(
        `[data-settings-toggle-pref="${key}"]`,
      );

      if (toggle) {
        toggle.checked = Boolean(value);
        return;
      }

      if (key === "theme") {
        document.querySelectorAll("[data-theme-option]").forEach((o) => {
          o.classList.toggle("is-selected", o.dataset.themeOption === value);
        });
      }

      if (key === "font-scale") {
        const slider = document.querySelector("[data-font-scale]");
        const display = document.querySelector("[data-font-scale-value]");

        if (slider) slider.value = value;
        if (display) display.textContent = `${value}%`;
      }
    });
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
