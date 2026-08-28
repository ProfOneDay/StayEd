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
  static detailFilters = { search: "", stage: "all" };

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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                list.length
                  ? list.map((m) => this.renderCatalogRow(m)).join("")
                  : `<tr><td colspan="6">
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

    root.querySelectorAll("[data-manage-module]").forEach((btn) => {
      btn.addEventListener("click", () => this.openModuleDetail(Number(btn.dataset.manageModule)));
    });
    root.querySelectorAll("[data-edit-module]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = this.modules.find((mod) => mod.id === Number(btn.dataset.editModule));
        if (m) this.openEditModuleModal(m);
      });
    });
    root.querySelectorAll("[data-archive-module]").forEach((btn) => {
      btn.addEventListener("click", () => this.confirmArchiveModule(Number(btn.dataset.archiveModule)));
    });
  }

  static renderCatalogRow(m) {
    const statusClass = this.badgeClassFor(m.releaseStatus);
    return `
      <tr data-module-row="${m.id}">
        <td><strong>Module ${m.sequenceNumber ?? ""}</strong></td>
        <td>${m.strandCode || "—"}</td>
        <td>
          ${m.title}
          ${m.topic ? `<div class="st-module-topic">${m.topic}</div>` : ""}
        </td>
        <td><span class="st-badge st-badge-${statusClass}">${m.releaseStatus}</span></td>
        <td>${m.releasedCount} of ${m.totalLearners}</td>
        <td>
          <div class="st-table-actions">
            <button type="button" class="st-btn st-btn-primary st-btn-xs" data-manage-module="${m.id}">Manage</button>
            <button type="button" class="st-btn-text" data-edit-module="${m.id}">Edit</button>
            <button type="button" class="st-btn-text" data-archive-module="${m.id}">Archive</button>
          </div>
        </td>
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
          <label for="amTitle">Module Title</label>
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
        <p style="color:var(--st-on-surface-variant);font-size:13px;margin-top:8px;">
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
    this.detailFilters = { search: "", stage: "all" };
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

    await this.loadRoster();
  }

  static async loadRoster() {
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
    const { search, stage } = this.detailFilters;
    return this.roster.filter((r) => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (stage !== "all" && this.stageFor(r) !== stage) return false;
      return true;
    });
  }

  static renderDetailView() {
    const root = document.querySelector("[data-view-root]");
    if (!root) return;

    const module = this.modules.find((m) => m.id === this.activeModuleId);
    const list = this.filteredRoster();
    const selectedCount = this.selectedEnrollmentIds.size;

    root.innerHTML = `
      <div class="st-panel st-panel-pad">
        <button type="button" class="st-btn-text" data-back-to-catalog>
          <span class="material-symbols-outlined" style="font-size:16px;vertical-align:-3px;">arrow_back</span>
          Back to Modules
        </button>

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
            <button type="button" class="st-btn st-btn-outline st-btn-xs" data-edit-active-module>Edit Module</button>
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
        </div>

        ${
          selectedCount
            ? `<div class="st-module-bulk-bar">
                <span>${selectedCount} learner${selectedCount === 1 ? "" : "s"} selected</span>
                <button type="button" class="st-btn st-btn-primary st-btn-xs" data-bulk-release>Release to Selected</button>
              </div>`
            : ""
        }

        <div class="st-table-scroll">
          <table class="st-data-table">
            <thead>
              <tr>
                <th style="width:32px;"></th>
                <th>Learner</th>
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
                  : `<tr><td colspan="6">
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

    root.querySelectorAll("[data-select-learner]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const id = Number(cb.dataset.selectLearner);
        if (cb.checked) this.selectedEnrollmentIds.add(id);
        else this.selectedEnrollmentIds.delete(id);
        this.renderDetailView();
      });
    });

    root.querySelector("[data-bulk-release]")?.addEventListener("click", () => {
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

    root.querySelectorAll("[data-undo-return]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const r = this.roster.find((row) => row.enrollmentId === Number(btn.dataset.undoReturn));
        if (r) this.confirmUndoReturn(r);
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

    return `
      <tr>
        <td>${stage === "Not Released" ? `<input type="checkbox" data-select-learner="${r.enrollmentId}" ${checked}>` : ""}</td>
        <td>${r.name}</td>
        <td><span class="st-badge st-badge-${badgeClass}">${stage}</span></td>
        <td>${r.releaseDate || "—"}</td>
        <td>${r.returnDate || "—"}</td>
        <td>${actionHtml}</td>
      </tr>
    `;
  }

  static openReleaseModal(enrollmentIds) {
    if (!window.Modal || !enrollmentIds.length) return;

    const today = new Date().toISOString().slice(0, 10);
    const plannedReturn = this.addDays(today, this.defaultDurationDays);
    const names = enrollmentIds
      .map((id) => this.roster.find((r) => r.enrollmentId === id)?.name)
      .filter(Boolean);

    Modal.show({
      title: enrollmentIds.length === 1 ? "Release Module" : `Release Module to ${enrollmentIds.length} Learners`,
      size: "sm",
      confirmLabel: "Confirm Release",
      asyncConfirm: true,
      message: `
        <p style="color:var(--st-on-surface-variant);font-size:14px;">${names.join(", ")}</p>
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
        try {
          const response = await API.releaseClassModule(this.classId, this.activeModuleId, {
            releaseDate,
            plannedReturnDate,
            learnerIds: enrollmentIds,
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
        <p style="color:var(--st-on-surface-variant);font-size:14px;">${rosterRow.name}</p>
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

  static confirmUndoReturn(rosterRow) {
    if (!window.Modal) return;

    Modal.show({
      title: "Undo Return?",
      size: "sm",
      confirmLabel: "Undo Return",
      asyncConfirm: true,
      message: `
        <p><strong>${rosterRow.name}</strong></p>
        <p style="color:var(--st-on-surface-variant);font-size:14px;margin-top:8px;">
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
