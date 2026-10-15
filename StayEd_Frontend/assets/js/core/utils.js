class Utils {
  static downloadLearnerImportTemplate() {
    const headers = [
      "LRN",
      "Last Name",
      "First Name",
      "Middle Name (optional)",
      "Sex",
      "Date of Birth",
      "Learning Modality",
      "Re-enrollee (Yes/No)",
      "Employment Status",
      "Distance from CLC (km)",
      "Civil Status (if applicable)",
      "Contact Number",
      "Guardian Contact Number (if applicable)",
      "Monthly Income",
      "Socio-economic Status",
    ];

    const sampleRow = [
      "123456789012",
      "Dela Cruz",
      "Juan",
      "Reyes",
      "Male",
      "5/14/2008",
      "Face-to-Face",
      "No",
      "Employed",
      "5.5",
      "Single",
      "09171234567",
      "09181234567",
      "8000",
      "Formal Employment",
    ];

    const csvContent = [headers, sampleRow]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = "StayEd_Learner_Import_Template.csv";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  static downloadCsv(filename, headers, rows) {
    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","),
      )
      .join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = filename;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  static qs(selector, scope = document) {
    return scope.querySelector(selector);
  }

  static qsa(selector, scope = document) {
    return [...scope.querySelectorAll(selector)];
  }

  static create(tag, className = "") {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    return element;
  }

  static show(element) {
    if (!element) return;

    element.classList.remove("st-hidden");
  }

  static hide(element) {
    if (!element) return;

    element.classList.add("st-hidden");
  }

  static toggle(element) {
    if (!element) return;

    element.classList.toggle("st-hidden");
  }

  static enable(button) {
    if (!button) return;

    button.disabled = false;
  }

  static disable(button) {
    if (!button) return;

    button.disabled = true;
  }

  static formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  static formatDate(date) {
    return new Intl.DateTimeFormat(
      "en-PH",

      {
        year: "numeric",

        month: "long",

        day: "numeric",
      },
    ).format(new Date(date));
  }

  static formatDateTime(date) {
    return new Intl.DateTimeFormat(
      "en-PH",

      {
        dateStyle: "medium",

        timeStyle: "short",
      },
    ).format(new Date(date));
  }

  static capitalize(text = "") {
    return text

      .split(" ")

      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())

      .join(" ");
  }

  // Canonical risk-level tone map. Anything not listed here (including
  // learners with no prediction yet) falls into the generic
  // "not yet assessed" neutral tone.
  static RISK_TONE = {
    High: { key: "high", label: "High", icon: "warning" },
    Moderate: { key: "moderate", label: "Moderate", icon: "warning" },
    Low: { key: "low", label: "Low", icon: "check_circle" },
    Preliminary: { key: "preliminary", label: "Preliminary", icon: "hourglass_top" },
  };

  static risk(level) {
    const tone = this.RISK_TONE[level];

    if (tone) {
      return { key: tone.key, label: tone.label, pillClass: `st-risk-badge--${tone.key}`, icon: tone.icon };
    }

    return { key: "neutral", label: "Not Yet Assessed", pillClass: "st-risk-badge--neutral", icon: "help" };
  }

  static riskPill(level) {
    const { label, pillClass } = this.risk(level);

    return `<span class="st-risk-badge ${pillClass}"><span class="st-risk-dot"></span>${label}</span>`;
  }

  static pct(part, total) {
    return total ? Math.round((part / total) * 100) : 0;
  }

  // learning_level is kept as its raw backend code (BLP/ELEMENTARY/
  // JUNIOR_HIGH_SCHOOL/SENIOR_HIGH_SCHOOL, sql/00_core_schema.sql's
  // ck_learning_class_level check) rather than a prettified label -- it's
  // also the literal categorical value the risk model was trained on
  // (models/features.py), so keeping the tag text 1:1 with that avoids a
  // display label that doesn't correspond to anything in the data/model.
  // One shared chip builder so every page renders it identically.
  static levelChip(level) {
    return level ? `<span class="st-level-chip">${level}</span>` : "—";
  }

  static INTERVENTION_TYPES = [
    "Home Visit", "Consultation", "Referral",
    "Learner Follow-up", "Parent/Guardian Conference", "Other",
  ];

  // The "Assign Intervention" modal -- was only wired up on the Learner
  // Profile page (learner-profile.js), so the same-looking "Assign
  // intervention" button/menu item on the Quick View popup and the
  // Learner Records row menu just navigated to that page instead of
  // actually opening it. window.Modal is loaded globally (every page
  // carries data-component="layout/modal"), so there's no reason this
  // needs a page to call it from; one shared implementation every
  // trigger can call directly, instead of each page re-navigating.
  static openAssignInterventionModal(learnerId, { prefillDescription = "", onDone } = {}) {
    if (!window.Modal || !learnerId) return;

    const types = this.INTERVENTION_TYPES;

    Modal.show({
      title: "Assign Intervention",
      size: "md",
      confirmLabel: "Select Intervention",
      message: `
        <div class="st-schedule-modal-field">
          <label for="ivType">Intervention Type</label>
          <select id="ivType">${types.map((t) => `<option value="${t}">${t}</option>`).join("")}</select>
        </div>
        <div class="st-schedule-modal-field">
          <label for="ivDescription">Description</label>
          <textarea id="ivDescription" rows="3" placeholder="What will this intervention involve?">${prefillDescription}</textarea>
        </div>
        <div class="st-schedule-modal-field">
          <label for="ivTargetDate">Target Follow-up Date (required)</label>
          <input type="date" id="ivTargetDate">
        </div>
      `,
      onConfirm: async () => {
        const type = document.getElementById("ivType")?.value;
        const description = document.getElementById("ivDescription")?.value.trim();
        const targetDate = document.getElementById("ivTargetDate")?.value;

        if (!description) {
          Toast?.error("Please describe the intervention.");
          return;
        }
        if (!targetDate) {
          Toast?.error("Please set a target follow-up date.");
          return;
        }

        try {
          await API.createIntervention(learnerId, { type, description, targetDate });
          Toast?.success("Intervention assigned.");
          if (onDone) await onDone();
        } catch (error) {
          console.error("[Utils] Assign intervention failed", error);
          Toast?.error(error?.data?.message || "Unable to assign intervention.");
        }
      },
    });
  }

  // Renders a "Showing X-Y of Z entries" + numbered page button row into
  // the element at `containerId`, replacing its full contents. Was
  // duplicated verbatim in admin/user-management.js and
  // admin/clc-management.js; this is the one copy everything else (new
  // and existing) should call.
  static renderPagination(containerId, totalItems, page, pageSize, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalItems);
    const addBtn = (p) => `<button class="st-page-btn ${p === page ? "is-active" : ""}" data-page="${p}">${p}</button>`;

    let pageBtns = "";
    if (totalPages <= 7) {
      for (let p = 1; p <= totalPages; p++) pageBtns += addBtn(p);
    } else {
      pageBtns += addBtn(1);
      if (page > 3) pageBtns += '<span class="st-page-ellipsis">…</span>';
      const start = Math.max(2, page - 1), end = Math.min(totalPages - 1, page + 1);
      for (let p = start; p <= end; p++) pageBtns += addBtn(p);
      if (page < totalPages - 2) pageBtns += '<span class="st-page-ellipsis">…</span>';
      pageBtns += addBtn(totalPages);
    }

    container.innerHTML = `
      <span class="st-pagination-info">Showing ${startItem}–${endItem} of ${totalItems} entries</span>
      <div class="st-pagination-controls">
        <button class="st-page-btn" id="${containerId}-prev" ${page <= 1 ? "disabled" : ""} aria-label="Previous page"><span class="material-symbols-outlined">chevron_left</span></button>
        ${pageBtns}
        <button class="st-page-btn" id="${containerId}-next" ${page >= totalPages ? "disabled" : ""} aria-label="Next page"><span class="material-symbols-outlined">chevron_right</span></button>
      </div>`;

    container.querySelectorAll(".st-page-btn[data-page]").forEach((btn) => btn.addEventListener("click", () => onPageChange(+btn.dataset.page)));
    const prevBtn = document.getElementById(`${containerId}-prev`);
    const nextBtn = document.getElementById(`${containerId}-next`);
    if (prevBtn) prevBtn.addEventListener("click", () => { if (page > 1) onPageChange(page - 1); });
    if (nextBtn) nextBtn.addEventListener("click", () => { if (page < totalPages) onPageChange(page + 1); });
  }

  // Wires up the "click a status to filter" pattern: a hero number plus
  // its per-category siblings, each carrying [data-filter-btn] and a
  // data-filter value, kept in sync with a <select> that filters the
  // same thing. One shared implementation for every page that offers
  // this (Early Warning Alerts, Student Registry, originally Admin's
  // User/CLC Management) instead of each page re-deriving it.
  static bindFilterButtons(buttons, select, onChange) {
    const setFilter = (value) => {
      if (select) select.value = value;
      buttons.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.filter === value));
      onChange(value);
    };

    buttons.forEach((btn) => btn.addEventListener("click", () => setFilter(btn.dataset.filter)));

    return setFilter;
  }

  static initials(name = "") {
    return name

      .split(" ")

      .map((word) => word[0])

      .join("")

      .substring(0, 2)

      .toUpperCase();
  }

  // HTML-escapes & < > " ' -- safe for both text content and attribute
  // values. Some of the 6 copies this replaces only escaped & < > (fine
  // for text content, not for attributes); using this everywhere is a
  // strict improvement for the ones that render into an attribute.
  static esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Counts el's text from its previous rendered value (or `from`, if given)
  // up to `to`, respecting prefers-reduced-motion. Of the 9 copies this
  // replaces, only the admin ones (clc-management/user-management) and
  // admin/dashboard's plain countTo() actually started from the previous
  // value -- the 5 byte-identical teacher-side copies always restarted
  // from 0 on every call despite tracking a dataset.final they never read
  // back. Starting from the previous value (as asked) is the fix for those 5.
  static countTo(el, to, { from, duration = 800 } = {}) {
    if (!el) return;

    const end = Number(to);

    if (!Number.isFinite(end)) {
      el.textContent = to;
      return;
    }

    const start = from !== undefined ? Number(from) || 0 : Number(el.dataset.final ?? 0) || 0;
    el.dataset.final = end;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = Math.round(end);
      return;
    }

    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(start + (end - start) * eased);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  static randomId(prefix = "st") {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  }

  static debounce(callback, delay = 300) {
    let timer;

    return (...args) => {
      clearTimeout(timer);

      timer = setTimeout(() => {
        callback(...args);
      }, delay);
    };
  }

  static sleep(milliseconds) {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }

  static copy(text) {
    navigator.clipboard.writeText(text);
  }

  static scrollTop() {
    window.scrollTo({
      top: 0,

      behavior: "smooth",
    });
  }

  static isEmpty(value) {
    return value === null || value === undefined || value === "";
  }

  static empty(element) {
    if (!element) return;

    element.innerHTML = "";
  }

  static serialize(form) {
    const data = {};

    new FormData(form).forEach((value, key) => {
      data[key] = value;
    });

    return data;
  }
}

