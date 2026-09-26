// Chart.js is loaded via CDN in dashboard.html. These are set once at
// module load (not per-render) so every chart this page creates shares
// the same look, and the reduced-motion check gates all of them. Every
// chart instance below sets its own explicit `animation` option, so
// Chart.defaults.animation is deliberately left alone here -- Chart.js
// mutates animation config objects in place to cache a resolved easing
// function, and pointing the global default at one shared object (as an
// earlier version of this file did) corrupted that cache across chart
// instances and silently broke the tooltip's own fade-in animation.
const ST_REDUCE_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Same mapping used by the Student Registry page (student-registry.js) so a
// learner's avatar color is consistent between the two tables.
const LEVEL_AVATAR_THEMES = {
  "Basic Literacy": "",
  "Elementary": " st-avatar-initials--teal",
  "Junior High": " st-avatar-initials--blue",
  "Senior High": " st-avatar-initials--slate",
};
if (typeof Chart !== "undefined") {
  Chart.defaults.font.family = "Inter, system-ui, sans-serif";
  Chart.defaults.color = "#8a91a0";
}
const ST_CHART_STAGGER = (step) =>
  ST_REDUCE_MOTION ? {} : { delay: (ctx) => (ctx.type === "data" && ctx.mode === "default" ? ctx.dataIndex * step : 0) };
const ST_LEGEND_BOTTOM = {
  position: "bottom",
  labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, boxHeight: 8, padding: 16, color: "#5a6275" },
};
const ST_TOOLTIP = { backgroundColor: "#111a36", padding: 10, cornerRadius: 8, displayColors: true, boxPadding: 4 };
// Composition tooltip: "value (share%)" instead of Chart.js's plain "label:
// value" default -- hovering any doughnut segment, bar, or line point shows
// the same count + percentage breakdown the panel body already displays.
// For a single-series chart (doughnut, bar) the share is of that series'
// own total; for a multi-series chart (the risk trend line, one series per
// risk level) it's each series' share of that month's total instead.
function ST_COMPOSE_LABEL(ctx) {
  const datasets = ctx.chart.data.datasets;
  const raw = typeof ctx.parsed === "object" ? ctx.parsed.x ?? ctx.parsed.y : ctx.parsed;
  const value = Number(raw) || 0;
  const total =
    datasets.length > 1
      ? datasets.reduce((sum, d) => sum + (Number(d.data[ctx.dataIndex]) || 0), 0)
      : datasets[ctx.datasetIndex].data.reduce((sum, v) => sum + (Number(v) || 0), 0);
  const pct = total ? Math.round((value / total) * 100) : 0;
  const label = datasets.length > 1 ? ctx.dataset.label : ctx.label;
  return `${label}: ${value} (${pct}%)`;
}
const ST_TOOLTIP_COMPOSE = { ...ST_TOOLTIP, callbacks: { label: ST_COMPOSE_LABEL } };
// Draws the series total in the middle of a doughnut -- registered once,
// applied per-chart via `plugins: [ST_CENTER_TOTAL]`.
const ST_CENTER_TOTAL = {
  id: "centerTotal",
  afterDraw(chart) {
    if (chart.config.type !== "doughnut") return;
    const { ctx, chartArea: a } = chart;
    const sum = chart.data.datasets[0].data.reduce((x, y) => x + y, 0);
    const cx = (a.left + a.right) / 2;
    const cy = (a.top + a.bottom) / 2;
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "#111a36";
    ctx.font = "800 28px 'Libre Franklin', sans-serif";
    ctx.fillText(sum, cx, cy + 4);
    ctx.font = "500 12px Inter, sans-serif";
    ctx.fillStyle = "#8a91a0";
    ctx.fillText("learners", cx, cy + 22);
    ctx.restore();
  },
};

