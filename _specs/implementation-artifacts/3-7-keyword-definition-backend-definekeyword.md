---
baseline_commit: e64e8b260d54a2ac01680d582cacc80de715e147
---

# Story 3.7: Keyword Definition Backend (`defineKeyword`)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a student,
I want a real, subject- and language-aware definition when I click a keyword,
so that Story 3.2's popover shows accurate content instead of mocks.

## Acceptance Criteria

1. **Given** a keyword click, **when** `defineKeyword()` runs via the AI Service Layer, **then** it returns a subject- and language-aware definition. [Source: epics.md Story 3.7; PRD FR20]
2. **Given** a tutor-authored override exists for that keyword, **when** the definition is served, **then** the override takes priority and is visually indistinguishable from an AI-generated one. [Source: epics.md Story 3.7; PRD FR20]
3. **Given** the same keyword clicked in two different-subject courses, **when** resolved, **then** each can surface a different, correct definition. [Source: epics.md Story 3.7; PRD FR20]

## Tasks / Subtasks

- [x] Task 1: `KeywordDefinition` Domain entity + persistence (AC: #2, #3)
  - [x] `Domain/AdaptiveLearning/KeywordDefinition.cs` (`AuditableEntity`): `CourseId`, `Keyword` (the original-cased keyword as first requested, display-only), `NormalizedKeyword` (lowercase/trimmed, the real lookup key), `GeneratedDefinitionText` (string?), `OverrideDefinitionText` (string?). Unique index on `(CourseId, NormalizedKeyword)` — **scoped per-course, not global**, directly satisfying AC#3 ("the same keyword clicked in two different-subject courses... each can surface a different... definition") by construction: two courses' rows for the same keyword text are simply two different rows, never sharing a cache entry.
  - [x] **Caching decision, resolving this epic's own PRD-noted open question (§8 Q2, "should keyword definitions be cached per-course to cut repeat generation cost?") rather than leaving it unimplemented:** yes, cache on first generation, reusing the exact same `GeneratedDefinitionText`/`OverrideDefinitionText` two-column shape Story 3.5 already established for Drill-Down/Ways — **this does not contradict FR21's "keyword definitions are NOT pre-generated at publish"** (FR21 is about the publish-time *batch*, which this story's cache is deliberately excluded from per Story 3.5's own Dev Notes); this is a request-time cache-after-first-generation, not a pre-generation step. `[ASSUMPTION: no stated cache-invalidation/expiry policy -- once generated, a definition is served from cache indefinitely unless a tutor overrides it; revisit if content drift over time becomes a real product concern.]`
  - [x] EF configuration + migration, same conventions as every other entity.
- [x] Task 2: `KeywordDefinitionPromptBuilder.cs` (AC: #1, #3)
  - [x] `Application/AdaptiveLearning/KeywordDefinitionPromptBuilder.cs` (static, pure, same shape as Story 3.5/3.6's builders): `BuildMessages(string keyword, string courseSubject): IReadOnlyList<AiGatewayMessage>`. System prompt instructs a short, subject-context-aware definition (the same keyword in a Chemistry course vs a Biology course must be free to diverge, per AC#3 — the prompt must actually pass `courseSubject` into the request, not just the bare keyword, or the model has no way to differentiate). `[ASSUMPTION: "language-aware" per FR20/AC#1 means the definition's own language matches the course's primary instructional language (English/Hindi, this platform's stated v1 scope per PRD §6.2) -- courseSubject alone doesn't carry this; pass the course's language signal too (Course.Subject already exists on the real Course entity, confirm during dev whether a course-level "language" field exists yet or needs adding -- if no such field exists, default to English and flag this as a real, currently-unaddressed gap rather than silently guessing at a language.]` Add `TryParseKeywordDefinition` to Story 3.5's shared `AdaptiveLearningResponseParser.cs` (a definition is a single plain string, not a nested JSON schema like Drill-Down/Ways/Exercise — confirm during dev whether this is simple enough to skip the JSON-schema-response discipline entirely and just take the AI response's raw text content, trimmed and length-capped, rather than requiring the model to wrap a one-sentence answer in JSON only to immediately unwrap it).
- [x] Task 3: `IKeywordDefinitionService`/`KeywordDefinitionService` (AC: #1, #2, #3)
  - [x] `Application/AdaptiveLearning/{IKeywordDefinitionService.cs, KeywordDefinitionService.cs}`. `DefineAsync(courseId, keyword, cancellationToken): Task<KeywordDefinitionDto>` — student-facing: normalizes `keyword`, looks up `(courseId, normalizedKeyword)`; if found (override or generated), returns immediately (AC#2's override-priority rule enforced at the DTO-mapping layer, override always wins when both are present); if not found, resolves the course's `Subject` (via `ICourseService`, matching AD-12's cross-feature-via-service-interface rule), calls `IAiTaskGateway.DefineKeywordAsync` via Task 2's builder, persists to `GeneratedDefinitionText`, returns it. A generation failure (any `AppException` from the gateway) returns a `KeywordDefinitionDto` with `definition: null` rather than propagating — matches DESIGN.md's own "Empty — no keyword definition available" State Pattern entry ("the popover shows a plain 'Definition unavailable' message, not a blank/broken popover shell"), i.e. this is this story's own best-effort/non-blocking call site, same reasoning as Story 2.10's `TryDescribeNotationAsync` (narrow catch: `AiTaskUnavailableException`/`AiTaskBudgetExceededException` specifically, anything else propagates as a genuine bug signal).
  - [x] `SetOverrideAsync(courseId, keyword, definitionText, cancellationToken): Task` — tutor-only (same "owned, not necessarily Draft" ownership-check gap already flagged in Story 3.5 — reuse whatever that story's implementation resolved it to, don't re-decide independently).
- [x] Task 4: `Api/Controllers/KeywordDefinitionController.cs` (AC: #1, #2, #3)
  - [x] `[Route("api/v1/courses/{courseId}/keywords")]` (course-scoped, not node-scoped — a keyword isn't tied to one Topic/Subtopic the way Drill-Down/Ways/Exercise are). `GET /{keyword}` (student-facing, no `CoursesCreate` policy, same auth-shape as Story 3.5/3.6) → 200 `KeywordDefinitionDto`. `PUT /{keyword}/override` (tutor, `[Authorize(Policy = FeatureKeys.CoursesCreate)]`) → 204.
- [x] Task 5: Backend tests (AD-7)
  - [x] `FlexDemy.Application.Tests/AdaptiveLearning/KeywordDefinitionPromptBuilderTests.cs` (new): includes both the keyword and the course's subject in the built messages.
  - [x] `FlexDemy.Application.Tests/AdaptiveLearning/KeywordDefinitionServiceTests.cs` (new): the same keyword in two different courses (two different `courseId`s) resolves independently, never sharing a cached row (AC#3, directly exercised); a cached row is served without a second gateway call; an override is served over a generated definition; `AiTaskUnavailableException`/`AiTaskBudgetExceededException` from the gateway produce a `definition: null` DTO rather than propagating, any other exception type does propagate (same narrow-catch pattern as Story 2.10, tested the same way that story's own regression tests were).

## Dev Notes

- **Per-course cache scoping (Task 1's unique index) is what makes AC#3 true by construction** — do not key the cache on `NormalizedKeyword` alone across all courses; that would be a real, silent AC violation only visible when two courses happen to use the same term.
- **This is the one AI-generation call site in this epic explicitly noted (PRD NFR) to route to the cheapest/fastest AI tier by default, due to expected high call volume** — this requires no special-case code in this story: tier/provider selection is already fully data-driven per-`AiTaskId` via `AiTaskConfig`/`IAiConfigService` (Epic 1), so this is purely an **admin-configuration concern** (setting `AiTaskConfig` for `AiTaskIds.DefineKeyword` to a cheap provider/model) — flag it in Completion Notes as a deployment/ops follow-up, not something this story's own code needs to special-case.
- **Best-effort, non-blocking generation, matching Story 2.10's `DescribeNotationAsync` precedent exactly** — a keyword popover failing to generate must never break the reading experience; the "Definition unavailable" empty state (DESIGN.md) is the correct, already-specified UI response, not a bug to prevent by other means.

### Project Structure Notes

- Backend new files: `Domain/AdaptiveLearning/KeywordDefinition.cs`, `Infrastructure/Persistence/Configurations/KeywordDefinitionConfiguration.cs`, migration, `Application/AdaptiveLearning/{IKeywordDefinitionService.cs, KeywordDefinitionService.cs, KeywordDefinitionPromptBuilder.cs}`, `Api/Controllers/KeywordDefinitionController.cs`, both new test files from Task 5.
- Backend modified files: `Infrastructure/Persistence/FlexDemyDbContext.cs` (one new `DbSet`), `Application/AdaptiveLearning/AdaptiveLearningResponseParser.cs` (extended), DI registration files.

### References

- [Source: _specs/planning-artifacts/epics.md — Story 3.7 (lines 699-717)]
- [Source: _specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md — FR20 §4.9 (subject/language-aware, tutor override priority, cheapest/fastest-tier NFR); FR21 §4.10 (keyword definitions explicitly excluded from publish-time pre-generation); open question §8 Q2 (per-course caching), resolved by this story]
- [Source: _specs/implementation-artifacts/3-2-ways-menu-keyword-popover-ui-mock-data.md — the frontend `useKeywordDefinition` mock hook shape and "Definition unavailable" empty-state UI this story's backend serves]
- [Source: _specs/implementation-artifacts/3-5-drill-down-ways-ai-task-implementation.md — the `Application/AdaptiveLearning` feature folder, generated/override two-column persistence shape, and best-effort narrow-catch pattern this story reuses]
- [Source: BackEnd/src/FlexDemy.Application/AiGateway/IAiTaskGateway.cs — confirms `DefineKeywordAsync` already exists on the interface, unused before this story]

## Previous Story Intelligence

Stories 3.5/3.6 (this epic, `ready-for-dev`, not yet implemented) established the `Application/AdaptiveLearning` feature folder, the generated/override persistence shape, the prompt-builder/response-parser pattern, and the student-read-vs-tutor-write controller auth-shape — this story is the third and last consumer of all of those, reusing each directly. This story's own new contribution is the per-course cache-scoping requirement (AC#3) and the deliberate resolution of the PRD's open caching-policy question.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `dotnet build` clean across the full solution after every task (0 errors, 1 pre-existing unrelated warning in `Program.cs`).
- `dotnet ef migrations add AddKeywordDefinitions --startup-project ../FlexDemy.Api --project .` — generated cleanly; migration verified by inspection (one `CreateTable` + one composite unique `CreateIndex`, no partial-index workaround needed since `CourseId`/`NormalizedKeyword` are both non-nullable, unlike Story 3.5/3.6's `TopicId?`/`SubtopicId?` columns).
- Full backend regression: `dotnet test` → 595 tests passing across all 3 test projects (410 Application + 140 Infrastructure + 45 Api; 0 failures, 0 regressions), including 18 new tests for this story (5 prompt-builder + 13 service) plus 3 new `TryParseKeywordDefinition` tests extending Story 3.5's parser test file.

### Completion Notes List

- Task 1: `KeywordDefinition` entity, unique index on `(CourseId, NormalizedKeyword)` — both columns non-nullable, so a plain composite unique index works correctly here (no NULL-distinctness workaround needed, unlike Story 3.5/3.6's Topic/Subtopic-scoped entities). Per-course scoping makes AC#3 true by construction.
- Task 2: `KeywordDefinitionPromptBuilder` follows `NotationDescriptionPromptBuilder.cs`'s own established precedent (Story 2.10) of a raw plain-text AI response rather than a JSON schema, since a keyword definition is a single short string. `TryParseKeywordDefinition` (added to Story 3.5's shared parser) just trims and length-caps (1000 chars) rather than deserializing JSON. **Real, currently-unaddressed gap flagged rather than silently guessed at:** FR20's "language-aware" requirement has no course-level language field to read from — confirmed by direct read of `Domain/Courses/Course.cs` (no such field exists among `Subject`/`Level`/`TargetGradeTag`/etc.). The prompt always requests an English-language definition as a result; adding a Course-level language field is out of this story's own stated scope.
- Task 3: `KeywordDefinitionService.DefineAsync` — cache-hit (override or generated) returns immediately; on a miss, resolves the course's `Subject` via `ICourseService` and calls `IAiTaskGateway.DefineKeywordAsync`. Best-effort, non-blocking generation matches Story 2.10's `TryDescribeNotationAsync` precedent exactly: only `AiTaskUnavailableException`/`AiTaskBudgetExceededException` are caught (returning `Definition: null`), any other failure (including an unusable AI response) propagates as a genuine bug signal. **Proactively applied the race-safe upsert pattern from the start** (rather than waiting for a third code-review pass to catch the same class of concurrent-insert bug Stories 3.5/3.6 were each separately patched for) — `UpsertGeneratedAsync`/`UpsertOverrideAsync` both catch broadly, verify the failure was actually a lost race by re-checking the row, and either return the winner's content (generation) or retry as an UPDATE (override, last-write-wins).
- Task 4: `KeywordDefinitionController` — course-scoped route (`/keywords/{keyword}`), not node-scoped, since a keyword isn't tied to one Topic/Subtopic. GET has no `[Authorize]` attribute (matches Story 3.5/3.6's established student-facing precedent); `PUT .../override` uses `[Authorize(Policy = FeatureKeys.CoursesCreate)]`.
- Task 5: added `KeywordDefinitionPromptBuilderTests.cs` (5 tests, including one confirming two different subjects produce different system prompts for the same keyword — the mechanism AC#3 depends on) and `KeywordDefinitionServiceTests.cs` (12 tests: independent per-course cache resolution for the identical keyword — AC#3 directly exercised — cache-hit-no-gateway-call, override-wins, both narrow-catch exception paths plus a genuine-failure-propagates control case, and the proactive race-safety), plus 3 new `TryParseKeywordDefinition` tests extending `AdaptiveLearningResponseParserTests.cs`.
- **Deployment/ops follow-up, not code:** per this story's own Dev Notes, `AiTaskConfig` for `AiTaskIds.DefineKeyword` should be set to a cheap/fast provider tier given this endpoint's expected high call volume — a pure admin-configuration action (Epic 1's `IAiConfigService`), no code change needed in this story.

### File List

- `BackEnd/src/FlexDemy.Domain/AdaptiveLearning/KeywordDefinition.cs` (new)
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Configurations/KeywordDefinitionConfiguration.cs` (new)
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Migrations/20260812204128_AddKeywordDefinitions.cs` (new)
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Migrations/20260812204128_AddKeywordDefinitions.Designer.cs` (new)
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Migrations/FlexDemyDbContextModelSnapshot.cs` (modified)
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/FlexDemyDbContext.cs` (modified — one new `DbSet`)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/KeywordDefinitionPromptBuilder.cs` (new)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/AdaptiveLearningResponseParser.cs` (modified — added `TryParseKeywordDefinition`)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/IKeywordDefinitionRepository.cs` (new)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/IKeywordDefinitionService.cs` (new)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/KeywordDefinitionService.cs` (new)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/KeywordDefinitionDtos.cs` (new)
- `BackEnd/src/FlexDemy.Infrastructure/Repositories/KeywordDefinitionRepository.cs` (new)
- `BackEnd/src/FlexDemy.Api/Controllers/KeywordDefinitionController.cs` (new)
- `BackEnd/src/FlexDemy.Application/DependencyInjection.cs` (modified)
- `BackEnd/src/FlexDemy.Infrastructure/DependencyInjection.cs` (modified)
- `BackEnd/tests/FlexDemy.Application.Tests/AdaptiveLearning/KeywordDefinitionPromptBuilderTests.cs` (new)
- `BackEnd/tests/FlexDemy.Application.Tests/AdaptiveLearning/KeywordDefinitionServiceTests.cs` (new)
- `BackEnd/tests/FlexDemy.Application.Tests/AdaptiveLearning/AdaptiveLearningResponseParserTests.cs` (modified — added `TryParseKeywordDefinition` tests)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/KeywordDefinitionService.cs` (modified during code-review patch — whitespace/Unicode-normalizing `Normalize`)

## Senior Developer Review (AI)

**Date:** 2026-08-13
**Outcome:** Approved after patch
**Method:** `bmad-code-review` — parallel adversarial review (Blind Hunter, Acceptance Auditor)

**Acceptance Criteria audit (Acceptance Auditor):** All 3 ACs verified PASS: `DefineAsync` resolves the course's `Subject` and passes it into the prompt builder, producing genuinely different system prompts for the same keyword across two subjects (AC1 — "language-aware" honestly not implemented since no course-level language field exists, but this is disclosed, not silently defaulted); every read path serves `OverrideDefinitionText ?? GeneratedDefinitionText` uniformly with no shape difference between override and generated content (AC2); the unique index is genuinely per-course (`(course_id, normalized_keyword)`, confirmed in both the EF config and the raw migration SQL), directly exercised by a dedicated test (AC3). The race-safe upsert pattern, proactively applied from the start based on the Story 3.5/3.6 lesson, was confirmed to hold up structurally identical to the two already-accepted sibling implementations. No unchecked subtasks misrepresent completed work.

**Action Items:**

- [x] **[Medium]** `Normalize(keyword)` only trimmed and lowercased, without collapsing internal whitespace runs or applying Unicode normalization. Two requests for what a user considers "the same" keyword (e.g. `"wave length"` vs. `"wave  length"` with a double internal space — plausible from an HTML text-node join or copy-paste, or precomposed vs. decomposed Unicode forms for non-ASCII text) could produce different `NormalizedKeyword` values and therefore different cache rows. This doesn't just waste a redundant AI call — it silently breaks AC#2 from the caller's perspective: a tutor's `SetOverrideAsync` writes an override keyed on one whitespace/Unicode variant, and a student's lookup on a differently-rendered variant of the same visible phrase would resolve to a different row with no override, silently falling through to (or generating) an AI definition instead. Found by the Blind Hunter pass. **Fix:** `Normalize` now collapses internal whitespace runs to a single space (`Regex.Replace(@"\s+", " ")`) and applies Unicode normalization (`NormalizationForm.FormKC`) before lowercasing. Added a regression test confirming a double-internal-space, mixed-case, leading/trailing-padded variant and a clean lowercase-single-space variant both resolve to the identical normalized cache key across both `SetOverrideAsync` and `DefineAsync`.

Full regression suite (595 tests) and `dotnet build` re-verified clean after the patch.

## Change Log

- 2026-08-12: Story created via `bmad-create-story` — seventh of Epic 3's 11 stories, written as part of the full-epic write-then-implement batch. Status set to `ready-for-dev`.
- 2026-08-13: All 5 tasks implemented via `bmad-dev-story`. `KeywordDefinition` entity (per-course-scoped unique index, no partial-index workaround needed), `KeywordDefinitionPromptBuilder`/`TryParseKeywordDefinition` (raw-text response, not JSON, matching Story 2.10's precedent; language-field gap explicitly flagged), `KeywordDefinitionService` (cache-after-first-generation, override-priority, best-effort narrow-catch, race-safety applied proactively from the start based on the lesson learned across Stories 3.5/3.6), and `KeywordDefinitionController`. 17 new tests plus 3 extending Story 3.5's parser tests. Full regression 594 tests passing, 0 regressions; `dotnet build` clean. Status set to `review`, ready for code-review cycle.
- 2026-08-13: `bmad-code-review` (Blind Hunter/Acceptance Auditor) found one Medium-severity real bug — `Normalize()` didn't collapse internal whitespace or apply Unicode normalization, risking a tutor's override silently missing a student's differently-whitespaced lookup of the same visible keyword. Patched plus a regression test. All 3 ACs independently verified PASS. Full regression re-run: 595 tests passing, `dotnet build` clean. Status set to `done`.
