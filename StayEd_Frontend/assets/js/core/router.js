/**
 * ============================================
 * StayEd
 * Client Router
 * ============================================
 *
 * Maps logical application routes to physical
 * page files. Pages live under /pages/<area>/,
 * so navigation is centralised here — page code
 * never hard-codes relative "../" paths.
 *
 * When the app later moves to a real backend or
 * SPA history API, only this module changes.
 * ============================================
 */

class Router {

    /*
     * Logical route -> path relative to the /pages
     * directory. The leading segment is the folder.
     */
    static ROUTES = {

        "/login":            "auth/login.html",
        "/register":         "auth/register.html",
        "/forgot-password":  "auth/forgot-password.html",
        "/reset-password":   "auth/reset-password.html",
        "/pending":          "auth/pending.html",

        "/setup":            "setup/setup-wizard-1.html",
        "/setup/wizard-1":   "setup/setup-wizard-1.html",
        "/setup/wizard-2":   "setup/setup-wizard-2.html",
        "/setup/wizard-3":   "setup/setup-wizard-3.html",
        "/setup/wizard-4":   "setup/setup-wizard-4.html",
        "/setup/wizard-5":   "setup/setup-wizard-5.html",

        "/dashboard":        "teacher/dashboard.html",
        "/learner-records":  "teacher/learner-records.html",
        "/notifications":    "teacher/notifications.html",
        "/settings":         "teacher/settings.html"

    };

    /*
     * Centralised breadcrumb map, keyed by physical
     * filename (e.g. "learner-management.html"). Each
     * entry is the trail of {label, href} crumbs to show,
     * in order, ending with the current page (the last
     * entry's href is ignored — it's never clickable).
     *
     * Layout.updateBreadcrumb() reads this automatically
     * so individual pages don't need to declare their own
     * breadcrumb trail — add a page here once and every
     * page linking to it gets a correct, clickable trail.
     */
    static BREADCRUMBS = {

        "dashboard.html": [
            { label: "Dashboard" }
        ],

        "clc-overview.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "CLC Overview" }
        ],
        "clc-details.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "CLC Overview", href: "clc-overview.html" },
            { label: "Add New CLC" }
        ],
        "clc-upload.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "CLC Overview", href: "clc-overview.html" },
            { label: "Add New CLC", href: "clc-details.html" },
            { label: "Upload Records" }
        ],

        "learner-records.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "Learner", href: "learner-management.html" },
            { label: "Learner Record Management" }
        ],
        "learner-management.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "Learner", href: "learner-management.html" },
            { label: "Learner Management" }
        ],
        "learner-profile.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "Learner", href: "learner-management.html" },
            { label: "Learner Management", href: "learner-management.html" },
            { label: "Learner Profile" }
        ],
        "add-learner.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "Learner", href: "learner-management.html" },
            { label: "Learner Management", href: "learner-management.html" },
            { label: "Add New Learner" }
        ],
        "learner-import.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "Learner", href: "learner-management.html" },
            { label: "Learner Management", href: "learner-management.html" },
            { label: "Add New Learner", href: "add-learner.html" },
            { label: "Import Learners" }
        ],
        "learner-enroll.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "Learner", href: "learner-management.html" },
            { label: "Learner Management", href: "learner-management.html" },
            { label: "Add New Learner", href: "add-learner.html" },
            { label: "Manual Enrollment" }
        ],

        "early-warning.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "Early Warning Alerts" }
        ],

        "notifications.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "Notifications" }
        ],

        "settings.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "System Settings" }
        ],

        "profile.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "Profile Settings" }
        ],
        "help.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "Help & User Manual" }
        ],
        "about.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "About StayEd" }
        ]

    };

    /**
     * Look up the breadcrumb trail for a page. Falls back
     * to a generic two-level trail (Dashboard > title) if
     * the page isn't in the map, so nothing ever renders
     * empty.
     */
    static breadcrumbFor(filename, fallbackTitle) {

        if (this.BREADCRUMBS[filename]) {

            return this.BREADCRUMBS[filename].map(c => ({ ...c }));

        }

        return [
            { label: "Dashboard", href: "dashboard.html" },
            { label: fallbackTitle || filename }
        ];

    }

    /**
     * Resolve a logical route to a URL relative to the
     * current page's location.
     */
    static resolve(route) {

        const target = this.ROUTES[route];

        if (!target) {

            console.warn(`[Router] Unknown route: ${route}`);

            return null;

        }

        return this.toPagesRelative(target);

    }

    /**
     * Build a path from the current page back to /pages,
     * then into the target. Every page sits at
     * /pages/<area>/<file>, so "../" reaches /pages.
     */
    static toPagesRelative(target) {

        const path = window.location.pathname;

        // Are we already somewhere under /pages/<area>/ ?
        const match = path.match(/\/pages\/[^/]+\//);

        if (match) {
            // From /pages/<area>/file -> ../<area>/file
            return `../${target}`;
        }

        // Fallback: assume we're at project root.
        return `pages/${target}`;

    }

    /**
     * Navigate to a logical route.
     */
    static go(route) {

        const url = this.resolve(route);

        if (url) {
            window.location.href = url;
        }

    }

    /**
     * Replace current history entry (no back button trap).
     */
    static replace(route) {

        const url = this.resolve(route);

        if (url) {
            window.location.replace(url);
        }

    }

    /**
     * Current filename (e.g. "dashboard.html").
     */
    static current() {

        return window.location.pathname
            .split("/")
            .pop();

    }

}

window.Router = Router;
