class AssessmentScores {
  static classId = "";
  static classInfo = null;
  static learners = [];
  static selectedLearnerId = null;
  static currentForm = null;
  static search = "";

  // Drives both the AF5 Assessment Results table and what gets read/written
  // to the "scores" JSON blob. Every "score" row has pre/post + a
  // teacher-typed likelihood string (matching the real paper form, which
  // shows no visible max-per-item or formula to compute it from).
  static AF5_ROWS = [
    { type: "score", id: "pis", label: "PIS Score" },
    { type: "section", label: "Assessment for Basic Literacy (ABL)" },
    { type: "status", id: "abl_neo", label: "Neo Literate" },
    { type: "status", id: "abl_post", label: "Post Literate" },
    { type: "section", label: "Functional Literacy Assessment (FLT)" },
    { type: "subsection", label: "LS 1 - Communication Skills (English)" },
    { type: "score", id: "flt_ls1_en_mc", label: "Multiple Choice", indent: true },
    { type: "score", id: "flt_ls1_en_writing", label: "Writing", indent: true },
    { type: "score", id: "flt_ls1_en_listening", label: "Listening/Speaking", indent: true },
    { type: "subsection", label: "LS 1 - Communication Skills (Filipino)" },
    { type: "score", id: "flt_ls1_fil_mc", label: "Multiple Choice", indent: true },
    { type: "score", id: "flt_ls1_fil_writing", label: "Pagsulat", indent: true },
    { type: "score", id: "flt_ls1_fil_listening", label: "Pakikinig/Pagsasalita", indent: true },
    { type: "score", id: "flt_ls2", label: "LS 2 - Scientific Literacy and Critical Thinking Skills" },
    { type: "score", id: "flt_ls3", label: "LS 3 - Mathematical and Problem Solving Skills" },
    { type: "score", id: "flt_ls4", label: "LS 4 - Life and Career Skills" },
    { type: "score", id: "flt_ls5", label: "LS 5 - Understanding the Self and Society" },
    { type: "score", id: "flt_ls6", label: "LS 6 - Digital Citizenship" },
  ];

  static PORTFOLIO_WORK_SAMPLE_ROWS = [
    { id: "ls1_en", label: "LS 1 - Communication Skills (English)" },
    { id: "ls1_fil", label: "LS 1 - Communication Skills (Filipino)" },
    { id: "ls2", label: "LS 2 - Scientific Literacy and Critical Thinking Skills" },
    { id: "ls3", label: "LS 3 - Mathematical and Problem Solving Skills" },
    { id: "ls4", label: "LS 4 - Life and Career Skills" },
    { id: "ls5", label: "LS 5 - Understanding the Self and Society" },
    { id: "ls6", label: "LS 6 - Digital Citizenship" },
  ];

  static PORTFOLIO_REVALIDA_ROWS = [
    { id: "revalida_oral_reading", label: "Oral Reading" },
    { id: "revalida_writing", label: "Writing" },
    { id: "revalida_interview", label: "Interview" },
  ];

  static async init() {
    if (window.Guards) Guards.teacher();

    const params = new URLSearchParams(window.location.search);
    this.classId = params.get("class") || "";

    this.bindSearch();
    this.bindSave();

    await this.loadClassContext();
    await this.loadLearners();
  }

  // Same pattern as module-management.js's loadClassContext().
  static async loadClassContext() {
    if (!this.classId) return;

    try {
      const response = await API.getTeacherClasses();
      const match = (response?.data || []).find(
        (item) => String(item.id) === String(this.classId),
      );
      if (!match) return;

      this.classInfo = match;
      const badge = document.querySelector("[data-learner-level-badge]");
      if (badge) badge.textContent = match.level || "—";
    } catch (error) {
      console.error("[AssessmentScores] Unable to load class context", error);
    }
  }

