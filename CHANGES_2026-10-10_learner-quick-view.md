# Learner Quick-View Modal — 2026-10-10

Added a learner quick-view modal to the teacher pages per
`design/learner-quick-view/learner-quick-view-prototype.html`: clicking a
learner's avatar or name now opens a preview of their profile instead of
leaving the page. Frontend only — uses the existing
`API.getLearnerProfile(id)` (`GET /learners/:id/profile`), no backend
changes.

## Shared component (new)

- `assets/js/core/learner-quick-view.js` — `LearnerQuickView`: builds one
  global overlay lazily on first open, a delegated `document` click
  handler for `[data-learner-preview]`, a session `Map` cache keyed by
  learner id, a request-token guard so a stale fetch can never overwrite a
  newer one, skeleton/profile/error render states, focus trap + Escape +
  backdrop-click + scroll-lock, and focus restore to the trigger on close.
- `assets/css/components/learner-quick-view.css` (new directory) —
  `.st-qv-*` styling: centered 680px dialog on desktop, a bottom sheet
  under 768px, risk-tone CSS variables (`--rc`/`--rs`/`--ri`/`--ring`) set
  per `.st-qv.is-high/-moderate/-low/-preliminary/-neutral`, sourced from
  the shared `--st-risk-*` tokens in `variables.css` — the same pattern
  `.st-sv-risk.is-high` already uses on the student portal page. Imported
  from `main.css` right after `layout.css`, as shared cross-page CSS.
- Field mapping notes: the real risk model only emits
  High/Moderate/Low/"Not Yet Assessed" (confirmed in
  `_shape_learner`/backend) — there is no "Preliminary" state in the
  teacher-facing data today. Kept the Preliminary tone/icon defined
  anyway (matching `assets/js/student/portal.js`'s own defensive
  Preliminary handling) since it's harmless and the prototype calls for
  it; it just won't currently be reachable from real data. Risk % comes
  from the newest `riskTrend[].probability`; the block hides itself when
  that's null. Risk helper sentence and High-risk recommendation-title
  override mirror `learner-profile.js`'s `renderHero()` exactly. Factor
  tone→color mapping mirrors `learner-profile.js`'s contributor-card
  mapping (error→high, moderate→moderate, everything else→low — the
  modal's factor pill only has 3 color variants, like the prototype's).
  The active intervention shown is `interventions.activeList[0]` (not the
  singular `interventions.active`), since only `activeList` entries carry
  `dueStatus` for the Overdue/Due Today/Due Soon pill.

## Wired into 5 pages

Each page's avatar+name are now one `.st-qv-trigger[data-learner-preview]`
button; every other existing control (View profile buttons, row-menu
items, Assign intervention, etc.) is untouched and still navigates
straight to `learner-profile.html` as before.

- `assets/js/teacher/dashboard.js` — **Recent High-Risk list**: the row
  used to be one big button navigating directly; split into a plain grid
  div containing the new quick-view trigger (avatar+name) and a second
  small button that keeps the original `data-attention-learner` direct-
  navigate behavior over just the risk%/meter portion (new
  `.st-attention-trigger`/`.st-attention-risk-btn` CSS in `dashboard.css`
  recreates the original 3-column layout across the two buttons).
  **Student Registry Summary table**: avatar+name used to carry
  `data-view-learner` (same hook as the separate "View profile" button);
  removed it from the avatar/name and moved to the new trigger, left
  untouched on the standalone "View profile" button.
- `assets/js/teacher/student-registry.js` — registry table: avatar was a
  plain non-interactive `<span>`, name carried `data-view-learner`. Wrapped
  both in the new trigger, removed the hook from the name, left it
  untouched on the separate "View profile" button. (No separate mobile
  card renderer exists on this page — the table collapses via CSS.)
- `assets/js/teacher/learner-records-hub.js` — class roster: avatar and
  name were both fully inert (`tabindex="-1"`, no hooks at all — the only
  way to reach the profile was the row-menu's "View learner profile"
  item). Wrapped both in the new, keyboard-reachable trigger; the
  row-menu item is untouched.
- `assets/js/teacher/early-warning.js` — alerts table: name carried
  `data-open-profile` (avatar had no hook), and this page has no separate
  "View profile" control at all. Avatar+name now open the quick view;
  there's no other element to "preserve" the old hook on, since none
  existed — reaching the full profile without the quick view's own
  footer button isn't possible from this row any more, same as how the
  feature works on every other page.
- `assets/js/teacher/module-management.js` — module detail roster: avatar
  and name (`<span class="st-module-title">`, not even a button) had no
  hook and no risk-color class. Wrapped both in the new trigger using
  `r.learnerId` (not `r.enrollmentId`, which is the release-batch record,
  a different entity — confirmed via its other uses in this same file).

Not touched: Assessment Scores, where clicking a learner selects them for
scoring instead of navigating.

## Verification performed

- `node --check` on every edited/new JS file.
- Brace-balance checks on every edited/new CSS file.
- Confirmed each page's script tag was added exactly once, right after
  `components/modal.js`.
- Confirmed Assessment Scores was left untouched.
- Confirmed the standalone "View profile" buttons/row-menu items that
  should be untouched still carry their original hooks unchanged.

Not yet done (needs a running app + browser, not available in this
session): the prototype's `?open=`/`?state=loading` URL-driven visual
comparison against the PNG/GIF references at 1440/390px, the offline-mode
error-state check, and the reduced-motion check. Please run through the
Checks list in the original prompt before considering this fully verified
end to end.
