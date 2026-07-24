/**
 * ============================================
 * StayEd
 * Authentication
 * ============================================
 */

class Auth {

    static TOKEN_KEY = "stayed_token";

    static USER_KEY = "stayed_user";

    /* =======================================
       LOGIN
    ======================================= */

    static async login(credentials) {

        const response = await API.post(

            "/auth/login",

            credentials

        );

        if (!response.token) {

            throw new Error(

                "Invalid login response."

            );

        }

        this.saveSession(

            response.token,

            response.user

        );

        return response;

    }

    /* =======================================
       SESSION
    ======================================= */

    static saveSession(token, user) {

        Utils.storage.set(

            this.TOKEN_KEY,

            token

        );

        Utils.storage.set(

            this.USER_KEY,

            user

        );

    }

    /*
     * DEMO MODE ONLY
     * -----------------------------------------
     * Seeds a normal-looking local session (same
     * storage keys/shape as a real login) from a
     * DemoAuthService account, so Guards/Layout
     * work exactly as they would post-login. Not
     * called anywhere in the real auth flow.
     */
    static seedDemoSession(account) {

        account = account || {};

        const header = { alg: "HS256", typ: "JWT" };

        const payload = {
            id: account.id || "demo",
            role: "teacher",
            exp: Math.floor(Date.now() / 1000) + 86400
        };

        const encode = obj =>
            btoa(JSON.stringify(obj))
                .replace(/=+$/, "");

        const token =
            `${encode(header)}.${encode(payload)}.demo`;

        this.saveSession(token, {
            id: payload.id,
            role: "teacher",
            full_name: account.full_name || "Demo Teacher",
            email: account.email || "demo.teacher@deped.gov.ph",
            status: "approved"
        });

    }

    static clearSession() {

        Utils.storage.remove(

            this.TOKEN_KEY

        );

        Utils.storage.remove(

            this.USER_KEY

        );

    }

    static token() {

        return Utils.storage.get(

            this.TOKEN_KEY

        );

    }

    static user() {

        return Utils.storage.get(

            this.USER_KEY

        );

    }

    static authenticated() {

        return Boolean(

            this.token()

        );

    }

    static role() {

        const user = this.user();

        return user

            ? user.role

            : null;

    }

    static id() {

        const user = this.user();

        return user

            ? user.id

            : null;

    }

    static name() {

        const user = this.user();

        if (!user) {

            return "";

        }

        return (

            user.full_name ||

            [

                user.first_name,

                user.last_name

            ]

            .filter(Boolean)

            .join(" ")

        );

    }

    /* =======================================
       LOGOUT
    ======================================= */

    static async logout() {

        try {

            if (window.API) {

                await API.post("/auth/logout");

            }

        }

        catch (error) {

            console.warn(error);

        }

        this.clearSession();

        window.location.href = "../auth/login.html";

    }

    /* =======================================
       RESTORE SESSION
    ======================================= */

    static restore() {

        if (!this.authenticated()) {

            return null;

        }

        return this.user();

    }

    /* =======================================
       REFRESH USER
    ======================================= */

    static async refresh() {

        const user = await API.get(

            "/auth/me"

        );

        Utils.storage.set(

            this.USER_KEY,

            user

        );

        return user;

    }

    /* =======================================
       UPDATE LOCAL USER
    ======================================= */

    static updateUser(data = {}) {

        const current =

            this.user() || {};

        const updated = {

            ...current,

            ...data

        };

        Utils.storage.set(

            this.USER_KEY,

            updated

        );

        return updated;

    }

    /* =======================================
       REDIRECT AFTER LOGIN
    ======================================= */

    static redirectAfterLogin() {

        const role = this.role();

        switch (role) {

            case "admin":

                window.location.href =
                    "../admin/dashboard.html";

                break;

            case "teacher":

                window.location.href =
                    "../teacher/dashboard.html";

                break;

            default:

                window.location.href =
                    "../auth/login.html";

        }

    }

    /* =======================================
       REQUIRE LOGIN
    ======================================= */

    static requireAuth() {

        if (!this.authenticated()) {

            window.location.href =

                "../auth/login.html";

        }

    }

    /* =======================================
       REQUIRE ROLE
    ======================================= */

    static requireRole(...roles) {

        if (

            !roles.includes(

                this.role()

            )

        ) {

            window.location.href =

                "../auth/login.html";

        }

    }

    /* =======================================
       TOKEN EXPIRATION
    ======================================= */

    static tokenExpired() {

        const token = this.token();

        if (!token) {

            return true;

        }

        try {

            const payload = JSON.parse(

                atob(token.split(".")[1])

            );

            return (

                Date.now() >=

                payload.exp * 1000

            );

        }

        catch {

            return true;

        }

    }

    /* =======================================
       VALIDATE SESSION
    ======================================= */

    static validateSession() {

        if (

            !this.authenticated()

        ) {

            return false;

        }

        if (

            this.tokenExpired()

        ) {

            this.clearSession();

            return false;

        }

        return true;

    }

    /* =======================================
       CHANGE PASSWORD
    ======================================= */

    static async changePassword(data) {

        return API.post(

            "/auth/change-password",

            data

        );

    }

    /* =======================================
       FORGOT PASSWORD
    ======================================= */

    static async forgotPassword(email) {

        return API.post(

            "/auth/forgot-password",

            {

                email

            }

        );

    }

    /* =======================================
       RESET PASSWORD
    ======================================= */

    static async resetPassword(data) {

        return API.post(

            "/auth/reset-password",

            data

        );

    }

    /* =======================================
       REGISTER
    ======================================= */

    static async register(data){

        return API.post(

            "/auth/register",

            data

        );

    }

    /* =======================================
       VERIFY EMAIL
    ======================================= */

    static async verifyEmail(token) {

        return API.post(

            "/auth/verify-email",

            {

                token

            }

        );

    }

    /* =======================================
       UPDATE PROFILE
    ======================================= */

    static async updateProfile(data) {

        const user = await API.put(

            "/users/profile",

            data

        );

        this.updateUser(user);

        return user;

    }

    /* =======================================
       AUTO RESTORE
    ======================================= */

    static initialize() {

        if (!this.validateSession()) {

            return;

        }

        const user = this.restore();

        if (user) {

            console.log(

                `%cWelcome back, ${this.name()}`,

                "color:#12355B;font-weight:bold;"

            );

        }

    }

    /* =======================================
       REDIRECT IF LOGGED IN
    ======================================= */

    static redirectIfAuthenticated() {

        if (!this.validateSession()) {

            return;

        }

        const path =

            window.location.pathname.toLowerCase();

        if (

            path.includes("/auth/login") ||

            path.includes("/auth/register") ||

            path.includes("/auth/forgot")

        ) {

            this.redirectAfterLogin();

        }

    }

    /* =======================================
       USER DISPLAY HELPERS
    ======================================= */

    static avatar() {

        const user = this.user();

        return user?.avatar || "";

    }

    static email() {

        const user = this.user();

        return user?.email || "";

    }

    static school() {

        const user = this.user();

        return user?.school || "";

    }

}

/* ==========================================
   EXPORT
========================================== */

window.Auth = Auth;

/* ==========================================
   AUTO INITIALIZATION
========================================== */

document.addEventListener(

    "DOMContentLoaded",

    () => {

        Auth.initialize();

        Auth.redirectIfAuthenticated();

        console.log(

            "%cStayEd Authentication Ready",

            "color:#006A68;font-weight:bold;"

        );

    }

);