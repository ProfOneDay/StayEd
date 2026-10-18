class ResetPasswordPage {
  static initialize() {
    this.form = document.getElementById("resetPasswordForm");

    if (!this.form) {
      return;
    }

    // The emailed link is .../reset-password.html?token=... -- without it
    // there's nothing to reset against.
    this.token = new URLSearchParams(window.location.search).get("token") || "";

    if (!this.token) {
      Toast.warning("This reset link is incomplete. Please request a new one from the Forgot Password page.");
      this.form.querySelector('button[type="submit"]')?.setAttribute("disabled", "");
      return;
    }

    this.form.addEventListener(
      "submit",

      this.submit.bind(this),
    );
  }

  static async submit(event) {
    event.preventDefault();

    const password = document.getElementById("password").value;

    const confirm = document.getElementById("confirm_password").value;

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      Toast.warning("Password must have 8+ characters, an uppercase letter, a lowercase letter, and a number.");

      return;
    }

    if (password !== confirm) {
      Toast.warning("Passwords do not match.");

      return;
    }

    const button = this.form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    try {
      await Auth.resetPassword({
        token: this.token,

        password,
      });

      Toast.success("Password successfully changed. You can now log in.");

      setTimeout(
        () => {
          window.location.href = "/index.html";
        },

        1500,
      );
    } catch (error) {
      if (button) button.disabled = false;
      Toast.error(error.message || "Unable to reset password.");
    }
  }
}

document.addEventListener(
  "DOMContentLoaded",

  () => {
    ResetPasswordPage.initialize();
  },
);
