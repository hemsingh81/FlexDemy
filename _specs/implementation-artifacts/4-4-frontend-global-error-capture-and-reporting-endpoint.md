---
baseline_commit: bbcf238016cf10bf942364c1bbd929d43991d5eb
---

# Story 4.4: Frontend Global Error Capture and Reporting Endpoint

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

*(Cross-cutting story: touches both frontend, backend, and a new backend cross-cutting concern (rate limiting) that has zero existing precedent in this codebase — confirmed via repo-wide grep, no `RateLimit` usage anywhere today.)*

## Story

As a platform engineer,
I want every uncaught frontend error — render crash, unhandled rejection, or raw exception — automatically reported to the backend,
so that frontend failures stop vanishing silently the moment a user's tab closes.

## Acceptance Criteria

1. **Given** any component throws during render, **when** that happens, **then** a single top-level React Error Boundary (mounted in `main.tsx`) catches it, shows a graceful fallback UI instead of a blank screen, and reports it. [Source: epics-ErrorObservability.md Story 4.4; PRD FR-6]
2. **Given** a rejected Promise with no `.catch()`, or a raw exception outside React's render cycle (e.g. inside `setTimeout` or a raw event handler), **when** that happens, **then** `window.addEventListener('unhandledrejection'/'error', ...)` listeners, registered once at app startup, catch and report it. [Source: PRD FR-6]
3. **Given** any of these three capture paths fires, **when** it does, **then** `errorsService.ts` calls `POST /api/v1/errors/client` with `{ message, stack?, url, userAgent, timestamp }`, **and** that call never itself surfaces a visible error to the user, even if the report fails. [Source: PRD FR-6, FR-7]
4. **Given** the request carries a valid auth token, **when** `ErrorReportingController` receives it, **then** the resulting `ErrorRecord`'s `UserId` is populated; **given** no valid token (e.g. a crash on the login screen itself), **when** the report is received, **then** `UserId` is `null` and the record is still created — `ErrorReportingController` carries no `[Authorize]` attribute at all. [Source: PRD FR-7]
5. **Given** more than 30 requests/minute from one source IP, **when** the limit is exceeded, **then** further requests return 204, not 429 — no visible error from the error-reporting endpoint itself. [Source: PRD FR-7, `[ASSUMPTION: 30/min/IP — confirm before build]`]
6. **Given** `services/httpClient.ts` receives a response carrying an `X-Correlation-Id` header, **when** that happens, **then** the module-level store is updated with that value; **given** `errorsService.ts` sends a report, **when** the store holds a current value, **then** the report payload includes it. [Source: PRD FR-23; frontend AD-7]

## Tasks / Subtasks

### Frontend

- [x] Task 1: `services/httpClient.ts` — the new shared low-level request helper (AC: #6)
  - [x] `FrontEnd/src/services/httpClient.ts`: extract/generalize `courseDraftService.ts`'s `write<T>()` into a shared `request<T>(path, method, body?)` function — same `Authorization: Bearer ${getToken()}` header, same `problem.detail`-reading error path, same 204-returns-`undefined` handling. **New behavior this story adds:** after every `fetch` resolves (success or error-status), read `response.headers.get('X-Correlation-Id')` and, if present, update a module-level `let currentCorrelationId: string | null = null` variable (not React state — this doesn't drive rendering, per AD-7). Export `getCurrentCorrelationId(): string | null`.
  - [x] Export a generic `HttpClientError extends Error` for callers that don't need their own named subclass.
  - [x] **Scope boundary — do not migrate every existing service in this story.** Frontend AD-7 and the addendum explicitly name only `courseFileService.ts` for retirement of its duplicated fetch pattern. This story's Task 2 migrates `courseFileService.ts` onto `httpClient.ts`. `courseDraftService.ts`'s own `write<T>()` should also delegate to `httpClient.ts`'s `request<T>()` internally (thin wrapper, keep `CourseDraftError` as its public error type) so its calls also update the correlation-ID store — AD-7's own reasoning ("bolting capture onto only the shared helper would mean calls still on the per-function pattern silently never update the retained ID") applies to it too, since it's a second, separate helper today. **Every other service file** (`coursesService.ts`, `aiConfigService.ts`, `tagsService.ts`, `tutorService.ts`, `groupStudyService.ts`, `userService.ts`, `reviewsService.ts`, `aiGatewayService.ts`) is **out of scope** for this story — do not touch them; several are still mock-backed and don't call `fetch` at all yet.
