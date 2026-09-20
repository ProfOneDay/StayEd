class RecordScores {
  static classId = "";
  static moduleId = "";
  static module = null;
  static roster = [];

  static SCORE_FIELDS = ["pretestScore", "pretestTotal", "posttestScore", "posttestTotal"];

  static async init() {
    if (window.Guards) Guards.teacher();

    const params = new URLSearchParams(window.location.search);
    this.classId = params.get("class") || "";
    this.moduleId = params.get("module") || "";

    document
      .querySelector("[data-back-link]")
      ?.setAttribute("href", `module-management.html?class=${this.classId}`);

    if (!this.classId || !this.moduleId) {
      const notice = document.querySelector("[data-no-module-notice]");
      if (notice) notice.style.display = "";
      return;
    }

    await this.loadClassContext();
    await this.load();
  }

  // Same pattern as module-management.js's loadClassContext() so this page
  // shows the same class-context banner reached from the same ?class= link.
  static async loadClassContext() {
    const banner = document.querySelector("[data-class-context-banner]");
    if (!this.classId || !banner) return;

    try {
      const response = await API.getTeacherClasses();
      const match = (response?.data || []).find(
        (item) => String(item.id) === String(this.classId),
      );
      if (!match) return;

      banner.classList.remove("st-hidden");
      this.set("[data-class-context-clc]", match.clc);
      this.set("[data-class-context-level]", match.level);
      this.set(
        "[data-class-context-meta]",
        `${match.modality} · School Year ${match.schoolYear} · ${match.learnerCount} Enrolled Learners`,
      );
    } catch (error) {
      console.error("[RecordScores] Unable to load class context", error);
    }
  }

  static async load() {
    if (window.Layout) Layout.showLoader();

    try {
      const [rosterResponse, catalogResponse] = await Promise.all([
        API.getClassModuleRoster(this.classId, this.moduleId),
        API.getClassModules(this.classId),
      ]);

      this.roster = rosterResponse.data || [];
      this.module = (catalogResponse.data || []).find(
        (m) => String(m.id) === String(this.moduleId),
      );

      this.render();
    } catch (error) {
      console.error("[RecordScores] Unable to load roster", error);
      Toast?.error("Unable to load this module's roster.");
    } finally {
      if (window.Layout) Layout.hideLoader();
    }
  }

  static render() {
    const root = document.querySelector("[data-view-root]");
    if (!root) return;

    const releasedCount = this.roster.filter((r) => r.moduleRecordId).length;

    root.innerHTML = `
      <div class="st-panel st-panel-pad">
        <div class="st-record-scores-head">
          <h3 class="st-panel-title">
            Module ${this.module?.sequenceNumber ?? ""} — ${this.module?.strandCode || ""} ${this.module?.title || ""}
          </h3>
          <p class="st-panel-subtitle">
            ${releasedCount} of ${this.roster.length} learner(s) have this module released and can have scores recorded.
          </p>
        </div>

        <div class="st-table-scroll st-table-scroll--sticky">
          <table class="st-data-table st-record-scores-table">
            <thead>
              <tr>
                <th rowspan="2">Learner</th>
                <th rowspan="2">Modality</th>
                <th colspan="2">Pre-Test</th>
                <th colspan="2">Post-Test</th>
              </tr>
              <tr class="st-record-scores-subhead">
                <th>Score</th>
                <th>Total</th>
                <th>Score</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${this.roster.map((r) => this.renderRow(r)).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindInputs();
  }

  static renderRow(r) {
    if (!r.moduleRecordId) {
      return `
        <tr>
          <td>${this.esc(r.name)}</td>
          <td>${this.modalityPill(r.modality)}</td>
          <td colspan="4" class="st-record-scores-unreleased">Not released yet</td>
        </tr>
      `;
    }

    return `
      <tr>
        <td>${this.esc(r.name)}</td>
        <td>${this.modalityPill(r.modality)}</td>
        <td>${this.scoreCell(r, "pretestScore")}</td>
        <td>${this.scoreCell(r, "pretestTotal")}</td>
        <td>${this.scoreCell(r, "posttestScore")}</td>
        <td>${this.scoreCell(r, "posttestTotal")}</td>
      </tr>
    `;
  }

  static scoreCell(r, field) {
    const val = r[field];
    return `
      <input
        type="number"
        min="0"
        step="0.5"
        inputmode="decimal"
        class="st-score-cell"
        data-score-cell
        data-enrollment-id="${r.enrollmentId}"
        data-field="${field}"
        value="${val == null ? "" : val}"
      >
    `;
  }

  static modalityPill(modality) {
    const teal = modality === "Modular" ? " st-pill--teal" : "";
    return `<span class="st-pill${teal}">${modality || "—"}</span>`;
  }

  static bindInputs() {
    document.querySelectorAll("[data-score-cell]").forEach((input) => {
      input.dataset.lastValue = input.value;

      input.addEventListener("blur", () => this.handleBlur(input));

      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") input.blur();
      });
    });
  }

  static async handleBlur(input) {
    const newValue = input.value;

    // Skip the round-trip entirely if nothing actually changed (e.g. the
    // teacher just clicked into the cell and back out).
    if (newValue === input.dataset.lastValue) return;

    const enrollmentId = Number(input.dataset.enrollmentId);
    const field = input.dataset.field;
    const row = this.roster.find((r) => r.enrollmentId === enrollmentId);
    if (!row) return;

    input.classList.remove("is-score-error");
    input.classList.add("is-score-saving");

    try {
      const payload = { [field]: newValue === "" ? null : Number(newValue) };

      await API.updateModuleScores(row.learnerId, row.releaseBatchId, row.moduleRecordId, payload);

      row[field] = payload[field];
      input.dataset.lastValue = newValue;

      input.classList.remove("is-score-saving");
      input.classList.add("is-score-saved");
      setTimeout(() => input.classList.remove("is-score-saved"), 1200);
    } catch (error) {
      console.error("[RecordScores] Unable to save score", error);

      input.classList.remove("is-score-saving");
      input.classList.add("is-score-error");

      Toast?.error(error?.data?.message || "Unable to save this score.");
    }
  }

  static esc(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  static set(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value ?? "—";
  }
}

(function bootRecordScores() {
  document.addEventListener("DOMContentLoaded", () => RecordScores.init());
})();

window.RecordScores = RecordScores;
