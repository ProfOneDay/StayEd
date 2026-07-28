

class App {

    static init() {

        console.log(

            "%cStayEd Initialized",

            "color:#12355B;font-weight:bold;"

        );

        this.restoreUser();

        this.initializePage();

        this.initializeLogout();

    }

    static restoreUser() {

        if (!window.Auth) {

            return;

        }

        const user = Auth.user();

        if (!user) {

            return;

        }

        document

            .querySelectorAll(

                "[data-st-user-name]"

            )

            .forEach(element => {

                element.textContent =

                    user.full_name ||

                    [

                        user.first_name,

                        user.last_name

                    ]

                    .filter(Boolean)

                    .join(" ");

            });

        document

            .querySelectorAll(

                "[data-st-user-role]"

            )

            .forEach(element => {

                element.textContent =

                    user.role ||

                    "";

            });

        document

            .querySelectorAll(

                "[data-st-user-email]"

            )

            .forEach(element => {

                element.textContent =

                    user.email ||

                    "";

            });

        document

            .querySelectorAll(

                "[data-st-user-avatar]"

            )

            .forEach(image => {

                if (

                    user.avatar

                ) {

                    image.src =

                        user.avatar;

                }

            });

    }

static initializePage() {

        const body = document.body;

        const title = body.dataset.page;

        if (

            title &&

            window.Layout

        ) {

            Layout.updatePageTitle();

        }

    }

static initializeLogout() {

        document

            .querySelectorAll(

                "[data-st-logout]"

            )

            .forEach(button => {

                button.addEventListener(

                    "click",

                    async event => {

                        event.preventDefault();

                        await Auth.logout();

                    }

                );

            });

    }

    static ready(callback) {

        if (

            document.readyState ===

            "loading"

        ) {

            document.addEventListener(

                "DOMContentLoaded",

                callback

            );

        }

        else {

            callback();

        }

    }

}

window.App = App;

App.ready(() => {

    App.init();

});