  static async loadLearners() {
    const list = document.querySelector("[data-learner-list]");

    try {
      const res = await API.getLearners(this.classId ? { class: this.classId } : {});
      this.learners = res.data || [];

      this.renderLearnerList();
    } catch (error) {
      console.error("[AssessmentScores] Unable to load learners", error);
      if (list) list.innerHTML = `<p class="st-assessment-empty">Unable to load learners.</p>`;
    }
  }

  static bindSearch() {
    document.querySelector("[data-learner-search]")?.addEventListener("input", (e) => {
      this.search = e.target.value.trim().toLowerCase();
      this.renderLearnerList();
    });
  }

  static filteredLearners() {
    if (!this.search) return this.learners;
    return this.learners.filter(
      (l) =>
        (l.name || "").toLowerCase().includes(this.search) ||
        (l.lrn || "").toLowerCase().includes(this.search),
    );
  }

  static renderLearnerList() {
    const list = document.querySelector("[data-learner-list]");
    const countEl = document.querySelector("[data-learner-count]");
    if (!list) return;

    const filtered = this.filteredLearners();
    if (countEl) countEl.textContent = this.learners.length;

    if (!filtered.length) {
      list.innerHTML = `<p class="st-assessment-empty">No learners found.</p>`;
      return;
    }

    list.innerHTML = filtered
      .map(
        (l) => `
          <button
            type="button"
            class="st-assessment-learner-row ${String(l.id) === String(this.selectedLearnerId) ? "is-active" : ""}"
            data-learner-row="${l.id}"
          >
            <span class="st-assessment-avatar st-assessment-avatar--sm">${this.initials(l.name)}</span>
            <span class="st-assessment-learner-row-text">
              <span class="st-assessment-learner-row-name">${this.esc(l.name)}</span>
              <span class="st-assessment-learner-row-lrn">LRN: ${this.esc(l.lrn || "—")}</span>
            </span>
          </button>
        `,
      )
      .join("");

    list.querySelectorAll("[data-learner-row]").forEach((btn) => {
      btn.addEventListener("click", () => this.selectLearner(Number(btn.dataset.learnerRow)));
    });
  }

  static async selectLearner(learnerId) {
    this.selectedLearnerId = learnerId;
    this.renderLearnerList();

    document.querySelector("[data-no-learner-panel]").hidden = true;
    const panel = document.querySelector("[data-detail-panel]");
    panel.hidden = false;

    const learner = this.learners.find((l) => l.id === learnerId);
    if (learner) {
      document.querySelector("[data-detail-avatar]").textContent = this.initials(learner.name);
      document.querySelector("[data-detail-name]").textContent = learner.name;
      document.querySelector("[data-detail-meta]").textContent =
        `LRN: ${learner.lrn || "—"} · Level: ${learner.level || "—"} · SY: ${learner.school_year || this.classInfo?.schoolYear || "—"}`;
    }

    const formRoot = document.querySelector("[data-assessment-form]");
    formRoot.innerHTML = `<p class="st-assessment-empty">Loading scores…</p>`;

    try {
      this.currentForm = await API.getAssessmentScores(learnerId);
      this.renderAssessedBadge();
      this.renderForm();
    } catch (error) {
      console.error("[AssessmentScores] Unable to load scores", error);
      Toast?.error("Unable to load this learner's assessment scores.");
      formRoot.innerHTML = `<p class="st-assessment-empty">Unable to load scores.</p>`;
    }
  }

  static renderAssessedBadge() {
    const badge = document.querySelector("[data-detail-assessed-badge]");
    if (!badge) return;
    const assessed = Boolean(this.currentForm?.assessed);
    badge.textContent = assessed ? "Assessed" : "Not Assessed";
    badge.classList.toggle("st-badge-success", assessed);
    badge.classList.toggle("st-badge-info", !assessed);
  }

