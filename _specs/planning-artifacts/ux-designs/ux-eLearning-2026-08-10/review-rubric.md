# Spine Pair Review — FlexDemy

## Overall verdict
This spine pair is mechanically sound and largely load-bearing: every `sources` entry resolves to a real PRD, all four source User Journeys are faithfully mirrored into Key Flows with named protagonists and verbatim-consistent edge cases, and every `{...}` token/section reference in EXPERIENCE.md resolves cleanly to a real DESIGN.md frontmatter token or header. The weak point is State Patterns coverage — roughly half the Information Architecture surfaces (Home/Discover, Course Overview, Group Study, Certificates, Admin, Auth, the Profile funnel's own states) have zero explicit state treatment, and a handful of composite components used behaviorally in EXPERIENCE.md (Course card, Booking grid, Toast, Dashboard section nav) never get a matching visual row in DESIGN.md. Neither issue breaks a source-extraction pass, but both leave real gaps a downstream consumer would have to invent on their own.

## 1. Flow coverage — strong
Checked all four source User Journeys (Dashboard PRD UJ-1/UJ-2, Assignments PRD UJ-1/UJ-2) against EXPERIENCE.md's Key Flows. Each has a named protagonist, numbered steps, an explicit `**Climax:**` beat, and an edge case faithfully mirrored from (not dropped from) the source PRD's own UJ edge case / Consequences text.
### Findings
No misses.

## 2. Token completeness — adequate
Extracted all 16 color, 7 typography, 6 rounded, 6 spacing, and 11 component tokens from DESIGN.md frontmatter, and every `{path.to.token}` reference in both files' prose (via grep, not just visual scan). All referenced tokens resolve to real frontmatter definitions and every color has a hex value — no critical misses. Gaps run the other direction: a few frontmatter tokens are defined but never explained or referenced in prose.
### Findings
- **medium** `colors.surface-secondary` and `colors.dark-canvas` (DESIGN.md frontmatter lines 17–18) are defined with hex values but never mentioned anywhere in the Colors prose section, which otherwise explains all other 14 color tokens' usage rules. In an otherwise fully-annotated "which color means what" system, these two are unexplained — `dark-canvas` is especially conspicuous in a system explicitly described as "light-theme." (DESIGN.md Colors section, lines 143–153). *Fix:* add a usage bullet for each, or remove if dead.
- **low** `rounded.md` (0.75rem) is value-identical to `rounded.DEFAULT` (0.75rem); neither `rounded.sm` nor `rounded.md` is ever referenced via `{rounded.*}` in prose — the Shapes section only documents DEFAULT/lg/xl/full (DESIGN.md lines 65–71, 179–183). *Fix:* clarify whether `rounded.md` is an intentional alias or leftover duplicate.
- **low** `spacing.unit` and `spacing.icon-well` are defined in frontmatter but never cited via `{spacing.*}` bracket notation in prose — "icon well" is discussed descriptively (Components → Stat card) without citing the token (DESIGN.md line 190). *Fix:* cite `{spacing.icon-well}` at that mention, or fold the token away.

## 3. Component coverage — adequate
Extracted every component name from DESIGN.md.Components and EXPERIENCE.md.Component Patterns and cross-checked both directions. The core primitives (buttons, stat/section/hero cards, badge-pill, modal, input, nav-desktop/mobile) all have real behavioral rules on both sides. Several screen-specific composite components used in EXPERIENCE.md have no DESIGN.md visual anchor at all.
### Findings
- **medium** "Dashboard section nav" has a full row in EXPERIENCE.md.Component Patterns and is discussed at length in DESIGN.md's Do's and Don'ts (the `DashboardSectionNav.tsx` responsive fix), but has no dedicated visual-spec row in DESIGN.md.Components — no color/shape/spacing token distinguishes it from `nav-desktop`/`nav-mobile`, which per EXPERIENCE.md's own "Left-nav ↔ top-nav relationship" row are explicitly a *different* (primary) nav component. (DESIGN.md lines 187–196, 206; EXPERIENCE.md line 60). *Fix:* add a `dashboard-section-nav` component entry.
- **medium** No Toast/notification component is defined anywhere in DESIGN.md (no color, elevation, or shape entry), despite Toasts being a named, detailed interaction primitive in EXPERIENCE.md — including the special persistent `AppointmentToast` countdown that behaves differently from ordinary toasts. (EXPERIENCE.md lines 89, 96–100; DESIGN.md has no matching entry). *Fix:* add a toast component row (default + persistent variant).
- **low** Course card, Booking slot table/grid, and Public Live Masterclass card each have EXPERIENCE.md.Component Patterns rows but no matching DESIGN.md.Components row. They likely compose from `card-stat`/`card-section`/`badge-pill` primitives already defined, but that inheritance is implicit, not stated. (EXPERIENCE.md lines 62, 67–68). *Fix:* either add explicit rows, or add one line noting these compose from existing primitives.

## 4. State coverage — thin
Walked every surface in the Information Architecture table and listed plausible states (empty, cold-load, error, permission-denied) against EXPERIENCE.md.State Patterns. Roughly half the IA surfaces have zero explicit coverage.
### Findings
- **high** Home (Discover) — course catalog browse/search/filter has no State Patterns row at all: no empty-search-results state, no cold-load/skeleton state, no fetch-error state. (IA table row "Home (Discover)," EXPERIENCE.md line 26; no matching State Patterns row). *Fix:* add rows for empty search results and catalog load state.
- **high** Group Study — a full top-level IA surface (synchronous peer rooms: live shared reader, whiteboard, chat) has zero State Patterns coverage: no empty-room state, no connection-loss/reconnect state for the real-time features, no permission-denied. (IA table row "Group Study," EXPERIENCE.md line 30). *Fix:* add rows for empty/offline/reconnect states.
- **medium** Course Overview — no State Patterns row despite housing progress, notes, and reviews, each plausibly having an empty state (no notes yet, no reviews yet). (EXPERIENCE.md line 28). *Fix:* add rows.
- **medium** Auth (Login/Sign Up/Forgot Password) — no error-state row for invalid credentials, signup validation, or password-reset flow; only the inverse case ("Network/session error on refresh → falls back to Login") is covered. (EXPERIENCE.md line 33, 85). *Fix:* add Auth error-state rows.
- **medium** Profile funnel (Setup/Pending Approval/Rejected) — IA table names these as dedicated blocking states, but State Patterns has no row describing what the Pending/Rejected screens actually show. (EXPERIENCE.md line 34). *Fix:* add rows.
- **low** Certificates — no empty state ("no certificates earned yet"). (EXPERIENCE.md line 31). *Fix:* add row.
- **low** Admin — no permission-denied state for a role-gated surface, no empty state (e.g., zero pending tutor approvals). (EXPERIENCE.md line 32). *Fix:* add row(s).

## 5. Visual reference coverage — N/A, legitimately flagged
Listed the doc_workspace directory: only `DESIGN.md`, `EXPERIENCE.md`, `reconcile-assignments-prd.md`, `reconcile-dashboard-prd.md`, and `.memlog.md` exist — no `.working/`, `imports/`, `mockups/`, or `wireframes/` directories at all. This is expected and self-disclosed: EXPERIENCE.md's IA section explicitly states "Composition reference: none yet — this spec was authored against the live, already-built product rather than new mockups" and points to a Finalize mock-coverage step. Given the stated Fast-path/reverse-engineered context, this is not treated as a defect.
### Findings
- **low** Since the product already exists and runs, the spec had the option to capture screenshots of the live UI as a cheap visual reference (rather than commissioning new mockups) but didn't. "No mockups exist yet" and "no visual reference could exist" are different claims — worth naming even though not penalized.

## 6. Bloat & overspecification — strong
Checked for pixel specs undermining tokens, source restatement, prose-where-table-fits, and decorative narrative untied to a decision.
### Findings
No misses. Pixel-value annotations (e.g., "(20px)") always pair with, never replace, a token reference. Key Flows are renumbered/synthesized from PRD prose rather than copy-pasted. The one long prose section (Brand & Style) matches the reference example's expected density, and its narrative beats (the "My time. My academy." tagline, the "earned achievement" warmth carve-out) are each tied directly to a stated design decision, not decorative filler.

## 7. Inheritance discipline — strong
Verified `sources` frontmatter resolves to real files (both PRDs read directly), UJ names carried verbatim, the PRD-name disambiguation prefix, and every `{...}` reference in EXPERIENCE.md.
### Findings
No misses. `sources:` entries (`{planning_artifacts}/prds/prd-eLearning-2026-08-10/prd.md` and `.../prd-eLearning-Assignments-2026-08-10/prd.md`) resolve to the actual PRD files. UJ names are carried verbatim from each PRD's §2.3, with the "Dashboard PRD ·" / "Assignments PRD ·" prefix applied consistently and correctly to disambiguate the duplicate UJ-1/UJ-2 IDs across the two source PRDs — not a naming drift. Grepped every `{...}` occurrence in EXPERIENCE.md: the only design-token reference, `{colors.error}` (Accessibility Floor, line 109), resolves to a real DESIGN.md frontmatter token. The two `{planning_artifacts}` occurrences are path-alias tokens in `sources:`, not design tokens. The one `{name}` occurrence (Voice and Tone table, line 46) is a literal microcopy interpolation placeholder, correctly left unbracketed as a token. All prose-form `DESIGN.md.<Section>` cross-references (Layout & Spacing, Brand & Style, Components) resolve to real DESIGN.md H2 headers.

## 8. Shape fit — strong
Checked DESIGN.md section order against canon and EXPERIENCE.md against required defaults + triggered sections.
### Findings
- **low** Inspiration & Anti-patterns was dropped from EXPERIENCE.md. Defensible for a reverse-engineered spec — there's no external inspiration story to tell for a product that already exists — but the anti-pattern-shaped content that does exist (no centered max-width column, no breakpoint-gated element without a same-capability sibling) ended up scattered across DESIGN.md's Do's and Don'ts and EXPERIENCE.md's Foundation/Responsive & Platform sections rather than consolidated in one place. Minor discoverability cost, not a real gap. (DESIGN.md lines 198–206; EXPERIENCE.md lines 20, 112–122).

Otherwise no misses: DESIGN.md's section order matches the canonical order exactly (Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts). EXPERIENCE.md carries all required defaults (Foundation, IA, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor, Key Flows) plus the triggered Responsive & Platform section, with its trigger condition stated inline.

## Mechanical notes
- Frontmatter is complete on both files (title/status/created/updated/name; EXPERIENCE.md additionally carries `sources`). No broken cross-refs found anywhere in either document.
- Two ancillary files (`reconcile-assignments-prd.md`, `reconcile-dashboard-prd.md`) and a `.memlog.md` sit in the same doc_workspace directory but were out of scope for this spine-pair review (not DESIGN.md/EXPERIENCE.md content) and were not evaluated.
- `rounded.md` duplicates `rounded.DEFAULT`'s value (0.75rem) and is never consumed by name anywhere in either document — likely a leftover from the token-scale authoring pass.
