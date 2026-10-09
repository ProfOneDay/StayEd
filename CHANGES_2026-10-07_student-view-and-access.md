# Student View Redesign + Per-Class LRN Access — 2026-10-07

Two parts: Part A redesigns the public Student View page to match the
`student-view-prototype.html` reference. Part B replaces the old
per-student copy-link sharing with a per-class toggle plus a new public
"look up my report with my LRN + birthdate" page, backed by a new rate
limited backend endpoint.

## Part A — Student View redesign

- `pages/student/view.html` — rewritten around a sticky top bar (dark logo
  + "Student view · read-only" chip), a 1200px-wide centered
  `st-student-body`, and a slim footer. Only loads `variables.css` +
  `components.css` + `student-portal.css` — no `main.css`, no app chrome.
  Same `data-student-body`/`data-student-loading` hooks.
- `assets/js/student/portal.js` — rewritten render methods under the new
  `.st-sv-*` namespace: `renderHero()` (76px avatar + risk-tinted ring + 4
  meta tiles), `renderRiskCard()`, `renderCounts()`, a rebuilt
  `renderPerformanceProgress()` (plot box + dashed gridlines + outside %
  labels + `vector-effect="non-scaling-stroke"` + HTML dot overlay instead
  of the old cropped/wrapped date labels), and `renderModulesSection()`
  (My Modules grouped by release date, 2-col grid, left-border + icon +
  status pill). Extracted a shared `statusOf()` helper (returned → overdue
  → dueSoon → pending — same priority as before) used by both
  `renderCounts()` and `renderModuleRow()` so they can't disagree. Same
  `GET /public/student-view/:token` call, same token handling, same
  `esc()` escaping on every interpolated value.
- `assets/css/pages/student/student-portal.css` — rewritten `.st-sv-*`
  styles: cards settle in on load, chart line reveals via `clip-path`
  (not a dash animation), area fades in, dots pop, bar fills, module cards
  lift on hover; all gated behind `@media (prefers-reduced-motion: reduce)`.
  Full responsive breakpoints at 1023px/767px. Uses the app's real
  `--st-*` tokens throughout instead of inventing local shorthand ones.
- `assets/css/components.css` — the shared `[data-tooltip]`/`[data-tip]`
  exclusion list referenced the old class name
  (`.st-student-progress-point`); updated to `.st-sv-pt` to match the
  renamed chart-point class.
- `renderUnavailable()` now includes a "Look up my report with my LRN"
  button linking to the new `access.html` (Part B).

## Part B — per-class share toggle + LRN/birthdate access page

**Why per-class, not per-student:** the old design put a copy-link toggle
on every individual Learner Profile. Moved to one toggle per class in
Learner Records (Class Management), since a teacher turns student
visibility on/off for a whole class at once in practice. The student side
no longer needs a link at all — they just enter their own LRN.

**Why LRN + birthdate, not LRN alone:** an LRN is printed on school IDs
and report cards and is knowable to classmates/relatives, so by itself
it's too weak a key to gate a minor's name and risk status behind. Adding
birthdate (something the learner also already knows, no new credential to
distribute) raises the bar without requiring an account.

### Database

- `sql/35_class_portal_share.sql` — adds
  `learning_class.portal_share_enabled boolean not null default false`;
  drops the now-redundant `learner.portal_share_enabled` (the per-learner
  flag superseded by the class-level one). `learner.portal_share_token` is
  kept — now just a token, no longer self-gating.

### Backend (`app/routes/learner_routes.py`)

- `GET/PUT /classes/:id/portal-share` (teacher-only, ownership-checked)
  replace the old `GET/PUT /learners/:id/portal-share`. Turning a class on
  backfills a `portal_share_token` for every enrolled learner that doesn't
  already have one.
- `public_student_view(token)`'s gate query now joins
  `learner → class_enrollment → learning_class` and checks the class's
  flag (most recent enrollment wins), instead of a flag on the learner row.
