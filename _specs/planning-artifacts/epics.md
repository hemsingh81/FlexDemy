---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - _specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md
  - _specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/addendum.md
  - _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md
  - _specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md
  - _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/DESIGN.md
  - _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/EXPERIENCE.md
---

# eLearning (New Course Wizard) - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the New Course Wizard — AI-Assisted Course Creation & Adaptive Learning Module, decomposing the PRD's 29 functional requirements, the UX spine's design/experience requirements, and the two architecture spines' technical decisions into implementable stories.

Scope note: this project has three PRDs (Dashboard merge, Assignments merge, New Course Wizard). This breakdown covers **New Course Wizard only**, per user confirmation — the architecture and UX spines are whole-app documents already updated with this PRD's additions (backend AD-14–AD-20, frontend AD-1/AD-3/AD-4 extensions + AD-6).

## Requirements Inventory

### Functional Requirements

FR1: Feature code (frontend and backend) can invoke AI capability only through the internal AI Service Layer; no feature module calls a vendor AI SDK directly.
FR2: Admin can change the active provider/model for a given AI Task and have it take effect without an application redeploy of feature code; a locally-run self-hosted model is a selectable backend for any AI Task.
FR3: The gateway supports assigning a different model per AI Task, and retries on an alternate provider when the primary is rate-limited or unavailable; every fallback event is logged and flagged.
FR4: The gateway records token usage and computed cost for every AI Task invocation, attributed to the task and (where applicable) the course/tutor that triggered it.
FR5: Prompts and model/provider config for every AI Task live in one centralized, versioned location, not scattered across feature code.
FR6: Tutor enters a required, single-line Course Title (trimmed, non-empty, max length enforced) and an optional short description/subtitle.
FR7: Tutor selects zero or more Tags from a searchable, type-ahead multi-select populated from the admin-governed Tag list; free-text tag entry is not available.
FR8: Tutor selects Country → State → City → Board → Class Level → Subject via cascading dropdowns backed by existing admin-governed master data; Country/Board/Class Level/Subject required, State/City board-dependent.
FR9: Tutor uploads up to 3 thumbnail images, cropping each to a fixed aspect ratio client-side before acceptance, with preview, reorder, delete, and set-primary actions.
FR10: The wizard shows a progress indicator across all steps, validates the current step before enabling "Next," and auto-persists wizard state as a Draft after every step.
FR11: Tutor uploads one or more files (PDF/Word/TXT/Excel), each with independent progress, type/size/integrity validation, and secure storage.
FR12: Before `extractStructure()` runs, the system runs a dedicated document-parsing pass (with OCR for scanned pages) to produce clean structured text; low-confidence parse output routes to failed/retry, not silent pass-through.
FR13: For each successfully parsed file, the gateway's `extractStructure()` AI Task proposes a nested Chapter → Topic → Subtopic → Content structure, with per-file status and independent retry.
FR14: Tutor can add, edit, delete, and reorder any Chapter, Topic, Subtopic, or Content Block, whether AI-extracted or tutor-added.
FR15: Each node carries an explicit tutor-confirmation state; a text-only edit preserves confirmation, a structural or AI-content-affecting edit resets it.
FR16: Both the tutor's editor and the student's view correctly author and display math/physics notation, chemistry (formulas/reactions as notation, structural diagrams as images), biology diagrams, and English/Hindi text — identically; golden-file tests enforce parity; rendered notation carries AI-generated screen-reader alt-text; Hindi content carries the correct `lang` attribute.
FR17: Every Topic/Subtopic has 5 Drill-Down Levels, generated via `explainTopic(level)`, tutor-editable, revealed one level at a time.
FR18: Every Topic/Subtopic has 5 "Ways" (alternative explanations), each generated via `rewriteExplanation(way)` with its own worked example, tutor-editable, freely cyclable.
FR19: Tutor can optionally attach exercises per node (self-authored or AI-proposed); students perform them inline with subject-appropriate answer types and immediate feedback.
FR20: Any keyword in course content can be clicked for an inline definition popover via `defineKeyword()`, subject/language-aware; tutor overrides take priority.
FR21: Drill-Down and Ways content are generated for every confirmed node at publish time (async batch, not on-demand per view), cached; a single node's generation failure falls back to on-demand generation rather than blocking the batch.
FR22: Tutor can leave and resume a course in Draft state at any point.
FR23: Tutor can preview the full course exactly as a student would see it (Review as Student) once all nodes are confirmed; entering this mode transitions the course to In Review.
FR24: Tutor must explicitly Confirm Review before Publish becomes available; Publish is disabled at every earlier Lifecycle State.
FR25: A tutor can return a Published course to Draft to make fixes; prior published state is retained as a version; re-publish is gated by Review Confirmed exactly like first-time publish.
FR26: Admin can add, rename, deactivate, and search Tags; duplicate names are prevented; deactivating a tag hides it from new selection without removing it from courses already using it.
FR27: Admin can view and change the active provider/model for each AI Task independently, and configure a fallback provider/model per task.
FR28: Admin can view token usage and computed cost, broken down by AI Task and by date range.
FR29: Admin can set a cost threshold per AI Task and/or platform-wide; the gateway blocks routing new requests that would exceed it, before the fact, not just reporting spend after.

### NonFunctional Requirements

NFR1 (Cost control): Free/cheap-tier models (including local models) by default in dev; per-task cost tracking live from day one; high-volume tasks (`defineKeyword`) default-routed to the cheapest viable tier; budget thresholds are an enforced guardrail, not just a dashboard.
NFR2 (Portability): No vendor lock-in — a provider/model swap is a configuration change, never a code change, across both the managed-gateway (dev) and self-hosted-gateway (launch) phases.
NFR3 (Performance): Large-file processing is asynchronous and non-blocking per file; student-facing Drill-Down/Way content is pre-generated and cached for near-instant response; Keyword definitions target low-latency on-demand response.
NFR4 (Reliability): Per-file failure never loses other files' progress; AI-layer fallback covers provider outage/rate-limiting; wizard state auto-persists so no in-progress work is lost.
NFR5 (Security & Privacy): Uploaded files are access-controlled and scanned before processing; dev-phase usage on real-ish student content is restricted to providers that don't train on input by default; the self-hosted migration path exists so student data need not transit a third-party managed relay in production.
NFR6 (Accessibility & i18n): WCAG 2.1 AA product-wide floor; multilingual scripts (English, Hindi) and mathematical/scientific notation render correctly across devices, including screen-reader alt-text and correct `lang` tagging.
NFR7 (High-volume task routing): `defineKeyword()` is routed to the cheapest/fastest AI Task tier by default, given its high expected call volume.

