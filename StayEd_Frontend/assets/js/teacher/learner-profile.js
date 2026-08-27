class LearnerProfilePage {
  static profile = null;

  static async init() {
    if (window.Guards) Guards.teacher();

    this.bindTabs();

    this.bindHistoryFilters();

    await this.load();

    this.openRequestedTab();
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
                <p style="color:var(--st-on-surface-variant);font-size:13px;margin-top:12px;">
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

    this.renderRiskTrendChart(p.riskTrend || []);

    this.renderMonitoringSummaryTable();

    this.renderTimeline(
      document.querySelector("[data-activity-feed]"),
      p.recentActivity || [],
      "No recent activity yet.",
    );
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
                    <span class="material-symbols-outlined" style="color:var(--st-risk-${c.tone === "error" ? "high" : c.tone === "moderate" ? "moderate" : "low"});font-size:18px;">${c.icon}</span>
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

    const recommendedAction = document.querySelector("[data-risk-recommended-action]");

    if (recommendedAction) {
      recommendedAction.innerHTML = (r.recommendedAction || [])
        .map(
          (a) => `
              <div class="st-action-item">
                  <span class="material-symbols-outlined" style="color:var(--st-primary);font-size:18px;">arrow_right</span>
                  <div>
                      <p class="st-action-item-title">${a.title}</p>
                      <p class="st-action-item-text">${a.text}</p>
                  </div>
              </div>
          `,
        )
        .join("");
    }

    const details = document.querySelector("[data-risk-details]");

    if (details) {
      details.innerHTML = `
                <div class="st-sidebar-info-row"><span>Current Risk</span><span>${r.currentRisk || "—"}</span></div>
                <div class="st-sidebar-info-row"><span>Records Used</span><span style="text-align:right;">${r.recordsUsed || "—"}</span></div>
            `;
    }
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
                            <p style="font-weight:700;color:var(--st-primary);font-size:14px;">${r.title}</p>
                        </div>
                        <span class="st-intervention-rank">Rank #${r.rank}</span>
                    </div>
                    <p class="st-intervention-card-factor"><strong>Factor:</strong> ${r.factor || "—"}</p>
                    <p class="st-intervention-card-text">${r.text}</p>
                    <div class="st-intervention-card-footer">
                        <span class="st-intervention-action-hint">Action: ${r.action}</span>
                        <button type="button" class="st-btn st-btn-primary st-btn-xs" data-assign-recommendation="${r.rank}">Assign</button>
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
      if (!iv.active) {
        active.innerHTML = `
          <div class="st-empty" style="border:none;background:transparent;">
            <span class="material-symbols-outlined">assignment_turned_in</span>
            <p class="st-empty-title">No interventions have been assigned.</p>
            <p class="st-empty-text">Assign an intervention once a learner requires additional support.</p>
          </div>
        `;
      } else {
        active.innerHTML = `
                <div class="st-active-intervention">
                    <div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <p style="font-weight:700;font-size:14px;">${iv.active.title}</p>
                            <span style="font-size:10px;font-weight:700;color:var(--st-risk-high);text-transform:uppercase;">${iv.active.priority}</span>
                        </div>
                        <div class="st-active-intervention-meta">
                            <span>Assigned: ${iv.active.assigned}</span>
                            <span>Follow-up: ${iv.active.followUp}</span>
                            <span>Assigned by: ${iv.active.assignedBy}</span>
                        </div>
                        <div style="margin-top:10px;">
                            <span class="st-pill st-pill--teal">${iv.active.status}</span>
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;flex-shrink:0;">
                        <button type="button" class="st-btn st-btn-outline st-btn-xs" data-update-status>Update Status</button>
                        <button type="button" class="st-btn st-btn-primary st-btn-xs" data-add-outcome>Add Outcome</button>
                    </div>
                </div>
            `;

        active
          .querySelector("[data-update-status]")
          ?.addEventListener("click", () => this.openUpdateStatusModal(iv.active.id));

        active
          .querySelector("[data-add-outcome]")
          ?.addEventListener("click", () => this.openAddOutcomeModal(iv.active.id));
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
                    <td style="font-weight:600;">${h.intervention}</td>
                    <td>${h.status}</td>
                    <td>${h.remarks}</td>
                </tr>
            `,
          )
          .join("");
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
                        <p style="font-weight:600;font-size:13px;">${c.level} Impact: ${c.title}</p>
                        <p style="font-size:11px;color:var(--st-on-surface-variant);">${c.text}</p>
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
      confirmLabel: "Assign Intervention",
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
          <label for="ivTargetDate">Target Follow-up Date (optional)</label>
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

        try {
          await API.createIntervention(this.getLearnerId(), {
            type, description, targetDate: targetDate || undefined,
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
    const statuses = ["PLANNED", "ONGOING", "COMPLETED", "CANCELLED"];

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

    Modal.show({
      title: "Add Outcome",
      size: "sm",
      confirmLabel: "Save Outcome",
      message: `
        <div class="st-schedule-modal-field">
          <label for="ivOutcome">Outcome</label>
          <input id="ivOutcome" type="text" placeholder="e.g. Learner responded positively">
        </div>
        <div class="st-schedule-modal-field">
          <label for="ivNotes">Notes</label>
          <textarea id="ivNotes" rows="3" placeholder="Details from the follow-up..."></textarea>
        </div>
      `,
      onConfirm: async () => {
        const outcome = document.getElementById("ivOutcome")?.value.trim();
        const notes = document.getElementById("ivNotes")?.value.trim();

        if (!notes) {
          Toast?.error("Notes are required.");
          return;
        }

        try {
          await API.addInterventionFollowUp(interventionId, { outcome, notes });
          Toast?.success("Outcome recorded.");
          await this.load();
          document.querySelector('[data-profile-tab="interventions"]')?.click();
        } catch (error) {
          console.error("[LearnerProfile] Add outcome failed", error);
          Toast?.error(error?.data?.message || "Unable to save outcome.");
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
    return `<span class="st-risk-badge st-risk-badge--${cls}" style="padding:4px 16px;font-size:12px;"><span class="st-risk-dot"></span>${label}</span>`;
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
