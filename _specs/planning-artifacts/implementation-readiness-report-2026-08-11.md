---
stepsCompleted: [1, 2, 3, 4, 5, 6]
documentsIncluded:
  - _specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md
  - _specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/addendum.md
  - _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md
  - _specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md
  - _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/DESIGN.md
  - _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/EXPERIENCE.md
  - _specs/planning-artifacts/epics.md
excludedDocuments:
  - _specs/planning-artifacts/prds/prd-eLearning-2026-08-10/prd.md (Dashboard merge — separate track)
  - _specs/planning-artifacts/prds/prd-eLearning-Assignments-2026-08-10/prd.md (Assignments merge — separate track)
---

# Implementation Readiness Assessment Report

**Date:** 2026-08-11
**Project:** eLearning — New Course Wizard

## Document Discovery

**PRD:** `prd-eLearning-CourseWizard-2026-08-10/prd.md` + `addendum.md`
**Architecture:** `architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md`, `architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md` (whole-app; carry this PRD's additions)
**UX:** `ux-eLearning-2026-08-10/DESIGN.md` + `EXPERIENCE.md` (whole-app)
**Epics & Stories:** `epics.md` (scoped to New Course Wizard only)

No whole+sharded duplicates found. Dashboard and Assignments PRDs exist but have no corresponding epics/stories yet — out of scope for this assessment by design.

## PRD Analysis

### Functional Requirements

FR-1: Feature code (frontend and backend) can invoke AI capability only through the internal AI Service Layer; no feature module calls a vendor AI SDK directly.
FR-2: Admin can change the active provider/model for a given AI Task and have it take effect without an application redeploy of feature code; self-hosted zero-markup OSS gateway from day one; a locally-run self-hosted model is a selectable backend for any AI Task; config store supports runtime (DB/API-driven) updates, not file-based config requiring a restart.
FR-3: The gateway supports assigning a different model per AI Task, and retries on an alternate provider when the primary is rate-limited or unavailable; every fallback event is logged and flagged via usage tracking.
FR-4: The gateway records token usage and computed cost for every AI Task invocation, attributed to the task and (where applicable) the course/tutor that triggered it; free-tier dev usage tracked the same way as paid usage.
FR-5: Prompts and model/provider config for every AI Task live in one centralized, versioned location, not scattered across feature code; changes are attributable to a version for rollback.
FR-6: Tutor enters a required, single-line Course Title (trimmed, non-empty, max length enforced) and an optional short description/subtitle.
FR-7: Tutor selects zero or more Tags from a searchable, type-ahead multi-select populated from the admin-governed Tag list; free-text tag entry is not available; deactivated tags stay attached to a course that already had them but aren't reselectable.
FR-8: Tutor selects Country → State → City → Board → Class Level → Subject via cascading dropdowns backed by existing admin-governed master data (MasterDataManager); Country/Board/Class Level/Subject required, State/City board-dependent per master data.
FR-9: Tutor uploads up to 3 thumbnail images, cropping each to a fixed aspect ratio client-side before acceptance, with preview, reorder, delete, and set-primary actions; a 4th upload is rejected with a clear message.
FR-10: The wizard shows a progress indicator across all steps (metadata + content), validates the current step before enabling "Next," and auto-persists wizard state as a Draft after every step; closing and returning resumes at the last-completed step.
FR-11: Tutor uploads one or more files (PDF/Word/TXT/Excel), each with independent progress, type/size/integrity validation, and secure storage scoped to course-owner; files are scanned for malware/type-mismatch via a free self-hosted scanner before parsing.
FR-12: Before `extractStructure()` runs, the system runs a dedicated document-parsing pass (with OCR for scanned pages, via a free self-hosted parser) to produce clean structured text; low-confidence parse output routes to failed/retry, not silent pass-through.
FR-13: For each successfully parsed file, the gateway's `extractStructure()` AI Task proposes a nested Chapter → Topic → Subtopic → Content structure, with per-file status (queued/parsing/extracting/done/failed) and independent retry; files that finish first surface immediately.
FR-14: Tutor can add, edit, delete, and reorder any Chapter, Topic, Subtopic, or Content Block, whether AI-extracted or tutor-added; deleting a Chapter cascades to descendants; reordering persists across reload.
FR-15: Each node carries an explicit tutor-confirmation state, separate from content edits; a text-only edit preserves confirmation; a structural or AI-content-regenerating edit resets it, requiring re-confirmation before Review as Student or Publish.
FR-16: Both the tutor's editor and the student's view correctly author and display math/physics notation, chemistry (formulas/reactions as notation, structural diagrams as images), biology diagrams, and English/Hindi text — identically (reusing existing KaTeX rendering, extended with `mhchem`); golden-file visual-regression tests enforce parity; rendered notation carries AI-generated (`describeNotation()`) screen-reader alt-text; Hindi content carries the correct `lang="hi"` attribute.
FR-17: Every Topic/Subtopic has 5 Drill-Down Levels, generated via `explainTopic(level)`, tutor-editable, revealed one level at a time; a student never sees Level N+1 before expanding Level N.
FR-18: Every Topic/Subtopic has 5 "Ways" (alternative explanations), each generated via `rewriteExplanation(way)` with its own worked example, tutor-editable, freely cyclable in any order (not gated like Drill-Down).
FR-19: Tutor can optionally attach exercises per node (self-authored or AI-proposed via `generateExercise()`); students perform them inline with subject-appropriate answer types and immediate feedback/worked solution; a node with no exercise shows no practice affordance.
FR-20: Any keyword in course content can be clicked for an inline definition popover via `defineKeyword()`, subject/language-aware; tutor overrides take priority; the same keyword can surface different definitions in different-subject courses.
FR-21: Drill-Down and Ways content are generated for every confirmed node at publish time (async batch via a transient `Publishing` sub-state, not on-demand per view), cached; editing and re-publishing regenerates only the edited node's cache; a single node's generation failure falls back to on-demand generation rather than blocking the rest of the course from publishing.
FR-22: Tutor can leave and resume a course in Draft state at any point, in the wizard or content editing, with all prior input intact.
FR-23: Tutor can preview the full course exactly as a student would see it (Review as Student) once all nodes are confirmed; every adaptive-learning affordance is exercisable; entering this mode transitions the course to In Review.
FR-24: Tutor must explicitly Confirm Review (→ Review Confirmed) before Publish becomes available; Publish is disabled at every earlier Lifecycle State; publishing begins the async generation batch (FR-21) and transitions to Published once it completes.
FR-25: A tutor can return a Published course to Draft to make fixes; prior published state is retained as a version; a text-only edit to a confirmed node can re-publish without fresh Confirm Review, a structural/regenerating edit requires it; re-publish is gated by Review Confirmed exactly like first-time publish.
FR-26: Admin can add, rename, deactivate, and search Tags; duplicate names (case-insensitive, active or deactivated) are prevented; deactivating a tag hides it from new selection without removing it from courses already using it; this is net-new work, not an extension of MasterDataManager.
FR-27: Admin can view and change the active provider/model for each AI Task (7 tasks: `extractStructure`, `explainTopic`, `rewriteExplanation`, `generateExercise`, `defineKeyword`, `describeNotation`, embeddings) independently, and configure a fallback provider/model per task.
FR-28: Admin can view token usage and computed cost, broken down by AI Task and by date range.
FR-29: Admin can set a cost threshold per AI Task and/or platform-wide; a warning surfaces approaching threshold (e.g. 80%); the gateway blocks routing new requests that would exceed it, before the fact, not just reporting spend after.

Total FRs: 29

### Non-Functional Requirements

NFR1 (Cost control): Free/cheap-tier models (including local models) by default in dev; per-task cost tracking live from day one; high-volume tasks (`defineKeyword`) default-routed to the cheapest viable tier; budget thresholds are an enforced guardrail, not just a dashboard.
NFR2 (Portability): No vendor lock-in — a provider/model swap is a configuration change, never a code change, via a self-hosted zero-markup OSS gateway from day one (no managed-then-self-hosted phasing).
NFR3 (Performance): Large-file processing is asynchronous and non-blocking per file; student-facing Drill-Down/Way content is pre-generated and cached for near-instant response; Keyword definitions target low-latency on-demand response.
NFR4 (Reliability): Per-file failure never loses other files' progress; AI-layer fallback covers provider outage/rate-limiting; wizard state auto-persists so no in-progress work is lost to a closed tab or crash.
NFR5 (Security & Privacy): Uploaded files are access-controlled and scanned before processing; dev-phase usage on real-ish student content is restricted to providers that don't train on input by default; self-hosting the gateway means student data never transits a third-party managed relay.
NFR6 (Accessibility & i18n): Multilingual scripts (English, Hindi) and mathematical/scientific notation render correctly across devices; standard accessibility practices apply to all new interactive surfaces; WCAG 2.1 AA assumed as the conformance target (unconfirmed).
NFR7 (High-volume task routing, §4.9 feature-specific): `defineKeyword()` is routed to the cheapest/fastest AI Task tier by default, given its high expected call volume.

Total NFRs: 7

### Additional Requirements

- Supersedes Dashboard PRD's FR-18 (old 4-step Course Creation Wizard) in full — replacement, not addition.
- Reuses `masterDataService.ts`/`MasterDataManager.tsx` for taxonomy (FR-8) — no new taxonomy admin CRUD.
- Reuses existing `DrilldownPanel.tsx` for FR-17's UI, wiring real AI content behind static mock data — but Ways/Exercises/Keyword UI surfaces are explicitly NOT assumed to already exist there (net-new surfaces per the PRD's own note).
- `[NOTE FOR PM]` flags in the source PRD (already resolved by the architecture spines during the architecture pass): golden-file visual-regression tooling needs a distinct tool from the existing `vitest`+`@testing-library/react` DOM-assertion convention (resolved: Vitest 4 `toMatchScreenshot()`, Frontend AD-6); the `Publishing` sub-state needs a worker/job execution model neither original architecture doc had (resolved: Hangfire, Backend AD-15); FR-29's concurrent budget-counter mechanism needs explicit naming (resolved: atomic DB `UPDATE...RETURNING`, Backend AD-18); FR-25's versioning storage approach needs explicit design (resolved: deep-copy snapshot, Backend AD-17).
- Open Questions from the PRD (§8) not yet closed: exercise auto-grading (deferred, non-blocking — MVP is shown-solution/immediate-feedback per §6.2); keyword-definition caching policy (deferred, non-blocking — on-demand generation is the MVP behavior either way); final provider/model selection per AI Task (explicitly a build-time decision, already reflected as "Deferred, not in scope for this epic set" in `epics.md`); exact WCAG conformance level beyond the assumed 2.1 AA floor (already adopted as the working floor across UX/architecture/epics).
- Assumptions Index (§9, ~14 items) — mostly numeric/product-detail placeholders (Title max length, thumbnail size cap/aspect ratio, upload size cap, OCR confidence threshold, version-retention count, `defineKeyword` latency target) explicitly marked "confirm before build" in the source PRD. None are blocking for epic/story structure; they're implementation-detail decisions for the dev agent to make or confirm during story execution, not requirements gaps.

