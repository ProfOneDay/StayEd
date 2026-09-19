const REPORT_SEMESTER_LABELS = {
  FIRST: "First Trimester",
  SECOND: "Second Trimester",
  SUMMER: "Third Trimester",
  WHOLE_YEAR: "Whole Year",
};

const REPORT_MODALITY_LABELS = {
  FACE_TO_FACE: "Face-to-Face",
  MODULAR: "Modular",
  BLENDED: "Blended",
};

const REPORT_GROUP_LABELS = {
  clc_name: "Learning Center",
  teacher_name: "Assigned Teacher",
  semester: "Academic Semester",
  learning_modality: "Learning Delivery Mode",
};

class AdminReports {
  static state = {
    all: [],
    filtered: [],
    search: "",
    clc: "",
    schoolYear: "",
    semester: "",
    teacher: "",
    modality: "",
    groupBy: "",
    submissions: [],
    submissionSearch: "",
    submissionType: "",
    submissionStatus: "",
  };

  static async init() {
    if (window.Guards) Guards.admin();

    this.bindControls();
    this.bindSubmissionFilters();

    await Promise.all([this.load(), this.loadSubmittedReports()]);

    const submissionId = new URLSearchParams(window.location.search).get("submission");
    if (submissionId) this.viewSubmittedReport(Number(submissionId));
  }

  // ---------------------------------------------------------------------------
  // Reports from Teachers (At-Risk / Intervention / Class List / Attendance /
  // Learner Progress sent up for admin review -- see reports_routes.py
  // teacher_report_submission). Fetched once, filtered client-side -- same
  // pattern as the Master Enrollment Listing below.
  // ---------------------------------------------------------------------------

