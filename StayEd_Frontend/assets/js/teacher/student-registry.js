const ST_REGISTRY_REDUCE_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Same mapping used by the Dashboard's Student Registry Summary widget
// (dashboard.js) so a learner's avatar color is consistent between the two.
const LEVEL_AVATAR_THEMES = {
  "Basic Literacy": "",
  "Elementary": " st-avatar-initials--teal",
  "Junior High": " st-avatar-initials--blue",
  "Senior High": " st-avatar-initials--slate",
};

class StudentRegistry {
  static state = {
    all: [],
    filtered: [],
    selected: new Set(),
    predicting: new Set(),
    page: 1,
    perPage: 8,
    search: "",
    level: "",
    risk: "",
    status: "",
    sortKey: null,
    sortDir: 1,
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
      const response = await API.getLearners();

      this.state.all = response.data || [];

      this.renderStats();

      this.apply();
    } catch (error) {
      console.error("[StudentRegistry]", error);

      Toast?.error("Unable to load learners.");
    } finally {
      if (window.Layout) Layout.hideLoader();
    }
  }

  static showSkeleton() {
    const body = document.querySelector("[data-mgmt-body]");

    if (body && window.Skeletons) {
      body.innerHTML = Skeletons.tableRows(6, 8);
    }
  }

  static bindControls() {
    const on = (selector, event, handler) => {
      document.querySelector(selector)?.addEventListener(event, handler);
    };

    on("[data-mgmt-export-all]", "click", () => {
      this.exportLearners(this.state.filtered);
    });

    on("[data-mgmt-search]", "input", (e) => {
      this.state.search = e.target.value.toLowerCase();
      this.state.page = 1;
      this.apply();
    });

    on("[data-mgmt-filter-level]", "change", (e) => {
      this.state.level = e.target.value;
      this.state.page = 1;
      this.apply();
    });

    on("[data-mgmt-filter-risk]", "change", (e) => {
      this.state.risk = e.target.value;
      this.state.page = 1;
      this.apply();
    });

    on("[data-mgmt-filter-status]", "change", (e) => {
      this.state.status = e.target.value;
      this.state.page = 1;
      this.apply();
    });

    on("[data-mgmt-clear]", "click", () => {
      this.state.search = "";
      this.state.level = "";
      this.state.risk = "";
      this.state.status = "";
      this.state.page = 1;

      const search = document.querySelector("[data-mgmt-search]");
      if (search) search.value = "";
      const level = document.querySelector("[data-mgmt-filter-level]");
      if (level) level.value = "";
      const risk = document.querySelector("[data-mgmt-filter-risk]");
      if (risk) risk.value = "";
      const status = document.querySelector("[data-mgmt-filter-status]");
      if (status) status.value = "";

      this.apply();
    });

    document.querySelectorAll("[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (this.state.sortKey === key) {
          this.state.sortDir *= -1;
        } else {
          this.state.sortKey = key;
          this.state.sortDir = 1;
        }
        this.apply();
      });
    });

    on("[data-mgmt-select-all]", "change", (e) => {
      const checked = e.target.checked;
      const idsOnPage = this.currentPageRows().map((l) => l.id);
      idsOnPage.forEach((id) => {
        if (checked) this.state.selected.add(id);
        else this.state.selected.delete(id);
      });
      this.renderPage();
    });

    on("[data-mgmt-bulk-archive]", "click", () => this.bulkArchive());
    on("[data-mgmt-bulk-delete]", "click", () => this.bulkDelete());
    on("[data-mgmt-bulk-export]", "click", () => {
      const selected = this.state.all.filter((l) => this.state.selected.has(l.id));
      this.exportLearners(selected);
    });
  }

  static exportLearners(learners) {
    if (!learners.length) {
      Toast?.error("There are no learners to export.");
      return;
    }

    Utils.downloadCsv(
      `StayEd_Student_Registry_${new Date().toISOString().slice(0, 10)}.csv`,
      ["LRN", "Name", "Learning Level", "Modality", "CLC", "Risk Level", "Status"],
      learners.map((l) => [l.lrn, l.name, l.level, l.modality, l.clc, l.risk, l.status]),
    );

    Toast?.success(`Exported ${learners.length} learner(s).`);
  }

  static renderStats() {
    const all = this.state.all;

    const count = (level) => all.filter((l) => l.risk === level).length;

    const total = all.length;
    const high = count("High");
    const moderate = count("Moderate");
    const low = count("Low");
    const unassessed = Math.max(0, total - high - moderate - low);

    this.countTo(document.querySelector("[data-mgmt-total]"), total);
    this.countTo(document.querySelector("[data-mgmt-high]"), high);
    this.countTo(document.querySelector("[data-mgmt-moderate]"), moderate);
    this.countTo(document.querySelector("[data-mgmt-low]"), low);
    this.countTo(document.querySelector("[data-mgmt-unassessed]"), unassessed);

    // Proportional risk strip: each segment's flex-grow equals its own
    // count, matching the dashboard's overview strip.
    const grow = (selector, value) => {
      const el = document.querySelector(selector);
      if (el) el.style.flexGrow = String(Math.max(value, 0.0001));
    };
    grow("[data-risk-strip-high]", high);
    grow("[data-risk-strip-moderate]", moderate);
    grow("[data-risk-strip-low]", low);
    grow("[data-risk-strip-unassessed]", unassessed);

    const strip = document.querySelector("[data-risk-strip]");
    if (strip) {
      strip.setAttribute(
        "aria-label",
        `${high} high, ${moderate} moderate, ${low} low, ${unassessed} not yet assessed`,
      );
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
    if (ST_REGISTRY_REDUCE_MOTION || !Number.isFinite(end)) {
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

    const { search, level, risk, status } = this.state;

    if (search) {
      rows = rows.filter(
        (l) =>
          (l.name || "").toLowerCase().includes(search) ||
          (l.lrn || "").toLowerCase().includes(search),
      );
    }

    if (level) rows = rows.filter((l) => l.level === level);
    if (risk) rows = rows.filter((l) => l.risk === risk);
    if (status) rows = rows.filter((l) => l.status === status);

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

    this.updateSortIndicators();

    this.renderPage();
  }

  static updateSortIndicators() {
    document.querySelectorAll("[data-sort]").forEach((th) => {
      const icon = th.querySelector(".st-sort-icon");
      const isActive = th.dataset.sort === this.state.sortKey;

      th.classList.toggle("is-sorted", isActive);

      if (icon) {
        icon.textContent = isActive
          ? this.state.sortDir === 1
            ? "arrow_upward"
            : "arrow_downward"
          : "unfold_more";
      }
    });
  }

  static currentPageRows() {
    const { filtered, page, perPage } = this.state;

    const start = (page - 1) * perPage;

    return filtered.slice(start, start + perPage);
  }

  static renderPage() {
    const body = document.querySelector("[data-mgmt-body]");

    if (!body) return;

    const pageRows = this.currentPageRows();

    if (!pageRows.length) {
      body.innerHTML = `
                <tr>
                    <td colspan="8">
                        <div class="st-empty" style="border:none;background:transparent;">
                            <span class="material-symbols-outlined">search_off</span>
                            <p class="st-empty-title">No learners found</p>
                            <p class="st-empty-text">Try adjusting your search or filters.</p>
                        </div>
                    </td>
                </tr>
            `;
    } else {
      body.innerHTML = pageRows.map((l, i) => this.row(l, i)).join("");

      body.querySelectorAll("[data-row-select]").forEach((cb) => {
        cb.addEventListener("change", (e) => {
          const id = cb.dataset.rowSelect;
          if (e.target.checked) this.state.selected.add(id);
          else this.state.selected.delete(id);
          this.updateBulkBar();
          cb.closest("tr")?.classList.toggle("is-selected", e.target.checked);
        });
      });

      body.querySelectorAll("[data-view-learner]").forEach((btn) => {
        btn.addEventListener("click", () => this.view(btn.dataset.viewLearner));
      });

      body.querySelectorAll("[data-archive-learner]").forEach((btn) => {
        btn.addEventListener("click", () =>
          this.archiveOne(btn.dataset.archiveLearner),
        );
      });

      body.querySelectorAll("[data-run-prediction]").forEach((btn) => {
        btn.addEventListener("click", () =>
          this.runPrediction(btn.dataset.runPrediction),
        );
      });
    }

    body.classList.remove("is-inview");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => body.classList.add("is-inview")),
    );
    body.querySelectorAll("[data-countup]").forEach((el) => this.countTo(el));

    this.syncSelectAllState();

    this.updateBulkBar();

    this.renderPagination();
  }

  static formatDisplayName(learner) {
    // Prefer the backend's own first_name/last_name -- naively splitting
    // the combined `name` string and treating the last token as surname
    // mangles any multi-word surname (e.g. "Dela Cruz", "Santos Reyes").
    const first = (learner?.first_name || "").trim();
    const last = (learner?.last_name || "").trim();
    if (first && last) return `${last}, ${first}`;

    const value = (learner?.name || "").trim();
    if (!value) return "";

    const parts = value.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return value;

    const lastName = parts.pop();
    const firstName = parts.join(" ");
    return `${lastName}, ${firstName}`;
  }

  static row(l, i) {
    const initials = (l.name || "?")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    const isArchived = l.status === "Archived";

    return `
            <tr class="${this.state.selected.has(l.id) ? "is-selected" : ""}" style="--i:${i}">
                <td class="checkbox-col" data-col="select">
                    <input type="checkbox" data-row-select="${l.id}"
                        ${this.state.selected.has(l.id) ? "checked" : ""}
                        aria-label="Select ${l.name}">
                </td>
                <td data-col="learner">
                    <div class="st-learner-cell">
                        ${this.avatar(l, initials)}
                        <div style="min-width:0">
                            <button type="button" class="st-learner-name" data-view-learner="${l.id}">${this.formatDisplayName(l)}</button>
                            <p class="st-learner-id"><span class="num">${l.lrn}</span>${l.sex || l.age ? ` · ${l.sex || ""}${l.sex && l.age ? ", " : ""}${l.age || ""}` : ""}</p>
                        </div>
                    </div>
                </td>
                <td data-col="level">${l.level || "—"}</td>
                <td data-col="modality">${this.modalityPill(l.modality)}</td>
                <td data-col="risk">${this.riskCell(l)}</td>
                <td data-col="activity" class="st-activity" ${l.activity_text ? `data-tip="${l.activity_text.replace(/"/g, "&quot;")}"` : ""}><span class="st-activity-text">${l.activity_text || "—"}</span></td>
                <td data-col="status">${this.statusPill(l.status)}</td>
                <td class="is-right" data-col="actions">
                    <div class="st-row-actions">
                        <button class="st-btn st-btn-outline st-btn-xs" data-view-learner="${l.id}">View profile</button>
                        <div class="st-row-menu" data-row-menu>
                            <button type="button" class="st-row-menu-trigger" data-row-menu-trigger aria-label="More actions">
                                <span class="material-symbols-outlined">more_vert</span>
                            </button>
                            <div class="st-row-menu-list">
                                <button type="button" data-run-prediction="${l.id}"
                                    ${this.state.predicting.has(String(l.id)) ? "disabled" : ""}>
                                    <span class="material-symbols-outlined">${this.state.predicting.has(String(l.id)) ? "progress_activity" : "bolt"}</span>
                                    Run prediction
                                </button>
                                <button type="button" data-archive-learner="${l.id}">
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

  // Colored by Learning Level (not risk) so a learner's avatar reads the
  // same way here and in the Dashboard's Student Registry Summary widget.
  static avatar(l, initials) {
    const cls = LEVEL_AVATAR_THEMES[l.level] || "";
    return `<span class="st-avatar-initials${cls}">${initials}</span>`;
  }

  static modalityPill(modality) {
    const cls = { "Face-to-Face": " st-modality-pill--f2f", Modular: " st-modality-pill--modular", Blended: " st-modality-pill--blended" }[modality] || "";
    return `<span class="st-pill st-modality-pill${cls}">${modality || "—"}</span>`;
  }

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

  static syncSelectAllState() {
    const selectAll = document.querySelector("[data-mgmt-select-all]");

    if (!selectAll) return;

    const idsOnPage = this.currentPageRows().map((l) => l.id);

    const allSelected =
      idsOnPage.length > 0 &&
      idsOnPage.every((id) => this.state.selected.has(id));

    selectAll.checked = allSelected;
  }

  static updateBulkBar() {
    const bar = document.querySelector("[data-mgmt-bulk-bar]");
    const count = document.querySelector("[data-mgmt-bulk-count]");

    if (!bar) return;

    const n = this.state.selected.size;

    bar.classList.toggle("st-hidden", n === 0);

    if (count) {
      count.textContent = `${n} selected`;
    }
  }

  static renderPagination() {
    const { filtered, page, perPage } = this.state;

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / perPage));
    const start = total ? (page - 1) * perPage + 1 : 0;
    const end = Math.min(page * perPage, total);

    this.set(
      "[data-mgmt-info]",
      `Showing ${start}\u2013${end} of ${total} learners`,
    );

    this.set("[data-mgmt-info-top]", `${total} learner${total === 1 ? "" : "s"}`);

    const container = document.querySelector("[data-mgmt-pages]");

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

  static view(id) {
    const l = this.state.all.find((x) => String(x.id) === String(id));

    if (!l) return;

    window.location.href = `learner-profile.html?id=${encodeURIComponent(l.id)}`;
  }

  static async archiveOne(id) {
    const l = this.state.all.find((x) => String(x.id) === String(id));

    if (!l) return;

    const archiving = l.status !== "Archived";

    try {
      await API.updateLearner(id, {
        status: archiving ? "Archived" : "Active",
      });

      l.status = archiving ? "Archived" : "Active";

      this.apply();

      Toast?.success(archiving ? "Learner archived." : "Learner restored.");
    } catch (error) {
      console.error(error);
      Toast?.error("Unable to update learner status.");
    }
  }

  // Same manual trigger as Learner Profile's "Run Prediction" button, just
  // reachable per-row here without leaving the registry table. Updates the
  // row in place from the response instead of a full reload.
  static async runPrediction(id) {
    const key = String(id);
    if (this.state.predicting.has(key)) return;

    this.state.predicting.add(key);
    this.apply();

    try {
      const result = await API.runPrediction(id);
      const l = this.state.all.find((x) => String(x.id) === key);
      if (l) {
        l.risk =
          result.risk_level.charAt(0) + result.risk_level.slice(1).toLowerCase();
        l.risk_probability = result.risk_probability;
      }
      Toast?.success(
        `Prediction updated: ${result.risk_level} risk (${Math.round(result.risk_probability * 100)}%).`,
      );
    } catch (error) {
      console.error("[StudentRegistry] runPrediction", error);
      Toast?.error(error?.message || "Unable to run a prediction for this learner.");
    } finally {
      this.state.predicting.delete(key);
      this.apply();
    }
  }

  static bulkArchive() {
    const ids = [...this.state.selected];

    if (!ids.length || !window.Modal) return;

    Modal.show({
      title: "Archive Learners",
      message: `Archive <strong>${ids.length}</strong> selected learner(s)? They can be restored later.`,
      onConfirm: async () => {
        let archived = 0;

        for (const id of ids) {
          try {
            await API.updateLearner(id, { status: "Archived" });
            const learner = this.state.all.find(
              (item) => String(item.id) === String(id),
            );
            if (learner) learner.status = "Archived";
            archived += 1;
          } catch (error) {
            console.error(error);
          }
        }

        this.state.selected.clear();
        this.apply();

        if (archived === ids.length) {
          Toast?.success(`${archived} learner(s) archived.`);
        } else {
          Toast?.warning(`${archived} of ${ids.length} learner(s) were archived.`);
        }
      },
    });
  }

  static bulkDelete() {
    const ids = [...this.state.selected];

    if (!ids.length || !window.Modal) return;

    Modal.show({
      title: "Delete Learners",
      message: `Are you sure you want to permanently remove <strong>${ids.length}</strong> selected learner(s)? This action cannot be undone.`,
      onConfirm: async () => {
        const deletedIds = new Set();

        for (const id of ids) {
          try {
            await API.deleteLearner(id);
            deletedIds.add(id);
          } catch (error) {
            console.error(error);
          }
        }

        this.state.all = this.state.all.filter(
          (l) => !deletedIds.has(String(l.id)) && !deletedIds.has(l.id),
        );

        this.state.selected.clear();

        this.renderStats();

        this.apply();

        if (deletedIds.size === ids.length) {
          Toast?.success(`${deletedIds.size} learner(s) deleted.`);
        } else {
          Toast?.warning(`${deletedIds.size} of ${ids.length} learner(s) were deleted.`);
        }
      },
    });
  }

  static riskBadge(risk) {
    const cls = { High: "high", Moderate: "moderate", Low: "low" }[risk];
    const label = cls ? risk : "Not yet assessed";
    return `<span class="st-risk-badge st-risk-badge--${cls || "neutral"}"><span class="st-risk-dot"></span>${label}</span>`;
  }

  static statusPill(status) {
    const cls = (status || "").toLowerCase();
    return `<span class="st-pill st-pill--${cls}">${status || "\u2014"}</span>`;
  }

  static set(selector, value) {
    const el = document.querySelector(selector);
    if (el && value !== undefined && value !== null) {
      el.textContent = value;
    }
  }
}

// Row menu (Run prediction / Archive) open/close + fixed positioning, same
// pattern as Learner Records' row menu. data-view-learner is handled by its
// own per-row binding in renderPage(), not here, so it isn't duplicated.
function closeOpenRegistryRowMenus() {
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

window.addEventListener("scroll", closeOpenRegistryRowMenus, true);

(function bootManagement() {
  let started = false;
  const start = () => {
    if (!started) {
      started = true;
      StudentRegistry.init();
    }
  };
  document.addEventListener("components:loaded", start);
  document.addEventListener("DOMContentLoaded", () => setTimeout(start, 600));
})();

window.StudentRegistry = StudentRegistry;
