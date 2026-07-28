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

    if (form.password !== form.confirm_password) {
      Toast.error("Passwords do not match.");

      return;
    }

    try {
      Layout.showLoader();

      await Auth.register({
        full_name: form.full_name,

        email: form.email,

        password: form.password,
      });

      Toast.success("Registration submitted.");

      setTimeout(() => {
        window.location.href = "pending.html";
      }, 1200);
    } catch (error) {
      Toast.error(error.data?.message || "Registration failed.");
    } finally {
      Layout.hideLoader();
    }
  }
}

document.addEventListener(
  "DOMContentLoaded",

  () => {
    RegisterPage.init();
  },
);
