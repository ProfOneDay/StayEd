# StayEd — UI Changes Summary

Consolidated record of every frontend/UI change made across the project, merged from the
individual `CHANGES_*.md` session logs (now removed) into one chronological history. Backend-only
work (new DB migrations, mailer service, validation endpoints, etc.) from those same sessions is
omitted here — this file tracks what changed **visually and structurally in the UI**. File paths
are relative to the repo root.

---

## 2026-08-05 — Early feature-driven UI work

- **CLC Overview**: auto-scoped to the logged-in teacher's own municipality (read-only label)
  instead of a manual dropdown; municipality filtering stays admin-only.
- **Class Management**: scoped to one CLC at a time; cards show Learning Level / CLC / School
  Year / Enrolled Learners (no modality tag); added a **Delete Class** action with confirmation.
- **Learner Records**: Face-to-Face / Blended / Modular tables unified to one shared layout
  (columns, widths, pagination, typography); fixed a row-action menu that was clipped inside a
  scrolling table (switched to `position:fixed` with computed coordinates).
- **Module Release Logbook**: modules are released/returned as batches shown in a chronological
  logbook with per-batch status and partial-return support (per-module checkboxes + "Return All").
- **Learner Profile** (first major revision): removed the manual-prediction UI; header shows
  School Year, Date Enrolled, Assigned Teacher, Current Class; Overview replaced attendance
  metrics with Engagement Score, Modules Released/Returned/Active, Last Activity, Days Since Last
  Return; Risk Trend plots real discrete risk-level history; Risk Explanation rewritten around
  real contributing factors; Interventions tab made fully functional (Assign / Update Status / Add
  Outcome all persist); Background Information moved into a real **Edit Learner** modal.
- **Teacher Dashboard**: fixed the Learning Level filter tabs overflowing their container
  ("Senior High" clipped).
- **Profile Settings**: removed the non-functional Appearance / System Preferences / Privacy
  sections (theme picker, font-scale slider, compact mode, language/timezone, session history).
- **Admin/Teacher design unification**: re-pointed the admin section's (Dashboard, CLC Management,
  Settings, User Management) hand-rolled CSS values (colors, radius, shadow, badge colors, type
  sizes — ~276 hardcoded hex colors) onto the shared `--st-*` tokens teacher pages already used, no
  HTML/class changes on either side. Bumped the shared type scale ~2px per step across the whole
  app (body 16→18px, page titles 28→30px, etc.).

## 2026-08-15 — Meeting notes fixes

- **Teacher Dashboard filter bar**: CLC Location filter was hardcoded to two fake options — now
  populates from the teacher's real assigned CLCs; added a missing School Year filter; "Coverage"
  now shows a real percentage instead of a raw learner count.
- **Notification bell**: the unread-count dot had no `display:none` default and was permanently
  visible — now hidden by default, shown only via an explicit `.is-visible` class; clicking a
  notification card now also marks it read.
- **CLC Overview**: removed the "+ Add Class" button (class creation lives only in Class
  Management) and the Active Centers / High-Risk Learners KPI cards, leaving a 2-column Total
  CLCs + Total Learners layout.
- **Learner Profile — Risk Trend**: chart rewritten to plot points by real probability within
  their correct Low/Moderate/High colored zone (not equal thirds), connected with an SVG line;
  added the exact required empty/single-point messaging.
- **Early Warning**: CLC filter dropdown previously only listed CLCs with an active alert — now
  sources from the same assigned-CLC list as everywhere else, so a CLC with zero alerts still
  appears (with a proper "no learners requiring attention" empty state).
- **Module Release Logbook**: added an "Edit" action on every batch row (active and returned) to
  correct Release Date, Module Name, Learning Strand, Return Date, and Remarks after the fact.
- **Learner Profile — Module Rate**: replaced the "Engagement Score" KPI card with "Module Rate"
  (`returned / released × 100`, plus "N of M modules returned" and a small progress bar);
  reordered the KPI row.

## 2026-08-23 — Modality history, attendance, overdue tracking

- **Learner Profile**: now shows "Modality: X (Since [date])"; Edit Learner modal gained a real
  Modality dropdown that prompts for a change reason and logs it; every change appears as a
  "Modality Changed" entry in the Monitoring History timeline.
- **Email format validation**: Registration, Forgot Password, and the profile email field now
  reject malformed addresses client-side (in addition to server-side).
- **Class Management**: new "Take Attendance" button on class cards (Face-to-Face/Blended classes
  only) opening a checklist-style attendance modal; reopening a saved date lets you correct it.
