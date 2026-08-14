---
baseline_commit: bbcf238016cf10bf942364c1bbd929d43991d5eb
---

# Story 4.3: Backend Error Capture Wiring

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform engineer,
I want the global exception middleware and all 4 Hangfire jobs' terminal failures to call the capture service,
so that no backend error — unhandled exception, `AppException`, or exhausted-retry job failure — goes unrecorded.

## Acceptance Criteria

1. **Given** a non-`AppException` exception (e.g. `NullReferenceException`) reaches the outermost request pipeline, **when** `ExceptionHandlingMiddleware` catches it, **then** it still returns the existing catch-all 500 `ProblemDetails` response, unchanged, **and** it also calls `IErrorCaptureService.CaptureAsync` exactly once. [Source: epics-ErrorObservability.md Story 4.3; PRD FR-1]
2. **Given** any of the 10 existing `AppException` subtypes reaches the middleware, **when** caught, **then** it still returns its existing mapped status code, unchanged, **and** `CaptureAsync` is called with `ExceptionType` set to the concrete subtype's class name (e.g. `"ValidationException"`), not a generic value. [Source: PRD FR-2]
3. **Given** `ScanFileJob`, `ParseFileJob`, `ExtractStructureJob`, or `PublishNodeContentJob` exhausts its configured retries, or short-circuits early via `AiTaskBudgetExceededException`/`AiResponseValidationException`, **when** it writes its terminal `Failed` status to `CourseFile`/`PublishBatchItem`, **then** `CaptureAsync` is also called, with `RelatedEntityType`/`RelatedEntityId` set to the originating record and `Category` tagged `Background Job Error` alongside the underlying-cause category. [Source: PRD FR-3, FR-9]
4. **Given** a job retry that eventually succeeds, **when** that happens, **then** `CaptureAsync` is never called for that job's execution. [Source: PRD FR-3]
5. **Given** `CourseFile.FailureReason` / `PublishBatchItem.ProgressText`, **when** a job fails, **then** they are written exactly as they are today — this feature adds a mirrored `ErrorRecord`, it does not change either existing field's shape or behavior. [Source: PRD FR-4]

## Tasks / Subtasks

### Backend

