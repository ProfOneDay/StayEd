/**
 * ============================================
 * StayEd
 * Route Guards
 * ============================================
 */

class Guards {

    /**
     * Any authenticated user
     */
    static auth() {

        if (!Auth.validateSession()) {

            window.location.href = "../auth/login.html";

        }

    }

    /**
     * Guest only
     * (Login, Forgot Password, etc.)
     */
    static guest() {

        if (Auth.validateSession()) {

            Auth.redirectAfterLogin();

        }

    }

    /**
     * Teacher pages only
     */
    static teacher() {

        this.auth();

        if (Auth.role() !== "teacher") {

            this.unauthorized();

        }

    }

    /**
     * Admin pages only
     */
    static admin() {

        this.auth();

        if (Auth.role() !== "admin") {

            this.unauthorized();

        }

    }

    /**
     * Teacher or Admin
     */
    static roles(...roles) {

        this.auth();

        if (!roles.includes(Auth.role())) {

            this.unauthorized();

        }

    }

    /**
     * Unauthorized page
     */
    static unauthorized() {

        window.location.href = "../errors/403.html";

    }

    /**
     * Not Found
     */
    static notFound() {

        window.location.href = "../errors/404.html";

    }

}

window.Guards = Guards;

document.addEventListener(

    "DOMContentLoaded",

    () => {

        console.log(

            "%cStayEd Guards Ready",

            "color:#12355B;font-weight:bold;"

        );

    }

);