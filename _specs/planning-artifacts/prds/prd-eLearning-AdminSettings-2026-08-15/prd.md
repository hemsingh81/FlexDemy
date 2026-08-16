---
title: Admin Settings & Runtime UI Configuration (incl. Course Wizard Relocation)
status: final
created: 2026-08-15
updated: 2026-08-15
---

# PRD: Admin Settings & Runtime UI Configuration

## 0. Document Purpose

This PRD scopes two bundled changes to the FlexDemy platform: (1) relocating the "New Course
Wizard" entry point into the My Courses (Tutor) section, and (2) a new Admin > Settings
capability that lets Master and Support admins change approved site-wide UI settings —
starting with typography (font pairing and font size) — at runtime, without a code deploy. It
is written for the engineer(s) who will build it and for the Master/Support admins who will
use it. It builds on the existing Admin Panel pattern (AI Configuration / Tag Management
precedent) and the existing CSS-custom-property-based theming already in `index.css`, rather
than introducing new architectural patterns. Exact schema/column-level detail and the AI
Configuration/ErrorRetentionSettings precedents this PRD's data model borrows from live in
`addendum.md`, not duplicated here. FRs are numbered locally to this document (FR-1 through
FR-22). This PRD bundles two independent changes that ship together for scoping convenience
(same sprint, same engineer, no dependency between them) rather than a shared product thesis —
§4.1 and §4.2–§4.7 can be read as two self-contained specs.

## 1. Vision

Today, changing anything about how FlexDemy looks — starting with the two typefaces
(Fraunces for display, Outfit for body) hardcoded in `index.css`, and the sizes they render
at — requires a code change and a redeploy. There is no admin-facing way to adjust it, and no
durable record of who changed what if something does get changed. Separately, the "New Course
Wizard" trigger lives inside a stats-card row above the My Courses (Tutor) list, one step
removed from the course list it creates entries for.

This PRD closes both gaps. A new **Admin Settings** section gives Master/Support admins a
self-service way to change approved UI settings at runtime — font pairing and font size —
backed by a generic settings store (Key/Value/KeyType/IsActive) designed from day one to hold
any future setting type, not just fonts. Each setting change goes through a preview-before-apply
step and a full change history, so a bad change is always visible and traceable. Separately, the
New Course Wizard trigger moves into the My Courses section itself, on the right-hand side, next
to the list it populates.

This is deliberately scoped to typography (font pairing and font size) for v1. The settings
store is generic; the *UI* for colors, spacing, or logo is future work, not built here. Font
size is curated (a fixed, pre-approved scale list), not a free numeric input — the same
guardrail philosophy FR-9 already applies to font pairing, extended to a second risk: an
unbounded size value can break layout and legibility site-wide just as an unvetted font family
can break brand consistency.

## 2. Target User

### 2.1 Jobs To Be Done

- As a Master or Support admin, I need to change the site's typography without filing an
  engineering ticket and waiting for a deploy, so the team can iterate on brand presentation
  on its own timeline.
- As that same admin, I need to see what a change will look like before it goes live
  site-wide, so I don't find out it looks wrong only after every user already sees it.
- As that same admin, I need to know who changed a setting and when, so a bad or
  unexplained change can be traced and reasoned about instead of being a mystery.
- As a tutor, I need the "create a new course" action right next to the list of courses I
  already manage, so I don't have to look for it in an unrelated stats row.

### 2.2 Non-Users (v1)

Admin Settings is Master/Support-only (§4.2, FR-4) — Tutor-Approvals-tier and below never see
this screen. Students and tutors are not users of this feature; they are *affected by* its
output (the rendered site) but never interact with the Settings screen itself. The My Courses
relocation, conversely, is Tutor-facing only — it does not touch Admin Settings.

### 2.3 Key User Journeys

- **UJ-1. An admin updates the site's typography.**
  - **Persona + context:** Priya, a Support-role admin, has been asked by the founder to try a
    slightly warmer body font for an upcoming campaign push.
  - **Entry state:** Logged in, on the Admin panel.
  - **Path:** Clicks the new "Settings" tab. Sees the current Font/Typography setting (Display:
    Fraunces, Body: Outfit, Mono: JetBrains Mono) with its IsActive state and last-changed
    info. Opens the font picker, which shows a small curated list of pre-approved pairings
    (not free text). Selects a candidate pairing.
  - **Climax:** A live preview renders immediately in the Settings screen against sample site
    content (heading, body paragraph, a card) using the candidate pairing — nothing site-wide
    has changed yet. Priya compares it against the current pairing side by side, decides it
    reads well, and clicks **Apply**.
  - **Resolution:** The change takes effect for all users on their next page load — no redeploy,
    no logout required. A new change-history entry records Priya, the old pairing, the new
    pairing, and the timestamp. If the founder later says "revert it," Priya can see exactly
    what it was before.
  - **Edge case:** Priya opens the picker, selects a candidate, sees the preview, and decides
    she doesn't like it — she navigates away without clicking Apply. Nothing is saved; the
    live site is untouched.

