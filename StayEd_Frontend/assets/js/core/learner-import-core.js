// Shared learner-import engine used by both the Class Management "Import
// Learners" page (assets/js/teacher/learner-import.js) and the first-time
// setup wizard's Upload/Preview steps (assets/js/setup/setup.js) -- one
// source for file validation and the /learners/import* API calls, so the
// two features can't drift apart. Each page still owns its own DOM/markup,
// since the two UIs intentionally look different (a rich sticky-column
// table with inline edit on the Class Management page vs. a simpler
// read-only preview table in the wizard).
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

  static preview(file) {
    return API.getImportPreview(file);
  }

  static revalidate(rows) {
    return API.revalidateImportRows(rows);
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

  static downloadTemplate() {
    Utils.downloadLearnerImportTemplate();
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
}

window.LearnerImportCore = LearnerImportCore;
