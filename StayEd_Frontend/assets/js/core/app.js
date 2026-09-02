class App {
  static init() {
    console.log(
      "%cStayEd Initialized",

      "color:#12355B;font-weight:bold;",
    );

    this.restoreUser();

    this.initializePage();

    this.initializeLogout();

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

  static restoreUser() {
    if (!window.Auth) {
      return;
    }

    const user = Auth.user();

    if (!user) {
      return;
    }

    document

      .querySelectorAll("[data-st-user-name]")

      .forEach((element) => {
        element.textContent =
          user.full_name ||
          [user.first_name, user.last_name]

            .filter(Boolean)

            .join(" ");
      });

    document

      .querySelectorAll("[data-st-user-role]")

      .forEach((element) => {
        element.textContent = user.role || "";
      });

    document

      .querySelectorAll("[data-st-user-email]")

      .forEach((element) => {
        element.textContent = user.email || "";
      });

    document

      .querySelectorAll("[data-st-user-avatar]")

      .forEach((image) => {
        if (user.avatar) {
          image.src = user.avatar;
        }
      });
  }

  static initializePage() {
    const body = document.body;

    const title = body.dataset.page;

    if (title && window.Layout) {
      Layout.updatePageTitle();
    }
  }

  static initializeLogout() {
    document

      .querySelectorAll("[data-st-logout]")

      .forEach((button) => {
        button.addEventListener(
          "click",

          async (event) => {
            event.preventDefault();

            await Auth.logout();
          },
        );
      });
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
