---
title: Centralized Error Observability & Management
status: final
created: 2026-08-13
updated: 2026-08-13
---

# PRD: Centralized Error Observability & Management

## 0. Document Purpose

This PRD scopes a new capability for the FlexDemy platform: a durable, queryable, admin-facing record of every error the system produces — backend and frontend — so that no failure goes unseen. It is written for the engineer(s) who will design and build this (backend architecture, frontend UI, data model) and for the Master-role admins who will use it day to day. It builds directly on the existing backend architecture (`ARCHITECTURE-SPINE.md`'s AD-1 through AD-22 conventions — Clean Architecture layering, `AppException` taxonomy, Hangfire job pattern, `FeatureKeys`/role-permission RBAC, feature-folder frontend organization) rather than introducing new architectural patterns; where this PRD references an existing convention it names it, and the exact file-level grounding (real exception types, real job classes, real RBAC wiring steps) lives in this workspace's `addendum.md`, not duplicated here. FRs are numbered globally (FR-1 through FR-24); §3 Glossary terms are used verbatim throughout.

## 1. Vision

Today, when something breaks in FlexDemy — an unhandled exception, a background job that exhausts its retries, a self-hosted dependency (document parsing, AI gateway) going down, a frontend crash — the only trace is a line in a container's stdout log, if that. There is no persistent store, no admin-facing view, and two specific exception types (`DocumentParsingUnavailableException`, `FileScanUnavailableException`) are never logged anywhere at all outside a single entity's own status field. Frontend runtime errors have no capture mechanism whatsoever today — a crash simply happens and vanishes. This was confirmed directly: diagnosing a real production issue this session required manually reading Docker container logs by hand, because no other option existed.

Centralized Error Observability closes this gap. Every error the system produces — regardless of where it originates — lands in one durable, queryable store, auto-categorized and auto-prioritized without waiting on a human to notice or classify it first. A new Admin-only "Error Log" screen lets a Master-role admin see everything happening across the system in one place: what broke, how often, how severe, and what to do about it. Admins triage from there — archive noise, mark real issues resolved, escalate priority on anything the automatic assignment under-called — instead of grepping logs after a user complains.

This is deliberately scoped as an internal operations tool, not a full APM/tracing platform. It replaces "nothing" with "a working error log," not with commercial-grade distributed tracing.

## 2. Target User

### 2.1 Jobs To Be Done

- As the person responsible for keeping FlexDemy running, I need to see every failure across the system in one place, so I can find and fix real problems before a student or tutor has to report them.
- As that same person, I need failures ranked by how bad they are without having to read every single one first, so I can spend my limited attention on what actually matters.
- As that same person, when I've fixed something, I need a way to clear it out of my active queue without permanently losing the record — in case it comes back.

### 2.2 Non-Users (v1)

This is a single-operator-role tool for v1: **Master** admins only (§2.3 of the access-control decision, FR-19). Support-role staff, tutors, and students are not users of this feature in v1 — they may be the ones *affected by* the errors it captures, but they don't see this screen.

### 2.3 Key User Journeys

*Single-operator-role tool — journeys are kept light per the PRD's own scope dial guidance. One representative journey, JTBD-restated form for the rest.*

- **UJ-1. An admin triages after a rough morning.**
  - **Persona + context:** A Master admin, already authenticated, opens the app after seeing a spike in support messages about course uploads failing.
  - **Entry state:** Logged in, on the Admin panel.
  - **Path:** Clicks the new "Error Log" menu item. Filters by Category = "External Integration Error" and Priority = P0/P1. Sees 14 occurrences of the same fingerprint — the document-parsing service was down for 40 minutes — already P1 from the moment it first occurred (a Background Job Error is at least P1 on sight, FR-10 Phase A).
  - **Climax:** Opens the error's detail view, sees the full exception chain and every affected course-file, confirms the parsing service is back up now, and marks it Resolved.
  - **Resolution:** The error drops out of the active queue. If the same fingerprint recurs later, it reopens automatically (FR-16) — the admin doesn't have to remember to check.
  - **Edge case:** A different, genuinely new error shows up during the same session, auto-tagged P0 (unhandled exception in the course-publish critical path). The admin bumps nothing — it's already at the ceiling — and jumps straight to it instead, because priority did the triage-ordering work for them.

## 3. Glossary

- **ErrorRecord** — A single persisted row representing one *kind* of error (see Fingerprint). The unit everything else in this PRD (Category, Priority, Status, Occurrence) attaches to.
- **Source** — Where an ErrorRecord originated: `Backend` or `Frontend`.
- **Category** — A rule-assigned classification of an ErrorRecord's failure mode (FR-9). One of a fixed, product-defined set (§4.4).
- **Priority** — A rule-assigned severity ranking, P0 (highest) through P3 (lowest) (FR-10). Auto-assigned on first occurrence; an admin may manually increase it (never auto-decreased by the system).
- **Status** — An ErrorRecord's lifecycle state: `New`, `Resolved`, or `Archived` (§4.7). Distinct from Priority — Status tracks triage progress, Priority tracks severity.
- **Fingerprint** — A deterministic hash (exception type + normalized message + origin location) used to group repeated occurrences of the *same underlying failure* into one ErrorRecord instead of one row per occurrence (FR-8).
- **Occurrence** — One instance of a Fingerprint happening. An ErrorRecord tracks `OccurrenceCount`, `FirstOccurredAt`, and `LastOccurredAt` rather than storing a full row per occurrence in v1 (§6.2).
- **Correlation ID** — A stable identifier generated once per originating user action (an inbound HTTP request, or the request that kicks off an asynchronous background-job chain) and propagated through every downstream step of that action — including retries and any Hangfire jobs it enqueues — so every ErrorRecord produced while handling it can be traced back to the same originating action (FR-20–FR-24). Distinct from Fingerprint: Fingerprint groups occurrences of the *same kind* of failure across many unrelated requests; Correlation ID groups every event, of any kind, produced by *one specific* request or job chain.
- **Reopen** — The automatic transition of a `Resolved` or `Archived` ErrorRecord back to `New` when its Fingerprint occurs again (FR-16) — FlexDemy's term for what the error-tracking industry calls regression detection. Applies uniformly to both dismissal states so Fingerprint uniqueness (FR-8) never splits across two records regardless of how the prior occurrence was dismissed.
- **Retention Policy** — An admin-configurable rule that permanently purges `Archived`/`Resolved` ErrorRecords older than a set number of days (FR-18) — the only path to permanent deletion in v1 (no per-record hard delete).
- **Critical Path** — A named, extensible set of system flows whose failures are treated as maximum severity regardless of other signals. Starting set for v1: Authentication (login/register) and Course Publish. `[ASSUMPTION: this starting list may be incomplete — confirm before build; the real code doesn't currently mark any flow as "critical," so this is a new concept this PRD introduces.]`

## 4. Features

### 4.1 Backend Error Capture

**Description:** Every error a backend request or background job produces is captured into the central ErrorRecord store, closing the specific gaps confirmed to exist today: unhandled non-`AppException` exceptions currently bubble past `ExceptionHandlingMiddleware` uncaught; `DocumentParsingUnavailableException`/`FileScanUnavailableException` are caught inside their jobs but never logged anywhere; and the four existing Hangfire jobs (`ScanFileJob`, `ParseFileJob`, `ExtractStructureJob`, `PublishNodeContentJob`) only ever write their terminal failure into their own entity's field (`CourseFile.FailureReason`, `PublishBatchItem.ProgressText`), with no admin-facing surface reading that field today. Capture must never become a new source of outages — a failure while writing an ErrorRecord must be swallowed, not thrown.

**Functional Requirements:**

#### FR-1: Global unhandled-exception capture

The system captures every exception that reaches the outermost request pipeline, whether or not it's an `AppException` subtype.

**Consequences (testable):**
- A non-`AppException` exception (e.g. `NullReferenceException`) still returns the existing catch-all 500 `ProblemDetails` response (no behavior change to the API contract) AND produces exactly one new ErrorRecord.
- An `AppException` subtype still returns its existing mapped status code (no behavior change) AND produces exactly one new ErrorRecord (FR-2).
- A failure inside the error-capture code path itself does not prevent the original response from being returned to the caller.

#### FR-2: `AppException` subtype capture

Every one of the 10 existing `AppException` subtypes (and any future subtype) is captured with its concrete type preserved, not collapsed to a generic "exception."

**Consequences (testable):**
- The persisted ErrorRecord's `ExceptionType` field exactly matches the subtype's class name (e.g. `"ValidationException"`, not `"AppException"`).
- `DocumentParsingUnavailableException` and `FileScanUnavailableException` — currently caught only inside their respective jobs, never reaching this middleware — are captured via FR-3 instead (job-level); they are not expected to flow through this FR.

#### FR-3: Background job terminal-failure capture

When any Hangfire job (the 4 existing jobs, and any added later following the same pattern) exhausts its configured retry attempts, an ErrorRecord is created in addition to — not instead of — the job's existing write to its own entity's status/failure field.

**Consequences (testable):**
- After `ScanFileJob`/`ParseFileJob`/`ExtractStructureJob`/`PublishNodeContentJob` writes a terminal `Failed` status to its entity, exactly one ErrorRecord exists (or an existing one's `OccurrenceCount` increments, per FR-8) with `Category = "Background Job Error"` plus the specific underlying-cause category (FR-9's multi-tag note).
- A job retry that eventually *succeeds* (doesn't exhaust attempts) does NOT create an ErrorRecord — only terminal failures do.

#### FR-4: Existing per-entity failure mirroring

Existing per-entity failure fields (`CourseFile.FailureReason`, `PublishBatchItem.ProgressText` on terminal `Failed`) continue to exist and continue to drive their own existing UI exactly as today — this feature adds a mirrored ErrorRecord, it does not replace or remove either field.

**Consequences (testable):**
- `CourseFile.Status`/`FailureReason` and `PublishBatchItem.Status`/`ProgressText` are unchanged in shape and behavior.
- The mirrored ErrorRecord carries `RelatedEntityType`/`RelatedEntityId` pointing back to the originating `CourseFile`/`PublishBatchItem` row, so an admin can navigate from the error to the affected record.

#### FR-5: Secret/PII redaction guardrail

Before an ErrorRecord is persisted, known-sensitive values are redacted — from structured context *and* from free-text message/stack-trace content, since the latter is the more common real leak channel. *(Why both: see addendum's "Corrections Made During Review.")*

**Consequences (testable):**
- A captured error whose underlying exception message or context contains a value under a key matching a deny-list (`Authorization`, `ApiKey`, `Password`, `Token`, case-insensitive substring match) has that value replaced with `"[REDACTED]"` before the row is written.
- Independently of the above, the free-text `Message` and `StackTrace` fields are scanned with a small set of secret-shaped patterns (`[ASSUMPTION: starting pattern set — Bearer tokens, common API-key prefixes like gsk_/sk_/AIza, and inline connection-string Password=/Pwd= segments — confirm before build whether this list needs to grow]`) and any match is replaced with `"[REDACTED]"` in place, independent of whether it sat under a recognized field name.
- This applies uniformly regardless of Source (Backend or Frontend, FR-6/FR-7).

**Feature-specific NFRs:**
- Capture must be effectively non-blocking with respect to the request/job it originates from — it must not add meaningfully to response latency or job duration. `[ASSUMPTION: fire-and-forget / async write is acceptable given this is an internal admin tool, not a compliance-grade audit log requiring synchronous durability — confirm before build.]`

### 4.2 Frontend Error Capture

**Description:** Confirmed today: there is no global frontend error-handling mechanism of any kind — no React error boundary, no `window.onerror`, no `unhandledrejection` listener anywhere in the codebase. Every screen relies entirely on local `try`/`catch` with local `error` state. This feature is net-new frontend infrastructure, not a wiring exercise on top of something that already exists.

**Functional Requirements:**

#### FR-6: Global frontend runtime error capture

The frontend captures uncaught JavaScript exceptions, unhandled promise rejections, and React render crashes anywhere in the app, without requiring any individual component to opt in.

**Consequences (testable):**
- A single top-level React Error Boundary wraps the app root; a component throwing during render is caught there (and shows a graceful fallback UI instead of a blank white screen) rather than crashing the whole app.
- A `window.addEventListener('error', ...)` and `window.addEventListener('unhandledrejection', ...)` pair, registered once at app startup, catches errors outside React's render cycle (e.g. inside a `setTimeout`, a raw event handler, or a rejected Promise nobody `.catch()`ed).
- Every one of these three capture paths results in a call to FR-7's reporting endpoint.

#### FR-7: Error reporting endpoint

A new backend endpoint accepts frontend-captured error reports and creates ErrorRecords with `Source = "Frontend"`; on the client side, the reporting call follows the codebase's existing custom-`Error`-subclass-plus-shared-request-helper service pattern.

**Consequences (testable):**
- `POST /api/v1/errors/client` accepts `{ message, stack?, url, userAgent, timestamp }` and returns 202 Accepted (fire-and-forget from the client's perspective — a failure to report an error must never itself surface as a visible error to the user).
- If the request carries a valid auth token, the resulting ErrorRecord's `UserId` is populated; if not (e.g. a crash on the login screen itself), the ErrorRecord is still created with `UserId = null` — reporting is not gated behind authentication.
- **This endpoint lives on its own controller, separate from FR-11–FR-18's admin CRUD/lifecycle/retention-policy endpoints, and carries no `[Authorize]` policy at all** — it must remain reachable by a logged-out user. *(Why a separate controller: see addendum's "Corrections Made During Review.")*
- To prevent this open endpoint being abused as an arbitrary free write, it is rate-limited per source IP (`[ASSUMPTION: 30 requests/minute/IP — confirm before build]`); requests over the limit are dropped (204, not 429 — a rate-limited client shouldn't get a *visible* error back from the error-reporting endpoint itself).

### 4.3 Error Record Data Model

**Description:** The central store every other feature in this PRD reads from and writes to.

**Functional Requirements:**

#### FR-8: ErrorRecord schema, fingerprinting, and occurrence counting

A new `ErrorRecord` entity persists one row per distinct Fingerprint, incrementing occurrence data on repeat rather than duplicating rows.

**Consequences (testable):**
- Fields include (at minimum): `Id`, `Fingerprint`, `Source`, `Category`, `Priority`, `Status`, `Message`, `ExceptionType` (nullable — frontend errors may not have one), `StackTrace` (nullable, truncated to a bounded length matching the existing `CourseFile.FailureReason`'s 1024-char precedent, scaled up appropriately for a full stack trace), `OriginContext` (controller/job/component name), `RelatedEntityType`/`RelatedEntityId` (nullable, FR-4), `UserId` (nullable), `RequestPath`/`Route` (nullable), `CorrelationId` (nullable, FR-22), `OccurrenceCount`, `FirstOccurredAt`, `LastOccurredAt`, `ResolvedAt`/`ResolvedByUserId` (nullable), `ArchivedAt` (nullable), `PriorityIncreasedAt`/`PriorityIncreasedByUserId` (nullable — added in review: FR-17's audit-attribution requirement has nowhere else to live), `CreatedAt`, `UpdatedAt`.
- A second occurrence of an existing, non-`Archived` Fingerprint increments `OccurrenceCount` and updates `LastOccurredAt` on the *same* row rather than inserting a new one.
- A second occurrence of a Fingerprint whose existing record is `Resolved` triggers Reopen (FR-16) instead of silently incrementing.

**Feature-specific NFRs:**
- Query performance for the admin list view (FR-11/FR-12) must remain acceptable at realistic volume — index `Fingerprint`, `Category`, `Priority`, `Status`, and `LastOccurredAt` at minimum.

### 4.4 Auto-Categorization

**Description:** Every new ErrorRecord is assigned a Category by deterministic rule (exception type / HTTP status / origin), not by AI judgment — matching how established error-tracking tools (Sentry, Datadog) primarily classify. `[ASSUMPTION: rule-based, not LLM-based, categorization — this was an explicit research-grounded recommendation; confirm before build if AI-assisted categorization is actually wanted for ambiguous cases.]`

**Functional Requirements:**

#### FR-9: Rule-based category assignment

The system assigns exactly one primary Category to every ErrorRecord from this fixed set, using a deterministic mapping table:

| Category | Assigned when |
|---|---|
| **System / Infrastructure Error** | Unmatched/unmapped exception type, DB connectivity failure |
| **Validation Error** | `ValidationException` |
| **Authentication / Authorization Error** | `UnauthorizedAppException` |
| **External Integration Error** | `AiGatewayException`, `AiTaskUnavailableException`, `AiResponseValidationException`, `AiTaskBudgetExceededException`, `DocumentParsingUnavailableException`, `FileScanUnavailableException` |
| **File Processing Error** | Origin is `ScanFileJob` or `ParseFileJob` specifically (overlaps with External Integration for the underlying exception — File Processing wins as the more specific tag when both apply) |
| **Data Integrity Error** | `ConflictException`, DB constraint-violation exceptions |
| **Background Job Error** | Origin is any Hangfire job's terminal failure (FR-3) — applied alongside the underlying-cause category, not instead of it |
| **Frontend Runtime Error** | `Source = "Frontend"` (FR-6/FR-7) |
| **Uncategorized** | Fallback — nothing else matched |

**Consequences (testable):**
- Given an `AiGatewayException` thrown from inside `ExtractStructureJob`, the resulting ErrorRecord's Category is `"External Integration Error"` with a secondary `"Background Job Error"` tag (an ErrorRecord may carry one primary Category plus the Background-Job cross-cutting tag when applicable — not a full multi-category system beyond this specific case).
- The mapping table above is stored as code/config, not hardcoded inline per call site, so adding a new exception type later means one new table row, not a scan of every throw site.

### 4.5 Auto-Priority Assignment

**Description:** Every ErrorRecord is auto-assigned a Priority using an explainable, deterministic rule set — grounded in how Rollbar/Bugsnag/PagerDuty avoid "AI decides" severity assignment in favor of objective, written criteria. Split into two distinct, separately-triggered phases. *(Why two phases, not one: see addendum's "Corrections Made During Review.")*

**Functional Requirements:**

#### FR-10: P0–P3 rule-based priority assignment

**Phase A — Initial assignment**, evaluated exactly once, the first time a Fingerprint is ever seen (top-down, first match wins):
1. **P0** — the error occurred within a Critical Path (§3 Glossary) OR the ErrorRecord's Category is Data Integrity Error (`[ASSUMPTION: Data Integrity Error is unconditionally P0 regardless of other context — as debatable a call as the Critical-Path list itself; confirm before build]`).
2. **P1** — occurred in a user-facing (non-background-job) request, OR the ErrorRecord's Category is Background Job Error (FR-3's terminal-failure records are always at least this severe on first sight, since retries are already exhausted by the time one exists).
3. **P3** — Category is Validation Error, or Category is Frontend Runtime Error.
4. **P2** — none of the above (fallback).

**Phase B — Escalation on repeat occurrence**, evaluated every time an *existing*, non-`Archived` Fingerprint occurs again (FR-8):
- If occurrence frequency crosses a spike threshold (`[ASSUMPTION: 10x the prior 24h average within a 1-hour window — confirm before build]`) AND current Priority is P2 or P3, escalate to P1.

**Consequences (testable):**
- Phase A runs once and only once per Fingerprint's lifetime — including across a Reopen (FR-16), which revives the existing record rather than creating a new one, so Phase A does not re-run on reopen.
- Phase B never fires on a first occurrence (there is no "prior 24h average" to compare against yet) and never *decreases* a Priority — same one-way-only principle as a manual Increase (FR-17).
- Both phases are deterministic and auditable — given the same inputs, the same Priority is always assigned; no non-deterministic/AI component in either phase.

### 4.6 Admin Error Log UI

**Description:** A new Master-only screen under the existing Admin panel, following the panel's established sub-tab convention (`useAdminPanel.ts`'s `AdminSubTab` union / `ADMIN_SUBTAB_META`) and its existing hook shape (`{ data, isLoading, error, filters }`) for visual/structural consistency with the AI Configuration & Usage screen. Unlike every other existing admin list in the app (all of which fetch their full result set and filter client-side), this screen requires genuine server-side pagination and filtering — error-log volume is not expected to stay small enough for client-side filtering to hold up. `[NOTE FOR PM: this is new frontend infrastructure, not reuse of an existing pattern — flag for realistic estimation.]`

**Functional Requirements:**

#### FR-11: Error list view

A Master admin sees a paginated table of ErrorRecords, newest-`LastOccurredAt`-first by default.

**Consequences (testable):**
- Each row shows: Category, Priority (color-coded badge — reusing the app's existing badge-pill visual convention), Status, truncated Message, Source, OccurrenceCount, LastOccurredAt.
- The list is server-side paginated (not a full client-side fetch-then-filter, unlike every other existing admin list).
- `Archived` records are excluded from the default view.

#### FR-12: Filtering and search

An admin narrows the list by Category, Priority, Status, Source, a date range on `LastOccurredAt`, and free-text search over Message/`ExceptionType`.

**Consequences (testable):**
- Filters are combinable (e.g. Category = External Integration Error AND Priority = P0/P1 simultaneously, as in UJ-1).
- An explicit toggle (default off) includes `Archived` records in results when the admin wants to review history.

#### FR-13: Error detail view

An admin can open a single ErrorRecord to see everything about it.

**Consequences (testable):**
- Detail view shows the full (untruncated) `StackTrace`, `RequestPath`/`Route`, `OriginContext`, occurrence timeline (`FirstOccurredAt`/`LastOccurredAt`/`OccurrenceCount`), and — when `RelatedEntityType`/`RelatedEntityId` is set (FR-4) — a link back to the originating record (e.g. the specific `CourseFile`).

### 4.7 Error Lifecycle Actions

**Description:** The three actions requested, refined against how established error-tracking tools actually handle triage lifecycles: literal permanent per-record delete is deliberately **not** offered, replaced by Archive (reversible soft-delete) plus a separate retention policy for real cleanup — every tool surveyed (Sentry, Rollbar, Bugsnag, Datadog) treats hard-delete-by-a-human as an anti-pattern because it destroys the ability to detect a fixed error coming back. This substitution was proposed and confirmed during this PRD's discovery, not assumed unilaterally.

**Functional Requirements:**

#### FR-14: Archive (replaces literal "Delete")

An admin can archive an ErrorRecord, removing it from the default active view without destroying it.

**Consequences (testable):**
- Archiving sets `Status = "Archived"` and `ArchivedAt = now`; the row is not removed from the database.
- An archived record recurring triggers Reopen (FR-16), exactly like a `Resolved` record does — **not** a new ErrorRecord. Archive is a stronger *dismissal signal* than Resolve, not a stronger claim about the Fingerprint being gone for good — Fingerprint uniqueness (FR-8) holds regardless of Status. *(Why this matters: see addendum's "Corrections Made During Review.")*
- An archived record is only permanently removed by the retention policy (FR-18), never by this action directly.

#### FR-15: Mark as Resolved

An admin can mark an ErrorRecord resolved once they've fixed the underlying cause.

**Consequences (testable):**
- Sets `Status = "Resolved"`, `ResolvedAt = now`, `ResolvedByUserId = <acting admin>`.
- A `Resolved` record is excluded from the default active view (same as `Archived`) but is distinguished from it in the data model and in the "include historical" filter (FR-12), since Resolved records are the ones eligible for auto-Reopen (FR-16) and Archived ones are not.

#### FR-16: Auto-Reopen on regression

If a `Resolved` **or** `Archived` ErrorRecord's Fingerprint occurs again, it automatically reopens rather than silently incrementing behind the admin's back (FR-14).

**Consequences (testable):**
- The record's `Status` flips back to `New`, `OccurrenceCount` increments, and `LastOccurredAt` updates.
- `ResolvedAt`/`ResolvedByUserId` (or `ArchivedAt`) are preserved until the next dismissal overwrites them — they reflect the *most recent* prior dismissal, not a full history (a real occurrence-by-occurrence history is explicitly out of scope for v1, §5 Non-Goals). *(Why this wording, specifically: see addendum's "Corrections Made During Review.")*
- A reopened record's Priority is **not** silently reset — it keeps whatever Priority it had (including any manual increase from before, FR-17), so a regression on a previously-escalated issue doesn't quietly downgrade its urgency.

#### FR-17: Increase Priority

An admin can manually escalate an ErrorRecord's Priority by one level.

**Consequences (testable):**
- Each click moves Priority exactly one step toward P0 (e.g. P2 → P1); the action is unavailable/disabled once already at P0.
- The change sets `PriorityIncreasedAt`/`PriorityIncreasedByUserId` (FR-8) to the acting admin and current time — overwriting any prior increase's attribution, matching FR-16's same single-most-recent-event convention rather than a full history.
- `[ASSUMPTION: "increase" only, one level at a time, matching the literal request — no manual decrease and no jump-to-any-level in v1. If auto-assignment over-prioritizes something in practice, there's currently no way to correct that downward except Archive/Resolve. Confirm before build whether this asymmetry is acceptable or whether a full bidirectional override is actually wanted.]`

#### FR-18: Retention policy (the actual deletion mechanism)

An admin-configurable policy permanently purges old `Resolved`/`Archived` ErrorRecords — this is the feature's only path to real, permanent deletion.

**Consequences (testable):**
- A configurable retention window (default `[ASSUMPTION: 180 days, matching the longer end of the Sentry/Rollbar precedent researched — confirm before build]`) applies independently to `Resolved` and `Archived` records; `New` records are never auto-purged regardless of age.
- Purging is logged (count + date range purged) so there's a record that a purge happened, even though the individual rows are gone.

### 4.8 Access Control

**Description:** Reuses the existing `FeatureKeys`/role-permission-matrix RBAC pattern exactly as every other Master-only admin feature does (`AiConfigManage`, `AdminPermissionsManage`) — no new authorization mechanism.

**Functional Requirements:**

#### FR-19: Master-only access

Only the Master role can view or act on the Error Log.

**Consequences (testable):**
- A new `FeatureKeys.ErrorsManage` policy gates the admin controller (list/filter/detail/Archive/Resolve/Increase-Priority/retention-policy configuration — FR-11 through FR-18, plus the trace-view filter of FR-24) and every write action on it (`[Authorize(Policy = FeatureKeys.ErrorsManage)]`), seeded as a Master-only row — matching the existing fail-closed default (undocumented role×key combos are not visible).
- This policy does **not** gate FR-7's error-reporting endpoint (see FR-7).
- The new "Error Log" admin sub-tab is present in the Master role's navigation and absent from Support's (and every other role's).
- A non-Master user hitting the admin API directly (bypassing the UI) receives 403, not just a hidden menu item — the backend policy is the real enforcement, the frontend hide is UX only.

### 4.9 Correlation ID Traceability

**Description:** Every error captured by this feature also carries the Correlation ID of the user action that produced it, so an admin can trace one failure back to — and forward through — everything else that same action touched, even across asynchronous job boundaries. This is net-new: confirmed absent from the backend today (no `Correlation`, `TraceIdentifier`, or equivalent header handling anywhere in the codebase).

**Functional Requirements:**

#### FR-20: Backend correlation ID assignment

A new outermost middleware assigns a Correlation ID to every inbound HTTP request.

**Consequences (testable):**
- If the inbound request carries an `X-Correlation-Id` header, that value is reused as-is (supports a resilient client retrying the same logical request, or a support workflow that already has an ID to hand); otherwise a new GUID is generated.
- The Correlation ID is available to every downstream component for the lifetime of the request (e.g. via a scoped accessor) and is echoed back on the response as `X-Correlation-Id`, whether the request succeeds or fails.
- This middleware runs before `ExceptionHandlingMiddleware` (FR-1's extension point), so a Correlation ID is always already established by the time any exception is caught and turned into an ErrorRecord.

#### FR-21: Correlation ID propagation into background jobs

When a request enqueues one of the 4 existing Hangfire jobs (or any added later), the enqueuing request's Correlation ID travels with the job.

**Consequences (testable):**
- Each job enqueuer (`ScanFileJobEnqueuer`, `ParseFileJobEnqueuer`, `ExtractStructureJobEnqueuer`, `PublishNodeContentJobEnqueuer`) accepts and forwards the current Correlation ID as a job argument, so it is available inside the job's `RunAsync` regardless of how long the job sits in the queue or how many times it retries.
- A single course-file upload's full pipeline — scan → parse → extract — produces ErrorRecords (if any step fails) that all share the same Correlation ID as the original upload request, even though each job runs asynchronously and independently.
- A job enqueued without an available Correlation ID (e.g. a future scheduled/recurring job with no originating request) is not blocked from running — it proceeds with a `null` Correlation ID rather than failing.

#### FR-22: ErrorRecord correlation ID capture

Every ErrorRecord captures the Correlation ID active at the moment of failure, with no extra work required by individual call sites.

**Consequences (testable):**
- FR-8's schema gains a `CorrelationId` field (nullable — see Open Questions for cases where none exists).
- FR-1 (unhandled exceptions), FR-3 (job terminal failures, via FR-21), and FR-6/FR-7 (frontend errors, via FR-23) all populate this field automatically as part of their existing capture path — it is not a separate write.
- A repeat occurrence of an existing Fingerprint (FR-8) updates `LastOccurredAt`/`OccurrenceCount` on the same row; `CorrelationId` reflects only the most recent occurrence's originating action, not a full history — same single-most-recent-event convention as FR-16/FR-17.

#### FR-23: Frontend correlation ID propagation

The frontend retains the Correlation ID from its most recent backend response and includes it when reporting an error.

**Consequences (testable):**
- The frontend reads `X-Correlation-Id` off every API response (FR-20) and holds the most recent value.
- A frontend error report (FR-7) includes that value when available, so a UI crash immediately following a failed API call can be traced back to the same backend request.
- A frontend error with no prior backend call in the current page session (e.g. a crash on initial page load) reports with no Correlation ID rather than a fabricated one. `[ASSUMPTION: v1 does not mint a client-side-only correlation id for this case — confirm before build whether that gap matters enough to add one.]`

#### FR-24: Admin trace view

An admin can see every ErrorRecord that shares a Correlation ID with the one they're looking at.

**Consequences (testable):**
- FR-13's detail view displays the Correlation ID (when present) as a clickable value.
- Clicking it filters FR-11's list view to only ErrorRecords sharing that Correlation ID — surfacing, e.g., every failure produced by one course-file's scan→parse→extract chain in one view.
- FR-12's search/filter gains Correlation ID as an explicit filterable field (exact match, not substring).

## 5. Non-Goals (Explicit)

- **Not a full APM/tracing platform.** No distributed tracing, no request-span timing, no performance-monitoring beyond error events. This is an error log, not Datadog APM.
- **Not replacing existing per-entity failure UI.** `CourseFile`'s own status badge and `PublishBatchItem`'s progress display stay exactly as they are; this feature is additive (FR-4).
- **No alerting/notifications in v1.** No Slack/email/PagerDuty integration when a P0 lands. `[NOTE FOR PM: natural, high-value v2 given this is effectively an internal error-tracking tool — flag for revisit once v1 has real usage data.]`
- **No AI-based error classification in v1.** Categorization and prioritization are rule-based and deterministic (FR-9/FR-10), not LLM-judged — an explicit choice to keep triage explainable and auditable, matching industry precedent.
- **No true hard-delete in v1.** Permanent removal only happens via the retention policy (FR-18), never a direct per-record action.
- **No Support-role access in v1.** Master only (§2.2, FR-19).
- **No per-occurrence row storage in v1.** Occurrences are counted (`OccurrenceCount`), not individually stored — no full occurrence-by-occurrence audit trail beyond first/last timestamp.
- **Not distributed tracing / OpenTelemetry.** Correlation ID is a single app-level identifier threaded through one system's own requests and jobs — not a W3C Trace Context/OpenTelemetry span model, and not multi-service distributed tracing. `[NOTE FOR PM: if FlexDemy later splits into more independently-deployed services, revisit whether this simple ID is still sufficient.]`

## 6. MVP Scope

### 6.1 In Scope

- Backend capture: global unhandled-exception middleware extension, `AppException` capture, all 4 Hangfire jobs' terminal-failure capture, per-entity failure mirroring, secret/PII redaction.
- Frontend capture: global React error boundary, `window.onerror`/`unhandledrejection` handlers, error-reporting endpoint.
- `ErrorRecord` data model with fingerprinting and occurrence counting.
- Rule-based auto-categorization (9 categories) and auto-priority (P0–P3).
- Admin Error Log UI: list, filter/search, detail view — server-side paginated.
- Lifecycle actions: Archive, Mark Resolved, auto-Reopen, Increase Priority.
- Admin-configurable retention/purge policy.
- Master-only RBAC.
- Correlation ID assignment (HTTP requests), propagation (background-job chains and frontend), ErrorRecord capture, and admin trace view (FR-20–FR-24).

### 6.2 Out of Scope for MVP

- Alerting/notifications (deferred to v2, see Non-Goals).
- AI-assisted categorization for ambiguous/uncategorized errors (deferred — revisit if the "Uncategorized" bucket proves large in practice).
- Bidirectional/full manual priority override (deferred pending confirmation, FR-17's assumption).
- Per-occurrence detailed audit trail (only aggregate counts in v1).
- Cross-error analytics/trend charts beyond the basic list+filter view.
- Support-role visibility.

## 7. Success Metrics

**Primary**
- **SM-1**: Silent-failure coverage — 100% of the specifically-identified previously-uncaptured failure modes (`DocumentParsingUnavailableException`, `FileScanUnavailableException`, non-`AppException` unhandled exceptions, all frontend runtime errors) produce an ErrorRecord within one release cycle of this feature shipping. Validates FR-1, FR-3, FR-6.
- **SM-2**: Time-to-visibility — median time from an error occurring to it being queryable in the Admin Error Log is under 1 minute (near-real-time, not batch). Validates FR-1 through FR-8.

**Secondary**
- **SM-3**: Triage throughput — percentage of P0/P1 ErrorRecords reaching `Resolved` status within 24 hours of first occurrence. Validates FR-15 (process metric — depends on admin behavior, not purely system capability, so tracked as secondary).

**Counter-metrics (do not optimize)**
- **SM-C1**: Do not optimize "fewer visible errors" as a target. A dropping active-error count achieved by aggressively Archiving/Resolving without actually fixing anything is a false signal, not success — it defeats SM-1's entire premise (surfacing what was previously invisible). Counterbalances SM-1 and SM-3.

## 8. Open Questions

1. Is the Critical-Path list (Authentication, Course Publish) complete, or are there other flows (e.g. payment/billing, if any exists) that should also drive P0 assignment? (§3 Glossary assumption)
2. Is it acceptable that Data Integrity Error is unconditionally P0 with no other qualifying condition, same as Critical Path? (FR-10 Phase A assumption, flagged in review)
3. Should Increase Priority support a full bidirectional/jump-to-any-level override, or is one-way, one-step-at-a-time sufficient for v1? (FR-17 assumption)
4. Is fire-and-forget (non-blocking, best-effort) capture acceptable, or does any category of error need guaranteed/synchronous persistence? (FR-1's NFR assumption)
5. What's the right default retention window — 180 days, or something shorter/longer given expected error volume once this ships? (FR-18 assumption)
6. What's the actual spike-frequency threshold that should trigger Phase B's P1 auto-escalation for a recurring error? (FR-10 Phase B assumption)
7. Is a 30 requests/minute/IP rate limit right for the anonymous error-reporting endpoint, or does real frontend crash-storm behavior (e.g. a bad deploy causing every active session to error at once) need a higher ceiling? (FR-7 assumption, added in review)
8. Is the starting secret-pattern list (Bearer tokens, `gsk_`/`sk_`/`AIza`-style prefixes, connection-string `Password=`/`Pwd=`) enough for free-text redaction, or does it need to cover more provider-specific key formats? (FR-5 assumption, added in review)
9. Are the placeholder performance/scale numbers (~50ms/~200ms overhead, 2s list-view response at 100k records) actually right for this system, or need adjustment before they're treated as real targets? (Cross-Cutting NFRs, added in review)
10. Should a Correlation ID header follow an existing standard (e.g. W3C `traceparent`) in case FlexDemy adopts OpenTelemetry later, or is a simple `X-Correlation-Id` GUID sufficient for v1's single-service scope? (FR-20 assumption)
11. Is it acceptable that a frontend error with no prior backend call in the page session reports with no Correlation ID at all, or does v1 need a client-generated fallback ID for that case? (FR-23 assumption)

## 9. Assumptions Index

- §3 Glossary — Critical Path starting set (Authentication, Course Publish) is inferred, not confirmed against a real prioritized list.
- §4.1 FR-1 NFR — fire-and-forget/async capture assumed acceptable for an internal admin tool.
- §4.2 FR-7 — rate limit of 30 requests/minute/IP on the anonymous error-reporting endpoint (added in review, to close the abuse-vector gap created by FR-7 having no auth).
- §4.4 — rule-based (not AI-assisted) categorization assumed as the v1 approach.
- §4.5 FR-10 Phase A — Data Integrity Error unconditionally maps to P0 (flagged in review as equally load-bearing to the Critical-Path assumption, previously untagged).
- §4.5 FR-10 Phase B — spike-frequency threshold (10x/24h baseline within 1h) is a placeholder pending real volume data.
- §4.7 FR-5 — starting free-text secret-pattern list (added in review, closing the structured-field-only redaction gap).
- §4.7 FR-17 — Increase Priority scoped to one-way, one-level-at-a-time, matching the literal original request.
- §4.7 FR-18 — 180-day default retention window, matching researched industry precedent, not confirmed against FlexDemy's own data-retention needs.
- Cross-Cutting NFRs — placeholder performance/scale numbers (added in review, replacing unquantified "negligible"/"realistic volume" language with figures a builder can actually test against).
- §4.9 FR-20 — Correlation ID is a simple app-level `X-Correlation-Id` GUID, not a W3C Trace Context/OpenTelemetry identifier.
- §4.9 FR-23 — a frontend error with no prior backend call in the session reports with no Correlation ID (no client-generated fallback in v1).

---

## Cross-Cutting NFRs

*Numbers below are placeholders added in review (an earlier draft's "negligible"/"realistic volume" language had no evidence anyone could build or test against) — treat every figure as `[ASSUMPTION: confirm before build]`, not a settled target.*

- **Performance:** error capture (backend and frontend) adds no more than ~50ms to p99 request latency and no more than ~200ms to a background job's total run time — no synchronous blocking write on the hot path of any request or job (FR-1's NFR).
- **Reliability:** the observability system must never itself become a source of outages — a failure inside error-capture code is caught and discarded, never allowed to propagate or recurse (FR-1, FR-5).
- **Scalability:** the Admin Error Log's list view (FR-11) returns within ~2 seconds at up to ~100,000 stored ErrorRecords, via server-side pagination and appropriate indexing (FR-8's NFR) — this is new infrastructure, since no existing admin screen in the app does true server-side pagination today.
- **Security:** error records must never contain plaintext secrets, API keys, tokens, or passwords — redaction (structured *and* free-text, FR-5) is mandatory before persistence, not optional, and admin access is restricted to the Master role (FR-19); the reporting endpoint (FR-7) is intentionally the one anonymous exception to that access restriction.

## Constraints and Guardrails

- **Privacy:** stack traces and error messages can incidentally contain user-identifying information (email addresses in a validation message, for instance) — access is restricted to Master admins specifically because of this (FR-19), and the redaction guardrail (FR-5) targets known-sensitive *field names plus a starting set of secret-shaped free-text patterns*, not a claim of removing all possible PII from free-text messages. `[NOTE FOR PM: if FlexDemy later needs GDPR/similar data-subject-deletion guarantees over error records containing a specific user's data, that's a real gap in v1's design — flag for revisit if that requirement ever surfaces.]`
- **Security:** access is gated by the existing fail-closed RBAC system (FR-19); this is not a publicly reachable surface under any circumstance.

## Integration and Dependencies

This feature is deliberately cross-cutting — it observes, rather than replaces, every existing failure-producing surface in the backend:

- All 10 existing `AppException` subtypes (`NotFoundException`, `ValidationException`, `ConflictException`, `UnauthorizedAppException`, `AiGatewayException`, `AiResponseValidationException`, `AiTaskUnavailableException`, `AiTaskBudgetExceededException`, `DocumentParsingUnavailableException`, `FileScanUnavailableException`).
- All 4 existing Hangfire jobs (`ScanFileJob`, `ParseFileJob`, `ExtractStructureJob`, `PublishNodeContentJob`) and any added later.
- The 4 existing Hangfire job enqueuers (`ScanFileJobEnqueuer`, `ParseFileJobEnqueuer`, `ExtractStructureJobEnqueuer`, `PublishNodeContentJobEnqueuer`) — each needs a new Correlation ID parameter threaded through to its job (FR-21).
- The two existing per-entity failure-tracking entities (`CourseFile`, `PublishBatchItem`).
- The three self-hosted external service dependencies whose failures this feature specifically makes visible for the first time: the document-parsing/OCR service, the AI-provider gateway, and the malware-scanning service.
- The existing `FeatureKeys`/role-permission RBAC system (no new auth mechanism).
- The existing Admin panel frontend shell (`AdminPanel.tsx`, `useAdminPanel.ts`) for menu placement.

No new external third-party service is introduced by this feature — everything above is either already part of FlexDemy or is new code within FlexDemy's own boundary.