### PRD Completeness Assessment

The PRD is thorough, internally consistent, and every FR carries testable "Consequences." All four `[NOTE FOR PM]` architecture-scoping flags raised in the source PRD were subsequently resolved in the two architecture spines (traced above) — none remain open. The Assumptions Index items are appropriately-scoped implementation-detail placeholders, not structural gaps. This PRD is complete and ready to serve as the epics/stories traceability baseline.

## Epic Coverage Validation

### Coverage Matrix

| FR | PRD Requirement (short) | Epic Coverage | Status |
|---|---|---|---|
| FR1 | Provider-agnostic AI gateway | Epic 1, Story 1.4 | ✓ Covered |
| FR2 | Config-only provider/model swap | Epic 1, Story 1.5 | ✓ Covered |
| FR3 | Per-task model selection & fallback | Epic 1, Story 1.6 | ✓ Covered |
| FR4 | Token usage & cost tracking | Epic 1, Story 1.7 | ✓ Covered |
| FR5 | Centralized, versioned prompt/model config | Epic 1, Story 1.5 | ✓ Covered |
| FR6 | Course Title step | Epic 2, Stories 2.1, 2.4 | ✓ Covered |
| FR7 | Tags step | Epic 2, Stories 2.1, 2.5 | ✓ Covered |
| FR8 | Academic Taxonomy step | Epic 2, Stories 2.1, 2.5 | ✓ Covered |
| FR9 | Thumbnails step | Epic 2, Stories 2.1, 2.4 | ✓ Covered |
| FR10 | Step progression/validation/auto-persist | Epic 2, Stories 2.1, 2.4 | ✓ Covered |
| FR11 | Multi-file upload with per-file progress | Epic 2, Stories 2.2, 2.6 | ✓ Covered |
| FR12 | Parsing/OCR pre-step | Epic 2, Story 2.7 | ✓ Covered |
| FR13 | AI-driven structure extraction | Epic 2, Story 2.8 | ✓ Covered |
| FR14 | Add/modify/delete/reorder any node | Epic 2, Stories 2.3, 2.9 | ✓ Covered |
| FR15 | Explicit per-node confirmation | Epic 2, Stories 2.3, 2.9 | ✓ Covered |
| FR16 | WYSIWYG parity across subjects/scripts | Epic 2 (Stories 2.3, 2.10, editor-side), Epic 3 (Story 3.11, cross-view parity) | ✓ Covered |
| FR17 | Five-level drill-down | Epic 3, Stories 3.1, 3.5 | ✓ Covered |
| FR18 | Five alternative explanations | Epic 3, Stories 3.2, 3.5 | ✓ Covered |
| FR19 | Optional per-node exercises | Epic 3, Stories 3.3, 3.6 | ✓ Covered |
| FR20 | Inline keyword definition popover | Epic 3, Stories 3.2, 3.7 | ✓ Covered |
| FR21 | Pre-generate and cache at publish | Epic 3, Stories 3.4, 3.8 | ✓ Covered |
| FR22 | Save as Draft at any point | Epic 3, Story 3.9 (folded AC) | ✓ Covered |
| FR23 | Review as Student mode | Epic 3, Stories 3.4, 3.9 | ✓ Covered |
| FR24 | Required review confirmation gates Publish | Epic 3, Stories 3.4, 3.9 | ✓ Covered |
| FR25 | Post-publish editing with versioning | Epic 3, Stories 3.4, 3.10 | ✓ Covered |
| FR26 | Tag CRUD with deactivation/dedup | Epic 1, Stories 1.3, 1.9 | ✓ Covered |
| FR27 | Per-task provider/model/fallback config UI | Epic 1, Stories 1.1, 1.5 | ✓ Covered |
| FR28 | Usage and cost visibility per task | Epic 1, Stories 1.2, 1.7 | ✓ Covered |
| FR29 | Budget threshold enforcement per task | Epic 1, Stories 1.1, 1.8 | ✓ Covered |

