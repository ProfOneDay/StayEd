/**
 * ============================================
 * StayEd
 * CLC Details ("Add New CLC") Controller
 * ============================================
 *
 * Validates the CLC registration form, creates
 * the CLC via API.createClc() (mock-backed), then
 * proceeds to the CLC Upload / learner enrollment
 * step. Required fields mirror the Community
 * Learning Center backend model.
 * ============================================
 */

class ClcDetails {

    static async init() {

        if (window.Guards) Guards.teacher();

        this.form = document.getElementById("clcDetailsForm");

        if (!this.form) return;

        window.UnsavedChanges?.track(this.form);

        this.form.addEventListener("submit", this.submit.bind(this));

    }

    static async submit(event) {

        event.preventDefault();

        const fields = [
            { id: "clcMunicipality", label: "Municipality" },
            { id: "clcName", label: "CLC Name" },
            { id: "clcLevel", label: "Learning Level" },
            { id: "clcPhone", label: "Contact Number" },
            { id: "clcAddress", label: "Address" },
            { id: "clcCoordinatorName", label: "Coordinator Name" }
        ];

        let valid = true;

        fields.forEach(({ id }) => {

            const el = document.getElementById(id);

            const group = el.closest(".st-clc-field");

            const isEmpty = !el.value || el.value.trim() === "";

            group.classList.toggle("is-invalid", isEmpty);

            if (el.classList) {
                el.classList.toggle("has-error", isEmpty);
            }

            if (isEmpty) valid = false;

        });

        if (!valid) {

            Toast?.error("Please complete all required fields.");

            return;

        }

        const submitBtn = document.getElementById("clcNextBtn");

        const originalHtml = submitBtn.innerHTML;

        submitBtn.disabled = true;

        submitBtn.innerHTML =
            `<span class="material-symbols-outlined">progress_activity</span> Saving…`;

        const payload = {
            municipality: document.getElementById("clcMunicipality").value,
            name: document.getElementById("clcName").value.trim(),
            schoolYear: document.getElementById("clcSchoolYear").value,
            semester: document.getElementById("clcSemester").value,
            learningLevel: document.getElementById("clcLevel").value,
            phone: document.getElementById("clcPhone").value.trim(),
            email: document.getElementById("clcEmail").value.trim(),
            address: document.getElementById("clcAddress").value.trim(),
            province: document.getElementById("clcProvince").value.trim(),
            zip: document.getElementById("clcZip").value.trim(),
            coordinatorName: document.getElementById("clcCoordinatorName").value.trim(),
            coordinatorEmail: document.getElementById("clcCoordinatorEmail").value.trim(),
            location: [
                document.getElementById("clcAddress").value.trim(),
                document.getElementById("clcMunicipality").value
            ].filter(Boolean).join(", ")
        };

        try {

            await API.createClc(payload);

            window.UnsavedChanges?.clear(this.form);

            Toast?.success("CLC details saved. Continue to upload learner records.");

            setTimeout(() => {
                window.location.href = "clc-upload.html";
            }, 600);

        } catch (error) {

            console.error(error);

            Toast?.error("Unable to save CLC details.");

            submitBtn.disabled = false;

            submitBtn.innerHTML = originalHtml;

        }

    }

}

(function bootClcDetails() {
    let started = false;
    const start = () => { if (!started) { started = true; ClcDetails.init(); } };
    document.addEventListener("components:loaded", start);
    document.addEventListener("DOMContentLoaded", () => setTimeout(start, 300));
})();

window.ClcDetails = ClcDetails;
