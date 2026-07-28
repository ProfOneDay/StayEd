const MockDB = {
  system: {
    app_name: "StayEd",

    version: CONFIG.VERSION,

    school_year: "2026-2027",

    semester: "First Semester",

    mode: CONFIG.MODE,
  },

  users: [
    {
      id: 1,

      role: "admin",

      email: "admin@stayed.com",

      password: "123456",

      first_name: "Maria",

      last_name: "Gonzales",

      full_name: "Maria Gonzales",

      school: "Division Office",

      avatar: "../../assets/images/avatar.png",
    },

    {
      id: 2,

      role: "teacher",

      email: "teacher@stayed.com",

      password: "123456",

      first_name: "Trisha",

      last_name: "Santos",

      full_name: "Trisha Santos",

      school: "San Carlos ALS CLC",

      avatar: "../../assets/images/avatar.png",
    },
  ],

  learners: [],

  attendance: [],

  alerts: [],

  clcs: [],

  reports: [],

  uploads: [],

  settings: {},

  findUser(email) {
    return (
      this.users.find(
        (user) => user.email.toLowerCase() === String(email).toLowerCase(),
      ) || null
    );
  },

  findUserById(id) {
    return this.users.find((user) => Number(user.id) === Number(id)) || null;
  },

  findLearner(id) {
    return (
      this.learners.find((learner) => Number(learner.id) === Number(id)) || null
    );
  },

  findLearnerByLrn(lrn) {
    if (!lrn) return null;

    const normalized = String(lrn).trim();

    return this.learners.find((learner) => learner.lrn === normalized) || null;
  },

  nextId(collection) {
    if (!Array.isArray(collection) || collection.length === 0) {
      return 1;
    }

    return Math.max(...collection.map((item) => Number(item.id) || 0)) + 1;
  },

  insert(collection, record) {
    collection.push(record);

    return record;
  },

  update(collection, id, changes) {
    const record = collection.find((item) => Number(item.id) === Number(id));

    if (!record) {
      return null;
    }

    Object.assign(
      record,

      changes,
    );

    return record;
  },

  remove(collection, id) {
    const index = collection.findIndex(
      (item) => Number(item.id) === Number(id),
    );

    if (index === -1) {
      return false;
    }

    collection.splice(
      index,

      1,
    );

    return true;
  },

  clone(data) {
    return JSON.parse(JSON.stringify(data));
  },

  rememberCurrent(key, value) {
    this[key] = value;

    try {
      sessionStorage.setItem(`stayed_mock_${key}`, JSON.stringify(value));
    } catch {}
  },

  recallCurrent(key) {
    if (this[key]) {
      return this[key];
    }

    try {
      const raw = sessionStorage.getItem(`stayed_mock_${key}`);

      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  reset() {
    this.learners = [];

    this.attendance = [];

    this.alerts = [];

    this.clcs = [];

    this.reports = [];

    this.uploads = [];

    this.settings = {};

    console.info(
      "%cMockDB Reset",

      "color:#EF6C00;font-weight:bold;",
    );
  },

  seed() {
    console.info(
      "%cMockDB Seeded",

      "color:#2E7D32;font-weight:bold;",
    );

    return this;
  },
};

window.MockDB = MockDB;

document.addEventListener(
  "DOMContentLoaded",

  () => {
    if (CONFIG.MODE !== "development") {
      return;
    }

    MockDB.seed();

    console.log(
      "%cStayEd Mock Database Ready",

      "color:#006A68;font-weight:bold;",
    );
  },
);
