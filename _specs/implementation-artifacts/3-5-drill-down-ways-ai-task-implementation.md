---
baseline_commit: e64e8b260d54a2ac01680d582cacc80de715e147
---

# Story 3.5: Drill-Down & Ways AI Task Implementation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

<!-- First Phase B story -- real backend generation/lifecycle logic begins here, live-wiring Phase
A's mock UI (Stories 3.1/3.2). -->

## Story

As the system,
I want `explainTopic(level)` and `rewriteExplanation(way)` implemented via the AI Service Layer with tutor-override storage,
so that Story 3.1 and 3.2's UI can display real generated content instead of mocks.

## Acceptance Criteria

1. **Given** a confirmed Topic/Subtopic, **when** `explainTopic(level)` runs via `IAiTaskGateway`, **then** it produces one of 5 progressive depth levels of the same explanation. [Source: epics.md Story 3.5; PRD FR17]
2. **Given** `rewriteExplanation(way)` runs, **when** invoked, **then** it produces one of 5 alternative explanations, each with its own worked example. [Source: epics.md Story 3.5; PRD FR18]
3. **Given** a tutor override exists for a level or Way, **when** the content is served, **then** the override serves in place of AI content from then on. [Source: epics.md Story 3.5; PRD FR17/FR18]
4. **Given** a Published course's node whose pre-generation failed or was never generated, **when** a student requests it, **then** it generates on-demand as a fallback rather than the student ever seeing empty content. [Source: PRD FR21]

## Tasks / Subtasks

### Backend

