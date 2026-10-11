const Skeletons = {
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

  statCards(count = 4) {
    const card = `
            <div class="st-skeleton-stat-card">
                <div class="st-skeleton"></div>
                <div class="st-skeleton"></div>
            </div>
        `;

    return Array(count).fill(card).join("");
  },

  cards(count = 3) {
    const card = `
            <div class="st-skeleton-stat-card st-skeleton-stat-card--tall">
                <div class="st-skeleton st-skeleton-title"></div>
                <div class="st-skeleton st-skeleton-text"></div>
                <div class="st-skeleton st-skeleton-text st-skeleton-text--w70"></div>
                <div class="st-skeleton st-skeleton-card st-skeleton-card--sm"></div>
            </div>
        `;

    return Array(count).fill(card).join("");
  },

  listItems(count = 4) {
    const item = `
            <div class="st-skeleton-row st-skeleton-row--card">
                <div class="st-skeleton st-skeleton-avatar--md"></div>
                <div class="st-skeleton-row-lines">
                    <div class="st-skeleton st-skeleton-text st-skeleton-text--w55"></div>
                    <div class="st-skeleton st-skeleton-text st-skeleton-text--w85"></div>
                </div>
            </div>
        `;

    return Array(count).fill(item).join("");
  },
};

window.Skeletons = Skeletons;
