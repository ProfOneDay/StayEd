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
