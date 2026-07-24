/**
 * ============================================
 * StayEd
 * Reset Password
 * ============================================
 */

class ResetPasswordPage {

    static initialize() {

        this.form = document.getElementById(

            "resetPasswordForm"

        );

        if (!this.form) {

            return;

        }

        this.form.addEventListener(

            "submit",

            this.submit.bind(this)

        );

    }

    static async submit(event) {

        event.preventDefault();

        const password =

            document.getElementById(

                "password"

            ).value;

        const confirm =

            document.getElementById(

                "confirmPassword"

            ).value;

        if (password.length < 8) {

            Toast.warning(

                "Password must be at least 8 characters."

            );

            return;

        }

        if (password !== confirm) {

            Toast.warning(

                "Passwords do not match."

            );

            return;

        }

        try {

            await Auth.resetPassword({

                password

            });

            Toast.success(

                "Password successfully changed."

            );

            setTimeout(

                () => {

                    window.location.href =

                        "login.html";

                },

                1500

            );

        }

        catch (error) {

            Toast.error(

                error.message ||

                "Unable to reset password."

            );

        }

    }

}

document.addEventListener(

    "DOMContentLoaded",

    () => {

        ResetPasswordPage.initialize();

    }

);