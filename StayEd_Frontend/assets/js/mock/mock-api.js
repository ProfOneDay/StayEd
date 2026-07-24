/**
 * ============================================
 * StayEd
 * Mock API
 * ============================================
 *
 * Simulates the Laravel backend during
 * frontend development.
 *
 * ============================================
 */

class MockAPI {

    /* =======================================
       REQUEST ROUTER
    ======================================= */

    static async request(endpoint, options = {}) {

        await Utils.sleep(CONFIG.MOCK_DELAY);

        const method = (options.method || "GET").toUpperCase();

        const body = this.parseBody(options.body);

        switch (`${method} ${endpoint}`) {

            /* Authentication */

            case "POST /auth/login":
                return this.login(body);

            case "POST /auth/logout":
                return this.logout();

            case "GET /auth/me":
                return this.currentUser();

            case "POST /auth/forgot-password":
                return this.forgotPassword(body);

            case "POST /auth/reset-password":
                return this.resetPassword(body);

            case "POST /auth/change-password":
                return this.changePassword(body);

            case "POST /auth/register":
                return this.register(body);

            /* Dashboard */

            case "GET /teacher/dashboard":
                return this.teacherDashboard();

            /* Predictive Analytics */

            case "GET /predictions/summary":
                return this.predictionSummary();

            case "GET /predictions/risk-distribution":
                return this.riskDistribution();

            case "GET /interventions":
                return this.interventions();

            /* Classes */

            case "GET /classes":
                return this.classes();

            case "GET /classes/current":
                return this.currentClass();

            case "POST /classes":
                return this.createClass(body);

            case "POST /learners/import/preview":
                return this.importPreview(body?.filename);

            case "POST /learners/import":
                return this.importLearners(body);

            case "GET /learners/import/summary":
                return this.importSummary();

            /* Community Learning Centers */

            case "GET /clcs":
                return this.clcs();

            /* Notifications */

            case "GET /notifications":
                return this.notifications();

            case "POST /notifications/read-all":
                return this.markAllNotificationsRead();

            case "GET /clcs/current":
                return this.currentClc();

            case "POST /clcs":
                return this.createClc(body);

            /* Learners */

            case "GET /learners":
                return this.learners();

            case "POST /learners":
                return this.createLearner(body);

            default:

                /* Parameterised routes (e.g. /learners/:id) */

                return this.dynamicRoute(method, endpoint, body);

        }

    }

    /* =======================================
       DYNAMIC (PARAMETERISED) ROUTES
    ======================================= */

    static dynamicRoute(method, endpoint, body) {

        /* /notifications/:id/read -> POST (mark one read) */

        const notifReadMatch =
            endpoint.match(/^\/notifications\/([^/]+)\/read$/);

        if (notifReadMatch && method === "POST") {

            return this.markNotificationRead(notifReadMatch[1]);

        }

        /* /notifications/:id -> DELETE */

        const notifMatch =
            endpoint.match(/^\/notifications\/([^/]+)$/);

        if (notifMatch && method === "DELETE") {

            return this.deleteNotification(notifMatch[1]);

        }

        /* /learners/:id/profile -> GET (full profile detail) */

        const profileMatch =
            endpoint.match(/^\/learners\/([^/]+)\/profile$/);

        if (profileMatch && method === "GET") {

            return this.learnerProfile(profileMatch[1]);

        }

        /* /learners/:id/records-detail -> GET (modality hub detail) */

        const recordsDetailMatch =
            endpoint.match(/^\/learners\/([^/]+)\/records-detail$/);

        if (recordsDetailMatch && method === "GET") {

            return MockDB.getRecordsHubDetail(recordsDetailMatch[1]);

        }

        /* /learners/:id  ->  GET / PUT / DELETE */

        const learnerMatch =
            endpoint.match(/^\/learners\/([^/]+)$/);

        if (learnerMatch) {

            const id = learnerMatch[1];

            if (method === "GET") {
                return this.learner(id);
            }

            if (method === "PUT" || method === "PATCH") {
                return this.updateLearner(id, body);
            }

            if (method === "DELETE") {
                return this.deleteLearner(id);
            }

        }

        throw {

            status: 404,

            data: {

                message: `Mock endpoint not found: ${method} ${endpoint}`

            }

        };

    }

