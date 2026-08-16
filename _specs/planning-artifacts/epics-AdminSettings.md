---
stepsCompleted: [1, 2, 3]
inputDocuments: ['{planning_artifacts}/prds/prd-eLearning-AdminSettings-2026-08-15/prd.md', '{planning_artifacts}/prds/prd-eLearning-AdminSettings-2026-08-15/addendum.md', '{planning_artifacts}/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md', '{planning_artifacts}/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md']
---

# eLearning (Admin Settings) - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the Admin Settings &
Runtime UI Configuration feature (incl. Course Wizard button relocation), decomposing the
requirements from `prd-eLearning-AdminSettings-2026-08-15` and the backend/frontend
Architecture Spine updates (AD-25 through AD-27, AD-8) into implementable stories. No UX
design contract exists for this feature (not run for this PRD).

## Requirements Inventory

### Functional Requirements

FR1: The "New Course Wizard" trigger is removed from the Teaching stats-card row and rendered instead in the My Courses (Tutor) section, positioned on the right-hand side of that section's header/toolbar area. The persistent left-nav "Course Publishing" link (which scroll-jumps to `id="course-publishing"` today) continues to resolve to a valid target after relocation.
FR2: The relocated trigger opens the same New Course Wizard flow that exists today — no change to steps, validation, or the wizard's own UI.
FR3: The My Courses (Tutor) empty-state copy is updated to match the trigger's new position.
FR4: A new "Settings" subtab is added to the Admin Panel's subtab set, visible only to users with Master or Support role — the same access level as Tutor Approvals.
FR5: The Settings screen lists every Setting grouped by KeyType, showing each one's current Value, IsActive state, and when/by whom it was last changed.
FR6: Settings are persisted generically — Key (unique per KeyType), Value, KeyType, IsActive, plus audit fields — not a font-specific table.
FR7: Introducing a new setting category (e.g. Color) requires only new Key/KeyType rows through the existing store, not a schema change.
FR8: When a Setting's IsActive is false, the system's Effective Value for that Key reverts to its hardcoded default rather than the stored Value.
FR9: The Settings screen offers a fixed, pre-approved list of Font Pairings (Display/Body/Mono roles) for selection — not a free-text font-name field.
FR10: The system rejects any attempted Value for the Font KeyType that is not one of the currently curated Font Pairing identifiers — enforced server-side (API/domain layer), not only in the picker UI.
FR11: An applied Font Pairing takes effect at runtime (next page load) for any font already available to the app, without a frontend rebuild or redeploy. A pairing including a font family not already loaded via `index.html` is out of scope for v1.
FR12: Selecting a candidate Font Pairing renders a live preview, in the Settings screen, against representative site content — before any change is committed.
FR13: A previewed change only becomes the live, site-wide Effective Value after the admin takes a distinct "Apply" action. Navigating away from an unapplied preview discards it.
FR14: Every time a Setting's Value is applied, the system records the Key, the immediately-prior Value read fresh at write time, the new Value, the admin who applied it, and a timestamp.
FR15: The Settings screen provides a way to view a given Setting's history as a reverse-chronological list.
FR16: An admin can restore a prior historical value as the new current value directly from the history view, going through the same Preview, Apply, and curation-check steps as any other change. Restoring a value that is no longer a currently curated pairing is rejected the same way a direct write of an uncurated value would be.
FR17: The Settings screen offers a fixed, pre-approved list of Font Size scales — each a named proportional root-scale factor (not a per-role Display/Body/Mono value) — for selection, not a free-numeric-value field.
FR18: The system rejects any attempted Value for the FontSize KeyType that is not one of the currently curated Font Size scale identifiers — enforced server-side, not only in the picker UI.
FR19: Font Size is a separate Setting row (KeyType `FontSize`) from Font Pairing (KeyType `Font`) — changing one never affects the other's Value, IsActive state, or change history.
FR20: Font Size reuses the existing Preview, Apply, curation-check, and Change History mechanisms already built for Font Pairing — no parallel preview/apply/history UI or backend path.
FR21: A Font Size scale is a single, indivisible Setting Value — a proportional root-scale factor, not several independently mutable roles, so there is no multi-role atomicity concern the way Font Pairing's Display/Body/Mono roles have.

### NonFunctional Requirements

