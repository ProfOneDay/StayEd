class TeacherReports {
  static state = {
    learners: [],
    classes: [],
    selectedLearnerId: null,
  };

  static async init() {
    if (window.Guards) Guards.teacher();

    this.bindControls();
    this.setupLearnerSearch();
    this.setupClassListSearch();
    this.setupAttendanceSearch();
    this.setupAtRiskSearch();
    this.setupInterventionSearch();

    await this.loadFilters();
  }

  static async loadFilters() {
    try {
      const [learnersRes, classesRes] = await Promise.all([
        API.getLearners(),
        API.getClasses(),
      ]);

      this.state.learners = learnersRes.data || [];
      this.state.classes = classesRes.data || classesRes || [];
    } catch (error) {
      console.error("[TeacherReports]", error);
      Toast?.error("Unable to load report filters.");
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Learner Autocomplete Search (Individual Progress)
  // ---------------------------------------------------------------------------

  static setupLearnerSearch() {
    const searchInput = document.querySelector("[data-report-learner-search]");
    const dropdown = document.querySelector("[data-report-learner-results]");
    const clearBtn = document.querySelector("[data-report-learner-clear]");
    const hiddenId = document.querySelector("[data-report-learner-id]");

    if (!searchInput || !dropdown) return;

    const renderResults = (query = "") => {
      const term = query.trim().toLowerCase();
      let matched = this.state.learners;

      if (term) {
        matched = matched.filter(
          (l) =>
            (l.name || "").toLowerCase().includes(term) ||
            (l.lrn || "").toLowerCase().includes(term) ||
            (l.clc || "").toLowerCase().includes(term),
        );
      }

      if (!matched.length) {
        dropdown.innerHTML = `<div class="st-report-search-empty">No matching learners found.</div>`;
        dropdown.classList.remove("st-hidden");
        return;
      }

      const preview = matched.slice(0, 30);
      dropdown.innerHTML = preview
        .map(
          (l) => `
          <button type="button" class="st-report-search-item" data-learner-id="${l.id}">
            <div class="st-report-search-item-info">
              <span class="st-report-search-item-name">${l.name}</span>
              <span class="st-report-search-item-meta">LRN: ${l.lrn || "—"} · ${l.clc || "CLC"} · ${l.level || ""}</span>
            </div>
            <span class="badge badge-neutral">${l.modality || "Enrolled"}</span>
          </button>
        `,
        )
        .join("");

      dropdown.querySelectorAll("[data-learner-id]").forEach((item) => {
        item.addEventListener("click", () => {
          const id = item.getAttribute("data-learner-id");
          const learner = this.state.learners.find((l) => String(l.id) === String(id));
          if (learner) {
            this.selectLearner(learner);
          }
        });
      });

      dropdown.classList.remove("st-hidden");
    };

    searchInput.addEventListener("input", (e) => {
      renderResults(e.target.value);
      if (clearBtn) clearBtn.classList.toggle("st-hidden", !e.target.value);
    });

    searchInput.addEventListener("focus", () => {
      renderResults(searchInput.value);
    });

    if (clearBtn) {
      clearBtn.addEventListener("mousedown", (e) => e.preventDefault());
      clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.clearLearnerSelection();
        searchInput.focus();
      });
    }

    document.addEventListener("click", (e) => {
      if (
        !searchInput.contains(e.target) &&
        !dropdown.contains(e.target) &&
        (!clearBtn || !clearBtn.contains(e.target))
      ) {
        dropdown.classList.add("st-hidden");
      }
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") dropdown.classList.add("st-hidden");
    });
  }

  static selectLearner(learner) {
    const searchInput = document.querySelector("[data-report-learner-search]");
    const dropdown = document.querySelector("[data-report-learner-results]");
    const clearBtn = document.querySelector("[data-report-learner-clear]");
    const hiddenId = document.querySelector("[data-report-learner-id]");

    this.state.selectedLearnerId = learner.id;

    if (searchInput) searchInput.value = `${learner.name} (${learner.lrn})`;
    if (hiddenId) hiddenId.value = learner.id;
    if (clearBtn) clearBtn.classList.remove("st-hidden");
    if (dropdown) dropdown.classList.add("st-hidden");
  }

  static clearLearnerSelection() {
    const searchInput = document.querySelector("[data-report-learner-search]");
    const dropdown = document.querySelector("[data-report-learner-results]");
    const clearBtn = document.querySelector("[data-report-learner-clear]");
    const hiddenId = document.querySelector("[data-report-learner-id]");

    this.state.selectedLearnerId = null;

    if (searchInput) searchInput.value = "";
    if (hiddenId) hiddenId.value = "";
    if (clearBtn) clearBtn.classList.add("st-hidden");
    if (dropdown) dropdown.classList.add("st-hidden");
  }

  // ---------------------------------------------------------------------------
  // 2. Class List Autocomplete Search
  // ---------------------------------------------------------------------------

  static setupClassListSearch() {
    const searchInput = document.querySelector("[data-report-classlist-search]");
    const dropdown = document.querySelector("[data-report-classlist-results]");
    const clearBtn = document.querySelector("[data-report-classlist-clear]");
    const hiddenClassId = document.querySelector("[data-report-classlist-class-id]");

    if (!searchInput || !dropdown) return;

    const renderResults = (query = "") => {
      const term = query.trim().toLowerCase();
      let matchedClasses = this.state.classes;

      if (term) {
        matchedClasses = matchedClasses.filter((c) => {
          const text = `${c.className || ""} ${c.learningLevel || ""} ${c.schoolYear || ""} ${c.clcName || ""}`.toLowerCase();
          return text.includes(term);
        });
      }

      let html = `
        <button type="button" class="st-report-search-item" data-class-id="">
          <div class="st-report-search-item-info">
            <span class="st-report-search-item-name">All Classes (Full Roster)</span>
            <span class="st-report-search-item-meta">Export roster across all classes</span>
          </div>
          <span class="badge badge-neutral">All</span>
        </button>
      `;

      if (matchedClasses.length) {
        html += matchedClasses
          .map(
            (c) => `
            <button type="button" class="st-report-search-item" data-class-id="${c.id}" data-class-name="${c.className || c.learningLevel}">
              <div class="st-report-search-item-info">
                <span class="st-report-search-item-name">${c.className || c.learningLevel}</span>
                <span class="st-report-search-item-meta">SY ${c.schoolYear || "—"} · ${c.learningLevel || "Level"}</span>
              </div>
              <span class="badge badge-primary">Class</span>
            </button>
          `,
          )
          .join("");
      } else if (term) {
        html += `<div class="st-report-search-empty">Search keyword: "<strong>${term}</strong>"</div>`;
      }

      dropdown.innerHTML = html;

      dropdown.querySelectorAll("[data-class-id]").forEach((item) => {
        item.addEventListener("click", () => {
          const id = item.getAttribute("data-class-id");
          const name = item.getAttribute("data-class-name") || "All Classes";
          if (hiddenClassId) hiddenClassId.value = id;
          searchInput.value = id ? name : "";
          if (clearBtn) clearBtn.classList.toggle("st-hidden", !id);
          dropdown.classList.add("st-hidden");
        });
      });

      dropdown.classList.remove("st-hidden");
    };

    searchInput.addEventListener("input", (e) => {
      renderResults(e.target.value);
      if (clearBtn) clearBtn.classList.toggle("st-hidden", !e.target.value);
    });

    searchInput.addEventListener("focus", () => {
      renderResults(searchInput.value);
    });

    if (clearBtn) {
      clearBtn.addEventListener("mousedown", (e) => e.preventDefault());
      clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        searchInput.value = "";
        if (hiddenClassId) hiddenClassId.value = "";
        clearBtn.classList.add("st-hidden");
        dropdown.classList.add("st-hidden");
        searchInput.focus();
      });
    }

    document.addEventListener("click", (e) => {
      if (
        !searchInput.contains(e.target) &&
        !dropdown.contains(e.target) &&
        (!clearBtn || !clearBtn.contains(e.target))
      ) {
        dropdown.classList.add("st-hidden");
      }
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") dropdown.classList.add("st-hidden");
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Attendance List Autocomplete Search
  // ---------------------------------------------------------------------------

  static setupAttendanceSearch() {
    const searchInput = document.querySelector("[data-report-attendance-search]");
    const dropdown = document.querySelector("[data-report-attendance-results]");
    const clearBtn = document.querySelector("[data-report-attendance-clear]");
    const hiddenClassId = document.querySelector("[data-report-attendance-class-id]");

    if (!searchInput || !dropdown) return;

    const renderResults = (query = "") => {
      const term = query.trim().toLowerCase();
      let matchedClasses = this.state.classes;

      if (term) {
        matchedClasses = matchedClasses.filter((c) => {
          const text = `${c.className || ""} ${c.learningLevel || ""} ${c.schoolYear || ""}`.toLowerCase();
          return text.includes(term);
        });
      }

      let html = `
        <button type="button" class="st-report-search-item" data-att-class-id="">
          <div class="st-report-search-item-info">
            <span class="st-report-search-item-name">All Classes (Full Attendance)</span>
            <span class="st-report-search-item-meta">Export attendance for all classes</span>
          </div>
          <span class="badge badge-neutral">All</span>
        </button>
      `;

      if (matchedClasses.length) {
        html += matchedClasses
          .map(
            (c) => `
            <button type="button" class="st-report-search-item" data-att-class-id="${c.id}" data-att-class-name="${c.className || c.learningLevel}">
              <div class="st-report-search-item-info">
                <span class="st-report-search-item-name">${c.className || c.learningLevel}</span>
                <span class="st-report-search-item-meta">SY ${c.schoolYear || "—"} · ${c.learningLevel || ""}</span>
              </div>
              <span class="badge badge-primary">Class</span>
            </button>
          `,
          )
          .join("");
      } else if (term) {
        html += `<div class="st-report-search-empty">Search keyword: "<strong>${term}</strong>"</div>`;
      }

      dropdown.innerHTML = html;

      dropdown.querySelectorAll("[data-att-class-id]").forEach((item) => {
        item.addEventListener("click", () => {
          const id = item.getAttribute("data-att-class-id");
          const name = item.getAttribute("data-att-class-name") || "All Classes";
          if (hiddenClassId) hiddenClassId.value = id;
          searchInput.value = id ? name : "";
          if (clearBtn) clearBtn.classList.toggle("st-hidden", !id);
          dropdown.classList.add("st-hidden");
        });
      });

      dropdown.classList.remove("st-hidden");
    };

    searchInput.addEventListener("input", (e) => {
      renderResults(e.target.value);
      if (clearBtn) clearBtn.classList.toggle("st-hidden", !e.target.value);
    });

    searchInput.addEventListener("focus", () => {
      renderResults(searchInput.value);
    });

    if (clearBtn) {
      clearBtn.addEventListener("mousedown", (e) => e.preventDefault());
      clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        searchInput.value = "";
        if (hiddenClassId) hiddenClassId.value = "";
        clearBtn.classList.add("st-hidden");
        dropdown.classList.add("st-hidden");
        searchInput.focus();
      });
    }

    document.addEventListener("click", (e) => {
      if (
        !searchInput.contains(e.target) &&
        !dropdown.contains(e.target) &&
        (!clearBtn || !clearBtn.contains(e.target))
      ) {
        dropdown.classList.add("st-hidden");
      }
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") dropdown.classList.add("st-hidden");
    });
  }

  // ---------------------------------------------------------------------------
  // 4. At-Risk Learners Autocomplete Search
  // ---------------------------------------------------------------------------

  static setupAtRiskSearch() {
    const searchInput = document.querySelector("[data-report-atrisk-search]");
    const dropdown = document.querySelector("[data-report-atrisk-results]");
    const clearBtn = document.querySelector("[data-report-atrisk-clear]");
    const hiddenClassId = document.querySelector("[data-report-atrisk-class-id]");

    if (!searchInput || !dropdown) return;

    const renderResults = (query = "") => {
      const term = query.trim().toLowerCase();
      let matchedClasses = this.state.classes;

      if (term) {
        matchedClasses = matchedClasses.filter((c) => {
          const text = `${c.className || ""} ${c.learningLevel || ""} ${c.schoolYear || ""}`.toLowerCase();
          return text.includes(term);
        });
      }

      let html = `
        <button type="button" class="st-report-search-item" data-risk-class-id="">
          <div class="st-report-search-item-info">
            <span class="st-report-search-item-name">All Classes (At-Risk Learners)</span>
            <span class="st-report-search-item-meta">Export at-risk learners across all classes</span>
          </div>
          <span class="badge badge-neutral">All</span>
        </button>
      `;

      if (matchedClasses.length) {
        html += matchedClasses
          .map(
            (c) => `
            <button type="button" class="st-report-search-item" data-risk-class-id="${c.id}" data-risk-class-name="${c.className || c.learningLevel}">
              <div class="st-report-search-item-info">
                <span class="st-report-search-item-name">${c.className || c.learningLevel}</span>
                <span class="st-report-search-item-meta">SY ${c.schoolYear || "—"} · ${c.learningLevel || ""}</span>
              </div>
              <span class="badge badge-primary">Class</span>
            </button>
          `,
          )
          .join("");
      } else if (term) {
        html += `<div class="st-report-search-empty">Search keyword: "<strong>${term}</strong>"</div>`;
      }

      dropdown.innerHTML = html;

      dropdown.querySelectorAll("[data-risk-class-id]").forEach((item) => {
        item.addEventListener("click", () => {
          const id = item.getAttribute("data-risk-class-id");
          const name = item.getAttribute("data-risk-class-name") || "All Classes";
          if (hiddenClassId) hiddenClassId.value = id;
          searchInput.value = id ? name : "";
          if (clearBtn) clearBtn.classList.toggle("st-hidden", !id);
          dropdown.classList.add("st-hidden");
        });
      });

      dropdown.classList.remove("st-hidden");
    };

    searchInput.addEventListener("input", (e) => {
      renderResults(e.target.value);
      if (clearBtn) clearBtn.classList.toggle("st-hidden", !e.target.value);
    });

    searchInput.addEventListener("focus", () => {
      renderResults(searchInput.value);
    });

    if (clearBtn) {
      clearBtn.addEventListener("mousedown", (e) => e.preventDefault());
      clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        searchInput.value = "";
        if (hiddenClassId) hiddenClassId.value = "";
        clearBtn.classList.add("st-hidden");
        dropdown.classList.add("st-hidden");
        searchInput.focus();
      });
    }

    document.addEventListener("click", (e) => {
      if (
        !searchInput.contains(e.target) &&
        !dropdown.contains(e.target) &&
        (!clearBtn || !clearBtn.contains(e.target))
      ) {
        dropdown.classList.add("st-hidden");
      }
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") dropdown.classList.add("st-hidden");
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Intervention Tracking Autocomplete Search
  // ---------------------------------------------------------------------------

  static setupInterventionSearch() {
    const searchInput = document.querySelector("[data-report-intervention-search]");
    const dropdown = document.querySelector("[data-report-intervention-results]");
    const clearBtn = document.querySelector("[data-report-intervention-clear]");
    const hiddenClassId = document.querySelector("[data-report-intervention-class-id]");
    const hiddenStatus = document.querySelector("[data-report-intervention-status-val]");

    if (!searchInput || !dropdown) return;

    const statuses = [
      { id: "COMPLETED", label: "Completed Interventions", badge: "badge-success" },
      { id: "ONGOING", label: "In Progress / Ongoing", badge: "badge-warning" },
      { id: "PLANNED", label: "Pending / Planned", badge: "badge-neutral" },
      { id: "CANCELLED", label: "Cancelled Interventions", badge: "badge-danger" },
    ];

    const renderResults = (query = "") => {
      const term = query.trim().toLowerCase();

      let html = `
        <button type="button" class="st-report-search-item" data-int-class="" data-int-status="">
          <div class="st-report-search-item-info">
            <span class="st-report-search-item-name">All Interventions (All Classes & Statuses)</span>
            <span class="st-report-search-item-meta">Full tracking history</span>
          </div>
          <span class="badge badge-neutral">All</span>
        </button>
      `;

      const matchedStatuses = statuses.filter((s) => !term || s.label.toLowerCase().includes(term) || s.id.toLowerCase().includes(term));
      if (matchedStatuses.length) {
        html += matchedStatuses
          .map(
            (s) => `
            <button type="button" class="st-report-search-item" data-int-status="${s.id}" data-int-label="${s.label}">
              <div class="st-report-search-item-info">
                <span class="st-report-search-item-name">${s.label}</span>
                <span class="st-report-search-item-meta">Filter by status</span>
              </div>
              <span class="badge ${s.badge}">Status</span>
            </button>
          `,
          )
          .join("");
      }

      let matchedClasses = this.state.classes;
      if (term) {
        matchedClasses = matchedClasses.filter((c) => {
          const text = `${c.className || ""} ${c.learningLevel || ""} ${c.schoolYear || ""}`.toLowerCase();
          return text.includes(term);
        });
      }

      if (matchedClasses.length) {
        html += matchedClasses
          .map(
            (c) => `
            <button type="button" class="st-report-search-item" data-int-class="${c.id}" data-int-label="${c.className || c.learningLevel}">
              <div class="st-report-search-item-info">
                <span class="st-report-search-item-name">${c.className || c.learningLevel}</span>
                <span class="st-report-search-item-meta">SY ${c.schoolYear || "—"} · ${c.learningLevel || ""}</span>
              </div>
              <span class="badge badge-primary">Class</span>
            </button>
          `,
          )
          .join("");
      } else if (term && !matchedStatuses.length) {
        html += `<div class="st-report-search-empty">Search keyword: "<strong>${term}</strong>"</div>`;
      }

      dropdown.innerHTML = html;

      dropdown.querySelectorAll("[data-int-status], [data-int-class]").forEach((item) => {
        item.addEventListener("click", () => {
          const classId = item.getAttribute("data-int-class") || "";
          const status = item.getAttribute("data-int-status") || "";
          const label = item.getAttribute("data-int-label") || "";

          if (hiddenClassId) hiddenClassId.value = classId;
          if (hiddenStatus) hiddenStatus.value = status;

          searchInput.value = label || (classId || status ? `${label}` : "");
          if (clearBtn) clearBtn.classList.toggle("st-hidden", !classId && !status);
          dropdown.classList.add("st-hidden");
        });
      });

      dropdown.classList.remove("st-hidden");
    };

    searchInput.addEventListener("input", (e) => {
      renderResults(e.target.value);
      if (clearBtn) clearBtn.classList.toggle("st-hidden", !e.target.value);
    });

    searchInput.addEventListener("focus", () => {
      renderResults(searchInput.value);
    });

    if (clearBtn) {
      clearBtn.addEventListener("mousedown", (e) => e.preventDefault());
      clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        searchInput.value = "";
        if (hiddenClassId) hiddenClassId.value = "";
        if (hiddenStatus) hiddenStatus.value = "";
        clearBtn.classList.add("st-hidden");
        dropdown.classList.add("st-hidden");
        searchInput.focus();
      });
    }

    document.addEventListener("click", (e) => {
      if (
        !searchInput.contains(e.target) &&
        !dropdown.contains(e.target) &&
        (!clearBtn || !clearBtn.contains(e.target))
      ) {
        dropdown.classList.add("st-hidden");
      }
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") dropdown.classList.add("st-hidden");
    });
  }

  static bindControls() {
    document
      .querySelector("[data-export-csv-progress]")
      ?.addEventListener("click", () => this.exportProgressCsv());

    document
      .querySelector("[data-export-csv-classlist]")
      ?.addEventListener("click", () => this.exportClassListCsv());

    document
      .querySelector("[data-export-csv-attendance]")
      ?.addEventListener("click", () => this.exportAttendanceCsv());

    document
      .querySelector("[data-export-csv-atrisk]")
      ?.addEventListener("click", () => this.exportAtRiskCsv());

    document
      .querySelector("[data-export-csv-intervention]")
      ?.addEventListener("click", () => this.exportInterventionCsv());
  }

  // ---------------------------------------------------------------------------
  // Export CSV Handlers
  // ---------------------------------------------------------------------------

  static async exportProgressCsv() {
    const learnerId =
      this.state.selectedLearnerId ||
      document.querySelector("[data-report-learner-id]")?.value;

    if (!learnerId) {
      Toast?.error("Please search and select a learner first.");
      return;
    }

    try {
      const profile = await API.getLearnerProfile(learnerId);
      const riskPct = Math.round((profile.risk_probability || 0) * 100);

      const reportModel = {
        title: "Individual Learner Progress Report",
        subtitle: `${profile.name} — LRN ${profile.lrn}`,
        meta: [
          { label: "Learner Name", value: profile.name || "—" },
          { label: "LRN", value: profile.lrn || "—" },
          { label: "Learning Level", value: profile.level || "—" },
          { label: "Modality", value: profile.modality || "—" },
          { label: "Learning Center", value: profile.clc || "—" },
          { label: "Class", value: profile.header?.currentClass || "—" },
          { label: "School Year", value: profile.header?.schoolYear || "—" },
          { label: "Date Enrolled", value: profile.header?.dateEnrolled || "—" },
          {
            label: "Current Risk Level",
            value:
              profile.risk && profile.risk !== "Not Yet Assessed"
                ? `${profile.risk} (${riskPct}%)`
                : "Not Yet Assessed",
          },
          { label: "Module Returns", value: profile.metrics?.moduleRateText || "—" },
        ],
        sections: [
          {
            title: "Risk Trend (Last Assessments)",
            columns: ["Date", "Risk Level", "Probability"],
            rows: (profile.riskTrend || []).map((r) => [
              r.date,
              r.level,
              r.probability != null ? `${r.probability}%` : "—",
            ]),
            emptyText: "No prediction history available yet.",
          },
          {
            title: "Module Monitoring History",
            columns: ["Module", "Released", "Submitted"],
            rows: (profile.monitoringHistory?.modules || []).map((m) => [
              m.module,
              m.released,
              m.submitted,
            ]),
            emptyText: "No modules released yet.",
          },
          {
            title: "Intervention History",
            columns: ["Date Assigned", "Intervention Method", "Status", "Remarks"],
            rows: (profile.interventions?.history || []).map((i) => [
              i.date,
              i.intervention,
              i.status,
              i.remarks,
            ]),
            emptyText: "No interventions have been assigned.",
          },
          {
            title: "Risk Contributors",
            columns: ["Factor", "Level", "Detail"],
            rows: (profile.riskExplanation?.contributors || []).map((c) => [
              c.title,
              c.level,
              c.text,
            ]),
            emptyText: "No specific risk contributors identified.",
          },
          {
            title: "Recommended Actions",
            columns: ["Priority", "Action", "Detail"],
            rows: (profile.recommendedActions || []).map((r) => [
              Utils.capitalize(r.priority),
              r.title,
              r.text,
            ]),
            emptyText: "No recommended actions at this time.",
          },
        ],
      };

      ReportPrinter.open(reportModel);
    } catch (error) {
      console.error("[TeacherReports]", error);
      Toast?.error("Unable to load the learner progress report.");
    }
  }

  static async exportClassListCsv() {
    const classId =
      document.querySelector("[data-report-classlist-class-id]")?.value || "";
    const search =
      document.querySelector("[data-report-classlist-search]")?.value.trim() || "";

    try {
      const params = {};
      if (classId) params.class_id = classId;
      if (search && !classId) params.search = search;

      const res = await API.getClassListReport(params);
      let rows = res.data || [];

      if (search && !classId) {
        const term = search.toLowerCase();
        rows = rows.filter(
          (l) =>
            (l.name || "").toLowerCase().includes(term) ||
            (l.lrn || "").toLowerCase().includes(term) ||
            (l.clc || "").toLowerCase().includes(term) ||
            (l.section || "").toLowerCase().includes(term) ||
            (l.level || "").toLowerCase().includes(term),
        );
      }

      if (!rows.length) {
        Toast?.error("No learners match the specified search criteria.");
        return;
      }

      const columns = [
        "LRN", "Last Name", "First Name", "Sex", "Age", "Date of Birth",
        "Contact Number", "Guardian Name", "Guardian Contact", "Address",
        "Learning Center", "Class / Section", "Learning Level", "School Year",
        "Modality", "Enrollment Status", "4Ps Beneficiary", "Risk Level",
        "Risk Probability (%)",
      ];

      const reportRows = rows.map((l) => [
        l.lrn,
        l.last_name || "",
        l.first_name || "",
        l.sex || "—",
        l.age || "—",
        l.birthdate || "—",
        l.contact_number || "—",
        l.guardian_name || "—",
        l.guardian_contact_number || "—",
        l.address || "—",
        l.clc || "—",
        l.section || "—",
        l.level || "—",
        l.school_year || "—",
        l.modality || "—",
        l.status || "—",
        l.is_4ps_beneficiary ? "Yes" : "No",
        l.risk || "Not Yet Assessed",
        l.risk_probability ? `${Math.round(l.risk_probability * 100)}%` : "0%",
      ]);

      ReportPrinter.open({
        title: "Class List Report",
        subtitle: search || "All Classes",
        meta: [
          { label: "Filter", value: search || "All Classes" },
          { label: "Total Learners", value: String(rows.length) },
          { label: "Generated", value: new Date().toLocaleDateString("en-PH") },
        ],
        sections: [
          {
            title: "Class Roster",
            columns,
            rows: reportRows,
            emptyText: "No learners found.",
          },
        ],
      });
    } catch (error) {
      console.error("[TeacherReports]", error);
      Toast?.error("Unable to load the class list report.");
    }
  }

  static async exportAttendanceCsv() {
    const classId =
      document.querySelector("[data-report-attendance-class-id]")?.value || "";
    const search =
      document.querySelector("[data-report-attendance-search]")?.value.trim() || "";

    try {
      const params = {};
      if (classId) params.class_id = classId;
      if (search && !classId) params.search = search;

      const res = await API.getAttendanceReport(params);
      let rows = res.data || [];

      if (search && !classId) {
        const term = search.toLowerCase();
        rows = rows.filter(
          (r) =>
            (r.name || "").toLowerCase().includes(term) ||
            (r.lrn || "").toLowerCase().includes(term) ||
            (r.clc || "").toLowerCase().includes(term) ||
            (r.class_name || "").toLowerCase().includes(term),
        );
      }

      if (!rows.length) {
        Toast?.error("No attendance records match the specified search criteria.");
        return;
      }

      const columns = [
        "LRN", "Last Name", "First Name", "Sex", "Learning Center", "Class",
        "Learning Level", "School Year", "Modality", "Total Meet-ups",
        "Present Count", "Absent Count", "Attendance Rate (%)",
        "Last Present Date", "Status",
      ];

      const reportRows = rows.map((r) => [
        r.lrn,
        r.last_name || "",
        r.first_name || "",
        r.sex || "—",
        r.clc || "—",
        r.class_name || "—",
        r.learning_level || "—",
        r.school_year || "—",
        r.modality || "—",
        r.total_sessions || 0,
        r.sessions_present || 0,
        r.sessions_absent || 0,
        `${Math.round(r.attendance_rate || 0)}%`,
        r.last_present_date || "—",
        r.status || "—",
      ]);

      ReportPrinter.open({
        title: "Attendance List Report",
        subtitle: search || "All Classes",
        meta: [
          { label: "Filter", value: search || "All Classes" },
          { label: "Total Learners", value: String(rows.length) },
          { label: "Generated", value: new Date().toLocaleDateString("en-PH") },
        ],
        sections: [
          {
            title: "Session Attendance",
            columns,
            rows: reportRows,
            emptyText: "No attendance records found.",
          },
        ],
      });
    } catch (error) {
      console.error("[TeacherReports]", error);
      Toast?.error("Unable to load the attendance list report.");
    }
  }

  static async exportAtRiskCsv() {
    const classId =
      document.querySelector("[data-report-atrisk-class-id]")?.value || "";
    const search =
      document.querySelector("[data-report-atrisk-search]")?.value.trim() || "";

    try {
      const params = {};
      if (classId) params.class_id = classId;
      if (search && !classId) params.search = search;

      const res = await API.getAtRiskReport(params);
      let rows = res.data || [];

      if (search && !classId) {
        const term = search.toLowerCase();
        rows = rows.filter(
          (l) =>
            (l.name || "").toLowerCase().includes(term) ||
            (l.lrn || "").toLowerCase().includes(term) ||
            (l.clc || "").toLowerCase().includes(term) ||
            (l.level || "").toLowerCase().includes(term),
        );
      }

      if (!rows.length) {
        Toast?.error("No at-risk learners match the specified search criteria.");
        return;
      }

      const columns = [
        "LRN", "Learner Name", "Level", "Modality",
        "Risk Level", "Risk Probability (%)", "Last Activity",
      ];

      const reportRows = rows.map((l) => [
        l.lrn,
        l.name,
        l.level,
        l.modality,
        l.risk,
        `${Math.round((l.risk_probability || 0) * 100)}%`,
        l.activity_text,
      ]);

      ReportPrinter.open({
        title: "At-Risk Learners List",
        subtitle: search || "All Classes",
        meta: [
          { label: "Filter", value: search || "All Classes" },
          { label: "Total At-Risk", value: String(rows.length) },
          { label: "Generated", value: new Date().toLocaleDateString("en-PH") },
        ],
        sections: [
          {
            title: "At-Risk Learners",
            columns,
            rows: reportRows,
            emptyText: "No at-risk learners found.",
          },
        ],
      });
    } catch (error) {
      console.error("[TeacherReports]", error);
      Toast?.error("Unable to load the at-risk report.");
    }
  }

  static async exportInterventionCsv() {
    const classId =
      document.querySelector("[data-report-intervention-class-id]")?.value ||
      "";
    const status =
      document.querySelector("[data-report-intervention-status-val]")?.value ||
      "";
    const search =
      document.querySelector("[data-report-intervention-search]")?.value.trim() ||
      "";

    try {
      const params = {};
      if (classId) params.class_id = classId;
      if (status) params.status = status;
      if (search && !classId && !status) params.search = search;

      const res = await API.getInterventionReport(params);
      let rows = res.data || [];

      if (search && !classId && !status) {
        const term = search.toLowerCase();
        rows = rows.filter(
          (r) =>
            (r.learner_name || "").toLowerCase().includes(term) ||
            (r.lrn || "").toLowerCase().includes(term) ||
            (r.class_name || "").toLowerCase().includes(term) ||
            (r.intervention_type || "").toLowerCase().includes(term) ||
            (r.description || "").toLowerCase().includes(term) ||
            (r.status || "").toLowerCase().includes(term),
        );
      }

      if (!rows.length) {
        Toast?.error("No interventions found matching your search criteria.");
        return;
      }

      const columns = [
        "Learner Name", "LRN", "Class", "Intervention Method", "Description",
        "Date Assigned", "Target Date", "Date Completed", "Status",
        "Follow-up Date", "Follow-up Outcome", "Follow-up Notes",
      ];

      const reportRows = rows.map((r) => [
        r.learner_name,
        r.lrn,
        r.class_name || "—",
        r.intervention_type,
        r.description,
        Utils.formatDate(r.date_assigned),
        Utils.formatDate(r.target_date),
        Utils.formatDate(r.date_completed),
        r.status,
        Utils.formatDate(r.follow_up_date),
        r.follow_up_outcome || "—",
        r.follow_up_notes || "—",
      ]);

      ReportPrinter.open({
        title: "Intervention Tracking Report",
        subtitle: search || (status ? `Status: ${status}` : "All Classes"),
        meta: [
          { label: "Filter", value: search || (status ? `Status: ${status}` : "All Classes") },
          { label: "Total Records", value: String(rows.length) },
          { label: "Generated", value: new Date().toLocaleDateString("en-PH") },
        ],
        sections: [
          {
            title: "Intervention Records",
            columns,
            rows: reportRows,
            emptyText: "No interventions found.",
          },
        ],
      });
    } catch (error) {
      console.error("[TeacherReports]", error);
      Toast?.error("Unable to load the intervention report.");
    }
  }
}

(function bootTeacherReports() {
  let started = false;
  const start = () => {
    if (!started) {
      started = true;
      TeacherReports.init();
    }
  };
  document.addEventListener("components:loaded", start);
  document.addEventListener("DOMContentLoaded", () => setTimeout(start, 600));
})();

window.TeacherReports = TeacherReports;
