# Addendum: Centralized Error Observability & Management

Technical-how grounding for downstream architecture/story work. Not part of the PRD's capability-level narrative — kept here per this skill's own discipline (technical choices/mechanism decisions belong in the addendum, not the PRD body). Sourced from a live codebase survey conducted during this PRD's discovery, 2026-08-13.

## Corrections Made During Review (2026-08-13)

The first draft went through a rubric-walker pass and an adversarial pass in parallel. Both independently landed on the FR-7/FR-19 conflict below; everything else came from the adversarial pass. All five are already reflected in `prd.md`'s current FR text — this section is the *why*, kept out of the PRD body so each FR states only the final, corrected requirement.

1. **FR-7 vs. FR-19 (endpoint auth conflict).** The first draft never said which controller FR-7's error-reporting endpoint lived on. FR-19's Master-only `[Authorize]` policy is class-level on the admin controller — if FR-7 shared that controller, the one capture path this whole feature exists to guarantee (an unauthenticated user's crash, e.g. on the login screen) would 403 silently. Fixed by putting FR-7 on its own controller, no `[Authorize]` at all, protected by a rate limit instead of auth (see "RBAC wiring steps" below).

2. **FR-10 (priority rules referenced states that couldn't exist yet).** The first draft's priority rules checked "is this Fingerprint *recurring*" and "has occurrence frequency *spiked*" — both structurally impossible to evaluate on an error's first-ever occurrence, since there's no prior occurrence to compare against. Those branches could never fire under their own stated trigger. Fixed by splitting into **Phase A** (runs once, first occurrence only — Critical Path, category, background-job checks) and **Phase B** (runs only on repeat occurrences — the frequency-spike escalation).

3. **FR-5 (redaction only covered structured fields).** The first draft's redaction guardrail only caught a secret sitting under a recognized field name (`"ApiKey": "..."`). It missed the more common real leak shape — a secret sitting inline in a plain sentence, like an exception message that says `"Invalid API key: gsk_abc123"` (a realistic shape: this repo's own `AiGatewayException` messages already read like `"No API key configured for AI provider 'Groq'"`, and a future edit adding the actual key value for debuggability is exactly the kind of change that leaks it). Fixed by adding a second, independent redaction pass that scans free-text `Message`/`StackTrace` content for secret-shaped patterns, not just structured field names.

4. **FR-8/FR-14 (Archive broke Fingerprint uniqueness).** The first draft special-cased Archive to spawn a *new* ErrorRecord when an archived Fingerprint recurred, rather than reopening the existing one the way Resolve does. That split one real recurring failure across two disconnected records with nothing linking them — directly undermining FR-8's own stated purpose ("one row per distinct Fingerprint"). Fixed by making Archive behave exactly like Resolve on recurrence: both reopen (FR-16), because Archive is a stronger *dismissal signal*, not a stronger claim that the Fingerprint is gone for good.

5. **FR-16/FR-17 (claimed audit fields the data model didn't have).** FR-17 requires priority increases to be "attributed and timestamped," and the first draft's FR-16 said Reopen preserves resolution info "as historical record of the prior resolution attempt" — but FR-8's schema had no field to hold a priority-increase's attribution, and `ResolvedAt`/`ResolvedByUserId` are single nullable fields, not a log, so a second resolve-then-reopen cycle silently overwrites the first cycle's values. Fixed two ways: added `PriorityIncreasedAt`/`PriorityIncreasedByUserId` to FR-8's schema (small, real gap — one migration, not a redesign), and corrected FR-16's wording to say "most recent dismissal only," matching the honest scope of a single-slot field rather than promising a history the design doesn't have (a full history is explicitly out of scope for v1, per the PRD's own Non-Goals).

## Existing `AppException` taxonomy (verbatim, for FR-2/FR-9's mapping table)

`BackEnd/src/FlexDemy.Application/Common/AppException.cs` — abstract base, all subtypes `sealed`, all in this one file:

| Subtype | HTTP mapping (existing) | Real throw sites |
|---|---|---|
| `NotFoundException(entityName, id)` | 404 | 21 files — heaviest: `CourseService.cs` (12), `ContentTreeService.cs` (10) |
| `ValidationException(message)` | 400 | 21 files — heaviest: `CourseService.cs` (15), `ProfileService.cs` (12) |
| `ConflictException(message)` | 409 | `TagService.cs`, `UserService.cs` |
| `UnauthorizedAppException(message)` | 401 | `CourseService.cs`, `UserService.cs` |
| `AiGatewayException(message)` | 502 | `Infrastructure/AiGateway/PortkeyAiGateway.cs` only |
| `AiResponseValidationException(message)` | 502 | `AdaptiveLearningService.cs`, `ExerciseService.cs`, `KeywordDefinitionService.cs` |
| `AiTaskUnavailableException(taskId, inner?)` | 503 | `Application/AiGateway/AiTaskGateway.cs` only |
| `AiTaskBudgetExceededException(taskId)` | 429 | `AiTaskGateway.cs` only |
| `DocumentParsingUnavailableException(message, inner?)` | **none — never reaches middleware** | `Infrastructure/Parsing/DoclingParsingClient.cs`, caught inside `ParseFileJob` only |
| `FileScanUnavailableException(message, inner?)` | **none — never reaches middleware** | `Infrastructure/Scanning/ClamAvFileScanner.cs`, caught inside `ScanFileJob` only |

`ExceptionHandlingMiddleware.cs` (full, for reference — FR-1/FR-2's extension point):

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
        // NOTE: no outer catch(Exception) -- a non-AppException exception is NOT caught here at
        // all today. FR-1 needs a new outer boundary (either a second middleware wrapping this
        // one, or extending this catch block's pattern match to `catch (Exception ex)` with an
        // `AppException` sub-branch inside it) -- decide the exact mechanism at architecture time.
    }
}
```

No Serilog / structured logging / external sink anywhere in the repo (confirmed via repo-wide grep). `appsettings.json`'s `Logging` section is the stock ASP.NET Core default (`Default: Information`, `Microsoft.AspNetCore: Warning`). `logger.LogWarning(...)` in the snippet above is the *only* place in the entire backend that logs an exception today.

## Existing per-entity failure fields (FR-4's mirror targets)

- **`CourseFile`** (`BackEnd/src/FlexDemy.Domain/Courses/CourseFile.cs`): `Status: JobItemStatus` (`Queued, Parsing, Extracting, Done, Failed`), `FailureReason: string?` (max length 1024, per existing `HasMaxLength(1024)` config — real precedent for ErrorRecord's own truncation length).
- **`PublishBatchItem`** (`BackEnd/src/FlexDemy.Domain/AdaptiveLearning/PublishBatchItem.cs`): `Status: PublishItemStatus` (`Queued, InProgress, Done, Failed`), `ProgressText: string?` (doubles as both live-progress message and terminal failure message — no dedicated failure field), `DecrementCommitted: bool`.

No other Domain entity has its own status/failure-reason pair.

## Hangfire job retry-exhaustion pattern (FR-3's hook point)

4 jobs in `BackEnd/src/FlexDemy.Infrastructure/Jobs/`: `ScanFileJob.cs`, `ParseFileJob.cs`, `ExtractStructureJob.cs`, `PublishNodeContentJob.cs`. All `MaxAttempts = 5`. Retry-exhaustion detection is manual (Hangfire has no built-in "on final failure" hook these use) — each job reads `context?.GetJobParameter<int?>("RetryCount") ?? 0`, compares to `MaxAttempts - 1`, and either re-throws (`throw;`, letting Hangfire retry) or falls through to write the terminal failure state. Representative pattern (`ScanFileJob.cs`):

```csharp
var retryCount = context?.GetJobParameter<int?>("RetryCount") ?? 0;
if (retryCount < MaxAttempts - 1)
    throw; // propagate uncaught -- triggers Hangfire's automatic retry

courseFile.Status = JobItemStatus.Failed;
courseFile.FailureReason = Truncate(...);
await unitOfWork.SaveChangesAsync(cancellationToken);
// FR-3's new ErrorRecord write belongs right here, alongside this existing terminal write.
```

`ExtractStructureJob.cs` and `PublishNodeContentJob.cs` both additionally have a no-retry short-circuit for `AiTaskBudgetExceededException` (retrying can't un-exceed a budget) and, for the latter, `AiResponseValidationException` too — both go straight to terminal `Failed` without exhausting the full 5 attempts. Any FR-3 implementation needs to hook both the "exhausted after N attempts" path AND these early-terminal paths, not just the retry-count check.

No Hangfire Dashboard is mounted (`Program.cs` comment: `// No Hangfire Dashboard mapped -- it has no auth story yet and isn't required by any AC.`) — nothing to integrate with there.

## RBAC wiring steps (FR-19, exact mechanical steps)

Two controllers, one policy applied to only one of them — see "Corrections Made During Review" (#1) above for why:

1. Add `ErrorsManage = "errors.manage"` to `BackEnd/src/FlexDemy.Application/Permissions/FeatureKeys.cs`'s `AllKeys` list.
2. Add one Master-only seed row to `BackEnd/src/FlexDemy.Api/SeedData/RolePermissionSeedData.cs`: `seeds.Add(new RolePermissionSeed(UserRole.Master, FeatureKeys.ErrorsManage, true));`
3. **Admin controller** (FR-11–FR-18: list/filter/detail/Archive/Resolve/Increase-Priority/retention-policy config; plus FR-24's trace-view filter, added 2026-08-13): `[Authorize(Policy = FeatureKeys.ErrorsManage)]` at class level, mirroring `AiConfigController.cs`/`AiUsageController.cs` exactly (both are the closest existing analog — a paired config+usage-style admin surface under one policy).
4. **Reporting controller** (FR-7, `POST /api/v1/errors/client` only): no `[Authorize]` attribute at all — deliberately anonymous, protected instead by the per-IP rate limit (FR-7's own consequence) rather than authentication.
5. The system is fail-closed by design — no explicit `false` seed rows needed for other roles on the admin controller; the reporting controller is intentionally outside the policy system entirely, not "fail-closed to everyone" — that's the point of it.

## Frontend admin-nav plug-in point (FR-11's menu placement)

`FrontEnd/src/features/Admin/useAdminPanel.ts`:
```ts
export type AdminSubTab =
  | 'masterdata' | 'support-users' | 'role-visibility'
  | 'tutor-approvals' | 'ai-configuration' | 'tag-management';
// add: | 'errors'

export const ADMIN_SUBTAB_META: Record<AdminSubTab, { label: string; icon: ComponentType<...> }> = {
  ...
  // add: errors: { label: 'Error Log', icon: AlertTriangle },
};

const availableSubTabs = useMemo<AdminSubTab[]>(() => {
  if (user?.role === 'Master') return ALL_SUB_TABS; // 'errors' included here
  if (user?.role === 'Support') return ['tutor-approvals', 'tag-management']; // 'errors' NOT added here
  return [];
}, [user?.role]);
```
`AdminPanel.tsx` renders the active sub-tab via a conditional list; `FrontEnd/src/ui/Navbar.tsx` renders the same `ADMIN_SUBTAB_META` for desktop + mobile nav, sharing `activeSubTab` state lifted to `App.tsx`. Client-side role gating here is explicitly UX-only — the real enforcement is the backend policy (FR-19).

## Frontend service pattern (FR-7's client-side shape)

Every real (non-mock) frontend service in `FrontEnd/src/services/*.ts` follows: a custom `Error` subclass (`export class XError extends Error {}`) plus a shared `write()`/`request()` helper that reads the RFC7807 `problem.detail` field from a failed response. `courseDraftService.ts`'s shared `write<T>()` helper is the more mature version of this pattern (vs. `courseFileService.ts`'s per-function duplication) — model the new `errorsService.ts` on `courseDraftService.ts`'s shape.

**Confirmed absent, zero matches repo-wide:** `componentDidCatch`, `window.onerror`, `unhandledrejection`, any `ErrorBoundary` component. FR-6 is genuinely new infrastructure.

## Existing admin dashboard UI conventions to reuse for visual/structural consistency (FR-11/FR-12/FR-13)

Closest analog: the AI Usage & Cost Dashboard, `FrontEnd/src/features/Admin/AiConfiguration/` (`AiConfiguration.tsx`, `useAiUsage.ts`, `AiUsageDateRangeControl.tsx`, `AiUsageSummary.tsx`, `AiUsageChart.tsx`). Hook shape: `{ data, isLoading, error, dateRange, setDateRange }`, fetched in a `useEffect` keyed on filter state with a `cancelled` guard against stale responses. Loading/error UI convention:
```tsx
{isLoading ? <Spinner size="lg" /> : error ? <p role="alert" className="text-xs font-semibold text-red-600">{error}</p> : <Content />}
```
Status-pill convention (`AdminUserStatusList.tsx`):
```tsx
<button className={`px-2.5 py-1 rounded-full text-[10px] font-bold ... ${isActive ? 'bg-[#179765]/15 text-[#179765]' : 'bg-red-100 text-red-600'}`}>
```

**Confirmed: no pagination component exists anywhere in the frontend** (zero matches for `Pagination|totalPages|pageSize` repo-wide). Every existing admin list fetches its full result set and filters/searches client-side (e.g. `TagManagement.tsx`'s 250ms-debounced client-side filter). The Admin Error Log (FR-11) is the first screen in the app needing true server-side pagination — build it as new infrastructure, don't look for an existing component to reuse.

## Correlation ID: existing state and wiring points (FR-20–FR-24, added 2026-08-13)

Confirmed absent, zero matches repo-wide: `Correlation`, `TraceIdentifier`, `X-Request-Id`, `traceparent`. Net-new, same as FR-6's frontend capture.

**Middleware ordering (`BackEnd/src/FlexDemy.Api/Program.cs`):** current pipeline is `UseCors` → `UseMiddleware<ExceptionHandlingMiddleware>()` (line 115) → `UseHttpsRedirection` → `UseStaticFiles` → `UseAuthentication` → `UseAuthorization` → (later) `UseHangfireServer`. FR-20's new correlation middleware must be registered *before* `ExceptionHandlingMiddleware`, not after — otherwise an exception caught by that middleware would have no Correlation ID yet to attach to its ErrorRecord (FR-1/FR-22).

**Job enqueuer shape (FR-21's hook point):** all 4 are thin wrappers with an identical shape, e.g. `ScanFileJobEnqueuer.cs`:
```csharp
BackgroundJob.Enqueue<IScanFileJob>(j => j.RunAsync(courseFileId, CancellationToken.None, null));
```
(`ParseFileJobEnqueuer`, `ExtractStructureJobEnqueuer`, `PublishNodeContentJobEnqueuer` are the same pattern, differing only in job type and id parameter.) Adding Correlation ID propagation means: (1) each `I{X}JobEnqueuer` interface gains a `correlationId` parameter, (2) each enqueuer forwards it into the `BackgroundJob.Enqueue<...>` call as a new job argument, (3) each job's `RunAsync` signature gains a matching parameter it can read inside the job body. This touches all 4 enqueuer interfaces, all 4 enqueuer implementations, and all 4 job classes — a mechanical but not small change, worth sizing explicitly at architecture/story time.

**Candidate mechanism `[ASSUMPTION]`:** ASP.NET Core's built-in `HttpContext.TraceIdentifier` is a plausible source for the Correlation ID value itself (avoids minting a second GUID per request) — but it is not currently read or surfaced anywhere in this codebase, and using it ties the "correlation ID" concept to a framework-internal value that also serves other purposes (e.g. `W3CTraceId` if that provider is ever enabled). Confirm at architecture time whether to reuse it or mint a dedicated value scoped only to this feature.

## Research-grounded design decisions (sources)

- Rollbar (fixed severity scale, item-level lifecycle): https://docs.rollbar.com/docs/item-levels
- Bugsnag (handled-vs-unhandled severity default): https://docs.bugsnag.com/product/severity-indicator/
- PagerDuty (written, objective severity criteria over subjective judgment): https://response.pagerduty.com/before/severity_levels/
- Datadog (issue states / lifecycle model informing New/Resolved/Archived + Reopen): https://docs.datadoghq.com/error_tracking/issue_states/
- Datadog (regression detection — direct source for FR-16's auto-Reopen behavior): https://docs.datadoghq.com/error_tracking/regression_detection/
- Rollbar / Sentry data retention precedent (informing FR-18's 180-day default assumption): https://docs.rollbar.com/docs/data-retention, https://sentry.zendesk.com/hc/en-us/articles/27118913621019-How-Long-Are-Errors-Events-Stored-in-Sentry
- Sentry issue grouping (fingerprinting model behind FR-8): https://getsentry-sentry.mintlify.app/features/issue-grouping
- Sentry triage workflow (behind the Archive-not-Delete recommendation, FR-14): https://blog.sentry.io/2019/02/07/sentry-workflow-triage/
