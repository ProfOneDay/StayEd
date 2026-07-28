
class DemoAuthService {

    static STORAGE_KEY = "stayed_demo_session";

    static _session = null;

    static isEnabled() {

        return Boolean(
            window.CONFIG && CONFIG.DEMO_MODE
        );

    }

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

    static async createAccount({ full_name, email, password } = {}) {

        await this._delay();

        const session = this._load();

        session.account = {

            id: this._id("acct"),
            full_name: full_name || "Demo Teacher",
            email: email || "demo.teacher@deped.gov.ph",
            role: "teacher",
            status: "approved",   
            created_at: new Date().toISOString()

        };

        session.createdAt = new Date().toISOString();

        this._persist();

        return {

            message: "Demo account created successfully.",
            data: { ...session.account }

        };

    }

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

    static getSession() {

        return { ...this._load() };

    }

    static hasActiveSession() {

        return Boolean(this._load().account);

    }

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

}

    }

}

window.DemoAuthService = DemoAuthService;
