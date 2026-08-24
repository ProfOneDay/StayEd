class ForgotPasswordPage {
  static initialize() {
    this.form = document.getElementById("forgotPasswordForm");

    if (!this.form) {
      return;
    }

    this.form.addEventListener(
      "submit",

      this.submit.bind(this),
    );
  }

  static async submit(event) {
    event.preventDefault();

    const email = document

      .getElementById("email")

      .value.trim();

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

      setTimeout(
        () => {
          window.location.href = "login.html";
        },

        1500,
      );
    } catch (error) {
      Toast.error(error.message || "Unable to send reset email.");
    }
  }
}

document.addEventListener(
  "DOMContentLoaded",

  () => {
    ForgotPasswordPage.initialize();
  },
);
