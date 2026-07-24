/**
 * ============================================
 * StayEd
 * API Client
 * ============================================
 *
 * Supports:
 * - Mock Database
 * - Future Laravel API
 * - JWT Authentication
 * - Automatic Timeout
 * - Unified Error Handling
 * ============================================
 */

class API {

    /**
     * ----------------------------------------
     * Configuration
     * ----------------------------------------
     */

    static BASE_URL = CONFIG.API_URL;

    static TIMEOUT = 15000;

    static get MODE() {

        return CONFIG.MODE || "development";

    }

    /**
     * ----------------------------------------
     * Default Headers
     * ----------------------------------------
     */

    static headers(extra = {}) {

        const token = Auth?.token
            ? Auth.token()
            : Utils.storage.get("stayed_token");

        const headers = {

            Accept: "application/json",

            ...extra

        };

        if (!(extra instanceof FormData)) {

            headers["Content-Type"] =
                "application/json";

        }

        if (token) {

            headers.Authorization =
                `Bearer ${token}`;

        }

        return headers;

    }

    /**
     * ----------------------------------------
     * Request Entry
     * ----------------------------------------
     */

    static async request(

        endpoint,

        options = {}

    ) {

        /*
        ---------------------------------------
        Development Mode
        ---------------------------------------
        */

        if (

            CONFIG.MODE === "development" &&

            window.MockAPI

        ) {

            return MockAPI.request(

                endpoint,

                options

            );

        }

        /*
        ---------------------------------------
        Production
        ---------------------------------------
        */

        const controller =

            new AbortController();

        const timeout =

            setTimeout(

                () => controller.abort(),

                this.TIMEOUT

            );

        try {

            const response =

                await fetch(

                    `${this.BASE_URL}${endpoint}`,

                    {

                        ...options,

                        signal:

                            controller.signal

                    }

                );

            clearTimeout(timeout);

            return await this.handleResponse(

                response

            );

        }

        catch (error) {

            clearTimeout(timeout);

            return this.handleError(error);

        }

    }

    /**
     * ----------------------------------------
     * HTTP Fetch Request
     * ----------------------------------------
     */

    static async fetchRequest(

        endpoint,

        options

    ) {

        const controller =

            new AbortController();

        const timeout =

            setTimeout(

                () => controller.abort(),

                this.TIMEOUT

            );

        try {

            const response =

                await fetch(

                    `${this.BASE_URL}${endpoint}`,

                    {

                        ...options,

                        signal:

                            controller.signal

                    }

                );

            clearTimeout(timeout);

            return await this.handleResponse(

                response

            );

        }

        catch (error) {

            clearTimeout(timeout);

            return this.handleError(

                error

            );

        }

    }

    /**
     * ----------------------------------------
     * Response Handler
     * ----------------------------------------
     */

    static async handleResponse(

        response

    ) {

        const type =

            response.headers.get(

                "content-type"

            ) || "";

        let data = null;

        if (

            type.includes(

                "application/json"

            )

        ) {

            data =

                await response.json();

        }

        else {

            data =

                await response.text();

        }

        if (

            !response.ok

        ) {

            throw {

                status:

                    response.status,

                data

            };

        }

        return data;

    }

    /**
     * ----------------------------------------
     * Error Handler
     * ----------------------------------------
     */

    static handleError(error) {

        console.error(

            "[StayEd API]",

            error

        );

        if (

            error.name === "AbortError"

        ) {

            throw new Error(

                "The request timed out."

            );

        }

        if (

            error.status === 401

        ) {

            if (

                window.Auth

            ) {

                Auth.clearSession();

            }

            throw new Error(

                "Your session has expired."

            );

        }

        if (

            error.status === 403

        ) {

            throw new Error(

                "You are not authorized to perform this action."

            );

        }

        if (

            error.status === 404

        ) {

            throw new Error(

                "The requested resource could not be found."

            );

        }

        if (

            error.status >= 500

        ) {

            throw new Error(

                "The server encountered an unexpected error."

            );

        }

        if (

            error.data

        ) {

            throw error.data;

        }

        throw error;

    }

    /**
     * ----------------------------------------
     * GET
     * ----------------------------------------
     */

    static get(

        endpoint

    ) {

        return this.request(

            endpoint,

            {

                method: "GET",

                headers:

                    this.headers()

            }

        );

    }

    /**
     * ----------------------------------------
     * POST
     * ----------------------------------------
     */

    static post(

        endpoint,

        body = {}

    ) {

        return this.request(

            endpoint,

            {

                method: "POST",

                headers:

                    this.headers(),

                body:

                    JSON.stringify(body)

            }

        );

    }

