/**
 * ============================================
 * StayEd
 * Skeleton Loader Helpers
 * ============================================
 *
 * Small, reusable generators for the loading
 * states most pages need: table rows and stat
 * cards. Centralised here so every controller
 * (dashboard, learner management, early warning,
 * CLC overview, notifications) uses the same
 * markup instead of hand-rolling "Loading..."
 * strings or duplicating skeleton HTML.
 * ============================================
 */

const Skeletons = {

    /**
     * A table row skeleton: avatar + two lines,
     * matching the shape of most data-table rows
     * in the app. `columns` controls how many
     * <td> cells to fill (colspan-style single
     * cell if only rendering into one column).
     */
    tableRows(count = 5, columns = 1) {

        const row = `
            <tr>
                <td colspan="${columns}">
                    <div class="st-skeleton-row">
                        <div class="st-skeleton st-skeleton-avatar"></div>
                        <div class="st-skeleton-row-lines">
                            <div class="st-skeleton st-skeleton-text"></div>
                            <div class="st-skeleton st-skeleton-text"></div>
                        </div>
                    </div>
                </td>
            </tr>
        `;

        return Array(count).fill(row).join("");

    },

    /**
     * A grid of stat-card skeletons (label + value
     * placeholder), matching .st-stat-card /
     * .st-records-stat / .st-ewa-summary-card.
     */
    statCards(count = 4) {

        const card = `
            <div class="st-skeleton-stat-card">
                <div class="st-skeleton"></div>
                <div class="st-skeleton"></div>
            </div>
        `;

        return Array(count).fill(card).join("");

    },

    /**
     * A generic content card skeleton (title +
     * body lines), for card-grid layouts like
     * CLC Overview.
     */
    cards(count = 3) {

        const card = `
            <div class="st-skeleton-stat-card" style="height:220px;justify-content:flex-start;">
                <div class="st-skeleton st-skeleton-title"></div>
                <div class="st-skeleton st-skeleton-text"></div>
                <div class="st-skeleton st-skeleton-text" style="width:70%;"></div>
                <div class="st-skeleton st-skeleton-card" style="height:40px;margin-top:auto;"></div>
            </div>
        `;

        return Array(count).fill(card).join("");

    },

    /**
     * A notification/list-item skeleton (icon +
     * two lines), for card-list layouts like
     * Notifications.
     */
    listItems(count = 4) {

        const item = `
            <div class="st-skeleton-row" style="border-top:none;background:#fff;border:1px solid rgba(195,198,207,.30);border-radius:var(--st-radius-lg);margin-bottom:8px;">
                <div class="st-skeleton" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;"></div>
                <div class="st-skeleton-row-lines">
                    <div class="st-skeleton st-skeleton-text" style="width:55%;"></div>
                    <div class="st-skeleton st-skeleton-text" style="width:85%;"></div>
                </div>
            </div>
        `;

        return Array(count).fill(item).join("");

    }

};

window.Skeletons = Skeletons;
