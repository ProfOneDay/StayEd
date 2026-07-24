/**
 * ============================================
 * StayEd
 * Component Loader
 * ============================================
 *
 * Supports
 * data-component="layout/sidebar"
 * data-component="dashboard/statistics"
 * data-component="auth/login-form"
 *
 * ============================================
 */

class ComponentLoader {

    static BASE = "../../components";

    static async load() {

        const components = document.querySelectorAll(

            "[data-component]"

        );

        for (const element of components) {

            const component =

                element.dataset.component;

            try {

                const response = await fetch(

                    `${this.BASE}/${component}.html`

                );

                if (!response.ok) {

                    throw new Error(

                        `${component}.html not found.`

                    );

                }

                element.innerHTML =

                    await response.text();

            }

            catch (error) {

                console.error(

                    "[ComponentLoader]",

                    error.message

                );

            }

        }

    }

    static async loadInto(selector, component) {

        const container =

            document.querySelector(selector);

        if (!container) {

            return;

        }

        try {

            const response = await fetch(

                `${this.BASE}/${component}.html`

            );

            if (!response.ok) {

                throw new Error(

                    `${component}.html not found.`

                );

            }

            container.innerHTML =

                await response.text();

        }

        catch (error) {

            console.error(

                "[ComponentLoader]",

                error.message

            );

        }

    }

}

window.ComponentLoader = ComponentLoader;

document.addEventListener(

    "DOMContentLoaded",

    async () => {

        await ComponentLoader.load();

        /*
         * Components are injected asynchronously, so any
         * module that needs to read component markup (Layout,
         * page controllers) must wait for this event rather
         * than DOMContentLoaded alone.
         */

        document.dispatchEvent(

            new CustomEvent("components:loaded")

        );

    }

);