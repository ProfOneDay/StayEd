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
    }

    // For every real HTTP error response, prefer the backend's own message
    // (error.data.message, set by the shared `error()` helper server-side)
    // over a generic fallback -- discarding it here previously meant a
    // caller checking `error?.data?.message` silently got `undefined` even
    // when the server sent a specific, useful reason for the failure.
    if (error.status) {
      const fallback = {
        401: "Your session has expired.",
        403: "You are not authorized to perform this action.",
        404: "The requested resource could not be found.",
      }[error.status] || (error.status >= 500 ? "The server encountered an unexpected error." : "The request could not be completed.");

      const apiError = new Error(error?.data?.message || fallback);
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
    if (window.CONFIG?.USE_MOCK_API || window.CONFIG?.DEMO_MODE) {
      return Promise.resolve(this.mockNotifications());
    }

    return this.get("/notifications").catch(() => this.mockNotifications());
  }

  static mockNotificationKey() {
    const role = window.Auth?.role ? Auth.role() : "teacher";
    return `stayed_demo_notifications_${role || "teacher"}`;
  }

  static mockNotificationSeed() {
    return [
      {
        id: 1,
        type: "risk",
        title: "High-risk learner follow-up",
        message: "Three high-risk learners in San Jose CLC, Binalonan municipality, need intervention review this week.",
        read: false,
        time: "2 hours ago",
        metaLabel: "High",
        link: "dashboard.html?municipality=binalonan",
      },
      {
        id: 2,
        type: "system",
        title: "System update",
        message: "The demo database has been refreshed for testing and sample data review.",
        read: true,
        time: "Yesterday",
        metaLabel: "Demo",
        link: "settings.html",
      },
    ];
  }

  static mockNotifications() {
    const key = this.mockNotificationKey();
    let notifications;

    try {
      notifications = JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      notifications = null;
    }

    if (Array.isArray(notifications)) {
      notifications = notifications.filter(
        (notification) => notification.title !== "New learner registration",
      );
      notifications = notifications.map((notification) =>
        notification.title === "High-risk learner follow-up"
          ? {
              ...notification,
              message: "Three high-risk learners in San Jose CLC, Binalonan municipality, need intervention review this week.",
              link: "dashboard.html?municipality=binalonan",
            }
          : notification,
      );
    }

    if (!Array.isArray(notifications)) {
      notifications = this.mockNotificationSeed();
    }

    localStorage.setItem(key, JSON.stringify(notifications));

    return {
      data: notifications,
    };
  }

  static updateMockNotifications(update) {
    const current = this.mockNotifications().data;
    const next = update(current);
    localStorage.setItem(this.mockNotificationKey(), JSON.stringify(next));
    return { data: next };
  }

  static addMockTeacherRegistration(fullName, email) {
    const key = "stayed_demo_notifications_admin";
    let notifications;

    try {
      notifications = JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      notifications = null;
    }

    notifications = Array.isArray(notifications)
      ? notifications.filter((notification) => notification.title !== "New learner registration")
      : this.mockNotificationSeed();

    notifications.unshift({
      id: Date.now(),
      type: "info",
      title: "New Teacher Registration",
      message: `${fullName} (${email}) has registered and is awaiting approval.`,
      read: false,
      time: "Just now",
      metaLabel: "Pending",
      link: "user-management.html",
    });
    localStorage.setItem(key, JSON.stringify(notifications));
  }

  static mockEnrollmentListing() {
    return {
      data: [
        {
          learner_id: 101,
          lrn: "123456789012",
          first_name: "Maria",
          last_name: "Santos",
          sex: "Female",
          enrollment_id: 1,
          enrollment_status: "ENROLLED",
          enrollment_date: "2026-08-01",
          learning_modality: "FACE_TO_FACE",
          class_id: 11,
          class_name: "Elementary 2026",
          learning_level: "ELEMENTARY",
          school_year: "2026-2027",
          semester: "FIRST",
          clc_id: 1,
          clc_name: "San Jose CLC",
          teacher_id: 21,
          teacher_name: "Ana Dela Cruz",
        },
        {
          learner_id: 102,
          lrn: "123456789013",
          first_name: "Jose",
          last_name: "Reyes",
          sex: "Male",
          enrollment_id: 2,
          enrollment_status: "ENROLLED",
          enrollment_date: "2026-08-02",
          learning_modality: "MODULAR",
          class_id: 12,
          class_name: "JHS 2026",
          learning_level: "JUNIOR_HIGH_SCHOOL",
          school_year: "2026-2027",
          semester: "SECOND",
          clc_id: 2,
          clc_name: "Mabini CLC",
          teacher_id: 22,
          teacher_name: "Ramon Castro",
        },
        {
          learner_id: 103,
          lrn: "123456789014",
          first_name: "Cristina",
          last_name: "Luna",
          sex: "Female",
          enrollment_id: 3,
          enrollment_status: "ENROLLED",
          enrollment_date: "2026-08-03",
          learning_modality: "BLENDED",
          class_id: 13,
          class_name: "SHS 2026",
          learning_level: "SENIOR_HIGH_SCHOOL",
          school_year: "2026-2027",
          semester: "SUMMER",
          clc_id: 3,
          clc_name: "Laoac CLC",
          teacher_id: 23,
          teacher_name: "Joel Mendoza",
        },
        {
          learner_id: 104,
          lrn: "123456789015",
          first_name: "Ruben",
          last_name: "Bautista",
          sex: "Male",
          enrollment_id: 4,
          enrollment_status: "ENROLLED",
          enrollment_date: "2026-08-04",
          learning_modality: "FACE_TO_FACE",
          class_id: 14,
          class_name: "Elementary 2026",
          learning_level: "ELEMENTARY",
          school_year: "2025-2026",
          semester: "WHOLE_YEAR",
          clc_id: 1,
          clc_name: "San Jose CLC",
          teacher_id: 21,
          teacher_name: "Ana Dela Cruz",
        },
        {
          learner_id: 105,
          lrn: "123456789016",
          first_name: "Leah",
          last_name: "Navarro",
          sex: "Female",
          enrollment_id: 5,
          enrollment_status: "ENROLLED",
          enrollment_date: "2026-08-05",
          learning_modality: "MODULAR",
          class_id: 15,
          class_name: "BLP 2026",
          learning_level: "BLP",
          school_year: "2025-2026",
          semester: "FIRST",
          clc_id: 4,
          clc_name: "Aguilar CLC",
          teacher_id: 24,
          teacher_name: "Sofia Ramos",
        },
      ],
    };
  }

  static markNotificationRead(id) {
    if (window.CONFIG?.USE_MOCK_API || window.CONFIG?.DEMO_MODE) {
      return Promise.resolve(this.updateMockNotifications((notifications) =>
        notifications.map((notification) =>
          String(notification.id) === String(id)
            ? { ...notification, read: true }
            : notification,
        ),
      ));
    }

    return this.post(`/notifications/${id}/read`);
  }

  static markAllNotificationsRead() {
    if (window.CONFIG?.USE_MOCK_API || window.CONFIG?.DEMO_MODE) {
      return Promise.resolve(this.updateMockNotifications((notifications) =>
        notifications.map((notification) => ({ ...notification, read: true })),
      ));
    }

    return this.post("/notifications/read-all");
  }

  static deleteNotification(id) {
    if (window.CONFIG?.USE_MOCK_API || window.CONFIG?.DEMO_MODE) {
      return Promise.resolve(this.updateMockNotifications((notifications) =>
        notifications.filter((notification) => String(notification.id) !== String(id)),
      ));
    }

    return this.delete(`/notifications/${id}`);
  }

  static getTeacherClasses() {
    return this.get("/teacher-classes");
  }

  static getClcs() {
    return this.get("/clcs");
  }

  static getTeacherClcs() {
    return this.get("/teacher/clcs");
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

  static getClassModules(classId) {
    return this.get(`/classes/${classId}/modules`);
  }

  static createClassModule(classId, payload) {
    return this.post(`/classes/${classId}/modules`, payload);
  }

  static updateClassModule(classId, classModuleId, payload) {
    return this.put(`/classes/${classId}/modules/${classModuleId}`, payload);
  }

  static archiveClassModule(classId, classModuleId) {
    return this.post(`/classes/${classId}/modules/${classModuleId}/archive`);
  }

  static unarchiveClassModule(classId, classModuleId) {
    return this.post(`/classes/${classId}/modules/${classModuleId}/unarchive`);
  }

  static releaseClassModule(classId, classModuleId, payload) {
    return this.post(`/classes/${classId}/modules/${classModuleId}/release`, payload);
  }

  static getClassModuleRoster(classId, classModuleId) {
    return this.get(`/classes/${classId}/modules/${classModuleId}/roster`);
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

  static editModuleBatch(learnerId, batchId, payload) {
    return this.put(`/learners/${learnerId}/module-batches/${batchId}`, payload);
  }

  static deleteModuleBatch(learnerId, batchId) {
    return this.delete(`/learners/${learnerId}/module-batches/${batchId}`);
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

  static deleteClassSession(classId, sessionId) {
    return this.delete(`/classes/${classId}/sessions/${sessionId}`);
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

  static runPrediction(learnerId) {
    return this.post("/predictions/run", { learner_id: learnerId });
  }

  static getLearnerRecordsDetail(id) {
    return this.get(`/learners/${id}/records-detail`);
  }

  static getLearnerSessionSchedule(id) {
    return this.get(`/learners/${id}/session-schedule`);
  }

  static updateLearnerSessionSchedule(id, payload) {
    return this.put(`/learners/${id}/session-schedule`, payload);
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

  
  static moveInterventionToHistory(id) {
    return this.post(`/interventions/${id}/move-to-history`, {});
  }

  static addInterventionFollowUp(id, payload) {
    return this.post(`/interventions/${id}/follow-up`, payload);
  }
  static deleteIntervention(id) {
    return this.delete(`/interventions/${id}`);
  }

  static getAtRiskReport(params = {}) {
    const qs = params && Object.keys(params).length ? this.query(params) : "";
    return this.get(`/reports/at-risk${qs}`);
  }

  static getInterventionReport(params = {}) {
    const qs = params && Object.keys(params).length ? this.query(params) : "";
    return this.get(`/reports/interventions${qs}`);
  }

  static getClassListReport(params = {}) {
    const qs = params && Object.keys(params).length ? this.query(params) : "";
    return this.get(`/reports/class-list${qs}`);
  }

  static getAttendanceReport(params = {}) {
    const qs = params && Object.keys(params).length ? this.query(params) : "";
    return this.get(`/reports/attendance-list${qs}`);
  }

  static getEnrollmentListingReport() {
    if (window.CONFIG?.USE_MOCK_API || window.CONFIG?.DEMO_MODE) {
      return Promise.resolve(this.mockEnrollmentListing());
    }

    return this.get("/reports/enrollment-listing").catch(() => this.mockEnrollmentListing());
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
