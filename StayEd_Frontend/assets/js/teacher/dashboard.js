/**
 * ============================================
 * StayEd
 * Teacher Dashboard Controller
 * ============================================
 *
 * Loads dashboard data through the API domain
 * layer (mock now, Flask later) and renders:
 *   - welcome greeting + term context
 *   - risk statistic cards
 *   - risk distribution chart + insights
 *   - quick action tip
 *   - student registry table (search + paginate)
 * ============================================
 */

class TeacherDashboard {

    static state = {
        learners: [],
        filtered: [],
        page: 1,
        perPage: 5,
        search: "",
        sortByRisk: true
    };

    static async init() {

        if (window.Guards) Guards.teacher();

        this.bindStaticUI();

        if (window.Layout) Layout.showLoader();

        this.showSkeleton();

        try {

            const data = await API.getDashboard();

            this.renderWelcome(data.context);

            this.renderStatistics(data.statistics);

            this.renderRiskChart(
                data.riskDistribution,
                data.predictionSummary
            );

            this.renderInterventionTip(data.interventions);

            this.state.learners = data.learners || [];

            this.applyRegistry();

        }

        catch (error) {

            console.error("[Dashboard]", error);

            if (window.Toast) {
                Toast.error(
                    error.message || "Unable to load dashboard."
                );
            }

        }

        finally {

            if (window.Layout) Layout.hideLoader();

        }

    }

    /* ---------------------------------------
       Static UI (banner, filters, search)
    --------------------------------------- */

    static bindStaticUI() {

        /* Dismissible notification banner */
        const dismiss =
            document.querySelector("[data-notif-dismiss]");

        dismiss?.addEventListener("click", () => {
            document
                .querySelector("[data-notif-banner]")
                ?.remove();
        });

        /* Learning-level segmented control */
        const seg =
            document.querySelector("[data-filter-level]");

        seg?.addEventListener("click", event => {

            const btn = event.target.closest("button");

            if (!btn) return;

            seg.querySelectorAll("button")
                .forEach(b => b.classList.remove("is-active"));

            btn.classList.add("is-active");

        });

        /* Apply filters */
        document
            .querySelector("[data-filter-apply]")
            ?.addEventListener("click", () => {
                if (window.Toast) {
                    Toast.success("Filters applied.");
                }
                this.applyRegistry();
            });

        /* Registry search */
        document
            .querySelector("[data-registry-search]")
            ?.addEventListener("input", event => {
                this.state.search =
                    event.target.value.toLowerCase();
                this.state.page = 1;
                this.applyRegistry();
            });

        /* Registry sort */
        document
            .querySelector("[data-registry-sort]")
            ?.addEventListener("click", () => {
                this.state.sortByRisk = !this.state.sortByRisk;
                this.applyRegistry();
            });

    }

    /* ---------------------------------------
       Welcome + term context
    --------------------------------------- */

    static renderWelcome(context = {}) {

        const greeting = this.timeGreeting();

        this.setText(
            "[data-dash-greeting]",
            `${greeting}, ${context.greeting_name || "Teacher"}!`
        );

        this.setText(
            "[data-dash-school-year]",
            context.school_year
        );

        this.setText(
            "[data-dash-trimester]",
            context.trimester
        );

        this.setText(
            "[data-dash-updated]",
            context.last_updated
        );

    }

    /* ---------------------------------------
       Statistic cards
    --------------------------------------- */

    static renderStatistics(stats = {}) {

        this.setText("[data-stat-total]", stats.registered);

        this.setText(
            "[data-stat-total-meta]",
            MockDB?.dashboard?.context?.selected_class ||
            "Current class"
        );

        this.setText("[data-stat-high]", stats.high);

        this.setText(
            "[data-stat-high-meta]",
            stats.high_delta
                ? `\u2191 ${stats.high_delta} since last prediction`
                : "Stable"
        );

        this.setText("[data-stat-moderate]", stats.moderate);
        this.setText(
            "[data-stat-moderate-meta]",
            stats.moderate_trend || "Stable"
        );

        this.setText("[data-stat-low]", stats.low);
        this.setText(
            "[data-stat-low-meta]",
            stats.low_trend || "Stable"
        );

    }

