class ModuleManagementModal {
  static learner = null;

  static meta = {};

  static batches = [];

  static strandOptions = [];

  static defaultDurationDays = 21;

  static editingPlannedModuleId = null;

  static view = "logbook";

  static expandedBatchId = null;

  static releaseForm = null;

  static returnState = null;

  static editState = null;

  static onUpdate = null;

  static async open(learner, onUpdate) {
    this.learner = learner;
    this.onUpdate = onUpdate || null;
    this.view = "logbook";
    this.expandedBatchId = null;
    this.editingPlannedModuleId = null;

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
      <p class="st-empty-title">Loading module release logbook…</p>
    </div>`;

    try {
      const [logbook, strandsResponse, durationResponse] = await Promise.all([
        API.getModuleLogbook(learner.id),
        API.get("/learning-strands"),
        API.getModuleDurationSetting().catch(() => null),
      ]);
      this.meta = logbook.learner || {};
      this.batches = logbook.batches || [];
      this.strandOptions = strandsResponse.data || [];
      this.defaultDurationDays = durationResponse?.defaultDurationDays || 21;
      if (this.batches.length) this.expandedBatchId = this.batches[0].id;
    } catch (error) {
      console.error("[ModuleManagementModal] Failed to load logbook", error);
      Toast?.error("Unable to load the module release logbook.");
      this.meta = {};
      this.batches = [];
      this.strandOptions = [];
    }

    this.renderAll();
  }

  static async reloadLogbook() {
    try {
      const logbook = await API.getModuleLogbook(this.learner.id);
      this.meta = logbook.learner || {};
      this.batches = logbook.batches || [];
    } catch (error) {
      console.error("[ModuleManagementModal] Failed to reload logbook", error);
      Toast?.error("Unable to refresh the module release logbook.");
    }
  }

  static renderAll() {
    if (this.view === "release") {
      this.bodyEl.innerHTML = this.renderReleaseForm();
    } else if (this.view === "return") {
      this.bodyEl.innerHTML = this.renderReturnModal();
    } else if (this.view === "edit") {
      this.bodyEl.innerHTML = this.renderEditForm();
    } else {
      this.bodyEl.innerHTML = this.renderLogbook();
    }
    this.bind();
  }

  // ------------------------------------------------------------------
  // Logbook view
  // ------------------------------------------------------------------

  static renderLogbook() {
    const l = this.meta;

    return `
      <div class="st-module-modal-header">
        <button type="button" class="st-module-modal-close" data-module-close aria-label="Close">
          <span class="material-symbols-outlined">close</span>
        </button>
        <div class="st-module-modal-title-row">
          <div>
            <h1 class="st-module-modal-title">Module Release Logbook</h1>
            <p class="st-mrb-learner-name">${l.name || ""}</p>
            <p class="st-module-modal-meta">
              LRN: ${l.lrn || "—"}
              <span class="sep">|</span>
              ${l.clc || "—"} • ${l.level || "—"}
            </p>
          </div>
          <button type="button" class="st-btn st-btn-primary" data-open-release-form>
            <span class="material-symbols-outlined" style="font-size:18px;">add</span>
            Add Modules
          </button>
        </div>
      </div>

      <div class="st-module-modal-body">
        ${this.batches.length ? this.batches.map((b) => this.renderBatchRow(b)).join("") : this.renderLogbookEmpty()}
      </div>
    `;
  }

  static renderLogbookEmpty() {
    return `
      <div class="st-empty" style="border:none;background:transparent;">
        <span class="material-symbols-outlined">menu_book</span>
        <p class="st-empty-title">No modules released yet</p>
        <p class="st-empty-text">Click "Add Modules" to record the first release batch for this learner.</p>
      </div>
    `;
  }

  static statusMeta(batch) {
    // This pill describes module return timing only. Learner risk belongs on
    // learner/profile surfaces, not in the Module Release Logbook.
    if (batch.status === "returned") {
      return { label: "Returned", icon: "check", cssClass: "returned" };
    }
    if (batch.status === "overdue") {
      const sub = batch.daysOverdue != null
        ? `Overdue by ${batch.daysOverdue} day${batch.daysOverdue === 1 ? "" : "s"}`
        : "Past planned return date";
      return { label: "Overdue", sub, icon: "warning", cssClass: "overdue" };
    }
    if (batch.status === "due") {
      let sub = "Planned return date is approaching";
      if (batch.daysUntilDue === 0) sub = "Due today";
      else if (batch.daysUntilDue != null) {
        sub = `Due in ${batch.daysUntilDue} day${batch.daysUntilDue === 1 ? "" : "s"}`;
      }
      return { label: "Due Soon", sub, icon: "schedule", cssClass: "due" };
    }
    return { label: "Pending", icon: "hourglass_empty", cssClass: "pending" };
  }


  static renderBatchRow(batch) {
    const expanded = this.expandedBatchId === batch.id;
    const strandLabel = `${batch.strandCount} Learning Strand${batch.strandCount === 1 ? "" : "s"}`;
    const status = this.statusMeta(batch);

    if (batch.status === "returned") {
      return `
        <div class="st-mrb-row ${expanded ? "is-expanded" : ""}">
          <button type="button" class="st-mrb-row-main" data-batch-toggle="${batch.id}">
            <span class="material-symbols-outlined st-mrb-chevron">${expanded ? "expand_less" : "chevron_right"}</span>
            <div class="st-mrb-col st-mrb-col--date">
              <span class="st-mrb-label">Released</span>
              <span class="st-mrb-date">${batch.releaseDate}</span>
            </div>
            <div class="st-mrb-col st-mrb-col--summary">
              <span class="st-mrb-label">Release Summary</span>
              <span class="st-mrb-summary-text">${batch.moduleCount} Modules across ${strandLabel}</span>
            </div>
            <div class="st-mrb-col st-mrb-col--returned">
              <span class="st-mrb-returned-text">Returned: ${batch.returnDate} (${batch.daysToReturn} day${batch.daysToReturn === 1 ? "" : "s"} after release)</span>
            </div>
          </button>
          <div class="st-mrb-actions">
            <span class="st-mrb-status-pill st-mrb-status-pill--returned">
              <span class="material-symbols-outlined">check</span> Returned
            </span>
            <button type="button" class="st-mrb-edit-btn" data-edit-batch="${batch.id}" title="Edit this release batch" aria-label="Edit this release batch">
              <span class="material-symbols-outlined">edit</span>
            </button>
          </div>
          ${expanded ? this.renderBatchExpanded(batch) : ""}
        </div>
      `;
    }

    return `
      <div class="st-mrb-row ${expanded ? "is-expanded" : ""}">
        <button type="button" class="st-mrb-row-main st-mrb-row-main--active" data-batch-toggle="${batch.id}">
          <span class="material-symbols-outlined st-mrb-chevron">${expanded ? "expand_less" : "chevron_right"}</span>
          <div class="st-mrb-col st-mrb-col--date">
            <span class="st-mrb-label">Released</span>
            <span class="st-mrb-date">${batch.releaseDate}</span>
          </div>
          <div class="st-mrb-stat st-mrb-stat--progress">
            <span class="st-mrb-label">Release Progress</span>
            <div class="st-progress-cell">
              <span class="st-progress-cell-count">${batch.returnedCount} of ${batch.moduleCount} Returned (${Math.round((batch.returnedCount / batch.moduleCount) * 100) || 0}%)</span>
              <div class="st-progress-track">
                <div class="st-progress-fill st-progress-fill--primary" style="width:${Math.round((batch.returnedCount / batch.moduleCount) * 100) || 0}%;"></div>
              </div>
            </div>
          </div>
          <div class="st-mrb-stat">
            <span class="st-mrb-label">Strands</span>
            <span class="st-mrb-stat-value">${strandLabel}</span>
          </div>
        </button>
        <div class="st-mrb-actions">
          <span class="st-mrb-status-pill st-mrb-status-pill--${status.cssClass}">
            <span class="material-symbols-outlined">${status.icon}</span>
            <span>
              <strong>${status.label}</strong>
              ${status.sub ? `<small>${status.sub}</small>` : ""}
            </span>
          </span>
          <button type="button" class="st-btn st-btn-primary st-btn-xs" data-record-return="${batch.id}">Record Return</button>
          <button type="button" class="st-mrb-edit-btn" data-edit-batch="${batch.id}" title="Edit this release batch" aria-label="Edit this release batch">
            <span class="material-symbols-outlined">edit</span>
          </button>
        </div>
        ${expanded ? this.renderBatchExpanded(batch) : ""}
      </div>
    `;
  }

  static renderBatchExpanded(batch) {
    const timingMessage = batch.status === "overdue"
      ? `Module return overdue${batch.deadlineDate ? ` — planned return was ${batch.deadlineDate}` : ""}`
      : batch.status === "due"
        ? `Module return due soon${batch.deadlineDate ? ` — planned return is ${batch.deadlineDate}` : ""}`
        : batch.status === "returned"
          ? "All modules in this release batch have been returned."
          : `Module return pending${batch.deadlineDate ? ` — planned return is ${batch.deadlineDate}` : ""}`;
    const timingAlert = batch.status === "overdue";

    return `
      <div class="st-mrb-expanded">
        <p class="st-mrb-followup ${timingAlert ? "st-mrb-followup--overdue" : ""}">
          <span class="material-symbols-outlined">${timingAlert ? "warning" : "info"}</span>
          ${timingMessage}
        </p>
        ${this.renderLastContactBlock(batch)}
        <div class="st-mrb-strand-grid">
          ${batch.strands
            .map(
              (s) => `
              <div class="st-mrb-strand-col">
                <h4>${s.code} ${s.name}</h4>
                <ul class="st-mrb-module-status-list">${s.modules
                  .map(
                    (m) => `
                    <li class="st-mrb-module-status-item ${m.status === "returned" ? "is-returned" : "is-pending"}">
                      <span class="material-symbols-outlined">${m.status === "returned" ? "check_box" : "check_box_outline_blank"}</span>
                      <span>
                        ${m.title} <em>(${m.status === "returned" ? "Returned" : "Pending"})</em>
                        ${m.status !== "returned" ? `
                          <br>
                          ${this.editingPlannedModuleId === m.id ? `
                            <small style="display:inline-flex;align-items:center;gap:6px;">
                              Planned Return:
                              <input type="date" data-planned-input="${m.id}" value="${m.plannedReturnIso || ""}" style="font-size:12px;padding:2px 4px;">
                              <button type="button" class="st-btn st-btn-primary st-btn-xs" data-save-planned="${m.id}">Save</button>
                              <button type="button" class="st-btn-text" data-cancel-planned="${m.id}">Cancel</button>
                            </small>
                          ` : `
                            <small>
                              Planned Return: ${m.plannedReturn || "—"}
                              ${m.overdue ? `<strong style="color:var(--st-risk-high);"> · Overdue by ${m.daysOverdue} day${m.daysOverdue === 1 ? "" : "s"}</strong>` : ""}
                              <button type="button" class="st-icon-btn-sm" data-edit-planned="${m.id}" title="Edit planned return date" style="vertical-align:middle;">
                                <span class="material-symbols-outlined" style="font-size:14px;">edit</span>
                              </button>
                            </small>
                          `}
                        ` : ""}
                      </span>
                    </li>
                  `,
                  )
                  .join("")}</ul>
              </div>
            `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  static renderLastContactBlock(batch) {
    const dateLine =
      batch.status === "returned"
        ? `Returned: ${batch.returnDate}`
        : `Released: ${batch.releaseDate}`;

    const activityText = batch.activityText || this.meta.activityText || "";
    const isRedundantReleaseActivity = /^Module released(?:\s|$)/i.test(activityText.trim());

    return `
      <div class="st-mrb-last-contact">
        <span class="st-return-eyebrow">Last Contact</span>
        <p class="st-mrb-last-contact-date">${dateLine}</p>
        ${
          activityText && !isRedundantReleaseActivity
            ? `<p class="st-mrb-last-contact-activity">${activityText}</p>`
            : ""
        }
      </div>
    `;
  }


  static bindLogbook(root) {
    root.querySelectorAll("[data-batch-toggle]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = Number(el.dataset.batchToggle);
        this.expandedBatchId = this.expandedBatchId === id ? null : id;
        this.renderAll();
      });
    });

    root.querySelector("[data-open-release-form]")?.addEventListener("click", () => {
      this.view = "release";
      const releaseDate = new Date().toISOString().slice(0, 10);
      this.releaseForm = {
        releaseDate,
        plannedReturnDate: this.addDays(releaseDate, this.defaultDurationDays),
        plannedReturnTouched: false,
        strands: [{ strandCode: "", modules: [""] }],
      };
      this.renderAll();
    });

    root.querySelectorAll("[data-record-return]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = Number(el.dataset.recordReturn);
        const batch = this.batches.find((b) => b.id === id);
        if (!batch) return;
        this.view = "return";
        this.returnState = {
          batchId: id,
          checked: new Set(),
          returnDate: new Date().toISOString().slice(0, 10),
          remarks: "",
        };
        this.renderAll();
      });
    });

    root.querySelectorAll("[data-edit-batch]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = Number(el.dataset.editBatch);
        const batch = this.batches.find((b) => b.id === id);
        if (!batch) return;
        this.view = "edit";
        this.editState = {
          batchId: id,
          releaseDate: batch.releaseDateISO || new Date().toISOString().slice(0, 10),
          modules: batch.strands.flatMap((s) =>
            s.modules.map((m) => ({
              id: m.id,
              title: m.title,
              strandCode: m.strandCode || s.code,
              returnDate: m.returnedISO || "",
              remarks: m.remarks || "",
            })),
          ),
          error: "",
        };
        this.renderAll();
      });
    });

    root.querySelectorAll("[data-edit-planned]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.editingPlannedModuleId = Number(el.dataset.editPlanned);
        this.renderAll();
      });
    });

    root.querySelectorAll("[data-cancel-planned]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.editingPlannedModuleId = null;
        this.renderAll();
      });
    });

    root.querySelectorAll("[data-save-planned]").forEach((el) => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const moduleId = Number(el.dataset.savePlanned);
        const input = root.querySelector(`[data-planned-input="${moduleId}"]`);
        const value = input?.value;
        if (!value) {
          Toast?.error("Please choose a date.");
          return;
        }

        const batch = this.batches.find((b) =>
          b.strands.some((s) => s.modules.some((m) => m.id === moduleId)),
        );
        if (!batch) return;

        el.disabled = true;
        try {
          const response = await API.updateModulePlannedReturn(
            this.learner.id, batch.id, moduleId, value,
          );
          this.meta = response.learner || this.meta;
          this.batches = response.batches || [];
          this.expandedBatchId = batch.id;
          this.editingPlannedModuleId = null;
          Toast?.success("Planned return date updated.");
          this.renderAll();
          this.onUpdate?.();
        } catch (error) {
          console.error("[ModuleManagementModal] Update planned return failed", error);
          Toast?.error(error?.data?.message || "Unable to update the planned return date.");
          el.disabled = false;
        }
      });
    });
  }

  // ------------------------------------------------------------------
  // Release form view
  // ------------------------------------------------------------------

  static availableStrandsFor(index) {
    const usedElsewhere = new Set(
      this.releaseForm.strands
        .filter((_, i) => i !== index)
        .map((s) => s.strandCode)
        .filter(Boolean),
    );
    return this.strandOptions.filter((s) => !usedElsewhere.has(s.code));
  }

  static addDays(isoDate, days) {
    const d = new Date(`${isoDate}T00:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  static isReleaseFormValid() {
    const form = this.releaseForm;
    if (!form.releaseDate) return false;
    if (form.releaseDate > new Date().toISOString().slice(0, 10)) return false;
    if (!form.strands.length) return false;
    return form.strands.every((s) => s.strandCode && s.modules.some((m) => m.trim()));
  }

  static renderReleaseForm() {
    const form = this.releaseForm;
    const valid = this.isReleaseFormValid();

    return `
      <div class="st-module-modal-header">
        <button type="button" class="st-module-modal-close" data-module-close aria-label="Close">
          <span class="material-symbols-outlined">close</span>
        </button>
        <h1 class="st-module-modal-title">Record Module Release</h1>
        <p class="st-mrf-subtitle">Record the learning modules released to this learner during today's consultation.</p>
      </div>

      <div class="st-module-modal-body">
        <h3 class="st-mrf-section-title">Release Details</h3>

        <div class="st-schedule-modal-field">
          <label for="mrfReleaseDate">Release Date *</label>
          <input type="date" id="mrfReleaseDate" data-release-date value="${form.releaseDate}" max="${new Date().toISOString().slice(0, 10)}">
        </div>

        <div class="st-schedule-modal-field">
          <label for="mrfPlannedReturn">Planned Return Date</label>
          <input type="date" id="mrfPlannedReturn" data-planned-return value="${form.plannedReturnDate}">
          <p class="st-mrf-subtitle" style="margin-top:4px;">
            Auto-suggested (${this.defaultDurationDays} days from release). Adjust if needed.
          </p>
        </div>

        ${form.strands.map((s, i) => this.renderStrandBlock(s, i)).join("")}

        <p class="st-mrf-add-strand-hint">Add another Learning Strand if needed.</p>
        <button type="button" class="st-mrf-add-strand-btn" data-add-strand>
          <span class="material-symbols-outlined">add_circle</span>
          Add Another Learning Strand
        </button>
      </div>

      <div class="st-module-modal-footer">
        <button type="button" class="st-btn-text" data-module-cancel>Cancel</button>
        <button type="button" class="st-btn st-btn-primary" data-record-release ${valid ? "" : "disabled"}>
          <span class="material-symbols-outlined">send</span>
          Record Release
        </button>
      </div>
    `;
  }

  static renderStrandBlock(strand, index) {
    const options = this.availableStrandsFor(index)
      .map((s) => `<option value="${s.code}" ${strand.strandCode === s.code ? "selected" : ""}>${s.code} – ${s.name}</option>`)
      .join("");

    return `
      <div class="st-mrf-strand-block">
        <div class="st-mrf-strand-head">
          <label for="mrfStrand${index}">Learning Strand *</label>
          ${this.releaseForm.strands.length > 1 ? `<button type="button" class="st-mrf-remove-strand" data-remove-strand="${index}">Remove Strand</button>` : ""}
        </div>
        <select id="mrfStrand${index}" data-strand-select="${index}">
          <option value="" ${strand.strandCode ? "" : "selected"} disabled>Select strand…</option>
          ${options}
        </select>

        <div class="st-mrf-modules-box">
          <div class="st-mrf-modules-head">
            <span>Modules to Release</span>
            <span class="st-mrf-modules-count">${strand.modules.length} module${strand.modules.length === 1 ? "" : "s"} listed</span>
          </div>

          ${strand.modules
            .map(
              (title, mi) => `
              <div class="st-mrf-module-row">
                <label>Module ${mi + 1}</label>
                <input type="text" value="${title}" data-module-title="${index}:${mi}" placeholder="e.g. Module 1: Basic Reading Comprehension">
                <button type="button" class="st-btn-outline st-mrf-remove-module" data-remove-module="${index}:${mi}">
                  <span class="material-symbols-outlined">delete</span> Remove Module
                </button>
              </div>
            `,
            )
            .join("")}

          <button type="button" class="st-mrf-add-module" data-add-module="${index}">
            <span class="material-symbols-outlined">add</span> Add another module
          </button>
        </div>
      </div>
    `;
  }

  static refreshReleaseValidity(root) {
    const btn = root.querySelector("[data-record-release]");
    if (btn) btn.disabled = !this.isReleaseFormValid();
  }

  static bindReleaseForm(root) {
    root.querySelector("[data-release-date]")?.addEventListener("input", (e) => {
      this.releaseForm.releaseDate = e.target.value;
      if (!this.releaseForm.plannedReturnTouched) {
        this.releaseForm.plannedReturnDate = this.addDays(e.target.value, this.defaultDurationDays);
        const plannedInput = root.querySelector("[data-planned-return]");
        if (plannedInput) plannedInput.value = this.releaseForm.plannedReturnDate;
      }
      this.refreshReleaseValidity(root);
    });

    root.querySelector("[data-planned-return]")?.addEventListener("input", (e) => {
      this.releaseForm.plannedReturnDate = e.target.value;
      this.releaseForm.plannedReturnTouched = true;
    });

    root.querySelectorAll("[data-strand-select]").forEach((el) => {
      el.addEventListener("change", () => {
        const index = Number(el.dataset.strandSelect);
        this.releaseForm.strands[index].strandCode = el.value;
        this.renderAll();
      });
    });

    root.querySelectorAll("[data-module-title]").forEach((el) => {
      el.addEventListener("input", () => {
        const [index, mi] = el.dataset.moduleTitle.split(":").map(Number);
        this.releaseForm.strands[index].modules[mi] = el.value;
        this.refreshReleaseValidity(root);
      });
    });

    root.querySelectorAll("[data-add-module]").forEach((el) => {
      el.addEventListener("click", () => {
        const index = Number(el.dataset.addModule);
        this.releaseForm.strands[index].modules.push("");
        this.renderAll();
      });
    });

    root.querySelectorAll("[data-remove-module]").forEach((el) => {
      el.addEventListener("click", () => {
        const [index, mi] = el.dataset.removeModule.split(":").map(Number);
        this.releaseForm.strands[index].modules.splice(mi, 1);
        this.renderAll();
      });
    });

    root.querySelector("[data-add-strand]")?.addEventListener("click", () => {
      this.releaseForm.strands.push({ strandCode: "", modules: [""] });
      this.renderAll();
    });

    root.querySelectorAll("[data-remove-strand]").forEach((el) => {
      el.addEventListener("click", () => {
        const index = Number(el.dataset.removeStrand);
        this.releaseForm.strands.splice(index, 1);
        this.renderAll();
      });
    });

    root.querySelector("[data-module-cancel]")?.addEventListener("click", () => {
      this.view = "logbook";
      this.renderAll();
    });

    root.querySelector("[data-record-release]")?.addEventListener("click", async (e) => {
      if (!this.isReleaseFormValid()) return;

      const btn = e.currentTarget;
      if (btn.disabled) return;
      btn.disabled = true;

      const payload = {
        releaseDate: this.releaseForm.releaseDate,
        plannedReturnDate: this.releaseForm.plannedReturnDate || undefined,
        strands: this.releaseForm.strands.map((s) => ({
          strandCode: s.strandCode,
          modules: s.modules.map((m) => m.trim()).filter(Boolean),
        })),
      };

      try {
        const response = await API.releaseModuleBatch(this.learner.id, payload);
        this.meta = response.learner || this.meta;
        this.batches = response.batches || [];
        this.expandedBatchId = this.batches.length ? this.batches[0].id : null;
        Toast?.success("Module batch released.");
        this.view = "logbook";
        this.renderAll();
        this.onUpdate?.();
      } catch (error) {
        console.error("[ModuleManagementModal] Release failed", error);
        Toast?.error(error?.data?.message || "Unable to release this module batch.");
        btn.disabled = false;
      }
    });
  }

  // ------------------------------------------------------------------
  // Return modal view
  // ------------------------------------------------------------------

  static renderReturnModal() {
    const batch = this.batches.find((b) => b.id === this.returnState.batchId);
    if (!batch) {
      this.view = "logbook";
      return this.renderLogbook();
    }

    const returnableCount = batch.strands.reduce(
      (sum, s) => sum + s.modules.filter((m) => m.status !== "returned").length,
      0,
    );
    const strandSummary = batch.strands.map((s) => `${s.code} – ${s.name}`).join(", ");

    return `
      <div class="st-return-modal-header">
        <h2>Mark Module Return</h2>
        <button type="button" class="st-return-modal-close" data-module-close aria-label="Close">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="st-module-modal-body">
        <div class="st-return-summary-card">
          <span class="st-return-eyebrow">Returning for Student</span>
          <p class="st-return-student-name">${this.meta.name || ""}</p>

          <hr>

          <div class="st-return-summary-row">
            <div>
              <span class="st-return-eyebrow">Release Summary</span>
              <p class="st-return-summary-bold">${batch.moduleCount} Modules • ${batch.strandCount} Learning Strand${batch.strandCount === 1 ? "" : "s"}</p>
              <p class="st-return-summary-strands">${strandSummary}</p>
            </div>
            ${this.renderLastContactBlock(batch)}
          </div>

          <div class="st-return-info-note">
            <span class="material-symbols-outlined">info</span>
            Recording this return updates the learner's module history and clears the inactivity alert.
          </div>
        </div>

        <div class="st-return-checklist">
          <label class="st-return-checkall">
            <input type="checkbox" data-return-all ${this.returnState.checked.size === returnableCount && returnableCount > 0 ? "checked" : ""}>
            <span>Return All</span>
          </label>

          ${batch.strands
            .map(
              (s) => `
              <div class="st-return-strand-group">
                <span class="st-return-strand-label">${s.code} – ${s.name}</span>
                ${s.modules
                  .map((m) =>
                    m.status === "returned"
                      ? `
                    <label class="st-return-module-row st-return-module-row--returned">
                      <input type="checkbox" checked disabled>
                      <span>${m.title} <em>(Returned ${m.returned})</em></span>
                    </label>
                  `
                      : `
                    <label class="st-return-module-row">
                      <input type="checkbox" data-return-module="${m.id}" ${this.returnState.checked.has(m.id) ? "checked" : ""}>
                      <span>${m.title}</span>
                    </label>
                  `,
                  )
                  .join("")}
              </div>
            `,
            )
            .join("")}
        </div>

        <div class="st-schedule-modal-field">
          <label for="mrReturnDate">Return Date *</label>
          <input type="date" id="mrReturnDate" data-return-date value="${this.returnState.returnDate}" max="${new Date().toISOString().slice(0, 10)}">
        </div>

        <div class="st-schedule-modal-field">
          <label for="mrReturnRemarks">Remarks (optional)</label>
          <textarea id="mrReturnRemarks" data-return-remarks rows="3" placeholder="Optional notes (e.g. learner attended consultation, module incomplete, needs intervention, or referred for follow-up)">${this.returnState.remarks}</textarea>
        </div>
      </div>

      <div class="st-module-modal-footer">
        <button type="button" class="st-btn-text" data-module-cancel>Cancel</button>
        <button type="button" class="st-btn st-btn-primary" data-record-return-submit>Record Module Return</button>
      </div>
    `;
  }

  static bindReturnModal(root) {
    const allModuleIds = () => {
      const batch = this.batches.find((b) => b.id === this.returnState.batchId);
      if (!batch) return [];
      return batch.strands
        .flatMap((s) => s.modules)
        .filter((m) => m.status !== "returned")
        .map((m) => m.id);
    };

    root.querySelector("[data-return-all]")?.addEventListener("change", (e) => {
      const ids = allModuleIds();
      this.returnState.checked = e.target.checked ? new Set(ids) : new Set();
      root.querySelectorAll("[data-return-module]").forEach((cb) => {
        cb.checked = e.target.checked;
      });
    });

    root.querySelectorAll("[data-return-module]").forEach((el) => {
      el.addEventListener("change", () => {
        const id = Number(el.dataset.returnModule);
        if (el.checked) this.returnState.checked.add(id);
        else this.returnState.checked.delete(id);

        const returnAllBox = root.querySelector("[data-return-all]");
        if (returnAllBox) {
          const ids = allModuleIds();
          returnAllBox.checked = ids.length > 0 && ids.every((mid) => this.returnState.checked.has(mid));
        }
      });
    });

    root.querySelector("[data-return-date]")?.addEventListener("input", (e) => {
      this.returnState.returnDate = e.target.value;
    });

    root.querySelector("[data-return-remarks]")?.addEventListener("input", (e) => {
      this.returnState.remarks = e.target.value;
    });

    root.querySelector("[data-module-cancel]")?.addEventListener("click", () => {
      this.view = "logbook";
      this.renderAll();
    });

    root.querySelector("[data-record-return-submit]")?.addEventListener("click", async (e) => {
      if (!this.returnState.checked.size) {
        Toast?.error("Select at least one module to return.");
        return;
      }

      if (this.returnState.returnDate > new Date().toISOString().slice(0, 10)) {
        Toast?.error("Return date cannot be later than today.");
        return;
      }

      const btn = e.currentTarget;
      if (btn.disabled) return;
      btn.disabled = true;

      const payload = {
        returnDate: this.returnState.returnDate,
        remarks: this.returnState.remarks.trim(),
        moduleIds: Array.from(this.returnState.checked),
      };

      try {
        const response = await API.returnModuleBatch(this.learner.id, this.returnState.batchId, payload);
        this.meta = response.learner || this.meta;
        this.batches = response.batches || [];
        this.expandedBatchId = this.returnState.batchId;
        Toast?.success("Module return recorded.");
        this.view = "logbook";
        this.renderAll();
        this.onUpdate?.();
      } catch (error) {
        console.error("[ModuleManagementModal] Return failed", error);
        Toast?.error(error?.data?.message || "Unable to record this return.");
        btn.disabled = false;
      }
    });
  }

  // ------------------------------------------------------------------
  // Edit batch view
  // ------------------------------------------------------------------

  static renderEditForm() {
    const state = this.editState;
    const batch = this.batches.find((b) => b.id === state.batchId);
    if (!batch) {
      this.view = "logbook";
      return this.renderLogbook();
    }

    const strandOptionsHtml = (selectedCode) =>
      this.strandOptions
        .map((s) => `<option value="${s.code}" ${selectedCode === s.code ? "selected" : ""}>${s.code} – ${s.name}</option>`)
        .join("");

    return `
      <div class="st-module-modal-header">
        <button type="button" class="st-module-modal-close" data-module-close aria-label="Close">
          <span class="material-symbols-outlined">close</span>
        </button>
        <h1 class="st-module-modal-title">Edit Release Batch</h1>
        <p class="st-mrf-subtitle">Correct the release date, module details, or return dates for this batch.</p>
      </div>

      <div class="st-module-modal-body">
        ${state.error ? `<p class="st-form-error">${state.error}</p>` : ""}

        <div class="st-schedule-modal-field">
          <label for="mreReleaseDate">Release Date *</label>
          <input type="date" id="mreReleaseDate" data-edit-release-date value="${state.releaseDate}">
        </div>

        <h3 class="st-mrf-section-title">Modules</h3>

        ${state.modules
          .map(
            (m, i) => `
            <div class="st-mrf-strand-block">
              <div class="st-mrf-strand-head">
                <label>Module ${i + 1}</label>
              </div>
              <input type="text" value="${m.title}" data-edit-module-title="${i}" placeholder="Module name">

              <label for="mreStrand${i}" style="margin-top:8px;">Learning Strand</label>
              <select id="mreStrand${i}" data-edit-module-strand="${i}">
                ${strandOptionsHtml(m.strandCode)}
              </select>

              <label for="mreReturn${i}" style="margin-top:8px;">Return Date</label>
              <input type="date" id="mreReturn${i}" data-edit-module-return="${i}" value="${m.returnDate || ""}">

              <label for="mreRemarks${i}" style="margin-top:8px;">Remarks</label>
              <textarea id="mreRemarks${i}" data-edit-module-remarks="${i}" rows="2">${m.remarks || ""}</textarea>
            </div>
          `,
          )
          .join("")}
      </div>

      <div class="st-module-modal-footer">
        <button type="button" class="st-btn-text" data-module-cancel>Cancel</button>
        <button type="button" class="st-btn st-btn-primary" data-save-edit-submit>Save Changes</button>
      </div>
    `;
  }

  static bindEditForm(root) {
    const state = this.editState;

    root.querySelector("[data-edit-release-date]")?.addEventListener("input", (e) => {
      state.releaseDate = e.target.value;
    });

    root.querySelectorAll("[data-edit-module-title]").forEach((el) => {
      el.addEventListener("input", (e) => {
        state.modules[Number(el.dataset.editModuleTitle)].title = e.target.value;
      });
    });

    root.querySelectorAll("[data-edit-module-strand]").forEach((el) => {
      el.addEventListener("change", (e) => {
        state.modules[Number(el.dataset.editModuleStrand)].strandCode = e.target.value;
      });
    });

    root.querySelectorAll("[data-edit-module-return]").forEach((el) => {
      el.addEventListener("input", (e) => {
        state.modules[Number(el.dataset.editModuleReturn)].returnDate = e.target.value;
      });
    });

    root.querySelectorAll("[data-edit-module-remarks]").forEach((el) => {
      el.addEventListener("input", (e) => {
        state.modules[Number(el.dataset.editModuleRemarks)].remarks = e.target.value;
      });
    });

    root.querySelector("[data-module-cancel]")?.addEventListener("click", () => {
      this.view = "logbook";
      this.renderAll();
    });

    root.querySelector("[data-save-edit-submit]")?.addEventListener("click", async (e) => {
      const today = new Date().toISOString().slice(0, 10);

      // Mirror the backend's validation here so the teacher sees a clear
      // message immediately, without waiting on a round trip -- the backend
      // still re-validates and is the final authority.
      if (!state.releaseDate) {
        state.error = "Release date is required.";
        this.renderAll();
        return;
      }
      if (state.releaseDate > today) {
        state.error = "Release date cannot be later than the current date.";
        this.renderAll();
        return;
      }
      for (const m of state.modules) {
        if (!m.title.trim()) {
          state.error = "Module name cannot be blank.";
          this.renderAll();
          return;
        }
        if (m.returnDate) {
          if (m.returnDate > today) {
            state.error = "Return date cannot be later than the current date.";
            this.renderAll();
            return;
          }
          if (m.returnDate < state.releaseDate) {
            state.error = "Return date cannot be earlier than the module release date.";
            this.renderAll();
            return;
          }
        }
      }

      state.error = "";
      const btn = e.currentTarget;
      if (btn.disabled) return;
      btn.disabled = true;

      const payload = {
        releaseDate: state.releaseDate,
        modules: state.modules.map((m) => ({
          id: m.id,
          moduleName: m.title.trim(),
          strandCode: m.strandCode,
          returnDate: m.returnDate || null,
          remarks: m.remarks.trim(),
        })),
      };

      try {
        const response = await API.editModuleBatch(this.learner.id, state.batchId, payload);
        this.meta = response.learner || this.meta;
        this.batches = response.batches || [];
        this.expandedBatchId = state.batchId;
        Toast?.success("Release batch updated.");
        this.view = "logbook";
        this.renderAll();
        this.onUpdate?.();
      } catch (error) {
        console.error("[ModuleManagementModal] Edit failed", error);
        state.error = error?.data?.message || "Unable to update this release batch.";
        this.renderAll();
      }
    });
  }

  // ------------------------------------------------------------------
  // Shared bind dispatcher
  // ------------------------------------------------------------------

  static bind() {
    const root = this.bodyEl.parentElement;

    root.querySelectorAll("[data-module-close]").forEach((el) => {
      el.addEventListener("click", () => Modal.hide());
    });

    if (this.view === "release") this.bindReleaseForm(root);
    else if (this.view === "return") this.bindReturnModal(root);
    else if (this.view === "edit") this.bindEditForm(root);
    else this.bindLogbook(root);
  }
}

window.ModuleManagementModal = ModuleManagementModal;