- **Module Release / Learner Profile / Admin Settings**: modules now get a "Planned Return Date"
  at release time (auto-suggested, editable) and show a red "Overdue by N days" flag once passed;
  Learner Profile gained an "Overdue Modules" stat; Admin Settings gained a "Module Return Default"
  control.

## 2026-09-25 — Teacher Dashboard redesign

Full visual revision to match the approved dashboard prototype — presentational only, no feature/
data-logic changes.

- **New design tokens** (`variables.css`): line/ink/risk-ink/category colors, card radius/shadow,
  motion-timing tokens (`--st-line`, `--st-radius-card`, `--st-ease-out`, `--st-t-hover/-press/
  -fill`, etc.); sidebar width 280→256px, navbar height 80→64px.
- **Shared app shell** (`layout.css`, affects every logged-in page): sidebar gets a 64px brand row,
  flat nav items with a solid white active pill; navbar is 64px translucent-blur with an inline
  breadcrumb; footer became a slim single line; mobile (<1024px) sidebar becomes an off-canvas
  drawer; global hover/press motion added everywhere, gated behind `prefers-reduced-motion`.
- **Dashboard page**: the 4 separate stat cards became one overview card (total-learners number +
  proportional risk strip + 3-column legend); risk-distribution chart became horizontal bars with
  a redesigned insights panel; recent high-risk list simplified to tinted avatars + a meter;
  Student Registry widget merged its Profile/Name columns into one Learner column.
- Added scroll-triggered "fill in on view" motion (risk strip, bars, meters, count-up numbers),
  fully disabled under `prefers-reduced-motion`.
- **Bug fixed**: an unscoped admin-dashboard CSS rule was leaking a solid background fill into the
  new dashboard's risk-legend items (only meant to show a colored border) — fixed with an explicit
  `background: transparent` on the dashboard's own rule.

## 2026-09-25 — Teacher Calendar redesign

Reuses the dashboard's shared shell/tokens/motion.