    /* ---------------------------------------
       Risk distribution chart
    --------------------------------------- */

    static renderRiskChart(dist = {}, summary = {}) {

        const max = dist.scale_max || 25;

        const setBar = (level, value) => {

            const bar =
                document.querySelector(`[data-bar="${level}"]`);

            if (!bar) return;

            const pct =
                Math.min(100, Math.round((value / max) * 100));

            // Animate from 0 on next frame
            requestAnimationFrame(() => {
                bar.style.height = `${pct}%`;
            });

            bar.setAttribute(
                "title",
                `${this.capitalize(level)} Risk: ${value}`
            );

        };

        setBar("high", dist.high || 0);
        setBar("moderate", dist.moderate || 0);
        setBar("low", dist.low || 0);

        /* Prediction meta */
        this.setText("[data-risk-date]", summary.date);
        this.setText("[data-risk-coverage]", summary.coverage);
        this.setText("[data-risk-model]", summary.model);
        this.setText("[data-risk-confidence]", summary.confidence);

        /* Insights */
        const list =
            document.querySelector("[data-risk-insights]");

        if (list && Array.isArray(summary.insights)) {

            list.innerHTML = summary.insights.map(item => `
                <li>
                    <span class="st-bullet ${
                        item.tone === "error"
                            ? "st-bullet--error"
                            : ""
                    }">&bull;</span>
                    ${item.text}
                </li>
            `).join("");

        }

    }

    /* ---------------------------------------
       Intervention tip
    --------------------------------------- */

    static renderInterventionTip(interventions = []) {

        const pending =
            interventions.filter(
                i => i.status !== "Resolved"
            ).length;

        const el =
            document.querySelector(
                "[data-quick-intervention-count]"
            );

        if (el) {
            el.textContent =
                `${pending} learner${pending === 1 ? "" : "s"}`;
        }

    }

    /* ---------------------------------------
       Registry table
    --------------------------------------- */

    static applyRegistry() {

        let rows = [...this.state.learners];

        /* Search */
        if (this.state.search) {
            rows = rows.filter(l =>
                (l.name || "").toLowerCase()
                    .includes(this.state.search) ||
                (l.lrn || "").toLowerCase()
                    .includes(this.state.search)
            );
        }

        /* Sort by risk severity */
        if (this.state.sortByRisk) {
            const order = { High: 0, Moderate: 1, Low: 2 };
            rows.sort((a, b) =>
                (order[a.risk] ?? 3) - (order[b.risk] ?? 3)
            );
        }

        this.state.filtered = rows;

        this.renderRegistryPage();

    }