- [x] Task 2: Retire `courseFileService.ts`'s duplicated fetch logic (AC: #6)
  - [x] `FrontEnd/src/services/courseFileService.ts`: both `uploadFile` (FormData body) and `getFiles` (plain GET) currently duplicate the same try/fetch/`!response.ok`/`problem.detail` block `courseDraftService.ts` already factors out. Rewrite both to call `httpClient.ts`'s `request<T>()` — `request<T>()` needs to support a `FormData` body variant too (no `Content-Type` header set manually, same as `uploadThumbnail`'s existing handling in `courseDraftService.ts`) for `uploadFile` to migrate cleanly.
- [x] Task 3: `services/errorsService.ts` (AC: #3, #4, #6)
  - [x] `FrontEnd/src/services/errorsService.ts`: `reportError({ message, stack, url, userAgent, timestamp }): Promise<void>` — calls `httpClient.ts`'s `request()` against `POST /api/v1/errors/client`, including `correlationId: getCurrentCorrelationId()` in the body when non-null (an addition beyond FR-7's literal minimum payload shape, required by AC #6/FR-23 — the PRD's payload list is a floor, not a ceiling). **Must never throw outward** (AC #3's "never itself surface a visible error") — wrap the `request()` call in its own `try { ... } catch { /* swallowed */ }`, do not let `httpClient.ts`'s own error-throwing behavior propagate here.
- [x] Task 4: Top-level React Error Boundary (AC: #1)
  - [x] New `FrontEnd/src/ErrorBoundary.tsx` — a class component (React Error Boundaries require `componentDidCatch`/`getDerivedStateFromError`, which function components cannot implement). **Placement note:** this is neither a `ui/` primitive (it calls `errorsService.ts`, failing AD-3's `ui/` test — `ui/` may import only `lib/*`/`types.ts`, never `services/*`) nor a feature — it's composition-root infrastructure, so it lives at `src/` top level alongside `App.tsx`/`main.tsx`, not under `features/` or `ui/`. `componentDidCatch(error, errorInfo)` calls `errorsService.reportError(...)` and renders a simple fallback UI (a centered message + reload suggestion, not a blank screen) instead of `this.props.children`.
  - [x] `FrontEnd/src/main.tsx`: wrap `<App />` in `<ErrorBoundary>` inside the existing `<StrictMode>`.
- [x] Task 5: Global `window.onerror`/`unhandledrejection` listeners (AC: #2)
  - [x] New `FrontEnd/src/globalErrorHandlers.ts`: exports `registerGlobalErrorHandlers()`, called once from `main.tsx` before `createRoot(...).render(...)` — registers `window.addEventListener('error', ...)` and `window.addEventListener('unhandledrejection', ...)`, each calling `errorsService.reportError(...)` with the available `message`/`stack`/`url`(`window.location.href`)/`userAgent`(`navigator.userAgent`)/`timestamp`(`new Date().toISOString()`).
- [x] Task 6: Frontend tests (AD-5)
  - [x] `FrontEnd/tests/services/httpClient.test.ts`: correlation-ID store updates from a response header and is readable via `getCurrentCorrelationId()`; a response with no header leaves the prior value unchanged (not reset to null).
  - [x] `FrontEnd/tests/services/errorsService.test.ts`: payload includes `correlationId` when the store has a value, omits/nulls it when not; a `fetch` rejection or non-OK response never throws out of `reportError`.
  - [x] `FrontEnd/tests/ErrorBoundary.test.tsx`: a throwing child renders the fallback UI instead of crashing the test render, and calls the mocked `errorsService.reportError`.
  - [x] `FrontEnd/tests/globalErrorHandlers.test.ts`: dispatching a synthetic `window` `error`/`unhandledrejection` event triggers a mocked `errorsService.reportError` call.
  - [x] Update `FrontEnd/tests/services/courseFileService.test.ts` (if it exists — confirm during dev) for the `httpClient.ts` migration; mock `httpClient.ts`, not raw `fetch`, per AD-5's "the service module is the mock boundary" convention now one layer deeper for this file. **Confirmed during dev: this file does not exist** — neither does `courseDraftService.test.ts` — so there was nothing to update; both files' only coverage is indirect, through the feature tests that mock the service module wholesale (`CourseContentEditor.test.tsx`, `useFileUpload.test.ts`, `useCourseDraft.test.ts`, etc.), all of which still pass unmodified since exported names/signatures/error classes didn't change.

### Backend

- [x] Task 7: `ErrorReportingController` (AC: #3, #4, #5)
  - [x] `Api/Controllers/ErrorReportingController.cs`: `[ApiController]`, `[Route("api/v1/errors")]`, **no `[Authorize]` attribute at all** (AC #4 — deliberately anonymous, per AD-24's two-controller split). `[HttpPost("client")] Task<IActionResult> ReportClientError(ReportClientErrorRequest request, CancellationToken cancellationToken)`.
  - [x] `ReportClientErrorRequest` DTO: `Message` (string), `Stack` (string?), `Url` (string?), `UserAgent` (string?), `Timestamp` (DateTime?), `CorrelationId` (string?).
  - [x] Action body: calls `IErrorCaptureService.CaptureAsync(new ErrorCaptureRequest { Message = request.Message, StackTrace = request.Stack, Source = ErrorSource.Frontend, RequestPath = request.Url, UserId = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value, CorrelationIdOverride = request.CorrelationId }, cancellationToken)`, then `return Accepted()` (202) unconditionally — `CaptureAsync` already swallows its own failures (Story 4.2), so there is no failure path here to branch on. **`UserId` populates itself for free** — `UseAuthentication` runs on every request regardless of the controller's own `[Authorize]` status (confirmed: it's registered ahead of `UseAuthorization`/`MapControllers` in `Program.cs`'s existing pipeline), so `User.FindFirst(...)` resolves a claim if a valid bearer token was sent, and is simply absent otherwise — no extra "try to auth this anonymous endpoint" logic needed. **Implemented via `ICurrentUserService.UserId` instead of the literal `User?.FindFirst(ClaimTypes.NameIdentifier)` text above** — Story 4.3's own code review (2026-08-14) just replaced that exact ad hoc pattern in `ExceptionHandlingMiddleware` for the identical reason: it checks only one of the two claim types (`ClaimTypes.NameIdentifier` vs. `JwtRegisteredClaimNames.Sub`) every other call site in this codebase checks via the shared `ICurrentUserService` abstraction. Reusing it here from the start avoids reintroducing the same bug this story would otherwise need a follow-up patch for.
  - [x] **This is the call site that exercises Story 4.2's `CorrelationIdOverride ?? accessor.Current` resolution for real** — `request.CorrelationId` (the frontend's stored value from a prior page/response) takes precedence over whatever `CorrelationIdMiddleware` assigned to this specific anonymous POST request itself. Verified via `Passes_the_request_body_CorrelationId_through_as_CorrelationIdOverride` — behaves as designed.
- [x] Task 8: Per-IP rate limiting — genuinely new infrastructure (AC: #5)
  - [x] `Api/Program.cs`: `builder.Services.AddRateLimiter(...)` — .NET's own built-in `Microsoft.AspNetCore.RateLimiting` middleware, no NuGet package needed. **Implemented as `options.AddPolicy(ErrorReportingRateLimiterPolicy.PolicyName, ErrorReportingRateLimiterPolicy.GetPartition)` referencing a new `Api/RateLimiting/ErrorReportingRateLimiterPolicy.cs` static class, not an inline lambda in `Program.cs`** — pulling `GetPartition`/`OnRejected` out into their own testable methods is what makes Task 9's rate-limiter test possible without a `WebApplicationFactory` (see Task 9 below). Partitioned by `context.Connection.RemoteIpAddress`. `OnRejected` overrides the library's default 429 with 204 (AC #5).
  - [x] `app.UseRateLimiter()` registered in the middleware pipeline, after `UseAuthorization()` and before `UseHangfireServer()`/`MapControllers()`.
  - [x] `[EnableRateLimiting("ErrorReporting")]` on the whole `ErrorReportingController` (it only has one action).
- [x] Task 9: Backend tests (AD-7)
  - [x] `FlexDemy.Api.Tests/Controllers/ErrorReportingControllerTests.cs`: action-level tests confirming an authenticated request (via a substituted `ICurrentUserService`) populates `UserId`, an unauthenticated one leaves it `null`, both return 202, the request body maps onto `ErrorCaptureRequest` with `Source = Frontend`, and `CorrelationId` passes through as `CorrelationIdOverride`.
  - [x] `FlexDemy.Api.Tests/RateLimiting/ErrorReportingRateLimiterPolicyTests.cs`: per the story's own `[ASSUMPTION]`, scoped to a lower-level unit test of the limiter policy rather than a `WebApplicationFactory`-based integration test — this repo has no such test-host infrastructure (confirmed: only direct-construction unit tests exist under `FlexDemy.Api.Tests/Controllers`), and the in-process test host wouldn't populate `RemoteIpAddress` realistically anyway. Builds a real `PartitionedRateLimiter<HttpContext>` from `ErrorReportingRateLimiterPolicy.GetPartition` (the same partitioner `Program.cs` registers) and drives it directly: the 31st request from the same simulated IP within the window is rejected, a different IP has its own independent limit, and `OnRejected` sets 204 (not the library's 429 default).

### Review Findings

- [x] [Review][Patch] `Program.cs`'s CORS policy (`policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()`) never calls `.WithExposedHeaders("X-Correlation-Id")` — browsers only expose CORS-safelisted response headers to JS on cross-origin responses unless the server explicitly opts a header in via `Access-Control-Expose-Headers`. The frontend (Vite dev server / nginx `web` container) and API are different origins by this project's own design (see the CORS comment), so `httpClient.ts`'s `response.headers.get('X-Correlation-Id')` reads `null` on every real cross-origin request, and `getCurrentCorrelationId()` never populates — AC #6/FR-23's entire correlation-ID capture chain silently never fires outside a same-origin setup, confirmed by reading the actual `Program.cs` CORS config [BackEnd/src/FlexDemy.Api/Program.cs:46-50]
- [x] [Review][Patch] `ErrorReportingRateLimiterPolicy` uses a `FixedWindowRateLimiter`, which permits up to ~2x `PermitLimit` in a short span for a client bursting at the boundary between two adjacent windows (e.g. 30 requests at :59, 30 more at :01) — undermines AC #5's "more than 30 requests/minute" intent without any comment acknowledging the tradeoff; `RateLimitPartition.GetSlidingWindowLimiter` is a drop-in replacement in the same API family with no new dependencies [BackEnd/src/FlexDemy.Api/RateLimiting/ErrorReportingRateLimiterPolicy.cs:20-26]
- [x] [Review][Patch] `ErrorReportingController` accepts `request.CorrelationId` from an anonymous, unauthenticated caller and passes it straight through as `CorrelationIdOverride` with no format validation — any anonymous client can spoof an arbitrary correlation ID, cross-linking its error report to an unrelated (possibly authenticated) session's trail. `CorrelationIdMiddleware` already established the exact validation this needs (length cap, `^[A-Za-z0-9_-]+$` pattern) for the identical untrusted-client-input problem on the request header side — this endpoint should reuse that same validation, not skip it because the value arrives in a body field instead of a header [BackEnd/src/FlexDemy.Api/Controllers/ErrorReportingController.cs:31]
- [x] [Review][Patch] `ReportClientErrorRequest.Message` has no validation at all — empty/whitespace-only messages are accepted and persisted with zero guard, on the one anonymous write endpoint in this app [BackEnd/src/FlexDemy.Api/Controllers/ErrorReportingController.cs:27-39]
- [x] [Review][Patch] `httpClient.ts`'s `request()` calls `response.json()` unguarded on the success path (`if (response.status === 204) return undefined as T; return response.json();`) — a malformed or empty-but-200 JSON body throws a raw `SyntaxError` instead of the same friendly `HttpClientError` every other failure path in this function already produces [FrontEnd/src/services/httpClient.ts:48-50]
- [x] [Review][Patch] `ErrorBoundary.tsx`'s `componentDidCatch(error: Error, ...)` assumes the thrown value is always an `Error` instance, but React passes through whatever was actually thrown at runtime (a string, a plain object, etc.) regardless of the TS parameter type — for a non-`Error` throw, `error.message` is `undefined`, and `JSON.stringify` silently drops the `message` key from the report payload entirely, defeating this exact feature for exactly the inputs AC #1 says it must catch ("any component throws during render," not "throws an `Error`") [FrontEnd/src/ErrorBoundary.tsx:27]
- [x] [Review][Defer] The module-level `currentCorrelationId` in `httpClient.ts` holds only the most-recently-seen value ("last response wins"), so under concurrent in-flight requests an error report can be tagged with an unrelated request's correlation ID. Deferred: this is the literal, deliberate frontend AD-7 architecture decision ("a single module-level store... holds the most recently seen `X-Correlation-Id` response header value" — not per-request state) — revisiting it means reopening an already-ratified architecture decision, out of this story's scope.
- [x] [Review][Defer] `ErrorReportingRateLimiterPolicy.GetPartition`'s per-IP key collapses to a shared `"unknown"` bucket when `RemoteIpAddress` is null, and collapses to one shared budget for any clients behind the same NAT/reverse proxy. Deferred: a real limitation of "per source IP" limiting generally; properly fixing the proxy case requires `ForwardedHeadersMiddleware` with an explicit trusted-proxy configuration decision (blindly trusting `X-Forwarded-For` without restricting to known proxies is itself a spoofing risk) — a deployment-topology decision bigger than this story's rate-limiting scope, and `docker-compose.yml` puts no reverse proxy in front of the API today.
- [x] [Review][Defer] Unauthenticated `Message`/`Stack`/`Url` are persisted with no sanitization for future rendering. Deferred: not a risk in this story — nothing renders these fields yet (Story 4.5 builds the admin error-log viewer), and React's default JSX escaping means no code path is unsafe unless a future admin UI deliberately opts into `dangerouslySetInnerHTML`. Flagged here so Story 4.5's own code review re-checks this once that UI exists.
- [x] [Review][Defer] `globalErrorHandlers.ts`/`ErrorBoundary.tsx` have no dedup/debounce for a tight loop of repeated identical errors, which could flood the reporting endpoint. Deferred: a real resilience enhancement, but no AC requires it, and the (patched) rate limiter already provides basic flood protection at 30/min/IP.

## Dev Notes

- **This is the first story in Epic 4 with a real, if narrow, user-visible surface** — the Error Boundary's fallback UI is something an actual (crashing) user sees. It is still not the epic's real release checkpoint (that's Story 4.5 — an admin can't yet *view* anything this story reports).
- **AD-7's core risk, spelled out again for this story specifically:** if `courseDraftService.ts`'s `write<T>()` is left as its own separate implementation instead of delegating to `httpClient.ts`, FR-23 will appear to work for `courseFileService.ts`'s calls and silently not for `courseDraftService.ts`'s — exactly the inconsistency AD-7 exists to prevent. Do not skip the `courseDraftService.ts` delegation in Task 1 just because it wasn't explicitly named for "retirement" the way `courseFileService.ts` was.
- **`ErrorBoundary.tsx`'s file placement is a judgment call, not a spine-pinned path** — the frontend architecture spine only says `main.tsx` "mounts the top-level React Error Boundary," without naming the component's own file location. This story places it at `src/ErrorBoundary.tsx` (composition-root-adjacent, since it structurally can't be `ui/` per AD-3's own test). If a fresher architecture note contradicts this by the time of implementation, follow that instead.
- **Rate limiting is genuinely new to this codebase** (confirmed zero existing usage) — don't look for an existing pattern to copy; this is the first cross-cutting middleware-level policy of its kind here, same "new infrastructure, not reuse" flag the PRD/addendum already raised for FR-11's pagination (Story 4.5).

### Project Structure Notes

- **New (frontend):** `services/httpClient.ts`, `services/errorsService.ts`, `src/ErrorBoundary.tsx`, `src/globalErrorHandlers.ts`, plus 4 new test files.
- **Modified (frontend):** `services/courseFileService.ts` (migrated onto `httpClient.ts`), `services/courseDraftService.ts` (`write<T>()` delegates to `httpClient.ts`), `src/main.tsx` (mounts `ErrorBoundary`, calls `registerGlobalErrorHandlers()`).
- **New (backend):** `Api/Controllers/ErrorReportingController.cs`, its request DTO.
- **Modified (backend):** `Api/Program.cs` (rate limiter registration + `UseRateLimiter()`).

### References

- [Source: _specs/planning-artifacts/epics-ErrorObservability.md — Story 4.4 (lines 223-261)]
- [Source: _specs/planning-artifacts/prds/prd-eLearning-ErrorObservability-2026-08-13/prd.md — FR-6, FR-7, FR-23 §4.2/§4.9]
- [Source: _specs/planning-artifacts/prds/prd-eLearning-ErrorObservability-2026-08-13/addendum.md — "Frontend service pattern", "Existing admin dashboard UI conventions" (rate-limit/pagination "new infra" framing), "Confirmed absent, zero matches repo-wide: componentDidCatch, window.onerror, unhandledrejection, any ErrorBoundary component"]
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md — AD-7 (verbatim, this story's core mechanism), AD-1/AD-3 (why `ErrorBoundary` can't be a `ui/` primitive), AD-5 (test conventions), Structural Seed's `services/httpClient.ts`/`services/errorsService.ts`/`main.tsx` lines]
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md — AD-24 (two-controller split, `ErrorReportingController` has no `[Authorize]`)]
- [Source: FrontEnd/src/services/courseDraftService.ts, FrontEnd/src/services/courseFileService.ts — both read in full; the exact `write<T>()` pattern this story generalizes and the exact duplicated logic it retires]

## Previous Story Intelligence

- **Story 4.2 built `IErrorCaptureService`/`ErrorCaptureRequest` with an explicit `CorrelationIdOverride` field specifically anticipating this story** — Task 7 is the intended consumer. If Story 4.2's actual field name differs from `CorrelationIdOverride` by the time this story starts, use whatever Story 4.2 actually shipped, not this story's text.
- **Story 4.1's `CorrelationIdMiddleware` runs on every request, including this story's own anonymous `POST /api/v1/errors/client`** — that's precisely why Task 7 needs the override mechanism at all; re-read Story 4.1's Dev Notes forward-flag if the interaction is unclear.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- Frontend `npx tsc --noEmit`: 0 new errors (7 pre-existing `FlashcardsModal.tsx` errors confirmed present on a clean `git stash` baseline, unrelated to this story).
- Frontend `npx vitest run --project unit` (full suite, pre-review): 548 passed, 0 failed (81 test files; up from 537/78 pre-story).
- Frontend `npx vitest run --project unit` (full suite, post-patch-round): 550 passed, 0 failed (+2 new: a malformed-JSON-on-200 case in `httpClient.test.ts`, a non-`Error`-throw case in `ErrorBoundary.test.tsx`).
- Backend `dotnet build` (Api project, which pulls in Infrastructure/Application/Domain): 0 errors.
- Backend `dotnet test` (full regression, pre-review): 809 passed, 0 failed (71 Api.Tests + 556 Application.Tests + 182 Infrastructure.Tests).
- Backend `dotnet test` (full regression, post-patch-round): 829 passed, 0 failed (79 Api.Tests + 568 Application.Tests + 182 Infrastructure.Tests — +20 new: 2 `FrontendCorsPolicyTests` + 5 `ErrorReportingControllerTests` (malformed/oversized CorrelationId, empty Message) + 12 `CorrelationIdValidatorTests` + the 1 net class extraction from `CorrelationIdMiddleware`, which kept its own existing test count unchanged).

### Completion Notes List

- **`courseDraftService.ts`'s `uploadThumbnail` was migrated onto `httpClient.ts` too, beyond Task 1's literal text.** Task 1 only named `write<T>()` for delegation; `uploadThumbnail` is a second, separate raw-`fetch` implementation in the same file that Task 1's text didn't call out. AD-7's own Rule text is unconditional ("every `services/*` HTTP call goes through one shared low-level request helper"), and its own Dev Notes warning ("if `courseDraftService.ts`'s `write<T>()` is left as its own separate implementation... FR-23 will appear to work in some flows and silently not in others") applies identically to `uploadThumbnail` — leaving it on raw `fetch` would have reproduced the exact bug AD-7 exists to prevent, just one function over. `request<T>()` was designed from the start to accept a `FormData` body (needed anyway for `courseFileService.ts`'s `uploadFile` per Task 2), so no extra work was required to also cover this call site.
- **`ErrorReportingController`'s `UserId` uses the injected `ICurrentUserService` instead of the story's literal `User?.FindFirst(ClaimTypes.NameIdentifier)?.Value` text.** Story 4.3's own code review (2026-08-14, same day) found and patched that exact ad hoc claim-lookup pattern in `ExceptionHandlingMiddleware` for reproducing only half of this codebase's established dual-claim-type check (`ClaimTypes.NameIdentifier` vs. `JwtRegisteredClaimNames.Sub`, depending on `JwtBearerOptions.MapInboundClaims`). Implementing Task 7 with the literal text would have reintroduced the identical, already-diagnosed bug on the same day it was fixed elsewhere. `ICurrentUserService` was already registered in DI (`HttpContextCurrentUserService`, Scoped) — no new registration needed.
- **Rate limiter policy pulled into its own testable class (`Api/RateLimiting/ErrorReportingRateLimiterPolicy.cs`) rather than the story's suggested inline lambda in `Program.cs`.** The story's own Task 9 `[ASSUMPTION]` flagged that a `WebApplicationFactory`-based integration test might not populate `RemoteIpAddress` realistically and suggested falling back to "a lower-level unit test of the limiter policy instead" if so — confirmed true (this repo has no `WebApplicationFactory` infra at all, matching Story 4.1/4.3's identical precedent). Extracting `GetPartition`/`OnRejected` as static methods on their own class made that fallback testable directly against a real `PartitionedRateLimiter<HttpContext>`, without inventing any new test infrastructure.
- **`FrontEnd/tests/services/courseFileService.test.ts` and `courseDraftService.test.ts` were confirmed absent** (Task 6's own conditional "if it exists") — both files' only existing coverage is indirect, through feature-level tests that mock the service module wholesale (`CourseContentEditor.test.tsx`, `useFileUpload.test.ts`, `useCourseDraft.test.ts`, `CourseWizard.test.tsx`, `PublishLifecycleBar.test.tsx`, `useCourseLifecycle.test.ts`, `TutorEducatorHubView.test.tsx`) — all pass unmodified since exported function names, signatures, and error classes (`CourseFileError`, `CourseDraftError`) are unchanged by the migration.
- **`courseDraftService.ts` re-exports `API_BASE_URL` from `httpClient.ts`** — `useCourseDraft.ts` imports it from `courseDraftService.ts` to build absolute thumbnail URLs; removing the constant from `courseDraftService.ts` entirely (since it now lives in `httpClient.ts`) would have been a breaking change to that existing, unrelated call site. Re-exporting preserves the existing public import surface with no consumer changes needed.

**Code review patch round (2026-08-14):**
- Fixed a confirmed-real bug the review caught only by reading `Program.cs` directly: the CORS policy allowed the frontend origin but never called `.WithExposedHeaders("X-Correlation-Id")`, so the browser silently discarded that header on every cross-origin response — the entire correlation-ID capture chain (AC #6/FR-23) never fired outside a same-origin dev setup. Pulled the policy body into a new testable `FrontendCorsPolicy.Configure()` (mirroring `ErrorReportingRateLimiterPolicy`'s own precedent from this same story) so this class of bug has regression coverage going forward, not just manual-inspection coverage.
- Switched `ErrorReportingRateLimiterPolicy` from a fixed window to a sliding window (`GetSlidingWindowLimiter`, 6 segments) to close the ~2x-burst-at-window-boundary gap — same rate-limiting API family, no new dependency, and the existing 3 rate-limiter tests kept passing unmodified (sliding-window degrades to identical behavior for a tight burst).
- Extracted `CorrelationIdValidator` (`Application/Common`) out of `CorrelationIdMiddleware`'s own private validation logic (Story 4.1) so `ErrorReportingController` applies the identical shape/length rule to `ReportClientErrorRequest.CorrelationId` — that field is exactly as much untrusted anonymous-client input as the `X-Correlation-Id` request header the middleware already guarded; skipping validation just because it arrives in a body field instead of a header would have left an unguarded spoofing vector. `CorrelationIdMiddleware`'s own behavior is unchanged (same regex, same 128-char cap) — its existing test suite passed unmodified.
- `ErrorReportingController` now skips `CaptureAsync` entirely (still returns 202) when `Message` is null/whitespace-only, closing the "anonymous endpoint accepts and persists garbage records with zero validation" gap.
- `httpClient.ts`'s `request()` now wraps the success-path `response.json()` call in the same try/catch pattern the non-ok path already used, so a malformed/empty-but-200 body throws the friendly `HttpClientError` instead of a raw `SyntaxError`.
- `ErrorBoundary.tsx`'s `componentDidCatch` now coerces a non-`Error` thrown value (React passes through whatever was actually thrown, regardless of the TS parameter type) into a real `Error` before building the report payload — previously `error.message` would be `undefined` for e.g. `throw "some string"`, and `JSON.stringify` would silently drop the `message` key from the request body entirely.
- Reviewed but not fixed (defer, logged to `deferred-work.md`): `httpClient.ts`'s "last response wins" correlation-ID store is frontend AD-7's own literal, deliberate design, not a defect; per-IP rate-limit-key collapse under NAT/reverse-proxy requires a bigger `ForwardedHeadersMiddleware`/trusted-proxy decision this story's scope doesn't cover; unsanitized `Message`/`Stack`/`Url` storage is a non-issue until Story 4.5 builds something that renders them; error-storm dedup/debounce is a resilience nice-to-have no AC requires.

### File List

**New (frontend):**
- `FrontEnd/src/services/httpClient.ts`
- `FrontEnd/src/services/errorsService.ts`
- `FrontEnd/src/ErrorBoundary.tsx`
- `FrontEnd/src/globalErrorHandlers.ts`
- `FrontEnd/tests/services/httpClient.test.ts`
- `FrontEnd/tests/services/errorsService.test.ts`
- `FrontEnd/tests/ErrorBoundary.test.tsx`
- `FrontEnd/tests/globalErrorHandlers.test.ts`

**Modified (frontend):**
- `FrontEnd/src/services/courseFileService.ts` (migrated onto `httpClient.ts`)
- `FrontEnd/src/services/courseDraftService.ts` (`write<T>()` and `uploadThumbnail` delegate to `httpClient.ts`; re-exports `API_BASE_URL`)
- `FrontEnd/src/main.tsx` (mounts `ErrorBoundary`, calls `registerGlobalErrorHandlers()`)
- `FrontEnd/src/services/httpClient.ts` (patch: guards `response.json()` on the success path)
- `FrontEnd/src/ErrorBoundary.tsx` (patch: coerces non-`Error` thrown values)
- `FrontEnd/tests/services/httpClient.test.ts` (patch: malformed-JSON-on-200 test)
- `FrontEnd/tests/ErrorBoundary.test.tsx` (patch: non-`Error`-throw test)

**New (backend):**
- `BackEnd/src/FlexDemy.Api/Controllers/ErrorReportingController.cs`
- `BackEnd/src/FlexDemy.Api/RateLimiting/ErrorReportingRateLimiterPolicy.cs`
- `BackEnd/tests/FlexDemy.Api.Tests/Controllers/ErrorReportingControllerTests.cs`
- `BackEnd/tests/FlexDemy.Api.Tests/RateLimiting/ErrorReportingRateLimiterPolicyTests.cs`
- `BackEnd/src/FlexDemy.Api/Cors/FrontendCorsPolicy.cs` (patch)
- `BackEnd/tests/FlexDemy.Api.Tests/Cors/FrontendCorsPolicyTests.cs` (patch)
- `BackEnd/src/FlexDemy.Application/Common/CorrelationIdValidator.cs` (patch)
- `BackEnd/tests/FlexDemy.Application.Tests/Common/CorrelationIdValidatorTests.cs` (patch)

**Modified (backend):**
- `BackEnd/src/FlexDemy.Api/Program.cs` (rate limiter registration + `UseRateLimiter()`; patch: CORS policy now built via `FrontendCorsPolicy.Configure`)
- `BackEnd/src/FlexDemy.Api/Middleware/CorrelationIdMiddleware.cs` (patch: validation delegated to shared `CorrelationIdValidator`, behavior unchanged)
- `BackEnd/src/FlexDemy.Api/Controllers/ErrorReportingController.cs` (patch: validates `CorrelationId`, guards empty `Message`)
- `BackEnd/src/FlexDemy.Api/RateLimiting/ErrorReportingRateLimiterPolicy.cs` (patch: fixed window → sliding window)
- `BackEnd/tests/FlexDemy.Api.Tests/Controllers/ErrorReportingControllerTests.cs` (patch: malformed/oversized `CorrelationId`, empty `Message` tests)

## Change Log

- 2026-08-13: Story created via `bmad-create-story` — fourth of Epic 4's 7 stories, written as part of a full-epic write-then-implement batch. Status set to `ready-for-dev`.
- 2026-08-14: Implementation complete via `bmad-dev-story` — all 9 tasks done. Frontend: `httpClient.ts` shared request helper with correlation-ID capture (AD-7), `courseFileService.ts`/`courseDraftService.ts` migrated onto it (including `uploadThumbnail`, beyond the story's literal scope — see Completion Notes), `errorsService.ts`, `ErrorBoundary.tsx`, `globalErrorHandlers.ts`, all wired into `main.tsx`. Backend: anonymous `ErrorReportingController` (`UserId` via `ICurrentUserService`, not the story's literal ad hoc claim lookup — see Completion Notes), per-IP rate limiting via a new testable `ErrorReportingRateLimiterPolicy` class. Full regression: 548 frontend tests (11 new) + 809 backend tests (8 new), 0 failures. Status set to `review`.
- 2026-08-14: Adversarial code review via `bmad-code-review` (Blind Hunter, Edge Case Hunter, Acceptance Auditor) — Acceptance Auditor confirmed all 6 ACs correctly implemented with no violations; Blind Hunter and Edge Case Hunter together surfaced 6 patch-worthy findings, the most serious a confirmed CORS misconfiguration (`Program.cs` never called `.WithExposedHeaders("X-Correlation-Id")`) that silently defeated AC #6/FR-23's entire correlation-ID capture chain outside a same-origin setup. All 6 patches applied: CORS fix (+ new testable `FrontendCorsPolicy` class), fixed→sliding-window rate limiting, shared `CorrelationIdValidator` applied to the anonymous endpoint's body-field `CorrelationId`, an empty/whitespace-`Message` guard, a `response.json()` guard on `httpClient.ts`'s success path, and non-`Error`-throw coercion in `ErrorBoundary.tsx`. One Edge Case Hunter finding (uncaught `OperationCanceledException` in the controller) was verified as a false positive by reading `ErrorCaptureService`'s actual source — its outer `catch (Exception)` has no exclusion filter, so it never throws, confirmed by the NFR2 contract. 4 items deferred (logged to `deferred-work.md`): the correlation-ID store's "last response wins" semantics (literal AD-7 design), per-IP rate-limit-key collapse under NAT/proxy (needs a bigger `ForwardedHeadersMiddleware` decision), unsanitized-input-for-future-rendering (Story 4.5's concern once it exists), and error-storm dedup (no AC requires it). Full regression re-run: 550 frontend tests (+2) + 829 backend tests (+20), 0 failures. Status set to `done`.