- **New event-type color tokens**; "Module return due" changed from orange (risk-moderate's color)
  to violet, since a return date isn't a risk level.
- Replaced three duplicated inline color maps with one shared `EVENT_TYPES` object; mini-month
  days became keyboard-reachable `<button>`s; rewrote the Upcoming list item template (date tile +
  type-color dot); month-grid chips dropped their icon for full label width; week view simplified
  to one click-target column per day; day panel gained a weekday kicker and icon-tile event cards;
  event-detail modal restyled with an icon tile + outward-arrow title link.
- Added direction-aware entrance motion on prev/next/Today/view-toggle, and a reverse slide-out
  when closing the day panel — all skipped under `prefers-reduced-motion`.
- Mobile (<768px): two-row toolbar, short day-of-week labels, month chips collapse to dots, week
  view becomes a vertical list, day panel becomes a bottom sheet with a grab handle.
- **Bugs fixed**: a stray `*/` inside a CSS comment was silently truncating the stylesheet and
  dropping the next rule; a leaked unscoped `display:flex` was shrinking the class-search field
  instead of letting it stretch to its intended 340px.

## 2026-09-25 — Global design consistency pass

Un-scoped the dashboard/calendar page-header, spacing, and card styling into the shared rules so
every teacher/admin page picks it up automatically.

- `.st-page-header-title`: 26px navy 700 → 30px Libre Franklin 800 near-black, site-wide.
- `.st-content`: padding/gap tightened (32px gap → 20px) site-wide — this was the main source of
  "inconsistent spacing" complaints, since only the dashboard had been tightened before.
- `.st-card` now shares the same 12px radius / soft shadow as `.st-panel`.
- Admin Dashboard's own no-scroll single-viewport layout was deliberately left at its smaller
  26px title as a documented exception.
- **Round 2 — spacing + table unification**: removed a leftover `.st-page-header` margin-bottom
  that was doubling up with `.st-content`'s new gap on every page; un-scoped the dashboard's table
  restyle (14px body text, 12.5px headers, small pills, outline "View profile" button) so it
  applies to every `.st-data-table` in the app (Learner Records, Student Registry, Early Warning,
  admin Reports, etc.) instead of just the dashboard; added the `.st-data-table` class to two admin
  pages (CLC Management, User Management) whose tables had never had it; changed "View Profile"
  buttons from solid to outline in Student Registry/Early Warning to match.
- **Bug fixed**: CLC Overview's filter row indicator column overflowed on mobile — fixed with a
  stacking media rule.

## 2026-09-26 — CLC Overview & Class Management redesign

- **Shared `.st-clc-card`**: dropped the repeated building/book icon tile; footer is now a
  full-width "View classes"/"Open class" row button with a hover-nudging arrow.
- **CLC Overview**: replaced two floating stat boxes + a loose paragraph with one 3-column summary
  strip (CLC count, total learners, municipality); search row is now borderless/transparent;
  card pill is sentence-case with a teal-soft "Active" style; fake teacher-initial avatars replaced
  with a single "N assigned teachers" line.
- **Class Management**: banner rebuilt from a solid navy block into a white bar with a 4px navy
  left border and an outline "Switch CLC" button; card footer is now Open class (primary) +
  Attendance (outline, icon+label) + Delete (turns red on hover).
- Added `data-animate-cards` settle-in motion (fade + 8px rise, 50ms stagger) to both grids,
  respecting `prefers-reduced-motion`.
- **Bugs fixed**: empty states ("No CLCs found"/"No classes yet") were rendering but permanently
  invisible because the animation-reveal class was never re-triggered on that code path; the CLC
  search field's icon was fighting the shared `.st-search` component's absolute positioning; the
  Calendar day panel's Action buttons were rendering in Arial instead of the site font (buttons
  don't inherit `font-family` by default).

## 2026-09-26 — Reports, Profile Settings, System Settings, Help & User Manual, About StayEd

- **Profile Settings**: old `col-4`/`col-8` bento grid became a sticky-left `280px + 2fr` layout;
  summary card reordered (photo → name/role/status → CLC/employee-ID details); Profile
  information/Account settings became true collapsible accordions; locked fields get a lock icon
  + one shared explanatory note; danger zone rebuilt as a red-header card.
- **Reports**: grid became 2 equal columns with visible field labels above every control and a
  footer "CSV chip + Preview & export" button; search dropdowns restyled as a floating pop-in card.
- **System Settings**: old 12-column bento grid became four full-width stacked cards; font-size
  slider now has a real animated gradient fill + tick labels.
- **Help & User Manual**: FAQs moved from a plain list into a 2-column icon-tile card grid.
- **About StayEd**: rebuilt as one card with a navy header band, logo, and three fact tiles
  (Version/Organization/Built for) — wording unchanged.
- All five pages settle in on load (fade + rise, staggered), respecting `prefers-reduced-motion`.
- **Bug fixed**: Reports' learner-search modality badge had no color of its own from the shared
  `.badge` class and was rendering as plain stacked text — restyled as a small navy-soft tag.

## 2026-09-26 — Student Registry, Learner Records, Early Warning Alerts

The largest single revision of the project, done in seven follow-up rounds.

- **Shared building blocks**: new `.st-table-card`, `.st-toolbar`, `.st-risk-cell` (badge +
  probability % + fill meter), `.st-two-line`, sortable `.st-sort-btn` headers, `[data-tip]`
  tooltips, row-entrance motion, new status pills, risk-tinted avatars, and the mobile
  table→card-stacking pattern — all shared across the three pages.
- **Student Registry**: 4 stat cards became the dashboard's `.st-overview` strip plus a new
  "Not yet assessed" segment; bulk-action bar restyled as a navy pill; Learner/LRN merged into one
  sortable header cell.
- **Learner Records**: header actions reordered (Enroll student now primary); context banner
  matches Class Management's; modality tabs moved into the table card's head as a segmented
  control; Modules column shows a fillable progress bar + "View logbook →".
- **Early Warning Alerts**: summary reuses `.st-overview`; "Medium Risk" renamed to "Moderate
  risk"; Class and Risk/Alert columns merged to match the shared pattern.
- **Global button fix**: `.st-btn`/`.st-btn-primary` base was still 44px/4px-radius/16px-text
  from before the dashboard revision — updated to 38px/8px-radius/14px-text app-wide, fixing every
  plain button in the app (e.g. "Add class" looking stale) at the source.
- **Doubled-spacing sweep**: found and fixed six more leftover-margin doubling bugs across
  Assessment Scores, Notifications, Reports, and three admin pages.
- **Round 2**: fixed a shared banner's leftover 24px margin-bottom (Learner Records/Module
  Management doubling to 44px) and a leftover `transform` making every toolbar search icon sit at
  the top of its field instead of centered (affected all three pages).
- **Round 3**: both pages' colored risk strips were rendering as blank space — the shared
  `.st-risk-strip` reveal only runs once an `.is-inview` class is added by an IntersectionObserver
  that neither page had wired up; fixed by adding the class directly after render (no observer
  needed, since the card is always above the fold).
- **Round 4**: the summary card had no internal padding at all — root cause was a missing
  `.st-panel-pad` utility class that the dashboard's own version always includes separately.
- **Round 5**: upgraded the Dashboard's own "Student Registry Summary" widget's Risk column to the
  same badge+meter component used on the full pages.
