/**
 * ============================================
 * StayEd
 * Module Management Modal
 * ============================================
 *
 * Opened from the Learner Records hub (any
 * modality tab) via the "history" icon or
 * "Active Modules" link. Shows the learner's full
 * module list grouped by learning strand, with
 * inline status/return-date/remarks editing, plus
 * a Module History tab for completed modules.
 * ============================================
 */

class ModuleManagementModal {

    static learner = null;

    static activeTab = "active";

    static open(learner) {

        this.learner = learner;

        this.activeTab = "active";

        const body = Modal.showCustom({

            title: "",

            size: "xl",

            hideFooter: true

        });

        if (!body) return;

        body.parentElement.classList.add("st-module-modal");

        body.innerHTML = this.render();

        this.bind(body.parentElement);

    }

    static render() {

        const l = this.learner;

        const m = l.modules || {};

        const pct = Math.round((m.completed / m.total) * 100) || 0;

        return `
            <div class="st-module-modal-header">
                <div class="st-module-modal-title-row">
                    <div>
                        <h1 class="st-module-modal-title">Module Management</h1>
                        <div class="st-module-modal-meta">
                            <span style="font-weight:700;color:var(--st-primary);">${l.name}</span>
                            <span class="sep">•</span>
                            <span>LRN: ${l.lrn}</span>
                            <span class="sep">•</span>
                            <span class="chip">${l.modality} • ${l.level}</span>
                        </div>
                    </div>
                    <button type="button" class="st-btn st-btn-primary st-btn-xs" data-release-module>
                        <span class="material-symbols-outlined" style="font-size:16px;">add</span>
                        Release New Module
                    </button>
                </div>

                <div class="st-module-summary-card">
                    <div class="st-module-summary-row">
                        <div>
                            <p class="st-module-summary-label">Module Status</p>
                            <div class="st-module-summary-stats">
                                <span style="color:var(--st-primary);">${m.total} <span>Modules</span></span>
                                <span style="color:var(--st-secondary);">${m.completed} <span>Completed</span></span>
                                <span style="color:var(--st-primary-container);">${m.active} <span>Active</span></span>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <span class="st-module-summary-pct">${pct}%</span>
                            <p class="st-module-summary-label">Overall</p>
                        </div>
                    </div>
                    <div class="st-progress-track st-progress-track--lg">
                        <div class="st-progress-fill st-progress-fill--secondary" style="width:${pct}%;"></div>
                    </div>
                </div>
            </div>

            <nav class="st-module-modal-tabs">
                <button type="button" class="st-module-modal-tab is-active" data-module-tab="active">Active Modules</button>
                <button type="button" class="st-module-modal-tab" data-module-tab="history">Module History</button>
            </nav>

            <div class="st-module-modal-body" data-module-modal-content>
                ${this.renderActiveTab()}
            </div>

            <div class="st-module-modal-footer">
                <span style="font-size:12px;color:var(--st-on-surface-variant);">Changes save automatically</span>
                <button type="button" class="st-btn st-btn-primary" data-module-modal-done>Done</button>
            </div>
        `;

    }

    static renderActiveTab() {

        const groups = this.learner.moduleGroups || [];

        if (!groups.length) {
            return `
                <div class="st-empty" style="border:none;background:transparent;">
                    <span class="material-symbols-outlined">menu_book</span>
                    <p class="st-empty-title">No active modules</p>
                    <p class="st-empty-text">Release a new module to get started.</p>
                </div>
            `;
        }

        return groups.map((group, gi) => `
            <div class="st-module-group" data-module-group>
                <button type="button" class="st-module-group-header" data-module-group-toggle>
                    <div class="st-module-group-header-left">
                        <span class="material-symbols-outlined" style="color:var(--st-primary);">${group.icon || "forum"}</span>
                        <h2 class="st-module-group-title">${group.strand}</h2>
                        <span class="st-module-group-count">(${group.modules.length} Active)</span>
                    </div>
                    <span class="material-symbols-outlined st-module-group-caret">expand_less</span>
                </button>
                <div class="st-module-group-body">
                    ${group.modules.map((mod, mi) => this.renderModuleItem(mod, gi, mi)).join("")}
                </div>
            </div>
        `).join("");

    }

