# StayEd frontend: style-consistency audit

**Scope:** the `StayEd_Frontend` upload, including 31 CSS files (about 25,200 lines) and the JS/HTML that renders markup.
**Method:** I parsed every rule with `tinycss2`. I then loaded the full `main.css` bundle in Chromium and compared what the browser kept against the source. You can re-run `stayed_style_audit.py` at any time; it is read-only, and `baseline_audit_output.txt` is the result for this upload.

## Verdict

**It works, but it is not yet consistent.** Every file parses (0 errors) and loads. The redesigned pages look right because each page carries its own copy of the shared look. That is also the problem: the same element (a button, a search box, a select, a table header, a modal) is defined several times, in different files, and often with different values. Changing "the button" today means editing 17 files.

| Check | Now | Target |
|---|---:|---:|
| Comments that end early and break the next rule | 1 | 0 |
| Core components styled outside the shared files | 46 | 0 |
| Core components whose base values conflict | 9 | 0 |
| Selectors that share styles through `body:is([data-page=…],…)` lists | 370 | 0 |
| Uses of legacy/duplicate tokens | 132 | 0 |
| `var(--a, var(--b))` fallback chains | 470 | 0 |
| Hard-coded hex colors outside `variables.css` | 249 | ≤ 25 |
| Distinct border radii | 43 | ≤ 12 |
| Distinct breakpoints | 20 | ≤ 4 |
| Distinct font sizes | 88 | ≤ 20 |
| `!important` | 359 | ≤ 40 |
| `@keyframes` (one name defined twice) | 41 | ≤ 20 |
| Identical 5+ property blocks copied across files | 30 | ≤ 3 |
| Inline `style=""` with real properties | 167 | ≤ 15 |
| JS helpers re-implemented (initials / esc / countTo / riskPill) | 13 / 6 / 9 / 6 | 0 |

---

## 1. Real bugs (fix first)

1. **A broken comment at `pages/teacher/module-management.css:1`.** The comment text contains `.st-badge-*/.st-pill/`. The `*/` inside it closes the comment early. The rest of the comment then glues onto the next selector, and the browser drops that rule. This is the actual cause of the "first-rule-in-file parsing quirk".
   - The "deliberate no-op placeholder" rules work around it: `.st-module-management-root` (line 16), `.st-assessment-scores-root` (`assessment-scores.css:1`) and the one in `landing.css:1`.
   - They protect nothing. Once the comment is fixed, all three can go.
2. **`@keyframes stModalIn` is defined twice:** in `components.css:1103` and in `admin-list-pages.css:141`. The admin copy loads later, so it silently replaces the shared modal animation on **every** page.
3. **`assessment-scores.css` loads twice.** It is imported in `main.css:20` and linked again in `pages/teacher/assessment-scores.html:26`. Its 251 `!important`s partly exist to win against itself.
4. **`.st-sr-only` only works on System Settings** (`system-settings.css:3` is page-scoped). Screen-reader-only text on any other page is visible.
5. **`admin-clc-management.css` is an empty stub** (331 bytes, comment only), but it is still imported.

## 2. Two token systems in `variables.css`

| Concept | Old token | New token | Effect |
|---|---|---|---|
| Card radius | `--st-card-radius: 5px` (line 147; 23 uses in 9 files) | `--st-radius-card: 12px` (line 341; 21 uses in 13 files) | Cards are 5px on some pages and 12px on others |
| Control radius | `--st-button-radius: 4px` (148; 26 uses in 14 files) | `--st-radius-control: 8px` (342; 45 uses in 19 files) | Buttons and inputs are 4px or 8px |
| Control height | `--st-button-height` / `--st-input-height: 44px` (175, 183) | none (pages hard-code 38/40/44) | Unused tokens; heights disagree |
| Red | `--st-danger #d32f2f` (265) | `--st-error` / `--st-risk-high #ba1a1a` (34) | Two reds for the same meaning |
| Orange / green | `--st-warning #ed6c02`, `--st-success #2e7d32` (262, 259) | risk moderate/low tokens | Same |
| High-risk tint | `--st-risk-high-soft` rgba (41) | `--st-risk-high-soft-2 #fdecea` (329), and the same for moderate/low | Two tints |
| Teal tint | none | `#e3f4f3` hard-coded **27 times**; the only token with that value is `--st-ev-attendance-soft` (356) | Missing token |

On top of this, 470 `var(--st-ink, var(--st-on-surface))`-style chains bridge the Material names (`--st-on-surface`, `--st-outline-variant`) and the redesign names (`--st-ink`, `--st-line`). Each pair resolves to the same color, so one name per role is enough.

**Hard-coded colors:** 249 hex colors outside `variables.css`, most of them equal to an existing token, plus 129 distinct `rgba()` literals. The worst files are `admin-list-pages.css` and `learner-profile.css`.

## 3. Shared components that live in page files

These elements look the same everywhere, but none has one shared, unscoped definition:

