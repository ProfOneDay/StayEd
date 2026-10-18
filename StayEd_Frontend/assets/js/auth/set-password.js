// "Set Your Password" -- shown after logging in with an admin-issued
// temporary password (new account created by an admin, or an admin
// password reset). Every other page redirects here until it's done, and
// the backend refuses everything else (sql/38_must_change_password.sql).
class SetPasswordPage {
  static initialize() {
    if (!Auth.validateSession()) {
      window.location.href = "/index.html";
      return;
    }
    if (!Auth.mustChangePassword()) {
      Auth.redirectAfterLogin();
      return;
    }

    this.form = document.getElementById("setPasswordForm");
    this.form?.addEventListener("submit", this.submit.bind(this));

    document.getElementById("setPasswordLogout")?.addEventListener("click", async (event) => {
      event.preventDefault();
      await Auth.logout();
      window.location.href = "/index.html";
    });
  }

  static async submit(event) {
    event.preventDefault();

    const current = document.getElementById("tempPassword").value;
    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirm_password").value;

    if (!current) {
      Toast.warning("Enter the temporary password from your email.");
      return;
    }
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
      await Auth.setInitialPassword({ current_password: current, password });
      Toast.success("Your password is set. Welcome to StayEd!");
      setTimeout(() => Auth.redirectAfterLogin(), 1200);
    } catch (error) {
      if (button) button.disabled = false;
      Toast.error(error.message || "Unable to set your password.");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  SetPasswordPage.initialize();
});
