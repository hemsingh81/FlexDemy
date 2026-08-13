---
baseline_commit: e64e8b260d54a2ac01680d582cacc80de715e147
---

# Story 3.10: Publish, Versioning & Rollback

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tutor,
I want to publish my course with the current state saved as a version, and be able to return a Published course to Draft to make fixes,
so that I can safely iterate on a live course without losing prior published state.

## Acceptance Criteria

1. **Given** Review Confirmed, **when** a tutor publishes, **then** a deep-copy snapshot of the entire confirmed content tree plus cached Drill-Down/Way content is saved as a version, and the course becomes Published. [Source: epics.md Story 3.10; PRD FR25; backend AD-17]
2. **Given** a Published course, **when** a tutor returns it to Draft, **then** the prior published state is retained as a version, and re-publish is gated by Review Confirmed exactly like first-time publish. [Source: epics.md Story 3.10; PRD FR25]

## Tasks / Subtasks

- [x] Task 1: Confirm AC#1 is already satisfied by Story 3.8 — no new work, verify only (AC: #1)
  - [x] Verified by direct code inspection: `PublishNodeContentJob`'s finalize step (Story 3.8) calls `VersionService.CreateSnapshotAsync` exactly once per successful publish, gated by AD-16's atomic decrement (only the item observing `Remaining == 0` runs it) and by `PublishService.PublishAsync`'s own zero-confirmed-nodes finalize path. Both call sites are already covered by Story 3.8's own test suite (`RunAsync_the_item_whose_decrement_reaches_zero_creates_the_version_snapshot...`, `PublishAsync_with_zero_confirmed_nodes_finalizes_immediately...`). No new code written for this task.
