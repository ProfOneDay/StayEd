/**
 * ============================================
 * StayEd
 * Manual Enrollment Wizard Controller
 * ============================================
 *
 * 9-step guided enrollment: Personal, Contact,
 * Guardian, Educational Background, Learning
 * Modality, Assigned CLC, Program Assignment,
 * Review, Confirmation. Supports Previous/Next
 * navigation with a progress indicator, and
 * tracks unsaved changes until submission.
 * ============================================
 */

class LearnerEnrollWizard {

    static currentStep = 1;

    static totalSteps = 9;

    static async init() {

        if (window.Guards) Guards.teacher();

        this.form = document.getElementById("enrollWizardForm");

        if (!this.form) return;

        window.UnsavedChanges?.track(this.form);

        this.bindSegments();

        this.bindNav();

        this.bindConfirmActions();

        this.updateProgress();

    }

    /* ---------------------------------------
       Segmented toggles (reused pattern from
       the round-2 enrollment form)
    --------------------------------------- */

    static bindSegments() {

        document.querySelectorAll("[data-segment]").forEach(group => {

            group.querySelectorAll("button").forEach(btn => {

                btn.addEventListener("click", () => {
                    group.querySelectorAll("button").forEach(b => b.classList.remove("is-active"));
                    btn.classList.add("is-active");
                });

            });

        });

    }

    static getSegmentValue(name) {

        const group = document.querySelector(`[data-segment="${name}"]`);

        return group?.querySelector(".is-active")?.dataset.value || null;

    }

    /* ---------------------------------------
       Wizard navigation
    --------------------------------------- */

    static bindNav() {

        document.querySelector("[data-wizard-prev]")?.addEventListener("click", () => {

            if (this.currentStep > 1) {
                this.goToStep(this.currentStep - 1);
            }

        });

        document.querySelector("[data-wizard-next]")?.addEventListener("click", () => {

            if (!this.validateStep(this.currentStep)) {
                return;
            }

            if (this.currentStep === this.totalSteps - 1) {
                // Leaving the Review step -> submit.
                this.submit();
                return;
            }

            if (this.currentStep < this.totalSteps) {
                this.goToStep(this.currentStep + 1);
            }

        });

    }

    static goToStep(step) {

        this.currentStep = step;

        document.querySelectorAll("[data-enroll-step]").forEach(el => {
            el.classList.toggle("is-active", Number(el.dataset.enrollStep) === step);
        });

        this.updateProgress();

        if (step === this.totalSteps - 1) {
            this.renderReview();
        }

        const nav = document.querySelector("[data-wizard-nav]");

        const prevBtn = document.querySelector("[data-wizard-prev]");

        const nextBtn = document.querySelector("[data-wizard-next]");

        if (prevBtn) prevBtn.disabled = step === 1;

        // Hide the Prev/Next footer entirely on the final
        // confirmation step — it has its own actions.
        if (nav) nav.style.display = step === this.totalSteps ? "none" : "flex";

        if (nextBtn) {
            nextBtn.innerHTML = step === this.totalSteps - 1
                ? `<span class="material-symbols-outlined">how_to_reg</span> Confirm &amp; Enroll`
                : `Next <span class="material-symbols-outlined">arrow_forward</span>`;
        }

    }

    static updateProgress() {

        document.querySelectorAll("[data-progress-step]").forEach(el => {

            const step = Number(el.dataset.progressStep);

            el.classList.toggle("is-active", step === this.currentStep);

            el.classList.toggle("is-complete", step < this.currentStep);

        });

    }

    /* ---------------------------------------
       Per-step validation (required fields only
       on the steps that have them)
    --------------------------------------- */

    static validateStep(step) {

        const requiredByStep = {
            1: ["wFullName", "wSex", "wBirthdate"],
            2: ["wAddress"],
            6: ["wClc"]
        };

        const ids = requiredByStep[step];

        if (!ids) return true;

        let valid = true;

        ids.forEach(id => {

            const el = document.getElementById(id);

            const isEmpty = !el.value || el.value.trim() === "";

            el.classList.toggle("has-error", isEmpty);

            if (isEmpty) valid = false;

        });

        if (!valid) {
            Toast?.error("Please complete all required fields before continuing.");
        }

        return valid;

    }

    /* ---------------------------------------
       Review step
    --------------------------------------- */

