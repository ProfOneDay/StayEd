# StayEd style audit: history

Consolidated run-by-run record of `stayed_style_audit.py` across the CSS architecture cleanup
(see `STYLE_AUDIT_REPORT.md` for the narrative findings behind the baseline numbers). Replaces the
six separate raw-output files that used to live in this folder — same numbers, one table.

| Check (target) | baseline | phase2_before | phase2_interim | phase2_final | phase3_final | **final (current)** |
|---|---:|---:|---:|---:|---:|---:|
| Comments that end early and break the next rule (≤0) | 1 | 0 | 0 | 0 | 0 | 0 |
| Core components styled outside shared files (≤0) | 46 | 45 | 27 | 27 | 27 | 28 |
| Core components with conflicting base values (≤0) | 9 | 8 | 3 | 1 | 1 | 1 |
| Selectors sharing styles via `body:is([data-page=…],…)` lists (≤0) | 370 | 367 | 301 | 301 | 286 | 291 |
| Uses of legacy/duplicate tokens (≤0) | 132 | 2 | 1 | 1 | 1 | 1 |
| `var(--a, var(--b))` fallback chains (≤0) | 470 | 0 | 0 | 0 | 0 | 0 |
| Hard-coded hex colors outside `variables.css` (≤25) | 249 | 109 | 107 | 107 | 136 | 134 |
| Distinct border-radius values (≤12) | 43 | 15 | 17 | 17 | 20 | 22 |
| Distinct media-query breakpoints (≤4) | 20 | 8 | 8 | 8 | 8 | 8 |
| Distinct font-size values (≤20) | 88 | 44 | 45 | 45 | 51 | 60 |
| `!important` declarations (≤40) | 359 | 350 | 326 | 326 | 323 | 397 |
| `@keyframes` names defined more than once (≤0) | 1 | 0 | 0 | 0 | 0 | 0 |
| `@keyframes` total, many identical copies (≤20) | 41 | 30 | 30 | 30 | 29 | 36 |
| Identical 5+ property blocks copied across files (≤3) | 30 | 38 | 33 | 33 | 30 | 34 |
| Inline `style=""` with real properties (≤15) | 170 | 170 | 170 | 170 | 0 | 2 |
| JS helper `initials` re-implemented (≤0) | 13 | 13 | 13 | 13 | 0 | 0 |
| JS helper `esc`/`escapeHtml` re-implemented (≤0) | 7 | 7 | 7 | 7 | 7 | 7 |
| JS helper `countTo`/`countUp` re-implemented (≤0) | 9 | 9 | 9 | 9 | 9 | 9 |
| JS helper `riskPill`/`riskBadge` re-implemented (≤0) | 6 | 6 | 6 | 6 | 6 | 6 |
| **Checks on target** | **0/19** | **3/19** | **3/19** | **3/19** | **5/19** | **5/19** |

## Notes

- The `final_audit_output.txt` file this table replaces was actually a stale duplicate of the
  `phase2_before` run (byte-identical output), not a true post-cleanup result. The **final
  (current)** column above is a fresh run against the current `StayEd_Frontend` tree
  (2026-11-06), not a recovered or guessed number.
- **Drift since `phase3_final`**: `!important` (323→397) and distinct font-size values (51→60)
  both regressed, and `admin-user-management.css` now shows up in the "styled outside shared
  files" violation list. This tracks with the admin Reports/User-Management work that landed
  after the Phase 3 cleanup — new pages were written without going back through the shared
  component library the refactor had just established. Re-running `stayed_style_audit.py`
  periodically (not just once per refactor) would have caught this as it happened.
- Re-run it yourself: `pip install tinycss2 && python stayed_style_audit.py ../../StayEd_Frontend`
  from this folder.
