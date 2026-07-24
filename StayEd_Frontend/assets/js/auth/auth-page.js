/**
 * ============================================
 * StayEd
 * Shared Authentication Page Behaviour
 * ============================================
 *
 * Wires up interactions common to every auth
 * screen without any page-specific coupling:
 *
 *   - password visibility toggles
 *   - live password-requirement feedback
 *   - dynamic footer year
 *
 * Page-specific logic (login/register/etc.)
 * lives in its own script.
 * ============================================
 */

const AuthPage = {

    init() {

        this.bindPasswordToggles();

        this.bindPasswordRules();

        this.stampYear();

    },

    /* -----------------------------------------
       Password visibility
    ----------------------------------------- */

    bindPasswordToggles() {

        const toggles =
            document.querySelectorAll(".password-toggle");

        toggles.forEach(toggle => {

            toggle.addEventListener("click", () => {

                /*
                 * A toggle either references a field by
                 * data-toggle, or sits inside a wrapper
                 * next to the input it controls.
                 */

                let input = null;

                const targetId = toggle.dataset.toggle;

                if (targetId) {

                    input = document.getElementById(targetId);

                } else {

                    input =
                        toggle
                            .closest(".password-wrapper")
                            ?.querySelector("input");

                }

                if (!input) return;

                const icon =
                    toggle.querySelector(
                        ".material-symbols-outlined"
                    );

                if (input.type === "password") {

                    input.type = "text";

                    if (icon) icon.textContent = "visibility_off";

                    toggle.setAttribute(
                        "aria-label",
                        "Hide password"
                    );

                } else {

                    input.type = "password";

                    if (icon) icon.textContent = "visibility";

                    toggle.setAttribute(
                        "aria-label",
                        "Show password"
                    );

                }

            });

        });

    },

    /* -----------------------------------------
       Live password requirement feedback
    ----------------------------------------- */

    bindPasswordRules() {

        const rulesList =
            document.querySelector(".auth-password-rules");

        const password =
            document.getElementById("password");

        if (!rulesList || !password) return;

        const rules = {

            length: v => v.length >= 8,

            upper: v => /[A-Z]/.test(v),

            lower: v => /[a-z]/.test(v),

            number: v => /[0-9]/.test(v)

        };

        const evaluate = () => {

            const value = password.value;

            Object.keys(rules).forEach(key => {

                const item =
                    rulesList.querySelector(
                        `[data-rule="${key}"]`
                    );

                if (!item) return;

                const valid = rules[key](value);

                item.classList.toggle("is-valid", valid);

                const icon =
                    item.querySelector(
                        ".material-symbols-outlined"
                    );

                if (icon) {

                    icon.textContent =
                        valid ? "check_circle" : "circle";

                }

            });

        };

        password.addEventListener("input", evaluate);

    },

    /* -----------------------------------------
       Footer year
    ----------------------------------------- */

    stampYear() {

        const year = new Date().getFullYear();

        document
            .querySelectorAll("[data-year]")
            .forEach(el => {
                el.textContent = year;
            });

    }

};

/*
 * Auth partials load asynchronously via the
 * ComponentLoader, so we initialise slightly after
 * DOMContentLoaded to ensure injected markup
 * (toggles, footer) is present.
 */

document.addEventListener("DOMContentLoaded", () => {

    // Initialise immediately for inline markup...
    AuthPage.init();

    // ...and again shortly after, to catch
    // component-injected elements.
    setTimeout(() => AuthPage.init(), 250);

});

window.AuthPage = AuthPage;
