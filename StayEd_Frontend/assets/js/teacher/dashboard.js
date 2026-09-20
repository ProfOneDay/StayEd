class TeacherDashboard {
  static state = {
    learners: [],
    filtered: [],
    page: 1,
    perPage: 5,
    search: "",
    sortByRisk: true,
    filtersApplied: false,
    riskTrend: [],
    currentRiskCounts: { high: 0, moderate: 0, low: 0 },
  };

  static chartType = { risk: "bar", level: "bar", modality: "pie" };
  static chartInstances = { risk: null, level: null, modality: null };

  static async init() {
    if (window.Guards) Guards.teacher();

    this.bindStaticUI();
    this.bindChartToggles();

    if (window.Layout) Layout.showLoader();

    this.showSkeleton();

    try {
      const data = await API.getDashboard();

      this.state.context = data.context || {};

      this.renderWelcome(data.context);

      this.renderStatistics(data.statistics);

      this.state.riskTrend = data.riskTrend || [];

      this.renderRiskChart(data.riskDistribution, data.predictionSummary);

      this.renderInterventionTip(data.interventions);

      this.state.learners = data.learners || [];

      this.populateClcFilter();

      this.populateSchoolYearFilter();

      this.applyRegistry({ recomputeStats: false });

      this.renderLevelModalityCharts(this.state.filtered);
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

  static async populateClcFilter() {
    const select = document.querySelector("[data-filter-clc]");

    if (!select) return;

    try {
      // Use the same teacher-scoped CLC population as CLC Overview so the
      // dashboard filter cannot include another teacher's centers/learners.
      const response = await API.getTeacherClcs();
      const clcs = response.data || [];

      const current = select.value;

      select.replaceChildren();

      const allOption = document.createElement("option");
      allOption.textContent = "All CLCs";
      select.appendChild(allOption);

      clcs
        .map((c) => c.name)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .forEach((name) => {
          const option = document.createElement("option");
          option.textContent = name;
          select.appendChild(option);
        });

      const names = Array.from(select.options).map((o) => o.value);
      select.value = names.includes(current) ? current : "All CLCs";
    } catch (error) {
      console.error("[Dashboard] Unable to load assigned CLCs", error);
    }
  }

  static populateSchoolYearFilter() {
    const select = document.querySelector("[data-filter-school-year]");

    if (!select) return;

    const current = select.value;

    const years = [
      ...new Set(this.state.learners.map((l) => l.school_year).filter(Boolean)),
    ].sort((a, b) => b.localeCompare(a));

    select.replaceChildren();

    const allOption = document.createElement("option");
    allOption.textContent = "All School Years";
    select.appendChild(allOption);

    years.forEach((year) => {
      const option = document.createElement("option");
      option.textContent = year;
      select.appendChild(option);
    });

    const values = Array.from(select.options).map((o) => o.value);
    select.value = values.includes(current) ? current : "All School Years";
  }

  static renderStatistics(stats = {}) {
    this.setText("[data-stat-total]", stats.registered);
    this.setText("[data-stat-high]", stats.high);
    this.setText("[data-stat-moderate]", stats.moderate);
    this.setText("[data-stat-low]", stats.low);
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

    this.state.currentRiskCounts = { high: dist.high || 0, moderate: dist.moderate || 0, low: dist.low || 0 };
    this.renderRiskChartTypeView();
  }

  // ---------------------------------------------------------------------------
  // Chart-type toggles (Bar/Pie/Trend for Risk Distribution; Bar/Pie for the
  // Learning Level and Modality distribution panels). Chart.js is loaded via
  // CDN in dashboard.html; renderRiskChart()'s existing custom CSS bars stay
  // the default "Bar" view so nothing already working changes visually.
  // ---------------------------------------------------------------------------

  static bindChartToggles() {
    const bind = (toggleId, key, onChange) => {
      document.querySelectorAll(`#${toggleId} .chart-type-btn`).forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(`#${toggleId} .chart-type-btn`).forEach((b) => b.classList.toggle("is-active", b === btn));
          this.chartType[key] = btn.dataset.chartType;
          onChange();
        });
      });
    };
    bind("riskChartToggle", "risk", () => this.renderRiskChartTypeView());
    bind("levelChartToggle", "level", () => this.renderLevelModalityCharts(this.state.filtered));
    bind("modalityChartToggle", "modality", () => this.renderLevelModalityCharts(this.state.filtered));
  }

  static chartJsReady(note) {
    if (typeof Chart !== "undefined") return true;
    if (note) note.textContent = "Chart library failed to load -- check your connection and reload the page.";
    return false;
  }

  static renderRiskChartTypeView() {
    const barView = document.getElementById("riskBarView");
    const chartView = document.getElementById("riskChartView");
    if (!barView || !chartView) return;

    if (this.chartType.risk === "bar") {
      barView.hidden = false;
      chartView.hidden = true;
      this.chartInstances.risk?.destroy();
      this.chartInstances.risk = null;
      return;
    }

    barView.hidden = true;
    chartView.hidden = false;
    const note = document.getElementById("riskChartNote");
    const canvas = document.getElementById("riskChartCanvas");
    this.chartInstances.risk?.destroy();
    this.chartInstances.risk = null;
    if (!canvas || !this.chartJsReady(note)) return;

    const { high, moderate, low } = this.state.currentRiskCounts;

    if (this.chartType.risk === "pie") {
      note.textContent = "Current risk distribution for your filtered learners.";
      this.chartInstances.risk = new Chart(canvas.getContext("2d"), {
        type: "doughnut",
        data: {
          labels: ["High Risk", "Moderate Risk", "Low Risk"],
          datasets: [{ data: [high, moderate, low], backgroundColor: ["#ba1a1a", "#f39422", "#6bbf59"], borderColor: "#fff", borderWidth: 2 }],
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom" }, tooltip: { enabled: true } } },
      });
      return;
    }

    if (this.chartType.risk === "line") {
      const trend = this.state.riskTrend;
      if (!trend.length) {
        note.textContent = "No prediction runs recorded in the last 6 months yet.";
        return;
      }
      note.textContent = "Monthly trend of your learners' assessed risk levels (last 6 months).";
      this.chartInstances.risk = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
          labels: trend.map((m) => m.month),
          datasets: [
            { label: "High", data: trend.map((m) => m.high), borderColor: "#ba1a1a", backgroundColor: "#ba1a1a22", tension: 0.3 },
            { label: "Moderate", data: trend.map((m) => m.moderate), borderColor: "#f39422", backgroundColor: "#f3942222", tension: 0.3 },
            { label: "Low", data: trend.map((m) => m.low), borderColor: "#6bbf59", backgroundColor: "#6bbf5922", tension: 0.3 },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
      });
    }
  }

  static renderLevelModalityCharts(rows = []) {
    const levelOrder = ["Basic Literacy", "Elementary", "Junior High", "Senior High"];
    const modalityOrder = ["Face-to-Face", "Modular", "Blended"];

    const countBy = (order, field) => order.map((key) => rows.filter((r) => r[field] === key).length);

    this.renderDistributionChart({
      key: "level",
      canvasId: "levelChartCanvas",
      noteId: "levelChartNote",
      labels: levelOrder,
      values: countBy(levelOrder, "level"),
      colors: ["#3B7DDD", "#6bbf59", "#f39422", "#8E5BD6"],
      noteText: "Learner count per ALS learning level for your currently filtered learners.",
    });

    this.renderDistributionChart({
      key: "modality",
      canvasId: "modalityChartCanvas",
      noteId: "modalityChartNote",
      labels: modalityOrder,
      values: countBy(modalityOrder, "modality"),
      colors: ["#3B7DDD", "#f39422", "#8E5BD6"],
      noteText: "Learner count per learning delivery mode for your currently filtered learners.",
    });
  }

  // Shared renderer for the Learning Level / Modality panels -- both only
  // ever toggle between Bar and Doughnut (no custom CSS bar view to preserve like
  // Risk Distribution has), so a single Chart.js bar/pie is swapped in place.
  static renderDistributionChart({ key, canvasId, noteId, labels, values, colors, noteText }) {
    const note = document.getElementById(noteId);
    const canvas = document.getElementById(canvasId);
    this.chartInstances[key]?.destroy();
    this.chartInstances[key] = null;
    if (!canvas || !this.chartJsReady(note)) return;

    note.textContent = noteText;
    const type = this.chartType[key] === "pie" ? "doughnut" : "bar";
    this.chartInstances[key] = new Chart(canvas.getContext("2d"), {
      type,
      data: {
        labels,
        datasets: [
          type === "pie"
            ? { data: values, backgroundColor: colors, borderColor: "#fff", borderWidth: 2 }
            : { label: "Learners", data: values, backgroundColor: colors },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", display: type === "doughnut" }, tooltip: { enabled: true } },
        cutout: type === "doughnut" ? "62%" : undefined,
        scales: type === "doughnut" ? {} : { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
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

      if (activeLevel && activeLevel.dataset.level && activeLevel.dataset.level !== "All") {
        rows = rows.filter((l) => l.level === activeLevel.dataset.level);
      }

      const modality = document.querySelector("[data-filter-modality]")?.value;

      if (modality && modality !== "All Modalities") {
        rows = rows.filter((l) => l.modality === modality);
      }

      const clc = document.querySelector("[data-filter-clc]")?.value;

      if (clc && clc !== "All CLCs") {
        rows = rows.filter((l) => l.clc === clc);
      }

      const schoolYear = document.querySelector(
        "[data-filter-school-year]",
      )?.value;

      if (schoolYear && schoolYear !== "All School Years") {
        rows = rows.filter((l) => l.school_year === schoolYear);
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

      this.renderLevelModalityCharts(rows);
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
    const notYetAssessed = count("Not Yet Assessed");

    // "Not Yet Assessed" learners are counted under Low for this KPI/chart.
    const low = count("Low") + notYetAssessed;

    const registered = rows.length;
    const predicted = registered - notYetAssessed;
    const coverage = registered > 0 ? Math.round((predicted / registered) * 100) : 0;

    // Scale the Y-axis to the largest visible category so bars don't
    // render as tiny slivers (e.g. High=0, Moderate=3, Low=9 -> max 10).
    const largestCategory = Math.max(high, moderate, low, 1);
    const scaleMax = Math.max(5, Math.ceil(largestCategory / 5) * 5);

    const insights = [
      {
        tone: high ? "error" : "primary",
        text: `${high} learner(s) are currently classified as High Risk`,
      },
      {
        tone: "primary",
        text: `Prediction coverage is ${coverage}% of active learners`,
      },
    ];

    if (!registered) {
      insights.push({
        text: "No learners match the current filters.",
        tone: "neutral",
      });
    }

    this.renderRiskChart(
      { scale_max: scaleMax, high, moderate, low },
      {
        coverage: `${coverage}%`,
        confidence: predicted > 0 ? "Available" : "Pending",
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
                <td style="font-size:0.75rem;">${l.activity_text || "\u2014"}</td>
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
                <span class="material-symbols-outlined" style="font-size:1rem;">chevron_left</span>
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
                <span class="material-symbols-outlined" style="font-size:1rem;">chevron_right</span>
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
