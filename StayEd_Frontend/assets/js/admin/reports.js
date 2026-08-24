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

    on("[data-report-group-by]", "change", (e) => {
      this.state.groupBy = e.target.value;
    });

    on("[data-generate-enrollment-listing]", "click", () => this.generate());
  }

  static apply() {
    const { all, clc, schoolYear, semester, teacher, modality } = this.state;

    let rows = [...all];
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
      body.innerHTML += `<tr><td colspan="7" class="st-table-empty-cell">…and ${rows.length - preview.length} more. Generate the report to see the full listing.</td></tr>`;
    }
  }

  static generate() {
    const rows = this.state.filtered;

    if (!rows.length) {
      Toast?.error("No enrollment records match the current filters.");
      return;
    }

    const groupBy = this.state.groupBy;
    const columns = [
      "LRN",
      "Learner",
      "Sex",
      "Learning Center",
      "Assigned Teacher",
      "School Year / Semester",
      "Modality",
      "Status",
    ];

    const rowMapper = (r) => [
      r.lrn,
      `${r.first_name} ${r.last_name}`,
      r.sex,
      r.clc_name,
      r.teacher_name,
      `${r.school_year || "—"} · ${REPORT_SEMESTER_LABELS[r.semester] || r.semester || "—"}`,
      REPORT_MODALITY_LABELS[r.learning_modality] || r.learning_modality,
      r.enrollment_status,
    ];

    let sections;

    if (groupBy) {
      const groupKeyLabel = (r) => {
        if (groupBy === "semester") return REPORT_SEMESTER_LABELS[r[groupBy]] || r[groupBy] || "Unspecified";
        if (groupBy === "learning_modality") return REPORT_MODALITY_LABELS[r[groupBy]] || r[groupBy] || "Unspecified";
        return r[groupBy] || "Unspecified";
      };

      const groups = new Map();
      rows.forEach((r) => {
        const key = groupKeyLabel(r);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      });

      sections = [...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, groupRows]) => ({
          type: "table",
          title: `${REPORT_GROUP_LABELS[groupBy]}: ${key} (${groupRows.length})`,
          columns,
          rows: groupRows.map(rowMapper),
        }));
    } else {
      sections = [
        {
          type: "table",
          title: "Enrollment Listing",
          columns,
          rows: rows.map(rowMapper),
        },
      ];
    }

    ReportPrinter.open({
      title: "Master Enrollment Listing",
      subtitle: "Cross-CLC enrollment records",
      meta: [
        { label: "Total Records", value: rows.length },
        { label: "Learning Center", value: this.state.clc || "All" },
        { label: "School Year", value: this.state.schoolYear || "All" },
        {
          label: "Semester",
          value: REPORT_SEMESTER_LABELS[this.state.semester] || this.state.semester || "All",
        },
        { label: "Teacher", value: this.state.teacher || "All" },
        {
          label: "Modality",
          value: REPORT_MODALITY_LABELS[this.state.modality] || this.state.modality || "All",
        },
      ],
      sections,
    });
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
