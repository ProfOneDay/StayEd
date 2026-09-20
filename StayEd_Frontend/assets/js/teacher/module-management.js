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
      return;
    }

    document
      .querySelector("[data-add-module-btn]")
      ?.addEventListener("click", () => this.openAddModuleModal());

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
    this.updateUrl();

    try {
      const response = await API.getClassModules(this.classId);
      this.modules = response.data || [];
      this.totalLearners = response.totalLearners || 0;
      this.summary = response.summary || null;
      this.renderCatalogView();
    } catch (error) {
      console.error("[ModuleManagement] Unable to load module catalog", error);
      Toast?.error("Unable to load this class's module catalog.");
    }
  }

  static filteredSortedModules() {
    const { search, status, sortBy } = this.catalogFilters;
    let list = this.modules.filter((m) => {
      if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (status === "released" && m.releaseStatus !== "Released") return false;
      if (status === "not_released" && m.releaseStatus !== "Not Released") return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === "status") return a.releaseStatus.localeCompare(b.releaseStatus);
      return (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0);
    });
    return list;
  }

  static renderCatalogView() {
    const root = document.querySelector("[data-view-root]");
    if (!root) return;

    const list = this.filteredSortedModules();
    const s = this.summary || {};

    root.innerHTML = `
      <div class="st-module-summary-row">
        <div class="st-module-summary-stat">
          <span class="st-module-summary-value">${s.totalModules ?? 0}</span>
          <span class="st-module-summary-label">Total Modules</span>
        </div>
        <div class="st-module-summary-stat">
          <span class="st-module-summary-value">${s.releasedModules ?? 0}</span>
          <span class="st-module-summary-label">Released</span>
        </div>
        <div class="st-module-summary-stat">
          <span class="st-module-summary-value">${s.notYetReleased ?? 0}</span>
          <span class="st-module-summary-label">Not Yet Released</span>
        </div>
        <div class="st-module-summary-stat">
          <span class="st-module-summary-value">${s.activeTransactions ?? 0}</span>
          <span class="st-module-summary-label">Active Transactions</span>
        </div>
        <div class="st-module-summary-stat">
          <span class="st-module-summary-value">${s.returnedTransactions ?? 0}</span>
          <span class="st-module-summary-label">Returned Transactions</span>
        </div>
      </div>

      <div class="st-panel" data-catalog-panel>
        <div class="st-panel-head st-panel-head--flush">
          <h4 class="st-panel-title">Module Catalog</h4>
        </div>
        <div class="st-module-toolbar">
          <div class="st-search st-module-search">
            <span class="material-symbols-outlined">search</span>
            <input type="text" placeholder="Search modules..." data-catalog-search value="${this.catalogFilters.search}">
          </div>
          <select data-catalog-status-filter>
            <option value="all" ${this.catalogFilters.status === "all" ? "selected" : ""}>All Statuses</option>
            <option value="released" ${this.catalogFilters.status === "released" ? "selected" : ""}>Released</option>
            <option value="not_released" ${this.catalogFilters.status === "not_released" ? "selected" : ""}>Not Released</option>
          </select>
          <select data-catalog-sort>
            <option value="number" ${this.catalogFilters.sortBy === "number" ? "selected" : ""}>Sort by Module Number</option>
            <option value="status" ${this.catalogFilters.sortBy === "status" ? "selected" : ""}>Sort by Status</option>
          </select>
        </div>
        <div class="st-table-scroll">
          <table class="st-data-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Strand</th>
                <th>Title/Topic</th>
                <th>Module Status</th>
                <th>Learners</th>
              </tr>
            </thead>
            <tbody>
              ${
                list.length
                  ? list.map((m) => this.renderCatalogRow(m)).join("")
                  : `<tr><td colspan="5">
                      <div class="st-empty" style="border:none;background:transparent;">
                        <span class="material-symbols-outlined">inventory_2</span>
                        <p class="st-empty-title">${this.modules.length ? "No modules match your filters" : "No modules set up yet"}</p>
                        <p class="st-empty-text">${this.modules.length ? "Try clearing the search or status filter." : "Add this class's first module (e.g. \"Module 1\") to get started."}</p>
                      </div>
                    </td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    root.querySelector("[data-catalog-search]")?.addEventListener("input", (e) => {
      this.catalogFilters.search = e.target.value;
      this.renderCatalogView();
    });
    root.querySelector("[data-catalog-status-filter]")?.addEventListener("change", (e) => {
      this.catalogFilters.status = e.target.value;
      this.renderCatalogView();
    });
    root.querySelector("[data-catalog-sort]")?.addEventListener("change", (e) => {
      this.catalogFilters.sortBy = e.target.value;
      this.renderCatalogView();
    });

    root.querySelectorAll("[data-module-row]").forEach((tr) => {
      tr.addEventListener("click", () => this.openModuleDetail(Number(tr.dataset.moduleRow)));
    });
  }

  static renderCatalogRow(m) {
    const statusClass = this.badgeClassFor(m.releaseStatus);
    return `
      <tr data-module-row="${m.id}" style="cursor:pointer;">
        <td><strong>Module ${m.sequenceNumber ?? ""}</strong></td>
        <td>${m.strandCode || "—"}</td>
        <td>
          ${m.title}
          ${m.topic ? `<div class="st-module-topic">${m.topic}</div>` : ""}
        </td>
        <td><span class="st-badge st-badge-${statusClass}">${m.releaseStatus}</span></td>
        <td>${m.releasedCount} of ${m.totalLearners}</td>
      </tr>
    `;
  }

  static openAddModuleModal() {
    if (!window.Modal) return;

    const strandOptionsHtml = this.strandOptions
      .map((s) => `<option value="${s.code}">${s.code} – ${s.name}</option>`)
      .join("");

    Modal.show({
      title: "Add Module",
      size: "sm",
      confirmLabel: "Save Module",
      asyncConfirm: true,
      message: `
        <div class="st-schedule-modal-field">
          <label for="amStrand">Learning Strand</label>
          <select id="amStrand">
            <option value="" selected disabled>Select strand…</option>
            ${strandOptionsHtml}
          </select>
        </div>
        <div class="st-schedule-modal-field">
          <label for="amTitle">Module Title <span class="required">*</span></label>
          <input id="amTitle" type="text" placeholder="e.g. Communication Skills">
        </div>
        <div class="st-schedule-modal-field">
          <label for="amTopic">Unit/Topic (optional)</label>
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
      title: `Edit Module ${module.sequenceNumber ?? ""}`,
      size: "sm",
      confirmLabel: "Save Changes",
      asyncConfirm: true,
      message: `
        <div class="st-schedule-modal-field">
          <label for="emStrand">Learning Strand</label>
          <select id="emStrand">${strandOptionsHtml}</select>
        </div>
        <div class="st-schedule-modal-field">
          <label for="emTitle">Module Title</label>
          <input id="emTitle" type="text" value="${module.title}">
        </div>
        <div class="st-schedule-modal-field">
          <label for="emTopic">Unit/Topic (optional)</label>
          <input id="emTopic" type="text" value="${module.topic || ""}">
        </div>
        <div class="st-schedule-modal-field">
          <label for="emDescription">Description (optional)</label>
          <textarea id="emDescription" rows="3">${module.description || ""}</textarea>
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
  }

  static confirmArchiveModule(classModuleId) {
    if (!window.Modal) return;
    const module = this.modules.find((m) => m.id === classModuleId);

    Modal.show({
      title: "Archive Module",
      size: "sm",
      confirmLabel: "Archive Module",
      asyncConfirm: true,
      message: `Archive <strong>${module?.title || "this module"}</strong>? It will be hidden from the active catalog, but every learner's release/return history for it is kept exactly as it is.`,
      onConfirm: async () => {
        try {
          await API.archiveClassModule(this.classId, classModuleId);
          Toast?.success("Module archived.");
          await this.loadCatalog();
        } catch (error) {
          console.error("[ModuleManagement] Archive failed", error);
          Toast?.error(error?.data?.message || "Unable to archive this module.");
          throw error;
        }
      },
    });
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

    if (pushState) this.updateUrl();

    // Always refresh the module's own catalog metadata (title/strand/topic/
    // etc) -- both for a direct deep link where the catalog was never
    // loaded, and after an edit, so the detail header can't show a stale
    // title/strand from before the edit.
    try {
      const response = await API.getClassModules(this.classId);
      this.modules = response.data || [];
      this.totalLearners = response.totalLearners || 0;
      this.summary = response.summary || null;
    } catch (error) {
      console.error("[ModuleManagement] Unable to load module catalog", error);
    }

    await this.loadRoster({ resetSelection: true });
  }

  static async loadRoster({ resetSelection = false } = {}) {
    try {
      const [rosterResponse, catalogResponse] = await Promise.all([
        API.getClassModuleRoster(this.classId, this.activeModuleId),
        // Also refresh the module's own catalog entry -- a release/return
        // changes its releasedCount/returnedCount/releaseStatus, and the
        // detail header (Overall Status badge) reads from `this.modules`,
        // not from the roster response, so skipping this left the header
        // showing a stale status right after a release/return.
        API.getClassModules(this.classId),
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
      this.renderDetailView();
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

  static renderDetailView() {
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

    root.innerHTML = `
      <div class="st-panel st-panel-pad">
        <div style="display:flex;justify-content:flex-end;">
          <button type="button" class="st-btn-text" data-back-to-catalog>
            <span class="material-symbols-outlined" style="font-size:1rem;vertical-align:-3px;">arrow_back</span>
            Back to Modules
          </button>
        </div>

        <div class="st-module-detail-header">
          <div>
            <h3 class="st-panel-title">
              Module ${module?.sequenceNumber ?? ""} — ${module?.strandCode || ""} ${module?.strandCode ? "–" : ""} ${module?.title || ""}
            </h3>
            <p class="st-panel-subtitle">
              Class: ${this.classInfo?.level || ""} · Overall Status:
              <span class="st-badge st-badge-${this.badgeClassFor(module?.releaseStatus)}">${module?.releaseStatus || "—"}</span>
            </p>
            ${module?.topic ? `<p class="st-panel-subtitle">Topic: ${module.topic}</p>` : ""}
          </div>
          <div class="st-table-actions">
            <a
              href="record-scores.html?class=${this.classId}&module=${this.activeModuleId}"
              class="st-btn st-btn-outline st-btn-xs"
            >
              <span class="material-symbols-outlined" style="font-size:1rem;vertical-align:-3px;">edit_note</span>
              Record Scores
            </a>
            <button type="button" class="st-btn st-btn-outline st-btn-xs" data-edit-active-module>Edit Module</button>
            <button type="button" class="st-btn st-btn-primary st-btn-xs" data-release-selected ${selectedCount ? "" : "disabled"}>
              Release${selectedCount ? ` (${selectedCount})` : ""}
            </button>
            <button type="button" class="st-btn-text" data-archive-active-module>Archive</button>
          </div>
        </div>

        <div class="st-module-toolbar">
          <div class="st-search st-module-search">
            <span class="material-symbols-outlined">search</span>
            <input type="text" placeholder="Search learners..." data-detail-search value="${this.detailFilters.search}">
          </div>
          <select data-detail-stage-filter>
            <option value="all" ${this.detailFilters.stage === "all" ? "selected" : ""}>All Stages</option>
            <option value="Not Released" ${this.detailFilters.stage === "Not Released" ? "selected" : ""}>Not Released</option>
            <option value="Released" ${this.detailFilters.stage === "Released" ? "selected" : ""}>Released</option>
            <option value="Returned" ${this.detailFilters.stage === "Returned" ? "selected" : ""}>Returned</option>
          </select>
          <select data-detail-modality-filter>
            <option value="all" ${this.detailFilters.modality === "all" ? "selected" : ""}>All Modalities</option>
            <option value="Face-to-Face" ${this.detailFilters.modality === "Face-to-Face" ? "selected" : ""}>Face-to-Face</option>
            <option value="Modular" ${this.detailFilters.modality === "Modular" ? "selected" : ""}>Modular</option>
            <option value="Blended" ${this.detailFilters.modality === "Blended" ? "selected" : ""}>Blended</option>
          </select>
        </div>

        <div class="st-table-scroll">
          <table class="st-data-table">
            <thead>
              <tr>
                <th style="width:32px;">
                  ${
                    releasableIds.length
                      ? `<input type="checkbox" data-select-all-learners title="Select all students" ${allSelected ? "checked" : ""}>`
                      : ""
                  }
                </th>
                <th>Learner</th>
                <th>Modality</th>
                <th>Stage</th>
                <th>Release Date</th>
                <th>Return Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${
                list.length
                  ? list.map((r) => this.renderDetailRow(r)).join("")
                  : `<tr><td colspan="7">
                      <div class="st-empty" style="border:none;background:transparent;">
                        <span class="material-symbols-outlined">group_off</span>
                        <p class="st-empty-title">No learners match your filters</p>
                      </div>
                    </td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
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

    root.querySelectorAll("[data-record-scores]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const r = this.roster.find((row) => row.enrollmentId === Number(btn.dataset.recordScores));
        if (r) this.openScoresModal(r);
      });
    });
  }

  static renderDetailRow(r) {
    const stage = this.stageFor(r);
    const badgeClass = this.badgeClassFor(stage);
    const checked = this.selectedEnrollmentIds.has(r.enrollmentId) ? "checked" : "";

    let actionHtml = "";
    if (stage === "Not Released") {
      actionHtml = `<button type="button" class="st-btn st-btn-outline st-btn-xs" data-release-one="${r.enrollmentId}">Release</button>`;
    } else if (stage === "Released") {
      actionHtml = `<button type="button" class="st-btn st-btn-primary st-btn-xs" data-return-one="${r.enrollmentId}">Mark as Returned</button>`;
    } else if (stage === "Returned") {
      actionHtml = `<button type="button" class="st-btn-text" data-undo-return="${r.enrollmentId}">Undo</button>`;
    }

    // Pre-Test/Post-Test can be recorded any time after release, independent
    // of return stage -- a Pre-Test is often given before the module is even
    // worked on.
    let scoresHtml = "";
    if (r.released) {
      const hasScores = r.pretestScore != null || r.posttestScore != null;
      const summary = hasScores
        ? `<div class="st-module-score-summary">${
            r.pretestScore != null ? `Pre ${r.pretestScore}/${r.pretestTotal}` : "Pre —"
          } &middot; ${r.posttestScore != null ? `Post ${r.posttestScore}/${r.posttestTotal}` : "Post —"}</div>`
        : "";
      scoresHtml = `
        <button type="button" class="st-btn-text" data-record-scores="${r.enrollmentId}">
          <span class="material-symbols-outlined" style="font-size:1rem;vertical-align:-2px;">edit_note</span>
          Scores
        </button>
        ${summary}
      `;
    }

    const releaseDateHtml = r.releaseDate
      ? `${r.releaseDate} <button type="button" class="st-icon-btn" data-edit-release-date="${r.enrollmentId}" title="Edit release date" style="vertical-align:middle;border:none;background:none;cursor:pointer;color:var(--st-on-surface-variant);">
          <span class="material-symbols-outlined" style="font-size:1rem;vertical-align:-3px;">edit</span>
        </button>`
      : "—";

    return `
      <tr>
        <td>${stage === "Not Released" ? `<input type="checkbox" data-select-learner="${r.enrollmentId}" ${checked}>` : ""}</td>
        <td>${r.name}</td>
        <td>${this.modalityPill(r.modality)}</td>
        <td><span class="st-badge st-badge-${badgeClass}">${stage}</span></td>
        <td>${releaseDateHtml}</td>
        <td>${r.returnDate || "—"}</td>
        <td>${actionHtml}${scoresHtml}</td>
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
            <label>Students Receiving This Module</label>
            <div class="st-roster-checklist" id="rmChecklist">
              <div class="st-roster-checklist-row" style="font-weight:600;">
                <input type="checkbox" id="rmSelectAll" checked>
                <label for="rmSelectAll" style="cursor:pointer;margin:0;font-weight:600;">Select All (${candidates.length})</label>
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
      title: candidates.length === 1 ? "Release Module" : `Release Module to ${candidates.length} Learners`,
      size: "sm",
      confirmLabel: "Confirm Release",
      asyncConfirm: true,
      message: `
        ${recipientsHtml}
        <div class="st-schedule-modal-field">
          <label for="rmReleaseDate">Release Date</label>
          <input type="date" id="rmReleaseDate" value="${today}" max="${today}">
        </div>
        <div class="st-schedule-modal-field">
          <label for="rmPlannedReturn">Planned Return Date</label>
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
      title: "Edit Release Date",
      size: "sm",
      confirmLabel: "Save Changes",
      asyncConfirm: true,
      message: `
        <p style="color:var(--st-on-surface-variant);font-size:0.875rem;">${rosterRow.name}</p>
        <div class="st-schedule-modal-field">
          <label for="erdReleaseDate">Release Date</label>
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
      title: "Mark as Returned",
      size: "sm",
      confirmLabel: "Confirm Return",
      asyncConfirm: true,
      message: `
        <p style="color:var(--st-on-surface-variant);font-size:0.875rem;">${rosterRow.name}</p>
        <div class="st-schedule-modal-field">
          <label for="rtReturnDate">Return Date</label>
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

  static openScoresModal(rosterRow) {
    if (!window.Modal) return;

    const val = (v) => (v == null ? "" : v);

    Modal.show({
      title: "Record Scores",
      size: "sm",
      confirmLabel: "Save Scores",
      asyncConfirm: true,
      message: `
        <p style="color:var(--st-on-surface-variant);font-size:0.875rem;">${rosterRow.name}</p>
        <div class="st-schedule-modal-field">
          <label>Pre-Test</label>
          <div class="st-score-input-row">
            <input type="number" min="0" step="0.5" id="scPretestScore" placeholder="Score" value="${val(rosterRow.pretestScore)}">
            <span>/</span>
            <input type="number" min="0" step="0.5" id="scPretestTotal" placeholder="Total" value="${val(rosterRow.pretestTotal)}">
          </div>
        </div>
        <div class="st-schedule-modal-field">
          <label>Post-Test</label>
          <div class="st-score-input-row">
            <input type="number" min="0" step="0.5" id="scPosttestScore" placeholder="Score" value="${val(rosterRow.posttestScore)}">
            <span>/</span>
            <input type="number" min="0" step="0.5" id="scPosttestTotal" placeholder="Total" value="${val(rosterRow.posttestTotal)}">
          </div>
        </div>
      `,
      onConfirm: async () => {
        const read = (id) => {
          const raw = document.getElementById(id)?.value;
          return raw === "" || raw == null ? null : Number(raw);
        };

        const pretestScore = read("scPretestScore");
        const pretestTotal = read("scPretestTotal");
        const posttestScore = read("scPosttestScore");
        const posttestTotal = read("scPosttestTotal");

        if ((pretestScore != null) !== (pretestTotal != null)) {
          Toast?.error("Enter both a Pre-Test score and total, or leave both blank.");
          throw new Error("validation");
        }
        if ((posttestScore != null) !== (posttestTotal != null)) {
          Toast?.error("Enter both a Post-Test score and total, or leave both blank.");
          throw new Error("validation");
        }

        try {
          await API.updateModuleScores(rosterRow.learnerId, rosterRow.releaseBatchId, rosterRow.moduleRecordId, {
            pretestScore,
            pretestTotal,
            posttestScore,
            posttestTotal,
          });
          Toast?.success("Scores saved.");
          await this.loadRoster();
        } catch (error) {
          console.error("[ModuleManagement] Unable to save scores", error);
          Toast?.error(error?.data?.message || "Unable to save these scores.");
          throw error;
        }
      },
    });
  }

  static confirmUndoReturn(rosterRow) {
    if (!window.Modal) return;

    Modal.show({
      title: "Undo Return?",
      size: "sm",
      confirmLabel: "Undo Return",
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