    /**
     * ----------------------------------------
     * PUT
     * ----------------------------------------
     */

    static put(

        endpoint,

        body = {}

    ) {

        return this.request(

            endpoint,

            {

                method: "PUT",

                headers:

                    this.headers(),

                body:

                    JSON.stringify(body)

            }

        );

    }

    /**
     * ----------------------------------------
     * PATCH
     * ----------------------------------------
     */

    static patch(

        endpoint,

        body = {}

    ) {

        return this.request(

            endpoint,

            {

                method: "PATCH",

                headers:

                    this.headers(),

                body:

                    JSON.stringify(body)

            }

        );

    }

    /**
     * ----------------------------------------
     * DELETE
     * ----------------------------------------
     */

    static delete(

        endpoint

    ) {

        return this.request(

            endpoint,

            {

                method: "DELETE",

                headers:

                    this.headers()

            }

        );

    }

    /**
     * ----------------------------------------
     * HEAD
     * ----------------------------------------
     */

    static head(

        endpoint

    ) {

        return this.request(

            endpoint,

            {

                method: "HEAD",

                headers:

                    this.headers()

            }

        );

    }

    /**
     * ----------------------------------------
     * OPTIONS
     * ----------------------------------------
     */

    static options(

        endpoint

    ) {

        return this.request(

            endpoint,

            {

                method: "OPTIONS",

                headers:

                    this.headers()

            }

        );

    }

    /**
     * ----------------------------------------
     * File Upload
     * ----------------------------------------
     */

    static upload(

        endpoint,

        formData

    ) {

        const token =

            Auth?.token
                ? Auth.token()
                : Utils.storage.get("stayed_token");

        const headers = {};

        if (token) {

            headers.Authorization =
                `Bearer ${token}`;

        }

        return this.request(

            endpoint,

            {

                method: "POST",

                headers,

                body: formData

            }

        );

    }

    /**
     * ----------------------------------------
     * Build Query String
     * ----------------------------------------
     */

    static query(

        params = {}

    ) {

        const search =

            new URLSearchParams();

        Object.entries(params)

            .forEach(

                ([key, value]) => {

                    if (

                        value !== undefined &&

                        value !== null &&

                        value !== ""

                    ) {

                        search.append(

                            key,

                            value

                        );

                    }

                }

            );

        return search.toString()

            ? `?${search}`

            : "";

    }

    /**
     * ----------------------------------------
     * Download File
     * ----------------------------------------
     */

    static async download(

        endpoint,

        filename

    ) {

        const response =

            await fetch(

                `${this.BASE_URL}${endpoint}`,

                {

                    method: "GET",

                    headers:

                        this.headers()

                }

            );

        if (

            !response.ok

        ) {

            throw new Error(

                "Download failed."

            );

        }

        const blob =

            await response.blob();

        const url =

            URL.createObjectURL(blob);

        const link =

            document.createElement("a");

        link.href = url;

        link.download = filename;

        document.body.appendChild(link);

        link.click();

        link.remove();

        URL.revokeObjectURL(url);

    }

    /**
     * ----------------------------------------
     * Retry Helper
     * ----------------------------------------
     */

    static async retry(

        callback,

        attempts = 3

    ) {

        let lastError;

        for (

            let i = 0;

            i < attempts;

            i++

        ) {

            try {

                return await callback();

            }

            catch (error) {

                lastError = error;

            }

        }

        throw lastError;

    }

    /**
     * ----------------------------------------
     * Health Check
     * ----------------------------------------
     */

    static health() {

        return this.get(

            "/health"

        );

    }

    /**
     * ----------------------------------------
     * Connectivity Test
     * ----------------------------------------
     */

    static async ping() {

        if (

            this.MODE === "development" &&

            window.MockAPI

        ) {

            return true;

        }

        try {

            await fetch(

                this.BASE_URL,

                {

                    method: "HEAD"

                }

            );

            return true;

        }

        catch {

            return false;

        }

    }

    /**
     * ----------------------------------------
     * Endpoint Builder
     * ----------------------------------------
     */

    static endpoint(

        resource,

        id = null

    ) {

        return id

            ? `/${resource}/${id}`

            : `/${resource}`;

    }

    /**
     * ----------------------------------------
     * Version
     * ----------------------------------------
     */

    static version() {

        return {

            name: "StayEd API",

            version: "2.0.0",

            mode: this.MODE,

            baseURL: this.BASE_URL

        };

    }

    /* ==========================================
       DOMAIN METHODS
       ------------------------------------------
       Named, intention-revealing wrappers around
       the transport verbs above. Page code calls
       these — never raw endpoints — so the switch
       from MockAPI to the real Flask backend needs
       no page changes.
    ========================================== */

