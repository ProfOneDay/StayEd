class SystemSettingsPage {
  static preferences = {};

  static FONT_SIZE_LABELS = {
    1: "Small",
    2: "Medium-Small",
    3: "Default",
    4: "Large",
    5: "Extra Large",
  };

  // True once the user has touched the slider themselves -- guards against
  // the settings GET (fired in load()) resolving late and clobbering a
  // change the user already made while it was still in flight.
  static userAdjustedFontScale = false;

  static async init() {
    if (window.Guards) Guards.teacher();

    // Bind listeners immediately so the slider (and toggles) respond right
    // away, instead of sitting inert until the settings GET below finishes.
    this.bindToggles();
    this.bindFontSizeSlider();

    await this.load();
  }

  static async load() {
    try {
      const [settings, schoolYear] = await Promise.all([
        API.getSettings(),
        API.getActiveSchoolYear().catch(() => null),
      ]);

      this.preferences = settings.preferences || {};

      this.applyToggles();
      this.applyFontSizeSlider();

      this.set("#sysSchoolYear", schoolYear?.schoolYear || "—");
    } catch (error) {
      console.error("[SystemSettings] Unable to load settings", error);
      Toast?.error("Unable to load your settings.");
    }
  }

  // Reflects the saved font-size level into the slider UI + the live
  // document scale. Runs after load() (server value) and is also what the
  // inline <head> bootstrap snippet + core/app.js's reconcile step keep in
  // sync with localStorage on every other page.
  static applyFontSizeSlider() {
    // The user may have already dragged the slider while this (or the
    // load() GET behind it) was still in flight -- don't stomp on that.
    if (this.userAdjustedFontScale) return;

    const slider = document.querySelector("[data-font-size-slider]");
    if (!slider) return;

    const level = String(this.preferences.fontScale || "3");
    slider.value = level;
    this.setFontScale(level, { persist: false });
  }

  static setFontScale(level, { persist } = { persist: true }) {
    document.documentElement.setAttribute("data-font-scale", level);
    this.set("[data-font-size-label]", this.FONT_SIZE_LABELS[level] || "Default");

    try {
      localStorage.setItem("stayed_font_scale", level);
    } catch (e) {}

    if (!persist) return;

    API.updateSettings({ fontScale: level })
      .then((result) => {
        this.preferences = result.preferences || this.preferences;
      })
      .catch((error) => {
        console.error("[SystemSettings] Unable to save font size", error);
        Toast?.error("Unable to save this preference.");
      });
  }

  static bindFontSizeSlider() {
    const slider = document.querySelector("[data-font-size-slider]");
    if (!slider) return;

    // Live preview while dragging -- no network call until the user
    // actually settles on a value (change), so dragging through 1-2-3-4-5
    // doesn't fire five separate save requests.
    slider.addEventListener("input", () => {
      this.userAdjustedFontScale = true;
      this.setFontScale(slider.value, { persist: false });
    });

    slider.addEventListener("change", () => {
      this.userAdjustedFontScale = true;
      this.setFontScale(slider.value, { persist: true });
      Toast?.success("Font size updated.");
    });
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
