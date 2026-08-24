class TeacherReports {
  static state = {
    learners: [],
    classes: [],
  };

  static async init() {
    if (window.Guards) Guards.teacher();

    this.bindControls();

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

      this.populateLearnerSelect();
      this.populateClassSelects();
    } catch (error) {
      console.error("[TeacherReports]", error);
      Toast?.error("Unable to load report filters.");
    }
  }

  static populateLearnerSelect() {
    const select = document.querySelector("[data-report-learner]");
    if (!select) return;

    const sorted = [...this.state.learners].sort((a, b) =>
      (a.name || "").localeCompare(b.name || ""),
    );

    select.innerHTML =
      `<option value="">Select a learner…</option>` +
      sorted
        .map((l) => `<option value="${l.id}">${l.name} (${l.lrn})</option>`)
        .join("");
  }

  static populateClassSelects() {
    const options =
      `<option value="">All Classes</option>` +
      this.state.classes
        .map(
          (c) =>
            `<option value="${c.id}">${c.className || `${c.learningLevel} — ${c.schoolYear}`}</option>`,
        )
        .join("");

    const atRisk = document.querySelector("[data-report-atrisk-class]");
    const intervention = document.querySelector(
      "[data-report-intervention-class]",
    );

    if (atRisk) atRisk.innerHTML = options;
    if (intervention) intervention.innerHTML = options;
  }

  static bindControls() {
    document
      .querySelector("[data-generate-progress]")
      ?.addEventListener("click", () => this.generateProgress());

    document
      .querySelector("[data-generate-atrisk]")
      ?.addEventListener("click", () => this.generateAtRisk());

    document
      .querySelector("[data-generate-intervention]")
      ?.addEventListener("click", () => this.generateIntervention());
  }

  static async generateProgress() {
    const learnerId = document.querySelector("[data-report-learner]")?.value;

    if (!learnerId) {
      Toast?.error("Select a learner first.");
      return;
    }

    try {
      const profile = await API.getLearnerProfile(learnerId);
      ReportPrinter.open(this.buildProgressReport(profile));
    } catch (error) {
      console.error("[TeacherReports]", error);
      Toast?.error("Unable to generate the report.");
    }
  }

  static buildProgressReport(p) {
    const riskPct = Math.round((p.risk_probability || 0) * 100);

    return {
      title: "Individual Learner Progress Report",
      subtitle: `${p.name} — LRN ${p.lrn}`,
      meta: [
        { label: "Learning Level", value: p.level || "—" },
        { label: "Modality", value: p.modality || "—" },
        { label: "Learning Center", value: p.clc || "—" },
        { label: "Class", value: p.header?.currentClass || "—" },
        { label: "School Year", value: p.header?.schoolYear || "—" },
        { label: "Date Enrolled", value: p.header?.dateEnrolled || "—" },
        {
          label: "Current Risk Level",
          value:
            p.risk && p.risk !== "Not Yet Assessed"
              ? `${p.risk} (${riskPct}%)`
              : "Not Yet Assessed",
        },
        { label: "Module Returns", value: p.metrics?.moduleRateText || "—" },
      ],
      sections: [
        {
          type: "table",
          title: "Risk Trend (Last 6 Assessments)",
          columns: ["Date", "Risk Level", "Probability"],
          rows: (p.riskTrend || []).map((r) => [
            r.date,
            ReportPrinter.riskBadge(r.level),
            r.probability != null ? `${r.probability}%` : "—",
          ]),
          emptyText: "No prediction history available yet.",
        },
        {
          type: "table",
          title: "Module Monitoring History",
          columns: ["Module", "Released", "Submitted"],
          rows: (p.monitoringHistory?.modules || []).map((m) => [
            m.module,
            m.released,
            m.submitted,
          ]),
          emptyText: "No modules released yet.",
        },
        {
          type: "table",
          title: "Intervention History",
          columns: ["Date Assigned", "Intervention Method", "Status", "Remarks"],
          rows: (p.interventions?.history || []).map((i) => [
            i.date,
            i.intervention,
            i.status,
            i.remarks,
          ]),
          emptyText: "No interventions have been assigned.",
        },
        {
          type: "table",
          title: "Risk Contributors",
          columns: ["Factor", "Level", "Detail"],
          rows: (p.riskExplanation?.contributors || []).map((c) => [
            c.title,
            c.level,
            c.text,
          ]),
          emptyText: "No specific risk contributors identified.",
        },
        {
          type: "table",
          title: "Recommended Actions",
          columns: ["Priority", "Action", "Detail"],
          rows: (p.recommendedActions || []).map((r) => [
            Utils.capitalize(r.priority),
            r.title,
            r.text,
          ]),
          emptyText: "No recommended actions at this time.",
        },
      ],
    };
  }

  static async generateAtRisk() {
    const classId =
      document.querySelector("[data-report-atrisk-class]")?.value || "";

    try {
      const res = await API.getAtRiskReport(
        classId ? { class_id: classId } : {},
      );
      const rows = res.data || [];

      ReportPrinter.open({
        title: "At-Risk Learners List",
        subtitle: "Learners flagged High or Moderate risk of dropping out",
        meta: [
          { label: "Total At-Risk Learners", value: rows.length },
          {
            label: "High Risk",
            value: rows.filter((l) => l.risk === "High").length,
          },
          {
            label: "Moderate Risk",
            value: rows.filter((l) => l.risk === "Moderate").length,
          },
        ],
        sections: [
          {
            type: "table",
            title: "At-Risk Learners",
            columns: [
              "LRN",
              "Learner",
              "Level",
              "Modality",
              "Risk Level",
              "Risk Probability",
              "Last Activity",
            ],
            rows: rows.map((l) => [
              l.lrn,
              l.name,
              l.level,
              l.modality,
              ReportPrinter.riskBadge(l.risk),
              `${Math.round((l.risk_probability || 0) * 100)}%`,
              l.activity_text,
            ]),
            emptyText:
              "No learners are currently flagged High or Moderate risk.",
          },
        ],
      });
    } catch (error) {
      console.error("[TeacherReports]", error);
      Toast?.error("Unable to generate the report.");
    }
  }

  static async generateIntervention() {
    const classId =
      document.querySelector("[data-report-intervention-class]")?.value ||
      "";
    const status =
      document.querySelector("[data-report-intervention-status]")?.value ||
      "";

    try {
      const params = {};
      if (classId) params.class_id = classId;
      if (status) params.status = status;

      const res = await API.getInterventionReport(params);
      const rows = res.data || [];

      ReportPrinter.open({
        title: "Intervention Tracking Report",
        subtitle: "Corrective actions logged per learner",
        meta: [
          { label: "Total Interventions", value: rows.length },
          {
            label: "Completed",
            value: rows.filter((r) => r.status === "Completed").length,
          },
          {
            label: "In Progress",
            value: rows.filter((r) => r.status === "In Progress").length,
          },
        ],
        sections: [
          {
            type: "table",
            title: "Interventions",
            columns: [
              "Learner",
              "LRN",
              "Intervention Method",
              "Description",
              "Date Assigned",
              "Status",
              "Outcome",
            ],
            rows: rows.map((r) => [
              r.learner_name,
              r.lrn,
              r.intervention_type,
              r.description,
              Utils.formatDate(r.date_assigned),
              r.status,
              r.follow_up_outcome,
            ]),
            emptyText: "No interventions recorded yet.",
          },
        ],
      });
    } catch (error) {
      console.error("[TeacherReports]", error);
      Toast?.error("Unable to generate the report.");
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
