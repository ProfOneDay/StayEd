// Shared System Settings behavior for both the teacher and admin pages:
// the [data-settings-toggle-pref] toggles (Notifications/Student portal)
// and the [data-font-size-slider] Accessibility control. Both pages'
// markup/CSS already come from the same shared, unscoped
// body[data-page="System Settings"] rules in system-settings.css -- this
// is the matching shared behavior layer, so admin's Notifications/
// Accessibility cards don't need their own separate copy of this logic.
// Each page's own system-settings.js still owns its page-specific fields
// (teacher: the read-only active school year; admin: the editable
// Academic Year / Module Return Default cards and their dialogs).
class SettingsPrefs {
  static FONT_SIZE_LABELS = {
    1: "Small",
    2: "Medium-Small",
    3: "Default",
    4: "Large",
    5: "Extra Large",
  };

  static preferences = {};

  // True once the user has touched the slider themselves -- guards against
  // the settings GET (fired in load()) resolving late and clobbering a
  // change the user already made while it was still in flight.
  static userAdjustedFontScale = false;

  // Bind listeners immediately so the slider (and toggles) respond right
  // away, instead of sitting inert until the settings GET in load() finishes.
  static bind() {
    this.bindToggles();
    this.bindFontSizeSlider();
  }

  static async load() {
    try {
      const settings = await API.getSettings();
      this.preferences = settings.preferences || {};
      this.applyToggles();
      this.applyFontSizeSlider();
    } catch (error) {
      console.error("[SettingsPrefs] Unable to load settings", error);
      Toast?.error("Unable to load your settings.");
    }
    return this.preferences;
  }

  // Reflects the saved font-size level into the slider UI + the live
  // document scale. Runs after load() (server value) and is also what the
  // inline <head> bootstrap snippet + core/app.js's reconcile step keep in
  // sync with localStorage on every other page.
  static applyFontSizeSlider() {
    if (this.userAdjustedFontScale) return;

    const slider = document.querySelector("[data-font-size-slider]");
    if (!slider) return;

    const level = String(this.preferences.fontScale || "3");
    slider.value = level;
    this.setFontScale(level, { persist: false });
  }

  static setFontScale(level, { persist } = { persist: true }) {
    document.documentElement.setAttribute("data-font-scale", level);

    const label = document.querySelector("[data-font-size-label]");
    if (label) label.textContent = this.FONT_SIZE_LABELS[level] || "Default";

    const slider = document.querySelector("[data-font-size-slider]");
    if (slider) {
      slider.style.setProperty("--p", `${((level - 1) / 4) * 100}%`);
    }

    try {
      localStorage.setItem("stayed_font_scale", level);
    } catch (e) {}

    if (!persist) return;

    API.updateSettings({ fontScale: level })
      .then((result) => {
        this.preferences = result.preferences || this.preferences;
      })
      .catch((error) => {
        console.error("[SettingsPrefs] Unable to save font size", error);
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
    document.querySelectorAll("[data-settings-toggle-pref]").forEach((toggle) => {
      toggle.addEventListener("change", async () => {
        const key = toggle.dataset.settingsTogglePref;

        try {
          const result = await API.updateSettings({ [key]: toggle.checked });
          this.preferences = result.preferences || this.preferences;
          Toast?.success("Preference updated.");
        } catch (error) {
          console.error("[SettingsPrefs] Unable to save preference", error);
          Toast?.error("Unable to save this preference.");
          toggle.checked = !toggle.checked;
        }
      });
    });
  }
}

window.SettingsPrefs = SettingsPrefs;
