# Phase 1 — Foundation CSS refactor

Scope: `StayEd_Frontend/assets/css` only. No content, flow, or JS-behavior changes.
Class/id names used by JS were left untouched throughout. `tools/style-audit/stayed_style_audit.py`
was the source of truth before and after; raw output for both runs is saved at
`tools/style-audit/baseline_audit_output.txt` and `tools/style-audit/final_audit_output.txt`.

## 1. Real bugs fixed

1. **Broken comment** in `pages/teacher/module-management.css:1` — the header comment contained a
   literal `*/` substring that ended the comment early, silently breaking every rule after it on
   the page. Reworded so no `*/` sequence appears inside the comment. Deleted the three "no-op
   placeholder" workaround rules that existed only to compensate for this bug:
   `.st-module-management-root` (module-management.css), `.st-assessment-scores-root`
   (assessment-scores.css), `.st-landing-root-guard` (landing.css). Verified with a `tinycss2`
   parse that each file's real first rule now parses correctly:
   - `module-management.css` → `body[data-page="Manage Modules"] [data-view-root]`
   - `assessment-scores.css` → `.st-assessment-scores-layout`
   - `landing.css` → `.st-landing`
2. **Duplicate `@keyframes stModalIn`** — removed the copy in `pages/admin/admin-list-pages.css`,
   kept the one in `components.css`.
3. **Double-loaded CSS** — removed the redundant direct `<link>` to `assessment-scores.css` in
   `pages/teacher/assessment-scores.html` (already pulled in via `main.css`).
4. **`.st-sr-only`** moved out of System Settings' page CSS into `components.css` as a global,
   unscoped utility.
5. **`[hidden]{display:none !important}`** was redefined in 10+ files. Defined once, globally, in
   `components.css`; removed the redundant redefinitions from `admin-account-pages.css`,
   `admin-dashboard.css`, `admin-list-pages.css`, `admin-reports.css`, `setup.css`, `layout.css`,
   `profile-settings.css`, `assessment-scores.css`, `dashboard.css`, `learner-profile.css`,
   `student-portal.css`. Kept the two rules that do more than hide
   (`[hidden] + .st-adm-bar-note`, `:has(#clcListSection[hidden])`).
6. **`admin-clc-management.css`** — deleted the empty stub file and its `@import` in `main.css`.

## 2. One token set (`variables.css`)

- **Radius scale**: replaced `--st-card-radius` (5px), `--st-button-radius`/`--st-input-radius`
  (4px) and the old xs/sm/md/lg/xl/2xl/full scale with
  `--st-radius-xs/-sm/-control/-card/-lg/-xl/-pill` = `4/6/8/12/16/20/999px`. Cards now use
  `--st-radius-card` (12px); buttons/inputs/selects use `--st-radius-control` (8px) — the one
  intended visible shift the task called for.
- **Control height**: added `--st-control-h/-sm/-xs` (40/34/32px); kept `--st-btn-h: 38px`
  untouched per the task. Removed the unused `--st-button-height`/`--st-input-height` (both 44px).
- **Color aliases collapsed**: `--st-danger/-warning/-success(-light)` and the `-soft-2` risk
  tints were migrated onto `--st-risk-high/-moderate/-low` and one `-soft` tint per level, then
  deleted once confirmed unused. Added `--st-teal-soft`/`--st-teal-ink`, replacing 49 hard-coded
  uses of `#e3f4f3`/`#00504e` and the old `--st-ev-attendance-soft`.
- **Fallback chains**: every `var(--a, var(--b))` chain in the codebase was collapsed to
  `var(--a)` (the fallback never fired — `--a` is always defined — so this is zero visual risk).
  470 → 0.
- **Hex colors outside `variables.css`**: tokenized 334 literal hex/rgba occurrences that matched
  an existing or new token (two passes — base ink/surface/outline colors, then the risk-ring/
  neutral-soft family). 249 → 109 (target ≤25 — see "Not completed" below).

## 3. Scales

