# Phase 2 — Shared component library

Scope: pull every shared UI element into one unscoped definition under `StayEd_Frontend/assets/css/components/`,
inherited everywhere, so pages keep only layout and what's genuinely unique to them. No content, flow, or
JS-behavior changes; every id, `data-*` hook, and JS-toggled class (`is-active`, `is-open`, `.selected`,
`.chart-type-btn.is-active`, …) was left in place. Before/after audit numbers are in
`tools/style-audit/phase2_before_audit_output.txt` (== Phase 1's final numbers) and
`tools/style-audit/phase2_final_audit.txt`.

**Screenshot verification was not performed** — no browser/screenshot tooling was available in this session. This
is the single biggest open item before calling Phase 2 done: every page needs a side-by-side check against the
Phase 1 screenshots (1440/390px), especially tables, pagination, empty states, and every modal, per the task's
own "Checks" list.

## 1. New files under `assets/css/components/`

| File | Contents |
|---|---|
| `base.css` | `[hidden]`, `.st-sr-only`, focus-visible ring, shared keyframes, the global reduced-motion reset |
| `buttons.css` | `.st-btn` + all variants/sizes/modifiers, `.st-icon-btn-sm`, `.st-text-btn`, `.st-sort-btn` |
| `forms.css` | `.st-field`/`.st-label`, `.st-input`, `.st-select`, `.st-search`, `.st-toggle*`, checkbox/radio |
| `pills.css` | `.st-pill` + tones, `.st-risk-badge`, `.st-chip`, `.st-tag` |
| `surfaces.css` | `.st-card`, `.st-panel`(+head/title/sub), `.st-icon-tile` + tones, `.st-stat`, `.st-empty`, `.st-insights`, `.st-class-context-banner` |
| `avatar.css` | `.st-avatar-initials` + sizes/tones, `.st-learner-cell`, `.st-two-line` |
| `table.css` | `.st-table-card`(+head/title/count), `.st-toolbar`, `.st-filter-bar`, `.st-data-table`, `.st-row-actions`, `.st-row-menu-trigger`, `.st-pagination`, `.st-page-btn` |
| `data-viz.css` | `.st-risk-strip`, `.st-risk-legend*`, `.st-hbar*`, `.st-risk-meter`, `.st-segment`, `.chart-type-toggle`/`-btn`, `.chart-canvas-wrap` |
| `modal.css` | `.st-modal` system |
| `tabs.css` | `.st-tabs`/`.st-tab` |

All ten are imported from `main.css` right after `variables.css`, before the old `components.css`, `layout.css`,
and every page file. `components.css` is **not yet empty** — see "Not completed" below.

## 2. How the standards were reached

For almost every component, the "several pages each redefine this" problem turned out to already have a de
facto winner: one file's copy was explicitly commented as "matches the canonical treatment" of another, or
every real usage had already overridden the same unused default away from it. In those cases the already-agreed
look became the one definition, and the per-page copies (now provably identical or functionally dead) were
deleted rather than re-designed:

- **`.st-search`** — the spec text describes an absolute-positioned-icon layout, but six-plus files had already
  converged on a different, wrapper-flex layout (border/radius/height on the wrapper, icon as a flex sibling),
  each commented as deliberately matching "the canonical `.st-toolbar .st-search` treatment" instead of the old
  default. That wrapper-flex version is what's now in `forms.css`.
- **`.st-class-context-banner`** — the only definition (`learner-records-hub.css`) was a solid-navy fill with
  white text; every one of the three pages that actually use it overrode it to a white card with a navy left
  accent. The white-card version is now the default; the navy one is gone.
- **`.st-row-menu-trigger`** — two unrelated definitions existed (a 34px bordered button, scoped to 5 pages, and
  a bare 24px circular transparent one). The bare one was dead code: every page whose markup renders the trigger
  falls inside the 5-page scope, which always wins on specificity. Removed the dead one; the real one (snapped to
  32px per spec) is now unscoped in `table.css`.
- **`.st-risk-meter`** — same situation: a bare `margin-top:8px;height:8px` definition had a `.st-risk-meter-fill`
  child class with zero matches anywhere in the app's HTML/JS. Confirmed dead and deleted outright rather than
  moved; the real 5px version (used by 5 pages) is now the one in `data-viz.css`.
- **`.st-filter-bar`** — the task names this one explicitly ("the dashboard.css look, 12px radius"), which
  settled what would otherwise have been a judgment call between it and the older `components.css` version.
- **`.chart-type-toggle`/`-btn`, `.st-segment`, `.st-risk-strip`, `.st-hbar*`** — already unscoped, single-source
  in `dashboard.css` (its own comments documented this). Relocated unchanged into `data-viz.css`.
- **`.st-toggle*`** — already unscoped, single-source in `profile-settings.css` (ditto). Relocated unchanged.

## 3. Sanctioned shifts (visible, intentional)

- Buttons: active state `scale(.96)` → `scale(.97)`; icon gap `8px` → `6px`; a universal hover `translateY(-1px)`
  removed in favor of each tone's own hover (background change), matching the given spec's per-tone description.
- `.st-icon-tile`: radius `--st-radius-card` (12px) → `--st-radius-control` (8px), per spec.
- `.st-row-menu-trigger`: 34px → 32px, per spec.
- `.st-pill`: `2px 10px` padding / micro font / weight 700 → fixed `24px` height / `0 10px` / `--st-fs-xs` /
  weight 600, per spec.
- Focus rings standardized onto `var(--st-focus-ring)` (α.18) where several copies used a literal α.12 shadow.
- Modal corner radius: `var(--st-radius-card)` (12px) → the spec's literal `18px`; sizes `--sm/--md/--lg`
  changed from `440/640/860px` to the spec's `420/560/720px` (`--xl` at `1040px` kept as an unnamed extension).
- Added a grab-handle bar to the mobile bottom-sheet modal (new, per spec) — this is a visible addition with no
  prior equivalent, flagged for screenshot review.
- `.st-data-table th`: `text-transform: none` → `uppercase`, per spec's explicit "(uppercase `--st-fs-xs`,
  muted)" — the one typography change in this phase that wasn't just a number snap.

