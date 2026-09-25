const CLC_OVERVIEW_REDUCE_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;

class ClcOverview {
  static state = {
    all: [],
    filtered: [],
    search: "",
    municipality: "",
    totalLearners: 0,
  };

  static async init() {
    if (window.Guards) Guards.teacher();

    this.state.municipality = window.Auth ? Auth.municipality() : "";

    this.bindControls();

    await this.load();
  }

  static async load() {
    if (window.Layout) Layout.showLoader();

    this.showSkeleton();

    try {
      // The backend already scopes this list and its learner counts to the
      // logged-in teacher. Do not broaden it again by municipality.
      const response = await API.getTeacherClcs();

      this.state.all = response.data || [];
      this.state.totalLearners = Number(response.totalLearners || 0);

      this.renderMunicipalityLabel();

      this.renderStats();

      this.apply();
    } catch (error) {
      console.error("[ClcOverview]", error);
      Toast?.error("Unable to load Community Learning Centers.");
    } finally {
      if (window.Layout) Layout.hideLoader();
    }
  }

  static renderMunicipalityLabel() {
    this.set("[data-clc-municipality-name]", this.state.municipality || "—");
  }

  static bindControls() {
    document
      .querySelector("[data-clc-search]")
      ?.addEventListener("input", (e) => {
        this.state.search = e.target.value.toLowerCase();
        this.apply();
      });
  }

  static renderStats() {
    const all = this.state.all;

    this.countTo(document.querySelector("[data-clc-count]"), all.length);

    this.countTo(
      document.querySelector("[data-clc-learners]"),
      this.state.totalLearners,
    );
  }

  static apply() {
    let rows = [...this.state.all];

    if (this.state.search) {
      rows = rows.filter((c) =>
        (c.name || "").toLowerCase().includes(this.state.search),
      );
    }

    this.state.filtered = rows;

    this.set(
      "[data-clc-showing]",
      `Showing ${rows.length} Community Learning Center${rows.length === 1 ? "" : "s"}`,
    );

    this.render();
  }

  static render() {
    const grid = document.querySelector("[data-clc-grid]");

    if (!grid) return;

    const rows = this.state.filtered;

    if (!rows.length) {
      grid.innerHTML = `
                <div class="st-empty">
                    <span class="material-symbols-outlined">search_off</span>
                    <p class="st-empty-title">No Community Learning Centers found</p>
                    <p class="st-empty-text">Try adjusting your search or filter.</p>
                </div>
            `;
    } else {
      grid.innerHTML = rows.map((clc, i) => this.card(clc, i)).join("");

      grid.querySelectorAll("[data-clc-view]").forEach((btn) => {
        btn.addEventListener("click", () => {
          localStorage.setItem("stayed_last_teacher_clc", btn.dataset.clcName || "");
          window.location.href = `class-management.html?clc=${encodeURIComponent(btn.dataset.clcName)}`;
        });
      });
    }

    grid.classList.remove("is-inview");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => grid.classList.add("is-inview")),
    );

    grid.querySelectorAll("[data-countup]").forEach((el) => this.countTo(el));
  }

  static card(clc, i) {
    const learners = Number(clc.totalLearners) || 0;
    const isEmpty = learners === 0;
    const isActive = String(clc.status || "").toLowerCase() === "active";
    const teachers = Number(clc.teachers) || 0;
    const hasSchoolYear = clc.schoolYear && clc.schoolYear !== "—";
    const schoolYear = hasSchoolYear ? String(clc.schoolYear).replace("-", "–") : "";

    return `
            <article class="st-clc-card${isEmpty ? " is-empty" : ""}" style="--i:${i}">

                <div class="st-clc-card-top">
                    <div class="st-clc-card-titlerow">
                        <h3 class="st-clc-card-name">${clc.name}</h3>
                        <span class="st-clc-card-status${isActive ? "" : " st-clc-card-status--neutral"}">${clc.status}</span>
                    </div>
                    <p class="st-clc-card-location">
                        <span class="material-symbols-outlined">location_on</span>
                        ${clc.location}
                    </p>
                </div>

                <div class="st-clc-card-figure">
                    <div class="st-clc-card-count">
                        <b class="num" data-countup>${learners}</b>
                        <span>${learners === 1 ? "learner" : "learners"}</span>
                    </div>
                    <div class="st-clc-card-meta">
                        <small>School year</small>
                        ${schoolYear ? `<strong class="num">${schoolYear}</strong>` : `<strong class="is-missing">Not set</strong>`}
                    </div>
                </div>

                ${teachers > 0 ? `<p class="st-clc-card-teachers"><span class="material-symbols-outlined">person</span>${teachers} assigned teacher${teachers === 1 ? "" : "s"}</p>` : ""}

                <div class="st-clc-card-footer">
                    <button type="button" class="st-clc-card-go" data-clc-view="${clc.id}" data-clc-name="${clc.name}">
                        View classes
                        <span class="material-symbols-outlined">arrow_forward</span>
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
    if (CLC_OVERVIEW_REDUCE_MOTION || !Number.isFinite(end)) {
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

  static showSkeleton() {
    const grid = document.querySelector("[data-clc-grid]");

    if (grid && window.Skeletons) {
      grid.innerHTML = Skeletons.cards(6);
    }
  }

  static set(selector, value) {
    const el = document.querySelector(selector);
    if (el && value !== undefined && value !== null) {
      el.textContent = value;
    }
  }
}

(function bootClcOverview() {
  let started = false;
  const start = () => {
    if (!started) {
      started = true;
      ClcOverview.init();
    }
  };
  document.addEventListener("components:loaded", start);
  document.addEventListener("DOMContentLoaded", () => setTimeout(start, 400));
})();

window.ClcOverview = ClcOverview;
