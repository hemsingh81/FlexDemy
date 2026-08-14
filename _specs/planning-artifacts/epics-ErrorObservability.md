---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - _specs/planning-artifacts/prds/prd-eLearning-ErrorObservability-2026-08-13/prd.md
  - _specs/planning-artifacts/prds/prd-eLearning-ErrorObservability-2026-08-13/addendum.md
  - _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md
  - _specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md
---

# Centralized Error Observability & Management - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Centralized Error Observability & Management, decomposing the PRD's 24 functional requirements and the two architecture spines' technical decisions (backend AD-23/AD-24, frontend AD-7) into implementable stories.

Scope note: this project already has an `epics.md` covering the New Course Wizard PRD's Epic 1-3 (in progress per `sprint-status.yaml`). This is a **separate, PRD-scoped breakdown** for the new Error Observability PRD, kept in its own file per user direction so the existing document and its downstream stories aren't disturbed. This becomes **Epic 4** in the project's overall numbering when folded into sprint planning.

No UX design contract exists for this PRD (no `bmad-ux` run) — the addendum's "Existing admin dashboard UI conventions" section (the AI Usage & Cost Dashboard as closest analog) is the visual/structural reference instead.

## Requirements Inventory

### Functional Requirements

FR-1: The system captures every exception that reaches the outermost request pipeline, whether or not it's an `AppException` subtype — producing exactly one new ErrorRecord without changing the existing API response, and a capture failure never blocks the original response.
FR-2: Every one of the 10 existing `AppException` subtypes is captured with its concrete type preserved in `ErrorRecord.ExceptionType`, not collapsed to a generic value.
FR-3: When any Hangfire job (the 4 existing jobs, or any added later) exhausts its retries, an ErrorRecord is created or an existing one's `OccurrenceCount` increments, in addition to — not instead of — the job's existing per-entity failure write; a job that eventually succeeds creates no ErrorRecord.
FR-4: Existing per-entity failure fields (`CourseFile.FailureReason`, `PublishBatchItem.ProgressText`) are unchanged in shape/behavior; the mirrored ErrorRecord carries `RelatedEntityType`/`RelatedEntityId` back to the originating record.
FR-5: Known-sensitive values are redacted before persistence — both from structured context (deny-listed field names) and from free-text `Message`/`StackTrace` content via a secret-shaped pattern scan.
FR-6: The frontend captures uncaught JS exceptions, unhandled promise rejections, and React render crashes anywhere in the app via one top-level Error Boundary plus `window.onerror`/`unhandledrejection` listeners, with no per-component opt-in required.
FR-7: `POST /api/v1/errors/client` (anonymous, no `[Authorize]`, rate-limited) accepts frontend-captured error reports and creates ErrorRecords with `Source = "Frontend"`; a failure to report never surfaces as a visible error to the user.
FR-8: A new `ErrorRecord` entity persists one row per distinct Fingerprint; a repeat occurrence increments `OccurrenceCount`/`LastOccurredAt` on the same row, or triggers Reopen if the existing record is `Resolved`/`Archived`.
FR-9: Every ErrorRecord is assigned exactly one primary Category from a fixed, deterministic mapping table (9 categories), plus an optional Background Job cross-cutting tag when applicable.
FR-10: Priority (P0-P3) is assigned in two phases — Phase A runs once on first occurrence (Critical Path/Category-based rules), Phase B runs only on repeat occurrence (spike-threshold escalation); Priority never auto-decreases.
FR-11: A Master admin sees a server-side-paginated table of ErrorRecords, newest-`LastOccurredAt`-first, with `Archived` excluded by default.
FR-12: An admin narrows the list by Category, Priority, Status, Source, a `LastOccurredAt` date range, and free-text search over Message/`ExceptionType`, with an explicit toggle to include `Archived`.
FR-13: An admin can open a single ErrorRecord to see the full untruncated `StackTrace`, `RequestPath`/`Route`, `OriginContext`, occurrence timeline, and a link to the related entity when `RelatedEntityType`/`RelatedEntityId` is set.
FR-14: An admin can Archive an ErrorRecord (`Status = "Archived"`, `ArchivedAt = now`) without deleting the row; recurrence triggers Reopen exactly like a Resolved record; only the retention policy (FR-18) permanently removes it.
FR-15: An admin can mark an ErrorRecord Resolved (`Status`, `ResolvedAt`, `ResolvedByUserId`); excluded from the default view but eligible for auto-Reopen.
FR-16: A `Resolved` or `Archived` ErrorRecord whose Fingerprint recurs automatically flips back to `New`, increments `OccurrenceCount`, preserves the most-recent-dismissal info (not a full history), and does not silently reset a previously-escalated Priority.
FR-17: An admin can manually escalate Priority one level at a time (disabled at P0), attributed/timestamped via `PriorityIncreasedAt`/`PriorityIncreasedByUserId`.
FR-18: An admin-configurable retention window (default 180 days) permanently purges old `Resolved`/`Archived` records; `New` records are never auto-purged; purges are logged (count + date range).
FR-19: A new `FeatureKeys.ErrorsManage` policy gates the admin controller (FR-11-FR-18, FR-24) and every write action on it; it does **not** gate FR-7's reporting endpoint; a non-Master user hitting the admin API directly gets 403.
FR-20: A new outermost middleware assigns a Correlation ID to every inbound HTTP request — reusing an incoming `X-Correlation-Id` header if present, otherwise generating a GUID — echoed back on the response.
FR-21: The enqueuing request's Correlation ID travels with each of the 4 Hangfire job enqueuers, so one course-file's full scan→parse→extract pipeline shares one ID across independently-running async steps.
FR-22: Every ErrorRecord captures the Correlation ID active at the moment of failure automatically, via FR-1/FR-3/FR-6/FR-7's existing capture paths — no extra per-call-site work.
FR-23: The frontend retains the Correlation ID from its most recent backend response and includes it when reporting an error (FR-7), when available.
FR-24: An admin can click a Correlation ID in the detail view (FR-13) to filter the list view (FR-11) to every ErrorRecord sharing it; FR-12's filter gains Correlation ID as an exact-match field.

