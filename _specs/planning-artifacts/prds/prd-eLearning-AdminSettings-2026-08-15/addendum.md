# Addendum — Admin Settings & Runtime UI Configuration

Technical grounding and mechanism notes gathered during PRD research. Not part of the PRD
narrative; for the architecture/dev handoff.

## Current codebase facts (verified 2026-08-15)

- **Stack:** .NET 10 / ASP.NET Core Web API, Clean Architecture (`FlexDemy.Api` /
  `.Application` / `.Domain` / `.Infrastructure`), EF Core 10 targeting PostgreSQL via Npgsql,
  `EFCore.NamingConventions` for snake_case columns. Migrations live in
  `BackEnd/src/FlexDemy.Infrastructure/Persistence/Migrations/`. Frontend: React/TS/Vite,
  Tailwind v4 (CSS-first, `@theme` in `FrontEnd/src/index.css`).
- **Admin Panel:** `FrontEnd/src/features/Admin/AdminPanel.tsx`, subtabs driven by
  `useAdminPanel.ts` (`AdminSubTab` type). Current tabs: `masterdata`, `support-users`,
  `role-visibility`, `tutor-approvals`, `ai-configuration`, `errors`. A `settings` entry
  follows the exact same wiring pattern as `ai-configuration`.
- **Course Wizard button today:** `FrontEnd/src/features/Dashboard/TeachingStatsCards.tsx`
  (lines ~35-47), a "Course Creation" stat card with a `Plus` icon, rendered above
  `MyCoursesSection.tsx` inside `TutorEducatorHubView.tsx` (stats at line ~81, My Courses at
  line ~91). Wizard itself opens via `courseCreationFlow.openWizard` from
  `useCourseCreationFlow.ts` — unchanged by this PRD.
- **Typography today:** CSS custom properties in `FrontEnd/src/index.css` under `@theme`:
  `--font-display: "Fraunces"...`, `--font-sans: "Outfit"...`, `--font-mono: "JetBrains
  Mono"...`. Fonts loaded via Google Fonts `<link>` in `FrontEnd/index.html`. Runtime override
  is feasible by injecting a `<style>` tag (or setting `document.documentElement.style`) for
  these custom properties from settings fetched at app load — no rebuild required, as long as
  the target font is already `<link>`-loaded. A font not already loaded would need dynamic
  `<link>`/`@font-face` injection (explicitly out of v1 scope per PRD FR-12).
  `DESIGN.md` hard rule (line ~273): "Don't introduce a second serif or a second sans-serif
  family — no exceptions per-feature" — this is why FR-10 mandates a curated list, not free
  text.

## Precedents to model the new table on — SUPERSEDED, see "Current implementation state" below

The precedents originally listed here (`ErrorRetentionSettings`, `AiTaskConfig`) were the
pre-implementation grounding for what became `Setting`/`SettingsService`/`SettingsController`,
which now exist and are the actual thing to extend — not a precedent to model a new table on.
Kept below for history; a Story 6.4 implementer should read "Current implementation state"
instead.

## Current implementation state (verified against the repo, post-Story-6.1/6.2/6.3)

Epic 6 (Stories 6.1–6.3) has already built the generic Setting model and Font Pairing end to
end, in review status but not yet merged/committed. Font Size (this amendment) extends the same
code, not new machinery:

- **`Setting`** (`BackEnd/src/FlexDemy.Domain/Settings/Setting.cs`) — the generic Key/Value/
  KeyType/IsActive row this PRD's FR-6 specifies. `SettingConfiguration.cs` enforces a
  composite unique index on `(Key, KeyType)`.
- **`SettingsService`/`ISettingsService`** (`BackEnd/src/FlexDemy.Application/Settings/`) —
  owns `ApplyAsync` (the exclusive mutation path, FR-14), curation enforcement for the `Font`
  KeyType (FR-10), and `GetHistoryAsync` (FR-16). A `FontSize` branch in the same curation
  check is the natural extension point for FR-19 — see `ApplyAsync`'s `KeyType == "Font"`
  branch in the current code.
- **`SettingsController`** (`BackEnd/src/FlexDemy.Api/Controllers/SettingsController.cs`) —
  `[Route("api/v1/settings")]`, sub-routes `GET /font-pairings`, `PUT /{id}/apply`,
  `GET /{id}/history`, and (added during Epic 6's combined code-review fix pass, after a
  critical bug where `SiteSettingsContext` called the admin-gated routes above and got 401/403
  for every non-Master/Support visitor) `GET /effective-fonts` with `[AllowAnonymous]` on that
  one action — resolves the active Font Pairing server-side and returns only the three resolved
  font-family strings, not admin-shaped data. A `GET /font-sizes` sub-route mirroring
  `/font-pairings` is the natural Story 6.4 addition; `GetEffectiveFontsAsync`/`EffectiveFontsDto`
  should be extended to also resolve/return the effective font-size scale factor, keeping the
  same "one minimal public endpoint" design rather than adding a second public route.
