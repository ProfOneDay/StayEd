# Learner Profile UI revision — 2026-09-30

Revised the teacher Learner Profile page to match the approved prototype
(`design/teacher-learner-profile/teacher-learner-profile-prototype.html`).
Presentational/structural change only — no backend, API, or flow changes.

## Files changed

- `StayEd_Frontend/pages/teacher/learner-profile.html` — restructured markup
  to the prototype's sections (icon-tile headers, two-column metric groups,
  side-by-side performance/readiness cards, two-column risk trend body,
  segmented sticky tabs, contributor grid, risk-row layout, sticky risk
  factors sidebar). Every existing `data-*` hook, control, tab, table, empty
  state and modal trigger is preserved.
- `StayEd_Frontend/assets/js/teacher/learner-profile.js` — presentational-only
  edits: render functions now emit classes instead of inline styles (hero
  risk-panel tone + icon swap, contributor/risk-factor tone classes,
  recommendation/active-intervention cards, AI Insight boxes, category chips,
  history table link/danger-outline styling); fixed the mojibake `â€”` →
  `—`; added dark hover tooltips to the performance-progress and risk-trend
  chart points (matching the dashboard's chart tooltip style); added a
  shared `IntersectionObserver`-based motion system (`setupMotionObserver`,
  `triggerInView`, `replayAnimations`) that fills bars/lines on scroll into
  view and replays on tab switch; sentence-cased static UI labels/buttons.
  No API calls, guards, computation, or save/edit logic were touched.
- `StayEd_Frontend/assets/css/pages/teacher/learner-profile.css` — full
  rewrite, entirely scoped under `body[data-page="Learner Profile"]`,
  matching the prototype's visual design: 4-column hero with risk-tone
  panel, segmented sticky tab bar, two-column metric groups with a fill
  bar, rebuilt performance-progress plot (inset gridlines, gradient area,
  animated draw-in line, tooltip-on-hover points), A&E readiness bar with a
  70% cutoff marker and sentence-case badge trick, two-column risk trend
  chart + run list, restyled timeline/contributor/intervention/AI-insight
  components, full-width layout, and responsive rules at 1280px/1024px/768px
  with no horizontal scroll at 390px. Motion respects
  `prefers-reduced-motion: reduce`.

## Notes

- Verified via Playwright against the dev servers across High/Moderate/
  Preliminary risk learners at 1440px, 1280px and 390px: hero, all four
  tabs, module-rate/readiness bars, risk trend chart, timelines,
  recommendation cards, edit-learner modal, and the Assign Intervention
  tab-switch + modal flow all render and behave correctly with no console
  errors.
