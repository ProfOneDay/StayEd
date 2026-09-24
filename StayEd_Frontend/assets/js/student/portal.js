class StudentPortal {
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
      <div class="st-student-unavailable">
        <span class="material-symbols-outlined">link_off</span>
        <p>This link isn't available. Ask your teacher for an updated link.</p>
      </div>
    `;
  }

  static render(data) {
    const body = document.querySelector("[data-student-body]");
    if (!body) return;

    body.innerHTML = `
      ${this.renderProfileCard(data.profile)}
      ${this.renderRiskCard(data.risk)}
      ${this.renderPerformanceProgress(data.performanceProgress || [])}
      ${this.renderModulesSection(data.batches || [])}
    `;
  }

  static renderProfileCard(profile) {
    if (!profile) return "";

    return `
      <div class="st-student-card">
        <p class="st-student-profile-name">${this.esc(profile.name)}</p>
        <div class="st-student-profile-meta">
          <p>LRN <span>${this.esc(profile.lrn || "—")}</span></p>
          <p>Class <span>${this.esc(profile.clc || "—")}</span></p>
          <p>Level <span>${this.esc(profile.level || "—")}</span></p>
          <p>Modality <span>${this.esc(profile.modality || "—")}</span></p>
        </div>
      </div>
    `;
  }

  static renderRiskCard(risk) {
    if (!risk) return "";

    const cls =
      { High: "high", Moderate: "moderate", Low: "low" }[risk.label] ||
      "neutral";

    return `
      <div class="st-student-card st-student-risk-card">
        <p class="st-student-risk-label">My Current Risk</p>
        <span class="st-risk-badge st-risk-badge--${cls}" style="align-self:flex-start;">
          <span class="st-risk-dot"></span>${this.esc(risk.label)}
        </span>
        <p class="st-student-risk-summary">${this.esc(risk.summary)}</p>
      </div>
    `;
  }

  static renderPerformanceProgress(progress) {
    const rows = Array.isArray(progress) ? progress : [];
    const current = rows.length ? rows[rows.length - 1].rate : null;

    if (!rows.length) {
      return `
        <div>
          <p class="st-student-section-title">Student Performance Progress</p>
          <div class="st-student-card">
            <p class="st-student-empty">Progress will appear after modules are released or returned.</p>
          </div>
        </div>
      `;
    }

    const width = 100;
    const height = 100;
    const leftPad = 5;
    const rightPad = 5;
    const topPad = 9;
    const bottomPad = 18;
    const usableWidth = width - leftPad - rightPad;
    const usableHeight = height - topPad - bottomPad;
    const coords = rows.map((pt, index) => ({
      x: rows.length === 1
        ? leftPad + usableWidth / 2
        : leftPad + (index / (rows.length - 1)) * usableWidth,
      y: topPad + ((100 - Math.max(0, Math.min(100, Number(pt.rate) || 0))) / 100) * usableHeight,
      pt,
    }));
    const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
    const area = `${leftPad},${topPad + usableHeight} ${line} ${leftPad + usableWidth},${topPad + usableHeight}`;
    const labelIndexes = new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1]);

    return `
      <div>
        <div class="st-student-progress-heading">
          <div>
            <p class="st-student-section-title">Student Performance Progress</p>
            <p class="st-student-progress-subtitle">Cumulative module return rate over time.</p>
          </div>
          <div class="st-student-progress-current">
            <span>Current Progress</span>
            <strong>${current == null ? "—" : `${Math.round(current)}%`}</strong>
          </div>
        </div>
        <div class="st-student-card st-student-progress-card">
          <div class="st-student-progress-chart" role="img" aria-label="Student performance progress line graph">
            ${[100, 75, 50, 25, 0].map((value) => {
              const y = topPad + ((100 - value) / 100) * usableHeight;
              return `<div class="st-student-progress-grid" style="top:${y}%"><span>${value}%</span></div>`;
            }).join("")}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="${area}" class="st-student-progress-area"></polygon>
              <polyline points="${line}" class="st-student-progress-line"></polyline>
            </svg>
            ${coords.map(({ x, y, pt }, index) => {
              const tooltip = `${pt.date}: ${Math.round(pt.rate)}% progress`;
              const safeTooltip = String(tooltip)
                .replace(/&/g, "&amp;")
                .replace(/"/g, "&quot;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");

              return `
                <span class="st-student-progress-point" style="left:${x}%;top:${y}%;" data-tooltip="${safeTooltip}" aria-label="${safeTooltip}" tabindex="0"></span>
                ${labelIndexes.has(index) ? `<span class="st-student-progress-date" style="left:${x}%">${this.esc(pt.date)}</span>` : ""}
              `;
            }).join("")}
          </div>
        </div>
      </div>
    `;
  }

  static renderModulesSection(batches) {
    if (!batches.length) {
      return `
        <div>
          <p class="st-student-section-title">My Modules</p>
          <div class="st-student-card">
            <p class="st-student-empty">No modules have been released to you yet.</p>
          </div>
        </div>
      `;
    }

    const batchesHtml = batches
      .map(
        (batch) => `
          <div class="st-student-batch">
            <p class="st-student-batch-date">Released ${this.esc(batch.releaseDate)}</p>
            ${(batch.strands || [])
              .flatMap((strand) => strand.modules || [])
              .map((m) => this.renderModuleRow(m))
              .join("")}
          </div>
        `,
      )
      .join("");

    return `
      <div>
        <p class="st-student-section-title">My Modules</p>
        <div class="st-student-card">${batchesHtml}</div>
      </div>
    `;
  }

  static renderModuleRow(m) {
    let pillClass = "pending";
    let pillText = "Pending";

    if (m.status === "returned") {
      pillClass = "returned";
      pillText = "Returned";
    } else if (m.overdue) {
      pillClass = "overdue";
      pillText = "Overdue";
    } else if (m.dueSoon) {
      pillClass = "due";
      pillText = "Due Soon";
    }

    return `
      <div class="st-student-module-row">
        <div>
          <p class="st-student-module-name">${this.esc(m.title)}</p>
          <p class="st-student-module-strand">${this.esc(m.strandCode || "")}</p>
        </div>
        <span class="st-student-status-pill st-student-status-pill--${pillClass}">${pillText}</span>
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