- **Round 6**: added hover/focus tooltips to non-obvious column headers (LRN, Risk, Modules,
  Alert); fixed tooltips opening upward and getting clipped by the card's rounded-corner overflow.
- **Round 7**: unified the row-actions "View profile" + ⋮-menu pattern across all three tables
  (Student Registry, Early Warning, and the Dashboard widget all gained the same floating-menu
  component); reworked each table's columns to close remaining gaps (Student Registry regained
  Level/Modality/Latest activity as separate columns; Early Warning split Class/Alert back into
  four columns); fixed resulting horizontal-overflow regressions at 1280px via padding/column-cap
  tuning, and a stray `@media` cap that was over-truncating text on mobile.
- **Other fixes**: a double focus-ring on Student Registry's search field; a truthy
  `"Not Yet Assessed"` string bypassing the old `risk || "fallback"` check; an `Invalid Date` bug
  in Early Warning from a full ISO datetime being re-parsed with an appended time.

## 2026-09-28 — Class tools (Manage Modules, Import Learners, Manual Enrollment, Assessment Scores)

- **Manage Modules**: catalog view's 5 stat boxes became one summary card (total/progress
  bar/active/returned); module rows merge the number tile, title, strand chip and topic; detail
  view header restyled with a stage-summary bar and merged Dates column; full custom mobile
  table→card conversion.
- **Import Learners**: added a 3-step indicator (Upload → Review → Done); restyled the upload zone
  and preview table (sticky Learner/Actions columns, merged Status+Issue cell); success panel
  restyled with a large check icon + 4 color-coded stat tiles. Review table intentionally stays a
  horizontally-scrolling table on mobile (explicit exemption from the shared card-stacking rule).
- **Manual Enrollment**: gate/modality choices restyled as icon option-cards; added a compact
  mobile "Step N of 8" progress readout; directional slide transitions between steps.
  **Bug fixed**: the review step was missing the already-collected Socio-economic Status and
  Monthly Household Income rows — added them (₱-formatted).
- **Assessment Scores**: **bug fixed** — the AF5 table's percentage-widthed columns plus a
  1080px `min-width` floor pushed the Readiness/Competency column permanently off-screen inside
  its ~778px container at laptop widths; switched to fixed pixel column widths and a 620px floor.
  **Bug fixed** — unassessed learners showed a computed "0%" instead of "Waiting for post-test
  scores", because the summed total defaults to `0` (not `null`); added explicit
  has-any-post-score checks gating all three render paths. **Added** — the learner panel becomes a
  horizontal scrolling chip row under 1024px, and its header is now sticky under the top bar.

## 2026-09-30 — Learner Profile revision (prototype match)

Full revision of the teacher Learner Profile page to match its approved design prototype —
presentational/structural only, no backend/API/flow changes.

- 4-column hero card (identity / details / current-risk panel / actions) with icon-tile headers,
  two-column metric groups with a fill bar, a rebuilt performance-progress plot (inset gridlines,
  gradient area, animated draw-in line, hover-tooltip points matching the dashboard's chart
  tooltip style), an A&E readiness bar with a 70% cutoff marker, a two-column risk-trend
  chart + run list, a segmented sticky tab bar, a 3-column contributing-factors grid, and restyled
  timeline/intervention/AI-Insight components.
- Render functions rewritten to emit classes instead of inline styles; fixed a mojibake `â€”` →
  `—`; added a shared `IntersectionObserver`-based motion system that fills bars/lines on scroll
  into view and replays on tab switch.
- **Hero risk states**: the current-risk panel, avatar ring, and icon now switch between five
  distinct looks — High, Moderate, Low, Preliminary, and Not yet assessed — each with its own
  gradient, icon-circle tint, and avatar ring color, driven by the learner's existing risk/
  preliminary signal (no new backend field). Preliminary uses an hourglass icon and the existing
  `st-risk-badge--preliminary` styling already used in the data tables.
- Responsive at 1280px/1024px/768px with no horizontal scroll at 390px; motion respects
  `prefers-reduced-motion`.

## 2026-09-30 — Student Registry & Manage Modules: Archive feature

Added a Manage-Modules-style Archive/Restore feature to Student Registry, then adjusted both
pages' toolbar layouts per follow-up feedback.