    static renderRegistryPage() {

        const body =
            document.querySelector("[data-registry-body]");

        if (!body) return;

        const { filtered, page, perPage } = this.state;

        const start = (page - 1) * perPage;

        const pageRows = filtered.slice(start, start + perPage);

        if (!pageRows.length) {

            body.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center;padding:32px;color:var(--st-outline);font-style:italic;">
                        No learners match your search.
                    </td>
                </tr>
            `;

        } else {

            body.innerHTML =
                pageRows.map((l, i) =>
                    this.registryRow(l, start + i)
                ).join("");

            body.querySelectorAll("[data-view-learner]").forEach(el => {
                el.addEventListener("click", () => {
                    window.location.href =
                        `learner-profile.html?id=${encodeURIComponent(el.dataset.viewLearner)}`;
                });
            });

        }

        this.renderPagination();

    }

    static registryRow(l, index) {

        const initialsTheme =
            ["", "--teal", "--blue"][index % 3];

        const initials =
            (l.name || "?")
                .split(" ")
                .map(w => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();

        return `
            <tr tabindex="0">
                <td>
                    <button type="button" class="st-avatar-initials st-avatar-initials${initialsTheme} st-avatar-btn"
                        data-view-learner="${l.id}" aria-label="View ${l.name}'s profile">${initials}</button>
                </td>
                <td>
                    <button type="button" class="st-learner-name st-learner-name-link" data-view-learner="${l.id}">${l.name}</button>
                    <p class="st-learner-id">ID: ${l.lrn}</p>
                </td>
                <td>${l.level}</td>
                <td>${this.modalityPill(l.modality)}</td>
                <td>${this.riskBadge(l.risk)}</td>
                <td style="font-size:12px;">${l.latest_activity || "\u2014"}</td>
                <td>
                    <div class="st-row-actions">
                        <button class="st-btn st-btn-primary st-btn-xs"
                            data-view-learner="${l.id}">View Profile</button>
                        <button class="st-icon-btn-sm" aria-label="More options">
                            <span class="material-symbols-outlined">more_vert</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;

    }

    static renderPagination() {

        const { filtered, page, perPage } = this.state;

        const total = filtered.length;

        const pages = Math.max(1, Math.ceil(total / perPage));

        const start = total ? (page - 1) * perPage + 1 : 0;

        const end = Math.min(page * perPage, total);

        this.setText(
            "[data-registry-info]",
            `Showing ${start}\u2013${end} of ${total} learners`
        );

        const container =
            document.querySelector("[data-registry-pages]");

        if (!container) return;

        let html = `
            <button class="st-page-btn" ${page === 1 ? "disabled" : ""} data-page-prev>
                <span class="material-symbols-outlined" style="font-size:16px;">chevron_left</span>
            </button>
        `;

        for (let p = 1; p <= pages; p++) {
            html += `
                <button class="st-page-btn ${p === page ? "is-active" : ""}"
                    data-page-go="${p}">${p}</button>
            `;
        }

        html += `
            <button class="st-page-btn" ${page === pages ? "disabled" : ""} data-page-next>
                <span class="material-symbols-outlined" style="font-size:16px;">chevron_right</span>
            </button>
        `;

        container.innerHTML = html;

        container
            .querySelector("[data-page-prev]")
            ?.addEventListener("click", () => {
                if (this.state.page > 1) {
                    this.state.page--;
                    this.renderRegistryPage();
                }
            });

        container
            .querySelector("[data-page-next]")
            ?.addEventListener("click", () => {
                if (this.state.page < pages) {
                    this.state.page++;
                    this.renderRegistryPage();
                }
            });

        container
            .querySelectorAll("[data-page-go]")
            .forEach(btn => {
                btn.addEventListener("click", () => {
                    this.state.page =
                        Number(btn.dataset.pageGo);
                    this.renderRegistryPage();
                });
            });

    }

    /* ---------------------------------------
       Render helpers
    --------------------------------------- */

    static riskBadge(risk) {

        const map = {
            High: "high",
            Moderate: "moderate",
            Low: "low"
        };

        const cls = map[risk] || "low";

        return `
            <span class="st-risk-badge st-risk-badge--${cls}">
                <span class="st-risk-dot"></span>${risk}
            </span>
        `;

    }

    static modalityPill(modality) {

        const teal =
            modality === "Modular" ? " st-pill--teal" : "";

        return `<span class="st-pill${teal}">${modality || "\u2014"}</span>`;

    }

    static setText(selector, value) {
        const el = document.querySelector(selector);
        if (el && value !== undefined && value !== null) {
            el.textContent = value;
        }
    }

    static timeGreeting() {
        const h = new Date().getHours();
        if (h < 12) return "Good Morning";
        if (h < 18) return "Good Afternoon";
        return "Good Evening";
    }

    static capitalize(s) {
        return s ? s[0].toUpperCase() + s.slice(1) : s;
    }

    static showSkeleton() {

        const body = document.querySelector("[data-registry-body]");

        if (body && window.Skeletons) {

            body.innerHTML = Skeletons.tableRows(5, 7);

        }

    }

}

/*
 * Components load asynchronously via ComponentLoader.
 * Prefer the components:loaded event; fall back to a
 * timed init if the event has already fired.
 */

(function bootDashboard() {

    let started = false;

    const start = () => {
        if (started) return;
        started = true;
        TeacherDashboard.init();
    };

    document.addEventListener("components:loaded", start);

    // Safety net in case the event fired before this listener.
    document.addEventListener("DOMContentLoaded", () => {
        setTimeout(start, 600);
    });

})();

window.TeacherDashboard = TeacherDashboard;