    /* =======================================
       HELPERS
    ======================================= */

    static parseBody(body) {

        if (!body) {

            return {};

        }

        if (typeof body === "string") {

            try {

                return JSON.parse(body);

            }

            catch {

                return {};

            }

        }

        return body;

    }

    static generateToken(user) {

        const payload = {

            id: user.id,

            role: user.role,

            exp:

                Math.floor(Date.now() / 1000)

                +

                (60 * 60 * 24)

        };

        return [

            "mock",

            btoa(JSON.stringify(payload)),

            "signature"

        ].join(".");

    }

    static decodeToken(token) {

        try {

            return JSON.parse(

                atob(

                    token.split(".")[1]

                )

            );

        }

        catch {

            return {};

        }

    }

    /* =======================================
       AUTHENTICATION
    ======================================= */

    static login(credentials = {}) {

        const user = MockDB.findUser(

            credentials.email

        );

        if (

            !user ||

            user.password !== credentials.password

        ) {

            throw {

                status: 401,

                data: {

                    message: "Invalid email or password."

                }

            };

        }

        const {

            password,

            ...safeUser

        } = user;

        return {

            token: this.generateToken(user),

            user: MockDB.clone(safeUser)

        };

    }

    static logout() {

        return {

            success: true,

            message: "Logged out."

        };

    }

    static currentUser() {

        const token = Auth.token();

        if (!token) {

            throw {

                status: 401,

                data: {

                    message: "Unauthenticated."

                }

            };

        }

        const payload =

            this.decodeToken(token);

        const user =

            MockDB.findUserById(payload.id);

        if (!user) {

            throw {

                status: 401,

                data: {

                    message: "User not found."

                }

            };

        }

        const {

            password,

            ...safeUser

        } = user;

        return MockDB.clone(safeUser);

    }

    static forgotPassword(data) {

        const user = MockDB.findUser(

            data.email

        );

        if (!user) {

            throw {

                status: 404,

                data: {

                    message:

                        "Email address not found."

                }

            };

        }

        return {

            success: true,

            message:

                "Password reset email sent."

        };

    }

    static resetPassword(data) {

        if (

            !data.password ||

            data.password.length < 8

        ) {

            throw {

                status: 400,

                data: {

                    message:

                        "Password is too short."

                }

            };

        }

        return {

            success: true,

            message:

                "Password updated successfully."

        };

    }

    static changePassword() {

        return {

            success: true,

            message:

                "Password successfully changed."

        };

    }

    static register(data = {}) {

        const exists = MockDB.users.find(

            user =>

                user.email.toLowerCase() ===

                data.email.toLowerCase()

        );

        if (exists) {

            throw {

                status:409,

                data:{

                    message:"Email already exists."

                }

            };

        }

        const teacher = {

            id: MockDB.nextId(MockDB.users),

            role:"teacher",

            status:"pending",

            full_name:data.full_name,

            first_name:data.full_name.split(" ")[0],

            last_name:data.full_name.split(" ").slice(1).join(" "),

            email:data.email,

            password:data.password,

            school:"",

            avatar:"../../assets/images/avatar.png"

        };

        MockDB.users.push(teacher);

        return {

            success:true,

            message:

                "Registration submitted."

        };

    }

    /* =======================================
       DASHBOARD
    ======================================= */

    static teacherDashboard() {

        const learners = MockDB.learners;

        const countRisk = level =>
            learners.filter(l => l.risk === level).length;

        return {

            context:
                MockDB.clone(MockDB.dashboard.context),

            statistics: {

                registered:
                    MockDB.dashboard.context.registered_learners,

                high: countRisk("High"),

                moderate: countRisk("Moderate"),

                low: countRisk("Low"),

                high_delta:
                    MockDB.dashboard.statistics.high_delta,

                moderate_trend:
                    MockDB.dashboard.statistics.moderate_trend,

                low_trend:
                    MockDB.dashboard.statistics.low_trend

            },

            riskDistribution:
                MockDB.clone(MockDB.riskDistribution),

            predictionSummary:
                MockDB.clone(MockDB.predictionSummary),

            learners:
                MockDB.clone(learners),

            interventions:
                MockDB.clone(MockDB.interventions)

        };

    }