- **Student Registry**: new active/archived view toggle (mirroring Manage Modules' pattern) that
  filters the table, swaps the card title ("All learners" ↔ "Archived learners"), disables the
  now-irrelevant status filter while viewing archived learners, and shows an archived-aware empty
  state; bulk actions swap between Archive/Restore depending on the current view; archived learners
  are excluded from the top summary stats. The toggle button lives in the page header, before
  "Export"; "Clear filters" stays in its original toolbar position (far right, in line with the
  filters).
- **Manage Modules**: moved the existing archive/active toggle out of the table toolbar into the
  page header, before "Add module" (shown/hidden in sync with it across catalog/detail views); added
  a new "Clear filters" button to the toolbar, right-aligned in line with the search/status/sort
  controls, matching Student Registry's exact styling and position.

---

## 2026-10-02 — Admin Dashboard: rebuilt on the teacher dashboard's components

Replaced the admin dashboard's standalone, hand-rolled layout with the same components and CSS the
teacher dashboard already uses, matching a design prototype (`design/admin-dashboard/`). No backend,
API, Division II scoping, risk thresholds, deep-link, or map zoom/pan logic changed — purely a
presentational rebuild, with every stat, chart, toggle, legend item, and the CLC list/pager preserved.

- **Shared CSS, not duplicated**: `assets/css/pages/teacher/dashboard.css` now scopes under
  `body:is([data-page="Teacher Dashboard"],[data-page="Admin Dashboard"])` instead of just the
  teacher page, so admin gets the exact same panel/grid/overview/`st-hbar`/filter-bar/motion rules.
  This also fixed a real bug: the teacher dashboard's chart-type toggle (bordered pill, navy active
  state) was *leaking in* from the old `admin-dashboard.css`, which `main.css` imports after the
  teacher file — not from `dashboard.css` itself as it looked. That old file's `.chart-type-toggle`/
  `.chart-canvas-wrap`/etc. rules are gone now that admin pulls from the same shared definition.
- **`admin-dashboard.css` rewritten** to hold only what the shared teacher components don't already
  cover: the area-selector bar, the risk dot, the CLC card's teal tint, and the map container/hover/
  select behavior. Also removed the old `@media (min-width: 981px)` lock that forced `overflow:hidden`
  on the whole page and squeezed everything into one non-scrolling screen — the page now scrolls
  normally like every other page in the app.
- **New "Not yet assessed" stat**: the overview card's risk strip/legend gained a 4th segment
  (`total − high − moderate − low`, clamped at 0) so the displayed percentages always sum to 100% —
  previously the gap between "learners with a risk result" and "total learners" was invisible.
- **Map**: kept the original interaction exactly (navy outline on hover, navy fill + lift on select,
  the pill tooltip, the real risk-level colors) but moved the SVG's background out of an inline
  `<rect>`/style attribute into the `.mapwrap` container's own CSS, and switched the zoom buttons to
  icon-based controls matching the teacher dashboard's icon-button style.
- **Chart.js views upgraded** to match the teacher dashboard's styling: dark tooltips showing
  "value (share%)", a bottom legend, a 68%-cutout doughnut with a center total, and the same
  stagger/draw-in animation — plus a working count-up on every stat number that counts *from* the
  previous value when you switch municipalities, not just snapping to the new one.
- **Avatar fallback** (`core/layout.js`): a broken/missing avatar image now falls back to the
  initials bubble instead of showing a broken-image icon — this was visible on the admin navbar
  specifically, since no admin account in this environment has an avatar set.

---

## 2026-10-02 — User Management & CLC Management: rebuilt on the teacher Student Registry's components

Redesigned the admin **User Management** and **CLC Management** pages to use the same overview strip,
table card, search/select, pills, row buttons and pagination as the revised teacher Student Registry
and the teacher dashboard, matching `design/admin-users-and-clcs/` prototypes. Frontend-only: no
filtering/search/pagination/approve/reject/edit/reset/deactivate/remove/add/archive/restore logic or
API calls changed — every KPI, modal, field, banner, radio option and button was kept and only
restyled. All JS hook ids (`#kpis`, `#tbody`, `#umPagination`/`#clcPagination`, every modal id and its
field ids, `.kpi[data-filter]`, `data-clc`, `name="reject-reason"`, etc.) are unchanged.

- **Fixed a real CSS bug affecting every table in the app**: a comment in
  `assets/css/pages/teacher/dashboard.css` contained a stray `*/` mid-sentence
  (`.st-pagination*/.st-page-btn`), which closed the comment early and turned the rest of it into an
  invalid selector — silently dropping the shared `.st-data-table { width:100%; text-align:left; … }`
  rule that followed. Every data table in the app (Student Registry, Learner Records, Early Warning,
  the teacher dashboard registry, and now the two admin list pages) was quietly relying on a fallback
  width instead of filling its card. Fixed by adding spaces around the `/`.