  static renderForm() {
    const root = document.querySelector("[data-assessment-form]");
    const f = this.currentForm || {};
    const scores = f.scores || {};
    const portfolio = f.portfolio || {};

    root.innerHTML = `
      <div class="st-assessment-table-card">
        <div class="st-assessment-table-head">
          <h3>AF5 - ASSESSMENT RESULTS</h3>
        </div>
        <table class="st-assessment-table">
          <thead>
            <tr>
              <th>Assessment Component / Learning Area</th>
              <th colspan="2">Score</th>
              <th>Likelihood of Passing A&amp;E Exam</th>
            </tr>
            <tr class="st-assessment-subhead">
              <th></th><th>Pre</th><th>Post</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${this.AF5_ROWS.map((row) => this.renderAf5Row(row, scores)).join("")}
            <tr class="st-assessment-total-row">
              <td>Overall Score</td>
              <td><input type="text" class="st-assessment-input" readonly value="${f.overallScorePre ?? 0}"></td>
              <td><input type="text" class="st-assessment-input" readonly value="${f.overallScorePost ?? 0}"></td>
              <td>
                <input
                  type="text"
                  class="st-assessment-input st-assessment-input--wide"
                  placeholder="e.g. 84% HIGH LIKELIHOOD (PASS)"
                  data-overall-likelihood
                  value="${this.escAttr(scores.overall_likelihood)}"
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="st-assessment-table-card">
        <div class="st-assessment-table-head">
          <h3>PRESENTATION PORTFOLIO ASSESSMENT</h3>
        </div>
        <table class="st-assessment-table">
          <thead>
            <tr>
              <th>Activity / Component</th>
              <th>Remarks / Raw Score</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Date of Assessment</td>
              <td><input type="date" class="st-assessment-input" data-date-of-assessment value="${f.dateOfAssessment || ""}"></td>
            </tr>
            <tr class="st-assessment-section-row"><td colspan="2">Final Assessment of Work Samples (Raw Score)</td></tr>
            ${this.PORTFOLIO_WORK_SAMPLE_ROWS.map(
              (row) => `
                <tr>
                  <td class="st-assessment-indent">${this.esc(row.label)}</td>
                  <td><input type="number" step="0.5" class="st-assessment-input" data-portfolio-field="${row.id}" value="${portfolio[row.id] ?? ""}"></td>
                </tr>
              `,
            ).join("")}
            <tr class="st-assessment-total-row">
              <td>TOTAL SCORE</td>
              <td><input type="text" class="st-assessment-input" readonly value="${f.portfolioTotalScore ?? 0}"></td>
            </tr>
            <tr class="st-assessment-section-row"><td colspan="2">Inter-District Revalida</td></tr>
            ${this.PORTFOLIO_REVALIDA_ROWS.map(
              (row) => `
                <tr>
                  <td class="st-assessment-indent">${this.esc(row.label)}</td>
                  <td><input type="number" step="0.5" class="st-assessment-input" data-portfolio-field="${row.id}" value="${portfolio[row.id] ?? ""}"></td>
                </tr>
              `,
            ).join("")}
            <tr class="st-assessment-total-row">
              <td>FINAL SCORE PERCENTAGE GRADE</td>
              <td><input type="text" class="st-assessment-input" placeholder="e.g. 68%" data-final-grade value="${this.escAttr(f.finalScorePercentageGrade)}"></td>
            </tr>
          </tbody>
        </table>
        <div class="st-assessment-rating-banner">
          <span>OVERALL FINAL ASSESSMENT RATING</span>
          <input type="text" class="st-assessment-rating-input" placeholder="e.g. 98.55" data-overall-rating value="${this.escAttr(f.overallFinalAssessmentRating)}">
        </div>
      </div>
    `;
  }

