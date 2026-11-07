# StayEd — Testing round fixes (2026-11-07)

Covers all 6 items from the latest testing round. Backend tests: 63 passed
(9 new test functions added, plus `field_issues`/`field_notes` assertions
added to several existing ones, all in `tests/test_import_validation.py`).
No data on the live or local database was changed — item 6's cleanup SQL was
written but **not run**, per the instructions.

---

## 1. Learner import: values that aren't on the list

### 1a. Duplicates are now checked like every other row
- `_preview_rows()` (`learner_routes.py`) now runs the full field-level check on a
  duplicate-LRN row too. A duplicate with its own problems is now **error**, not
  **duplicate** — so `_insert_import_rows()` never silently attaches it with a
  guessed value.
  - Before: a duplicate LRN with an invalid modality was attached to the class
    with `enum_modality()`'s default guess (Face-to-Face), issue never surfaced.
  - After: status `error`, message `"This LRN is already registered. Learning
    Modality must be Face-to-Face, Modular or Blended (you entered 'Notepad')."`
  - Only a duplicate with **no** other issues still gets the plain duplicate
    message: `"This LRN is already registered or appears twice in the file"`.
- Added `strict_modality()` and `strict_yes_no()` (`app/helpers.py`) — both
  return `None` instead of guessing. Wired into **both** insert loops in
  `_insert_import_rows()` (new rows and the duplicate-attach loop) as the
  safety net the spec asked for; a row that somehow still has an unrecognised
  value at insert time is skipped and counted as invalid, never saved with a
  made-up default. `enum_modality()` itself is untouched and still used by its
  other callers (`reports_routes.py:136`, the modality filter in
  `list_learners()`) as instructed.
- Manual enroll (`create_learner`) and profile edit (`update_learner`) now call
  `match_option(data.get("modality"), MODALITY_OPTIONS)` **before**
  `enum_modality()`. An unrecognised value now returns:
  **422** `"Learning modality must be Face-to-Face, Modular or Blended."`
  (Previously: silently saved as Face-to-Face.)

### 1b. Employment Status
- `EMPLOYMENT_ALIASES` (`app/helpers.py`) accepts `Self-employed`, `Self employed`,
  `Selfemployed`, and `Self-Employed / Business Owner` (case-insensitive,
  hyphen-insensitive) and maps them to **Employed**. The preview row stays
  **Valid**; `field_notes.employment_status` carries a note (e.g. `"Changed
  from 'Self-employed'"`), shown as a small gray note under the Employment
  cell by the frontend (see 1e).
- Anything else not on the list is now an error with the exact wording:
  **Before:** `"Employment Status must be one of: Employed, Unemployed"`
  **After:** `"Employment Status must be Employed or Unemployed (you entered
  'Not Employed')."`
- `import_template.py`'s Instructions sheet row for Employment Status now reads:
  *"Employed or Unemployed. Self-employed learners are recorded as Employed; use
  Socio-economic Status → Self-Employed / Business Owner for the detail."*
  (previously just `"Dropdown: Employed, Unemployed"`).

### 1c. Learning Modality
- **Before:** `"Learning Modality must be one of: Face-to-Face, Modular, Blended"`
  **After:** `"Learning Modality must be Face-to-Face, Modular or Blended (you
  entered 'Notepad')."`
- Added "F2F" as a friendly alias (`resolve_modality_alias`, `app/helpers.py`),
  on top of the existing case/hyphen/space folding in `match_option()`.

### 1d. Re-enrollee
- **Before:** `"Re-enrollee must be one of: Yes, No"`
  **After:** `"Re-enrollee must be Yes or No (you entered 'Maybe')."`
- Blank still means No, unchanged (`test_blank_re_enrollee_is_not_an_issue`).

### 1e. Field-level display + the skip-confirmation step
- `_check_import_row()` now also returns `field_issues` (`{field: message}`) and
  `field_notes` (`{field: note}`), sent with every preview row alongside the
  existing `issue` string.
