# StayEd — Meeting Notes Fixes (2026-08-15)

Addresses all 9 items from `Notes_meeting (1).pdf`. Every backend change below was tested
against a live PostgreSQL instance with realistic seeded data (module batches, multi-point
risk histories, edge cases) before being written up here — not just read and assumed correct.

## 1. Risk Distribution Chart Synchronization

The `/teacher/dashboard` endpoint itself already computed KPI cards and chart from the same
learner list. The real gaps were:

- A dead `/predictions/risk-distribution` endpoint counted only model-predicted `LOW` learners,
  silently excluding "awaiting prediction" ones — precisely the trap the notes warn against.
  Nothing currently calls it, but it's now rewritten to reuse the exact same `_learner_query` +
  `_shape_learner` classification and "awaiting prediction counts as Low" rule as the dashboard,
  so it can't become a future landmine.
- The Dashboard's "CLC Location" filter was **hardcoded** to two fake options ("Central ALS
  Center", "San Felipe Sur CLC"). It now populates from the teacher's real assigned-CLC list.
- There was no "School Year" filter control at all, despite being required. Added one, populated
  from the school years actually present in the teacher's own learner data.
- After clicking Apply Filters, the "Coverage" meta stat showed a raw learner count ("12 learners
  in current view") instead of a percentage, and the Risk Insights text didn't match the initial
  load's format. Both now compute genuine coverage % and matching insight text
  (`"N learner(s) are currently classified as High Risk"` / `"Prediction coverage is N% of active
  learners"`), consistent with the backend's own wording.

**Files:** `StayEd_Backend/app/routes/prediction_routes.py`,
`StayEd_Frontend/components/dashboard/filter-bar.html`, `assets/js/teacher/dashboard.js`.

## 2 & 6. Learner Activity Dates / Days Since Last Return

Most of the date-centralization work the notes describe (using `date_released`/`date_returned`/
`contact_date` instead of `created_at`, one shared "days ago" phrase-builder) was already in
place from an earlier pass. Three real gaps remained:

- **`Days Since Last Return: -26` bug**: `learner_profile()` computed
  `(date.today() - last_returned).days` with no clamping, so a future-dated (bad) return would
  surface a negative number. Now: if the recorded return date is in the future, it's treated as
  invalid and the field returns `null` (frontend shows "—") instead of a negative value.
- **Face-to-Face learners with modules were invisible to "Latest Activity"**: the SQL computing
  the most recent activity event excluded module *release* dates for any modality except
  Modular/Blended, so a Face-to-Face learner who *did* have modules released showed "No activity
  recorded" instead of the actual release date. Per the notes' explicit rule ("Face-to-Face:
  consultation dates; relevant module release/return dates, if modules are also used"), this
  filter is removed — release dates now count for every modality whenever module records exist.
- **No date validation on entry**: releasing a module with a future date, or recording a return
  before its release date / in the future, was previously only caught by a raw Postgres
  constraint with an unhelpful generic message. Added explicit checks with the exact messages
  from the notes ("Release date cannot be later than the current date.", "Return date cannot be
  earlier than the module release date.", "Return date cannot be later than the current date.").

**Files:** `StayEd_Backend/app/services/learner_service.py`, `app/routes/learner_routes.py`.

## 3. Notification Bell Unread Indicator

The backend's unread-count logic was already correct end to end. The bug was entirely visual:
`.st-notification-dot` in the shared navbar had no `display:none` default and nothing ever
toggled it — it was permanently visible regardless of unread count.

- CSS: dot is hidden by default, shown only via an explicit `.is-visible` class.
- `Layout.refreshNotificationDot()` fetches the real unread count on every page load and toggles
  the class; the Notifications page calls it again after mark-read / mark-all-read / delete so
  the bell in the *same* page updates without a reload.
- Per the notes' "opens/clicks it" requirement: clicking a notification card (or its "View
  Learner"/"View Intervention" button) now also marks it read, in addition to the existing
  explicit checkmark button and "Mark All Read". Opening the Notifications page itself still does
  **not** mark anything as read.

**Files:** `assets/css/layout.css`, `assets/js/core/layout.js`, `assets/js/teacher/notifications.js`.

## 4. Simplified Community Learning Center Overview

Removed the "+ Add Class" button (class creation lives only in Class Management now) and the
"Active Centers" / "High-Risk Learners" KPI cards, leaving Total CLCs + Total Learners in a
2-column layout (new `.st-records-stats--clc` modifier; the shared 4-column class used by Student
Registry is untouched).

**Files:** `pages/teacher/clc-overview.html`, `assets/js/teacher/clc-overview.js`,
`assets/css/pages/teacher/learner-records.css`.

## 5. Learner Profile Risk Trend Over Time

- Backend now includes the actual risk **probability** (not just the Low/Moderate/High level) on
  every historical trend point.
- A learner who is "Not Yet Assessed" (no module batch released yet) can no longer show a stray
  trend point even if a `risk_assessment` row exists from before monitoring started — the trend
  is now gated by the same "has monitoring started" check as the risk badge itself, so the two
  parts of the page can't disagree.
- Frontend chart rewritten: points now plot by real probability using a piecewise mapping that
  keeps each dot inside its correct colored Low/Moderate/High zone (the zones aren't equal
  thirds — they mirror the actual 40%/70% classification thresholds) while still moving
  proportionally *within* a zone, so e.g. two "Moderate" points at 41% vs 63% plot at different
  heights, making a worsening trend visible even before the category changes.
- Consecutive points are now connected with a line (SVG, non-scaling stroke so it isn't
  distorted by the chart's non-square aspect ratio).
- Exact required messaging added: zero assessments → "No risk assessment available yet."; exactly
  one → the single point plus "Only one assessment is available. Additional assessments are
  required to display a risk trend." (no fabricated history).

**Files:** `assets/js/teacher/learner-profile.js`, `assets/css/pages/teacher/learner-profile.css`,
`StayEd_Backend/app/routes/learner_routes.py`.

## 7. Early Warning CLC Filter Population

The dropdown built its option list from `learners.filter(risk is High/Moderate)` — so a CLC with
zero current alerts silently disappeared from the filter entirely. It now sources from the same
assigned-CLC list as CLC Overview and the Dashboard filter bar (confirmed: returns all 6
Binalonan CLCs from the notes' example, not just the one with an active alert). Selecting a CLC
with no current High/Moderate learners now shows "No learners requiring attention in this CLC."
instead of the generic empty state.

**Files:** `assets/js/teacher/early-warning.js`.

## 8. Edit Access for the Module Release Logbook

New backend endpoint, `PUT /learners/<id>/module-batches/<batchId>`, lets a teacher correct a
previously-encoded batch's Release Date, and per module within it: Module Name, Learning Strand,
Return Date (including clearing it / "un-returning" a mistaken entry), and Remarks.

- Validates holistically across the whole batch (not just the edited rows) so an edit can never
  save an inconsistent state — same future-date / return-before-release rules as release/return.
- Every applied field change is written to `user_activity_log` (old value → new value) *before*
  being applied, so corrected records stay traceable without a new migration or a destructive
  delete path — matching "do not delete or overwrite historical information silently."
- After saving, module progress / activity / risk are recalculated and re-synchronized exactly
  like the existing release/return endpoints (same response shape, same best-effort
  `trigger_prediction` call).
- Frontend: new "Edit" icon button on every batch row (both active and fully-returned) opening a
  form pre-filled with the batch's current values.

**Files:** `StayEd_Backend/app/routes/learner_routes.py`, `assets/js/core/api.js`,
`assets/js/teacher/module-management-modal.js`, `assets/css/pages/teacher/learner-records-hub.css`.

## 9. Module Rate Tracking

Replaced the "Engagement Score" KPI card on the Learner Profile Overview with "Module Rate"
(`(modules returned / modules released) × 100`, shown as `"3 of 4 modules returned"` supporting
text plus a small progress bar), computed from the same centralized module counts already used by
the Modules Released/Returned KPIs so all three can never drift apart. Reordered the KPI row to
match the notes' recommended order. Not added to the Random Forest model's feature set, per the
notes' explicit instruction — it's purely an operational/teacher-facing metric for now.

`_engagement_score()` itself (the old AF2/AF5/PIS/FLT-based calculation) is left in place as an
internal signal for the separate Risk Explanation tab's fallback contributor text — the notes
scope the removal to the Overview **KPI card** specifically ("Engagement Score: 3 of 4"), not that
internal, differently-worded explanation text.

**Files:** `StayEd_Backend/app/routes/learner_routes.py`, `pages/teacher/learner-profile.html`,
`assets/js/teacher/learner-profile.js`, `assets/css/pages/teacher/learner-profile.css`.

---

## Verification notes

No local test suite existed to run. Verification was done by standing up a local PostgreSQL 16
instance, applying all 12 `sql/*.sql` migrations, seeding demo data plus additional
module-release/return/risk-history scenarios matching the meeting notes' examples (a Diego
Castro released-4-days-ago/partially-returned-3-days-ago scenario, a Face-to-Face learner with
modules but no consultations, a single-assessment learner, a zero-assessment learner, etc.), and
exercising every changed endpoint directly:

- Confirmed `/predictions/risk-distribution` now returns byte-for-byte the same counts as
  `/teacher/dashboard`'s `riskDistribution`.
- Confirmed Diego Castro's `daysSinceLastReturn` reads `3` (not a negative number) and his
  activity text reads "Module returned 3 days ago".
- Confirmed a Face-to-Face learner with an unreturned module now shows "No consultation for N
  days" instead of "No activity recorded".
- Confirmed future release dates, future return dates, and return-before-release are all rejected
  with the exact messages from the notes.
- Confirmed the new batch-edit endpoint applies changes, writes an audit trail per changed field,
  rejects edits to modules outside the target batch, rejects unknown learning strands, and
  supports clearing a return date.
- Confirmed a learner with zero module batches shows `moduleRate: null` /
  `"Not Yet Available"`, and Diego (3 of 4 returned) shows `moduleRate: 75` /
  `"3 of 4 modules returned"`.
- Confirmed Diego's risk trend returns real probabilities (`25% → 41% → 72% → 55% → 49%`) and
  that a "Not Yet Assessed" learner's trend is empty even when a stray `risk_assessment` row
  exists.
- Confirmed the assigned-CLC list returns exactly the 6 Binalonan CLCs from the notes' example.
- Confirmed the notifications unread count and mark-all-read flow end to end (6 unread → 0).

All modified Python files were compiled (`python -m py_compile`); all modified/all JavaScript
files were syntax-checked (`node --check`); modified HTML files were checked for balanced tags.
A full recursive diff against the original upload confirms exactly 19 files changed, with no
files added, removed, or touched outside this scope.

**What wasn't run:** an actual browser — this environment has no headless browser available, so
frontend verification is careful code review plus the data-contract testing above (confirming the
exact `data-*` attributes each script queries exist in the corresponding HTML), not a pixel-level
visual check. If anything looks visually off after this, it's the most likely place to double-check
first.
