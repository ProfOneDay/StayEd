class LearnerEnrollWizard {
  static currentStep = 1;

  static totalSteps = 9;

  static currentClc = null;

  static existingLearnerId = null;

  static PREFILLED_FIELD_IDS = [
    "wFullName",
    "wLrn",
    "wSex",
    "wBirthdate",
    "wCivilStatus",
    "wPhone",
    "wEmail",
    "wAddress",
    "wGuardianName",
    "wGuardianRelation",
    "wGuardianContact",
  ];

  static LOCKED_SELECT_IDS = ["wSex", "wCivilStatus", "wGuardianRelation"];

  static async init() {
    if (window.Guards) Guards.teacher();

    this.form = document.getElementById("enrollWizardForm");

    if (!this.form) return;

    window.UnsavedChanges?.track(this.form);

    this.bindBackLinks();

    this.bindGate();

    this.bindSegments();

    this.bindLrnLookup();

    this.bindNav();

    this.bindConfirmActions();

    this.updateProgress();

    await this.loadClassContext();
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

  static bindGate() {
    const gate = document.querySelector("[data-enroll-gate]");
    const wizard = document.querySelector("[data-enroll-wizard]");

    if (!gate || !wizard) return;

    document
      .querySelector('[data-gate-choice="new"]')
      ?.addEventListener("click", () => this.enterWizard());

    document
      .querySelector('[data-gate-choice="existing"]')
      ?.addEventListener("click", () => {
        document.querySelector("[data-gate-options]")?.classList.add("st-hidden");
        document
          .querySelector("[data-gate-existing-panel]")
          ?.classList.remove("st-hidden");
        this.searchExistingLearners("");
      });

    document.querySelector("[data-gate-back]")?.addEventListener("click", () => {
      document
        .querySelector("[data-gate-existing-panel]")
        ?.classList.add("st-hidden");
      document.querySelector("[data-gate-options]")?.classList.remove("st-hidden");
    });

    let searchTimer;
    document
      .querySelector("[data-gate-search-input]")
      ?.addEventListener("input", (e) => {
        clearTimeout(searchTimer);
        const value = e.target.value;
        searchTimer = setTimeout(() => this.searchExistingLearners(value), 250);
      });
  }

  static async searchExistingLearners(search) {
    const results = document.querySelector("[data-gate-search-results]");

    if (!results) return;

    results.innerHTML = `<p class="st-enroll-gate-hint">Searching…</p>`;

    try {
      const res = await API.getLearners(search ? { search } : {});
      const learners = res?.data || [];

      if (!learners.length) {
        results.innerHTML = `<p class="st-enroll-gate-hint">No matching learners found.</p>`;
        return;
      }

      results.innerHTML = learners
        .map(
          (l) => `
            <button type="button" class="st-enroll-gate-result" data-gate-select="${l.id}">
              <span class="material-symbols-outlined">person</span>
              <span class="st-enroll-gate-result-info">
                <strong>${l.name}</strong>
                <small>LRN ${l.lrn || "—"} · ${l.clc || "—"} · ${l.level || "—"}</small>
              </span>
            </button>
          `,
        )
        .join("");

      results.querySelectorAll("[data-gate-select]").forEach((btn) => {
        btn.addEventListener("click", () =>
          this.selectExistingLearner(btn.dataset.gateSelect),
        );
      });
    } catch (error) {
      console.error("[LearnerEnrollWizard] Unable to search learners", error);
      results.innerHTML = `<p class="st-enroll-gate-hint">Unable to load learners right now.</p>`;
    }
  }

  static async selectExistingLearner(id) {
    try {
      const learner = await API.getLearner(id);

      this.existingLearnerId = id;

      this.prefillFromExistingLearner(learner);

      this.enterWizard();

      Toast?.success(`Using the existing record for ${learner.name}.`);
    } catch (error) {
      console.error("[LearnerEnrollWizard] Unable to load learner", error);
      Toast?.error("Unable to load that learner's record. Please try again.");
    }
  }

  static prefillFromExistingLearner(learner) {
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el && value !== undefined && value !== null && value !== "") {
        el.value = value;
      }
    };

    set("wFullName", learner.name);
    set("wLrn", learner.lrn);
    set("wSex", learner.sex);
    set("wBirthdate", learner.birthdate);
    set("wCivilStatus", learner.civil_status);
    set("wPhone", learner.contact_number);
    set("wEmail", learner.email);
    set("wAddress", learner.address);
    set("wGuardianName", learner.guardian_name);
    set("wGuardianRelation", learner.guardian_relationship);
    set("wGuardianContact", learner.guardian_contact_number);
    set("wEmployment", learner.employment_status);
    set("wLastGrade", learner.last_grade_completed);

    this.PREFILLED_FIELD_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (this.LOCKED_SELECT_IDS.includes(id)) {
        el.disabled = true;
      } else {
        el.setAttribute("readonly", "readonly");
      }
    });

    const hidden = document.getElementById("wReenrollee");
    if (hidden) hidden.value = "Yes";

    const statusBox = document.querySelector("[data-reenrollee-status]");
    if (statusBox) {
      statusBox.innerHTML = `
                <span class="material-symbols-outlined" style="color:var(--st-secondary);">check_circle</span>
                <p><strong>Existing learner selected.</strong> ${learner.name} is already known to StayEd and will be enrolled into this class.</p>
            `;
    }

    const banner = document.querySelector("[data-existing-learner-banner]");
    if (banner) {
      banner.classList.remove("st-hidden");
      const nameEl = banner.querySelector("[data-existing-learner-name]");
      if (nameEl) nameEl.textContent = learner.name;
    }
  }

  static clearExistingLearnerPrefill() {
    this.existingLearnerId = null;

    this.PREFILLED_FIELD_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.removeAttribute("readonly");
      el.disabled = false;
    });

    document
      .querySelector("[data-existing-learner-banner]")
      ?.classList.add("st-hidden");
  }

  static enterWizard() {
    document.querySelector("[data-enroll-gate]")?.classList.add("st-hidden");
    document.querySelector("[data-enroll-wizard]")?.classList.remove("st-hidden");
  }

  static returnToGate() {
    this.clearExistingLearnerPrefill();

    document
      .querySelector("[data-gate-existing-panel]")
      ?.classList.add("st-hidden");
    document.querySelector("[data-gate-options]")?.classList.remove("st-hidden");
    document.querySelector("[data-enroll-wizard]")?.classList.add("st-hidden");
    document.querySelector("[data-enroll-gate]")?.classList.remove("st-hidden");
  }

  static async loadClassContext() {
    const teacherName = (window.Auth && Auth.user && Auth.user()) || {};
    const name =
      teacherName.full_name ||
      [teacherName.first_name, teacherName.last_name].filter(Boolean).join(" ") ||
      "";

    const teacherField = document.getElementById("wAssignedTeacher");
    if (teacherField && name) teacherField.value = name;

    try {
      this.currentClc = await API.getCurrentClc();

      const clcField = document.getElementById("wClc");
      if (clcField) clcField.value = this.currentClc?.name || "";

      const schoolYearField = document.getElementById("wSchoolYear");
      if (schoolYearField) schoolYearField.value = this.currentClc?.schoolYear || "";
    } catch (error) {
      console.error("[LearnerEnrollWizard] Unable to load current CLC", error);
    }
  }

  static bindSegments() {
    document.querySelectorAll("[data-segment]").forEach((group) => {
      group.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
          group
            .querySelectorAll("button")
            .forEach((b) => b.classList.remove("is-active"));
          btn.classList.add("is-active");
        });
      });
    });
  }

  static getSegmentValue(name) {
    const group = document.querySelector(`[data-segment="${name}"]`);

    return group?.querySelector(".is-active")?.dataset.value || null;
  }

  static bindLrnLookup() {
    const lrnInput = document.getElementById("wLrn");

    if (!lrnInput) return;

    lrnInput.addEventListener("blur", () => this.checkReenrolleeStatus());

    lrnInput.addEventListener("input", () => {
      const hidden = document.getElementById("wReenrollee");

      if (hidden) hidden.value = "No";
    });
  }

  static async checkReenrolleeStatus() {
    const lrnInput = document.getElementById("wLrn");

    const statusBox = document.querySelector("[data-reenrollee-status]");

    const hidden = document.getElementById("wReenrollee");

    if (!lrnInput || !statusBox || !hidden) return;

    const lrn = lrnInput.value.trim();

    if (!lrn) {
      statusBox.innerHTML = `
                <span class="material-symbols-outlined">person_search</span>
                <p>Enter a Learner Reference Number in Step 1 to automatically check enrollment history.</p>
            `;

      hidden.value = "No";

      return;
    }

    statusBox.innerHTML = `
              <span class="material-symbols-outlined">progress_activity</span>
              <p>Checking the StayEd database for this LRN…</p>
          `;

    try {
      const result = await API.lookupLearnerByLrn(lrn);
      const existing = result?.found ? result.data : null;

      if (existing) {
        hidden.value = "Yes";

        statusBox.innerHTML = `
                  <span class="material-symbols-outlined" style="color:var(--st-secondary);">check_circle</span>
                  <p><strong>Re-enrollee detected.</strong> This LRN matches ${existing.name}, already known to the system. Marked as a re-enrollee automatically.</p>
              `;
      } else {
        hidden.value = "No";

        statusBox.innerHTML = `
                  <span class="material-symbols-outlined">person_add</span>
                  <p>No existing record found for this LRN. This will be enrolled as a new learner.</p>
              `;
      }
    } catch (error) {
      console.error("[LearnerEnrollWizard] LRN lookup failed", error);
      hidden.value = "No";
      statusBox.innerHTML = `
                <span class="material-symbols-outlined">warning</span>
                <p>The LRN could not be checked right now. You may continue, and the server will validate it when you enroll.</p>
            `;
    }
  }

  static bindNav() {
    document
      .querySelector("[data-wizard-prev]")
      ?.addEventListener("click", () => {
        if (this.currentStep > 1) {
          this.goToStep(this.currentStep - 1);
        } else {
          // Step 1 has nowhere earlier to go inside the wizard itself --
          // send them back to the New/Existing Student gate instead.
          this.returnToGate();
        }
      });

    document
      .querySelector("[data-wizard-next]")
      ?.addEventListener("click", () => {
        if (!this.validateStep(this.currentStep)) {
          return;
        }

        if (this.currentStep === this.totalSteps - 1) {
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

    document.querySelectorAll("[data-enroll-step]").forEach((el) => {
      el.classList.toggle("is-active", Number(el.dataset.enrollStep) === step);
    });

    this.updateProgress();

    if (step === 7) {
      this.checkReenrolleeStatus();
    }

    if (step === this.totalSteps - 1) {
      this.renderReview();
    }

    const nav = document.querySelector("[data-wizard-nav]");

    const nextBtn = document.querySelector("[data-wizard-next]");

    // The Back button is always enabled -- on step 1 it returns to the
    // New/Existing Student gate instead of going to a nonexistent step 0.
    if (nav) nav.style.display = step === this.totalSteps ? "none" : "flex";

    if (nextBtn) {
      nextBtn.innerHTML =
        step === this.totalSteps - 1
          ? `<span class="material-symbols-outlined">how_to_reg</span> Confirm &amp; Enroll`
          : `Next <span class="material-symbols-outlined">arrow_forward</span>`;
    }
  }

  static updateProgress() {
    document.querySelectorAll("[data-progress-step]").forEach((el) => {
      const step = Number(el.dataset.progressStep);

      el.classList.toggle("is-active", step === this.currentStep);

      el.classList.toggle("is-complete", step < this.currentStep);
    });
  }

  static validateStep(step) {
    const requiredByStep = {
      1: ["wFullName", "wLrn", "wSex", "wBirthdate"],
      2: ["wAddress"],
    };

    const ids = requiredByStep[step];

    if (!ids) return true;

    let valid = true;

    ids.forEach((id) => {
      const el = document.getElementById(id);

      const isEmpty = !el.value || el.value.trim() === "";

      el.classList.toggle("has-error", isEmpty);

      if (isEmpty) valid = false;
    });

    if (step === 1) {
      const lrnInput = document.getElementById("wLrn");
      const lrn = lrnInput?.value.trim() || "";

      if (!/^\d{12}$/.test(lrn)) {
        lrnInput?.classList.add("has-error");
        Toast?.error("LRN must contain exactly 12 digits.");
        valid = false;
      }
    }

    if (!valid) {
      Toast?.error("Please complete all required fields before continuing.");
    }

    return valid;
  }

  static renderReview() {
    const container = document.querySelector("[data-review-content]");

    if (!container) return;

    const val = (id) => document.getElementById(id)?.value || "\u2014";

    const sections = [
      {
        title: "Personal Information",
        rows: [
          ["Full Name", val("wFullName")],
          ["LRN", val("wLrn")],
          ["Sex", val("wSex")],
          ["Birthdate", val("wBirthdate")],
          ["Civil Status", val("wCivilStatus")],
        ],
      },
      {
        title: "Contact Information",
        rows: [
          ["Contact Number", val("wPhone")],
          ["Email", val("wEmail")],
          ["Address", val("wAddress")],
        ],
      },
      {
        title: "Guardian Information",
        rows: [
          ["Guardian Name", val("wGuardianName")],
          ["Relationship", val("wGuardianRelation")],
          ["Guardian Contact", val("wGuardianContact")],
        ],
      },
      {
        title: "Learning Modality",
        rows: [
          ["Learning Level", this.getSegmentValue("level")],
          ["Modality", this.getSegmentValue("modality")],
        ],
      },
      {
        title: "Class Context",
        rows: [
          ["CLC", val("wClc")],
          ["Distance Category", val("wDistance")],
          ["School Year", val("wSchoolYear")],
        ],
      },
      {
        title: "Program Assignment",
        rows: [
          ["Program", val("wProgram")],
          ["Assigned Teacher", val("wAssignedTeacher")],
        ],
      },
      {
        title: "Educational Background",
        rows: [
          ["Re-enrollee", val("wReenrollee")],
          ["Employment Status", val("wEmployment")],
          ["Last Grade Completed", val("wLastGrade")],
        ],
      },
    ];

    container.innerHTML = sections
      .map(
        (section) => `
            <div class="st-enroll-review-section">
                <p class="st-enroll-review-section-title">${section.title}</p>
                <div class="st-enroll-review-grid">
                    ${section.rows
                      .map(
                        ([label, value]) => `
                        <div class="st-enroll-review-row">
                            <label>${label}</label>
                            <span>${value}</span>
                        </div>
                    `,
                      )
                      .join("")}
                </div>
            </div>
        `,
      )
      .join("");
  }

  static async submit() {
    const nextBtn = document.querySelector("[data-wizard-next]");

    const originalHtml = nextBtn.innerHTML;

    nextBtn.disabled = true;

    nextBtn.innerHTML = `<span class="material-symbols-outlined">progress_activity</span> Enrolling…`;

    const distanceKmByCategory = { Near: 2, Moderate: 4, Far: 7, Unknown: null };
    const distanceCategory = document.getElementById("wDistance")?.value;

    const payload = {
      name: document.getElementById("wFullName").value.trim(),
      lrn: document.getElementById("wLrn").value.trim(),
      sex: document.getElementById("wSex").value,
      birthdate: document.getElementById("wBirthdate").value,
      is_re_enrollee: document.getElementById("wReenrollee")?.value === "Yes",
      level: this.getSegmentValue("level"),
      modality: this.getSegmentValue("modality"),
      clc: document.getElementById("wClc").value,
      status: "Active",
      risk: "Low",
      civil_status: document.getElementById("wCivilStatus")?.value || null,
      contact_number: document.getElementById("wPhone")?.value.trim() || null,
      email: document.getElementById("wEmail")?.value.trim() || null,
      address: document.getElementById("wAddress")?.value.trim() || null,
      guardian_name: document.getElementById("wGuardianName")?.value.trim() || null,
      guardian_relationship: document.getElementById("wGuardianRelation")?.value || null,
      guardian_contact_number: document.getElementById("wGuardianContact")?.value.trim() || null,
      employment_status: document.getElementById("wEmployment")?.value || null,
      last_grade_completed: document.getElementById("wLastGrade")?.value.trim() || null,
      distance_km: distanceKmByCategory[distanceCategory] ?? null,
    };

    try {
      await API.createLearner(payload);

      window.UnsavedChanges?.clear(this.form);

      this.set(
        "[data-confirm-summary]",
        `${payload.name} has been added to ${payload.clc} under the ${payload.modality} modality.`,
      );

      this.goToStep(this.totalSteps);

      Toast?.success("Learner enrolled successfully.");
    } catch (error) {
      console.error(error);

      Toast?.error(error?.message || error?.data?.message || "Unable to enroll learner. Please try again.");

      nextBtn.disabled = false;

      nextBtn.innerHTML = originalHtml;
    }
  }

  static bindConfirmActions() {
    document
      .querySelector("[data-enroll-another]")
      ?.addEventListener("click", () => {
        this.form.reset();

        this.clearExistingLearnerPrefill();

        document.querySelectorAll("[data-segment]").forEach((group) => {
          group.querySelectorAll("button").forEach((b, i) => {
            b.classList.toggle(
              "is-active",
              i === (group.dataset.segment === "level" ? 2 : 0),
            );
          });
        });

        this.checkReenrolleeStatus();

        const nextBtn = document.querySelector("[data-wizard-next]");

        if (nextBtn) {
          nextBtn.disabled = false;
          nextBtn.innerHTML = `Next <span class="material-symbols-outlined">arrow_forward</span>`;
        }

        this.goToStep(1);

        this.returnToGate();
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
  const start = () => {
    if (!started) {
      started = true;
      LearnerEnrollWizard.init();
    }
  };
  document.addEventListener("components:loaded", start);
  document.addEventListener("DOMContentLoaded", () => setTimeout(start, 300));
})();

window.LearnerEnrollWizard = LearnerEnrollWizard;
