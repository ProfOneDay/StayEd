class ModuleManagementModal {
  static learner = null;

  static activeTab = "active";

  static summary = { total: 0, returned: 0, inProgress: 0, completionPercent: 0 };

  static modules = [];

  static strands = [];

  static showReleaseForm = false;

  static async open(learner) {
    this.learner = learner;
    this.activeTab = "active";
    this.showReleaseForm = false;

    const body = Modal.showCustom({
      title: "",
      size: "xl",
      hideFooter: true,
    });

    if (!body) return;

    this.bodyEl = body;
    body.parentElement.classList.add("st-module-modal");
    body.innerHTML = `<div class="st-empty" style="border:none;background:transparent;">
      <span class="material-symbols-outlined">progress_activity</span>
      <p class="st-empty-title">Loading modules…</p>
    </div>`;

    try {
      const [modulesResponse, strandsResponse] = await Promise.all([
        API.get(`/learners/${learner.id}/modules`),
        API.get("/learning-strands"),
      ]);
      this.summary = modulesResponse.summary || this.summary;
      this.modules = modulesResponse.modules || [];
      this.strands = strandsResponse.data || [];
    } catch (error) {
      console.error("[ModuleManagementModal] Failed to load modules", error);
      Toast?.error("Unable to load modules for this learner.");
      this.summary = { total: 0, returned: 0, inProgress: 0, completionPercent: 0 };
      this.modules = [];
      this.strands = [];
    }

    body.innerHTML = this.render();
    this.bind(body.parentElement);
  }

  static render() {
    const l = this.learner;
    const s = this.summary;

    return `
            <div class="st-module-modal-header">
                <div class="st-module-modal-title-row">
                    <div>
                        <h1 class="st-module-modal-title">Module Management</h1>
                        <div class="st-module-modal-meta">
                            <span style="font-weight:700;color:var(--st-primary);">${l.name}</span>
                            <span class="sep">•</span>
                            <span>LRN: ${l.lrn}</span>
                            <span class="sep">•</span>
                            <span class="chip">${l.modality} • ${l.level}</span>
                        </div>
                    </div>
                    <button type="button" class="st-btn st-btn-primary st-btn-xs" data-release-module>
                        <span class="material-symbols-outlined" style="font-size:16px;">add</span>
                        Release New Module
                    </button>
                </div>

                <div class="st-module-summary-card">
                    <div class="st-module-summary-row">
                        <div>
                            <p class="st-module-summary-label">Module Status</p>
                            <div class="st-module-summary-stats">
                                <span style="color:var(--st-primary);">${s.total} <span>Modules</span></span>
                                <span style="color:var(--st-secondary);">${s.returned} <span>Returned</span></span>
                                <span style="color:var(--st-primary-container);">${s.inProgress} <span>In Progress</span></span>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <span class="st-module-summary-pct">${s.completionPercent}%</span>
                            <p class="st-module-summary-label">Overall</p>
                        </div>
                    </div>
                    <div class="st-progress-track st-progress-track--lg">
                        <div class="st-progress-fill st-progress-fill--secondary" style="width:${s.completionPercent}%;"></div>
                    </div>
                </div>
            </div>

            ${this.showReleaseForm ? this.renderReleaseForm() : ""}

            <nav class="st-module-modal-tabs">
                <button type="button" class="st-module-modal-tab ${this.activeTab === "active" ? "is-active" : ""}" data-module-tab="active">Active Modules</button>
                <button type="button" class="st-module-modal-tab ${this.activeTab === "history" ? "is-active" : ""}" data-module-tab="history">Module History</button>
            </nav>

            <div class="st-module-modal-body" data-module-modal-content>
                ${this.activeTab === "active" ? this.renderActiveTab() : this.renderHistoryTab()}
            </div>

            <div class="st-module-modal-footer">
                <span style="font-size:12px;color:var(--st-on-surface-variant);">Changes save automatically</span>
                <button type="button" class="st-btn st-btn-primary" data-module-modal-done>Done</button>
            </div>
        `;
  }

  static renderReleaseForm() {
    const options = this.strands
      .map((s) => `<option value="${s.code}">${s.code} – ${s.name}</option>`)
      .join("");

    return `
            <form class="st-module-release-form" data-release-form style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;padding:12px;margin:0 0 12px;border:1px solid var(--st-outline-variant);border-radius:8px;">
                <div style="flex:2;min-width:200px;">
                    <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Module Title</label>
                    <input type="text" data-release-title required placeholder="e.g. Module 1: Basic Reading Comprehension" style="width:100%;">
                </div>
                <div style="flex:1;min-width:160px;">
                    <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Learning Strand</label>
                    <select data-release-strand required style="width:100%;">
                        <option value="" disabled selected>Select strand…</option>
                        ${options}
                    </select>
                </div>
                <div style="flex:1;min-width:140px;">
                    <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Release Date</label>
                    <input type="date" data-release-date value="${new Date().toISOString().slice(0, 10)}" style="width:100%;">
                </div>
                <button type="submit" class="st-btn st-btn-primary st-btn-xs">Release</button>
                <button type="button" class="st-btn st-btn-xs" data-release-cancel>Cancel</button>
            </form>
        `;
  }

  static renderActiveTab() {
    const active = this.modules.filter((m) => m.status === "released");
    const groups = {};
    active.forEach((m) => {
      const key = `${m.strandCode || "General"} – ${m.strandName || "Modules"}`;
      (groups[key] = groups[key] || []).push(m);
    });

    const strandKeys = Object.keys(groups);
    if (!strandKeys.length) {
      return `
                <div class="st-empty" style="border:none;background:transparent;">
                    <span class="material-symbols-outlined">menu_book</span>
                    <p class="st-empty-title">No active modules</p>
                    <p class="st-empty-text">Release a new module to get started.</p>
                </div>
            `;
    }

    return strandKeys
      .map(
        (strand) => `
            <div class="st-module-group" data-module-group>
                <button type="button" class="st-module-group-header" data-module-group-toggle>
                    <div class="st-module-group-header-left">
                        <span class="material-symbols-outlined" style="color:var(--st-primary);">forum</span>
                        <h2 class="st-module-group-title">${strand}</h2>
                        <span class="st-module-group-count">(${groups[strand].length} Active)</span>
                    </div>
                    <span class="material-symbols-outlined st-module-group-caret">expand_less</span>
                </button>
                <div class="st-module-group-body">
                    ${groups[strand].map((mod) => this.renderModuleItem(mod)).join("")}
                </div>
            </div>
        `,
      )
      .join("");
  }

  static renderModuleItem(mod) {
    return `
            <div class="st-module-item" data-module-id="${mod.id}">
                <div class="st-module-item-main">
                    <div class="st-module-item-icon">
                        <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1;">description</span>
                    </div>
                    <div class="st-module-item-body">
                        <h3 class="st-module-item-title">${mod.title}</h3>
                        <div class="st-module-item-dates">
                            <div class="st-module-item-date-row">
                                <span class="st-module-item-date-label">Released</span>
                                <span>${mod.released}</span>
                            </div>
                            ${mod.returned ? `<div class="st-module-item-date-row"><span class="st-module-item-date-label">Returned</span><span>${mod.returned}</span></div>` : ""}
                        </div>
                        <input type="text" class="st-module-item-remarks" placeholder="Add remarks (optional)..."
                            value="${mod.remarks || ""}" data-module-remarks="${mod.id}">
                    </div>
                </div>
                <div class="st-module-item-controls">
                    <div class="st-module-item-field">
                        <label>Status</label>
                        <select data-module-status="${mod.id}">
                            <option value="released" ${mod.status === "released" ? "selected" : ""}>In Progress</option>
                            <option value="returned" ${mod.status === "returned" ? "selected" : ""}>Returned</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
  }

  static renderHistoryTab() {
    const history = this.modules.filter((m) => m.status === "returned");

    if (!history.length) {
      return `
                <div class="st-empty" style="border:none;background:transparent;">
                    <span class="material-symbols-outlined">history</span>
                    <p class="st-empty-title">No returned modules yet</p>
                </div>
            `;
    }

    return `
            <table class="st-module-history-table" style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr>
                        <th>Module</th>
                        <th>Strand</th>
                        <th>Returned</th>
                        <th>Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    ${history
                      .map(
                        (h) => `
                        <tr>
                            <td style="font-weight:600;">${h.title}</td>
                            <td>${h.strandCode || "—"}</td>
                            <td>${h.returned || "—"}</td>
                            <td>${h.remarks || "—"}</td>
                        </tr>
                    `,
                      )
                      .join("")}
                </tbody>
            </table>
        `;
  }

  static bind(container) {
    container.querySelectorAll("[data-module-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        this.activeTab = tab.dataset.moduleTab;
        this.showReleaseForm = false;
        this.refreshBody(container);
      });
    });

    this.bindGroupToggles(container);

    container
      .querySelector("[data-module-modal-done]")
      ?.addEventListener("click", () => {
        Modal.hide();
      });

    container
      .querySelector("[data-release-module]")
      ?.addEventListener("click", () => {
        this.showReleaseForm = !this.showReleaseForm;
        this.rerender(container);
      });

    container
      .querySelector("[data-release-cancel]")
      ?.addEventListener("click", () => {
        this.showReleaseForm = false;
        this.rerender(container);
      });

    container
      .querySelector("[data-release-form]")
      ?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const title = container.querySelector("[data-release-title]").value.trim();
        const strandCode = container.querySelector("[data-release-strand]").value;
        const dateReleased = container.querySelector("[data-release-date]").value;
        if (!title || !strandCode) {
          Toast?.error("Module title and learning strand are required.");
          return;
        }
        try {
          const response = await API.post(`/learners/${this.learner.id}/modules`, {
            title,
            strandCode,
            dateReleased,
          });
          this.summary = response.summary;
          this.modules = response.modules;
          this.showReleaseForm = false;
          this.activeTab = "active";
          Toast?.success("Module released.");
          this.rerender(container);
        } catch (error) {
          console.error("[ModuleManagementModal] Release failed", error);
          Toast?.error(error?.data?.message || "Unable to release this module.");
        }
      });

    this.bindItemControls(container);
  }

  static async updateModule(container, moduleId, payload, { silent = false } = {}) {
    try {
      const response = await API.put(`/learners/${this.learner.id}/modules/${moduleId}`, payload);
      this.summary = response.summary;
      this.modules = response.modules;
      if (!silent) Toast?.success("Module updated.");
      this.rerender(container);
    } catch (error) {
      console.error("[ModuleManagementModal] Update failed", error);
      Toast?.error(error?.data?.message || "Unable to update this module.");
    }
  }

  static rerender(container) {
    this.bodyEl.innerHTML = this.render();
    this.bind(container);
  }

  static refreshBody(container) {
    const content = container.querySelector("[data-module-modal-content]");
    const tabs = container.querySelectorAll("[data-module-tab]");
    tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.moduleTab === this.activeTab));
    if (content) {
      content.innerHTML = this.activeTab === "active" ? this.renderActiveTab() : this.renderHistoryTab();
      this.bindGroupToggles(content);
      this.bindItemControls(container);
    }
  }

  static bindItemControls(container) {
    container.querySelectorAll("[data-module-status]").forEach((el) => {
      el.addEventListener("change", async () => {
        const moduleId = el.dataset.moduleStatus;
        await this.updateModule(container, moduleId, { returned: el.value === "returned" });
      });
    });
    container.querySelectorAll("[data-module-remarks]").forEach((el) => {
      el.addEventListener("blur", async () => {
        const moduleId = el.dataset.moduleRemarks;
        const original = this.modules.find((m) => String(m.id) === String(moduleId));
        if (original && (original.remarks || "") === el.value.trim()) return;
        await this.updateModule(container, moduleId, { remarks: el.value.trim() }, { silent: true });
      });
    });
  }

  static bindGroupToggles(container) {
    container
      .querySelectorAll("[data-module-group-toggle]")
      .forEach((header) => {
        header.addEventListener("click", () => {
          header
            .closest("[data-module-group]")
            ?.classList.toggle("is-collapsed");
        });
      });
  }
}

window.ModuleManagementModal = ModuleManagementModal;