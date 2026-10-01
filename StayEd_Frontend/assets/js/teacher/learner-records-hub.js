const LEARNER_RECORDS_REDUCE_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    document
      .querySelector("[data-assessment-scores-link]")
      ?.setAttribute("href", `assessment-scores.html${search}`);

    // Module Management is class-scoped (a per-class module catalog), so it
    // only makes sense -- and is only shown -- once a specific class is
    // selected, same gating as the class-context banner below.
    const manageModulesLink = document.querySelector("[data-manage-modules-link]");
    if (classId && manageModulesLink) {
      manageModulesLink.setAttribute("href", `module-management.html${search}`);
      manageModulesLink.classList.remove("st-hidden");
    }

    if (!classId || !banner) return;

    const findClass = async () => {
      const response = await API.getTeacherClasses();
      return (response?.data || []).find(
        (item) => String(item.id) === String(classId),
      );
    };

    let match;
    try {
      match = await findClass();
    } catch (error) {
      console.error("[LearnerRecordsHub] Unable to load class context", error);
      // One retry -- a slow/transient request shouldn't permanently hide
      // the banner for the rest of the session.
      try {
        match = await findClass();
      } catch (retryError) {
        console.error(
          "[LearnerRecordsHub] Retry failed to load class context",
          retryError,
        );
        return;
      }
    }

    if (!match) return;

    banner.classList.remove("st-hidden");
    this.set("[data-class-context-clc]", match.clc);
    this.set("[data-class-context-level]", match.level);
    this.set(
      "[data-class-context-meta]",
      `${match.modality} · School Year ${match.schoolYear} · ${match.learnerCount} Enrolled Learners`,
    );
    this.set(
      "[data-records-subtitle]",
      `Viewing records for ${match.clc}, ${match.level} (SY ${match.schoolYear}).`,
    );
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
      colspan: 5,
      rowRenderer: (l, i) => this.modularRow(l, i),
    });
  }

  static modularRow(l, i) {
    return `<tr style="--i:${i}">${this.recordCells(l)}<td class="is-right" data-col="menu">${this.rowActionsMenu(l)}</td></tr>`;
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
      rowRenderer: (l, i) => this.f2fRow(l, i),
    });
  }

  static f2fRow(l, i) {
    return `<tr style="--i:${i}">${this.recordCells(l)}<td class="is-right" data-col="menu">${this.rowActionsMenu(l)}</td></tr>`;
  }

  static renderBlended() {
    const rows = this.filteredForModality("Blended");

    this.renderTable({
      rows,
      bodySelector: "[data-blended-body]",
      infoSelector: "[data-blended-info]",
      pagesSelector: "[data-blended-pages]",
      pageKey: "blended",
      colspan: 5,
      rowRenderer: (l, i) => this.blendedRow(l, i),
    });
  }

  static blendedRow(l, i) {
    return `<tr style="--i:${i}">${this.recordCells(l)}<td class="is-right" data-col="menu">${this.rowActionsMenu(l)}</td></tr>`;
  }

  // Shared cell markup for LRN / Learner / Modules / Latest Activity / Risk
  // Level \u2014 kept identical across all three modality tables so only the
  // underlying data (and each tab's "Latest ..." column header) differs.
  static formatDisplayName(learner) {
    // Prefer the backend's own first_name/last_name -- they're the source
    // of truth and can't be mis-split, unlike re-deriving from the
    // combined `name` string by guessing "last whitespace token = surname"
    // (which mangles any multi-word surname, e.g. "Dela Cruz", "Santos
    // Reyes" -- common in Filipino names).
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

  static recordCells(l) {
    const initials = (l.name || "?")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    const avatarCls = { High: " st-avatar-initials--high", Moderate: " st-avatar-initials--moderate" }[l.risk] || "";

    return `
            <td data-col="learner">
                <div class="st-learner-cell">
                    <span class="st-avatar-initials${avatarCls}">${initials}</span>
                    <div style="min-width:0">
                        <button type="button" class="st-learner-name" tabindex="-1">${this.formatDisplayName(l)}</button>
                        <p class="st-learner-id">LRN <span class="num">${l.lrn}</span></p>
                    </div>
                </div>
            </td>
            <td data-col="modules">${this.modulesCell(l)}</td>
            <td data-col="activity">${this.activityCell(l)}</td>
            <td data-col="risk">${this.riskBadge(l.risk)}</td>
        `;
  }

  static modulesCell(l) {
    const m = l.modules || {};

    const pct = Math.round((m.completed / m.total) * 100) || 0;

    return `
            <div class="st-progress-cell">
                <div class="st-progress-cell-top"><span><b class="num">${m.completed} of ${m.total}</b> returned</span><span class="num">${m.total ? pct + "%" : ""}</span></div>
                <div class="st-progress-track">
                    <div class="st-progress-fill st-progress-fill--primary" style="--w:${pct}%;width:${pct}%;"></div>
                </div>
                <button type="button" class="st-progress-link" data-open-module-modal="${l.id}">
                    View logbook
                    <span class="material-symbols-outlined">arrow_forward</span>
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
            <div class="st-activity${l.activity_status === "none" ? " st-activity--none" : ""}">
                <span class="st-consult-dot ${dotClass}"></span>
                <span>${l.activity_text || "\u2014"}</span>
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

    body.classList.remove("is-inview");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => body.classList.add("is-inview")),
    );

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
                <span class="material-symbols-outlined" style="font-size:1rem;">chevron_left</span>
            </button>
        `;

    for (let p = 1; p <= pages; p++) {
      html += `<button class="st-page-btn ${p === current ? "is-active" : ""}" data-go="${p}">${p}</button>`;
    }

    html += `
            <button class="st-page-btn" ${current === pages ? "disabled" : ""} data-next>
                <span class="material-symbols-outlined" style="font-size:1rem;">chevron_right</span>
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
                        View learner profile
                    </button>
                    <button type="button" data-open-module-modal="${id}">
                        <span class="material-symbols-outlined">menu_book</span>
                        Open module progress
                    </button>
                    ${showSchedule ? `
                    <button type="button" data-open-schedule-modal="${id}">
                        <span class="material-symbols-outlined">event</span>
                        Set schedule
                    </button>
                    ` : ""}
                    ${showConsultation ? `
                    <button type="button" data-open-consultation-modal="${id}">
                        <span class="material-symbols-outlined">support</span>
                        Record consultation
                    </button>
                    ` : ""}
                    <button type="button" data-assign-intervention="${id}">
                        <span class="material-symbols-outlined">support_agent</span>
                        Assign intervention
                    </button>
                </div>
            </div>
        `;
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
