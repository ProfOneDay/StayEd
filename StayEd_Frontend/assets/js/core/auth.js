class Auth {
  static TOKEN_KEY = "stayed_token";

  static USER_KEY = "stayed_user";

  static async login(credentials) {
    const response = await API.post(
      "/auth/login",

      credentials,
    );

    if (!response.token) {
      throw new Error("Invalid login response.");
    }

    this.saveSession(
      response.token,

      response.user,
    );

    return response;
  }

  static saveSession(token, user) {
    Utils.storage.set(
      this.TOKEN_KEY,

      token,
    );

    Utils.storage.set(
      this.USER_KEY,

      user,
    );
  }

  static seedDemoSession(account) {
    account = account || {};

    const header = { alg: "HS256", typ: "JWT" };

    const payload = {
      id: account.id || "demo",
      role: "teacher",
      exp: Math.floor(Date.now() / 1000) + 86400,
    };

    const encode = (obj) => btoa(JSON.stringify(obj)).replace(/=+$/, "");

    const token = `${encode(header)}.${encode(payload)}.demo`;

    this.saveSession(token, {
      id: payload.id,
      role: "teacher",
      full_name: account.full_name || "Demo Teacher",
      email: account.email || "demo.teacher@deped.gov.ph",
      status: "approved",
    });
  }

  static clearSession() {
    Utils.storage.remove(this.TOKEN_KEY);

    Utils.storage.remove(this.USER_KEY);
  }

  static token() {
    return Utils.storage.get(this.TOKEN_KEY);
  }

  static user() {
    return Utils.storage.get(this.USER_KEY);
  }

  static authenticated() {
    return Boolean(this.token());
  }

  static role() {
  const user = this.user();

  return String(user?.role || "")
    .trim()
    .toLowerCase();
}

  static id() {
    const user = this.user();

    return user ? user.id : null;
  }

  static name() {
    const user = this.user();

    if (!user) {
      return "";
    }

    return (
      user.full_name ||
      [user.first_name, user.last_name]

        .filter(Boolean)

        .join(" ")
    );
  }

  static async logout() {
    try {
      if (window.API) {
        await API.post("/auth/logout");
      }
    } catch (error) {
      console.warn(error);
    }

    this.clearSession();

    window.location.href = "../auth/login.html";
  }

  static restore() {
    if (!this.authenticated()) {
      return null;
    }

    return this.user();
  }

  static async refresh() {
    const user = await API.get("/auth/me");

    Utils.storage.set(
      this.USER_KEY,

      user,
    );

    return user;
  }

  static updateUser(data = {}) {
    const current = this.user() || {};

    const updated = {
      ...current,

      ...data,
    };

    Utils.storage.set(
      this.USER_KEY,

      updated,
    );

    return updated;
  }

  static redirectAfterLogin() {
    const role = this.role();

    switch (role) {
      case "admin":
        window.location.href = "../admin/dashboard.html";

        break;

      case "teacher":
        window.location.href = "../teacher/dashboard.html";

        break;

      default:
        window.location.href = "../auth/login.html";
    }
  }

  static requireAuth() {
    if (!this.authenticated()) {
      window.location.href = "../auth/login.html";
    }
  }

  static requireRole(...roles) {
    if (!roles.includes(this.role())) {
      window.location.href = "../auth/login.html";
    }
  }

  static tokenExpired() {
    const token = this.token();

    if (!token) {
      return true;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));

      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }

  static validateSession() {
    if (!this.authenticated()) {
      return false;
    }

    if (this.tokenExpired()) {
      this.clearSession();

      return false;
    }

    return true;
  }

  static async changePassword(data) {
    return API.post(
      "/auth/change-password",

      data,
    );
  }

  static async forgotPassword(email) {
    return API.post(
      "/auth/forgot-password",

      {
        email,
      },
    );
  }

  static async resetPassword(data) {
    return API.post(
      "/auth/reset-password",

      data,
    );
  }

  static async register(data) {
    return API.post(
      "/auth/register",

      data,
    );
  }

  static async verifyEmail(token) {
    return API.post(
      "/auth/verify-email",

      {
        token,
      },
    );
  }

  static async updateProfile(data) {
    const user = await API.put(
      "/users/profile",

      data,
    );

    this.updateUser(user);

    return user;
  }

  static initialize() {
    if (!this.validateSession()) {
      return;
    }

    const user = this.restore();

    if (user) {
      console.log(
        `%cWelcome back, ${this.name()}`,

        "color:#12355B;font-weight:bold;",
      );
    }
  }

  static redirectIfAuthenticated() {
    if (!this.validateSession()) {
      return;
    }

    const path = window.location.pathname.toLowerCase();

    if (
      path.includes("/auth/login") ||
      path.includes("/auth/register") ||
      path.includes("/auth/forgot")
    ) {
      this.redirectAfterLogin();
    }
  }

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

window.Auth = Auth;

document.addEventListener(
  "DOMContentLoaded",

  () => {
    Auth.initialize();

    Auth.redirectIfAuthenticated();

    console.log(
      "%cStayEd Authentication Ready",

      "color:#006A68;font-weight:bold;",
    );
  },
);
