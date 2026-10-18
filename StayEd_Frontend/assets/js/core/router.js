class Router {
  static ROUTES = {
    // "/login" is handled separately in resolve() -- it now points at the
    // root landing page's in-hero login panel, not this standalone page.
    "/register": "auth/register.html",
    "/forgot-password": "auth/forgot-password.html",
    "/reset-password": "auth/reset-password.html",
    "/pending": "auth/pending.html",

    "/setup": "setup/setup-wizard-1.html",
    "/setup/wizard-1": "setup/setup-wizard-1.html",
    "/setup/wizard-2": "setup/setup-wizard-2.html",
    "/setup/wizard-3": "setup/setup-wizard-3.html",
    "/setup/wizard-4": "setup/setup-wizard-4.html",
    "/setup/wizard-5": "setup/setup-wizard-5.html",

    "/dashboard": "teacher/dashboard.html",
    "/calendar": "teacher/calendar.html",
    "/learner-records": "teacher/learner-records.html",
    "/notifications": "teacher/notifications.html",
    "/admin/notifications": "admin/notifications.html",
    "/settings": "teacher/settings.html",
    "/admin/settings": "admin/settings.html",
    "/profile": "teacher/profile.html",
    "/admin/profile": "admin/profile.html",
    "/admin/dashboard": "admin/dashboard.html",
  };

  static BREADCRUMBS = {
    "dashboard.html": [{ label: "Dashboard" }],

    "calendar.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "Calendar" },
    ],

    "clc-overview.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "CLC Overview" },
    ],
    "clc-details.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "CLC Overview", href: "clc-overview.html" },
      { label: "Add New CLC" },
    ],
    "clc-upload.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "CLC Overview", href: "clc-overview.html" },
      { label: "Add New CLC", href: "clc-details.html" },
      { label: "Upload Records" },
    ],

    "class-management.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "CLC Overview", href: "clc-overview.html" },
      { label: "Class Management" },
    ],
    // Learner Records and everything reached from it sit under CLC Overview
    // in the sidebar (CLC Overview -> Class Management -> a class), so the
    // trail follows that same path. Every crumb except the last is a link.
    "learner-records.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "CLC Overview", href: "clc-overview.html" },
      { label: "Class Management", href: "class-management.html" },
      { label: "Learner Records" },
    ],
    "module-management.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "CLC Overview", href: "clc-overview.html" },
      { label: "Class Management", href: "class-management.html" },
      { label: "Learner Records", href: "learner-records.html", preserveQuery: true },
      { label: "Manage Modules" },
    ],
    "assessment-scores.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "CLC Overview", href: "clc-overview.html" },
      { label: "Class Management", href: "class-management.html" },
      { label: "Learner Records", href: "learner-records.html", preserveQuery: true },
      { label: "Assessment Scores" },
    ],
    "learner-import.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "CLC Overview", href: "clc-overview.html" },
      { label: "Class Management", href: "class-management.html" },
      { label: "Learner Records", href: "learner-records.html", preserveQuery: true },
      { label: "Import Students" },
    ],
    "learner-enroll.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "CLC Overview", href: "clc-overview.html" },
      { label: "Class Management", href: "class-management.html" },
      { label: "Learner Records", href: "learner-records.html", preserveQuery: true },
      { label: "Enroll Student" },
    ],
    "student-registry.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "Student Registry" },
    ],
    // Default trail only -- Learner Profile is opened from many pages, so
    // breadcrumbFor() swaps in the page the teacher actually came from
    // (see ORIGIN_PARENTS).
    "learner-profile.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "Student Registry", href: "student-registry.html" },
      { label: "Learner Profile" },
    ],

    "early-warning.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "Early Warnings" },
    ],

    "reports.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "Reports" },
    ],

    "notifications.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "Notifications" },
    ],

    "settings.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "System Settings" },
    ],

    "profile.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "Profile Settings" },
    ],
    "help.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "Help & User Manual" },
    ],
    "about.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "About StayEd" },
    ],

    "admin/dashboard.html": [{ label: "Dashboard" }],
    "admin/notifications.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "Notifications" },
    ],
    "admin/reports.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "Reports" },
    ],
    "admin/user-management.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "User Management" },
    ],
    "admin/clc-management.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "CLC Management" },
    ],
    "admin/settings.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "System Settings" },
    ],
    "admin/manage-admins.html": [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "Manage Admins" },
    ],
  };

  // Teacher pages reachable from several places: their trail follows the
  // page the teacher actually came from (if it's one of these), instead of
  // always claiming one fixed parent. Anything else falls back to the
  // default trail in BREADCRUMBS.
  static ORIGIN_PARENTS = {
    "learner-profile.html": [
      "dashboard.html", "student-registry.html", "early-warning.html",
      "learner-records.html", "notifications.html", "calendar.html", "reports.html",
    ],
    "assessment-scores.html": ["learner-records.html", "learner-profile.html"],
  };

  static ORIGIN_KEY = "stayed_breadcrumb_origin:";

  // The parent page (filename + query) this page was opened from: the
  // referrer when it's an allowed parent, otherwise whatever was remembered
  // for this page earlier in the tab (so a refresh, or coming back from a
  // child page, keeps the same trail).
  static originFor(filename) {
    const allowed = this.ORIGIN_PARENTS[filename];
    if (!allowed) return null;

    let fromReferrer = null;
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      if (ref && ref.origin === window.location.origin && ref.pathname !== window.location.pathname) {
        const refFile = ref.pathname.split("/").pop();
        if (allowed.includes(refFile)) fromReferrer = { file: refFile, href: refFile + ref.search };
      }
    } catch {
      fromReferrer = null;
    }

    const key = this.ORIGIN_KEY + filename;
    try {
      if (fromReferrer) {
        sessionStorage.setItem(key, JSON.stringify(fromReferrer));
        return fromReferrer;
      }
      const saved = JSON.parse(sessionStorage.getItem(key) || "null");
      return saved && allowed.includes(saved.file) ? saved : null;
    } catch {
      return fromReferrer;
    }
  }

  static breadcrumbFor(filename, fallbackTitle, sectionKey, depth = 0) {
    const origin = depth < 3 ? this.originFor(filename) : null;
    if (origin) {
      const own = this.BREADCRUMBS[filename];
      const ownLabel = own ? own[own.length - 1].label : fallbackTitle || filename;
      const parentTrail = this.breadcrumbFor(origin.file, origin.file, null, depth + 1);
      // The parent's own last crumb becomes a link back to the exact page
      // (with its ?class= / ?id= query) the teacher came from.
      parentTrail[parentTrail.length - 1] = {
        ...parentTrail[parentTrail.length - 1],
        href: origin.href,
        preserveQuery: false,
      };
      return [...parentTrail, { label: ownLabel }];
    }

    if (sectionKey && this.BREADCRUMBS[sectionKey]) {
      return this.BREADCRUMBS[sectionKey].map((c) => ({ ...c }));
    }

    if (this.BREADCRUMBS[filename]) {
      return this.BREADCRUMBS[filename].map((c) => ({ ...c }));
    }

    return [
      { label: "Dashboard", href: "dashboard.html" },
      { label: fallbackTitle || filename },
    ];
  }

  static resolve(route) {
    if (route === "/login") {
      return "/index.html";
    }

    const currentRole = window.Auth?.role ? Auth.role() : "teacher";

    if (route === "/notifications" && currentRole === "admin") {
      return this.toPagesRelative("admin/notifications.html");
    }

    if (route === "/settings" && currentRole === "admin") {
      return this.toPagesRelative("admin/settings.html");
    }

    if (route === "/profile" && currentRole === "admin") {
      return this.toPagesRelative("admin/profile.html");
    }

    if (route === "/dashboard" && currentRole === "admin") {
      return this.toPagesRelative("admin/dashboard.html");
    }

    const target = this.ROUTES[route];

    if (!target) {
      console.warn(`[Router] Unknown route: ${route}`);

      return null;
    }

    return this.toPagesRelative(target);
  }

  static toPagesRelative(target) {
    const path = window.location.pathname;

    const match = path.match(/\/pages\/[^/]+\//);

    if (match) {
      return `../${target}`;
    }

    return `pages/${target}`;
  }

  static go(route) {
    const url = this.resolve(route);

    if (url) {
      window.location.href = url;
    }
  }

  static replace(route) {
    const url = this.resolve(route);

    if (url) {
      window.location.replace(url);
    }
  }

  static current() {
    return window.location.pathname.split("/").pop();
  }
}

window.Router = Router;