    /* =======================================
       PREDICTIVE ANALYTICS
    ======================================= */

    static predictionSummary() {

        return MockDB.clone(MockDB.predictionSummary);

    }

    static riskDistribution() {

        return MockDB.clone(MockDB.riskDistribution);

    }

    static interventions() {

        return {

            total: MockDB.interventions.length,

            data: MockDB.clone(MockDB.interventions)

        };

    }

    /* =======================================
       CLASSES
    ======================================= */

    static classes() {

        const list = MockDB.classes || [];

        return {

            total: list.length,

            data: MockDB.clone(list)

        };

    }

    static createClass(data = {}) {

        if (!MockDB.classes) {

            MockDB.classes = [];

        }

        const record = {

            id:
                MockDB.classes.length
                    ? Math.max(...MockDB.classes.map(c => c.id)) + 1
                    : 1,

            created_at:
                new Date().toISOString(),

            ...data

        };

        MockDB.classes.push(record);

        /* Remember as the active class for the setup wizard */
        MockDB.currentClass = record;
        MockDB.rememberCurrent("currentClass", record);

        return {

            message: "Class created successfully.",

            data: MockDB.clone(record)

        };

    }

    /* =======================================
       COMMUNITY LEARNING CENTERS (CLC)
    ======================================= */

    /* =======================================
       NOTIFICATIONS
    ======================================= */

    static notifications() {

        const list = MockDB.notifications || [];

        return {

            total: list.length,

            unread: list.filter(n => !n.read).length,

            data: MockDB.clone(list)

        };

    }

    static markNotificationRead(id) {

        const notif = (MockDB.notifications || []).find(
            n => String(n.id) === String(id)
        );

        if (notif) {
            notif.read = true;
        }

        return { message: "Notification marked as read." };

    }

    static markAllNotificationsRead() {

        (MockDB.notifications || []).forEach(n => { n.read = true; });

        return { message: "All notifications marked as read." };

    }

    static deleteNotification(id) {

        if (!MockDB.notifications) return { message: "Notification removed." };

        const index = MockDB.notifications.findIndex(
            n => String(n.id) === String(id)
        );

        if (index !== -1) {
            MockDB.notifications.splice(index, 1);
        }

        return { message: "Notification removed." };

    }

    static clcs() {

        const list = MockDB.clcs || [];

        return {

            total: list.length,

            data: MockDB.clone(list)

        };

    }

    static createClc(data = {}) {

        if (!MockDB.clcs) {

            MockDB.clcs = [];

        }

        const record = {

            id:
                MockDB.clcs.length
                    ? Math.max(...MockDB.clcs.map(c => c.id)) + 1
                    : 1,

            status: "Active",

            icon: "account_balance",

            totalLearners: 0,

            teachers: 0,

            created_at: new Date().toISOString(),

            ...data

        };

        MockDB.clcs.push(record);

        /* Remembered so the Upload confirmation step can
           read back what was just entered on CLC Details.
           Persisted across the page navigation between
           CLC Details and CLC Upload (see MockDB.rememberCurrent). */
        MockDB.rememberCurrent("currentClc", record);

        return {

            message: "CLC registered successfully.",

            data: MockDB.clone(record)

        };

    }

    static currentClc() {

        const fallback = {
            municipality: "Quezon City",
            name: "San Felipe Sur CLC",
            schoolYear: "2023-2024",
            learningLevel: "A&E - Secondary"
        };

        return MockDB.clone(MockDB.recallCurrent("currentClc") || fallback);

    }

    static currentClass() {

        /* Fall back to a sensible default so the wizard summary
           still renders if the class step was skipped. */
        const fallback = {
            communityLearningCenter: "San Felipe Sur CLC",
            schoolYear: "2026-2027",
            semester: "First Trimester",
            learningLevel: "Basic Literacy Program"
        };

        return MockDB.clone(MockDB.recallCurrent("currentClass") || fallback);

    }

