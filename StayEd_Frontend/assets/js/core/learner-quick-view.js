// Learner quick-view modal -- shared across every teacher page that lists
// learners. Clicking a learner's avatar or name (any [data-learner-preview]
// trigger) opens a preview of their profile instead of leaving the page.
// One global overlay, built once lazily on first open() and reused from
// then on. See assets/css/components/learner-quick-view.css for styling.
class LearnerQuickView {
  static overlay = null;
  static dialog = null;
  static lastFocus = null;
  static cache = new Map();
  static requestToken = 0;
  static currentId = null;

  static RISK_TONE = {
    High: { cls: "high", icon: "warning" },
    Moderate: { cls: "moderate", icon: "warning" },
    Low: { cls: "low", icon: "check_circle" },
    // Not a state the real risk model emits today (see _shape_learner on
    // the backend) -- kept for parity with the student portal's own
    // risk-tone map (assets/js/student/portal.js), which already defines
    // this exact tone/icon pairing defensively for the same reason.
    Preliminary: { cls: "preliminary", icon: "hourglass_top" },
  };

  static ensureOverlay() {
    if (this.overlay) return;

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="st-qv-overlay" hidden>
        <div class="st-qv" role="dialog" aria-modal="true" aria-labelledby="stQvTitle" tabindex="-1"></div>
      </div>
    `;
    this.overlay = wrap.firstElementChild;
    document.body.appendChild(this.overlay);
    this.dialog = this.overlay.querySelector(".st-qv");

    this.overlay.addEventListener("click", (event) => {
      if (event.target === this.overlay) this.close();
    });

    document.addEventListener("keydown", (event) => {
      if (this.overlay.hidden) return;

      if (event.key === "Escape") {
        this.close();
        return;
      }

      if (event.key === "Tab") {
        const focusable = [...this.dialog.querySelectorAll("button, a[href]")].filter(
          (el) => !el.disabled && el.offsetParent !== null,
        );
        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-learner-preview]");
      if (trigger) this.open(trigger.dataset.learnerPreview, trigger);
    });
  }

  static tone(risk) {
    return this.RISK_TONE[risk] || { cls: "neutral", icon: "help" };
  }

  static initialsOf(name) {
    return String(name || "?")
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  static esc(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  }

  static open(id, triggerEl) {
    this.ensureOverlay();

    this.lastFocus = triggerEl || document.activeElement;
    this.currentId = id;
    const token = ++this.requestToken;

    this.renderSkeleton();
    this.overlay.hidden = false;
    requestAnimationFrame(() => this.overlay.classList.add("is-open"));
    document.body.style.overflow = "hidden";

    if (this.cache.has(id)) {
      this.renderProfile(this.cache.get(id));
      this.dialog.focus();
      return;
    }

    API.getLearnerProfile(id)
      .then((profile) => {
        if (token !== this.requestToken) return; // a newer open() superseded this one
        this.cache.set(id, profile);
        this.renderProfile(profile);
        this.dialog.focus();
      })
      .catch((error) => {
        if (token !== this.requestToken) return;
        console.error("[LearnerQuickView] Unable to load learner profile", error);
        this.renderError(id);
        this.dialog.focus();
      });
  }

  static close() {
    this.overlay.classList.remove("is-open");
    document.body.style.overflow = "";
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const restore = () => {
      this.overlay.hidden = true;
      this.lastFocus?.focus?.();
    };
    if (reduceMotion) restore();
    else setTimeout(restore, 200);
  }

  static bindCloseTargets() {
    this.dialog.querySelectorAll("[data-qv-close]").forEach((btn) => {
      btn.addEventListener("click", () => this.close());
    });
  }

  static renderSkeleton() {
    this.dialog.className = "st-qv is-neutral";
    this.dialog.innerHTML = `
      <header class="st-qv-head">
        <div class="st-qv-id">
          <div class="st-qv-avatar st-qv-sk" style="background-color:#eef1f5"></div>
          <div style="flex:1">
            <div class="st-qv-sk" style="height:22px;width:60%"></div>
            <div class="st-qv-sk" style="height:12px;width:35%;margin-top:8px"></div>
          </div>
        </div>
        <div class="st-qv-sk" style="height:66px;margin-top:16px;border-radius:12px"></div>
      </header>
      <div class="st-qv-body" style="padding-bottom:20px">
        <div class="st-qv-sk" style="height:58px;opacity:1;transform:none"></div>
        <div class="st-qv-sk" style="height:70px;opacity:1;transform:none"></div>
        <div class="st-qv-sk" style="height:90px;opacity:1;transform:none"></div>
      </div>
    `;
  }

  static renderError(id) {
    this.dialog.className = "st-qv is-neutral";
    this.dialog.innerHTML = `
      <header class="st-qv-head">
        <button type="button" class="st-qv-close" data-qv-close aria-label="Close preview">
          <span class="material-symbols-outlined">close</span>
        </button>
        <h2 class="st-qv-name" id="stQvTitle">Learner preview</h2>
      </header>
      <div class="st-qv-body">
        <div class="st-qv-error">
          <span class="material-symbols-outlined">error</span>
          <p>Couldn't load this learner's preview.</p>
          <div class="st-qv-error-actions">
            <button type="button" class="st-btn st-btn-outline" data-qv-retry>Try again</button>
            <a href="learner-profile.html?id=${encodeURIComponent(id)}" class="st-btn st-btn-primary">View full profile</a>
          </div>
        </div>
      </div>
    `;
    this.bindCloseTargets();
    this.dialog.querySelector("[data-qv-retry]")?.addEventListener("click", () => {
      this.cache.delete(id);
      this.open(id, this.lastFocus);
    });
  }

  static riskHelper(profile) {
    const risk = profile.risk;
    if (risk === "High") {
      const recList = (profile.interventions && profile.interventions.recommended) || [];
      const topRec = recList.slice().sort((a, b) => (a.rank || 999) - (b.rank || 999))[0];
      return topRec ? topRec.title : "Prioritize follow-up and intervention.";
    }
    if (risk === "Moderate") return "Needs regular monitoring.";
    if (risk === "Low") return "Continue regular monitoring.";
    if (risk === "Preliminary") return "Early estimate from limited records.";
    return "Risk will appear after a prediction is generated.";
  }

  static factorToneClass(tone) {
    // Same mapping learner-profile.js uses for its contributor cards
    // (tone "error" -> high, "moderate" -> moderate, everything else,
    // including "low"/"neutral" -> low) -- the prototype's factor pill
    // only has high/moderate/low variants, no neutral one.
    return tone === "error" ? "high" : tone === "moderate" ? "moderate" : "low";
  }

  static renderProfile(profile) {
    const risk = profile.risk;
    const { cls, icon } = this.tone(risk === "Not Yet Assessed" ? null : risk);
    const initials = this.initialsOf(profile.name);
    const badgeLabel = cls === "neutral" ? "Not Yet Assessed" : `${risk} Risk`;
    const helper = this.esc(this.riskHelper(profile));

    const trend = profile.riskTrend || [];
    const latest = trend.length ? trend[trend.length - 1] : null;
    const prob = latest && latest.probability != null ? latest.probability : null;

    const metrics = profile.metrics || {};
    const moduleRateText =
      metrics.moduleRate == null ? "Module rate not yet available" : metrics.moduleRateText;
    const overdue = Number(metrics.overdueModules || 0);

    const className = (profile.header && profile.header.currentClass) || profile.section || "—";

    const contributors = ((profile.riskExplanation && profile.riskExplanation.contributors) || []).slice(0, 3);
    const activeIv = ((profile.interventions && profile.interventions.activeList) || [])[0] || null;

    const id = profile.id;
    const dueLabel = { overdue: "Overdue", due: "Due Today", soon: "Due Soon" }[activeIv?.dueStatus] || "";

    this.dialog.className = `st-qv is-${cls}`;
    this.dialog.innerHTML = `
      <header class="st-qv-head">
        <button type="button" class="st-qv-close" data-qv-close aria-label="Close preview">
          <span class="material-symbols-outlined">close</span>
        </button>
        <div class="st-qv-id">
          <div class="st-qv-avatar">${this.esc(initials)}</div>
          <div>
            <h2 class="st-qv-name" id="stQvTitle">${this.esc(profile.name)}</h2>
            <p class="st-qv-lrn">LRN <b>${this.esc(profile.lrn || "—")}</b></p>
            <div class="st-qv-tags">
              <span class="st-qv-tag">${this.esc(profile.level || "—")}</span>
              <span class="st-qv-tag">${this.esc(profile.modality || "—")}</span>
            </div>
          </div>
        </div>
        <div class="st-qv-risk">
          <div class="st-qv-risk-icon"><span class="material-symbols-outlined">${icon}</span></div>
          <div class="st-qv-risk-text">
            <small>Current risk</small>
            <span class="st-qv-pill">${this.esc(badgeLabel)}</span>
            <p>${helper}</p>
          </div>
          ${
            prob != null
              ? `<div class="st-qv-prob"><b>${prob}%</b><small>dropout risk</small><div class="st-qv-meter"><i style="--w:${prob}%"></i></div></div>`
              : ""
          }
        </div>
      </header>
      <div class="st-qv-body">
        <section class="st-qv-sec" style="--i:0">
          <h3><span class="material-symbols-outlined">badge</span>Enrollment</h3>
          <div class="st-qv-facts">
            <div><small>CLC</small><b>${this.esc(profile.clc || "—")}</b></div>
            <div><small>Class</small><b>${this.esc(className)}</b></div>
            <div><small>Level</small><b>${this.esc(profile.level || "—")}</b></div>
          </div>
        </section>
        <section class="st-qv-sec" style="--i:1">
          <h3><span class="material-symbols-outlined">menu_book</span>Modules</h3>
          <div class="st-qv-stats">
            <div class="st-qv-stat st-qv-stat--hero">
              <b>${metrics.moduleRate == null ? "—" : metrics.moduleRate + "%"}</b>
              <div class="bar"><i style="--w:${metrics.moduleRate || 0}%"></i></div>
              <small>${this.esc(moduleRateText)}</small>
            </div>
            <div class="st-qv-stat"><b>${Number(metrics.modulesReleased || 0)}</b><small>Released</small></div>
            <div class="st-qv-stat"><b>${Number(metrics.activeModules || 0)}</b><small>Active</small></div>
            <div class="st-qv-stat${overdue ? " st-qv-stat--warn" : ""}"><b>${overdue}</b><small>Overdue</small></div>
          </div>
          <p class="st-qv-activity"><span class="material-symbols-outlined">history</span>Last activity: <b>${this.esc(metrics.lastActivity || "—")}</b></p>
        </section>
        <div class="st-qv-pair" style="--i:2">
          <section class="st-qv-sec">
            <h3><span class="material-symbols-outlined">insights</span>Top risk factors<a href="learner-profile.html?id=${encodeURIComponent(id)}&tab=risk">Why this risk? →</a></h3>
            ${
              contributors.length
                ? `<div class="st-qv-factors">${contributors
                    .map(
                      (c) =>
                        `<div class="st-qv-factor ${this.factorToneClass(c.tone)}"><b>${this.esc(c.title)}</b><span>${this.esc(c.level)}</span></div>`,
                    )
                    .join("")}</div>`
                : `<p class="st-qv-empty">No contributing factors to show yet.</p>`
            }
          </section>
          <section class="st-qv-sec">
            <h3><span class="material-symbols-outlined">support_agent</span>Active intervention</h3>
            ${
              activeIv
                ? `<div class="st-qv-iv">
                    <span class="material-symbols-outlined">assignment_turned_in</span>
                    <div><b>${this.esc(activeIv.title)}</b><small>Assigned ${this.esc(activeIv.assigned)} · Due ${this.esc(activeIv.followUp)}</small></div>
                    ${dueLabel ? `<span class="st-qv-pill due">${this.esc(dueLabel)}</span>` : ""}
                  </div>`
                : `<p class="st-qv-empty">No active intervention.</p>`
            }
          </section>
        </div>
      </div>
      <footer class="st-qv-foot">
        <button type="button" class="st-btn st-qv-btn-ghost" data-qv-close>Close</button>
        <div class="r">
          <a href="learner-profile.html?id=${encodeURIComponent(id)}&tab=interventions" class="st-btn st-btn-outline">
            <span class="material-symbols-outlined">person_add</span>Assign intervention
          </a>
          <a href="learner-profile.html?id=${encodeURIComponent(id)}" class="st-btn st-btn-primary">
            <span>View full profile</span><span class="material-symbols-outlined">arrow_forward</span>
          </a>
        </div>
      </footer>
    `;

    this.bindCloseTargets();
  }
}

window.LearnerQuickView = LearnerQuickView;

document.addEventListener("DOMContentLoaded", () => LearnerQuickView.ensureOverlay());
