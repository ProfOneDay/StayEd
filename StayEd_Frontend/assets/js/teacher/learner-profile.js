class LearnerProfilePage {
  static profile = null;

  static assessments = [];

  static async init() {
    if (window.Guards) Guards.teacher();

    this.bindTabs();

    this.bindHistoryFilters();

    this.bindPortalShare();

    this.bindAssessments();

    await this.load();

    await this.loadPortalShare();

    await this.loadAssessments();

    this.openRequestedTab();
  }

  static bindAssessments() {
    document
      .querySelector("[data-add-assessment-btn]")
      ?.addEventListener("click", () => this.openAssessmentModal());
  }

  static async loadAssessments() {
    try {
      const id = this.getLearnerId();
      const result = await API.getAssessments(id);

      this.assessments = result.data || [];

      this.renderAssessments();
    } catch (error) {
      console.error("[LearnerProfile] Unable to load assessments", error);
    }
  }

  static renderAssessments() {
    const list = document.querySelector("[data-assessment-list]");
    if (!list) return;

    if (!this.assessments.length) {
      list.innerHTML = `<p class="st-assessment-empty">No assessments recorded yet.</p>`;
      return;
    }

    const resultClass = { PASSED: "low", FAILED: "high", PENDING: "neutral" };

    list.innerHTML = this.assessments
      .map((a) => {
        const scoreText =
          a.score != null && a.totalScore != null ? `${a.score}/${a.totalScore}` : "No score yet";
        const cls = resultClass[a.result] || "neutral";
        const label = a.result.charAt(0) + a.result.slice(1).toLowerCase();

        return `
          <div class="st-assessment-row">
            <div class="st-assessment-row-main">
              <span class="st-assessment-row-level">${this.capitalize((a.level || "").toLowerCase())}</span>
              <span class="st-assessment-row-meta">${a.testDateText || "—"} &middot; ${scoreText}</span>
              <span class="st-risk-badge st-risk-badge--${cls}"><span class="st-risk-dot"></span>${label}</span>
            </div>
            <div class="st-assessment-row-actions">
              <button type="button" class="st-icon-btn" data-edit-assessment="${a.id}" title="Edit">
                <span class="material-symbols-outlined" style="font-size:1.125rem;">edit</span>
              </button>
              <button type="button" class="st-icon-btn" data-delete-assessment="${a.id}" title="Delete">
                <span class="material-symbols-outlined" style="font-size:1.125rem;">delete</span>
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    list.querySelectorAll("[data-edit-assessment]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const a = this.assessments.find((x) => x.id === Number(btn.dataset.editAssessment));
        if (a) this.openAssessmentModal(a);
      });
    });

    list.querySelectorAll("[data-delete-assessment]").forEach((btn) => {
      btn.addEventListener("click", () => this.confirmDeleteAssessment(Number(btn.dataset.deleteAssessment)));
    });
  }

  static openAssessmentModal(existing) {
    if (!window.Modal) return;

    const val = (v) => (v == null ? "" : v);
    const isEdit = Boolean(existing);

    Modal.show({
      title: isEdit ? "Edit Assessment" : "Record Assessment",
      size: "sm",
      confirmLabel: isEdit ? "Save Changes" : "Record Assessment",
      asyncConfirm: true,
      message: `
        <div class="st-schedule-modal-field">
          <label for="asLevel">Level</label>
          <select id="asLevel">
            <option value="ELEMENTARY" ${existing?.level === "ELEMENTARY" ? "selected" : ""}>Elementary</option>
            <option value="SECONDARY" ${existing?.level === "SECONDARY" ? "selected" : ""}>Secondary</option>
          </select>
        </div>
        <div class="st-schedule-modal-field">
          <label for="asTestDate">Test Date</label>
          <input type="date" id="asTestDate" value="${val(existing?.testDate)}">
        </div>
        <div class="st-schedule-modal-field">
          <label>Score</label>
          <div class="st-score-input-row">
            <input type="number" min="0" step="0.5" id="asScore" placeholder="Score" value="${val(existing?.score)}">
            <span>/</span>
            <input type="number" min="0" step="0.5" id="asTotalScore" placeholder="Total" value="${val(existing?.totalScore)}">
          </div>
        </div>
        <div class="st-schedule-modal-field">
          <label for="asResult">Result</label>
          <select id="asResult">
            <option value="PENDING" ${!existing || existing?.result === "PENDING" ? "selected" : ""}>Pending</option>
            <option value="PASSED" ${existing?.result === "PASSED" ? "selected" : ""}>Passed</option>
            <option value="FAILED" ${existing?.result === "FAILED" ? "selected" : ""}>Failed</option>
          </select>
        </div>
        <div class="st-schedule-modal-field">
          <label for="asRemarks">Remarks (optional)</label>
          <textarea id="asRemarks" rows="2">${existing?.remarks || ""}</textarea>
        </div>
      `,
      onConfirm: async () => {
        const level = document.getElementById("asLevel")?.value;
        const testDate = document.getElementById("asTestDate")?.value;
        const scoreRaw = document.getElementById("asScore")?.value;
        const totalRaw = document.getElementById("asTotalScore")?.value;
        const result = document.getElementById("asResult")?.value;
        const remarks = document.getElementById("asRemarks")?.value.trim();

        if (!testDate) {
          Toast?.error("Please set a test date.");
          throw new Error("validation");
        }

        const payload = {
          level,
          testDate,
          result,
          remarks,
          score: scoreRaw === "" ? null : Number(scoreRaw),
          totalScore: totalRaw === "" ? null : Number(totalRaw),
        };

        try {
          const id = this.getLearnerId();
          if (isEdit) {
            await API.updateAssessment(id, existing.id, payload);
            Toast?.success("Assessment updated.");
          } else {
            await API.createAssessment(id, payload);
            Toast?.success("Assessment recorded.");
          }
          await this.loadAssessments();
        } catch (error) {
          console.error("[LearnerProfile] Unable to save assessment", error);
          Toast?.error(error?.data?.message || "Unable to save this assessment.");
          throw error;
        }
      },
    });
  }

  static confirmDeleteAssessment(assessmentId) {
    if (!window.Modal) return;

    Modal.show({
      title: "Remove Assessment?",
      size: "sm",
      confirmLabel: "Remove",
      asyncConfirm: true,
      message: `<p style="color:var(--st-on-surface-variant);font-size:0.875rem;">This will permanently remove this assessment record.</p>`,
      onConfirm: async () => {
        try {
          await API.deleteAssessment(this.getLearnerId(), assessmentId);
          Toast?.success("Assessment removed.");
          await this.loadAssessments();
        } catch (error) {
          console.error("[LearnerProfile] Unable to remove assessment", error);
          Toast?.error(error?.data?.message || "Unable to remove this assessment.");
          throw error;
        }
      },
    });
  }

  static bindPortalShare() {
    const toggle = document.querySelector("[data-portal-share-toggle]");
    const copyBtn = document.querySelector("[data-portal-share-copy-btn]");

    toggle?.addEventListener("change", async () => {
      const id = this.getLearnerId();
      const enabled = toggle.checked;

      toggle.disabled = true;

      try {
        const result = await API.updatePortalShare(id, enabled);

        this.renderPortalShare(result);

        Toast?.success(
          enabled ? "Student view link is now on." : "Student view link is now off.",
        );
      } catch (error) {
        console.error("[LearnerProfile] Unable to update portal share", error);

        toggle.checked = !enabled;

        Toast?.error("Unable to update the student view link.");
      } finally {
        toggle.disabled = false;
      }
    });

    copyBtn?.addEventListener("click", async () => {
      const input = document.querySelector("[data-portal-share-link-input]");
      if (!input?.value) return;

      try {
        await navigator.clipboard.writeText(input.value);

        Toast?.success("Link copied.");
      } catch (error) {
        console.error("[LearnerProfile] Unable to copy link", error);

        input.select();

        Toast?.error("Couldn't copy automatically -- link is selected, copy it manually.");
      }
    });
  }

  static async loadPortalShare() {
    try {
      const id = this.getLearnerId();
      const result = await API.getPortalShare(id);

      this.renderPortalShare(result);
    } catch (error) {
      console.error("[LearnerProfile] Unable to load portal share state", error);
    }
  }

  static renderPortalShare({ enabled, token }) {
    const toggle = document.querySelector("[data-portal-share-toggle]");
    const linkRow = document.querySelector("[data-portal-share-link-row]");
    const linkInput = document.querySelector("[data-portal-share-link-input]");

    if (toggle) toggle.checked = Boolean(enabled);

    if (enabled && token) {
      const shareUrl = new URL(
        `../student/view.html?token=${token}`,
        window.location.href,
      ).href;

      if (linkInput) linkInput.value = shareUrl;
      if (linkRow) linkRow.hidden = false;
    } else if (linkRow) {
      linkRow.hidden = true;
    }
  }

  static openRequestedTab() {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (!tab) return;

    document.querySelector(`[data-profile-tab="${tab}"]`)?.click();
  }

  static getLearnerId() {
    const params = new URLSearchParams(window.location.search);

    return params.get("id") || "1";
  }

  static async load() {
    if (window.Layout) Layout.showLoader();

    this.showSkeleton();

    try {
      const id = this.getLearnerId();

      this.profile = await API.getLearnerProfile(id);

      this.renderHero();

      this.renderOverview();

      this.renderMonitoringHistory();

      this.renderRiskExplanation();

      this.renderInterventions();

      this.updatePageBreadcrumb();
    } catch (error) {
      console.error("[LearnerProfile]", error);

      Toast?.error("Unable to load learner profile.");
    } finally {
      if (window.Layout) Layout.hideLoader();
    }
  }

  static updatePageBreadcrumb() {
    if (!window.Layout || !this.profile) return;

    Layout.options.breadcrumb = [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "Learner", href: "student-registry.html" },
      { label: "Student Registry", href: "student-registry.html" },
      { label: this.profile.name },
    ];

    Layout.updateBreadcrumb();
  }

  static bindTabs() {
    document.querySelectorAll("[data-profile-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.profileTab;

        document.querySelectorAll("[data-profile-tab]").forEach((t) => {
          const active = t === tab;
          t.classList.toggle("is-active", active);
          t.setAttribute("aria-selected", active ? "true" : "false");
        });

        document.querySelectorAll("[data-profile-panel]").forEach((panel) => {
          panel.classList.toggle(
            "is-active",
            panel.dataset.profilePanel === target,
          );
        });
      });
    });
  }

  static renderHero() {
    const p = this.profile;
    const h = p.header || {};

    const initials = (p.name || "?")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    this.set("[data-profile-avatar]", initials);
    this.set("[data-profile-name]", p.name);
    this.set("[data-profile-lrn]", p.lrn);
    this.set("[data-profile-clc]", p.clc || "—");
    this.set("[data-profile-level]", p.level);
    this.set("[data-profile-modality]", p.modality);
    this.set(
      "[data-profile-modality-since]",
      h.modalitySince && h.modalitySince !== "—" ? `(Since ${h.modalitySince})` : "",
    );
    this.set("[data-profile-school-year]", h.schoolYear);
    this.set("[data-profile-date-enrolled]", h.dateEnrolled);
    this.set("[data-profile-assigned-teacher]", h.assignedTeacher);
    this.set("[data-profile-current-class]", h.currentClass);

    const classButton = document.querySelector("[data-profile-class-btn]");
    if (classButton) {
      if (h.classId) {
        classButton.href = `learner-records.html?class=${encodeURIComponent(h.classId)}`;
        classButton.hidden = false;
      } else {
        classButton.removeAttribute("href");
        classButton.hidden = true;
      }
    }

    const badge = document.querySelector("[data-profile-risk-badge]");

    if (badge) badge.innerHTML = this.riskPill(p.risk);

    document
      .querySelector("[data-profile-assign-btn]")
      ?.addEventListener("click", () => {
        document.querySelector('[data-profile-tab="interventions"]')?.click();
        this.openAddInterventionModal();
      });

    document
      .querySelector("[data-profile-edit-btn]")
      ?.addEventListener("click", () => this.openEditLearnerModal());

  }

  static formatModalityDate(iso) {
    if (!iso) return "—";
    return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  static openEditLearnerModal() {
    if (!window.Modal) return;
    const bg = this.profile.background || {};
    const currentModality = this.profile.modality || "Face-to-Face";
    const modalities = ["Face-to-Face", "Modular", "Blended"];
    const today = new Date().toISOString().slice(0, 10);

    Modal.show({
      title: "Edit Learner",
      size: "sm",
      confirmLabel: "Save Changes",
      message: `
        <div class="st-schedule-modal-field">
          <label for="elModality">Modality</label>
          <select id="elModality">
            ${modalities.map((m) => `<option value="${m}" ${m === currentModality ? "selected" : ""}>${m}</option>`).join("")}
          </select>
        </div>
        <div class="st-schedule-modal-field" id="elModalityEffectiveField" style="display:none;">
          <label for="elModalityEffective">Effective Date</label>
          <input id="elModalityEffective" type="date" value="${today}" max="${today}">
        </div>
        <div class="st-schedule-modal-field" id="elModalityReasonField" style="display:none;">
          <label for="elModalityReason">Reason for Modality Change (optional)</label>
          <input id="elModalityReason" type="text" placeholder="e.g. Schedule constraints">
        </div>
        <div class="st-schedule-modal-field">
          <label for="elCivil">Civil Status</label>
          <input id="elCivil" type="text" value="${bg.civilStatusRaw || ""}" placeholder="e.g. Single">
        </div>
        <div class="st-schedule-modal-field">
          <label for="elEmployment">Employment Status</label>
          <input id="elEmployment" type="text" value="${bg.employmentRaw || ""}" placeholder="e.g. Unemployed">
        </div>
        <div class="st-schedule-modal-field">
          <label for="elDistance">Distance from CLC (km)</label>
          <input id="elDistance" type="number" step="0.1" min="0" value="${bg.distanceKm || 0}">
        </div>
        <div class="st-schedule-modal-field">
          <label for="elOccupation">Socio-economic Status</label>
          <select id="elOccupation">
            <option value="" ${!bg.occupation ? "selected" : ""}>Select Status</option>
            ${[
              "Unemployed / No Income",
              "Informal / Contractual Worker",
              "Formal Employment",
              "Self-Employed / Business Owner",
              "OFW (Overseas Filipino Worker)",
              "Retired / Pensioner",
              "Other",
            ]
              .map(
                (opt) =>
                  `<option ${bg.occupation === opt ? "selected" : ""}>${opt}</option>`,
              )
              .join("")}
          </select>
        </div>
        <div class="st-schedule-modal-field">
          <label for="elMonthlyIncome">Monthly Household Income (₱)</label>
          <input id="elMonthlyIncome" type="number" min="0" step="0.01" value="${bg.monthlyIncome ?? ""}" placeholder="e.g. 12000">
        </div>
        <div class="st-schedule-modal-field st-schedule-modal-field--row">
          <input id="elReenrollee" type="checkbox" ${bg.isReenrollee ? "checked" : ""}>
          <label for="elReenrollee">Re-enrollee</label>
        </div>
        <div class="st-schedule-modal-field st-schedule-modal-field--row">
          <input id="el4Ps" type="checkbox" ${bg.is4Ps ? "checked" : ""}>
          <label for="el4Ps">4Ps Beneficiary</label>
        </div>
      `,
      onConfirm: () => {
        const modality = document.getElementById("elModality")?.value;
        const modalityReason = document.getElementById("elModalityReason")?.value.trim();
        const modalityEffective = document.getElementById("elModalityEffective")?.value;

        const otherFields = {
          civil_status: document.getElementById("elCivil")?.value.trim(),
          employment_status: document.getElementById("elEmployment")?.value.trim(),
          occupation: document.getElementById("elOccupation")?.value.trim(),
          monthly_income: document.getElementById("elMonthlyIncome")?.value || null,
          distance_from_clc_km: parseFloat(document.getElementById("elDistance")?.value) || 0,
          is_re_enrollee: document.getElementById("elReenrollee")?.checked,
          is4Ps: document.getElementById("el4Ps")?.checked,
        };

        const saveLearner = async (extra = {}) => {
          try {
            await API.updateLearner(this.getLearnerId(), {
              modality,
              ...otherFields,
              ...extra,
            });
            Toast?.success("Learner updated.");
            await this.load();
          } catch (error) {
            console.error("[LearnerProfile] Edit failed", error);
            Toast?.error(error?.data?.message || "Unable to update learner.");
          }
        };

        if (modality !== currentModality) {
          // Modal is a single shared #st-modal instance -- its confirm
          // button calls hide() right after this onConfirm returns, so
          // showing the confirmation modal synchronously here would just
          // have it immediately hidden again. Deferring to the next tick
          // lets that hide() finish first.
          setTimeout(() => {
            Modal.show({
              title: "Change Modality?",
              size: "sm",
              confirmLabel: "Confirm Change",
              message: `
                <p><strong>Current modality:</strong> ${currentModality}</p>
                <p><strong>New modality:</strong> ${modality}</p>
                <p><strong>Effective date:</strong> ${this.formatModalityDate(modalityEffective)}</p>
                ${modalityReason ? `<p><strong>Reason:</strong> ${modalityReason}</p>` : ""}
                <p style="color:var(--st-on-surface-variant);font-size:0.8125rem;margin-top:12px;">
                  This will update the learner's current modality. The previous modality will remain in the learner's modality history.
                </p>
              `,
              onConfirm: () => {
                saveLearner({
                  modality_change_reason: modalityReason || undefined,
                  modality_effective_date: modalityEffective || undefined,
                });
              },
            });
          }, 0);
          return;
        }

        saveLearner();
      },
    });

    const modalitySelect = document.getElementById("elModality");
    const reasonField = document.getElementById("elModalityReasonField");
    const effectiveField = document.getElementById("elModalityEffectiveField");

    const syncModalityChangeFields = () => {
      const changed = modalitySelect?.value !== currentModality;
      if (reasonField) reasonField.style.display = changed ? "" : "none";
      if (effectiveField) effectiveField.style.display = changed ? "" : "none";
    };

    modalitySelect?.addEventListener("change", syncModalityChangeFields);
    syncModalityChangeFields();
  }

  static renderOverview() {
    const p = this.profile;
    const m = p.metrics || {};

    this.set(
      "[data-metric-module-rate]",
      m.moduleRate == null ? "Not Yet Available" : `${m.moduleRate}%`,
    );
    this.set("[data-metric-module-rate-text]", m.moduleRate == null ? "" : m.moduleRateText);
    this.set("[data-metric-released]", m.modulesReleased);
    this.set("[data-metric-returned]", m.modulesReturned);
    this.set("[data-metric-active]", m.activeModules);
    this.set("[data-metric-last-activity]", m.lastActivity);
    this.set(
      "[data-metric-days-since]",
      m.daysSinceLastReturn == null ? "—" : m.daysSinceLastReturn,
    );
    this.set("[data-metric-overdue]", m.overdueModules ?? 0);

    // Modular learners do not use session attendance, so hide the attendance card
    // instead of showing an N/A metric. Face-to-Face/Blended learners still see it.
    const attendanceCard = document.querySelector(".st-metric-card--attendance");
    const attendanceNotApplicable = m.attendanceRateLabel === "N/A";
    if (attendanceCard) {
      attendanceCard.style.display = attendanceNotApplicable ? "none" : "";
    }
    if (!attendanceNotApplicable) {
      this.set(
        "[data-metric-attendance-rate]",
        m.attendanceRate == null
          ? (m.attendanceRateLabel || "Not Yet Available")
          : `${m.attendanceRate}%`,
      );
      this.set(
        "[data-metric-attendance-rate-text]",
        m.attendanceRateText || "",
      );
    }

    this.renderPerformanceProgress(p.performanceProgress || []);
    this.renderExamPassingChance(p.examPassingChance || {});

    this.renderRiskTrendChart(p.riskTrend || []);

    this.renderMonitoringSummaryTable();

    this.renderTimeline(
      document.querySelector("[data-activity-feed]"),
      p.recentActivity || [],
      "No recent activity yet.",
    );
  }

  static renderPerformanceProgress(progress) {
    const chart = document.querySelector("[data-performance-progress-chart]");
    const current = document.querySelector("[data-performance-progress-current]");

    if (!chart) return;

    if (!progress.length) {
      if (current) current.textContent = "Not Yet Available";
      chart.innerHTML = `
        <div class="st-performance-progress-empty">
          Performance progress will appear after modules are released and returned.
        </div>
      `;
      return;
    }

    const latest = progress[progress.length - 1];
    if (current) current.textContent = `${latest.rate}%`;

    const leftPad = 7;
    const rightPad = 3;
    const topPad = 8;
    const bottomPad = 10;
    const usableWidth = 100 - leftPad - rightPad;
    const usableHeight = 100 - topPad - bottomPad;

    const coords = progress.map((pt, i) => ({
      x:
        progress.length === 1
          ? leftPad + usableWidth / 2
          : leftPad + (i / (progress.length - 1)) * usableWidth,
      y:
        topPad +
        (1 - Math.max(0, Math.min(100, Number(pt.rate) || 0)) / 100) *
          usableHeight,
      pt,
    }));

    const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
    const area = [
      `${coords[0].x},${topPad + usableHeight}`,
      ...coords.map((c) => `${c.x},${c.y}`),
      `${coords[coords.length - 1].x},${topPad + usableHeight}`,
    ].join(" ");

    const dots = coords
      .map(
        ({ x, y, pt }) => `
          <span
            class="st-performance-progress-point"
            style="left:${x}%;top:${y}%;"
            title="${pt.date}: ${pt.rate}% (${pt.returned} of ${pt.released} modules returned)"
          ></span>
        `,
      )
      .join("");

    const labelIndexes = new Set([0, progress.length - 1]);
    if (progress.length > 2) {
      labelIndexes.add(Math.floor((progress.length - 1) / 2));
    }
    if (progress.length > 6) {
      labelIndexes.add(Math.floor((progress.length - 1) / 3));
      labelIndexes.add(Math.floor(((progress.length - 1) * 2) / 3));
    }

    const labels = coords
      .map(({ x, pt }, i) =>
        labelIndexes.has(i)
          ? `<span class="st-performance-progress-x-label" style="left:${x}%;">${pt.date}</span>`
          : "",
      )
      .join("");

    chart.innerHTML = `
      <div class="st-performance-progress-plot">
        ${[100, 75, 50, 25, 0]
          .map(
            (value) => `
              <div class="st-performance-progress-grid-line" style="top:${topPad + ((100 - value) / 100) * usableHeight}%;">
                <span>${value}%</span>
              </div>
            `,
          )
          .join("")}
        <svg class="st-performance-progress-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polygon points="${area}" class="st-performance-progress-area"></polygon>
          <polyline points="${line}" class="st-performance-progress-path"></polyline>
        </svg>
        ${dots}
        ${labels}
      </div>
    `;
  }

  static renderExamPassingChance(readiness) {
    const badge = document.querySelector("[data-exam-readiness-badge]");
    const scoreEl = document.querySelector("[data-exam-readiness-score]");
    const confidenceEl = document.querySelector("[data-exam-readiness-confidence]");
    const bar = document.querySelector("[data-exam-readiness-bar]");
    const summary = document.querySelector("[data-exam-readiness-summary]");
    const factors = document.querySelector("[data-exam-readiness-factors]");
    const note = document.querySelector("[data-exam-readiness-note]");

    if (!badge || !scoreEl || !confidenceEl || !bar || !summary || !factors) return;

    const status = String(readiness.status || "INSUFFICIENT").toUpperCase();
    const className =
      status === "HIGH" ? "high" : status === "LOW" ? "low" : "neutral";

    badge.className = `st-exam-readiness-badge st-exam-readiness-badge--${className}`;
    badge.textContent = readiness.label || "Not enough data";

    const score = Number.isFinite(Number(readiness.score)) && readiness.score != null
      ? Math.max(0, Math.min(100, Number(readiness.score)))
      : null;

    scoreEl.textContent = score == null ? "—" : `${Math.round(score)}/100`;
    confidenceEl.textContent = readiness.confidence || "Waiting for assessment scores";
    bar.style.width = score == null ? "0%" : `${score}%`;
    bar.className = `st-exam-readiness-progress-fill st-exam-readiness-progress-fill--${className}`;

    summary.textContent =
      readiness.summary ||
      "Record at least one module pre-test or post-test score to estimate this learner's A&E exam passing chance.";

    const rows = Array.isArray(readiness.factors) ? readiness.factors : [];
    factors.innerHTML = rows.length
      ? rows
          .map(
            (factor) => `
              <div class="st-exam-readiness-factor">
                <span class="st-exam-readiness-factor-name">${factor.name || "Performance factor"}</span>
                <span class="st-exam-readiness-factor-detail">${factor.detail || "—"}</span>
              </div>
            `,
          )
          .join("")
      : `<p class="st-assessment-empty">No performance factors available yet.</p>`;

    if (note) {
      note.textContent =
        readiness.disclaimer ||
        "Performance-based readiness estimate only; this is not an official A&E result or passing mark.";
    }
  }

  static renderRiskTrendChart(trend) {
    const points = document.querySelector("[data-risk-trend-points]");
    const list = document.querySelector("[data-risk-trend-list]");

    if (!points || !list) return;

    // Fallback band midpoints, only used for the rare point that has no
    // saved risk_probability (older/imported data) -- everything else uses
    // the actual probability so real movement within a level (e.g. Moderate
    // 40% -> Moderate 63%) is still visible on the chart.
    const yFor = { High: 15, Moderate: 50, Low: 85 };
    const yForPoint = (pt) =>
      pt.probability == null ? (yFor[pt.level] ?? 50) : Math.max(0, Math.min(100, 100 - pt.probability));

    if (!trend.length) {
      points.innerHTML = "";
      list.innerHTML = `<p class="st-risk-trend-empty">No risk assessment available yet.</p>`;
      return;
    }

    if (trend.length === 1) {
      const pt = trend[0];
      const y = yForPoint(pt);
      points.innerHTML = `<span class="st-risk-trend-point st-risk-trend-point--${pt.level.toLowerCase()}" style="left:50%;top:${y}%;" title="${pt.date}: ${pt.level} Risk${pt.probability != null ? ` (${pt.probability}%)` : ""}"></span>`;
      list.innerHTML = `
        <div class="st-risk-trend-list-row">
          <span>${pt.date}</span>
          <span class="st-risk-badge st-risk-badge--${pt.level.toLowerCase()}"><span class="st-risk-dot"></span>${pt.level}</span>
        </div>
        <p class="st-risk-trend-empty">Only one assessment is available. Additional assessments are required to display a risk trend.</p>
      `;
      return;
    }

    const coords = trend.map((pt, i) => ({
      x: (i / (trend.length - 1)) * 100,
      y: yForPoint(pt),
      pt,
    }));

    const line = coords.map((c) => `${c.x},${c.y}`).join(" ");

    const dots = coords
      .map(
        ({ x, y, pt }) =>
          `<span class="st-risk-trend-point st-risk-trend-point--${pt.level.toLowerCase()}" style="left:${x}%;top:${y}%;" title="${pt.date}: ${pt.level} Risk${pt.probability != null ? ` (${pt.probability}%)` : ""}"></span>`,
      )
      .join("");

    points.innerHTML = `
      <svg class="st-risk-trend-line" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points="${line}" fill="none" stroke="var(--st-primary)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
      </svg>
      ${dots}
    `;

    list.innerHTML = trend
      .map(
        (pt) => `
          <div class="st-risk-trend-list-row">
            <span>${pt.date}</span>
            <span class="st-risk-badge st-risk-badge--${pt.level.toLowerCase()}"><span class="st-risk-dot"></span>${pt.level}${pt.probability != null ? ` (${pt.probability}%)` : ""}</span>
          </div>
        `,
      )
      .join("");
  }

  static renderMonitoringSummaryTable() {
    const body = document.querySelector("[data-monitoring-summary-body]");

    if (!body) return;

    const timeline = (this.profile.monitoringHistory?.timeline || []).slice(0, 4);

    if (!timeline.length) {
      body.innerHTML = `<tr><td colspan="3" class="st-table-empty-cell">No monitoring activity yet.</td></tr>`;
      document
        .querySelector("[data-view-all-monitoring]")
        ?.addEventListener("click", () => {
          document.querySelector('[data-profile-tab="monitoring"]')?.click();
        });
      return;
    }

    body.innerHTML = timeline
      .map(
        (item) => `
            <tr>
                <td style="font-weight:600;color:var(--st-primary);">${this.capitalize(item.type)}</td>
                <td>${item.date}</td>
                <td>${item.title}${item.text ? ` — ${item.text}` : ""}</td>
            </tr>
        `,
      )
      .join("");

    document
      .querySelector("[data-view-all-monitoring]")
      ?.addEventListener("click", () => {
        document.querySelector('[data-profile-tab="monitoring"]')?.click();
      });
  }

  static renderMonitoringHistory() {
    const timeline = this.profile.monitoringHistory?.timeline || [];

    this.allTimelineItems = timeline;

    this.renderTimeline(
      document.querySelector("[data-monitoring-timeline]"),
      timeline,
      "No monitoring records yet.",
    );
  }

  static renderTimeline(container, items, emptyText = "Nothing to show yet.") {
    if (!container) return;

    if (!items.length) {
      container.innerHTML = `
                <div class="st-empty">
                    <span class="material-symbols-outlined">history</span>
                    <p class="st-empty-title">${emptyText}</p>
                </div>
            `;

      return;
    }

    const iconMap = {
      module: "menu_book",
      intervention: "support_agent",
      risk: "trending_up",
      modality: "swap_horiz",
    };

    container.innerHTML = items
      .map(
        (item) => `
            <div class="st-timeline-item">
                <div class="st-timeline-dot st-timeline-dot--${item.type}">
                    <span class="material-symbols-outlined">${iconMap[item.type] || "circle"}</span>
                </div>
                <div class="st-timeline-card">
                    <div class="st-timeline-card-head">
                        <p class="st-timeline-card-title">${item.title}</p>
                        <span class="st-timeline-card-date">${item.date}</span>
                    </div>
                    <p class="st-timeline-card-text">${item.text}</p>
                </div>
            </div>
        `,
      )
      .join("");
  }

  static bindHistoryFilters() {
    document.querySelectorAll("[data-history-filter]").forEach((chip) => {
      chip.addEventListener("click", () => {
        document
          .querySelectorAll("[data-history-filter]")
          .forEach((c) => c.classList.remove("is-active"));

        chip.classList.add("is-active");

        const filter = chip.dataset.historyFilter;

        const all = this.allTimelineItems || [];

        const filtered = filter === "all" ? all : all.slice(-3);

        this.renderTimeline(
          document.querySelector("[data-monitoring-timeline]"),
          filtered,
          "No monitoring records yet.",
        );
      });
    });

    document
      .querySelector("[data-history-search]")
      ?.addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase();

        const all = this.allTimelineItems || [];

        const filtered = q
          ? all.filter(
              (item) =>
                item.title.toLowerCase().includes(q) ||
                item.date.toLowerCase().includes(q),
            )
          : all;

        this.renderTimeline(
          document.querySelector("[data-monitoring-timeline]"),
          filtered,
          "No monitoring records yet.",
        );
      });
  }

  static renderRiskExplanation() {
    const r = this.profile.riskExplanation || {};

    const badge = document.querySelector("[data-risk-current-badge]");

    if (badge) badge.innerHTML = this.riskPill(this.profile.risk);

    this.set("[data-risk-summary]", r.summary);
    this.set("[data-risk-model-explanation]", r.modelExplanation);
    this.set(
      "[data-risk-records-used]",
      r.recordsUsed ? `Based on ${r.recordsUsed}.` : "",
    );

    const changesList = document.querySelector("[data-risk-changes]");
    const changesCard = document.querySelector("[data-risk-changes-card]");

    if (changesList) {
      if (!r.changes || !r.changes.length) {
        changesList.innerHTML = `<li class="st-change-list-empty">No risk level changes recorded yet.</li>`;
      } else {
        changesList.innerHTML = r.changes
          .map(
            (c) => `
                <li>
                    <span class="st-change-list-label">
                        <span class="material-symbols-outlined" style="color:var(--st-risk-${c.severity});">${c.icon}</span>
                        ${c.text}
                    </span>
                    <span style="font-weight:700;color:var(--st-risk-${c.severity});">${c.date}</span>
                </li>
            `,
          )
          .join("");
      }
    }
    if (changesCard) changesCard.style.display = "";

    const contributors = document.querySelector("[data-risk-contributors]");

    if (contributors) {
      contributors.innerHTML = (r.contributors || [])
        .map(
          (c) => `
                <div class="st-contributor-item">
                    <span class="material-symbols-outlined" style="color:var(--st-risk-${c.tone === "error" ? "high" : c.tone === "moderate" ? "moderate" : "low"});font-size:1.125rem;">${c.icon}</span>
                    <div>
                        <div class="st-contributor-title-row">
                            <p class="st-contributor-title">${c.title}</p>
                            <span class="st-contributor-badge" style="background:var(--st-risk-${c.tone === "error" ? "high" : c.tone === "moderate" ? "moderate" : "low"}-soft);color:var(--st-risk-${c.tone === "error" ? "high" : c.tone === "moderate" ? "moderate" : "low"});">${c.level}</span>
                        </div>
                        <p class="st-contributor-text">${c.text}</p>
                    </div>
                </div>
            `,
        )
        .join("");
    }
    const monitoringContext = document.querySelector("[data-risk-monitoring-context]");

    if (monitoringContext) {
      if (!r.monitoringContext || !r.monitoringContext.length) {
        monitoringContext.innerHTML = `<p class="st-contributor-text">No additional monitoring information is available for this learner yet.</p>`;
      } else {
        monitoringContext.innerHTML = r.monitoringContext
          .map(
            (m) => `
                <div class="st-contributor-item">
                    <span class="material-symbols-outlined" style="color:var(--st-on-surface-variant);font-size:1.125rem;">${m.icon}</span>
                    <div>
                        <p class="st-contributor-text">${m.text}</p>
                    </div>
                </div>
            `,
          )
          .join("");
      }
    }
    // "Recommended Teacher Action" and the "Details" sidebar were removed
    // from the Risk Explanation tab -- both were redundant with information
    // already shown elsewhere (the risk badge above, and the Recommended
    // Interventions list on the Interventions tab). recordsUsed is now
    // folded into a caption line under the summary instead (see above).
  }

  static renderInterventions() {
    const iv = this.profile.interventions || {};

    const recs = document.querySelector("[data-intervention-recommendations]");

    if (recs) {
      if (!iv.recommended || !iv.recommended.length) {
        recs.innerHTML = `<div class="st-empty" style="border:none;background:transparent;"><p class="st-empty-title">No recommendations available.</p></div>`;
      } else {
        recs.innerHTML = iv.recommended
          .map(
            (r) => `
                <div class="st-intervention-card">
                    <div class="st-intervention-card-head">
                        <div class="st-intervention-card-title-row">
                            <span class="st-priority-chip st-priority-chip--${r.priority.toLowerCase().includes("high") ? "high" : "medium"}">${r.priority}</span>
                            <p style="font-weight:700;color:var(--st-primary);font-size:0.875rem;">${r.title}</p>
                        </div>
                        <span class="st-intervention-rank">Rank #${r.rank}</span>
                    </div>
                                          <p class="st-intervention-card-factor"><strong>Factor:</strong> ${r.factor || "â€”"}</p>
                      <p class="st-intervention-card-text">${r.text}</p>
                      ${r.aiInsight ? `
                      <div style="margin-top:12px;padding:10px 12px;background:#F5F3FF;border-left:3px solid #7C3AED;border-radius:6px;">
                          <p style="font-size:0.6875rem;font-weight:700;color:#7C3AED;text-transform:uppercase;letter-spacing:0.03em;margin-bottom:4px;">AI Insight</p>
                          <p style="font-size:0.8125rem;color:#374151;margin-bottom:6px;">${r.aiInsight.reason}</p>
                          <p style="font-size:0.8125rem;color:#6B7280;font-style:italic;margin-top:6px;">Disclaimer: AI generated suggestions may not always be accurate or appropriate. Please review and use professional judgment before applying any intervention.</p>
                      </div>
                      ` : ""}
                      <div class="st-intervention-card-footer">
                          <span class="st-intervention-action-hint">Action: ${r.action}</span>
                          <button type="button" class="st-btn st-btn-primary st-btn-xs" data-assign-recommendation="${r.rank}">Select</button>
                    </div>
                </div>
            `,
          )
          .join("");

        recs.querySelectorAll("[data-assign-recommendation]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const rank = Number(btn.dataset.assignRecommendation);
            const rec = iv.recommended.find((r) => r.rank === rank);
            this.openAddInterventionModal(rec?.text || "");
          });
        });
      }
    }

    const active = document.querySelector("[data-active-intervention]");

    if (active) {
      const list = iv.activeList || [];

      if (!list.length) {
        active.innerHTML = `
          <div class="st-empty" style="border:none;background:transparent;">
            <span class="material-symbols-outlined">assignment_turned_in</span>
            <p class="st-empty-title">No interventions have been assigned.</p>
            <p class="st-empty-text">Assign an intervention once a learner requires additional support.</p>
          </div>
        `;
      } else {
        active.innerHTML = list.map((a) => `
          <div class="st-active-intervention" data-iv-id="${a.id}" style="margin-bottom:12px;">
            <div>
              <div style="display:flex;align-items:center;gap:8px;">
                <p style="font-weight:700;font-size:0.875rem;">${a.title}</p>
                <span style="font-size:0.625rem;font-weight:700;color:var(--st-risk-high);text-transform:uppercase;">${a.priority}</span>
              </div>
              <div class="st-active-intervention-meta">
                <span>Assigned: ${a.assigned}</span>
                ${a.followUp && a.followUp !== "—" ? `<span>Due: ${a.followUp}</span>` : ""}
              </div>
              ${a.dueStatus ? `
              <p style="margin-top:8px;font-size:0.75rem;font-weight:700;color:${a.dueStatus === "overdue" ? "#B91C1C" : "#B45309"};">
                ⚠️ ${a.dueStatus === "overdue" ? "Overdue" : a.dueStatus === "due" ? "Due Today" : "Due Soon"} - Update Required
              </p>
              ` : ""}
              ${["COMPLETED", "CANCELLED"].includes(a.status?.toUpperCase()) ? `<div style="margin-top:10px;"><span class="st-pill st-pill--teal">${a.status}</span></div>` : ""}
              ${a.aiReason || a.aiNextStep ? `
              <div style="margin-top:12px;padding:10px 12px;background:#F5F3FF;border-left:3px solid #7C3AED;border-radius:6px;">
                <p style="font-size:0.6875rem;font-weight:700;color:#7C3AED;text-transform:uppercase;letter-spacing:0.03em;margin-bottom:4px;">AI Insight</p>
                ${a.aiReason ? `<p style="font-size:0.8125rem;color:#374151;margin-bottom:6px;">${a.aiReason}</p>` : ""}
                ${a.aiNextStep ? `<p style="font-size:0.75rem;color:#4B5563;"><strong>Suggested next step:</strong> ${a.aiNextStep}</p>` : ""}
                <p style="font-size:0.8125rem;color:#6B7280;font-style:italic;margin-top:8px;">Disclaimer: AI generated suggestions may not always be accurate or appropriate. Please review and use professional judgment before applying any intervention.</p>
              </div>
              ` : ""}
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;">
              <button type="button" class="st-btn st-btn-outline st-btn-xs" data-update-status>Update Status</button>
              <button type="button" class="st-btn st-btn-primary st-btn-xs" data-add-outcome>Add Outcome</button>
              ${a.canSaveToHistory ? `<button type="button" class="st-btn st-btn-outline st-btn-xs" data-save-to-history>Save to History</button>` : ""}
            </div>
          </div>
        `).join("");

        active.querySelectorAll("[data-iv-id]").forEach((card) => {
          const id = Number(card.dataset.ivId);

          card.querySelector("[data-update-status]")
            ?.addEventListener("click", () => this.openUpdateStatusModal(id));

          card.querySelector("[data-add-outcome]")
            ?.addEventListener("click", () => this.openAddOutcomeModal(id));

          card.querySelector("[data-save-to-history]")
            ?.addEventListener("click", async () => {
              try {
                await API.moveInterventionToHistory(id);
                Toast?.success("Intervention saved to history.");
                await this.load();
                document.querySelector('[data-profile-tab="interventions"]')?.click();
              } catch (error) {
                console.error("[LearnerProfile] Save to history failed", error);
                Toast?.error(error?.data?.message || "Unable to save to history.");
              }
            });
        });
      }
    }

    const history = document.querySelector("[data-intervention-history]");

    if (history) {
      if (!iv.history || !iv.history.length) {
                history.innerHTML = `<tr><td colspan="4" class="st-table-empty-cell">No interventions have been assigned yet.</td></tr>`;
      } else {
                history.innerHTML = iv.history
          .map(
            (h) => `
                <tr>
                    <td>${h.date}</td>
                    <td style="font-weight:600;color:var(--st-primary);cursor:pointer;text-decoration:underline;" data-view-history="${h.id}">${h.intervention}</td>
                    <td>${h.remarks}</td>
                    <td>
                        <button type="button" class="st-btn st-btn-outline st-btn-xs" data-edit-history="${h.id}">Edit</button>
                        <button type="button" class="st-btn st-btn-outline st-btn-xs" data-delete-history="${h.id}">Delete</button>
                    </td>
                </tr>
            `,
          )
          .join("");
                  history.querySelectorAll("[data-view-history]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = Number(btn.dataset.viewHistory);
            const h = iv.history.find((x) => x.id === id);
            this.openViewHistoryModal(h);
          });
        });
        history.querySelectorAll("[data-edit-history]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = Number(btn.dataset.editHistory);
            const h = iv.history.find((x) => x.id === id);
            this.openEditHistoryModal(h);
          });
        });
        history.querySelectorAll("[data-delete-history]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = Number(btn.dataset.deleteHistory);
            this.openDeleteHistoryModal(id);
          });
        });
      }
    }

    const factors = document.querySelector("[data-current-risk-factors]");

    if (factors) {
      const toneMap = {
        error: "var(--st-risk-high)",
        moderate: "var(--st-risk-moderate)",
        neutral: "#60a5fa",
      };

      const contributors = this.profile.riskExplanation?.contributors || [];

      factors.innerHTML = contributors.length
        ? contributors
            .slice(0, 3)
            .map(
              (c) => `
                <div class="st-risk-factor-item">
                    <span class="st-risk-factor-dot" style="background:${toneMap[c.tone] || "var(--st-outline)"};"></span>
                    <div>
                        <p style="font-weight:600;font-size:0.8125rem;">Important Factor: ${c.title}</p>
                        <p style="font-size:0.6875rem;color:var(--st-on-surface-variant);">${c.text}</p>
                    </div>
                </div>
            `,
            )
            .join("")
        : `<p class="st-empty-text" style="padding:8px 0;">No risk factors on record.</p>`;
    }

    document
      .querySelector("[data-add-intervention-btn]")
      ?.addEventListener("click", () => this.openAddInterventionModal());
  }

  static openAddInterventionModal(prefillDescription = "") {
    if (!window.Modal) return;
    const types = [
      "Home Visit", "Consultation", "Referral",
      "Learner Follow-up", "Parent/Guardian Conference", "Other",
    ];

    Modal.show({
      title: "Assign Intervention",
      size: "sm",
      confirmLabel: "Select Intervention",
      message: `
        <div class="st-schedule-modal-field">
          <label for="ivType">Intervention Type</label>
          <select id="ivType">${types.map((t) => `<option value="${t}">${t}</option>`).join("")}</select>
        </div>
        <div class="st-schedule-modal-field">
          <label for="ivDescription">Description</label>
          <textarea id="ivDescription" rows="3" placeholder="What will this intervention involve?">${prefillDescription}</textarea>
        </div>
        <div class="st-schedule-modal-field">
          <label for="ivTargetDate">Target Follow-up Date (required)</label>
          <input type="date" id="ivTargetDate">
        </div>
      `,
      onConfirm: async () => {
        const type = document.getElementById("ivType")?.value;
        const description = document.getElementById("ivDescription")?.value.trim();
        const targetDate = document.getElementById("ivTargetDate")?.value;

        if (!description) {
          Toast?.error("Please describe the intervention.");
          return;
        }
                if (!targetDate) {
          Toast?.error("Please set a target follow-up date.");
          return;
        }

        try {
          await API.createIntervention(this.getLearnerId(), {
            type, description, targetDate,
          });
          Toast?.success("Intervention assigned.");
          await this.load();
          document.querySelector('[data-profile-tab="interventions"]')?.click();
        } catch (error) {
          console.error("[LearnerProfile] Assign intervention failed", error);
          Toast?.error(error?.data?.message || "Unable to assign intervention.");
        }
      },
    });
  }

  static openUpdateStatusModal(interventionId) {
    if (!window.Modal || !interventionId) return;
      const statuses = ["COMPLETED", "CANCELLED"];

    Modal.show({
      title: "Update Intervention Status",
      size: "sm",
      confirmLabel: "Update Status",
        message: `
        <div class="st-schedule-modal-field">
          <label for="ivStatus">Status</label>
          <select id="ivStatus">${statuses.map((s) => `<option value="${s}">${this.capitalize(s.toLowerCase())}</option>`).join("")}</select>
        </div>
      `,
      onConfirm: async () => {
        const status = document.getElementById("ivStatus")?.value;
        try {
          await API.updateInterventionStatus(interventionId, { status });
          Toast?.success("Status updated.");
          await this.load();
          document.querySelector('[data-profile-tab="interventions"]')?.click();
        } catch (error) {
          console.error("[LearnerProfile] Status update failed", error);
          Toast?.error(error?.data?.message || "Unable to update status.");
        }
      },
    });
  }

  static openAddOutcomeModal(interventionId) {
    if (!window.Modal || !interventionId) return;

    this._outcomePhotos = [];

    Modal.show({
      title: "Add Outcome",
      size: "xl",
      confirmLabel: "Save Outcome",
      message: `
        <p style="font-size:13px;color:#6B7280;margin-bottom:16px;">Document what happened after the intervention and record the learner's response or outcome.</p>
        <div class="st-schedule-modal-field">
          <label for="ivOutcome">Outcome</label>
            <select id="ivOutcome" onchange="document.getElementById('ivOutcomeOtherField').style.display = this.value === 'Others' ? '' : 'none';">
            <option value="Successful">Successful</option>
            <option value="Failed">Failed</option>
            <option value="Others">Others</option>
          </select>
        </div>
        <div class="st-schedule-modal-field" id="ivOutcomeOtherField" style="display:none;">
          <label for="ivOutcomeOther">Please specify</label>
          <input id="ivOutcomeOther" type="text" placeholder="Describe the outcome...">
        </div>
        <div class="st-schedule-modal-field">
          <label for="ivNotes">Notes</label>
          <textarea id="ivNotes" rows="3" placeholder="Details from the follow-up..."></textarea>
        </div>
        <div class="st-schedule-modal-field">
          <label for="ivPhotoInput">Photos (optional, up to 5)</label>
          <input id="ivPhotoInput" type="file" accept="image/*" multiple>
          <div id="ivPhotoPreview" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;"></div>
        </div>
      `,
      onConfirm: async () => {
        const outcomeSelect = document.getElementById("ivOutcome")?.value;
        const outcomeOther = document.getElementById("ivOutcomeOther")?.value.trim();
        const outcome = outcomeSelect === "Others" ? outcomeOther : outcomeSelect;
        const notes = document.getElementById("ivNotes")?.value.trim();
        if (outcomeSelect === "Others" && !outcomeOther) {
          Toast?.error("Please specify the outcome.");
          return;
        }
        if (!notes) {
          Toast?.error("Notes are required.");
          return;
        }

        try {
          await API.addInterventionFollowUp(interventionId, {
            outcome,
            notes,
            photos: this._outcomePhotos,
          });
          Toast?.success("Outcome recorded.");
          this._outcomePhotos = [];
          await this.load();
          document.querySelector('[data-profile-tab="interventions"]')?.click();
        } catch (error) {
          console.error("[LearnerProfile] Add outcome failed", error);
          Toast?.error(error?.data?.message || "Unable to save outcome.");
        }
      },
    });

    setTimeout(() => this.bindOutcomePhotoInput(), 0);
  }

  static bindOutcomePhotoInput() {
    const input = document.getElementById("ivPhotoInput");
    const preview = document.getElementById("ivPhotoPreview");
    if (!input || !preview) return;

    input.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        if (this._outcomePhotos.length >= 5) {
          Toast?.error("Maximum of 5 photos per outcome.");
          break;
        }
        const resized = await this.resizeImageFile(file);
        this._outcomePhotos.push({ file_name: file.name, image_data: resized });
        this.renderOutcomePhotoPreview();
      }
      input.value = "";
    });
  }

  static renderOutcomePhotoPreview() {
    const preview = document.getElementById("ivPhotoPreview");
    if (!preview) return;
    preview.innerHTML = this._outcomePhotos
      .map(
        (p, i) => `
        <div style="position:relative;width:72px;height:72px;">
          <img src="${p.image_data}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;border:1px solid #E5E7EB;">
          <button type="button" data-remove-outcome-photo="${i}" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#DC2626;color:#fff;border:none;font-size:12px;cursor:pointer;line-height:1;">×</button>
        </div>
      `
      )
      .join("");

    preview.querySelectorAll("[data-remove-outcome-photo]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.removeOutcomePhoto);
        this._outcomePhotos.splice(idx, 1);
        this.renderOutcomePhotoPreview();
      });
    });
  }

  static resizeImageFile(file, maxDim = 900, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
    static openPhotoLightbox(imageData) {
    const existing = document.getElementById("stPhotoLightbox");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "stPhotoLightbox";
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;cursor:zoom-out;";
    overlay.innerHTML = `
      <img src="${imageData}" style="max-width:100%;max-height:100%;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.4);">
      <button type="button" style="position:absolute;top:16px;right:24px;background:none;border:none;color:#fff;font-size:32px;cursor:pointer;line-height:1;">×</button>
    `;
    overlay.addEventListener("click", () => overlay.remove());
    document.body.appendChild(overlay);
  }
    static openViewHistoryModal(h) {
    if (!window.Modal || !h) return;
    const photos = h.photos || [];
    Modal.show({
      title: h.intervention,
      size: "md",
      confirmLabel: "Close",
      message: `
        <p style="font-size:13px;color:#6B7280;margin-bottom:10px;">Assigned: ${h.date} — ${h.remarks}</p>
        <p style="font-size:14px;margin-bottom:12px;">${h.description || "No description recorded."}</p>
        ${h.aiReason ? `
        <div style="padding:10px 12px;background:#F5F3FF;border-left:3px solid #7C3AED;border-radius:6px;margin-bottom:12px;">
          <p style="font-size:11px;font-weight:700;color:#7C3AED;text-transform:uppercase;margin-bottom:4px;">AI Insight</p>
          <p style="font-size:13px;color:#374151;">${h.aiReason}</p>
        </div>
        ` : ""}
                  ${h.outcome ? `<p style="font-size:13px;"><strong>Outcome:</strong> ${h.outcome}</p>` : ""}
          ${h.outcomeNotes ? `<p style="font-size:13px;"><strong>Outcome Notes:</strong> ${h.outcomeNotes}</p>` : ""}
          ${photos.length ? `
          <p style="font-size:13px;font-weight:700;margin-top:12px;margin-bottom:6px;">Photos</p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${photos.map((p, i) => `<img src="${p.imageData}" alt="${p.fileName || "Outcome photo"}" style="width:90px;height:90px;object-fit:cover;border-radius:6px;border:1px solid #E5E7EB;cursor:pointer;" onclick="LearnerProfilePage.openPhotoLightbox('${p.imageData.replace(/'/g, "\\'")}')">`).join("")}
          </div>
          ` : ""}
      `,
      onConfirm: async () => {},
    });
  }
  static openEditHistoryModal(h) {
    if (!window.Modal || !h) return;
    Modal.show({
      title: "Edit Intervention",
      size: "sm",
      confirmLabel: "Save Changes",
      message: `
        <div class="st-schedule-modal-field">
          <label for="editIvType">Intervention Type</label>
          <input id="editIvType" type="text" value="${h.intervention || ""}">
        </div>
        <div class="st-schedule-modal-field">
          <label for="editIvDesc">Description</label>
          <textarea id="editIvDesc">${h.description || ""}</textarea>
        </div>
      `,
      onConfirm: async () => {
        const interventionType = document.getElementById("editIvType")?.value?.trim();
        const description = document.getElementById("editIvDesc")?.value?.trim();
        try {
          await API.updateInterventionRecord(h.id, { interventionType, description });
          Toast?.success("Intervention updated.");
          await this.load();
          document.querySelector('[data-profile-tab="interventions"]')?.click();
        } catch (error) {
          console.error("[LearnerProfile] Edit history failed", error);
          Toast?.error(error?.data?.message || "Unable to update intervention.");
        }
      },
    });
  }
  static openDeleteHistoryModal(id) {
    if (!window.Modal || !id) return;
    Modal.show({
      title: "Delete Intervention",
      size: "sm",
      confirmLabel: "Delete",
      message: `<p>Are you sure you want to delete this intervention record? This cannot be undone.</p>`,
      onConfirm: async () => {
        try {
          await API.deleteIntervention(id);
          Toast?.success("Intervention deleted.");
          await this.load();
          document.querySelector('[data-profile-tab="interventions"]')?.click();
        } catch (error) {
          console.error("[LearnerProfile] Delete history failed", error);
          Toast?.error(error?.data?.message || "Unable to delete intervention.");
        }
      },
    });
  }

  static showSkeleton() {
    const monitoringBody = document.querySelector(
      "[data-monitoring-summary-body]",
    );

    if (monitoringBody && window.Skeletons) {
      monitoringBody.innerHTML = Skeletons.tableRows(3, 3);
    }

    const timeline = document.querySelector("[data-monitoring-timeline]");

    if (timeline && window.Skeletons) {
      timeline.innerHTML = Skeletons.listItems(4);
    }
  }

  static riskPill(risk) {
    const cls =
      { High: "high", Moderate: "moderate", Low: "low" }[risk] || "neutral";
    const label = cls === "neutral" ? "Not Yet Assessed" : `${risk} Risk`;
    return `<span class="st-risk-badge st-risk-badge--${cls}" style="padding:4px 16px;font-size:0.75rem;"><span class="st-risk-dot"></span>${label}</span>`;
  }

  static capitalize(s) {
    return s ? s[0].toUpperCase() + s.slice(1) : s;
  }

  static set(selector, value) {
    const el = document.querySelector(selector);
    if (el && value !== undefined && value !== null) {
      el.textContent = value;
    }
  }
}

(function bootLearnerProfile() {
  let started = false;
  const start = () => {
    if (!started) {
      started = true;
      LearnerProfilePage.init();
    }
  };
  document.addEventListener("components:loaded", start);
  document.addEventListener("DOMContentLoaded", () => setTimeout(start, 400));
})();

window.LearnerProfilePage = LearnerProfilePage;
