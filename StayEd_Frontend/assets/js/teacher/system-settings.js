class SystemSettingsPage {
  static async init() {
    if (window.Guards) Guards.teacher();

    this.trackForms();

    this.bindToggles();

    this.bindSaveAll();
  }

  static trackForms() {
    const container = document.querySelector(".st-settings-bento-left");

    if (container) {
      window.UnsavedChanges?.track(container);
    }
  }

  static bindToggles() {
    document
      .querySelectorAll("[data-settings-toggle-pref]")
      .forEach((toggle) => {
        toggle.addEventListener("change", () => {
          Toast?.success("Preference updated.");
        });
      });
  }

  static bindSaveAll() {
    document
      .querySelector("[data-save-all-settings]")
      ?.addEventListener("click", () => {
        const container = document.querySelector(".st-settings-bento-left");

        if (container) {
          window.UnsavedChanges?.clear(container);
        }

        Toast?.success("All settings saved.");
      });
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