### Missing Requirements

None. All 29 FRs trace to at least one story with acceptance criteria addressing it.

### Coverage Statistics

- Total PRD FRs: 29
- FRs covered in epics: 29
- Coverage percentage: 100%

## UX Alignment Assessment

### UX Document Status

**Found** — `DESIGN.md` + `EXPERIENCE.md` (whole-app UX spine pair, `status: final`), extended specifically for this PRD with new IA rows, Component Patterns, State Patterns, Accessibility Floor entries, Key Flows for UJ-1–UJ-4, and 5 new design tokens (UX-DR19).

### UX ↔ PRD Alignment

- All four PRD user journeys (UJ-1 scanned-chapter extraction, UJ-2 drill-down/Ways/keyword, UJ-3 admin model swap, UJ-4 Review as Student) have corresponding Key Flows in `EXPERIENCE.md`.
- 20 UX-DRs extracted from the UX spines all trace back to a PRD FR or a UX-discovered refinement of one (e.g. UX-DR10's `DrilldownPanel.tsx` color remediation is UX-discovered scope, not a separate PRD FR — folded into FR17's implementation rather than left as an orphaned requirement).
- No UX requirement contradicts a PRD FR.

### UX ↔ Architecture Alignment

Spot-checked the UX requirements most dependent on backend behavior against both architecture spines:

