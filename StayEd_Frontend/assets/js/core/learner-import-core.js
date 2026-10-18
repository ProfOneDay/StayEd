// Shared learner-import engine used by both the Class Management "Import
// Learners" page (assets/js/teacher/learner-import.js) and the first-time
// setup wizard's Upload/Preview steps (assets/js/setup/setup.js) -- one
// source for file validation, the /learners/import* API calls, AND the
// rich preview table itself (rendering, the edit-row modal, remove-row),
// so the two "import learners" flows are the same feature end to end, not
// two separately-built UIs kept visually in sync by hand.
class LearnerImportCore {
  static VALID_EXTENSIONS = [".csv", ".xlsx", ".xls"];
  static MAX_SIZE_BYTES = 5 * 1024 * 1024;

  // Returns an error message string, or null when the file is acceptable.
  static validateFile(file) {
    const ext = "." + file.name.split(".").pop().toLowerCase();

    if (!this.VALID_EXTENSIONS.includes(ext)) {
      return "Please select a CSV or Excel file.";
    }

    if (file.size > this.MAX_SIZE_BYTES) {
      return "Maximum upload size is 5MB.";
    }

    return null;
  }

  static formatBytes(bytes) {
    return Utils.formatFileSize(bytes);
  }

  // Standard dropdown values ({ civil_status: [...], ... }) and required
  // fields, as sent by the backend with every preview -- the edit-row modal
  // offers exactly the values the import validation accepts.
  static options = {};
  // Fallback until a preview arrives; mirrors the "*" columns in
  // import_template.IMPORT_COLUMNS.
  static required = [
    "lrn", "last_name", "first_name", "sex", "birthdate", "modality", "civil_status",
    "occupation",
  ];

  static remember(preview) {
    if (preview?.options) this.options = preview.options;
    if (preview?.required) this.required = preview.required;
    return preview;
  }

  static preview(file) {
    return API.getImportPreview(file).then((r) => this.remember(r));
  }

  static revalidate(rows) {
    return API.revalidateImportRows(rows).then((r) => this.remember(r));
  }

  // class_id is intentionally optional: the backend falls back to the
  // teacher's active class when it's omitted, which is what lets the setup
  // wizard reuse this same call right after creating its first class.
  static confirm(rows, classId) {
    return API.importLearners({
      learners: rows.filter((r) => r.status !== "error"),
      ...(classId ? { class_id: classId } : {}),
    });
  }

  // Excel template built by the backend: dropdowns for every fixed-choice
  // column, required columns marked with *, and an Instructions sheet.
  static downloadTemplate() {
    return API.download(
      "/learners/import/template",
      "StayEd_Learner_Import_Template.xlsx",
    );
  }

  static cell(value) {
    return value === undefined || value === null || value === ""
      ? "—"
      : String(value);
  }

  static titleCase(value) {
    if (!value) return "—";
    return String(value)
      .toLowerCase()
      .replace(/(^|[\s/-])\S/g, (m) => m.toUpperCase());
  }

  // Normalizes a /learners/import/preview response's field names (the API
  // calls the error bucket "errors") into the {total, valid, duplicates,
  // invalid} shape both UIs' stat tiles use.
  static stats(preview) {
    return {
      total: preview?.total || 0,
      valid: preview?.valid || 0,
      duplicates: preview?.duplicates || 0,
      invalid: preview?.errors || 0,
    };
  }