Object.assign(Utils, {
  storage: {
    set(key, value) {
      localStorage.setItem(
        key,

        JSON.stringify(value),
      );
    },

    get(key, fallback = null) {
      try {
        const value = localStorage.getItem(key);

        return value ? JSON.parse(value) : fallback;
      } catch {
        return fallback;
      }
    },

    remove(key) {
      localStorage.removeItem(key);
    },

    clear() {
      localStorage.clear();
    },
  },

  session: {
    set(key, value) {
      sessionStorage.setItem(
        key,

        JSON.stringify(value),
      );
    },

    get(key, fallback = null) {
      try {
        const value = sessionStorage.getItem(key);

        return value ? JSON.parse(value) : fallback;
      } catch {
        return fallback;
      }
    },

    remove(key) {
      sessionStorage.removeItem(key);
    },

    clear() {
      sessionStorage.clear();
    },
  },

  formatNumber(number = 0) {
    return new Intl.NumberFormat("en-PH").format(number);
  },

  formatCurrency(amount = 0) {
    return new Intl.NumberFormat(
      "en-PH",

      {
        style: "currency",

        currency: "PHP",
      },
    ).format(amount);
  },

  percentage(value, total) {
    if (!total) {
      return 0;
    }

    return ((value / total) * 100).toFixed(1);
  },

  email(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  phone(number) {
    return /^(09|\+639)\d{9}$/.test(number);
  },

  required(value) {
    return !this.isEmpty(value);
  },

  uuid() {
    return crypto.randomUUID();
  },

  query(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  redirect(url) {
    window.location.href = url;
  },

  download(filename, content) {
    const blob = new Blob(
      [content],

      {
        type: "text/plain",
      },
    );

    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);

    link.download = filename;

    link.click();

    URL.revokeObjectURL(link.href);
  },

  avatarColor(text = "") {
    const colors = [
      "#12355B",

      "#006A68",

      "#0D47A1",

      "#6A1B9A",

      "#EF6C00",

      "#2E7D32",

      "#AD1457",
    ];

    let hash = 0;

    for (const char of text) {
      hash += char.charCodeAt(0);
    }

    return colors[hash % colors.length];
  },
});

Utils.toast = function (message, type = "info") {
  if (window.Toast && typeof Toast[type] === "function") {
    Toast[type](message);
    return;
  }

  if (window.Toast && typeof Toast.show === "function") {
    Toast.show(message, type);
    return;
  }

  console.log(`[toast:${type}] ${message}`);
};

// Empty state for the Risk Distribution "Trend" view (teacher + admin
// dashboards) when no learner has an assessed prediction yet. Built in
// HTML/SVG rather than drawn on the Chart.js canvas so text stays crisp and
// the faint "ghost" trend lines can animate in with CSS. `wrap` is the
// .chart-canvas-wrap holding the canvas; the canvas is hidden while shown.
Utils.lastSixMonths = function () {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) =>
    new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      .toLocaleDateString("en-US", { month: "short", year: "numeric" }),
  );
};

