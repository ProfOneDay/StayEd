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

  static applyPreviewStats(p) {
    this.set("[data-preview-total-count]", p.total);
    this.set("[data-preview-valid-count]", p.valid);
    this.set("[data-preview-duplicate-count]", p.duplicates);
    this.set("[data-preview-error-count]", p.errors);

    const count = document.querySelector("[data-preview-count]");
    if (count) {
      count.textContent = `Showing ${p.rows.length} of ${p.total} row${p.total === 1 ? "" : "s"}`;
    }
  }

  static renderPreview() {
    const p = this.preview;

    if (!p) return;

    this.applyPreviewStats(p);

    const body = document.querySelector("[data-preview-body]");

    if (body) {
      LearnerImportCore.renderPreviewRows(body, p.rows);

      this.previewState = { rows: p.rows };

      LearnerImportCore.bindPreviewRowActions(body, this.previewState, (updated) => {
        this.preview = updated;

        this.applyPreviewStats(updated);
      });
    }
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