    static renderModuleItem(mod, gi, mi) {

        const overdue = mod.overdueDays > 0;

        return `
            <div class="st-module-item ${overdue ? "st-module-item--overdue" : ""}">
                <div class="st-module-item-main">
                    <div class="st-module-item-icon">
                        <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1;">description</span>
                    </div>
                    <div class="st-module-item-body">
                        <h3 class="st-module-item-title">${mod.title}</h3>
                        <div class="st-module-item-dates">
                            <div class="st-module-item-date-row">
                                <span class="st-module-item-date-label">Released</span>
                                <span>${mod.released}</span>
                            </div>
                            <div class="st-module-item-date-row">
                                <span class="st-module-item-date-label">Due</span>
                                <span>${mod.due}</span>
                            </div>
                            ${overdue ? `<span class="st-module-item-overdue-chip">${mod.overdueDays} Days Overdue</span>` : ""}
                        </div>
                        <input type="text" class="st-module-item-remarks" placeholder="Add remarks (optional)..."
                            value="${mod.remarks || ""}" data-module-remarks="${gi}-${mi}">
                    </div>
                </div>
                <div class="st-module-item-controls">
                    <div class="st-module-item-field">
                        <label>Status</label>
                        <select data-module-status="${gi}-${mi}">
                            <option value="in_progress" ${mod.status === "in_progress" ? "selected" : ""}>In Progress</option>
                            <option value="returned" ${mod.status === "returned" ? "selected" : ""}>Returned</option>
                            <option value="not_returned" ${mod.status === "not_returned" ? "selected" : ""}>Not Returned</option>
                        </select>
                    </div>
                    <div class="st-module-item-field">
                        <label>Return Date</label>
                        <input type="date" data-module-return-date="${gi}-${mi}">
                    </div>
                    <button type="button" class="st-icon-btn-sm" style="margin-top:18px;" aria-label="More options">
                        <span class="material-symbols-outlined">more_vert</span>
                    </button>
                </div>
            </div>
        `;

    }

    static renderHistoryTab() {

        const history = this.learner.moduleHistory || [];

        if (!history.length) {
            return `
                <div class="st-empty" style="border:none;background:transparent;">
                    <span class="material-symbols-outlined">history</span>
                    <p class="st-empty-title">No completed modules yet</p>
                </div>
            `;
        }

        return `
            <table class="st-module-history-table" style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr>
                        <th>Module</th>
                        <th>Strand</th>
                        <th>Completed</th>
                        <th>Score</th>
                    </tr>
                </thead>
                <tbody>
                    ${history.map(h => `
                        <tr>
                            <td style="font-weight:600;">${h.module}</td>
                            <td>${h.strand}</td>
                            <td>${h.completedDate}</td>
                            <td style="color:var(--st-secondary);font-weight:700;">${h.score}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;

    }

    static bind(container) {

        container.querySelectorAll("[data-module-tab]").forEach(tab => {

            tab.addEventListener("click", () => {

                container.querySelectorAll("[data-module-tab]").forEach(t => t.classList.remove("is-active"));

                tab.classList.add("is-active");

                this.activeTab = tab.dataset.moduleTab;

                const content = container.querySelector("[data-module-modal-content]");

                if (content) {
                    content.innerHTML = this.activeTab === "active"
                        ? this.renderActiveTab()
                        : this.renderHistoryTab();
                    this.bindGroupToggles(content);
                }

            });

        });

        this.bindGroupToggles(container);

        container.querySelector("[data-module-modal-done]")?.addEventListener("click", () => {
            Toast?.success("Module updates saved.");
            Modal.hide();
        });

        container.querySelector("[data-release-module]")?.addEventListener("click", () => {
            Toast?.info("Release New Module form will open here.");
        });

        container.querySelectorAll("[data-module-status], [data-module-return-date]").forEach(el => {
            el.addEventListener("change", () => {
                Toast?.success("Module status updated.");
            });
        });

    }

    static bindGroupToggles(container) {

        container.querySelectorAll("[data-module-group-toggle]").forEach(header => {

            header.addEventListener("click", () => {
                header.closest("[data-module-group]")?.classList.toggle("is-collapsed");
            });

        });

    }

}

window.ModuleManagementModal = ModuleManagementModal;
