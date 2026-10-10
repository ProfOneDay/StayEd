class ModuleManagement {
  static classId = "";
  static classInfo = null;
  static strandOptions = [];
  static defaultDurationDays = 21;

  static modules = [];
  static totalLearners = 0;
  static summary = null;

  static view = "catalog"; // "catalog" | "detail"
  static activeModuleId = null;
  static roster = [];
  static selectedEnrollmentIds = new Set();

  static catalogFilters = { search: "", status: "all", sortBy: "number" };
  static catalogView = "active"; // "active" | "archived"
  static detailFilters = { search: "", stage: "all", modality: "all" };

  static async init() {
    if (window.Guards) Guards.teacher();

    const params = new URLSearchParams(window.location.search);
    this.classId = params.get("class") || "";
    const initialModuleId = params.get("module");

    await this.loadClassContext();

    if (!this.classId) {
      document.querySelector("[data-no-class-notice]").style.display = "";
      document.querySelector("[data-add-module-btn]").disabled = true;
      document.querySelector("[data-catalog-view-toggle]").style.display = "none";
      return;
    }

    document
      .querySelector("[data-add-module-btn]")
      ?.addEventListener("click", () => this.openAddModuleModal());

    document
      .querySelector("[data-catalog-view-toggle]")
      ?.addEventListener("click", () => {
        this.catalogView = this.catalogView === "archived" ? "active" : "archived";
        this.renderCatalogView(true);
      });

    await this.loadStrandsAndDuration();

    if (initialModuleId) {
      await this.openModuleDetail(Number(initialModuleId), { pushState: false });
    } else {
      await this.loadCatalog();
    }
  }

  // Mirrors learner-records-hub.js's loadClassContext() so this page shows
  // the same class-context banner (same markup/CSS) reached from the same
  // ?class=&clc= link.
  static async loadClassContext() {
    const banner = document.querySelector("[data-class-context-banner]");
    if (!this.classId || !banner) return;

    try {
      const response = await API.getTeacherClasses();
      const match = (response?.data || []).find(
        (item) => String(item.id) === String(this.classId),
      );
      if (!match) return;

      this.classInfo = match;
      banner.classList.remove("st-hidden");
      this.set("[data-class-context-clc]", match.clc);
      this.set("[data-class-context-level]", match.level);
      this.set(
        "[data-class-context-meta]",
        `${match.modality} · School Year ${match.schoolYear} · ${match.learnerCount} Enrolled Learners`,
      );
    } catch (error) {
      console.error("[ModuleManagement] Unable to load class context", error);
    }
  }

  static set(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value ?? "—";
  }

  static async loadStrandsAndDuration() {
    try {
      const [strandsResponse, durationResponse] = await Promise.all([
        API.get("/learning-strands"),
        API.getModuleDurationSetting().catch(() => null),
      ]);
      this.strandOptions = strandsResponse.data || [];
      this.defaultDurationDays = durationResponse?.defaultDurationDays || 21;
    } catch (error) {
      console.error("[ModuleManagement] Unable to load strands", error);
      this.strandOptions = [];
    }
  }

  static addDays(isoDate, days) {
    const d = new Date(`${isoDate}T00:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  // The roster only returns release/return dates as long locale strings
  // (e.g. "August 15, 2026"), not ISO -- convert back to "YYYY-MM-DD" so an
  // edit modal can prefill a native <input type="date">.
  static parseLongDate(str) {
    if (!str) return null;
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  // ==================================================================
  // Catalog view (Level 1 -- module definitions for this class)
  // ==================================================================

  static async loadCatalog() {
    this.view = "catalog";
    this.activeModuleId = null;
    document.querySelector("[data-add-module-btn]").style.display = "";
    document.querySelector("[data-catalog-view-toggle]").style.display = "";
    this.updateUrl();

    try {
      const response = await API.getClassModules(this.classId, { includeArchived: true });
      this.modules = response.data || [];
      this.totalLearners = response.totalLearners || 0;
      this.summary = response.summary || null;
      this.renderCatalogView(true);
    } catch (error) {
      console.error("[ModuleManagement] Unable to load module catalog", error);
      Toast?.error("Unable to load this class's module catalog.");
    }
  }

  // initials("Dela Cruz, Juan") -> "DJ" -- presentational only, used by the
  // detail table's learner-cell avatar.
  static initials(name) {
    return String(name || "?")
      .replace(",", "")
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  // Cards/rows settle in with a fade+rise only on a "real" render (initial
  // load, or opening/leaving a module's detail) -- not on the re-render
  // that runs on every catalog search/filter keystroke, which just needs
  // content visible immediately with no replay.
  static revealAnimated(root, animate) {
    const targets = [
      root.querySelector("[data-animate]"),
      root.querySelector("[data-animate-rows]"),
    ].filter(Boolean);
    const reveal = () => targets.forEach((el) => el.classList.add("is-inview"));
    if (animate) requestAnimationFrame(() => requestAnimationFrame(reveal));
    else reveal();
  }

  // Modules currently in the toggled view (active vs archived), before the
  // search/status/sort toolbar filters are applied -- also used for the
  // "N modules" count in the card header, so that count always matches
  // whichever tab is showing rather than the combined active+archived total.
  static modulesInView() {
    const wantArchived = this.catalogView === "archived";
    return this.modules.filter((m) => Boolean(m.isArchived) === wantArchived);
  }

  static filteredSortedModules() {
    const { search, status, sortBy } = this.catalogFilters;
    const inArchivedView = this.catalogView === "archived";
    let list = this.modulesInView().filter((m) => {
      if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (!inArchivedView && status === "released" && m.releaseStatus !== "Released") return false;
      if (!inArchivedView && status === "not_released" && m.releaseStatus !== "Not Released") return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === "status") return a.releaseStatus.localeCompare(b.releaseStatus);
      return (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0);
    });
    return list;
  }

  static renderCatalogView(animate = false) {
    const root = document.querySelector("[data-view-root]");
    if (!root) return;

    const list = this.filteredSortedModules();
    const s = this.summary || {};
    const released = s.releasedModules ?? 0;
    const notYet = s.notYetReleased ?? 0;
    const isArchivedView = this.catalogView === "archived";
    const archivedCount = this.modules.filter((m) => m.isArchived).length;

    const toggleIcon = document.querySelector("[data-catalog-view-toggle-icon]");
    if (toggleIcon) toggleIcon.textContent = isArchivedView ? "unarchive" : "archive";
    const toggleLabel = document.querySelector("[data-catalog-view-toggle-label]");
    if (toggleLabel) {
      toggleLabel.textContent = isArchivedView
        ? "View active modules"
        : `View archived${archivedCount ? ` (${archivedCount})` : ""}`;
    }

    root.innerHTML = `
      <div class="st-module-summary-row" data-animate>
        <div class="st-module-summary-stat st-module-summary-stat--total">
          <span class="st-module-summary-value">${s.totalModules ?? 0}</span>
          <span class="st-module-summary-label">Total modules</span>
        </div>
        <div class="st-module-summary-stat st-module-summary-stat--bar">
          <div class="st-release-bar" role="img" aria-label="${released} released, ${notYet} not yet released">
            <span class="rel" style="flex-grow:${released}"></span>
            <span class="not" style="flex-grow:${notYet}"></span>
          </div>
          <div class="st-release-legend">
            <span><i style="background:var(--st-secondary)"></i><b>${released}</b>released</span>
            <span><i style="background:#cfd5de"></i><b>${notYet}</b>not yet released</span>
          </div>
        </div>
        <div class="st-module-summary-stat">
          <span class="st-module-summary-value">${s.activeTransactions ?? 0}</span>
          <span class="st-module-summary-label">Active modules</span>
        </div>
        <div class="st-module-summary-stat">
          <span class="st-module-summary-value">${s.returnedTransactions ?? 0}</span>
          <span class="st-module-summary-label">Returned modules</span>
        </div>
      </div>

      <section class="st-panel st-table-card" data-catalog-panel>
        <div class="st-table-card-head">
          <h2 class="st-table-card-title">${isArchivedView ? "Archived modules" : "Module catalog"}</h2>
          <span class="st-table-card-count">${this.modulesInView().length} modules</span>
        </div>
        <div class="st-module-toolbar">
          <label class="st-search st-module-search">
            <span class="material-symbols-outlined">search</span>
            <input type="text" placeholder="Search modules" data-catalog-search value="${this.catalogFilters.search}">
          </label>
          <select class="st-select" data-catalog-status-filter ${isArchivedView ? "disabled" : ""}>
            <option value="all" ${this.catalogFilters.status === "all" ? "selected" : ""}>All statuses</option>
            <option value="released" ${this.catalogFilters.status === "released" ? "selected" : ""}>Released</option>
            <option value="not_released" ${this.catalogFilters.status === "not_released" ? "selected" : ""}>Not released</option>
          </select>
          <select class="st-select" data-catalog-sort>
            <option value="number" ${this.catalogFilters.sortBy === "number" ? "selected" : ""}>Sort by module number</option>
            <option value="status" ${this.catalogFilters.sortBy === "status" ? "selected" : ""}>Sort by status</option>
          </select>
          <button type="button" class="st-text-btn st-mm-clear-btn" data-catalog-clear>
            <span class="material-symbols-outlined">filter_list_off</span>
            Clear filters
          </button>
        </div>
        <div class="st-table-scroll">
          <table class="st-data-table st-mm-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Status</th>
                <th>${isArchivedView ? "Action" : "Learners released"}</th>
                ${isArchivedView ? "" : "<th></th>"}
              </tr>
            </thead>
            <tbody data-animate-rows>
              ${
                list.length
                  ? list.map((m, i) => this.renderCatalogRow(m, i)).join("")
                  : `<tr><td colspan="${isArchivedView ? 3 : 4}" class="st-mm-empty-cell">
                      <div class="st-empty st-empty--flush">
                        <span class="material-symbols-outlined">inventory_2</span>
                        <p class="st-empty-title">${isArchivedView ? "No archived modules" : this.modulesInView().length ? "No modules match your filters" : "No modules set up yet"}</p>
                        <p class="st-empty-text">${isArchivedView ? "Modules you archive from a class will show up here." : this.modulesInView().length ? "Try clearing the search or status filter." : "Add this class's first module (e.g. \"Module 1\") to get started."}</p>
                        ${
                          !isArchivedView && !this.modulesInView().length
                            ? `<button type="button" class="st-btn st-btn-primary st-mm-empty-add" data-empty-add-module><span class="material-symbols-outlined">add</span>Add module</button>`
                            : ""
                        }
                      </div>
                    </td></tr>`
              }
            </tbody>
          </table>
        </div>
      </section>
    `;

    root.querySelector("[data-catalog-search]")?.addEventListener("input", (e) => {
      this.catalogFilters.search = e.target.value;
      this.renderCatalogView();
    });
    root.querySelector("[data-catalog-status-filter]")?.addEventListener("change", (e) => {
      this.catalogFilters.status = e.target.value;
      this.renderCatalogView();
    });
    root.querySelector("[data-catalog-clear]")?.addEventListener("click", () => {
      this.catalogFilters = { search: "", status: "all", sortBy: "number" };
      this.renderCatalogView();
    });
    root.querySelector("[data-catalog-sort]")?.addEventListener("change", (e) => {
      this.catalogFilters.sortBy = e.target.value;
      this.renderCatalogView();
    });

    root.querySelectorAll("[data-module-row]").forEach((tr) => {
      tr.addEventListener("click", () => this.openModuleDetail(Number(tr.dataset.moduleRow)));
    });
    root.querySelector("[data-empty-add-module]")?.addEventListener("click", () => this.openAddModuleModal());
    root.querySelectorAll("[data-unarchive-module]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.unarchiveModule(Number(btn.dataset.unarchiveModule));
      });
    });

    this.revealAnimated(root, animate);
  }

  static renderCatalogRow(m, i) {
    const statusClass = m.isArchived ? "info" : this.badgeClassFor(m.releaseStatus);
    const statusLabel = m.isArchived
      ? "Archived"
      : m.releaseStatus === "Not Released"
        ? "Not released"
        : m.releaseStatus;
    const pct = m.totalLearners ? Math.round((m.releasedCount / m.totalLearners) * 100) : 0;
    const moduleCell = `
      <td data-col="learner">
        <div class="st-module-cell">
          <span class="st-module-num">${m.sequenceNumber ?? ""}</span>
          <div>
            <div class="st-module-title">${m.title}</div>
            <div class="st-module-topic"><span class="st-strand-chip">${m.strandCode || "—"}</span>${m.topic ? " " + m.topic : ""}</div>
          </div>
        </div>
      </td>
      <td data-col="status"><span class="st-badge st-badge-${statusClass}">${statusLabel}</span></td>
    `;

    if (m.isArchived) {
      return `
        <tr data-module-row="${m.id}" style="--i:${i}">
          ${moduleCell}
          <td data-col="action" class="is-right">
            <button type="button" class="st-btn st-btn-outline st-mm-unarchive-btn" data-unarchive-module="${m.id}">
              <span class="material-symbols-outlined">unarchive</span>Unarchive
            </button>
          </td>
        </tr>
      `;
    }

    return `
      <tr data-module-row="${m.id}" style="--i:${i}">
        ${moduleCell}
        <td data-col="learners">
          <div class="st-learners-cell">
            <span><b>${m.releasedCount} of ${m.totalLearners}</b> learners</span>
            <div class="st-mini-track"><i style="--w:${pct}%"></i></div>
          </div>
        </td>
        <td data-col="go" class="is-right"><span class="material-symbols-outlined st-row-go">chevron_right</span></td>
      </tr>
    `;
  }

  static openAddModuleModal() {
    if (!window.Modal) return;

    const strandOptionsHtml = this.strandOptions
      .map((s) => `<option value="${s.code}">${s.code} – ${s.name}</option>`)
      .join("");

    Modal.show({
      title: "Add module",
      size: "sm",
      confirmLabel: "Save module",
      asyncConfirm: true,
      message: `
        <div class="st-schedule-modal-field">
          <label for="amStrand">Learning strand</label>
          <select id="amStrand">
            <option value="" selected disabled>Select strand…</option>
            ${strandOptionsHtml}
          </select>
        </div>
        <div class="st-schedule-modal-field">
          <label for="amTitle">Module title <span class="required">*</span></label>
          <input id="amTitle" type="text" placeholder="e.g. Communication Skills">
        </div>
        <div class="st-schedule-modal-field">
          <label for="amTopic">Unit/topic (optional)</label>
          <input id="amTopic" type="text" placeholder="e.g. Reading Comprehension">
        </div>
        <div class="st-schedule-modal-field">
          <label for="amDescription">Description (optional)</label>
          <textarea id="amDescription" rows="3" placeholder="Notes about this module..."></textarea>
        </div>
        <p style="color:var(--st-on-surface-variant);font-size:0.8125rem;margin-top:8px;">
          This defines the module once for the whole class -- you'll choose who receives it and when from Module Details.
        </p>
      `,
      onConfirm: async () => {
        const strandCode = document.getElementById("amStrand")?.value;
        const title = document.getElementById("amTitle")?.value.trim();
        const topic = document.getElementById("amTopic")?.value.trim();
        const description = document.getElementById("amDescription")?.value.trim();
        if (!strandCode || !title) {
          Toast?.error("A learning strand and module title are required.");
          throw new Error("validation");
        }
        try {
          await API.createClassModule(this.classId, { strandCode, title, topic, description });
          Toast?.success("Module added to the catalog.");
          await this.loadCatalog();
        } catch (error) {
          console.error("[ModuleManagement] Add module failed", error);
          Toast?.error(error?.data?.message || "Unable to add this module.");
          throw error;
        }
      },
    });
  }

  static openEditModuleModal(module) {
    if (!window.Modal) return;

    const strandOptionsHtml = this.strandOptions
      .map((s) => `<option value="${s.code}" ${s.code === module.strandCode ? "selected" : ""}>${s.code} – ${s.name}</option>`)
      .join("");

    Modal.show({
      title: `Edit module ${module.sequenceNumber ?? ""}`,
      size: "sm",
      confirmLabel: "Save changes",
      asyncConfirm: true,
      message: `
        <div class="st-schedule-modal-field">
          <label for="emStrand">Learning strand</label>
          <select id="emStrand">${strandOptionsHtml}</select>
        </div>
        <div class="st-schedule-modal-field">
          <label for="emTitle">Module title</label>
          <input id="emTitle" type="text" value="${module.title}">
        </div>
        <div class="st-schedule-modal-field">
          <label for="emTopic">Unit/topic (optional)</label>
          <input id="emTopic" type="text" value="${module.topic || ""}">
        </div>
        <div class="st-schedule-modal-field">
          <label for="emDescription">Description (optional)</label>
          <textarea id="emDescription" rows="3">${module.description || ""}</textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:12px;">
          <button type="button" class="st-btn-text" data-remove-edit-module>
            <span class="material-symbols-outlined" style="font-size:1rem;vertical-align:-3px;">delete</span>
            Remove from catalog
          </button>
        </div>
      `,
      onConfirm: async () => {
        const strandCode = document.getElementById("emStrand")?.value;
        const title = document.getElementById("emTitle")?.value.trim();
        const topic = document.getElementById("emTopic")?.value.trim();
        const description = document.getElementById("emDescription")?.value.trim();
        if (!title) {
          Toast?.error("Module title cannot be blank.");
          throw new Error("validation");
        }
        try {
          await API.updateClassModule(this.classId, module.id, { strandCode, title, topic, description });
          Toast?.success("Module updated.");
          if (this.view === "detail" && this.activeModuleId === module.id) {
            await this.openModuleDetail(module.id, { pushState: false });
          } else {
            await this.loadCatalog();
          }
        } catch (error) {
          console.error("[ModuleManagement] Edit module failed", error);
          Toast?.error(error?.data?.message || "Unable to update this module.");
          throw error;
        }
      },
    });

    document.querySelector("[data-remove-edit-module]")?.addEventListener("click", () => {
      Modal.hide();
      setTimeout(() => this.confirmArchiveModule(module.id), 80);
    });
  }

  static confirmArchiveModule(classModuleId) {
    if (!window.Modal) return;
    const module = this.modules.find((m) => m.id === classModuleId);

    Modal.show({
      title: "Remove module from catalog",
      size: "sm",
      confirmLabel: "Remove module",
      asyncConfirm: true,
      message: `Remove <strong>${module?.title || "this module"}</strong> from the active catalog? Every learner's release and return history for it will be kept.`,
      onConfirm: async () => {
        try {
          await API.archiveClassModule(this.classId, classModuleId);
          Toast?.success("Module removed from the catalog.");
          await this.loadCatalog();
        } catch (error) {
          console.error("[ModuleManagement] Archive failed", error);
          Toast?.error(error?.data?.message || "Unable to archive this module.");
          throw error;
        }
      },
    });
  }

  static async unarchiveModule(classModuleId) {
    try {
      await API.unarchiveClassModule(this.classId, classModuleId);
      Toast?.success("Module restored to the active catalog.");
      await this.loadCatalog();
    } catch (error) {
      console.error("[ModuleManagement] Unarchive failed", error);
      Toast?.error(error?.data?.message || "Unable to unarchive this module.");
    }
  }

  // ==================================================================
  // Module Detail view (Level 2 -- module-first student list, Section 8)
  // ==================================================================

  static async openModuleDetail(classModuleId, { pushState = true } = {}) {
    this.view = "detail";
    this.activeModuleId = classModuleId;
    this.selectedEnrollmentIds = new Set();
    this.detailFilters = { search: "", stage: "all", modality: "all" };
    document.querySelector("[data-add-module-btn]").style.display = "none";
    document.querySelector("[data-catalog-view-toggle]").style.display = "none";

    if (pushState) this.updateUrl();

    // Always refresh the module's own catalog metadata (title/strand/topic/
    // etc) -- both for a direct deep link where the catalog was never
    // loaded, and after an edit, so the detail header can't show a stale
    // title/strand from before the edit.
    try {
      const response = await API.getClassModules(this.classId, { includeArchived: true });
      this.modules = response.data || [];
      this.totalLearners = response.totalLearners || 0;
      this.summary = response.summary || null;
    } catch (error) {
      console.error("[ModuleManagement] Unable to load module catalog", error);
    }

    await this.loadRoster({ resetSelection: true, animate: true });
  }

  static async loadRoster({ resetSelection = false, animate = false } = {}) {
    try {
      const [rosterResponse, catalogResponse] = await Promise.all([
        API.getClassModuleRoster(this.classId, this.activeModuleId),
        // Also refresh the module's own catalog entry -- a release/return
        // changes its releasedCount/returnedCount/releaseStatus, and the
        // detail header (Overall Status badge) reads from `this.modules`,
        // not from the roster response, so skipping this left the header
        // showing a stale status right after a release/return.
        API.getClassModules(this.classId, { includeArchived: true }),
      ]);
      this.roster = rosterResponse.data || [];
      this.modules = catalogResponse.data || [];
      this.totalLearners = catalogResponse.totalLearners || 0;
      this.summary = catalogResponse.summary || null;
      // "Select All Students" is the default: every learner who hasn't
      // received this module yet starts pre-selected, so a teacher can
      // release to everyone with no extra clicks and only has to
      // deselect the exceptions. Only reset on a fresh open of this
      // module (not after every roster refresh), so manual deselections
      // made mid-session survive a release/return/undo refresh.
      if (resetSelection) {
        this.selectedEnrollmentIds = new Set(
          this.roster.filter((r) => this.stageFor(r) === "Not Released").map((r) => r.enrollmentId),
        );
      }
      this.renderDetailView(animate);
    } catch (error) {
      console.error("[ModuleManagement] Unable to load roster", error);
      Toast?.error("Unable to load this module's student list.");
    }
  }

  // Single source of truth for status/stage colors, so "Released" (etc.)
  // is never a different color depending on which table it's shown in.
  // Not Released = info (blue), Released = warning (amber, still pending
  // a return), Returned = success (green, the only "fully done" state --
  // module-level status has no equivalent, since a module itself doesn't
  // get "returned").
  static badgeClassFor(label) {
    if (label === "Returned") return "success";
    if (label === "Released") return "warning";
    return "info";
  }

  static stageFor(r) {
    if (r.returned) return "Returned";
    if (r.released) return "Released";
    return "Not Released";
  }

  static filteredRoster() {
    const { search, stage, modality } = this.detailFilters;
    return this.roster.filter((r) => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (stage !== "all" && this.stageFor(r) !== stage) return false;
      if (modality !== "all" && r.modality !== modality) return false;
      return true;
    });
  }

  static renderDetailView(animate = false) {
    const root = document.querySelector("[data-view-root]");
    if (!root) return;

    const module = this.modules.find((m) => m.id === this.activeModuleId);
    const list = this.filteredRoster();
    const selectedCount = this.selectedEnrollmentIds.size;
    // Only "Not Released" rows carry a checkbox at all (see renderDetailRow),
    // so "select all" only ever targets those -- and only within the
    // currently filtered/visible list, matching normal table select-all
    // behavior when a search/stage filter is active.
    const releasableIds = list.filter((r) => this.stageFor(r) === "Not Released").map((r) => r.enrollmentId);
    const allSelected = releasableIds.length > 0 && releasableIds.every((id) => this.selectedEnrollmentIds.has(id));

    // Stage summary bar: counts from the FULL roster (not the filtered
    // list), so it always reflects the whole module regardless of the
    // active search/stage/modality filter.
    const notCount = this.roster.filter((r) => this.stageFor(r) === "Not Released").length;
    const relCount = this.roster.filter((r) => this.stageFor(r) === "Released").length;
    const retCount = this.roster.filter((r) => this.stageFor(r) === "Returned").length;

    root.innerHTML = `
      <button type="button" class="st-back-link" data-back-to-catalog>
        <span class="material-symbols-outlined">arrow_back</span>All modules
      </button>
      <section class="st-panel st-table-card" data-animate>
        <div class="st-module-detail-header">
          <div>
            <h2 class="st-module-detail-title">
              <span class="st-module-num">${module?.sequenceNumber ?? ""}</span>${module?.title || ""}
            </h2>
            <p class="st-module-detail-meta">
              <span class="st-strand-chip">${module?.strandCode || "—"}</span>
              ${module?.topic ? `Topic: ${module.topic}<span>·</span>` : ""}
              <span class="st-badge st-badge-${this.badgeClassFor(module?.releaseStatus)}">${module?.releaseStatus === "Not Released" ? "Not released" : module?.releaseStatus || "—"}</span>
            </p>
          </div>
          <div class="st-table-actions">
            <button type="button" class="st-btn st-btn-outline st-btn-sm" data-edit-active-module><span class="material-symbols-outlined">edit</span>Edit module</button>
            <button type="button" class="st-btn st-btn-primary st-btn-sm" data-release-selected ${selectedCount ? "" : "disabled"}>
              <span class="material-symbols-outlined">send</span>Release${selectedCount ? ` (${selectedCount})` : ""}
            </button>
            <button type="button" class="st-btn-danger-text" data-archive-active-module><span class="material-symbols-outlined">archive</span>Archive</button>
          </div>
        </div>

        <div class="st-stage-summary">
          <div class="st-stage-bar" role="img" aria-label="${notCount} not released, ${relCount} released, ${retCount} returned">
            <span class="not" style="flex-grow:${notCount}"></span>
            <span class="rel" style="flex-grow:${relCount}"></span>
            <span class="ret" style="flex-grow:${retCount}"></span>
          </div>
          <div class="st-stage-legend">
            <span><i style="background:#cfd5de"></i><b>${notCount}</b> not released</span>
            <span><i style="background:#f39422"></i><b>${relCount}</b> released</span>
            <span><i style="background:var(--st-secondary)"></i><b>${retCount}</b> returned</span>
          </div>
        </div>

        <div class="st-module-toolbar">
          <label class="st-search st-module-search">
            <span class="material-symbols-outlined">search</span>
            <input type="text" placeholder="Search learners" data-detail-search value="${this.detailFilters.search}">
          </label>
          <select class="st-select" data-detail-stage-filter>
            <option value="all" ${this.detailFilters.stage === "all" ? "selected" : ""}>All stages</option>
            <option value="Not Released" ${this.detailFilters.stage === "Not Released" ? "selected" : ""}>Not released</option>
            <option value="Released" ${this.detailFilters.stage === "Released" ? "selected" : ""}>Released</option>
            <option value="Returned" ${this.detailFilters.stage === "Returned" ? "selected" : ""}>Returned</option>
          </select>
          <select class="st-select" data-detail-modality-filter>
            <option value="all" ${this.detailFilters.modality === "all" ? "selected" : ""}>All modalities</option>
            <option value="Face-to-Face" ${this.detailFilters.modality === "Face-to-Face" ? "selected" : ""}>Face-to-Face</option>
            <option value="Modular" ${this.detailFilters.modality === "Modular" ? "selected" : ""}>Modular</option>
            <option value="Blended" ${this.detailFilters.modality === "Blended" ? "selected" : ""}>Blended</option>
          </select>
        </div>

        <div class="st-table-scroll">
          <table class="st-data-table st-mm-table st-mm-table--detail">
            <thead>
              <tr>
                <th class="checkbox-col">
                  ${
                    releasableIds.length
                      ? `<input type="checkbox" data-select-all-learners title="Select all students" ${allSelected ? "checked" : ""}>`
                      : ""
                  }
                </th>
                <th>Learner</th>
                <th>Modality</th>
                <th>Stage</th>
                <th>Dates</th>
                <th class="is-right">Action</th>
              </tr>
            </thead>
            <tbody data-animate-rows>
              ${
                list.length
                  ? list.map((r, i) => this.renderDetailRow(r, i)).join("")
                  : `<tr><td colspan="6" style="padding:0">
                      <div class="st-empty st-empty--flush">
                        <span class="material-symbols-outlined">group_off</span>
                        <p class="st-empty-title">No learners match your filters</p>
                      </div>
                    </td></tr>`
              }
            </tbody>
          </table>
        </div>
      </section>
    `;

    root.querySelector("[data-back-to-catalog]")?.addEventListener("click", () => this.loadCatalog());
    root.querySelector("[data-edit-active-module]")?.addEventListener("click", () => {
      if (module) this.openEditModuleModal(module);
    });
    root.querySelector("[data-archive-active-module]")?.addEventListener("click", () => {
      if (module) this.confirmArchiveModule(module.id);
    });

    root.querySelector("[data-detail-search]")?.addEventListener("input", (e) => {
      this.detailFilters.search = e.target.value;
      this.renderDetailView();
    });
    root.querySelector("[data-detail-stage-filter]")?.addEventListener("change", (e) => {
      this.detailFilters.stage = e.target.value;
      this.renderDetailView();
    });
    root.querySelector("[data-detail-modality-filter]")?.addEventListener("change", (e) => {
      this.detailFilters.modality = e.target.value;
      this.renderDetailView();
    });

    root.querySelector("[data-select-all-learners]")?.addEventListener("change", (e) => {
      if (e.target.checked) releasableIds.forEach((id) => this.selectedEnrollmentIds.add(id));
      else releasableIds.forEach((id) => this.selectedEnrollmentIds.delete(id));
      this.renderDetailView();
    });

    root.querySelectorAll("[data-select-learner]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const id = Number(cb.dataset.selectLearner);
        if (cb.checked) this.selectedEnrollmentIds.add(id);
        else this.selectedEnrollmentIds.delete(id);
        this.renderDetailView();
      });
    });

    root.querySelector("[data-release-selected]")?.addEventListener("click", () => {
      this.openReleaseModal([...this.selectedEnrollmentIds]);
    });

    root.querySelectorAll("[data-release-one]").forEach((btn) => {
      btn.addEventListener("click", () => this.openReleaseModal([Number(btn.dataset.releaseOne)]));
    });

    root.querySelectorAll("[data-return-one]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const r = this.roster.find((row) => row.enrollmentId === Number(btn.dataset.returnOne));
        if (r) this.openReturnModal(r);
      });
    });

    root.querySelectorAll("[data-edit-release-date]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const r = this.roster.find((row) => row.enrollmentId === Number(btn.dataset.editReleaseDate));
        if (r) this.openEditReleaseDateModal(r);
      });
    });

    root.querySelectorAll("[data-undo-return]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const r = this.roster.find((row) => row.enrollmentId === Number(btn.dataset.undoReturn));
        if (r) this.confirmUndoReturn(r);
      });
    });

    this.revealAnimated(root, animate);
  }

  static renderDetailRow(r, i) {
    const stage = this.stageFor(r);
    const badgeClass = this.badgeClassFor(stage);
    const checked = this.selectedEnrollmentIds.has(r.enrollmentId) ? "checked" : "";

    let actionHtml = "";
    if (stage === "Not Released") {
      actionHtml = `<button type="button" class="st-btn st-btn-outline st-btn-xs" data-release-one="${r.enrollmentId}">Release</button>`;
    } else if (stage === "Released") {
      actionHtml = `<button type="button" class="st-btn st-btn-primary st-btn-xs" data-return-one="${r.enrollmentId}"><span class="material-symbols-outlined" style="font-size:17px">assignment_return</span>Mark as returned</button>`;
    } else if (stage === "Returned") {
      actionHtml = `<button type="button" class="st-btn-text" data-undo-return="${r.enrollmentId}"><span class="material-symbols-outlined" style="font-size:17px;vertical-align:-4px">undo</span>Undo</button>`;
    }

    const releaseDateHtml = r.releaseDate
      ? `${r.releaseDate} <button type="button" class="st-icon-btn-sm st-icon-btn-sm--tiny" data-edit-release-date="${r.enrollmentId}" title="Edit release date">
          <span class="material-symbols-outlined">edit</span>
        </button>`
      : "—";

    return `
      <tr style="--i:${i}" class="${checked ? "is-selected" : ""}">
        <td class="checkbox-col" data-col="select">${stage === "Not Released" ? `<input type="checkbox" data-select-learner="${r.enrollmentId}" ${checked}>` : ""}</td>
        <td data-col="learner"><button type="button" class="st-qv-trigger st-learner-cell" data-learner-preview="${r.learnerId}" aria-haspopup="dialog" aria-label="Preview ${r.name}'s profile"><span class="st-avatar-initials">${this.initials(r.name)}</span><span class="st-module-title">${r.name}</span></button></td>
        <td data-col="modality">${this.modalityPill(r.modality)}</td>
        <td data-col="stage"><span class="st-badge st-badge-${badgeClass}">${stage === "Not Released" ? "Not released" : stage}</span></td>
        <td data-col="dates"><div class="st-date-cell"><span>Released ${releaseDateHtml}</span><span class="st-muted">Returned ${r.returnDate || "—"}</span></div></td>
        <td data-col="actions" class="is-right">${actionHtml}</td>
      </tr>
    `;
  }

  // Same pill styling as the teacher dashboard's learner registry
  // (dashboard.js modalityPill), so a learner's modality reads the same way
  // across pages.
  static modalityPill(modality) {
    const teal = modality === "Modular" ? " st-pill--teal" : "";
    return `<span class="st-pill${teal}">${modality || "—"}</span>`;
  }

  static openReleaseModal(enrollmentIds) {
    if (!window.Modal || !enrollmentIds.length) return;

    const today = new Date().toISOString().slice(0, 10);
    const plannedReturn = this.addDays(today, this.defaultDurationDays);
    const candidates = enrollmentIds
      .map((id) => this.roster.find((r) => r.enrollmentId === id))
      .filter(Boolean);

    // For a single learner (the per-row "Release" button) a plain name is
    // enough. For a batch (the header "Release" button / bulk select) show
    // an actual checklist -- defaulting every row to checked, matching
    // "select all" being the default -- so a teacher can still deselect a
    // specific student right before confirming, without leaving the modal.
    const recipientsHtml =
      candidates.length > 1
        ? `
          <div class="st-schedule-modal-field">
            <label>Students receiving this module</label>
            <div class="st-roster-checklist" id="rmChecklist">
              <div class="st-roster-checklist-row" style="font-weight:600;">
                <input type="checkbox" id="rmSelectAll" checked>
                <label for="rmSelectAll" style="cursor:pointer;margin:0;font-weight:600;">Select all (${candidates.length})</label>
              </div>
              ${candidates
                .map(
                  (r) => `
                <div class="st-roster-checklist-row">
                  <input type="checkbox" id="rmStudent${r.enrollmentId}" data-rm-student="${r.enrollmentId}" checked>
                  <label for="rmStudent${r.enrollmentId}" style="cursor:pointer;margin:0;">${r.name}</label>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
        `
        : `<p style="color:var(--st-on-surface-variant);font-size:0.875rem;">${candidates[0]?.name || ""}</p>`;

    Modal.show({
      title: candidates.length === 1 ? "Release module" : `Release module to ${candidates.length} learners`,
      size: "sm",
      confirmLabel: "Confirm release",
      asyncConfirm: true,
      message: `
        ${recipientsHtml}
        <div class="st-schedule-modal-field">
          <label for="rmReleaseDate">Release date</label>
          <input type="date" id="rmReleaseDate" value="${today}" max="${today}">
        </div>
        <div class="st-schedule-modal-field">
          <label for="rmPlannedReturn">Planned return date</label>
          <input type="date" id="rmPlannedReturn" value="${plannedReturn}">
          <p class="st-mrf-subtitle" style="margin-top:4px;">
            Auto-suggested (${this.defaultDurationDays} days from release). Adjust if needed.
          </p>
        </div>
        <div class="st-schedule-modal-field">
          <label for="rmNotes">Notes (optional)</label>
          <input type="text" id="rmNotes" placeholder="Optional notes for this release">
        </div>
      `,
      onConfirm: async () => {
        const releaseDate = document.getElementById("rmReleaseDate")?.value;
        const plannedReturnDate = document.getElementById("rmPlannedReturn")?.value;
        const studentCheckboxes = document.querySelectorAll("[data-rm-student]");
        const targetIds = studentCheckboxes.length
          ? [...studentCheckboxes].filter((cb) => cb.checked).map((cb) => Number(cb.dataset.rmStudent))
          : enrollmentIds;
        if (!targetIds.length) {
          Toast?.error("Select at least one student to release to.");
          throw new Error("validation");
        }
        try {
          const response = await API.releaseClassModule(this.classId, this.activeModuleId, {
            releaseDate,
            plannedReturnDate,
            learnerIds: targetIds,
          });
          Toast?.success(response?.message || "Module released.");
          this.selectedEnrollmentIds.clear();
          await this.loadRoster();
        } catch (error) {
          console.error("[ModuleManagement] Release failed", error);
          Toast?.error(error?.data?.message || "Unable to release this module.");
          throw error;
        }
      },
    });

    document.getElementById("rmSelectAll")?.addEventListener("change", (e) => {
      document.querySelectorAll("[data-rm-student]").forEach((cb) => {
        cb.checked = e.target.checked;
      });
    });
    document.getElementById("rmChecklist")?.addEventListener("change", (e) => {
      if (!e.target.matches("[data-rm-student]")) return;
      const all = [...document.querySelectorAll("[data-rm-student]")];
      const selectAll = document.getElementById("rmSelectAll");
      if (selectAll) selectAll.checked = all.every((cb) => cb.checked);
    });
  }

  static openEditReleaseDateModal(rosterRow) {
    if (!window.Modal) return;
    const today = new Date().toISOString().slice(0, 10);
    const current = this.parseLongDate(rosterRow.releaseDate) || today;

    Modal.show({
      title: "Edit release date",
      size: "sm",
      confirmLabel: "Save changes",
      asyncConfirm: true,
      message: `
        <p style="color:var(--st-on-surface-variant);font-size:0.875rem;">${rosterRow.name}</p>
        <div class="st-schedule-modal-field">
          <label for="erdReleaseDate">Release date</label>
          <input type="date" id="erdReleaseDate" value="${current}" max="${today}">
        </div>
        <p class="st-mrf-subtitle" style="margin-top:4px;">
          This corrects the recorded release date -- it will also update the
          return date's minimum bound for any modules released together in
          the same batch.
        </p>
      `,
      onConfirm: async () => {
        const releaseDate = document.getElementById("erdReleaseDate")?.value;
        if (!releaseDate) {
          Toast?.error("Please choose a release date.");
          throw new Error("validation");
        }
        try {
          await API.editModuleBatch(rosterRow.learnerId, rosterRow.releaseBatchId, { releaseDate });
          Toast?.success("Release date updated.");
          await this.loadRoster();
        } catch (error) {
          console.error("[ModuleManagement] Edit release date failed", error);
          Toast?.error(error?.data?.message || "Unable to update the release date.");
          throw error;
        }
      },
    });
  }

  static openReturnModal(rosterRow) {
    if (!window.Modal) return;
    const today = new Date().toISOString().slice(0, 10);

    Modal.show({
      title: "Mark as returned",
      size: "sm",
      confirmLabel: "Confirm return",
      asyncConfirm: true,
      message: `
        <p style="color:var(--st-on-surface-variant);font-size:0.875rem;">${rosterRow.name}</p>
        <div class="st-schedule-modal-field">
          <label for="rtReturnDate">Return date</label>
          <input type="date" id="rtReturnDate" value="${today}" max="${today}">
        </div>
      `,
      onConfirm: async () => {
        const returnDate = document.getElementById("rtReturnDate")?.value;
        try {
          await API.returnModuleBatch(rosterRow.learnerId, rosterRow.releaseBatchId, {
            moduleIds: [rosterRow.moduleRecordId],
            returnDate,
          });
          Toast?.success("Module marked as returned.");
          await this.loadRoster();
        } catch (error) {
          console.error("[ModuleManagement] Return failed", error);
          Toast?.error(error?.data?.message || "Unable to record this return.");
          throw error;
        }
      },
    });
  }

  static confirmUndoReturn(rosterRow) {
    if (!window.Modal) return;

    Modal.show({
      title: "Undo return?",
      size: "sm",
      confirmLabel: "Undo return",
      asyncConfirm: true,
      message: `
        <p><strong>${rosterRow.name}</strong></p>
        <p style="color:var(--st-on-surface-variant);font-size:0.875rem;margin-top:8px;">
          This will revert this module back to "Released" for this learner (returned on ${rosterRow.returnDate}). Use this if the return was recorded by mistake.
        </p>
      `,
      onConfirm: async () => {
        try {
          await API.undoModuleReturn(rosterRow.learnerId, rosterRow.releaseBatchId, {
            moduleIds: [rosterRow.moduleRecordId],
          });
          Toast?.success("Return undone.");
          await this.loadRoster();
        } catch (error) {
          console.error("[ModuleManagement] Undo return failed", error);
          Toast?.error(error?.data?.message || "Unable to undo this return.");
          throw error;
        }
      },
    });
  }

  static updateUrl() {
    const params = new URLSearchParams(window.location.search);
    if (this.activeModuleId) params.set("module", this.activeModuleId);
    else params.delete("module");
    history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }
}

window.ModuleManagement = ModuleManagement;

document.addEventListener("components:loaded", () => {
  ModuleManagement.init();
});