- **Shared the teacher list styles instead of copying them**: every selector scoped to
  `[data-page="Student Registry"]` across `learner-records.css`, `learner-records-hub.css` and
  `dashboard.css` now also matches `[data-page="User Management"]` and `[data-page="CLC Management"]`,
  so the two admin pages get the exact same overview strip, `.st-table-card`, `.st-search`/`.st-select`,
  `.st-data-table`/`.st-reg-table` (including the mobile card-stacking rules), `.st-pill`,
  `.st-row-actions`/`.st-btn-xs`, `.st-pagination`/`.st-page-btn` and row-menu styling the teacher pages
  already have — nothing visually changed for the teacher pages themselves, they just gained two more
  pages in their `:is(...)` selector lists.
- **New shared admin-only layer** (`assets/css/pages/admin/admin-list-pages.css`, scoped under
  `body:is([data-page="User Management"],[data-page="CLC Management"])`): the KPI overview
  (big total + proportional strip + bordered/tinted legend buttons), CLC/teacher chips, status pills,
  and the `.overlay`/`.modal` visual language (16px radius, large shadow, scale-in, bottom-sheet on
  mobile) that both pages' modals share.
- **Old per-page CSS files were leaking globally**: `admin-user-management.css` and
  `admin-clc-management.css` declared bare, unscoped `.btn`, `.badge`, `.card`, `.kpi`, `.overlay`,
  `.modal`, `.field`, `.pagination*` and `.empty-state` rules that `main.css`'s `@import` chain applied
  to *every* page — most visibly, `admin-settings.css`'s unscoped `.modal{width:39.6vw;min-width:456px}`
  broke every other page's dialogs on phones. Both old admin-list files were rewritten to hold only
  what's page-exclusive (User Management's Create Account role toggle, reject-reason radio list, and
  reset-password reveal field; CLC Management has nothing left over), and `admin-settings.css`'s rules
  were scoped to `body[data-page="Settings"]`. `admin-reports.css` was already properly namespaced.
- **Modals**: moved every inline `style=""` (font sizes, margins, grids, `display:none`) into classes
  (`.st-modal-section-label`, `.st-field-grid-2`/`-3`, `.modal-actions--split` + `.st-modal-actions-right`)
  or the `hidden` attribute, and remapped button classes to the shared `.st-btn-*` set (`st-btn-primary`,
  `st-btn-outline`, `st-btn-ghost`, `st-btn-danger` for final confirms, `st-btn-danger-outline` for
  Reject). Replaced the inline SVG icons in confirm dialogs with Material Symbols matching the same
  meaning (`archive`, `restore`, `lock_reset`, `check_circle`, `person_off`, `delete`).
- **Toasts**: both pages' custom inline `#toast` div + hand-rolled `showToast()` were replaced with the
  shared `Utils.toast(message, type)` / `data-component="layout/toast"` system already used by the
  admin dashboard, with error paths now passing `'error'` and validation messages `'warning'` instead of
  every toast using the same green checkmark regardless of outcome.
