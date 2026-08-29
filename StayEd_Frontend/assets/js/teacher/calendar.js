/**
 * TeacherCalendar
 * Google Calendar-style month/week view for ALS teachers.
 *
 * Features:
 *  - Month and Week views with navigation
 *  - Attendance sessions, module release dates, module return due dates as event chips
 *  - Mini-month navigator (left sidebar) keeps in sync with main grid
 *  - Upcoming events panel (next 7 days)
 *  - Slide-in day detail panel on cell click
 *  - "Record Attendance" → delegates to ClassAttendanceModal
 *  - "Set Module Release Date" → inline Modal.show() form
 *  - Class filter dropdown (All Classes or specific class)
 */
class TeacherCalendar {
  // ── State ──────────────────────────────────────────────────────────────────
  static view = "month";          // "month" | "week"
  static cursor = new Date();     // currently displayed month/week
  static today = new Date();
  static selectedDate = null;     // ISO date string of open day panel
  static classes = [];            // fetched teacher classes
  static events = {};             // keyed by ISO date "YYYY-MM-DD"
  static selectedClassId = "";    // "" = all

  // ── Boot ───────────────────────────────────────────────────────────────────
  static async init() {
    if (window.Guards) Guards.teacher();

    // Normalise cursor to midnight
    this.cursor = new Date(
      this.today.getFullYear(),
      this.today.getMonth(),
      1,
    );

    this.bindToolbar();
    this.bindMiniNav();
    this.bindDayPanel();
    this.bindViewToggle();

    await this.loadClasses();
    await this.loadEvents();

    this.render();
    this.renderUpcoming();
  }

  // ── Data ───────────────────────────────────────────────────────────────────
  static async loadClasses() {
    try {
      const res = await API.getTeacherClasses?.() ?? await API.getClasses?.();
      this.classes = (res?.data || res || []).filter(Boolean);
    } catch (e) {
      console.warn("[TeacherCalendar] Could not load classes:", e);
      this.classes = [];
    }

    this._bindClassSearch();
  }

