class ClassManagement {
  static classes = [];

  static clcName = "";

  static municipality = "";

  static async init() {
    if (window.Guards) Guards.teacher();

    await this.resolveClcContext();

    this.bindAddClass();

    await this.load();
  }

  // A teacher may belong to several CLCs within their municipality, so
  // Class Management always operates on exactly one CLC at a time: either
  // the one passed in via ?clc= (arriving from CLC Overview's "View
  // Classes" button) or, when reached directly (e.g. the sidebar link),
  // the teacher's current CLC assignment.
  static async resolveClcContext() {
    const params = new URLSearchParams(window.location.search);
    const clcParam = params.get("clc");

    this.municipality = window.Auth ? Auth.municipality() : "";

    if (clcParam) {
      this.clcName = clcParam;
      return;
    }

    try {
      const current = await API.getCurrentClc();
      this.clcName = current?.name || "";
    } catch (error) {
      this.clcName = "";
    }
  }

  static async load() {
    if (window.Layout) Layout.showLoader();

    this.showSkeleton();

    try {
      if (!this.clcName) {
        this.classes = [];
        this.renderClcBanner();
        this.renderNoClcSelected();
        return;
      }

      const res = await API.getTeacherClasses();

      this.classes = (res.data || []).filter((c) => c.clc === this.clcName);

      this.renderClcBanner();

      this.render();
    } catch (error) {
      console.error("[ClassManagement]", error);
      Toast?.error("Unable to load your classes.");
    } finally {
      if (window.Layout) Layout.hideLoader();
    }
  }

  static renderClcBanner() {
    this.set(
      "[data-clc-context-name]",
      this.clcName || "No CLC selected",
    );

    this.set(
      "[data-clc-context-meta]",
      this.clcName
        ? `${this.classes.length} class${this.classes.length === 1 ? "" : "es"} under this CLC`
        : "Choose a CLC from CLC Overview to get started",
    );
  }

  static showSkeleton() {
    const grid = document.querySelector("[data-class-grid]");

    if (grid && window.Skeletons) {
      grid.innerHTML = Skeletons.cards(4);
    }
  }

  static renderNoClcSelected() {
    const grid = document.querySelector("[data-class-grid]");

    if (!grid) return;

    grid.innerHTML = `
            <div class="st-empty" style="grid-column:1/-1;">
                <span class="material-symbols-outlined">hub</span>
                <p class="st-empty-title">No Community Learning Center selected</p>
                <p class="st-empty-text">Choose a CLC from CLC Overview to view and manage its classes.</p>
                <a href="clc-overview.html" class="st-btn st-btn-primary" style="margin-top:16px;">
                    Go to CLC Overview
                </a>
            </div>
        `;
  }

  static render() {
    const grid = document.querySelector("[data-class-grid]");

    if (!grid) return;

    if (!this.classes.length) {
      grid.innerHTML = `
                <div class="st-empty" style="grid-column:1/-1;">
                    <span class="material-symbols-outlined">school</span>
                    <p class="st-empty-title">No registered classes yet.</p>
                    <p class="st-empty-text">Create a class for this CLC to begin enrolling learners and managing records.</p>
                </div>
            `;

      return;
    }

    grid.innerHTML = this.classes.map((c) => this.card(c)).join("");

    grid.querySelectorAll("[data-open-class]").forEach((el) => {
      el.addEventListener("click", () => {
        const classId = el.dataset.openClass;
        window.location.href = `learner-records.html?class=${encodeURIComponent(classId)}`;
      });
    });

    grid.querySelectorAll("[data-delete-class]").forEach((el) => {
      el.addEventListener("click", () => {
        const classId = el.dataset.deleteClass;
        const cls = this.classes.find((x) => String(x.id) === String(classId));
        this.confirmDelete(classId, cls?.level);
      });
    });

    grid.querySelectorAll("[data-take-attendance]").forEach((el) => {
      el.addEventListener("click", () => {
        const classId = el.dataset.takeAttendance;
        const cls = this.classes.find((x) => String(x.id) === String(classId));
        if (cls && window.ClassAttendanceModal) {
          ClassAttendanceModal.open(cls);
        }
      });
    });
  }

