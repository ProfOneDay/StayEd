# StayEd — Session Summary (2026-09-25)

Applied the dashboard/calendar design system's page header, spacing, and card styling
site-wide, across every teacher and admin page, instead of scoping it to individual pages.
Frontend-only, presentational — no flow, click-handler, or data changes. File paths are
relative to the repo root. None of this is committed to git yet.

## Header, spacing, cards — applied globally

Earlier revisions (teacher dashboard, teacher calendar) intentionally scoped their new page-title
size, `.st-content` spacing, etc. to just those two pages, to avoid touching the rest of the app.
This session removes that scoping and moves the new values into the shared rules in
`assets/css/layout.css` and `assets/css/components.css`, so every page that uses the standard
`.st-page-header`/`.st-content`/`.st-card` markup picks it up automatically — no per-page CSS
needed.

**`assets/css/layout.css`:**
- `.st-page-header-title`: 26px navy 700 → **30px Libre Franklin 800, near-black ink,
  -0.02em letter-spacing** (24px on mobile), matching the dashboard/calendar prototype.
- `.st-page-header-subtitle`: now 15px muted with a 640px max-width (14px on mobile).
- `.st-page-header`: `align-items` changed from `center` to `flex-end`, so a header's title+subtitle
  block and any action button/search field on the right share the same bottom alignment.
- `.st-content`: padding changed from a flat `40px` to `24px 32px 40px`, and the gap between the
  header/filters/panels tightened from `32px` to `20px` (`16px 16px 32px` / `16px` gap on mobile)
  — this was the main source of the "inconsistent spacing" report, since only the dashboard had
  been tightened before.

**`assets/css/components.css`:** `.st-card` (used by `learner-profile.html`) now uses the same
radius/shadow/border tokens as `.st-panel` (12px radius, the softer two-layer shadow) instead of
its old 5px radius and heavier drop shadow.

**Cleanup:** removed the now-redundant page-scoped `.st-content`/`.st-page-header-title`
overrides from `dashboard.css` and `calendar.css`, since their values are now identical to the
new shared defaults.

**Footer:** already consistent site-wide from the earlier dashboard revision — every teacher and
admin page loads it via the same `data-component="layout/footer"` include and the shared
`.st-footer` rule in `layout.css`, confirmed by screenshot on both a teacher and an admin page.
The Admin Dashboard's own footer/header overrides (see below) are a deliberate exception, not a
missed page.

### Deliberate exception left alone
`pages/admin/dashboard.html` has its own scoped CSS (`admin-dashboard.css`) that fits its map +
stats layout into one viewport with no scrolling — a pre-existing, intentional design documented
in that file. Its page title already inherits the new Libre Franklin/800/near-black styling from
the shared rule (confirmed via computed style), it's just kept at the smaller 26px size and
single-row layout that the no-scroll constraint requires. Not changed further, to avoid
reintroducing scroll on that page.

### Bug fixed along the way
`clc-overview.html`'s filter row (`.st-clc-filter-row`, built on the shared `.st-filter-row` grid)
has an `auto`-sized last column for its "Showing N Community Learning Centers" indicator. At
mobile widths that column doesn't shrink or wrap, so the indicator overflowed past the viewport
(pre-existing, unrelated to this session's other edits — found while re-checking mobile widths
after the spacing change). Fixed with a `max-width:640px` media rule in `clc.css` that stacks the
row to one column and lets the indicator wrap on narrow screens.

## Verification done this session

Logged in and screenshotted at 1440px: `clc-overview.html`, `learner-records.html`,
`early-warning.html`, `reports.html`, `dashboard.html`, `calendar.html` (teacher), and
`admin/dashboard.html`, `admin/reports.html`, `admin/settings.html`, `admin/user-management.html`
(admin) — headers now render at the consistent 30px Libre Franklin weight/size, spacing between
header/filters/panels is visually consistent, and the footer matches across every page checked.
Re-checked the dashboard and calendar pages specifically for regressions from the shared-rule
change — pixel-identical to before. Checked mobile (390px) on a newly-affected page
(`clc-overview.html`) and found + fixed the pre-existing overflow bug above; re-verified clean
afterward.

### Not yet independently re-verified this session
- Every remaining teacher/admin page beyond the ones listed above (e.g. notifications,
  profile-settings, class-management, module-management, CLC/user management forms) — spot-check
  recommended, though the change is a shared-rule value update with no structural changes, so risk
  is low.