    /**
     * Simulated row-level validation preview shown before
     * a batch import is committed — mixes valid, duplicate,
     * and error rows so the preview table (and duplicate-
     * detection UI) has something realistic to render.
     */
    static importPreview(filename) {

        const sample = MockDB.learners.slice(0, 6);

        const rows = sample.map((l, i) => {

            const status =
                i === 1 ? "duplicate" :
                i === 4 ? "error" : "valid";

            return {
                lrn: l.lrn,
                name: l.name,
                level: l.level,
                modality: l.modality,
                status,
                issue:
                    status === "duplicate" ? "LRN already exists in the system" :
                    status === "error" ? "Missing required field: Birthdate" :
                    null
            };

        });

        const summary = {
            total: rows.length,
            valid: rows.filter(r => r.status === "valid").length,
            duplicates: rows.filter(r => r.status === "duplicate").length,
            errors: rows.filter(r => r.status === "error").length,
            filename: filename || "learners_import.csv",
            rows
        };

        MockDB.rememberCurrent("importPreview", summary);

        return summary;

    }

    static importLearners(data = {}) {

        const rows =
            Array.isArray(data.learners)
                ? data.learners
                : [];

        const imported = rows.length || 40;

        const previewLearners =
            rows.length
                ? rows
                : MockDB.learners.slice(0, 5).map(l => ({
                    lrn: l.lrn,
                    name: l.name,
                    level: l.level
                }));

        /* Persist a summary the next page can read back
           (see MockDB.rememberCurrent for why this is
           needed across a real page navigation). */
        MockDB.rememberCurrent("importSummary", {
            total: imported + 2,
            imported: imported,
            duplicates: 1,
            invalid: 1,
            learners: previewLearners
        });

        return {

            message: "Learners imported successfully.",

            imported: imported,

            skipped: 2

        };

    }

    static importSummary() {

        const fallback = {
            total: 42,
            imported: 40,
            duplicates: 1,
            invalid: 1,
            learners: MockDB.learners.slice(0, 5).map(l => ({
                lrn: l.lrn,
                name: l.name,
                level: l.level
            }))
        };

        return MockDB.clone(MockDB.recallCurrent("importSummary") || fallback);

    }

    /* =======================================
       LEARNERS
    ======================================= */

    static learners() {

        return {

            total:

                MockDB.learners.length,

            data:

                MockDB.clone(

                    MockDB.learners

                )

        };

    }

    static learner(id) {

        const learner =

            MockDB.findLearner(id);

        if (!learner) {

            throw {

                status: 404,

                data: {

                    message:

                        "Learner not found."

                }

            };

        }

        return learner;

    }

    static learnerProfile(id) {

        const profile = MockDB.getLearnerProfile(id);

        if (!profile) {

            throw {

                status: 404,

                data: {

                    message: "Learner not found."

                }

            };

        }

        return profile;

    }

    static createLearner(data = {}) {

        const learner = {

            id:

                MockDB.nextId(

                    MockDB.learners

                ),

            ...data

        };

        MockDB.insert(

            MockDB.learners,

            learner

        );

        return MockDB.clone(learner);

    }

    static updateLearner(id, data = {}) {

        const learner =

            MockDB.update(

                MockDB.learners,

                id,

                data

            );

        if (!learner) {

            throw {

                status: 404,

                data: {

                    message:

                        "Learner not found."

                }

            };

        }

        return MockDB.clone(learner);

    }

    static deleteLearner(id) {

        const success =

            MockDB.remove(

                MockDB.learners,

                id

            );

        if (!success) {

            throw {

                status: 404,

                data: {

                    message:

                        "Learner not found."

                }

            };

        }

        return {

            success: true

        };

    }

}

/* ==========================================
   EXPORT
========================================== */

window.MockAPI = MockAPI;

/* ==========================================
   INITIALIZATION
========================================== */

document.addEventListener(

    "DOMContentLoaded",

    () => {

        if (

            CONFIG.MODE !== "development"

        ) {

            return;

        }

        console.log(

            "%cStayEd Mock API Ready",

            "color:#006A68;font-weight:bold;"

        );

    }

);