    /* --- Authentication --- */

    static login(credentials) {
        return this.post("/auth/login", credentials);
    }

    static register(data) {
        return this.post("/auth/register", data);
    }

    static logout() {
        return this.post("/auth/logout");
    }

    static currentUser() {
        return this.get("/auth/me");
    }

    static forgotPassword(email) {
        return this.post("/auth/forgot-password", { email });
    }

    static resetPassword(payload) {
        return this.post("/auth/reset-password", payload);
    }

    static changePassword(payload) {
        return this.post("/auth/change-password", payload);
    }

    /* --- Notifications --- */

    static getNotifications() {
        return this.get("/notifications");
    }

    static markNotificationRead(id) {
        return this.post(`/notifications/${id}/read`);
    }

    static markAllNotificationsRead() {
        return this.post("/notifications/read-all");
    }

    static deleteNotification(id) {
        return this.delete(`/notifications/${id}`);
    }

    /* --- Community Learning Centers --- */

    static getClcs() {
        return this.get("/clcs");
    }

    static getCurrentClc() {
        return this.get("/clcs/current");
    }

    static createClc(payload) {
        return this.post("/clcs", payload);
    }

    /* --- Classes --- */

    static getClasses() {
        return this.get("/classes");
    }

    /*
     * DEMO MODE BRANCH POINT
     * When CONFIG.DEMO_MODE is on (see config.js) and a
     * demo onboarding session is active, class creation
     * is simulated by DemoAuthService so the setup wizard
     * works with no backend at all. Remove this branch
     * once self-serve registration is live — the
     * post("/classes", payload) call below already
     * matches the real endpoint contract.
     */
    static createClass(payload) {

        if (window.DemoAuthService && DemoAuthService.isEnabled()
            && DemoAuthService.hasActiveSession()) {
            return DemoAuthService.createOrganization(payload);
        }

        return this.post("/classes", payload);
    }

    /* Most recently created class (used by the setup wizard) */
    static getCurrentClass() {

        if (window.DemoAuthService && DemoAuthService.isEnabled()
            && DemoAuthService.hasActiveSession()) {
            const session = DemoAuthService.getSession();
            return Promise.resolve(session.organization || {});
        }

        return this.get("/classes/current");
    }

    /* --- Learners --- */

    static getLearners(params = {}) {
        const qs =
            params && Object.keys(params).length
                ? "?" + new URLSearchParams(params).toString()
                : "";
        return this.get(`/learners${qs}`);
    }

    static getLearner(id) {
        return this.get(`/learners/${id}`);
    }

    static getLearnerProfile(id) {
        return this.get(`/learners/${id}/profile`);
    }

    static getLearnerRecordsDetail(id) {
        return this.get(`/learners/${id}/records-detail`);
    }

    static createLearner(payload) {
        return this.post("/learners", payload);
    }

    static updateLearner(id, payload) {
        return this.put(`/learners/${id}`, payload);
    }

    static deleteLearner(id) {
        return this.delete(`/learners/${id}`);
    }

    /* Bulk import from a parsed CSV/Excel dataset */
    static uploadLearners(payload) {
        return this.post("/learners/import", payload);
    }

    /* Alias used by the setup wizard */
    static importLearners(payload) {
        return this.post("/learners/import", payload);
    }

    /* Row-level validation preview before committing an import */
    static getImportPreview(filename) {
        return this.post("/learners/import/preview", { filename });
    }

    /* Import summary for the just-uploaded dataset */
    static getImportedLearners() {
        return this.get("/learners/import/summary");
    }

    /* --- Dashboard --- */

    static getDashboard() {
        return this.get("/teacher/dashboard");
    }

    /* --- Predictive Analytics --- */

    static getPredictionSummary() {
        return this.get("/predictions/summary");
    }

    static getRiskDistribution() {
        return this.get("/predictions/risk-distribution");
    }

    static getInterventions() {
        return this.get("/interventions");
    }

}

/* ==========================================
   Export
========================================== */

window.API = API;

/* ==========================================
   Initialization
========================================== */

document.addEventListener(

    "DOMContentLoaded",

    async () => {

        console.log(

            "%cStayEd API Ready",

            "color:#006A68;font-weight:bold;"

        );

        console.table(

            API.version()

        );

        const online =

            await API.ping();

        if (online) {

            console.log(

                "%cAPI Connection Established",

                "color:#2E7D32;font-weight:bold;"

            );

        }

        else {

            console.warn(

                "StayEd backend is currently unreachable."

            );

        }

    }

);