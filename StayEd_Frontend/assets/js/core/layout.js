/**
 * ============================================
 * StayEd
 * Global Layout
 * ============================================
 */

class Layout {

    static init(options = {}) {

        this.options = {

            role: "teacher",

            page: "",

            title: "",

            breadcrumb: [],

            ...options

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

    /* =======================================
       CACHE DOM
    ======================================= */

    static cache() {

        this.sidebar = document.querySelector(".st-sidebar");

        this.navbar = document.querySelector(".st-navbar");

        this.footer = document.querySelector(".st-footer");

        this.main = document.querySelector(".st-main");

        this.content = document.querySelector(".st-content");

    }

    /* =======================================
       USER
    ======================================= */

    static restoreUser() {

        const user = Utils.storage.get(

            "stayed_user",

            {}

        );

        const fullName =

            user.full_name ||

            [

                user.first_name,

                user.last_name

            ]

            .filter(Boolean)

            .join(" ")

            ||

            "Teacher";

        document

            .querySelectorAll(

                "[data-st-user-name]"

            )

            .forEach(element => {

                element.textContent = fullName;

            });

        document

            .querySelectorAll(

                "[data-st-user-role]"

            )

            .forEach(element => {

                element.textContent =

                    user.role ||

                    "ALS Teacher";

            });

        document

            .querySelectorAll(

                "[data-st-user-avatar]"

            )

            .forEach(image => {

                if (

                    user.avatar

                ) {

                    image.src =

                        user.avatar;

                }

            });

    }

    /* =======================================
       SIDEBAR
    ======================================= */

    static initializeSidebar() {

        if (!this.sidebar) {

            return;

        }

        const toggle =

            document.getElementById(

                "sidebarToggle"

            );

        if (!toggle) {

            return;

        }

        /* Restore the persisted collapse state (desktop
           icon-only mode) before wiring the click handler,
           so navigating between pages keeps it consistent. */
        this.restoreSidebarCollapsedState();

        toggle.addEventListener(

            "click",

            () => {

                if (window.innerWidth > 992) {

                    this.toggleSidebarCollapsed();

                } else {

                    this.sidebar.classList.toggle(

                        "open"

                    );

                }

            }

        );

    }

    /* =======================================
       SIDEBAR COLLAPSE (desktop icon-only mode)
    ======================================= */

    static SIDEBAR_COLLAPSED_KEY = "stayed_sidebar_collapsed";

    static toggleSidebarCollapsed() {

        const collapsed =
            this.sidebar.classList.toggle("is-collapsed");

        document.querySelector(".st-app")
            ?.classList.toggle("is-sidebar-collapsed", collapsed);

        document.getElementById("sidebarToggle")
            ?.setAttribute("aria-expanded", collapsed ? "false" : "true");

        try {

            localStorage.setItem(
                this.SIDEBAR_COLLAPSED_KEY,
                collapsed ? "1" : "0"
            );

        } catch {

            /* localStorage unavailable — state still
               applies for the current page view. */

        }

    }

    static restoreSidebarCollapsedState() {

        let collapsed = false;

        try {

            collapsed =
                localStorage.getItem(this.SIDEBAR_COLLAPSED_KEY) === "1";

        } catch {

            collapsed = false;

        }

        if (collapsed) {

            this.sidebar.classList.add("is-collapsed");

            document.querySelector(".st-app")
                ?.classList.add("is-sidebar-collapsed");

        }

        document.getElementById("sidebarToggle")
            ?.setAttribute("aria-expanded", collapsed ? "false" : "true");

    }

    /* =======================================
       SIDEBAR SUBMENUS (e.g. "Learner")
       Expand/collapse, remembers state across
       navigation, auto-expands when a child
       page is active.
    ======================================= */

    static initializeSubmenus() {

        document.querySelectorAll("[data-submenu]").forEach(submenu => {

            const key = submenu.dataset.submenu;

            const trigger = submenu.querySelector("[data-submenu-trigger]");

            const hasActiveChild =
                Boolean(submenu.querySelector(".st-submenu-list a.active"));

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

                /*
                 * If the sidebar is in icon-only (collapsed)
                 * mode, a click on the Learner icon should
                 * first expand the sidebar back to its full
                 * width so the submenu labels are visible,
                 * then open the submenu — rather than
                 * silently expanding a submenu nobody can see.
                 */

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

            localStorage.setItem(
                `stayed_submenu_${key}`,
                expanded ? "1" : "0"
            );

        } catch {

            /* ignore */

        }

    }

    /* =======================================
       NAVBAR
    ======================================= */

    static initializeNavbar() {

        this.updatePageTitle();

        this.initializeNotifications();

        this.initializeUserMenu();

    }

    static updatePageTitle() {

        const titleElements = document.querySelectorAll(

            "[data-st-page-title]"

        );

        titleElements.forEach(element => {

            element.textContent =

                this.options.title ||

                document.title ||

                "StayEd";

        });

        if (this.options.title) {

            document.title = `StayEd | ${this.options.title}`;

        }

    }

    static initializeNotifications() {

        const button = document.querySelector(

            "[data-st-notifications]"

        );

        if (button) {

            button.addEventListener("click", () => {

                Router?.go("/notifications") ??
                    (window.location.href = "notifications.html");

            });

        }

        const settingsButton = document.querySelector(

            "[data-st-settings]"

        );

        settingsButton?.addEventListener("click", () => {

            Router?.go("/settings") ??
                (window.location.href = "settings.html");

        });

    }

    static initializeUserMenu() {

        const trigger = document.querySelector(

            "[data-st-user-menu]"

        );

        const menu = document.querySelector(

            "[data-st-user-dropdown]"

        );

        if (!trigger || !menu) {

            return;

        }

        trigger.addEventListener("click", event => {

            event.stopPropagation();

            menu.classList.toggle("st-hidden");

        });

        document.addEventListener("click", () => {

            menu.classList.add("st-hidden");

        });

    }

    /* =======================================
       SIDEBAR ACTIVE LINK
    ======================================= */

    static highlightCurrentPage() {

        const current =

            this.options.page ||

            window.location.pathname

                .split("/")

                .pop();

        document

            .querySelectorAll(

                ".st-sidebar a"

            )

            .forEach(link => {

                link.classList.remove(

                    "active"

                );

                const href =

                    link.getAttribute("href");

                if (!href) {

                    return;

                }

                if (

                    href.endsWith(current)

                ) {

                    link.classList.add(

                        "active"

                    );

                }

            });

    }

    /* =======================================
       BREADCRUMB
    ======================================= */

    static updateBreadcrumb() {

        const container = document.querySelector(

            "[data-st-breadcrumb]"

        );

        if (!container) {

            return;

        }

        /*
         * Two supported inputs, in priority order:
         *   1. this.options.breadcrumb — explicit override,
         *      an array of strings or {label, href} objects,
         *      for pages that need a custom trail (e.g. a
         *      learner's name as the final crumb).
         *   2. Router.BREADCRUMBS — automatic, centralised
         *      trail looked up by the current filename.
         */

        const filename =
            this.options.page ||
            window.location.pathname.split("/").pop();

        let items;

        if (this.options.breadcrumb.length) {

            items = this.options.breadcrumb.map(entry =>
                typeof entry === "string"
                    ? { label: entry }
                    : entry
            );

        } else if (window.Router) {

            items = Router.breadcrumbFor(filename, this.options.title);

        } else {

            items = [
                { label: "Dashboard", href: "dashboard.html" },
                { label: this.options.title || filename }
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

                icon.className =
                    "material-symbols-outlined st-breadcrumb-icon";

                icon.textContent = "chevron_right";

                container.appendChild(icon);

            }

        });

    }

    /* =======================================
       FOOTER
    ======================================= */

    static initializeFooter() {

        const year = document.querySelector(

            "[data-st-year]"

        );

        if (year) {

            year.textContent =

                new Date().getFullYear();

        }

    }

    /* =======================================
       LOGOUT
    ======================================= */

    static initializeLogout() {

        document

            .querySelectorAll(

                "[data-st-logout]"

            )

            .forEach(button => {

                button.addEventListener(

                    "click",

                    async event => {

                        event.preventDefault();

                        try {

                            if (

                                window.API

                            ) {

                                await API.post(

                                    "/auth/logout"

                                );

                            }

                        }

                        catch(error){

                            console.warn(error);

                        }

                        Utils.storage.remove(

                            "stayed_token"

                        );

                        Utils.storage.remove(

                            "stayed_user"

                        );

                        window.location.href =

                            "../auth/login.html";

                    }

                );

            });

    }

    /* =======================================
       RESPONSIVE SIDEBAR
    ======================================= */

    static initializeResponsiveSidebar() {

        if (!this.sidebar) {

            return;

        }

        document.addEventListener(

            "click",

            event => {

                if (

                    window.innerWidth > 992

                ) {

                    return;

                }

                const toggle =

                    document.getElementById(

                        "sidebarToggle"

                    );

                const clickedSidebar =

                    this.sidebar.contains(

                        event.target

                    );

                const clickedToggle =

                    toggle

                        ? toggle.contains(

                            event.target

                        )

                        : false;

                if (

                    !clickedSidebar &&

                    !clickedToggle

                ) {

                    this.closeSidebar();

                }

            }

        );

        document.addEventListener(

            "keydown",

            event => {

                if (

                    event.key === "Escape"

                ) {

                    this.closeSidebar();

                }

            }

        );

        window.addEventListener(

            "resize",

            Utils.debounce(

                () => {

                    if (

                        window.innerWidth >

                        992

                    ) {

                        this.sidebar.classList.remove(

                            "open"

                        );

                    }

                },

                150

            )

        );

    }

    /* =======================================
       SIDEBAR METHODS
    ======================================= */

    static openSidebar() {

        if (!this.sidebar) {

            return;

        }

        this.sidebar.classList.add(

            "open"

        );

    }

    static closeSidebar() {

        if (!this.sidebar) {

            return;

        }

        this.sidebar.classList.remove(

            "open"

        );

    }

    static toggleSidebar() {

        if (!this.sidebar) {

            return;

        }

        this.sidebar.classList.toggle(

            "open"

        );

    }

    /* =======================================
       PAGE LOADER
    ======================================= */

    static showLoader() {

        const loader = document.querySelector(

            "[data-st-loader]"

        );

        if (loader) {

            loader.classList.remove("st-hidden");

        }

    }

    static hideLoader() {

        const loader = document.querySelector(

            "[data-st-loader]"

        );

        if (loader) {

            loader.classList.add("st-hidden");

        }

    }

    /* =======================================
       TOAST HELPERS
    ======================================= */

    static success(message = "Success") {

        if (

            window.Toast &&

            typeof Toast.success === "function"

        ) {

            Toast.success(message);

            return;

        }

        console.log(message);

    }

    static error(message = "Something went wrong.") {

        if (

            window.Toast &&

            typeof Toast.error === "function"

        ) {

            Toast.error(message);

            return;

        }

        console.error(message);

    }

    static warning(message = "Warning") {

        if (

            window.Toast &&

            typeof Toast.warning === "function"

        ) {

            Toast.warning(message);

            return;

        }

        console.warn(message);

    }

    static info(message = "Information") {

        if (

            window.Toast &&

            typeof Toast.info === "function"

        ) {

            Toast.info(message);

            return;

        }

        console.info(message);

    }

    /* =======================================
       PAGE HOOKS
    ======================================= */

    static beforePageLoad() {

        this.showLoader();

    }

    static afterPageLoad() {

        this.hideLoader();

    }

}

/* ==========================================
   GLOBAL ERROR HANDLER
========================================== */

window.addEventListener(

    "error",

    event => {

        console.error(

            "[StayEd]",

            event.message

        );

    }

);

window.addEventListener(

    "unhandledrejection",

    event => {

        console.error(

            "[StayEd Promise]",

            event.reason

        );

    }

);

/* ==========================================
   EXPORT
========================================== */

window.Layout = Layout;

/* ==========================================
   AUTO INITIALIZATION
========================================== */

function bootStayEdLayout() {

    Layout.beforePageLoad();

    Layout.init({

        page:

            window.location.pathname

                .split("/")

                .pop(),

        title:

            document.body.dataset.page ||

            document.title

    });

    Layout.afterPageLoad();

}

document.addEventListener(

    "DOMContentLoaded",

    () => {

        bootStayEdLayout();

        console.log(

            "%cStayEd Layout Ready",

            "color:#12355B;font-weight:bold;"

        );

    }

);

/*
 * Re-run once async partials (sidebar, navbar, footer)
 * are in the DOM so user info, active nav, breadcrumb and
 * logout binding attach to the injected markup.
 */

document.addEventListener(

    "components:loaded",

    () => {

        bootStayEdLayout();

    }

);