- Extracted `_portal_sharing_allowed(teacher_id)` (checks the existing
  teacher-level "Allow student view links" master switch in
  `users.preferences`) so both `public_student_view` and the new lookup
  endpoint share one code path.
- New `POST /public/student-lookup` — body `{ lrn, dateOfBirth }`. Matches
  on exact LRN + birthdate, requires the learner's current class to have
  sharing on and the teacher's master switch on, and returns `{ token }`
  (reusing/creating the learner's `portal_share_token`). Every failure
  case (bad input, no match, sharing off) returns the identical generic
  404 message so the endpoint never reveals which case applies:
  "We couldn't open a report for this LRN. Check the number, or ask your
  teacher to turn on your student view." Rate-limited per IP (5 attempts /
  10 minutes, in-process sliding window) with failed attempts logged;
  over the limit returns 429. The in-process limiter isn't shared across
  worker processes — acceptable for the app's current single-process
  deployment.

### Frontend — toggle relocation

- Removed the per-learner toggle + copy-link card from
  `pages/teacher/learner-profile.html` / `learner-profile.js` /
  `learner-profile.css` entirely (`bindPortalShare()`, `loadPortalShare()`,
  `renderPortalShare()` and the markup block all deleted).
- Added the same card (same class names, reworded copy) to
  `pages/teacher/learner-records.html`, right after the existing class
  context banner and gated by the same "a class is selected" condition
  (`learner-records-hub.js`'s `loadClassContext()`). New
  `bindClassPortalShare()` / `loadClassPortalShare()` methods wire the
  toggle to the new `/classes/:id/portal-share` endpoints.
- `assets/js/core/api.js` — `getPortalShare`/`updatePortalShare` renamed to
  `getClassPortalShare`/`updateClassPortalShare`, now hitting
  `/classes/:id/portal-share`.
- `assets/css/pages/teacher/learner-records-hub.css` — new
  `.st-portal-share-card` block (ported from the removed
  `learner-profile.css` rules).

### Frontend — new access page

- `pages/student/access.html` (new) — standalone public page, two-column
  desktop layout (navy pitch panel left, form card right; stacks on
  mobile ≤900px). Form: auto-grouped 12-digit LRN field
  (`#### #### ####`) with a 0/12 counter that turns teal at 12, a native
  date-of-birth field, a disabled-until-valid "View my report" button, a
  `role="alert"` error box with a shake animation, a lock note explaining
  the teacher-switch requirement, and a "Sign in here" link to
  `pages/auth/login.html` for staff who land here by mistake.
- `assets/css/pages/student/student-access.css` (new) — `.st-sa-*`
  namespace, matching the token conventions used elsewhere (real
  `--st-*` custom properties, not locally duplicated values).
  `@media (prefers-reduced-motion: reduce)` disables the entrance/shake
  animations.
- `assets/js/student/access.js` (new) — digit-only LRN normalization +
  grouping, submit-button gating, loading-spinner state,
  `POST /public/student-lookup` via raw `fetch()` (same unauthenticated
  pattern as `portal.js`), redirect to `view.html?token=...` on success
  (the LRN itself never appears in the URL).

## Verification

- `py_compile` + live curl against the real dev DB (native Postgres,
  port 5433 — not the unused `stayed-postgres` Docker container):
  - Valid LRN + birthdate with class sharing on → `{ token }`, and that
    token resolves via `GET /public/student-view/:token`.
  - Valid LRN + wrong birthdate → generic 404, same message.
  - Malformed LRN / missing birthdate → generic 404, no 500.
  - 6th request within 10 minutes from the same IP → 429.
  - `GET /classes/:id/portal-share` without auth → 401 (route correctly
    gated).
- `node --check` on every edited/new JS file; brace-balance and div-balance
  checks on every edited/new CSS and HTML file.
- Not done: no browser/visual pass in this session (no browser automation
  tool available here) — recommend eyeballing `access.html` and the
  redesigned `view.html` at 1440px/1024px/390px before shipping, and
  walking the LRN+birthdate → redirect → report flow by hand in a browser.