- `learner-import-core.js`'s `renderPreviewRow()`: every cell value is now
  escaped with `Utils.esc()` (previously several — LRN, status issue text, the
  learner name cell, level — went into `innerHTML` unescaped: a real stored-XSS
  gap via an imported Excel/CSV cell). A cell with a `field_issues` entry gets a
  red tint + a small `error` icon + the message as its tooltip
  (`.st-import-cell--error`, new rule in `data-upload.css`, deliberately
  unscoped like the rest of that file so it also applies on the setup wizard).
  A cell with a `field_notes` entry (just Employment Status today) gets a small
  gray note under the value instead.
- Edit-row modal (`openEditRowModal`): a `<select>` whose value isn't one of the
  options now gets a red border (`.is-invalid`, reusing the same convention as
  `.st-assessment-input.is-invalid`) + `aria-invalid="true"` + a hint:
  *"You entered 'Notepad'. Please choose one of the options."* Re-enrollee no
  longer defaults an **invalid** value to "No" — `row.re_enrollee || "No"`
  defaulted *any* falsy value, which happened to be correct for blank but was
  the wrong mechanism; replaced with an explicit blank check
  (`String(row.re_enrollee ?? "").trim()`), same net effect for blank, but no
  longer conflates "blank" with "falsy."
- **Confirm-import skip warning**, new shared helper
  `LearnerImportCore.confirmSkipWarning(preview, proceed)`: before importing,
  if any row is an error, shows a modal — *"N learner(s) will be imported. M
  row(s) with errors will be skipped. Fix them with Edit row first if you want
  to include them."* — with **Continue**/**Go back** buttons; only the actual
  import call runs on Continue. Shown only when M > 0.
  Wired into all three entry points that share this preview:
  - **Import Students** (`learner-import.js`) — already had a post-import
    "Errors skipped" stat tile; now also warns *before* importing.
  - **Setup wizard** (`setup.js`, wizard step 4→5) — same; wizard-5's stat label
    changed from "Invalid" to **"Invalid, skipped"** to make the number legible
    on its own.
  - **CLC Upload** (`clc-upload.js`) — this page only ever showed an aggregate
    summary (no row table), with no warning and no skipped-count in the success
    message at all. Now shows the same Continue/Go-back warning, and its
    success message appends *"N row(s) with errors were skipped."* when M > 0.

### 1f. Tests
Added to `StayEd_Backend/tests/test_import_validation.py` (20 tests total in
the file now, all passing): "Not Employed" → error; all 4 Self-employed
spellings → Employed + note; "Notepad" modality → error; "Maybe" re-enrollee →
error; blank re-enrollee → no issue; a duplicate LRN with an invalid modality →
error (not duplicate, via `monkeypatch` on `fetch_all`); a duplicate with no
other issues still stays `duplicate`; `strict_modality`/`strict_yes_no` never
return a guessed value; re-importing an exported CSV's `="…"`-wrapped and
leading-apostrophe values strips back to the plain digits (see section 5).

---

## 2. Assign Intervention form (`Utils.openAssignInterventionModal`, `core/utils.js`)

- Added `Utils.todayIso()` — the **browser's local date** (`getFullYear`/
  `getMonth`/`getDate`), not `toISOString().slice(0,10)`.
- Target Follow-up Date input: `min="${Utils.todayIso()}"` disables earlier
  dates in the picker.
- Typing/submitting a past date anyway (or editing the date after opening):
  the field gets a red border + `aria-invalid="true"` + a hint under it, and a
  toast — *"The follow-up date can't be in the past. Please choose today or a
  later date."* — and the modal stays open (same `ModalInlineError`/`onConfirm`
  mechanism every other modal in the app already uses to stay open on error).
- Intervention Type, Description, and Target Follow-up Date all show a red
  `<span class="required">*</span>`; a `"* Required"` line was added at the top
  of the form; the date label's old `"(required)"` text suffix was removed
  (the asterisk now carries that meaning, consistent with the rest of the app).
- A missing Description or date shows the same red-border + hint treatment
  (previously: toast only, and in the async path the toast could even outlive
  the modal closing).
- **Backend**: `create_intervention` (`learner_routes.py`) now rejects
  `target_date < today_ph()` with **422**: *"The follow-up date can't be in the
  past. Please choose today or a later date."* `PATCH /interventions/<id>`
  (`intervention_routes.py`) applies the same rule **only when the date is
  actually changing** — an unchanged old date on an existing (possibly
  already-past) record is still allowed, per the spec.
