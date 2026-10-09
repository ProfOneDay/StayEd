class LearnerImportPage {
  static file = null;

  static preview = null;

  static async init() {
    if (window.Guards) Guards.teacher();

    this.bindBackLinks();

    this.bindDropzone();

    this.bindPreviewActions();

    this.bindSuccessActions();

    document
      .querySelector("[data-download-template]")
      ?.addEventListener("click", () => {
        this.downloadTemplate();
      });

    this.setImportStep(1);
  }

  // Drives the "Upload file → Review rows → Done" step indicator; called
  // wherever the three sections are shown/hidden so the indicator always
  // matches whichever section is currently visible.
  static setImportStep(n) {
    document.querySelectorAll("[data-import-step]").forEach((li) => {
      const step = Number(li.dataset.importStep);
      li.classList.toggle("is-active", step === n);
      li.classList.toggle("is-done", step < n);
    });
  }

  // Carries this page's own ?class=&clc= (set by learner-records-hub.js
  // when it links here) back onto every "return to records" link, so Back
  // lands on the same class instead of the unfiltered records view.
  static bindBackLinks() {
    const search = window.location.search || "";
    document.querySelectorAll("[data-back-to-records]").forEach((el) => {
      el.href = `learner-records.html${search}`;
    });
  }

  // The class this import should attach learners to, carried over from
  // learner-records-hub.js via ?class=<id> on the link into this page.
  static getClassId() {
    const params = new URLSearchParams(window.location.search || "");
    return params.get("class") || params.get("class_id") || null;
  }

  static downloadTemplate() {
    LearnerImportCore.downloadTemplate();

    Toast?.success("Template downloaded.");
  }

  static bindDropzone() {
    const zone = document.getElementById("importDropZone");
    const input = document.getElementById("importFileInput");
    const browseBtn = document.getElementById("importBrowseBtn");
    const previewBtn = document.getElementById("importPreviewBtn");

    LearnerImportCore.bindDropzone({
      zone,
      input,
      browseBtn,
      onFile: (file) => this.selectFile(file),
    });

    previewBtn?.addEventListener("click", () => this.runPreview());
  }

  static selectFile(file) {
    const validationError = LearnerImportCore.validateFile(file);

    if (validationError) {
      Toast?.error(validationError);
      return;
    }

    this.file = file;

    const card = document.getElementById("importFileCard");
    const name = document.getElementById("importFileName");
    const size = document.getElementById("importFileSize");
    const previewBtn = document.getElementById("importPreviewBtn");
    const fill = document.getElementById("importProgressFill");
    const status = document.getElementById("importStatusText");

    name.textContent = file.name;
    size.textContent = this.formatBytes(file.size);
    card.classList.remove("st-hidden");

    LearnerImportCore.animateProgress(fill, status, "Ready to preview.", () => {
      previewBtn.disabled = false;
    });
  }

  static async runPreview() {
    try {
      this.preview = await LearnerImportCore.preview(this.file);

      document
        .getElementById("importUploadSection")
        ?.classList.add("st-hidden");

      document
        .getElementById("importPreviewSection")
        ?.classList.remove("st-hidden");

      this.setImportStep(2);

      this.renderPreview();
    } catch (error) {
      console.error(error);
      Toast?.error("Unable to validate the file. Please try again.");
    }
  }

  static cell(value) {
    return LearnerImportCore.cell(value);
  }

  static titleCase(value) {
    return LearnerImportCore.titleCase(value);
  }

  static renderPreview() {
    const p = this.preview;

    if (!p) return;

    this.set("[data-preview-valid-count]", p.valid);
    this.set("[data-preview-duplicate-count]", p.duplicates);
    this.set("[data-preview-error-count]", p.errors);

    const body = document.querySelector("[data-preview-body]");

    if (body) {
      body.innerHTML = p.rows
        .map((row, index) => {
          const name =
            `${this.cell(row.last_name)}, ${this.cell(row.first_name)} ${row.middle_name ? row.middle_name : ""}`.trim();
          const rowClass =
            row.status !== "valid" ? `st-import-row--${row.status}` : "";

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
                    <td>${this.titleCase(row.re_enrollee) === "\u2014" ? "No" : this.titleCase(row.re_enrollee)}</td>
                    <td>${this.cell(row.employment_status)}</td>
                    <td>${row.distance_from_clc_km != null && row.distance_from_clc_km !== "" ? `${row.distance_from_clc_km} km` : "\u2014"}</td>
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
        })
        .join("");

      this.bindRowActions(body);
    }
  }

  static bindRowActions(body) {
    body.querySelectorAll("[data-edit-row]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.openEditRowModal(Number(btn.dataset.editRow));
      });
    });

    body.querySelectorAll("[data-remove-row]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.removeRow(Number(btn.dataset.removeRow));
      });
    });
  }

  static async revalidateAndRerender() {
    try {
      this.preview = await LearnerImportCore.revalidate(this.preview.rows);
      this.renderPreview();
    } catch (error) {
      console.error("[LearnerImport] Unable to revalidate rows", error);
      Toast?.error("Unable to revalidate the updated rows.");
    }
  }

  static async removeRow(index) {
    this.preview.rows.splice(index, 1);
    await this.revalidateAndRerender();
    Toast?.success("Row removed.");
  }

  static openEditRowModal(index) {
    if (!window.Modal) return;

    const row = this.preview.rows[index];

    const field = (id, label, value, type = "text") => `
      <div class="st-schedule-modal-field">
        <label for="${id}">${label}</label>
        <input id="${id}" type="${type}" value="${value ?? ""}">
      </div>
    `;

    Modal.show({
      title: "Edit learner row",
      size: "lg",
      confirmLabel: "Save row",
      message: `
        <div class="st-schedule-modal-row">
          ${field("editLrn", "LRN", row.lrn)}
          ${field("editLastName", "Last name", row.last_name)}
          ${field("editFirstName", "First name", row.first_name)}
          ${field("editMiddleName", "Middle name", row.middle_name)}
          <div class="st-schedule-modal-field">
            <label for="editSex">Sex</label>
            <select id="editSex">
              <option value="Male" ${row.sex?.toUpperCase() === "MALE" ? "selected" : ""}>Male</option>
              <option value="Female" ${row.sex?.toUpperCase() === "FEMALE" ? "selected" : ""}>Female</option>
            </select>
          </div>
          ${field("editBirthdate", "Date of birth", row.birthdate, "date")}
          <div class="st-schedule-modal-field">
            <label for="editModality">Learning modality</label>
            <select id="editModality">
              <option ${row.modality === "Face-to-Face" ? "selected" : ""}>Face-to-Face</option>
              <option ${row.modality === "Modular" ? "selected" : ""}>Modular</option>
              <option ${row.modality === "Blended" ? "selected" : ""}>Blended</option>
            </select>
          </div>
          <div class="st-schedule-modal-field">
            <label for="editReenrollee">Re-enrollee</label>
            <select id="editReenrollee">
              <option value="No" ${String(row.re_enrollee).toLowerCase() !== "yes" ? "selected" : ""}>No</option>
              <option value="Yes" ${String(row.re_enrollee).toLowerCase() === "yes" ? "selected" : ""}>Yes</option>
            </select>
          </div>
          ${field("editEmployment", "Employment status", row.employment_status)}
          ${field("editDistance", "Distance from CLC (km)", row.distance_from_clc_km, "number")}
          ${field("editCivilStatus", "Civil status", row.civil_status)}
          ${field("editContact", "Contact number", row.contact_number)}
          ${field("editGuardianContact", "Guardian contact number", row.guardian_contact_number)}
        </div>
      `,
      onConfirm: async () => {
        const val = (id) => document.getElementById(id)?.value.trim() || "";

        this.preview.rows[index] = {
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
          contact_number: val("editContact"),
          guardian_contact_number: val("editGuardianContact"),
        };

        await this.revalidateAndRerender();

        Toast?.success("Row updated.");
      },
    });
  }

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

  static bindPreviewActions() {
    document
      .querySelector("[data-preview-cancel]")
      ?.addEventListener("click", () => {
        document
          .getElementById("importPreviewSection")
          ?.classList.add("st-hidden");

        document
          .getElementById("importUploadSection")
          ?.classList.remove("st-hidden");

        this.setImportStep(1);

        this.resetUploadState();
      });

    document
      .querySelector("[data-preview-confirm]")
      ?.addEventListener("click", async () => {
        const btn = document.querySelector("[data-preview-confirm]");

        const originalHtml = btn.innerHTML;

        btn.disabled = true;

        btn.innerHTML = `<span class="material-symbols-outlined">progress_activity</span> Importing…`;

        try {
          // Duplicates are bypassed, not skipped: the row keeps its
          // "Duplicate" status in the preview, but the matching existing
          // learner is still attached to this class. Only error rows are
          // left out of the submission.
          const classId = this.getClassId();

          const result = await LearnerImportCore.confirm(this.preview.rows, classId);

          document
            .getElementById("importPreviewSection")
            ?.classList.add("st-hidden");

          const success = document.getElementById("importSuccessSection");

          success?.classList.remove("st-hidden");

          this.setImportStep(3);

          const addedCount = result.imported + result.attached;

          this.countUp("[data-success-total]", this.preview.total);
          this.countUp("[data-success-imported]", addedCount);
          this.countUp("[data-success-duplicates]", this.preview.duplicates);
          this.countUp("[data-success-errors]", this.preview.errors);

          Toast?.success(`${addedCount} learner(s) added to this class.`);
        } catch (error) {
          console.error(error);

          Toast?.error("Import failed. Please try again.");

          btn.disabled = false;

          btn.innerHTML = originalHtml;
        }
      });
  }

  static bindSuccessActions() {
    document
      .querySelector("[data-import-another]")
      ?.addEventListener("click", () => {
        document
          .getElementById("importSuccessSection")
          ?.classList.add("st-hidden");

        document
          .getElementById("importUploadSection")
          ?.classList.remove("st-hidden");

        this.setImportStep(1);

        this.resetUploadState();
      });
  }

  static resetUploadState() {
    this.file = null;

    this.preview = null;

    document.getElementById("importFileCard")?.classList.add("st-hidden");

    const fill = document.getElementById("importProgressFill");

    if (fill) fill.style.width = "0%";

    const input = document.getElementById("importFileInput");

    if (input) input.value = "";

    const previewBtn = document.getElementById("importPreviewBtn");

    if (previewBtn) previewBtn.disabled = true;
  }

  static formatBytes(bytes) {
    return LearnerImportCore.formatBytes(bytes);
  }

  static set(selector, value) {
    const el = document.querySelector(selector);
    if (el && value !== undefined && value !== null) {
      el.textContent = value;
    }
  }

  static countUp(selector, value) {
    const el = document.querySelector(selector);
    if (!el || value === undefined || value === null) return;

    const target = Number(value) || 0;
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion) {
      el.textContent = target;
      return;
    }

    const duration = 600;
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(eased * target);
      if (t < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }
}

(function bootLearnerImport() {
  let started = false;
  const start = () => {
    if (!started) {
      started = true;
      LearnerImportPage.init();
    }
  };
  document.addEventListener("components:loaded", start);
  document.addEventListener("DOMContentLoaded", () => setTimeout(start, 300));
})();

window.LearnerImportPage = LearnerImportPage;
