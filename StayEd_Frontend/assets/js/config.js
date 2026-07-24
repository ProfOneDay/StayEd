/**
 * ============================================
 * StayEd
 * Configuration
 * ============================================
 */

const CONFIG = {

    APP_NAME: "StayEd",

    VERSION: "1.0.0",

    MODE: "development",   // development | production

    API_URL: "http://localhost:3000/api",

    MOCK_DELAY: 400,

    DEBUG: true,

    /*
     * DEMO_MODE lets "Create Account" launch the full
     * setup wizard without a connected backend, using
     * DemoAuthService (assets/js/demo/demo-auth-service.js)
     * instead of the real registration endpoint. Set to
     * false once self-serve registration is live.
     */
    DEMO_MODE: true

};

window.CONFIG = CONFIG;