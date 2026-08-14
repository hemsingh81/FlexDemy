---
baseline_commit: bbcf238016cf10bf942364c1bbd929d43991d5eb
---

# Story 4.1: Correlation ID Assignment and Propagation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

*(Sizing/risk note, per epics-ErrorObservability.md's own "Implementation notes": this is the one genuinely unproven mechanism in this codebase — `AsyncLocal` correctly surviving into a Hangfire job's separate execution context. Build and prove this story in isolation before any capture site (Stories 4.2-4.4) depends on it.)*

## Story

As a platform engineer,
I want every request and its downstream background jobs to carry one shared Correlation ID,
so that a single user action's full failure chain can be traced together once error capture exists (Stories 4.2+).

## Acceptance Criteria

1. **Given** a request with no `X-Correlation-Id` header, **when** it reaches the API, **then** a new GUID is generated, set on `ICorrelationIdAccessor.Current`, and echoed back on the response as `X-Correlation-Id`. [Source: epics-ErrorObservability.md Story 4.1; PRD FR-20]
2. **Given** a request that already carries an `X-Correlation-Id` header, **when** it reaches the API, **then** that value is reused as-is, not regenerated. [Source: PRD FR-20]
3. **Given** `CorrelationIdMiddleware` and `ExceptionHandlingMiddleware` are both registered, **when** an exception occurs anywhere downstream, **then** `CorrelationIdMiddleware` has already run (registered first in the pipeline), so `ICorrelationIdAccessor.Current` is already set at the moment the exception is caught. [Source: PRD FR-20; backend AD-23]
4. **Given** a request enqueues `ScanFileJob`, `ParseFileJob`, `ExtractStructureJob`, or `PublishNodeContentJob`, **when** the job is enqueued, **then** the current Correlation ID is read from the accessor and passed as an explicit argument to `BackgroundJob.Enqueue<IXJob>(...)`. [Source: PRD FR-21; backend AD-23]
5. **Given** a Hangfire job runs with a `correlationId` argument, **when** `RunAsync` begins, **then** it calls `ICorrelationIdAccessor.Set(correlationId)` as its first action, so the same ID is available to the rest of that job's execution, **and** this holds even though the job runs on a separate thread with no relationship to the enqueuing request's async-flow context. [Source: PRD FR-21; backend AD-23]
6. **Given** a job enqueued with no available Correlation ID (e.g. a future scheduled/recurring job with no originating request), **when** it runs, **then** it proceeds with a `null` Correlation ID rather than failing. [Source: PRD FR-21]

## Tasks / Subtasks

### Backend