class TeacherDashboard {
  static state = {
    learners: [],
    filtered: [],
    page: 1,
    perPage: 5,
    search: "",
    sortKey: "risk",
    sortDir: 1,
    predicting: new Set(),
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

      this.renderInterventionReminder(data.interventionReminder);

      this.state.riskTrend = data.riskTrend || [];

      this.renderRiskChart(data.riskDistribution, data.predictionSummary);

      this.renderInterventionTip(data.interventions);

      this.state.learners = data.learners || [];
      this.renderAttentionList(this.state.learners);

      this.populateClcFilter();

      this.populateSchoolYearFilter();

      this.applyRegistry({ recomputeStats: false });

      this.renderLevelModalityCharts(this.state.filtered);

      this.setupMotionObserver();
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
      const banner = document.querySelector("[data-notif-banner]");
      if (!banner) return;
      if (ST_REDUCE_MOTION) {
        banner.remove();
        return;
      }
      banner.classList.add("is-leaving");
      banner.addEventListener("transitionend", () => banner.remove(), { once: true });
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

    document.querySelectorAll("[data-registry-sort-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.registrySortKey;
        if (this.state.sortKey === key) {
          this.state.sortDir *= -1;
        } else {
          this.state.sortKey = key;
          this.state.sortDir = 1;
        }
        this.applyRegistry({ recomputeStats: false });
      });
    });
  }

  static updateRegistrySortIndicators() {
    document.querySelectorAll("[data-registry-sort-key]").forEach((btn) => {
      const icon = btn.querySelector(".st-sort-icon");
      const isActive = btn.dataset.registrySortKey === this.state.sortKey;

      btn.classList.toggle("is-sorted", isActive);

      if (icon) {
        icon.textContent = isActive
          ? this.state.sortDir === 1
            ? "arrow_upward"
            : "arrow_downward"
          : "unfold_more";
      }
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
  static renderInterventionReminder(reminder) {
    const box = document.querySelector("[data-intervention-reminder]");
    if (box) box.innerHTML = "";

    const parts = [];
    if (reminder?.overdue) parts.push([reminder.overdue, "overdue"]);
    if (reminder?.dueToday) parts.push([reminder.dueToday, "due today"]);
    if (reminder?.dueSoon) parts.push([reminder.dueSoon, "due within 3 days"]);

    const list = document.querySelector("[data-stat-intervention-detail]");
    if (list) {
      list.innerHTML = parts.length
        ? parts.map(([count, label]) => `<li><strong class="num" data-countup>${count}</strong>${label}</li>`).join("")
        : `<li>Nothing to follow up on right now.</li>`;
      list.querySelectorAll("[data-countup]").forEach((el) => this.countTo(el, Number(el.textContent)));
    }
  }
  static renderStatistics(stats = {}) {
    const total = Number(stats.registered) || 0;
    const high = Number(stats.high) || 0;
    const moderate = Number(stats.moderate) || 0;
    const low = Number(stats.low) || 0;

    this.countTo(document.querySelector("[data-stat-total]"), total);
    this.countTo(document.querySelector("[data-stat-high]"), high);
    this.countTo(document.querySelector("[data-stat-moderate]"), moderate);
    this.countTo(document.querySelector("[data-stat-low]"), low);

    // Proportional risk strip: each segment's flex-grow equals its own
    // count, so the strip's visual split always matches the legend below
    // it exactly (a plain percentage-of-100 grow could round differently
    // per segment and drift out of sync with the displayed percentages).
    const grow = (selector, value) => {
      const el = document.querySelector(selector);
      if (el) el.style.flexGrow = String(Math.max(value, 0.0001));
    };
    grow("[data-risk-strip-high]", high);
    grow("[data-risk-strip-moderate]", moderate);
    grow("[data-risk-strip-low]", low);

    const strip = document.querySelector("[data-risk-strip]");
    if (strip) strip.setAttribute("aria-label", `${high} high, ${moderate} moderate, ${low} low risk`);

    const pct = (value) => (total > 0 ? Math.round((value / total) * 100) : 0);
    // The percentage text node sits before the nested .pct-suffix span
    // (" of learners"), so replacing just firstChild's text leaves that
    // suffix span in place instead of needing to re-append it.
    const setPct = (selector, value) => {
      const el = document.querySelector(selector);
      if (el && el.firstChild) el.firstChild.textContent = `${pct(value)}%`;
    };
    setPct("[data-stat-high-pct]", high);
    setPct("[data-stat-moderate-pct]", moderate);
    setPct("[data-stat-low-pct]", low);
  }

  static renderRiskChart(dist = {}, summary = {}) {
    const rawMax = dist.scale_max || 25;
    const max = Math.max(5, Math.ceil(rawMax / 5) * 5);
    const total = (dist.high || 0) + (dist.moderate || 0) + (dist.low || 0);

    const setBar = (level, value) => {
      const bar = document.querySelector(`[data-bar="${level}"]`);
      const valueEl = document.querySelector(`[data-bar-value="${level}"]`);
      const pctEl = document.querySelector(`[data-bar-pct="${level}"]`);
      const pct = Math.min(100, Math.round((value / max) * 100));
      const shareOfTotal = total > 0 ? Math.round((value / total) * 100) : 0;

      if (bar) {
        bar.style.setProperty("--w", `${pct}%`);
        const track = bar.closest(".st-hbar-track");
        const tipText = `${this.capitalize(level)} risk: ${value} (${shareOfTotal}%)`;
        if (track) track.setAttribute("data-tooltip", tipText);
        bar.setAttribute("title", tipText);
      }
      if (valueEl) valueEl.firstChild.textContent = String(value);
      if (pctEl) pctEl.textContent = `${shareOfTotal}%`;
    };

    setBar("high", dist.high || 0);
    setBar("moderate", dist.moderate || 0);
    setBar("low", dist.low || 0);

    const yaxis = document.querySelector("[data-riskchart-yaxis]");

    if (yaxis) {
      // Ascending (0 -> max) so the horizontal scale reads left to right
      // under the bars, unlike the old vertical chart's top-to-bottom axis.
      const steps = 5;
      yaxis.innerHTML = Array.from(
        { length: steps + 1 },
        (_, i) => `<span>${Math.round((max / steps) * i)}</span>`,
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
                    }"></span>
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
        plugins: [ST_CENTER_TOTAL],
        data: {
          labels: ["High risk", "Moderate risk", "Low risk"],
          datasets: [{ data: [high, moderate, low], backgroundColor: ["#ba1a1a", "#f39422", "#6bbf59"], borderColor: "#fff", borderWidth: 3, hoverOffset: 4 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "68%",
          animation: ST_REDUCE_MOTION ? false : { animateRotate: true, animateScale: false, duration: 1000, easing: "easeOutQuart" },
          plugins: { legend: ST_LEGEND_BOTTOM, tooltip: ST_TOOLTIP_COMPOSE },
        },
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
            { label: "High", data: trend.map((m) => m.high), borderColor: "#ba1a1a", backgroundColor: "#ba1a1a", pointRadius: 3, pointHoverRadius: 5, borderWidth: 2.5, tension: 0.35 },
            { label: "Moderate", data: trend.map((m) => m.moderate), borderColor: "#f39422", backgroundColor: "#f39422", pointRadius: 3, pointHoverRadius: 5, borderWidth: 2.5, tension: 0.35 },
            { label: "Low", data: trend.map((m) => m.low), borderColor: "#6bbf59", backgroundColor: "#6bbf59", pointRadius: 3, pointHoverRadius: 5, borderWidth: 2.5, tension: 0.35 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          animation: ST_REDUCE_MOTION ? false : { duration: 700, easing: "easeOutQuart", ...ST_CHART_STAGGER(110) },
          animations: ST_REDUCE_MOTION ? {} : { y: { from: (ctx) => (ctx.type === "data" ? ctx.chart.scales.y.getPixelForValue(0) : undefined) } },
          plugins: { legend: ST_LEGEND_BOTTOM, tooltip: ST_TOOLTIP_COMPOSE },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#eef1f5" }, border: { display: false } },
            x: { grid: { display: false }, border: { display: false } },
          },
        },
      });
    }
  }

  static renderLevelModalityCharts(rows = []) {
    const levelOrder = ["Basic Literacy", "Elementary", "Junior High", "Senior High"];
    const modalityOrder = ["Face-to-Face", "Modular", "Blended"];

    const countBy = (order, field) => order.map((key) => rows.filter((r) => r[field] === key).length);

    // Non-risk categories deliberately never reuse the risk red/orange/green
    // (--st-cat-1..4: navy, slate blue, teal, light blue) so these two
    // charts can't be misread as risk levels.
    const catColors = ["#12355b", "#4c6f95", "#006a68", "#9db5d3"];

    this.renderDistributionChart({
      key: "level",
      canvasId: "levelChartCanvas",
      noteId: "levelChartNote",
      labels: levelOrder,
      values: countBy(levelOrder, "level"),
      colors: catColors,
      noteText: "Learner count per ALS learning level for your currently filtered learners.",
    });

    this.renderDistributionChart({
      key: "modality",
      canvasId: "modalityChartCanvas",
      noteId: "modalityChartNote",
      labels: modalityOrder,
      values: countBy(modalityOrder, "modality"),
      colors: catColors.slice(0, 3),
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
      plugins: type === "doughnut" ? [ST_CENTER_TOTAL] : [],
      data: {
        labels,
        datasets: [
          type === "doughnut"
            ? { data: values, backgroundColor: colors, borderColor: "#fff", borderWidth: 3, hoverOffset: 4 }
            : { label: "Learners", data: values, backgroundColor: colors, borderRadius: 6, borderSkipped: false, barThickness: 22 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: type === "bar" ? "y" : undefined,
        animation:
          type === "doughnut"
            ? ST_REDUCE_MOTION ? false : { animateRotate: true, animateScale: false, duration: 1000, easing: "easeOutQuart" }
            : ST_REDUCE_MOTION ? false : { duration: 900, easing: "easeOutQuart", ...ST_CHART_STAGGER(90) },
        plugins: { legend: type === "doughnut" ? ST_LEGEND_BOTTOM : { display: false }, tooltip: ST_TOOLTIP_COMPOSE },
        cutout: type === "doughnut" ? "68%" : undefined,
        scales:
          type === "doughnut"
            ? {}
            : {
                x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#eef1f5" }, border: { display: false } },
                y: { grid: { display: false }, border: { display: false }, ticks: { color: "#43474e", font: { weight: "600" } } },
              },
      },
    });
  }

  static renderAttentionList(learners = []) {
    const root = document.querySelector("[data-dashboard-attention-list]");
    if (!root) return;

    const priority = { High: 0, Moderate: 1 };
    const rows = learners
      .filter((learner) => learner.risk === "High" || learner.risk === "Moderate")
      .sort((a, b) => {
        const byLevel = (priority[a.risk] ?? 9) - (priority[b.risk] ?? 9);
        if (byLevel) return byLevel;
        return Number(b.risk_probability || 0) - Number(a.risk_probability || 0);
      })
      .slice(0, 4);

    if (!rows.length) {
      root.innerHTML = `<p class="st-attention-empty">No High or Moderate risk learners right now.</p>`;
      return;
    }

    const esc = (value) => String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

    root.innerHTML = rows.map((learner) => {
      const pct = Math.round(Number(learner.risk_probability || 0) * 100);
      const initials = String(learner.name || "?")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "?";
      const isModerate = learner.risk === "Moderate";
      return `
        <button type="button" class="st-attention-row${isModerate ? " is-moderate" : ""}" data-attention-learner="${learner.id}">
          <span class="st-attention-avatar">${initials}</span>
          <span class="st-attention-person">
            <strong>${esc(learner.name || "Learner")}</strong>
            <small>${esc(learner.lrn || "No LRN")}</small>
          </span>
          <span class="st-attention-risk" title="Predicted dropout probability">${pct}% risk<span class="meter"><i style="--w:${pct}%"></i></span></span>
        </button>
      `;
    }).join("");

    root.querySelectorAll("[data-attention-learner]").forEach((button) => {
      button.addEventListener("click", () => {
        window.location.href = `learner-profile.html?id=${encodeURIComponent(button.dataset.attentionLearner)}`;
      });
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

    if (this.state.sortKey) {
      const key = this.state.sortKey;
      const riskOrder = { High: 0, Moderate: 1, Low: 2 };

      rows.sort((a, b) => {
        let va = a[key];
        let vb = b[key];

        if (key === "risk") {
          va = riskOrder[va] ?? 3;
          vb = riskOrder[vb] ?? 3;
        }

        if (va < vb) return -1 * this.state.sortDir;
        if (va > vb) return 1 * this.state.sortDir;
        return 0;
      });
    }

    this.state.filtered = rows;

    this.updateRegistrySortIndicators();

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
                    <td colspan="6" class="st-registry-loading">
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

      body.querySelectorAll("[data-registry-run-prediction]").forEach((btn) => {
        btn.addEventListener("click", () =>
          this.runRegistryPrediction(btn.dataset.registryRunPrediction),
        );
      });

      body.querySelectorAll("[data-registry-archive]").forEach((btn) => {
        btn.addEventListener("click", () =>
          this.archiveRegistryLearner(btn.dataset.registryArchive),
        );
      });
    }

    // Reveals each row's risk probability meter (width transition gated on
    // [data-animate-rows].is-inview, see dashboard.css) -- this table isn't
    // watched by the page's scroll IntersectionObserver, so trigger it
    // directly on render instead, same as Student Registry/Early Warning.
    body.classList.remove("is-inview");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => body.classList.add("is-inview")),
    );

    this.renderPagination();
  }

  static registryRow(l, index) {
    const initialsTheme = LEVEL_AVATAR_THEMES[l.level] || "";

    const initials = (l.name || "?")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    const isArchived = l.status === "Archived";

    return `
            <tr tabindex="0">
                <td data-col="learner">
                    <div class="st-learner-cell">
                        <button type="button" class="st-avatar-initials st-avatar-initials${initialsTheme} st-avatar-btn"
                            data-view-learner="${l.id}" aria-label="View ${l.name}'s profile">${initials}</button>
                        <div>
                            <button type="button" class="st-learner-name st-learner-name-link" data-view-learner="${l.id}">${l.name}</button>
                            <p class="st-learner-id">LRN ${l.lrn}</p>
                        </div>
                    </div>
                </td>
                <td data-col="level">${l.level}</td>
                <td data-col="modality">${this.modalityPill(l.modality)}</td>
                <td data-col="risk">${this.riskCell(l)}</td>
                <td data-col="activity" class="st-activity">${l.activity_text || "\u2014"}</td>
                <td class="is-right" data-col="actions">
                    <div class="st-row-actions">
                        <button class="st-btn st-btn-outline st-btn-xs"
                            data-view-learner="${l.id}">View profile</button>
                        <div class="st-row-menu" data-row-menu>
                            <button type="button" class="st-row-menu-trigger" data-row-menu-trigger aria-label="More actions">
                                <span class="material-symbols-outlined">more_vert</span>
                            </button>
                            <div class="st-row-menu-list">
                                <button type="button" data-registry-run-prediction="${l.id}"
                                    ${this.state.predicting.has(String(l.id)) ? "disabled" : ""}>
                                    <span class="material-symbols-outlined">${this.state.predicting.has(String(l.id)) ? "progress_activity" : "bolt"}</span>
                                    Run prediction
                                </button>
                                <button type="button" data-registry-archive="${l.id}">
                                    <span class="material-symbols-outlined">${isArchived ? "unarchive" : "archive"}</span>
                                    ${isArchived ? "Restore" : "Archive"}
                                </button>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
  }

  // Same manual trigger as Student Registry's row menu -- updates the row
  // in place from the response instead of a full reload.
  static async runRegistryPrediction(id) {
    const key = String(id);
    if (this.state.predicting.has(key)) return;

    this.state.predicting.add(key);
    this.renderRegistryPage();

    try {
      const result = await API.runPrediction(id);
      const l = this.state.learners.find((x) => String(x.id) === key);
      if (l) {
        l.risk =
          result.risk_level.charAt(0) + result.risk_level.slice(1).toLowerCase();
        l.risk_probability = result.risk_probability;
      }
      Toast?.success(
        `Prediction updated: ${result.risk_level} risk (${Math.round(result.risk_probability * 100)}%).`,
      );
    } catch (error) {
      console.error("[TeacherDashboard] runRegistryPrediction", error);
      Toast?.error(error?.message || "Unable to run a prediction for this learner.");
    } finally {
      this.state.predicting.delete(key);
      this.applyRegistry({ recomputeStats: false });
    }
  }

  static async archiveRegistryLearner(id) {
    const l = this.state.learners.find((x) => String(x.id) === String(id));

    if (!l) return;

    const archiving = l.status !== "Archived";

    try {
      await API.updateLearner(id, {
        status: archiving ? "Archived" : "Active",
      });

      l.status = archiving ? "Archived" : "Active";

      this.applyRegistry({ recomputeStats: false });

      Toast?.success(archiving ? "Learner archived." : "Learner restored.");
    } catch (error) {
      console.error(error);
      Toast?.error("Unable to update learner status.");
    }
  }

  // Badge + probability meter, matching Student Registry/Early Warning's
  // risk cell. Falls back to the plain badge for learners not yet assessed.
  static riskCell(l) {
    const cls = { High: "high", Moderate: "moderate", Low: "low" }[l.risk];
    if (!cls) {
      return `<div class="st-risk-cell"><div class="st-risk-cell-top">${this.riskBadge(l.risk)}</div></div>`;
    }
    const pct = Math.round(Math.min(1, Math.max(0, l.risk_probability ?? 0)) * 100);
    return `
            <div class="st-risk-cell st-risk-cell--${cls}" title="Predicted dropout probability">
                <div class="st-risk-cell-top">${this.riskBadge(l.risk)}<span class="st-risk-pct num">${pct}%</span></div>
                <div class="st-risk-meter"><i style="--w:${pct}%"></i></div>
            </div>
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
    const cls = { "Face-to-Face": " st-modality-pill--f2f", Modular: " st-modality-pill--modular", Blended: " st-modality-pill--blended" }[modality] || "";
    return `<span class="st-pill st-modality-pill${cls}">${modality || "\u2014"}</span>`;
  }

  static setText(selector, value) {
    const el = document.querySelector(selector);
    if (el && value !== undefined && value !== null) {
      el.textContent = value;
    }
  }

  // Counts a [data-countup] element up from 0 to `value` over ~800ms
  // (ease-out-cubic), remembering the target on the element itself
  // (dataset.final) so the motion observer's "replay on scroll back into
  // view" can re-trigger the same count-up without needing the value
  // passed in again. Writes the value immediately if it isn't a finite
  // number (e.g. "--") or motion is reduced.
  static countTo(el, value) {
    if (!el) return;
    const end = Number(value ?? el.dataset.final ?? el.textContent);
    el.dataset.final = Number.isFinite(end) ? end : (value ?? "");
    if (ST_REDUCE_MOTION || !Number.isFinite(end)) {
      el.textContent = value ?? el.dataset.final;
      return;
    }
    const t0 = performance.now();
    const dur = 800;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(end * eased);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // One IntersectionObserver for every [data-animate] panel: fills bars,
  // strips and meters in via CSS (.is-inview, see dashboard.css), counts
  // up their numbers, and replays their Chart.js charts -- again each
  // time the panel comes back into view (scroll away, then scroll back).
  static setupMotionObserver() {
    if (this._motionObserver) return;
    const panels = document.querySelectorAll("[data-animate]");
    if (!panels.length) return;

    this._motionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, isIntersecting, intersectionRatio }) => {
          if (isIntersecting && intersectionRatio >= 0.3 && !target.classList.contains("is-inview")) {
            target.classList.add("is-inview");
            target.querySelectorAll("[data-countup]").forEach((el) => this.countTo(el));
            if (!ST_REDUCE_MOTION) {
              target.querySelectorAll("canvas").forEach((canvas) => {
                const chart = typeof Chart !== "undefined" && Chart.getChart(canvas);
                if (chart) {
                  chart.reset();
                  chart.update();
                }
              });
            }
          } else if (!isIntersecting) {
            target.classList.remove("is-inview");
          }
        });
      },
      { threshold: [0, 0.3] },
    );

    panels.forEach((panel) => this._motionObserver.observe(panel));
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
      body.innerHTML = Skeletons.tableRows(5, 6);
    }
  }
}

// Row menu (Run prediction / Archive) open/close + fixed positioning, same
// pattern as Learner Records/Student Registry's row menu. data-view-learner
// is handled by its own per-row binding in renderRegistryPage(), not here.
function closeOpenDashboardRowMenus() {
  document.querySelectorAll(".st-row-menu.is-open").forEach((menu) => {
    menu.classList.remove("is-open");
  });
}

document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-row-menu-trigger]");

  document.querySelectorAll(".st-row-menu.is-open").forEach((menu) => {
    if (!trigger || menu !== trigger.closest(".st-row-menu")) {
      menu.classList.remove("is-open");
    }
  });

  if (trigger) {
    const menu = trigger.closest(".st-row-menu");
    const opening = !menu?.classList.contains("is-open");

    menu?.classList.toggle("is-open");

    if (opening && menu) {
      const list = menu.querySelector(".st-row-menu-list");
      const rect = trigger.getBoundingClientRect();

      if (list) {
        list.style.top = `${rect.bottom + 4}px`;
        list.style.right = `${window.innerWidth - rect.right}px`;
      }
    }
  }
});

window.addEventListener("scroll", closeOpenDashboardRowMenus, true);

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