- **Font Size mechanism — verified during Story 6.4's own research, corrects an earlier
  reviewer-gate assumption:** `index.css` has zero font-size CSS custom properties (only
  `--font-display`/`--font-sans`/`--font-mono` for family) and no `tailwind.config` override
  exists — Tailwind's default rem-based `text-*` scale is in full, unmodified effect across the
  whole app. There is no natural Display/Body/Mono role split for font *size* the way there is
  for font *family*. The correct, minimally-invasive mechanism: one new CSS custom property
  driving the document root's font-size (`html { font-size: var(--root-font-scale, 100%); }`,
  added once to `index.css`), which proportionally scales every rem-based `text-*` utility
  site-wide with zero changes to any component. `SiteSettingsContext` applies it via the exact
  same `document.documentElement.style.setProperty(...)` mechanism already used for the three
  font-family properties, just pointed at this one new property instead. Known limitation:
  elements sized via a Tailwind arbitrary literal-pixel class (`text-[10px]` and similar) bypass
  the relative scale entirely and won't respond — an accepted PRD Non-Goal, not a defect to fix.
- **`SettingChangeHistory`** (`BackEnd/src/FlexDemy.Domain/Settings/SettingChangeHistory.cs`) —
  the append-only Change History row (FR-15). KeyType-agnostic already — no changes needed for
  a new KeyType to get history for free.
- **Curated-list storage mechanism — this addendum's own open question, now answered by code:**
  Font Pairing's curated list is **not** a second KeyType in the generic Setting table — it's a
  separate reference table, `FontPairingDefinition`
  (`BackEnd/src/FlexDemy.Domain/Settings/FontPairingDefinition.cs`, table
  `font_pairing_definitions`), with its own repository and a dedicated
  `GET /api/v1/settings/font-pairings` read endpoint, closer to the `AiTaskConfig`/
  `ErrorRetentionSettings` seeded-reference-table pattern than to the generic Setting store
  itself. **Font Size's curated list should follow the identical shape** — a new
  `FontSizeDefinition` reference table (own migration, own repository, own
  `GET /font-sizes` endpoint) — not a second KeyType inside the generic store. This resolves
  the open question below in favor of "separate reference table," now that real code exists to
  confirm which of the two originally-considered options was actually built.
- **Frontend:** `SiteSettingsContext.tsx` (`FrontEnd/src/context/`) fetches Settings +
  FontPairingDefinitions at boot and applies the active Font Pairing via
  `document.documentElement.style.setProperty('--font-display'/'--font-sans'/'--font-mono', ...)`,
  with fail-safe defaults (NFR-4) if the fetch fails or the Value doesn't resolve. `Settings.tsx`
  (`FrontEnd/src/features/Admin/Settings/`) holds the curated picker, scoped Preview (a wrapper
  `style` override + explicit per-child `fontFamily`, not global custom-property mutation —
  isolation is structural, not conventional), and Apply/history/restore UI. **Whether font
  *size* is expressed via an equivalently small set of CSS custom properties (vs. Tailwind's
  baked-in `text-*` utility classes) has not been verified** — this is the PRD's `[ASSUMPTION]`
  under FR-21; check `index.css`'s actual `@theme` block and how `text-*` sizes are consumed
  across components before assuming `SiteSettingsContext`'s font-pairing mechanism transfers
  directly to font size.

## Options considered (rejected/deferred, not in PRD)

- **Fully open font text input** — rejected in favor of curated dropdown (see PRD §4.4) because
  it would let an admin silently violate the `DESIGN.md` "no second font family" rule with no
  guardrail.
- **Font-specific settings table** (narrower than generic Key/Value) — rejected per explicit
  user direction: the table must be generic enough to hold "other setting[s] also from the
  site," not just fonts, to avoid a second migration when the next setting type (color,
  spacing, logo) is added.
- **Hard real-time push of setting changes** (no navigation required) — deferred out of v1
  (NFR-1 only requires next-page-load propagation). A future version could add this via
  SignalR/WebSockets if live-editing sessions become a real pain point; no such mechanism
  exists in the codebase today.
- **Concurrent-edit conflict detection** (optimistic concurrency on Setting updates) — proposed
  during drafting, explicitly rejected by the user to keep v1 simple; resulting behavior is
  documented in PRD NFR-5.

## Reviewer-gate findings applied (2026-08-15)

Three parallel reviewers (PRD-quality rubric, edge-case hunter, adversarial-general) converged
independently on one structural gap: the PRD originally treated a Font Pairing as three
separate per-role Setting rows (Display/Body/Mono Keys), which broke IsActive atomicity,
change-history entry counting, and restore-vs-curated-list integrity all at once. Fixed by
making Font Pairing a single Setting row whose Value is a pairing identifier (PRD FR-11).

## Open Questions for Architecture/Design (not blocking PRD finalize, needed before build)

- **Curated Font Pairing list content** (which Display/Body/Mono combinations are pre-approved)
  is not yet defined — needs a short design pass before FR-9 can be implemented. Tracked as a
  `[NOTE FOR PM]` in PRD §7.
- **Curated Font Size scale list content** (which named scales are pre-approved, and what
  relative sizes each sets for the Display/Body/Mono roles) is not yet defined — needs the same
  short design pass, plus the breakpoint/overflow QA check NFR-6 requires, before FR-18 can be
  implemented. Tracked as a `[NOTE FOR PM]` in PRD §7. Storage mechanism is resolved: a
  `FontSizeDefinition` reference table mirroring `FontPairingDefinition`'s shape (see "Current
  implementation state" above) — no separate design decision needed here.
- **Curated list storage mechanism — RESOLVED (see "Current implementation state" above).** A
  small static/seeded reference table separate from the generic settings store
  (`FontPairingDefinition`, closer to the `AiTaskConfig`/`ErrorRetentionSettings` seeding
  pattern) is what was actually built for Font Pairing. Font Size's curated list should follow
  the identical shape (`FontSizeDefinition`).
