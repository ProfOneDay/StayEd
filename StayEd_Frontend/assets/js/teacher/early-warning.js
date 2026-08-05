class EarlyWarningPage {
  static state = {
    all: [],
    filtered: [],
    page: 1,
    perPage: 8,
    search: "",
    riskLevel: "",
    clc: "",
  };

  static async init() {
    if (window.Guards) Guards.teacher();

    this.bindControls();

    await this.load();
  }

  static async load() {
    if (window.Layout) Layout.showLoader();

    this.showSkeleton();

    try {
      const res = await API.getLearners();

      const learners = res.data || [];

      this.state.all = learners
        .filter((l) => l.risk === "High" || l.risk === "Moderate")
        .map((l) => ({
          ...l,
          program: l.level,
          clc: l.clc || "Unassigned",
          dateGenerated: l.date_generated || "",
          assignedTeacher: l.assigned_teacher || "Unassigned",
          status: l.status === "Archived" ? "Archived" : "Active",
        }))
        .sort((a, b) => (b.risk_probability || 0) - (a.risk_probability || 0));

      this.populateClcFilter();

      this.renderSummary(learners);

      this.apply();
    } catch (error) {
      console.error("[EarlyWarning]", error);
      Toast?.error("Unable to load early warning alerts.");
    } finally {
      if (window.Layout) Layout.hideLoader();
    }
  }

  static populateClcFilter() {
    const select = document.querySelector("[data-ewa-filter-clc]");
    if (!select) return;

    const current = this.state.clc;
    const names = [...new Set(this.state.all.map((item) => item.clc))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    select.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "All CLCs";
    select.appendChild(allOption);

    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });

    select.value = names.includes(current) ? current : "";
    this.state.clc = select.value;
  }

  static bindControls() {
    document
      .querySelector("[data-ewa-search]")
      ?.addEventListener("input", (e) => {
        this.state.search = e.target.value.toLowerCase();
        this.state.page = 1;
        this.apply();
      });

    document
      .querySelector("[data-ewa-filter-risk]")
      ?.addEventListener("change", (e) => {
        this.state.riskLevel = e.target.value;
        this.state.page = 1;
        this.apply();
      });

    document
      .querySelector("[data-ewa-filter-clc]")
      ?.addEventListener("change", (e) => {
        this.state.clc = e.target.value;
        this.state.page = 1;
        this.apply();
      });

    document
      .querySelector("[data-ewa-clear]")
      ?.addEventListener("click", () => {
        this.state.search = "";
        this.state.riskLevel = "";
        this.state.clc = "";
        this.state.page = 1;

        document.querySelector("[data-ewa-search]").value = "";
        document.querySelector("[data-ewa-filter-risk]").value = "";
        document.querySelector("[data-ewa-filter-clc]").value = "";

        this.apply();
      });

    document
      .querySelector("[data-ewa-export]")
      ?.addEventListener("click", () => {
        Toast?.info("Export will be available once connected to the server.");
      });
  }

  static renderSummary(allLearners) {
    this.set("[data-ewa-total]", this.state.all.length);
    this.set(
      "[data-ewa-high]",
      allLearners.filter((l) => l.risk === "High").length,
    );
    this.set(
      "[data-ewa-moderate]",
      allLearners.filter((l) => l.risk === "Moderate").length,
    );
    this.set(
      "[data-ewa-low]",
      allLearners.filter((l) => l.risk === "Low").length,
    );
  }

  static apply() {
    let rows = [...this.state.all];

    if (this.state.search) {
      rows = rows.filter(
        (l) =>
          (l.name || "").toLowerCase().includes(this.state.search) ||
          (l.lrn || "").toLowerCase().includes(this.state.search),
      );
    }

    if (this.state.riskLevel) {
      rows = rows.filter((l) => l.risk === this.state.riskLevel);
    }

    if (this.state.clc) {
      rows = rows.filter((l) => l.clc === this.state.clc);
    }

    this.state.filtered = rows;

    this.set(
      "[data-ewa-count]",
      `${rows.length} alert${rows.length === 1 ? "" : "s"}`,
    );

    this.renderPage();
  }

  static renderPage() {
    const body = document.querySelector("[data-ewa-body]");

    if (!body) return;

    const { filtered, page, perPage } = this.state;

    const start = (page - 1) * perPage;

    const pageRows = filtered.slice(start, start + perPage);

    if (!pageRows.length) {
      body.innerHTML = `
                <tr>
                    <td colspan="9">
                        <div class="st-empty" style="border:none;background:transparent;">
                            <span class="material-symbols-outlined">verified_user</span>
                            <p class="st-empty-title">No active alerts</p>
                            <p class="st-empty-text">Try adjusting your search or filters.</p>
                        </div>
                    </td>
                </tr>
            `;
    } else {
      body.innerHTML = pageRows.map((l) => this.row(l)).join("");

      body.querySelectorAll("[data-open-profile]").forEach((el) => {
        el.addEventListener("click", () => {
          window.location.href = `learner-profile.html?id=${encodeURIComponent(el.dataset.openProfile)}`;
        });
      });
    }

    this.renderPagination();
  }

  static row(l) {
    const cls =
      { High: "high", Moderate: "moderate", Low: "low" }[l.risk] || "low";

    const initials = (l.name || "?")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    const score = Math.round((l.risk_probability ?? 0) * 100);

    return `
            <tr>
                <td>
                    <div class="st-ewa-table-name-cell">
                        <div class="st-avatar-initials st-avatar-initials--${cls === "high" ? "" : "teal"}">${initials}</div>
                        <div>
                            <p class="st-learner-name" style="cursor:pointer;" data-open-profile="${l.id}">${l.name}</p>
                            <p class="st-learner-id">LRN: ${l.lrn}</p>
                        </div>
                    </div>
                </td>
                <td>${l.program}</td>
                <td>${l.clc}</td>
                <td class="is-center">
                    <span class="st-ewa-risk-score" style="color:var(--st-risk-${cls});">${score}%</span>
                </td>
                <td>${this.riskBadge(l.risk)}</td>
                <td><span class="st-pill">${l.status}</span></td>
                <td style="font-size:12px;">${l.dateGenerated ? new Date(l.dateGenerated).toLocaleDateString() : "Not generated"}</td>
                <td style="font-size:12px;">${l.assignedTeacher}</td>
                <td class="is-center">
                    <button type="button" class="st-btn st-btn-primary st-btn-xs" data-open-profile="${l.id}">
                        View Profile
                    </button>
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

    this.set(
      "[data-ewa-info]",
      `Showing ${start}\u2013${end} of ${total} alerts`,
    );

    const container = document.querySelector("[data-ewa-pages]");

    if (!container) return;

    let html = `
            <button class="st-page-btn" ${page === 1 ? "disabled" : ""} data-prev>
                <span class="material-symbols-outlined" style="font-size:16px;">chevron_left</span>
            </button>
        `;

    for (let p = 1; p <= pages; p++) {
      html += `<button class="st-page-btn ${p === page ? "is-active" : ""}" data-go="${p}">${p}</button>`;
    }

    html += `
            <button class="st-page-btn" ${page === pages ? "disabled" : ""} data-next>
                <span class="material-symbols-outlined" style="font-size:16px;">chevron_right</span>
            </button>
        `;

    container.innerHTML = html;

    container.querySelector("[data-prev]")?.addEventListener("click", () => {
      if (this.state.page > 1) {
        this.state.page--;
        this.renderPage();
      }
    });

    container.querySelector("[data-next]")?.addEventListener("click", () => {
      if (this.state.page < pages) {
        this.state.page++;
        this.renderPage();
      }
    });

    container.querySelectorAll("[data-go]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.state.page = Number(btn.dataset.go);
        this.renderPage();
      });
    });
  }

  static showSkeleton() {
    const body = document.querySelector("[data-ewa-body]");

    if (body && window.Skeletons) {
      body.innerHTML = Skeletons.tableRows(6, 9);
    }
  }

  static riskBadge(risk) {
    const cls =
      { High: "high", Moderate: "moderate", Low: "low" }[risk] || "low";
    const label =
      risk === "High"
        ? "High Risk"
        : risk === "Moderate"
          ? "Medium Risk"
          : "Low Risk";
    return `<span class="st-risk-badge st-risk-badge--${cls}"><span class="st-risk-dot"></span>${label}</span>`;
  }

  static set(selector, value) {
    const el = document.querySelector(selector);
    if (el && value !== undefined && value !== null) {
      el.textContent = value;
    }
  }
}

(function bootAlerts() {
  let started = false;
  const start = () => {
    if (!started) {
      started = true;
      EarlyWarningPage.init();
    }
  };
  document.addEventListener("components:loaded", start);
  document.addEventListener("DOMContentLoaded", () => setTimeout(start, 400));
})();

window.EarlyWarningPage = EarlyWarningPage;
