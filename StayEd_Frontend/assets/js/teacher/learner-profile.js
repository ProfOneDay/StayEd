class LearnerProfilePage {
  static profile = null;

  static async init() {
    if (window.Guards) Guards.teacher();

    this.bindTabs();

    this.bindHistoryFilters();

    this.bindRunPrediction();

    await this.load();
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

  static bindRunPrediction() {
    const btn = document.querySelector("[data-profile-run-prediction-btn]");

    if (!btn) return;

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.innerHTML = `<span class="material-symbols-outlined">progress_activity</span> Running…`;

      try {
        const result = await API.runPrediction(this.getLearnerId());

        Toast?.success(
          `Prediction generated: ${result.risk_level} risk (${Math.round(result.risk_probability * 100)}%)`,
        );

        await this.load();
      } catch (error) {
        console.error("[LearnerProfile] runPrediction", error);

        Toast?.error(error.message || "Unable to generate a prediction.");
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined">insights</span> Run Prediction`;
      }
    });
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

    const initials = (p.name || "?")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    this.set("[data-profile-avatar]", initials);
    this.set("[data-profile-name]", p.name);
    this.set("[data-profile-lrn]", p.lrn);
    this.set("[data-profile-clc]", p.clc || "San Felipe Sur CLC");
    this.set("[data-profile-level]", p.level);
    this.set("[data-profile-modality]", p.modality);
    this.set(
      "[data-profile-probability]",
      `${Math.round((p.risk_probability || 0.5) * 100)}%`,
    );
    this.set(
      "[data-profile-confidence]",
      p.riskExplanation?.confidence || "High",
    );

    const badge = document.querySelector("[data-profile-risk-badge]");

    if (badge) badge.innerHTML = this.riskPill(p.risk);

    document
      .querySelector("[data-profile-assign-btn]")
      ?.addEventListener("click", () => {
        document.querySelector('[data-profile-tab="interventions"]')?.click();
      });

    document
      .querySelector("[data-profile-edit-btn]")
      ?.addEventListener("click", () => {
        Toast?.info(
          "Learner editing will open the enrollment form once connected.",
        );
      });
  }

  static renderOverview() {
    const p = this.profile;
    const m = p.metrics || {};

    this.set("[data-metric-attendance]", `${m.attendanceRate}%`);

    const deltaEl = document.querySelector("[data-metric-attendance-delta]");

    if (deltaEl && m.attendanceDelta != null) {
      const isDown = m.attendanceDelta < 0;

      deltaEl.classList.toggle("is-down", isDown);
      deltaEl.classList.toggle("is-up", !isDown);
      deltaEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:12px;">${isDown ? "trending_down" : "trending_up"}</span>${m.attendanceDelta}%`;
    }

    this.set(
      "[data-metric-modules]",
      `${m.modulesCompleted} of ${m.modulesTotal} Modules`,
    );

    const modulesPct =
      Math.round((m.modulesCompleted / m.modulesTotal) * 100) || 0;

    this.set("[data-metric-modules-pct]", `${modulesPct}%`);

    const bar = document.querySelector("[data-metric-modules-bar]");

    if (bar)
      requestAnimationFrame(() => {
        bar.style.width = `${modulesPct}%`;
      });

    this.set("[data-metric-timeliness]", `${m.submissionTimeliness}%`);
    this.set(
      "[data-metric-consultations]",
      `${m.consultationsAttended} of ${m.consultationsTotal}`,
    );

    this.renderRiskTrendChart(p.riskTrend || []);

    this.renderRecommendedActions(p.recommendedActions || []);

    this.renderMonitoringSummaryTable();

    this.renderBackgroundInfo(p.background || {});

    this.renderActivityFeed(p.recentActivity || []);
  }

  static renderRiskTrendChart(trend) {
    const svg = document.querySelector("[data-risk-trend-svg]");
    const xaxis = document.querySelector("[data-risk-trend-xaxis]");

    if (!svg || !trend.length) return;

    const w = 600,
      h = 220;

    const max = 100;

    const points = trend.map((pt, i) => {
      const x = (i / (trend.length - 1)) * w;
      const y = h - (pt.value / max) * h;
      return `${x},${y}`;
    });

    const path = `M ${points.join(" L ")}`;

    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

    svg.innerHTML = `
            <path d="${path}" fill="none" stroke="#12355B" stroke-linecap="round" stroke-width="3"/>
            <circle cx="${points[points.length - 1].split(",")[0]}" cy="${points[points.length - 1].split(",")[1]}" r="5" fill="#12355B"/>
        `;

    if (xaxis) {
      xaxis.innerHTML = trend.map((pt) => `<span>${pt.month}</span>`).join("");
    }
  }

  static renderRecommendedActions(actions) {
    const container = document.querySelector("[data-recommended-actions]");

    if (!container) return;

    container.innerHTML = actions
      .map(
        (a) => `
            <div class="st-recommend-card">
                <div class="st-recommend-card-head">
                    <span class="st-priority-chip st-priority-chip--${a.priority}">${a.priority} priority</span>
                    <button type="button" class="st-panel-link" style="font-size:11px;" data-assign-action>Assign</button>
                </div>
                <p style="font-weight:700;font-size:13px;">${a.title}</p>
                <p style="font-size:11px;color:var(--st-on-surface-variant);">${a.text}</p>
            </div>
        `,
      )
      .join("");

    container.querySelectorAll("[data-assign-action]").forEach((btn) => {
      btn.addEventListener("click", () =>
        Toast?.success("Action assigned to your task list."),
      );
    });
  }

  static renderMonitoringSummaryTable() {
    const body = document.querySelector("[data-monitoring-summary-body]");

    if (!body) return;

    const timeline = (this.profile.monitoringHistory?.timeline || []).slice(
      0,
      4,
    );

    body.innerHTML = timeline
      .map(
        (item) => `
            <tr>
                <td style="font-weight:600;color:var(--st-primary);">${this.capitalize(item.type)}</td>
                <td>${item.date}</td>
                <td>${this.statusBadge(item.type)}</td>
                <td>${item.text}</td>
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

  static renderBackgroundInfo(bg) {
    const container = document.querySelector("[data-background-info]");

    if (!container) return;

    const rows = {
      "Age / Sex": `${this.profile.age || "—"} / ${this.profile.sex || "—"}`,
      "Civil Status": bg.civilStatus,
      Employment: bg.employment,
      "Distance Category": bg.distanceCategory,
      Modality: this.profile.modality,
      "Learning Level": this.profile.level,
      "Re-enrollee": bg.reenrollee,
      "Years Enrolled": bg.yearsEnrolled,
      "4Ps Beneficiary": bg.beneficiary4Ps,
    };

    container.innerHTML = Object.entries(rows)
      .map(
        ([label, value]) => `
            <div class="st-sidebar-info-row">
                <span>${label}</span>
                <span>${value ?? "—"}</span>
            </div>
        `,
      )
      .join("");
  }

  static renderActivityFeed(activity) {
    const container = document.querySelector("[data-activity-feed]");

    if (!container) return;

    const iconMap = {
      trending_up: "trending_up",
      "file-check": "task_alt",
      users: "groups",
      mail: "mail",
    };

    container.innerHTML = activity
      .map(
        (item) => `
            <div class="st-activity-item">
                <div class="st-activity-dot st-activity-dot--${item.tone}">
                    <span class="material-symbols-outlined">${iconMap[item.icon] || "circle"}</span>
                </div>
                <p class="st-activity-title">${item.title}</p>
                <p class="st-activity-sub">${item.sub}</p>
                ${item.date ? `<p class="st-activity-date">${item.date}</p>` : ""}
            </div>
        `,
      )
      .join("");
  }

  static renderMonitoringHistory() {
    const timeline = this.profile.monitoringHistory?.timeline || [];

    this.allTimelineItems = timeline;

    this.renderTimeline(timeline);
  }

  static renderTimeline(items) {
    const container = document.querySelector("[data-monitoring-timeline]");

    if (!container) return;

    if (!items.length) {
      container.innerHTML = `
                <div class="st-empty">
                    <span class="material-symbols-outlined">history</span>
                    <p class="st-empty-title">No monitoring records yet</p>
                </div>
            `;

      return;
    }

    const iconMap = {
      attendance: "event_busy",
      module: "assignment_late",
      intervention: "support_agent",
      note: "sticky_note_2",
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

        this.renderTimeline(filtered);
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

        this.renderTimeline(filtered);
      });
  }

  static renderRiskExplanation() {
    const r = this.profile.riskExplanation || {};

    const badge = document.querySelector("[data-risk-current-badge]");

    if (badge) badge.innerHTML = this.riskPill(this.profile.risk);

    this.set("[data-risk-probability]", `${r.probability}%`);
    this.set("[data-risk-confidence]", r.confidence);
    this.set("[data-risk-last]", r.lastPrediction);
    this.set("[data-risk-model]", r.model);
    this.set("[data-risk-summary]", r.summary);
    this.set("[data-risk-previous]", r.previousRisk);
    this.set("[data-risk-current]", r.currentRisk);

    const changesList = document.querySelector("[data-risk-changes]");

    if (changesList) {
      changesList.innerHTML = (r.changes || [])
        .map(
          (c) => `
                <li>
                    <span class="st-change-list-label">
                        <span class="material-symbols-outlined" style="color:var(--st-risk-${c.tone === "error" ? "high" : c.tone === "moderate" ? "moderate" : "low"});">${c.icon}</span>
                        ${c.text}
                    </span>
                    <span style="font-weight:700;color:var(--st-risk-${c.tone === "error" ? "high" : c.tone === "moderate" ? "moderate" : "low"});">${c.severity}</span>
                </li>
            `,
        )
        .join("");
    }

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

    const details = document.querySelector("[data-risk-details]");

    if (details) {
      details.innerHTML = `
                <div class="st-sidebar-info-row"><span>Model</span><span>${r.model || "—"}</span></div>
                <div class="st-sidebar-info-row"><span>Confidence</span><span style="color:var(--st-secondary);">${r.confidence || "—"}</span></div>
                <div class="st-sidebar-info-row"><span>Last Updated</span><span>${r.lastPrediction || "—"}</span></div>
                <div class="st-sidebar-info-row"><span>Records Used</span><span style="text-align:right;">${r.recordsUsed || "—"}</span></div>
            `;
    }
  }

  static renderInterventions() {
    const iv = this.profile.interventions || {};

    const recs = document.querySelector("[data-intervention-recommendations]");

    if (recs) {
      recs.innerHTML = (iv.recommended || [])
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
                    <p class="st-intervention-card-factor"><strong>Factor:</strong> ${r.factor}</p>
                    <p class="st-intervention-card-text">${r.text}</p>
                    <div class="st-intervention-card-footer">
                        <span class="st-intervention-action-hint">Action: ${r.action}</span>
                        <button type="button" class="st-btn st-btn-primary st-btn-xs" data-select-intervention="${r.rank}">Select Intervention</button>
                    </div>
                </div>
            `,
        )
        .join("");

      recs.querySelectorAll("[data-select-intervention]").forEach((btn) => {
        btn.addEventListener("click", () => {
          Toast?.success(
            "Intervention selected and added to Active Interventions.",
          );
        });
      });
    }

    const active = document.querySelector("[data-active-intervention]");

    if (active && iv.active) {
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
        ?.addEventListener("click", () => {
          Toast?.info("Status update form will open here.");
        });

      active
        .querySelector("[data-add-outcome]")
        ?.addEventListener("click", () => {
          Toast?.info("Outcome logging will open here.");
        });
    }

    const history = document.querySelector("[data-intervention-history]");

    if (history) {
      history.innerHTML = (iv.history || [])
        .map(
          (h, i) => `
                <div class="st-expand-card" data-history-card>
                    <div class="st-expand-card-header" data-history-toggle>
                        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
                            <span style="font-size:12px;color:var(--st-on-surface-variant);min-width:110px;">${h.date}</span>
                            <span style="font-weight:600;font-size:13px;">${h.intervention}</span>
                            <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:${h.priority === "High" ? "var(--st-risk-high)" : "var(--st-risk-moderate)"};">${h.priority}</span>
                        </div>
                        <span class="material-symbols-outlined">expand_more</span>
                    </div>
                    <div class="st-expand-card-body">
                        <div class="st-expand-card-body-inner">
                            <p><strong>Reason:</strong> ${h.reason}</p>
                            <p><strong>Status:</strong> ${h.status}</p>
                            <p><strong>Outcome:</strong> ${h.outcome}</p>
                            <div style="display:flex;gap:8px;margin-top:8px;">
                                <button type="button" class="st-btn st-btn-outline st-btn-xs" data-history-view>View</button>
                                <button type="button" class="st-btn st-btn-outline st-btn-xs" data-history-edit>Edit</button>
                                <button type="button" class="st-btn st-btn-outline st-btn-xs" data-history-archive>Archive</button>
                            </div>
                        </div>
                    </div>
                </div>
            `,
        )
        .join("");

      history.querySelectorAll("[data-history-toggle]").forEach((header) => {
        header.addEventListener("click", () => {
          header.closest(".st-expand-card")?.classList.toggle("is-open");
        });
      });

      history.querySelectorAll("[data-history-archive]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          Toast?.success("Intervention archived.");
        });
      });
    }

    const factors = document.querySelector("[data-current-risk-factors]");

    if (factors) {
      const toneMap = {
        error: "var(--st-risk-high)",
        moderate: "var(--st-risk-moderate)",
        neutral: "#60a5fa",
      };

      factors.innerHTML = (this.profile.riskExplanation?.contributors || [])
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
        .join("");
    }
  }

  static showSkeleton() {
    const monitoringBody = document.querySelector(
      "[data-monitoring-summary-body]",
    );

    if (monitoringBody && window.Skeletons) {
      monitoringBody.innerHTML = Skeletons.tableRows(3, 4);
    }

    const timeline = document.querySelector("[data-monitoring-timeline]");

    if (timeline && window.Skeletons) {
      timeline.innerHTML = Skeletons.listItems(4);
    }
  }

  static riskPill(risk) {
    const cls =
      { High: "high", Moderate: "moderate", Low: "low" }[risk] || "low";
    return `<span class="st-risk-badge st-risk-badge--${cls}" style="padding:4px 16px;font-size:12px;"><span class="st-risk-dot"></span>${risk} Risk</span>`;
  }

  static statusBadge(type) {
    const map = {
      attendance:
        '<span class="st-risk-badge st-risk-badge--high"><span class="st-risk-dot"></span>Flagged</span>',
      module:
        '<span class="st-risk-badge st-risk-badge--moderate"><span class="st-risk-dot"></span>Late</span>',
      intervention:
        '<span class="st-risk-badge st-risk-badge--low"><span class="st-risk-dot"></span>Resolved</span>',
      note: '<span class="st-pill">Note</span>',
    };
    return map[type] || '<span class="st-pill">—</span>';
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
