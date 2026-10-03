# Admin Settings Split UI — 2026-10-03

Part 1 of 2: revised the admin sidebar, split the combined admin Settings page
into **Profile Settings** and **System Settings**, and added an admin
**Help & User Manual** page. The admin Reports page was not touched beyond
adding the shared `st-admin` body class (Part 2 covers Reports).

## Sidebar

- `components/layout/sidebar-admin.html`: renamed "Settings" to
  "System Settings", added an "Account" divider, and added "Profile Settings"
  (`profile.html`) and "Help & User Manual" (`help.html`) links below it.

## New / changed pages

- `pages/admin/profile.html` (new) — `data-page="Profile Settings"`, shares
  the teacher Profile Settings page's `data-page` value so it inherits
  `profile-settings.css` directly. Contains the profile summary card, three
  collapsible sections (Account information, Security, Danger zone), and the
  Confirm / Edit Profile / Change Password (3-view) modals — all content and
  hooks carried over from the old combined Settings page, none removed.
- `pages/admin/settings.html` (rewritten) — now **System Settings** only:
  two bento cards (Academic year, Module return default) plus the Academic
  Year and Module Duration modals, and a hint linking to Profile Settings.
  No confirm-modal step for these two saves, matching the old page's
  direct-save behavior.
- `pages/admin/help.html` (new) — mirrors `pages/teacher/help.html`'s
  structure (`st-help-section`/`st-faq-list`, same inline entrance script).
  FAQ content is a first draft (approving teacher registration, adding a
  CLC, exporting the Master Enrollment Listing, changing the school year) —
  **please confirm or edit this wording before treating it as final.**
- `pages/admin/*.html` (all) — added the shared `st-admin` body class
  (dashboard, user-management, clc-management, reports, notifications,
  about, contact-us, privacy-policy, terms-of-service, plus the three above).

## JS

- `assets/js/admin/profile-settings.js` (new) — ported from the old
  `settings.js`: own-profile load, collapsible-section toggling, Edit Profile
  modal (incl. avatar upload), Change Password modal (3 views, forgot-password
  flow), 2FA toggle, logout/deactivate confirm flows, and the
  `[data-animate-cards]` entrance (honors `prefers-reduced-motion`). Password
  requirement checklist now toggles `is-met` (new prototype's class) instead
  of the old `met`. All toasts now go through `Utils.toast()` instead of the
  legacy custom `#toast` box.
- `assets/js/admin/system-settings.js` (new) — ported the active-school-year
  and module-duration load/save logic, same `Utils.toast()` convention and
  entrance animation.
- `assets/js/admin/settings.js` (deleted) — fully superseded by the two files
  above.
- `assets/js/core/router.js` — breadcrumb label for `admin/settings.html`
  updated from "Settings" to "System Settings". No breadcrumb entries were
  needed for the new `profile.html`/`help.html` pages; they already fall back
  correctly to the existing bare `profile.html`/`help.html` entries.

## CSS

- `assets/css/pages/admin/admin-account-pages.css` (new) — the admin-only
  layer for Profile Settings + System Settings: the `.overlay`/`.modal`
  dialog system (ported from `admin-list-pages.css`'s visual language),
  icon circles (incl. `st-icon-circle--navy`/`--teal`), form fields, the
  2-column password requirements checklist, the avatar-upload row, info/
  warning banners, and the System Settings value-chip row. Everything is
  scoped under `body.st-admin:is([data-page="Profile Settings"],
  [data-page="System Settings"])` (or narrower, page-specific selectors)
  so none of it can leak onto the teacher pages that share those
  `data-page` values.
- `assets/css/pages/admin/admin-settings.css` (deleted) — superseded by the
  file above; confirmed it was the sole consumer of `data-page="Settings"`
  before deleting.
- `assets/css/main.css` — swapped the `admin-settings.css` import for
  `admin-account-pages.css`.

## Verified

- No duplicate HTML ids and no dangling `getElementById` lookups in either
  new page's JS (checked programmatically against the markup).
- All 14 required hooks (`openEditProfileBtn`, `openChangePasswordBtn2`,
  `twoFactorToggle`, `logoutBtn`, `deactivateSelfBtn`, `profileAvatarInitials`,
  `profileDisplayName`, `profileEmailDisplay`, `profilePhoneDisplay`,
  `profileEmpIdDisplay`, `activeSchoolYearDisplay`, `openEditSchoolYearBtn`,
  `moduleDurationDisplay`, `openEditModuleDurationBtn`) are present.
- No stale references to the deleted `admin/settings.js` or
  `admin-settings.css` remain anywhere in the frontend.
- All new/edited files serve with HTTP 200 from the local dev server.
- Teacher's `profile.html`, `settings.html`, and `help.html` were not
  modified — confirmed via diff against the pre-existing versions.

## Still needs a human pass

- The Help & User Manual FAQ wording is a draft — flagged above and in the
  original spec, please review before shipping.
- Full in-browser functional/visual QA (every modal flow, 1440px/390px
  comparison against the prototypes, sidebar tooltip/active-link states,
  `prefers-reduced-motion` behavior) still needs to be run manually; this
  session verified file wiring and static correctness but has no browser
  automation available to drive the actual login + click-through flows.
