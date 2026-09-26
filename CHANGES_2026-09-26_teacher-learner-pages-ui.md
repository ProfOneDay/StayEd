# StayEd — Student Registry, Learner Records, Early Warning Alerts UI revision (2026-09-26)

Revised **Student Registry**, **Learner Records** and **Early Warning Alerts** to match the
approved prototypes in `design/teacher-learner-pages/`, plus three smaller fixes flagged
in the same request (a double focus-ring on the registry search field, doubled section
spacing on several pages, and a stale-looking "Add class" button). Frontend-only,
presentational — no API, guard, sorting/filtering/pagination-logic, or modal changes.
None of this is committed to git yet.

## Files changed

- `StayEd_Frontend/pages/teacher/student-registry.html` / `assets/js/teacher/student-registry.js`
- `StayEd_Frontend/pages/teacher/learner-records.html` / `assets/js/teacher/learner-records-hub.js`
- `StayEd_Frontend/pages/teacher/early-warning.html` / `assets/js/teacher/early-warning.js`
- `StayEd_Frontend/assets/css/pages/teacher/learner-records.css` — new shared table-card
  component styles for all three pages, Student Registry's bulk bar and 4-item risk legend.
- `StayEd_Frontend/assets/css/pages/teacher/learner-records-hub.css` — Learner Records'
  tabs-in-table-card head, light context banner, row-menu popup, progress/activity cells.
- `StayEd_Frontend/assets/css/pages/teacher/dashboard.css` — Early Warning's old standalone
  summary/filter-bar styling replaced with reuse of the shared `.st-overview`/`.st-table-card`;
  `.none` risk-strip/legend variant added for Student Registry's "not yet assessed" segment.
- `StayEd_Frontend/assets/css/components.css` — **global button fix**, see below.
- `StayEd_Frontend/assets/css/pages/teacher/{assessment-scores,notifications,reports}.css`,
  `StayEd_Frontend/assets/css/pages/admin/{admin-clc-management,admin-settings,admin-user-management}.css`
  — removed six leftover-margin spacing bugs, see below.

## Shared building blocks (all three pages)

Reused the dashboard's `.st-overview` component (Registry and Early Warning) exactly as-is —
it already lived in `dashboard.css` unscoped. Built new shared classes in `learner-records.css`,
scoped to `body:is([data-page="Student Registry"], [data-page="Learner Records"],
[data-page="Early Warning Alerts"])` per the brief: `.st-table-card` (+`-head`/`-title`/`-count`),
`.st-toolbar` (search up to 420px + selects with a custom caret + text buttons), `.st-risk-cell`
(badge + probability % + a meter that fills on `[data-animate-rows].is-inview`), `.st-two-line`,
button-based `.st-sort-btn`/`.st-sort-icon`/`.st-th-sep`, `[data-tip]` tooltips, row entrance
(`[data-animate-rows]`, fade + 4px rise, staggered 30ms via `style="--i:N"`), new status pills
(`.st-pill--active/-pending/-archived/-inactive`), risk-tinted avatars
(`.st-avatar-initials--high/-moderate`), and the mobile card-stacking pattern (header collapses
to a sort bar, rows become cards via `data-col`).

The **learner cell** (avatar + name button + "LRN …" sub-line, LRN merged in, no separate
column) is identical across all three pages, matching the prototypes.

## Student Registry

- Header stays the same; the four stat cards became the `.st-overview` strip: total +
  high/moderate/low **+ a new "Not yet assessed" segment**, computed in `renderStats()` as
  `total − high − moderate − low` and written to a new `data-mgmt-unassessed` element (added
  the `.none` risk-strip/legend color variant to the shared dashboard component for this).
- Table card: "All learners" + count, toolbar (search + 3 selects), bulk bar restyled to a
  navy pill with translucent white Export/Archive/Delete buttons (Delete reddens on hover),
  pops in over 180ms.
