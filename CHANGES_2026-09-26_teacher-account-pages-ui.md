# StayEd — Reports, Profile Settings, System Settings, Help & User Manual, About StayEd UI revision (2026-09-26)

Revised five teacher pages to match the rest of the redesigned StayEd, per
`CLAUDE_CODE_PROMPT_teacher-account-pages-v2.md`. Frontend-only — no changes
to `StayEd_Backend/`, API calls, guards, CSV generation, preview modals,
profile/password/photo saving, preference saving, or the font-scale
mechanism. Notifications was explicitly out of scope and is untouched.

## Files changed

- `StayEd_Frontend/pages/teacher/profile.html` — full markup rewrite (same
  `data-settings-*`, `data-profile-photo*`, `data-change-photo`,
  `data-remove-photo`, `data-deactivate-account`, `data-st-logout`, form/field
  `id`s, and `is-open` classes as before).
- `StayEd_Frontend/assets/css/pages/teacher/profile-settings.css` — full
  rewrite. Contains the one shared, intentionally-unscoped `.st-toggle`
  refresh (44×26px track, 20px thumb); everything else is scoped to
  `body[data-page="Profile Settings"]`.
- `StayEd_Frontend/assets/js/teacher/profile-settings.js` — added
  `playEntrance()`/`countTo()` (cards settle in on load, "Active learners"
  counts up); no changes to existing save/upload/toggle/danger-zone logic.
- `StayEd_Frontend/pages/teacher/reports.html` — full markup rewrite (every
  `data-report-*` / `data-export-csv-*` attribute, hidden `*-id` /
  `*-class-id` / `*-status-val` inputs, `*-results` dropdowns and `*-clear`
  buttons kept exactly as before).
- `StayEd_Frontend/assets/css/pages/teacher/reports.css` — full rewrite,
  scoped to `body[data-page="Reports"]`.
- `StayEd_Frontend/assets/js/teacher/reports.js` — added `playEntrance()`
  only; no changes to filter/search/export logic.
- `StayEd_Frontend/pages/teacher/settings.html` — full markup rewrite
  (`sysSchoolYear`, `data-settings-toggle-pref="ewa-alerts"` /
  `="student-portal-enabled"`, `data-font-size-slider`,
  `data-font-size-label`, `data-font-size-preview`, `fontSizeTicks` kept).
- `StayEd_Frontend/assets/css/pages/teacher/system-settings.css` — full
  rewrite, scoped to `body[data-page="System Settings"]`.
- `StayEd_Frontend/assets/js/teacher/system-settings.js` — `setFontScale()`
  now also sets the slider's `--p` custom property (drives the CSS fill);
  added `playEntrance()`. No changes to persistence/API logic.
- `StayEd_Frontend/pages/teacher/help.html` — full markup rewrite (kept
  `.st-faq-question` / `.st-faq-answer`, all four FAQs, wording unchanged);
  added a small inline entrance-motion trigger script (this page has no
  dedicated JS file).
- `StayEd_Frontend/assets/css/pages/teacher/help.css` — **new file**, scoped
  to `body[data-page="Help & User Manual"]` (added to `main.css` imports).
- `StayEd_Frontend/pages/teacher/about.html` — full markup rewrite (existing
  description paragraph and the "Version 1.0 · Department of Education ·
  Built for Community Learning Centers nationwide" line preserved verbatim,
  split into three fact tiles); added the same inline entrance-motion script.
- `StayEd_Frontend/assets/css/pages/teacher/about.css` — **new file**, scoped
  to `body[data-page="About StayEd"]` (added to `main.css` imports).
- `StayEd_Frontend/assets/css/main.css` — added the two new imports.
- `StayEd_Frontend/assets/css/layout.css` — added
  `.st-sidebar-secondary.active` (white-pill style, matching
  `.st-sidebar-nav a.active`) so About StayEd's sidebar footer link shows as
  active on its own page; `Layout.highlightCurrentPage()` already added the
  `.active` class to it, it just had no matching style before.

## What changed on each page

**Profile Settings** (matches `teacher-profile-prototype.html` exactly): the
old `.st-dash-grid`/`col-4`/`col-8` layout became a
`minmax(280px,1fr) minmax(0,2fr)` grid spanning the full content width, left
column sticky under the top bar. Summary card reordered per spec (photo →
help text → hidden Remove-photo button → name/role/status chip → a `<dl>` of
Employee ID/Assigned CLC/Join date), Quick Stats kept as its own card
alongside it. Profile information and Account settings became collapsible
sections (`display:grid; grid-template-rows: 0fr → 1fr` instead of the old
`max-height` transition); the three locked fields (Position, Organization,
Assigned CLC) get a small lock icon after their label plus one shared "Locked
fields are managed by your administrator" note, replacing the old per-field
inline `background`/`cursor` styles. Danger zone rebuilt as a non-collapsible
card with a red header strip, outline "Log out" and solid-red "Deactivate"
buttons. All labels/headings/buttons moved to sentence case; no text content
changed.

