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
  };

  static async init() {
    if (window.Guards) Guards.teacher();

    await this.loadClassContext();

    this.bindTabs();

    this.bindFilters();

    await this.load();
  }

  static async loadClassContext() {
    const params = new URLSearchParams(window.location.search);
    const classId = params.get("class");
    const clcName = params.get("clc");
    const banner = document.querySelector("[data-class-context-banner]");

    this.state.classId = classId || "";
    if (clcName) this.state.clc = clcName;

    // Carry the current ?class=&clc= context onto Import/Enroll so their
    // Back buttons can return here to the same class instead of the
    // unfiltered Learner Records view.
    const search = window.location.search;
    document
      .querySelector("[data-import-link]")
      ?.setAttribute("href", `learner-import.html${search}`);
    document
      .querySelector("[data-enroll-link]")
      ?.setAttribute("href", `learner-enroll.html${search}`);

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

  static async refreshLearnerRow(learnerId) {
    try {
      const [learner, detail] = await Promise.all([
        API.getLearner(learnerId),
        API.getLearnerRecordsDetail(learnerId),
      ]);

      const merged = { ...learner, ...detail };

      const index = this.state.all.findIndex(
        (x) => String(x.id) === String(learnerId),
      );

      if (index === -1) {
        this.state.all.push(merged);
      } else {
        this.state.all[index] = merged;
      }

      this.renderActiveTab();
    } catch (error) {
      console.error("[LearnerRecordsHub] Unable to refresh learner row", error);
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
      colspan: 6,
      rowRenderer: (l) => this.modularRow(l),
    });
  }

  static modularRow(l) {
    return `<tr>${this.recordCells(l)}<td class="is-center">${this.rowActionsMenu(l)}</td></tr>`;
  }

  static renderF2F() {
    const rows = this.filteredForModality("Face-to-Face");

    this.renderTable({
      rows,
      bodySelector: "[data-f2f-body]",
      infoSelector: "[data-f2f-info]",
      pagesSelector: "[data-f2f-pages]",
      pageKey: "face-to-face",
      colspan: 6,
      rowRenderer: (l) => this.f2fRow(l),
    });
  }

  static f2fRow(l) {
    return `<tr>${this.recordCells(l)}<td class="is-center">${this.rowActionsMenu(l)}</td></tr>`;
  }

  static renderBlended() {
    const rows = this.filteredForModality("Blended");

    this.renderTable({
      rows,
      bodySelector: "[data-blended-body]",
      infoSelector: "[data-blended-info]",
      pagesSelector: "[data-blended-pages]",
      pageKey: "blended",
      colspan: 6,
      rowRenderer: (l) => this.blendedRow(l),
    });
  }

  static blendedRow(l) {
    return `<tr>${this.recordCells(l)}<td class="is-center">${this.rowActionsMenu(l)}</td></tr>`;
  }

  // Shared cell markup for LRN / Learner / Modules / Latest Activity / Risk
  // Level \u2014 kept identical across all three modality tables so only the
  // underlying data (and each tab's "Latest ..." column header) differs.
  static recordCells(l) {
    return `
            <td style="font-family:monospace;font-size:12px;color:var(--st-on-surface-variant);">${l.lrn}</td>
            <td style="font-weight:600;color:var(--st-on-surface);">${l.name}</td>
            <td>${this.modulesCell(l)}</td>
            <td>${this.activityCell(l)}</td>
            <td>${this.riskBadge(l.risk)}</td>
        `;
  }

  static modulesCell(l) {
    const m = l.modules || {};

    const pct = Math.round((m.completed / m.total) * 100) || 0;

    return `
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
        `;
  }

  static activityCell(l) {
    const dotClass =
      l.activity_status === "danger"
        ? "st-consult-dot--danger"
        : l.activity_status === "warning"
          ? "st-consult-dot--warning"
          : l.activity_status === "none"
            ? "st-consult-dot--none"
            : "st-consult-dot--ok";

    return `
            <div style="display:flex;align-items:center;gap:6px;">
                <span class="st-consult-dot ${dotClass}"></span>
                <span style="font-size:13px;">${l.activity_text || "\u2014"}</span>
            </div>
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
          ModuleManagementModal.open(learner, () => this.refreshLearnerRow(id));
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
       container.querySelectorAll("[data-open-consultation-modal]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.openConsultationModal;
        const learner = this.state.all.find((x) => String(x.id) === String(id));
        if (learner && window.ConsultationModal) {
          ConsultationModal.open(learner);
        }
      });
    });

  }

    static rowActionsMenu(l) {
    const id = l.id;
    const showConsultation = l.modality !== "Modular";
    const showSchedule = l.modality !== "Modular";
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
                    ${showSchedule ? `
                    <button type="button" data-open-schedule-modal="${id}">
                        <span class="material-symbols-outlined">event</span>
                        Set Schedule
                    </button>
                    ` : ""}
                    ${showConsultation ? `
                    <button type="button" data-open-consultation-modal="${id}">
                        <span class="material-symbols-outlined">support</span>
                        Record Consultation
                    </button>
                    ` : ""}
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
      { High: "high", Moderate: "moderate", Low: "low" }[risk] || "neutral";
    return `<span class="st-risk-badge st-risk-badge--${cls}"><span class="st-risk-dot"></span>${risk || "Not Yet Assessed"}</span>`;
  }

  static set(selector, value) {
    const el = document.querySelector(selector);
    if (el && value !== undefined && value !== null) {
      el.textContent = value;
    }
  }
}

function closeOpenRowMenus() {
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

  const viewBtn = event.target.closest("[data-view-learner]");
  if (viewBtn) {
    window.location.href = `learner-profile.html?id=${encodeURIComponent(viewBtn.dataset.viewLearner)}`;
  }

  const assignBtn = event.target.closest("[data-assign-intervention]");
  if (assignBtn) {
    window.location.href = `learner-profile.html?id=${encodeURIComponent(assignBtn.dataset.assignIntervention)}&tab=interventions`;
  }
});

window.addEventListener("scroll", closeOpenRowMenus, true);

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
