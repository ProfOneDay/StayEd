# Claude Code prompt (v2): StayEd Admin Dashboard, aligned with the teacher dashboard

This replaces the earlier `CLAUDE_CODE_PROMPT_admin-dashboard.md`. Before running, put `admin-dashboard-prototype.html`, the `admin-dashboard-*.png` images and `admin-dashboard-motion-demo.gif` in `StayEd/design/admin-dashboard/`. Then copy everything below the line into Claude Code, run from the `StayEd/` folder.

---

Redesign the **Admin Dashboard** so it is built from the **same components and CSS as the current teacher dashboard**. Match `design/admin-dashboard/admin-dashboard-prototype.html`. Its query strings show each state: `?m=binalonan` for a municipality, `?risk=pie`, `?risk=line`, `?gender=grouped` and `?level=pie`.

The prototype was made from the app's real stylesheet bundle (`main.css` and its imports) plus a small admin-only layer, so the class names and values in it are the ones to use.

Files:
- `StayEd_Frontend/pages/admin/dashboard.html`
- `assets/js/admin/dashboard.js`
- `assets/css/pages/admin/admin-dashboard.css` (rewrite)
- `assets/css/pages/teacher/dashboard.css` (widen scope, promote shared rules)
- `assets/js/core/layout.js` (avatar fallback only)

## Hard rules

1. **Do not remove any content.** Every stat, helper line, chart, toggle option, legend item and count, zoom control, the select and its options, the hint, the CLC list and its pager, the gender callout and its four text variants, the level-average marker, and the empty and hidden states must still be on the page. You may move, regroup, restyle, or replace an icon or font treatment, but nothing disappears, including on mobile.
2. **Frontend only.** No changes to `StayEd_Backend/`, the API calls, the Division II scoping, the `riskLevel()` thresholds (20% / 10%), the `?municipality=` deep link, or the zoom and pan math.
3. **No flow changes.** Selecting on the map, the select, "All (Pangasinan II)", the legend filter, zoom in/out/reset, drag-to-pan, keyboard selection, every chart toggle, and the CLC pager behave as now.
4. **Keep every JS hook:** `municipalitySelect`, `mapTooltip`, `zoomGroup`, `zoomInBtn`, `zoomOutBtn`, `zoomResetBtn`, `legend`, `.legend-item[data-level]`, `countLow`, `countModerate`, `countHigh`, `name`, `scopeMeta`, `empty`, `panel`, `total`, `clcs`, `high`, `moderate`, `lowSummary`, `clcListSection`, `clcList`, `clcListPrev`, `clcListNext`, every `*Bar` / `*Pct` / `*CountText` id, `riskChartToggle`, `riskBarView`, `riskChartView`, `riskChartCanvas`, `riskChartNote`, `levelChartToggle`, `levelBarView`, `levels`, `levelChartView`, `levelChartCanvas`, `levelChartNote`, `genderChartToggle`, `genderRiskCallout`, `genderBarView`, `genderChartView`, `genderChartCanvas`, `genderChartNote`, and the classes `.municipality`, `.division-ii`, `.outside-division`, `.selected`, `.dim` and `.chart-type-btn.is-active`.
5. JS edits are presentational: markup strings, classes, `--w` / `flex-grow` values, `data-tooltip` text, Chart.js styling, and motion hooks.

## Step 1: share the teacher dashboard styles (don't duplicate them)

