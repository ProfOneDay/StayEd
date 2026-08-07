class TeacherDashboard {
  static state = {
    learners: [],
    filtered: [],
    page: 1,
    perPage: 5,
    search: "",
    sortByRisk: true,
    filtersApplied: false,
  };

  static async init() {
    if (window.Guards) Guards.teacher();

    this.bindStaticUI();

    if (window.Layout) Layout.showLoader();

    this.showSkeleton();

    try {
      const data = await API.getDashboard();

      this.state.context = data.context || {};

      this.renderWelcome(data.context);

      this.renderStatistics(data.statistics);

      this.renderRiskChart(data.riskDistribution, data.predictionSummary);

      this.renderInterventionTip(data.interventions);

      this.state.learners = data.learners || [];

      this.applyRegistry({ recomputeStats: false });
    } catch (error) {
      console.error("[Dashboard]", error);

      if (window.Toast) {
        Toast.error(error.message || "Unable to load dashboard.");
      }
    } finally {
      if (window.Layout) Layout.hideLoader();
    }
  }

  static bindStaticUI() {
    const dismiss = document.querySelector("[data-notif-dismiss]");

    dismiss?.addEventListener("click", () => {
      document.querySelector("[data-notif-banner]")?.remove();
    });

    const seg = document.querySelector("[data-filter-level]");

    seg?.addEventListener("click", (event) => {
      const btn = event.target.closest("button");

      if (!btn) return;

      seg
        .querySelectorAll("button")
        .forEach((b) => b.classList.remove("is-active"));

      btn.classList.add("is-active");
    });

    document
      .querySelector("[data-filter-apply]")
      ?.addEventListener("click", () => {
        if (window.Toast) {
          Toast.success("Filters applied.");
        }
        this.state.filtersApplied = true;
        this.state.page = 1;
        this.applyRegistry({ recomputeStats: true });
      });

    document
      .querySelector("[data-registry-search]")
      ?.addEventListener("input", (event) => {
        this.state.search = event.target.value.toLowerCase();
        this.state.page = 1;
        this.applyRegistry({ recomputeStats: false });
      });

    document
      .querySelector("[data-registry-sort]")
      ?.addEventListener("click", () => {
        this.state.sortByRisk = !this.state.sortByRisk;
        this.applyRegistry({ recomputeStats: false });
      });
  }

  static renderWelcome(context = {}) {
    const greeting = this.timeGreeting();

    this.setText(
      "[data-dash-greeting]",
      `${greeting}, ${context.greeting_name || "Teacher"}!`,
    );

    this.setText("[data-dash-school-year]", context.school_year);

    this.setText("[data-dash-trimester]", context.trimester);
  }

  static renderStatistics(stats = {}) {
    this.setText("[data-stat-total]", stats.registered);

    this.setText(
      "[data-stat-total-meta]",
      this.state.context?.selected_class || "Current class",
    );

    this.setText("[data-stat-high]", stats.high);

    this.setText(
      "[data-stat-high-meta]",
      stats.high_delta
        ? `\u2191 ${stats.high_delta} since last prediction`
        : "Stable",
    );

    this.setText("[data-stat-moderate]", stats.moderate);
    this.setText("[data-stat-moderate-meta]", stats.moderate_trend || "Stable");

    this.setText("[data-stat-low]", stats.low);
    this.setText(
      "[data-stat-low-meta]",
      stats.low_trend || "Includes learners awaiting prediction",
    );
  }

  static renderRiskChart(dist = {}, summary = {}) {
    const rawMax = dist.scale_max || 25;
    const max = Math.max(5, Math.ceil(rawMax / 5) * 5);

    const setBar = (level, value) => {
      const bar = document.querySelector(`[data-bar="${level}"]`);

      if (!bar) return;

      const pct = Math.min(100, Math.round((value / max) * 100));

      requestAnimationFrame(() => {
        bar.style.height = `${pct}%`;
      });

      bar.setAttribute("title", `${this.capitalize(level)} Risk: ${value}`);
    };

    setBar("high", dist.high || 0);
    setBar("moderate", dist.moderate || 0);
    setBar("low", dist.low || 0);

    const yaxis = document.querySelector("[data-riskchart-yaxis]");

    if (yaxis) {
      const steps = 5;
      yaxis.innerHTML = Array.from(
        { length: steps + 1 },
        (_, i) => `<span>${Math.round((max / steps) * (steps - i))}</span>`,
      ).join("");
    }

    this.setText("[data-risk-coverage]", summary.coverage);
    this.setText("[data-risk-model]", summary.model);
    this.setText("[data-risk-confidence]", summary.confidence);

    const list = document.querySelector("[data-risk-insights]");

    if (list && Array.isArray(summary.insights)) {
      list.innerHTML = summary.insights
        .map(
          (item) => `
                <li>
                    <span class="st-bullet ${
                      item.tone === "error" ? "st-bullet--error" : ""
                    }">&bull;</span>
                    ${item.text}
                </li>
            `,
        )
        .join("");
    }
  }

  static renderInterventionTip(interventions = []) {
    const pending = interventions.filter((i) => !["Resolved", "Completed", "Cancelled"].includes(i.status)).length;

    const el = document.querySelector("[data-quick-intervention-count]");

    if (el) {
      el.textContent = `${pending} learner${pending === 1 ? "" : "s"}`;
    }
  }

  static applyRegistry({ recomputeStats = false } = {}) {
    let rows = [...this.state.learners];

    if (this.state.filtersApplied) {
      const activeLevel = document.querySelector(
        "[data-filter-level] button.is-active",
      );

      if (activeLevel && activeLevel.dataset.level) {
        rows = rows.filter((l) => l.level === activeLevel.dataset.level);
      }

      const modality = document.querySelector("[data-filter-modality]")?.value;

      if (modality && modality !== "All Modalities") {
        rows = rows.filter((l) => l.modality === modality);
      }

      const clc = document.querySelector("[data-filter-clc]")?.value;

      if (clc && clc !== "All CLCs" && rows.some((l) => l.clc)) {
        rows = rows.filter((l) => l.clc === clc);
      }
    }

    if (this.state.search) {
      rows = rows.filter(
        (l) =>
          (l.name || "").toLowerCase().includes(this.state.search) ||
          (l.lrn || "").toLowerCase().includes(this.state.search),
      );
    }

    if (this.state.sortByRisk) {
      const order = { High: 0, Moderate: 1, Low: 2 };
      rows.sort((a, b) => (order[a.risk] ?? 3) - (order[b.risk] ?? 3));
    }

    this.state.filtered = rows;

    this.renderRegistryPage();

    if (recomputeStats) {
      this.renderStatisticsFromRows(rows);

      this.renderRiskChartFromRows(rows);
    }
  }

  static renderStatisticsFromRows(rows) {
    const count = (risk) => rows.filter((l) => l.risk === risk).length;

    this.renderStatistics({
      registered: rows.length,
      high: count("High"),
      moderate: count("Moderate"),
      low: count("Low") + count("Not Yet Assessed"),
    });
  }

  static renderRiskChartFromRows(rows) {
    const count = (risk) => rows.filter((l) => l.risk === risk).length;

    const high = count("High");
    const moderate = count("Moderate");
    const low = count("Low") + count("Not Yet Assessed");

    const scaleMax = Math.max(25, high, moderate, low) + 5;

    const insights = [];

    if (!rows.length) {
      insights.push({
        text: "No learners match the current filters.",
        tone: "neutral",
      });
    } else if (low >= rows.length / 2) {
      insights.push({
        text: "Most learners in this view are currently classified as Low Risk.",
        tone: "neutral",
      });
    } else {
      insights.push({
        text: "A significant share of learners in this view are at Moderate or High Risk.",
        tone: "error",
      });
    }

    this.renderRiskChart(
      { scale_max: scaleMax, high, moderate, low },
      {
        coverage: `${rows.length} learner${rows.length === 1 ? "" : "s"} in current view`,
        insights,
      },
    );
  }

  static renderRegistryPage() {
    const body = document.querySelector("[data-registry-body]");

    if (!body) return;

    const { filtered, page, perPage } = this.state;

    const start = (page - 1) * perPage;

    const pageRows = filtered.slice(start, start + perPage);

    if (!pageRows.length) {
      body.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center;padding:32px;color:var(--st-outline);font-style:italic;">
                        No learners match your search.
                    </td>
                </tr>
            `;
    } else {
      body.innerHTML = pageRows
        .map((l, i) => this.registryRow(l, start + i))
        .join("");

      body.querySelectorAll("[data-view-learner]").forEach((el) => {
        el.addEventListener("click", () => {
          window.location.href = `learner-profile.html?id=${encodeURIComponent(el.dataset.viewLearner)}`;
        });
      });
    }

    this.renderPagination();
  }

  static registryRow(l, index) {
    const initialsTheme = ["", "--teal", "--blue"][index % 3];

    const initials = (l.name || "?")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    return `
            <tr tabindex="0">
                <td>
                    <button type="button" class="st-avatar-initials st-avatar-initials${initialsTheme} st-avatar-btn"
                        data-view-learner="${l.id}" aria-label="View ${l.name}'s profile">${initials}</button>
                </td>
                <td>
                    <button type="button" class="st-learner-name st-learner-name-link" data-view-learner="${l.id}">${l.name}</button>
                    <p class="st-learner-id">ID: ${l.lrn}</p>
                </td>
                <td>${l.level}</td>
                <td>${this.modalityPill(l.modality)}</td>
                <td>${this.riskBadge(l.risk)}</td>
                <td style="font-size:12px;">${l.activity_text || "\u2014"}</td>
                <td>
                    <div class="st-row-actions">
                        <button class="st-btn st-btn-primary st-btn-xs"
                            data-view-learner="${l.id}">View Profile</button>
                        <button class="st-icon-btn-sm" aria-label="More options">
                            <span class="material-symbols-outlined">more_vert</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
  }

  static renderPagination() {
    const { filtered, page, perPage } = this.state;

    const total = filtered.length;

    const pages = Math.max(1, Math.ceil(total / perPage));

    const start = total ? (page - 1) * perPage + 1 : 0;

    const end = Math.min(page * perPage, total);

    this.setText(
      "[data-registry-info]",
      `Showing ${start}\u2013${end} of ${total} learners`,
    );

    const container = document.querySelector("[data-registry-pages]");

    if (!container) return;

    let html = `
            <button class="st-page-btn" ${page === 1 ? "disabled" : ""} data-page-prev>
                <span class="material-symbols-outlined" style="font-size:16px;">chevron_left</span>
            </button>
        `;

    for (let p = 1; p <= pages; p++) {
      html += `
                <button class="st-page-btn ${p === page ? "is-active" : ""}"
                    data-page-go="${p}">${p}</button>
            `;
    }

    html += `
            <button class="st-page-btn" ${page === pages ? "disabled" : ""} data-page-next>
                <span class="material-symbols-outlined" style="font-size:16px;">chevron_right</span>
            </button>
        `;

    container.innerHTML = html;

    container
      .querySelector("[data-page-prev]")
      ?.addEventListener("click", () => {
        if (this.state.page > 1) {
          this.state.page--;
          this.renderRegistryPage();
        }
      });

    container
      .querySelector("[data-page-next]")
      ?.addEventListener("click", () => {
        if (this.state.page < pages) {
          this.state.page++;
          this.renderRegistryPage();
        }
      });

    container.querySelectorAll("[data-page-go]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.state.page = Number(btn.dataset.pageGo);
        this.renderRegistryPage();
      });
    });
  }

  static riskBadge(risk) {
    const map = {
      High: "high",
      Moderate: "moderate",
      Low: "low",
    };

    const cls = map[risk] || "neutral";

    return `
            <span class="st-risk-badge st-risk-badge--${cls}">
                <span class="st-risk-dot"></span>${risk || "Not Yet Assessed"}
            </span>
        `;
  }

  static modalityPill(modality) {
    const teal = modality === "Modular" ? " st-pill--teal" : "";

    return `<span class="st-pill${teal}">${modality || "\u2014"}</span>`;
  }

  static setText(selector, value) {
    const el = document.querySelector(selector);
    if (el && value !== undefined && value !== null) {
      el.textContent = value;
    }
  }

  static timeGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 18) return "Good Afternoon";
    return "Good Evening";
  }

  static capitalize(s) {
    return s ? s[0].toUpperCase() + s.slice(1) : s;
  }

  static showSkeleton() {
    const body = document.querySelector("[data-registry-body]");

    if (body && window.Skeletons) {
      body.innerHTML = Skeletons.tableRows(5, 7);
    }
  }
}

(function bootDashboard() {
  let started = false;

  const start = () => {
    if (started) return;
    started = true;
    TeacherDashboard.init();
  };

  document.addEventListener("components:loaded", start);

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(start, 600);
  });
})();

window.TeacherDashboard = TeacherDashboard;
