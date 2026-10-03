# Admin Reports UI — 2026-10-03

Part 2 of 2: revised the admin Reports page (`pages/admin/reports.html`,
`assets/js/admin/reports.js`, `assets/css/pages/admin/admin-reports.css`) to
match the `admin-reports-prototype.html` reference. Part 1's sidebar,
`st-admin` body class, and admin modal layer were not touched here.

## Markup

- `pages/admin/reports.html` — both panels now use the `.st-panel.st-table-card`
  shell (`.st-table-card-head`/`.st-table-card-title` instead of the old
  `.st-panel-head`/`.st-panel-title`).
  - **Master Enrollment Listing**: head now carries a `.st-adm-card-sub`
    subtitle and an icon-labelled Learners/Teachers toggle (`school`/`badge`
    icons). The filter row became `.st-adm-report-filters`, a 6-column grid
    (3 under 1280px, 2 on mobile) of labelled `.st-adm-filter-field` blocks;
    the Account status field (Teachers mode only) is a sixth field hidden by
    default via the `hidden` attribute, toggled in JS instead of an inline
    `style="display:none"`. The count line and the CSV chip + "Preview &
    export" button now sit together in a gray `.st-adm-report-actionbar`.
  - **Reports from Teachers**: head carries the amber "N new" badge
    (`.st-adm-count-badge`) and "Notify teachers" button; its filter row
    reuses the existing `.st-adm-toolbar` (search + 2 selects, same class
    already used by User/CLC Management).
  - Both tables keep their exact columns/hooks and now scroll inside a
    520px-max-height `.st-report-table-wrap` with a sticky header.
  - DOM order is unchanged (Reports-from-Teachers panel first, Master
    Enrollment Listing second) — the existing CSS `order` rule (now scoped
    under `body.st-admin[data-page="Reports"]`) still displays Master
    Enrollment Listing first.
  - Removed every inline `style="..."` attribute from this page (grid-column
    overrides, `min-width`, `display:none`), replaced by classes.

## JS (`assets/js/admin/reports.js`)

- `onReportModeChange()` now toggles `hidden` on each filter's
  `.st-adm-filter-field` wrapper (via `.closest()`) instead of setting
  `el.style.display` directly on the `<select>` — same `data-mode-only`
  hooks, now hides the label along with the control.
- Row templates (`renderSubmittedReports`, `renderTeacherPreview`,
  `renderLearnerPreview`) no longer contain inline styles: the submitted
  report's subtitle line now uses `.st-report-sub`, each row carries
  `style="--i:N"` for the stagger-delay custom property (the one inline
  attribute every animated list in the app uses for this), and "Mark
  Reviewed" is now `.st-text-link-btn` (teal) instead of the plain gray
  `.st-btn-text`.
- Added `reportStatusPillClass()` and wrapped status values (enrollment
  status, teacher account status, submission status) in
  `.st-pill.st-pill--status` + a color modifier; learner/teacher names in
  `.st-adm-learner`; the Learning Level column in `.st-adm-level-chip`.
- Added `setCount()` — renders `data-report-preview-count` as an icon +
  bold number instead of plain text (`data-submitted-reports-count` stays
  plain text, matching the prototype).
- Added `replay()` (same pattern as `clc-management.js`/`user-management.js`):
  called once after initial load on both `[data-animate]` panels, and after
  every table render on each `[data-animate-rows]` tbody (search, filter
  changes, mode toggle).
- Filter "All …" option labels changed to sentence case ("All learning
  centers", "All school years", etc.) to match the rest of the admin UI
  established in Part 1; search placeholders lost their trailing ellipsis to
  match the prototype. No behavioral change — same values, same filtering
  logic, same API calls.

## CSS (`assets/css/pages/admin/admin-reports.css`)

Rewritten from scratch, every selector scoped under
`body.st-admin[data-page="Reports"]` (or just `body.st-admin` for the new
generic `.st-table-card` shell, which only this page uses today but isn't
page-specific by nature) so none of it can affect — or be affected by — the
teacher Reports page, which shares `data-page="Reports"` but uses an
entirely different, non-overlapping class vocabulary
(`.st-report-grid`/`.st-report-card`/...). `.chart-type-toggle`/
`.chart-type-btn` were left as the pre-existing shared/unscoped component.

Added: the filter grid (6/3/2 responsive columns), the gray action bar, the
icon+bold count line, the search clear button, the 520px sticky-scroll table
wrapper, the level chip / learner-name / status-pill cell styles, the report
subtitle line, the teal "Mark reviewed" button, and the motion rules (card
entrance + row stagger + `prefers-reduced-motion` override). Dropped three
dead, unused classes (`st-report-listing-actions`, `st-report-groupby`,
`st-report-action-buttons`) that nothing in the codebase referenced.

## Verified

- No duplicate ids and no dangling hooks in `reports.html`; every
  `data-report-*`/`data-submitted-reports-*` lookup in `reports.js` resolves
  against the markup (the two exceptions, `data-view-submission` and
  `data-review-submission`, are JS-generated per row, as before).
- `node --check` passes on `reports.js`; CSS braces and HTML `<div>` tags
  balance.
- `git status` shows zero changes to any teacher-side file
  (`pages/teacher/reports.html`, `assets/js/teacher/reports.js`,
  `assets/css/pages/teacher/reports.css`) — the teacher Reports page was not
  touched by this pass.
- All edited files serve HTTP 200 from the local dev server.

## Still needs a human pass

No browser automation is available in this environment, so this session
verified wiring and static correctness only. Before shipping, please run
through the checklist from the spec in an actual browser: both report
modes, every filter (incl. Account status appearing only in Teachers mode),
clearing search, Preview & export, the CSV download, Notify teachers, View,
Mark reviewed (and the unread badge updating), the empty/loading states, a
1440px vs 390px visual comparison against the reference images, and
`prefers-reduced-motion: reduce` actually disabling all motion.