Utils.showEmptyTrend = function (wrap) {
  if (!wrap) return;
  Utils.hideEmptyTrend(wrap);
  const canvas = wrap.querySelector("canvas");
  if (canvas) canvas.hidden = true;

  const months = Utils.lastSixMonths();
  // Three gentle placeholder curves (High / Moderate / Low order), drawn in a
  // 600x200 box. Purely decorative -- not data.
  const ghosts = [
    { cls: "low", d: "M0,120 C80,108 140,92 200,96 S330,70 400,74 S520,52 600,46" },
    { cls: "moderate", d: "M0,150 C70,146 150,132 200,136 S320,118 400,124 S520,108 600,104" },
    { cls: "high", d: "M0,172 C90,170 150,162 200,166 S320,156 400,160 S520,150 600,148" },
  ];
  const ends = { low: 46, moderate: 104, high: 148 };

  const el = document.createElement("div");
  el.className = "st-trend-empty";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", "Risk trend: no assessed learners yet in the last 6 months");
  el.innerHTML = `
    <div class="st-trend-empty-plot">
      <svg class="st-trend-empty-svg" viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden="true">
        ${[40, 80, 120, 160].map((y) => `<line class="grid" x1="0" x2="600" y1="${y}" y2="${y}" />`).join("")}
        <line class="base" x1="0" x2="600" y1="199" y2="199" />
        <g class="ghosts">${ghosts.map((g) => `<path class="ghost ghost--${g.cls}" d="${g.d}" />`).join("")}</g>
      </svg>
      ${ghosts.map((g, i) => `<span class="st-trend-empty-dot dot--${g.cls}" style="--i:${i};top:${(ends[g.cls] / 200) * 100}%"></span>`).join("")}
      <div class="st-trend-empty-card">
        <span class="st-trend-empty-icon material-symbols-outlined" aria-hidden="true">insights</span>
        <p class="st-trend-empty-title">No trend yet</p>
        <p class="st-trend-empty-text">Each prediction run adds a point here once learners have module or attendance activity.</p>
      </div>
    </div>
    <div class="st-trend-empty-months" aria-hidden="true">${months.map((m) => `<span>${m}</span>`).join("")}</div>
    <div class="st-trend-empty-legend" aria-hidden="true">
      <span><i class="dot--high"></i>High</span>
      <span><i class="dot--moderate"></i>Moderate</span>
      <span><i class="dot--low"></i>Low</span>
    </div>`;
  wrap.insertBefore(el, wrap.querySelector(".chart-canvas-note"));
};

Utils.hideEmptyTrend = function (wrap) {
  if (!wrap) return;
  wrap.querySelector(".st-trend-empty")?.remove();
  const canvas = wrap.querySelector("canvas");
  if (canvas) canvas.hidden = false;
};

window.Utils = Utils;

document.addEventListener(
  "DOMContentLoaded",

  () => {
    console.log(
      "%cStayEd Utilities Loaded",

      "color:#12355B;font-weight:bold;",
    );
  },
);
