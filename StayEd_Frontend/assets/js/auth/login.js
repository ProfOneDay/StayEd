

class LoginPage {

    static initialize() {

        this.form =
            document.getElementById("loginForm");

        if (!this.form) {

            return;

        }

        this.email =
            document.getElementById("email");

        this.password =
            document.getElementById("password");

        this.remember =
            this.form.querySelector(
                "input[type='checkbox']"
            );

        this.submitButton =
            this.form.querySelector(
                "button[type='submit']"
            );

        this.toggleButton =
            document.getElementById(
                "togglePassword"
            );

        this.createAccountLink =
            document.getElementById(
                "createAccountLink"
            );

        this.restoreRememberedEmail();

        this.initializePasswordToggle();

        this.initializeCreateAccountDemo();

        this.form.addEventListener(

            "submit",

            this.submit.bind(this)

        );

    }

    static initializeCreateAccountDemo() {

        if (!this.createAccountLink) {

            return;

        }

        if (!window.DemoAuthService || !DemoAuthService.isEnabled()) {

            return;

        }

        this.createAccountLink.addEventListener(

            "click",

            async event => {

                event.preventDefault();

                const link = event.currentTarget;

                const originalText = link.textContent;

                link.textContent = "Starting demo…";

                link.style.pointerEvents = "none";

                try {

                    await DemoAuthService.createAccount({
                        full_name: "Demo Teacher",
                        email: "demo.teacher@deped.gov.ph"
                    });

                    Toast?.success(
                        "Demo account created — let's set up your class."
                    );

                    setTimeout(
                        () => DemoAuthService.startDemo(),
                        500
                    );

                }

                catch (error) {

                    console.error(error);

                    link.textContent = originalText;

                    link.style.pointerEvents = "";

                }

            }

        );

    }

static initializePasswordToggle() {

        if (!this.toggleButton) {

            return;

        }

        this.toggleButton.addEventListener(

            "click",

            () => {

                const hidden =

                    this.password.type ===

                    "password";

                this.password.type =

                    hidden

                        ? "text"

                        : "password";

                this.toggleButton
                    .querySelector("span")
                    .textContent =

                    hidden

                        ? "visibility_off"

                        : "visibility";

            }

        );

    }

    static async submit(event) {

        event.preventDefault();

        const email =

            this.email.value.trim();

        const password =

            this.password.value;

        if (!email || !password) {

            Toast.warning(

                "Please enter your email and password."

            );

            return;

        }

        this.loading(true);

        try {

            const response =

                await Auth.login({

                    email,

                    password

                });

            if (this.remember.checked) {

                localStorage.setItem(

                    "stayed_remember_email",

                    email

                );

            }

            else {

                localStorage.removeItem(

                    "stayed_remember_email"

                );

            }

            Toast.success(

                `Welcome back, ${response.user.full_name}!`

            );

            setTimeout(

                () => {

                    Auth.redirectAfterLogin();

                },

                600

            );

        }

        catch (error) {

            Toast.error(

                error.message ||

                "Invalid email or password."

            );

        }

        finally {

            this.loading(false);

        }

    }

    static loading(state) {

        if (!this.submitButton) {

            return;

        }

        this.submitButton.disabled = state;

        this.submitButton.textContent =

            state

                ? "Signing In..."

                : "Log In";

    }

    static restoreRememberedEmail() {

        const email =

            localStorage.getItem(

                "stayed_remember_email"

            );

        if (!email) {

            return;

        }

        this.email.value = email;

        if (this.remember) {

            this.remember.checked = true;

        }

    }

}

document.addEventListener(

    "DOMContentLoaded",

    () => {

        LoginPage.initialize();

    }

);