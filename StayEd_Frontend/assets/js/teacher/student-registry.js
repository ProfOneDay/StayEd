
class StudentRegistry {

    static state = {
        all: [],
        filtered: [],
        selected: new Set(),
        page: 1,
        perPage: 8,
        search: "",
        level: "",
        risk: "",
        status: "",
        sortKey: null,
        sortDir: 1
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

            const response = await API.getLearners();

            this.state.all = response.data || [];

            this.renderStats();

            this.apply();

        }

        catch (error) {

            console.error("[StudentRegistry]", error);

            Toast?.error("Unable to load learners.");

        }

        finally {

            if (window.Layout) Layout.hideLoader();

        }

    }

    static showSkeleton() {

        const body = document.querySelector("[data-mgmt-body]");

        if (body && window.Skeletons) {

            body.innerHTML = Skeletons.tableRows(6, 9);

        }

    }

static bindControls() {

        const on = (selector, event, handler) => {
            document.querySelector(selector)?.addEventListener(event, handler);
        };

        on("[data-mgmt-export-all]", "click", () => {
            Toast?.info(`Exporting all ${this.state.filtered.length} filtered learner record(s)…`);
        });

        on("[data-mgmt-search]", "input", e => {
            this.state.search = e.target.value.toLowerCase();
            this.state.page = 1;
            this.apply();
        });

        on("[data-mgmt-filter-level]", "change", e => {
            this.state.level = e.target.value;
            this.state.page = 1;
            this.apply();
        });

        on("[data-mgmt-filter-risk]", "change", e => {
            this.state.risk = e.target.value;
            this.state.page = 1;
            this.apply();
        });

        on("[data-mgmt-filter-status]", "change", e => {
            this.state.status = e.target.value;
            this.state.page = 1;
            this.apply();
        });

        document.querySelectorAll("[data-sort]").forEach(th => {
            th.addEventListener("click", () => {
                const key = th.dataset.sort;
                if (this.state.sortKey === key) {
                    this.state.sortDir *= -1;
                } else {
                    this.state.sortKey = key;
                    this.state.sortDir = 1;
                }
                this.apply();
            });
        });

        on("[data-mgmt-select-all]", "change", e => {
            const checked = e.target.checked;
            const idsOnPage = this.currentPageRows().map(l => l.id);
            idsOnPage.forEach(id => {
                if (checked) this.state.selected.add(id);
                else this.state.selected.delete(id);
            });
            this.renderPage();
        });

        on("[data-mgmt-bulk-archive]", "click", () => this.bulkArchive());
        on("[data-mgmt-bulk-delete]", "click", () => this.bulkDelete());
        on("[data-mgmt-bulk-export]", "click", () => {
            Toast?.info(`Exporting ${this.state.selected.size} learner record(s)…`);
        });

    }

    static renderStats() {

        const all = this.state.all;

        const count = level => all.filter(l => l.risk === level).length;

        this.set("[data-mgmt-total]", all.length);
        this.set("[data-mgmt-high]", count("High"));
        this.set("[data-mgmt-moderate]", count("Moderate"));
        this.set("[data-mgmt-low]", count("Low"));

    }

    static apply() {

        let rows = [...this.state.all];

        const { search, level, risk, status } = this.state;

        if (search) {
            rows = rows.filter(l =>
                (l.name || "").toLowerCase().includes(search) ||
                (l.lrn || "").toLowerCase().includes(search)
            );
        }

        if (level) rows = rows.filter(l => l.level === level);
        if (risk) rows = rows.filter(l => l.risk === risk);
        if (status) rows = rows.filter(l => l.status === status);

        if (this.state.sortKey) {

            const key = this.state.sortKey;

            const riskOrder = { High: 0, Moderate: 1, Low: 2 };

            rows.sort((a, b) => {

                let va = a[key];
                let vb = b[key];

                if (key === "risk") {
                    va = riskOrder[va] ?? 3;
                    vb = riskOrder[vb] ?? 3;
                }

                if (va < vb) return -1 * this.state.sortDir;
                if (va > vb) return 1 * this.state.sortDir;
                return 0;

            });

        }

        this.state.filtered = rows;

        this.updateSortIndicators();

        this.renderPage();

    }

    static updateSortIndicators() {

        document.querySelectorAll("[data-sort]").forEach(th => {

            const icon = th.querySelector(".st-sort-icon");
            const isActive = th.dataset.sort === this.state.sortKey;

            th.classList.toggle("is-sorted", isActive);

            if (icon) {
                icon.textContent = isActive
                    ? (this.state.sortDir === 1 ? "arrow_upward" : "arrow_downward")
                    : "unfold_more";
            }

        });

    }

    static currentPageRows() {

        const { filtered, page, perPage } = this.state;

        const start = (page - 1) * perPage;

        return filtered.slice(start, start + perPage);

    }

    static renderPage() {

        const body = document.querySelector("[data-mgmt-body]");

        if (!body) return;

        const pageRows = this.currentPageRows();

        if (!pageRows.length) {

            body.innerHTML = `
                <tr>
                    <td colspan="9">
                        <div class="st-empty" style="border:none;background:transparent;">
                            <span class="material-symbols-outlined">search_off</span>
                            <p class="st-empty-title">No learners found</p>
                            <p class="st-empty-text">Try adjusting your search or filters.</p>
                        </div>
                    </td>
                </tr>
            `;

        } else {

            body.innerHTML = pageRows.map(l => this.row(l)).join("");

            body.querySelectorAll("[data-row-select]").forEach(cb => {
                cb.addEventListener("change", e => {
                    const id = cb.dataset.rowSelect;
                    if (e.target.checked) this.state.selected.add(id);
                    else this.state.selected.delete(id);
                    this.updateBulkBar();
                    cb.closest("tr")?.classList.toggle("is-selected", e.target.checked);
                });
            });

            body.querySelectorAll("[data-view-learner]").forEach(btn => {
                btn.addEventListener("click", () => this.view(btn.dataset.viewLearner));
            });

            body.querySelectorAll("[data-archive-learner]").forEach(btn => {
                btn.addEventListener("click", () => this.archiveOne(btn.dataset.archiveLearner));
            });

        }

        this.syncSelectAllState();

        this.updateBulkBar();

        this.renderPagination();

    }

    static row(l) {

        const initialsTheme = ["", "--teal", "--blue"][(l.id || 0) % 3];

        const initials = (l.name || "?")
            .split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

        const confidence = Math.round((1 - (l.risk_probability || 0.3)) * 100 + (l.risk === "Low" ? 20 : 0));

        const isArchived = l.status === "Archived";

        return `
            <tr class="${this.state.selected.has(l.id) ? "is-selected" : ""}">
                <td class="checkbox-col">
                    <input type="checkbox" data-row-select="${l.id}"
                        ${this.state.selected.has(l.id) ? "checked" : ""}
                        aria-label="Select ${l.name}">
                </td>
                <td style="font-weight:600;color:var(--st-primary);">${l.lrn}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:12px;">
                        <button type="button" class="st-avatar-initials st-avatar-initials${initialsTheme} st-avatar-btn"
                            data-view-learner="${l.id}" aria-label="View ${l.name}'s profile">${initials}</button>
                        <div>
                            <button type="button" class="st-learner-name st-learner-name-link" data-view-learner="${l.id}">${l.name}</button>
                            <p class="st-learner-id">${l.sex || ""}${l.age ? ", " + l.age + " yrs" : ""}</p>
                        </div>
                    </div>
                </td>
                <td>${this.levelPill(l.level)}</td>
                <td>${this.modalityPill(l.modality)}</td>
                <td>${this.riskBadge(l.risk)}</td>
                <td class="is-center">
                    <p class="st-confidence-value">${Math.min(99, Math.max(1, confidence))}%</p>
                    <p class="st-confidence-label">${l.risk === "Low" ? "High" : l.risk === "High" ? "Low" : "Medium"}</p>
                </td>
                <td>${this.statusPill(l.status)}</td>
                <td>
                    <div class="st-row-actions">
                        <button class="st-btn st-btn-primary st-btn-xs" data-view-learner="${l.id}">View Profile</button>
                        <button class="st-icon-btn-sm" data-archive-learner="${l.id}"
                            aria-label="${isArchived ? "Restore" : "Archive"} learner"
                            title="${isArchived ? "Restore" : "Archive"}">
                            <span class="material-symbols-outlined">${isArchived ? "unarchive" : "archive"}</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;

    }

    static syncSelectAllState() {

        const selectAll = document.querySelector("[data-mgmt-select-all]");

        if (!selectAll) return;

        const idsOnPage = this.currentPageRows().map(l => l.id);

        const allSelected =
            idsOnPage.length > 0 &&
            idsOnPage.every(id => this.state.selected.has(id));

        selectAll.checked = allSelected;

    }

    static updateBulkBar() {

        const bar = document.querySelector("[data-mgmt-bulk-bar]");
        const count = document.querySelector("[data-mgmt-bulk-count]");

        if (!bar) return;

        const n = this.state.selected.size;

        bar.classList.toggle("st-hidden", n === 0);

        if (count) {
            count.textContent = `${n} learner${n === 1 ? "" : "s"} selected`;
        }

    }

    static renderPagination() {

        const { filtered, page, perPage } = this.state;

        const total = filtered.length;
        const pages = Math.max(1, Math.ceil(total / perPage));
        const start = total ? (page - 1) * perPage + 1 : 0;
        const end = Math.min(page * perPage, total);

        this.set("[data-mgmt-info]", `Showing ${start}\u2013${end} of ${total} learners`);

        const container = document.querySelector("[data-mgmt-pages]");

        if (!container) return;

        let html = `
            <button class="st-page-btn" ${page === 1 ? "disabled" : ""} data-prev>
                <span class="material-symbols-outlined" style="font-size:16px;">chevron_left</span>
            </button>
        `;

        for (let p = 1; p <= pages; p++) {
            html += `<button class="st-page-btn ${p === page ? "is-active" : ""}" data-go="${p}">${p}</button>`;
        }

        html += `
            <button class="st-page-btn" ${page === pages ? "disabled" : ""} data-next>
                <span class="material-symbols-outlined" style="font-size:16px;">chevron_right</span>
            </button>
        `;

        container.innerHTML = html;

        container.querySelector("[data-prev]")?.addEventListener("click", () => {
            if (this.state.page > 1) { this.state.page--; this.renderPage(); }
        });

        container.querySelector("[data-next]")?.addEventListener("click", () => {
            if (this.state.page < pages) { this.state.page++; this.renderPage(); }
        });

        container.querySelectorAll("[data-go]").forEach(btn => {
            btn.addEventListener("click", () => {
                this.state.page = Number(btn.dataset.go);
                this.renderPage();
            });
        });

    }

    static view(id) {

        const l = this.state.all.find(x => String(x.id) === String(id));

        if (!l) return;

        window.location.href = `learner-profile.html?id=${encodeURIComponent(l.id)}`;

    }

    static async archiveOne(id) {

        const l = this.state.all.find(x => String(x.id) === String(id));

        if (!l) return;

        const archiving = l.status !== "Archived";

        try {

            await API.updateLearner(id, {
                status: archiving ? "Archived" : "Active"
            });

            l.status = archiving ? "Archived" : "Active";

            this.apply();

            Toast?.success(
                archiving ? "Learner archived." : "Learner restored."
            );

        } catch (error) {

            console.error(error);
            Toast?.error("Unable to update learner status.");

        }

    }

    static bulkArchive() {

        const ids = [...this.state.selected];

        if (!ids.length || !window.Modal) return;

        Modal.show({
            title: "Archive Learners",
            message: `Archive <strong>${ids.length}</strong> selected learner(s)? They can be restored later.`,
            onConfirm: async () => {

                for (const id of ids) {
                    const l = this.state.all.find(x => String(x.id) === String(id));
                    if (l) l.status = "Archived";
                }

                this.state.selected.clear();

                this.apply();

                Toast?.success(`${ids.length} learner(s) archived.`);

            }
        });

    }

    static bulkDelete() {

        const ids = [...this.state.selected];

        if (!ids.length || !window.Modal) return;

        Modal.show({
            title: "Delete Learners",
            message: `Are you sure you want to permanently remove <strong>${ids.length}</strong> selected learner(s)? This action cannot be undone.`,
            onConfirm: async () => {

                for (const id of ids) {
                    try { await API.deleteLearner(id); } catch {  }
                }

                this.state.all = this.state.all.filter(l => !this.state.selected.has(l.id));

                this.state.selected.clear();

                this.renderStats();

                this.apply();

                Toast?.success(`${ids.length} learner(s) deleted.`);

            }
        });

    }

    static riskBadge(risk) {
        const cls = { High: "high", Moderate: "moderate", Low: "low" }[risk] || "low";
        return `<span class="st-risk-badge st-risk-badge--${cls}"><span class="st-risk-dot"></span>${risk}</span>`;
    }

    static levelPill(level) {
        return `<span class="st-pill st-pill--teal">${level || "\u2014"}</span>`;
    }

    static modalityPill(m) {
        const teal = m === "Modular" ? " st-pill--teal" : "";
        return `<span class="st-pill${teal}">${m || "\u2014"}</span>`;
    }

    static statusPill(status) {
        return `<span class="st-pill">${status || "\u2014"}</span>`;
    }

    static set(selector, value) {
        const el = document.querySelector(selector);
        if (el && value !== undefined && value !== null) {
            el.textContent = value;
        }
    }

}

(function bootManagement() {
    let started = false;
    const start = () => { if (!started) { started = true; StudentRegistry.init(); } };
    document.addEventListener("components:loaded", start);
    document.addEventListener("DOMContentLoaded", () => setTimeout(start, 600));
})();

window.StudentRegistry = StudentRegistry;