    static renderReview() {

        const container = document.querySelector("[data-review-content]");

        if (!container) return;

        const val = id => document.getElementById(id)?.value || "\u2014";

        const sections = [
            {
                title: "Personal Information",
                rows: [
                    ["Full Name", val("wFullName")],
                    ["LRN", val("wLrn")],
                    ["Sex", val("wSex")],
                    ["Birthdate", val("wBirthdate")],
                    ["Civil Status", val("wCivilStatus")]
                ]
            },
            {
                title: "Contact Information",
                rows: [
                    ["Contact Number", val("wPhone")],
                    ["Email", val("wEmail")],
                    ["Address", val("wAddress")]
                ]
            },
            {
                title: "Guardian Information",
                rows: [
                    ["Guardian Name", val("wGuardianName")],
                    ["Relationship", val("wGuardianRelation")],
                    ["Guardian Contact", val("wGuardianContact")]
                ]
            },
            {
                title: "Educational Background",
                rows: [
                    ["Re-enrollee", document.querySelector('input[name="wReenrollee"]:checked')?.value || "No"],
                    ["Employment Status", val("wEmployment")],
                    ["Last Grade Completed", val("wLastGrade")]
                ]
            },
            {
                title: "Learning Modality",
                rows: [
                    ["Learning Level", this.getSegmentValue("level")],
                    ["Modality", this.getSegmentValue("modality")]
                ]
            },
            {
                title: "Assigned CLC",
                rows: [
                    ["CLC", val("wClc")],
                    ["Distance Category", val("wDistance")],
                    ["School Year", val("wSchoolYear")]
                ]
            },
            {
                title: "Program Assignment",
                rows: [
                    ["Program", val("wProgram")],
                    ["Semester", val("wSemester")],
                    ["Assigned Teacher", val("wAssignedTeacher")]
                ]
            }
        ];

        container.innerHTML = sections.map(section => `
            <div class="st-enroll-review-section">
                <p class="st-enroll-review-section-title">${section.title}</p>
                <div class="st-enroll-review-grid">
                    ${section.rows.map(([label, value]) => `
                        <div class="st-enroll-review-row">
                            <label>${label}</label>
                            <span>${value}</span>
                        </div>
                    `).join("")}
                </div>
            </div>
        `).join("");

    }

    /* ---------------------------------------
       Submit
    --------------------------------------- */

    static async submit() {

        const nextBtn = document.querySelector("[data-wizard-next]");

        const originalHtml = nextBtn.innerHTML;

        nextBtn.disabled = true;

        nextBtn.innerHTML = `<span class="material-symbols-outlined">progress_activity</span> Enrolling…`;

        const payload = {
            name: document.getElementById("wFullName").value.trim(),
            lrn: document.getElementById("wLrn").value.trim(),
            sex: document.getElementById("wSex").value,
            birthdate: document.getElementById("wBirthdate").value,
            level: this.getSegmentValue("level"),
            modality: this.getSegmentValue("modality"),
            clc: document.getElementById("wClc").value,
            status: "Active",
            risk: "Low"
        };

        try {

            await API.createLearner(payload);

            window.UnsavedChanges?.clear(this.form);

            this.set(
                "[data-confirm-summary]",
                `${payload.name} has been added to ${payload.clc} under the ${payload.modality} modality.`
            );

            this.goToStep(this.totalSteps);

            Toast?.success("Learner enrolled successfully.");

        } catch (error) {

            console.error(error);

            Toast?.error("Unable to enroll learner. Please try again.");

            nextBtn.disabled = false;

            nextBtn.innerHTML = originalHtml;

        }

    }

    static bindConfirmActions() {

        document.querySelector("[data-enroll-another]")?.addEventListener("click", () => {

            this.form.reset();

            document.querySelectorAll("[data-segment]").forEach(group => {
                group.querySelectorAll("button").forEach((b, i) => {
                    b.classList.toggle("is-active", i === (group.dataset.segment === "level" ? 2 : 0));
                });
            });

            const nextBtn = document.querySelector("[data-wizard-next]");

            if (nextBtn) {
                nextBtn.disabled = false;
                nextBtn.innerHTML = `Next <span class="material-symbols-outlined">arrow_forward</span>`;
            }

            this.goToStep(1);

        });

    }

    static set(selector, value) {
        const el = document.querySelector(selector);
        if (el && value !== undefined && value !== null) {
            el.textContent = value;
        }
    }

}

(function bootEnrollWizard() {
    let started = false;
    const start = () => { if (!started) { started = true; LearnerEnrollWizard.init(); } };
    document.addEventListener("components:loaded", start);
    document.addEventListener("DOMContentLoaded", () => setTimeout(start, 300));
})();

window.LearnerEnrollWizard = LearnerEnrollWizard;
