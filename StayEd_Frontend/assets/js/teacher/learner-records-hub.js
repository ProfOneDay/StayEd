class LearnerRecordsHub {
  static state = {
    all: [],
    activeTab: "modular",
    search: "",
    clc: "",
    level: "",
    risk: "",
    page: { modular: 1, "face-to-face": 1, blended: 1 },
    perPage: 6,
    classId: "",
    selected: {
      modular: new Set(),
      "face-to-face": new Set(),
      blended: new Set(),
    },
  };

  static async init() {
    if (window.Guards) Guards.teacher();

    await this.loadClassContext();

    this.bindTabs();

    this.bindFilters();

    this.bindSaveExport();

    await this.load();
  }

  static async loadClassContext() {
    const params = new URLSearchParams(window.location.search);
    const classId = params.get("class");
    const clcName = params.get("clc");
    const banner = document.querySelector("[data-class-context-banner]");

    this.state.classId = classId || "";
    if (clcName) this.state.clc = clcName;

    if (!classId || !banner) return;

    try {
      const response = await API.getTeacherClasses();
      const match = (response?.data || []).find(
        (item) => String(item.id) === String(classId),
      );

      if (!match) return;

      banner.classList.remove("st-hidden");
      this.set("[data-class-context-name]", `${match.clc} — ${match.level}`);
      this.set(
        "[data-class-context-meta]",
        `${match.modality} · School Year ${match.schoolYear} · ${match.learnerCount} Enrolled Learners`,
      );
      this.set(
        "[data-records-subtitle]",
        `Viewing records for ${match.clc}, ${match.level} (SY ${match.schoolYear}).`,
      );
    } catch (error) {
      console.error("[LearnerRecordsHub] Unable to load class context", error);
    }
  }

  static async load() {
    if (window.Layout) Layout.showLoader();

    this.showSkeleton();

    try {
      const res = await API.getLearners(
        this.state.classId ? { class: this.state.classId } : {},
      );

      const learners = res.data || [];

      this.state.all = await Promise.all(
        learners.map(async (l) => {
          const detail = await API.getLearnerRecordsDetail(l.id);
          return { ...l, ...detail };
        }),
      );

      this.renderActiveTab();
    } catch (error) {
      console.error("[LearnerRecordsHub]", error);
      Toast?.error("Unable to load learner records.");
    } finally {
      if (window.Layout) Layout.hideLoader();
    }
  }

  static showSkeleton() {
    ["modular", "f2f", "blended"].forEach((key) => {
      const body = document.querySelector(`[data-${key}-body]`);

      if (body && window.Skeletons) {
        body.innerHTML = Skeletons.tableRows(4, 6);
      }
    });
  }

  static bindTabs() {
    document.querySelectorAll("[data-modality-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.modalityTab;

        document.querySelectorAll("[data-modality-tab]").forEach((t) => {
          const active = t === tab;
          t.classList.toggle("is-active", active);
          t.setAttribute("aria-selected", active ? "true" : "false");
        });

        document.querySelectorAll("[data-modality-panel]").forEach((panel) => {
          panel.classList.toggle(
            "is-active",
            panel.dataset.modalityPanel === target,
          );
        });

        this.state.activeTab = target;

        this.renderActiveTab();
      });
    });
  }

  static bindFilters() {
    document
      .querySelector("[data-records-search]")
      ?.addEventListener("input", (e) => {
        this.state.search = e.target.value.toLowerCase();
        this.resetPages();
        this.renderActiveTab();
      });

    document
      .querySelector("[data-records-filter-risk]")
      ?.addEventListener("change", (e) => {
        this.state.risk = e.target.value;
        this.resetPages();
        this.renderActiveTab();
      });
  }

  static resetPages() {
    this.state.page = { modular: 1, "face-to-face": 1, blended: 1 };
  }

  static bindSaveExport() {
    document
      .querySelector("[data-records-save]")
      ?.addEventListener("click", () => {
        Toast?.success("Changes saved.");
      });

    document
      .querySelector("[data-modular-bulk-export]")
      ?.addEventListener("click", () => {
        Toast?.info(
          `Exporting ${this.state.selected.modular.size} learner record(s)…`,
        );
      });

    document
      .querySelector("[data-modular-bulk-contact]")
      ?.addEventListener("click", () => {
        Toast?.success(
          `Marked ${this.state.selected.modular.size} learner(s) as Contacted.`,
        );
      });

    document
      .querySelector("[data-blended-bulk-export]")
      ?.addEventListener("click", () => {
        Toast?.info(
          `Exporting ${this.state.selected.blended.size} learner record(s)…`,
        );
      });
  }

  static filteredForModality(modality) {
    let rows = this.state.all.filter((l) => l.modality === modality);

    const { search, clc, level, risk } = this.state;

    if (search) {
      rows = rows.filter(
        (l) =>
          (l.name || "").toLowerCase().includes(search) ||
          (l.lrn || "").toLowerCase().includes(search),
      );
    }

    if (clc) rows = rows.filter((l) => l.clc === clc);
    if (level) rows = rows.filter((l) => l.level === level);
    if (risk) rows = rows.filter((l) => l.risk === risk);

    return rows;
  }

  static renderActiveTab() {
    const tab = this.state.activeTab;

    if (tab === "modular") this.renderModular();
    else if (tab === "face-to-face") this.renderF2F();
    else if (tab === "blended") this.renderBlended();
  }

  static renderModular() {
    const rows = this.filteredForModality("Modular");

    this.renderTable({
      rows,
      bodySelector: "[data-modular-body]",
      infoSelector: "[data-modular-info]",
      pagesSelector: "[data-modular-pages]",
      pageKey: "modular",
      colspan: 7,
      rowRenderer: (l) => this.modularRow(l),
    });
  }

  static modularRow(l) {
    const m = l.modules || {};

    const pct = Math.round((m.completed / m.total) * 100) || 0;

    const barClass =
      l.risk === "High"
        ? "st-progress-fill--high"
        : l.risk === "Moderate"
          ? "st-progress-fill--moderate"
          : "st-progress-fill--low";

    const labelClass =
      l.risk === "High" ? "st-progress-cell-label--danger" : "";

    return `
            <tr>
                <td class="checkbox-col">
                    <input type="checkbox" data-row-select-modular="${l.id}"
                        ${this.state.selected.modular.has(l.id) ? "checked" : ""}
                        aria-label="Select ${l.name}">
                </td>
                <td style="font-family:monospace;font-size:12px;color:var(--st-on-surface-variant);">${l.lrn}</td>
                <td style="font-weight:600;color:var(--st-on-surface);">${l.name}</td>
                <td>${this.riskBadge(l.risk)}</td>
                <td>
                    <div class="st-progress-cell">
                        <div class="st-progress-cell-head">
                            <button type="button" class="st-progress-cell-label ${labelClass}" data-open-module-modal="${l.id}" style="background:none;border:none;padding:0;cursor:pointer;text-align:left;">${m.active} Active Modules</button>
                            <span class="st-progress-cell-count">${m.completed} of ${m.total}</span>
                        </div>
                        <div class="st-progress-track">
                            <div class="st-progress-fill ${barClass}" style="width:${pct}%;"></div>
                        </div>
                    </div>
                </td>
                <td>
                    <select class="st-quick-select" data-contact-status="${l.id}" aria-label="Contact status for ${l.name}">
                        <option ${m.contactStatus === "Contacted" ? "selected" : ""}>Contacted</option>
                        <option ${m.contactStatus === "Follow-up Needed" ? "selected" : ""}>Follow-up Needed</option>
                        <option ${m.contactStatus === "No Response" ? "selected" : ""}>No Response</option>
                        <option ${m.contactStatus === "Guardian Contacted" ? "selected" : ""}>Guardian Contacted</option>
                    </select>
                </td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-size:13px;">${l.lastInteraction || "\u2014"}</span>
                        <button type="button" class="st-icon-btn-sm" data-open-module-modal="${l.id}" aria-label="View module history" title="View module history">
                            <span class="material-symbols-outlined" style="font-size:16px;">history</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
  }

  static renderF2F() {
    const rows = this.filteredForModality("Face-to-Face");

    this.renderTable({
      rows,
      bodySelector: "[data-f2f-body]",
      infoSelector: "[data-f2f-info]",
      pagesSelector: "[data-f2f-pages]",
      pageKey: "face-to-face",
      colspan: 5,
      rowRenderer: (l) => this.f2fRow(l),
    });
  }

  static f2fRow(l) {
    const m = l.modules || {};

    const pct = Math.round((m.completed / m.total) * 100) || 0;

    const consultDot =
      l.risk === "High"
        ? "st-consult-dot--danger"
        : l.risk === "Moderate"
          ? "st-consult-dot--warning"
          : "st-consult-dot--ok";

    return `
            <tr>
                <td style="font-family:monospace;font-size:12px;color:var(--st-on-surface-variant);">${l.lrn}</td>
                <td style="font-weight:600;color:var(--st-on-surface);">${l.name}</td>
                <td>
                    <div class="st-progress-cell">
                        <span class="st-progress-cell-count">${m.completed} of ${m.total} Returned</span>
                        <div class="st-progress-track">
                            <div class="st-progress-fill st-progress-fill--primary" style="width:${pct}%;"></div>
                        </div>
                        <button type="button" class="st-progress-link" data-open-module-modal="${l.id}">
                            View Logbook
                            <span class="material-symbols-outlined" style="font-size:16px;">arrow_forward</span>
                        </button>
                    </div>
                </td>
                <td>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span class="st-consult-dot ${consultDot}"></span>
                        <span style="font-size:13px;">${l.lastInteraction || "\u2014"}</span>
                    </div>
                </td>
                <td>${this.riskBadge(l.risk)}</td>
            </tr>
        `;
  }

  static renderBlended() {
    const rows = this.filteredForModality("Blended");

    this.renderTable({
      rows,
      bodySelector: "[data-blended-body]",
      infoSelector: "[data-blended-info]",
      pagesSelector: "[data-blended-pages]",
      pageKey: "blended",
      colspan: 7,
      rowRenderer: (l) => this.blendedRow(l),
    });
  }

  static blendedRow(l) {
    const a = l.attendance || {};

    const m = l.modules || {};

    const pct = Math.round((m.completed / m.total) * 100) || 0;

    const scheduleCell = a.nextSession
      ? `
                <div class="st-schedule-cell" data-open-schedule-modal="${l.id}">
                    <span class="st-schedule-date">${a.nextSession.date}</span>
                    <span class="st-schedule-status ${a.nextSession.status === "Scheduled" ? "st-schedule-status--scheduled" : "st-schedule-status--pending"}">${a.nextSession.status}</span>
                </div>
            `
      : `
                <div class="st-schedule-cell" data-open-schedule-modal="${l.id}">
                    <span style="font-size:12px;color:var(--st-on-surface-variant);">No session scheduled</span>
                    <button type="button" class="st-schedule-set-link">Set Schedule</button>
                </div>
            `;

    return `
            <tr>
                <td class="checkbox-col">
                    <input type="checkbox" data-row-select-blended="${l.id}"
                        ${this.state.selected.blended.has(l.id) ? "checked" : ""}
                        aria-label="Select ${l.name}">
                </td>
                <td>
                    <div style="display:flex;flex-direction:column;">
                        <span class="st-learner-id" style="font-family:monospace;">${l.lrn}</span>
                        <span style="font-weight:600;">${l.name}</span>
                        <div style="margin-top:4px;">${this.riskBadge(l.risk)}</div>
                    </div>
                </td>
                <td>${scheduleCell}</td>
                <td>
                    <div class="st-progress-cell">
                        <span class="st-progress-cell-count">${m.completed} of ${m.total} Completed</span>
                        <div class="st-progress-track st-progress-track--lg">
                            <div class="st-progress-fill st-progress-fill--primary" style="width:${pct}%;"></div>
                        </div>
                        <button type="button" class="st-progress-link" data-open-module-modal="${l.id}">
                            <span class="material-symbols-outlined" style="font-size:16px;">menu_book</span>
                            ${m.active} Active Modules
                        </button>
                    </div>
                </td>
                <td style="font-weight:700;color:var(--st-primary);">${pct}%</td>
                <td style="font-size:13px;font-style:italic;color:var(--st-on-surface-variant);">${l.lastInteraction || "\u2014"}</td>
                <td class="is-center">${this.rowActionsMenu(l.id)}</td>
            </tr>
        `;
  }

  static renderTable({
    rows,
    bodySelector,
    infoSelector,
    pagesSelector,
    pageKey,
    colspan,
    rowRenderer,
  }) {
    const body = document.querySelector(bodySelector);

    if (!body) return;

    const perPage = this.state.perPage;

    const page = this.state.page[pageKey] || 1;

    const start = (page - 1) * perPage;

    const pageRows = rows.slice(start, start + perPage);

    if (!pageRows.length) {
      body.innerHTML = `
                <tr>
                    <td colspan="${colspan}">
                        <div class="st-empty" style="border:none;background:transparent;">
                            <span class="material-symbols-outlined">search_off</span>
                            <p class="st-empty-title">No learners found</p>
                            <p class="st-empty-text">Try adjusting your search or filters.</p>
                        </div>
                    </td>
                </tr>
            `;
    } else {
      body.innerHTML = pageRows.map(rowRenderer).join("");

      this.bindRowInteractions(body);
    }

    const total = rows.length;

    const pages = Math.max(1, Math.ceil(total / perPage));

    const infoStart = total ? start + 1 : 0;

    const infoEnd = Math.min(page * perPage, total);

    this.set(
      infoSelector,
      `Showing ${infoStart}\u2013${infoEnd} of ${total} learners`,
    );

    this.renderPagination(pagesSelector, pageKey, pages);
  }

  static renderPagination(selector, pageKey, pages) {
    const container = document.querySelector(selector);

    if (!container) return;

    const current = this.state.page[pageKey] || 1;

    let html = `
            <button class="st-page-btn" ${current === 1 ? "disabled" : ""} data-prev>
                <span class="material-symbols-outlined" style="font-size:16px;">chevron_left</span>
            </button>
        `;

    for (let p = 1; p <= pages; p++) {
      html += `<button class="st-page-btn ${p === current ? "is-active" : ""}" data-go="${p}">${p}</button>`;
    }

    html += `
            <button class="st-page-btn" ${current === pages ? "disabled" : ""} data-next>
                <span class="material-symbols-outlined" style="font-size:16px;">chevron_right</span>
            </button>
        `;

    container.innerHTML = html;

    container.querySelector("[data-prev]")?.addEventListener("click", () => {
      if (this.state.page[pageKey] > 1) {
        this.state.page[pageKey]--;
        this.renderActiveTab();
      }
    });

    container.querySelector("[data-next]")?.addEventListener("click", () => {
      if (this.state.page[pageKey] < pages) {
        this.state.page[pageKey]++;
        this.renderActiveTab();
      }
    });

    container.querySelectorAll("[data-go]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.state.page[pageKey] = Number(btn.dataset.go);
        this.renderActiveTab();
      });
    });
  }

  static bindRowInteractions(container) {
    container.querySelectorAll("[data-open-module-modal]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.openModuleModal;
        const learner = this.state.all.find((x) => String(x.id) === String(id));
        if (learner && window.ModuleManagementModal) {
          ModuleManagementModal.open(learner);
        }
      });
    });

    container.querySelectorAll("[data-open-schedule-modal]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.openScheduleModal;
        const learner = this.state.all.find((x) => String(x.id) === String(id));
        if (learner && window.ScheduleAttendanceModal) {
          ScheduleAttendanceModal.open(learner);
        }
      });
    });

    container
      .querySelectorAll("[data-contact-status]")
      .forEach((select) => {
        select.addEventListener("change", () => {
          Toast?.success("Status updated.");
        });
      });

    this.bindSelectionCheckboxes(container);
  }

  static SELECTION_CONFIG = {
    modular: {
      attr: "data-row-select-modular",
      selectAll: "[data-modular-select-all]",
      bar: "[data-modular-bulk-bar]",
      count: "[data-modular-bulk-count]",
    },
    blended: {
      attr: "data-row-select-blended",
      selectAll: "[data-blended-select-all]",
      bar: "[data-blended-bulk-bar]",
      count: "[data-blended-bulk-count]",
    },
  };

  static bindSelectionCheckboxes(container) {
    const tab = this.state.activeTab;

    const config = this.SELECTION_CONFIG[tab];

    if (!config) return;

    const attrCamel = config.attr
      .replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      .replace("data", "");

    container.querySelectorAll(`[${config.attr}]`).forEach((cb) => {
      cb.addEventListener("change", () => {
        const id = cb.getAttribute(config.attr);

        if (cb.checked) this.state.selected[tab].add(id);
        else this.state.selected[tab].delete(id);

        cb.closest("tr")?.classList.toggle("is-selected", cb.checked);

        this.updateBulkBar(tab);
      });
    });

    this.syncSelectAll(tab);

    this.updateBulkBar(tab);
  }

  static syncSelectAll(tab) {
    const config = this.SELECTION_CONFIG[tab];

    const selectAll = document.querySelector(config.selectAll);

    if (!selectAll) return;

    selectAll.onchange = () => {
      const checked = selectAll.checked;

      const config2 = this.SELECTION_CONFIG[tab];

      document.querySelectorAll(`[${config2.attr}]`).forEach((cb) => {
        cb.checked = checked;

        const id = cb.getAttribute(config2.attr);

        if (checked) this.state.selected[tab].add(id);
        else this.state.selected[tab].delete(id);

        cb.closest("tr")?.classList.toggle("is-selected", checked);
      });

      this.updateBulkBar(tab);
    };
  }

  static updateBulkBar(tab) {
    const config = this.SELECTION_CONFIG[tab];

    if (!config) return;

    const bar = document.querySelector(config.bar);

    const count = document.querySelector(config.count);

    if (!bar) return;

    const n = this.state.selected[tab].size;

    bar.classList.toggle("st-hidden", n === 0);

    if (count) {
      count.textContent = `${n} learner${n === 1 ? "" : "s"} selected`;
    }
  }

  static rowActionsMenu(id) {
    return `
            <div class="st-row-menu" data-row-menu>
                <button type="button" class="st-row-menu-trigger" data-row-menu-trigger aria-label="More actions">
                    <span class="material-symbols-outlined">more_vert</span>
                </button>
                <div class="st-row-menu-list">
                    <button type="button" data-view-learner="${id}">
                        <span class="material-symbols-outlined">visibility</span>
                        View Learner Profile
                    </button>
                    <button type="button" data-open-module-modal="${id}">
                        <span class="material-symbols-outlined">menu_book</span>
                        Open Module Progress
                    </button>
                    <button type="button" data-assign-intervention="${id}">
                        <span class="material-symbols-outlined">support_agent</span>
                        Assign Intervention
                    </button>
                </div>
            </div>
        `;
  }

  static riskBadge(risk) {
    const cls =
      { High: "high", Moderate: "moderate", Low: "low" }[risk] || "low";
    return `<span class="st-risk-badge st-risk-badge--${cls}"><span class="st-risk-dot"></span>${risk}</span>`;
  }

  static set(selector, value) {
    const el = document.querySelector(selector);
    if (el && value !== undefined && value !== null) {
      el.textContent = value;
    }
  }
}

document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-row-menu-trigger]");

  document.querySelectorAll(".st-row-menu.is-open").forEach((menu) => {
    if (!trigger || menu !== trigger.closest(".st-row-menu")) {
      menu.classList.remove("is-open");
    }
  });

  if (trigger) {
    trigger.closest(".st-row-menu")?.classList.toggle("is-open");
  }

  const viewBtn = event.target.closest("[data-view-learner]");
  if (viewBtn) {
    window.location.href = `learner-profile.html?id=${encodeURIComponent(viewBtn.dataset.viewLearner)}`;
  }

  const assignBtn = event.target.closest("[data-assign-intervention]");
  if (assignBtn) {
    window.location.href = `learner-profile.html?id=${encodeURIComponent(assignBtn.dataset.assignIntervention)}#interventions`;
  }
});

(function bootRecordsHub() {
  let started = false;
  const start = () => {
    if (!started) {
      started = true;
      LearnerRecordsHub.init();
    }
  };
  document.addEventListener("components:loaded", start);
  document.addEventListener("DOMContentLoaded", () => setTimeout(start, 400));
})();

window.LearnerRecordsHub = LearnerRecordsHub;