- The "Edit Intervention" history modal (`learner-profile.js`,
  `openEditHistoryModal`) has no date field at all (Type + Description only) —
  nothing to fix there. The Calendar page doesn't edit intervention dates
  either (confirmed by search — no `targetDate`/intervention-PATCH code in
  `calendar.js`).

---

## 3. The database warning after entering a 2025 date

- `app/__init__.py`'s `CheckViolation` handler no longer sends `detail` to the
  browser unless `app.debug` is on (matching the pattern the generic 500
  handler already used) — it's logged server-side instead
  (`app.logger.warning(...)`).
- Added `CONSTRAINT_MESSAGES` / `constraint_message()` (`app/helpers.py`),
  mapping `error.diag.constraint_name` to a plain message. Mapped:
  `ck_intervention_dates`, `ck_module_record_dates`,
  `ck_class_enrollment_distance`, `ck_learner_date_of_birth`,
  `ck_risk_monitoring_dates`, and all 5 contact-number constraints
  (`ck_users_contact_number`, `ck_teacher_contact_number`,
  `ck_learner_contact_number`, `ck_learner_guardian_contact_number`,
  `ck_clc_contact_number`). Anything else keeps the existing generic message:
  *"Some of the information entered is not allowed. Please check it and try
  again."*
  - **Before** (for a past intervention date, if the request ever reached the
    DB): `message` was already the generic sentence above; `detail` carried
    the raw PostgreSQL text and was sent to every client regardless of debug
    mode.
  - **After**: `message` is now specifically *"The follow-up date can't be
    earlier than the day the intervention was assigned."*; `detail` is gone
    from the response in production.
- **Frontend audit** (grepped every `.js` file for `.detail`, `error.data.detail`,
  `String(error)`, `error.message`): no call site reads `error.data.detail` or
  `String(error)` anywhere. Every `Toast.error(error.message || "...")` call
  site is safe by construction — `API.handleError()` (`core/api.js`) already
  builds `new Error(error?.data?.message || fallback)` for every real HTTP
  error, so `.message` is always either the backend's own `message` field or a
  friendly fallback, never raw `detail`. No frontend changes were needed here;
  the fix is entirely the backend handler above.
- **Could not reproduce interactively** — there's no running browser in this
  environment. I traced the mechanism (confirmed `ck_intervention_dates`'s
  exact CHECK clause in `sql/00_core_schema.sql:626`, confirmed the handler
  code path, confirmed the frontend never surfaces `detail`) and fixed the
  verified cause; after section 2's fix this code path should no longer be
  reachable from the Assign Intervention form in the first place. Please
  re-check in a real browser: assign an intervention with a 2025 date (if still
  possible to get the request past the new 422 some other way — e.g. a stale
  tab with the old JS cached) and confirm no database wording appears anywhere.

---

## 4. Breadcrumbs start where the teacher started

- `Router.BREADCRUMBS` (`core/router.js`): removed the leading `{label:
  "Dashboard", href: "dashboard.html"}` crumb from **every** trail. Nested pages
  keep their real intermediate parents (e.g. `learner-records.html` is still
  `CLC Overview › Class Management › Learner Records`), they just no longer
  start with Dashboard when that isn't where the teacher came from. Top-level
  pages (Calendar, Reports, Notifications, Profile Settings, System Settings,
  Help, About, and their admin equivalents) now show only their own name.
- `Router.rememberNavRoot()` / `Router.navRoot()`: a new `sessionStorage` key
  (`stayed_nav_root`) holding the filename of the last sidebar item clicked.
  Written by a new `Layout.bindSidebarNavRoot()` (`core/layout.js`), delegated
  on `.st-sidebar` (shared markup for both the teacher and admin sidebars) so
  it covers both without a second listener.
