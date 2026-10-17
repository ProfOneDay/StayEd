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
    { type: "abl", id: "abl_neo", label: "Neo Literate", preMax: 23, postMax: 38 },
    { type: "abl", id: "abl_post", label: "Post Literate", preMax: 40, postMax: 40 },
    { type: "section", label: "Functional Literacy Assessment (FLT)" },
    { type: "subsection", label: "LS 1 - Communication Skills (English)", group: "ls1_en" },
    { type: "score", id: "flt_ls1_en_mc", label: "Multiple Choice", indent: true },
    { type: "score", id: "flt_ls1_en_writing", label: "Writing", indent: true },
    { type: "score", id: "flt_ls1_en_listening", label: "Listening/Speaking", indent: true },
    { type: "subsection", label: "LS 1 - Communication Skills (Filipino)", group: "ls1_fil" },
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

  // Presentation Portfolio Assessment scoring basis used by the later PPA Year 5 rules:
  // 7 work-sample learning strands x HPS 4 = 28 points, plus 41 points
  // for the Inter-District Revalida (18 Oral Reading + 18 Writing + 5 Interview).
  static PORTFOLIO_WORK_SAMPLE_HPS = 4;
  static PORTFOLIO_REVALIDA_MAX_SCORES = {
    revalida_oral_reading: 18,
    revalida_writing: 18,
    revalida_interview: 5,
  };

  static get PORTFOLIO_WORK_SAMPLE_MAX_SCORE() {
    return this.PORTFOLIO_WORK_SAMPLE_ROWS.length * this.PORTFOLIO_WORK_SAMPLE_HPS;
  }

  static get PORTFOLIO_REVALIDA_MAX_SCORE() {
    return Object.values(this.PORTFOLIO_REVALIDA_MAX_SCORES).reduce((sum, value) => sum + value, 0);
  }

  static get PORTFOLIO_MAX_SCORE() {
    return this.PORTFOLIO_WORK_SAMPLE_MAX_SCORE + this.PORTFOLIO_REVALIDA_MAX_SCORE;
  }

  // Item totals supplied for the AF5 scoring basis. LS1 English and Filipino
  // are grouped subjects: their three detailed rows add up to one /15 score.
  // The full assessment is 98 items total.
  static SUBJECT_MAX_SCORES = {
    pis: 10,
    ls1_en: 15,
    ls1_fil: 15,
    flt_ls2: 13,
    flt_ls3: 15,
    flt_ls4: 10,
    flt_ls5: 10,
    flt_ls6: 10,
  };

  static SUBJECT_GROUPS = {
    ls1_en: ["flt_ls1_en_mc", "flt_ls1_en_writing", "flt_ls1_en_listening"],
    ls1_fil: ["flt_ls1_fil_mc", "flt_ls1_fil_writing", "flt_ls1_fil_listening"],
  };

  // Each LS1 detailed component contributes 5 points to its /15 strand total.
  static GROUP_COMPONENT_MAX_SCORE = 5;

  static get TOTAL_ASSESSMENT_MAX_SCORE() {
    return Object.values(this.SUBJECT_MAX_SCORES).reduce((sum, value) => sum + value, 0);
  }

  // DepEd ALS assessment applicability (DO 001, s. 2026):
  // - Basic Literacy Program (BLP): ABL is the program-specific assessment.
  //   The revised FLT may also be recorded here as the learner's entry-level
  //   assessment before learning intervention; it is not used for StayEd's
  //   A&E passing-likelihood calculation for BLP learners.
  // - A&E Elementary / Junior High School: FLT is used before, during and
  //   after ALS classes. PPA is part of the A&E certification process.
  // - Senior High School: ABL, FLT and the Elementary/JHS PPA block are not
  //   applicable on this screen.
  static learningLevelCodeFrom(value) {
    const raw = String(value || "").trim().toLowerCase();

    if (raw === "blp" || raw.includes("basic literacy")) return "BLP";
    if (raw.includes("junior")) return "JUNIOR_HIGH_SCHOOL";
    if (raw.includes("senior")) return "SENIOR_HIGH_SCHOOL";
    if (raw.includes("elementary")) return "ELEMENTARY";
    return "UNKNOWN";
  }

  static currentLearningLevelCode() {
    const learner = this.learners.find((item) => String(item.id) === String(this.selectedLearnerId));
    return this.learningLevelCodeFrom(
      this.classInfo?.level
      || this.classInfo?.learningLevel
      || learner?.level
      || "",
    );
  }

  static supportsAssessmentRecords(levelCode = this.currentLearningLevelCode()) {
    return ["BLP", "ELEMENTARY", "JUNIOR_HIGH_SCHOOL"].includes(levelCode);
  }

  static usesAbl() {
    return this.currentLearningLevelCode() === "BLP";
  }

  // FLT can appear for BLP as an entry-level assessment, and is the regular
  // pre/during/post functional-literacy assessment for A&E Elementary/JHS.
  static showsFlt() {
    return ["BLP", "ELEMENTARY", "JUNIOR_HIGH_SCHOOL"].includes(this.currentLearningLevelCode());
  }

  // StayEd's internal A&E passing-likelihood display is only meaningful for
  // the A&E Elementary and Junior High School programs.
  static usesAeReadiness() {
    return ["ELEMENTARY", "JUNIOR_HIGH_SCHOOL"].includes(this.currentLearningLevelCode());
  }

  static usesPortfolio() {
    return ["ELEMENTARY", "JUNIOR_HIGH_SCHOOL"].includes(this.currentLearningLevelCode());
  }

  static visibleAf5Rows() {
    const level = this.currentLearningLevelCode();

    // BLP keeps ABL and the entry-level FLT visible. The render helpers below
    // make the FLT rows entry-only rather than treating them as BLP post-tests.
    if (level === "BLP") return this.AF5_ROWS;

    if (["ELEMENTARY", "JUNIOR_HIGH_SCHOOL"].includes(level)) {
      return this.AF5_ROWS.filter((row) =>
        row.type !== "abl"
        && !(row.type === "section" && row.label.includes("Basic Literacy")),
      );
    }

    if (level === "SENIOR_HIGH_SCHOOL") return [];

    // Backward-compatible fallback if the class context cannot be resolved.
    // This should be rare because the assessment page normally opens from a class.
    return this.AF5_ROWS;
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
      const allLearners = res.data || [];

      // The current Assessment Scores module covers BLP, A&E Elementary,
      // and A&E Junior High only. Senior High learners remain available in
      // enrollment/learner management, but are intentionally excluded here.
      if (this.currentLearningLevelCode() === "SENIOR_HIGH_SCHOOL") {
        this.learners = [];
      } else {
        this.learners = allLearners.filter(
          (learner) => this.learningLevelCodeFrom(learner.level) !== "SENIOR_HIGH_SCHOOL",
        );
      }

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

    const searchInput = document.querySelector("[data-learner-search]");
    if (this.currentLearningLevelCode() === "SENIOR_HIGH_SCHOOL") {
      if (searchInput) searchInput.disabled = true;
      list.innerHTML = `
        <p class="st-assessment-empty">
          Senior High assessment records are outside the current StayEd Assessment Scores module.
          This module supports Basic Literacy, Elementary, and Junior High learners.
        </p>
      `;
      return;
    }
    if (searchInput) searchInput.disabled = false;

    if (!filtered.length) {
      list.innerHTML = `<p class="st-assessment-empty">No supported learners found.</p>`;
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
            <span class="st-assessment-avatar st-assessment-avatar--sm">${Utils.initials(l.name)}</span>
            <span class="st-assessment-learner-row-text">
              <span class="st-assessment-learner-row-name">${this.esc(l.name)}</span>
              <span class="st-assessment-learner-row-lrn">LRN ${this.esc(l.lrn || "—")}</span>
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
    const learner = this.learners.find((item) => String(item.id) === String(learnerId));
    if (this.learningLevelCodeFrom(learner?.level) === "SENIOR_HIGH_SCHOOL") {
      Toast?.error("Senior High assessment records are outside the current Assessment Scores module.");
      return;
    }

    this.selectedLearnerId = learnerId;
    this.renderLearnerList();

    document.querySelector("[data-no-learner-panel]").hidden = true;
    const panel = document.querySelector("[data-detail-panel]");
    panel.hidden = false;

    if (learner) {
      document.querySelector("[data-detail-avatar]").textContent = Utils.initials(learner.name);
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
    badge.textContent = assessed ? "Assessed" : "Not assessed";
    badge.classList.toggle("st-badge-success", assessed);
    badge.classList.toggle("st-badge-info", !assessed);
  }

  static renderForm() {
    const root = document.querySelector("[data-assessment-form]");
    const f = this.currentForm || {};
    const scores = f.scores || {};
    const portfolio = f.portfolio || {};

    // Recompute these from the stored row values instead of trusting legacy
    // backend aggregate fields, so the page is consistent immediately on load.
    const overallPre = this.sumScoreData(scores, "pre");
    const overallPost = this.sumScoreData(scores, "post");
    const hasAnyPost = this.hasAnyPostScoreInData(scores);
    const workSampleTotal = this.portfolioWorkSampleTotal(portfolio);
    const revalidaTotal = this.portfolioRevalidaTotal(portfolio);
    const portfolioRawTotal = this.portfolioRawTotal(portfolio);
    const finalPercentage = this.portfolioPercentageGrade(portfolio);
    const learningLevel = this.currentLearningLevelCode();
    const visibleAf5Rows = this.visibleAf5Rows();
    const isBlp = learningLevel === "BLP";
    const isSeniorHigh = learningLevel === "SENIOR_HIGH_SCHOOL";
    const showAeReadiness = this.usesAeReadiness();
    const showPortfolio = this.usesPortfolio() || learningLevel === "UNKNOWN";

    const contextLabel = document.querySelector("[data-assessment-context-label]");
    if (contextLabel) {
      contextLabel.textContent = isBlp
        ? "AF5 · Basic Literacy & Entry Assessment"
        : isSeniorHigh
          ? "SHS · Outside current assessment module"
          : "AF5 · Assessment Results & Portfolio";
    }

    const saveButton = document.querySelector("[data-save-scores-btn]");
    if (saveButton) saveButton.hidden = isSeniorHigh;

    if (isSeniorHigh) {
      root.innerHTML = `
        <div class="st-assessment-table-card">
          <div class="st-assessment-table-head">
            <h3>Senior High School Assessment</h3>
          </div>
          <p class="st-assessment-empty">
            Senior High assessment records are outside the current StayEd Assessment Scores module. This module currently supports Basic Literacy, Elementary, and Junior High learners.
          </p>
        </div>
      `;
      return;
    }

    root.innerHTML = `
      <div class="st-assessment-table-card">
        <div class="st-assessment-table-head">
          <h3>AF5 · Assessment Results</h3>
          <span class="st-assessment-table-head-subtitle">${isBlp ? "ABL progress scores and entry-level FLT" : "Pre-Test and Post-Test Scores"}</span>
        </div>
        <table class="st-assessment-table st-assessment-table--af5">
          <colgroup>
            <col class="st-assessment-col-area">
            <col class="st-assessment-col-score">
            <col class="st-assessment-col-score">
            <col class="st-assessment-col-readiness">
          </colgroup>
          <thead>
            <tr>
              <th>Component / Learning Area</th>
              <th>${isBlp ? "Pre / Entry" : "Pre"}</th>
              <th>${isBlp ? "Post (ABL only)" : "Post"}</th>
              <th>${isBlp ? "Competency / Notes" : "Likelihood / Competency"}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Date of Assessment</td>
              <td colspan="3"><input type="date" class="st-assessment-input st-assessment-input--date" data-date-of-assessment value="${f.dateOfAssessment || ""}"></td>
            </tr>
            ${visibleAf5Rows.map((row) => this.renderAf5Row(row, scores)).join("")}
            ${isBlp ? `
              <tr class="st-assessment-total-row">
                <td>Entry-Level FLT Score</td>
                <td>${this.renderOverallScoreTotal(overallPre, "pre")}</td>
                <td><span class="st-assessment-computed-empty">—</span></td>
                <td class="st-assessment-result-cell"><span class="st-assessment-result-note">Entry-level reference only</span></td>
              </tr>
            ` : `
              <tr class="st-assessment-total-row">
                <td>Overall FLT Score</td>
                <td>${this.renderOverallScoreTotal(overallPre, "pre")}</td>
                <td>${this.renderOverallScoreTotal(overallPost, "post")}</td>
                <td class="st-assessment-result-cell" data-overall-grade-cell>${this.renderOverallLikelihoodCell(overallPost, hasAnyPost)}</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>

      ${showPortfolio ? `
        <div class="st-assessment-table-card">
          <div class="st-assessment-table-head">
            <h3>Presentation Portfolio Assessment</h3>
          </div>
          <table class="st-assessment-table">
            <thead>
              <tr>
                <th>Activity / Component</th>
                <th>Remarks / Raw Score</th>
              </tr>
            </thead>
            <tbody>
              <tr class="st-assessment-section-row"><td colspan="2">Final Assessment of Work Samples (Raw Score)</td></tr>
              ${this.PORTFOLIO_WORK_SAMPLE_ROWS.map(
                (row) => `
                  <tr>
                    <td class="st-assessment-indent">${this.esc(row.label)}</td>
                    <td><input type="number" min="0" max="${this.PORTFOLIO_WORK_SAMPLE_HPS}" step="0.5" class="st-assessment-input st-assessment-portfolio-work-sample-score" data-portfolio-field="${row.id}" value="${this.escAttr(this.validNumber(portfolio[row.id], this.PORTFOLIO_WORK_SAMPLE_HPS) ?? "")}" aria-label="${this.esc(row.label)} raw score, highest possible score ${this.PORTFOLIO_WORK_SAMPLE_HPS}"></td>
                  </tr>
                `,
              ).join("")}
              <tr class="st-assessment-total-row">
                <td>Total Work Samples Raw Score</td>
                <td>
                  <span class="st-assessment-score-entry st-assessment-score-entry--total">
                    <input type="text" class="st-assessment-input st-assessment-portfolio-work-sample-total" data-portfolio-total readonly value="${workSampleTotal ?? ""}" aria-label="Total Work Samples raw score out of ${this.PORTFOLIO_WORK_SAMPLE_MAX_SCORE}">
                    <span class="st-assessment-score-denominator">/ ${this.PORTFOLIO_WORK_SAMPLE_MAX_SCORE}</span>
                  </span>
                </td>
              </tr>
              <tr class="st-assessment-section-row"><td colspan="2">Inter-District Revalida</td></tr>
              ${this.PORTFOLIO_REVALIDA_ROWS.map(
                (row) => `
                  <tr>
                    <td class="st-assessment-indent">${this.esc(row.label)}</td>
                    <td><input type="number" min="0" max="${this.PORTFOLIO_REVALIDA_MAX_SCORES[row.id]}" step="0.5" class="st-assessment-input" data-portfolio-field="${row.id}" value="${this.escAttr(this.validNumber(portfolio[row.id], this.PORTFOLIO_REVALIDA_MAX_SCORES[row.id]) ?? "")}" aria-label="${this.esc(row.label)} raw score, highest possible score ${this.PORTFOLIO_REVALIDA_MAX_SCORES[row.id]}"></td>
                  </tr>
                `,
              ).join("")}
              <tr class="st-assessment-total-row">
                <td>Total Inter-District Revalida Raw Score</td>
                <td>
                  <span class="st-assessment-score-entry st-assessment-score-entry--total">
                    <input type="text" class="st-assessment-input" data-revalida-total readonly value="${revalidaTotal ?? ""}" aria-label="Total Inter-District Revalida raw score out of ${this.PORTFOLIO_REVALIDA_MAX_SCORE}">
                    <span class="st-assessment-score-denominator">/ ${this.PORTFOLIO_REVALIDA_MAX_SCORE}</span>
                  </span>
                </td>
              </tr>
              <tr class="st-assessment-total-row">
                <td>Total Presentation Portfolio Assessment Raw Score</td>
                <td>
                  <span class="st-assessment-score-entry st-assessment-score-entry--total">
                    <input type="text" class="st-assessment-input" data-portfolio-raw-total readonly value="${portfolioRawTotal ?? ""}" aria-label="Total Presentation Portfolio Assessment raw score out of ${this.PORTFOLIO_MAX_SCORE}">
                    <span class="st-assessment-score-denominator">/ ${this.PORTFOLIO_MAX_SCORE}</span>
                  </span>
                </td>
              </tr>
              <tr class="st-assessment-total-row">
                <td>Final Score Percentage Grade</td>
                <td><input type="text" class="st-assessment-input st-assessment-input--rating" data-final-grade readonly value="${finalPercentage == null ? "" : `${this.escAttr(finalPercentage)}%`}" aria-label="Final score percentage grade"></td>
              </tr>
            </tbody>
          </table>

          ${showAeReadiness ? `
            <div class="st-assessment-likelihood-summary">
              <div class="st-assessment-likelihood-main">
                <span class="material-symbols-outlined" aria-hidden="true">analytics</span>
                <div class="st-assessment-likelihood-result">
                  <p class="st-assessment-likelihood-kicker">Likelihood of Passing A&amp;E Exam</p>
                  <strong aria-live="polite" data-overall-likelihood-preview data-level="${hasAnyPost ? "readiness" : "neutral"}">${(() => {
                    if (!hasAnyPost) return "Waiting for post-test scores";
                    const percentage = this.overallLikelihoodPercentage(overallPost);
                    if (percentage == null) return "Waiting for post-test scores";
                    const { label } = this.componentLikelihoodMeta(percentage);
                    return `${percentage}% · ${label} Likelihood`;
                  })()}</strong>
                </div>
              </div>
              <p class="st-assessment-likelihood-note">Calculated from the learner's <strong>FLT post-test total</strong>. StayEd internal threshold: <strong>High likelihood = 70% or above</strong>; <strong>Low likelihood = below 70%</strong>. This is a project readiness rule, not an official DepEd A&amp;E passing mark.</p>
            </div>
          ` : ""}
        </div>
      ` : ""}
    `;

    this.bindLivePreview();
  }

  static renderAf5Row(row, scores) {
    const isBlp = this.currentLearningLevelCode() === "BLP";

    if (row.type === "section") {
      const label = isBlp && row.label.includes("Functional Literacy")
        ? `${row.label} · Entry-Level Assessment`
        : row.label;
      return `<tr class="st-assessment-section-row"><td colspan="4">${this.esc(label)}</td></tr>`;
    }

    if (row.type === "subsection") {
      const maxScore = this.SUBJECT_MAX_SCORES[row.group];
      const preTotal = this.subjectGroupTotal(row.group, scores, "pre");
      const postTotal = this.subjectGroupTotal(row.group, scores, "post");
      return `
        <tr class="st-assessment-subsection-row">
          <td>${this.esc(row.label)}</td>
          <td>${this.renderScoreTotal(preTotal, maxScore, row.group, "pre")}</td>
          <td>${isBlp ? `<span class="st-assessment-computed-empty">—</span>` : this.renderScoreTotal(postTotal, maxScore, row.group, "post")}</td>
          <td class="st-assessment-result-cell" data-subject-group-cell="${row.group}">${this.renderSubjectGroupResult(row.group, scores)}</td>
        </tr>
      `;
    }

    const r = scores[row.id] || {};
    const labelClass = row.indent ? "st-assessment-indent" : "";

    if (row.type === "abl") {
      return `
        <tr class="st-assessment-abl-row">
          <td class="${labelClass}">${this.esc(row.label)}</td>
          <td>${this.renderScoreInput(row.id, "pre", r.pre, row.preMax, row.preMax)}</td>
          <td>${this.renderScoreInput(row.id, "post", r.post, row.postMax, row.postMax)}</td>
          <td class="st-assessment-result-cell" data-abl-computed-cell="${row.id}">${this.renderAblPercentage(row, r)}</td>
        </tr>
      `;
    }

    const directMax = this.SUBJECT_MAX_SCORES[row.id] || null;
    const grouped = this.isGroupedScoreRow(row.id);
    const inputMax = grouped ? this.GROUP_COMPONENT_MAX_SCORE : directMax;
    const displayMax = inputMax;

    return `
      <tr>
        <td class="${labelClass}">${this.esc(row.label)}</td>
        <td>${this.renderScoreInput(row.id, "pre", r.pre, displayMax, inputMax)}</td>
        <td>${isBlp ? `<span class="st-assessment-computed-empty">—</span>` : this.renderScoreInput(row.id, "post", r.post, displayMax, inputMax)}</td>
        <td class="st-assessment-result-cell" data-computed-cell="${row.id}">${this.renderComputedRowResult(row.id, r)}</td>
      </tr>
    `;
  }


  static renderScoreInput(rowId, part, value, displayMax = null, inputMax = null) {
    const maxAttr = inputMax ? ` max="${inputMax}"` : "";
    const safeValue = inputMax ? this.validNumber(value, inputMax) : this.validNumber(value, null);
    const input = `<input type="number" step="1" min="0"${maxAttr} inputmode="numeric" class="st-assessment-input" data-score-field="${rowId}" data-score-part="${part}" value="${safeValue ?? ""}">`;
    if (!displayMax) return input;
    return `
      <div class="st-assessment-score-entry">
        ${input}
        <span class="st-assessment-score-denominator">/ ${displayMax}</span>
      </div>
    `;
  }

  static renderScoreTotal(value, maxScore, groupKey, part) {
    return `
      <div class="st-assessment-score-entry st-assessment-score-entry--total" data-subject-group-total="${groupKey}" data-score-part="${part}">
        <span class="st-assessment-readonly-score-box st-assessment-group-total-value">${value == null ? "" : this.esc(value)}</span>
        <span class="st-assessment-score-denominator">/ ${maxScore}</span>
      </div>
    `;
  }

  static renderOverallScoreTotal(value, part) {
    return `
      <div class="st-assessment-score-entry st-assessment-score-entry--overall" data-overall-score-wrap="${part}">
        <span class="st-assessment-readonly-score-box st-assessment-overall-value-box" data-overall-${part}>${value == null ? "" : this.esc(value)}</span>
        <span class="st-assessment-score-denominator">/ ${this.TOTAL_ASSESSMENT_MAX_SCORE}</span>
      </div>
    `;
  }

  static renderAblPercentage(row, rowData = {}) {
    const postValue = this.validNumber(rowData.post, row.postMax);
    if (postValue == null || !row.postMax) {
      return `<span class="st-assessment-computed-empty">—</span>`;
    }

    const percentage = this.roundPercent((postValue / row.postMax) * 100);
    const competency = this.competencyLabel(percentage);
    return `
      <div class="st-assessment-result">
        <span class="st-assessment-result-pill is-competency">${percentage}%</span>
        <span class="st-assessment-result-note">${this.esc(competency)}</span>
      </div>
    `;
  }

  static renderComputedRowResult(rowId, rowData = {}) {
    const isBlp = this.currentLearningLevelCode() === "BLP";
    const percentage = isBlp
      ? this.rowPercentageForPart(rowId, rowData, "pre")
      : this.rowPercentage(rowId, rowData);
    if (percentage == null) {
      return `<span class="st-assessment-computed-empty">—</span>`;
    }

    if (isBlp) {
      return `
        <div class="st-assessment-result">
          <span class="st-assessment-result-pill is-competency">${percentage}%</span>
          <span class="st-assessment-result-note">Entry-level</span>
        </div>
      `;
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

    if (percentage > 100) {
      return `
        <div class="st-assessment-result">
          <span class="st-assessment-result-pill is-invalid-score">${percentage}%</span>
          <span class="st-assessment-result-note">(Invalid)</span>
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

  static renderSubjectGroupResult(groupKey, scores = {}) {
    const isBlp = this.currentLearningLevelCode() === "BLP";
    const total = this.subjectGroupTotal(groupKey, scores, isBlp ? "pre" : "post")
      ?? this.subjectGroupTotal(groupKey, scores, "pre");
    const maxScore = this.SUBJECT_MAX_SCORES[groupKey];
    const percentage = total == null || !maxScore
      ? null
      : this.roundPercent((total / maxScore) * 100);
    if (percentage == null) return `<span class="st-assessment-computed-empty">—</span>`;

    if (isBlp) {
      return `
        <div class="st-assessment-result">
          <span class="st-assessment-result-pill is-competency">${percentage}%</span>
          <span class="st-assessment-result-note">Entry-level</span>
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

  static renderOverallLikelihoodCell(overallPostScore, hasAnyPost) {
    const percentage = this.overallLikelihoodPercentage(overallPostScore);
    if (percentage == null || !hasAnyPost) {
      return `<span class="st-assessment-computed-empty">Waiting for post-test scores</span>`;
    }
    const { label, tone } = this.componentLikelihoodMeta(percentage);
    return `
      <div class="st-assessment-result st-assessment-result--overall">
        <span class="st-assessment-result-pill is-${tone}">${percentage}%</span>
        <span class="st-assessment-result-note">${this.esc(label)} Likelihood</span>
      </div>
    `;
  }

  // The summed post-test total defaults to 0 (not null) when no FLT
  // post-test field has been filled in yet, which made an unassessed
  // learner's 0% total render as a real (misleadingly low) readiness
  // result. These check whether any post field actually has a value,
  // independent of what that value sums to.
  static hasAnyPostScoreInData(scores = {}) {
    return this.AF5_ROWS.some((row) => {
      if (row.type !== "score" || !row.id) return false;
      const v = scores[row.id]?.post;
      return v !== null && v !== undefined && v !== "";
    });
  }

  static hasAnyPostScoreInDom() {
    return this.AF5_ROWS.some((row) => {
      if (row.type !== "score" || !row.id) return false;
      const el = document.querySelector(`[data-score-field="${row.id}"][data-score-part="post"]`);
      return el && String(el.value ?? "").trim() !== "";
    });
  }

  static overallLikelihoodPercentage(overallPostScore) {
    if (overallPostScore == null || overallPostScore === "") return null;
    const score = Number(overallPostScore);
    if (!Number.isFinite(score)) return null;
    const percentage = Math.max(0, Math.min(100, (score / this.TOTAL_ASSESSMENT_MAX_SCORE) * 100));
    return Number(percentage.toFixed(2));
  }

  static subjectGroupTotal(groupKey, scores = {}, part = "post") {
    const rowIds = this.SUBJECT_GROUPS[groupKey] || [];
    const values = rowIds.map((rowId) => {
      const row = scores[rowId] || {};
      return this.validNumber(row[part], this.GROUP_COMPONENT_MAX_SCORE);
    });
    if (!values.some((value) => Number.isFinite(value))) return null;
    const total = values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
    return Number.isInteger(total) ? total : Number(total.toFixed(2));
  }

  static subjectGroupPercentage(groupKey, scores = {}) {
    const total = this.subjectGroupTotal(groupKey, scores, "post") ?? this.subjectGroupTotal(groupKey, scores, "pre");
    const maxScore = this.SUBJECT_MAX_SCORES[groupKey];
    if (total == null || !maxScore) return null;
    return this.roundPercent((total / maxScore) * 100);
  }

  static rowPercentage(rowId, rowData = {}) {
    const value = rowData.post ?? rowData.pre;
    const groupKey = this.groupForRow(rowId);
    const maxScore = this.SUBJECT_MAX_SCORES[rowId] || (groupKey ? this.GROUP_COMPONENT_MAX_SCORE : null);
    if (value == null || value === "" || !maxScore) return null;
    const numericValue = this.validNumber(value, maxScore);
    if (numericValue == null) return null;
    return this.roundPercent((numericValue / maxScore) * 100);
  }

  static rowPercentageForPart(rowId, rowData = {}, part = "pre") {
    const value = rowData?.[part];
    const groupKey = this.groupForRow(rowId);
    const maxScore = this.SUBJECT_MAX_SCORES[rowId] || (groupKey ? this.GROUP_COMPONENT_MAX_SCORE : null);
    if (value == null || value === "" || !maxScore) return null;
    const numericValue = this.validNumber(value, maxScore);
    if (numericValue == null) return null;
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
    if (percentage >= 70) return { label: "High", tone: "high" };
    return { label: "Low", tone: "low" };
  }

  static likelihoodLabel(value) {
    if (value == null || String(value).trim() === "") {
      return "Waiting for post-test scores";
    }
    const score = Number(value);
    if (!Number.isFinite(score)) return "Waiting for post-test scores";
    return `${this.roundPercent(score)}%`;
  }

  static sumScoreData(scores = {}, part = "post") {
    const rows = this.AF5_ROWS.filter((row) => row.id && row.type === "score");
    const values = rows.map((row) => {
      const raw = scores[row.id]?.[part];
      const maxScore = this.SUBJECT_MAX_SCORES[row.id] || (this.isGroupedScoreRow(row.id) ? this.GROUP_COMPONENT_MAX_SCORE : null);
      return this.validNumber(raw, maxScore);
    });
    if (!values.some((value) => Number.isFinite(value))) return null;
    const total = values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
    return Number.isInteger(total) ? total : Number(total.toFixed(2));
  }

  static portfolioWorkSampleTotal(portfolio = {}) {
    return this.sumPortfolioFields(portfolio, this.PORTFOLIO_WORK_SAMPLE_ROWS.map((row) => row.id));
  }

  static portfolioRevalidaTotal(portfolio = {}) {
    return this.sumPortfolioFields(portfolio, this.PORTFOLIO_REVALIDA_ROWS.map((row) => row.id));
  }

  static portfolioRawTotal(portfolio = {}) {
    const allIds = [...this.PORTFOLIO_WORK_SAMPLE_ROWS, ...this.PORTFOLIO_REVALIDA_ROWS].map((row) => row.id);
    return this.sumPortfolioFields(portfolio, allIds);
  }

  static sumPortfolioFields(portfolio = {}, ids = []) {
    const values = ids.map((id) => {
      const isWorkSample = this.PORTFOLIO_WORK_SAMPLE_ROWS.some((row) => row.id === id);
      const maxScore = isWorkSample ? this.PORTFOLIO_WORK_SAMPLE_HPS : this.PORTFOLIO_REVALIDA_MAX_SCORES[id];
      return this.validNumber(portfolio[id], maxScore);
    });
    if (!values.some((value) => Number.isFinite(value))) return null;
    const total = values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
    return Number.isInteger(total) ? total : Number(total.toFixed(2));
  }

  static readPortfolioFromDom() {
    const portfolio = {};
    [...this.PORTFOLIO_WORK_SAMPLE_ROWS, ...this.PORTFOLIO_REVALIDA_ROWS].forEach((row) => {
      portfolio[row.id] = this.readNumber(`[data-portfolio-field="${row.id}"]`);
    });
    return portfolio;
  }

  static portfolioPercentageGrade(portfolio = {}) {
    const rawTotal = this.portfolioRawTotal(portfolio);
    if (rawTotal == null) return null;
    const percentage = Math.max(0, Math.min(100, (rawTotal / this.PORTFOLIO_MAX_SCORE) * 100));
    return Number(percentage.toFixed(2));
  }

  static bindLivePreview() {
    const preview = document.querySelector("[data-overall-likelihood-preview]");
    const overallGradeCell = document.querySelector("[data-overall-grade-cell]");

    const updateLikelihoodPreview = () => {
      const overallPost = this.sumRowScores("post");
      const hasAnyPost = this.hasAnyPostScoreInDom();
      const percentage = hasAnyPost ? this.overallLikelihoodPercentage(overallPost) : null;
      if (preview) {
        if (percentage == null) {
          preview.textContent = "Waiting for post-test scores";
          preview.dataset.level = "neutral";
        } else {
          const { label } = this.componentLikelihoodMeta(percentage);
          preview.textContent = `${percentage}% · ${label} Likelihood`;
          preview.dataset.level = "readiness";
        }
      }
      if (overallGradeCell) {
        overallGradeCell.innerHTML = this.renderOverallLikelihoodCell(overallPost, hasAnyPost);
      }
    };

    const updateGroupPreview = (groupKey) => {
      const scores = this.readAllScoresFromDom();
      ["pre", "post"].forEach((part) => {
        const wrap = document.querySelector(`[data-subject-group-total="${groupKey}"][data-score-part="${part}"]`);
        const valueEl = wrap?.querySelector(".st-assessment-group-total-value");
        if (valueEl) {
          const total = this.subjectGroupTotal(groupKey, scores, part);
          valueEl.textContent = total == null ? "" : total;
        }
      });
      const groupTarget = document.querySelector(`[data-subject-group-cell="${groupKey}"]`);
      if (groupTarget) groupTarget.innerHTML = this.renderSubjectGroupResult(groupKey, scores);
    };

    const updateRowPreview = (rowId) => {
      const target = document.querySelector(`[data-computed-cell="${rowId}"]`);
      if (target) target.innerHTML = this.renderComputedRowResult(rowId, this.readScoreRowFromDom(rowId));

      const groupKey = this.groupForRow(rowId);
      if (groupKey) updateGroupPreview(groupKey);
    };

    const updateAblPreview = (rowId) => {
      const row = this.AF5_ROWS.find((item) => item.id === rowId && item.type === "abl");
      const target = document.querySelector(`[data-abl-computed-cell="${rowId}"]`);
      if (row && target) target.innerHTML = this.renderAblPercentage(row, this.readScoreRowFromDom(rowId));
    };

    const updateOverallScores = () => {
      const preEl = document.querySelector("[data-overall-pre]");
      const postEl = document.querySelector("[data-overall-post]");
      if (preEl) preEl.textContent = this.hasAnyScore("pre") ? this.sumRowScores("pre") : "";
      if (postEl) postEl.textContent = this.hasAnyScore("post") ? this.sumRowScores("post") : "";
    };

    const updatePortfolioPreview = () => {
      const portfolio = this.readPortfolioFromDom();
      const workTotal = this.portfolioWorkSampleTotal(portfolio);
      const revalidaTotal = this.portfolioRevalidaTotal(portfolio);
      const rawTotal = this.portfolioRawTotal(portfolio);
      const finalPercentage = this.portfolioPercentageGrade(portfolio);

      const workEl = document.querySelector("[data-portfolio-total]");
      const revalidaEl = document.querySelector("[data-revalida-total]");
      const rawEl = document.querySelector("[data-portfolio-raw-total]");
      const finalEl = document.querySelector("[data-final-grade]");
      if (workEl) workEl.value = workTotal ?? "";
      if (revalidaEl) revalidaEl.value = revalidaTotal ?? "";
      if (rawEl) rawEl.value = rawTotal ?? "";
      if (finalEl) finalEl.value = finalPercentage == null ? "" : `${finalPercentage}%`;
      this.updatePortfolioValidity();
    };

    document.querySelectorAll("[data-score-field][data-score-part='pre'], [data-score-field][data-score-part='post']").forEach((input) => {
      input.addEventListener("input", () => {
        this.clampInputToBounds(input);
        const rowId = input.dataset.scoreField;
        const row = this.AF5_ROWS.find((item) => item.id === rowId);
        if (row?.type === "score") updateRowPreview(rowId);
        if (row?.type === "abl") updateAblPreview(rowId);
        updateOverallScores();
        updateLikelihoodPreview();
        this.updateScoreValidity();
      });
    });

    document.querySelectorAll("[data-portfolio-field]").forEach((input) => {
      input.addEventListener("input", () => {
        this.clampInputToBounds(input);
        updatePortfolioPreview();
      });
    });

    this.AF5_ROWS.filter((row) => row.id && row.type === "score").forEach((row) => updateRowPreview(row.id));
    this.AF5_ROWS.filter((row) => row.id && row.type === "abl").forEach((row) => updateAblPreview(row.id));
    Object.keys(this.SUBJECT_GROUPS).forEach(updateGroupPreview);
    updateOverallScores();
    updatePortfolioPreview();
    updateLikelihoodPreview();
    this.updateScoreValidity();
  }

  static readScoreRowFromDom(rowId) {
    return {
      pre: this.readNumber(`[data-score-field="${rowId}"][data-score-part="pre"]`),
      post: this.readNumber(`[data-score-field="${rowId}"][data-score-part="post"]`),
    };
  }

  static isGroupedScoreRow(rowId) {
    return Object.values(this.SUBJECT_GROUPS).some((rowIds) => rowIds.includes(rowId));
  }

  static groupForRow(rowId) {
    return Object.entries(this.SUBJECT_GROUPS).find(([, rowIds]) => rowIds.includes(rowId))?.[0] || null;
  }

  static readAllScoresFromDom() {
    const scores = {};
    this.AF5_ROWS.filter((row) => row.id).forEach((row) => {
      const preInput = document.querySelector(`[data-score-field="${row.id}"][data-score-part="pre"]`);
      const postInput = document.querySelector(`[data-score-field="${row.id}"][data-score-part="post"]`);
      if (!preInput && !postInput) return;
      scores[row.id] = this.readScoreRowFromDom(row.id);
    });
    return scores;
  }

  static hasAnyScore(part) {
    return this.AF5_ROWS.some((row) => row.id && row.type === "score" && this.readNumber(`[data-score-field="${row.id}"][data-score-part="${part}"]`) != null);
  }

  static sumRowScores(part) {
    const rows = this.AF5_ROWS.filter((row) => row.id && row.type === "score");
    const total = rows.reduce((sum, row) => sum + (this.readNumber(`[data-score-field="${row.id}"][data-score-part="${part}"]`) || 0), 0);
    return Number.isInteger(total) ? total : Number(total.toFixed(2));
  }

  static scoreValidationErrors() {
    const errors = [];
    const scores = this.readAllScoresFromDom();

    Object.entries(this.SUBJECT_MAX_SCORES).forEach(([key, maxScore]) => {
      if (this.SUBJECT_GROUPS[key]) {
        ["pre", "post"].forEach((part) => {
          const total = this.subjectGroupTotal(key, scores, part);
          if (total != null && total > maxScore) {
            errors.push(`${key === "ls1_en" ? "LS 1 English" : "LS 1 Filipino"} ${part}-test total cannot exceed ${maxScore}.`);
          }
        });
        return;
      }

      ["pre", "post"].forEach((part) => {
        const value = this.readNumber(`[data-score-field="${key}"][data-score-part="${part}"]`);
        if (value != null && value > maxScore) {
          const row = this.AF5_ROWS.find((item) => item.id === key);
          errors.push(`${row?.label || key} ${part}-test score cannot exceed ${maxScore}.`);
        }
      });
    });

    this.AF5_ROWS.filter((row) => row.type === "abl").forEach((row) => {
      [["pre", row.preMax], ["post", row.postMax]].forEach(([part, maxScore]) => {
        const value = this.readNumber(`[data-score-field="${row.id}"][data-score-part="${part}"]`);
        if (value != null && maxScore != null && value > maxScore) {
          errors.push(`${row.label} ${part}-test score cannot exceed ${maxScore}.`);
        }
      });
    });

    return [...errors, ...this.portfolioValidationErrors()];
  }

  static portfolioValidationErrors() {
    const errors = [];
    this.PORTFOLIO_WORK_SAMPLE_ROWS.forEach((row) => {
      const value = this.readNumber(`[data-portfolio-field="${row.id}"]`);
      if (value != null && (value < 0 || value > this.PORTFOLIO_WORK_SAMPLE_HPS)) {
        errors.push(`${row.label} work-sample score must be from 0 to ${this.PORTFOLIO_WORK_SAMPLE_HPS}.`);
      }
    });

    this.PORTFOLIO_REVALIDA_ROWS.forEach((row) => {
      const value = this.readNumber(`[data-portfolio-field="${row.id}"]`);
      const maxScore = this.PORTFOLIO_REVALIDA_MAX_SCORES[row.id];
      if (value != null && (value < 0 || value > maxScore)) {
        errors.push(`${row.label} Revalida score must be from 0 to ${maxScore}.`);
      }
    });
    return errors;
  }

  static updateScoreValidity() {
    document.querySelectorAll("[data-score-field]").forEach((input) => input.classList.remove("is-invalid"));

    Object.entries(this.SUBJECT_MAX_SCORES).forEach(([key, maxScore]) => {
      if (this.SUBJECT_GROUPS[key]) {
        ["pre", "post"].forEach((part) => {
          const scores = this.readAllScoresFromDom();
          const total = this.subjectGroupTotal(key, scores, part);
          if (total != null && total > maxScore) {
            this.SUBJECT_GROUPS[key].forEach((rowId) => {
              document.querySelector(`[data-score-field="${rowId}"][data-score-part="${part}"]`)?.classList.add("is-invalid");
            });
          }
        });
        return;
      }

      ["pre", "post"].forEach((part) => {
        const input = document.querySelector(`[data-score-field="${key}"][data-score-part="${part}"]`);
        const value = input?.value === "" ? null : Number(input?.value);
        if (value != null && Number.isFinite(value) && value > maxScore) input?.classList.add("is-invalid");
      });
    });

    this.AF5_ROWS.filter((row) => row.type === "abl").forEach((row) => {
      [["pre", row.preMax], ["post", row.postMax]].forEach(([part, maxScore]) => {
        const input = document.querySelector(`[data-score-field="${row.id}"][data-score-part="${part}"]`);
        const value = input?.value === "" ? null : Number(input?.value);
        if (value != null && Number.isFinite(value) && maxScore != null && value > maxScore) input?.classList.add("is-invalid");
      });
    });
  }

  static updatePortfolioValidity() {
    document.querySelectorAll("[data-portfolio-field]").forEach((input) => input.classList.remove("is-invalid"));

    this.PORTFOLIO_WORK_SAMPLE_ROWS.forEach((row) => {
      const input = document.querySelector(`[data-portfolio-field="${row.id}"]`);
      const value = input?.value === "" ? null : Number(input?.value);
      if (value != null && Number.isFinite(value) && (value < 0 || value > this.PORTFOLIO_WORK_SAMPLE_HPS)) {
        input?.classList.add("is-invalid");
      }
    });

    this.PORTFOLIO_REVALIDA_ROWS.forEach((row) => {
      const input = document.querySelector(`[data-portfolio-field="${row.id}"]`);
      const value = input?.value === "" ? null : Number(input?.value);
      const maxScore = this.PORTFOLIO_REVALIDA_MAX_SCORES[row.id];
      if (value != null && Number.isFinite(value) && (value < 0 || value > maxScore)) {
        input?.classList.add("is-invalid");
      }
    });
  }

  static buildScoresPayload() {
    const existing = this.currentForm?.scores || {};
    const scores = {};

    this.AF5_ROWS.filter((row) => row.id).forEach((row) => {
      const preInput = document.querySelector(`[data-score-field="${row.id}"][data-score-part="pre"]`);
      const postInput = document.querySelector(`[data-score-field="${row.id}"][data-score-part="post"]`);
      const previous = existing[row.id] || {};

      // Only overwrite rows that are applicable to the learner's current level
      // and therefore rendered on screen. Hidden legacy rows are preserved.
      if (preInput || postInput) {
        scores[row.id] = {
          // Preserve a stored value when one side is intentionally hidden for
          // the current level (for example BLP FLT post-test fields).
          pre: preInput
            ? this.readNumber(`[data-score-field="${row.id}"][data-score-part="pre"]`)
            : (previous.pre ?? null),
          post: postInput
            ? this.readNumber(`[data-score-field="${row.id}"][data-score-part="post"]`)
            : (previous.post ?? null),
          likelihood: previous.likelihood ?? null,
          status: row.type === "abl" ? null : (previous.status ?? null),
        };
      } else if (Object.keys(previous).length) {
        scores[row.id] = {
          pre: previous.pre ?? null,
          post: previous.post ?? null,
          likelihood: previous.likelihood ?? null,
          status: previous.status ?? null,
        };
      }
    });

    if (this.usesAeReadiness()) {
      const overallPostForLikelihood = this.sumRowScores("post");
      const overallPercentage = this.overallLikelihoodPercentage(overallPostForLikelihood);
      scores.overall_likelihood = overallPercentage == null
        ? null
        : `${this.componentLikelihoodMeta(overallPercentage).label.toUpperCase()} LIKELIHOOD`;
    } else {
      scores.overall_likelihood = null;
    }

    return scores;
  }

  static bindSave() {
    document.querySelector("[data-save-scores-btn]")?.addEventListener("click", () => this.save());
  }

  static async save() {
    if (!this.selectedLearnerId) return;

    const validationErrors = this.scoreValidationErrors();
    if (validationErrors.length) {
      this.updateScoreValidity();
      this.updatePortfolioValidity();
      Toast?.error(validationErrors[0]);
      return;
    }

    const scores = this.buildScoresPayload();

    const portfolio = this.usesPortfolio()
      ? this.readPortfolioFromDom()
      : { ...(this.currentForm?.portfolio || {}) };

    const payload = {
      dateOfAssessment: document.querySelector("[data-date-of-assessment]")?.value || this.currentForm?.dateOfAssessment || null,
      scores,
      // Hidden non-applicable portfolio values are preserved rather than
      // silently erased when a BLP learner is saved.
      portfolio,
      finalScorePercentageGrade: this.usesPortfolio()
        ? this.portfolioPercentageGrade(portfolio)
        : (this.currentForm?.finalScorePercentageGrade ?? null),
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

  static validNumber(value, maxScore = null, minScore = 0) {
    if (value == null || value === "") return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < minScore) return null;
    if (maxScore != null && Number.isFinite(Number(maxScore)) && numeric > Number(maxScore)) return null;
    return numeric;
  }

  static clampInputToBounds(input) {
    if (!input || input.value === "") return;
    const numeric = Number(input.value);
    if (!Number.isFinite(numeric)) return;
    const min = input.min === "" ? null : Number(input.min);
    const max = input.max === "" ? null : Number(input.max);
    let next = numeric;
    if (Number.isFinite(min)) next = Math.max(min, next);
    if (Number.isFinite(max)) next = Math.min(max, next);
    if (next !== numeric) input.value = String(next);
  }

  static readNumber(selector) {
    const raw = document.querySelector(selector)?.value;
    return raw === "" || raw == null ? null : Number(raw);
  }

  static readText(selector) {
    const raw = document.querySelector(selector)?.value;
    return raw === "" || raw == null ? null : raw.trim();
  }

  static esc(value) {
    return value == null ? "" : Utils.esc(value);
  }

  static escAttr(value) {
    return value == null ? "" : this.esc(value);
  }
}

document.addEventListener("DOMContentLoaded", () => AssessmentScores.init());

window.AssessmentScores = AssessmentScores;