- [x] Task 1: `DrilldownLevel`/`WayContent` Domain entities + persistence (AC: #1, #2, #3)
  - [x] New feature folder `Application/AdaptiveLearning/` and `Domain/AdaptiveLearning/` — Drilldown, Ways (this story), Exercises (Story 3.6), and Keyword Definitions (Story 3.7) all live here as one conceptual feature area, matching this epic's own "Adaptive Learning Experience" framing, rather than being scattered across the existing `Courses` feature folder.
  - [x] `Domain/AdaptiveLearning/DrilldownLevel.cs` (`AuditableEntity`): `TopicId?`/`SubtopicId?` (exactly one set, same mutual-exclusivity pattern as `ContentBlock.TopicId`/`SubtopicId`), `LevelNumber` (int, 1-5), `GeneratedContentJson` (string, nullable — null until first generated), `OverrideContentJson` (string, nullable — a tutor override). Both JSON columns store the same shape: `{ title, subtitle, content, keyPoints: string[], mathFormulas?: string[], examples: ExampleItem[] }` (mirrors the frontend's own `DrillLevelData`/`ExampleItem` shape from Story 3.1, so the DTO mapping is a straight pass-through, not a reshaping) — **reuses Story 2.8's own established precedent of storing structured AI output as raw JSON rather than fully normalizing every nested field into columns** (`CourseFile.ExtractedStructureJson`), not a new pattern.
  - [x] `Domain/AdaptiveLearning/WayContent.cs` (`AuditableEntity`): same `TopicId?`/`SubtopicId?` pattern, `WayNumber` (int, 1-5), `GeneratedContentJson`/`OverrideContentJson` (shape: `{ explanation: string, example: ExampleItem }`).
  - [x] EF configurations (`Infrastructure/Persistence/Configurations/{DrilldownLevelConfiguration.cs, WayContentConfiguration.cs}`), unique index on `(TopicId, SubtopicId, LevelNumber)`/`(TopicId, SubtopicId, WayNumber)` (a node has at most one row per level/way number — enforced at the DB level, not just app-level, since a duplicate here would be a real data-integrity bug, not just a display glitch). Migration.
  - [x] `IsOverridden` is **not a stored column** — computed as `OverrideContentJson is not null` wherever needed (matches `ContentBlock`'s own precedent of deriving state rather than storing a redundant flag alongside the data it's redundant with).
- [x] Task 2: `DrilldownPromptBuilder.cs` / `WaysPromptBuilder.cs` (AC: #1, #2)
  - [x] `Application/AdaptiveLearning/DrilldownPromptBuilder.cs` (static, pure — same shape as `ExtractionPromptBuilder.cs`/`NotationDescriptionPromptBuilder.cs`): `BuildMessages(string nodeContent, int level): IReadOnlyList<AiGatewayMessage>`. `nodeContent` is the Topic/Subtopic's own aggregated `ContentBlock` text (tutor-authored/AI-extracted course material for that node — the raw material Drill-Down explains, analogous to how `ExtractionPromptBuilder` takes a whole document's `ParsedContent`). System prompt instructs progressively deeper/more-rigorous explanation per `level` (1 = simplest, 5 = most rigorous), same JSON-schema-only response discipline as `ExtractionPromptBuilder`'s own system prompt (a `{title, subtitle, content, keyPoints, mathFormulas?, examples}` schema, reusing that story's exact "respond with ONLY JSON, no prose/markdown fences" instruction pattern).
  - [x] `Application/AdaptiveLearning/WaysPromptBuilder.cs`: `BuildMessages(string nodeContent, int wayNumber): IReadOnlyList<AiGatewayMessage>` — instructs a genuinely different explanatory angle/analogy per `wayNumber` (not a rephrasing of the same explanation), each with its own worked example (`{explanation, example}` schema).
  - [x] A shared `AdaptiveLearningResponseParser.cs` (static, pure — mirrors `ExtractionResponseParser`'s own validated-parse-not-blind-deserialize discipline): `TryParseLevel(string aiContent, out DrilldownLevelContent?, out string? parseError)` / `TryParseWay(...)` — malformed/incomplete AI JSON fails closed (returns false), never silently saved as a broken level/way, same AC#2-equivalent low-confidence-output discipline Stories 2.7/2.8 already established twice in this codebase.
- [x] Task 3: `IAdaptiveLearningService`/`AdaptiveLearningService` — generation, override storage, and the read/fallback path (AC: #1, #2, #3, #4)
  - [x] `Application/AdaptiveLearning/{IAdaptiveLearningService.cs, AdaptiveLearningService.cs, AdaptiveLearningDtos.cs}`. Depends on `IAiTaskGateway` (not `IAiGateway` directly, matching `IAiTaskGateway.cs`'s own header comment), `IContentTreeRepository`-equivalent read access to a Topic/Subtopic's `ContentBlock`s (reuse Story 2.9's `IContentTreeRepository`/its `FindNodeAsync`, do not build a parallel content-tree reader), and a new `IAdaptiveLearningRepository` for the two entities above.
  - [x] `GenerateLevelAsync(courseId, nodeId, level, cancellationToken): Task<DrilldownLevelDto>` — resolves the node's aggregated content, calls `IAiTaskGateway.ExplainTopicAsync`, parses via Task 2's parser, upserts the `DrilldownLevel` row's `GeneratedContentJson` (never touches `OverrideContentJson`), returns the DTO reflecting **override-if-present, else generated** (AC#3's "override serves in place" rule, enforced at the read/DTO-mapping layer so every caller gets it for free rather than each caller having to remember to check). Same shape for `GenerateWayAsync`.
  - [x] `GetOrGenerateLevelAsync(courseId, nodeId, level, cancellationToken): Task<DrilldownLevelDto>` — the **student-facing on-demand-fallback read path** (AC#4): if a row exists with a non-null `GeneratedContentJson` or `OverrideContentJson`, return it directly (cache hit, no AI call); otherwise call `GenerateLevelAsync` synchronously and return the freshly generated result. Requires `Course.LifecycleState == Published` (a student can only read Drill-Down/Ways for a course that's actually live) — `[ASSUMPTION: reading a non-Published course's Drill-Down content is out of scope for this story; Story 3.9's own Review-as-Student mode is a distinct, tutor-only path that this story does not gate identically -- confirm during dev whether Review-as-Student needs its own bypass of this Published-only check, since epics.md's own Story 3.9 text implies a tutor previews adaptive content before the course is Published at all.]` Same shape for `GetOrGenerateWayAsync`.
  - [x] `SetLevelOverrideAsync(courseId, nodeId, level, content, cancellationToken): Task` / `SetWayOverrideAsync(...)` — tutor-only (starts with `ICourseService.EnsureOwnedDraftAsync`-equivalent ownership check; **note this specifically is NOT `EnsureOwnedDraftAsync` itself**, since a tutor sets overrides on a course that may already be Published, not only while it's a Draft — reuse whichever of `ICourseService`'s existing methods actually checks "is this caller this course's owning tutor" without ALSO requiring `LifecycleState == Draft`; if no such method exists yet, this is this story's own gap to close, not a pre-existing one to silently work around). Writes `OverrideContentJson`, leaving `GeneratedContentJson` untouched (so removing an override later can fall back to the last real AI generation instead of needing to regenerate).
- [x] Task 4: `Api/Controllers/AdaptiveLearningController.cs` (AC: #1, #2, #3, #4)
  - [x] `[Route("api/v1/courses/{courseId}/adaptive-learning")]`. `GET nodes/{nodeId}/drilldown/{level}` and `GET nodes/{nodeId}/ways/{wayNumber}` — student-facing reads, calls `GetOrGenerateLevelAsync`/`GetOrGenerateWayAsync`, **no `[Authorize(Policy = FeatureKeys.CoursesCreate)]`** (any authenticated student, not tutor-gated — confirm this codebase's existing convention for a student-facing, non-tutor endpoint, e.g. how `CoursesController.GetCourseByIdAsync` is itself authorized, and match it rather than inventing a new auth shape). `PUT nodes/{nodeId}/drilldown/{level}/override` / `PUT nodes/{nodeId}/ways/{wayNumber}/override` — tutor-facing writes, `[Authorize(Policy = FeatureKeys.CoursesCreate)]`.
- [x] Task 5: Backend tests (AD-7)
  - [x] `FlexDemy.Application.Tests/AdaptiveLearning/{DrilldownPromptBuilderTests.cs, WaysPromptBuilderTests.cs, AdaptiveLearningResponseParserTests.cs}` (new): prompt builders include node content + level/way number in the built messages; parser rejects malformed/incomplete JSON, accepts well-formed JSON for both shapes.
  - [x] `FlexDemy.Application.Tests/AdaptiveLearning/AdaptiveLearningServiceTests.cs` (new): `GenerateLevelAsync` calls `IAiTaskGateway.ExplainTopicAsync` and persists to `GeneratedContentJson`, never `OverrideContentJson`; `GetOrGenerateLevelAsync` returns a cached row without calling the gateway when one exists, and generates+persists when none does; a row with a non-null `OverrideContentJson` is served over `GeneratedContentJson` by every read path; `SetLevelOverrideAsync` requires tutor ownership and never requires `LifecycleState == Draft`; same coverage mirrored for Ways.

## Dev Notes

- **`explainTopic`/`rewriteExplanation` are `IAiTaskGateway.ExplainTopicAsync`/`RewriteExplanationAsync` — confirmed already on the interface, unused by any real caller until this story** (direct read of `IAiTaskGateway.cs` this session). This story is their first real caller — no interface change needed, only a real `AiTaskRequest` built per-call the way `ExtractStructureJob.cs` already demonstrates (`CourseId`/`TutorId` attribution, `MaxTokens` set explicitly per that story's own "don't leave it at the provider default" lesson).
- **Generation here is a plain synchronous service call, never a Hangfire job of its own** — Story 3.8 owns the Hangfire batch that calls `GenerateLevelAsync`/`GenerateWayAsync` once per confirmed Topic/Subtopic at publish time; this story's `GetOrGenerateLevelAsync`/`GetOrGenerateWayAsync` (the on-demand fallback) also calls the same generation methods synchronously, inline in a normal HTTP request — same AD-14 "inline/authoring-or-viewing-time, not batch-async" reasoning Story 2.10's `DescribeNotationAsync` call already established for this codebase.
- **Confirmed-node scope reminder, carried forward from this epic's own dependency analysis:** only Topic/Subtopic nodes are Drill-Down/Ways generation targets (never Chapter, never ContentBlock) — `nodeId` in every method above always resolves to one of those two entity types; reject (or simply never construct a request for) anything else.
- **Tutor-override storage answers this epic's own cross-story dependency question #4 (override-takes-priority pattern), for the first of 3 stories that need it** — Stories 3.6 (exercises) and 3.7 (keyword definitions) each need their own equivalent "does a tutor-authored value exist? serve it instead" mechanism; they are not required to copy this story's exact two-JSON-column shape verbatim (keyword overrides in particular are naturally a different shape — open-ended keyword text, not a fixed 1-5 index), but the override-always-wins, visually-indistinguishable-from-AI-content behavior must match in spirit across all three, since Story 3.9's Review-as-Student walkthrough exercises all three in one flow.

### Project Structure Notes

- Backend new files: `Domain/AdaptiveLearning/{DrilldownLevel.cs, WayContent.cs}`, `Infrastructure/Persistence/Configurations/{DrilldownLevelConfiguration.cs, WayContentConfiguration.cs}`, migration, `Infrastructure/Repositories/AdaptiveLearningRepository.cs`, `Application/AdaptiveLearning/{IAdaptiveLearningRepository.cs, IAdaptiveLearningService.cs, AdaptiveLearningService.cs, AdaptiveLearningDtos.cs, DrilldownPromptBuilder.cs, WaysPromptBuilder.cs, AdaptiveLearningResponseParser.cs}`, `Api/Controllers/AdaptiveLearningController.cs`, all new test files from Task 5.
- Backend modified files: `Infrastructure/Persistence/FlexDemyDbContext.cs` (two new `DbSet`s), `Infrastructure/DependencyInjection.cs`/`Application/DependencyInjection.cs` (new registrations).
- Naming: new `FlexDemy.Domain.AdaptiveLearning`/`FlexDemy.Application.AdaptiveLearning` namespaces — a new feature area, not folded into the existing `Courses` feature, per this story's own Task 1 rationale.

### References

- [Source: _specs/planning-artifacts/epics.md — Story 3.5 (lines 663-681)]
- [Source: _specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md — FR17 §4.6, FR18 §4.7, FR21 §4.10 (on-demand fallback), FR-15 §4.4 (confirmed-node scope)]
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md — AD-14 (AI Service Layer, inline/authoring-time call discipline), AD-18 (budget pre-flight reserve, applies to every `ExplainTopicAsync`/`RewriteExplanationAsync` call through `IAiTaskGateway`'s own internal resolution), AD-20 (content-tree entities, Topic/Subtopic-only generation scope)]
- [Source: BackEnd/src/FlexDemy.Application/AiGateway/IAiTaskGateway.cs — read directly this session; confirmed `ExplainTopicAsync`/`RewriteExplanationAsync` already exist, unused by any caller]
- [Source: BackEnd/src/FlexDemy.Application/Courses/{ExtractionPromptBuilder.cs, ExtractionResponseParser.cs, NotationDescriptionPromptBuilder.cs} — Story 2.8/2.10's established prompt-builder/response-parser patterns this story's own `DrilldownPromptBuilder`/`WaysPromptBuilder`/`AdaptiveLearningResponseParser` mirror; `CourseFile.ExtractedStructureJson`'s raw-JSON-storage precedent this story's `GeneratedContentJson`/`OverrideContentJson` columns reuse]
- [Source: _specs/implementation-artifacts/3-1-student-course-player-shell-ui-mock-data.md — the frontend `DrillLevelData`/`ExampleItem`/`WayData` shapes this story's JSON schemas and DTOs must match, so Phase B's real API swap-in requires no frontend reshaping]

## Previous Story Intelligence

Stories 3.1-3.4 (this epic, `ready-for-dev`, not yet implemented) establish the frontend-side shapes this story's backend must produce:

- **Story 3.1's `useDrilldownContent`/Story 3.2's `useWays` mock hooks already define the exact `DrillLevelData`/`WayData`/`ExampleItem` shapes this story's `GeneratedContentJson`/DTOs must match byte-for-byte** — read those stories' own Task 1/Task 3 definitions directly before designing this story's JSON schema, don't re-derive it from PRD prose alone.
- **This epic's shared research pass (done once, before any of the 11 stories were written) already confirmed `IAiTaskGateway`'s full method surface and the real `LifecycleState`/content-tree entity shapes** — this story's Dev Notes cite that research directly; no need to re-research the AI Service Layer or content-tree entities from scratch during implementation, only to re-verify specific claims against the live file if something looks off (per this epic's own repeatedly-demonstrated lesson: 3 of the first 4 stories written found a real discrepancy between research and actual code).

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `dotnet build` clean across the full solution after every task and after the code-review patch (0 errors, 1 pre-existing unrelated warning in `Program.cs`).
- `dotnet ef migrations add AddAdaptiveLearningDrilldownWays --startup-project ../FlexDemy.Api --project .` — generated cleanly; migration verified by inspection (two `CreateTable` + four partial `CreateIndex` calls, no `Down()` issues).
- Full backend regression: `dotnet test` → 544 tests passing across all 3 test projects (359 Application + 140 Infrastructure + 45 Api; 0 failures, 0 regressions), including 42 new tests for this story.

### Completion Notes List

- Task 1: `DrilldownLevel`/`WayContent` entities in a new `Domain/AdaptiveLearning`/`Application/AdaptiveLearning` feature area, mirroring `ContentBlock`'s `TopicId?`/`SubtopicId?` mutual-exclusivity pattern. **Correction found during implementation, not silently followed from the story's literal text:** a single composite unique index on `(TopicId, SubtopicId, LevelNumber)` as literally specified would NOT actually enforce "at most one row per node per level" — SQL treats `NULL` as distinct from every other `NULL` in a unique index by default, and a Subtopic-scoped row's `TopicId` is always `NULL`, so two duplicate Subtopic-scoped rows would never collide against that composite index. Used two Postgres partial unique indexes instead (`HasFilter("topic_id IS NOT NULL")` / `HasFilter("subtopic_id IS NOT NULL")`), which correctly achieve the story's own explicitly stated intent ("enforced at the DB level, not just app-level"). Documented in both `DrilldownLevelConfiguration.cs`/`WayContentConfiguration.cs` directly.
- Task 2: `DrilldownPromptBuilder`/`WaysPromptBuilder` mirror `ExtractionPromptBuilder`'s pure-static shape; `AdaptiveLearningResponseParser` mirrors `ExtractionResponseParser`'s validated-parse-not-blind-deserialize discipline (fails closed on missing title/subtitle/content/keyPoints/examples, an unsupported `difficulty` value, or a null example entry).
- Task 3: `AdaptiveLearningService` depends on `IAiTaskGateway`, `IContentTreeRepository` (reused, not a parallel reader), and the new `IAdaptiveLearningRepository`. `GetOrGenerateLevelAsync`/`GetOrGenerateWayAsync` require `Course.LifecycleState == Published` via `ICourseService.GetCourseByIdAsync` (which itself already hides a non-Published course from anyone but its owning tutor) plus an explicit follow-up check, so even the owning tutor can't read through this student-facing on-demand path for their own non-Published course — Story 3.9's Review-as-Student mode is the distinct bypass, not built here. **Added a new `ICourseService.EnsureOwnedAsync` method** (this story's own gap to close, per its own Dev Notes) — an ownership-only guard, deliberately not `EnsureOwnedDraftAsync`, since a tutor sets Drill-Down/Ways overrides on a course that may already be Published. Added a new `AiResponseValidationException` (maps to 502, same status as `AiGatewayException`) for when the AI call itself succeeds but the response fails the parser's validation.
- Task 4: `AdaptiveLearningController` — GET reads have no `[Authorize]` attribute (matches `CoursesController.GetCourseById`'s own convention); PUT override writes use `[Authorize(Policy = FeatureKeys.CoursesCreate)]`.
- Task 5: added `DrilldownPromptBuilderTests.cs` (5 tests), `WaysPromptBuilderTests.cs` (5 tests), `AdaptiveLearningResponseParserTests.cs` (14 tests), `AdaptiveLearningServiceTests.cs` (14 tests, NSubstitute-mocked, mirroring `ContentTreeServiceTests.cs`'s established `Sut`-record pattern) — covering generation/persistence, the cache-hit-vs-generate branch of the on-demand fallback, override-always-wins across every read path, and the `EnsureOwnedAsync`-not-`EnsureOwnedDraftAsync` distinction for both Drill-Down and Ways.

### File List

- `BackEnd/src/FlexDemy.Domain/AdaptiveLearning/DrilldownLevel.cs` (new)
- `BackEnd/src/FlexDemy.Domain/AdaptiveLearning/WayContent.cs` (new)
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Configurations/DrilldownLevelConfiguration.cs` (new)
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Configurations/WayContentConfiguration.cs` (new)
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Migrations/20260812200531_AddAdaptiveLearningDrilldownWays.cs` (new)
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Migrations/20260812200531_AddAdaptiveLearningDrilldownWays.Designer.cs` (new)
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Migrations/FlexDemyDbContextModelSnapshot.cs` (modified)
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/FlexDemyDbContext.cs` (modified — two new `DbSet`s)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/DrilldownPromptBuilder.cs` (new)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/WaysPromptBuilder.cs` (new)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/AdaptiveLearningResponseParser.cs` (new)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/IAdaptiveLearningRepository.cs` (new)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/IAdaptiveLearningService.cs` (new)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/AdaptiveLearningService.cs` (new)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/AdaptiveLearningDtos.cs` (new)
- `BackEnd/src/FlexDemy.Infrastructure/Repositories/AdaptiveLearningRepository.cs` (new)
- `BackEnd/src/FlexDemy.Application/Courses/ICourseService.cs` (modified — added `EnsureOwnedAsync`)
- `BackEnd/src/FlexDemy.Application/Courses/CourseService.cs` (modified — implemented `EnsureOwnedAsync`)
- `BackEnd/src/FlexDemy.Application/Common/AppException.cs` (modified — added `AiResponseValidationException`)
- `BackEnd/src/FlexDemy.Api/Middleware/ExceptionHandlingMiddleware.cs` (modified — mapped `AiResponseValidationException` to 502)
- `BackEnd/src/FlexDemy.Api/Controllers/AdaptiveLearningController.cs` (new)
- `BackEnd/src/FlexDemy.Application/DependencyInjection.cs` (modified)
- `BackEnd/src/FlexDemy.Infrastructure/DependencyInjection.cs` (modified)
- `BackEnd/tests/FlexDemy.Application.Tests/AdaptiveLearning/DrilldownPromptBuilderTests.cs` (new)
- `BackEnd/tests/FlexDemy.Application.Tests/AdaptiveLearning/WaysPromptBuilderTests.cs` (new)
- `BackEnd/tests/FlexDemy.Application.Tests/AdaptiveLearning/AdaptiveLearningResponseParserTests.cs` (new)
- `BackEnd/tests/FlexDemy.Application.Tests/AdaptiveLearning/AdaptiveLearningServiceTests.cs` (new; extended during code-review patch with 4 concurrent-insert-race regression tests)

## Senior Developer Review (AI)

**Date:** 2026-08-13
**Outcome:** Approved after patch
**Method:** `bmad-code-review` — parallel adversarial review (Blind Hunter, Acceptance Auditor)

**Acceptance Criteria audit (Acceptance Auditor):** All 4 ACs verified PASS: `explainTopic(level)`/`rewriteExplanation(way)` called via `IAiTaskGateway` with per-level/per-way prompt guidance and validated parsing (AC1/AC2); every read path (`ToDto`) resolves `OverrideContentJson ?? GeneratedContentJson`, including fresh generations, so an existing override always wins (AC3); `GetOrGenerateLevelAsync`/`GetOrGenerateWayAsync` require `Published` and generate-on-miss without the student ever seeing empty content (AC4). Controller auth split confirmed correct (GET reads unauthenticated-policy same as `CoursesController.GetCourseById`, PUT overrides gated by `FeatureKeys.CoursesCreate`); `SetLevelOverrideAsync`/`SetWayOverrideAsync` confirmed to call `EnsureOwnedAsync`, never `EnsureOwnedDraftAsync`. No unchecked subtasks misrepresent completed work.

**Action Items:**

- [x] **[High]** The upsert logic in `GenerateLevelAsync`/`GenerateWayAsync`/`SetLevelOverrideAsync`/`SetWayOverrideAsync` had a check-then-act race: the existence check (`repository.GetLevelAsync`/`GetWayAsync`) and the subsequent `SaveChangesAsync` were not atomic. Two concurrent requests for the same never-yet-generated node+level (a realistic scenario — multiple students opening the same freshly-published node before pre-generation completes, or two rapid tutor override edits) would both see no existing row, both construct one with a distinct generated id, and the second `SaveChangesAsync` would throw an unhandled `DbUpdateException` from the partial unique index's own correct rejection — surfacing as a raw 500 instead of succeeding. Found by the Blind Hunter pass. **Fix:** added four private upsert helpers (`UpsertGeneratedLevelAsync`/`UpsertGeneratedWayAsync`/`UpsertLevelOverrideAsync`/`UpsertWayOverrideAsync`) that catch the failure broadly (`FlexDemy.Application` deliberately has no EF Core package reference — Clean Architecture boundary — so `DbUpdateException` can't be caught by type), then verify it was actually a lost race by re-querying for the row; a genuinely different failure (row still doesn't exist) rethrows untouched, matching `ContentTreeService.cs`'s own established `catch (Exception ex) when (ex is not OperationCanceledException)` idiom. Generation's loser discards its own redundant AI output and returns the winner's already-valid content; an override write's loser retries as an UPDATE against the winner row instead (last-write-wins, since a tutor's own explicit edit should still take effect). Added 4 regression tests (`AdaptiveLearningServiceTests.cs`) covering the winner-content-returned path for both Drill-Down and Ways, the override retry-as-update path, and a "rethrows when it wasn't actually a race" negative case so a genuine future failure is never silently swallowed.

Full regression suite (544 tests) and `dotnet build` re-verified clean after the patch.

## Change Log

- 2026-08-12: Story created via `bmad-create-story` — fifth of Epic 3's 11 stories (first of Phase B), written as part of the full-epic write-then-implement batch. Status set to `ready-for-dev`.
- 2026-08-13: All 5 tasks implemented via `bmad-dev-story`. New `AdaptiveLearning` feature area (Domain/Application/Infrastructure/Api), `DrilldownLevel`/`WayContent` entities with a corrected partial-unique-index approach (the story's literal composite-index spec would not have actually enforced uniqueness), prompt builders + response parser mirroring Story 2.8's established patterns, `AdaptiveLearningService` (generation, on-demand fallback, tutor overrides), a new `ICourseService.EnsureOwnedAsync` method, and `AdaptiveLearningController`. 38 new backend tests added across 4 files. Full regression 540 tests passing (355+140+45), 0 regressions; `dotnet build` clean. Status set to `review`, ready for code-review cycle.
- 2026-08-13: `bmad-code-review` (Blind Hunter/Acceptance Auditor) found one High-severity real bug — a concurrent-insert race in all four upsert paths that would surface as an unhandled 500 under real concurrent traffic. Patched with a verify-then-rethrow-or-recover retry pattern (no EF Core type dependency, respecting the Application layer's persistence-ignorance) plus 4 regression tests. All 4 ACs independently verified PASS. Full regression re-run: 544 tests passing, `dotnet build` clean. Status set to `done`.