- Columns: checkbox; Learner/LRN with both sort buttons in one header cell separated by a
  faint "/"; Level & modality (two-line, replaces the two gray pills); Risk (badge + probability
  meter, `data-sort="risk"` kept); Status; Actions (outline "View profile", tooltipped icon
  buttons for Run prediction/Archive-Restore).
- Colspan/skeleton updated from 9 to 6 columns.

## Learner Records

- Header links reordered/relabeled in sentence case; Enroll student is now the primary (navy)
  button, the other three stay outline; on mobile they form a 2-column grid with Enroll
  student first and full width.
- Context banner: now the same light white-bar-with-navy-border look as Class Management
  (44px icon tile, CLC as a faint kicker, level as 20px Libre Franklin 800, muted meta line,
  outline "Switch class" button) — scoped to this page only; the shared two-line base rules
  in this file (also used by Module Management) are untouched.
- The modality tabs moved from a standalone row into the table card's head, alongside search
  and the risk select, as a segmented control; the tabs/panels and their JS are unchanged,
  only their position and look.
- Columns: Learner; Modules ("**2 of 5** returned" + percent, a fillable teal progress bar,
  "View logbook →" with a hover-nudging arrow); Activity (existing dot/text, dot now gray for
  `none`); Risk (badge only, no probability on this page); Actions (⋮ menu).