- **Tutor relocation (JTBD-restated, no full journey — a one-step UI move, not a new flow):**
  a tutor on the Tutor Hub who currently scans the stats-card row for "Course Creation" instead
  finds the same "New Course Wizard" trigger on the right-hand side of the My Courses section
  header, directly above their existing course list.

- **Font Size (JTBD-restated, no full journey — identical mechanics to UJ-1, a different
  Setting):** the same Priya, in the same Settings screen, opens a separate Font Size picker
  instead of the Font Pairing one, sees a live preview of the candidate size scale against
  sample content, and Applies or walks away exactly as UJ-1 describes — the picker, preview,
  Apply, and history steps are the same mechanism applied to a different curated list.

## 3. Glossary

- **Setting** — One row in the generic settings store: a Key, its current Value, a KeyType,
  and an IsActive flag (§4.3).
- **KeyType** — The category a Setting belongs to (e.g. `Font`). Extensible — a future Setting
  category (Color, Spacing, Logo) is a new KeyType value, not a new table (FR-7).
- **Effective Value** — The Value FlexDemy actually renders with: the Setting's Value when
  IsActive is true, otherwise the system's hardcoded default for that Key (FR-8).
- **Font Pairing** — A named, pre-approved combination of Display/Body/Mono font families,
  vetted ahead of time by design so the existing "no second serif/sans-serif family" rule
  (`DESIGN.md`) can never be violated through this screen (FR-9).
- **Font Size Scale** — A named, pre-approved proportional scale factor applied to the site's
  root text size, uniformly resizing every element sized via the standard relative type scale
  (FR-18) — not a per-role (Display/Body/Mono) value the way Font Pairing is; there is no
  natural role split for size the way there is for family, so a single scalar is the accurate
  model, not an invented one. Vetted ahead of time by design so a curated selection can never
  produce overflow, clipping, or illegible text. A second, independent typography setting
  alongside Font Pairing (FR-20) — same curation philosophy, different mechanism and different
  risk it guards against.
- **Preview** — A client-side, session-local render of a candidate Setting value against sample
  content, visible only to the admin previewing it, that has no effect on the live site or any
  other user until Apply is clicked (FR-13, FR-14).
- **Change History** — The append-only record of every applied change to a Setting: old Value,
  new Value, changed-by user, timestamp (FR-15, FR-16).

## 4. Features

### 4.1 My Courses — Course Wizard Entry Point Relocation

**Description:** Moves the existing "New Course Wizard" trigger from the Teaching stats-card
row (`TeachingStatsCards.tsx`) into the My Courses (Tutor) section (`MyCoursesSection.tsx`),
right-hand side. No change to the wizard flow itself (per the CourseWizard PRD) — placement
only.

#### FR-1: Relocate the wizard trigger

The "New Course Wizard" trigger is removed from the Teaching stats-card row and rendered
instead in the My Courses (Tutor) section, positioned on the right-hand side of that section's
header/toolbar area.

**Consequences (testable):**
- The stats-card row no longer contains a course-creation trigger.
- The My Courses (Tutor) section header renders a "New Course Wizard" trigger on its
  right-hand side, above the course list.
- The persistent left-nav "Course Publishing" link, which today scroll-jumps to
  `id="course-publishing"` on this section, continues to resolve to a valid, visible target
  after relocation — either the anchor moves with the trigger or the link's target is updated
  to match.

#### FR-2: Preserve existing wizard behavior

The relocated trigger opens the same New Course Wizard flow that exists today — no change to
steps, validation, or the wizard's own UI.

**Consequences (testable):**
- Clicking the relocated trigger opens the identical wizard component used by the current
  stats-card trigger today.

#### FR-3: Update empty-state copy

The My Courses (Tutor) empty state's existing copy ("No courses yet — start with New Course
Wizard above") is updated to match the trigger's new position, since "above" no longer applies
once the trigger sits beside the list header rather than in the stats row above it.

