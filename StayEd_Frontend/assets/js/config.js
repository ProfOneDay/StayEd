const CONFIG = {
  APP_NAME: "StayEd",

  VERSION: "1.1.0",

  MODE: "development",

  // Local dev (localhost / 127.0.0.1) talks to Flask on port 5000.
  // On the deployed site, nginx serves the frontend and forwards /api to
  // the backend on the same domain, so a relative URL works everywhere.
  API_URL: ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://127.0.0.1:5000/api"
    : "/api",

  MOCK_DELAY: 400,

  // Use the live Flask backend and PostgreSQL database.
  USE_MOCK_API: false,

  DEBUG: true,

  DEMO_MODE: false,
};

window.CONFIG = CONFIG;