  static _bindClassSearch() {
    const input    = document.getElementById("calClassSearchInput");
    const dropdown = document.getElementById("calClassSearchDropdown");
    const clearBtn = document.getElementById("calClassSearchClear");

    if (!input || !dropdown) return;

    // Normalise field names — /teacher-classes uses `level` and `clc`;
    // /classes uses `learningLevel` and `communityLearningCenter`.
    const getLevel = (c) =>
      c.level || c.learningLevel || c.learning_level || "";
    const getClc = (c) =>
      c.clc || c.clcName || c.clc_name || c.communityLearningCenter || "Unknown CLC";
    const getName = (c) =>
      getLevel(c) || c.className || c.class_name || `Class ${c.id}`;
    const getSY = (c) =>
      String(c.schoolYear || c.school_year || "");

    // Group classes by CLC name
    const groupByCLC = (list) => {
      const map = {};
      list.forEach((c) => {
        const clc = getClc(c);
        if (!map[clc]) map[clc] = [];
        map[clc].push(c);
      });
      return map;
    };

    const renderDropdown = (query = "") => {
      const term = query.trim().toLowerCase();

      let filtered = this.classes;
      if (term) {
        filtered = filtered.filter((c) => {
          const clc  = getClc(c).toLowerCase();
          const name = getName(c).toLowerCase();
          return clc.includes(term) || name.includes(term);
        });
      }

      let html = "";

      // "All Classes" row — only show when no query
      if (!term) {
        html += `
          <div class="st-cal-search-all-option${!this.selectedClassId ? " is-active" : ""}"
               data-cal-pick-all role="option" aria-selected="${!this.selectedClassId}">
            <span class="material-symbols-outlined">layers</span>
            All Classes
          </div>`;
      }

      if (!filtered.length) {
        html += `<div class="st-cal-search-empty">No classes match "${this._esc(query)}"</div>`;
      } else {
        const groups = groupByCLC(filtered);
        Object.entries(groups).forEach(([clcName, classes]) => {
          html += `
            <div class="st-cal-search-group-header">
              <span class="material-symbols-outlined">hub</span>
              ${this._esc(clcName)}
            </div>`;

          classes.forEach((c) => {
            const name = this._esc(getName(c));
            const sy   = getSY(c);
            const meta = sy ? `SY ${this._esc(sy)}` : "";
            const isActive = String(c.id) === String(this.selectedClassId);

            html += `
              <div class="st-cal-search-class-option${isActive ? " is-active" : ""}"
                   data-cal-pick-class="${c.id}" role="option" aria-selected="${isActive}">
                <div class="st-cal-search-class-option-info">
                  <span class="st-cal-search-class-name">${name}</span>
                  ${meta ? `<span class="st-cal-search-class-meta">${meta}</span>` : ""}
                </div>
              </div>`;
          });
        });
      }

      dropdown.innerHTML = html;
      dropdown.classList.remove("st-hidden");
      input.setAttribute("aria-expanded", "true");

      // Bind "All Classes"
      dropdown.querySelector("[data-cal-pick-all]")?.addEventListener("click", () => {
        this._selectClass(null, "All Classes");
      });

      // Bind individual class rows
      dropdown.querySelectorAll("[data-cal-pick-class]").forEach((row) => {
        row.addEventListener("click", () => {
          const cid = row.dataset.calPickClass;
          const cls = this.classes.find((c) => String(c.id) === String(cid));
          if (cls) {
            const name = getName(cls);
            const clc  = getClc(cls);
            this._selectClass(cid, clc ? `${name} — ${clc}` : name);
          }
        });
      });
    };

    // Show dropdown on focus
    input.addEventListener("focus", () => renderDropdown(input.value));

    // Filter on type
    let debounce;
    input.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => renderDropdown(input.value), 150);
      if (clearBtn) clearBtn.classList.toggle("st-hidden", !input.value);
    });

    // Clear button
    clearBtn?.addEventListener("mousedown", (e) => e.preventDefault());
    clearBtn?.addEventListener("click", () => {
      input.value = "";
      clearBtn.classList.add("st-hidden");
      this._selectClass(null, "All Classes");
      input.focus();
    });

    // Close on outside click
    document.addEventListener("click", (e) => {
      const wrap = document.getElementById("calClassSearchWrap");
      if (wrap && !wrap.contains(e.target)) {
        dropdown.classList.add("st-hidden");
        input.setAttribute("aria-expanded", "false");
      }
    });

    // Close on Escape
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        dropdown.classList.add("st-hidden");
        input.setAttribute("aria-expanded", "false");
        input.blur();
      }
    });
  }

  static async _selectClass(classId, label) {
    const input    = document.getElementById("calClassSearchInput");
    const dropdown = document.getElementById("calClassSearchDropdown");
    const clearBtn = document.getElementById("calClassSearchClear");

    this.selectedClassId = classId || "";

    if (input) {
      input.value = classId ? label : "";
      input.setAttribute("aria-expanded", "false");
    }
    if (dropdown) dropdown.classList.add("st-hidden");
    if (clearBtn) clearBtn.classList.toggle("st-hidden", !classId);

    await this.loadEvents();
    this.render();
    this.renderUpcoming();
  }

  static async loadEvents() {
    this.events = {};

    // Determine date range to fetch (current month ±1 month buffer)
    const year = this.cursor.getFullYear();
    const month = this.cursor.getMonth();
    const from = new Date(year, month - 1, 1);
    const to   = new Date(year, month + 2, 0);

    const fmt = (d) => d.toISOString().slice(0, 10);

    const classIds = this.selectedClassId
      ? [this.selectedClassId]
      : this.classes.map((c) => c.id);

    await Promise.all(
      classIds.map((classId) => this.loadClassEvents(classId, fmt(from), fmt(to))),
    );
  }

  static async loadClassEvents(classId, from, to) {
    const cls = this.classes.find((c) => String(c.id) === String(classId));
    const className =
      cls?.level || cls?.learningLevel || cls?.class_name || `Class ${classId}`;

    try {
      // ── Attendance sessions ────────────────────────────────────────────
      const sessRes = await API.getClassSessions?.(classId);
      const sessions = sessRes?.data || sessRes || [];

      sessions.forEach((s) => {
        const date = s.dateIso?.slice(0, 10) || this._parseDate(s.date);
        if (!date) return;
        this._addEvent(date, {
          type: "attendance",
          label: `Attendance — ${className}`,
          meta: `${s.presentCount ?? "?"}/${s.recordedCount ?? "?"} present`,
          classId,
          className,
          sessionId: s.id,
          status: s.status,
        });
      });
    } catch (e) {
      console.warn(`[TeacherCalendar] Sessions load failed for class ${classId}`, e);
    }

    try {
      // ── Module release & return dates ──────────────────────────────────
      const modRes = await API.getClassModules?.(classId);
      const modules = modRes?.data || modRes || [];

      modules.forEach((m) => {
        // lastReleaseDate comes back as "August 15, 2026" — parse it
        const rel = this._parseLongDate(m.lastReleaseDate)
          || this._parseDate(m.releaseDate || m.release_date);
        if (rel) {
          this._addEvent(rel, {
            type: "module",
            label: `Module Released — ${className}`,
            meta: m.title || m.moduleName || m.module_name || "Module",
            classId,
            className,
            moduleId: m.id,
          });

          // Derive a return-due date: rel + 14 days as a calendar hint
          // (exact per-learner dates live in the roster, but this gives
          // a visible marker without N extra API calls)
          const relD = new Date(rel + "T00:00:00");
          relD.setDate(relD.getDate() + 14);
          const ret = this._fmt(relD);
          this._addEvent(ret, {
            type: "return",
            label: `Return Due — ${className}`,
            meta: m.title || m.moduleName || m.module_name || "Module",
            classId,
            className,
            moduleId: m.id,
          });
        }
      });
    } catch (e) {
      console.warn(`[TeacherCalendar] Modules load failed for class ${classId}`, e);
    }
  }

  static _addEvent(date, event) {
    if (!this.events[date]) this.events[date] = [];
    this.events[date].push(event);
  }

  // ── Rendering ──────────────────────────────────────────────────────────────
  static render() {
    this.renderMiniMonth();
    if (this.view === "month") {
      this.renderMonthGrid();
    } else {
      this.renderWeekGrid();
    }
  }

  // ---- Mini-month (left sidebar) ------------------------------------------
  static renderMiniMonth() {
    const year  = this.cursor.getFullYear();
    const month = this.cursor.getMonth();

    const label = document.getElementById("miniMonthLabel");
    if (label) {
      label.textContent = new Date(year, month, 1).toLocaleDateString("en-PH", {
        month: "long",
        year: "numeric",
      });
    }

    const container = document.getElementById("miniDays");
    if (!container) return;

    const todayStr = this._fmt(this.today);
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev  = new Date(year, month, 0).getDate();

    let html = "";

    // Leading days from previous month
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrev - i;
      const date = this._fmt(new Date(year, month - 1, d));
      html += this._miniDayHtml(d, date, true, todayStr);
    }

    // Days of current month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = this._fmt(new Date(year, month, d));
      html += this._miniDayHtml(d, date, false, todayStr);
    }

    // Trailing days from next month
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    let next = 1;
    for (let i = firstDay + daysInMonth; i < totalCells; i++, next++) {
      const date = this._fmt(new Date(year, month + 1, next));
      html += this._miniDayHtml(next, date, true, todayStr);
    }

    container.innerHTML = html;

    container.querySelectorAll("[data-mini-date]").forEach((el) => {
      el.addEventListener("click", () => {
        const date = el.dataset.miniDate;
        const d = new Date(date + "T00:00:00");
        this.cursor = new Date(d.getFullYear(), d.getMonth(), 1);
        this.render();
        this.openDayPanel(date);
      });
    });
  }

  static _miniDayHtml(d, date, otherMonth, todayStr) {
    const hasEvents = !!this.events[date]?.length;
    const cls = [
      "st-cal-mini-day",
      otherMonth          ? "is-other-month"  : "",
      date === todayStr   ? "is-today"        : "",
      date === this.selectedDate ? "is-selected" : "",
      hasEvents           ? "has-events"      : "",
    ].filter(Boolean).join(" ");

    return `<span class="${cls}" data-mini-date="${date}">${d}</span>`;
  }

  // ---- Month grid ----------------------------------------------------------
  static renderMonthGrid() {
    const grid = document.getElementById("calGrid");
    const week = document.getElementById("calWeek");
    if (!grid) return;

    grid.classList.remove("st-hidden");
    if (week) week.classList.add("st-hidden");

    // Update DOW header (shown for month view)
    const dowRow = document.querySelector(".st-cal-dow-row");
    if (dowRow) dowRow.classList.remove("st-hidden");

    const year  = this.cursor.getFullYear();
    const month = this.cursor.getMonth();

    document.getElementById("calMonthLabel").textContent =
      new Date(year, month, 1).toLocaleDateString("en-PH", {
        month: "long",
        year: "numeric",
      });

    const todayStr = this._fmt(this.today);
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev  = new Date(year, month, 0).getDate();

    let html = "";

    // Leading cells
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrev - i;
      const date = this._fmt(new Date(year, month - 1, d));
      html += this._monthCellHtml(d, date, true, todayStr);
    }

    // Current month cells
    for (let d = 1; d <= daysInMonth; d++) {
      const date = this._fmt(new Date(year, month, d));
      html += this._monthCellHtml(d, date, false, todayStr);
    }

    // Trailing cells
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    let next = 1;
    for (let i = firstDay + daysInMonth; i < totalCells; i++, next++) {
      const date = this._fmt(new Date(year, month + 1, next));
      html += this._monthCellHtml(next, date, true, todayStr);
    }

    grid.innerHTML = html;

    grid.querySelectorAll("[data-cal-date]").forEach((cell) => {
      cell.addEventListener("click", (e) => {
        if (e.target.closest(".st-cal-more")) return;
        this.openDayPanel(cell.dataset.calDate);
      });
    });

    grid.querySelectorAll(".st-cal-more").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openDayPanel(btn.dataset.calDate);
      });
    });
  }

  static _monthCellHtml(d, date, otherMonth, todayStr) {
    const evts = this.events[date] || [];
    const isToday  = date === todayStr;
    const isSelected = date === this.selectedDate;

    const cls = [
      "st-cal-cell",
      otherMonth ? "is-other-month" : "",
      isToday    ? "is-today"       : "",
      isSelected ? "is-selected"   : "",
    ].filter(Boolean).join(" ");

    const MAX_VISIBLE = 3;
    const visible  = evts.slice(0, MAX_VISIBLE);
    const overflow = evts.length - MAX_VISIBLE;

    const chips = visible.map((e) => this._eventChipHtml(e)).join("");
    const more  = overflow > 0
      ? `<span class="st-cal-more" data-cal-date="${date}">+${overflow} more</span>`
      : "";

    return `
      <div class="${cls}" data-cal-date="${date}">
        <div class="st-cal-cell-num">${d}</div>
        <div class="st-cal-cell-events">
          ${chips}
          ${more}
        </div>
      </div>`;
  }

  static _eventChipHtml(evt) {
    const icons = {
      attendance: "how_to_reg",
      module:     "inventory_2",
      return:     "assignment_return",
    };
    return `
      <div class="st-cal-event st-cal-event--${evt.type}" title="${this._esc(evt.label)} — ${this._esc(evt.meta)}">
        <span class="material-symbols-outlined">${icons[evt.type] || "event"}</span>
        ${this._esc(evt.label)}
      </div>`;
  }

  // ---- Week grid -----------------------------------------------------------
  static renderWeekGrid() {
    const grid = document.getElementById("calGrid");
    const week = document.getElementById("calWeek");
    if (!week) return;

    if (grid) grid.classList.add("st-hidden");
    week.classList.remove("st-hidden");

    // Hide separate DOW header (week view has its own)
    const dowRow = document.querySelector(".st-cal-dow-row");
    if (dowRow) dowRow.classList.add("st-hidden");

    // Find the Sunday of the week containing cursor day-1 or today
    const ref = new Date(
      this.cursor.getFullYear(),
      this.cursor.getMonth(),
      this.cursor.getDate() > 1 ? this.cursor.getDate() : 1,
    );
    const sunday = new Date(ref);
    sunday.setDate(ref.getDate() - ref.getDay());

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      return d;
    });

    const todayStr = this._fmt(this.today);

    document.getElementById("calMonthLabel").textContent =
      `${days[0].toLocaleDateString("en-PH", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;

    const DOWS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Header row
    let html = `<div class="st-cal-week-head-gutter"></div>`;
    days.forEach((d, i) => {
      const date = this._fmt(d);
      const isToday = date === todayStr;
      html += `
        <div class="st-cal-week-head-cell">
          <span class="st-cal-week-head-dow">${DOWS[i]}</span>
          <span class="st-cal-week-head-num${isToday ? " is-today" : ""}">${d.getDate()}</span>
        </div>`;
    });

    // All-day events row
    html += `<div class="st-cal-week-allday-gutter">all-day</div>`;
    days.forEach((d) => {
      const date = this._fmt(d);
      const isToday = date === todayStr;
      const isSelected = date === this.selectedDate;
      const evts = this.events[date] || [];
      const cls = [
        "st-cal-week-allday-cell",
        isToday    ? "is-today"    : "",
        isSelected ? "is-selected" : "",
      ].filter(Boolean).join(" ");

      const chips = evts.map((e) => this._eventChipHtml(e)).join("");

      html += `
        <div class="${cls}" data-cal-date="${date}">
          ${chips || ""}
        </div>`;
    });

    week.innerHTML = html;

    week.querySelectorAll("[data-cal-date]").forEach((cell) => {
      cell.addEventListener("click", () => this.openDayPanel(cell.dataset.calDate));
    });
  }

  // ---- Upcoming events (next 7 days) --------------------------------------
  static renderUpcoming() {
    const container = document.getElementById("upcomingList");
    if (!container) return;

    const items = [];
    for (let i = 0; i <= 7; i++) {
      const d = new Date(this.today);
      d.setDate(this.today.getDate() + i);
      const date = this._fmt(d);
      (this.events[date] || []).forEach((e) => items.push({ date, ...e }));
    }

    if (!items.length) {
      container.innerHTML = `<p class="st-cal-upcoming-empty">No upcoming events in the next 7 days.</p>`;
      return;
    }

    const colors = {
      attendance: "var(--st-secondary)",
      module:     "var(--st-primary)",
      return:     "#e67700",
    };

    container.innerHTML = items
      .map((item) => {
        const dateLabel = new Date(item.date + "T00:00:00").toLocaleDateString(
          "en-PH",
          { month: "short", day: "numeric" },
        );
        return `
          <div class="st-cal-upcoming-item">
            <span class="st-cal-upcoming-dot" style="background:${colors[item.type] || "#888"}"></span>
            <div class="st-cal-upcoming-info">
              <span class="st-cal-upcoming-label">${this._esc(item.label)}</span>
              <span class="st-cal-upcoming-meta">${dateLabel} · ${this._esc(item.meta)}</span>
            </div>
          </div>`;
      })
      .join("");
  }

  // ── Day detail panel ───────────────────────────────────────────────────────
  static openDayPanel(date) {
    this.selectedDate = date;
    this.render(); // re-render to highlight selected cell

    const panel = document.getElementById("calDayPanel");
    if (!panel) return;

    // Date label
    const d = new Date(date + "T00:00:00");
    document.getElementById("panelDateLabel").textContent = d.toLocaleDateString(
      "en-PH",
      { weekday: "long", year: "numeric", month: "long", day: "numeric" },
    );

    // Class context label
    const cls = this.classes.find((c) => String(c.id) === String(this.selectedClassId));
    document.getElementById("panelClassLabel").textContent = cls
      ? cls.level || cls.learningLevel || cls.className || cls.class_name || ""
      : this.classes.length ? "All Classes" : "";

    // Events list
    const evts = this.events[date] || [];
    const list  = document.getElementById("panelEventsList");
    const colors = {
      attendance: "var(--st-secondary)",
      module:     "var(--st-primary)",
      return:     "#e67700",
    };

    if (!evts.length) {
      list.innerHTML = `<p class="st-cal-day-empty">No events recorded for this date.</p>`;
    } else {
      list.innerHTML = evts
        .map(
          (e) => `
          <div class="st-cal-panel-event">
            <span class="st-cal-panel-event-dot" style="background:${colors[e.type] || "#888"}"></span>
            <div class="st-cal-panel-event-body">
              <span class="st-cal-panel-event-title">${this._esc(e.label)}</span>
              <span class="st-cal-panel-event-meta">${this._esc(e.meta)}</span>
            </div>
          </div>`,
        )
        .join("");
    }

    // Wire action buttons
    const btnAttendance = document.getElementById("panelRecordAttendance");
    const btnModule     = document.getElementById("panelSetModuleRelease");

    // Clone to remove old listeners
    const newBtnA = btnAttendance.cloneNode(true);
    const newBtnM = btnModule.cloneNode(true);
    btnAttendance.replaceWith(newBtnA);
    btnModule.replaceWith(newBtnM);

    newBtnA.addEventListener("click", () => this.openAttendanceDialog(date));
    newBtnM.addEventListener("click", () => this.openModuleReleaseDialog(date));

    panel.classList.remove("st-hidden");
    this.renderMiniMonth(); // sync mini selection
  }

  static closeDayPanel() {
    const panel = document.getElementById("calDayPanel");
    if (panel) panel.classList.add("st-hidden");
  }

  // ── Attendance dialog ──────────────────────────────────────────────────────
  static async openAttendanceDialog(date) {
    const allClasses = this.classes;

    if (!allClasses.length) {
      Toast?.error("No classes found. Please set up a class first.");
      return;
    }

    // If there is exactly one class, or the teacher has already filtered to
    // a specific class, skip the picker and go straight to the modal.
    const preselected = this.selectedClassId
      ? allClasses.find((c) => String(c.id) === String(this.selectedClassId))
      : null;

    if (preselected) {
      this._openAttendanceForClass(preselected, date);
      return;
    }

    if (allClasses.length === 1) {
      this._openAttendanceForClass(allClasses[0], date);
      return;
    }

    // Multiple classes — show a styled picker
    const d = new Date(date + "T00:00:00");
    const dateLabel = d.toLocaleDateString("en-PH", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const classRowsHtml = allClasses
      .map((c) => {
        const name = this._esc(c.level || c.learningLevel || c.learning_level || c.className || c.class_name || `Class ${c.id}`);
        const level = this._esc(c.level || c.learningLevel || c.learning_level || "");
        const sy = this._esc(String(c.schoolYear || c.school_year || "—"));
        const clc = this._esc(c.clc || c.clcName || c.clc_name || c.communityLearningCenter || "");
        return `
          <div class="st-cal-modal-class-row" data-pick-class="${c.id}" role="button" tabindex="0">
            <div class="st-cal-modal-class-icon">
              <span class="material-symbols-outlined">school</span>
            </div>
            <div class="st-cal-modal-class-info">
              <span class="st-cal-modal-class-name">${name}</span>
              <span class="st-cal-modal-class-meta">${[clc, level, sy ? `SY ${sy}` : ""].filter(Boolean).join(" · ")}</span>
            </div>
            <span class="material-symbols-outlined" style="font-size:18px;color:var(--st-outline);">chevron_right</span>
          </div>`;
      })
      .join("");

    const bodyHtml = `
      <div class="st-cal-modal-body">
        <div class="st-cal-modal-info">
          <span class="material-symbols-outlined">calendar_month</span>
          <span>Recording attendance for <strong>${this._esc(dateLabel)}</strong>. Select the class to continue.</span>
        </div>
        <div class="st-cal-modal-class-list">
          ${classRowsHtml}
        </div>
      </div>`;

    Modal?.show({
      title: "Select Class — Record Attendance",
      message: bodyHtml,
      hideConfirm: true,
      cancelLabel: "Cancel",
      size: "md",
    });

    // Bind picker rows after the modal is in the DOM
    requestAnimationFrame(() => {
      document.querySelectorAll("[data-pick-class]").forEach((row) => {
        const activate = () => {
          const cid = row.dataset.pickClass;
          const cls = allClasses.find((c) => String(c.id) === String(cid));
          if (!cls) return;
          Modal?.hide();
          // Small delay so the picker modal fully closes before opening the attendance modal
          setTimeout(() => this._openAttendanceForClass(cls, date), 80);
        };
        row.addEventListener("click", activate);
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
        });
      });
    });
  }

  static _openAttendanceForClass(cls, date) {
    if (window.ClassAttendanceModal) {
      ClassAttendanceModal.open(
        {
          id:          cls.id,
          classId:     cls.id,
          className:   cls.level || cls.learningLevel || cls.learning_level || cls.className || cls.class_name || `Class ${cls.id}`,
          clc:         cls.clc || cls.clcName || cls.clc_name || cls.communityLearningCenter || "",
          level:       cls.level || cls.learningLevel || cls.learning_level || "",
          schoolYear:  cls.schoolYear || cls.school_year || "",
          prefillDate: date,
        },
        () => {
          this.loadEvents().then(() => {
            this.render();
            this.openDayPanel(date);
            this.renderUpcoming();
          });
        },
      );
    } else {
      Toast?.warning("Attendance modal is not available. Please refresh the page.");
    }
  }

  // ── Module release dialog ──────────────────────────────────────────────────
  static async openModuleReleaseDialog(date) {
    const allClasses = this.classes;

    if (!allClasses.length) {
      Toast?.error("No classes found. Please set up a class first.");
      return;
    }

    const getLevel = (c) => c.level || c.learningLevel || c.learning_level || "";
    const getClc   = (c) => c.clc || c.clcName || c.clc_name || c.communityLearningCenter || "Unknown CLC";
    const getName  = (c) => getLevel(c) || c.className || c.class_name || `Class ${c.id}`;
    const getSY    = (c) => String(c.schoolYear || c.school_year || "");

    const d = new Date(date + "T00:00:00");
    const dateLabel = d.toLocaleDateString("en-PH", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    // If a specific class is already filtered, skip the class-picker step
    const preselected = this.selectedClassId
      ? allClasses.find((c) => String(c.id) === String(this.selectedClassId))
      : allClasses.length === 1 ? allClasses[0] : null;

    if (preselected) {
      await this._openModuleForm(preselected, date, dateLabel);
      return;
    }

    // ── Step 1: Class picker ─────────────────────────────────────────────────
    // Group by CLC
    const groups = {};
    allClasses.forEach((c) => {
      const clc = getClc(c);
      if (!groups[clc]) groups[clc] = [];
      groups[clc].push(c);
    });

    let classRowsHtml = "";
    Object.entries(groups).forEach(([clcName, classes]) => {
      classRowsHtml += `
        <div class="st-cal-search-group-header" style="margin-top:8px;">
          <span class="material-symbols-outlined">hub</span>
          ${this._esc(clcName)}
        </div>`;
      classes.forEach((c) => {
        const sy = getSY(c);
        classRowsHtml += `
          <div class="st-cal-modal-class-row" data-mod-pick-class="${c.id}" role="button" tabindex="0">
            <div class="st-cal-modal-class-icon">
              <span class="material-symbols-outlined">school</span>
            </div>
            <div class="st-cal-modal-class-info">
              <span class="st-cal-modal-class-name">${this._esc(getName(c))}</span>
              <span class="st-cal-modal-class-meta">${this._esc(clcName)}${sy ? ` · SY ${this._esc(sy)}` : ""}</span>
            </div>
            <span class="material-symbols-outlined" style="font-size:18px;color:var(--st-outline);">chevron_right</span>
          </div>`;
      });
    });

    const pickerHtml = `
      <div class="st-cal-modal-body">
        <div class="st-cal-modal-info">
          <span class="material-symbols-outlined">calendar_month</span>
          <span>Setting module release for <strong>${this._esc(dateLabel)}</strong>. Select the class to continue.</span>
        </div>
        <div class="st-cal-modal-class-list">${classRowsHtml}</div>
      </div>`;

    Modal?.show({
      title: "Select Class — Set Module Release",
      message: pickerHtml,
      hideConfirm: true,
      cancelLabel: "Cancel",
      size: "md",
    });

    requestAnimationFrame(() => {
      document.querySelectorAll("[data-mod-pick-class]").forEach((row) => {
        const activate = () => {
          const cid = row.dataset.modPickClass;
          const cls = allClasses.find((c) => String(c.id) === String(cid));
          if (!cls) return;
          Modal?.hide();
          setTimeout(() => this._openModuleForm(cls, date, dateLabel), 80);
        };
        row.addEventListener("click", activate);
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
        });
      });
    });
  }

  static async _openModuleForm(cls, date, dateLabel) {
    const getLevel = (c) => c.level || c.learningLevel || c.learning_level || "";
    const getClc   = (c) => c.clc || c.clcName || c.clc_name || c.communityLearningCenter || "—";
    const getSY    = (c) => String(c.schoolYear || c.school_year || "");

    // Default planned return = release + 14 days
    const retDate = new Date(date + "T00:00:00");
    retDate.setDate(retDate.getDate() + 14);
    const defaultReturn = this._fmt(retDate);

    // Fetch modules first so the form is fully ready before opening
    let modules = [];
    try {
      const res = await API.getClassModules(cls.id);
      modules = res?.data || [];
    } catch (e) {
      console.warn("[TeacherCalendar] Could not load modules", e);
    }

    const moduleOptions = modules.length
      ? modules.map((m) =>
          `<option value="${m.id}">${this._esc(m.title || m.module_name || `Module ${m.id}`)}</option>`
        ).join("")
      : `<option value="" disabled>No modules set up for this class yet</option>`;

    const formHtml = `
      <div class="st-cal-modal-body">
        <div class="st-cal-modal-info">
          <span class="material-symbols-outlined">hub</span>
          <div>
            <strong>${this._esc(getLevel(cls) || "Class")}</strong> &mdash; ${this._esc(getClc(cls))}
            ${getSY(cls) ? `<br><span style="font-size:12px;color:var(--st-outline);">SY ${this._esc(getSY(cls))}</span>` : ""}
          </div>
        </div>
        <div class="st-schedule-modal-field">
          <label for="calModModule">Module <span style="color:#ba1a1a;">*</span></label>
          <select id="calModModule">
            <option value="">— Select a module —</option>
            ${moduleOptions}
          </select>
        </div>
        <div class="st-schedule-modal-row">
          <div class="st-schedule-modal-field">
            <label for="calModRelease">Release Date <span style="color:#ba1a1a;">*</span></label>
            <input type="date" id="calModRelease" value="${date}" max="${this._fmt(this.today)}" />
          </div>
          <div class="st-schedule-modal-field">
            <label for="calModReturn">Planned Return Date</label>
            <input type="date" id="calModReturn" value="${defaultReturn}" />
          </div>
        </div>
      </div>`;

    Modal?.show({
      title: "Set Module Release Date",
      message: formHtml,
      confirmLabel: "Save Release",
      cancelLabel: "Cancel",
      size: "md",
      asyncConfirm: true,
      onConfirm: async () => {
        const moduleId    = document.getElementById("calModModule")?.value;
        const releaseDate = document.getElementById("calModRelease")?.value;
        const returnDate  = document.getElementById("calModReturn")?.value;

        if (!moduleId) {
          Toast?.error("Please select a module to release.");
          throw new Error("validation");
        }
        if (!releaseDate) {
          Toast?.error("Please enter a release date.");
          throw new Error("validation");
        }

        // Backend rejects future release dates
        if (releaseDate > this._fmt(this.today)) {
          Toast?.error("Release date cannot be later than today.");
          throw new Error("validation");
        }

        try {
          await API.releaseClassModule(cls.id, moduleId, {
            releaseDate,
            plannedReturnDate: returnDate || null,
          });
        } catch (err) {
          const msg = err?.message || err?.data?.message || "Unable to save the module release. Please try again.";
          Toast?.error(msg);
          throw err; // keep modal open
        }

        Toast?.success("Module release date saved.");
        await this.loadEvents();
        this.render();
        this.openDayPanel(releaseDate);
        this.renderUpcoming();
      },
    });
  }

  // ── Toolbar bindings ───────────────────────────────────────────────────────
  static bindToolbar() {
    document.getElementById("calPrev")?.addEventListener("click", () => {
      this._shiftCursor(-1);
    });
    document.getElementById("calNext")?.addEventListener("click", () => {
      this._shiftCursor(1);
    });
    document.getElementById("calTodayBtn")?.addEventListener("click", () => {
      this.cursor = new Date(
        this.today.getFullYear(),
        this.today.getMonth(),
        1,
      );
      this.render();
    });
  }

  static _shiftCursor(dir) {
    if (this.view === "month") {
      this.cursor = new Date(
        this.cursor.getFullYear(),
        this.cursor.getMonth() + dir,
        1,
      );
    } else {
      // Shift by 1 week
      this.cursor = new Date(
        this.cursor.getFullYear(),
        this.cursor.getMonth(),
        this.cursor.getDate() + dir * 7,
      );
    }
    this.loadEvents().then(() => {
      this.render();
      this.renderUpcoming();
    });
  }

  static bindMiniNav() {
    document.getElementById("miniPrev")?.addEventListener("click", () => {
      this.cursor = new Date(
        this.cursor.getFullYear(),
        this.cursor.getMonth() - 1,
        1,
      );
      this.loadEvents().then(() => {
        this.render();
        this.renderUpcoming();
      });
    });
    document.getElementById("miniNext")?.addEventListener("click", () => {
      this.cursor = new Date(
        this.cursor.getFullYear(),
        this.cursor.getMonth() + 1,
        1,
      );
      this.loadEvents().then(() => {
        this.render();
        this.renderUpcoming();
      });
    });
  }

  static bindViewToggle() {
    document.querySelectorAll(".st-cal-view-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.dataset.view;
        if (v === this.view) return;
        this.view = v;

        document.querySelectorAll(".st-cal-view-btn").forEach((b) =>
          b.classList.toggle("is-active", b.dataset.view === v),
        );

        this.render();
      });
    });
  }

  static bindDayPanel() {
    document.getElementById("calDayPanelClose")?.addEventListener("click", () =>
      this.closeDayPanel(),
    );
    document.getElementById("calDayPanelBackdrop")?.addEventListener("click", () =>
      this.closeDayPanel(),
    );
  }

  // ── Utilities ──────────────────────────────────────────────────────────────
  /** Format a Date as "YYYY-MM-DD" */
  static _fmt(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  /**
   * Parse any date string the API might return into "YYYY-MM-DD".
   * Handles ISO ("2026-08-15"), MM/DD/YYYY ("08/15/2026"), and
   * already-correct ISO slices.
   */
  static _parseDate(str) {
    if (!str) return null;
    const s = String(str).trim();
    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // MM/DD/YYYY
    const mmddyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mmddyyyy) {
      const [, mm, dd, yyyy] = mmddyyyy;
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
    return null;
  }

  /**
   * Parse a long locale date like "August 15, 2026" → "2026-08-15".
   * This is the format the backend uses for lastReleaseDate / releaseDate
   * on class module and roster responses.
   */
  static _parseLongDate(str) {
    if (!str) return null;
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    return this._fmt(d);
  }

  /** Minimal HTML-escape */
  static _esc(str) {
    return String(str ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
(function bootTeacherCalendar() {
  let started = false;
  const start = () => {
    if (!started) {
      started = true;
      TeacherCalendar.init();
    }
  };
  document.addEventListener("components:loaded", start);
  document.addEventListener("DOMContentLoaded", () => setTimeout(start, 300));
})();

window.TeacherCalendar = TeacherCalendar;