## 4. New modifier classes (markup changes)

- **`.st-btn-lg`** added to the 5 setup-wizard "Next/Finish" buttons and the 7 auth/landing-hero primary submit
  buttons, replacing page-scoped `height:48px`/`52px` overrides with the spec's named 44px size.
- **`.st-btn-block`** already existed in markup on several pages but had no unscoped CSS definition anywhere
  (only a page-scoped one) — added the missing global definition rather than inventing a new class name.

## 5. Checks

| Check | Before | After | Target |
|---|---|---|---|
| Core components outside shared files | 45 | 27 | 0 |
| Conflicting base values | 8 | 1 | 0 |
| `body:is([data-page=…])` list selectors | 367 | 301 | 0 |
| Legacy/duplicate tokens | 2 | 1 | 0 |
| Fallback chains | 0 | 0 | 0 |
| Hex colors outside variables.css | 109 | 107 | ≤25 |
| Distinct border-radius values | 15 | 17 | ≤12 |
| Distinct breakpoints | 8 | 8 | ≤4 |
| Distinct font sizes | 44 | 45 | ≤20 |
| `!important` | 350 | 326 | ≤40 |
| Duplicate keyframe names | 0 | 0 | 0 |
| `@keyframes` total | 30 | 30 | ≤20 |
| Copied 5+ property blocks | 38 | 33 | ≤3 |
| Inline `style=""` | 170 | 170 | ≤15 |
| JS helper duplication | unchanged | unchanged | 0 |

**The 1 remaining conflicting value** (`.st-filter-bar`) is intentional: `clc.css` deliberately strips the card
look (`background:none;border:0;box-shadow:none;padding:0`) for the CLC Overview search row only, commented
"on this page only" — a genuine, named exception, not an accidental duplicate.

**The 27 remaining "outside shared files" hits** are almost entirely contextual layout overrides the audit's
blunt heuristic can't distinguish from real redefinitions — e.g. `.st-filter-apply .st-btn{width:100%}` in a
specific footer, `.st-learner-cell .st-avatar-initials{width:36px}` inside one table's cell, a 479px
`.st-class-context-banner{row-gap:8px}` responsive tweak. None of these reset a component's color, radius, or
border — only size/position within one specific layout context — so they were deliberately left as page layout
rather than forced into new one-off modifier classes under this phase's time budget. `.st-btn` itself accounts
for most of the 27 for exactly this reason (15 files, all `.context .st-btn{width/height/flex}` style rules).

