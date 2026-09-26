const EARLY_WARNING_REDUCE_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  // Ticket 2: `new Date(...).toLocaleDateString()` with no locale argument
  // renders using the viewer's own OS/browser locale -- under an en-GB-style
  // locale that flips to DD/MM/YYYY (confirmed: 2026-08-03 renders "8/3/2026"
  // under en-US but "03/08/2026" under en-GB). date_generated is already a
  // safe, unambiguous ISO string from the backend; only this display step
  // was locale-dependent, so no stored/historical data is affected by this
  // fix -- it only changes how the same value is rendered on screen.
  //
  // Ticket 3: the backend sends date_generated from assessment_date.isoformat(),
  // which can be a full datetime ("2026-09-20T10:15:00"), not just a date.
  // Appending another "T00:00:00" onto that built an invalid Date. Slicing
  // to the first 10 characters first keeps this working for both a bare
  // date and a full datetime. Nothing is sent back to the server.
  static formatDateMDY(iso) {
    if (!iso) return "—";
    const date = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
        }))
        .sort((a, b) => (b.risk_probability || 0) - (a.risk_probability || 0));

      await this.populateClcFilter();

      this.renderSummary(learners);

      this.apply();
    } catch (error) {
      console.error("[EarlyWarning]", error);
      Toast?.error("Unable to load early warning alerts.");
    } finally {
      if (window.Layout) Layout.hideLoader();
    }
  }

  static async populateClcFilter() {
    const select = document.querySelector("[data-ewa-filter-clc]");
    if (!select) return;

    const current = this.state.clc;

    // Use the teacher's assigned CLC master list (the same source of truth
    // as CLC Overview / Class Management) so every assigned CLC is listed
    // here, not only CLCs that currently have a flagged learner.
    let names = [];
    try {
      const response = await API.getClcs();
      names = (response.data || [])
        .map((c) => c.name)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    } catch (error) {
      console.error("[EarlyWarning] Unable to load assigned CLCs", error);
      // Fall back to whatever CLC names are present in the flagged list so
      // the filter still works even if the CLC master list is unavailable.
      names = [...new Set(this.state.all.map((item) => item.clc))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }

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
  }

  static renderSummary(allLearners) {
    const total = this.state.all.length;
    const high = allLearners.filter((l) => l.risk === "High").length;
    const moderate = allLearners.filter((l) => l.risk === "Moderate").length;
    const low = allLearners.filter((l) => l.risk === "Low").length;

    this.countTo(document.querySelector("[data-ewa-total]"), total);
    this.countTo(document.querySelector("[data-ewa-high]"), high);
    this.countTo(document.querySelector("[data-ewa-moderate]"), moderate);
    this.countTo(document.querySelector("[data-ewa-low]"), low);

    const grow = (selector, value) => {
      const el = document.querySelector(selector);
      if (el) el.style.flexGrow = String(Math.max(value, 0.0001));
    };
    grow("[data-risk-strip-high]", high);
    grow("[data-risk-strip-moderate]", moderate);
    grow("[data-risk-strip-low]", low);

    const strip = document.querySelector("[data-risk-strip]");
    if (strip) {
      strip.setAttribute("aria-label", `${high} high, ${moderate} moderate, ${low} low risk`);
    }

    // Reveals the risk strip (clip-path transition on [data-animate] .st-risk-strip,
    // defined globally in dashboard.css) -- the dashboard triggers this via an
    // IntersectionObserver for its several scrollable widgets, but this summary
    // panel is always above the fold on load, so just add the class directly.
    const panel = document.querySelector(".st-overview[data-animate]");
    if (panel) {
      panel.classList.remove("is-inview");
      requestAnimationFrame(() =>
        requestAnimationFrame(() => panel.classList.add("is-inview")),
      );
    }
  }

  // Counts a [data-countup] element up from 0 to `value` over ~800ms
  // (ease-out-cubic). Writes the value immediately if motion is reduced.
  static countTo(el, value) {
    if (!el) return;
    const end = Number(value ?? el.dataset.final ?? el.textContent);
    el.dataset.final = Number.isFinite(end) ? end : (value ?? "");
    if (EARLY_WARNING_REDUCE_MOTION || !Number.isFinite(end)) {
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
      const clcSelected = this.state.clc;
      const title = clcSelected ? "No learners requiring attention in this CLC." : "No active alerts";
      const text = clcSelected
        ? "Try selecting a different CLC or clearing your filters."
        : "Try adjusting your search or filters.";
      body.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="st-empty" style="border:none;background:transparent;">
                            <span class="material-symbols-outlined">verified_user</span>
                            <p class="st-empty-title">${title}</p>
                            <p class="st-empty-text">${text}</p>
                        </div>
                    </td>
                </tr>
            `;
    } else {
      body.innerHTML = pageRows.map((l, i) => this.row(l, i)).join("");

      body.querySelectorAll("[data-open-profile]").forEach((el) => {
        el.addEventListener("click", () => {
          window.location.href = `learner-profile.html?id=${encodeURIComponent(el.dataset.openProfile)}`;
        });
      });
    }

    body.classList.remove("is-inview");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => body.classList.add("is-inview")),
    );

    this.renderPagination();
  }

  static row(l, i) {
    const cls = { High: "high", Moderate: "moderate", Low: "low" }[l.risk];

    const initials = (l.name || "?")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    const pct = Math.round(Math.min(1, Math.max(0, l.risk_probability ?? 0)) * 100);

    const avatarCls = { high: " st-avatar-initials--high", moderate: " st-avatar-initials--moderate" }[cls] || "";

    const riskCell = cls
      ? `<div class="st-risk-cell st-risk-cell--${cls}" title="Predicted dropout probability">
           <div class="st-risk-cell-top">${this.riskBadge(l.risk)}<span class="st-risk-pct num">${pct}%</span></div>
           <div class="st-risk-meter"><i style="--w:${pct}%"></i></div>
         </div>`
      : `<div class="st-risk-cell"><div class="st-risk-cell-top">${this.riskBadge(l.risk)}</div></div>`;

    return `
            <tr style="--i:${i}">
                <td data-col="learner">
                    <div class="st-learner-cell">
                        <span class="st-avatar-initials${avatarCls}">${initials}</span>
                        <div style="min-width:0">
                            <button type="button" class="st-learner-name" data-open-profile="${l.id}">${l.name}</button>
                            <p class="st-learner-id">LRN <span class="num">${l.lrn}</span></p>
                        </div>
                    </div>
                </td>
                <td data-col="level">${l.program || "—"}</td>
                <td data-col="clc">${l.clc || "—"}</td>
                <td data-col="risk">${riskCell}</td>
                <td data-col="date">
                    <span class="num">${l.dateGenerated ? EarlyWarningPage.formatDateMDY(l.dateGenerated) : "Not generated"}</span>
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
                <span class="material-symbols-outlined" style="font-size:1rem;">chevron_left</span>
            </button>
        `;

    for (let p = 1; p <= pages; p++) {
      html += `<button class="st-page-btn ${p === page ? "is-active" : ""}" data-go="${p}">${p}</button>`;
    }

    html += `
            <button class="st-page-btn" ${page === pages ? "disabled" : ""} data-next>
                <span class="material-symbols-outlined" style="font-size:1rem;">chevron_right</span>
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
      body.innerHTML = Skeletons.tableRows(6, 5);
    }
  }

  static riskBadge(risk) {
    const cls = { High: "high", Moderate: "moderate", Low: "low" }[risk];
    const label = cls ? risk : "Not yet assessed";
    return `<span class="st-risk-badge st-risk-badge--${cls || "neutral"}"><span class="st-risk-dot"></span>${label}</span>`;
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