- Pages with a fully custom header layout instead of `.st-page-header-title`/`-subtitle` (e.g.
  `admin/settings.html`'s "Settings" header) were left as-is — they don't use the shared classes,
  so this pass didn't touch their typography; flagging in case that's also expected to change.

---

## Round 2: header-to-content spacing bug, and unifying every data table

### Header spacing bug (Calendar and others)
`.st-page-header` still had a leftover `margin-bottom: 24px` from before `.st-content`'s `gap`
took over spacing duties. That doubled up with the new 20px gap (44px total) on every page that
uses `.st-page-header` — the dashboard didn't show it because its greeting block
(`.st-welcome`) is a different element with no margin-bottom of its own. Removed the
margin-bottom; every `.st-page-header` page now gets the same 20px gap as the dashboard.

### Tables unified across the system
The teacher dashboard's registry table restyle (14px body text, 12.5px headers, small pills,
outline "View profile" button) had been scoped to `body[data-page="Teacher Dashboard"]` only, as
a defensive fix for a leak from another page. That defensive scoping had a side effect: `.st-data-table`,
`.st-learner-name`, `.st-pagination`, `.st-page-btn`, `.st-btn-xs`, `.st-icon-btn-sm` and
`.st-row-actions` are actually shared components used by Learner Records, Student Registry, Early
Warning, Learner Import, admin Reports, and more — so scoping the new look to just the dashboard
left every other table still rendering the old, larger, unstyled version.

**`assets/css/pages/teacher/dashboard.css`:** un-scoped those rules (kept in this file, since it
already hosts several other shared classes like `.st-panel`/`.col-*`, but no longer prefixed with
`body[data-page="Teacher Dashboard"]`), so the table styling now applies everywhere.

**Reconciled per-page overrides** that were fighting the new sizing at equal specificity +
later load order:
- `learner-records.css`: removed `.st-data-table th/td` and `.st-learner-name-link` from a shared
  16px-text selector list (was overriding the table back to the old size).
- `admin-reports.css` (`.st-report-table-wrap .st-data-table th/td`) and `module-management.css`
  (`.st-panel[data-catalog-panel] .st-data-table th/td`): these use a more specific selector than
  the shared rule, so updating the base alone didn't reach them — changed their literal font-sizes
  to the same 12.5px/14px scale directly.

**`pages/admin/clc-management.html` and `user-management.html`:** their tables had no
`.st-data-table` class at all (relying on old, unscoped bare `table`/`thead th`/`tbody td` rules
from that page's own CSS) — added the class so they pick up the shared styling too. Their
surrounding page chrome (the custom `.card`/`.toolbar`/`.pagination` wrapper classes) is a
different, older component system from the rest of the app; restyling that is a larger, separate
job and was left alone this round.

**`student-registry.js` / `early-warning.js`:** their "View Profile" buttons used
`st-btn-primary` (solid); changed to `st-btn-outline` to match the dashboard registry's button
weight for the same action. Risk/status pills in both files already used the shared
`.st-pill`/`.st-risk-badge` classes, so they picked up the new smaller sizing automatically once
scoping was removed — no JS change needed for those.

Mobile card-stacking behavior for `.st-data-table` (the dashboard's own `[data-col]`-based
mobile layout) was deliberately left scoped to the dashboard, since other pages' tables may
already have their own mobile handling (e.g. horizontal scroll) that a blanket change could
disrupt without per-page verification.

### Verification
Re-checked `learner-records.html`, `student-registry.html`, `early-warning.html`,
`admin/clc-management.html`, `admin/user-management.html`, `admin/reports.html` at 1440px —
table text, pills, avatars, and pagination now match the dashboard's scale and look consistent
across all of them. Re-checked `calendar.html` and `dashboard.html` for the spacing fix and for
regressions from the table un-scoping — both correct, dashboard's own registry table unchanged.
Checked mobile (390px) on `admin/user-management.html` — no horizontal overflow.

### Not yet independently re-verified
- `learner-profile.html`, `learner-import.html`'s own tables (both use `.st-data-table` with no
  conflicting overrides found, so they should already pick up the new styling, but weren't
  individually screenshotted).
- Mobile-width tables beyond the one spot-check above.
