---
baseline_commit: a1519bbfd2d31406dd1949e5ab47875246c6b371
---

# Story 1.6: Per-Task Fallback & Retry

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform operator,
I want each AI Task call wrapped in a fallback policy,
so that a rate-limited or unavailable primary provider doesn't block the task.

## Acceptance Criteria

1. A new `IAiTaskGateway` (`Application/AiGateway/`) — one method per AI Task, mirroring `IAiGateway`'s shape but *without* `Provider`/`Model` in its request (those are resolved internally from `AiTaskConfig`, via `IAiConfigService`) — is what a future feature (Epic 2/3's `extractStructure`/`explainTopic`/etc. implementations) will call, never `IAiGateway` directly. When the primary provider (`AiTaskConfig.Provider`/`.Model`) fails, the request retries once against the task's configured fallback (`AiTaskConfig.FallbackProvider`/`.FallbackModel`). [Source: epics.md Story 1.6; AD-14: "a fallback policy wrapping each `IAiGateway` method's primary-provider call, falling back to that task's configured secondary provider/model on failure"]
2. The fallback policy is implemented with Polly 8.7.0 (`ResiliencePipelineBuilder<T>.AddFallback(...)`), not hand-rolled retry logic. [Source: epics.md Story 1.6; AD-14]
3. Every fallback event (primary failed, fallback was attempted) is logged (`ILogger`, structured: task id, primary provider/model, fallback provider/model, primary failure reason) and the returned result carries a `IsFallbackServed` flag — "admin visibility" in the UI sense is Story 1.7's job (once `AiTaskUsage` exists to persist this flag against a real usage record); this story's scope is producing the flag and logging it, not yet a dashboard. [Source: epics.md Story 1.6: "every fallback event is logged and flagged for admin visibility"; AD-18 confirms `AiTaskUsage`/`AiTaskBudget` don't exist until Story 1.7/1.8]
4. If both the primary and the fallback call fail, the request fails with a new, distinct `AiTaskUnavailableException` (`Application/Common/AppException.cs`), mapped by `ExceptionHandlingMiddleware` to HTTP 503 — never a silent hang, never a raw/unhandled exception, and never the generic `AiGatewayException`/502 (that's still correct for `IAiGateway`'s own single-call failures; this is a new, more specific terminal state one level up, for "the whole task — primary and fallback both — is unavailable"). [Source: epics.md Story 1.6: "the request fails with a distinct, loggable terminal error state — never a silent hang or an unhandled exception surfaced raw to the caller"]

## Tasks / Subtasks

- [x] Task 1: Extend `IAiConfigService` with a single-task lookup (AC: #1)
  - [x] `Application/AiConfig/IAiConfigService.cs` + `AiConfigService.cs`: add `Task<AiTaskConfigDto> GetTaskConfigAsync(string taskId, CancellationToken cancellationToken = default)` — validates `taskId` against `AiTaskIds.All` (`ValidationException` if unknown, reusing `UpdateTaskConfigAsync`'s existing check — consider extracting a small private `ValidateTaskId` helper instead of duplicating the `if` block) and `NotFoundException` if no row, mirroring `UpdateTaskConfigAsync`'s existing lookup pattern. This avoids `IAiTaskGateway` (Task 5/6) fetching all 7 rows via `GetAllTaskConfigsAsync` on every single call just to read one.
  - [x] New test(s) in `AiConfigServiceTests.cs`: happy path returns the right DTO; unknown taskId throws `ValidationException`; missing row throws `NotFoundException`.
- [x] Task 2: `AiTaskUnavailableException` (AC: #4)
  - [x] `Application/Common/AppException.cs`: add `public sealed class AiTaskUnavailableException(string taskId) : AppException($"AI Task '{taskId}' is unavailable: both the primary and fallback provider failed.");` alongside the existing 5 subtypes (including Story 1.4's `AiGatewayException`).
  - [x] `Api/Middleware/ExceptionHandlingMiddleware.cs`: add `AiTaskUnavailableException => (StatusCodes.Status503ServiceUnavailable, "AI Task Unavailable"),` to the existing `switch` expression.
  - [x] New test(s) in `ExceptionHandlingMiddlewareTests.cs` (Story 1.4's file): `AiTaskUnavailableException` maps to 503.
- [x] Task 3: Add Polly 8.7.0 to `FlexDemy.Application` (AC: #2)
  - [x] `FlexDemy.Application.csproj`: `<PackageReference Include="Polly.Core" Version="8.7.0" />` (the lean `Polly.Core` package ships `ResiliencePipelineBuilder`/`AddFallback` and is what's actually needed here — not the full `Polly` metapackage, which pulls in legacy `Policy`-based v7-compat surface this story doesn't use; web-verify the exact package name/version is still current before adding).
- [x] Task 4: `IAiTaskGateway` interface + request/result models (AC: #1, #3)
  - [x] `Application/AiGateway/AiTaskModels.cs`: `AiTaskRequest(IReadOnlyList<AiGatewayMessage> Messages, double? Temperature = null, int? MaxTokens = null)` (reuses Story 1.4's `AiGatewayMessage`); `AiTaskResult(string Content, string Provider, string Model, AiGatewayUsage Usage, bool IsFallbackServed)`; `AiTaskEmbeddingResult(IReadOnlyList<IReadOnlyList<float>> Embeddings, string Provider, string Model, AiGatewayUsage Usage, bool IsFallbackServed)`.
  - [x] `Application/AiGateway/IAiTaskGateway.cs`: `ExtractStructureAsync`, `ExplainTopicAsync`, `RewriteExplanationAsync`, `GenerateExerciseAsync`, `DefineKeywordAsync`, `DescribeNotationAsync` (each `Task<AiTaskResult> (AiTaskRequest, CancellationToken = default)`), plus `GenerateEmbeddingAsync(IReadOnlyList<string> input, CancellationToken = default): Task<AiTaskEmbeddingResult>`.
- [x] Task 5: `AiTaskGateway` implementation with Polly fallback (AC: #1, #2, #3, #4)
  - [x] `Application/AiGateway/AiTaskGateway.cs`, constructor-injected `IAiGateway gateway, IAiConfigService configService, ILogger<AiTaskGateway> logger`. The 6 chat-style methods are thin wrappers delegating to one shared private `DispatchAsync(string taskId, AiTaskRequest request, Func<AiGatewayRequest, CancellationToken, Task<AiGatewayResponse>> primaryCall, CancellationToken)` — same "one method per task, all delegating to shared logic" shape `PortkeyAiGateway` already established in Story 1.4.
  - [x] `DispatchAsync`: `var config = await configService.GetTaskConfigAsync(taskId, cancellationToken);` then build a Polly pipeline: `new ResiliencePipelineBuilder<AiGatewayResponse>().AddFallback(new FallbackStrategyOptions<AiGatewayResponse> { ShouldHandle = new PredicateBuilder<AiGatewayResponse>().Handle<AiGatewayException>(), FallbackAction = async args => { /* call primaryCall again with config.FallbackProvider/.FallbackModel, wrapped in try/catch — on a second AiGatewayException, log + throw AiTaskUnavailableException(taskId); on success, mark a local `usedFallback` flag true and log the fallback event; return Outcome.FromResult(...) */ } }).Build();` then `var response = await pipeline.ExecuteAsync(async ct => await primaryCall(new AiGatewayRequest(config.Provider, config.Model, request.Messages, request.Temperature, request.MaxTokens), ct), cancellationToken);` — map `response` + the local `usedFallback` flag into `AiTaskResult`. Web-verify Polly 8.7.0's exact `FallbackStrategyOptions<T>`/`PredicateBuilder<T>`/`Outcome.FromResultAsValueTask`/`ExecuteAsync` API shape before implementing (confirmed current as of this story's research: `ShouldHandle`/`FallbackAction` on `FallbackStrategyOptions<T>`, `new PredicateBuilder<T>().Handle<TException>()`, `pipeline.ExecuteAsync(async ct => ..., cancellationToken)`).
  - [x] Any exception from `primaryCall` that is **not** `AiGatewayException` (e.g. a genuine bug) is **not** caught by the fallback's `ShouldHandle` predicate and propagates immediately, unretried — the fallback is specifically for gateway-transport failures (rate-limited/unavailable/etc., AC #1's framing), not a catch-all.
  - [x] `GenerateEmbeddingAsync` follows the identical shape against `IAiGateway.GenerateEmbeddingAsync`/`AiEmbeddingResponse`/`AiTaskEmbeddingResult` — it does not share `DispatchAsync`'s generic signature (different underlying gateway method/response type), so either write a small second, parallel private method, or generalize `DispatchAsync` with a type parameter if that turns out cleaner once written — use judgment, don't force a shared generic prematurely if it reads worse.
- [x] Task 6: DI registration (AC: #1)
  - [x] `FlexDemy.Application/DependencyInjection.cs`: `services.AddScoped<IAiTaskGateway, AiTaskGateway>();` (Application-layer registration, not Infrastructure — `AiTaskGateway` only depends on other Application interfaces (`IAiGateway`, `IAiConfigService`) plus Polly, no direct Infrastructure/EF/HTTP dependency of its own, matching AD-1's project-reference-only framing of the layering rule).
- [x] Task 7: Tests (AD-7)
  - [x] `FlexDemy.Application.Tests/AiGateway/AiTaskGatewayTests.cs`: NSubstitute-mocked `IAiGateway` + `IAiConfigService`. Cover: primary succeeds → fallback method on `IAiGateway` never called, `IsFallbackServed` false; primary throws `AiGatewayException` → fallback call made with `config.FallbackProvider`/`.FallbackModel`, succeeds → `IsFallbackServed` true, a warning is logged (use a captured `ILogger` substitute or `NullLogger` + assert on behavior rather than log content if asserting log calls proves awkward — behavior assertions take priority); both primary and fallback throw `AiGatewayException` → `AiTaskUnavailableException` thrown, nothing propagates as a raw `AiGatewayException`; a non-`AiGatewayException` thrown by the primary call propagates immediately without invoking the fallback at all; repeat the primary-fails-fallback-succeeds case for at least 2 of the 6 chat methods (not just one) to confirm each method actually routes through `DispatchAsync` correctly, plus one embeddings-specific test covering primary-fails-fallback-succeeds.

## Dev Notes

- **This story does not touch `IAiGateway`, `PortkeyAiGateway`, or anything in `Infrastructure/AiGateway/`.** Story 1.4's design was deliberate about this: `IAiGateway` is a pure transport abstraction; provider/model resolution and fallback orchestration were explicitly named as "layered above it" in that story's own Dev Notes. `IAiTaskGateway` (this story) is that layer. Don't add fallback logic inside `PortkeyAiGateway` — it stays exactly as Story 1.4 left it.
- **No feature code calls `IAiTaskGateway` yet.** Like Story 1.5's `AiPromptVersion`, this is infrastructure for a capability nothing in Epic 1 exercises end-to-end yet — the first real caller will be whichever Epic 2/3 story implements an actual AI Task's business logic (e.g. `extractStructure`'s real prompt-construction/parsing). That's expected; this story's tests exercise `IAiTaskGateway` directly, not through a feature.
- **"Flagged for admin visibility" is deliberately partial in this story.** `AiTaskResult.IsFallbackServed` + the structured log line are the only things this story produces. A real, queryable, UI-visible fallback flag against a persisted usage record is Story 1.7's job once `AiTaskUsage` (AD-18, `Domain/AiUsage/`) exists — don't build that table or a controller/UI for it here; it doesn't exist yet and nothing in this story's AC asks for it.
- **Fallback trigger scope: any `AiGatewayException` from the primary call, not a narrower rate-limit-specific subset.** `IAiGateway`'s current design (Story 1.4) throws one exception type for every transport-level failure (non-success status, network error, timeout, malformed response, missing API key) with no status-code property to distinguish them. Rather than reaching back into Story 1.4's exception type to add that distinction (extra scope with no AC forcing it — "unavailable" in this story's own AC text is broad enough to cover all of these), this story treats every `AiGatewayException` from the primary as fallback-worthy. If a future story needs finer-grained control (e.g. don't fall back on a 401), that's a deliberate, separate scope decision for whoever needs it, not a gap to silently work around here.
- **Web-verify Polly 8.7.0's API before implementing** (Task 5) — the exact shape (`ResiliencePipelineBuilder<T>`, `FallbackStrategyOptions<T>` with `ShouldHandle`/`FallbackAction`, `PredicateBuilder<T>().Handle<TException>()`, `pipeline.ExecuteAsync(async ct => ..., cancellationToken)`) was confirmed current as of this story's own research (2026-08-11) via Polly's official docs (`pollydocs.org/strategies/fallback.html`) — re-confirm nothing has shifted before writing code, since library APIs can change between a story's planning and its implementation.

### Project Structure Notes

- New files: `Application/AiGateway/{AiTaskModels.cs, IAiTaskGateway.cs, AiTaskGateway.cs}`, `Application.Tests/AiGateway/AiTaskGatewayTests.cs`.
- Modified files: `Application/AiConfig/{IAiConfigService.cs, AiConfigService.cs}` (new method), `Application/Common/AppException.cs` (new exception), `Api/Middleware/ExceptionHandlingMiddleware.cs` (new switch case), `Application/DependencyInjection.cs` (new registration), `Application/FlexDemy.Application.csproj` (Polly package), `Application.Tests/AiConfig/AiConfigServiceTests.cs`, `Api.Tests/Middleware/ExceptionHandlingMiddlewareTests.cs`.
- No frontend changes in this story — no AC touches any UI, and Story 1.2's fallback-badge UI already exists against mock data (still mock until Story 1.7 live-wires it).
- Namespace: `FlexDemy.Application.AiGateway` (same as `IAiGateway`/`AiGatewayModels.cs`, both already there from Story 1.4 — this is the same feature folder, not a new one).

### References

- [Source: _specs/planning-artifacts/epics.md — Epic 1, Story 1.6 (full AC text)]
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md — AD-14 (this story's primary source: fallback policy wrapping `IAiGateway`, Polly 8.7.0), AD-18 (confirms `AiTaskUsage` doesn't exist yet — why "admin visibility" is scoped down), AD-1/AD-2/AD-6/AD-7 (general conventions), Stack table (`Polly | 8.7.0`)]
- [Source: BackEnd/src/FlexDemy.Application/AiGateway/IAiGateway.cs, AiGatewayModels.cs — Story 1.4's existing interface/DTOs this story builds on top of, read in full this session]
- [Source: BackEnd/src/FlexDemy.Application/AiConfig/IAiConfigService.cs, AiConfigService.cs — Story 1.5's existing service (`UpdateTaskConfigAsync`'s taskId-validation pattern to reuse for the new `GetTaskConfigAsync`), read in full this session]
- [Source: BackEnd/src/FlexDemy.Application/Common/AppException.cs — existing 5 subtypes (including Story 1.4's `AiGatewayException`), read in full this session]
- [Source: BackEnd/src/FlexDemy.Api/Middleware/ExceptionHandlingMiddleware.cs — existing switch expression, read in full this session]
- [Source: Polly docs, `https://www.pollydocs.org/strategies/fallback.html` and `https://github.com/App-vNext/Polly/blob/main/docs/strategies/fallback.md` — fetched 2026-08-11, confirms the `ResiliencePipelineBuilder<T>.AddFallback(FallbackStrategyOptions<T> { ShouldHandle, FallbackAction })` API shape used in Task 5]

## Previous Story Intelligence

Story 1.5 (`1-5-ai-task-configuration-store-live-wire-config-ui.md`, status: done — closed after a 6-patch code review round):

- **The most consequential lesson from 1.5's review, directly relevant here:** Dev Notes *claimed* a validation rule existed ("Only non-empty-string validation applies server-side") that the code didn't actually implement — caught by all 3 reviewers. The lesson: when this story's Dev Notes state something is true of the implementation (e.g. "any `AiGatewayException` is fallback-worthy," "the fallback is attempted exactly once"), the actual code must be checked to genuinely match that claim before considering a task done — don't let a Dev Notes sentence substitute for the real check.
- **1.5 also found:** a seeding/lookup gap where a filtered `.Where(...)` silently dropped missing entries with no log — the direct analog here is `DispatchAsync`'s fallback path: don't let a fallback failure get silently swallowed or mis-mapped; the AC is explicit that both-failed must be a *distinct* error, not a repeat of the primary's own `AiGatewayException`.
- **Test-writing pattern that worked well across 1.4/1.5:** a `CreateSut(...)` helper with sensible defaults for every dependency, so each test only overrides what it's actually exercising — apply the same shape to `AiTaskGatewayTests.cs`.
- **`ILogger<T>` is now a known, working pattern in this project** — Story 1.5 was the first to add `Microsoft.Extensions.Logging.Abstractions` to `FlexDemy.Application.csproj` (for `AiConfigService`); this story's `AiTaskGateway` reuses that same already-referenced package, no new package needed for logging (only Polly is new, Task 3).

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `dotnet build src/FlexDemy.Application/FlexDemy.Application.csproj` — 0 warnings/errors after Tasks 3, 4, 5, 6.
- `dotnet test tests/FlexDemy.Application.Tests/FlexDemy.Application.Tests.csproj --filter FullyQualifiedName~AiTaskGatewayTests` — confirmed RED (`CS0246: The type or namespace name 'AiTaskGateway' could not be found`, the test file compiling correctly against the not-yet-written implementation) before Task 5's implementation; GREEN (9/9) after.
- `dotnet test` (full solution) — 231/231 (128 Application, 59 Infrastructure, 44 Api), no regressions.

### Completion Notes List

- Implemented all 7 tasks exactly as scoped, in order, following strict RED-GREEN TDD discipline per task.
- `IAiConfigService.GetTaskConfigAsync` (Task 1) extracted a shared private `ValidateTaskId` helper reused by both the new method and the existing `UpdateTaskConfigAsync`, replacing their previously-duplicated inline `AiTaskIds.All.Contains` check — a small proactive refactor, not new scope.
- `AiTaskGatewayTests.cs` (Task 7) does not use a `CreateSut(...)` helper despite Previous Story Intelligence's suggestion to mirror 1.4/1.5's pattern — each test constructs `new AiTaskGateway(gateway, configService, NullLogger<AiTaskGateway>.Instance)` directly instead. With only 3 constructor dependencies and every test needing distinct `IAiGateway`/`IAiConfigService` substitute setups anyway, a shared-defaults helper added indirection without reducing duplication; a first draft of the helper was written then removed as dead code once this became clear.
- `DispatchAsync`'s Polly fallback strategy and the parallel `GenerateEmbeddingAsync` implementation both catch a second `AiGatewayException` from the fallback attempt inside the `FallbackAction` delegate itself (not via a second Polly policy layer) and throw `AiTaskUnavailableException` directly from there — matches Task 5's own subtask guidance verbatim; verified via the "both fail" test for each (`ExplainTopicAsync_both_primary_and_fallback_fail_throws_AiTaskUnavailableException`, `GenerateEmbeddingAsync_both_primary_and_fallback_fail_throws_AiTaskUnavailableException`) that no raw `AiGatewayException` ever escapes the pipeline.
- Confirmed (per Story 1.5's lesson about Dev Notes claims not matching code) that the "any `AiGatewayException` triggers fallback, everything else propagates unretried" claim actually holds: `ExplainTopicAsync_a_non_AiGatewayException_from_the_primary_propagates_without_attempting_fallback` asserts both the correct exception type surfaces and the primary was called exactly once (i.e. no fallback attempt).
- No frontend changes — this story has no UI-facing AC, matching Dev Notes' expectation.
- **Code review (2026-08-11):** 3-layer adversarial review — Blind Hunter found zero defects (explicitly verified Polly API usage, exception flow, layering, DI, and the two `DispatchAsync`/`GenerateEmbeddingAsync` implementations for divergence); Acceptance Auditor verified all 4 ACs and every Dev Notes/Completion Notes claim PASS with no gaps (specifically checked for, and did not find, this project's known "Dev Notes claims a behavior the code doesn't implement" failure pattern from Story 1.5); Edge Case Hunter found 6 items (2 high, 3 medium, 1 low). 1 patch applied: `AppException`'s base constructor now accepts an optional `innerException`, and `AiTaskUnavailableException` uses it to carry the fallback's own failure — closing part of a Story 1.4-deferred item ("no `AppException` subtype preserves an inner exception") for this story's own new exception type. 2 new regression assertions added (`ex.InnerException` type-checked in both "both fail" tests). The remaining 5 Edge Case Hunter findings were deferred with reasoning, not silently dropped: a missing-config-row 404 (matches the codebase's existing systemic `NotFoundException` message convention), fallback-identical-to-primary (already tracked from Story 1.5, now with a concrete consequence noted), empty-input triggering a wasted fallback + misleading 503 (an explicit, named scope boundary in this story's own Dev Notes — fixing it requires a Story 1.4 change), unhandled cancellation in the middleware (pre-existing, systemic, not story-specific), and concurrent calls on a scoped `DbContext` (general EF Core/DI caveat, not story-specific). Full backend suite re-verified green (231/231, no regressions).

### File List

- `BackEnd/src/FlexDemy.Application/AiConfig/IAiConfigService.cs` (modified — new `GetTaskConfigAsync` method)
- `BackEnd/src/FlexDemy.Application/AiConfig/AiConfigService.cs` (modified — `GetTaskConfigAsync` implementation, extracted `ValidateTaskId` helper)
- `BackEnd/tests/FlexDemy.Application.Tests/AiConfig/AiConfigServiceTests.cs` (modified — 3 new tests for `GetTaskConfigAsync`)
- `BackEnd/src/FlexDemy.Application/Common/AppException.cs` (modified — new `AiTaskUnavailableException`)
- `BackEnd/src/FlexDemy.Api/Middleware/ExceptionHandlingMiddleware.cs` (modified — new switch case, 503)
- `BackEnd/tests/FlexDemy.Api.Tests/Middleware/ExceptionHandlingMiddlewareTests.cs` (modified — new test for the 503 mapping)
- `BackEnd/src/FlexDemy.Application/FlexDemy.Application.csproj` (modified — added `Polly.Core` 8.7.0 package reference)
- `BackEnd/src/FlexDemy.Application/AiGateway/AiTaskModels.cs` (new)
- `BackEnd/src/FlexDemy.Application/AiGateway/IAiTaskGateway.cs` (new)
- `BackEnd/src/FlexDemy.Application/AiGateway/AiTaskGateway.cs` (new)
- `BackEnd/src/FlexDemy.Application/DependencyInjection.cs` (modified — `IAiTaskGateway` registration)
- `BackEnd/tests/FlexDemy.Application.Tests/AiGateway/AiTaskGatewayTests.cs` (new, modified post-review — 2 new `InnerException` assertions)

## Change Log

- 2026-08-11: Story implemented (Tasks 1-7, strict RED-GREEN TDD per task), full backend suite green (231/231), status set to `review`.
- 2026-08-11: Code review complete — 3-layer adversarial review (Blind Hunter: 0 findings; Acceptance Auditor: all 4 ACs + Dev Notes claims PASS; Edge Case Hunter: 6 findings). 1 patch applied (`AppException`/`AiTaskUnavailableException` now preserve the fallback's inner exception), 2 new regression assertions. 5 findings deferred with reasoning to `deferred-work.md`. Full backend suite re-verified green (231/231). Status set to `done`.