  static card(c) {
    return `
            <div class="st-clc-card">

                <div class="st-clc-card-head">
                    <div class="st-clc-card-icon">
                        <span class="material-symbols-outlined">${c.icon || "school"}</span>
                    </div>
                    <span class="st-clc-card-status">${c.schoolYear}</span>
                </div>

                <div class="st-clc-card-body">
                    <h3 class="st-clc-card-name">${c.level}</h3>
                    <p class="st-clc-card-location">
                        <span class="material-symbols-outlined">location_on</span>
                        ${c.clc}
                    </p>
                </div>

                <div class="st-clc-card-stats">
                    <div class="st-clc-card-stat-row">
                        <span>Enrolled Learners</span>
                        <span>${c.learnerCount}</span>
                    </div>
                </div>

                <div class="st-clc-card-footer st-clc-card-footer--split">
                    <button type="button" class="st-btn st-btn-primary" data-open-class="${c.id}">
                        Open Class
                        <span class="material-symbols-outlined">arrow_forward</span>
                    </button>
                    ${c.hasF2FLearners ? `
                    <button type="button" class="st-icon-btn-sm" data-take-attendance="${c.id}" aria-label="Take attendance" title="Take attendance">
                        <span class="material-symbols-outlined">checklist</span>
                    </button>
                    ` : ""}
                    <button type="button" class="st-icon-btn-sm st-icon-btn-sm--danger" data-delete-class="${c.id}" aria-label="Delete class" title="Delete class">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>

            </div>
        `;
  }

  static confirmDelete(id, level) {
    if (!window.Modal) return;

    Modal.show({
      title: "Delete Class",
      message: `Are you sure you want to delete <strong>${level || "this class"}</strong>? This cannot be undone.`,
      confirmLabel: "Delete Class",
      onConfirm: async () => {
        try {
          await API.deleteClass(id);

          Toast?.success("Class deleted.");

          await this.load();
        } catch (error) {
          console.error(error);
          Toast?.error(error.message || "Unable to delete the class.");
        }
      },
    });
  }

  static bindAddClass() {
    document
      .querySelector("[data-add-class-btn]")
      ?.addEventListener("click", async () => {
        if (!window.Modal) return;

        if (!this.clcName) {
          Toast?.warning(
            "Choose a Community Learning Center from CLC Overview first.",
          );
          return;
        }

        let activeSchoolYear = "—";
        try {
          const res = await API.getActiveSchoolYear();
          activeSchoolYear = res?.schoolYear || activeSchoolYear;
        } catch (error) {
          console.error("[ClassManagement] Unable to load active school year", error);
        }

        Modal.show({
          title: "Add Class",
          size: "sm",
          confirmLabel: "Create Class",
          message: `
            <div class="st-schedule-modal-field">
              <label>Community Learning Center</label>
              <p class="st-schedule-modal-learner">${this.clcName}</p>
            </div>
            <div class="st-schedule-modal-field">
              <label for="newClassLevel">Learning Level</label>
              <select id="newClassLevel">
                <option>Basic Literacy Program</option>
                <option>Elementary</option>
                <option>Junior High School</option>
                <option>Senior High School</option>
              </select>
            </div>
            <div class="st-schedule-modal-field">
              <label>School Year</label>
              <p class="st-schedule-modal-learner">${activeSchoolYear} <span style="font-weight:400;font-size:12px;color:var(--st-outline);">(set by your administrator)</span></p>
            </div>
          `,
          onConfirm: async () => {
            const learningLevel =
              document.getElementById("newClassLevel")?.value.trim();

            if (!learningLevel) {
              Toast?.error("Please complete all class details.");
              return;
            }

            try {
              await API.createClass({
                communityLearningCenter: this.clcName,
                municipality: this.municipality,
                learningLevel,
                semester: "Whole Year",
                className: `${learningLevel} ${activeSchoolYear}`,
              });

              Toast?.success("Class created.");
              await this.load();
            } catch (error) {
              console.error(error);
              Toast?.error(error.message || "Unable to create the class.");
            }
          },
        });
      });
  }

  static set(selector, value) {
    const el = document.querySelector(selector);
    if (el && value !== undefined && value !== null) {
      el.textContent = value;
    }
  }
}

(function bootClassManagement() {
  let started = false;
  const start = () => {
    if (!started) {
      started = true;
      ClassManagement.init();
    }
  };
  document.addEventListener("components:loaded", start);
  document.addEventListener("DOMContentLoaded", () => setTimeout(start, 400));
})();

window.ClassManagement = ClassManagement;
