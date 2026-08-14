---
baseline_commit: bbcf238016cf10bf942364c1bbd929d43991d5eb
---

# Story 4.7: Correlation ID Trace View

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Master admin,
I want to click a Correlation ID and see every other error it produced,
so that I can see one user action's full failure chain — e.g. a single upload's scan→parse→extract failures — in one place instead of hunting for them individually.

## Acceptance Criteria

1. **Given** an `ErrorRecord`'s detail view shows a non-null Correlation ID, **when** the admin clicks it, **then** the list view filters to show only `ErrorRecord`s sharing that exact Correlation ID. [Source: epics-ErrorObservability.md Story 4.7; PRD FR-24]
2. **Given** FR-12's filter panel, **when** a Correlation ID is entered directly, **then** it filters by exact match, not substring. [Source: PRD FR-24]
3. **Given** a course-file upload whose scan/parse/extract pipeline produced 3 separate `ErrorRecord`s sharing one Correlation ID (per Story 4.1's job propagation), **when** an admin opens any one of them and clicks its Correlation ID, **then** all 3 appear together in the filtered list. [Source: PRD FR-24; backend AD-23]

## Tasks / Subtasks

### Backend

- [x] Task 1: Add Correlation ID as an exact-match filter (AC: #2, #3)
  - [x] `Application/ErrorObservability/ErrorListQuery.cs` (from Story 4.5): add `CorrelationId` (string?, nullable).
  - [x] `Infrastructure/Repositories/ErrorRecordRepository.cs`'s `QueryAsync` (from Story 4.5): when `query.CorrelationId` is non-null, add `.Where(r => r.CorrelationId == query.CorrelationId)` — **exact equality, not `Contains`/`ILike`** (AC #2's explicit "not substring" requirement; this is the one filter in the whole feature that must not be a partial match, unlike the free-text `Search` filter Story 4.5 already built). **Note: actual file is `Infrastructure/ErrorObservability/ErrorRecordRepository.cs` (AD-24's placement, established in Stories 4.5/4.6), not `Infrastructure/Repositories/` — the story's stale path text.**
  - [x] No controller change needed — `ErrorsController`'s existing `[HttpGet] GetList([FromQuery] ErrorListQuery query, ...)` (Story 4.5) already binds any new query-string parameter on `ErrorListQuery` automatically; `?correlationId=...` starts working the moment the DTO field exists. Confirmed: no controller change made.
- [x] Task 2: Backend tests (AD-7)
  - [x] `FlexDemy.Infrastructure.Tests/ErrorObservability/ErrorRecordRepositoryTests.cs` (extend Story 4.5's): `QueryAsync` with a `CorrelationId` filter returns only exact matches; a record whose `CorrelationId` merely *contains* the queried value as a substring is correctly excluded (the specific case AC #2 exists to prevent); combined with another filter (`CorrelationId` + `Status`) still ANDs correctly, same as every other filter combination Story 4.5 already tests.

### Frontend

- [x] Task 3: Clickable Correlation ID in the detail view (AC: #1, #3)
  - [x] `ErrorDetailModal.tsx` (from Story 4.5): render `CorrelationId` (when non-null) as a clickable element (button or link-styled span — this app has no client-side router to deep-link to, per the existing `App.tsx`-driven tab-switching convention, so a plain click handler is correct, not an `<a href>`). **Note: actual component is `ErrorDetailPanel.tsx` (a `SidePanel`, established naming since Story 4.5) — the story's stale "Modal" text, same deviation Story 4.6 already documented.**
  - [x] On click: call `useErrorLog`'s `setFilters` (lifted from `ErrorLog.tsx`, needs to be passed down into `ErrorDetailModal` as a prop, or the click handler needs to be passed down from `ErrorLog.tsx` — developer's call on the exact prop-threading shape) with `{ ...currentFilters, correlationId: clickedValue }`, and close the detail modal so the admin lands back on the now-filtered list (AC #1/#3's "list view filters to show only..."). **Implemented as: `ErrorLog.tsx` owns a `handleCorrelationIdClick` callback (closes over `filters`/`setFilters`) passed down as `onCorrelationIdClick` prop; `ErrorDetailPanel` calls it plus `onClose()` on click.**
- [x] Task 4: Correlation ID as a direct filter-panel field (AC: #2)
  - [x] `ErrorLogFilters.tsx` (from Story 4.5): add a text input for `CorrelationId`, wired into the same `filters` state as every other filter — no special-casing needed on the frontend for "exact match" (that's a backend query-semantics concern, Task 1; the frontend just passes the typed string through). Debounced (250ms) same as the existing free-text Search field, with a re-sync effect so a value set externally (a Correlation ID click) reflects in the input.
- [x] Task 5: Frontend tests (AD-5)
  - [x] `FrontEnd/tests/features/Admin/ErrorLog/ErrorDetailModal.test.tsx` (extend Story 4.5/4.6's): clicking the Correlation ID calls the filter-setting callback with the right value and closes the modal. **Written in the actual `ErrorDetailPanel.test.tsx`** (2 new tests: click behavior, and no-clickable-element when `correlationId` is null).
  - [x] `FrontEnd/tests/features/Admin/ErrorLog/ErrorLogFilters.test.tsx` (extend if it exists, or add): typing into the Correlation ID field updates filter state. Extended with 2 new tests (typing updates state; external value reflects in the input).

### Review Findings

- [x] [Review][Patch] A Correlation ID click doesn't clear the other active filters, so it can fail to show the full trace — `ErrorLog.tsx`'s `handleCorrelationIdClick` does `setFilters({ ...filters, correlationId })`, preserving any active Category/Priority/Status/Source/date-range/Search filter and `IncludeArchived`'s default-off. AC #1 requires the click to "show only `ErrorRecord`s sharing that exact Correlation ID" and AC #3's own 3-record scan→parse→extract example requires "all 3 appear together" — a chain's stages very plausibly differ in Category/Priority, so a stale filter silently drops trace siblings. [FrontEnd/src/features/Admin/ErrorLog/ErrorLog.tsx:handleCorrelationIdClick] — **Fixed**: `handleCorrelationIdClick` now replaces the filters with `{ correlationId, includeArchived: true }` instead of spreading the prior ones. New integration test in `ErrorLog.test.tsx` proves an active Priority filter is cleared by the click.
- [x] [Review][Patch] AC #3's core "multiple records sharing one Correlation ID" scenario has zero test coverage — all 3 new `ErrorRecordRepositoryTests.cs` cases assert exactly one matching record (`Assert.Single(items)`), never N>1 returned together, which is the literal claim AC #3 makes. [BackEnd/tests/FlexDemy.Infrastructure.Tests/ErrorObservability/ErrorRecordRepositoryTests.cs] — **Fixed**: new `QueryAsync_returns_every_record_sharing_the_same_CorrelationId` test uses the story's own 3-record scan/parse/extract example and asserts all 3 come back together.
- [x] [Review][Patch] `ErrorRecordRepository.QueryAsync`'s new `CorrelationId` comparison isn't trimmed, only gated by `IsNullOrWhiteSpace` — a value with incidental leading/trailing whitespace (a saved URL, a non-UI caller) fails to match even though it "means" the same id. [BackEnd/src/FlexDemy.Infrastructure/ErrorObservability/ErrorRecordRepository.cs] — **Fixed**: the query value is now `.Trim()`-med before comparing.
- [x] [Review][Patch] No DB index on `CorrelationId` — `ErrorRecordConfiguration.cs` explicitly indexes `Fingerprint`/`Category`/`Priority`/`Status`/`LastOccurredAt` "for the admin list view's query shape... NFR3," but this story adds a new equality-filtered column with no corresponding `HasIndex`/migration, inconsistent with that established precedent. [BackEnd/src/FlexDemy.Infrastructure/Persistence/Configurations/ErrorRecordConfiguration.cs] — **Fixed**: added `HasIndex(r => r.CorrelationId)` plus migration `20260814084540_AddErrorRecordCorrelationIdIndex`.
- [x] [Review][Defer] Case-sensitive exact match with no normalization, unlike the adjacent `Search` filter's `.ToLower()` [BackEnd/src/FlexDemy.Infrastructure/ErrorObservability/ErrorRecordRepository.cs] — deferred: judged as correct-as-specified, not a bug. AC #2 says "exact match," which conventionally implies case-sensitive unless stated otherwise; Correlation IDs are opaque system-generated tokens, not human-typed free text like `Search`'s Message/ExceptionType target, and the primary interaction path (clicking, Task 3) always passes the exact stored value/casing by construction — only the secondary manual-entry path (Task 4) is exposed to a hand-typed casing mismatch.
- [x] [Review][Defer] Latent max-length mismatch: `CorrelationIdValidator.MaxLength` allows inbound values up to 128 characters, but `ErrorRecordConfiguration` caps the persisted `CorrelationId` column at `HasMaxLength(64)` [BackEnd/src/FlexDemy.Infrastructure/Persistence/Configurations/ErrorRecordConfiguration.cs] — deferred: pre-existing gap from Story 4.1's original schema, not introduced by this story. This story is the first to round-trip the value through a user-facing filter, which surfaces the mismatch's user-facing implications for the first time, but fixing the ingestion-side validation/persistence boundary is out of this story's scope.

## Dev Notes

- **This is the smallest story in the epic** — one new query field, one new `Where` clause, one clickable UI element. It exists specifically to close the loop Story 4.1's Correlation ID infrastructure opened 6 stories earlier: the propagation mechanism has been running since Story 4.1, but nothing has surfaced it to an admin until now.
- **AC #3's 3-error scenario is the epic's own end-to-end validation case** — if a real course-file upload's scan→parse→extract chain fails at each step, this story is what an admin actually uses to confirm Story 4.1's propagation genuinely worked across all 3 Hangfire jobs, not just in isolated unit tests. Worth manually verifying this exact scenario during dev, not just relying on the unit-test coverage above.
- **No backend capture-path changes in this story** — Correlation ID capture itself was fully built by Stories 4.1-4.3 (backend) and 4.2/4.4 (frontend, via the `CorrelationIdOverride` resolution). This story is read/filter-only.

### Project Structure Notes

- **No new files.** Purely additive changes to Story 4.5's `ErrorListQuery.cs`, `ErrorRecordRepository.cs`, `ErrorDetailModal.tsx`, `ErrorLogFilters.tsx`, and their existing test files.

### References

- [Source: _specs/planning-artifacts/epics-ErrorObservability.md — Story 4.7 (lines 332-351, the epic's final story)]
- [Source: _specs/planning-artifacts/prds/prd-eLearning-ErrorObservability-2026-08-13/prd.md — FR-24 §4.9]
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md — AD-23 (the propagation mechanism this story's AC #3 end-to-end-validates)]

## Previous Story Intelligence

- **Story 4.5 built `ErrorListQuery`/`ErrorRecordRepository.QueryAsync`/`ErrorDetailModal.tsx`/`ErrorLogFilters.tsx`** — every task in this story extends one of those four. Confirm their exact current shape before extending; this is the last story in the epic, so any naming drift across Stories 4.2-4.6 will have accumulated by the time this one starts.
- **Story 4.1 is what actually produces multiple `ErrorRecord`s sharing one Correlation ID** (the scan→parse→extract chain) — this story's AC #3 is only testable/demonstrable once Stories 4.1 and 4.3 (capture wiring) are both genuinely working, not just this story's own code.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

TDD red/green cycle followed throughout, confirmed at each step via `dotnet test` (Infrastructure) and `npx vitest run` (Frontend). No debug-log file artifacts produced.

### Completion Notes List

- AC #3's end-to-end scan→parse→extract scenario was not manually verified in a running browser (would require the full Docker/Postgres stack). **Code review correction**: the Acceptance Auditor found the originally-claimed substitute coverage overstated — the pre-existing Story 4.1 propagation tests only verify a correlation ID string is passed as a parameter between mocked job stages, never that multiple persisted `ErrorRecord`s sharing one `CorrelationId` are returned together by a query, which is AC #3's actual literal claim. Closed via a genuinely new test, `QueryAsync_returns_every_record_sharing_the_same_CorrelationId`, using the story's own 3-record scan/parse/extract example directly. A live 3-job-failure browser walkthrough still was not performed.
- Two file/component naming deviations from the story's literal text, both pre-existing from Stories 4.5/4.6 (not introduced here): `Infrastructure/Repositories/ErrorRecordRepository.cs` → actual path is `Infrastructure/ErrorObservability/ErrorRecordRepository.cs` (AD-24); `ErrorDetailModal.tsx` → actual component is `ErrorDetailPanel.tsx` (a `SidePanel`).
- The Correlation ID filter-panel field (Task 4) is debounced (250ms) using the same shape as the existing Search field, including a re-sync `useEffect` so a value set externally (via a Correlation ID click in the detail panel) reflects correctly in the input rather than being silently overwritten by a stale local state value.
- The click-to-filter wiring (Task 3) is implemented as a `handleCorrelationIdClick` callback owned by `ErrorLog.tsx` (closing over `filters`/`setFilters` from `useErrorLog`), passed down to `ErrorDetailPanel` as `onCorrelationIdClick` — the "developer's call on the exact prop-threading shape" the story left open. **Code review correction**: originally spread the prior filters (`{ ...filters, correlationId }`); fixed to replace them entirely (`{ correlationId, includeArchived: true }`) so a stale Category/Priority/Status filter can't hide trace siblings — see Review Findings.
- Full regression after patches: 915 backend tests (597 Application + 219 Infrastructure + 99 Api), 0 failures. Frontend: all 28 ErrorLog-feature tests pass consistently; the full 590-test suite ran clean in the final pass (an earlier pass showed pre-existing, unrelated timing-flakiness under system load in `App.test.tsx`/`CoursePlayer.test.tsx`/`TutorEducatorHubView.test.tsx` — none touch this story's files, confirmed not a regression by re-running in isolation).

### File List

**Backend — New:**
- `src/FlexDemy.Infrastructure/Persistence/Migrations/20260814084540_AddErrorRecordCorrelationIdIndex.cs` (+ `.Designer.cs`, snapshot update) — code-review patch

**Backend — Modified:**
- `src/FlexDemy.Application/ErrorObservability/ErrorListQuery.cs`
- `src/FlexDemy.Infrastructure/ErrorObservability/ErrorRecordRepository.cs`
- `src/FlexDemy.Infrastructure/Persistence/Configurations/ErrorRecordConfiguration.cs` (code-review patch: `CorrelationId` index)
- `tests/FlexDemy.Infrastructure.Tests/ErrorObservability/ErrorRecordRepositoryTests.cs`

**Frontend — Modified:**
- `src/services/errorsService.ts`
- `src/features/Admin/ErrorLog/ErrorLogFilters.tsx`
- `src/features/Admin/ErrorLog/ErrorDetailPanel.tsx`
- `src/features/Admin/ErrorLog/ErrorLog.tsx`
- `tests/features/Admin/ErrorLog/ErrorLogFilters.test.tsx`
- `tests/features/Admin/ErrorLog/ErrorDetailPanel.test.tsx`
- `tests/features/Admin/ErrorLog/ErrorLog.test.tsx` (code-review patch: filter-clearing regression test)

## Change Log

- 2026-08-13: Story created via `bmad-create-story` — seventh and last of Epic 4's 7 stories, written as part of a full-epic write-then-implement batch. Status set to `ready-for-dev`.
- 2026-08-14: Implemented via `bmad-dev-story` (Tasks 1-5, backend + frontend). Correlation ID added as an exact-match list filter, plus a clickable Correlation ID in the detail panel that filters the list to the record's full trace. Status set to `review`.
- 2026-08-14: Code review via `bmad-code-review` (Blind Hunter, Edge Case Hunter, Acceptance Auditor). 0 decision-needed, 4 patch findings (a real functional bug where the Correlation ID click failed to clear other active filters, undermining the story's core purpose; a genuine AC #3 test-coverage gap; an untrimmed filter value; a missing DB index), 2 deferred to `deferred-work.md`, 4 dismissed as noise. All patches fixed via TDD; full regression re-run clean (915 backend tests, 590 frontend tests, 0 failures). This closes out Epic 4 — all 7 stories now `done`. Status set to `done`.
