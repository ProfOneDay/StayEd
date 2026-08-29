class ClassAttendanceModal {
  static classInfo = null;

  static onUpdate = null;

  static view = "dates";

  static sessions = [];

  static newDate = "";

  static currentPage = 1;

  static checklist = null; // { sessionId, date, learners: [...], checked: Set }

  static async open(classInfo, onUpdate) {
    this.classInfo = classInfo;
    this.onUpdate = onUpdate || null;
    this.view = "dates";
    this.currentPage = 1;
    this.newDate = classInfo.prefillDate || new Date().toISOString().slice(0, 10);

    const body = Modal.showCustom({ title: "", size: "lg", hideFooter: true });

    if (!body) return;

    this.bodyEl = body;
    body.parentElement.classList.add("st-module-modal");
    body.innerHTML = `<div class="st-empty" style="border:none;background:transparent;">
      <span class="material-symbols-outlined">progress_activity</span>
      <p class="st-empty-title">Loading meet-up dates…</p>
    </div>`;

    await this.loadSessions();

    // If a prefill date was provided, check if a session already exists for
    // that date and open the checklist directly; otherwise pre-fill the date
    // input and stay on the dates view so the teacher can add it.
    if (classInfo.prefillDate) {
      const parseIso = (str) => {
        if (!str) return null;
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
        const m = String(str).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        return m ? `${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}` : null;
      };
      const existing = this.sessions.find(
        (s) => (s.dateIso?.slice(0, 10) || parseIso(s.date)) === classInfo.prefillDate,
      );
      if (existing) {
        await this.openChecklist(existing.id);
        return;
      }
      // No session yet — stay on dates view with the date pre-filled
    }

    this.renderAll();
  }

  static async loadSessions() {
    try {
      const res = await API.getClassSessions(this.classInfo.id);
      this.sessions = res.data || [];
    } catch (error) {
      console.error("[ClassAttendanceModal] Failed to load sessions", error);
      Toast?.error("Unable to load meet-up dates.");
      this.sessions = [];
    }
  }

  static renderAll() {
    if (this.view === "checklist") {
      this.bodyEl.innerHTML = this.renderChecklist();
    } else {
      this.bodyEl.innerHTML = this.renderDates();
    }
    this.bind();
  }

  // ------------------------------------------------------------------
  // Dates view
  // ------------------------------------------------------------------

  static renderDates() {
    const c = this.classInfo;
    const pageSize = 5;
    const totalPages = Math.max(1, Math.ceil(this.sessions.length / pageSize));
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    const startIndex = (this.currentPage - 1) * pageSize;
    const visibleSessions = this.sessions.slice(startIndex, startIndex + pageSize);

    return `
      <div class="st-module-modal-header">
        <button type="button" class="st-module-modal-close" data-attendance-close aria-label="Close">
          <span class="material-symbols-outlined">close</span>
        </button>
        <div class="st-module-modal-title-row st-module-modal-title-row--with-actions">
          <div>
            <h1 class="st-module-modal-title">Attendance — Meet-up Dates</h1>
            <p class="st-module-modal-meta">${c.clc || "—"} • ${c.level || "—"}</p>
          </div>
          <div class="st-schedule-modal-field st-schedule-modal-field--inline st-schedule-modal-field--header">
            <label for="attNewDate">Add Meet-up Date</label>
            <input type="date" id="attNewDate" value="${this.newDate}">
            <button type="button" class="st-btn st-btn-primary" data-add-date>
              <span class="material-symbols-outlined" style="font-size:18px;">add</span>
              Add Date
            </button>
          </div>
        </div>
      </div>

      <div class="st-module-modal-body">
        ${this.sessions.length ? this.renderSessionList(visibleSessions) : this.renderDatesEmpty()}
        ${this.sessions.length > pageSize ? this.renderDatePager(totalPages) : ""}
      </div>
    `;
  }

  static renderDatesEmpty() {
    return `
      <div class="st-empty" style="border:none;background:transparent;">
        <span class="material-symbols-outlined">event</span>
        <p class="st-empty-title">No meet-up dates scheduled yet</p>
        <p class="st-empty-text">Add a date above to start recording attendance.</p>
      </div>
    `;
  }

  static renderSessionList(visibleSessions = this.sessions) {
    return `
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:20px;">
        ${visibleSessions
          .map(
            (s) => `
            <div class="st-mrb-row">
              <button type="button" class="st-mrb-row-main" data-open-session="${s.id}">
                <div class="st-mrb-col st-mrb-col--date">
                  <span class="st-mrb-label">Meet-up Date</span>
                  <span class="st-mrb-date">${s.date}</span>
                </div>
                <div class="st-mrb-col st-mrb-col--summary">
                  <span class="st-mrb-label">Recorded</span>
                  <span class="st-mrb-summary-text">${s.presentCount} of ${s.recordedCount} present</span>
                </div>
                <span class="st-pill${s.status === "Completed" ? " st-pill--teal" : ""}">${s.status}</span>
              </button>
            </div>
          `,
          )
          .join("")}
      </div>
    `;
  }

  static renderDatePager(totalPages) {
    const pages = Array.from({ length: totalPages }, (_, index) => {
      const page = index + 1;
      const isActive = page === this.currentPage;
      return `
        <button
          type="button"
          class="st-btn ${isActive ? "st-btn-primary" : "st-btn-outline"} st-btn-xs"
          data-date-page="${page}"
          ${isActive ? "aria-current=\"page\"" : ""}
        >
          ${page}
        </button>
      `;
    }).join("");

    return `
      <div class="st-mrb-pagination">
        ${pages}
      </div>
    `;
  }

  static bindDates(root) {
    root.querySelector("[data-add-date]")?.addEventListener("click", async () => {
      const dateValue = document.getElementById("attNewDate")?.value;
      if (!dateValue) {
        Toast?.error("Please choose a meet-up date.");
        return;
      }

      try {
        const res = await API.createClassSession(this.classInfo.id, dateValue);
        Toast?.success("Meet-up date added.");
        this.currentPage = 1;
        await this.loadSessions();
        this.renderAll();
        await this.openChecklist(res.id);
      } catch (error) {
        console.error("[ClassAttendanceModal] Failed to add date", error);
        Toast?.error(error?.data?.message || "Unable to add this meet-up date.");
      }
    });

    root.querySelectorAll("[data-open-session]").forEach((el) => {
      el.addEventListener("click", () => this.openChecklist(Number(el.dataset.openSession)));
    });

    root.querySelectorAll("[data-date-page]").forEach((el) => {
      el.addEventListener("click", () => {
        const pageValue = el.dataset.datePage;
        const pageSize = 5;
        const totalPages = Math.max(1, Math.ceil(this.sessions.length / pageSize));
        const nextPage = Number(pageValue);

        if (Number.isInteger(nextPage) && nextPage >= 1 && nextPage <= totalPages) {
          this.currentPage = nextPage;
          this.renderAll();
        }
      });
    });
  }

  // ------------------------------------------------------------------
  // Checklist view
  // ------------------------------------------------------------------

  static async openChecklist(sessionId) {
    try {
      const res = await API.getSessionAttendance(this.classInfo.id, sessionId);
      this.checklist = {
        sessionId,
        date: res.date,
        learners: res.learners || [],
        checked: new Set(res.learners.filter((l) => l.present).map((l) => l.enrollmentId)),
      };
      this.view = "checklist";
      this.renderAll();
    } catch (error) {
      console.error("[ClassAttendanceModal] Failed to load checklist", error);
      Toast?.error("Unable to load the attendance checklist.");
    }
  }

  static renderChecklist() {
    const c = this.classInfo;
    const list = this.checklist;

    if (!list.learners.length) {
      return `
        <div class="st-module-modal-header">
          <button type="button" class="st-module-modal-close" data-attendance-close aria-label="Close">
            <span class="material-symbols-outlined">close</span>
          </button>
          <h1 class="st-module-modal-title">Attendance — ${c.clc || "—"}, ${c.level || "—"}</h1>
          <p class="st-mrf-subtitle">Meet-up: ${list.date}</p>
        </div>
        <div class="st-module-modal-body">
          <div class="st-empty" style="border:none;background:transparent;">
            <span class="material-symbols-outlined">group_off</span>
            <p class="st-empty-title">No Face-to-Face or Blended learners enrolled</p>
            <p class="st-empty-text">Attendance only applies to learners with a meet-up-based modality.</p>
          </div>
        </div>
        <div class="st-module-modal-footer">
          <button type="button" class="st-btn-text" data-attendance-back>Back</button>
        </div>
      `;
    }

    return `
      <div class="st-module-modal-header">
        <button type="button" class="st-module-modal-close" data-attendance-close aria-label="Close">
          <span class="material-symbols-outlined">close</span>
        </button>
        <h1 class="st-module-modal-title">Attendance — ${c.clc || "—"}, ${c.level || "—"}</h1>
        <p class="st-mrf-subtitle">Meet-up: ${list.date}</p>
      </div>

      <div class="st-module-modal-body">
        <div class="st-return-checklist">
          <label class="st-return-checkall">
            <input type="checkbox" data-attendance-check-all ${list.checked.size === list.learners.length ? "checked" : ""}>
            <span>Mark All Present</span>
          </label>

          ${list.learners
            .map(
              (l) => `
              <label class="st-return-module-row">
                <input type="checkbox" data-attendance-learner="${l.enrollmentId}" ${list.checked.has(l.enrollmentId) ? "checked" : ""}>
                <span>${l.name} <em>(${l.modality}${l.noLongerEnrolled ? " — no longer enrolled" : ""})</em></span>
              </label>
            `,
            )
            .join("")}
        </div>
      </div>

      <div class="st-module-modal-footer">
        <button type="button" class="st-btn-text" data-attendance-back>Back</button>
        <button type="button" class="st-btn st-btn-primary" data-attendance-save>
          <span class="material-symbols-outlined">save</span>
          Save
        </button>
      </div>
    `;
  }

  static bindChecklist(root) {
    root.querySelector("[data-attendance-back]")?.addEventListener("click", async () => {
      this.view = "dates";
      await this.loadSessions();
      this.renderAll();
    });

    root.querySelector("[data-attendance-check-all]")?.addEventListener("change", (e) => {
      const list = this.checklist;
      list.checked = e.target.checked ? new Set(list.learners.map((l) => l.enrollmentId)) : new Set();
      root.querySelectorAll("[data-attendance-learner]").forEach((cb) => {
        cb.checked = e.target.checked;
      });
    });

    root.querySelectorAll("[data-attendance-learner]").forEach((el) => {
      el.addEventListener("change", () => {
        const id = Number(el.dataset.attendanceLearner);
        if (el.checked) this.checklist.checked.add(id);
        else this.checklist.checked.delete(id);

        const allBox = root.querySelector("[data-attendance-check-all]");
        if (allBox) allBox.checked = this.checklist.checked.size === this.checklist.learners.length;
      });
    });

    root.querySelector("[data-attendance-save]")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      if (btn.disabled) return;
      btn.disabled = true;

      try {
        const res = await API.saveSessionAttendance(
          this.classInfo.id,
          this.checklist.sessionId,
          Array.from(this.checklist.checked),
        );
        Toast?.success(`Attendance saved: ${res.presentCount} of ${res.totalCount} present.`);
        this.view = "dates";
        await this.loadSessions();
        this.renderAll();
        this.onUpdate?.();
      } catch (error) {
        console.error("[ClassAttendanceModal] Save failed", error);
        Toast?.error(error?.data?.message || "Unable to save attendance.");
        btn.disabled = false;
      }
    });
  }

  // ------------------------------------------------------------------
  // Shared bind dispatcher
  // ------------------------------------------------------------------

  static bind() {
    const root = this.bodyEl.parentElement;

    root.querySelectorAll("[data-attendance-close]").forEach((el) => {
      el.addEventListener("click", () => Modal.hide());
    });

    if (this.view === "checklist") this.bindChecklist(root);
    else this.bindDates(root);
  }
}

window.ClassAttendanceModal = ClassAttendanceModal;
