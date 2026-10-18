class RegisterPage {
  static init() {
    Guards.guest();

    this.form = document.getElementById("registrationForm");

    if (!this.form) {
      return;
    }

    this.bind();
  }

  static bind() {
    Utils.limitDigits(document.getElementById("employee_id"), 7);

    this.form.addEventListener(
      "submit",

      (event) => {
        event.preventDefault();

        this.submit();
      },
    );

    // Password visibility toggles for .password-toggle buttons are bound
    // generically by AuthPage.bindPasswordToggles() (auth-page.js, loaded
    // on this page). This used to duplicate that binding, stacking a
    // second listener on the same click and silently cancelling the
    // toggle out every other click -- same bug already fixed on login.js.
  }

  static async submit() {
    const form = Utils.serialize(this.form);

    if (!this.form.checkValidity()) {
      this.form.reportValidity();
      return;
    }

    if (!Utils.isEmployeeId(form.employee_id.trim())) {
      Toast.error("Employee ID must be exactly 7 digits.");
      return;
    }

    if (form.password !== form.confirm_password) {
      Toast.error("Passwords do not match.");
      return;
    }

    try {
      if (window.Layout) {
        Layout.showLoader();
      }

      const response = await Auth.register({
        first_name: form.first_name.trim(),
        middle_name: (form.middle_name || "").trim(),
        last_name: form.last_name.trim(),
        full_name: [form.first_name, form.middle_name, form.last_name].map((p) => (p || "").trim()).filter(Boolean).join(" "),
        employee_id: form.employee_id.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      Toast.success(
        response?.message || "Registration submitted successfully."
      );

      setTimeout(() => {
        window.location.href = "pending.html";
      }, 1200);
    } catch (error) {
      console.error("Registration error:", error);

      Toast.error(
        error?.data?.message ||
        error?.message ||
        "Registration failed."
      );
    } finally {
      if (window.Layout) {
        Layout.hideLoader();
      }
    }
  }
}

document.addEventListener(
  "DOMContentLoaded",

  () => {
    RegisterPage.init();
  },
);