1. In `assets/css/pages/teacher/dashboard.css`, replace every `body[data-page="Teacher Dashboard"]` selector with `body:is([data-page="Teacher Dashboard"],[data-page="Admin Dashboard"])`, so the admin page gets the exact same panel, grid, overview, strip, legend, `st-hbar`, filter-bar, term-card and motion rules. The unscoped rules (`.st-dash-grid`, `.col-*`, `.st-panel-pad`, `.st-panel-head`, `.st-panel-title`, `.st-overview`, `.st-risk-strip`, `.st-risk-legend*`, `.st-hbar*`, `[data-animate]` motion) already apply.
2. **Important: promote the toggle styles before deleting the old admin CSS.** The teacher dashboard's current toggle look (a bordered pill whose active button is filled navy) and its 280px chart height do **not** come from `dashboard.css`. They leak globally from the old `admin-dashboard.css` (its unscoped `.chart-type-toggle`, `.chart-type-btn`, `.chart-type-btn.is-active`, `.chart-type-btn:hover:not(.is-active)`, `.chart-canvas-wrap`, `.chart-canvas-wrap:not([hidden])`, `.chart-canvas-wrap canvas` and `.chart-canvas-note` rules), because `main.css` loads it after the teacher file.
   - Move exactly those rules into `dashboard.css` (as the shared definition, replacing the gray-track version there), and add `transition` plus `:active{transform:scale(.95)}`.
   - **Check the teacher dashboard looks identical before and after.**
   - The old file also leaks generic `.high`, `.moderate`, `.low`, `.fill`, `.track`, `.stat`, `.card` and `.grid` rules. After the rewrite none of those may remain unscoped.
3. If the teacher's Chart.js constants (`ST_LEGEND_BOTTOM`, `ST_TOOLTIP`, `ST_TOOLTIP_COMPOSE`, `ST_CENTER_TOTAL`, `ST_CHART_STAGGER`, `countTo`, the `[data-animate]` `IntersectionObserver`) only live in `assets/js/teacher/dashboard.js`, move them to a shared `assets/js/core/dashboard-charts.js`, load it on both pages, and make sure the teacher dashboard behaves the same.

## Step 2: rewrite `admin-dashboard.css`

Replace the whole file with the admin-only layer from the prototype's `<style>` (the block after the bundle, every rule scoped under `body[data-page="Admin Dashboard"]`).

**Delete the old desktop lock.** The `@media (min-width: 981px)` block that sets `overflow:hidden` on body, `.st-main` and `.st-content` and squeezes everything into one screen. That lock is why the current dashboard scrolls inside a side panel. The page now scrolls normally like the teacher dashboard.

## Step 3: page structure

Rebuild `pages/admin/dashboard.html` with the teacher dashboard's components, in this order (see `admin-dashboard-desktop-all.png` and `-municipality.png`):

1. **Header: `.st-welcome`.** The title "Pangasinan II Risk Overview" and the existing subtitle. On the right, a `.st-term-card` with "Division: Pangasinan II" and "Municipalities: 22" (the count from `DIVISION_II_MUNICIPALITIES.length`).
2. **Area bar: a `.st-filter-bar` shell** (same card, spacing and select styling as the teacher filters):
   - The "Selected area" label and `#municipalitySelect`, keeping both options.
   - A divider, then "Now showing" with `#name` (Libre Franklin 800, 1.25rem, with a risk dot: `is-high` / `is-moderate` / `is-low`, navy for All) and `#scopeMeta`.
   - The existing hint ("Select an area on the map or use the list.") on the right. It is hidden only below 1280px, where the card has no room; it stays in the markup.
