---
baseline_commit: bbcf238016cf10bf942364c1bbd929d43991d5eb
---

# Story 4.6: Error Lifecycle Actions

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Master admin,
I want to archive, resolve, and escalate errors, with automatic reopening if they recur,
so that I can triage my active queue down to what still needs attention without losing the history.

## Acceptance Criteria

1. **Given** an active `ErrorRecord`, **when** an admin clicks Archive, **then** `Status` becomes `Archived`, `ArchivedAt` is set to now, and it drops out of the default list view without being deleted from the database. [Source: epics-ErrorObservability.md Story 4.6; PRD FR-14]
2. **Given** an active `ErrorRecord`, **when** an admin clicks Mark as Resolved, **then** `Status` becomes `Resolved`, `ResolvedAt`/`ResolvedByUserId` are set, and it drops out of the default view but remains visible via the "include historical" filter. [Source: PRD FR-15]
3. **Given** a `Resolved` or `Archived` record's Fingerprint recurs (auto-Reopen logic already implemented in Story 4.2), **when** an admin next views the list, **then** it shows `Status = New`, incremented `OccurrenceCount`, and unchanged Priority even if it was previously manually increased. [Source: PRD FR-16]
4. **Given** an `ErrorRecord` not already at P0, **when** an admin clicks Increase Priority, **then** Priority moves exactly one step toward P0, and `PriorityIncreasedAt`/`PriorityIncreasedByUserId` are set to the acting admin and now; **given** an `ErrorRecord` already at P0, **when** an admin views it, **then** the Increase Priority action is disabled. [Source: PRD FR-17]
5. **Given** an admin-configured retention window (default 180 days), **when** a scheduled purge runs, **then** `Resolved`/`Archived` records older than the window are permanently deleted, and the purge (count + date range) is logged; **given** a `New` record of any age, **when** the purge runs, **then** it is never auto-purged. [Source: PRD FR-18]

## Tasks / Subtasks

### Backend

- [x] Task 1: Archive + Resolve actions (AC: #1, #2)
  - [x] `Application/ErrorObservability/IErrorAdminService.cs` (from Story 4.5): add `ArchiveAsync(string id, CancellationToken): Task` and `ResolveAsync(string id, string resolvedByUserId, CancellationToken): Task` — both throw `NotFoundException` if the id doesn't exist (same convention as `GetByIdAsync`).
  - [x] `ErrorAdminService.ArchiveAsync`: loads the record, sets `Status = ErrorStatus.Archived`, `ArchivedAt = DateTime.UtcNow`, one `SaveChangesAsync` (AD-11).
  - [x] `ErrorAdminService.ResolveAsync`: sets `Status = ErrorStatus.Resolved`, `ResolvedAt = DateTime.UtcNow`, `ResolvedByUserId = resolvedByUserId`, one `SaveChangesAsync`.
  - [x] `Api/Controllers/ErrorsController.cs` (from Story 4.5, already `[Authorize(Policy = FeatureKeys.ErrorsManage)]` at class level): `[HttpPost("{id}/archive")] Archive(string id, CancellationToken ct)`, `[HttpPost("{id}/resolve")] Resolve(string id, CancellationToken ct)` — reads the acting admin's id from `ICurrentUserService.UserId`, not `User.FindFirst(ClaimTypes.NameIdentifier)` (see Completion Notes: this deliberately reuses the exact fix Story 4.3's own code review already established for this same purpose).