### NonFunctional Requirements

NFR1 (Performance): error capture adds no more than ~50ms to p99 request latency and no more than ~200ms to a background job's total run time — no synchronous blocking write on the hot path of any request or job.
NFR2 (Reliability): the observability system must never itself become a source of outages — a failure inside error-capture code is caught and discarded, never propagated or allowed to recurse.
NFR3 (Scalability): the Admin Error Log's list view returns within ~2 seconds at up to ~100,000 stored ErrorRecords, via server-side pagination and appropriate indexing (`Fingerprint`, `Category`, `Priority`, `Status`, `LastOccurredAt`).
NFR4 (Security): error records must never contain plaintext secrets/API keys/tokens/passwords — redaction (structured and free-text) is mandatory before persistence; admin access is restricted to the Master role; the reporting endpoint (FR-7) is the one intentional anonymous exception.
NFR5 (Privacy): access is restricted to Master admins because stack traces/messages can incidentally contain user-identifying information; the redaction guardrail targets known-sensitive field names plus a starting free-text secret-pattern set, not a guarantee of removing all possible PII.

### Additional Requirements

- No starter template — brownfield extension of the existing ASP.NET Core 10 (C# 14, Clean Architecture/Onion) backend and React 19 + TypeScript + Vite frontend. New `ErrorObservability` feature folder mirrors the existing `Courses`/`Tutoring` shape. (Backend AD-6, extended)
- **Correlation ID propagation mechanism**: new `Application/Common/ICorrelationIdAccessor` (Application interface), `AsyncLocal<string?>`-backed Infrastructure implementation; new `CorrelationIdMiddleware` registered before `ExceptionHandlingMiddleware`. Each of the 4 Hangfire job enqueuers (`ScanFileJobEnqueuer`, `ParseFileJobEnqueuer`, `ExtractStructureJobEnqueuer`, `PublishNodeContentJobEnqueuer`) gains an explicit `correlationId` parameter forwarded into its `BackgroundJob.Enqueue` call; each job's `RunAsync` re-seeds the accessor as its first line, since `AsyncLocal` does not survive into a Hangfire job's separate execution context. `[ASSUMPTION: mints its own GUID rather than reusing HttpContext.TraceIdentifier — confirm before build.]` (Backend AD-23)
- **Centralized error capture**: one `Application/ErrorObservability/IErrorCaptureService.CaptureAsync(...)` owns fingerprinting (FR-8), categorization (FR-9), and priority assignment (FR-10); all 4 capture sites (global exception middleware, 4 job terminal-failure sites, frontend-reporting endpoint) call it — none reimplements the logic. Swallows its own failures per FR-1's NFR. (Backend AD-24)
- **Two-controller split**: anonymous `ErrorReportingController` (`POST /api/v1/errors/client`, no `[Authorize]`) and Master-gated `ErrorsController` (`[Authorize(Policy = FeatureKeys.ErrorsManage)]` at class level, FR-11-FR-18 + FR-24) — never merged into one controller, since a shared class-level policy would 403 FR-7's deliberately-anonymous callers. (Backend AD-24)
- **RBAC wiring**: add `ErrorsManage = "errors.manage"` to `FeatureKeys.AllKeys`; one Master-only seed row in `RolePermissionSeedData.cs`, matching the existing `AiConfigManage`/`AdminPermissionsManage` pattern.
- **ErrorRecord persistence**: new `Domain/ErrorObservability/ErrorRecord` entity (fields per PRD FR-8, including `CorrelationId`, `PriorityIncreasedAt`/`PriorityIncreasedByUserId`) + EF Core `IEntityTypeConfiguration<ErrorRecord>`, indexed on `Fingerprint`/`Category`/`Priority`/`Status`/`LastOccurredAt`.
- **Existing extension points**: the 10-subtype `AppException` taxonomy and `ExceptionHandlingMiddleware.cs` (no outer `catch(Exception)` today) are FR-1/FR-2's hook; the existing manual retry-count check (`context?.GetJobParameter<int?>("RetryCount")`) across `ScanFileJob`/`ParseFileJob`/`ExtractStructureJob`/`PublishNodeContentJob` is FR-3's hook — `ExtractStructureJob`/`PublishNodeContentJob`'s no-retry short-circuits (`AiTaskBudgetExceededException`, `AiResponseValidationException`) must also route into capture, not just the exhausted-retry path. No Serilog/structured logging exists today — this feature is the first durable error store in the backend.
- **Frontend Correlation ID capture**: new `services/httpClient.ts` shared low-level request helper (generalizing `courseDraftService.ts`'s `write<T>()` pattern) reads `X-Correlation-Id` off every response into a module-level store; `courseFileService.ts`'s duplicated per-function fetch pattern is retired as part of this feature so FR-23 doesn't silently work for only some services. (Frontend AD-7)
- **New frontend service**: `services/errorsService.ts` (FR-7), reads `httpClient.ts`'s current Correlation ID into its report payload.
- **New frontend admin surface**: `features/Admin/ErrorLog/` (FR-11-FR-13, FR-24), Master-only sub-tab wired through the existing `useAdminPanel.ts`/`ADMIN_SUBTAB_META` plug-in point, following the AI Usage & Cost Dashboard's `{ data, isLoading, error, filters }` hook shape and loading/error UI convention. First admin screen needing true server-side pagination — confirmed no pagination component exists anywhere in the frontend today, so this is new infrastructure, not reuse.
- **Global frontend error capture**: single top-level React Error Boundary plus `window.onerror`/`unhandledrejection` listeners registered once at `main.tsx` startup — confirmed net-new (zero existing `componentDidCatch`/`window.onerror`/`ErrorBoundary` anywhere in the codebase).
- Deferred, not in scope for this epic set: OpenTelemetry/W3C Trace Context adoption, bidirectional/full manual priority override, AI-assisted categorization for the Uncategorized bucket, alerting/notifications (v2), per-occurrence detailed audit trail.

### UX Design Requirements

No UX design contract exists for this PRD. The addendum's "Existing admin dashboard UI conventions" section is the reference: reuse the AI Usage & Cost Dashboard's hook shape and loading/error UI convention, and the existing status-pill component convention for Category/Priority/Status badges.

### FR Coverage Map

FR-1: Epic 4 - global unhandled-exception capture (outermost request pipeline)
FR-2: Epic 4 - `AppException` subtype capture, concrete type preserved
FR-3: Epic 4 - Hangfire job terminal-failure capture (4 existing jobs)
FR-4: Epic 4 - existing per-entity failure field mirroring (`CourseFile`, `PublishBatchItem`)
FR-5: Epic 4 - secret/PII redaction guardrail (structured + free-text)
FR-6: Epic 4 - frontend global error capture (Error Boundary + window.onerror/unhandledrejection)
FR-7: Epic 4 - anonymous error-reporting endpoint
FR-8: Epic 4 - ErrorRecord schema, fingerprinting, occurrence counting
FR-9: Epic 4 - rule-based category assignment
FR-10: Epic 4 - two-phase rule-based priority assignment
FR-11: Epic 4 - admin error list view (server-side paginated)
FR-12: Epic 4 - filtering and search
FR-13: Epic 4 - error detail view
FR-14: Epic 4 - Archive action
FR-15: Epic 4 - Mark as Resolved action
FR-16: Epic 4 - auto-Reopen on regression
FR-17: Epic 4 - Increase Priority action
FR-18: Epic 4 - retention/purge policy
FR-19: Epic 4 - Master-only RBAC
FR-20: Epic 4 - backend Correlation ID assignment
FR-21: Epic 4 - Correlation ID propagation into background jobs
FR-22: Epic 4 - ErrorRecord Correlation ID capture
FR-23: Epic 4 - frontend Correlation ID propagation
FR-24: Epic 4 - admin trace view

## Epic List

### Epic 4: Centralized Error Observability & Management
Admins can see every error the system produces — backend and frontend — in one durable, auto-categorized, auto-prioritized Admin Error Log, triage it (archive, resolve, escalate), and trace a single failure across its full request/job chain via Correlation ID.

**FRs covered:** FR-1 through FR-24 (all)
**NFRs covered:** NFR1-NFR5 (all)

**Implementation notes (from party-mode pressure-test, 2026-08-13):**
- Story order builds correlation-ID infrastructure (AD-23) and the centralized `IErrorCaptureService` (AD-24) first, and proves them before any capture site depends on them — the AsyncLocal-across-Hangfire propagation is the one genuinely unproven mechanism in this codebase, so it should fail fast and cheaply on its own rather than underneath everything else.
- The anonymous error-reporting endpoint (FR-7) and the Master-gated admin UI (FR-11-FR-13, FR-19) must ship in the same story or immediately adjacent stories — no released increment where the anonymous endpoint is live and writing ErrorRecords that nobody can yet view or triage.
- Backend-first ordering throughout (unlike Epic 1/2's mock-data-first UI convention) — the admin UI is wired directly against real data since the backend stories precede it, no mock-data story needed.

## Epic 4: Centralized Error Observability & Management

Admins can see every error the system produces — backend and frontend — in one durable, auto-categorized, auto-prioritized Admin Error Log, triage it (archive, resolve, escalate), and trace a single failure across its full request/job chain via Correlation ID. Backend-first execution order: Correlation ID infrastructure and the centralized capture service are built and proven before any capture site depends on them; the anonymous reporting endpoint and the Master-gated admin UI ship back-to-back with no released gap between them (party-mode review, 2026-08-13).

**FRs covered:** FR-1 through FR-24
**Also covers:** NFR1, NFR2, NFR3, NFR4, NFR5

### Story 4.1: Correlation ID Assignment and Propagation

As a platform engineer,
I want every request and its downstream background jobs to carry one shared Correlation ID,
So that a single user action's full failure chain can be traced together once error capture exists.

**Acceptance Criteria:**

**Given** a request with no `X-Correlation-Id` header
**When** it reaches the API
**Then** a new GUID is generated, set on `ICorrelationIdAccessor.Current`, and echoed back on the response as `X-Correlation-Id`

**Given** a request that already carries an `X-Correlation-Id` header
**When** it reaches the API
**Then** that value is reused as-is, not regenerated

**Given** `CorrelationIdMiddleware` and `ExceptionHandlingMiddleware` are both registered
**When** an exception occurs anywhere downstream
**Then** `CorrelationIdMiddleware` has already run (registered first in the pipeline), so `ICorrelationIdAccessor.Current` is already set at the moment the exception is caught

**Given** a request enqueues `ScanFileJob`, `ParseFileJob`, `ExtractStructureJob`, or `PublishNodeContentJob`
**When** the job is enqueued
**Then** the current Correlation ID is read from the accessor and passed as an explicit argument to `BackgroundJob.Enqueue<IXJob>(...)`

**Given** a Hangfire job runs with a `correlationId` argument
**When** `RunAsync` begins
**Then** it calls `ICorrelationIdAccessor.Set(correlationId)` as its first action, so the same ID is available to the rest of that job's execution
**And** this holds even though the job runs on a separate thread with no relationship to the enqueuing request's async-flow context

**Given** a job enqueued with no available Correlation ID (e.g. a future scheduled/recurring job with no originating request)
**When** it runs
**Then** it proceeds with a `null` Correlation ID rather than failing

### Story 4.2: ErrorRecord Data Model and Centralized Capture Service

As a platform engineer,
I want one `ErrorRecord` entity and one `IErrorCaptureService` that owns fingerprinting, categorization, and priority assignment,
So that every future capture site shares the same dedup/categorize/prioritize logic instead of reimplementing it.

**Acceptance Criteria:**

**Given** `IErrorCaptureService.CaptureAsync(request)` is called with an exception's type/message/stack/origin
**When** the resulting Fingerprint (exception type + normalized message + origin) does not yet exist
**Then** a new `ErrorRecord` is created with `OccurrenceCount = 1`, `FirstOccurredAt`/`LastOccurredAt = now`, `Category` assigned per the FR-9 mapping table, `Priority` assigned per FR-10 Phase A, and `CorrelationId` populated from `ICorrelationIdAccessor.Current`

**Given** the same Fingerprint occurs again on an existing, non-`Archived`, non-`Resolved` record
**When** `CaptureAsync` runs
**Then** `OccurrenceCount` increments and `LastOccurredAt` updates on the same row, not a new one
**And** Phase B's spike-threshold check runs and escalates Priority to P1 if it crosses the threshold while at P2/P3

**Given** an existing `ErrorRecord` with `Status = Resolved` or `Status = Archived`
**When** its Fingerprint recurs
**Then** `CaptureAsync` flips `Status` back to `New`, increments `OccurrenceCount`, updates `LastOccurredAt`, and does **not** reset `Priority` — even if it was previously manually increased

**Given** a captured value under a deny-listed field name (`Authorization`, `ApiKey`, `Password`, `Token`, case-insensitive) or matching a secret-shaped free-text pattern (Bearer tokens, `gsk_`/`sk_`/`AIza`-style prefixes, `Password=`/`Pwd=` connection-string segments)
**When** it appears anywhere in the captured `Message`, `StackTrace`, or structured context
**Then** that value is replaced with `"[REDACTED]"` before the row is persisted

**Given** `CaptureAsync` itself fails (e.g. a database write error)
**When** that happens
**Then** the failure is swallowed inside `IErrorCaptureService` and never propagates back to the caller

**Given** `CaptureAsync` is invoked from a request or job's hot path (NFR1)
**When** it runs
**Then** it does not add more than ~50ms to p99 request latency or ~200ms to a background job's total run time — no synchronous blocking database write sits on the caller's critical path

**Given** the `ErrorRecord` table
**When** the future admin list view queries it
**Then** it is indexed on `Fingerprint`, `Category`, `Priority`, `Status`, and `LastOccurredAt`

### Story 4.3: Backend Error Capture Wiring

As a platform engineer,
I want the global exception middleware and all 4 Hangfire jobs' terminal failures to call the capture service,
So that no backend error — unhandled exception, `AppException`, or exhausted-retry job failure — goes unrecorded.

**Acceptance Criteria:**

**Given** a non-`AppException` exception (e.g. `NullReferenceException`) reaches the outermost request pipeline
**When** `ExceptionHandlingMiddleware` catches it
**Then** it still returns the existing catch-all 500 `ProblemDetails` response, unchanged
**And** it also calls `IErrorCaptureService.CaptureAsync` exactly once

**Given** any of the 10 existing `AppException` subtypes reaches the middleware
**When** caught
**Then** it still returns its existing mapped status code, unchanged
**And** `CaptureAsync` is called with `ExceptionType` set to the concrete subtype's class name (e.g. `"ValidationException"`), not a generic value

**Given** `ScanFileJob`, `ParseFileJob`, `ExtractStructureJob`, or `PublishNodeContentJob` exhausts its configured retries, or short-circuits early via `AiTaskBudgetExceededException`/`AiResponseValidationException`
**When** it writes its terminal `Failed` status to `CourseFile`/`PublishBatchItem`
**Then** `CaptureAsync` is also called, with `RelatedEntityType`/`RelatedEntityId` set to the originating record and `Category` tagged `Background Job Error` alongside the underlying-cause category

**Given** a job retry that eventually succeeds
**When** that happens
**Then** `CaptureAsync` is never called for that job's execution

**Given** `CourseFile.FailureReason` / `PublishBatchItem.ProgressText`
**When** a job fails
**Then** they are written exactly as they are today — this feature adds a mirrored `ErrorRecord`, it does not change either existing field's shape or behavior

### Story 4.4: Frontend Global Error Capture and Reporting Endpoint

As a platform engineer,
I want every uncaught frontend error — render crash, unhandled rejection, or raw exception — automatically reported to the backend,
So that frontend failures stop vanishing silently the moment a user's tab closes.

**Acceptance Criteria:**

**Given** any component throws during render
**When** that happens
**Then** a single top-level React Error Boundary (mounted in `main.tsx`) catches it, shows a graceful fallback UI instead of a blank screen, and reports it

**Given** a rejected Promise with no `.catch()`, or a raw exception outside React's render cycle (e.g. inside `setTimeout` or a raw event handler)
**When** that happens
**Then** `window.addEventListener('unhandledrejection'/'error', ...)` listeners, registered once at app startup, catch and report it

**Given** any of these three capture paths fires
**When** it does
**Then** `errorsService.ts` calls `POST /api/v1/errors/client` with `{ message, stack?, url, userAgent, timestamp }`
**And** that call never itself surfaces a visible error to the user, even if the report fails

**Given** the request carries a valid auth token
**When** `ErrorReportingController` receives it
**Then** the resulting `ErrorRecord`'s `UserId` is populated
**Given** no valid token (e.g. a crash on the login screen itself)
**When** the report is received
**Then** `UserId` is `null` and the record is still created — `ErrorReportingController` carries no `[Authorize]` attribute at all

**Given** more than 30 requests/minute from one source IP
**When** the limit is exceeded
**Then** further requests return 204, not 429 — no visible error from the error-reporting endpoint itself

**Given** `services/httpClient.ts` receives a response carrying an `X-Correlation-Id` header
**When** that happens
**Then** the module-level store is updated with that value
**Given** `errorsService.ts` sends a report
**When** the store holds a current value
**Then** the report payload includes it

### Story 4.5: Admin Error Log — List, Filter, and Detail

As a Master admin,
I want to see every captured error in one server-side-paginated, filterable list with a detail view,
So that I can find and investigate real problems without reading container logs by hand.

**Acceptance Criteria:**

**Given** a new `FeatureKeys.ErrorsManage` policy seeded Master-only
**When** a non-Master user calls the admin API directly
**Then** they receive 403, not just a hidden menu item
**Given** a Master admin
**When** they open the Admin panel
**Then** a new "Error Log" sub-tab is visible (wired through `useAdminPanel.ts`/`ADMIN_SUBTAB_META`), absent for every other role

**Given** `ErrorsController`'s list endpoint
**When** called with no filters
**Then** it returns a server-side-paginated page of ErrorRecords newest-`LastOccurredAt`-first, each row showing Category, Priority (color-coded badge), Status, truncated Message, Source, OccurrenceCount, and LastOccurredAt
**And** `Archived` records are excluded by default

**Given** Category, Priority, Status, Source, date-range, and free-text filters
**When** combined (e.g. Category = External Integration Error AND Priority = P0/P1)
**Then** results match all active filters simultaneously
**Given** the "include Archived" toggle, default off
**When** turned on
**Then** `Archived` records appear in the results too

**Given** a single ErrorRecord's detail view
**When** opened
**Then** it shows the full untruncated `StackTrace`, `RequestPath`/`Route`, `OriginContext`, and the occurrence timeline (`FirstOccurredAt`/`LastOccurredAt`/`OccurrenceCount`)
**And** when `RelatedEntityType`/`RelatedEntityId` is set, a link back to the originating record is shown

**Given** Story 4.4's reporting endpoint has already been live
**When** this story ships
**Then** any ErrorRecords it already produced — including frontend crashes — are immediately visible in this list, closing the visibility gap flagged in the party-mode review

### Story 4.6: Error Lifecycle Actions

As a Master admin,
I want to archive, resolve, and escalate errors, with automatic reopening if they recur,
So that I can triage my active queue down to what still needs attention without losing the history.

**Acceptance Criteria:**

**Given** an active ErrorRecord
**When** an admin clicks Archive
**Then** `Status` becomes `Archived`, `ArchivedAt` is set to now, and it drops out of the default list view without being deleted from the database

**Given** an active ErrorRecord
**When** an admin clicks Mark as Resolved
**Then** `Status` becomes `Resolved`, `ResolvedAt`/`ResolvedByUserId` are set, and it drops out of the default view but remains visible via the "include historical" filter

**Given** a `Resolved` or `Archived` record's Fingerprint recurs (auto-Reopen logic already implemented in Story 4.2)
**When** an admin next views the list
**Then** it shows `Status = New`, incremented `OccurrenceCount`, and unchanged Priority even if it was previously manually increased

**Given** an ErrorRecord not already at P0
**When** an admin clicks Increase Priority
**Then** Priority moves exactly one step toward P0, and `PriorityIncreasedAt`/`PriorityIncreasedByUserId` are set to the acting admin and now
**Given** an ErrorRecord already at P0
**When** an admin views it
**Then** the Increase Priority action is disabled

**Given** an admin-configured retention window (default 180 days)
**When** a scheduled purge runs
**Then** `Resolved`/`Archived` records older than the window are permanently deleted, and the purge (count + date range) is logged
**Given** a `New` record of any age
**When** the purge runs
**Then** it is never auto-purged

### Story 4.7: Correlation ID Trace View

As a Master admin,
I want to click a Correlation ID and see every other error it produced,
So that I can see one user action's full failure chain — e.g. a single upload's scan→parse→extract failures — in one place instead of hunting for them individually.

**Acceptance Criteria:**

**Given** an ErrorRecord's detail view shows a non-null Correlation ID
**When** the admin clicks it
**Then** the list view filters to show only ErrorRecords sharing that exact Correlation ID

**Given** FR-12's filter panel
**When** a Correlation ID is entered directly
**Then** it filters by exact match, not substring

**Given** a course-file upload whose scan/parse/extract pipeline produced 3 separate ErrorRecords sharing one Correlation ID (per Story 4.1's job propagation)
**When** an admin opens any one of them and clicks its Correlation ID
**Then** all 3 appear together in the filtered list