  static bindSubmissionFilters() {
    const searchInput = document.querySelector("[data-submitted-reports-search]");
    const clearBtn = document.querySelector("[data-submitted-reports-search-clear]");

    searchInput?.addEventListener("input", (e) => {
      this.state.submissionSearch = e.target.value.trim();
      clearBtn?.classList.toggle("st-hidden", !e.target.value.trim());
      this.applySubmissionFilters();
    });

    clearBtn?.addEventListener("mousedown", (e) => e.preventDefault());
    clearBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (searchInput) searchInput.value = "";
      this.state.submissionSearch = "";
      clearBtn.classList.add("st-hidden");
      this.applySubmissionFilters();
      searchInput?.focus();
    });

    document.querySelector("[data-submitted-reports-type-filter]")?.addEventListener("change", (e) => {
      this.state.submissionType = e.target.value;
      this.applySubmissionFilters();
    });

    document.querySelector("[data-submitted-reports-status-filter]")?.addEventListener("change", (e) => {
      this.state.submissionStatus = e.target.value;
      this.applySubmissionFilters();
    });

    document.querySelector("[data-notify-teachers-btn]")?.addEventListener("click", () => this.openNotifyTeachersModal());
  }

  static async loadSubmittedReports() {
    const body = document.querySelector("[data-submitted-reports-body]");
    if (!body) return;

    try {
      const res = await API.getAdminReportSubmissions();
      this.state.submissions = res.data || [];

      const badge = document.querySelector("[data-submitted-reports-unread-badge]");
      if (badge) {
        if (res.unreviewed) {
          badge.textContent = `${res.unreviewed} New`;
          badge.classList.remove("st-hidden");
        } else {
          badge.classList.add("st-hidden");
        }
      }

      this.applySubmissionFilters();
    } catch (error) {
      console.error("[AdminReports]", error);
      body.innerHTML = `<tr><td colspan="6" class="st-table-empty-cell">Unable to load reports from teachers.</td></tr>`;
    }
  }

  static applySubmissionFilters() {
    const { submissions, submissionSearch, submissionType, submissionStatus } = this.state;
    const term = submissionSearch.toLowerCase();

    const rows = submissions.filter((s) => {
      if (submissionType && s.reportType !== submissionType) return false;
      if (submissionStatus && s.status !== submissionStatus) return false;
      if (term) {
        const haystack = `${s.title} ${s.subtitle || ""} ${s.teacherName || ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    this.renderSubmittedReports(rows);
  }

  static renderSubmittedReports(rows) {
    const body = document.querySelector("[data-submitted-reports-body]");
    if (!body) return;

    this.set(
      "[data-submitted-reports-count]",
      `${rows.length} report(s) match the current filters.`,
    );

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="6" class="st-table-empty-cell">${
        this.state.submissions.length
          ? "No reports match these filters."
          : "No reports have been sent by teachers yet."
      }</td></tr>`;
      return;
    }

    body.innerHTML = rows
      .map(
        (s) => `
          <tr>
            <td><strong>${s.title}</strong>${s.subtitle ? `<div style="font-size:var(--st-font-size-caption);color:var(--st-on-surface-variant, var(--muted));margin-top:2px;">${s.subtitle}</div>` : ""}</td>
            <td>${s.reportTypeLabel}</td>
            <td>${s.teacherName || "—"}</td>
            <td>${s.submittedAt}</td>
            <td><span class="st-badge st-badge-${s.status === "REVIEWED" ? "success" : "warning"}">${s.status === "REVIEWED" ? "Reviewed" : "New"}</span></td>
            <td>
              <div class="st-table-actions">
                <button type="button" class="st-btn st-btn-outline st-btn-xs" data-view-submission="${s.id}">View</button>
                ${s.status === "REVIEWED" ? "" : `<button type="button" class="st-btn-text" data-review-submission="${s.id}">Mark Reviewed</button>`}
              </div>
            </td>
          </tr>
        `,
      )
      .join("");

    body.querySelectorAll("[data-view-submission]").forEach((btn) => {
      btn.addEventListener("click", () => this.viewSubmittedReport(Number(btn.dataset.viewSubmission)));
    });
    body.querySelectorAll("[data-review-submission]").forEach((btn) => {
      btn.addEventListener("click", () => this.markSubmissionReviewed(Number(btn.dataset.reviewSubmission)));
    });
  }

  static async viewSubmittedReport(id) {
    try {
      const submission = await API.getAdminReportSubmission(id);
      ReportPrinter.open({
        title: submission.title,
        subtitle: submission.subtitle || `Sent by ${submission.teacherName || "a teacher"} on ${submission.submittedAt}`,
        meta: submission.meta || [],
        sections: submission.sections || [],
      });
      if (submission.status !== "REVIEWED") {
        await this.markSubmissionReviewed(id, { silent: true });
      }
    } catch (error) {
      console.error("[AdminReports]", error);
      Toast?.error("Unable to open this report.");
    }
  }

  static async markSubmissionReviewed(id, { silent = false } = {}) {
    try {
      await API.reviewAdminReportSubmission(id);
      if (!silent) Toast?.success("Marked as reviewed.");
      await this.loadSubmittedReports();
    } catch (error) {
      console.error("[AdminReports]", error);
      if (!silent) Toast?.error("Unable to update this report's status.");
    }
  }

  // ---------------------------------------------------------------------------
  // Notify Teachers -- admin sends an announcement or asks for a report,
  // landing in the target teacher(s)' existing notification inbox.
  // ---------------------------------------------------------------------------

  static async openNotifyTeachersModal() {
    if (!window.Modal) return;

    let teachers = [];
    try {
      const res = await API.getNotifiableTeachers();
      teachers = res.data || [];
    } catch (error) {
      console.error("[AdminReports]", error);
      Toast?.error("Unable to load the teacher list.");
      return;
    }

    if (!teachers.length) {
      Toast?.error("No active teachers to notify.");
      return;
    }

    const presets = {
      ANNOUNCEMENT: { title: "", message: "" },
      REPORT_REQUEST: {
        title: "Report Requested",
        message: "Please prepare and send an updated report for your class(es) at your earliest convenience.",
      },
    };

    Modal.show({
      title: "Notify Teachers",
      size: "md",
      confirmLabel: "Send Notification",
      asyncConfirm: true,
      message: `
        <div class="st-schedule-modal-field">
          <label>What is this?</label>
          <div class="chart-type-toggle" role="group" aria-label="Notification kind" id="notifyKindToggle" style="width:fit-content;">
            <button type="button" class="chart-type-btn is-active" data-notify-kind="ANNOUNCEMENT">Announcement</button>
            <button type="button" class="chart-type-btn" data-notify-kind="REPORT_REQUEST">Request a Report</button>
          </div>
        </div>
        <div class="st-schedule-modal-field">
          <label for="notifyTitle">Title</label>
          <input type="text" id="notifyTitle" placeholder="e.g. Division Meeting Reminder" value="${presets.ANNOUNCEMENT.title}">
        </div>
        <div class="st-schedule-modal-field">
          <label for="notifyMessage">Message</label>
          <textarea id="notifyMessage" rows="4" placeholder="What do you want teachers to know or do?">${presets.ANNOUNCEMENT.message}</textarea>
        </div>
        <div class="st-schedule-modal-field">
          <label>Recipients</label>
          <div class="st-roster-checklist" id="notifyTeacherChecklist">
            <div class="st-roster-checklist-row" style="font-weight:600;">
              <input type="checkbox" id="notifySelectAll">
              <label for="notifySelectAll" style="cursor:pointer;margin:0;">Select All Teachers (${teachers.length})</label>
            </div>
            ${teachers
              .map(
                (t) => `
              <div class="st-roster-checklist-row">
                <input type="checkbox" id="notifyTeacher${t.id}" data-notify-teacher="${t.id}">
                <label for="notifyTeacher${t.id}" style="cursor:pointer;margin:0;">${t.name}${t.municipality ? ` <span style="color:var(--st-on-surface-variant);">· ${t.municipality}</span>` : ""}</label>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `,
      onConfirm: async () => {
        const kind = document.querySelector("#notifyKindToggle .chart-type-btn.is-active")?.dataset.notifyKind || "ANNOUNCEMENT";
        const title = document.getElementById("notifyTitle")?.value.trim();
        const message = document.getElementById("notifyMessage")?.value.trim();
        const teacherUserIds = [...document.querySelectorAll("[data-notify-teacher]")]
          .filter((cb) => cb.checked)
          .map((cb) => Number(cb.dataset.notifyTeacher));

        if (!title || !message) {
          Toast?.error("A title and message are required.");
          throw new Error("validation");
        }
        if (!teacherUserIds.length) {
          Toast?.error("Select at least one teacher to notify.");
          throw new Error("validation");
        }

        try {
          const response = await API.sendTeacherBroadcast({ kind, title, message, teacherUserIds });
          Toast?.success(response?.message || "Notification sent.");
        } catch (error) {
          console.error("[AdminReports]", error);
          Toast?.error(error?.data?.message || "Unable to send this notification.");
          throw error;
        }
      },
    });

    document.querySelectorAll("#notifyKindToggle .chart-type-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#notifyKindToggle .chart-type-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
        const preset = presets[btn.dataset.notifyKind] || presets.ANNOUNCEMENT;
        const titleInput = document.getElementById("notifyTitle");
        const messageInput = document.getElementById("notifyMessage");
        // Only swap in the preset copy if the teacher hasn't already typed
        // something of their own -- switching kinds shouldn't clobber a
        // half-written message.
        if (titleInput && !titleInput.value.trim()) titleInput.value = preset.title;
        if (messageInput && !messageInput.value.trim()) messageInput.value = preset.message;
      });
    });

    document.getElementById("notifySelectAll")?.addEventListener("change", (e) => {
      document.querySelectorAll("[data-notify-teacher]").forEach((cb) => {
        cb.checked = e.target.checked;
      });
    });
    document.getElementById("notifyTeacherChecklist")?.addEventListener("change", (e) => {
      if (!e.target.matches("[data-notify-teacher]")) return;
      const all = [...document.querySelectorAll("[data-notify-teacher]")];
      const selectAll = document.getElementById("notifySelectAll");
      if (selectAll) selectAll.checked = all.length > 0 && all.every((cb) => cb.checked);
    });
  }

  static async load() {
    if (window.Layout) Layout.showLoader();

    try {
      const res = await API.getEnrollmentListingReport();
      this.state.all = res.data || [];

      this.populateFilters();
      this.apply();
    } catch (error) {
      console.error("[AdminReports]", error);
      Toast?.error("Unable to load enrollment data.");
    } finally {
      if (window.Layout) Layout.hideLoader();
    }
  }

  static uniqueValues(key) {
    return [...new Set(this.state.all.map((r) => r[key]).filter(Boolean))].sort();
  }

  static populateFilters() {
    this.fillSelect(
      "[data-report-filter-clc]",
      this.uniqueValues("clc_name"),
      "All Learning Centers",
      (v) => v,
    );

    this.fillSelect(
      "[data-report-filter-year]",
      this.uniqueValues("school_year").sort().reverse(),
      "All School Years",
      (v) => v,
    );

    this.fillSelect(
      "[data-report-filter-teacher]",
      this.uniqueValues("teacher_name"),
      "All Teachers",
      (v) => v,
    );

    this.fillSelect(
      "[data-report-filter-semester]",
      this.uniqueValues("semester"),
      "All Semesters",
      (v) => REPORT_SEMESTER_LABELS[v] || v,
    );

    this.fillSelect(
      "[data-report-filter-modality]",
      this.uniqueValues("learning_modality"),
      "All Modalities",
      (v) => REPORT_MODALITY_LABELS[v] || v,
    );
  }

  static fillSelect(selector, values, allLabel, labelFor) {
    const select = document.querySelector(selector);
    if (!select) return;

    select.innerHTML =
      `<option value="">${allLabel}</option>` +
      values.map((v) => `<option value="${v}">${labelFor(v)}</option>`).join("");
  }

  static bindControls() {
    const on = (selector, event, handler) =>
      document.querySelector(selector)?.addEventListener(event, handler);

    const searchInput = document.querySelector("[data-report-filter-search]");
    const clearBtn = document.querySelector("[data-report-filter-clear]");

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.state.search = e.target.value.trim();
        if (clearBtn) clearBtn.classList.toggle("st-hidden", !e.target.value.trim());
        this.apply();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("mousedown", (e) => e.preventDefault());
      clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (searchInput) searchInput.value = "";
        this.state.search = "";
        clearBtn.classList.add("st-hidden");
        this.apply();
        if (searchInput) searchInput.focus();
      });
    }

    on("[data-report-filter-clc]", "change", (e) => {
      this.state.clc = e.target.value;
      this.apply();
    });

    on("[data-report-filter-year]", "change", (e) => {
      this.state.schoolYear = e.target.value;
      this.apply();
    });

    on("[data-report-filter-semester]", "change", (e) => {
      this.state.semester = e.target.value;
      this.apply();
    });

    on("[data-report-filter-teacher]", "change", (e) => {
      this.state.teacher = e.target.value;
      this.apply();
    });

    on("[data-report-filter-modality]", "change", (e) => {
      this.state.modality = e.target.value;
      this.apply();
    });

    on("[data-preview-enrollment-report]", "click", () => this.previewReport());
  }

  static previewReport() {
    const rows = this.state.filtered;

    if (!rows.length) {
      Toast?.error("No enrollment records match the current filters.");
      return;
    }

    ReportPrinter.open({
      title: "Master Enrollment Listing",
      subtitle: "StayEd Division-wide enrollment report",
      meta: [
        ["Generated", new Date().toLocaleString("en-PH")],
        ["Records", String(rows.length)],
      ],
      sections: [
        {
          title: "Enrollment Records",
          columns: [
            "LRN",
            "Learner",
            "Sex",
            "Learning Level",
            "Learning Center",
            "Assigned Teacher",
            "School Year / Semester",
            "Modality",
            "Status",
          ],
          rows: rows.map((r) => [
            r.lrn,
            `${r.first_name || ""} ${r.last_name || ""}`.trim(),
            r.sex || "—",
            r.learning_level || "—",
            r.clc_name || "—",
            r.teacher_name || "—",
            `${r.school_year || "—"} · ${REPORT_SEMESTER_LABELS[r.semester] || r.semester || "—"}`,
            REPORT_MODALITY_LABELS[r.learning_modality] || r.learning_modality || "—",
            r.enrollment_status || "—",
          ]),
          emptyText: "No enrollment records match the current filters.",
        },
      ],
    });
  }

  static apply() {
    const { all, search, clc, schoolYear, semester, teacher, modality } = this.state;

    let rows = [...all];
    if (search) {
      const term = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.first_name || "").toLowerCase().includes(term) ||
          (r.last_name || "").toLowerCase().includes(term) ||
          (r.lrn || "").toLowerCase().includes(term) ||
          (r.clc_name || "").toLowerCase().includes(term) ||
          (r.teacher_name || "").toLowerCase().includes(term),
      );
    }
    if (clc) rows = rows.filter((r) => r.clc_name === clc);
    if (schoolYear) rows = rows.filter((r) => r.school_year === schoolYear);
    if (semester) rows = rows.filter((r) => r.semester === semester);
    if (teacher) rows = rows.filter((r) => r.teacher_name === teacher);
    if (modality) rows = rows.filter((r) => r.learning_modality === modality);

    this.state.filtered = rows;
    this.renderPreview();
  }

  static renderPreview() {
    const body = document.querySelector("[data-report-preview-body]");
    if (!body) return;

    const rows = this.state.filtered;

    this.set(
      "[data-report-preview-count]",
      `${rows.length} enrollment record(s) match the current filters.`,
    );

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="9" class="st-table-empty-cell">No enrollment records match these filters.</td></tr>`;
      return;
    }

    const preview = rows.slice(0, 50);

    body.innerHTML = preview
      .map(
        (r) => `
      <tr>
        <td>${r.lrn}</td>
        <td>${r.first_name} ${r.last_name}</td>
        <td>${r.sex || "—"}</td>
        <td>${r.learning_level || "—"}</td>
        <td>${r.clc_name || "—"}</td>
        <td>${r.teacher_name || "—"}</td>
        <td>${r.school_year || "—"} · ${REPORT_SEMESTER_LABELS[r.semester] || r.semester || "—"}</td>
        <td>${REPORT_MODALITY_LABELS[r.learning_modality] || r.learning_modality || "—"}</td>
        <td>${r.enrollment_status || "—"}</td>
      </tr>`,
      )
      .join("");

    if (rows.length > preview.length) {
      body.innerHTML += `<tr><td colspan="9" class="st-table-empty-cell">…and ${rows.length - preview.length} more. Export the CSV report to see the full listing.</td></tr>`;
    }
  }

  static set(selector, value) {
    const el = document.querySelector(selector);
    if (el && value !== undefined && value !== null) {
      el.textContent = value;
    }
  }
}

(function bootAdminReports() {
  let started = false;
  const start = () => {
    if (!started) {
      started = true;
      AdminReports.init();
    }
  };
  document.addEventListener("components:loaded", start);
  document.addEventListener("DOMContentLoaded", () => setTimeout(start, 600));
})();

window.AdminReports = AdminReports;

