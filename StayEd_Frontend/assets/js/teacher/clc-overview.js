class ClcOverview {
  static state = {
    all: [],
    filtered: [],
    search: "",
    municipality: "",
  };

  static async init() {
    if (window.Guards) Guards.teacher();

    this.bindControls();

    await this.load();
  }

  static async load() {
    if (window.Layout) Layout.showLoader();

    this.showSkeleton();

    try {
      const response = await API.getClcs();

      this.state.all = response.data || [];

      this.populateMunicipalityFilter();

      this.renderStats();

      this.apply();
    } catch (error) {
      console.error("[ClcOverview]", error);
      Toast?.error("Unable to load Community Learning Centers.");
    } finally {
      if (window.Layout) Layout.hideLoader();
    }
  }

  static bindControls() {
    document
      .querySelector("[data-clc-search]")
      ?.addEventListener("input", (e) => {
        this.state.search = e.target.value.toLowerCase();
        this.apply();
      });

    document
      .querySelector("[data-clc-filter-municipality]")
      ?.addEventListener("change", (e) => {
        this.state.municipality = e.target.value;
        this.apply();
      });
  }

  static renderStats() {
    const all = this.state.all;

    this.set("[data-clc-count]", all.length);

    this.set(
      "[data-clc-learners]",
      all.reduce((sum, c) => sum + (c.totalLearners || 0), 0).toLocaleString(),
    );

    this.set(
      "[data-clc-teachers]",
      all.reduce((sum, c) => sum + (c.teachers || 0), 0),
    );

    this.set(
      "[data-clc-active]",
      all.filter((c) => c.status === "Active").length,
    );
  }

  static apply() {
    let rows = [...this.state.all];

    if (this.state.search) {
      rows = rows.filter((c) =>
        (c.name || "").toLowerCase().includes(this.state.search),
      );
    }

    if (this.state.municipality) {
      rows = rows.filter((c) => c.municipality === this.state.municipality);
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
                <div class="st-empty col-12" style="grid-column:1/-1;">
                    <span class="material-symbols-outlined">search_off</span>
                    <p class="st-empty-title">No Community Learning Centers found</p>
                    <p class="st-empty-text">Try adjusting your search or filter.</p>
                </div>
            `;

      return;
    }

    grid.innerHTML = rows.map((clc) => this.card(clc)).join("");

    grid.querySelectorAll("[data-clc-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.location.href = `learner-records.html?clc=${encodeURIComponent(btn.dataset.clcView)}`;
      });
    });
  }

  static card(clc) {
    const initials = ["AR", "MC", "JD", "LP"];

    const avatarCount = Math.min(clc.teachers || 0, 3);

    const avatars = Array.from(
      { length: avatarCount },
      (_, i) => `<div>${initials[i % initials.length]}</div>`,
    ).join("");

    const extra = (clc.teachers || 0) - avatarCount;

    const extraChip = extra > 0 ? `<div>+${extra}</div>` : "";

    return `
            <div class="st-clc-card">

                <div class="st-clc-card-head">
                    <div class="st-clc-card-icon">
                        <span class="material-symbols-outlined">${clc.icon || "account_balance"}</span>
                    </div>
                    <span class="st-clc-card-status">${clc.status}</span>
                </div>

                <div class="st-clc-card-body">
                    <h3 class="st-clc-card-name">${clc.name}</h3>
                    <p class="st-clc-card-location">
                        <span class="material-symbols-outlined">location_on</span>
                        ${clc.location}
                    </p>
                </div>

                <div class="st-clc-card-stats">

                    <div class="st-clc-card-stat-row">
                        <span>Total Learners</span>
                        <span>${clc.totalLearners} Learners</span>
                    </div>

                    <div class="st-clc-card-stat-row">
                        <span>School Year</span>
                        <span>${clc.schoolYear}</span>
                    </div>

                    <div>
                        <span class="st-clc-card-teachers-label">Assigned Teachers</span>
                        <div class="st-clc-avatar-stack">
                            ${avatars}${extraChip}
                        </div>
                    </div>

                </div>

                <div class="st-clc-card-footer">
                    <button type="button" class="st-btn st-btn-primary" data-clc-view="${clc.id}">
                        View Records
                        <span class="material-symbols-outlined">arrow_forward</span>
                    </button>
                </div>

            </div>
        `;
  }

  static showSkeleton() {
    const grid = document.querySelector("[data-clc-grid]");

    if (grid && window.Skeletons) {
      grid.innerHTML = Skeletons.cards(6);
    }
  }

  static populateMunicipalityFilter() {
    const select = document.querySelector("[data-clc-filter-municipality]");

    if (!select) return;

    const current = this.state.municipality;
    const list = [...new Set(this.state.all.map((item) => item.municipality))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    select.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "All Municipalities";
    select.appendChild(allOption);

    list.forEach((municipality) => {
      const option = document.createElement("option");
      option.value = municipality;
      option.textContent = municipality;
      select.appendChild(option);
    });

    select.value = list.includes(current) ? current : "";
    this.state.municipality = select.value;
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