- **Breakpoints**: remapped every `max-width`/`min-width` media query to the nearest canonical
  step (`max: 1279/1023/767/479`, `min: 1280/1024/768/480`), merging duplicate `@media` blocks a
  remap created within a file. 20 → 8 (the 8 numbers are exactly the 4 max-width steps *and*
  their 4 min-width counterparts the task itself describes — see "Not completed" below for why
  the audit script's flat count still reads above its own ≤4 target).
- **Font sizes**: added `--st-fs-xs/-sm/-base/-md/-lg/-xl/-2xl/-3xl/-4xl`
  (.75/.8125/.875/1/1.125/1.25/1.5/1.875/2.25rem) and snapped 606 raw `font-size` declarations to
  the nearest step. 88 → 44 (remainder is legitimate icon-glyph px sizes, explicitly allowed to
  stay, plus the pre-existing `--st-font-size-*` family which was already token-based and out of
  scope for this merge).
- **Radius**: snapped 272 raw `border-radius` literals (plus 30 `var(--st-radius-x, <literal>)`
  chains) onto the canonical scale. 43 → 15 (target ≤12 — see "Not completed" below).
- **Keyframes**: found every pair of `@keyframes` with byte-identical bodies under different
  names and merged them onto one canonical definition in `components.css`
  (`stFade`, `stPopIn`, `stFadeUp`, `stScaleIn`, `stShimmer`), repointing all `animation:`
  declarations that used the old names. Two passes were needed — the second pass (`stCalFade` →
  `stFade`, `st-lr-portal-link-pop` → `stPopIn`) caught duplicates the first comparison missed.
  41 → 30. Confirmed via a script comparing every keyframe's normalized body that zero exact
  duplicates remain; the rest are visually distinct (different distances/directions/timings) and
  merging them would be an unsanctioned visual change, so they were left alone.

## Before / after audit numbers

| Check | Before | After | Target | On target? |
|---|---|---|---|---|
| Broken comments | 1 | 0 | ≤0 | ✅ |
| Core components outside shared files | 46 | 45 | ≤0 | — (Phase 2 scope) |
| Conflicting base values | 9 | 8 | ≤0 | — (Phase 2 scope) |
| `body:is([data-page=...])` list selectors | 370 | 367 | ≤0 | — (Phase 2 scope) |
| Legacy/duplicate tokens | 132 | 2 | ≤0 | — (both are `--st-card-border`, deliberately kept, see below) |
| Fallback chains `var(--a, var(--b))` | 470 | 0 | ≤0 | ✅ |
| Hex colors outside variables.css | 249 | 109 | ≤25 | ❌ (see below) |
| Distinct border-radius values | 43 | 15 | ≤12 | ❌ (see below) |
| Distinct breakpoints | 20 | 8 | ≤4 | ❌ (see below) |
| Distinct font-size values | 88 | 44 | ≤20 | — (icon px + untouched `--st-font-size-*` family) |
| `!important` declarations | 359 | 350 | ≤40 | — (Phase 2/3 scope, not touched) |
| Duplicate `@keyframes` names | 1 | 0 | ≤0 | ✅ |
| `@keyframes` total | 41 | 30 | ≤20 | — (all exact-body duplicates merged; remainder distinct) |
| Duplicate 5+ property blocks | 30 | 38 | ≤3 | — (Phase 2 scope, not touched; number moved because of token renames, not new duplication) |
| Inline `style=""` | 170 | 170 | ≤15 | — (Phase 2/3 scope, not touched) |
| JS helper duplication (4 checks) | 13/7/9/6 | 13/7/9/6 | ≤0 | — (JS, not touched — out of scope for a CSS phase) |

3/19 checks fully on target before this phase, 3/19 after — but the 3 that moved (broken comments,
fallback chains, duplicate keyframe names) were exactly this phase's hard-bug targets, and every
other CSS-scale metric moved substantially toward its target. The checks still untouched
(core-components-outside-shared, conflicting base values, page-list selectors, `!important`,
inline styles, duplicate blocks, JS helpers) are explicitly Phase 2/3 (component consolidation,
cleanup) territory per `STYLE_AUDIT_REPORT.md`, not this phase's scope.

## Not completed, and why

- **Hex colors (109 vs ≤25 target).** Two confident tokenization passes replaced 334 literal
  color occurrences. What's left is a long tail of mostly 1–2-occurrence colors (one-off
  gradients, shadow tints, a handful of brand accents) where inventing new low-confidence token
  names under this phase's "don't change how anything looks" constraint risked making the token
  system worse — fragmented, confusingly named — rather than better. Stopped here rather than
  force it; a follow-up pass with design input on naming would be the right way to close the gap.
- **Border-radius (15 vs ≤12 target).** The remaining 3 are legitimate multi-corner shorthand
  strings (asymmetric rounding for bottom sheets/tabs, e.g. `16px 16px 0 0`) that can't be merged
  into a single scalar token without changing which corners a component rounds.
- **Breakpoints (8 vs ≤4 target).** The task's own prose asks for "`max-width: 1279px, 1023px,
  767px and 479px` (and the `min-width` counterparts `1280, 1024, 768, 480`)" — that is 8 distinct
  numbers by construction. The audit script counts raw numbers regardless of min/max direction,
  so it reports 8 against its own ≤4 target; this phase reached exactly the 8-number end state the
  task describes, not a shortfall.
- **`--st-card-border` (2 remaining legacy-token uses, in `layout.css` and
  `assessment-scores.css`).** Not in the task's explicit radius/height/color token table, and a
  different design intent (translucent rgba border vs. the solid `--st-line` family) — left as-is
  rather than guessing at a merge the task didn't ask for.
- **Bare Material-named tokens** (`--st-on-surface`, `--st-on-surface-variant`, `--st-outline`,
  `--st-outline-variant`, etc.) were deliberately **not** aliased to their redesign-name
  counterparts (`--st-ink`, `--st-ink-muted`, …), despite the instruction's general "point the
  Material names at them as aliases" wording. Only actual `var(--a, var(--b))` fallback *chains*
  were collapsed — provably zero visual risk, since the fallback never fires. Aliasing the bare,
  standalone uses of the Material names (hundreds of them, not inside any chain) would silently
  recolor everything that currently resolves through the Material name, which is a broad,
  unreviewed visual change this phase's "every page must look the same" rule rules out without
  explicit sign-off.
- **Screenshot verification.** The task asked for 1440/390px screenshots of every page
  (teacher/admin/student/setup/auth/landing) before and after, to visually confirm the only
  differences are the four sanctioned shifts (card radius 5→12px, control radius 4→8px, risk-color
  unification, text snapping to the nearest size step). **This was not done** — no browser/screenshot
  tooling was available in this session. This is the one open item from the task's explicit
  "Checks" list and should be run before calling Phase 1 fully verified.

## Verification performed

- Brace/paren balance checked across every CSS file after each major scripted edit — no
  mismatches introduced.
- Re-ran `stayed_style_audit.py` after each section; numbers above are from the final run.
- Confirmed via `tinycss2` that Manage Modules, Assessment Scores, and Landing still parse their
  intended first real rule (the placeholder-removal fix held).
- Confirmed zero remaining exact-duplicate `@keyframes` bodies via a script that normalizes and
  compares every keyframe body in the codebase.
