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

    this.bindStageTriggers();
    this.bindMobileMenu();
    this.bindNavScrollLinks();
    this.bindSignupForm();
    this.bindForgotForm();
  },

  bindStageTriggers() {
    if (!this.heroStage) return;

    document.querySelectorAll("[data-open-login]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        this.setStage("login");
      });
    });

    document.querySelectorAll("[data-open-signup]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        this.setStage("signup");
      });
    });

    document.querySelectorAll("[data-open-forgot]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        this.setStage("forgot");
      });
    });

    document.querySelectorAll("[data-close-panel]").forEach((btn) => {
      btn.addEventListener("click", () => this.setStage("intro"));
    });

    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        this.heroStage.dataset.stage !== "intro"
      ) {
        this.setStage("intro");
      }
    });
  },

  setStage(stage) {
    this.closeMobileMenu();
    this.heroStage.dataset.stage = stage;

    if (stage === "intro") return;

    const emailId =
      stage === "login" ? "email" : stage === "signup" ? "signupEmail" : "forgotEmail";
    const emailInput = document.getElementById(emailId);
    if (emailInput) setTimeout(() => emailInput.focus(), 350);
  },

  bindSignupForm() {
    const form = document.getElementById("signupForm");
    if (!form) return;

    const rules = {
      length: (v) => v.length >= 8,
      upper: (v) => /[A-Z]/.test(v),
      lower: (v) => /[a-z]/.test(v),
      number: (v) => /[0-9]/.test(v),
    };
    const rulesList = document.querySelector("[data-signup-password-rules]");
    const passwordInput = document.getElementById("signupPassword");

    if (rulesList && passwordInput) {
      passwordInput.addEventListener("input", () => {
        const value = passwordInput.value;
        Object.keys(rules).forEach((key) => {
          const item = rulesList.querySelector(`[data-rule="${key}"]`);
          if (!item) return;
          const valid = rules[key](value);
          item.classList.toggle("is-valid", valid);
          const icon = item.querySelector(".material-symbols-outlined");
          if (icon) icon.textContent = valid ? "check_circle" : "circle";
        });
      });
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const data = Utils.serialize(form);

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      if (data.password !== data.confirm_password) {
        Toast.error("Passwords do not match.");
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const response = await Auth.register({
          full_name: data.full_name.trim(),
          email: data.email.trim(),
          password: data.password,
        });

        Toast.success(
          response?.message || "Registration submitted successfully.",
        );

        setTimeout(() => {
          window.location.href = "pages/auth/pending.html";
        }, 1200);
      } catch (error) {
        console.error("Registration error:", error);
        Toast.error(
          error?.data?.message || error?.message || "Registration failed.",
        );
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  },

  bindForgotForm() {
    const form = document.getElementById("forgotPasswordForm");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = document.getElementById("forgotEmail").value.trim();

      if (!email) {
        Toast.warning("Please enter your email.");
        return;
      }

      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        Toast.warning("Enter a valid email address.");
        return;
      }

      try {
        await Auth.forgotPassword(email);
        Toast.success("Password reset instructions have been sent.");
        setTimeout(() => this.setStage("login"), 1200);
      } catch (error) {
        Toast.error(error.message || "Unable to send reset email.");
      }
    });
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
};

document.addEventListener("DOMContentLoaded", () => {
  Landing.init();
});