- [x] Task 1: `ICorrelationIdAccessor` + `AsyncLocal`-backed implementation (AC: #1, #2, #5)
  - [x] `Application/Common/ICorrelationIdAccessor.cs`: `string? Current { get; }`, `void Set(string? correlationId)`. This is the **only** sanctioned way to read/set the correlation ID anywhere in the codebase (AD-23) — never read `HttpContext.Items` directly from Application/Domain (would violate AD-1).
  - [x] `Infrastructure/Correlation/AsyncLocalCorrelationIdAccessor.cs`: backs `Current`/`Set` with a private `static readonly AsyncLocal<string?>` field. Register **Singleton** in `Infrastructure/DependencyInjection.cs` — an `AsyncLocal<T>` field must be a single shared instance app-wide (same pattern .NET's own `IHttpContextAccessor` uses internally); a Scoped/Transient registration would still work correctness-wise since `AsyncLocal` isolates per logical call context regardless of instance count, but Singleton is the idiomatic, zero-allocation-per-request choice and matches `IHttpContextAccessor`'s own registration in this same `Program.cs`.
- [x] Task 2: `CorrelationIdMiddleware` (AC: #1, #2, #3)
  - [x] `Api/Middleware/CorrelationIdMiddleware.cs`: reads inbound `X-Correlation-Id` header; if absent, generates `Guid.NewGuid().ToString()` — **not** `IIdGenerator.NewId()` (AD-9 only binds entity primary keys; a correlation ID is not a persisted entity, no need for `GuidV7`'s time-ordering property). Calls `ICorrelationIdAccessor.Set(id)`, sets `context.Response.Headers["X-Correlation-Id"] = id` **before** calling `next(context)` (headers must be set before the response starts writing; setting it up front means it's present on both success and exception-mapped responses, since `ExceptionHandlingMiddleware` never clears response headers).
  - [x] `Api/Program.cs`: register `app.UseMiddleware<CorrelationIdMiddleware>()` **immediately before** the existing `app.UseMiddleware<ExceptionHandlingMiddleware>()` call (currently line 115) — this exact ordering is AC #3 and PRD FR-20's explicit requirement. Do not place it after `UseCors`/before it matters which side of `UseCors` (CORS preflight doesn't need a correlation ID); before `ExceptionHandlingMiddleware` is the one hard constraint.
- [x] Task 3: Thread `correlationId` through all 4 job enqueuer interfaces + implementations (AC: #4, #6)
  - [x] `Application/Common/{IScanFileJobEnqueuer, IParseFileJobEnqueuer, IExtractStructureJobEnqueuer, IPublishNodeContentJobEnqueuer}.cs`: each `Enqueue(string id, ...)` method gains a second parameter, `string? correlationId`.
  - [x] `Infrastructure/Jobs/{ScanFileJobEnqueuer, ParseFileJobEnqueuer, ExtractStructureJobEnqueuer, PublishNodeContentJobEnqueuer}.cs`: forward the new parameter into the existing `BackgroundJob.Enqueue<IXJob>(j => j.RunAsync(id, correlationId, CancellationToken.None, null))` call (exact argument order per AD-23's own worked example — `correlationId` slots in right after the entity id, before `CancellationToken`).
- [x] Task 4: Thread `correlationId` through all 4 job interfaces + implementations (AC: #5, #6)
  - [x] `Infrastructure/Jobs/{IScanFileJob, IParseFileJob, IExtractStructureJob, IPublishNodeContentJob}.cs`: `RunAsync(string id, string? correlationId, CancellationToken cancellationToken, PerformContext? context = null)` — new parameter inserted in the same position as the enqueuer call above.
  - [x] Each job's `RunAsync` (`ScanFileJob.cs`, `ParseFileJob.cs`, `ExtractStructureJob.cs`, `PublishNodeContentJob.cs`): add `correlationIdAccessor.Set(correlationId);` as the **first line**, before any other logic — inject `ICorrelationIdAccessor` into each job's constructor. This is what makes the value available to Story 4.3's capture-service calls inside these same jobs, via the same accessor the HTTP path uses (never derived independently inside the job, per AD-23).
  - [x] Where a job itself enqueues the next pipeline step (`ScanFileJob` → `parseFileJobEnqueuer.Enqueue`; `ParseFileJob` → `extractStructureJobEnqueuer.Enqueue`), forward the **same `correlationId` parameter already in scope** — not a fresh `correlationIdAccessor.Current` read — to make the single-source-of-truth chain explicit and obviously correct at each hop.
- [x] Task 5: Update the 2 call sites that trigger the pipeline's first enqueue (AC: #4)
  - [x] `Application/Courses/CourseFileService.cs` (`UploadFileAsync`): inject `ICorrelationIdAccessor`; change `scanFileJobEnqueuer.Enqueue(courseFile.Id)` → `scanFileJobEnqueuer.Enqueue(courseFile.Id, correlationIdAccessor.Current)`.
  - [x] `Application/AdaptiveLearning/PublishService.cs` (`PublishAsync`): inject `ICorrelationIdAccessor`; the existing `foreach (var item in items) jobEnqueuer.Enqueue(item.Id);` loop enqueues **multiple** jobs from one HTTP request — read `correlationIdAccessor.Current` once (outside or inside the loop, same value either way since it's ambient for the whole request) and pass it to every `Enqueue` call, so all of one publish's node-generation jobs share one Correlation ID.
- [x] Task 6: Backend tests (AD-7)
  - [x] New: `FlexDemy.Infrastructure.Tests/Correlation/AsyncLocalCorrelationIdAccessorTests.cs` — `Set` then `Current` round-trips within one logical call context; a value set in one `async` chain is visible across `await` boundaries within that same chain (the actual guarantee AC #5 depends on).
  - [x] New: an `FlexDemy.Api.Tests` integration test (using this project's existing `WebApplicationFactory<Program>` pattern — `Program.cs`'s trailing `public partial class Program;` exists for exactly this) asserting: no `X-Correlation-Id` request header → response carries a newly-generated one; a supplied `X-Correlation-Id` request header → the exact same value comes back on the response.
  - [x] **Breaking-change alert — update every existing caller of the changed signatures**, or the build fails: `ScanFileJobTests.cs`, `ParseFileJobTests.cs`, `ExtractStructureJobTests.cs`, `PublishNodeContentJobTests.cs` (all 4 job test files — every `RunAsync(...)` call site needs a `correlationId` argument, e.g. a test constant or `null`), `CourseFileServiceTests.cs`, `PublishServiceTests.cs` (both now need an `ICorrelationIdAccessor` substitute injected). This is not optional cleanup — the existing test suite will not compile until these are updated.

### Review Findings

- [x] [Review][Patch] `Sut` records in `CourseFileServiceTests.cs`/`PublishServiceTests.cs` never expose `ICorrelationIdAccessor` — the forwarding of `accessor.Current` into the first enqueuer call at each pipeline's origin is completely untested [BackEnd/tests/FlexDemy.Application.Tests/Courses/CourseFileServiceTests.cs:12, BackEnd/tests/FlexDemy.Application.Tests/AdaptiveLearning/PublishServiceTests.cs:14]
- [x] [Review][Patch] `CorrelationIdMiddleware` performs no validation on the incoming `X-Correlation-Id` header — no length cap, no format restriction, no trim, and a repeated header is silently comma-joined via `StringValues.ToString()` instead of rejected/deduplicated; an unvalidated client value flows into the AsyncLocal, the echoed response header, and every downstream Hangfire job's persisted arguments [BackEnd/src/FlexDemy.Api/Middleware/CorrelationIdMiddleware.cs:16]
- [x] [Review][Patch] `PublishService.PublishAsync`'s multi-item enqueue loop has no test asserting every enqueued job in one batch receives the identical correlation ID — the existing call-order test only captures item IDs, never the correlationId argument [BackEnd/tests/FlexDemy.Application.Tests/AdaptiveLearning/PublishServiceTests.cs:127]
- [x] [Review][Patch] `CorrelationIdMiddleware` is registered after `UseCors`, so CORS-preflight (OPTIONS) responses never pass through it and get no correlation ID header — negligible real consequence but a trivial, risk-free reorder [BackEnd/src/FlexDemy.Api/Program.cs:95-117]
- [x] [Review][Patch] `Program.cs`'s comment on the new middleware claims it exists "so an exception always has an ID to attach to its ErrorRecord," but `ErrorRecord` doesn't exist yet and `ExceptionHandlingMiddleware` doesn't read the accessor at all — describes a Story 4.3 capability as already delivered [BackEnd/src/FlexDemy.Api/Program.cs:114]
- [x] [Review][Patch] `AsyncLocalCorrelationIdAccessor`'s DI-registration comment implies the Singleton lifetime is what provides "one shared instance app-wide," when the private static `AsyncLocal` field is actually what does that — any lifetime would behave identically; the registration choice is fine, the reasoning stated is misleading [BackEnd/src/FlexDemy.Infrastructure/DependencyInjection.cs:59-60]
- [x] [Review][Defer] No integration-level test exercises the real composed `Program.cs` pipeline (middleware order, DI wiring) — an accidental removal/reorder of `CorrelationIdMiddleware` or its DI registration wouldn't be caught by anything in this diff; pre-existing repo-wide gap (no `WebApplicationFactory` test infra exists anywhere yet), building it is a larger infrastructure investment better scoped as its own task — deferred, pre-existing
- [x] [Review][Defer] All 4 Hangfire job interfaces gained a new required mid-signature parameter; any job already serialized in Hangfire's job store before this deploys (mid-retry/delayed) was queued against the old 3-parameter signature — a general Hangfire-signature-versioning concern applying to any future change to these same job classes, dependent on deployment posture outside this review's scope — deferred, pre-existing

## Dev Notes

- **This story's entire job is infrastructure — it has no admin-visible or user-visible output on its own.** Per the epics document's own framing and the implementation-readiness review, Stories 4.1-4.5 are one atomic release unit; do not treat this story's completion as a deploy checkpoint.
- **AD-23's `[ASSUMPTION]`, carried forward, not yet resolved:** mint a fresh `Guid.NewGuid()` rather than reusing ASP.NET Core's built-in `HttpContext.TraceIdentifier`, specifically to avoid coupling this feature's identifier semantics to a framework-internal value that can serve other purposes. If this needs to change, it's a one-line swap inside `CorrelationIdMiddleware`, isolated by design.
- **Exact current pipeline (`Api/Program.cs`), for placement precision:** `UseCors` → **`UseMiddleware<CorrelationIdMiddleware>()` (new, this story)** → `UseMiddleware<ExceptionHandlingMiddleware>()` (existing, line 115) → `UseHttpsRedirection` → `UseStaticFiles` → `UseAuthentication` → `UseAuthorization` → `UseHangfireServer` → `MapControllers`.
- **Forward-looking flag for Story 4.2/4.4 (from the implementation-readiness review, 2026-08-13):** `ICorrelationIdAccessor.Current` correctly captures the ambient ID for the HTTP/job path this story builds (AC #1-#6), but Story 4.4's anonymous `POST /api/v1/errors/client` endpoint (FR-7) is itself a fresh HTTP request — its own `CorrelationIdMiddleware` pass will assign *that request* a new ID, which is **not** the same as the originating page-session ID the frontend needs to report (FR-23). This story does not need to solve that — it's Story 4.2/4.4's problem to make `IErrorCaptureService.CaptureAsync` accept an explicit override rather than only trusting the ambient accessor for that one path — but don't be surprised if that gap surfaces then; it's expected, not a regression in this story.
- **No behavior change to any existing response** — `CorrelationIdMiddleware` only adds a header and populates the accessor; it does not touch status codes, bodies, or existing `ProblemDetails` shapes.

### Project Structure Notes

- **New:** `BackEnd/src/FlexDemy.Application/Common/ICorrelationIdAccessor.cs`, `BackEnd/src/FlexDemy.Infrastructure/Correlation/AsyncLocalCorrelationIdAccessor.cs`, `BackEnd/src/FlexDemy.Api/Middleware/CorrelationIdMiddleware.cs`, `BackEnd/tests/FlexDemy.Infrastructure.Tests/Correlation/AsyncLocalCorrelationIdAccessorTests.cs`, a new `FlexDemy.Api.Tests` integration test file for the middleware.
- **Modified (signature changes — see Task 6's breaking-change alert):** all 4 `Application/Common/I*JobEnqueuer.cs`; all 4 `Infrastructure/Jobs/*JobEnqueuer.cs`; all 4 `Infrastructure/Jobs/I*Job.cs`; all 4 `Infrastructure/Jobs/{ScanFileJob, ParseFileJob, ExtractStructureJob, PublishNodeContentJob}.cs`; `Application/Courses/CourseFileService.cs`; `Application/AdaptiveLearning/PublishService.cs`; `Api/Program.cs`; `Infrastructure/DependencyInjection.cs` (new `ICorrelationIdAccessor` registration); `ScanFileJobTests.cs`, `ParseFileJobTests.cs`, `ExtractStructureJobTests.cs`, `PublishNodeContentJobTests.cs`, `CourseFileServiceTests.cs`, `PublishServiceTests.cs`.
- Matches the Structural Seed's `Infrastructure/Correlation/` folder, called out explicitly in the backend architecture spine.

### References

- [Source: _specs/planning-artifacts/epics-ErrorObservability.md — Story 4.1 (lines 123-155)]
- [Source: _specs/planning-artifacts/prds/prd-eLearning-ErrorObservability-2026-08-13/prd.md — FR-20, FR-21 §4.9]
- [Source: _specs/planning-artifacts/prds/prd-eLearning-ErrorObservability-2026-08-13/addendum.md — "Correlation ID: existing state and wiring points"]
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md — AD-23 (verbatim mechanism decision), AD-1 (why Application must never touch `HttpContext` directly)]
- [Source: _specs/planning-artifacts/implementation-readiness-report-2026-08-13.md — Issue 1 (FR-22/FR-23 Correlation ID plumbing gap), Issue 2 (Stories 4.1-4.5 as one atomic release unit)]
- [Source: BackEnd/src/FlexDemy.Api/Program.cs — exact current middleware pipeline order]
- [Source: BackEnd/src/FlexDemy.Infrastructure/Jobs/{ScanFileJob.cs, ParseFileJob.cs, ExtractStructureJob.cs, PublishNodeContentJob.cs} — exact current `RunAsync` bodies and retry-exhaustion shape, read in full]
- [Source: BackEnd/src/FlexDemy.Application/Courses/CourseFileService.cs, BackEnd/src/FlexDemy.Application/AdaptiveLearning/PublishService.cs — exact current enqueue call sites]

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `dotnet build` (full solution): 0 errors, 1 pre-existing unrelated warning (Hangfire `UseHangfireServer` obsolete-API, present before this story).
- `dotnet test` (full solution, all 3 test projects): 703 passed, 0 failed (479 Application.Tests + 175 Infrastructure.Tests + 49 Api.Tests).

### Completion Notes List

- **Deviation from story text — no `WebApplicationFactory<Program>`-based integration test infra exists in this repo.** Task 6's own text assumed one existed to extend; it doesn't (confirmed: only `FlexDemy.Api.Tests/Controllers`/`Middleware` tests exist, all constructing controllers/handlers directly). `CorrelationIdMiddlewareTests.cs` follows the exact same direct-unit-test pattern already established by `ExceptionHandlingMiddlewareTests.cs` instead — no new heavier test infrastructure needed or introduced.
- **Real `AsyncLocal` semantics finding, load-bearing for how this story's own tests had to be written:** a value set via `ICorrelationIdAccessor.Set(...)` inside `CorrelationIdMiddleware.InvokeAsync` (or inside a job's `RunAsync`) flows forward into `next(context)` (or, for jobs, into everything called after `Set()` within that same execution) — but does **not** flow back up to the middleware's own caller once `InvokeAsync` returns. This is by design (same reason ASP.NET Core's own `IHttpContextAccessor` is only ever read downstream of where it's set) and is exactly the mechanism that makes AC #3 true (`ExceptionHandlingMiddleware`, running inside `CorrelationIdMiddleware`'s own `next(context)` call, correctly observes the value). The first version of `CorrelationIdMiddlewareTests.cs` asserted `accessor.Current` *after* awaiting `InvokeAsync` from the test method itself and failed for exactly this reason; fixed by asserting from inside the `next` delegate instead, matching how `ExceptionHandlingMiddleware` will actually observe it in production. Worth flagging for Story 4.2/4.3's own developer: `IErrorCaptureService.CaptureAsync`, when called from within a job's `RunAsync` (after that job's own `Set()` call) or from within `ExceptionHandlingMiddleware` (downstream of `CorrelationIdMiddleware`), will correctly see the value — this is not a footgun for those stories, just worth understanding why it works.
- All 4 job enqueuer interfaces/implementations, all 4 job interfaces/implementations, and both call sites (`CourseFileService`, `PublishService`) were updated exactly as scoped. `PublishService.PublishAsync`'s loop reads `correlationIdAccessor.Current` once before enqueuing all of one publish batch's items, so every node-generation job from one publish trigger shares the same Correlation ID.
- Fixed 6 existing test files broken by the signature changes, exactly as this story's own Task 6 predicted (`CourseFileServiceTests.cs`, `PublishServiceTests.cs`, `ScanFileJobTests.cs`, `ParseFileJobTests.cs`, `ExtractStructureJobTests.cs`, `PublishNodeContentJobTests.cs`) — all were compile failures only (new required constructor/method parameters), plus one genuine test bug surfaced by the fix: `PublishServiceTests.cs`'s `call.Arg<string>()` became ambiguous once `Enqueue` gained a second `string` parameter (NSubstitute's `AmbiguousArgumentsException`) — fixed to `call.ArgAt<string>(0)`.
- Added one dedicated correlation-propagation test per job beyond the minimum compile-fix (`RunAsync_sets_the_correlation_accessor_and_forwards_the_same_id_to_the_...`/`RunAsync_sets_the_correlation_accessor_from_the_passed_in_id`) — these directly exercise this story's core value (AC #4/#5), not just the pre-existing behavior the signature change touched incidentally.

### File List

**New:**
- `BackEnd/src/FlexDemy.Application/Common/ICorrelationIdAccessor.cs`
- `BackEnd/src/FlexDemy.Infrastructure/Correlation/AsyncLocalCorrelationIdAccessor.cs`
- `BackEnd/src/FlexDemy.Api/Middleware/CorrelationIdMiddleware.cs`
- `BackEnd/tests/FlexDemy.Infrastructure.Tests/Correlation/AsyncLocalCorrelationIdAccessorTests.cs`
- `BackEnd/tests/FlexDemy.Api.Tests/Middleware/CorrelationIdMiddlewareTests.cs`

**Modified:**
- `BackEnd/src/FlexDemy.Infrastructure/DependencyInjection.cs`
- `BackEnd/src/FlexDemy.Api/Program.cs`
- `BackEnd/src/FlexDemy.Application/Common/{IScanFileJobEnqueuer.cs, IParseFileJobEnqueuer.cs, IExtractStructureJobEnqueuer.cs, IPublishNodeContentJobEnqueuer.cs}`
- `BackEnd/src/FlexDemy.Infrastructure/Jobs/{ScanFileJobEnqueuer.cs, ParseFileJobEnqueuer.cs, ExtractStructureJobEnqueuer.cs, PublishNodeContentJobEnqueuer.cs}`
- `BackEnd/src/FlexDemy.Infrastructure/Jobs/{IScanFileJob.cs, IParseFileJob.cs, IExtractStructureJob.cs, IPublishNodeContentJob.cs}`
- `BackEnd/src/FlexDemy.Infrastructure/Jobs/{ScanFileJob.cs, ParseFileJob.cs, ExtractStructureJob.cs, PublishNodeContentJob.cs}`
- `BackEnd/src/FlexDemy.Application/Courses/CourseFileService.cs`
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/PublishService.cs`
- `BackEnd/tests/FlexDemy.Application.Tests/Courses/CourseFileServiceTests.cs`
- `BackEnd/tests/FlexDemy.Application.Tests/AdaptiveLearning/PublishServiceTests.cs`
- `BackEnd/tests/FlexDemy.Infrastructure.Tests/Jobs/{ScanFileJobTests.cs, ParseFileJobTests.cs, ExtractStructureJobTests.cs, PublishNodeContentJobTests.cs}`

## Change Log

- 2026-08-13: Story created via `bmad-create-story` — first of Epic 4's 7 stories, written as part of a full-epic write-then-implement batch (all 7 stories created together, in dependency order, to minimize redundant re-analysis of shared PRD/architecture context across separate story-creation passes). Status set to `ready-for-dev`.
- 2026-08-13: Implementation complete via `bmad-dev-story` — all 6 tasks done, 703-test full backend regression suite passing (11 new tests added: 5 accessor, 4 middleware, 2 job-level correlation-propagation cases beyond the minimum compile fixes). One real `AsyncLocal` semantics correction made and documented (see Completion Notes); one deviation from story text (no `WebApplicationFactory` infra exists, used the existing direct-unit-test pattern instead). Status set to `review`.
- 2026-08-13: `bmad-code-review` (Blind Hunter/Edge Case Hunter/Acceptance Auditor, scoped to this story's own 31-file diff against `baseline_commit`) found 6 `patch` findings and 2 `defer` findings (3 dismissed as noise/false-positive). All 6 patches applied: `CorrelationIdMiddleware` now validates the incoming header (length cap, charset restriction, trim, rejects repeated headers instead of comma-joining them, falls back to a fresh GUID rather than trusting untrusted client input); reordered ahead of `UseCors` so CORS-preflight responses also get a correlation ID; two misleading comments corrected (`Program.cs`'s premature "attaches to ErrorRecord" claim, the DI-registration comment's Singleton-lifetime reasoning); and the two most significant gaps — `CourseFileServiceTests.cs`/`PublishServiceTests.cs` never actually verifying the correlation ID value reaches the enqueuer, and `PublishService`'s multi-item loop never verified to forward the *same* ID to every job — both fixed with dedicated new tests. Full regression re-run: 713 tests passing (10 new from the patch round), `dotnet build` clean. Status set to `done`.
