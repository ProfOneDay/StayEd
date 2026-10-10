class SystemSettingsPage {
  static async init() {
    if (window.Guards) Guards.teacher();

    // Bind listeners immediately so the slider (and toggles) respond right
    // away, instead of sitting inert until the settings GET below finishes.
    SettingsPrefs.bind();
    this.playEntrance();

    await this.load();
  }

  // Sections settle in once on load, staggered via each card's own --i
  // (see system-settings.css). Always above the fold, so this fires
  // directly rather than watching scroll position.
  static playEntrance() {
    const group = document.querySelector("[data-animate-cards]");
    if (!group) return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => group.classList.add("is-inview")),
    );
  }

  static async load() {
    const [, schoolYear] = await Promise.all([
      SettingsPrefs.load(),
      API.getActiveSchoolYear().catch(() => null),
    ]);

    this.set("#sysSchoolYear", schoolYear?.schoolYear || "—");
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
