class ClassManagement {
  static classes = [];

  static async init() {
    if (window.Guards) Guards.teacher();

    this.bindAddClass();

    await this.load();
  }

  static async load() {
    if (window.Layout) Layout.showLoader();

    this.showSkeleton();

    try {
      const res = await API.getTeacherClasses();

      this.classes = res.data || [];

      this.render();
    } catch (error) {
      console.error("[ClassManagement]", error);
      Toast?.error("Unable to load your classes.");
    } finally {
      if (window.Layout) Layout.hideLoader();
    }
  }

  static showSkeleton() {
    const grid = document.querySelector("[data-class-grid]");

    if (grid && window.Skeletons) {
      grid.innerHTML = Skeletons.cards(4);
    }
  }

  static render() {
    const grid = document.querySelector("[data-class-grid]");

    if (!grid) return;

    if (!this.classes.length) {
      grid.innerHTML = `
                <div class="st-empty" style="grid-column:1/-1;">
                    <span class="material-symbols-outlined">school</span>
                    <p class="st-empty-title">No classes yet</p>
                    <p class="st-empty-text">Add your first class to start enrolling learners.</p>
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
                    <span class="st-class-card-modality-chip">${c.modality}</span>
                </div>

                <div class="st-clc-card-stats">
                    <div class="st-clc-card-stat-row">
                        <span>Enrolled Learners</span>
                        <span>${c.learnerCount}</span>
                    </div>
                </div>

                <div class="st-clc-card-footer">
                    <button type="button" class="st-btn st-btn-primary" data-open-class="${c.id}">
                        Open Class
                        <span class="material-symbols-outlined">arrow_forward</span>
                    </button>
                </div>

            </div>
        `;
  }

  static bindAddClass() {
    document
      .querySelector("[data-add-class-btn]")
      ?.addEventListener("click", async () => {
        if (!window.Modal) return;

        let clcs = [];

        try {
          const response = await API.getClcs();
          clcs = response.data || [];
        } catch (error) {
          console.warn("[ClassManagement] Unable to load CLC choices", error);
        }

        const options = clcs.length
          ? clcs
              .map((item) => {
                const name = item.name || item.clc || item.clc_name || "";
                return `<option value="${name}">${name}</option>`;
              })
              .join("")
          : `<option value="San Felipe Sur CLC">San Felipe Sur CLC</option>`;

        Modal.show({
          title: "Add Class",
          size: "sm",
          confirmLabel: "Create Class",
          message: `
            <div class="st-schedule-modal-field">
              <label for="newClassClc">Community Learning Center</label>
              <select id="newClassClc">${options}</select>
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
              <label for="newClassYear">School Year</label>
              <input id="newClassYear" type="text" value="2026-2027">
            </div>
          `,
          onConfirm: async () => {
            const communityLearningCenter =
              document.getElementById("newClassClc")?.value.trim();
            const learningLevel =
              document.getElementById("newClassLevel")?.value.trim();
            const schoolYear =
              document.getElementById("newClassYear")?.value.trim();

            if (!communityLearningCenter || !learningLevel || !schoolYear) {
              Toast?.error("Please complete all class details.");
              return;
            }

            try {
              await API.createClass({
                communityLearningCenter,
                learningLevel,
                schoolYear,
                semester: "Whole Year",
                className: `${learningLevel} ${schoolYear}`,
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
  }}

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