NFR1: An applied setting change is reflected for all users on their next page load/navigation; a hard real-time push is not required for v1.
NFR2: The Settings subtab and its underlying endpoints are unreachable by any role below Support, including by direct navigation or direct API call.
NFR3: A Preview is visible only to the admin who triggered it and has no observable effect on any other user's session or the live Effective Value until Apply is clicked.
NFR4: If the settings store is unreachable, returns malformed/invalid data, or times out at page load, the system renders using hardcoded defaults rather than failing to load.
NFR5: Concurrent edits to the same Setting follow last-write-wins — no conflict detection between two admins editing the same Setting (deliberately kept simple for v1).

### Additional Requirements

- Backend: new `Settings` feature folder (Domain/Application/Infrastructure/Api, AD-6 shape) with `Setting`, `SettingChangeHistory`, and `FontPairingDefinition` entities — each with a GUIDv7 `Id` via `IIdGenerator` (AD-9). `Setting.Key` is unique per `KeyType` (composite index); `KeyType` is a plain string column, not an enum (AD-25).
- Backend: `ISettingsService.ApplyAsync` is the exclusive mutation path for a Setting's Value — no separate generic `UpdateAsync`; reactivating `IsActive` false→true re-runs the same curation check as a fresh Apply (AD-25).
- Backend: `SettingChangeHistory.OldValue` is captured via an atomic single-round-trip `UPDATE ... RETURNING` (same pattern as AD-18's budget counter), not a separate load-then-save (AD-25).
- Backend: `DatabaseSeeder` seeds the initial Font `Setting` row and the initial `FontPairingDefinition` rows (same seeding mechanism as `ErrorRetentionSettings`/`AiTaskConfig`) (AD-25, AD-26).
- Backend: new `GET /api/v1/settings/font-pairings` endpoint exposes the curated list; `SettingDto`'s Font-KeyType Value stays the raw pairing slug, never resolved font names (AD-26).
- Backend: new `FeatureKeys.SettingsManage` permission key, seeded for both Master and Support (matching `FeatureKeys.TutorApprove`'s pattern, not `FeatureKeys.MasterDataManage`'s Master-only pattern) — `SettingsController` gated at class level (AD-27).
- Frontend: new `SiteSettingsContext` (`context/SiteSettingsContext.tsx`), separate from `DomainContext`, created at the `App.tsx` composition root — fetches active `Setting` rows once at boot via new `services/settingsService.ts`, applies the active Font Pairing via `document.documentElement.style.setProperty(...)` per CSS custom property (AD-8).
- Frontend: Preview and Apply are structurally separate mechanisms — Preview scopes its candidate font to a local wrapper element's inline style (never touching `document.documentElement`); only Apply persists via `settingsService.ts` and updates `SiteSettingsContext` (AD-8).
- Frontend: boot-fetch failure or an unresolvable Value is fail-safe by design — `SiteSettingsContext` skips `setProperty` entirely, leaving `index.css`'s hardcoded `@theme` defaults in effect (AD-8, satisfies NFR4).
- Frontend: new `features/Admin/Settings/` subtab with its own colocated `useSettings.ts` hook (AD-2); `SiteSettingsContext` also exposes a `useSiteSettings()` hook (`{data, isLoading, error}`) for future non-CSS-representable settings (AD-8).
- No starter template applies — brownfield addition to the existing FlexDemy Clean Architecture (.NET 10) / React feature-folder (Vite/Tailwind v4) stack.
- Backend: Font Size's curated list follows the identical shape Font Pairing already established — a new `FontSizeDefinition` reference table (own migration, own repository, own `GET /api/v1/settings/font-sizes` endpoint) mirroring `FontPairingDefinition` exactly, not a second KeyType inside the generic Setting store — confirmed against Font Pairing's actual shipped implementation, not assumed.
- Backend: `SettingsService.ApplyAsync`'s curation-check branch gets a `KeyType == "FontSize"` sibling alongside the existing `KeyType == "Font"` branch.
- Backend: the public `GET /api/v1/settings/effective-fonts` endpoint (added during Epic 6's code-review fix pass, `[AllowAnonymous]`, resolves the active Font Pairing server-side into three font-family strings) currently only resolves Font Pairing — extending it to also resolve/include the effective Font Size scale is this story's job, keeping the same "one minimal public endpoint, no admin-shaped data" design that fix established rather than adding a second public endpoint.
- Frontend: **verified, not assumed** — `index.css` has zero font-size CSS custom properties and no `tailwind.config` override exists; Tailwind's default rem-based `text-*` scale is in full, unmodified effect app-wide. There is no Display/Body/Mono role split for size the way there is for family. Mechanism: one new `--root-font-scale` CSS custom property on `html { font-size: ...; }` (added once to `index.css`), applied via the exact same `document.documentElement.style.setProperty(...)` pattern `SiteSettingsContext` already uses for the three font-family properties — every rem-based `text-*` utility scales proportionally, no component changes needed. Known, accepted gap: elements sized via a Tailwind arbitrary literal-pixel class (`text-[10px]` etc.) bypass the relative scale and won't respond (PRD Non-Goal, not a defect).

### UX Design Requirements

None — no UX design contract exists for this feature (bmad-ux was not run for `prd-eLearning-AdminSettings-2026-08-15`).

### FR Coverage Map

FR1: Epic 5 - Relocate wizard trigger + preserve nav anchor
FR2: Epic 5 - Preserve existing wizard behavior
FR3: Epic 5 - Update empty-state copy
FR4: Epic 6 - Add Settings subtab (Master+Support)
FR5: Epic 6 - List settings by KeyType
FR6: Epic 6 - Generic settings persistence
FR7: Epic 6 - KeyType extensible without migration
FR8: Epic 6 - IsActive controls effective value
FR9: Epic 6 - Curated font pairing picker
FR10: Epic 6 - Server-side curation enforcement
FR11: Epic 6 - Runtime application without rebuild
FR12: Epic 6 - Live preview before commit
FR13: Epic 6 - Explicit Apply required
FR14: Epic 6 - Record every applied change
FR15: Epic 6 - View change history
FR16: Epic 6 - One-click restore from history
FR17: Epic 6 - Curated font-size scale picker
FR18: Epic 6 - Server-side curation enforcement for Font Size
FR19: Epic 6 - Font Size independent of Font Pairing
FR20: Epic 6 - Font Size reuses Preview/Apply/History mechanisms
FR21: Epic 6 - Font Size atomic resolution

## Epic List

### Epic 5: My Courses — Faster Course Creation Access
Tutors find the "New Course Wizard" trigger right where they manage their courses, not in an
unrelated stats row — a small, complete, standalone UI improvement.
**FRs covered:** FR1, FR2, FR3

### Epic 6: Admin Settings — Runtime Site Configuration
Master and Support admins can change approved site-wide UI settings (starting with
typography) at runtime — safely, with a preview before anything goes live, a full change
history, and the ability to restore a prior value — without filing an engineering ticket or
waiting on a deploy. Story sequencing within this epic follows dependency order (data model +
curation before picker UI, before preview/apply, before history/restore), not PRD FR order —
per the architecture's own FR10-before-FR12/13 constraint (Apply calls the curation check FR10
establishes) confirmed during party-mode review. Story 6.4 (Font Size) was added after 6.1-6.3
shipped, in response to a user follow-up request — it deliberately reuses 6.1-6.3's generic
Setting model and Preview/Apply/History/curation machinery rather than building anything new.
**FRs covered:** FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17,
FR18, FR19, FR20, FR21

## Epic 5: My Courses — Faster Course Creation Access

Tutors find the "New Course Wizard" trigger where they manage their courses, not in an
unrelated stats row.

### Story 5.1: Relocate the New Course Wizard trigger into My Courses

As a tutor,
I want the "New Course Wizard" trigger next to the courses I already manage,
So that I don't have to look for it in an unrelated stats row.

**Acceptance Criteria:**

**Given** I am a tutor viewing the Tutor Hub
**When** I look at the My Courses section
**Then** the "New Course Wizard" trigger renders on the right-hand side of that section's
header, and the Teaching stats-card row no longer contains a course-creation trigger

**Given** the relocated trigger
**When** I click it
**Then** it opens the identical New Course Wizard flow that exists today, with no change to
steps, validation, or wizard UI (FR2)

**Given** the persistent left-nav "Course Publishing" link, which today scroll-jumps to
`id="course-publishing"`
**When** the trigger relocates
**Then** that link still resolves to a valid, visible target — either the anchor moves with the
trigger or the link's target is updated (FR1)

**Given** I am a tutor with zero courses
**When** I view the empty My Courses state
**Then** its copy correctly points at the trigger's new location, not "above" (FR3)

## Epic 6: Admin Settings — Runtime Site Configuration

Master and Support admins can change approved site-wide UI settings (starting with
typography) at runtime — safely, with a preview before anything goes live, a full change
history, and the ability to restore a prior value — without filing an engineering ticket or
waiting on a deploy.

### Story 6.1: Settings subtab with the generic settings data model

As a Master or Support admin,
I want a Settings subtab that lists the site's current settings,
So that I can see what's configurable before changing anything.

**Acceptance Criteria:**

**Given** I am a Master or Support admin
**When** I open the Admin Panel
**Then** I see a "Settings" subtab, gated the same way Tutor Approvals is (FR4, NFR2)

**Given** I am an admin below Support tier
**When** I try to reach the Settings subtab, including by direct navigation or direct API call
**Then** I am denied access (NFR2)

**Given** the Settings subtab
**When** it loads
**Then** it lists every Setting grouped by KeyType, showing current Value, IsActive state, and
when/by whom it was last changed (FR5)

**Given** the underlying data store
**When** a Setting is persisted
**Then** it is a generic row (Key unique per KeyType, Value, KeyType, IsActive, audit fields) —
not a font-specific table (FR6, FR7)

**Given** a Setting whose IsActive is false
**When** the system resolves its Effective Value
**Then** it reverts to the hardcoded default for that Key, not the stored Value (FR8)

### Story 6.2: Curated font pairing picker with preview-before-apply

As a Master or Support admin,
I want to preview a candidate font pairing and only apply it after confirming,
So that I can change the site's typography without accidentally breaking the brand system or
affecting the live site before I'm sure.

**Acceptance Criteria:**

**Given** the Settings screen
**When** I open the font picker
**Then** I see a fixed, pre-approved list of Font Pairings — a selectable list, not a free-text
field (FR9)

**Given** I select a candidate pairing
**When** it renders
**Then** a live preview shows it against representative site content, in the Settings screen
itself, with no effect on the live site or any other user (FR12, NFR3)

**Given** a previewed candidate
**When** I navigate away without clicking Apply
**Then** nothing is saved — the stored Value and Effective Value are unchanged (FR13)

**Given** a previewed candidate
**When** I click Apply
**Then** it becomes the live, site-wide Effective Value on next page load, using only fonts
already available to the app, with no rebuild or redeploy (FR11, FR13)

**Given** any attempt to set the Font setting's Value — via the picker or a direct API call
**When** the value isn't one of the currently curated pairing identifiers
**Then** the system rejects it server-side, not just in the picker UI (FR10)

### Story 6.3: Change history and one-click restore

As a Master or Support admin,
I want to see what changed on a setting and restore a prior value,
So that a bad or unexplained change can be traced and undone without guessing.

**Acceptance Criteria:**

**Given** an admin applies a change to a Setting (Story 6.2's Apply)
**When** it commits
**Then** exactly one change-history entry is recorded with the Key, the freshly-read prior
Value, the new Value, the admin who applied it, and a timestamp (FR14)

**Given** the Settings screen
**When** I open a Setting's history
**Then** I see every prior applied change as a reverse-chronological list (FR15)

**Given** a prior entry in that history
**When** I select it to restore
**Then** it populates as the preview candidate, going through the same Preview and Apply steps
as any other change — and if it's no longer a currently curated pairing, restoring it is
rejected the same way an uncurated direct write would be (FR16, FR10)

**Given** the settings store is unreachable, returns malformed data, or times out at page load
**When** the app renders
**Then** it falls back to hardcoded defaults rather than failing to load (NFR4)

### Story 6.4: Curated font-size scale with the same preview/apply/history flow

As a Master or Support admin,
I want to preview a candidate font-size scale and only apply it after confirming, the same way
I already do for font pairing,
So that I can adjust text sizing site-wide without accidentally breaking legibility or layout,
or affecting the live site before I'm sure.

**Acceptance Criteria:**

**Given** the Settings screen
**When** I open the font-size picker
**Then** I see a fixed, pre-approved list of Font Size scales — a selectable list, not a
free-numeric-value field (FR17)

**Given** any attempt to set the FontSize setting's Value — via the picker or a direct API call
**When** the value isn't one of the currently curated scale identifiers
**Then** the system rejects it server-side, not just in the picker UI (FR18)

**Given** Font Size and Font Pairing
**When** I change one
**Then** the other's Value, IsActive state, and change history are completely unaffected (FR19)

**Given** a candidate Font Size scale
**When** I select it, preview it, and click Apply
**Then** it goes through the exact same Preview, Apply, curation-check, and Change History
mechanisms already built for Font Pairing — no new preview/apply/history UI or backend path
(FR20)

**Given** a Font Size scale selection is confirmed
**When** it's applied
**Then** it updates a single FontSize-KeyType Setting row's Value — a proportional root-scale
factor, not several independently mutable roles — so there is no partial-update state possible
(FR21)
