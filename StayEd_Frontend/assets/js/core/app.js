class App {
  static init() {
    console.log(
      "%cStayEd Initialized",

      "color:#12355B;font-weight:bold;",
    );

    // restoreUser(), page-title-setting, and logout binding used to live
    // here too, duplicating Layout.restoreUser()/updatePageTitle()/
    // initializeLogout() (layout.js) on every page that loads both
    // scripts -- stacking two logout click listeners (two API calls, two
    // redirects per click) and doing the user-info restore work twice.
    // reconcileFontScale() is the only job actually unique to App.
    this.reconcileFontScale();
  }

  // The inline <head> bootstrap snippet already applied the last-known
  // font-scale level from localStorage before first paint (flash-free).
  // Here we double-check that against the authoritative server value --
  // it may have changed on another device -- and correct both the DOM
  // attribute and localStorage if they differ. Wrapped defensively so a
  // logged-out page (no Auth/API) or a failed request never breaks load.
  static async reconcileFontScale() {
    if (!window.Auth || !Auth.authenticated() || !window.API) {
      return;
    }

    try {
      const settings = await API.getSettings();

      const serverLevel = String(settings?.preferences?.fontScale || "3");

      const currentLevel =
        document.documentElement.getAttribute("data-font-scale") || "3";

      if (serverLevel !== currentLevel) {
        document.documentElement.setAttribute("data-font-scale", serverLevel);

        try {
          localStorage.setItem("stayed_font_scale", serverLevel);
        } catch (e) {}
      }
    } catch (error) {
      console.warn("[App] Unable to reconcile font size preference", error);
    }
  }

  static ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",

        callback,
      );
    } else {
      callback();
    }
  }
}

window.App = App;

App.ready(() => {
  App.init();
});
