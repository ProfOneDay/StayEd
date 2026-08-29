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
  };

  static async init() {
    if (window.Guards) Guards.admin();

    this.bindControls();

    await this.load();
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

    on("[data-export-csv-enrollment-listing]", "click", () => this.exportCsv());
  }

  static exportCsv() {
    const rows = this.state.filtered;

    if (!rows.length) {
      Toast?.error("No enrollment records match the current filters.");
      return;
    }

    const headers = [
      "LRN",
      "Last Name",
      "First Name",
      "Sex",
      "Learning Center",
      "Assigned Teacher",
      "School Year",
      "Semester",
      "Learning Delivery Mode",
      "Enrollment Status",
    ];

    const csvRows = rows.map((r) => [
      r.lrn,
      r.last_name || "",
      r.first_name || "",
      r.sex || "—",
      r.clc_name || "—",
      r.teacher_name || "—",
      r.school_year || "—",
      REPORT_SEMESTER_LABELS[r.semester] || r.semester || "—",
      REPORT_MODALITY_LABELS[r.learning_modality] || r.learning_modality || "—",
      r.enrollment_status || "—",
    ]);

    ReportPrinter.downloadCsv(
      `StayEd_Master_Enrollment_Listing_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      csvRows,
    );
    Toast?.success("Master enrollment listing CSV exported.");
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
      body.innerHTML = `<tr><td colspan="7" class="st-table-empty-cell">No enrollment records match these filters.</td></tr>`;
      return;
    }

    const preview = rows.slice(0, 50);

    body.innerHTML = preview
      .map(
        (r) => `
      <tr>
        <td>${r.lrn}</td>
        <td>${r.first_name} ${r.last_name}</td>
        <td>${r.clc_name || "—"}</td>
        <td>${r.teacher_name || "—"}</td>
        <td>${r.school_year || "—"} · ${REPORT_SEMESTER_LABELS[r.semester] || r.semester || "—"}</td>
        <td>${REPORT_MODALITY_LABELS[r.learning_modality] || r.learning_modality || "—"}</td>
        <td>${r.enrollment_status || "—"}</td>
      </tr>`,
      )
      .join("");

    if (rows.length > preview.length) {
      body.innerHTML += `<tr><td colspan="7" class="st-table-empty-cell">…and ${rows.length - preview.length} more. Export the CSV report to see the full listing.</td></tr>`;
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