- `Router.breadcrumbFor()`: for a flexible page (`ORIGIN_PARENTS` — Learner
  Profile, Assessment Scores) with no real referrer/remembered-origin match, it
  now falls back to `navRoot()` **only when** that stored root is itself one of
  the page's allowed parents — covering a notification-bell click or a Quick
  View "View full profile" link from a page not already in that list. A direct
  bookmark/refresh with nothing stored still falls through to the same sensible
  default as before (`Student Registry › Learner Profile`).
- Verified each example from the spec traces correctly through the existing
  `originFor()`/`breadcrumbFor()` recursion with the Dashboard crumb removed:
  - CLC Overview → a class → Learner Records → Manage Modules: **CLC Overview
    › Class Management › Learner Records › Manage Modules**
  - Early Warnings → a learner: **Early Warnings › Learner Profile**
  - Student Registry → a learner: **Student Registry › Learner Profile**
  - Dashboard → a learner (High-Risk list): **Dashboard › Learner Profile**
- Not independently browser-verified (no browser in this environment) — please
  click through the 4 examples above plus a page refresh on each, per the
  spec's final-checks list.

---

## 5. Exported CSV: LRN showing as `1.23457E+11`

- Merged the three CSV writers into shared primitives on `Utils`
  (`core/utils.js`): `Utils.csvRow(cells, textFlags)` (one escaped row,
  `="123456789012"`-style for any cell flagged text) and `Utils.saveCsv(filename,
  csvContent)` (the Blob/anchor-click/UTF-8-BOM part every writer had
  hand-copied). `Utils.downloadCsv(filename, headers, rows, {textColumns})`
  is the simple single-table convenience wrapper built on both, used by Student
  Registry.
  - `report-printer.js`'s `downloadCsv()` and `exportCsv()` (both previously
    dead code — grepped, nothing calls either) now also build on
    `Utils.csvRow`/`Utils.saveCsv`, with a shared `TEXT_COLUMNS = ["lrn",
    "contact number", "guardian contact number"]` list.
  - The **actually-used** CSV export — the printable report popup's own
    `downloadReportCsv()`, wired to its "Export as CSV" button — ran in a
    separate `window.open()` popup with no script tags of its own, so it
    can't import `core/utils.js` directly. It now calls
    `window.opener.Utils.csvRow`/`.saveCsv` instead of its own third
    hand-copied escaping/Blob logic (same-origin, same pattern `sendReportToAdmin`
    in that same file already relied on `window.opener` for). If the opener tab
    was closed, it now shows a friendly alert instead of silently breaking.
- `Utils.downloadCsv` always writes a UTF-8 BOM and lets a caller mark text
  columns by header name (case-insensitive); those cells are written as
  `="123456789012"` so Excel/Sheets show the full digit string instead of
  scientific notation, and a contact number keeps its leading 0.