3. **`#panel` becomes the `.st-dash-grid`** (12 columns, the teacher dashboard's gaps):
   - **`col-9`: the teacher overview card** (`.st-overview`):
     - `#total` in the big number with the label "total learners" and the existing helper "Current learners in this view".
     - The `.st-risk-strip` with **four** segments (high / mod / low / none). Set each segment's `flex-grow` to its count.
     - `.st-risk-legend` with four items. High (`#high`), Moderate (`#moderate`) and Low (`#lowSummary`) each show the count, the name, and "NN% · existing helper text" ("Needs closer follow-up", "Needs monitoring", "Currently lower concern").
     - The fourth item is **Not yet assessed** (`#unassessed` = total − high − moderate − low, clamped at 0, with the helper "No prediction yet"). It explains why the risk percentages don't add up to 100%.
     - Keep the helper texts visible on mobile.
   - **`col-3`: CLC card**, the same shape as the teacher "Interventions to update" card but teal-tinted (`#eef8f7`, border `#cfe9e6`): a `hub` icon with "Community Learning Centers", `#clcs` in large navy, the existing "CLCs represented", and a short hint.
   - **`col-8`: map card** (`.st-panel-head` title "Interactive Municipality Map" and the existing subtitle, then the map, legend head and legend).
   - **`col-4`: a stack** of two cards: **Risk Distribution** (`#riskBarView` as teacher `.st-hbar-row`s), then **Risk by Gender** (the callout in the teacher `.st-insights` box, then the male and female `.st-hbar-row`s).
   - **`col-6`: Learning Level Distribution**, built from `.st-hbar-row`s with the category colors (`#12355b`, `#4c6f95`, `#006a68`, `#9db5d3`). Keep `.avg-mark` and its title, and add a one-line key: "Line marks the division average per municipality".
   - **`col-6`: Community Learning Centers** (`#clcListSection`, municipality view only), as 2-column CLC cards with a status pill and the pager.
   - When the CLC section is hidden, the level card spans all 12 columns (`:has(#clcListSection[hidden])`).
4. **Headings and copy:** Title Case like the teacher dashboard ("Risk Distribution", "Risk by Gender"). Toggle labels Bar / Donut / Trend / Compare, so "Pie" becomes "Donut" (keep `data-chart-type="pie"`).
5. **Bars:** in `selectMunicipality()`, `selectAllMunicipalities()` and `renderGenderRisk()`, set the `.st-hbar` width through `--w` instead of `style.width`. Put the hover text on the track as `data-tooltip` (the teacher tooltip), for example "High risk: 8 learners (24%)", "Male: 4 of 19 learners are High risk (21%)", or "Basic Literacy: 34 learners · division average 1.5". The count sub-line goes in a `<small>` under each label.

## Step 4: map (keep the original behavior)

- **Hover:** a **navy outline** (`stroke: var(--st-primary-dark)`, width 2.2, slight brightness).
- **Click/selected:** a **navy fill** (`fill: var(--st-primary-dark) !important`) with the original lift: `translateY(-3px) scale(1.025)`, a 2.8 stroke and a drop shadow.
- **Tooltip:** the original **navy name pill**.
- **Colors:** the original map palette is unchanged (`#D64545`, `#F39422`, `#6BBF59`, outside `#d9dee7`), and so are the legend dots (move their inline colors into classes).
- **Container:** `aspect-ratio: 800/500`, a 12px radius, a 1px border, and the `#e8f7f6` background (moved from the SVG's inline style and `<rect>`). The zoom controls become one vertical white pill of 36px icon buttons (`add`, `remove`, `restart_alt`). Legend items are pill buttons with count badges, and the active one is navy-soft.

## Step 5: charts and motion (same as the teacher dashboard)

- **Chart.js views** use the shared teacher constants: the dark tooltip with "value (share%)", a bottom legend, a 68% doughnut with the center total ("assessed" for risk), trend lines that draw left to right, and staggered bars.
- **`[data-animate]` panels**, via the shared observer:
  - The strip reveals.
  - The numbers count up, and **count from the previous value** when the area changes.
  - The `st-hbar` fills grow with a stagger.
  - Municipalities fade in with a 25ms stagger.
  - Charts replay when scrolled back to.
- **On selecting an area:** the strip segments animate `flex-grow`, and the bars and numbers animate to the new values.
- **Reduced motion:** everything final.

## Step 6: avatar fallback (shared)

In `layout.js`, add an `error` handler on `[data-st-user-avatar]` that hides the broken image and shows `[data-st-user-initials]` with the user's initials. The admin avatar currently shows broken "Profile photo" alt text.

## Checks

1. Run `start.ps1`, log in as admin, and compare against the images at 1440, 1280 and 390px. The page must scroll normally with no inner scroll panel and no horizontal scroll.
2. Log in as a teacher and confirm **the teacher dashboard looks exactly as before**: toggles, chart heights, panels.
3. Confirm **no content is missing** compared with the old admin dashboard (list each item).
4. Test map hover (navy outline), click (navy fill and lift), the pill tooltip, the select, All, the deep link, the legend filters, zoom and pan, keyboard selection, every toggle in All and municipality views, the trend empty note, the gender callout variants, and the CLC pager and empty state.
5. Check that Not yet assessed equals total − High − Moderate − Low.
6. Turn on reduce motion and confirm nothing animates.
7. Write `CHANGES_<date>_admin-dashboard-ui.md` in `StayEd/`.