  static renderAf5Row(row, scores) {
    if (row.type === "section") {
      return `<tr class="st-assessment-section-row"><td colspan="4">${this.esc(row.label)}</td></tr>`;
    }
    if (row.type === "subsection") {
      return `<tr class="st-assessment-subsection-row"><td colspan="4">${this.esc(row.label)}</td></tr>`;
    }

    const r = scores[row.id] || {};
    const labelClass = row.indent ? "st-assessment-indent" : "";

    if (row.type === "status") {
      return `
        <tr>
          <td class="${labelClass}">${this.esc(row.label)}</td>
          <td><input type="number" step="0.5" class="st-assessment-input" data-score-field="${row.id}" data-score-part="pre" value="${r.pre ?? ""}"></td>
          <td><input type="number" step="0.5" class="st-assessment-input" data-score-field="${row.id}" data-score-part="post" value="${r.post ?? ""}"></td>
          <td><input type="text" class="st-assessment-input st-assessment-input--wide" placeholder="Status" data-score-field="${row.id}" data-score-part="status" value="${this.escAttr(r.status)}"></td>
        </tr>
      `;
    }

    return `
      <tr>
        <td class="${labelClass}">${this.esc(row.label)}</td>
        <td><input type="number" step="0.5" class="st-assessment-input" data-score-field="${row.id}" data-score-part="pre" value="${r.pre ?? ""}"></td>
        <td><input type="number" step="0.5" class="st-assessment-input" data-score-field="${row.id}" data-score-part="post" value="${r.post ?? ""}"></td>
        <td><input type="text" class="st-assessment-input st-assessment-input--wide" placeholder="e.g. 82% (Likely)" data-score-field="${row.id}" data-score-part="likelihood" value="${this.escAttr(r.likelihood)}"></td>
      </tr>
    `;
  }

  static bindSave() {
    document.querySelector("[data-save-scores-btn]")?.addEventListener("click", () => this.save());
  }

  static async save() {
    if (!this.selectedLearnerId) return;

    const scores = {};
    this.AF5_ROWS.filter((r) => r.id).forEach((row) => {
      scores[row.id] = {
        pre: this.readNumber(`[data-score-field="${row.id}"][data-score-part="pre"]`),
        post: this.readNumber(`[data-score-field="${row.id}"][data-score-part="post"]`),
        likelihood: this.readText(`[data-score-field="${row.id}"][data-score-part="likelihood"]`),
        status: this.readText(`[data-score-field="${row.id}"][data-score-part="status"]`),
      };
    });
    scores.overall_likelihood = this.readText("[data-overall-likelihood]");

    const portfolio = {};
    [...this.PORTFOLIO_WORK_SAMPLE_ROWS, ...this.PORTFOLIO_REVALIDA_ROWS].forEach((row) => {
      portfolio[row.id] = this.readNumber(`[data-portfolio-field="${row.id}"]`);
    });

    const payload = {
      dateOfAssessment: document.querySelector("[data-date-of-assessment]")?.value || null,
      scores,
      portfolio,
      finalScorePercentageGrade: this.readNumber("[data-final-grade]"),
      overallFinalAssessmentRating: this.readNumber("[data-overall-rating]"),
    };

    const btn = document.querySelector("[data-save-scores-btn]");
    if (btn) btn.disabled = true;

    try {
      this.currentForm = await API.updateAssessmentScores(this.selectedLearnerId, payload);
      this.renderAssessedBadge();
      this.renderForm();
      Toast?.success("Scores saved.");
    } catch (error) {
      console.error("[AssessmentScores] Unable to save scores", error);
      Toast?.error(error?.data?.message || "Unable to save these scores.");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  static readNumber(selector) {
    const raw = document.querySelector(selector)?.value;
    return raw === "" || raw == null ? null : Number(raw);
  }

  static readText(selector) {
    const raw = document.querySelector(selector)?.value;
    return raw === "" || raw == null ? null : raw.trim();
  }

  static initials(name) {
    return (name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join("");
  }

  static esc(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  static escAttr(value) {
    return value == null ? "" : this.esc(value);
  }
}

document.addEventListener("DOMContentLoaded", () => AssessmentScores.init());

window.AssessmentScores = AssessmentScores;