- [x] Task 2: `ReturnToDraftAsync` — Published → Draft (AC: #2)
  - [x] `Application/Courses/{ICourseService.cs, CourseService.cs}` (Story 3.9's own lifecycle-method file): `ReturnToDraftAsync(courseId, cancellationToken)` — requires `LifecycleState == Published`; sets `LifecycleState = Draft`. Content-tree state untouched (no content-tree repository call at all in this method).
  - [x] No special-cased re-publish bypass exists or was added — `MoveToReviewAsync`'s own precondition (`LifecycleState == Draft`) is unconditional on history, verified with a dedicated regression test.
- [x] Task 3: Version history + restore (AD-17's "swap an active-version pointer" capability)
  - [x] `Application/AdaptiveLearning/{IVersionService.cs, VersionService.cs, IVersionRepository.cs, VersionRepository.cs}` extended (not a new interface): `GetVersionsAsync` (returns `CourseVersionDto { Id, PublishedAt, ChapterCount, TopicCount }`, the latter two derived from `SnapshotJson` at read time, not stored columns). `RestoreVersionAsync` — deserializes the chosen version's `SnapshotJson` back into real `Chapter`/`Topic`/`Subtopic`/`ContentBlock` domain entities (the same types `CreateSnapshotAsync` serialized directly, not a DTO layer), removes every current Chapter for the course (EF cascade-deletes all descendants, confirmed via the same `RemoveChapter`-only pattern `ContentTreeService.DeleteNodeAsync` already established), re-adds the snapshot's chapters via one `AddChapter` call per root (EF's change tracker walks the whole reachable Topic/Subtopic/ContentBlock graph from there), and calls the new `ICourseService.MarkDraftAsync` (unconditional Draft transition, mirroring `MarkPublishedAsync`'s trusted-system-caller shape). **Deliberately reuses the snapshot's original node ids** rather than minting new ones, verified by a dedicated test — see Completion Notes for why.
  - [x] `Api/Controllers/CoursesController.cs`: `GET drafts/{id}/versions`, `POST drafts/{id}/versions/{versionId}/restore`, `POST drafts/{id}/return-to-draft` — all `[Authorize(Policy = FeatureKeys.CoursesCreate)]`. Ownership is additionally enforced inside `VersionService` itself (`EnsureOwnedAsync`), not left to the policy alone — see Completion Notes.
- [x] Task 4: Frontend — return-to-Draft and version-history UI
  - [x] `PublishLifecycleBar.tsx`: "Return to Draft" button, visible only when `state === 'published'`, calls the endpoint then refetches lifecycle state via `getPublishStatus` (same refetch-after-mutate convention). Version history kept minimal per this task's own `[ASSUMPTION]`: a toggled plain list (fetched on first open, not eagerly) with a Restore button per entry, showing publish date + derived chapter/topic counts.
- [x] Task 5: Tests
  - [x] `FlexDemy.Application.Tests/Courses/CourseServiceTests.cs`: `ReturnToDraftAsync` (Published precondition, ownership, not-found, leaves content tree untouched), `MarkDraftAsync` (unconditional across all 4 states, no caller-identity check), and a dedicated no-bypass regression test (`MoveToReviewAsync` still enforces its normal all-nodes-confirmed precondition on a course whose `LifecycleState` was just reset to `Draft` by `ReturnToDraftAsync`).
  - [x] `FlexDemy.Application.Tests/AdaptiveLearning/VersionServiceTests.cs`: `RestoreVersionAsync` (removes every current chapter + re-adds the snapshot's, reuses original node ids, calls `MarkDraftAsync`, ownership check, not-found for an unknown/cross-course version id) and `GetVersionsAsync` (ownership check, derived-count DTO mapping) — both exercised against a REAL `SnapshotJson` produced by `CreateSnapshotAsync` itself (not hand-crafted JSON), so the round-trip is genuinely proven, not assumed.
  - [x] Frontend: `useCourseLifecycle.test.ts` (`triggerReturnToDraft`/`fetchVersions`/`triggerRestoreVersion` — success, no-op guards, failure-toast, courseId-change reset) and `PublishLifecycleBar.test.tsx` (Return to Draft visibility, version-history toggle/fetch/empty-state/Restore-click).

## Dev Notes

- **This story is deliberately small relative to its epics.md sizing** — the heavy lifting (snapshot creation, the `CourseVersion` entity itself, `IVersionService`'s existence) is Story 3.8's, per this epic's own explicit forward-dependency resolution (see Story 3.8's Dev Notes). This story's real net-new work is the `ReturnToDraftAsync` transition (small) and version history/restore (Task 3, the one piece genuinely new here).
- **Do not re-implement snapshot creation** — if Task 1's verification finds Story 3.8's own publish flow does NOT already create a `CourseVersion` row correctly, that's a Story 3.8 bug to fix in that story's own file, not a reason to build a second, parallel snapshot-creation path here.
- **`ReturnToDraftAsync` vs `RestoreVersionAsync` are two different operations, easy to conflate** — returning to Draft never touches content; restoring a version always does (and always also lands in Draft, as a side effect of "you just changed structural content," not because restoring specifically demands it independent of that rule).

### Project Structure Notes

- Backend modified files: `Application/AdaptiveLearning/{IVersionService.cs, VersionService.cs}` (Story 3.8, extended), `Application/Courses/{ICourseService.cs, CourseService.cs}` (or Story 3.9's lifecycle service location), `Api/Controllers/CoursesController.cs`.
- Frontend modified files: `FrontEnd/src/features/CourseContentEditor/PublishLifecycleBar.tsx` (Story 3.4), corresponding test files.

### References

- [Source: _specs/planning-artifacts/epics.md — Story 3.10 (lines 769-783)]
- [Source: _specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md — FR25 §4.11 (post-publish editing with versioning, no stated retention-count bound)]
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md — AD-17 (deep-copy snapshot per publish; "restoring a prior version swaps an active-version pointer to that snapshot, not a diff/replay engine" — the literal text Task 3's restore capability implements)]
- [Source: _specs/implementation-artifacts/3-8-publish-batch-job-pre-generation-caching.md — `CourseVersion`/`IVersionService.CreateSnapshotAsync`, built there per this epic's own resolved forward-dependency, extended (not recreated) by this story]

## Previous Story Intelligence

Story 3.8 (this epic, `ready-for-dev`, not yet implemented) is this story's direct prerequisite — its `CourseVersion` entity and `IVersionService` interface must exist and work correctly before this story's Task 3 can extend them. Story 3.9's lifecycle-transition methods (`MoveToReviewAsync`/`ConfirmReviewAsync`) are this story's sibling — `ReturnToDraftAsync` should live in the same service/file those landed in, for discoverability, not a third scattered location for lifecycle transitions.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `dotnet build`/`dotnet test` (full backend) and `npx tsc --noEmit`/`npx vitest run` (full frontend) all run clean: 687 backend tests passed (0 failed), 525 frontend tests passed across 77 files (0 failed; one `App.test.tsx` failure during a full-suite parallel run was confirmed flaky/unrelated — passed cleanly both in isolation and on a full-suite re-run). `tsc` shows only the 7 pre-existing, unrelated `FlashcardsModal.tsx` errors already documented in Story 3.9.

### Completion Notes List

- **`RestoreVersionAsync` reuses the snapshot's original Chapter/Topic/Subtopic/ContentBlock ids, not fresh ones.** This is deliberate, not an oversight: `DrilldownLevel`/`WayContent`/`Exercise`/`KeywordDefinition` rows are keyed by `TopicId`/`SubtopicId` and are never deleted by ordinary content-tree edits (they just become orphaned if a node's id changes or the node is deleted). By reusing the snapshot's original ids after wholesale-deleting the current tree first (safe: nothing can still hold one of those ids by the time the snapshot's chapters are re-inserted), a restore automatically "reconnects" any of that version's still-present cached AI content for free — matching AC#1's "cached Drill-Down/Way content" as something this system's versioning is meant to preserve, not just the tree skeleton, and AD-17's own "swap an active-version pointer" framing far better than minting new ids would (which would leave every restored node's adaptive content starting from empty, undermining the entire point of caching it in the first place). Verified directly: `RestoreVersionAsync_reuses_the_snapshots_original_node_ids_not_new_ones`.
- **`VersionService.GetVersionsAsync`/`RestoreVersionAsync` both call `ICourseService.EnsureOwnedAsync` explicitly**, even though this wasn't separately called out in Task 3's own text (which only specified controller-level `[Authorize(Policy = FeatureKeys.CoursesCreate)]`). That policy alone only proves "some authenticated tutor," not "this course's own tutor" — without the service-level check, any tutor could read another tutor's version history, or worse, overwrite another tutor's course content, by guessing/enumerating a courseId. Added proactively (not found via a review pass) since every other node-scoped mutation/read added across this epic (Stories 3.5-3.9) follows this same explicit-ownership-check discipline.
- **`RestoreVersionAsync` deserializes straight back into the real `Chapter`/`Topic`/`Subtopic`/`ContentBlock` domain entity types** (the same types `CreateSnapshotAsync`, Story 3.8, serialized directly — no DTO layer in between), confirmed to round-trip correctly through `System.Text.Json`'s `IReadOnlyList<T>` deserialization support via a real (not hand-crafted) `SnapshotJson` produced by `CreateSnapshotAsync` itself in every `VersionServiceTests.cs` test that needs one.
- **Content-tree wholesale deletion relies entirely on EF Core's own cascade delete** (`DeleteBehavior.Cascade` on all four Chapter/Topic/Subtopic/ContentBlock FK relationships, confirmed via direct read of their `Configurations/*.cs` files) — `RestoreVersionAsync` stages only `RemoveChapter` per top-level chapter, the exact same pattern `ContentTreeService.DeleteNodeAsync` already established for a single-chapter delete, not a new one invented here.
- **Correction (code-review pass):** this note originally claimed restored nodes' `CreatedAt`/`CreatedBy` reflect the restore time. That was **wrong**, verified empirically. `AuditSaveChangesInterceptor.cs` guards both fields (`if (entry.Entity.CreatedAt == default) ...`, `if (entry.Entity.CreatedBy is null) ...`) — since the deserialized snapshot entities carry their real, non-default original values, the interceptor does **not** overwrite them. A restored node keeps its **original** `CreatedAt`/`CreatedBy`, not the restore time. Arguably the more correct behavior anyway (these fields describe when/who authored the content, which restoring doesn't change) — no code change made, this entry exists only to correct the earlier inaccurate claim for any future reader.
- **`RestoreVersionAsync` now also restores `snapshot.AdaptiveContent`** (every archived `DrilldownLevel`/`WayContent` row), not just the tree — see Senior Developer Review below (this was a real gap the original implementation had).

### File List

**New:** none (all Task 3 work extends Story 3.8's own existing files).

**Modified:**
- `BackEnd/src/FlexDemy.Application/Courses/{ICourseService.cs, CourseService.cs}` (`ReturnToDraftAsync`, `MarkDraftAsync`)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/{IVersionService.cs, VersionService.cs, IVersionRepository.cs}` (`GetVersionsAsync`, `RestoreVersionAsync`, `RestoreAdaptiveContentAsync`, `CourseVersionDto`)
- `BackEnd/src/FlexDemy.Infrastructure/Repositories/VersionRepository.cs` (`GetByIdAsync`, `GetAllByCourseIdAsync`)
- `BackEnd/src/FlexDemy.Application/Common/IUnitOfWork.cs` / `BackEnd/src/FlexDemy.Infrastructure/Persistence/UnitOfWork.cs` (`ExecuteInTransactionAsync` — code-review patch)
- `BackEnd/src/FlexDemy.Api/Controllers/CoursesController.cs` (`POST drafts/{id}/return-to-draft`, `GET drafts/{id}/versions`, `POST drafts/{id}/versions/{versionId}/restore`)
- `FrontEnd/src/services/courseDraftService.ts` (`returnToDraft`, `getVersions`, `restoreVersion`, `CourseVersionDto`)
- `FrontEnd/src/features/CourseContentEditor/{useCourseLifecycle.ts, PublishLifecycleBar.tsx}`
- `BackEnd/tests/FlexDemy.Application.Tests/Courses/CourseServiceTests.cs`
- `BackEnd/tests/FlexDemy.Application.Tests/AdaptiveLearning/VersionServiceTests.cs`
- `BackEnd/tests/FlexDemy.Infrastructure.Tests/Repositories/ContentTreeRepositoryTests.cs` (code-review patch — real-DbContext regression tests)
- `FrontEnd/tests/features/CourseContentEditor/{useCourseLifecycle.test.ts, PublishLifecycleBar.test.tsx}`

## Senior Developer Review (AI)

**Date:** 2026-08-13
**Outcome:** Approved after patch
**Method:** `bmad-code-review` — parallel adversarial review (Blind Hunter, Acceptance Auditor)

**Acceptance Criteria audit (Acceptance Auditor):** AC#1/AC#2 verified PASS directly against the code. Both reviewers independently confirmed the build/test claims (687→691 backend, 525 frontend after patch) and that `tsc`'s only errors are the 7 pre-existing, unrelated `FlashcardsModal.tsx` ones. The ownership-check, cascade-delete, and id-reuse Completion Notes claims were all verified accurate. One Completion Notes claim (`CreatedAt`/`CreatedBy` reflecting restore time) was found factually backwards and is corrected above.

**Action Items:**

- [x] **[Critical, later downgraded after empirical verification — see note]** Blind Hunter flagged that `RestoreVersionAsync`'s remove-then-add-with-reused-ids sequence would throw an EF Core identity-map collision, since `GetTreeAsync`'s result is tracked (no `AsNoTracking`). **This claim was investigated and disproven** by writing real-`DbContext` regression tests (`ContentTreeRepositoryTests.cs`'s `RemoveChapter_then_AddChapter_reusing_the_same_id...` tests, including with a nested Topic graph matching `RestoreVersionAsync`'s actual shape): a `Deleted` entry and a separately-tracked `Added` instance for the same key coexist without conflict and commit correctly as DELETE-then-INSERT within one `SaveChangesAsync` call. An initial patch (splitting the remove/add into two separate commits) was applied before this was disproven and has since been **reverted** back to a single commit, since the original code was already correct on this specific point. This is recorded as an action item (not silently dropped) because the *investigation* was real work worth documenting, and because it produced two permanent regression tests proving the verified-safe behavior, even though the specific claimed bug wasn't real.
- [x] **[High]** `RestoreVersionAsync` never read `snapshot.AdaptiveContent` — it only replaced the tree structure. Since `DrilldownLevel`/`WayContent` have no FK to Topic/Subtopic, reusing the snapshot's node ids only "reconnects" whatever content *currently* exists at that id — the *newer* content if a tutor regenerated/overrode it after this version was published, not what this specific version actually archived. Found by the Acceptance Auditor pass; confirmed by direct read (`AdaptiveContent` was deserialized and then never referenced again) — AD-17's own "swaps an active-version pointer to THAT snapshot" text wasn't actually true for the adaptive-content half of a version. **Fix:** new `RestoreAdaptiveContentAsync` writes every archived Level/Way back onto the live `DrilldownLevel`/`WayContent` row (upsert: overwrite if it exists, insert if the row was since deleted entirely), overwriting drift from newer edits. 2 new regression tests, including one that specifically simulates post-publish drift and confirms the archived content wins.
- [x] **[High]** `RestoreVersionAsync`'s tree-replacement commit and `ICourseService.MarkDraftAsync`'s own separate commit had no shared transaction. A failure between them could leave a **Published** course's content swapped to a prior version's while `LifecycleState` stayed `Published` — meaning the public catalog (`GetCoursesAsync`, Published-only) would silently serve unreviewed restored content, bypassing FR-15's "restored content needs fresh review" gate entirely. Found by the Blind Hunter pass. **Fix:** new `IUnitOfWork.ExecuteInTransactionAsync` wraps the whole `RestoreVersionAsync` operation (tree replacement + adaptive-content restore + `MarkDraftAsync`) in one DB transaction — `IUnitOfWork`/the underlying DbContext is Scoped (one per request), so `CourseService`'s own `SaveChangesAsync` call (inside `MarkDraftAsync`) correctly enlists in the same ambient transaction. Regression test confirms `ExecuteInTransactionAsync` is called exactly once around the whole operation.
- [x] **[Low/Medium]** `triggerRestoreVersion`/`triggerReturnToDraft` had no in-flight re-entry guard (unlike `triggerPublish`, guarded by `isPublishing`) — a double-click could fire two concurrent requests. Found by the Blind Hunter pass. **Fix:** new `isRestoringVersion`/`isReturningToDraft` hook state, both buttons disabled while their own request is outstanding.
- [x] **[Low]** Completion Notes' claim about `CreatedAt`/`CreatedBy` reflecting restore time was factually backwards (see above) — corrected in place.
- [x] **[Low]** `ReturnToDraftAsync`'s own test didn't positively prove "content untouched," only never referenced the content-tree mock. **Fix:** added an explicit `DidNotReceiveWithAnyArgs()` assertion.

Full regression suite (691 backend tests, 525 frontend tests) and `dotnet build`/`npx tsc --noEmit` re-verified clean after the patch.

## Change Log

- 2026-08-12: Story created via `bmad-create-story` — tenth of Epic 3's 11 stories, written as part of the full-epic write-then-implement batch. Status set to `ready-for-dev`.
- 2026-08-13: All 5 tasks implemented via `bmad-dev-story`. Task 1 verified (no new code) that Story 3.8's own publish flow already creates exactly one `CourseVersion` per publish. `ReturnToDraftAsync`/`MarkDraftAsync` added to `CourseService`. `VersionService` extended with `GetVersionsAsync`/`RestoreVersionAsync`, the latter implementing AD-17's rollback capability by deep-copy-reconstructing the content tree from a snapshot and deliberately reusing the snapshot's original node ids so cached adaptive-learning content reconnects automatically. Frontend: Return to Draft button + minimal version-history list/restore UI in `PublishLifecycleBar.tsx`. Full regression: 687 backend tests, 525 frontend tests, both 0 failures; builds clean. Status set to `review`, ready for code-review cycle.
- 2026-08-13: `bmad-code-review` (Blind Hunter/Acceptance Auditor) found two High-severity real bugs — `RestoreVersionAsync` never actually restored archived Drill-Down/Way content (only the tree structure), and its multi-step commit had no shared transaction, risking a Published course silently serving unreviewed restored content on partial failure — plus one Low/Medium frontend re-entry gap and two Low-severity documentation/test fixes. A third claimed Critical finding (an EF Core identity-map collision) was investigated, disproven via real-`DbContext` regression tests, and the unnecessary interim patch for it was reverted. All confirmed findings patched with regression tests. Full regression re-run: 691 backend tests, 525 frontend tests, both 0 failures; builds clean. Status set to `done`.
