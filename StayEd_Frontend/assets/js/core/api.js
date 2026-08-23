class API {
  static BASE_URL = CONFIG.API_URL;

  static TIMEOUT = 15000;

  static get MODE() {
    return CONFIG.MODE || "development";
  }

  static headers(extra = {}) {
    const token = Auth?.token
      ? Auth.token()
      : Utils.storage.get("stayed_token");

    const headers = {
      Accept: "application/json",

      ...extra,
    };

    if (!(extra instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  static async request(
    endpoint,

    options = {},
  ) {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),

      this.TIMEOUT,
    );

    try {
      const response = await fetch(
        `${this.BASE_URL}${endpoint}`,

        {
          ...options,

          signal: controller.signal,
        },
      );

      clearTimeout(timeout);

      return await this.handleResponse(response);
    } catch (error) {
      clearTimeout(timeout);

      return this.handleError(error);
    }
  }

  static async fetchRequest(
    endpoint,

    options,
  ) {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),

      this.TIMEOUT,
    );

    try {
      const response = await fetch(
        `${this.BASE_URL}${endpoint}`,

        {
          ...options,

          signal: controller.signal,
        },
      );

      clearTimeout(timeout);

      return await this.handleResponse(response);
    } catch (error) {
      clearTimeout(timeout);

      return this.handleError(error);
    }
  }

  static async handleResponse(response) {
    const type = response.headers.get("content-type") || "";

    let data = null;

    if (type.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      throw {
        status: response.status,

        data,
      };
    }

    return data;
  }

  static handleError(error) {
    console.error(
      "[StayEd API]",

      error,
    );

    if (error.name === "AbortError") {
      throw new Error("The request timed out.");
    }

    if (error.status === 401) {
      if (window.Auth) {
        Auth.clearSession();
      }

      throw new Error("Your session has expired.");
    }

    if (error.status === 403) {
      throw new Error("You are not authorized to perform this action.");
    }

    if (error.status === 404) {
      throw new Error("The requested resource could not be found.");
    }

    if (error.status >= 500) {
      throw new Error("The server encountered an unexpected error.");
    }

    if (error.data) {
      const apiError = new Error(
        error.data.message || "The request could not be completed."
      );
      apiError.status = error.status;
      apiError.data = error.data;

      throw apiError;
    }

    throw error;
  }

  static get(endpoint) {
    return this.request(
      endpoint,

      {
        method: "GET",

        headers: this.headers(),
      },
    );
  }

  static post(
    endpoint,

    body = {},
  ) {
    return this.request(
      endpoint,

      {
        method: "POST",

        headers: this.headers(),

        body: JSON.stringify(body),
      },
    );
  }

  static put(
    endpoint,

    body = {},
  ) {
    return this.request(
      endpoint,

      {
        method: "PUT",

        headers: this.headers(),

        body: JSON.stringify(body),
      },
    );
  }

  static patch(
    endpoint,

    body = {},
  ) {
    return this.request(
      endpoint,

      {
        method: "PATCH",

        headers: this.headers(),

        body: JSON.stringify(body),
      },
    );
  }

  static delete(endpoint) {
    return this.request(
      endpoint,

      {
        method: "DELETE",

        headers: this.headers(),
      },
    );
  }

  static head(endpoint) {
    return this.request(
      endpoint,

      {
        method: "HEAD",

        headers: this.headers(),
      },
    );
  }

  static options(endpoint) {
    return this.request(
      endpoint,

      {
        method: "OPTIONS",

        headers: this.headers(),
      },
    );
  }

  static upload(
    endpoint,

    formData,
  ) {
    const token = Auth?.token
      ? Auth.token()
      : Utils.storage.get("stayed_token");

    const headers = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return this.request(
      endpoint,

      {
        method: "POST",

        headers,

        body: formData,
      },
    );
  }

  static query(params = {}) {
    const search = new URLSearchParams();

    Object.entries(params)

      .forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          search.append(
            key,

            value,
          );
        }
      });

    return search.toString() ? `?${search}` : "";
  }

  static async download(
    endpoint,

    filename,
  ) {
    const response = await fetch(
      `${this.BASE_URL}${endpoint}`,

      {
        method: "GET",

        headers: this.headers(),
      },
    );

    if (!response.ok) {
      throw new Error("Download failed.");
    }

    const blob = await response.blob();

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
  }

  static async retry(
    callback,

    attempts = 3,
  ) {
    let lastError;

    for (let i = 0; i < attempts; i++) {
      try {
        return await callback();
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }

  static health() {
    return this.get("/health");
  }

  static async ping() {
    try {
      await fetch(
        this.BASE_URL,

        {
          method: "HEAD",
        },
      );

      return true;
    } catch {
      return false;
    }
  }

  static endpoint(
    resource,

    id = null,
  ) {
    return id ? `/${resource}/${id}` : `/${resource}`;
  }

  static version() {
    return {
      name: "StayEd API",

      version: "2.0.0",

      mode: this.MODE,

      baseURL: this.BASE_URL,
    };
  }

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

  static getTeacherClasses() {
    return this.get("/teacher-classes");
  }

  static getClcs() {
    return this.get("/clcs");
  }

  static getCurrentClc() {
    return this.get("/clcs/current");
  }

  static getActiveSchoolYear() {
    return this.get("/settings/school-year");
  }

  static updateActiveSchoolYear(schoolYear) {
    return this.put("/admin/settings/school-year", { schoolYear });
  }

  static createClc(payload) {
    return this.post("/clcs", payload);
  }

  static getClasses() {
    return this.get("/classes");
  }

  static createClass(payload) {
    if (
      window.DemoAuthService &&
      DemoAuthService.isEnabled() &&
      DemoAuthService.hasActiveSession()
    ) {
      return DemoAuthService.createOrganization(payload);
    }

    return this.post("/classes", payload);
  }

  static deleteClass(id) {
    return this.delete(`/classes/${id}`);
  }

  static getModuleLogbook(learnerId) {
    return this.get(`/learners/${learnerId}/modules`);
  }

  static releaseModuleBatch(learnerId, payload) {
    return this.post(`/learners/${learnerId}/module-batches`, payload);
  }

  static returnModuleBatch(learnerId, batchId, payload) {
    return this.post(`/learners/${learnerId}/module-batches/${batchId}/return`, payload);
  }

  static updateModulePlannedReturn(learnerId, batchId, moduleRecordId, plannedReturnDate) {
    return this.patch(
      `/learners/${learnerId}/module-batches/${batchId}/modules/${moduleRecordId}`,
      { plannedReturnDate },
    );
  }

  static getModuleDurationSetting() {
    return this.get("/settings/module-duration");
  }

  static updateModuleDurationSetting(defaultDurationDays) {
    return this.put("/admin/settings/module-duration", { defaultDurationDays });
  }

  static getClassSessions(classId) {
    return this.get(`/classes/${classId}/sessions`);
  }

  static createClassSession(classId, date) {
    return this.post(`/classes/${classId}/sessions`, { date });
  }

  static getSessionAttendance(classId, sessionId) {
    return this.get(`/classes/${classId}/sessions/${sessionId}/attendance`);
  }

  static saveSessionAttendance(classId, sessionId, presentEnrollmentIds) {
    return this.post(`/classes/${classId}/sessions/${sessionId}/attendance`, { presentEnrollmentIds });
  }

  static recordConsultation(learnerId, payload) {
    return this.post(`/learners/${learnerId}/consultations`, payload);
  }

  static getCurrentClass() {
    if (
      window.DemoAuthService &&
      DemoAuthService.isEnabled() &&
      DemoAuthService.hasActiveSession()
    ) {
      const session = DemoAuthService.getSession();
      return Promise.resolve(session.organization || {});
    }

    return this.get("/classes/current");
  }

  static getLearners(params = {}) {
    const qs =
      params && Object.keys(params).length
        ? "?" + new URLSearchParams(params).toString()
        : "";
    return this.get(`/learners${qs}`);
  }

  static lookupLearnerByLrn(lrn) {
    return this.get(`/learners/lookup?lrn=${encodeURIComponent(lrn)}`);
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

  static uploadLearners(payload) {
    return this.post("/learners/import", payload);
  }

  static importLearners(payload) {
    if (payload instanceof File) {
      const form = new FormData();
      form.append("file", payload);
      return this.upload("/learners/import", form);
    }

    if (payload instanceof FormData) {
      return this.upload("/learners/import", payload);
    }

    return this.post("/learners/import", payload);
  }

  static getImportPreview(fileOrName) {
    if (fileOrName instanceof File) {
      const form = new FormData();
      form.append("file", fileOrName);
      return this.upload("/learners/import/preview", form);
    }

    return this.post("/learners/import/preview", { filename: fileOrName });
  }

  static revalidateImportRows(rows) {
    return this.post("/learners/import/preview", { rows });
  }

  static getImportedLearners() {
    return this.get("/learners/import/summary");
  }

  static getDashboard() {
    return this.get("/teacher/dashboard");
  }

  static getPredictionSummary() {
    return this.get("/predictions/summary");
  }

  static getSettings() {
    return this.get("/users/settings");
  }

  static updateSettings(preferences) {
    return this.put("/users/settings", { preferences });
  }

  static updateAvatar(avatar) {
    return this.put("/users/settings/avatar", { avatar });
  }

  static getAdminClcs() {
    return this.get("/admin/clcs");
  }

  static createAdminClc(payload) {
    return this.post("/admin/clcs", payload);
  }

  static updateAdminClc(id, payload) {
    return this.put(`/admin/clcs/${id}`, payload);
  }

  static archiveAdminClc(id) {
    return this.post(`/admin/clcs/${id}/archive`, {});
  }

  static restoreAdminClc(id) {
    return this.post(`/admin/clcs/${id}/restore`, {});
  }

  static assignClcTeachers(id, teacherIds, schoolYear) {
    return this.put(`/admin/clcs/${id}/teachers`, { teacherIds, schoolYear });
  }

  static getAdminDashboard() {
    return this.get("/admin/dashboard");
  }

  static getRiskDistribution() {
    return this.get("/predictions/risk-distribution");
  }

  static getInterventions() {
    return this.get("/interventions");
  }

  static createIntervention(learnerId, payload) {
    return this.post(`/learners/${learnerId}/interventions`, payload);
  }

  static updateInterventionStatus(id, payload) {
    return this.patch(`/interventions/${id}`, payload);
  }

  static addInterventionFollowUp(id, payload) {
    return this.post(`/interventions/${id}/follow-up`, payload);
  }

  static getAtRiskReport(params = {}) {
    const qs = params && Object.keys(params).length ? this.query(params) : "";
    return this.get(`/reports/at-risk${qs}`);
  }

  static getInterventionReport(params = {}) {
    const qs = params && Object.keys(params).length ? this.query(params) : "";
    return this.get(`/reports/interventions${qs}`);
  }

  static getEnrollmentListingReport() {
    return this.get("/reports/enrollment-listing");
  }
}

window.API = API;

document.addEventListener(
  "DOMContentLoaded",

  async () => {
    console.log(
      "%cStayEd API Ready",

      "color:#006A68;font-weight:bold;",
    );

    console.table(API.version());

    const online = await API.ping();

    if (online) {
      console.log(
        "%cAPI Connection Established",

        "color:#2E7D32;font-weight:bold;",
      );
    } else {
      console.warn("StayEd backend is currently unreachable.");
    }
  },
);