**Consequences (testable):**
- A tutor with zero courses sees empty-state copy that correctly points at the trigger's new
  location.

### 4.2 Admin Settings — Navigation & Access

**Description:** A new "Settings" subtab in the existing Admin Panel, following the same
structural pattern as the existing AI Configuration / Tag Management subtabs. Unlike AI
Configuration (Master-only, given its higher operational blast radius), Settings changes are
fully reversible via Preview + Change History + Restore (§4.5, §4.6), so access extends to
Support-tier admins — matching the existing Tutor Approvals precedent, the actual Master+Support
access tier already in use elsewhere in the Admin Panel, rather than AI Configuration's
stricter Master-only gating.

#### FR-4: Add the Settings subtab

A new `settings` entry is added to the Admin Panel's subtab set, visible only to users with
Master or Support role — the same access level as Tutor Approvals.

**Consequences (testable):**
- A Master or Support admin sees "Settings" in the Admin Panel navigation.
- A Tutor-Approvals-tier (or lower) admin does not see or reach the Settings subtab, including
  by direct navigation.

#### FR-5: List current settings by KeyType

The Settings screen lists every Setting grouped by KeyType, showing each one's current Value,
IsActive state, and when/by whom it was last changed.

**Consequences (testable):**
- Opening Settings with the Font KeyType present shows the current Font Pairing, its IsActive
  state, and its last-changed metadata.

### 4.3 Generic Settings Data Model

**Description:** A single, generic settings store — not a font-specific table — designed so
that a future setting type (color, spacing, logo) is new data, not a new table or migration.

#### FR-6: Persist settings generically

Settings are persisted with at minimum: Key (stable identifier, unique per KeyType), Value,
KeyType, IsActive, plus CreatedAt/UpdatedAt/UpdatedBy audit fields.

**Consequences (testable):**
- The Font Pairing setting and any future non-font setting are rows in the same store,
  distinguished only by KeyType — not separate tables.

#### FR-7: KeyType is extensible without a migration

Introducing a new setting category (e.g. Color) requires adding new Key/KeyType rows through
the existing store, not a schema change.

**Consequences (testable):**
- A new KeyType can be introduced by data alone; no migration is required to support it,
  though a new admin UI to *edit* that KeyType is separate follow-up work (out of scope here).

#### FR-8: IsActive controls the effective value

When a Setting's IsActive is false, the system's Effective Value for that Key reverts to its
hardcoded default rather than the stored Value.

**Consequences (testable):**
- Toggling Font Pairing's IsActive to false renders the site with the original hardcoded
  Fraunces/Outfit/JetBrains Mono defaults, regardless of what Value is stored.

### 4.4 Font Pairing Setting (v1 setting type, first of two typography settings)

**Description:** The typeface half of v1's two typography setting types (Font Size is the
other, §4.7). Curated, not free-text, to respect the existing brand rule against a second
serif/sans-serif family.

#### FR-9: Curated font pairing picker

The Settings screen offers a fixed, pre-approved list of Font Pairings (each specifying
Display/Body/Mono roles) for selection — not a free-text font-name field.

**Consequences (testable):**
- The font picker UI is a selectable list, not a text input.
- Every pairing in the list is vetted by design before it can appear here; the initial
  approved list itself is not yet defined and is tracked as an open item (§7), not assumed to
  already exist in the addendum.

#### FR-10: Server-side curation enforcement

The system rejects any attempted Value for the Font KeyType that is not one of the currently
curated Font Pairing identifiers (FR-9) — enforced in the API/domain layer, not only in the
picker UI — including attempts made via a direct API call rather than the Settings screen.

