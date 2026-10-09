class StudentPortal {
  static REDUCE_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;

  static async init() {
    const token = new URLSearchParams(window.location.search).get("token");

    if (!token) {
      this.renderUnavailable();
      return;
    }

    try {
      const res = await fetch(
        `${CONFIG.API_URL}/public/student-view/${encodeURIComponent(token)}`,
      );

      if (!res.ok) {
        this.renderUnavailable();
        return;
      }

      const data = await res.json();

      this.render(data);
    } catch (error) {
      console.error("[StudentPortal] Unable to load view", error);

      this.renderUnavailable();
    }
  }

  static renderUnavailable() {
    const body = document.querySelector("[data-student-body]");
    if (!body) return;

    body.innerHTML = `
      <div class="st-sv-card st-sv-unavailable">
        <span class="material-symbols-outlined">link_off</span>
        <h2 class="st-sv-title">This link isn't available</h2>
        <p class="st-sv-sub">This link isn't available. Ask your teacher for an updated link.</p>
        <a class="st-btn st-btn-primary" href="access.html">
          <span class="material-symbols-outlined">search</span>
          Look up my report with my LRN
        </a>
      </div>
    `;
  }

  static render(data) {
    const body = document.querySelector("[data-student-body]");
    if (!body) return;

    const batches = data.batches || [];

    body.innerHTML = `
      ${this.renderHero(data.profile || {}, data.risk)}
      <div class="st-sv-grid">
        <div class="st-sv-left">
          ${this.renderRiskCard(data.risk)}
          ${this.renderCounts(batches)}
        </div>
        ${this.renderPerformanceProgress(data.performanceProgress || [])}
      </div>
      ${this.renderModulesSection(batches)}
    `;

    // Cards settle in once on load; the chart's own line/area/dot reveal is
    // gated on the same .is-inview class (always-above-fold content here,
    // same pattern as the other "fires on render" entrance flows in the
    // app -- no IntersectionObserver needed).
    body.setAttribute("data-sv-animate", "");
    const start = () => {
      body.classList.add("is-inview");
      body.querySelectorAll("[data-sv-chart]").forEach((el) => el.classList.add("is-inview"));
    };
    if (this.REDUCE_MOTION) {
      start();
    } else {
      requestAnimationFrame(() => requestAnimationFrame(start));
    }
  }

  static initialsOf(name) {
    return String(name || "?")
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  static renderHero(profile, risk) {
    const ringByLevel = {
      High: "#f6c9c6",
      Moderate: "#f8d9ac",
      Low: "#c9e6c1",
      Preliminary: "#bcdcf3",
    };
    const ring = ringByLevel[risk && risk.label] || "#dfe3ea";
    const firstName = String(profile.name || "").split(" ")[0] || "there";

    return `
      <section class="st-sv-card st-sv-hero" style="--i:0;--ring-c:${ring}">
        <div class="st-sv-avatar">${this.esc(this.initialsOf(profile.name))}</div>
        <div>
          <p class="st-sv-hello">Hi, ${this.esc(firstName)}! Here's how you're doing.</p>
          <h2 class="st-sv-name">${this.esc(profile.name || "—")}</h2>
        </div>
        <div class="st-sv-meta">
          <div><span class="material-symbols-outlined">badge</span><span><small>LRN</small><b>${this.esc(profile.lrn || "—")}</b></span></div>
          <div><span class="material-symbols-outlined">hub</span><span><small>Class</small><b>${this.esc(profile.clc || "—")}</b></span></div>
          <div><span class="material-symbols-outlined">school</span><span><small>Level</small><b>${this.esc(profile.level || "—")}</b></span></div>
          <div><span class="material-symbols-outlined">groups</span><span><small>Modality</small><b>${this.esc(profile.modality || "—")}</b></span></div>
        </div>
      </section>
    `;
  }

  static renderRiskCard(risk) {
    if (!risk) return "";

    const RISK_ICON = {
      High: ["high", "warning"],
      Moderate: ["moderate", "warning"],
      Low: ["low", "check_circle"],
      Preliminary: ["preliminary", "hourglass_top"],
    };
    const [cls, icon] = RISK_ICON[risk.label] || ["neutral", "help"];

    return `
      <section class="st-sv-card st-sv-risk is-${cls}" style="--i:1">
        <div class="st-sv-risk-top">
          <div class="st-sv-risk-icon"><span class="material-symbols-outlined">${icon}</span></div>
          <div>
            <p class="st-sv-risk-label">My current risk</p>
            <span class="st-sv-badge">${this.esc(risk.label)}</span>
          </div>
        </div>
        <p class="st-sv-risk-summary">${this.esc(risk.summary)}</p>
      </section>
    `;
  }

  static renderCounts(batches) {
    const all = batches.flatMap((b) => (b.strands || []).flatMap((s) => s.modules || []));
    const counts = { returned: 0, due: 0, overdue: 0, pending: 0 };
    all.forEach((m) => {
      counts[this.statusOf(m)[0]] += 1;
    });

    return `
      <section class="st-sv-card" style="--i:2">
        <h3 class="st-sv-title">My modules at a glance</h3>
        <p class="st-sv-sub">${all.length} module${all.length === 1 ? "" : "s"} released to you</p>
        <div class="st-sv-counts">
          <div class="st-sv-count returned"><b>${counts.returned}</b><small>Returned</small></div>
          <div class="st-sv-count due"><b>${counts.due}</b><small>Due soon</small></div>
          <div class="st-sv-count overdue"><b>${counts.overdue}</b><small>Overdue</small></div>
          <div class="st-sv-count pending"><b>${counts.pending}</b><small>Pending</small></div>
        </div>
      </section>
    `;
  }

  static renderPerformanceProgress(progress) {
    const rows = Array.isArray(progress) ? progress : [];

    if (!rows.length) {
      return `
        <section class="st-sv-card st-sv-progress" style="--i:3">
          <h3 class="st-sv-title">Student Performance Progress</h3>
          <p class="st-sv-sub">Cumulative module return rate over time.</p>
          <p class="st-sv-empty" style="margin-top:14px">Progress will appear after modules are released or returned.</p>
        </section>
      `;
    }

    const x = (i) => (rows.length === 1 ? 50 : (i / (rows.length - 1)) * 100);
    const y = (rate) => 100 - Math.max(0, Math.min(100, Number(rate) || 0));
    const current = Math.round(Number(rows[rows.length - 1].rate) || 0);

    const line = rows.map((pt, i) => `${x(i)},${y(pt.rate)}`).join(" ");
    const area = `${x(0)},100 ${line} ${x(rows.length - 1)},100`;

    const dots = rows
      .map((pt, i) => {
        const edge = i === 0 ? " is-first" : i === rows.length - 1 ? " is-last" : "";
        const tooltip = `${pt.date}: ${Math.round(Number(pt.rate) || 0)}% progress`;
        const safeTooltip = this.esc(tooltip);

        return `
          <span class="st-sv-pt${edge}" tabindex="0" style="left:${x(i)}%;top:${y(pt.rate)}%;--d:${700 + i * 250}" data-tooltip="${safeTooltip}" aria-label="${safeTooltip}"></span>
          <span class="st-sv-xlab${edge}" style="left:${x(i)}%">${this.esc(pt.date)}</span>
        `;
      })
      .join("");

    const gridLines = [100, 75, 50, 25, 0]
      .map((v) => `<div class="st-sv-grid-line" style="top:${100 - v}%"><span>${v}%</span></div>`)
      .join("");

    return `
      <section class="st-sv-card st-sv-progress" style="--i:3" data-sv-chart>
        <div class="st-sv-progress-head">
          <div>
            <h3 class="st-sv-title">Student Performance Progress</h3>
            <p class="st-sv-sub">Cumulative module return rate over time.</p>
          </div>
          <div class="st-sv-current">
            <span>Current progress</span>
            <strong>${current}%</strong>
          </div>
        </div>
        <div class="st-sv-bar" aria-hidden="true"><i style="--w:${current}%"></i></div>
        <div class="st-sv-chart" role="img" aria-label="Student performance progress line graph">
          <div class="st-sv-plot">
            ${gridLines}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="svGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#12355b" stop-opacity=".16"></stop>
                  <stop offset="1" stop-color="#12355b" stop-opacity="0"></stop>
                </linearGradient>
              </defs>
              <polygon class="st-sv-area" points="${area}"></polygon>
              <polyline class="st-sv-line" points="${line}" vector-effect="non-scaling-stroke"></polyline>
            </svg>
            ${dots}
          </div>
        </div>
      </section>
    `;
  }

  static renderModulesSection(batches) {
    if (!batches.length) {
      return `
        <section class="st-sv-card" style="--i:4">
          <div class="st-sv-mod-head"><div><h3 class="st-sv-title">My Modules</h3><p class="st-sv-sub">Grouped by the date your teacher released them.</p></div></div>
          <p class="st-sv-empty">No modules have been released to you yet.</p>
        </section>
      `;
    }

    const batchesHtml = batches
      .map(
        (batch) => `
          <div class="st-sv-batch">
            <div class="st-sv-batch-date"><small>Released</small><b>${this.esc(batch.releaseDate)}</b></div>
            <div class="st-sv-mods">
              ${(batch.strands || [])
                .flatMap((strand) => strand.modules || [])
                .map((m) => this.renderModuleRow(m))
                .join("")}
            </div>
          </div>
        `,
      )
      .join("");

    return `
      <section class="st-sv-card" style="--i:4">
        <div class="st-sv-mod-head"><div><h3 class="st-sv-title">My Modules</h3><p class="st-sv-sub">Grouped by the date your teacher released them.</p></div></div>
        <div class="st-sv-batches">${batchesHtml}</div>
      </section>
    `;
  }

  // (statusKey, label, icon) -- same priority as before: returned -> overdue
  // -> dueSoon -> pending. Shared by renderModuleRow() and renderCounts() so
  // the glance tiles and the module pills can never disagree.
  static statusOf(m) {
    if (m.status === "returned") return ["returned", "Returned", "task_alt"];
    if (m.overdue) return ["overdue", "Overdue", "error"];
    if (m.dueSoon) return ["due", "Due Soon", "schedule"];
    return ["pending", "Pending", "hourglass_empty"];
  }

  static renderModuleRow(m) {
    const [cls, text, icon] = this.statusOf(m);

    return `
      <div class="st-sv-mod ${cls}">
        <span class="st-sv-mod-icon"><span class="material-symbols-outlined">${icon}</span></span>
        <div class="st-sv-mod-text">
          <p class="st-sv-mod-name">${this.esc(m.title)}</p>
          ${m.strandCode ? `<span class="st-sv-mod-strand">${this.esc(m.strandCode)}</span>` : ""}
        </div>
        <span class="st-sv-pill">${text}</span>
      </div>
    `;
  }

  static esc(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }
}

document.addEventListener("DOMContentLoaded", () => StudentPortal.init());
