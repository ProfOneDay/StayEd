const CLASS_MANAGEMENT_REDUCE_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;

class ClassManagement {
  static classes = [];

  static clcName = "";

  static lastClcStorageKey = "stayed_last_teacher_clc";

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
      localStorage.setItem(this.lastClcStorageKey, this.clcName);
      return;
    }

    const lastSelectedClc = localStorage.getItem(this.lastClcStorageKey) || "";
    if (lastSelectedClc) {
      this.clcName = lastSelectedClc;
      return;
    }

    try {
      const current = await API.getCurrentClc();
      this.clcName = current?.name || "";
      if (this.clcName) localStorage.setItem(this.lastClcStorageKey, this.clcName);
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
            <div class="st-empty">
                <span class="material-symbols-outlined">hub</span>
                <p class="st-empty-title">No Community Learning Center selected</p>
                <p class="st-empty-text">Choose a CLC from CLC Overview to view and manage its classes.</p>
                <a href="clc-overview.html" class="st-btn st-btn-primary">
                    Go to CLC Overview
                </a>
            </div>
        `;

    grid.classList.remove("is-inview");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => grid.classList.add("is-inview")),
    );
  }

  static render() {
    const grid = document.querySelector("[data-class-grid]");

    if (!grid) return;

    if (!this.classes.length) {
      grid.innerHTML = `
                <div class="st-empty">
                    <span class="material-symbols-outlined">school</span>
                    <p class="st-empty-title">No registered classes yet.</p>
                    <p class="st-empty-text">Create a class for this CLC to begin enrolling learners and managing records.</p>
                </div>
            `;
    } else {
      grid.innerHTML = this.classes.map((c, i) => this.card(c, i)).join("");

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

    grid.classList.remove("is-inview");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => grid.classList.add("is-inview")),
    );

    grid.querySelectorAll("[data-countup]").forEach((el) => this.countTo(el));
  }

  static card(c, i) {
    const learners = Number(c.learnerCount) || 0;
    const schoolYear = c.schoolYear ? String(c.schoolYear).replace("-", "–") : "";

    return `
            <article class="st-clc-card${learners ? "" : " is-empty"}" style="--i:${i}">

                <div class="st-clc-card-top">
                    <div class="st-clc-card-titlerow">
                        <h3 class="st-clc-card-name">${c.level}</h3>
                        <span class="st-clc-card-status st-clc-card-status--neutral num">SY ${schoolYear}</span>
                    </div>
                </div>

                <div class="st-clc-card-figure">
                    <div class="st-clc-card-count">
                        <b class="num" data-countup>${learners}</b>
                        <span>enrolled ${learners === 1 ? "learner" : "learners"}</span>
                    </div>
                </div>

                <div class="st-clc-card-footer st-clc-card-footer--split">
                    <button type="button" class="st-clc-card-go st-clc-card-go--primary" data-open-class="${c.id}">
                        Open class
                        <span class="material-symbols-outlined">arrow_forward</span>
                    </button>
                    ${c.hasF2FLearners ? `
                    <button type="button" class="st-card-icon-btn" data-take-attendance="${c.id}" aria-label="Take attendance" title="Take attendance">
                        <span class="material-symbols-outlined">checklist</span>
                        <span class="st-card-btn-label">Attendance</span>
                    </button>
                    ` : ""}
                    <button type="button" class="st-card-icon-btn st-card-icon-btn--danger" data-delete-class="${c.id}" aria-label="Delete class" title="Delete class">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>

            </article>
        `;
  }

  // Counts a [data-countup] element up from 0 to its target over ~800ms
  // (ease-out-cubic). Writes the value immediately if motion is reduced.
  static countTo(el, value) {
    if (!el) return;
    const end = Number(value ?? el.dataset.final ?? el.textContent);
    el.dataset.final = Number.isFinite(end) ? end : (value ?? "");
    if (CLASS_MANAGEMENT_REDUCE_MOTION || !Number.isFinite(end)) {
      el.textContent = value ?? el.dataset.final;
      return;
    }
    const t0 = performance.now();
    const dur = 800;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(end * eased);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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
              <p class="st-schedule-modal-learner">${activeSchoolYear} <span class="st-clc-modal-note">(set by your administrator)</span></p>
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
              const response = await API.createClass({
                communityLearningCenter: this.clcName,
                municipality: this.municipality,
                learningLevel,
                semester: "Whole Year",
                className: `${learningLevel} ${activeSchoolYear}`,
              });

              Toast?.success(response?.message || "Class saved.");
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
