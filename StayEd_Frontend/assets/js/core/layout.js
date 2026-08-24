class Layout {
  static init(options = {}) {
    this.options = {
      role: "teacher",

      page: "",

      title: "",

      breadcrumb: [],

      ...options,
    };

    this.cache();

    this.restoreUser();

    this.initializeSidebar();

    this.initializeNavbar();

    this.initializeFooter();

    this.initializeResponsiveSidebar();

    this.initializeLogout();

    this.highlightCurrentPage();

    this.initializeSubmenus();

    this.updateBreadcrumb();
  }

  static cache() {
    this.sidebar = document.querySelector(".st-sidebar");

    this.navbar = document.querySelector(".st-navbar");

    this.footer = document.querySelector(".st-footer");

    this.main = document.querySelector(".st-main");

    this.content = document.querySelector(".st-content");
  }

  static restoreUser() {
    const user = Utils.storage.get(
      "stayed_user",

      {},
    );

    const fullName =
      user.full_name ||
      [user.first_name, user.last_name]

        .filter(Boolean)

        .join(" ") ||
      "Teacher";

    document

      .querySelectorAll("[data-st-user-name]")

      .forEach((element) => {
        element.textContent = fullName;
      });

    document

      .querySelectorAll("[data-st-user-role]")

      .forEach((element) => {
        element.textContent = user.role || "ALS Teacher";
      });

    document

      .querySelectorAll("[data-st-user-avatar]")

      .forEach((image) => {
        if (user.avatar) {
          image.src = user.avatar;
        }
      });
  }

  static initializeSidebar() {
    if (!this.sidebar) {
      return;
    }

    const toggle = document.getElementById("sidebarToggle");

    if (!toggle) {
      return;
    }

    this.restoreSidebarCollapsedState();

    toggle.addEventListener(
      "click",

      () => {
        if (window.innerWidth > 992) {
          this.toggleSidebarCollapsed();
        } else {
          this.sidebar.classList.toggle("open");
        }
      },
    );
  }

  static SIDEBAR_COLLAPSED_KEY = "stayed_sidebar_collapsed";

  static toggleSidebarCollapsed() {
    const collapsed = this.sidebar.classList.toggle("is-collapsed");

    document
      .querySelector(".st-app")
      ?.classList.toggle("is-sidebar-collapsed", collapsed);

    document
      .getElementById("sidebarToggle")
      ?.setAttribute("aria-expanded", collapsed ? "false" : "true");

    try {
      localStorage.setItem(this.SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {}
  }

  static restoreSidebarCollapsedState() {
    let collapsed = false;

    try {
      collapsed = localStorage.getItem(this.SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      collapsed = false;
    }

    if (collapsed) {
      this.sidebar.classList.add("is-collapsed");

      document.querySelector(".st-app")?.classList.add("is-sidebar-collapsed");
    }

    document
      .getElementById("sidebarToggle")
      ?.setAttribute("aria-expanded", collapsed ? "false" : "true");
  }

  static initializeSubmenus() {
    document.querySelectorAll("[data-submenu]").forEach((submenu) => {
      const key = submenu.dataset.submenu;

      const trigger = submenu.querySelector("[data-submenu-trigger]");

      const hasActiveChild = Boolean(
        submenu.querySelector(".st-submenu-list a.active"),
      );

      const remembered = this.getSubmenuExpanded(key);

      const shouldExpand = hasActiveChild || remembered;

      if (shouldExpand) {
        submenu.classList.add("is-expanded");
      }

      trigger?.setAttribute("aria-expanded", shouldExpand ? "true" : "false");

      if (hasActiveChild) {
        trigger?.classList.add("has-active-child");
      }

      trigger?.addEventListener("click", () => {
        if (this.sidebar.classList.contains("is-collapsed")) {
          this.toggleSidebarCollapsed();

          submenu.classList.add("is-expanded");

          trigger.setAttribute("aria-expanded", "true");

          this.setSubmenuExpanded(key, true);

          return;
        }

        const expanded = submenu.classList.toggle("is-expanded");

        trigger.setAttribute("aria-expanded", expanded ? "true" : "false");

        this.setSubmenuExpanded(key, expanded);
      });
    });
  }

  static getSubmenuExpanded(key) {
    try {
      return localStorage.getItem(`stayed_submenu_${key}`) === "1";
    } catch {
      return false;
    }
  }

  static setSubmenuExpanded(key, expanded) {
    try {
      localStorage.setItem(`stayed_submenu_${key}`, expanded ? "1" : "0");
    } catch {}
  }

  static initializeNavbar() {
    this.updatePageTitle();

    this.initializeNotifications();

    this.initializeUserMenu();
  }

  static updatePageTitle() {
    const titleElements = document.querySelectorAll("[data-st-page-title]");

    titleElements.forEach((element) => {
      element.textContent = this.options.title || document.title || "StayEd";
    });

    if (this.options.title) {
      document.title = `StayEd | ${this.options.title}`;
    }
  }

  static initializeNotifications() {
    const button = document.querySelector("[data-st-notifications]");

    if (button) {
      button.addEventListener("click", () => {
        Router?.go("/notifications") ??
          (window.location.href = "notifications.html");
      });
    }

    const settingsButton = document.querySelector("[data-st-settings]");

    settingsButton?.addEventListener("click", () => {
      Router?.go("/settings") ?? (window.location.href = "settings.html");
    });

    // ITEM 3 FIX:
    // Refresh the bell as soon as the navbar is initialized.
    this.updateNotificationDot();
  }

  static async updateNotificationDot() {
    const dot = document.querySelector(
      "[data-st-notification-dot]",
    );

    if (!dot || !window.API?.getNotifications) {
      return;
    }

    try {
      const res = await API.getNotifications();

      const unreadCount = Array.isArray(res?.data)
        ? res.data.filter((n) => !n.read).length
        : Number(res?.unread || 0);

      dot.classList.toggle(
        "st-hidden",
        unreadCount <= 0,
      );

      dot.dataset.unreadCount = String(unreadCount);
    } catch (error) {
      console.error(
        "[Layout] Unable to refresh notification dot",
        error,
      );
    }
  }

  static initializeUserMenu() {
    const trigger = document.querySelector("[data-st-user-menu]");

    const menu = document.querySelector("[data-st-user-dropdown]");

    if (!trigger || !menu) {
      return;
    }

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();

      menu.classList.toggle("st-hidden");
    });

    document.addEventListener("click", () => {
      menu.classList.add("st-hidden");
    });
  }

  static highlightCurrentPage() {
    const current =
      this.options.page ||
      window.location.pathname

        .split("/")

        .pop();

    document

      .querySelectorAll(".st-sidebar a")

      .forEach((link) => {
        link.classList.remove("active");

        const href = link.getAttribute("href");

        if (!href) {
          return;
        }

        if (href.endsWith(current)) {
          link.classList.add("active");
        }
      });
  }

  static updateBreadcrumb() {
    const container = document.querySelector("[data-st-breadcrumb]");

    if (!container) {
      return;
    }

    const filename =
      this.options.page || window.location.pathname.split("/").pop();

    const sectionMatch = window.location.pathname.match(/\/pages\/([^/]+)\//);
    const sectionKey = sectionMatch ? `${sectionMatch[1]}/${filename}` : null;

    let items;

    if (this.options.breadcrumb.length) {
      items = this.options.breadcrumb.map((entry) =>
        typeof entry === "string" ? { label: entry } : entry,
      );
    } else if (window.Router) {
      items = Router.breadcrumbFor(filename, this.options.title, sectionKey);
    } else {
      items = [
        { label: "Dashboard", href: "dashboard.html" },
        { label: this.options.title || filename },
      ];
    }

    container.innerHTML = "";

    items.forEach((item, index) => {
      const isLast = index === items.length - 1;

      let node;

      if (!isLast && item.href) {
        node = document.createElement("a");

        node.href = item.href;

        node.className = "st-breadcrumb-link";
      } else {
        node = document.createElement("span");
      }

      node.textContent = item.label;

      if (isLast) {
        node.classList.add("active");
      }

      container.appendChild(node);

      if (!isLast) {
        const icon = document.createElement("span");

        icon.className = "material-symbols-outlined st-breadcrumb-icon";

        icon.textContent = "chevron_right";

        container.appendChild(icon);
      }
    });
  }

  static initializeFooter() {
    const year = document.querySelector("[data-st-year]");

    if (year) {
      year.textContent = new Date().getFullYear();
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

            try {
              if (window.API) {
                await API.post("/auth/logout");
              }
            } catch (error) {
              console.warn(error);
            }

            Utils.storage.remove("stayed_token");

            Utils.storage.remove("stayed_user");

            window.location.href = "../auth/login.html";
          },
        );
      });
  }

  static initializeResponsiveSidebar() {
    if (!this.sidebar) {
      return;
    }

    document.addEventListener(
      "click",

      (event) => {
        if (window.innerWidth > 992) {
          return;
        }

        const toggle = document.getElementById("sidebarToggle");

        const clickedSidebar = this.sidebar.contains(event.target);

        const clickedToggle = toggle ? toggle.contains(event.target) : false;

        if (!clickedSidebar && !clickedToggle) {
          this.closeSidebar();
        }
      },
    );

    document.addEventListener(
      "keydown",

      (event) => {
        if (event.key === "Escape") {
          this.closeSidebar();
        }
      },
    );

    window.addEventListener(
      "resize",

      Utils.debounce(
        () => {
          if (window.innerWidth > 992) {
            this.sidebar.classList.remove("open");
          }
        },

        150,
      ),
    );
  }

  static openSidebar() {
    if (!this.sidebar) {
      return;
    }

    this.sidebar.classList.add("open");
  }

  static closeSidebar() {
    if (!this.sidebar) {
      return;
    }

    this.sidebar.classList.remove("open");
  }

  static toggleSidebar() {
    if (!this.sidebar) {
      return;
    }

    this.sidebar.classList.toggle("open");
  }

  static showLoader() {
    const loader = document.querySelector("[data-st-loader]");

    if (loader) {
      loader.classList.remove("st-hidden");
    }
  }

  static hideLoader() {
    const loader = document.querySelector("[data-st-loader]");

    if (loader) {
      loader.classList.add("st-hidden");
    }
  }

  static success(message = "Success") {
    if (window.Toast && typeof Toast.success === "function") {
      Toast.success(message);

      return;
    }

    console.log(message);
  }

  static error(message = "Something went wrong.") {
    if (window.Toast && typeof Toast.error === "function") {
      Toast.error(message);

      return;
    }

    console.error(message);
  }

  static warning(message = "Warning") {
    if (window.Toast && typeof Toast.warning === "function") {
      Toast.warning(message);

      return;
    }

    console.warn(message);
  }

  static info(message = "Information") {
    if (window.Toast && typeof Toast.info === "function") {
      Toast.info(message);

      return;
    }

    console.info(message);
  }

  static beforePageLoad() {
    this.showLoader();
  }

  static afterPageLoad() {
    this.hideLoader();
  }
}

window.addEventListener(
  "error",

  (event) => {
    console.error(
      "[StayEd]",

      event.message,
    );
  },
);

window.addEventListener(
  "unhandledrejection",

  (event) => {
    console.error(
      "[StayEd Promise]",

      event.reason,
    );
  },
);

window.Layout = Layout;

function bootStayEdLayout() {
  Layout.beforePageLoad();

  Layout.init({
    page: window.location.pathname

      .split("/")

      .pop(),

    title: document.body.dataset.page || document.title,
  });

  Layout.afterPageLoad();
}

document.addEventListener(
  "DOMContentLoaded",

  () => {
    bootStayEdLayout();

    console.log(
      "%cStayEd Layout Ready",

      "color:#12355B;font-weight:bold;",
    );
  },
);

document.addEventListener(
  "components:loaded",

  () => {
    bootStayEdLayout();
  },
);