- **Student Registry** (`student-registry.js:202`): now passes
  `{textColumns: ["LRN"]}`. Also fixed its export filename's date — it used
  `new Date().toISOString().slice(0,10)` (the exact anti-pattern called out in
  the hard rules: reports yesterday's date before 8 AM in the Philippines) —
  now uses `Utils.todayIso()`.
- **Reports / "Learner Records" export**: these are all `ReportPrinter.open()`
  report types (Individual Learner Progress, At-Risk Learners List,
  Intervention Tracking, Master Enrollment Listing, etc.), all served by the
  one popup CSV path fixed above — any section whose columns include LRN/
  Contact Number/Guardian Contact Number is now covered automatically via the
  shared `TEXT_COLUMNS` list, no per-report-type change needed.
- **Admin/CLC exports**: grepped `assets/js/admin/` for any CSV export — there
  isn't one (User Management and CLC Management have no CSV export today), so
  nothing to change there.
- `_normalise_import_value()` (`learner_routes.py:2671`) now strips a
  `="…"` wrapper and a leading apostrophe before the rest of the import
  pipeline sees the cell, so a teacher can re-upload a file they just
  exported. Added `test_reimporting_an_exported_csv_value_strips_the_excel_text_wrapper`
  (and the apostrophe variant) to `test_import_validation.py`.
- **Checked**: `node --check` on every touched `.js` file, plus the printable
  report popup's embedded `<script>` block extracted and checked separately
  (it's inside a template literal, so the outer check doesn't parse it) — all
  syntactically clean. **Not opened in an actual copy of Excel/Google Sheets**
  in this environment — please do that check per the spec (export Student
  Registry and a Reports report, open both, confirm full LRN digits and
  contact numbers keep their leading 0, then re-import the Student Registry
  export).

---

## 6. Intervention notifications for a teacher with no learners of their own

### Diagnosis (read-only, against the local dev database — not the live server)

Confirmed the cause described in the ticket, with real numbers from this
database:

- `teacher@stayed.com` ("Trisha Santos", `user_id=1`) is indeed the
  `seed_demo.py` demo account.
- The 12 seeded LRNs correspond to **learner_id 1–12** in this database (listed
  in the cleanup script below). The database has **38 learners total** — the
  other 26 are real/imported test data, confirming this account has been used
  for real testing well beyond the original demo seed, exactly the situation
  the ticket's "make sure the script only touches the seeded LRNs" caveat
  anticipates.
- This teacher's `notification` table has **50 rows total**. **30 of them
  (60%)** point at the 12 seeded demo learners (`link` contains
  `id=<1..12>`) — including **11 currently unread**. That's the "gets
  notifications saying interventions already exist" symptom, reproduced
  directly from the data.
- The two static seeded notifications (`"High-risk learners need review"`,
  `"StayEd backend connected"`) are **not currently present** for this user —
  apparently already cleared/read out at some point. Part 2 of the cleanup
  script below still removes them (for whichever environment still has them,
  including a future reseed), it's just a no-op on this particular database
  today.
- **Important nuance, worth being precise about**: I checked whether the
  ENROLLED/ACTIVE-class scoping fix (below) would, by itself, have hidden these
  30 notifications on this database — it would **not**. The 12 demo learners'
  `class_enrollment.enrollment_status` is still `'ENROLLED'` and their class
  (`"Basic Literacy Program - A"`) is still `'ACTIVE'`; they're legitimately
  "qualifying" learners by that rule, because nothing has archived them. The
  scoping fix is real and correct (it will catch a *different*, also-real bug:
  a stale alert surviving after a learner is later archived/withdrawn or their
  class is archived), but it is **not** what makes these 30 demo notifications
  disappear for this specific account. Only two things do that: (a) the
  `--sample-data` flag change below, which stops it from happening again on a
  fresh seed, and (b) actually running the cleanup script in Part 4 (pending
  your approval) against this already-seeded data.

### Fixes applied

1. **Scoping** (`_generate_alerts()`, `notification_routes.py`): every
   alert-generating query (risk/inactivity, overdue modules, due-soon modules,
   and the intervention-due query named in the ticket) now requires
   `ce.enrollment_status = 'ENROLLED' AND lc.status = 'ACTIVE'`. The
   intervention-due query specifically was missing both checks entirely (no
   `learning_class` join at all); it now joins `learning_class lc` and adds
   both conditions, as specified.
2. **Hiding stale alerts already in the table**: `list_notifications()` now
   calls `_qualifying_learner_ids(teacher_id)` (ENROLLED + ACTIVE class) and
   filters out any `RISK`/`INTERVENTION` row whose `link` points at a learner
   outside that set, via `_is_stale_generated_alert()`. **Hidden, not
   deleted** — the rows stay in the database.
3. **`seed_demo.py`**: now takes `--sample-data`. Without it (the default),
   it only creates the teacher/admin login accounts, the reference CLC list,
   and the `model_info` registry row — no sample learners, no demo risk
   assessments/interventions, no demo notifications. `--sample-data` adds all
   of that, for local dev/demo use only.
   - `StayEd_Backend/step.txt` (local dev notes) updated to
     `python seed_demo.py --sample-data`.
   - `docs/SETUP.txt` (Step 6) updated the same way, with an explicit
     "**IMPORTANT**: `--sample-data` is for local development only" warning.
   - `deploy/setup_server.sh` already called `seed_demo.py` **without** the
     flag — so the live server's behavior is already correct now that the
     default is safe. Added a comment there explaining why that's
     deliberate, so a future edit doesn't "helpfully" add `--sample-data`
     back in.
   - `docs/STAYED_MAINTENANCE_HANDOFF.md`: added a dated entry (§8, item 11)
     documenting this fix and the reasoning, for whoever reads that doc next.
4. **Live cleanup SQL — written, NOT run**:
   `StayEd_Backend/sql/manual/remove_demo_sample_data.sql`. Structure:
   - **Part 1** (read-only): `SELECT` counts for exactly what Part 2/3 would
     delete — learner rows matching the 12 seeded LRNs, their
     `class_enrollment` rows, cascading `risk_assessment`/`intervention`/
     `follow_up` rows, generated notifications linking to those learners, and
     the 2 static ones.
   - **Part 2**: deletes the generated notifications + the 2 static ones.
   - **Part 3**: deletes `class_enrollment` for those learners (cascades
     `module_record`, `session_attendance`, `contact_log`,
     `module_release_batch`, `learner_session_schedule`, `risk_assessment` →
     `risk_factors`/`intervention` → `follow_up` — confirmed every one of
     those foreign keys is `ON DELETE CASCADE` in `sql/00_core_schema.sql`
     and the later migrations), then the `learner` rows themselves (blocked
     by `ON DELETE RESTRICT` until the enrollments above are gone).
   - Scoped **strictly to the 12 seeded LRNs** throughout — never to "this
     teacher's data" — so it's safe to run even though this account has real
     imported learners mixed in, per the ticket's caveat.
   - **I have not run this.** Running Part 1 alone (it's wrapped in
     `BEGIN;`/`ROLLBACK;`-able) against *this* local database, right now,
     would show: 12 learners, 12 enrollments, 12 risk_assessment rows
     (one each, confirmed above), the intervention rows for whichever of them
     had `probability >= .70` (Ana Batungbakal and Isabel Ramos per
     `seed_demo.py`'s own data, plus Juan Santos — matches the three names in
     the ticket), 30 generated notifications, and 0 static ones (already
     cleared, see diagnosis above). Please review and run it yourself when
     ready — I've left it staged for your `BEGIN`/`COMMIT`/`ROLLBACK` approval
     inside the file itself.

---

## Final checks status

1. ✅ `pytest StayEd_Backend/tests` — 63 passed (9 new tests, plus updated
   assertions on several existing ones, all in `test_import_validation.py`).
2. ⚠️ Import test file (Not Employed / Self-employed / Notepad / Maybe /
   duplicate+invalid-modality rows) across setup wizard, Import Students, and
   CLC Upload — **logic verified via the backend unit tests above**, not
   clicked through in a real browser (none available here).
3. ⚠️ Assign Intervention (disabled past dates, inline message, asterisks,
   422 on direct API call, no DB wording) — **backend 422 path is covered by
   the constraint-mapping fix and reasoning above**; not clicked through in a
   browser.
4. ⚠️ Breadcrumbs — traced through the router logic by hand for all 4 examples
   in section 4; not clicked through in a browser.
5. ⚠️ CSV — syntax-checked (`node --check` + the extracted popup script); not
   opened in actual Excel/Google Sheets.
6. ✅ Notifications — diagnosis run for real against the local database (see
   section 6); cleanup SQL written and reviewed, **not executed**, awaiting
   your approval.
7. This file.

Everything marked ⚠️ above is exactly what couldn't be reproduced/verified in
this environment (no browser, no Excel/Sheets) — the code-level fix and
reasoning for each is documented above either way.

**One scope note on `today_ph()`/`Utils.todayIso()`**: the hard rules say to
use these "for everything below," which I read as everywhere *these 6 items*
touch "today" — birthdate (§1), the follow-up date (§2), and the Student
Registry export filename (§5), all fixed above. I deliberately did **not**
sweep the rest of the codebase for the same `new Date().toISOString().slice(0,
10)` pattern — it also appears in `calendar.js`, `class-attendance-modal.js`,
`learner-profile.js`, `module-management.js`, and `module-management-modal.js`
(mostly release/return/attendance date defaults and `max=` bounds). None of
those are part of the 6 reported bugs, and changing them would be touching
unrelated flows the hard rules explicitly say not to. Flagging this so it's a
deliberate, visible decision rather than a silent gap — happy to do a separate
pass on those if you want them covered too.