**Reports**: grid is 2 equal columns (1 on mobile/tablet), with "Individual
learner progress" spanning both columns and its CLC/Class/Learner controls
in one row (down to 2+1 under 767px). Every card now has visible field
labels above each control (`From which CLC`, `Class`, `Learner`) and a
footer with a small "CSV" chip + "Preview & export" button, replacing the
former stacked-button layout. Search dropdowns restyled as a floating
10px-radius card with a 160ms pop-in. **Bug found while verifying**:
`reports.js`'s learner-search rows also render a `<span class="badge
badge-neutral">` modality tag that the initial CSS pass didn't account for
— the site-wide `.badge` class (leaked in globally from the admin pages'
CSS) has no `.badge-neutral` color of its own, so it was rendering as plain
bold black text stacked awkwardly under the meta line. Fixed by giving
`.st-report-search-item` a row layout (name/meta on the left, badge pinned
right) and styling the badge as a small navy-soft tag.

**System Settings**: the old 12-column bento grid became four full-width
stacked cards. General's Active school year field now shows a lock icon
inside the read-only input instead of just graying it out. The font-size
slider's track is now a real gradient fill driven by a `--p` custom
property (`(value-1)/4 * 100%`, set from `SystemSettingsPage.setFontScale()`
on every input/change **and** on initial load from the saved preference),
with `::-moz-range-progress` for Firefox; added "Small"/"Default"/"Extra
large" tick labels under the track. The current-level label is now a
navy-soft pill next to the section title.

**Help & User Manual**: FAQs moved from a plain stacked list into a
2-column card grid (1 column under 1024px), each with an icon tile and the
question at 16.5px. The risk-level FAQ additionally shows three small
Low/Moderate/High pills under its (unchanged) answer text, as a visual aid.

**About StayEd**: single full-width card — a navy header band with the
white logo, "StayEd", and the tagline, then the unchanged description
paragraph, then the existing "Version 1.0 · Department of Education · Built
for Community Learning Centers nationwide" line split into three fact
tiles (Version/Organization/Built for) without changing any of the words.
Sidebar footer's About link now gets the same active-pill treatment as the
main nav links.

## Motion

All five pages settle in once on load (`[data-animate-cards]` + `.is-inview`,
opacity/8px-rise, staggered via each card's own `--i`), added directly on
each page's own controller (`profile-settings.js`, `reports.js`,
`system-settings.js`) or a small inline script for Help/About (which have no
dedicated JS files). Accordions use the `grid-template-rows` transition with
a rotating caret. The Quick Stats "Active learners" value counts up over
800ms on load (percentage stays static, per spec). `prefers-reduced-motion:
reduce` is respected on every page — verified via a Playwright context with
`reducedMotion: "reduce"`, all five pages render their final state
(`opacity:1`, no transform) immediately.

## Verification

- Logged in as a teacher and compared all five pages against the reference
  images at 1440, 1024 and 390px — no horizontal scroll, cards reach the
  full width of the content area at every width.
- **Nothing removed**: confirmed every `data-*` hook, form/field `id`, and
  the Quick Stats card, hidden Remove-photo button, all four account
  toggles, the font-size datalist/preview, the System Settings profile
  hint, and all four FAQs are present in the new markup.
- **Reports**: ran the CLC → Class → Learner cascade end to end (CLC select
  populates, Class select goes from `disabled` to enabled and populates,
  learner search dropdown opens and lists matches, picking one enables the
  previously-`disabled` Preview & export button); the Class list report's
  search dropdown was also exercised.
- **Profile**: opened/closed the Account settings accordion (`is-open`
  toggles correctly, section animates open); toggled the Email alerts
  preference (checkbox state updates).
- **System Settings**: dragged the font-size slider to 5 — `--p` updates to
  100%, the pill label updates to "Extra Large", and
  `document.documentElement[data-font-scale]` updates to "5" live.
- **Shared toggle refresh**: screenshotted a toggle on Learner Profile
  (the only other page currently using `.st-toggle`) after the CSS
  rewrite — renders correctly at the same 44×26px size.
- **Reduced motion**: confirmed via a Playwright `reducedMotion: "reduce"`
  context that all five pages' `[data-animate-cards]` children render at
  `opacity:1`/no transform immediately, with no transition.
- **Notifications**: not touched by this revision (file untouched).
- Console/page-error check across all five pages: zero real errors (one
  transient `ERR_NO_BUFFER_SPACE` network blip during a rapid Playwright
  sweep, not a code issue).