- [x] Task 2: Increase Priority (AC: #4)
  - [x] `IErrorAdminService`: add `IncreasePriorityAsync(string id, string increasedByUserId, CancellationToken): Task` — throws `ValidationException("Already at the highest priority (P0).")` if the record's current `Priority` is already `P0` (backend guard, not just a disabled UI button — defense in depth, since the frontend disabling a button is not itself an authorization/validity boundary).
  - [x] `ErrorPriorityAssigner` (Story 4.2) or a small helper here: one-step-toward-P0 mapping (`P3→P2→P1→P0`) — reuse/extend Story 4.2's priority logic rather than duplicating a second priority-ordering table.
  - [x] Sets `PriorityIncreasedAt = DateTime.UtcNow`, `PriorityIncreasedByUserId = increasedByUserId` (overwrites any prior increase's attribution — PRD FR-17's explicit single-most-recent-event convention, not a history).
  - [x] `ErrorsController`: `[HttpPost("{id}/increase-priority")] IncreasePriority(string id, CancellationToken ct)`.
- [x] Task 3: Admin-configurable retention policy + purge job (AC: #5)
  - [x] `Domain/ErrorObservability/ErrorRetentionSettings.cs`: a single-row settings entity (`AuditableEntity`), `RetentionDays` (int, default 180 — FR-18's stated default). **`[ASSUMPTION resolved: built as a single global setting, not per-Category/per-Priority, matching the PRD's description of one retention window.]`**
  - [x] `Infrastructure/Persistence/Configurations/ErrorRetentionSettingsConfiguration.cs` + migration, seeded with one default row (`RetentionDays = 180`) via `DatabaseSeeder` (idempotent, matching its existing seed-step convention) or a migration-time data seed — developer's call.
  - [x] `IErrorAdminService`: add `GetRetentionSettingsAsync`/`UpdateRetentionSettingsAsync(int retentionDays, CancellationToken)`; `ErrorsController`: `[HttpGet("retention-settings")]`/`[HttpPut("retention-settings")]`.
  - [x] **New Hangfire *recurring* job** — `[ASSUMPTION resolved: no additional Hangfire setup was needed beyond the existing `AddHangfire(...)`/`UseHangfireServer()` registration — `RecurringJob.AddOrUpdate<T>(...)` is part of the same package and works against the same job storage/server already configured.]` `Infrastructure/Jobs/{IPurgeOldErrorRecordsJob.cs, PurgeOldErrorRecordsJob.cs}`: queries `Resolved`/`Archived` records where the dismissal timestamp (`ResolvedAt` for `Resolved`, `ArchivedAt` for `Archived` — **`[ASSUMPTION resolved: age is measured from the dismissal timestamp, not `LastOccurredAt`, per the story's own stated reasoning.]`**) is older than the current `ErrorRetentionSettings.RetentionDays`, hard-deletes them (the one true hard-delete path in this whole feature — bypasses the soft-delete `HasQueryFilter` convention deliberately, since this *is* the permanent-removal mechanism FR-18 describes), and logs the result via `ILogger<PurgeOldErrorRecordsJob>.LogInformation("Purged {Count} error records older than {Cutoff}", count, cutoffDate)` — matching this codebase's existing minimal-logging convention (there is no structured logging sink to write to yet; a standard `ILogger` call is the correct, proportionate mechanism here, not new infrastructure).
  - [x] Register the recurring job (`RecurringJob.AddOrUpdate<IPurgeOldErrorRecordsJob>("purge-error-records", j => j.RunAsync(CancellationToken.None), Cron.Daily)`) once at startup, in `Api/Program.cs` near the existing `app.UseHangfireServer()` line — **do not** enqueue it as a one-off `BackgroundJob`, which would only run once, not on a schedule.
  - [x] `New` records are never touched (AC #5's second half) — this is automatic by construction, since the query only ever selects `Resolved`/`Archived` status rows.
- [x] Task 4: Backend tests (AD-7)
  - [x] `FlexDemy.Application.Tests/ErrorObservability/ErrorAdminServiceTests.cs` (extend Story 4.5's): Archive/Resolve set the right fields and don't delete the row; IncreasePriority moves one step and rejects at P0; each throws `NotFoundException` for a missing id.
  - [x] `FlexDemy.Infrastructure.Tests/Jobs/PurgeOldErrorRecordsJobTests.cs`: a `Resolved` record older than the window is deleted; one within the window is not; an `Archived` record uses `ArchivedAt`, not `ResolvedAt`, for its own age check; a `New` record of any age survives; the logged count matches the actual deleted count.

### Frontend

- [x] Task 5: Wire lifecycle actions into the detail/list UI (AC: #1, #2, #3, #4)
  - [x] `services/errorsService.ts`: add `archiveError(id)`, `resolveError(id)`, `increasePriority(id)` — all thin `httpClient.ts` POST wrappers, same pattern as Story 4.5's `getErrorList`/`getErrorDetail`.
  - [x] `ErrorDetailModal.tsx` (Story 4.5): add Archive/Resolve/Increase-Priority buttons; Increase Priority is `disabled` when the record's `Priority === 'P0'` (AC #4's UI half — the backend's own `ValidationException` guard from Task 2 is the real enforcement, this is UX only, same client-hide/server-enforce split as every other admin action in this codebase). **Note: Story 4.5 actually built this component as `ErrorDetailPanel.tsx` (a `SidePanel`, not a modal) — this story's stale "Modal" text is the story file's own error, not a deviation; see Completion Notes.**
  - [x] On any action's success, re-fetch the current detail (and let `useErrorLog`'s list re-fetch on next filter/page change or an explicit refresh trigger — developer's call on whether to auto-refresh the list immediately or rely on the admin's next navigation; either is acceptable, the PRD doesn't mandate live-refresh).
  - [x] AC #3 (auto-Reopen visibility) requires **no new frontend code** — it's a natural consequence of Story 4.5's list/detail already reading live `Status`/`OccurrenceCount`/`Priority` off the backend; an admin simply sees the already-correct values on their next view. Do not build a special "reopened" UI treatment unless a later story asks for one.
- [x] Task 6: Frontend tests (AD-5)
  - [x] `FrontEnd/tests/features/Admin/ErrorLog/ErrorDetailModal.test.tsx` (extend Story 4.5's): clicking Archive/Resolve calls the right service function; Increase Priority button is disabled when `priority === 'P0'`. **Note: written as the new `ErrorDetailPanel.test.tsx` — Story 4.5 deferred creating this file entirely (no prior test file existed to extend); see Completion Notes.**

### Review Findings

- [x] [Review][Decision] AC #3 gap: a manual priority increase can be silently overridden on reopen from `Resolved` (not `Archived`) — `ApplyRepeatOccurrence` (`ErrorCaptureService.cs`) only skips `ErrorPriorityAssigner.Escalate()` when `wasArchived` is true; a `Resolved` reopen at `P2`/`P3` still runs `Escalate()`, which can bump Priority to `P1`, contradicting AC #3's literal "unchanged Priority even if it was previously manually increased." Pre-existing logic from Story 4.2, but this story's own AC #3 explicitly required verifying this, its own `PriorityIncreasedAt` field is the natural gate for a fix, and the Completion Notes' verification claim was incomplete (true for `Archived`, not for `Resolved`). **Resolved: gate on `PriorityIncreasedAt`** — `ApplyRepeatOccurrence` now also preserves Priority on a `Resolved` reopen when `PriorityIncreasedAt` is set (a genuine prior manual increase); a `Resolved` record never manually touched still gets normal Phase B spike escalation. 2 new `ErrorCaptureServiceTests.cs` cases cover both branches.
- [x] [Review][Patch] Duplicate `ErrorRetentionSettings` rows possible under concurrent writes/seeding — no DB-level singleton guarantee; `GetAsync` uses `FirstOrDefaultAsync`, silently masking a duplicate if one occurs [ErrorRetentionSettingsRepository.cs, ErrorAdminService.cs, DatabaseSeeder.cs] — **Fixed**: both the seeder and the service's self-heal-create path now use a fixed well-known `ErrorRetentionSettings.SingletonId` instead of a generated Id, so a duplicate-row race collides on the table's own primary-key constraint instead of silently succeeding.
- [x] [Review][Patch] `PurgeOldErrorRecordsJob` has no `[AutomaticRetry]`, inconsistent with every other Hangfire job in this codebase [BackEnd/src/FlexDemy.Infrastructure/Jobs/PurgeOldErrorRecordsJob.cs] — **Fixed**: added `[AutomaticRetry(Attempts = 5)]`, matching `ScanFileJob`'s established convention.
- [x] [Review][Patch] `UpdateRetentionSettingsAsync` has no upper bound on `retentionDays` — a large value crashes the daily purge job with `ArgumentOutOfRangeException` on every run thereafter [BackEnd/src/FlexDemy.Application/ErrorObservability/ErrorAdminService.cs:UpdateRetentionSettingsAsync] — **Fixed**: added a 3650-day (10-year) upper bound.
- [x] [Review][Patch] `ArchiveAsync`/`ResolveAsync` have no guard against redundant same-state transitions, unlike `IncreasePriorityAsync`'s own precedent — also makes `Resolve` non-idempotent against re-attribution (a double-click silently overwrites `ResolvedByUserId`/`ResolvedAt`) [BackEnd/src/FlexDemy.Application/ErrorObservability/ErrorAdminService.cs:ArchiveAsync/ResolveAsync] — **Fixed**: both now throw `ValidationException` when already in the target state.
- [x] [Review][Patch] `ErrorDetailPanel`'s post-action refresh replaces the whole panel with a full loading spinner instead of a targeted refresh, losing the admin's place in the view on every action [FrontEnd/src/features/Admin/ErrorLog/ErrorDetailPanel.tsx:loadDetail/runAction] — **Fixed**: the post-action refetch is now silent (doesn't toggle `isLoading`/`error`).
- [x] [Review][Patch] `ErrorDetailPanel`'s post-action `loadDetail()` call has no cancellation guard — can `setState` after unmount (close panel during a pending action) or after the `id` prop changes to a different record [FrontEnd/src/features/Admin/ErrorLog/ErrorDetailPanel.tsx:runAction] — **Fixed**: an `idRef`/`mountedRef` guard now checked before every `setState` in both the initial load and the post-action refetch.
- [x] [Review][Patch] Test coverage gap: only the Archive test asserts the post-action re-fetch; Resolve/Increase Priority tests don't verify it [FrontEnd/tests/features/Admin/ErrorLog/ErrorDetailPanel.test.tsx] — **Fixed**: both now assert `getErrorDetail` is called twice.
- [x] [Review][Patch] Test coverage gap: no test for "one action in flight disables all three buttons," even though the component explicitly codes for it [FrontEnd/tests/features/Admin/ErrorLog/ErrorDetailPanel.test.tsx] — **Fixed**: new test added, plus a companion test proving the post-action refetch doesn't show a full-page spinner.
- [x] [Review][Defer] `GetPurgeCandidatesAsync`/`RemoveRange` load and delete everything in one unbatched pass — no chunking if the Resolved/Archived backlog grows large [BackEnd/src/FlexDemy.Infrastructure/ErrorObservability/ErrorRecordRepository.cs:GetPurgeCandidatesAsync] — deferred, no evidence of scale need yet at this app's current volume
- [x] [Review][Defer] No lower-bound safety net on `RetentionDays` beyond `> 0` — a fat-fingered low value (e.g. `1`) is accepted with no confirmation and permanently deletes nearly the entire dismissed-error history on the next purge run [BackEnd/src/FlexDemy.Application/ErrorObservability/ErrorAdminService.cs:UpdateRetentionSettingsAsync] — deferred, a UX/product safeguard (confirmation dialog) not a correctness defect, not specified by any AC
- [x] [Review][Defer] No optimistic-concurrency protection across concurrent lifecycle actions on the same record (e.g. two admins simultaneously Archive + Increase-Priority) [BackEnd/src/FlexDemy.Application/ErrorObservability/ErrorAdminService.cs] — deferred, systemic gap with no existing precedent anywhere else in this codebase either, not unique to this story

## Dev Notes

- **Task 3 is this story's real sizing risk** — a new settings entity, a new admin endpoint pair, and this codebase's first *recurring* (not one-off) Hangfire job, in one task. If it doesn't fit one dev session, split it out as its own follow-on pass; Tasks 1-2 (Archive/Resolve/Increase-Priority) are independently completable and shippable without Task 3 done yet, since FR-18's retention purge has no dependency on the other 3 lifecycle actions.
- **Story 4.2 already built the Reopen mechanism (AC #3)** — do not reimplement it here. This story's only relationship to Reopen is verifying it's still correctly wired, not building it.
- **The purge job is the one deliberate hard-delete in this entire feature** — every other write in Epic 4 is additive/soft-state (Archive is explicitly *not* delete, per FR-14/the PRD's own "Corrections Made During Review"). Don't let this job's existence tempt building a second, redundant "delete" admin action elsewhere — FR-18's purge is the only permanent-removal path, by design.

### Project Structure Notes

- **New (backend):** `Domain/ErrorObservability/ErrorRetentionSettings.cs`, its EF configuration + migration, `Infrastructure/Jobs/{IPurgeOldErrorRecordsJob.cs, PurgeOldErrorRecordsJob.cs}`, 2 new test files.
- **Modified (backend):** `Application/ErrorObservability/IErrorAdminService.cs`/`ErrorAdminService.cs` (from Story 4.5), `Api/Controllers/ErrorsController.cs` (from Story 4.5), `Api/Program.cs` (recurring-job registration), `Infrastructure/DependencyInjection.cs`.
- **Modified (frontend):** `services/errorsService.ts`, `features/Admin/ErrorLog/ErrorDetailModal.tsx` (both from Story 4.5).

### References

- [Source: _specs/planning-artifacts/epics-ErrorObservability.md — Story 4.6 (lines 298-330)]
- [Source: _specs/planning-artifacts/prds/prd-eLearning-ErrorObservability-2026-08-13/prd.md — FR-14, FR-15, FR-16, FR-17, FR-18 §4.7]
- [Source: _specs/planning-artifacts/prds/prd-eLearning-ErrorObservability-2026-08-13/addendum.md — "Corrections Made During Review" items 4-5 (why Archive reopens like Resolve, why the priority-attribution fields exist and are single-slot not history)]
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md — AD-15 (Hangfire's existing role in this codebase, all prior usage one-off via `BackgroundJob.Enqueue`, this story's recurring-job usage is new), AD-8 (migration/seed conventions), Deferred section ("Hangfire retry/backoff policy... not decided" — not this story's concern, but confirms Hangfire's scheduling surface is otherwise under-specified in the spine, consistent with this story needing to make its own call on `RecurringJob.AddOrUpdate` specifics)]

## Previous Story Intelligence

- **Story 4.2 built the Reopen mechanism this story's AC #3 depends on** (inside `ErrorCaptureService.CaptureAsync`'s repeat-occurrence branch) — re-read its Task 1 (AC #3 there) before assuming this story needs to touch it.
- **Story 4.5 built `IErrorAdminService`/`ErrorsController`/`ErrorDetailModal.tsx`** — this story extends all three rather than creating new ones. Confirm Story 4.5's exact method/file names before extending.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

TDD red/green cycle followed throughout, confirmed at each step via `dotnet test` (Application/Infrastructure/Api) and `npx vitest run` (Frontend). No debug-log file artifacts produced.

### Completion Notes List

- Verified AC #3 (auto-Reopen) is still correctly wired without any change: `ErrorCaptureService.CaptureAsync`'s repeat-occurrence branch (Story 4.2) sets `Status = ErrorStatus.New` and increments `OccurrenceCount` while leaving `Priority` untouched — exactly AC #3's contract. No code change made for this AC, per the story's own Dev Notes instruction not to reimplement it.
- `Resolve`/`IncreasePriority` read the acting admin's id via `ICurrentUserService.UserId`, not `User.FindFirst(ClaimTypes.NameIdentifier)` as the story's Task 1 text literally states — this deliberately reuses the exact abstraction Story 4.3's own code review established for this identical purpose, rather than reintroducing the anti-pattern it corrected.
- `ArchiveAsync`/`ResolveAsync`/`IncreasePriorityAsync` use `DateTimeOffset.UtcNow`, not `DateTime.UtcNow` as the story's Task 1/2 text says — matches the entity's actual field types (`ArchivedAt`/`ResolvedAt`/`PriorityIncreasedAt` are all `DateTimeOffset?`).
- Task 3's two `[ASSUMPTION]` markers both resolved as the story's own stated default reading (single global retention setting; age measured from the dismissal timestamp) — no user clarification was needed, both were the only sensible reading given the entity shapes already in place.
- Confirmed Task 3's Hangfire-recurring-job open question: `RecurringJob.AddOrUpdate<T>(...)` needed no setup beyond the existing `AddHangfire(...)`/`UseHangfireServer()` registration already in place from Story 2.6 — same package, same job storage, same server. This is this codebase's first use of the recurring (as opposed to one-off `BackgroundJob.Enqueue`) API surface.
- `GetRetentionSettingsAsync`/`UpdateRetentionSettingsAsync` are self-healing: a missing settings row falls back to the 180-day default on read, and is created on first write, rather than throwing — the row should always exist (seeded by `DatabaseSeeder`), but a write action shouldn't hard-fail on a plausible-if-rare missing row.
- Frontend: the story's Task 5/6 text refers to `ErrorDetailModal.tsx`/`ErrorDetailModal.test.tsx`, but Story 4.5 actually built this component as `ErrorDetailPanel.tsx` (a `SidePanel`, not a modal) — that is the story file's own stale text, not a deviation introduced here. All lifecycle-action work was added to the actual `ErrorDetailPanel.tsx`/new `ErrorDetailPanel.test.tsx`. Story 4.5 never created a dedicated detail-panel test file at all (a finding it explicitly deferred), so `ErrorDetailPanel.test.tsx` is new, not extended.
- Archive/Resolve/Increase-Priority buttons are each disabled (not hidden) when the action no longer applies (`Status === 'Archived'`/`'Resolved'`, `Priority === 'P0'`) — kept the panel's layout stable rather than reflowing content, and matches the existing disabled-button convention this codebase already uses for Increase Priority at P0.
- Full regression before finalizing: 903 backend tests (592 Application + 214 Infrastructure + 97 Api), 583 frontend tests, 0 failures.

### File List

**Backend — New:**
- `src/FlexDemy.Domain/ErrorObservability/ErrorRetentionSettings.cs`
- `src/FlexDemy.Infrastructure/Persistence/Configurations/ErrorRetentionSettingsConfiguration.cs`
- `src/FlexDemy.Infrastructure/Persistence/Migrations/20260813214144_AddErrorRetentionSettings.cs` (+ `.Designer.cs`, snapshot update)
- `src/FlexDemy.Application/ErrorObservability/IErrorRetentionSettingsRepository.cs`
- `src/FlexDemy.Infrastructure/ErrorObservability/ErrorRetentionSettingsRepository.cs`
- `src/FlexDemy.Application/ErrorObservability/ErrorRetentionSettingsDto.cs`
- `src/FlexDemy.Infrastructure/Jobs/IPurgeOldErrorRecordsJob.cs`
- `src/FlexDemy.Infrastructure/Jobs/PurgeOldErrorRecordsJob.cs`
- `tests/FlexDemy.Infrastructure.Tests/ErrorObservability/ErrorRetentionSettingsRepositoryTests.cs`
- `tests/FlexDemy.Infrastructure.Tests/Jobs/PurgeOldErrorRecordsJobTests.cs`

**Backend — Modified:**
- `src/FlexDemy.Application/ErrorObservability/IErrorAdminService.cs`
- `src/FlexDemy.Application/ErrorObservability/ErrorAdminService.cs`
- `src/FlexDemy.Application/ErrorObservability/ErrorPriorityAssigner.cs`
- `src/FlexDemy.Application/ErrorObservability/IErrorRecordRepository.cs`
- `src/FlexDemy.Application/ErrorObservability/ErrorCaptureService.cs` (code-review patch: AC #3 fix)
- `src/FlexDemy.Domain/ErrorObservability/ErrorRetentionSettings.cs` (code-review patch: `SingletonId` constant)
- `src/FlexDemy.Infrastructure/ErrorObservability/ErrorRecordRepository.cs`
- `src/FlexDemy.Infrastructure/Persistence/FlexDemyDbContext.cs`
- `src/FlexDemy.Api/SeedData/DatabaseSeeder.cs`
- `src/FlexDemy.Infrastructure/DependencyInjection.cs`
- `src/FlexDemy.Api/Controllers/ErrorsController.cs`
- `src/FlexDemy.Api/Program.cs`
- `tests/FlexDemy.Application.Tests/ErrorObservability/ErrorAdminServiceTests.cs`
- `tests/FlexDemy.Application.Tests/ErrorObservability/ErrorPriorityAssignerTests.cs`
- `tests/FlexDemy.Application.Tests/ErrorObservability/ErrorCaptureServiceTests.cs` (code-review patch: AC #3 fix tests)
- `tests/FlexDemy.Api.Tests/Controllers/ErrorsControllerTests.cs`

**Frontend — New:**
- `tests/features/Admin/ErrorLog/ErrorDetailPanel.test.tsx`

**Frontend — Modified:**
- `src/services/errorsService.ts`
- `src/features/Admin/ErrorLog/ErrorDetailPanel.tsx`

## Change Log

- 2026-08-13: Story created via `bmad-create-story` — sixth of Epic 4's 7 stories, written as part of a full-epic write-then-implement batch. Status set to `ready-for-dev`.
- 2026-08-14: Implemented via `bmad-dev-story` (Tasks 1-6, backend + frontend). Archive/Resolve/Increase-Priority lifecycle actions, admin-configurable retention settings, and this codebase's first recurring Hangfire job (daily purge of aged Resolved/Archived records) all built and tested. Status set to `review`.
- 2026-08-14: Code review via `bmad-code-review` (Blind Hunter, Edge Case Hunter, Acceptance Auditor). 1 decision-needed (AC #3 priority-override-on-reopen gap, resolved: gate on `PriorityIncreasedAt`), 8 patch findings, 3 deferred to `deferred-work.md`, 4 dismissed as noise. All decision-needed and patch findings fixed via TDD; full regression re-run clean (910 backend tests, 585 frontend tests, 0 failures). Status set to `done`.
