class SystemSettingsPage {
  static preferences = {};

  static async init() {
    if (window.Guards) Guards.teacher();

    await this.load();

    this.bindToggles();
  }

  static async load() {
    try {
      const [settings, schoolYear] = await Promise.all([
        API.getSettings(),
        API.getActiveSchoolYear().catch(() => null),
      ]);

      this.preferences = settings.preferences || {};

      this.applyToggles();

      this.set("#sysSchoolYear", schoolYear?.schoolYear || "—");
    } catch (error) {
      console.error("[SystemSettings] Unable to load settings", error);
      Toast?.error("Unable to load your settings.");
    }
  }

  static applyToggles() {
    document.querySelectorAll("[data-settings-toggle-pref]").forEach((toggle) => {
      const key = toggle.dataset.settingsTogglePref;
      toggle.checked = this.preferences[key] !== false;
    });
  }

  static bindToggles() {
    document
      .querySelectorAll("[data-settings-toggle-pref]")
      .forEach((toggle) => {
        toggle.addEventListener("change", async () => {
          const key = toggle.dataset.settingsTogglePref;

          try {
            const result = await API.updateSettings({ [key]: toggle.checked });
            this.preferences = result.preferences || this.preferences;
            Toast?.success("Preference updated.");
          } catch (error) {
            console.error("[SystemSettings] Unable to save preference", error);
            Toast?.error("Unable to save this preference.");
            toggle.checked = !toggle.checked;
          }
        });
      });
  }

  static set(selector, value) {
    const el = document.querySelector(selector);
    if (!el) return;
    if ("value" in el) el.value = value;
    else el.textContent = value;
  }
}

(function bootSystemSettings() {
  let started = false;
  const start = () => {
    if (!started) {
      started = true;
      SystemSettingsPage.init();
    }
  };
  document.addEventListener("components:loaded", start);
  document.addEventListener("DOMContentLoaded", () => setTimeout(start, 400));
})();

window.SystemSettingsPage = SystemSettingsPage;