- **Motion**: the overview strip reveals via the same `[data-animate]`/`is-inview` clip-path pattern as
  the teacher dashboard (triggered directly on render, since the panel is always above the fold — same
  approach as Student Registry's summary), KPI numbers count up from their previous value, and table
  rows fade in with a 30ms stagger via `[data-animate-rows]` after every render (load, filter, search,
  page change). All of it collapses to its final state under `prefers-reduced-motion: reduce`.

---

## 2026-10-03 — Admin Settings split into Profile Settings + System Settings, new Help & User Manual

- **Sidebar**: "Settings" renamed to "System Settings"; added an "Account" divider with new
  "Profile Settings" and "Help & User Manual" links beneath it.
- **Profile Settings** (new admin page, shares the teacher page's `data-page` value so it inherits
  `profile-settings.css` directly): profile summary card, three collapsible sections (Account
  information, Security, Danger zone), Edit Profile / Change Password (3-view) / Confirm modals —
  all content and hooks carried over from the old combined Settings page.
- **System Settings** (rewritten, settings-only now): two cards (Academic year, Module return
  default) plus their edit modals and a hint linking to Profile Settings — no confirm-modal step,
  matching the old page's direct-save behavior.
- **Help & User Manual** (new admin page, mirrors the teacher Help page's FAQ layout): FAQ content
  is a first draft (approving teacher registration, adding a CLC, exporting the Master Enrollment
  Listing, changing the school year) — flagged as needing review before treating it as final.
- Added the shared `st-admin` body class across every admin page.

## 2026-10-03 — Admin Reports redesign

- Both panels (Master Enrollment Listing, Reports from Teachers) rebuilt on the shared
  `.st-panel.st-table-card` shell; the filter row became a responsive labelled-field grid
  (6/3/2 columns depending on width); both tables now scroll inside a sticky-header, 520px-max
  `.st-report-table-wrap`.
- Status values (enrollment/account/submission), learner/teacher names, and the Learning Level
  column now render as pills/chips instead of plain text; the count line gained an icon; "Mark
  Reviewed" restyled from plain gray text to a teal text-link button.
- Card-entrance + row-stagger motion added, respecting `prefers-reduced-motion`.
- CSS fully rewritten and scoped under `body.st-admin[data-page="Reports"]` — confirmed zero
  changes to the separate teacher Reports page, which shares the same `data-page` value but an
  entirely different, non-overlapping class vocabulary.

## 2026-10-07 — Student View redesign + per-class LRN/birthdate access

- **Student View** (public, read-only learner report page): rewritten around a sticky top bar
  (dark logo + "read-only" chip), a centered 1200px content column, and a slim footer — loads only
  `variables.css`/`components.css`/`student-portal.css`, no app chrome. Rebuilt hero (avatar +
  risk-tinted ring + meta tiles), risk card, and performance-progress chart (dashed gridlines,
  outside % labels, animated line draw-in on scroll into view).
- **Sharing model changed from per-student to per-class**: the old per-learner copy-link toggle on
  Learner Profile was removed entirely; a single "Student view" toggle now lives on Learner Records
  (Class Management) and covers every learner in that class at once, since that's how teachers
  actually used the per-student version in practice.
- **New public lookup page** (`pages/student/access.html`): instead of being handed a link,
  students open their own report by entering their LRN + birthdate — a two-column page (navy pitch
  panel + form card, stacks on mobile) with an auto-grouped 12-digit LRN field, a disabled-until-
  valid submit button, and a shake-animated generic error message (the endpoint never reveals
  *which* part of the lookup failed — bad LRN, wrong birthdate, or sharing turned off all look
  identical). Backed by a new rate-limited backend endpoint (5 attempts / 10 minutes per IP).
- `renderUnavailable()` on the Student View page now includes a "Look up my report with my LRN"
  link to the new access page.

## 2026-10-09 — Setup Wizard + Account Pending Approval redesign

- **5-step setup wizard**: sticky top bar with a dot-stepper (done steps teal + check, active step
  navy with a soft ring; collapses to "Step N of 5 · {label}" + a progress bar under 768px), a
  fixed footer (back left, primary action right), and a per-step layout rebuild (Welcome's
  split navy/white roadmap card, Create Class + sticky Class Summary, Upload's dropzone + file
  card, Preview's stat tiles + table, Complete's pop-in check + stats + configuration card).
- **Behavior change, not just cosmetic**: Upload/Preview now go through a real preview-then-confirm
  step — the file is validated and duplicate/invalid rows are flagged *before* anything is written
  to the database, and the import only commits when "Confirm Import" is clicked on step 4. The old
  wizard imported immediately on step 3 and just redisplayed the result as "Imported."
  Step 4 redirects back to step 3 if opened with nothing to confirm (a direct link or a refresh).
- Extracted a shared `LearnerImportCore` module (file validation, preview/confirm calls, template
  download, dropzone drag/drop wiring, staged-progress animation) so the setup wizard and Class
  Management's existing "Import Learners" page stop maintaining two separate copies of the same
  logic; Import Learners' own page design/behavior is otherwise unchanged.
- Step 2's Continue button is now disabled until municipality, CLC, level, and school year are all
  set, with the Class Summary's status line and each row's icon toggling live between "Complete all
  fields to continue" and "Ready for learner import."
- **Account Pending Approval**: background, pending icon (ring-pulse + hourglass-flip once), the
  "Pending review" chip, and a vertical step tracker (teal check "Done" / amber ring "In progress"
  / gray upcoming) now match the approved design; "Back to Login" restyled as a navy primary button
  with a back arrow.
- `prefers-reduced-motion: reduce` added to the shared auth stylesheet (there wasn't one before),
  disabling every `.auth-page` animation/transition app-wide.

## 2026-10-10 — Learner Quick-View modal

- Clicking a learner's avatar or name anywhere in the app now opens a quick-view preview modal
  (profile summary, risk card, contributing factors, active intervention) instead of always
  leaving the page for the full Learner Profile — wired into the Dashboard's Recent High-Risk list
  and Student Registry Summary widget, the full Student Registry, Learner Records (class roster),
  Early Warning Alerts, and the Module Management roster.
- Every other existing control (standalone "View profile" buttons, row-menu items, Assign
  Intervention, etc.) is untouched and still navigates straight to the full Learner Profile page as
  before. Assessment Scores was deliberately left out — clicking a learner there selects them for
  scoring instead of previewing their profile.
- Desktop: centered 680px dialog. Mobile (<768px): bottom sheet. Risk styling (tone, ring color,
  icon) reuses the same `--st-risk-*` tokens the rest of the app already uses, with focus-trap,
  Escape, backdrop-click, and scroll-lock behavior.

## 2026-10-11 — Three-phase CSS architecture cleanup

A three-session refactor of `assets/css`, presentational/structural only — no content, flow, or
JS-behavior changes, and every id, `data-*` hook, and JS-toggled class (`is-active`, `is-open`,
`.selected`, etc.) was left in place throughout all three phases.

- **Phase 1 — Foundation**: fixed a handful of real, previously-unnoticed bugs — a broken CSS
  comment (a literal `*/` mid-sentence) was silently dropping every rule after it on 3 pages'
  stylesheets; a duplicated `@keyframes` name; CSS double-loaded via both `main.css` and a direct
  `<link>` on one page. Collapsed the radius/color/breakpoint/font-size scales each onto one
  canonical token set (`--st-radius-*`, risk-color aliases, `--st-fs-*`, the 4-step breakpoint
  scale), and removed 470 dead `var(--a, var(--b))` fallback chains where the fallback could never
  actually fire.
- **Phase 2 — Shared component library**: pulled every shared UI element (buttons, form fields,
  pills/badges, panels/cards, avatars, data tables, charts/risk-viz, modals, tabs) into one
  unscoped definition under `assets/css/components/`, inherited by every page instead of being
  redefined per page. Settling on "the" canonical version of several long-duplicated components
  produced a few small, intentional visual shifts (e.g. button active-state scale `.96`→`.97`,
  icon-tile radius 12px→8px, pill height standardized to 24px, modal corner radius 12px→18px and
  new size steps, a new grab-handle bar on mobile bottom-sheet modals).
- **Phase 3 — Cleanup**: removed all 170 inline `style=""` attributes app-wide (replaced with
  classes or, where a value is genuinely per-instance like a chart point's position, CSS custom
  properties); consolidated 4 duplicated JS helpers (`initials`, `esc`, `countTo`, `riskPill`/
  `riskBadge`) down to one implementation each in `core/utils.js`. Standardized risk-pill label
  text to "High"/"Moderate"/"Low" (no "Risk" suffix) and the not-yet-assessed label to
  "Not Yet Assessed" everywhere, resolving small wording disagreements between the 6 previously
  separate copies. Removed 219 confirmed-dead CSS classes (verified against actual HTML/JS usage,
  including dynamically-built class names, before deleting).
- **Open item across all three phases**: none of them included a browser/screenshot verification
  pass (no browser automation was available in those sessions) — every change was verified by
  static checks only (brace balance, `node --check`, re-running the style-audit script, confirming
  specific pages still parse their intended first CSS rule). A full click-through + 1440px/390px
  screenshot comparison against the pre-refactor app is the single biggest remaining item before
  fully trusting the visual result of this cleanup.

---

## Recurring patterns worth knowing

- **CSS leaks globally**: `main.css` `@import`s every page's stylesheet unscoped, so a class name
  reused on two pages collides unless deliberately scoped under `body[data-page="…"]`. Nearly every
  "mystery styling" bug found across these sessions traced back to this.
- **`margin-bottom` vs. flex `gap`**: several pages kept an old `margin-bottom` on `.st-page-header`
  or a banner from before `.st-content`'s `gap: 20px` took over spacing duties, silently doubling
  the visual gap. Always check for this first when spacing looks "too big."
- **`[hidden]` vs. author CSS**: an element's own `display` rule (even from a shared class like
  `.st-btn`) always beats the browser's default `[hidden]{display:none}`, regardless of
  specificity — needs an explicit `:not([hidden])` guard or a scoped `[hidden]{display:none}` rule.
- **Scroll-reveal needs a trigger**: any component using a `[data-animate]`/`.is-inview` reveal
  pattern does nothing until something adds that class — either a real `IntersectionObserver` for
  below-the-fold content, or a direct add-after-render for content that's always above the fold.
- **No browser automation across most of this project's history**: nearly every session above
  ends with "not verified visually, no browser tooling available" — static checks (brace/paren
  balance, `node --check`, the style-audit script, hook/id cross-referencing) catch structural
  mistakes but can't confirm the app actually *looks* right. Treat any unreviewed entry above as
  code-complete, not visually confirmed, until someone has clicked through it.
