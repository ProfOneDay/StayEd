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
            <div class="st-skeleton-stat-card" style="height:220px;justify-content:flex-start;">
                <div class="st-skeleton st-skeleton-title"></div>
                <div class="st-skeleton st-skeleton-text"></div>
                <div class="st-skeleton st-skeleton-text" style="width:70%;"></div>
                <div class="st-skeleton st-skeleton-card" style="height:40px;margin-top:auto;"></div>
            </div>
        `;

    return Array(count).fill(card).join("");
  },

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
  },
};

window.Skeletons = Skeletons;
