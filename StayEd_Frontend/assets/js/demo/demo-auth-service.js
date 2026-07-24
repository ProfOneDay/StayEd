/**
 * ============================================
 * StayEd
 * Demo Auth / Registration Service
 * ============================================
 *
 * ISOLATION NOTICE
 * ----------------
 * This module exists so the "Create Account" ->
 * Setup Wizard flow can be fully demonstrated
 * without a connected backend. It never touches
 * the real API layer (assets/js/core/api.js) or
 * the real session keys used by Auth
 * (assets/js/core/auth.js) — it has its own
 * "stayed_demo_*" localStorage namespace.
 *
 * WHEN TO REMOVE
 * ---------------
 * Once the real backend supports instant/self-serve
 * account creation, delete this file, remove the
 * <script> include, and set CONFIG.DEMO_MODE = false.
 * Every call site already guards on
 * DemoAuthService.isEnabled() so nothing else needs
 * to change.
 *
 * WHAT IT SIMULATES
 * ------------------
 *   - createAccount()       new teacher account
 *   - createOrganization()  CLC / class creation
 *   - completeProfile()     teacher profile details
 *   - completeOnboarding()  marks the demo session done
 *
 * All state is kept in memory + localStorage under
 * the "stayed_demo_" prefix so a demo can be resumed
 * after a refresh, and reset() clears it completely.
 * ============================================
 */

class DemoAuthService {

    static STORAGE_KEY = "stayed_demo_session";

    static _session = null;

    /* -----------------------------------------
       Mode switch
    ----------------------------------------- */

    static isEnabled() {

        return Boolean(
            window.CONFIG && CONFIG.DEMO_MODE
        );

    }

    /* -----------------------------------------
       Session helpers
    ----------------------------------------- */

    static _load() {

        if (this._session) {
            return this._session;
        }

        try {

            const raw =
                localStorage.getItem(this.STORAGE_KEY);

            this._session =
                raw ? JSON.parse(raw) : this._blank();

        } catch {

            this._session = this._blank();

        }

        return this._session;

    }

    static _blank() {

        return {

            account: null,
            organization: null,
            profile: null,
            onboardingComplete: false,
            createdAt: null

        };

    }

    static _persist() {

        try {

            localStorage.setItem(
                this.STORAGE_KEY,
                JSON.stringify(this._session)
            );

        } catch {

            /* localStorage unavailable (private mode,
               storage full, etc.) — demo still works
               in-memory for the current page load. */

        }

    }

    static _delay(ms = 500) {

        return new Promise(resolve =>
            setTimeout(resolve, ms)
        );

    }

    static _id(prefix) {

        return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    }

    /* -----------------------------------------
       1. Account creation
       (mirrors Auth.register() shape so this can
       be swapped for the real call with no other
       code changes)
    ----------------------------------------- */

    static async createAccount({ full_name, email, password } = {}) {

        await this._delay();

        const session = this._load();

        session.account = {

            id: this._id("acct"),
            full_name: full_name || "Demo Teacher",
            email: email || "demo.teacher@deped.gov.ph",
            role: "teacher",
            status: "approved",   // demo skips the real approval wait
            created_at: new Date().toISOString()

        };

        session.createdAt = new Date().toISOString();

        this._persist();

        return {

            message: "Demo account created successfully.",
            data: { ...session.account }

        };

    }

    /* -----------------------------------------
       2. Organization / class creation
       (mirrors API.createClass())
    ----------------------------------------- */

    static async createOrganization(payload = {}) {

        await this._delay(400);

        const session = this._load();

        session.organization = {

            id: this._id("org"),
            communityLearningCenter:
                payload.communityLearningCenter ||
                payload.clc ||
                "Demo Community Learning Center",
            schoolYear: payload.schoolYear || "2026-2027",
            semester: payload.semester || "First Trimester",
            learningLevel:
                payload.learningLevel || "Basic Literacy Program",
            created_at: new Date().toISOString()

        };

        this._persist();

        return {

            message: "Demo class created successfully.",
            data: { ...session.organization }

        };

    }

    /* -----------------------------------------
       3. Profile completion
    ----------------------------------------- */

    static async completeProfile(payload = {}) {

        await this._delay(300);

        const session = this._load();

        session.profile = {

            school: payload.school || "Demo ALS Community Learning Center",
            position: payload.position || "ALS Teacher",
            completed_at: new Date().toISOString()

        };

        this._persist();

        return {

            message: "Demo profile completed.",
            data: { ...session.profile }

        };

    }

    /* -----------------------------------------
       4. Onboarding completion
    ----------------------------------------- */

    static async completeOnboarding() {

        await this._delay(300);

        const session = this._load();

        session.onboardingComplete = true;

        this._persist();

        return {

            message: "Demo onboarding complete.",
            data: { ...session }

        };

    }

    /* -----------------------------------------
       Session accessors (read-only helpers used
       by the wizard's Complete step / dashboard
       demo banner)
    ----------------------------------------- */

    static getSession() {

        return { ...this._load() };

    }

    static hasActiveSession() {

        return Boolean(this._load().account);

    }

    /* -----------------------------------------
       Start / reset
    ----------------------------------------- */

    /**
     * Begin a brand-new demo session and enter the
     * setup wizard, exactly the path a real signup
     * would take once the account exists.
     */
    /**
     * Enter the setup wizard. If a demo account was
     * already created (the normal path, via
     * createAccount()), that session is kept so the
     * wizard can read it back. Only starts fresh when
     * called with no existing session (e.g. a stale
     * demo left over from a previous visit).
     */
    static startDemo() {

        if (!this.hasActiveSession()) {

            this.reset();

        }

        Router.go("/setup/wizard-1");

    }

    static reset() {

        this._session = this._blank();

        try {

            localStorage.removeItem(this.STORAGE_KEY);

        } catch {

            /* ignore */

        }

    }

}

window.DemoAuthService = DemoAuthService;