- [x] Task 1: Global unhandled-exception + `AppException` capture in `ExceptionHandlingMiddleware` (AC: #1, #2)
  - [x] `Api/Middleware/ExceptionHandlingMiddleware.cs`: change the current `catch (AppException ex)` to `catch (Exception ex)`. The existing `ex switch { NotFoundException => ..., ValidationException => ..., ..., _ => (500, "Unexpected Error") }` pattern-match block needs **no other change** — a non-`AppException` (e.g. `NullReferenceException`) simply falls to the existing `_` branch and gets the same 500 it does today; every `AppException` subtype's existing mapped status code is unaffected. This is the entire mechanism for AC #1's "no behavior change to any existing response."
  - [x] Immediately after the status/title `switch` (or right before the response is written — order doesn't matter as long as it happens once per catch), inject `IErrorCaptureService` into the middleware's constructor and call `await errorCaptureService.CaptureAsync(new ErrorCaptureRequest { ExceptionType = ex.GetType().Name, Message = ex.Message, StackTrace = ex.StackTrace, Source = ErrorSource.Backend, OriginContext = context.Request.Path, RequestPath = context.Request.Path, UserId = context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value }, context.RequestAborted)`. Do **not** wrap this call in an extra `try/catch` here — `CaptureAsync` already swallows its own failures (Story 4.2, NFR2); double-guarding it is redundant.
  - [x] `AppException.ExceptionType` is exactly `ex.GetType().Name` for both branches (AC #2's literal requirement) — confirm `NullReferenceException`'s `.Name` is also just `"NullReferenceException"`, no special-casing needed for the non-`AppException` path either.
- [x] Task 2: Wire the 2 simple retry-exhaustion job sites (AC: #3, #4, #5)
  - [x] `Infrastructure/Jobs/ScanFileJob.cs`: in the final `catch (Exception ex) when (ex is not OperationCanceledException)` block's retries-exhausted branch (after the existing `courseFile.FailureReason = Truncate(...)` / `await unitOfWork.SaveChangesAsync(...)` lines — do not reorder those, AC #5 requires the existing write untouched), add a call to `errorCaptureService.CaptureAsync(new ErrorCaptureRequest { ExceptionType = ex.GetType().Name, Message = ex.Message, StackTrace = ex.StackTrace, Source = ErrorSource.Backend, OriginContext = nameof(ScanFileJob), RelatedEntityType = nameof(Domain.Courses.CourseFile), RelatedEntityId = courseFile.Id, IsBackgroundJobFailure = true }, cancellationToken)`.
  - [x] `Infrastructure/Jobs/ParseFileJob.cs`: identical pattern in its own final `catch` block's retries-exhausted branch, `OriginContext = nameof(ParseFileJob)`.
  - [x] Both jobs' **early-return/success paths must not call `CaptureAsync`** (AC #4) — the only call site is inside the `retryCount < MaxAttempts - 1` **else** branch (the one that doesn't `throw;`), which is already exactly where the existing terminal-failure write lives.
- [x] Task 3: Wire `ExtractStructureJob`'s two terminal-failure branches (AC: #3, #4, #5)
  - [x] `Infrastructure/Jobs/ExtractStructureJob.cs`: **three** distinct terminal-failure sites need the call, not one — (a) the `catch (AiTaskBudgetExceededException)` no-retry short-circuit, (b) the generic `catch (Exception ex)`'s retries-exhausted branch, and (c) the malformed-extraction-response `else` branch inside the `try` (where `ExtractionResponseParser.TryParse` fails — this is a terminal `Failed` write that happens **without going through the exception-based retry path at all**, since it's not a thrown exception, just a parsed-but-invalid response). For (c), synthesize an `ErrorCaptureRequest` with `ExceptionType = null` (no real exception object exists here) and `Message = parseError ?? "Extraction response could not be parsed."` — don't skip this site just because it has no exception to read `.GetType().Name` from; it's still a genuine capturable failure per FR-1's spirit even though it's not what FR-1 technically covers (FR-1 is about the request pipeline; this is FR-3's job-terminal-failure path, which the PRD does not restrict to exception-triggered failures only).
  - [x] Every one of the three sites: `RelatedEntityType = nameof(Domain.Courses.CourseFile)`, `RelatedEntityId = courseFile.Id`, `OriginContext = nameof(ExtractStructureJob)`, `IsBackgroundJobFailure = true`.
- [x] Task 4: Wire `PublishNodeContentJob`'s three terminal-failure branches (AC: #3, #4, #5)
  - [x] `Infrastructure/Jobs/PublishNodeContentJob.cs`: its `MarkFailedAsync` helper is called from **three** sites (`catch (AiTaskBudgetExceededException)`, `catch (AiResponseValidationException ex)`, and the generic `catch (Exception ex)`'s retries-exhausted branch) — the cleanest fix is adding the `CaptureAsync` call **inside `MarkFailedAsync` itself** (change its signature to also accept `Exception? exception` so all three call sites can pass through their own caught exception, or `null` if none applies) rather than duplicating the call at three separate points. `RelatedEntityType = nameof(Domain.AdaptiveLearning.PublishBatchItem)`, `RelatedEntityId = item.Id`, `OriginContext = nameof(PublishNodeContentJob)`, `IsBackgroundJobFailure = true`.
  - [x] **Do not** call `CaptureAsync` from the decrement/finalize step at the bottom of `RunAsync` — that logic runs on every terminal invocation (including successful ones) and is unrelated to whether *this* item failed; only `MarkFailedAsync`'s call sites are failure sites.
- [x] Task 5: Inject `IErrorCaptureService` into all 4 jobs' constructors
  - [x] `ScanFileJob`, `ParseFileJob`, `ExtractStructureJob`, `PublishNodeContentJob` each gain `IErrorCaptureService errorCaptureService` as a new constructor parameter (primary-constructor style, matching every other dependency in these classes already).
- [x] Task 6: Backend tests (AD-7)
  - [x] `FlexDemy.Api.Tests`: extend/add an `ExceptionHandlingMiddleware` integration test asserting a thrown `NullReferenceException` still returns 500 unchanged, and (via an `NSubstitute` fake registered in the test host) that `IErrorCaptureService.CaptureAsync` was invoked exactly once; same for a thrown `ValidationException` returning 400 unchanged plus one capture call with the correct `ExceptionType`.
  - [x] Extend `ScanFileJobTests.cs`, `ParseFileJobTests.cs`, `ExtractStructureJobTests.cs`, `PublishNodeContentJobTests.cs` (all 4 already gained a `correlationId` constructor/call-site change in Story 4.1 — this story adds one more constructor parameter, `IErrorCaptureService`, on top of that): retries-exhausted case calls `CaptureAsync` exactly once with the right `RelatedEntityType`/`RelatedEntityId`/`IsBackgroundJobFailure = true`; a retry that still has attempts left, or a job that succeeds, never calls it (AC #4); `ExtractStructureJob`'s malformed-parse branch (no exception object) also calls it once.

### Review Findings

- [x] [Review][Patch] `ParseFileJob`'s low-confidence/failed-parse branch (`result.IsSuccessful == false`) never calls `CaptureAsync` — structurally identical to `ExtractStructureJob`'s malformed-response branch (Task 3c), which *was* wired with the same "still a genuine capturable failure per FR-1's spirit" reasoning; this branch just wasn't named in Task 2's text, an apparent oversight rather than a deliberate exclusion [BackEnd/src/FlexDemy.Infrastructure/Jobs/ParseFileJob.cs:90]
- [x] [Review][Patch] `ScanFileJob`'s malware-detected branch never calls `CaptureAsync` — a genuine terminal `Failed` write inside the `try` block, parallel to the two gaps above; malware detection is exactly the kind of security-relevant signal FR-1 exists to surface [BackEnd/src/FlexDemy.Infrastructure/Jobs/ScanFileJob.cs:54]
- [x] [Review][Patch] `ScanFileJob`'s and `ParseFileJob`'s "could not schedule the next job" inner `catch` blocks never call `CaptureAsync` — a Hangfire enqueue failure (storage down) is exactly the backend-infrastructure failure this epic exists to surface, and each sits right next to an outer catch using the identical pattern that *is* wired [BackEnd/src/FlexDemy.Infrastructure/Jobs/ScanFileJob.cs:79, BackEnd/src/FlexDemy.Infrastructure/Jobs/ParseFileJob.cs:81]
- [x] [Review][Patch] `ExceptionHandlingMiddleware`'s widened `catch (Exception ex)` drops the `when (ex is not OperationCanceledException)` guard every one of the 4 jobs consistently uses — an ordinary client disconnect now gets mapped to a spurious 500, logged, and captured as a backend error, polluting the log with non-actionable noise [BackEnd/src/FlexDemy.Api/Middleware/ExceptionHandlingMiddleware.cs:25]
- [x] [Review][Patch] The middleware passes `context.RequestAborted` as `CaptureAsync`'s cancellation token — for the client-disconnect scenario most likely to land in this catch block, that token is already (or about to be) canceled, so `CaptureAsync`'s own DB calls throw immediately and get silently swallowed by its NFR2 catch-all — capture quietly no-ops for exactly the failures most likely to coincide with a disconnect, not just the disconnect itself [BackEnd/src/FlexDemy.Api/Middleware/ExceptionHandlingMiddleware.cs:53]
- [x] [Review][Patch] `OriginContext = context.Request.Path` puts the raw resolved URL (including path-segment ids) into the Fingerprint hash input, which `ErrorFingerprintGenerator` never normalizes (only `Message` is) — the same bug hit by two different requests against two different resource ids produces two different Fingerprints instead of one recurring one, defeating FR-8/FR-9's dedup guarantee for the single most common capture site; all 4 job sites avoid this by using a static `nameof(JobClass)`, the middleware doesn't follow that precedent [BackEnd/src/FlexDemy.Api/Middleware/ExceptionHandlingMiddleware.cs:50]
- [x] [Review][Patch] `UserId = context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value` reimplements claim lookup ad hoc and checks only one of the two claim types every other call site in this codebase checks — `HttpContextCurrentUserService`, `ProfilesController.CurrentUserId()`, and `AuthController.CurrentUserId()` all carry the identical comment explaining `ClaimTypes.NameIdentifier` vs. `JwtRegisteredClaimNames.Sub` depends on `JwtBearerOptions.MapInboundClaims` and both must be checked; this new code doesn't reuse the existing `ICurrentUserService` abstraction either, so `UserId` on captured records can silently come back null for authenticated users depending on that same ambiguity [BackEnd/src/FlexDemy.Api/Middleware/ExceptionHandlingMiddleware.cs:52]
- [x] [Review][Patch] Task 6 specified an `ExceptionHandlingMiddleware` integration test "via an NSubstitute fake registered in the test host," but the actual test kept the pre-existing direct-construction unit-test pattern instead (a reasonable choice, matching Story 4.1's identical, already-documented "no `WebApplicationFactory` infra exists" precedent) — this deviation just wasn't flagged in Completion Notes the way Story 4.1's was [BackEnd/tests/FlexDemy.Api.Tests/Middleware/ExceptionHandlingMiddlewareTests.cs]
- [x] [Review][Defer] Every exception thrown before a job's own `try` block (`NotFoundException` from the opening `GetByIdAsync` lookups, `PublishNodeContentJob`'s `InvalidOperationException` for a missing `TopicId`/`SubtopicId`) is invisible to this story's capture wiring — Hangfire's own `[AutomaticRetry]` still retries these at the framework level, but after exhausting retries there's no code path to write anything at all, not even the existing `CourseFile.FailureReason`/`PublishBatchItem.ProgressText` fields. Deferred: this blind spot predates Story 4.3 entirely (the per-entity failure fields have the identical gap today, unrelated to error capture) — not introduced or worsened by this story; fixing it requires wrapping each job's entire `RunAsync` body (not just the existing manual-retry-tracking `try` block) in a broader restructure, a bigger change than this story's own scope.
- [x] [Review][Defer] `PublishNodeContentJob`'s finalize step (`DecrementRemainingAsync`/`CreateSnapshotAsync`/`MarkPublishedAsync`) runs entirely outside the `try`/`catch` that has the `MarkFailedAsync`/`CaptureAsync` wiring — if it throws, there's no capture at any retry, including the final exhausted attempt. Deferred: this is Story 3.8's original design (the method's own extensive code-review commentary already documents why the decrement/finalize step is structured this way for retry-safety); reopening it is a bigger change than this story's error-capture-wiring scope, and doing so carelessly risks reintroducing the exact race Story 3.8's own review process already fixed once.

## Dev Notes

- **This story still has no admin-visible output** — `ErrorRecord` rows are now being written by every backend failure path, but nothing can read them until Story 4.5. Same atomic-release-unit framing as Stories 4.1/4.2.
- **The exact current `ExceptionHandlingMiddleware.cs` body (for precision — read it in full before editing, don't re-derive from memory):**
  ```csharp
  public class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
  {
      public async Task InvokeAsync(HttpContext context)
      {
          try { await next(context); }
          catch (AppException ex)
          {
              var (statusCode, title) = ex switch
              {
                  NotFoundException => (StatusCodes.Status404NotFound, "Not Found"),
                  ValidationException => (StatusCodes.Status400BadRequest, "Validation Failed"),
                  ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
                  UnauthorizedAppException => (StatusCodes.Status401Unauthorized, "Unauthorized"),
                  AiGatewayException => (StatusCodes.Status502BadGateway, "AI Gateway Error"),
                  AiResponseValidationException => (StatusCodes.Status502BadGateway, "AI Response Validation Failed"),
                  AiTaskUnavailableException => (StatusCodes.Status503ServiceUnavailable, "AI Task Unavailable"),
                  AiTaskBudgetExceededException => (StatusCodes.Status429TooManyRequests, "AI Task Budget Exceeded"),
                  _ => (StatusCodes.Status500InternalServerError, "Unexpected Error"),
              };
              logger.LogWarning(ex, "Request failed with {ExceptionType}", ex.GetType().Name);
              // ... writes ProblemDetails
          }
      }
  }
  ```
  Changing only the `catch` clause's type (`AppException` → `Exception`) is the whole fix — the switch expression's `_` fallback already produces the correct 500 for anything that isn't a listed `AppException` subtype.
- **`ExtractStructureJob`'s malformed-response branch (Task 3c) is easy to miss** — it's not inside any `catch` block at all, so a search for "catch" in that file will only find 2 of its 3 terminal-failure sites. Re-read the file's `if (ExtractionResponseParser.TryParse(...)) { ... } else { courseFile.Status = Failed; ... }` branch specifically.
- **`PublishNodeContentJob`'s `MarkFailedAsync` refactor (Task 4) touches a method with 3 existing call sites** — get the new `Exception? exception` parameter threading right for all 3, and don't accidentally change `MarkFailedAsync`'s existing `item.Status`/`item.ProgressText`/`SaveChangesAsync` behavior (AC #5 — this story is additive only).

### Project Structure Notes

- **Modified only, no new files:** `Api/Middleware/ExceptionHandlingMiddleware.cs`, `Infrastructure/Jobs/{ScanFileJob.cs, ParseFileJob.cs, ExtractStructureJob.cs, PublishNodeContentJob.cs}`, and their 4 corresponding test files, plus a new/extended `FlexDemy.Api.Tests` middleware test.

### References

- [Source: _specs/planning-artifacts/epics-ErrorObservability.md — Story 4.3 (lines 193-221)]
- [Source: _specs/planning-artifacts/prds/prd-eLearning-ErrorObservability-2026-08-13/prd.md — FR-1, FR-2, FR-3, FR-4 §4.1]
- [Source: _specs/planning-artifacts/prds/prd-eLearning-ErrorObservability-2026-08-13/addendum.md — "Existing `AppException` taxonomy", "Hangfire job retry-exhaustion pattern" (both quoted verbatim in this story's Dev Notes and Task descriptions)]
- [Source: BackEnd/src/FlexDemy.Infrastructure/Jobs/{ScanFileJob.cs, ParseFileJob.cs, ExtractStructureJob.cs, PublishNodeContentJob.cs} — all 4 read in full; every terminal-failure branch enumerated above is a real, confirmed branch in the current code, not inferred]
- [Source: BackEnd/src/FlexDemy.Application/Common/AppException.cs — the 10 subtypes AC #2 must preserve by name]

## Previous Story Intelligence

- **Story 4.1** already added a `correlationId` parameter to all 4 jobs' `RunAsync` signatures and constructors gained `ICorrelationIdAccessor` — this story's Task 5 adds `IErrorCaptureService` as one more constructor parameter on top of that; expect each job's constructor to now carry both.
- **Story 4.2** built `IErrorCaptureService`/`ErrorCaptureRequest`/`IsBackgroundJobFailure` — this story is the first real caller of all three; if any of Task 2-4's field names don't match what Story 4.2 actually produced, trust Story 4.2's own file over this story's text (verify before implementing, don't assume this story's naming is authoritative if it drifted).

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `dotnet build` (full solution): 0 errors.
- `dotnet test` (full solution, pre-review): 797 passed, 0 failed (556 Application.Tests + 59 Api.Tests + 182 Infrastructure.Tests).
- `dotnet test` (full solution, post-patch-round): 801 passed, 0 failed (556 Application.Tests + 63 Api.Tests + 182 Infrastructure.Tests).

### Completion Notes List

- **`ExtractStructureJob`'s Task 3 was scoped to exactly 3 terminal-failure sites, matching the story's own enumeration** — the job actually has a *4th* terminal-`Failed` write (the defensive `string.IsNullOrWhiteSpace(courseFile.ParsedContent)` guard near the top of `RunAsync`), which the story's Dev Notes explicitly did not name as one of the "three distinct terminal-failure sites." Left unwired, per "never implement anything not mapped to a specific task/subtask" — flagging here in case that 4th site was meant to be in scope and was simply missed when the story was written.
- **`ExtractStructureJob`'s malformed-response branch (Task 3c) required restructuring the existing `if/else` block**, not just inserting a call — the shared trailing `SaveChangesAsync` after the `if/else` only covers the success path now; the `else` (failure) branch saves, captures, and returns early itself. Verified no behavior change to what gets persisted or when (AC #5) via the full regression suite.
- **`PublishNodeContentJob`'s `MarkFailedAsync` refactor went exactly as scoped** — added `Exception? exception` as a new parameter (not a new overload), threaded through all 3 existing call sites, one `CaptureAsync` call inside the shared helper rather than 3 duplicated call sites.
- **Test discovery matched the story's own prediction exactly**: `ExceptionHandlingMiddlewareTests.cs` and all 4 job test files were the only 5 compile failures after wiring, exactly as Story 4.1/4.2's own "breaking-change alert" pattern predicted for constructor-signature changes.
- Every "does NOT call CaptureAsync" case named in AC #4 (a job retry still in progress, a job that succeeds outright) now has an explicit test per job, not just the "does call it" happy path.

**Code review patch round (2026-08-14):**
- Added the 4 missing terminal-failure `CaptureAsync` call sites the review flagged: `ScanFileJob`'s malware-detected branch, `ScanFileJob`'s and `ParseFileJob`'s "could not schedule the next job" inner-catch branches, and `ParseFileJob`'s low-confidence/failed-parse branch — each following the exact pattern already established at the sites Task 2/3/4 wired.
- `ExceptionHandlingMiddleware`: restored the `when (ex is not OperationCanceledException)` guard (matches all 4 jobs' identical filter); switched `CaptureAsync`'s cancellation token from `context.RequestAborted` to `CancellationToken.None` so a captured error survives a racing client disconnect instead of being silently dropped by `CaptureAsync`'s own NFR2 catch-all; changed `OriginContext` from the raw resolved `context.Request.Path` to the matched route pattern (`(context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText`, falling back to the raw path only when no endpoint matched) so `ErrorFingerprintGenerator`'s dedup isn't defeated by path-segment ids; replaced the ad hoc `context.User?.FindFirst(ClaimTypes.NameIdentifier)` lookup with an injected `ICurrentUserService`, matching the same abstraction `HttpContextCurrentUserService`/`ProfilesController`/`AuthController` already use for the identical claim-type ambiguity.
- Task 6's test-approach deviation (direct-construction unit test instead of a `WebApplicationFactory`-based integration test) is intentional, not an oversight — this repo has no such test host set up yet (confirmed: only `FlexDemy.Api.Tests/Controllers` exists, all constructing controllers/handlers directly), matching Story 4.1's identical, already-documented precedent for `CorrelationIdMiddlewareTests.cs`. Documented here per the review's own suggestion rather than changed, since introducing new test infrastructure is out of this story's scope.
- Added 4 new `ExceptionHandlingMiddlewareTests` covering the patch round: `OperationCanceledException` propagates uncaught and is never captured; `OriginContext` uses the matched route pattern (not the resolved path with ids) when an endpoint matched; `OriginContext` falls back to the raw path when no endpoint matched; `UserId` is sourced from `ICurrentUserService`, not read directly off `HttpContext.User`.

### File List

**Modified:**
- `BackEnd/src/FlexDemy.Api/Middleware/ExceptionHandlingMiddleware.cs`
- `BackEnd/src/FlexDemy.Infrastructure/Jobs/{ScanFileJob.cs, ParseFileJob.cs, ExtractStructureJob.cs, PublishNodeContentJob.cs}`
- `BackEnd/tests/FlexDemy.Api.Tests/Middleware/ExceptionHandlingMiddlewareTests.cs`
- `BackEnd/tests/FlexDemy.Infrastructure.Tests/Jobs/{ScanFileJobTests.cs, ParseFileJobTests.cs, ExtractStructureJobTests.cs, PublishNodeContentJobTests.cs}`

## Change Log

- 2026-08-13: Story created via `bmad-create-story` — third of Epic 4's 7 stories, written as part of a full-epic write-then-implement batch. Status set to `ready-for-dev`.
- 2026-08-14: Implementation complete via `bmad-dev-story` — all 6 tasks done, 797-test full backend regression suite passing (44 new tests: capture-call assertions for every terminal-failure site plus explicit "does NOT call" coverage for AC #4). One scope note flagged in Completion Notes (`ExtractStructureJob`'s defensive null-`ParsedContent` guard left unwired, matching the story's own literal 3-site enumeration — not a 4th site the story asked for). Status set to `review`.
- 2026-08-14: Adversarial code review via `bmad-code-review` (Blind Hunter, Edge Case Hunter, Acceptance Auditor) surfaced 8 findings, all triaged as patch — 4 missing job terminal-failure `CaptureAsync` sites, plus 4 gaps in the middleware's widened catch clause (missing `OperationCanceledException` filter, a cancellation-token bug that silently dropped captures on client disconnect, an `OriginContext` fingerprint-dedup bug, and ad hoc claim lookup instead of `ICurrentUserService`). All 8 patches applied; 4 new middleware tests added; full regression re-run at 801 passed, 0 failed. Status set to `done`.
