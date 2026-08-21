class ClcUpload {
  static file = null;

  static preview = null;

  static async init() {
    if (window.Guards) Guards.teacher();

    this.bindDropzone();

    this.bindConfirmActions();
  }

  static bindDropzone() {
    const zone = document.getElementById("clcDropZone");
    const input = document.getElementById("clcFileInput");
    const browseBtn = document.getElementById("clcBrowseBtn");
    const continueBtn = document.getElementById("clcContinueBtn");

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

    continueBtn?.addEventListener("click", () => this.showConfirmation());
  }

  static selectFile(file) {
    const validExt = [".csv", ".xlsx", ".xls"];

    const ext = "." + file.name.split(".").pop().toLowerCase();

    if (!validExt.includes(ext)) {
      Toast?.error("Please select a CSV or Excel file.");
      return;
    }

    this.file = file;

    const card = document.getElementById("clcFileCard");
    const name = document.getElementById("clcFileName");
    const size = document.getElementById("clcFileSize");
    const continueBtn = document.getElementById("clcContinueBtn");
    const fill = document.getElementById("clcProgressFill");
    const status = document.getElementById("clcUploadStatus");

    name.textContent = file.name;
    size.textContent = this.formatBytes(file.size);
    card.classList.remove("st-hidden");

    this.animateProgress(fill, status, () => {
      continueBtn.disabled = false;
    });
  }

  static async animateProgress(fill, status, done) {
    const steps = [20, 45, 70, 100];

    for (const pct of steps) {
      await Utils.sleep(220);
      fill.style.width = `${pct}%`;
      status.textContent =
        pct < 100 ? `Uploading… ${pct}%` : "Validating records…";
    }

    await Utils.sleep(300);

    status.textContent = "Upload complete.";

    done();
  }

  static async showConfirmation() {
    document.getElementById("clcUploadZoneSection")?.classList.add("st-hidden");

    const section = document.getElementById("clcConfirmSection");

    section?.classList.remove("st-hidden");

    try {
      const clc = await API.getCurrentClc();

      this.set("[data-confirm-municipality]", clc.municipality);
      this.set("[data-confirm-name]", clc.name);
      this.set("[data-confirm-year]", clc.schoolYear);
      this.set("[data-confirm-level]", clc.learningLevel);
    } catch (error) {
      console.error(error);
    }

    if (this.file) {
      this.set("[data-confirm-filename]", this.file.name);

      this.set(
        "[data-confirm-filemeta]",
        `${this.formatBytes(this.file.size)} • Uploaded just now`,
      );

      try {
        this.preview = await API.getImportPreview(this.file);
        this.renderPreviewSummary();
      } catch (error) {
        console.error(error);
        Toast?.error("Unable to validate the file. Please try again.");
      }
    }
  }

  static renderPreviewSummary() {
    const p = this.preview;

    if (!p) return;

    const validRows = p.rows.filter((r) => r.status === "valid");

    this.set("[data-confirm-total]", `${p.valid} Students`);

    this.set(
      "[data-confirm-validation]",
      `${p.total} row${p.total === 1 ? "" : "s"} detected. ${p.valid} passed validation` +
        (p.duplicates || p.errors
          ? ` (${p.duplicates} duplicate${p.duplicates === 1 ? "" : "s"}, ${p.errors} error${p.errors === 1 ? "" : "s"}).`
          : "."),
    );

    const male = validRows.filter(
      (r) => String(r.sex || "").toUpperCase() === "MALE",
    ).length;
    const female = validRows.filter(
      (r) => String(r.sex || "").toUpperCase() === "FEMALE",
    ).length;
    const returning = validRows.filter((r) =>
      ["yes", "y", "true", "1"].includes(
        String(r.re_enrollee || "").toLowerCase(),
      ),
    ).length;

    const ages = validRows
      .map((r) => this.computeAge(r.birthdate))
      .filter((age) => age != null);

    this.set("[data-summary-male]", male);
    this.set("[data-summary-female]", female);
    this.set("[data-summary-returning]", returning);
    this.set(
      "[data-summary-age]",
      ages.length ? `${Math.min(...ages)} - ${Math.max(...ages)}` : "—",
    );

    const validatedPct = p.total ? Math.round((p.valid / p.total) * 100) : 0;

    this.set("[data-donut-value]", `${validatedPct}%`);

    const donutPath = document.querySelector("[data-donut-path]");

    if (donutPath) {
      donutPath.setAttribute("stroke-dasharray", `${validatedPct}, 100`);
    }
  }

  static computeAge(isoDate) {
    if (!isoDate) return null;

    const dob = new Date(isoDate);

    if (Number.isNaN(dob.getTime())) return null;

    const today = new Date();

    let age = today.getFullYear() - dob.getFullYear();

    const hasHadBirthdayThisYear =
      today.getMonth() > dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());

    if (!hasHadBirthdayThisYear) age -= 1;

    return age;
  }

  static bindConfirmActions() {
    document
      .getElementById("clcCancelClearBtn")
      ?.addEventListener("click", () => {
        document
          .getElementById("clcConfirmSection")
          ?.classList.add("st-hidden");
        document
          .getElementById("clcUploadZoneSection")
          ?.classList.remove("st-hidden");

        this.file = null;
        this.preview = null;

        document.getElementById("clcFileCard")?.classList.add("st-hidden");

        const fill = document.getElementById("clcProgressFill");

        if (fill) fill.style.width = "0%";

        const input = document.getElementById("clcFileInput");

        if (input) input.value = "";
      });

    document
      .getElementById("clcRemoveFileBtn")
      ?.addEventListener("click", () => {
        document.getElementById("clcCancelClearBtn")?.click();
      });

    document
      .getElementById("clcCreateRecordsBtn")
      ?.addEventListener("click", async () => {
        await this.createRecords();
      });
  }

  static async createRecords() {
    if (!this.preview?.rows?.length) {
      Toast?.error("No validated rows to import. Please select a file first.");
      return;
    }

    const validRows = this.preview.rows.filter((r) => r.status === "valid");

    if (!validRows.length) {
      Toast?.error("None of the rows in this file passed validation.");
      return;
    }

    const btn = document.getElementById("clcCreateRecordsBtn");

    const originalHtml = btn.innerHTML;

    btn.disabled = true;

    btn.innerHTML = `<span class="material-symbols-outlined">progress_activity</span> Creating…`;

    try {
      const result = await API.importLearners({ learners: validRows });

      document.getElementById("clcConfirmSection")?.classList.add("st-hidden");

      const imported = result?.imported ?? validRows.length;

      this.set(
        "[data-success-summary]",
        `${imported} learner profile${imported === 1 ? "" : "s"} have been generated for this CLC.`,
      );

      const success = document.getElementById("clcSuccessSection");

      success?.classList.remove("st-hidden");

      Toast?.success("Learner records created successfully.");
    } catch (error) {
      console.error(error);

      Toast?.error("Unable to create learner records.");

      btn.disabled = false;

      btn.innerHTML = originalHtml;
    }
  }

  static formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  static set(selector, value) {
    const el = document.querySelector(selector);
    if (el && value !== undefined && value !== null) {
      el.textContent = value;
    }
  }
}

(function bootClcUpload() {
  let started = false;
  const start = () => {
    if (!started) {
      started = true;
      ClcUpload.init();
    }
  };
  document.addEventListener("components:loaded", start);
  document.addEventListener("DOMContentLoaded", () => setTimeout(start, 300));
})();

window.ClcUpload = ClcUpload;
