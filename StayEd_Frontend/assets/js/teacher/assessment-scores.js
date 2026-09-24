class AssessmentScores {
  static classId = "";
  static classInfo = null;
  static learners = [];
  static selectedLearnerId = null;
  static currentForm = null;
  static search = "";
  static requestedLearnerId = null;
  static returnUrl = "";

  // Drives both the AF5 Assessment Results table and what gets read/written
  // to the "scores" JSON blob. Per-component rows keep only the recorded
  // pre/post values. The overall passing-likelihood label is computed from
  // the FLT post-test total compared with the same component scales used by
  // the percentage column, instead of from the separate portfolio final grade.
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

  // Internal display scales used to show the per-row percentage badges that
  // appear in the AF5 table. These are UI-only helper scales so teachers can
  // see a percentage-based snapshot beside each encoded post score.
  static COMPONENT_MAX_SCORES = {
    pis: 10,
    flt_ls1_en_mc: 8.5,
    flt_ls1_en_writing: 4,
    flt_ls1_en_listening: 2.5,
    flt_ls1_fil_mc: 7.5,
    flt_ls1_fil_writing: 2.6,
    flt_ls1_fil_listening: 2.5,
    flt_ls2: 14,
    flt_ls3: 17,
    flt_ls4: 11.8,
    flt_ls5: 11.5,
    flt_ls6: 11.8,
  };

  static get FLT_TOTAL_MAX_SCORE() {
    return Object.entries(this.COMPONENT_MAX_SCORES)
      .filter(([rowId]) => rowId !== "pis")
      .reduce((sum, [, maxScore]) => sum + maxScore, 0);
  }

  static async init() {
    if (window.Guards) Guards.teacher();

    const params = new URLSearchParams(window.location.search);
    this.classId = params.get("class") || "";
    this.requestedLearnerId = params.get("learner") ? Number(params.get("learner")) : null;
    this.returnUrl = params.get("return") || "";

    this.bindSearch();
    this.bindSave();

    await this.loadClassContext();
    await this.loadLearners();

    if (this.requestedLearnerId) {
      const exists = this.learners.some((l) => String(l.id) === String(this.requestedLearnerId));
      if (exists) {
        await this.selectLearner(this.requestedLearnerId);
      } else {
        Toast?.error("Requested learner was not found in this assessment list.");
      }
    }
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
              <th>Likelihood / Competency</th>
            </tr>
            <tr class="st-assessment-subhead">
              <th></th><th>Pre</th><th>Post</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${this.AF5_ROWS.map((row) => this.renderAf5Row(row, scores)).join("")}
            <tr class="st-assessment-total-row">
              <td>Overall Score</td>
              <td><input type="text" class="st-assessment-input" data-overall-pre readonly value="${f.overallScorePre ?? 0}"></td>
              <td><input type="text" class="st-assessment-input" data-overall-post readonly value="${f.overallScorePost ?? 0}"></td>
              <td class="st-assessment-result-cell" data-overall-grade-cell>${this.renderOverallLikelihoodCell(f.overallScorePost)}</td>
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
              <td><input type="text" class="st-assessment-input" data-portfolio-total readonly value="${f.portfolioTotalScore ?? 0}"></td>
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
              <td><input type="number" min="0" max="100" step="0.01" class="st-assessment-input" placeholder="e.g. 68" data-final-grade value="${this.escAttr(f.finalScorePercentageGrade)}"></td>
            </tr>
          </tbody>
        </table>
        <div class="st-assessment-rating-banner">
          <span>OVERALL FINAL ASSESSMENT RATING</span>
          <input type="text" class="st-assessment-rating-input" placeholder="e.g. 98.55" data-overall-rating value="${this.escAttr(f.overallFinalAssessmentRating)}">
        </div>

        <div class="st-assessment-likelihood-summary">
          <div>
            <span class="material-symbols-outlined">analytics</span>
            <div>
              <p class="st-assessment-likelihood-kicker">Likelihood of Passing A&amp;E Exam</p>
              <strong data-overall-likelihood-preview>${this.esc(scores.overall_likelihood || (f.overallScorePercentage == null ? "Waiting for post-test scores" : this.likelihoodLabel(f.overallScorePercentage)))}</strong>
            </div>
          </div>
          <p>Calculated from the learner's <strong>FLT post-test total</strong>. StayEd internal threshold: <strong>High likelihood = 70% or above</strong>; <strong>Low likelihood = below 70%</strong>. This is a project readiness rule, not an official DepEd A&amp;E passing mark.</p>
        </div>
      </div>
    `;

    this.bindLivePreview();
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
        <td class="st-assessment-result-cell" data-computed-cell="${row.id}">${this.renderComputedRowResult(row.id, r)}</td>
      </tr>
    `;
  }

  static renderComputedRowResult(rowId, rowData = {}) {
    const percentage = this.rowPercentage(rowId, rowData);
    if (percentage == null) {
      return `<span class="st-assessment-computed-empty">—</span>`;
    }

    if (rowId === "pis") {
      const competency = this.competencyLabel(percentage);
      return `
        <div class="st-assessment-result">
          <span class="st-assessment-result-pill is-competency">${percentage}%</span>
          <span class="st-assessment-result-note">${this.esc(competency)}</span>
        </div>
      `;
    }

    const { label, tone } = this.componentLikelihoodMeta(percentage);
    return `
      <div class="st-assessment-result">
        <span class="st-assessment-result-pill is-${tone}">${percentage}%</span>
        <span class="st-assessment-result-note">(${this.esc(label)})</span>
      </div>
    `;
  }

  static renderOverallLikelihoodCell(overallPostScore) {
    const percentage = this.overallLikelihoodPercentage(overallPostScore);
    if (percentage == null) {
      return `<span class="st-assessment-computed-empty">Waiting for post-test scores</span>`;
    }
    const passed = percentage >= 70;
    return `
      <div class="st-assessment-result st-assessment-result--overall">
        <span class="st-assessment-result-pill ${passed ? "is-high" : "is-low"}">${percentage}%</span>
        <span class="st-assessment-result-note">${passed ? "HIGH LIKELIHOOD (PASS)" : "LOW LIKELIHOOD"}</span>
      </div>
    `;
  }

  static overallLikelihoodPercentage(overallPostScore) {
    if (overallPostScore == null || overallPostScore === "") return null;
    const score = Number(overallPostScore);
    if (!Number.isFinite(score)) return null;
    return this.roundPercent((score / this.FLT_TOTAL_MAX_SCORE) * 100);
  }

  static rowPercentage(rowId, rowData = {}) {
    const value = rowData.post ?? rowData.pre;
    const maxScore = this.COMPONENT_MAX_SCORES[rowId];
    if (value == null || value === "" || !maxScore) return null;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;
    return this.roundPercent((numericValue / maxScore) * 100);
  }

  static roundPercent(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(0, Math.min(100, Math.round(numeric)));
  }

  static competencyLabel(percentage) {
    if (percentage >= 90) return "Proficient";
    if (percentage >= 75) return "Approaching Proficiency";
    if (percentage >= 60) return "Developing";
    return "Beginning";
  }

  static componentLikelihoodMeta(percentage) {
    if (percentage >= 85) return { label: "High", tone: "high" };
    if (percentage >= 80) return { label: "Likely", tone: "likely" };
    if (percentage >= 75) return { label: "Moderate", tone: "moderate" };
    return { label: "Low", tone: "low" };
  }

  static likelihoodLabel(value) {
    if (value == null || String(value).trim() === "") {
      return "Waiting for final percentage grade";
    }
    const score = Number(value);
    if (!Number.isFinite(score)) return "Waiting for final percentage grade";
    return score >= 70 ? "HIGH LIKELIHOOD" : "LOW LIKELIHOOD";
  }

  static bindLivePreview() {
    const grade = document.querySelector("[data-final-grade]");
    const preview = document.querySelector("[data-overall-likelihood-preview]");
    const overallGradeCell = document.querySelector("[data-overall-grade-cell]");

    const updateLikelihoodPreview = () => {
      const overallPost = this.sumRowScores("post");
      const percentage = this.overallLikelihoodPercentage(overallPost);
      if (preview) {
        preview.textContent = percentage == null ? "Waiting for post-test scores" : this.likelihoodLabel(percentage);
        preview.dataset.level = percentage == null ? "neutral" : percentage >= 70 ? "high" : "low";
      }
      if (overallGradeCell) {
        overallGradeCell.innerHTML = this.renderOverallLikelihoodCell(overallPost);
      }
    };

    const updateRowPreview = (rowId) => {
      const target = document.querySelector(`[data-computed-cell="${rowId}"]`);
      if (!target) return;
      target.innerHTML = this.renderComputedRowResult(rowId, this.readScoreRowFromDom(rowId));
    };

    const updateOverallScores = () => {
      const preEl = document.querySelector("[data-overall-pre]");
      const postEl = document.querySelector("[data-overall-post]");
      if (preEl) {
        preEl.value = this.sumRowScores("pre");
      }
      if (postEl) {
        postEl.value = this.sumRowScores("post");
      }
    };

    const updatePortfolioTotal = () => {
      const totalEl = document.querySelector("[data-portfolio-total]");
      if (!totalEl) return;
      let total = 0;
      this.PORTFOLIO_WORK_SAMPLE_ROWS.forEach((row) => {
        const value = this.readNumber(`[data-portfolio-field="${row.id}"]`);
        total += value || 0;
      });
      totalEl.value = total;
    };

    document.querySelectorAll("[data-score-field][data-score-part='pre'], [data-score-field][data-score-part='post']").forEach((input) => {
      input.addEventListener("input", () => {
        const rowId = input.dataset.scoreField;
        updateRowPreview(rowId);
        updateOverallScores();
        updateLikelihoodPreview();
      });
    });

    document.querySelectorAll("[data-portfolio-field]").forEach((input) => {
      input.addEventListener("input", updatePortfolioTotal);
    });

    this.AF5_ROWS.filter((row) => row.id && row.type === "score").forEach((row) => updateRowPreview(row.id));
    updateOverallScores();
    updatePortfolioTotal();
    updateLikelihoodPreview();
  }

  static readScoreRowFromDom(rowId) {
    return {
      pre: this.readNumber(`[data-score-field="${rowId}"][data-score-part="pre"]`),
      post: this.readNumber(`[data-score-field="${rowId}"][data-score-part="post"]`),
    };
  }

  static sumRowScores(part) {
    const rows = this.AF5_ROWS.filter((row) => row.id && row.type === "score" && row.id !== "pis");
    const total = rows.reduce((sum, row) => sum + (this.readNumber(`[data-score-field="${row.id}"][data-score-part="${part}"]`) || 0), 0);
    return Number.isInteger(total) ? total : Number(total.toFixed(2));
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
        likelihood: this.currentForm?.scores?.[row.id]?.likelihood ?? null,
        status: this.readText(`[data-score-field="${row.id}"][data-score-part="status"]`)
          ?? this.currentForm?.scores?.[row.id]?.status
          ?? null,
      };
    });
    const overallPostForLikelihood = this.sumRowScores("post");
    const overallPercentage = this.overallLikelihoodPercentage(overallPostForLikelihood);
    scores.overall_likelihood = overallPercentage == null ? null : this.likelihoodLabel(overallPercentage);

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
