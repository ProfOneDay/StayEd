# StayEd — CLC Overview + Class Management UI revision (2026-09-26)

Revised **CLC Overview** and **Class Management** to match the approved prototypes in
`design/teacher-clc-and-classes/`, plus a small typography fix on the Calendar page
flagged in the same request. Frontend-only, presentational — no API, guard, modal-logic,
or localStorage-key changes. None of this is committed to git yet.

## Files changed

- `StayEd_Frontend/assets/css/pages/teacher/clc.css` — rebuilt the shared card, grid,
  summary strip, search row, empty state, and CLC context banner styling for these two
  pages; removed the superseded unscoped rules they replaced.
- `StayEd_Frontend/pages/teacher/clc-overview.html` — new summary strip markup
  (`.st-clc-summary`), borderless search row, `data-animate-cards` on the grid.
- `StayEd_Frontend/assets/js/teacher/clc-overview.js` — rewrote `card()`, `render()`,
  added a local `countTo` count-up helper and the settle-in animation toggle.
- `StayEd_Frontend/pages/teacher/class-management.html` — new banner kicker span,
  reordered Switch CLC icon+label, `data-animate-cards` on the grid, "Add class"
  label sentence-cased.
- `StayEd_Frontend/assets/js/teacher/class-management.js` — rewrote `card()`,
  `render()`, `renderNoClcSelected()`; added the same local `countTo` helper; moved the
  Add Class modal's inline note style into a class.
- `StayEd_Frontend/assets/css/pages/teacher/calendar.css` — one-line fix for the day
  panel's Actions buttons rendering in Arial instead of Inter (see below).

## Shared card (`.st-clc-card`, both pages)

Rebuilt per the prototype: dropped the icon tile that repeated the same building/book
icon on every card with no information; white card, `--st-line` border, 12px radius,
card shadow, hover raises border/shadow only (never clickable itself). Footer now holds
a full-width **"View classes" / "Open class" row button** (`.st-clc-card-go`) instead of
a solid navy block — arrow nudges 3px on hover, navy-soft tint, 0.98 press scale.

All of this is scoped under `body[data-page="CLC Overview"]` / `body[data-page="Class
Management"]`, even though no other page currently uses `.st-clc-card*`/`.st-clc-grid`,
per the revision brief's "scope everything" rule.

## CLC Overview

- **Summary strip** (`.st-clc-summary`): replaces the old two floating stat boxes and
  the loose municipality paragraph with one three-column card — CLC count, total
  learners, and the teacher's municipality (still read-only; the label shortens to
  "CLCs" on mobile via a long/short span pair). All three `data-` hooks
  (`data-clc-count`, `data-clc-learners`, `data-clc-municipality-name`) kept.
- **Search row**: `.st-filter-bar` is now transparent/borderless on this page only; the
  search field is 360px/40px with a navy hover border and teal focus ring. Reusing the
  shared `.st-search` class here needed two extra overrides (un-absolutizing its icon,
  resetting the input's inherited height/padding) — see "Bug fixed along the way" below.
  Dropped the `analytics` icon next to "Showing N…" per the brief.
- **Card**: pill is sentence-case ("Active") on a teal-soft background with a dot,
  non-active statuses get the neutral gray pill; figure shows total learners +
  "School year" (en dash, or "Not set" in faint gray when empty); the four fake teacher
  initials (`AR`/`MC`/`JD`/`LP`) are gone, replaced by a single "N assigned teachers"
  line (with a person icon) only when `clc.teachers > 0`.

## Class Management

- **CLC context banner**: solid navy block → white bar with a 4px navy left border,
  navy-soft icon tile, a new "Community Learning Center" kicker line above the name,
  and **Switch CLC as an outline button** (`swap_horiz` icon first) instead of a small
  underlined link — same `href`. Base `.st-class-context-banner*` rules in
  `learner-records-hub.css` (shared with Learner Records and Module Management) were
  left untouched; every override here is scoped to `body[data-page="Class Management"]`.
- **Card**: dropped the location line (redundant — every card already belongs to the
  CLC named in the banner above it); SY pill is the neutral style since a school year
  isn't a status; footer is now Open class (primary, fills remaining width) + Attendance
  (outline, `.st-card-icon-btn`, `checklist` icon + visible "Attendance" label, label
  hides under 768px leaving a 44px square) + Delete (40px outline square, turns red on
  hover). These use the new `.st-card-icon-btn` class, not the shared `.st-icon-btn-sm`.
- **Add class modal**: logic and fields untouched; only moved the "(set by your
  administrator)" note's inline `style` into `.st-clc-modal-note`.

