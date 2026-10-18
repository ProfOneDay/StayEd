class Guards {
  static auth() {
    if (!Auth.validateSession()) {
      window.location.href = "/index.html";
      return;
    }

    // Still on an admin-issued temporary password: nothing else works
    // until it's replaced (the backend refuses every other call).
    if (Auth.mustChangePassword()) {
      window.location.href = Auth.SET_PASSWORD_PAGE;
    }
  }

  static guest() {
    if (Auth.validateSession()) {
      Auth.redirectAfterLogin();
    }
  }

  static teacher() {
    this.auth();

    if (Auth.role() !== "teacher") {
      this.unauthorized();
    }
  }

  static admin() {
    this.auth();

    if (Auth.role() !== "admin") {
      this.unauthorized();
    }

    // Sidebar HTML isn't injected yet at this point (components load async
    // after DOMContentLoaded) -- listen for the event component-loader.js
    // fires once it actually is, instead of duplicating this call in every
    // admin page's own script. Most pages call Guards.admin() synchronously
    // at the top of their script, well before that event can fire, so the
    // listener always catches it -- but a couple of pages (Reports,
    // Notifications) only call this from inside their own init(), which is
    // itself triggered by components:loaded (or a delayed fallback). By
    // then the event has already fired and never fires again, so the
    // listener below would never run and the Manage Admins link would
    // silently never appear on just those pages. Covering both orders here
    // (instead of requiring every page to call this before components
    // load) keeps this a one-call-site fix.
    if (window.ComponentLoader?.loaded) {
      this.applyAdminSidebarPermissions();
    } else {
      document.addEventListener("components:loaded", () => this.applyAdminSidebarPermissions());
    }
  }

  static applyAdminSidebarPermissions() {
    const sidebarNav = document.querySelector(".st-sidebar-nav");
    if (!sidebarNav) return;

    const userMgmtLink = sidebarNav.querySelector('a[href="user-management.html"]');
    if (userMgmtLink && !Auth.canManageUsers()) userMgmtLink.remove();

    const clcMgmtLink = sidebarNav.querySelector('a[href="clc-management.html"]');
    const clcMgmtKept = Boolean(clcMgmtLink) && Auth.canManageClcs();
    if (clcMgmtLink && !clcMgmtKept) clcMgmtLink.remove();

    // Not in the static sidebar markup at all -- only a super admin gets
    // this link, inserted right after Profile Settings (always present,
    // unlike User/CLC Management above which can be removed by the checks
    // above this).
    if (Auth.isSuperAdmin() && !sidebarNav.querySelector('a[href="manage-admins.html"]')) {
      const manageAdminsLink = document.createElement("a");
      manageAdminsLink.href = "manage-admins.html";
      manageAdminsLink.dataset.tooltip = "Manage Admins";
      manageAdminsLink.innerHTML =
        '<span class="material-symbols-outlined">admin_panel_settings</span><span>Manage Admins</span>';
      const profileLink = sidebarNav.querySelector('a[href="profile.html"]');
      if (profileLink) {
        profileLink.insertAdjacentElement("afterend", manageAdminsLink);
      } else {
        sidebarNav.insertAdjacentElement("afterbegin", manageAdminsLink);
      }
    }
  }

  static superAdmin() {
    this.admin();

    if (!Auth.isSuperAdmin()) {
      this.unauthorized();
    }
  }

  static roles(...roles) {
    this.auth();

    if (!roles.includes(Auth.role())) {
      this.unauthorized();
    }
  }

  static unauthorized() {
    window.location.href = "../errors/403.html";
  }

  static notFound() {
    window.location.href = "../errors/404.html";
  }
}

window.Guards = Guards;

document.addEventListener(
  "DOMContentLoaded",

  () => {
    console.log(
      "%cStayEd Guards Ready",

      "color:#12355B;font-weight:bold;",
    );
  },
);