### Additional Requirements

- No starter template — this is a brownfield extension of the existing ASP.NET Core 10 (C# 14, Clean Architecture/Onion) backend and React 19 + TypeScript + Vite frontend; Epic 1 does not scaffold a new project.
- **AI Service Layer (`IAiGateway`)**: one fat interface (not per-task interfaces) in `Application/AiGateway/`, HTTP-calling implementation in `Infrastructure/AiGateway/`, DI wired via `Program.cs`/`AddInfrastructure()`. Targets a **self-hosted Portkey OSS gateway** (`portkey-ai/gateway`, Apache-2.0, zero inference markup) from day one — cost review superseded the original managed-then-self-hosted phasing, so there is no later migration to plan for. `describeNotation()` runs in the per-node authoring pipeline, not the publish batch. (Backend AD-14)
- **Per-task fallback**: Polly 8.7.0 (BSD-3-Clause) wraps each `IAiGateway` call with a fallback policy to the task's configured secondary provider/model. (Backend AD-14)
- **Document parsing/OCR**: self-hosted Docling (IBM, MIT, free — chosen over paid-per-page LlamaParse in cost review), its own lightweight HTTP service (`docling`, no .NET binding exists), client in new `Infrastructure/Parsing/`. Accepted trade-off: less accurate than paid alternatives on heavily degraded scans, mitigated by FR12's confidence-threshold retry gate. (Backend AD-21)
- **Upload malware scanning**: self-hosted ClamAV (Cisco-Talos, GPLv2, free, official `clamav/clamav` image), reached over `clamd` TCP, client implementing a new `IFileScanner` (`Application/Common/`) in new `Infrastructure/Scanning/`. Fills a previously-unnamed FR11 gap at zero cost. (Backend AD-22)
- **Async batch job execution**: Hangfire Core 1.8.24 + Hangfire.PostgreSql 1.21.1 (LGPLv3), server running in-process inside the existing `api` container — no new Docker service, no Redis — governs both the publish batch and the file-extraction pipeline, one job per content-node/file, independently retryable. Job status is a Domain-level `JobItemStatus` enum, never read via Hangfire's own monitoring API outside `Infrastructure/Jobs/`. (Backend AD-15)
- **Batch commit/completion pattern**: the triggering use-case commits once (AD-11 compliant); each job item commits its own content independently; batch completion (flipping `Publishing → Published`) is claimed by whichever job item's atomic decrement of a `remaining` counter reaches zero — avoids needing commercial Hangfire Pro batches. (Backend AD-16)
- **Course versioning**: deep-copy snapshot of the entire confirmed content tree + cached Drill-Down/Way content per publish; restore swaps an active-version pointer. (Backend AD-17)
- **Budget enforcement**: pre-flight atomic reserve (`UPDATE ... WHERE spent + cost <= threshold ... RETURNING spent`) against a single-source-of-truth threshold in `AiTaskConfig` — not post-hoc recording, not a duplicated threshold column. (Backend AD-18)
- **AI task configuration store**: DB-backed (`AiTaskConfig`, `AiPromptVersion` entities), never static `appsettings.json` — is what actually makes FR2's "no redeploy" guarantee true. New `Application/AiConfig/IAiConfigService` + `Api/Controllers/AiConfigController.cs`. (Backend AD-19)
- **Content tree domain model**: `Chapter`, `Topic`, `Subtopic`, `ContentBlock` as four explicit entity types (not a generic polymorphic node table) in `Domain/Courses/`, each with a parent-FK one level up; supersedes and replaces the old `Module`/`Lesson` entities entirely. (Backend AD-20)
- **New backend feature folders**: `Domain/Tags/` + `Application/Tags/` + `Api/Controllers/TagsController.cs` (FR26, net-new, not an extension of the taxonomy master-data scaffold).
- **Frontend cross-feature exception**: `CourseContentEditor`'s Review-as-Student mode is the one sanctioned case of `features/*` importing another `features/*` directly — it reuses `CoursePlayer`'s adaptive-learning components (DrilldownPanel, Ways menu, Exercise runner, keyword popover) rather than duplicating them, so parity with the real student view is structural, not just tested. (Frontend AD-3)
- **New frontend cross-cutting state**: `CourseContentContext` (backed by `services/courseContentService.ts`) holds the confirmed content tree, draft AND published — kept structurally separate from `DomainContext.courses` (published-catalog-only), so an in-progress draft cannot leak into the public catalog. (Frontend AD-4)
- **New frontend services**: `courseContentService.ts`, `aiConfigService.ts` (distinct backend surface from `aiGatewayService.ts`), `tagsService.ts`, `aiGatewayService.ts` — all `services/*`-boundary compliant (AD-1), no direct `fetch`/HTTP calls from features/hooks/Context.
- **Golden-file visual-regression testing**: Vitest 4's `toMatchScreenshot()` via `@vitest/browser-playwright` (pinned to the exact same version as `vitest` core — strict peer dependency), added as a second `test.projects` entry alongside the existing jsdom suite; CI gains a `playwright install --with-deps chromium` step; screenshot tests wait for `document.fonts.ready` and pin fonts in CI for KaTeX/Hindi determinism. (Frontend AD-6)
- **Removal, not addition**: the old 4-step Course Creation Wizard in `TutorEducatorHubView.tsx` (~950 lines, flat Module/Lesson model) is removed as part of this feature, not left running alongside the new wizard.
- **`DrilldownPanel.tsx` color remediation**: in scope for this same implementation pass (not a follow-up) — sweep its off-brand indigo/emerald Tailwind colors to the real token set (`ink-navy`/`citrus-amber`/`signal-green`) at the same time it's wired to real AI content.
- **Deployment envelope grows from 3 to 6 Docker Compose services** (cost review): `postgres`, `api`, `web` (existing) plus `ai-gateway` (self-hosted Portkey OSS), `docling` (OCR/parsing), `clamav` (malware scanning) — all `["backend", "all"]` profile, internal-network-only, no new external surface. (Backend AD-13)
- Deferred, not in scope for this epic set: Hangfire retry/backoff policy tuning, course-version snapshot storage retention policy, exact WCAG conformance level beyond the adopted 2.1 AA floor, final free-tier/launch AI model selection per task (build-time decision), exact .NET ClamAV client library choice (build-time decision).

### UX Design Requirements

UX-DR1: New Course Wizard metadata flow (Steps 1-4) reuses the existing side-panel/blade shell and "Step N of 4" step-swap discipline — same component, narrower scope (Title/Tags/Taxonomy/Thumbnails only, not the old 5-step shell).
UX-DR2: Tags step is a searchable type-ahead multi-select; a tag deactivated after attachment stays visible as a non-reselectable chip, visually distinct from an active, freely re-addable chip.
UX-DR3: Taxonomy step is 6 cascading dropdowns with parent-gated enabling; State/City required-ness is read from master data per board, not hardcoded.
UX-DR4: Thumbnails step includes an in-step crop tool (fixed aspect ratio, keyboard-operable per the Accessibility Floor — arrow-key nudge or numeric x/y/zoom fallback, not drag-only) plus button-based (not drag) reorder/delete/set-primary controls; a 4th upload attempt is rejected inline with a clear message.
UX-DR5: Course Content Editor is a new full-width surface (not a side-panel step) — a Chapter/Topic/Subtopic/Content-Block tree with per-node expand/collapse/edit/delete/drag-reorder/Confirm controls; a sticky header carries a persistent Draft→In Review→Review Confirmed→Published stage indicator (`aria-current` on the active stage).
UX-DR6: Deleting a Chapter or Topic (cascading, destructive) goes through the centered confirm-modal pattern, same as an Admin row delete; deleting a leaf Content Block does not need the extra confirm step.
UX-DR7: Course Content Editor tree-node reordering is keyboard-operable (move-up/move-down equivalent to drag), and every node's confirmed/unconfirmed state is exposed to assistive tech, not color-alone; an edit that auto-reverts confirmation is announced at the moment it happens via `aria-live="polite"`.
UX-DR8: Course Content Editor autosaves per-node on edit-then-blur rather than relying on a single page-level "leave without saving?" prompt.
UX-DR9: Extraction status indicator (Queued/Parsing/Extracting/Done/Failed) reuses the existing badge-pill semantic colors (navy/green/red) — no new color language; each status transition is announced via a scoped `aria-live="polite"` region, batched if many files finish near-simultaneously.
UX-DR10: `DrilldownPanel.tsx` gets its off-brand indigo/emerald colors swept to the real brand tokens as part of wiring it to real AI content (not deferred).
UX-DR11: Adaptive Ways menu is a small, secondary-weight pill/tray near Drill-Down's "Explain more" action — not a peer button, not a full modal; Level 1 of Drill-Down carries a visible textual nudge toward it; each Way is independently focusable with `aria-current` on the displayed one.
UX-DR12: Exercise runner is inline (not a modal), reusing the existing Quiz runner's "expands in place" idiom; numeric/math answers are captured as plain keyboard text entry, not a mouse-only visual equation editor; a node with no exercise shows no practice affordance at all.
UX-DR13: Every keyword renders as a real focusable/keyboard-operable inline control (not a `span` with only `onClick`), activated by Enter/Space; the definition popover keeps focus on the reading text and announces via `aria-live="polite"` rather than stealing focus.
UX-DR14: Publishing async-batch state is a node-by-node checklist ("N of M confirmed nodes generated"), never a spinner — survives tab-close, resumes on reopen; the checklist container is `aria-live="polite"`, announcing meaningful increments and terminal states, not a play-by-play.
UX-DR15: A node whose pre-generation failed during the publish batch falls back to on-demand generation for the student — never a visible "failed"/empty state; the failure is Admin-visible only (flagged in AI Configuration usage view).
UX-DR16: AI Configuration table (Admin) is one row per AI Task (7 tasks including `describeNotation`) with independent provider/model/fallback/budget-threshold fields per row, saved independently; usage/cost reuses existing stat-card/chart patterns.
UX-DR17: Budget threshold warning is icon + text, never color-alone (`{colors.warning}` fails AA for small text); threshold crossing is exposed via `aria-describedby` on the affected task's row.
UX-DR18: Tag Management table (Admin) reuses the existing list/search/CRUD shell pattern (e.g. Master Data), not a new pattern; Support role gets access alongside Master (unlike the Master-only AI Configuration tab).
UX-DR19: 5 new design tokens added to `DESIGN.md.components`: `content-tree-node`, `extraction-status-badge` (reuses `badge-pill`), `ways-menu`, `keyword-popover`, `exercise-runner` — all built from existing color/typography/rounded/spacing tokens, no new palette entries.
UX-DR20: Math/chemistry (KaTeX+mhchem) notation and Hindi (Devanagari) content require golden-file visual-regression coverage between editor and student view; math/chem notation additionally requires AI-generated (`describeNotation`) screen-reader alt-text, and Hindi content requires `lang="hi"` tagging at the content-block level — two distinct accessibility requirements, not one.

### FR Coverage Map

| Requirement | Epic |
|---|---|
| FR1, FR2, FR3, FR4, FR5 | Epic 1 |
| FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16 | Epic 2 |
| FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25 | Epic 3 |
| FR26, FR27, FR28, FR29 | Epic 1 |
| NFR1 (Cost control) | Epic 1 |
| NFR2 (Portability) | Epic 1 |
| NFR3 (Performance) | Epic 2 (async upload/extraction) & Epic 3 (pre-generation caching) |
| NFR4 (Reliability) | Epic 1 (gateway fallback) & Epic 2 (per-file failure isolation, autosave) |
| NFR5 (Security & Privacy) | Epic 1 (no-train dev routing) & Epic 2 (upload scanning) |
| NFR6 (Accessibility & i18n) | Epic 2 (editor) & Epic 3 (student view, notation/Hindi parity) |
| NFR7 (High-volume task routing) | Epic 1 |
| UX-DR1, UX-DR2, UX-DR3, UX-DR4 | Epic 2 |
| UX-DR5, UX-DR6, UX-DR7, UX-DR8, UX-DR9 | Epic 2 |
| UX-DR10, UX-DR11, UX-DR12, UX-DR13, UX-DR14, UX-DR15 | Epic 3 |
| UX-DR16, UX-DR17, UX-DR18 | Epic 1 |
| UX-DR19 (design tokens) | Epic 2 (content-tree-node, extraction-status-badge) & Epic 3 (ways-menu, keyword-popover, exercise-runner) |
| UX-DR20 (golden-file visual regression) | Epic 2 (editor side) & Epic 3 (student-view side) |

Story-level mapping is completed in Step 3.

## Epic List

### Epic 1: AI Backbone & Admin Control

**Goal:** Stand up the pluggable, provider-agnostic AI Service Layer (`IAiGateway`) and the admin surfaces that govern it — task-level provider/model/fallback config, budget enforcement, usage/cost visibility, and tag governance — so every later epic calls AI capability through one stable interface instead of a vendor SDK. This epic is foundational plumbing: it is demoable (an admin can configure a task and see it take effect), but it delivers no tutor/student-facing value yet — that lands starting in Epic 2.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR26, FR27, FR28, FR29

**Also covers:** NFR1, NFR2, NFR4 (gateway fallback), NFR5 (dev-phase no-train routing), NFR7, UX-DR16, UX-DR17, UX-DR18

**Key architecture inputs:** self-hosted Portkey OSS gateway (AD-14), Polly per-task fallback (AD-14), DB-backed `AiTaskConfig`/`AiPromptVersion` (AD-19), pre-flight atomic budget reserve (AD-18), new `Domain/Tags/` + `Application/Tags/` feature folder.

### Epic 2: Course Authoring — Metadata, Upload, AI Extraction & Editing

**Goal:** Give a tutor the full authoring path from a blank course to a fully-structured, tutor-confirmed content tree: metadata wizard (title/tags/taxonomy/thumbnails), file upload with malware scanning and parsing/OCR, AI-driven structure extraction (`extractStructure()`), and the Course Content Editor for adding, editing, reordering, and confirming Chapters/Topics/Subtopics/Content Blocks with full subject-aware WYSIWYG parity.

**FRs covered:** FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16

**Also covers:** NFR3 (async upload/extraction), NFR4 (per-file isolation, autosave), NFR5 (upload scanning), NFR6 (editor accessibility), UX-DR1–UX-DR9, UX-DR19 (content-tree-node, extraction-status-badge), UX-DR20 (editor side)

**Key architecture inputs:** self-hosted Docling parsing service (AD-21), self-hosted ClamAV scanning service (AD-22) behind new `IFileScanner`, four explicit content-tree entities superseding `Module`/`Lesson` (AD-20), new `CourseContentContext` (Frontend AD-4), removal of the old 4-step wizard.

### Epic 3: Adaptive Learning Experience & Publish Lifecycle

**Goal:** Deliver the student-facing adaptive mechanisms — 5-level Drill-Down, 5 Ways, optional exercises, click-any-keyword definitions — pre-generated and cached via an async publish batch, plus the full Draft → In Review → Review Confirmed → Published lifecycle including tutor Review-as-Student and post-publish versioning. Bundled as one epic rather than split, because Review-as-Student structurally needs the adaptive components to exist to render anything meaningful, while Publish is what triggers the batch job that populates those same components' cached content — splitting them would force a forward-dependency violation. In the actual breakdown this is the largest single epic (11 stories vs. 9 and 10), though not larger than Epics 1 and 2 combined as originally anticipated.

**FRs covered:** FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25

**Also covers:** NFR3 (pre-generation caching), NFR6 (student-view accessibility, notation/Hindi parity), UX-DR10–UX-DR15, UX-DR19 (ways-menu, keyword-popover, exercise-runner), UX-DR20 (student-view side)

**Key architecture inputs:** Hangfire-driven publish batch + extraction pipeline (AD-15), claimed-last-item atomic batch completion (AD-16), deep-copy version snapshot (AD-17), sanctioned `CourseContentEditor` → `CoursePlayer` cross-feature import for Review-as-Student parity (Frontend AD-3), `DrilldownPanel.tsx` color remediation folded into this pass.

## Epic 1: AI Backbone & Admin Control

Stand up the pluggable, provider-agnostic AI Service Layer (`IAiGateway`) and the admin surfaces that govern it — task-level provider/model/fallback config, budget enforcement, usage/cost visibility, and tag governance — so every later epic calls AI capability through one stable interface instead of a vendor SDK. Execution order within this epic: admin UI stories build first against mock data (deployable checkpoint for review), then backend stories implement the real services and live-wire the UI to them.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR26, FR27, FR28, FR29
**Also covers:** NFR1, NFR2, NFR4, NFR5, NFR7, UX-DR16, UX-DR17, UX-DR18

**Parallelization note:** the Phase A → Phase B split is a review checkpoint, not a strict blocking queue. Stories 1.4 (gateway client) and 1.6 (fallback policy) have no UI dependency and can start immediately, in parallel with the Phase A mock-UI stories, if capacity allows. Stories 1.5, 1.7, 1.8, and 1.9 are live-wire stories — they modify the Phase A screens directly, so they wait for your review of the mock UI before starting, to avoid rework if you request layout changes.

### Story 1.1: Admin AI Configuration UI (Mock Data)

As an admin,
I want to see and edit AI Task provider/model/fallback/budget settings in a table UI backed by mock data,
So that the layout and interaction can be validated before backend wiring exists.

**Acceptance Criteria:**

**Given** the AI Configuration screen loads
**When** it renders
**Then** it shows one row per AI Task (7 tasks: `extractStructure`, `explainTopic`, `rewriteExplanation`, `generateExercise`, `defineKeyword`, `embeddings`, `describeNotation`) with provider/model/fallback/budget-threshold fields, populated from local mock data

**Given** an admin edits a row's fields and saves
**When** the save is submitted
**Then** the change updates local mock state only — no network call is made
**And** the UI behaves as if the save succeeded, ready to be re-pointed at a real API later

**Given** a task's mock spend exceeds its mock threshold
**When** the row renders
**Then** the warning shows as icon + text, never color-alone, and is exposed via `aria-describedby`

**And** data access goes through a stable hook/service interface (e.g. `useAiTaskConfig()`) from the start, so Phase B swaps the mock implementation behind it without changing component code

### Story 1.2: Admin AI Usage & Cost Dashboard (Mock Data)

As an admin,
I want to see usage and cost broken down by AI Task and date range using mock data,
So that the dashboard layout and interactions can be reviewed before real usage data exists.

**Acceptance Criteria:**

**Given** the AI Usage dashboard loads
**When** it renders
**Then** it shows cost/usage broken down by task and by a selectable date range, using mock data and reusing existing stat-card/chart patterns

**Given** a date range is changed
**When** the change is applied
**Then** the mock dataset filters accordingly, client-side only

**And** data access goes through a stable hook/service interface (e.g. `useAiUsage()`) from the start, so Phase B swaps the mock implementation behind it without changing component code

### Story 1.3: Admin Tag Management UI (Mock Data)

As an admin,
I want a Tag Management screen with add/rename/deactivate/search against mock data,
So that the CRUD flow can be validated before backend wiring exists.

**Acceptance Criteria:**

**Given** the Tag Management screen, reusing the existing list/search/CRUD shell pattern
**When** an admin adds a tag whose name matches an existing mock tag
**Then** the duplicate is rejected client-side

**Given** an admin deactivates a mock tag
**When** the list re-renders
**Then** the tag shows as inactive/non-selectable but remains visible

**Given** a Support-role user opens this screen
**When** it loads
**Then** access is granted, unlike the Master-only AI Configuration tab

**And** data access goes through a stable hook/service interface (e.g. `useTags()`) from the start, so Phase B swaps the mock implementation behind it without changing component code

### Story 1.4: AI Service Layer Interface & Gateway Client

As a backend developer,
I want a single internal `IAiGateway` interface and an HTTP-calling implementation that targets the self-hosted Portkey OSS gateway,
So that all AI-driven features call one abstraction instead of a vendor SDK.

**Acceptance Criteria:**

**Given** any feature module needs an AI capability
**When** it is implemented
**Then** it calls `IAiGateway` (`Application/AiGateway/`) and never a vendor SDK directly

**Given** the `IAiGateway` HTTP implementation (`Infrastructure/AiGateway/`)
**When** it sends a request
**Then** it targets the configured self-hosted Portkey OSS endpoint (`http://ai-gateway:8787`) using an OpenAI-compatible request/response shape
**And** the gateway client is registered via DI in `AddInfrastructure()`

### Story 1.5: AI Task Configuration Store & Live-Wire Config UI

*(Sizing risk: this is one of the larger stories in the plan — real entities, endpoints, and UI wiring in one pass. If it doesn't fit a single dev session, this is the natural split point: config store + endpoints first, UI live-wire second.)*

As an admin,
I want Story 1.1's UI to read and write real `AiTaskConfig`/`AiPromptVersion` state,
So that config changes take effect on the next request with zero code deploy.

**Acceptance Criteria:**

**Given** `AiTaskConfig` and `AiPromptVersion` entities and endpoints exist
**When** Story 1.1's UI saves a row
**Then** the change persists to the real store and the next request for that task uses the new value immediately

**Given** a locally-run self-hosted model is configured as a task's backend
**When** a request for that task fires
**Then** it routes there like any other configured provider

**And** mock data from Story 1.1 is fully replaced by live API calls
**And** prompts/config for every AI Task live in this one centralized, versioned store — none scattered in feature code

**Given** the dev environment's seed configuration
**When** an AI Task's provider is first seeded (no admin override yet)
**Then** it defaults to a provider that does not train on input by default, satisfying NFR5's dev-phase constraint
**And** changing a task away from a no-train provider is a visible, deliberate admin action, not a silent default

### Story 1.6: Per-Task Fallback & Retry

As a platform operator,
I want each AI Task call wrapped in a fallback policy,
So that a rate-limited or unavailable primary provider doesn't block the task.

**Acceptance Criteria:**

**Given** an AI Task has a configured fallback provider/model
**When** the primary provider is rate-limited or unavailable
**Then** the request retries against the fallback
**And** every fallback event is logged and flagged for admin visibility

**Given** the fallback policy
**When** implemented
**Then** it uses Polly 8.7.0 wrapping the `IAiGateway` call

**Given** both the primary and fallback provider are unavailable
**When** the retry against the fallback also fails
**Then** the request fails with a distinct, loggable terminal error state — never a silent hang or an unhandled exception surfaced raw to the caller

### Story 1.7: Usage & Cost Tracking & Live-Wire Usage Dashboard

As an admin,
I want every AI Task invocation's token usage and cost recorded and shown live in Story 1.2's dashboard,
So that spend is attributable, auditable, and no longer mock data.

**Acceptance Criteria:**

**Given** any AI Task invocation completes
**When** the response returns
**Then** token usage and computed cost are recorded, attributed to the task and (where applicable) the course/tutor that triggered it
**And** this recording happens regardless of success/fallback path

**Given** Story 1.2's dashboard
**When** it loads
**Then** it reads real recorded usage/cost data instead of mocks

### Story 1.8: Budget Threshold Enforcement

As an admin,
I want a per-task and/or platform-wide cost threshold enforced pre-flight,
So that spend is blocked before it happens, not just reported after.

**Acceptance Criteria:**

**Given** a configured budget threshold
**When** a new request would push spend past it
**Then** the request is blocked before it is made, via an atomic reserve, not post-hoc recording

**Given** Story 1.1's threshold warning UI
**When** real spend crosses the real threshold
**Then** the warning reflects live state instead of mock data

### Story 1.9: Tag Management Backend & Live-Wire Tag UI

As an admin,
I want Story 1.3's UI to read and write real Tag data,
So that tag governance is enforced server-side, not just in the mock UI.

**Acceptance Criteria:**

**Given** the new `Domain/Tags/`, `Application/Tags/`, and `Api/Controllers/TagsController.cs`
**When** Story 1.3's UI adds, renames, deactivates, or searches a tag
**Then** it persists to and reads from the real backend, replacing mock data

**Given** a duplicate tag name is submitted
**When** validated server-side
**Then** it is rejected

**Given** a tag is deactivated
**When** a course already has it attached
**Then** it stays attached but cannot be newly selected

## Epic 2: Course Authoring — Metadata, Upload, AI Extraction & Editing

Give a tutor the full authoring path from a blank course to a fully-structured, tutor-confirmed content tree: metadata wizard (title/tags/taxonomy/thumbnails), file upload with malware scanning and parsing/OCR, AI-driven structure extraction (`extractStructure()`), and the Course Content Editor for adding, editing, reordering, and confirming Chapters/Topics/Subtopics/Content Blocks with full subject-aware WYSIWYG parity. Execution order within this epic: admin/tutor-facing UI stories build first against mock data (deployable checkpoint for review), then backend stories implement real services and live-wire the UI to them.

**FRs covered:** FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16
**Also covers:** NFR3, NFR4, NFR5, NFR6, UX-DR1, UX-DR2, UX-DR3, UX-DR4, UX-DR5, UX-DR6, UX-DR7, UX-DR8, UX-DR9, UX-DR19, UX-DR20 (editor side)

**Parallelization note:** Stories 2.8 (AI structure extraction logic) and 2.10 (alt-text/language tagging) have no direct dependency on the Phase A mock screens and can start in parallel with them if capacity allows. Stories 2.4, 2.5, 2.6, 2.7, and 2.9 are live-wire stories against Stories 2.1–2.3's screens, so they wait for your review checkpoint.

### Story 2.1: Course Metadata Wizard UI (Mock Data)

As a tutor,
I want to set Course Title, Tags, Taxonomy, and Thumbnails through a 4-step wizard against mock tag/taxonomy data,
So that the flow can be validated before backend wiring exists.

**Acceptance Criteria:**

**Given** the wizard
**When** a step's required field is unset
**Then** "Next" stays disabled

**Given** a mock tag/taxonomy list
**When** the Tags/Taxonomy steps render
**Then** they show cascading dropdowns and a type-ahead multi-select populated from mock data

**Given** the Thumbnails step
**When** a 4th upload is attempted
**Then** it is rejected inline with a clear message
**And** the crop tool is keyboard-operable (arrow-key nudge or numeric x/y/zoom fallback, not drag-only)

**And** step progress auto-persists to local mock state only — no network call yet
**And** data access goes through a stable hook/service interface (e.g. `useCourseDraft()`) from the start, so Phase B swaps the mock implementation behind it without changing component code

### Story 2.2: File Upload UI (Mock Data)

As a tutor,
I want to upload multiple files and see independent per-file progress and status, simulated against mock state,
So that the upload UX can be validated before real parsing exists.

**Acceptance Criteria:**

**Given** multiple files are selected
**When** upload starts
**Then** each file shows independent progress, not a single combined bar

**Given** a mock status transition (Queued → Parsing → Extracting → Done/Failed)
**When** it fires
**Then** it reuses the existing badge-pill semantic colors (navy/green/red)
**And** each status transition is announced via a scoped `aria-live="polite"` region, batched if many files finish near-simultaneously
**And** data access goes through a stable hook/service interface (e.g. `useFileUpload()`) from the start, so Phase B swaps the mock implementation behind it without changing component code

### Story 2.3: Course Content Editor UI (Mock Data)

As a tutor,
I want a Chapter/Topic/Subtopic/Content-Block tree with add/edit/delete/reorder/confirm controls and subject-aware rendering, working against mock content,
So that the editor UX can be validated before backend wiring exists.

**Acceptance Criteria:**

**Given** the content tree
**When** a node is reordered
**Then** it is keyboard-operable (move-up/move-down equivalent to drag)

**Given** a Chapter or Topic delete (cascading, destructive)
**When** triggered
**Then** it goes through the centered confirm-modal pattern
**And** deleting a leaf Content Block does not require the extra confirm step

**Given** an edit that would auto-revert a node's confirmation state
**When** it happens
**Then** it is announced at that moment via `aria-live="polite"`

**Given** mock content containing math, chemistry, biology diagrams, and Hindi text
**When** rendered in the editor
**Then** KaTeX+mhchem notation and Devanagari script display correctly
**And** edits autosave per-node on edit-then-blur, not via a page-level prompt
**And** data access goes through a stable hook/service interface (e.g. `useCourseContentTree()`) from the start, so Phase B swaps the mock implementation behind it without changing component code

### Story 2.4: Course Metadata Persistence & Live-Wire Wizard

As a tutor,
I want Story 2.1's wizard to persist my Title, Thumbnails, and step progress to a real Draft,
So that my work is saved, not just held in local mock state.

**Acceptance Criteria:**

**Given** real course/draft endpoints exist
**When** a wizard step is completed
**Then** state auto-persists as Draft after every step

**Given** a required, single-line Course Title
**When** submitted
**Then** it is trimmed, validated non-empty, and enforced against max length

**Given** up to 3 thumbnail images
**When** uploaded and cropped
**Then** each is stored with preview, reorder, delete, and set-primary actions working against real data

**Given** the new wizard is now persisting real Draft state
**When** this story ships
**Then** the old 4-step Course Creation Wizard in `TutorEducatorHubView.tsx` (flat Module/Lesson model) is removed, not left running alongside the new wizard

### Story 2.5: Tag & Taxonomy Live Data Wiring

As a tutor,
I want Story 2.1's Tags and Taxonomy steps to read real, admin-governed data,
So that my selections are valid and consistent with the rest of the platform.

**Acceptance Criteria:**

**Given** Epic 1's real Tag backend (Story 1.9)
**When** the Tags step renders
**Then** it shows a searchable, type-ahead multi-select populated from the live Tag list — no free-text entry

**Given** the existing taxonomy master-data system
**When** the Taxonomy step renders
**Then** Country → State → City → Board → Class → Subject cascade correctly, with State/City required-ness read from master data per board, not hardcoded

### Story 2.6: File Upload, Malware Scanning & Secure Storage

As a tutor,
I want my uploaded files scanned and securely stored,
So that malicious files never reach parsing and my content is safe.

**Acceptance Criteria:**

**Given** a real upload endpoint
**When** a file (PDF/Word/TXT/Excel) is uploaded
**Then** it is scanned via `IFileScanner`/ClamAV before acceptance and stored securely

**Given** a file fails type/size/integrity validation or the malware scan
**When** the check runs
**Then** it is rejected without blocking other files' uploads

**Given** the ClamAV service itself is unreachable
**When** a file is uploaded
**Then** the upload fails closed — rejected as unscanned, never accepted as if clean — until scanning is available again

**Given** Story 2.2's upload UI
**When** a real upload proceeds
**Then** its per-file progress and status reflect real upload/scan state instead of mock simulation

### Story 2.7: Document Parsing/OCR Pipeline

As the system,
I want each accepted file run through a dedicated parsing pass (with OCR for scans) before structure extraction,
So that `extractStructure()` receives clean text, not raw/degraded input.

**Acceptance Criteria:**

**Given** a scanned or text-based file
**When** the parsing pass runs (Docling)
**Then** it produces clean structured text

**Given** low-confidence parse output
**When** detected
**Then** the file routes to failed/retry, not silent pass-through

**Given** Story 2.2's status badges
**When** parsing completes or fails
**Then** they reflect real parsing state instead of mock simulation

### Story 2.8: AI Structure Extraction (`extractStructure`)

As a tutor,
I want the system to propose a Chapter → Topic → Subtopic → Content structure from my parsed files,
So that I edit and confirm rather than build the structure from a blank page.

**Acceptance Criteria:**

**Given** a successfully parsed file
**When** `extractStructure()` runs via Epic 1's `IAiGateway`
**Then** it proposes a nested Chapter → Topic → Subtopic → Content structure with per-file status

**Given** one file's extraction fails
**When** other files are still processing
**Then** the failure never blocks other files' extraction, and the failed file is independently retryable

### Story 2.9: Content Tree CRUD Backend & Live-Wire Editor

*(Sizing risk: the largest story in the plan — four entities, full CRUD, the confirmation-state machine, and UI wiring together. Kept as one story deliberately: the pieces only demo meaningfully as a set. If it doesn't fit a single dev session, split at sprint-planning time using real velocity data rather than guessing boundaries now.)*

As a tutor,
I want Story 2.3's editor to read and write real Chapter/Topic/Subtopic/Content-Block data,
So that my structural edits and confirmations are actually saved.

**Acceptance Criteria:**

**Given** `Chapter`, `Topic`, `Subtopic`, and `ContentBlock` entities and endpoints
**When** a tutor adds, edits, deletes, or reorders a node
**Then** the change persists to the real backend, replacing mock data

**Given** a node with an existing tutor-confirmation state
**When** a text-only edit is made
**Then** confirmation is preserved
**And** when a structural or AI-content-affecting edit is made, confirmation resets to unconfirmed

### Story 2.10: Subject-Aware Alt-Text & Language Tagging

As a student using assistive technology,
I want math/chemistry notation to carry AI-generated alt-text and Hindi content to carry correct language tagging,
So that a screen reader announces this content correctly.

**Acceptance Criteria:**

**Given** a content block containing math or chemistry notation
**When** it is authored or AI-extracted
**Then** `describeNotation()` generates screen-reader alt-text for it

**Given** a content block containing Hindi (Devanagari) text
**When** it is rendered
**Then** it carries `lang="hi"` at the content-block level

**And** this authoring-time output is what Epic 3's cross-view golden-file parity tests will validate against once the student view exists

## Epic 3: Adaptive Learning Experience & Publish Lifecycle

Deliver the student-facing adaptive mechanisms — 5-level Drill-Down, 5 Ways, optional exercises, click-any-keyword definitions — pre-generated and cached via an async publish batch, plus the full Draft → In Review → Review Confirmed → Published lifecycle including tutor Review-as-Student and post-publish versioning. Bundled as one epic rather than split, because Review-as-Student structurally needs the adaptive components to exist to render anything meaningful, while Publish is what triggers the batch job that populates those same components' cached content — splitting them would force a forward-dependency violation. Execution order within this epic: student-facing UI stories build first against mock data (deployable checkpoint for review), then backend stories implement real generation/lifecycle logic and live-wire the UI to it.

**FRs covered:** FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25
**Also covers:** NFR3, NFR6, UX-DR10, UX-DR11, UX-DR12, UX-DR13, UX-DR14, UX-DR15, UX-DR19, UX-DR20 (student-view side)

**Parallelization note:** unlike Epics 1 and 2, every backend story in this epic (3.5–3.11) directly serves content into a Phase A mock screen, so there's no story here that's genuinely parallel-safe — all of Phase B waits for the Phase A review checkpoint.

### Story 3.1: Student Course Player Shell UI (Mock Data)

As a student,
I want to open a Topic/Subtopic and see Drill-Down Level 1 with the ability to reveal deeper levels, against mock cached content,
So that the core player UX can be validated before real generation exists.

**Acceptance Criteria:**

**Given** mock Drill-Down content
**When** the player loads
**Then** Level 1 shows first
**And** Level N+1 never shows before Level N is expanded

**Given** `DrilldownPanel.tsx`
**When** built in this story
**Then** its off-brand indigo/emerald Tailwind colors are swept to the real brand tokens (`ink-navy`/`citrus-amber`/`signal-green`) as part of this pass, not deferred

**Given** a tutor-override exists for a level (mock)
**When** rendered
**Then** it displays in place of AI content

**And** data access goes through a stable hook/service interface (e.g. `useDrilldownContent()`) from the start, so Phase B swaps the mock implementation behind it without changing component code

### Story 3.2: Ways Menu & Keyword Popover UI (Mock Data)

As a student,
I want to cycle through 5 alternative explanations and click any keyword for a definition, against mock content,
So that this UX can be validated before real generation exists.

**Acceptance Criteria:**

**Given** the Ways menu
**When** rendered
**Then** it is a small, secondary-weight pill/tray near Drill-Down's "Explain more" action, not a peer button
**And** each Way is independently focusable with `aria-current` on the displayed one

**Given** a keyword
**When** activated via Enter/Space (not click-only)
**Then** the definition popover keeps focus on the reading text and announces via `aria-live="polite"`

**And** data access goes through a stable hook/service interface (e.g. `useWays()`, `useKeywordDefinition()`) from the start, so Phase B swaps the mock implementation behind it without changing component code

### Story 3.3: Exercise Runner UI (Mock Data)

As a student,
I want inline practice exercises with immediate feedback, against mock exercise data,
So that this UX can be validated before real generation/grading exists.

**Acceptance Criteria:**

**Given** a node with a mock exercise
**When** rendered
**Then** it expands inline, reusing the existing Quiz runner's "expands in place" idiom
**And** numeric/math answers are captured as plain keyboard text entry, not a mouse-only visual equation editor

**Given** a node with no attached exercise
**When** rendered
**Then** it shows no practice affordance at all — not a disabled or empty state

**And** data access goes through a stable hook/service interface (e.g. `useExercise()`) from the start, so Phase B swaps the mock implementation behind it without changing component code

### Story 3.4: Publishing Lifecycle UI (Mock Data)

As a tutor,
I want to preview my course as a student, confirm review, and see publish progress, against mock lifecycle state,
So that this UX can be validated before real backend wiring exists.

**Acceptance Criteria:**

**Given** all nodes are mock-confirmed
**When** "Review as Student" is triggered
**Then** the course visually transitions to In Review

**Given** Review is not yet Confirmed
**When** viewing any earlier state
**Then** Publish is disabled

**Given** the publish batch running (mock)
**When** the checklist renders
**Then** it is a node-by-node "N of M confirmed nodes generated" list, never a spinner
**And** it lives in an `aria-live="polite"` container announcing meaningful increments and terminal states, not a play-by-play

**And** data access goes through a stable hook/service interface (e.g. `useCourseLifecycle()`) from the start, so Phase B swaps the mock implementation behind it without changing component code

### Story 3.5: Drill-Down & Ways AI Task Implementation

As the system,
I want `explainTopic(level)` and `rewriteExplanation(way)` implemented via the AI Service Layer with tutor-override storage,
So that Story 3.1 and 3.2's UI can display real generated content instead of mocks.

**Acceptance Criteria:**

**Given** a confirmed Topic/Subtopic
**When** `explainTopic(level)` runs via `IAiGateway`
**Then** it produces one of 5 progressive depth levels of the same explanation

**Given** `rewriteExplanation(way)` runs
**When** invoked
**Then** it produces one of 5 alternative explanations, each with its own worked example

**Given** a tutor override exists for a level or Way
**When** the content is served
**Then** the override serves in place of AI content from then on

### Story 3.6: Exercise Generation & Grading Backend

As a tutor,
I want to optionally attach an AI-proposed or self-authored exercise per node, with backend grading support,
So that students get real inline practice with immediate feedback.

**Acceptance Criteria:**

**Given** a confirmed node
**When** a tutor requests an AI-proposed exercise
**Then** one is generated via the AI Service Layer and can be edited or accepted

**Given** a student submits an answer
**When** the exercise runner (Story 3.3) checks it
**Then** immediate feedback is returned from real backend grading logic, not mock data

### Story 3.7: Keyword Definition Backend (`defineKeyword`)

As a student,
I want a real, subject- and language-aware definition when I click a keyword,
So that Story 3.2's popover shows accurate content instead of mocks.

**Acceptance Criteria:**

**Given** a keyword click
**When** `defineKeyword()` runs via the AI Service Layer
**Then** it returns a subject- and language-aware definition

**Given** a tutor-authored override exists for that keyword
**When** the definition is served
**Then** the override takes priority and is visually indistinguishable from an AI-generated one

**Given** the same keyword clicked in two different-subject courses
**When** resolved
**Then** each can surface a different, correct definition

### Story 3.8: Publish Batch Job & Pre-Generation Caching

*(Sizing risk: Hangfire batch wiring, atomic-counter completion, on-demand fallback, and checklist live-wiring together. If it doesn't fit a single dev session, the natural split is batch-job-and-caching first, fallback-and-UI-wiring second.)*

As a tutor,
I want Drill-Down and Ways content pre-generated and cached for every confirmed node when I publish,
So that students never wait on AI generation while viewing the course.

**Acceptance Criteria:**

**Given** a course entering Publish
**When** the Hangfire-driven batch job runs
**Then** it generates and caches Drill-Down and Ways content for every confirmed node, one job per node, independently retryable

**Given** a single node's generation fails
**When** the batch completes
**Then** that node falls back to on-demand generation rather than ever rendering empty, and the batch is not blocked

**Given** the last remaining batch item completes
**When** its atomic `remaining` counter reaches zero
**Then** it claims batch completion and flips the course from Publishing to Published

**Given** Story 3.4's checklist UI
**When** the real batch runs
**Then** it reflects real per-node job status instead of mock simulation

### Story 3.9: Review as Student & Lifecycle Transitions

As a tutor,
I want to experience my course exactly as a student would before publishing,
So that I catch issues before students ever see them.

**Acceptance Criteria:**

**Given** all nodes are confirmed
**When** a tutor triggers "Review as Student"
**Then** it reuses `CoursePlayer`'s real adaptive-learning components via the sanctioned `CourseContentEditor` → `CoursePlayer` cross-feature import, and the course transitions to In Review

**Given** Review is not yet Confirmed
**When** any earlier Lifecycle State is active
**Then** Publish remains unreachable

**Given** Story 3.4's UI
**When** real lifecycle state changes
**Then** it reflects real transitions instead of mock state

**Given** a Draft course with wizard metadata and content-tree state
**When** a tutor leaves and later returns (including across a logout/login boundary)
**Then** the course resumes exactly where it was left, combining wizard and content-tree state coherently *(FR22)*

### Story 3.10: Publish, Versioning & Rollback

As a tutor,
I want to publish my course with the current state saved as a version, and be able to return a Published course to Draft to make fixes,
So that I can safely iterate on a live course without losing prior published state.

**Acceptance Criteria:**

**Given** Review Confirmed
**When** a tutor publishes
**Then** a deep-copy snapshot of the entire confirmed content tree plus cached Drill-Down/Way content is saved as a version, and the course becomes Published

**Given** a Published course
**When** a tutor returns it to Draft
**Then** the prior published state is retained as a version, and re-publish is gated by Review Confirmed exactly like first-time publish

### Story 3.11: Cross-View Golden-File Visual Regression Parity

As a QA engineer,
I want automated visual regression tests comparing the editor and student views for math, chemistry, and Hindi content,
So that rendering drift between the two views is caught automatically, not by manual inspection.

**Acceptance Criteria:**

**Given** the editor (Epic 2) and student view (this epic) both exist
**When** the Vitest 4 `toMatchScreenshot()` suite runs
**Then** it catches rendering drift for math, chemistry, and Hindi-script content between the two views

**Given** CI runs these tests
**When** fonts and KaTeX rendering are involved
**Then** the suite waits for `document.fonts.ready` and pins fonts for determinism
