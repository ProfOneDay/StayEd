
class Router {

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

        "class-management.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "Learner", href: "class-management.html" },
            { label: "Class Management" }
        ],
        "learner-records.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "Learner", href: "class-management.html" },
            { label: "Class Management", href: "class-management.html" },
            { label: "Learner Records" }
        ],
        "student-registry.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "Learner", href: "class-management.html" },
            { label: "Student Registry" }
        ],
        "learner-profile.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "Learner", href: "class-management.html" },
            { label: "Student Registry", href: "student-registry.html" },
            { label: "Learner Profile" }
        ],
        "learner-import.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "Learner", href: "class-management.html" },
            { label: "Class Management", href: "class-management.html" },
            { label: "Learner Records", href: "learner-records.html" },
            { label: "Import Students" }
        ],
        "learner-enroll.html": [
            { label: "Dashboard", href: "dashboard.html" },
            { label: "Learner", href: "class-management.html" },
            { label: "Class Management", href: "class-management.html" },
            { label: "Learner Records", href: "learner-records.html" },
            { label: "Enroll Student" }
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

    static breadcrumbFor(filename, fallbackTitle) {

        if (this.BREADCRUMBS[filename]) {

            return this.BREADCRUMBS[filename].map(c => ({ ...c }));

        }

        return [
            { label: "Dashboard", href: "dashboard.html" },
            { label: fallbackTitle || filename }
        ];

    }

    static resolve(route) {

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

        return window.location.pathname
            .split("/")
            .pop();

    }

}

window.Router = Router;
