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
    this.form.addEventListener(
      "submit",

      (event) => {
        event.preventDefault();

        this.submit();
      },
    );
  }

  static async submit() {
    const form = Utils.serialize(this.form);

    if (!this.form.checkValidity()) {
      this.form.reportValidity();
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
        full_name: form.full_name.trim(),
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