| UX Requirement | Architecture Support |
|---|---|
| UX-DR14 (publish checklist, survives tab-close, `aria-live`) | Backend AD-15 (Hangfire batch) + AD-16 (atomic completion) — job state is durable and queryable, supporting a resumable checklist |
| UX-DR20 (golden-file visual regression) | Frontend AD-6 (Vitest 4 `toMatchScreenshot()`) — dedicated tooling added, not assumed to fall out of the existing DOM-assertion test convention |
| UX-DR9 (extraction status badges) | Backend AD-15's `JobItemStatus` enum — per-file status is a first-class domain concept, not inferred from Hangfire's own monitoring API |
| UX-DR16/UX-DR17 (AI Configuration table, budget warning) | Backend AD-19 (`AiTaskConfig`/`AiPromptVersion`) + AD-18 (pre-flight atomic budget reserve) |
| UX-DR5 (sticky lifecycle stage indicator) | Backend Lifecycle State model + AD-17 (version snapshot) |
| UX-DR3 (taxonomy required-ness per board) | No new architecture needed — correctly reuses existing `MasterDataManager` |

No UX requirement found without architectural backing.

### Alignment Issues

None found.

### Warnings

None — UX documentation exists, is current (`status: final`, updated 2026-08-11, same day as this PRD's cost-review revision), and was built with this PRD as direct input.

## Epic Quality Review

Applying `create-epics-and-stories` standards rigorously, independent of the checks already run during that workflow's own Step 4.

### Epic Structure Validation

**User Value Focus:**
- Epic 2 ("Course Authoring...") and Epic 3 ("Adaptive Learning Experience & Publish Lifecycle") are unambiguously user-centric — Tutor and Student outcomes respectively.
- Epic 1 ("AI Backbone & Admin Control") is a borderline case by this checklist's own standard (comparable to its "Authentication System" example) — "Backbone" reads technical, but every story in it is genuinely Admin-facing (a real persona per PRD §2.1, realizing UJ-3) with a working screen delivered, not a hidden technical milestone. Judged **not a violation**, same conclusion as the create-epics-and-stories Step 4 pass, but flagged here again under independent scrutiny since it's the one epic worth a second look.

**Epic Independence:** Verified by re-tracing every cross-epic reference in `epics.md` — Epic 2 only references Epic 1 outputs (Story 1.9's Tag backend, Story 1.4's gateway), Epic 3 only references Epic 1 & 2 outputs. No epic references a later epic. Passes.

### Story Quality & Dependency Analysis

**Forward dependencies:** Re-checked every `Story X.Y` cross-reference in the document (28 references found via search) — every one points to a lower-numbered story in the same epic or an earlier epic. Zero forward references. Passes.

**Database/Entity creation timing:** `AiTaskConfig`/`AiPromptVersion` (Story 1.5) and Tag entities (Story 1.9) are created in Epic 1 where first needed; `Chapter`/`Topic`/`Subtopic`/`ContentBlock` (Story 2.9) are created in Epic 2, not dumped upfront in Epic 1 despite being thematically adjacent to the AI backbone. Passes.

**Starter template / brownfield indicators:** No starter template specified (correctly — Additional Requirements explicitly notes this is a brownfield extension), and Epic 1 Story 1.1 is not a scaffold story. Brownfield integration points are present (Story 2.5 reuses `MasterDataManager`; Story 1.4 follows existing `AddInfrastructure()` DI convention).

### 🔴 Critical Violations

None found.

### 🟠 Major Issues

**Old wizard removal has no story coverage.** The Additional Requirements section states plainly: *"the old 4-step Course Creation Wizard in `TutorEducatorHubView.tsx` (~950 lines, flat Module/Lesson model) is removed as part of this feature, not left running alongside the new wizard."* This is an explicit, unambiguous brownfield migration requirement — exactly the kind of thing this step's checklist calls out ("Brownfield projects should have: ...migration or compatibility stories"). Searched every story's acceptance criteria — none references removing or retiring the old component. It's currently documentation intent with zero implementation traceability.
- **Recommendation:** Add an AC to Story 2.4 (the point where the new wizard's persistence goes live, the natural retirement point) requiring `TutorEducatorHubView.tsx`'s old wizard code path to be removed, not just superseded in the UI's routing — or add a small dedicated story if the removal is non-trivial (e.g. if other flows still reference the old flat Module/Lesson model).

### 🟡 Minor Concerns

- **Story 2.8 doesn't name its execution mechanism.** The Additional Requirements section states Hangfire "governs both the publish batch and the file-extraction pipeline," and Story 3.8 explicitly references Hangfire, but Story 2.8's AC only specifies behavior (independent per-file status, non-blocking failure) without naming Hangfire as the mechanism. The behavior is correctly specified either way; this is a traceability nicety, not a functional gap.
- **New Docker Compose services aren't called out as ACs in their owning stories.** The `ai-gateway`, `docling`, and `clamav` services (Backend AD-13) are implied by Stories 1.4, 2.7, and 2.6 respectively but never stated as an explicit AC (e.g. "the `docling` service is added to `docker-compose.yml` under the `backend`/`all` profile"). Low severity — standard implementation detail a dev agent would reasonably infer — but adding it removes any ambiguity for whoever picks up those three stories first.

### Best Practices Compliance Checklist

| Check | Epic 1 | Epic 2 | Epic 3 |
|---|---|---|---|
| Delivers user value | ✓ (Admin) | ✓ (Tutor) | ✓ (Student + Tutor) |
| Functions independently | ✓ | ✓ (built on Epic 1) | ✓ (built on Epic 1 & 2) |
| Stories appropriately sized | ✓ (3 flagged sizing-risk, not blocking) | ✓ | ✓ |
| No forward dependencies | ✓ | ✓ | ✓ |
| Entities created when needed | ✓ | ✓ | ✓ (none new) |
| Clear acceptance criteria | ✓ | ✓ | ✓ |
| Traceable to FRs | ✓ | ✓ | ✓ |

## Summary and Recommendations

### Overall Readiness Status

**READY** — the one Major issue found during this assessment has been fixed directly in `epics.md`.

### Critical Issues Requiring Immediate Action

None. Zero Critical violations across FR coverage, UX alignment, and epic/story structure.

### Major Issue — FIXED during this assessment

1. **Old wizard removal was undocumented in stories.** The requirement to remove `TutorEducatorHubView.tsx`'s old 4-step wizard existed only as an Additional Requirements bullet, with zero story-level acceptance criteria. **Fixed:** added an explicit AC to Story 2.4 requiring the old wizard's removal, not left running alongside the new one.

### Minor Concerns (optional, low-risk to defer)

2. Story 2.8 doesn't name Hangfire as its execution mechanism, even though Additional Requirements assigns it there alongside Story 3.8's publish batch — a traceability nicety.
3. The three new Docker Compose services (`ai-gateway`, `docling`, `clamav`) aren't stated as explicit ACs in Stories 1.4, 2.7, and 2.6 — implied but not spelled out.

### Recommended Next Steps

1. ~~Add the old-wizard-removal AC to Story 2.4 in `epics.md`~~ — done during this assessment.
2. Optionally tighten Stories 2.8, 1.4, 2.7, and 2.6 with the two minor-concern additions above.
3. Proceed to `bmad-sprint-planning` — nothing found here blocks sequencing the 29 stories into a sprint plan.

### Final Note

This assessment identified 3 issues (0 critical, 1 major, 2 minor) across FR coverage (0 gaps, 100% traced), UX alignment (0 gaps), and epic/story quality (1 major — fixed, 2 minor — optional). PRD, UX, both architecture spines, and `epics.md` are otherwise fully aligned and internally consistent. The Minor concerns can be fixed now or picked up naturally when their owning stories are worked; neither blocks implementation.
