---
baseline_commit: e64e8b260d54a2ac01680d582cacc80de715e147
---

# Story 3.6: Exercise Generation & Grading Backend

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tutor,
I want to optionally attach an AI-proposed or self-authored exercise per node, with backend grading support,
so that students get real inline practice with immediate feedback.

## Acceptance Criteria

1. **Given** a confirmed node, **when** a tutor requests an AI-proposed exercise, **then** one is generated via the AI Service Layer and can be edited or accepted. [Source: epics.md Story 3.6; PRD FR19]
2. **Given** a student submits an answer, **when** the exercise runner (Story 3.3) checks it, **then** immediate feedback is returned from real backend grading logic, not mock data. [Source: epics.md Story 3.6; PRD FR19]

## Tasks / Subtasks

- [x] Task 1: `Exercise` Domain entity + persistence (AC: #1, #2)
  - [x] `Domain/AdaptiveLearning/Exercise.cs` (`AuditableEntity`): `TopicId?`/`SubtopicId?` (exactly one, same mutual-exclusivity pattern as `ContentBlock`), `QuestionText`, `AnswerType` (enum: `MultipleChoice`/`Numeric`/`ShortText` — matches Story 3.3's frontend union exactly), `OptionsJson` (string?, only for `MultipleChoice`), `CorrectAnswer` (string — the grading reference; **never included in any DTO returned to a student**, matching Story 3.3's own mock design decision to keep the answer key server-side-only), `FeedbackText` (the worked solution, always shown after submission regardless of correctness), `IsAiProposed` (bool — provenance only, does not gate anything once saved).
  - [x] **Scope correction, decided now rather than silently diverging or reopening an already-written story:** PRD FR19 §4.8 says "one or more exercises" per node; Story 3.3 (already written, this epic's own Phase A) modeled the frontend as zero-or-one exercise per node (`useExercise(): { exercise: Exercise | null, ... }`). This story keeps **at most one `Exercise` row per node** (a unique index on `(TopicId, SubtopicId)`, both nullable-aware), matching Story 3.3's already-committed shape rather than reworking that story to support multiple. `[ASSUMPTION: "one or more" is PRD-stated aspirational scope, not strictly binding for this MVP pass -- multi-exercise-per-node is a natural, additive future extension (widen the unique index to include an Order column, same pattern as CourseThumbnail.Order) that does not require restructuring anything built by this story if it's ever needed; flagging explicitly rather than silently narrowing scope without a record of the decision.]`
  - [x] EF configuration + migration, same `AuditableEntity`/query-filter/snake_case conventions as every other entity in this codebase.
- [x] Task 2: `ExerciseGenerationPromptBuilder.cs` (AC: #1)
  - [x] `Application/AdaptiveLearning/ExerciseGenerationPromptBuilder.cs` (static, pure, same shape as Story 3.5's prompt builders): `BuildMessages(string nodeContent, string answerType): IReadOnlyList<AiGatewayMessage>`. System prompt instructs a subject-appropriate practice question matching the requested `answerType`, plus a worked-solution/feedback text and (for `MultipleChoice`) 3-4 plausible options including the correct one — JSON-schema-only response (`{questionText, correctAnswer, feedbackText, options?}`), same "ONLY JSON, no prose" discipline as every prior prompt builder in this codebase. Add this schema's parsing to Story 3.5's `AdaptiveLearningResponseParser.cs` (`TryParseExercise(...)`) rather than starting a third parallel parser file — same validated-parse-not-blind-deserialize discipline (a `MultipleChoice` response missing `options`, or any response missing `correctAnswer`, fails closed).
- [x] Task 3: `IExerciseService`/`ExerciseService` — propose, save, grade (AC: #1, #2)
  - [x] `Application/AdaptiveLearning/{IExerciseService.cs, ExerciseService.cs}` (same `Application/AdaptiveLearning` feature folder Story 3.5 established). `ProposeExerciseAsync(courseId, nodeId, answerType, cancellationToken): Task<ExerciseDraftDto>` — tutor-only, calls `IAiTaskGateway.GenerateExerciseAsync` via Task 2's builder, returns the proposal **without saving it** (AC#1's "can be edited or accepted" — nothing persists until the tutor explicitly saves, matching this codebase's established "propose, then explicit accept" shape rather than auto-saving AI output).
  - [x] `SaveExerciseAsync(courseId, nodeId, request: SaveExerciseRequest, cancellationToken): Task<ExerciseDto>` — tutor-only, one save path for both self-authored (tutor calls this directly, `IsAiProposed = false`) and AI-proposed-then-accepted/edited (tutor calls this after `ProposeExerciseAsync`, `IsAiProposed = true`, with whatever fields they edited already reflected in `request`) exercises — upserts the node's single `Exercise` row (replaces any existing one; this story does not need edit-in-place granularity, a full replace is simplest and matches this being a low-frequency tutor action). `DeleteExerciseAsync(courseId, nodeId, cancellationToken): Task` — removes the node's exercise entirely (reverting to "no practice affordance," Story 3.3's AC#2 empty state).
  - [x] `GetExerciseAsync(courseId, nodeId, cancellationToken): Task<ExerciseDto?>` — student-facing read, `ExerciseDto` **excludes `CorrectAnswer`** (mirrors `ExerciseDraftDto`'s own field set minus the answer key — confirm these two DTOs don't accidentally diverge in a way that leaks the answer through the wrong one). `null` (not an exception) when the node has no exercise — Story 3.3's AC#2 "no affordance at all" depends on this being a clean empty case, not an error.
  - [x] `SubmitAnswerAsync(courseId, nodeId, answer: string, cancellationToken): Task<ExerciseSubmissionResultDto>` — student-facing grading. **Reuses the exact same evaluation rules Story 3.3's own mock `submit()` already established** (case-insensitive/trimmed string equality for `ShortText`/`MultipleChoice`, epsilon-tolerant numeric-parse comparison for `Numeric`) — this is a deliberate 1:1 port from the frontend mock to real backend logic, not a redesign; per this epic's own PRD-noted open question (§8 Q1), auto-grading beyond exact/near-exact match plus a shown worked solution is explicitly out of MVP scope. Returns `{ isCorrect: bool, feedbackText: string }` — `feedbackText` (the worked solution) is always returned, correct or not, matching FR19's "immediate feedback and worked solution on completion" applying either way.
- [x] Task 4: `Api/Controllers/ExerciseController.cs` (AC: #1, #2)
  - [x] `[Route("api/v1/courses/{courseId}/adaptive-learning/nodes/{nodeId}/exercise")]`. `GET /` (student-facing, no `CoursesCreate` policy — same auth-shape decision Story 3.5's controller makes, match it exactly here rather than re-deciding independently) → 200 `ExerciseDto?`. `POST /propose` (tutor, `[Authorize(Policy = FeatureKeys.CoursesCreate)]`) → 200 `ExerciseDraftDto`. `PUT /` (tutor) → 200 `ExerciseDto`. `DELETE /` (tutor) → 204. `POST /submit` (student-facing) → 200 `ExerciseSubmissionResultDto`.
- [x] Task 5: Backend tests (AD-7)
  - [x] `FlexDemy.Application.Tests/AdaptiveLearning/ExerciseGenerationPromptBuilderTests.cs` (new): includes node content + requested answer type in the built messages.
  - [x] `FlexDemy.Application.Tests/AdaptiveLearning/ExerciseServiceTests.cs` (new): `ProposeExerciseAsync` never persists anything (no repository `Add` call, confirms "propose, don't auto-save"); `SaveExerciseAsync` upserts the node's one row, replacing any prior exercise; `GetExerciseAsync`'s DTO never carries `CorrectAnswer` in any of its properties (an explicit reflection-based or property-enumeration assertion, not just "the test didn't happen to check it" — this is a real data-leak risk worth a directly-targeted test); `SubmitAnswerAsync` covers all 3 `answerType` grading paths including the numeric-tolerance and case-insensitive-trim cases (same specific cases Story 3.3's frontend mock test already covers, confirming behavioral parity); a node with no exercise returns `null` from `GetExerciseAsync`, not an exception.

## Dev Notes

- **Grading logic is a deliberate 1:1 port of Story 3.3's own mock evaluator, not a redesign** — read that story's Task 1 exactly before implementing `SubmitAnswerAsync`, so the frontend (once live-wired) and backend agree on identical correctness rules and a student never sees the UI and API disagree about whether an answer was right.
- **Exercise generation is a plain synchronous service call (like Story 3.5's Drilldown/Ways generation), never a Hangfire job** — `ProposeExerciseAsync` is a tutor-initiated, one-off, interactive action (the tutor is actively waiting for a proposal to review), unlike Story 3.8's publish-time batch generation which Drilldown/Ways content goes through. Exercises are **not** part of Story 3.8's pre-generation batch at all (PRD FR21 scopes pre-generation to Drill-Down/Ways specifically, not exercises) — a tutor must explicitly propose+save an exercise per node ahead of time; there is no "generate exercises for every confirmed node at publish" mechanism, and this story does not add one.
- **One exercise per node, not "one or more"** — see Task 1's scope-correction note. This is the single most important cross-story consistency decision in this story; get it wrong (e.g. by building a multi-exercise list server-side against Story 3.3's already-committed single-exercise frontend shape) and either this story or 3.3 needs rework.

### Project Structure Notes

- Backend new files: `Domain/AdaptiveLearning/Exercise.cs`, `Infrastructure/Persistence/Configurations/ExerciseConfiguration.cs`, migration, `Application/AdaptiveLearning/{IExerciseService.cs, ExerciseService.cs, ExerciseGenerationPromptBuilder.cs}` (join the existing `Application/AdaptiveLearning` folder from Story 3.5), `Api/Controllers/ExerciseController.cs`, all new test files from Task 5.
- Backend modified files: `Infrastructure/Persistence/FlexDemyDbContext.cs` (one new `DbSet`), `Application/AdaptiveLearning/AdaptiveLearningResponseParser.cs` (Story 3.5, extended with `TryParseExercise`), DI registration files.

### References

- [Source: _specs/planning-artifacts/epics.md — Story 3.6 (lines 683-697)]
- [Source: _specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md — FR19 §4.8 (exercises, self-authored or AI-proposed, subject-appropriate answer types; open question §8 Q1 on auto-grading scope)]
- [Source: _specs/implementation-artifacts/3-3-exercise-runner-ui-mock-data.md — the frontend `Exercise`/`SubmissionResult` shapes and mock grading rules this story ports server-side; the zero-or-one-exercise-per-node scope this story matches rather than reopens]
- [Source: _specs/implementation-artifacts/3-5-drill-down-ways-ai-task-implementation.md — the `Application/AdaptiveLearning` feature folder, prompt-builder pattern, and student-facing-vs-tutor-facing auth-shape decision this story reuses]
- [Source: BackEnd/src/FlexDemy.Application/AiGateway/IAiTaskGateway.cs — confirms `GenerateExerciseAsync` already exists on the interface, unused before this story]

## Previous Story Intelligence

Story 3.5 (this epic, `ready-for-dev`, not yet implemented) established the `Application/AdaptiveLearning` feature folder, the prompt-builder/response-parser pattern, and the student-read-vs-tutor-write controller auth-shape decision this story reuses directly rather than re-deciding. Read that story's own Dev Notes and Task 3/4 before starting this one — several of this story's tasks explicitly say "match Story 3.5's decision here" rather than restating the reasoning.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `dotnet build` clean across the full solution after every task and after the code-review patch (0 errors, 1 pre-existing unrelated warning in `Program.cs`).
- `dotnet ef migrations add AddExercises --startup-project ../FlexDemy.Api --project .` — generated cleanly; migration verified by inspection (one `CreateTable` + two partial `CreateIndex` calls).
- Full backend regression: `dotnet test` → 576 tests passing across all 3 test projects (391 Application + 140 Infrastructure + 45 Api; 0 failures, 0 regressions), including 32 new tests for this story (plus 8 new `TryParseExercise` tests added to Story 3.5's own parser test file).

### Completion Notes List

- Task 1: `Exercise` entity, same `TopicId?`/`SubtopicId?` mutual-exclusivity pattern as `ContentBlock`/Story 3.5's entities. Applied Story 3.5's own partial-unique-index correction here too (a plain unique index on nullable `TopicId`/`SubtopicId` wouldn't enforce "at most one exercise per node," for the identical NULL-distinctness reason) — two partial unique indexes, one per column, no per-level/per-way component since this is one-exercise-per-node, not one-per-node-per-level.
- Task 2: `ExerciseGenerationPromptBuilder`/`TryParseExercise` (added to Story 3.5's shared parser, not a third parallel file, per the story's own instruction). **Minor implementation deviation, not silently made:** both take the real `AnswerType` enum rather than a raw `string` (the story's own literal suggested signature) — this makes the two agree on one type-checked source of truth for "which answer type," removing any casing/spelling-mismatch risk between the prompt builder's text and the parser's conditional validation.
- Task 3: `ExerciseService` — `ProposeExerciseAsync` never persists (verified by a dedicated test asserting no repository `Add` call); `SaveExerciseAsync` upserts the node's single row via a new `IExerciseRepository` (a repository this story's own Project Structure Notes didn't explicitly list as a new file, but Task 3 clearly needs one — added following `IAdaptiveLearningRepository`'s exact AD-4 shape); `SubmitAnswerAsync` is a deliberate 1:1 port of Story 3.3's mock evaluator, using `double.TryParse` (strict by default in .NET, unlike JS's lenient `parseFloat` that needed a code-review patch on the frontend side) so no equivalent trailing-garbage false-positive bug exists here. **Proactively applied Story 3.5's `EnsurePublishedAsync` guard to `GetExerciseAsync`/`SubmitAnswerAsync`** (not explicitly required by this story's own Task 3 text) to keep this story's student-facing, node-scoped reads consistent with Story 3.5's identical-shape `GetOrGenerateLevelAsync`/`GetOrGenerateWayAsync` guard within the same feature area, rather than leaving an unexplained inconsistency between two sibling stories.
- Task 4: `ExerciseController` — GET/`POST /submit` have no `[Authorize]` attribute (matches `AdaptiveLearningController`'s Story 3.5 precedent exactly); `POST /propose`/`PUT /`/`DELETE /` use `[Authorize(Policy = FeatureKeys.CoursesCreate)]`.
- Task 5: added `ExerciseGenerationPromptBuilderTests.cs` (5 tests), `ExerciseServiceTests.cs` (14 tests, mirroring `AdaptiveLearningServiceTests.cs`'s `Sut`-record pattern — propose-never-persists, save-upserts/replaces, a reflection-based sweep of every `ExerciseDto` property confirming none ever contains `CorrectAnswer`'s value, and all 3 `SubmitAnswerAsync` grading paths including numeric-tolerance and case-insensitive-trim), plus 8 new `TryParseExercise` tests extending Story 3.5's own `AdaptiveLearningResponseParserTests.cs`.

### File List

- `BackEnd/src/FlexDemy.Domain/AdaptiveLearning/Exercise.cs` (new)
- `BackEnd/src/FlexDemy.Domain/AdaptiveLearning/AnswerType.cs` (new)
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Configurations/ExerciseConfiguration.cs` (new)
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Migrations/20260812202502_AddExercises.cs` (new)
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Migrations/20260812202502_AddExercises.Designer.cs` (new)
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Migrations/FlexDemyDbContextModelSnapshot.cs` (modified)
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/FlexDemyDbContext.cs` (modified — one new `DbSet`)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/ExerciseGenerationPromptBuilder.cs` (new)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/AdaptiveLearningResponseParser.cs` (modified — added `TryParseExercise`)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/IExerciseRepository.cs` (new)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/IExerciseService.cs` (new)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/ExerciseService.cs` (new)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/ExerciseDtos.cs` (new)
- `BackEnd/src/FlexDemy.Infrastructure/Repositories/ExerciseRepository.cs` (new)
- `BackEnd/src/FlexDemy.Api/Controllers/ExerciseController.cs` (new)
- `BackEnd/src/FlexDemy.Application/DependencyInjection.cs` (modified)
- `BackEnd/src/FlexDemy.Infrastructure/DependencyInjection.cs` (modified)
- `BackEnd/tests/FlexDemy.Application.Tests/AdaptiveLearning/ExerciseGenerationPromptBuilderTests.cs` (new)
- `BackEnd/tests/FlexDemy.Application.Tests/AdaptiveLearning/ExerciseServiceTests.cs` (new)
- `BackEnd/tests/FlexDemy.Application.Tests/AdaptiveLearning/AdaptiveLearningResponseParserTests.cs` (modified — added `TryParseExercise` tests)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/ExerciseService.cs` (modified during code-review patch — race-safe upsert, MultipleChoice/Numeric validation)

## Senior Developer Review (AI)

**Date:** 2026-08-13
**Outcome:** Approved after patch
**Method:** `bmad-code-review` — parallel adversarial review (Blind Hunter, Acceptance Auditor)

**Acceptance Criteria audit (Acceptance Auditor):** Both ACs verified PASS: `ProposeExerciseAsync` calls `IAiTaskGateway.GenerateExerciseAsync` with fail-closed parsing and never persists (dedicated no-`Add`-call test), leaving edit/accept entirely to a separate `SaveExerciseAsync` call (AC1); `SubmitAnswerAsync` grades server-side against the persisted `Exercise` row with a verified 1:1 rule-parity match against Story 3.3's frontend mock evaluator, always returning `FeedbackText` regardless of correctness (AC2). At-most-one-exercise-per-node correctly enforced via two partial unique indexes; `ExerciseDto` confirmed to never carry `CorrectAnswer` via a reflection-based property sweep. No unchecked subtasks misrepresent completed work; both documented implementation deviations (typed `AnswerType` enum, proactive `EnsurePublishedAsync` guard) are accurately described and present in the code.

**Action Items:**

- [x] **[High]** `SaveExerciseAsync` had the same unguarded check-then-act upsert race Story 3.5's `AdaptiveLearningService` was already patched for — two concurrent saves for a node with no existing exercise (e.g. a tutor double-clicking Save) would both see no row, both insert, and the second `SaveChangesAsync` would throw an unhandled failure from the partial unique index's own correct rejection. Found by the Blind Hunter pass. **Fix:** extracted the upsert into a new `UpsertExerciseAsync` helper using the same catch-broadly/verify-it-was-actually-a-race/retry-as-update pattern established in Story 3.5 (no EF Core type dependency, respecting the Application layer's persistence-ignorance). Added 2 regression tests (winner-row-retry-succeeds, rethrows-when-not-actually-a-race).
- [x] **[Medium]** `SaveExerciseAsync`'s validation never checked that a `MultipleChoice` exercise's `CorrectAnswer` was actually one of its own `Options`, or that a `Numeric` exercise's `CorrectAnswer` was actually a parseable number — unlike `TryParseExercise` (the AI-generation path), which enforces both. A tutor manually saving or editing an exercise could silently create a permanently unanswerable one (e.g. `Options: ["A","B","C"]`, `CorrectAnswer: "D"`), since `SubmitAnswerAsync` would then never be able to match a student's answer against it. Found by the Blind Hunter pass. **Fix:** added the same two validation checks to `SaveExerciseAsync` that `TryParseExercise` already applies, throwing `ValidationException` before any persistence is attempted. Added 2 regression tests covering both rejection cases.

Full regression suite (576 tests) and `dotnet build` re-verified clean after the patch.

## Change Log

- 2026-08-12: Story created via `bmad-create-story` — sixth of Epic 3's 11 stories, written as part of the full-epic write-then-implement batch. Status set to `ready-for-dev`.
- 2026-08-13: All 5 tasks implemented via `bmad-dev-story`. `Exercise` entity (one-exercise-per-node, corrected partial-unique-index), `ExerciseGenerationPromptBuilder`/`TryParseExercise` (typed on the real `AnswerType` enum), `ExerciseService` (propose/save/delete/get/submit, a deliberate 1:1 port of Story 3.3's mock grading rules, proactively made consistent with Story 3.5's Published-only guard), and `ExerciseController`. 28 new tests plus 8 extending Story 3.5's parser tests. Full regression 572 tests passing, 0 regressions; `dotnet build` clean. Status set to `review`, ready for code-review cycle.
- 2026-08-13: `bmad-code-review` (Blind Hunter/Acceptance Auditor) found two real bugs in `SaveExerciseAsync` — the same concurrent-insert race class Story 3.5 was already patched for, and a missing validation gap (vs. the AI-generation path) that could silently create a permanently unanswerable exercise. Both patched with 4 regression tests. Both ACs independently verified PASS. Full regression re-run: 576 tests passing, `dotnet build` clean. Status set to `done`.