| Component | Defined in | Conflict |
|---|---|---|
| `.st-btn` (+ `-primary`, `-outline`, `-ghost`, `-danger`, `-danger-outline`, `-sm`) | `components.css` **and 16 page files** | `.st-btn-danger` background differs; `.st-btn-sm` is 34px on Profile Settings |
| `.st-search` | `components.css` (44px, 4px radius) + about 6 page copies (40px, 8px) | height, radius |
| `.st-select` | 6 files | height 40/44, padding, radius, border, background |
| `.st-card` | `components.css:93`, `layout.css:1032`, `learner-profile.css:35` | padding, radius, background, border |
| `.st-filter-bar` | `components.css:583` (5px radius) and `dashboard.css:133` | padding, radius, border |
| `.st-table-card-head`, `.st-row-actions`, `.st-row-menu-trigger` | `dashboard.css`, `learner-records.css`, admin files | padding, gap, radius |
| `.st-data-table`, `.st-pagination`, `.st-page-btn` | `pages/teacher/dashboard.css` | — (works only because it's loaded everywhere) |
| `.st-risk-strip`, `.st-hbar*`, `.chart-type-toggle/-btn` | `dashboard.css` + `admin-reports.css` | — |
| `.st-risk-meter`, `.st-two-line`, `.st-sort-btn`, `.st-text-btn`, `.st-modality-pill` | `learner-records.css` under a page list | height, background |
| `.st-icon-tile` | 6 page-scoped copies | — |
| `.st-toggle*` | `profile-settings.css` only | — |
| `.st-empty` | several | padding, radius, background, border |
| `.st-class-context-banner` | `learner-records.css`, `module-management.css` | padding, radius, background |

**Page-list scoping:** 370 selectors share styles with lists like `body:is([data-page="Student Registry"],[data-page="Learner Records"],…)`. They are in `admin-list-pages` (162), `learner-records` (123), `admin-account-pages` (37), `dashboard` (36) and `learner-records-hub` (12). Every new page has to be added to these lists by hand, or it gets unstyled controls. That is exactly the failure the `module-management.css` header comment describes.

## 4. Parallel systems for the same kind of element

| Element | Class families today |
|---|---:|
| Buttons | 37 |
| Badges / pills / chips / tags | 77 |
| Stat / KPI tiles | 39 |
| Empty states | 25 |
| Tabs / segments | 21 |
| Avatars | 20 |
| Modals | 6 systems: `.st-modal` + `Modal.open` (shared), admin `.overlay/.modal` (2 copies: `admin-list-pages`, `admin-account-pages`), `st-qv-overlay`, `st-module-modal`, `st-return-modal`, `st-avatar-preview-dialog` |

Most are the same component with a page prefix (`st-adm-…`, `st-lp-…`, `st-mm-…`). They should become one base class plus a modifier.

## 5. Scales

- **Font sizes:** 88 distinct values, including near-duplicates such as `0.781rem`, `0.8125rem` and `0.813rem`. About 20 px values are icon glyph sizes. Proposed text scale: `.75 / .8125 / .875 / 1 / 1.125 / 1.25 / 1.5 / 1.875 / 2.25rem`.
- **Border radius:** 43 values. Proposed: `4 / 6 / 8 / 12 / 16 / 20 / 999px` as tokens.
- **Breakpoints:** 20 values (480, 520, 560, 576, 600, 601, 640, 700, 720, 767, 768, 900, 992, 1023, 1024, 1100, 1279, 1280, 1366, 1560). 767 vs 768 and 1023 vs 1024 are both used for the same intent. Proposed: `max-width 1279 / 1023 / 767 / 479`.
- **`!important`:** 359, of which 251 are in `assessment-scores.css`. Most become unnecessary once the double load and the page scopes are gone.
- **`[hidden]{display:none}`** is redefined in 11 files. It belongs once in `components.css` (with `!important`, as one of the few justified uses).

## 6. Copy-pasted blocks

There are 30 distinct 5+ property blocks pasted across files, 58 redundant copies in all. The most common:
- the search input and its icon (about 8 files)
- the icon tile (×5)
- the status-dot pill (×5)
- the whole admin modal CSS (×2)

## 7. Markup and JS

- **Inline styles:** 167 `style=""` attributes set real properties: font-size (35), width (21), color (16), display (13), border (12), and so on. The worst files are `learner-profile.js` (65) and `module-management.js` (29). The `--i` / `--w` custom-property ones are fine and stay.
- **Duplicate helpers** (`core/utils.js` has only `initials`):
  - `initials` is re-implemented in 13 files, even though `Utils.initials` exists.
  - `esc` / `escapeHtml` appears in 6: `assessment-scores`, `learner-profile`, `student/portal`, `profile-avatar`, `learner-quick-view`, `profile-security`.
  - `countTo` / `countUp` appears in 9 (admin and teacher dashboards, CLC, user management, registry, import, class management, early warning).
  - `riskPill` / `riskBadge` / `riskClass` appears in 6. This matters most, because the risk thresholds and labels must never disagree between pages.
- **Probably dead CSS:** about 150–200 classes have no match in any HTML or JS, for example `st-alert-card*`, `st-blended-summary*`, `st-action-card*`, `st-card-header/body/footer`. Verify each with a grep (including class names built from strings) before deleting.

---

## How to fix it

Run the three prompts **in order**, and check the site after each one. Each phase ends with the audit script, so you can see the numbers drop.

1. **`CLAUDE_CODE_PROMPT_phase1_foundation.md`.** Fixes the bugs and sets up one token set, one breakpoint scale and the radius and type scales. Low risk; mostly find-and-replace.
2. **`CLAUDE_CODE_PROMPT_phase2_components.md`.** Moves every shared component into `components/` as one unscoped definition, removes the page lists and duplicate copies, and puts all modals on one system. This is the big one.
3. **`CLAUDE_CODE_PROMPT_phase3_cleanup.md`.** Removes inline styles, shared JS helpers, dead CSS and leftover `!important`s.

None of the phases changes content, flows, or what any page looks like **on purpose**. Where two copies disagree, the prompts name which value wins: the redesign value (12px cards, 8px controls, 38px buttons, 40px fields). A few pages will therefore shift by a pixel or two toward the standard. That is the intended result.
