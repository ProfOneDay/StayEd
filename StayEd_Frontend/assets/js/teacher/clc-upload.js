/**
 * ============================================
 * StayEd
 * CLC Upload Controller
 * ============================================
 *
 * Three-state flow:
 *   1. Drag-and-drop / browse file selection
 *      with mocked upload progress
 *   2. Enrollment confirmation (batch summary,
 *      validation donut, next-steps tip) —
 *      matches the CLC Upload design reference
 *   3. Success screen
 *
 * Reads back the CLC just created in CLC Details
 * via API.getCurrentClc() so the confirmation
 * screen reflects real (mocked) data.
 * ============================================
 */

class ClcUpload {

    static file = null;

    static async init() {

        if (window.Guards) Guards.teacher();

        this.bindDropzone();

        this.bindConfirmActions();

    }

    /* ---------------------------------------
       State 1: Dropzone
    --------------------------------------- */

    static bindDropzone() {

        const zone = document.getElementById("clcDropZone");
        const input = document.getElementById("clcFileInput");
        const browseBtn = document.getElementById("clcBrowseBtn");
        const continueBtn = document.getElementById("clcContinueBtn");

        if (!zone || !input) return;

        browseBtn?.addEventListener("click", () => input.click());

        zone.addEventListener("click", e => {
            if (!e.target.closest("button")) input.click();
        });

        input.addEventListener("change", () => {
            if (input.files?.[0]) this.selectFile(input.files[0]);
        });

        ["dragenter", "dragover"].forEach(evt => {
            zone.addEventListener(evt, e => {
                e.preventDefault();
                zone.classList.add("is-dragover");
            });
        });

        ["dragleave", "drop"].forEach(evt => {
            zone.addEventListener(evt, e => {
                e.preventDefault();
                zone.classList.remove("is-dragover");
            });
        });

        zone.addEventListener("drop", e => {
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
            status.textContent = pct < 100 ? `Uploading… ${pct}%` : "Validating records…";
        }

        await Utils.sleep(300);

        status.textContent = "42 rows detected. Ready to import.";

        done();

    }

    /* ---------------------------------------
       State 2: Confirmation
    --------------------------------------- */

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
            this.set("[data-confirm-total]", "42 Students");

        } catch (error) {

            console.error(error);

        }

        if (this.file) {

            this.set("[data-confirm-filename]", this.file.name);

            this.set(
                "[data-confirm-filemeta]",
                `${this.formatBytes(this.file.size)} • Uploaded just now`
            );

        }

    }

    static bindConfirmActions() {

        document.getElementById("clcCancelClearBtn")?.addEventListener("click", () => {

            document.getElementById("clcConfirmSection")?.classList.add("st-hidden");
            document.getElementById("clcUploadZoneSection")?.classList.remove("st-hidden");

            this.file = null;

            document.getElementById("clcFileCard")?.classList.add("st-hidden");

            const fill = document.getElementById("clcProgressFill");

            if (fill) fill.style.width = "0%";

            const input = document.getElementById("clcFileInput");

            if (input) input.value = "";

        });

        document.getElementById("clcRemoveFileBtn")?.addEventListener("click", () => {
            document.getElementById("clcCancelClearBtn")?.click();
        });

        document.getElementById("clcCreateRecordsBtn")?.addEventListener("click", async () => {
            await this.createRecords();
        });

    }

    /* ---------------------------------------
       State 3: Create records / Success
    --------------------------------------- */

    static async createRecords() {

        const btn = document.getElementById("clcCreateRecordsBtn");

        const originalHtml = btn.innerHTML;

        btn.disabled = true;

        btn.innerHTML = `<span class="material-symbols-outlined">progress_activity</span> Creating…`;

        try {

            await API.importLearners({ learners: [] });

            document.getElementById("clcConfirmSection")?.classList.add("st-hidden");

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

    /* ---------------------------------------
       Helpers
    --------------------------------------- */

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
    const start = () => { if (!started) { started = true; ClcUpload.init(); } };
    document.addEventListener("components:loaded", start);
    document.addEventListener("DOMContentLoaded", () => setTimeout(start, 300));
})();

window.ClcUpload = ClcUpload;
