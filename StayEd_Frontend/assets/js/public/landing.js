const Landing = {
  init() {
    if (window.Auth && Auth.validateSession()) {
      Auth.redirectAfterLogin();
      return;
    }

    this.heroStage = document.querySelector("[data-hero-stage]");
    this.mobilePanel = document.querySelector("[data-mobile-panel]");
    this.menuToggle = document.querySelector("[data-menu-toggle]");
    this.nav = document.querySelector("[data-landing-nav]");
    this.introEl = document.querySelector("[data-hero-intro]");
    this.loginPanel = document.querySelector(".st-landing-login-panel");

    this.bindLoginStage();
    this.bindMobileMenu();
    this.bindNavScrollLinks();
    this.bindNavShadow();
    this.syncLoginPanelHeight();
    window.addEventListener("resize", () => this.syncLoginPanelHeight());

    // Web fonts finish loading after first paint and reflow the intro
    // text (different metrics than the fallback font), which changes its
    // height -- resync once that settles so the panel isn't sized off a
    // stale measurement.
    document.fonts?.ready?.then(() => this.syncLoginPanelHeight());
  },

  // The login panel should sit centered in the hero with equal top/bottom
  // margins, matching how far the hero's own padding already pushes the
  // intro text down from the nav -- not sized off the intro text itself
  // (the hero's height is fixed independently of either one, so pegging
  // the panel to intro's height just made it look small and lopsided).
  // CSS percentage heights on a grid item in an auto-sized row can't
  // express this reliably (the row can't resolve a % height without
  // first knowing its own size -- a circular dependency), so this reads
  // the hero's real height/padding and sets the panel's height inline.
  syncLoginPanelHeight() {
    if (!this.introEl || !this.loginPanel) return;
    const hero = this.introEl.closest(".st-landing-hero");
    if (!hero) return;
    const heroHeight = hero.getBoundingClientRect().height;
    const margin = parseFloat(getComputedStyle(hero).paddingTop) || 0;
    // The nav overlays the hero's own top edge (it's sticky, the hero
    // renders full-bleed behind it), so the space that's actually
    // *visible* above the panel is padding-top minus the nav's height --
    // add that back so the visible gap below matches the visible gap
    // above, not just the two CSS-box margins in the abstract. Measuring
    // .st-landing-nav-inner specifically (not the whole <header>, which
    // also contains the mobile hamburger panel) matters here: this runs
    // right after closing that panel, and its 300ms collapse transition
    // hasn't settled yet, so the header's own rect briefly still
    // includes its expanded height. The inner bar is a fixed 72px
    // regardless, so it sidesteps that race entirely.
    const navHeight =
      document.querySelector(".st-landing-nav-inner")?.getBoundingClientRect()
        .height || 0;
    // Extra breathing room on top of the bare minimum -- otherwise the
    // visible gap (padding-top minus the nav's overlay height) comes out
    // to ~12px, which reads as "no space" rather than an intentional
    // margin. Mobile uses a bigger value so the panel's top lands at the
    // same visible depth as the mobile hero-intro's text -- keep this in
    // sync with .st-landing-hero-login's own mobile margin-top override.
    const extraBreathingRoom = window.innerWidth >= 768 ? 30 : 93;
    // Desktop only: trims 20px off the bottom without moving the top --
    // a flat subtraction here (rather than adding it into
    // extraBreathingRoom, which affects both margins symmetrically)
    // shortens the panel while leaving its top position untouched.
    const desktopBottomTrim = window.innerWidth >= 768 ? 20 : 0;
    const panelHeight =
      heroHeight - (margin + extraBreathingRoom) * 2 + navHeight - desktopBottomTrim;
    if (panelHeight > 0) {
      this.loginPanel.style.height = `${Math.max(panelHeight, 200)}px`;
    }
  },

  bindLoginStage() {
    if (!this.heroStage) return;

    document.querySelectorAll("[data-open-login]").forEach((btn) => {
      btn.addEventListener("click", () => this.openLogin());
    });

    document.querySelectorAll("[data-close-login]").forEach((el) => {
      el.addEventListener("click", () => this.closeLogin());
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.heroStage.classList.contains("is-login")) {
        this.closeLogin();
      }
    });
  },

  openLogin() {
    const wasMobileMenuOpen = this.mobilePanel?.classList.contains("is-open");
    this.closeMobileMenu();
    this.heroStage.classList.add("is-login");
    // Re-measure right before showing the panel -- the load-time syncs
    // can catch the hero mid-reflow (e.g. text still wrapping in a
    // fallback font before web fonts finish loading), so this guarantees
    // a fresh, correct measurement at the moment it's actually needed.
    this.syncLoginPanelHeight();

    // Scrolling has to wait until the mobile menu's 300ms collapse
    // transition has settled -- it keeps shifting layout each frame, so
    // scrolling too early computes the target against a layout that's
    // still moving and overshoots.
    const hero = this.heroStage.closest(".st-landing-hero");
    const scrollDelay = wasMobileMenuOpen ? 320 : 0;
    setTimeout(() => {
      if (hero) hero.scrollIntoView({ behavior: "smooth", block: "start" });
    }, scrollDelay);

    const email = this.heroStage.querySelector("#email");
    if (email) setTimeout(() => email.focus(), 350);
  },

  closeLogin() {
    this.heroStage.classList.remove("is-login");
  },

  bindMobileMenu() {
    if (!this.menuToggle || !this.mobilePanel) return;

    this.menuToggle.addEventListener("click", () => {
      const open = this.mobilePanel.classList.toggle("is-open");
      this.menuToggle.setAttribute("aria-expanded", String(open));
      this.menuToggle.querySelector(".material-symbols-outlined").textContent =
        open ? "close" : "menu";
    });

    this.mobilePanel.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => this.closeMobileMenu());
    });
  },

  closeMobileMenu() {
    if (!this.mobilePanel || !this.menuToggle) return;
    this.mobilePanel.classList.remove("is-open");
    this.menuToggle.setAttribute("aria-expanded", "false");
    this.menuToggle.querySelector(".material-symbols-outlined").textContent =
      "menu";
  },

  bindNavScrollLinks() {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        const id = link.getAttribute("href").slice(1);
        const target = id ? document.getElementById(id) : null;

        if (!target) return;

        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  },

  bindNavShadow() {
    if (!this.nav) return;

    const toggle = () => {
      this.nav.classList.toggle("is-scrolled", window.scrollY > 8);
    };

    toggle();
    window.addEventListener("scroll", toggle, { passive: true });
  },
};

document.addEventListener("DOMContentLoaded", () => {
  Landing.init();
});