- Row menu restyled into a floating card (10px radius, `0 12px 32px rgba(17,26,54,.16)`
  shadow, 160ms pop-in); **kept its existing fixed-position JS** (`top`/`right` set from the
  trigger's `getBoundingClientRect()`) so it still isn't clipped by the table's scroll
  container — verified on the last row of a 6-row page.
- Colspan updated from 6 to 5; inline styles removed from `recordCells()`/`modulesCell()`/
  `activityCell()`.
- `.st-progress-cell`/`.st-consult-dot` restyling is scoped to `.st-lr-table` specifically
  (not just the page), since `.st-progress-cell` is also used inside the unrelated Module
  Release modal, which can be opened from this same page and must keep its own look.

## Early Warning Alerts

- Summary: now reuses `.st-overview` (total = "active alerts", legend = high/moderate/low).
  "Medium Risk" renamed to "Moderate risk" to match the filter and every other page; the old
  colored-left-border cards and their inline colors are gone.
- Table card: "Learners requiring attention" + count, toolbar (search, risk select, CLC
  select, "Clear filters" as a text button pushed right).
- Columns: Learner; Class (program + CLC, merges the old Program/CLC columns); Risk (merges
  Risk Score/Risk Level into the same badge+meter cell used by Student Registry); Alert (date
  + assigned teacher, each its own line with a small icon, merges Date Generated/Assigned
  Teacher); Status; Action (View profile + tooltipped Run prediction).
- Colspan/skeleton updated from 9 to 6.
- **Date bug fixed**: `date_generated` can be a full datetime
  (`assessment_date.isoformat()` → `"2026-09-20T10:15:00"`); appending another `T00:00:00`
  built an invalid `Date`. `formatDateMDY()` now slices to the first 10 characters first, and
  renders `Sep 20, 2026` (`en-US`, short month) instead of `MM/DD/YYYY`, falling back to "—"
  if still invalid. Verified: dates that previously rendered "Invalid Date" now render
  correctly; nothing is sent back to the server.

## Additional fixes from this request

**Double focus ring on Student Registry's search field.** The old markup nested `.st-search`
(a shared component with its own focus box-shadow) inside a filter bar that also drew a ring,
so focusing the field showed two concentric outlines. The new shared `.st-toolbar .st-search`
is a self-contained component with a single border/focus treatment; verified with a close-up
screenshot showing one clean teal ring.

**"Add class" button still looking old.** Root cause: the *global* `.st-btn`/`.st-btn-primary`
base in `components.css` was never updated during the earlier dashboard/CLC revisions —
it was still 44px tall, 4px corners, 16px text (the pre-revision spec), while every
page I'd already rebuilt had compensated by hardcoding the new 38px/8px/14px sizing on their
own purpose-built classes (`.st-clc-card-go`, `.st-card-icon-btn`, etc.), so the mismatch
only showed up on plain `.st-btn` buttons like "Add class". Fixed at the source: `.st-btn` is
now 38px tall, `0 16px` padding, 14px text, `var(--st-radius-control, 8px)` corners, with
icons inside sized to 19px — this is a **global change affecting every button in the app**,
not scoped to one page, since that's what actually needed fixing. Screenshotted Dashboard,
Calendar, CLC Overview, Class Management and Notifications afterward to confirm no layout
regressions (existing mobile full-width/44px overrides on specific pages are separate, more
specific rules and were untouched).

**Doubled section spacing on several pages ("Reports still isn't right").** Same root cause
as the `.st-page-header` margin-bottom bug found earlier this session, recurring in six more
places: a leftover `margin-bottom`/`margin-top` from before `.st-content`'s `gap: 20px` took
over spacing duties, now doubling up to ~36-52px. Found by sweeping every teacher and admin
page and measuring the actual gap between each direct child of `.st-content` via Playwright,
rather than checking pages by eye one at a time. Fixed by removing the leftover margin in each
case:
- `assessment-scores.css`: `[data-page="Assessment Scores"] .st-page-header { margin-bottom: 16px }`
- `notifications.css`: `.st-notif-toolbar { margin-bottom: 16px }` (shared, so this also fixed
  admin Notifications, which uses the same class)
- `reports.css` (teacher): `.st-report-grid { margin-top: var(--st-section-gap) }` (32px)
- `admin-clc-management.css` / `admin-user-management.css`: `.kpis { margin-bottom: 18px }`
  (each page defines its own `.kpis` independently, same bug in both)
- `admin-settings.css`: `.settings-tabs { margin-bottom: 18px }`

One more page flagged by the sweep turned out to be a false positive worth noting: admin
Reports' two `.st-report-master-panel` sections are deliberately reordered on screen via CSS
`order` (a `:has()` selector puts the submitted-reports panel first when present) without
matching DOM order, so a naive DOM-order gap measurement showed a nonsense 1040px/-1429px
"gap." Measuring by each panel's actual on-screen `top`/`bottom` instead confirmed both gaps
are a correct 20px — nothing to fix there.

## Verification

Logged in as a teacher (demo account) and checked Student Registry, Learner Records and
Early Warning at 1440/1280/390px — no horizontal scroll at any width, no table scroll at
1280px or wider.

- **Student Registry**: risk filter, both sort directions on Risk (icon flips
  `arrow_upward`/`arrow_downward`), pagination (page 2 shows "Showing 9–16 of 35"), Archive
  then Restore on the same row (icon swaps `archive`↔`unarchive`), single-ring search focus,
  bulk-select bar appearing/reading "N selected".
- **Learner Records**: arrived with a real `?class=&clc=` — banner appears, Manage modules
  un-hides, and Assessment scores/Import students/Enroll student all carry the query string
  through; arrived with no `?class=` — banner and Manage modules correctly stay hidden;
  switched to the Face-to-Face tab and opened the row menu on the last row of a page (not
  clipped, all 5 items visible including Set schedule/Record consultation).
- **Early Warning**: confirmed dates now read like "Aug 27, 2026" instead of "Invalid Date".
- **Reduced motion** (`reducedMotion: "reduce"` browser context): a table row's opacity is `1`
  immediately, no fade-in.
- **Regressions**: re-screenshotted Dashboard, Calendar, CLC Overview, Class Management and
  Notifications after the global `.st-btn` change and the six spacing fixes — no overflow, no
  visual breakage, and the "Add class"/"Preview & Export"/etc. buttons across the app now
  render at the consistent smaller size.
- A "Not Yet Assessed"/"Medium Risk" title-case text bug was also found and fixed along the
  way: the API sends a truthy literal string (`"Not Yet Assessed"`) for unassessed learners
  rather than null/empty, so the old `risk || "Not yet assessed"` fallback never actually
  fired — `riskBadge()` on all three pages now checks explicitly for High/Moderate/Low and
  falls back to sentence-case "Not yet assessed" otherwise.

## Round 2: Learner Records spacing and search icon (same session, follow-up report)

Two more bugs reported on Learner Records after the above landed: the gap between the CLC
context banner and the table card looked larger than everywhere else, and the search field's
magnifying-glass icon sat at the very top of the field instead of centered.

**Spacing (banner → table card measuring 44px instead of 20px).** Same leftover-margin
pattern as several other fixes this session: the shared `.st-class-context-banner` base rule
in `learner-records-hub.css` still had `margin-bottom: 24px` left over from before
`.st-content`'s `gap: 20px` took over spacing duties. Class Management has its own separate,
page-scoped banner (`clc.css`) that already zeroed this out when it was built, so only
**Learner Records and Module Management** — which both use the shared base rule directly —
were doubling up to 44px. Removed the leftover `margin-bottom` from the shared rule itself
(the true root, not a per-page patch), verified both pages now measure a clean 20px gap.

**Search icon sitting at the top of the field, not centered.** The new shared
`.st-toolbar .st-search` component (used by all three pages' toolbars) resets the icon's
`position` from the sitewide `.st-search`'s `position: absolute; top: 50%` centering trick
back to `static` so it can sit inline in a flexbox row instead — but the override didn't also
cancel that rule's `transform: translateY(-50%)`, which still applies to a statically
positioned element. The leftover transform then shifted the icon up by half its own height on
top of flexbox's own `align-items: center` centering, landing it flush against the top of the
field instead of centered. Added `transform: none` alongside the existing `position: static`
override. This was a shared-component bug, not specific to Learner Records — Student Registry
and Early Warning's search icons had the identical issue and are now fixed by the same change
(confirmed via computed geometry: icon is now equidistant, 10px, from both the top and bottom
of the 40px-tall field on all three pages).

Regression-checked Module Management (banner spacing) and Class Management (its own banner,
untouched) after these two fixes — both correct, no other changes.

## Round 3: missing risk strip on Student Registry and Early Warning Alerts

Both pages' summary cards were missing the colored proportional risk strip entirely — just
the total, a divider, and the legend items, with blank space where the bar should be. Root
cause: the shared `.st-risk-strip` component (dashboard.css) reveals via a `clip-path`
transition that only runs once its `[data-animate]` ancestor gets an `.is-inview` class —
on the dashboard that's added by an `IntersectionObserver` watching every `[data-animate]`
widget as the user scrolls. Student Registry's and Early Warning's `renderStats()`/
`renderSummary()` correctly set each segment's `flex-grow` and called `countTo()` on the
numbers, but never added `.is-inview` to anything, since neither page has that
`IntersectionObserver` wired up — so the strip stayed permanently clipped to 0 width
(`clip-path: inset(0 100% 0 0)`), confirmed via computed style before the fix.

Fixed by adding `.is-inview` directly in both `renderStats()`/`renderSummary()`, right after
the strip's `flex-grow`/`aria-label` are set. Unlike the dashboard's several scrollable
widgets, this summary card is always above the fold on page load, so there's no scroll
position to watch for — no `IntersectionObserver` needed, just the class add (double-`rAF`'d
so the 900ms reveal transition actually plays instead of snapping open instantly). Verified
via computed style (`clip-path: inset(0px round 999px)`, i.e. fully open) and screenshots on
both pages — the strip now fills left to right in the correct High/Moderate/Low(/Not yet
assessed) proportions and colors.

## Round 5: reconciling the Dashboard's Student Registry Summary widget

The Teacher Dashboard has its own separate embedded table, "Student Registry Summary"
(`components/dashboard/registry.html` + `dashboard.js`), distinct from the full Student
Registry page — flagged as visually inconsistent with the newly-revised page (plain Level
and Modality as two separate columns, a bare risk badge with no probability shown). After
discussion, landed on a narrow, specific fix rather than reconciling every column:

- **Left the widget's own columns as they are** (Learner, Learning level, Modality, Risk
  level, Latest activity, Actions) — no Status column added, and its Actions column (View
  profile + a plain "More options" icon button) stays deliberately different from the full
  page's (View profile + Run prediction + Archive/Restore), since the widget is a compact
  preview, not the full management surface.
- **Upgraded the Risk column** to the same badge + probability-percent + meter component
  used on Student Registry and Early Warning (`.st-risk-cell`), instead of a bare badge.
  Added a `riskCell()` helper to `dashboard.js` mirroring the other pages' version, and
  extended the shared `.st-risk-cell`/`.st-risk-meter` CSS scope (`learner-records.css`) to
  include `[data-page="Teacher Dashboard"]`.
- The probability meter's fill animation is gated on `[data-animate-rows].is-inview`, same
  as the other three pages, but this particular table isn't watched by the dashboard's own
  scroll `IntersectionObserver` (that only watches `[data-animate]` panels, and this table's
  wrapper never had that attribute). Rather than wiring it into that separate system, added
  `data-animate-rows` directly to the table body and toggled `.is-inview` right after each
  render in `renderRegistryPage()` — the same self-contained trigger pattern already used on
  Student Registry/Learner Records/Early Warning, so it doesn't depend on scroll position or
  the dashboard's animate-on-scroll timing.
- An earlier pass of this fix also added a Status column and a matching `statusPill()`
  helper to the widget before landing on the narrower scope above; removed both again
  (the helper and its would-have-been CSS scope extension) rather than leaving dead code
  behind once Status was dropped from the plan.

Verified via screenshot at 1440px and 390px: the widget's risk column now shows the meter
and percentage matching the other pages' visual language, no horizontal overflow at either
width, and the full Student Registry page's own risk cells are unaffected (re-screenshotted
to confirm no regression from widening the shared CSS selector's scope).

## Round 6: header tooltips for non-obvious columns

Added a small info icon (Material Symbols `info`, faint gray, hover/focus turns navy) next
to column headers whose meaning isn't obvious at a glance, reusing the `[data-tip]` tooltip
component already built for icon-only row buttons:

- **Student Registry**: "LRN" ("LRN: Learner Reference Number, a unique ID issued to each
  learner.") and "Risk" (the same risk description below).
- **Learner Records**: "Modules" ("Number of learning modules the learner has returned, out
  of those released to them.") and "Risk", on all three modality tabs (Modular,
  Face-to-Face, Blended each have their own `<thead>` with identical columns).
- **Early Warning Alerts**: "Risk" and "Alert" ("When this alert was generated, and the
  teacher it's assigned to.").
- **Risk description** (all four spots): "Predicted likelihood of dropping out, based on the
  learner's latest risk assessment."

Each icon is keyboard-focusable (`tabindex="0"`, `role="img"`, matching `aria-label`), so the
tooltip is reachable without a mouse, not just on hover.

**Bug found and fixed while verifying:** header tooltips initially opened *upward* (matching
the row-button tooltip direction) and got silently clipped, because a header cell sits right
at the top edge of `.st-table-card`, which has `overflow: hidden` for its rounded corners —
an upward-opening tooltip there has nowhere to render into and gets cut off entirely
(confirmed via screenshot: only a sliver of the tooltip's top edge was visible). Fixed by
giving header tooltips their own rule that opens *downward* instead (`top: calc(100% + 8px)`
instead of `bottom: calc(100% + 6px)`, sliding down into place rather than up) — this also
reads more naturally for a header, since the description explains the column of rows sitting
right below it. Row-button tooltips (Run prediction, Archive, etc.) are unaffected — they're
a separate, unchanged rule and don't sit at that same clipped edge.

Verified via computed style + screenshots on all three pages: every tooltip now renders
fully readable with none of its text or box clipped, and confirmed hidden on touch/mobile
widths (existing `[data-tip]::after { display: none }` rule under 768px already covers the
new header icons too, since they use the same `[data-tip]` attribute).

## Round 4: the summary card had no internal padding at all

Still visibly off from the prototype after the strip fix: the card's rounded border sat right
up against its own content on every side, with none of the prototype's comfortable inset. Root
cause: on the real, already-working Teacher Dashboard, `.st-overview` is never used alone —
its actual markup (`components/dashboard/statistics.html`) wraps it in a **separate** outer
`<div class="st-panel st-panel-pad" data-animate>`, and `.st-panel-pad` (a small reusable
utility class, `padding: 20px 22px` / `16px` on mobile) is what supplies the padding.
`.st-overview` itself has never had any padding of its own — only `display: grid` and the
column/gap layout. My markup for both pages combined `.st-panel` and `.st-overview` onto one
`<section>` but never included `.st-panel-pad`, so there was no padding source at all.

Fixed by adding `st-panel-pad` alongside the existing classes on that one `<section>`
(`class="st-panel st-panel-pad st-overview"`) on both pages, rather than restructuring into
the two-element nesting the dashboard uses — same visual result, and keeps the existing
`.st-overview[data-animate]` JS selector working unchanged. Verified via computed style
(`padding: 20px 22px`, matching the dashboard's own card exactly) and screenshots at
1440/390px on both pages — comfortable inset on every side now, matching the prototype;
re-checked the header-to-card and card-to-table gaps are still a clean 20px/16px (this fix
only touched the card's own inner padding, not outer spacing).

## Round 7: unifying the row-actions menu, reworking columns across all three tables

A larger follow-up request, reversing Round 5's "leave the widget's columns alone" decision:
unify the Actions column into a single "View profile" + ⋮-menu (Run prediction/Archive) pattern
across **all three tables** (Student Registry, Early Warning, and the Dashboard's Student
Registry Summary widget), then rework each table's columns to close the remaining gaps between
them.

**Row-actions menu, now identical on all three tables.** Extended Learner Records' existing
`.st-row-menu` floating-popup component (trigger button + fixed-position dropdown, already
built in Round 1) to Student Registry and the Dashboard widget, replacing their old inline
icon buttons (a bolt/flash icon for Run prediction, a plain archive icon) with the same
"View profile" button + ⋮ trigger opening a two-item dropdown (Run prediction, Archive/Restore
with icon + label). Added the open/close/position delegation logic (`document` click listener
+ `window` scroll listener, positioning via `getBoundingClientRect()`) to both
`student-registry.js` and `dashboard.js`, mirroring `learner-records-hub.js`'s existing version.
The Dashboard widget gained two entirely new methods it didn't have before, `runRegistryPrediction()`
and `archiveRegistryLearner()`, since "Run prediction"/"Archive" weren't previously exposed there.

**Student Registry**: removed the "Filter"/"Sort: Risk Level" buttons (the Filter button had no
click handler at all — dead markup); replaced them with the same Learner/LRN and Risk sortable
column-header pattern already used elsewhere, plus a "Clear filters" button in the same
placement as Early Warning's. Split the combined "Level & modality" column back into two plain
columns, added a colored modality pill (was a plain gray pill) using the previously-unused
`--st-cat-1/-2/-3` navy/teal token ramp so modality never reads as a risk color, and added a
new "Latest activity" column to match the Dashboard widget.

**Early Warning Alerts**: removed the Action column (View profile now lives in the row, same as
the other two tables) and the Status column (redundant with Student Registry). Split "Class"
back into separate Level/CLC columns and "Alert" back into separate Date generated/Assigned
teacher columns, placed after Risk. Removed the now-dead `runPrediction()` method and its
`predicting` state field, since that action moved into the row menu.

**Dashboard widget**: Learner/LRN merged into one sortable header cell (two `.st-sort-btn`s
separated by a `/`, matching Student Registry exactly) in place of the old single "Sort" button;
removed the dead Filter button here too. Level and Modality split into their own columns with
the same colored pills. An earlier pass of this same round added a Status column to the widget
to further match Student Registry, then removed it again per a follow-up correction — the widget
keeps no Status column, consistent with Round 5's original "compact preview" reasoning even
though its Actions menu is now unified with the other two tables.

**Table-width fitting.** Adding columns back (Student Registry: +2, Dashboard widget: net
column-count unchanged but Learner/LRN merge freed width for Latest activity) pushed both
tables past the session's standing "no horizontal scroll at 1280px+" rule. Fixed iteratively via
Playwright `scrollWidth`/`clientWidth` measurement, tightening cell padding and capping specific
columns with `max-width` + ellipsis:
- Student Registry: 14px cell padding (10px at ≤1366px), `Latest activity` capped 145px/65px,
  `Level` capped 75px and `Modality` 100px at ≤1366px only. Confirmed exact-fit at both 1440px
  and 1280px, and confirmed via screenshot the truncation reads as intentional ellipsis, not
  cut off mid-word.
- Early Warning: 12px cell padding at ≤1366px was enough on its own (6 columns, no column caps
  needed) — found and fixed a real overflow (`Assigned teacher` running off the right edge at
  1280px, not caught until this round's fresh measurement pass) that the earlier column-split
  hadn't accounted for.
- Student Registry's Learner/LRN column has no hard cap on real data length (name + LRN +
  gender/age), so its width — and therefore the whole table's fit — silently depended on
  which names happened to be on the current page; the very first "exact fit" measurement
  turned out to be a coincidence, not a guarantee, and a later re-measurement with different
  data overflowed by 9px. Fixed properly by capping the column (225px) and ellipsis-truncating
  the name/LRN text, so the fit no longer depends on data content.

**Bug found and fixed: the `@media (max-width:1366px)` column-cap block had no lower bound**,
so its 75px `Level` cap (meant only for the narrower desktop/tablet table layout) was also
silently active at mobile widths, where the same column becomes half of a stacked card row with
much more room — over-truncating "Basic Literacy" down to "Basi…" on a 390px screen where it
would otherwise fit on one line. Fixed by bounding the block to `(min-width:768px) and
(max-width:1366px)`, matching the point where the layout actually switches to the stacked card
pattern.

**Investigated and ruled out as a false alarm:** the row-menu appeared to fail to open roughly
half the time under Playwright's simulated `.click()`, closing itself immediately after opening.
Traced to Playwright's actionability check performing its own scroll-into-view immediately
before dispatching the click, which (for real browser reasons, not app code) sometimes fires a
genuine native `scroll` event on the table's scroll container — caught by the existing, correct
"close the menu on scroll" listener (`window.addEventListener("scroll", ..., true)`, capture
phase reaches nested scrollable ancestors), closing the menu that was just opened by the same
gesture. Confirmed via a native `element.click()` (bypassing Playwright's actionability
machinery) that the menu opens and stays open reliably — this is specific to how Playwright
drives clicks, not something an actual mouse click would trigger, so no code change was made.

Verified end-to-end via Playwright: Student Registry's Clear filters button resets
search/level/risk/status and re-queries; the Dashboard widget's Run prediction (503 from the
prediction service in this dev environment — surfaced correctly as a toast, not a silent
failure) and Archive (`PUT /api/learners/:id` → 200, row updates in place) both wired correctly;
the dashboard's existing chart filters (Level/Modality/CLC/School year selects + "Apply
filters" button) still correctly cascade into the widget's row set (35 → 6 learners when
filtering to Modular, confirmed by checking every visible row's modality); no horizontal
overflow on any of the three tables at 1440/1280/390px.
