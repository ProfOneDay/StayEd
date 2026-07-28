class LearnerImportPage {
  static file = null;

  static preview = null;

  static async init() {
    if (window.Guards) Guards.teacher();

    this.bindDropzone();

    this.bindPreviewActions();

    this.bindSuccessActions();

    document
      .querySelector("[data-download-template]")
      ?.addEventListener("click", () => {
        this.downloadTemplate();
      });
  }

  static downloadTemplate() {
    Utils.downloadLearnerImportTemplate();

    Toast?.success("Template downloaded.");
  }

  static bindDropzone() {
    const zone = document.getElementById("importDropZone");
    const input = document.getElementById("importFileInput");
    const browseBtn = document.getElementById("importBrowseBtn");
    const previewBtn = document.getElementById("importPreviewBtn");

    if (!zone || !input) return;

    browseBtn?.addEventListener("click", () => input.click());

    zone.addEventListener("click", (e) => {
      if (!e.target.closest("button")) input.click();
    });

    input.addEventListener("change", () => {
      if (input.files?.[0]) this.selectFile(input.files[0]);
    });

    ["dragenter", "dragover"].forEach((evt) => {
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
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
      if (dropped) this.selectFile(dropped);
    });

    previewBtn?.addEventListener("click", () => this.runPreview());
  }

  static selectFile(file) {
    const validExt = [".csv", ".xlsx", ".xls"];

    const ext = "." + file.name.split(".").pop().toLowerCase();

    if (!validExt.includes(ext)) {
      Toast?.error("Please select a CSV or Excel file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      Toast?.error("Maximum upload size is 5MB.");
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

    this.animateProgress(fill, status, () => {
      previewBtn.disabled = false;
    });
  }

  static async animateProgress(fill, status, done) {
    const steps = [25, 55, 80, 100];

    for (const pct of steps) {
      await Utils.sleep(200);
      fill.style.width = `${pct}%`;
      status.textContent =
        pct < 100
          ? `Uploading… ${pct}%`
          : "Scanning for duplicates and errors…";
    }

    await Utils.sleep(300);

    status.textContent = "Ready to preview.";

    done();
  }

  static async runPreview() {
    try {
      this.preview = await API.getImportPreview(this.file?.name);

      document
        .getElementById("importUploadSection")
        ?.classList.add("st-hidden");

      document
        .getElementById("importPreviewSection")
        ?.classList.remove("st-hidden");

      this.renderPreview();
    } catch (error) {
      console.error(error);
      Toast?.error("Unable to validate the file. Please try again.");
    }
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
        .map(
          (row) => `
                <tr class="${row.status !== "valid" ? `st-import-row--${row.status}` : ""}">
                    <td style="font-family:monospace;font-size:12px;">${row.lrn}</td>
                    <td style="font-weight:600;">${row.name}</td>
                    <td>${row.level}</td>
                    <td>${row.modality}</td>
                    <td>${this.statusBadge(row.status)}</td>
                    <td style="font-size:12px;color:var(--st-on-surface-variant);">${row.issue || "\u2014"}</td>
                </tr>
            `,
        )
        .join("");
    }
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
          const result = await API.importLearners({
            learners: this.preview.rows.filter((r) => r.status === "valid"),
          });

          document
            .getElementById("importPreviewSection")
            ?.classList.add("st-hidden");

          const success = document.getElementById("importSuccessSection");

          success?.classList.remove("st-hidden");

          this.set("[data-success-total]", this.preview.total);
          this.set("[data-success-imported]", this.preview.valid);
          this.set("[data-success-duplicates]", this.preview.duplicates);
          this.set("[data-success-errors]", this.preview.errors);

          Toast?.success(
            `${this.preview.valid} learner(s) imported successfully.`,
          );
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
    return Utils.formatFileSize(bytes);
  }

  static set(selector, value) {
    const el = document.querySelector(selector);
    if (el && value !== undefined && value !== null) {
      el.textContent = value;
    }
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