**Consequences (testable):**
- A request that attempts to set the Font Setting's Value to a pairing identifier not present
  in the current curated list is rejected, regardless of which client made the request
  (subject to NFR-2's role check happening first).
- Removing a pairing from the curated list makes it immediately unavailable for new Applies
  and for restores (FR-17) — a historical entry referencing it can still be viewed but not
  reapplied until it's re-curated or a different pairing is chosen.

#### FR-11: Applying a pairing updates the Font Setting atomically

Confirming a Font Pairing selection updates a single Font-KeyType Setting row's Value to the
selected pairing's identifier — Display, Body, and Mono roles are resolved together from that
one identifier, not stored or toggled as separate rows.

**Consequences (testable):**
- After Apply, the Settings list (FR-5) reflects the newly selected pairing as the current
  Value of one Font Setting row.
- Toggling IsActive (FR-8) affects the whole pairing at once — there is no way to end up with
  a custom Display font paired against a default Body font.

#### FR-12: Runtime application without rebuild

An applied Font Pairing takes effect at runtime (on next page load) for any font already
available to the app, without a frontend rebuild or redeploy.

**Consequences (testable):**
- Applying a pairing composed only of fonts already linked in `index.html` changes the
  rendered typography on the next page load, with no deploy in between.
- Introducing a pairing that includes a font family not already loaded via `index.html` is out
  of scope for v1 — the curated list (FR-9) is restricted to already-available fonts.

### 4.5 Preview-Before-Apply

**Description:** No Setting change reaches the live site without an explicit, separate
confirmation step after seeing what it looks like.

#### FR-13: Live preview before commit

Selecting a candidate Font Pairing renders a live preview, in the Settings screen, against
representative site content (a heading, a body paragraph, a card) using that pairing — before
any change is committed.

**Consequences (testable):**
- Selecting a candidate pairing updates only the preview area; the rest of the application
  (this admin's own other tabs, and every other user) continues rendering the current live
  pairing.

#### FR-14: Explicit Apply required to commit

A previewed change only becomes the live, site-wide Effective Value after the admin takes a
distinct "Apply" action. Navigating away from an unapplied preview discards it.

**Consequences (testable):**
- Selecting a candidate pairing and then navigating away without clicking Apply leaves the
  stored Value and Effective Value unchanged.

### 4.6 Change History

**Description:** Every applied change is durably recorded and viewable, so a live setting's
provenance is never a mystery.

#### FR-15: Record every applied change

Every time a Setting's Value is applied (FR-14), the system records the Key, the
immediately-prior Value read fresh from the store at the moment of the write (not the admin's
possibly-stale page-load snapshot), the new Value, the admin who applied it, and a timestamp.

**Consequences (testable):**
- Applying a Font Pairing change produces exactly one new change-history entry with the
  correct before/after values, actor, and timestamp.

#### FR-16: View a setting's change history

The Settings screen provides a way to view a given Setting's history as a reverse-chronological
list.

**Consequences (testable):**
- Opening the Font KeyType's history shows every prior applied change, most recent first.

#### FR-17: One-click restore from history

An admin can restore a prior historical value as the new current value directly from the
history view, going through the same Preview (FR-13), Apply (FR-14), and curation check
(FR-10) steps as any other change — restoring is not a distinct, unaudited or unvalidated code
path.

**Consequences (testable):**
- Selecting a prior entry from history populates it as the preview candidate; Apply commits it
  as a new change-history entry (the restore itself is recorded, not just the original change).
- Restoring a historical Value that is no longer curated is rejected by that KeyType's own
  curation check (FR-10 for Font, FR-19 for FontSize), and the admin is prompted to choose a
  currently-curated option instead.

### 4.7 Font Size Setting (v1 setting type, second of two typography settings)

**Description:** A second, independent typography setting alongside Font Pairing (§4.4) — a
curated *proportional scale factor* applied to the site's root text size, not a per-role
(Display/Body/Mono) value. **This section was revised after Story 6.4's implementation research
verified an assumption the original draft had left unconfirmed** (see the superseded text
preserved in `addendum.md`'s memlog): `index.css` has no font-size custom properties, no
`tailwind.config` override exists, and Tailwind's default rem-based `text-*` scale is in full,
unmodified effect. There is no natural three-role split for size the way there is for family —
text sizing varies continuously per element through Tailwind's granular scale (`text-xs` through
`text-6xl`+), not through three semantic buckets. The accurate, minimally-invasive mechanism is a
single new CSS custom property driving the document root's `font-size` (e.g.
`html { font-size: var(--root-font-scale, 100%); }`, added once to `index.css`) — every
rem-based `text-*` utility across the entire app scales proportionally from that one value, with
no changes to any individual component. Reuses the same generic Setting model (§4.3),
Preview-Before-Apply mechanism (§4.5), and Change History mechanism (§4.6) already specified for
Font Pairing — introduces one new curated data set and one new KeyType, not new machinery.

#### FR-18: Curated font-size scale picker

The Settings screen offers a fixed, pre-approved list of Font Size scales — each a named
proportional root-scale factor (e.g. Compact/Default/Comfortable/Large) — for selection, not a
free-numeric-value field, mirroring FR-9's curation rationale for the same reason: an unbounded
numeric value risks illegible text or broken layout site-wide, where a vetted, curated scale
cannot.

**Consequences (testable):**
- The font-size picker UI is a selectable list, not a numeric input.
- Every scale in the list is vetted by design (checked against overflow/clipping/legibility at
  the app's supported breakpoints, per NFR-6) before it can appear here; the initial approved
  scale list — including its exact root-scale percentage per named option — is not yet
  specified and is tracked as an open item (§7), the same status FR-9's font-pairing list has.
- Each curated scale is vetted against every currently curated Font Pairing (not in isolation),
  per NFR-6 — Font Size and Font Pairing can be independently applied at the same time (FR-20),
  so a scale cleared only against the default pairing is not sufficiently vetted.
- Elements sized via a Tailwind arbitrary literal-pixel class (e.g. `text-[10px]`, which bypasses
  the relative type scale entirely) do not respond to this setting — a known, accepted gap, not
  a defect (see Non-Goals).

#### FR-19: Server-side curation enforcement for Font Size

The system rejects any attempted Value for the FontSize KeyType that is not one of the
currently curated Font Size scale identifiers — enforced in the API/domain layer, not only in
the picker UI — mirroring FR-10's enforcement, for the same reason: an uncurated size can break
the site's layout the way an uncurated font can break its branding.

**Consequences (testable):**
- A request attempting to set the FontSize Setting's Value to a scale identifier not present in
  the current curated list is rejected, regardless of which client made the request.
- Removing a scale from the curated list makes it immediately unavailable for new Applies and
  restores — the same behavior FR-10's second consequence describes, applied to the FontSize
  KeyType.

#### FR-20: Font Size is independent of Font Pairing

Font Size is a separate Setting row (KeyType `FontSize`) from Font Pairing (KeyType `Font`) —
changing one never affects the other's Value, IsActive state, or change history.

**Consequences (testable):**
- Toggling Font Size's IsActive to false reverts only the root-scale factor to its hardcoded
  default (100%), leaving the currently-applied Font Pairing untouched, and vice versa.
- The Settings list (FR-5) shows Font Pairing and Font Size as two distinct rows, each with its
  own history (FR-16); grouping them together visually under a shared "Typography" heading is a
  UI decision, not a data-model requirement.

#### FR-21: Font Size reuses the existing Preview/Apply/History mechanisms

Selecting a candidate Font Size scale follows the identical Preview (FR-13), Apply (FR-14),
curation-check (FR-19), and Change History (FR-15–FR-17) flow already specified for Font
Pairing — no parallel preview, apply, or history UI or backend path is introduced for Font Size.
Runtime application without rebuild reuses `SiteSettingsContext`'s existing
`setProperty`-on-`document.documentElement` mechanism (the same one FR-12 describes for Font
Pairing's three font-family custom properties), pointed at the one new `--root-font-scale`
custom property instead — the delivery mechanism is identical even though what it's driving
(one scalar vs. three font-family strings) differs.

**Consequences (testable):**
- Selecting a candidate Font Size scale renders a live preview in the Settings screen before any
  change is committed, exactly as FR-13 describes for Font Pairing.
- Applying a Font Size scale takes effect at runtime on next page load, no redeploy, via the same
  `document.documentElement` custom-property mechanism FR-12 describes for Font Pairing.

#### FR-22: A Font Size scale is a single, indivisible Setting Value

Confirming a Font Size scale selection updates a single FontSize-KeyType Setting row's Value to
the selected scale's identifier. Unlike Font Pairing (FR-11), there is no multi-role atomicity
concern to guard against here — a root-scale factor is one number, not several independently
mutable roles, so there is no possible partial-update state to prevent. This FR exists for
symmetry with FR-11 and to make that reasoning explicit, not because the same bug class is
possible for Font Size.

**Consequences (testable):**
- After Apply, the Settings list (FR-5) reflects the newly selected scale as the current Value
  of one FontSize Setting row.
- Toggling IsActive (FR-8) reverts the entire site to the 100% default in one action — there is
  no partial or mixed root-scale state possible.

## 5. Non-Functional Requirements

- **NFR-1 (Propagation):** An applied setting change SHALL be reflected for all users on their
  next page load/navigation; a hard real-time push (no navigation required) is not required
  for v1.
- **NFR-2 (Access control):** The Settings subtab and its underlying endpoints SHALL be
  unreachable by any role below Support, including by direct navigation or direct API call —
  not just hidden from navigation.
- **NFR-3 (Preview isolation):** A Preview SHALL be visible only to the admin who triggered it
  and SHALL have no observable effect on any other user's session or the live Effective Value
  until Apply is clicked.
- **NFR-4 (Fail-safe default):** If the settings store is unreachable, returns malformed or
  invalid data, or times out at page load, the system SHALL render using hardcoded defaults
  rather than failing to load.
- **NFR-5 (Concurrency):** Concurrent edits to the same Setting follow last-write-wins — the
  system does not detect or surface conflicts between two admins editing the same Setting.
  Deliberately kept simple for v1; revisit if multi-admin collisions become a real problem.
- **NFR-6 (Graceful sizing):** This is a pre-launch content-curation gate, not a runtime system
  behavior the built system can be tested against — the same nature as Font Pairing's
  `DESIGN.md`-sourced curation rule (FR-9), which lives in prose rather than as its own NFR for
  the identical reason. Before any Font Size scale is added to the curated list (FR-18), it
  SHALL be manually design-QA'd against representative content (FR-13's preview surface) and
  against every other currently curated Font Pairing (per FR-18's combinatorial-vetting
  consequence) to confirm no overflow, clipping, or illegible rendering results across a
  reasonable sample of the app's actual screens — not just the Preview surface, since a
  root-scale factor affects every screen in the app, not only the Settings page's own preview
  content. There is no runtime clamping/auto-fit fallback and no automated check — curation is
  the entire mechanism, and a scale that later turns out to break something is fixed by
  decurating it (FR-19), not by a system-level correction.

**Counter-metric:** Watch applied-change → revert-within-1-hour rate. A high rate suggests the
preview step (FR-13) isn't giving admins enough signal before they apply.

## 6. Success Metrics

- Time from "admin decides to change typography" to "change is live" drops from
  deploy-cycle-length (hours-to-days, engineering-mediated) to single-digit minutes,
  self-service.
- Zero engineering tickets filed for typography-only changes post-launch.
- See Counter-metric above (§5) for the corresponding downside signal to watch.
- **Measured via:** Change History (FR-15/FR-16) provides applied-change timestamps for both
  the adoption metric and the counter-metric; ticket volume is tracked externally in the
  team's existing support/engineering ticket system, not by this feature. Both metrics and the
  counter-metric are tracked per-Key (Font Pairing and Font Size counted separately, each
  attributable via its own Change History rows) — not combined into one typography-wide number.

### Non-Goals (v1)

Collected here for scannability; each also appears inline at its point of relevance.

- Editing a KeyType's curated list content through the Settings UI (FR-7) — the UI to add/remove
  curated Font Pairings or Font Size scales is separate follow-up work, not built here; curated
  lists are seeded/managed outside this UI for v1.
- A Font Pairing that includes a font family not already loaded via `index.html` (FR-12).
- Colors, spacing, or logo as an editable setting type (§1) — the store is generic enough to
  hold them later; no UI for them ships in this PRD.
- Hard real-time push of a setting change to already-open sessions (NFR-1) — next-page-load
  propagation only.
- Conflict detection between two admins editing the same Setting concurrently (NFR-5).
- Automated/runtime detection of a curated Font Size scale that turns out to break layout after
  being curated (NFR-6) — decurating it (FR-19) is the only corrective mechanism.
- Font Size affecting elements sized via a Tailwind arbitrary literal-pixel class (e.g.
  `text-[10px]`), which bypasses the relative type scale entirely — only elements sized through
  the standard `text-xs`…`text-6xl`+ scale respond to this setting (FR-18).

## 7. Open Items

- `[NOTE FOR PM]` The initial curated Font Pairing list (names/values) is not specified in this
  PRD — it requires a short design pass and lives in `addendum.md` once available.
- `[NOTE FOR PM]` The initial curated Font Size scale list (named options and their exact
  root-scale percentages, e.g. Compact/Default/Comfortable/Large) is not specified in this PRD —
  it requires the same short design pass as the Font Pairing list (NFR-6), including the
  breakpoint/overflow QA check across a representative sample of the app's actual screens (not
  just the Settings preview surface, since this is a root-level scale affecting every screen),
  and lives in `addendum.md` once available.
- A Setting that is actively `IsActive` and later has its Value decurated (its identifier
  removed from the curated list, FR-10/FR-19) has no defined behavior — does the site keep
  rendering the now-uncurated value (grandfathered) until an admin explicitly changes it, or is
  there a forced fallback? This gap predates this amendment (it already applied to Font
  Pairing) and is not resolved here; flagged because adding a second independently-curatable
  KeyType (Font Size) doubles its practical exposure without changing its status as an
  unresolved, non-blocking open item.