## 6. Not completed

This was explicitly "the big one" per the audit report, and the full scope — six class families averaging
dozens of variants each, full removal of 301 remaining page-list selectors, and six separate modal
implementations unified onto one — is multi-session work. What's deferred, and why:

- **Modal unification.** Only the already-shared `.st-modal` system was moved into `modal.css` and resized to
  spec. The admin `.overlay`/`.modal` system (`admin-list-pages.css`, `admin-account-pages.css`) is still its own
  near-duplicate implementation with its own JS wiring; `st-module-modal`, `st-return-modal`,
  `st-avatar-preview-dialog`, and `st-qv-overlay` are untouched. Moving any of these onto `.st-modal` means
  rewriting each one's markup structure (header/body/footer slots) and its open/close JS, not a CSS-only move —
  real behavioral risk without a way to click through and verify in this session.
- **Parallel-system renames** (buttons 37, pills/badges/chips/tags 77, stat/KPI tiles 39, empty states 25,
  tabs/segments 21, avatars 20, per the audit report). `pills.css`/`surfaces.css`/`avatar.css` now define the
  canonical target shape for most of these (`.st-pill`+tones, `.st-stat`, `.st-empty`, `.st-avatar-initials`
  sizes), and a few real duplicates were folded in along the way (the `-active/-pending/-archived/-inactive`
  status-pill tones, found duplicated in two files, are now one definition), but the bulk of the 77+39+25+21+20
  page-prefixed variants (`st-adm-badge`, `st-lp-chip`, `st-mm-tag`, …) still exist under their own names and
  haven't been mapped onto the new shared classes in markup.
- **The remaining 301 page-list selectors.** `admin-list-pages.css`'s `.overlay`/`.modal`/`.field`/
  `.detail-grid`/`.icon-circle`/`.quick-actions` family (and the equivalent in `admin-account-pages.css`) is
  still deeply interleaved page CONTENT, not just component look — safely separating "this is the modal shell"
  from "this is Review Registration's specific field layout" needs careful reading per rule, which the remaining
  time didn't allow. `learner-records.css`/`learner-records-hub.css`/`dashboard.css` are in better shape (most
  of their list-scoped component rules were exactly what moved into the new files), but still carry page-specific
  rules under the same 5-page `:is()` lists rather than each under its own single-page scope.
- **`components.css` is not empty.** It's down from 1764 to ~1120 lines. What's left — `.st-metric*`,
  `.st-action-card*`, `.st-badge*` (an older, possibly-superseded-by-`.st-pill` system), `.st-alert*`, `.st-dot*`,
  the old `.st-table`/`.st-table-wrapper`/`.st-dropdown`/`.st-page-button` system (a different naming scheme from
  `.st-data-table`/`.st-pagination`/`.st-page-btn`, left alone rather than guessing whether it's dead), `.st-widget*`,
  `.st-chart-placeholder`, `.st-error-page*`, margin/utility classes, `.st-faq-*` — are all genuine components
  by nature, just not ones this task's explicit file list named. They'd need their own files (or folding into an
  existing one) in a follow-up pass.
- **Hex colors / breakpoints / font sizes / `!important` / copied blocks / inline styles / JS helpers** all moved
  in the right direction as a side effect of the component work, but none of these were this phase's direct
  target (per `STYLE_AUDIT_REPORT.md`, several — inline styles, JS helper de-duplication — are explicitly
  Phase 3 scope) and none hit their target number.

## 7. Verification performed

- Brace/paren balance checked across every CSS file after each component extraction.
- Re-ran `stayed_style_audit.py` after the full pass; numbers above are from the final run.
- Confirmed via `tinycss2` that Manage Modules, Assessment Scores, and Landing still parse their correct first
  rule (Phase 1's fix held through this phase's edits).
- Traced every "already shared" claim in a comment back to an actual grep of markup usage before trusting it
  (e.g. confirmed `.st-row-menu-trigger`'s bare 24px copy and `.st-risk-meter-fill`'s child class really do have
  zero matches anywhere in HTML/JS before calling them dead, rather than just assuming the comment was right).
- **Not performed:** screenshot comparison, and clicking through the flows listed in the task (login, setup,
  imports, enrollment, modules, scores, interventions, user/CLC management, reports, settings, student portal).
  Both are necessary before this phase can be called verified, not just code-complete.