## Motion

`data-animate-cards` on both grids: cards fade in + rise 8px, staggered 50ms per card
via `style="--i:N"`, toggled by adding `.is-inview` on the next animation frame after
`innerHTML` is set (matching the prototype's double-`requestAnimationFrame` pattern).
Summary numbers and each card's main count animate via a small local `countTo` helper
in each page's own JS file (no shared helper file exists yet to reuse). Both respect
`prefers-reduced-motion: reduce` — verified via a reduced-motion browser context that
cards render at full opacity immediately with no transition.

## Bugs found and fixed along the way

**Empty states were invisible.** `render()` (and `renderNoClcSelected()`) set the
grid's `innerHTML` to the empty-state markup, then `return`ed before re-triggering the
`.is-inview` toggle on `[data-animate-cards]`. Since that attribute's CSS keeps every
direct child at `opacity:0` until `.is-inview` is added, the "No CLCs found" and "No
classes yet" states rendered but stayed permanently invisible — a real regression I
introduced while adding the settle-in animation, not present in the prototype (which
always re-triggers `.is-inview` regardless of branch). Fixed by restructuring both
`render()` methods to branch on content but always fall through to the same
animate/count-up tail, matching the prototype.

**`.st-clc-search-wide` fighting the shared `.st-search` class.** CLC Overview's search
field carries both `.st-search` (the shared component in `components.css`, which
absolutely-positions its icon and sets the input's own height/padding directly) and the
new `.st-clc-search-wide` (which, like the prototype, expects the icon to sit inline in
a flex row). Since my scoped rule didn't touch those two properties, the global rule's
44px input height and 48px icon-reserving padding would have leaked through underneath
my 40px-tall wrapper. Added explicit overrides (`position:static` on the icon,
`height:100%`/`padding:0` on the input) scoped to this page only.

**Calendar day panel typography** (flagged separately as "Additional" in the same
request): the "Record attendance" / "Set module release date" buttons in the day
panel's Actions section were rendering in Arial at 16px instead of the site's Inter,
confirmed via computed style (`font-family: Arial` vs. `Inter, sans-serif` on the rest
of the panel). Root cause: `<button>` elements don't inherit `font-family` from the
body by default — the browser's own stylesheet sets it — so any button without an
explicit `font-family` falls back to a system font. This is the same bug class as the
`.st-attention-row` fix earlier in this project (dashboard.css). Fixed with one explicit
`font-family: var(--st-font-body);` on `.st-cal-day-panel-actions .st-btn`.

## Verification

Logged in as a teacher (demo account) and checked at 1440/820/390px — no horizontal
scroll at any width. Data used was the seeded demo CLC set (6 CLCs, including two with
0 learners and "Not set" school years, matching the prototype's sample data almost
exactly).

- CLC Overview: search with a match ("san felipe" → 2 results), no match (empty state
  now renders correctly, see bug above), and cleared back to all 6; View classes on a
  card correctly set `stayed_last_teacher_clc` and navigated to
  `class-management.html?clc=<name>` with the right CLC shown in the banner.
- Class Management: Add class modal opens with the CLC/level/school-year fields intact;
  Delete opens the existing confirm modal unchanged; Take attendance opens
  `ClassAttendanceModal` unchanged (only present on the class with F2F learners); Switch
  CLC navigates back to CLC Overview.
- Reduced motion (`reducedMotion: "reduce"` browser context): first card's opacity is
  `1` immediately on load, no settle-in transition.
- Regression check at 1440px on Student Registry, Learner Records, Module Management,
  Notifications, and Dashboard — all render exactly as before; none of the shared
  classes called out in the brief (`.st-records-stat*`, `.st-class-context-banner*`
  base rules, `.st-empty` elsewhere, `.st-filter-bar`/`.st-search` on other pages,
  `.st-icon-btn-sm`) changed appearance.
- Calendar: re-verified computed `font-family` on both Actions buttons now reads
  `Inter, sans-serif`, matching the rest of the day panel; screenshotted to confirm
  visually.
