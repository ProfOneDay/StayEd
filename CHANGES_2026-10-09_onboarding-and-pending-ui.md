# Setup Wizard + Account Pending Approval Redesign — 2026-10-09

Redesigned the 5-step first-time setup wizard and the Account Pending
Approval page to match `design/onboarding/setup-wizard-prototype.html` and
`design/onboarding/pending-approval-prototype.html`. Also extracted the
Upload/Preview logic into a module shared with Class Management's existing
"Import Learners" feature, per your note that they're "the same feature."

## Shared import engine (new)

- `assets/js/core/learner-import-core.js` (new) — `LearnerImportCore`:
  file validation (extension/size), the `/learners/import/preview`,
  `/learners/import/preview` (revalidate), and `/learners/import`
  (confirm) calls, `downloadTemplate()`, `cell()`/`titleCase()` text
  helpers, a `stats()` normalizer (the preview API calls the invalid
  bucket `errors`; both UIs' stat tiles want `invalid`), a shared
  `bindDropzone()` (drag/drop/browse wiring, including swallowing drops
  that land outside the zone so a missed drop doesn't navigate the whole
  page to the raw file), and a shared staged-progress animation.
- `assets/js/teacher/learner-import.js` (Class Management's "Import
  Learners" page) — refactored to call into `LearnerImportCore` for all
  of the above instead of its own inline copies. No visible or functional
  change on that page; it keeps its own rich sticky-column preview table,
  inline row edit/remove modal, and success-stats UI, since those are
  specific to that page's design.
- `pages/teacher/learner-import.html` — now also loads
  `core/learner-import-core.js`.

## Setup wizard (`pages/setup/setup-wizard-1..5.html`, `assets/js/setup/setup.js`, `assets/css/pages/teacher/setup.css`)

Markup and CSS rewritten per the prototype on all 5 pages: sticky top bar
with a dot-stepper (done steps teal + check, active step navy with a soft
ring, labels collapse to the active one under 1024px and to "Step N of 5 ·
{label}" with a progress bar under 768px), a fixed blurred footer (back
action left, secondary action + 48px primary right), and per-step layouts
(Welcome's split navy/white card with a "What you'll do" roadmap, Create
Class's form + sticky Class Summary, Upload's dropzone + file card,
Preview's stat tiles + table, Complete's pop-in check + stats +
configuration card). Every hook named in the brief (`data-wizard`,
`backBtn`, `nextBtn`, `classForm`, `municipality`, `clc`, `learningLevel`,
`schoolYear`, `summaryMunicipality`, `summaryCLC`, `summaryCLCLabel`,
`summaryLevel`, `summaryYear`, `dropZone`, `browseBtn`, `fileInput`,
`fileName`, `fileSize`, `uploadPreview`, `uploadProgress`, `uploadStatus`,
`setupDownloadTemplateLink`, `skipBtn`, `importBtn`, `learnerTable`,
`reuploadBtn`, `finishBtn`, `statTotal`, `statImported`, `statDuplicates`,
`statInvalid`, `successIcon`, `createAnotherBtn`) is preserved, and every
required piece of copy stays. Inline layout styles (the old
`style="width:20%"` progress fill) are gone — the stepper/mobile-progress
widths are now CSS keyed off the existing `body[data-wizard="N"]`
attribute; the `--i`/`--ring-c`-style custom-property inline styles used
for animation stagger indices are kept, matching the pattern already used
elsewhere in the app (e.g. the Student View cards).

**Behavior change — Upload/Preview now share Class Management's real
preview step (this is new, not purely cosmetic):** the old wizard
imported the file immediately on "Import & Continue" and step 4 just
redisplayed everything as "Imported." Now step 3 calls the shared
`LearnerImportCore.preview()` (validates the file, flags duplicates/
invalid rows, no DB writes yet) and hands the parsed result to step 4 via
`sessionStorage` (a File object can't survive a page navigation, and the
wizard is 5 separate pages, not Class Management's single-page flow).
Step 4 renders the real per-row status (Valid/Duplicate/Invalid, matching
the design's green/amber/red pills) and only commits the import — via the
same shared `LearnerImportCore.confirm()` Class Management uses — when
"Confirm Import" is clicked. Step 4 redirects back to step 3 if it's
opened with nothing in `sessionStorage` (e.g. a direct link or a refresh).
This was confirmed safe against the backend: `/learners/import/preview`
does no DB writes, and `/learners/import` already falls back to the
teacher's just-created active class when no `class_id` is passed — exactly
how the old wizard's immediate-import call already worked, so no backend
changes were needed.

Also fixed a bug introduced while building this: `.setup-file-card`
(step 3's file-chosen card) initially had `display: flex` unconditionally,
which overrides the browser's default `[hidden] { display: none }` rule —
the same class of bug just fixed on the student-access page's error box
earlier this session. Fixed with `.setup-file-card:not([hidden])`.

Step 2's Continue button is now disabled until municipality, CLC, level,
and school year are all set (matching the prototype), and the Class
Summary's status line and each row's icon now actually toggle live between
"Complete all fields to continue" (amber) and "Ready for learner import"
(teal) / unset vs. `.is-set`, per the prototype's Class Summary spec.

## Account Pending Approval (`pages/auth/pending.html`)

- Background, pending icon (ring-pulse-once + hourglass-flip-once), the
  "Pending review" chip, and the vertical step tracker (teal check +
  "Done" tag / amber ring + "In progress" tag / gray upcoming) now match
  the prototype. All three steps' existing text is unchanged.
- "Back to Login" is now a navy primary button with a back arrow, same
  `href`. Scoped as `.auth-switch .auth-pending-back` rather than
  restyling `.auth-switch a` globally — that shared class/selector is also
  used by `register.html`, `forgot-password.html`, and
  `reset-password.html` for their own plain-text footer links, which stay
  untouched.
- The new navy gradient + bottom-right teal glow background is scoped to
  `body.auth-page[data-page="Pending"]` (added `data-page="Pending"` to
  the body tag) so the other three `.auth-page` pages keep their existing
  classroom-photo background.
- Per your answer, the prototype's new note box ("Keep an eye on your
  DepEd email inbox...") was **not** added — nothing in this area besides
  what's listed above.
- Added `@media (prefers-reduced-motion: reduce)` to `auth.css` (there
  wasn't one before) disabling all `.auth-page` animations/transitions.

## Verification

- `node --check` on every edited/new JS file; div-balance and CSS
  brace-balance checks on every edited/new HTML/CSS file — all clean.
- Cross-checked every `setup-*`/`auth-*` class referenced in the wizard
  and pending HTML against the CSS — no missing definitions.
- Confirmed `.setup-complete-icon`'s rename to `.setup-success-icon`
  doesn't affect `pages/teacher/clc-upload.html` (it carries a leftover,
  already-unused `setup-complete-icon` class alongside its own
  page-scoped `.st-clc-success-icon`, which provides all of that
  element's actual styling).
- Traced the new preview→confirm flow against the backend
  (`app/routes/learner_routes.py`) to confirm no backend change was
  required.
- Not done: no browser/visual pass in this session (no browser automation
  tool available here), and no live walk-through of the actual 5-step
  flow, the CLC-after-municipality list, drag-and-drop, or the Pending
  page's animations. Recommend running through the Checks list from the
  original brief by hand (valid/oversized/wrong-type file, duplicates/
  invalid rows in the preview, Re-upload, Confirm, Create Another Class,
  registering a new teacher through to Pending, 1440/390px widths, and
  reduced motion) before shipping.