  // Shared drag-and-drop + browse wiring. `onFile` is called with the
  // dropped/chosen File; validation and preview/import calls stay the
  // caller's responsibility. Swallows drops that land outside the zone
  // (e.g. on the card's own padding) so the browser doesn't navigate the
  // whole page to the raw file -- a drop that silently does nothing reads
  // exactly like "drag and drop is broken" otherwise.
  static bindDropzone({ zone, input, browseBtn, onFile }) {
    if (!zone || !input) return;

    browseBtn?.addEventListener("click", () => input.click());

    zone.addEventListener("click", (e) => {
      if (!e.target.closest("button")) input.click();
    });

    input.addEventListener("change", () => {
      if (input.files?.[0]) onFile(input.files[0]);
    });

    ["dragenter", "dragover"].forEach((evt) => {
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
        zone.classList.add("is-dragover");
      });
    });

    ["dragleave", "drop"].forEach((evt) => {
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        zone.classList.remove("is-dragover");
      });
    });

    zone.addEventListener("drop", (e) => {
      const dropped = e.dataTransfer?.files?.[0];
      if (dropped) onFile(dropped);
    });

    ["dragover", "drop"].forEach((evt) => {
      document.addEventListener(evt, (e) => {
        if (!zone.contains(e.target)) e.preventDefault();
      });
    });
  }

  // Staged fake-progress feel used while the file sits client-side, before
  // the real network call. `readyText` lets each page keep its own copy
  // ("Ready to import." vs "Ready to preview.").
  static async animateProgress(fill, statusEl, readyText, done) {
    const steps = [25, 55, 80, 100];

    for (const pct of steps) {
      await Utils.sleep(200);
      if (fill) fill.style.width = `${pct}%`;
      if (statusEl) {
        statusEl.textContent =
          pct < 100 ? `Uploading… ${pct}%` : "Scanning for duplicates and errors…";
      }
    }

    await Utils.sleep(300);

    if (statusEl) statusEl.textContent = readyText;

    done?.();
  }

  // ---------------------------------------------------------------------
  // Preview table rendering + per-row edit/remove -- shared verbatim by
  // Class Management's #importPreviewSection and the setup wizard's step
  // 4, including markup/classes, so one CSS ruleset (data-upload.css,
  // deliberately unscoped from body[data-page="Import Learners"]) styles
  // both.
  // ---------------------------------------------------------------------

  static statusBadge(status) {
    const map = {
      valid:
        '<span class="st-import-status-badge st-import-status-badge--valid">Valid</span>',
      duplicate:
        '<span class="st-import-status-badge st-import-status-badge--duplicate">Duplicate</span>',
      error:
        '<span class="st-import-status-badge st-import-status-badge--error">Error</span>',
    };

    return map[status] || map.valid;
  }

  static renderPreviewRow(row, index) {
    const name =
      `${this.cell(row.last_name)}, ${this.cell(row.first_name)} ${row.middle_name ? row.middle_name : ""}`.trim();
    const rowClass = row.status !== "valid" ? `st-import-row--${row.status}` : "";

    return `
      <tr class="${rowClass}">
          <td class="st-import-sticky-left">
              <div class="st-import-learner-cell">
                  <span class="st-import-learner-name">${name}</span>
                  <span class="st-import-learner-lrn">${this.cell(row.lrn)}</span>
              </div>
          </td>
          <td>
              <div class="st-import-status-cell">
                  ${this.statusBadge(row.status)}
                  ${row.issue ? `<span class="st-import-issue">${this.cell(row.issue)}</span>` : ""}
              </div>
          </td>
          <td>${this.titleCase(row.sex)}</td>
          <td>${this.cell(row.birthdate)}</td>
          <td>${this.titleCase(row.modality)}</td>
          <td>${this.cell(row.level)}</td>
          <td>${this.titleCase(row.re_enrollee) === "—" ? "No" : this.titleCase(row.re_enrollee)}</td>
          <td>${this.cell(row.employment_status)}</td>
          <td>${row.distance_from_clc_km != null && row.distance_from_clc_km !== "" ? `${row.distance_from_clc_km} km` : "—"}</td>
          <td>${this.cell(row.civil_status)}</td>
          <td>${this.cell(row.contact_number)}</td>
          <td>${this.cell(row.guardian_contact_number)}</td>
          <td class="st-import-sticky-right">
              <div class="st-row-actions">
                  <button type="button" class="st-icon-btn-sm" data-edit-row="${index}" aria-label="Edit row" title="Edit">
                      <span class="material-symbols-outlined">edit</span>
                  </button>
                  <button type="button" class="st-icon-btn-sm" data-remove-row="${index}" aria-label="Remove row" title="Remove">
                      <span class="material-symbols-outlined">delete</span>
                  </button>
              </div>
          </td>
      </tr>
    `;
  }

  static renderPreviewRows(tbody, rows) {
    if (!tbody) return;

    tbody.innerHTML = rows.length
      ? rows.map((row, i) => this.renderPreviewRow(row, i)).join("")
      : `<tr><td colspan="13" class="st-import-empty-cell">No rows to preview.</td></tr>`;
  }

  // `state` is a plain { rows } object the caller owns; edit/remove mutate
  // state.rows in place and re-render into `tbody`. `onRevalidated(preview)`
  // -- preview being the full {total,valid,duplicates,errors,rows} shape --
  // lets the caller refresh its own stat tiles/stored copy after every edit.
  static bindPreviewRowActions(tbody, state, onRevalidated) {
    if (!tbody) return;

    tbody.querySelectorAll("[data-edit-row]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.openEditRowModal(state, Number(btn.dataset.editRow), tbody, onRevalidated);
      });
    });

    tbody.querySelectorAll("[data-remove-row]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.removeRow(state, Number(btn.dataset.removeRow), tbody, onRevalidated);
      });
    });
  }

  static async revalidateAndRerender(state, tbody, onRevalidated) {
    try {
      const updated = await this.revalidate(state.rows);
      state.rows = updated.rows;
      this.renderPreviewRows(tbody, state.rows);
      this.bindPreviewRowActions(tbody, state, onRevalidated);
      onRevalidated?.(updated);
    } catch (error) {
      console.error("[LearnerImportCore] Unable to revalidate rows", error);
      Toast?.error("We could not re-check your changes. Please try again.");
    }
  }

  static async removeRow(state, index, tbody, onRevalidated) {
    state.rows.splice(index, 1);
    await this.revalidateAndRerender(state, tbody, onRevalidated);
    Toast?.success("Row removed.");
  }

  static openEditRowModal(state, index, tbody, onRevalidated) {
    if (!window.Modal) return;

    const row = state.rows[index];

    const mark = (key, label) =>
      this.required.includes(key) ? `${label} <span class="required">*</span>` : label;

    const field = (id, label, value, type = "text", key = null) => `
      <div class="st-schedule-modal-field">
        <label for="${id}">${mark(key, label)}</label>
        <input id="${id}" type="${type}" value="${value ?? ""}">
      </div>
    `;

    // A value that isn't one of the standard options (e.g. "singel" typed
    // in Excel) leaves the blank option selected, so the teacher has to
    // pick a real one instead of re-saving the typo.
    const select = (id, label, key, value) => {
      const options = this.options[key] || [];
      const current = String(value ?? "").trim().toLowerCase();
      return `
        <div class="st-schedule-modal-field">
          <label for="${id}">${mark(key, label)}</label>
          <select id="${id}">
            <option value="">Select ${label.toLowerCase()}</option>
            ${options
              .map(
                (opt) =>
                  `<option value="${opt}" ${opt.toLowerCase() === current ? "selected" : ""}>${opt}</option>`,
              )
              .join("")}
          </select>
        </div>
      `;
    };

    Modal.show({
      title: "Edit learner row",
      size: "lg",
      confirmLabel: "Save row",
      message: `
        <div class="st-schedule-modal-row">
          ${field("editLrn", "LRN", row.lrn, "text", "lrn")}
          ${field("editLastName", "Last name", row.last_name, "text", "last_name")}
          ${field("editFirstName", "First name", row.first_name, "text", "first_name")}
          ${field("editMiddleName", "Middle name", row.middle_name)}
          ${select("editSex", "Sex", "sex", row.sex)}
          ${field("editBirthdate", "Date of birth", row.birthdate, "date", "birthdate")}
          ${select("editModality", "Learning modality", "modality", row.modality)}
          ${select("editCivilStatus", "Civil status", "civil_status", row.civil_status)}
          ${select("editReenrollee", "Re-enrollee", "re_enrollee", row.re_enrollee || "No")}
          ${select("editEmployment", "Employment status", "employment_status", row.employment_status)}
          ${select("editOccupation", "Socio-economic status", "occupation", row.occupation)}
          ${field("editIncome", "Monthly income (₱)", row.monthly_income, "number")}
          ${field("editDistance", "Distance from CLC (km)", row.distance_from_clc_km, "number")}
          ${field("editContact", "Contact number", row.contact_number)}
          ${field("editGuardianContact", "Guardian contact number", row.guardian_contact_number)}
        </div>
      `,
      onConfirm: async () => {
        const val = (id) => document.getElementById(id)?.value.trim() || "";

        state.rows[index] = {
          ...row,
          lrn: val("editLrn"),
          last_name: val("editLastName"),
          first_name: val("editFirstName"),
          middle_name: val("editMiddleName"),
          name: `${val("editFirstName")} ${val("editLastName")}`.trim(),
          sex: val("editSex"),
          birthdate: val("editBirthdate"),
          modality: val("editModality"),
          re_enrollee: val("editReenrollee"),
          employment_status: val("editEmployment"),
          distance_from_clc_km: val("editDistance"),
          civil_status: val("editCivilStatus"),
          occupation: val("editOccupation"),
          monthly_income: val("editIncome"),
          contact_number: val("editContact"),
          guardian_contact_number: val("editGuardianContact"),
        };

        await this.revalidateAndRerender(state, tbody, onRevalidated);

        Toast?.success("Row updated.");
      },
    });
  }
}

window.LearnerImportCore = LearnerImportCore;
