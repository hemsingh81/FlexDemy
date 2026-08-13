---
baseline_commit: e64e8b260d54a2ac01680d582cacc80de715e147
---

# Story 3.9: Review as Student & Lifecycle Transitions

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tutor,
I want to experience my course exactly as a student would before publishing,
so that I catch issues before students ever see them.

## Acceptance Criteria

1. **Given** all nodes are confirmed, **when** a tutor triggers "Review as Student", **then** it reuses `CoursePlayer`'s real adaptive-learning components via the sanctioned `CourseContentEditor` → `CoursePlayer` cross-feature import, and the course transitions to In Review. [Source: epics.md Story 3.9; PRD FR23; frontend AD-3]
2. **Given** Review is not yet Confirmed, **when** any earlier Lifecycle State is active, **then** Publish remains unreachable. [Source: epics.md Story 3.9; PRD FR24]
3. **Given** Story 3.4's UI, **when** real lifecycle state changes, **then** it reflects real transitions instead of mock state. [Source: epics.md Story 3.9]
4. **Given** a Draft course with wizard metadata and content-tree state, **when** a tutor leaves and later returns (including across a logout/login boundary), **then** the course resumes exactly where it was left, combining wizard and content-tree state coherently. [Source: epics.md Story 3.9; PRD FR22]

## Tasks / Subtasks

### Backend

- [x] Task 1: Real lifecycle transition methods (AC: #1, #2, #3)
  - [x] `Application/Courses/{ICourseService.cs, CourseService.cs}` (kept on `CourseService.cs`, not split into a new `ILifecycleService.cs` -- both new methods are small and `CourseService.cs` already owns every other `LifecycleState` transition): `MoveToReviewAsync(courseId, cancellationToken): Task` — **requires every node in the content tree (all 4 entity types: Chapter/Topic/Subtopic/ContentBlock) to be `Confirmed`**, via a new `FindFirstUnconfirmedNodeReason` helper walking `IContentTreeRepository.GetTreeAsync`'s result depth-first, throwing `ValidationException` naming the first unconfirmed node (a Chapter/Topic/Subtopic by title, a ContentBlock by its parent Topic/Subtopic since it has no title of its own); requires `LifecycleState == Draft`; sets `LifecycleState = InReview`.
  - [x] `ConfirmReviewAsync(courseId, cancellationToken): Task` — requires `LifecycleState == InReview`; sets `LifecycleState = ReviewConfirmed`.
  - [x] `Api/Controllers/CoursesController.cs`: `POST drafts/{id}/move-to-review`, `POST drafts/{id}/confirm-review`, both `[Authorize(Policy = FeatureKeys.CoursesCreate)]`.
- [x] Task 2: Allow Review-as-Student to call adaptive-learning generation on a non-Published course (AC: #1)
  - [x] Widened `AdaptiveLearningService`'s (Story 3.5) `EnsurePublishedAsync` → renamed `EnsureViewableForGenerationAsync`, now `LifecycleState is Published or InReview or ReviewConfirmed`, with `ICourseService.EnsureOwnedAsync` reused explicitly for the two non-Published states (Draft still excluded). Identical widening applied to `ExerciseService.cs`'s own copy (Story 3.6) and newly ADDED to `KeywordDefinitionService.DefineAsync` (Story 3.7), which had built no lifecycle gate at all until now (see Completion Notes).
- [x] Task 3: Draft resume coherence (AC: #4)
  - [x] **Verified, not rebuilt.** Confirmed via direct code read: this app has no router at all and no drafts-list UI — a Draft can only ever be reached through the linear "create new → wizard finishes → content editor opens with that fresh draftId" flow; there is no GET-by-id fetch path for wizard metadata anywhere, and no way to resume an existing Draft's metadata or content tree once the wizard closes. This is a genuine, real gap, exactly matching this task's own `[ASSUMPTION]` — flagged in Completion Notes rather than silently built as new scope (would require a router, a drafts-list screen, a GET-by-id wizard resume mode, and a get-draft backend read function — a materially larger undertaking than this story's own task list anticipated).

### Frontend

- [x] Task 4: Real-wire `useCourseLifecycle` to Task 1's endpoints (AC: #2, #3)
  - [x] `FrontEnd/src/features/CourseContentEditor/useCourseLifecycle.ts`: replaced the mock `setInterval` state machine with real calls — `triggerReviewAsStudent` → `POST .../move-to-review`, `triggerConfirmReview` → `POST .../confirm-review`, `triggerPublish` → Story 3.8's real publish endpoint then a `getPublishStatus` re-fetch, checklist polling → Story 3.8's real `GET .../publish-status` (same poll-while-non-terminal idiom `useFileUpload.ts` established). Kept the exact same exported shape (`state`, `isPublishing`, `checklist`, the 4 trigger/retry functions) plus one new optional second parameter (`onReviewAsStudentReady?`), needed for Task 5's wiring -- see Completion Notes for why this one addition was necessary and how it was kept minimal.
- [x] Task 5: Review-as-Student mode — the sanctioned cross-feature import (AC: #1)
  - [x] Extracted `CoursePlayer.tsx`'s own inline "selected content node" reading-pane JSX into a new shared `FrontEnd/src/features/CoursePlayer/ContentNodeReadingPane.tsx` (rendering `KeywordText`/`ExerciseRunner`), so both `CoursePlayer.tsx` itself and the new preview reuse the identical rendering rather than duplicating it. New `FrontEnd/src/features/CourseContentEditor/ReviewAsStudentPreview.tsx` — this is where AD-3's cross-feature import actually happens, importing `ContentNodeReadingPane` and `DrilldownPanel` (which itself renders `WaysMenu`/`ExampleCard`) directly from `features/CoursePlayer/`. Opens as a `fixed inset-0` full-surface takeover (matching `CourseContentEditor.tsx`'s own established convention) the instant `moveToReview` actually succeeds server-side (via Task 4's new callback), rendering the SAME `chapters` data `CourseContentEditor`'s own `useCourseContentTree` already has loaded.
- [x] Task 6: Publish gating (AC: #2)
  - [x] Confirmed correct as-is: `PublishLifecycleBar.tsx`'s existing `disabled={state !== 'reviewConfirmed' || isPublishing}` now operates on the real `state`/`isPublishing` values Task 4 provides — no code change needed.
- [x] Task 7: Tests
  - [x] `FlexDemy.Application.Tests/Courses/CourseServiceTests.cs`: `MoveToReviewAsync`/`ConfirmReviewAsync` — Draft/InReview precondition checks, ownership checks, unconfirmed-node detection across all 4 entity types (Chapter/Topic/ContentBlock-under-Topic/Subtopic/ContentBlock-under-Subtopic), full-tree-confirmed success case, empty-tree vacuous success.
  - [x] `FlexDemy.Application.Tests/AdaptiveLearning/{AdaptiveLearningServiceTests.cs, ExerciseServiceTests.cs, KeywordDefinitionServiceTests.cs}`: the widened gate allows the owning tutor through for `InReview`/`ReviewConfirmed`, rejects a non-owner for those same states, still rejects `Draft` outright, `Published` unchanged.
  - [x] `FrontEnd/tests/features/CourseContentEditor/useCourseLifecycle.test.ts`: fully rewritten against mocked `courseDraftService` calls (real fetch, not mock timers) — initial-load-picks-up-current-state, each trigger's success/no-op/failure-toast paths, poll-while-publishing/stops-when-done, `retryFailedNode`'s re-poll behavior, null-courseId no-ops.
  - [x] Also fixed as a direct consequence (not separately scoped, but broken by Task 4's real-wiring and needed for a clean regression): `FrontEnd/tests/features/CourseContentEditor/{PublishLifecycleBar.test.tsx, CourseContentEditor.test.tsx}`, both of which asserted against the now-removed mock timer progression.

## Dev Notes

- **This story closes 2 gaps its own predecessor stories explicitly flagged rather than silently resolved without a record** — Story 3.5's `LifecycleState == Published`-only gate (Task 2 here), and this epic's general "how does a tutor preview before publishing" question implicit throughout Phase A's mock stories.
- **All-4-types confirmation check (Task 1) is deliberately broader than Stories 3.5-3.8's Topic/Subtopic-only generation scope** — re-read this epic's own repeated scope-distinction note (first stated in Story 3.1's Dev Notes) before implementing `MoveToReviewAsync`'s validation; getting this narrower by mistake would let a course with an unconfirmed Chapter or ContentBlock incorrectly reach Review.
- **AD-3's cross-feature import is the only one of its kind in this codebase** — do not treat this story's Task 5 as license to casually import between other `features/*` folders elsewhere; this exception exists specifically because `CourseContentEditor`'s Review-as-Student mode and a real student's `CoursePlayer` view must render byte-for-byte identically (Story 3.11 validates this identity), which duplicating the components could never guarantee.

### Project Structure Notes

- Backend modified files: `Application/Courses/{ICourseService.cs, CourseService.cs}`, `Application/AdaptiveLearning/{AdaptiveLearningService.cs, ExerciseService.cs, KeywordDefinitionService.cs}` (Task 2's widened gate), `Api/Controllers/CoursesController.cs`.
- Frontend modified files: `FrontEnd/src/features/CourseContentEditor/{useCourseLifecycle.ts, CourseContentEditor.tsx}`, corresponding test files.

### References

- [Source: _specs/planning-artifacts/epics.md — Story 3.9 (lines 745-767)]
- [Source: _specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md — FR22 §4.11 (Draft resume), FR23 §4.11 (Review as Student, all-nodes-confirmed precondition), FR24 §4.11 (Review Confirmed gates Publish), FR-15 §4.4 (confirmation scope, all 4 entity types)]
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md — AD-3 (the sanctioned cross-feature import, verbatim reasoning quoted in this epic's shared research)]
- [Source: _specs/implementation-artifacts/{3-4-publishing-lifecycle-ui-mock-data.md, 3-5-drill-down-ways-ai-task-implementation.md, 3-6-exercise-generation-grading-backend.md, 3-7-keyword-definition-backend-definekeyword.md} — the mock hook shape this story real-wires, and the `LifecycleState == Published`-only gates this story widens]

## Previous Story Intelligence

Stories 3.4-3.8 (this epic, `ready-for-dev`, not yet implemented) all built the pieces this story wires together. In particular:

- **Story 3.5's own Dev Notes explicitly flagged the Published-only gate as needing this story's resolution** — that flag was deliberate, not an oversight; Task 2 here is its planned resolution, decided during this epic's own dependency-analysis pass rather than discovered as a surprise.
- **This is the first story in the epic that is almost entirely wiring/integration rather than new mechanism-building** — every piece it needs (lifecycle enum, content tree, adaptive-learning services, the mock hook shapes) already exists from Stories 3.1-3.8; the risk here is coordination/sequencing correctness, not designing something new.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `dotnet build`/`dotnet test` (full backend solution) and `npx tsc --noEmit`/`npx vitest run` (full frontend) all run clean at the end of this story: 666 backend tests passed (0 failed), 503 frontend tests passed across 76 files (0 failed). The only `tsc` errors present are 7 pre-existing, unrelated ones in `FlashcardsModal.tsx` (confirmed via `git status` showing zero pending changes to that file — not introduced by this story).

### Completion Notes List

- **Task 3's Draft-resume gap is real, not hypothetical.** Verified directly (no code written for a fix, per this task's own explicit "flag rather than silently expand scope" instruction): this app has no client-side router at all (no `react-router` dependency), no drafts-list screen, and `courseDraftService.ts` exposes no GET-by-id function — `CourseWizard.tsx`'s own `useCourseDraft.ts` always starts from a blank `createInitialDraft()`. The only way a Draft is ever reached is the linear create-new-wizard → content-editor-opens-with-that-id flow; there is no way back to an existing Draft's metadata or content tree once that screen closes. Fully solving this would mean adding routing/a drafts list/a GET-by-id backend read/a wizard resume-mode — a materially larger scope than this story's own task list, so it's documented here as a follow-up rather than built.
- **KeywordDefinitionService.DefineAsync had no lifecycle gate at all before this story** (confirmed by direct read of Story 3.7's implementation) — `GetCourseByIdAsync`'s own ownership-hiding side effect happened to already keep a non-owner to Published-only, but never excluded Draft for the owning tutor, unlike its two sibling gates (`AdaptiveLearningService`/`ExerciseService`). Added the identical widened `EnsureViewableForGenerationAsync` gate here too, for consistency and because Task 2's own text explicitly names `DefineAsync` as in scope.
- **`useCourseLifecycle`'s one shape addition (`onReviewAsStudentReady?` second param):** Task 4's own text asks the hook's *return* shape to stay identical so `PublishLifecycleBar.tsx` needs zero changes — that part holds exactly. But Task 5 needs `CourseContentEditor.tsx` to learn the instant `triggerReviewAsStudent` succeeds server-side, and `PublishLifecycleBar` is the one component that owns the hook instance wired to that button. Threading a second, independent `useCourseLifecycle` instance into `CourseContentEditor.tsx` just to observe state transitions would double the polling and risk falling out of sync with the instance that actually owns the trigger. The single new optional parameter (backward-compatible; `PublishLifecycleBar.tsx`'s own call site is the only one that needed a one-line change, its JSX is untouched) was the smallest change that avoids that duplication. Same reasoning documented inline in both files.
- **Error surfacing via `ToastContext`, not a new hook-return field:** a real `moveToReview`/`confirmReview`/`triggerPublish` call can now genuinely fail (e.g. the unconfirmed-node `ValidationException`, or Story 3.8's duplicate-publish guard) where the old mock never could. Adding an `error` field to the hook's return shape was ruled out by Task 4's own "PublishLifecycleBar.tsx needs zero changes" goal (that component has no inline error UI). `ToastContext`'s own doc comment already anticipates exactly this case ("'error' exists for completeness and any future caller that genuinely needs a transient... failure notice"), so failures surface there instead.
- **`ContentNodeReadingPane.tsx` extraction:** `CoursePlayer.tsx`'s own reading-pane rendering for a selected content-tree node (title, Open Drill-Down button, content blocks, ExerciseRunner, plus its own `useKeywordDefinition` instance) was inline JSX, not a reusable component. Since AD-3's own instruction is "import directly, do not duplicate," and Story 3.11 later validates byte-for-byte identity between this preview and the real `CoursePlayer` view, extracting this into its own component (rather than writing a second, similar-but-not-identical version inside `CourseContentEditor`) was necessary, not optional. `CoursePlayer.tsx` itself was updated to render the extracted component instead of its old inline block — a refactor with no behavior change (confirmed by the full frontend regression suite passing unchanged).
- **`retryFailedNode` has no backend counterpart.** Story 3.8 never built a manual per-node retry endpoint (Hangfire's own `[AutomaticRetry(Attempts=5)]` already retries transient failures automatically, and Story 3.5's on-demand fallback already serves a permanently-failed node's content the moment anyone views it). Implemented as an immediate re-poll of publish status instead of a no-op stub — a real, honest action (reveals whether the row has since resolved) rather than pretending to trigger server-side work that doesn't exist.
- **AC#1's "real components, not necessarily real data" scope was explicit from the start, not an oversight.** Task 5's own literal text anticipated exactly this: "if Stories 3.5-3.7's hooks are still mock at the point this story is implemented, Review-as-Student legitimately still shows mock adaptive content, which is fine — AC#1 only requires the *real components* render, not that every one is already live-wired." That is in fact the case here: `useDrilldownContent.ts`/`useExercise.ts`/`useKeywordDefinition.ts` (the CoursePlayer-feature hooks `ContentNodeReadingPane`/`DrilldownPanel` depend on) are still frontend-only mocks, since no story in this epic has a task to swap them to the real Story 3.5/3.6/3.7 endpoints yet. Stated explicitly here (not just in Task 5's own pre-existing text) because a code-review pass flagged this as looking like an undisclosed gap — it isn't; wiring those three hooks to real HTTP calls is a legitimate, real follow-up, but it belongs to whichever future story owns that frontend swap-in (not invented as new scope here).
- **Correction to this story's own Dev Notes claim** ("AD-3's cross-feature import is the only one of its kind in this codebase"): a code-review pass found this to be factually inaccurate as a description of the current codebase — `CoursePlayer.tsx`/`CourseDiscover.tsx` already import `CourseReviewModal` from `../CourseOverview/`, `TutorEducatorHubView.tsx` imports `CourseWizard`/`CourseContentEditor` from sibling feature folders, and `ProfileSetupPage.tsx` imports `AuthLayout` from `../Auth/` — all pre-existing, none introduced by this story. The Dev Notes' underlying *reasoning* for why Task 5's specific import is justified (preview/real-view parity, validated by Story 3.11) still holds independently of that inaccurate framing; this note exists so a future reader doesn't rely on "only one of its kind" as an argument for gating new cross-feature imports elsewhere.

### File List

**New:**
- `FrontEnd/src/features/CoursePlayer/ContentNodeReadingPane.tsx`
- `FrontEnd/src/features/CourseContentEditor/ReviewAsStudentPreview.tsx`

**Modified:**
- `BackEnd/src/FlexDemy.Application/Courses/{ICourseService.cs, CourseService.cs}` (`MoveToReviewAsync`, `ConfirmReviewAsync`, `LoadOwnedCourseAsync`, `FindFirstUnconfirmedNodeReason`)
- `BackEnd/src/FlexDemy.Application/AdaptiveLearning/{AdaptiveLearningService.cs, ExerciseService.cs, KeywordDefinitionService.cs}` (widened lifecycle gate)
- `BackEnd/src/FlexDemy.Api/Controllers/CoursesController.cs` (`POST drafts/{id}/move-to-review`, `POST drafts/{id}/confirm-review`)
- `FrontEnd/src/services/courseDraftService.ts` (`moveToReview`, `confirmReview`, `publishCourse`, `getPublishStatus`, `PublishStatusDto`/`ChecklistRowDto`, 204-handling in `write()`)
- `FrontEnd/src/features/CourseContentEditor/{useCourseLifecycle.ts, PublishLifecycleBar.tsx, CourseContentEditor.tsx}`
- `FrontEnd/src/features/CoursePlayer/CoursePlayer.tsx` (uses the extracted `ContentNodeReadingPane`)
- `BackEnd/tests/FlexDemy.Application.Tests/Courses/CourseServiceTests.cs`
- `BackEnd/tests/FlexDemy.Application.Tests/AdaptiveLearning/{AdaptiveLearningServiceTests.cs, ExerciseServiceTests.cs, KeywordDefinitionServiceTests.cs}`
- `FrontEnd/tests/features/CourseContentEditor/{useCourseLifecycle.test.ts, PublishLifecycleBar.test.tsx, CourseContentEditor.test.tsx}`

**Added by code-review patch (in addition to the above):**
- `FrontEnd/tests/features/CourseContentEditor/ReviewAsStudentPreview.test.tsx` (new)

## Senior Developer Review (AI)

**Date:** 2026-08-13
**Outcome:** Approved after patch
**Method:** `bmad-code-review` — parallel adversarial review (Blind Hunter, Acceptance Auditor)

**Acceptance Criteria audit (Acceptance Auditor):** AC#2/AC#3 verified PASS directly against the code. AC#4 (Draft resume) is **not satisfied** — confirmed genuinely absent (no router, no GET-by-id, no drafts list) — but this was already honestly disclosed in this story's own Task 3/Completion Notes as an explicit, reasoned scope boundary, not hidden. AC#1 (Review as Student reuses `CoursePlayer`'s real components) is satisfied for the *components* — the AD-3 import is real, correctly wired, and the extraction (`ContentNodeReadingPane.tsx`) is a genuine, behavior-preserving refactor, not a duplicate. The auditor initially flagged the underlying data hooks (`useDrilldownContent.ts`/`useExercise.ts`/`useKeywordDefinition.ts`) still being frontend mocks as an undisclosed gap; on review this was already explicitly anticipated and pre-authorized in Task 5's own original text ("if Stories 3.5-3.7's hooks are still mock... which is fine — AC#1 only requires the real components render"), and is now additionally called out explicitly in Completion Notes so it reads as disclosed on its own, not only via the task-list text.

**Action Items:**

- [x] **[High]** "Review as Student" became permanently unreachable after the first close, once a course left `Draft`. `PublishLifecycleBar.tsx`'s button was `disabled={state !== 'draft'}`, and `useCourseLifecycle.ts`'s `triggerReviewAsStudent` was a no-op for any state other than `'draft'` — but the only place that opens the preview (`onReviewAsStudentReady`) fires exclusively from that function's success path. Once a tutor closed the preview after the Draft → InReview transition, there was no way to reopen it for the rest of that course's pre-publish lifecycle, even though the backend's own widened `EnsureViewableForGenerationAsync` gate (Task 2, this same story) was deliberately built to allow the owning tutor to preview repeatedly through both `InReview` and `ReviewConfirmed`. Found by the Blind Hunter pass. **Fix:** the button is now `disabled={state === 'published'}` only; `triggerReviewAsStudent` now reopens the preview directly (via `onReviewAsStudentReady`, no backend call) whenever `state` is already past `'draft'`, and still performs the real `moveToReview` transition only the first time, while still `'draft'`. 3 new/updated regression tests.
- [x] **[Medium]** `ReviewAsStudentPreview.tsx` — this story's own centerpiece new UI and the literal site of its AD-3 cross-feature import — shipped with zero direct test coverage; the one existing test that clicks its trigger button only asserted on the lifecycle stage indicator, never on the preview surface itself. Found by the Acceptance Auditor pass. **Fix:** new `ReviewAsStudentPreview.test.tsx` (7 tests) — sidebar tree rendering, empty-selection placeholder, selecting a topic/subtopic renders the real `ContentNodeReadingPane` with that node's own content blocks (not a sibling's), Open Drill-Down opens the real `DrilldownPanel` (asserted via that component's own stable heading, confirming the actual imported component mounted, not a duplicate), closing `DrilldownPanel` returns to the reading pane without closing the whole preview, and the X button closes the preview.
- [x] **[Low]** This story's own pre-written Dev Notes claim ("AD-3's cross-feature import is the only one of its kind in this codebase") is factually inaccurate — several pre-existing cross-feature imports exist elsewhere. Found by the Acceptance Auditor pass. **Fix:** correction documented in Completion Notes (Dev Notes itself is out of this workflow's editable scope) so a future reader doesn't rely on the inaccurate framing.
- [x] **[Low]** Missing `ConfirmReviewAsync_throws_NotFoundException_for_a_genuinely_unknown_course_id` test (the shared-code-path coverage gap the auditor flagged). **Fix:** added.

Full regression suite (667 backend tests, 512 frontend tests) and `dotnet build`/`npx tsc --noEmit` re-verified clean after the patch.

## Change Log

- 2026-08-12: Story created via `bmad-create-story` — ninth of Epic 3's 11 stories, written as part of the full-epic write-then-implement batch. Status set to `ready-for-dev`.
- 2026-08-13: All 7 tasks implemented via `bmad-dev-story`. Real `MoveToReviewAsync`/`ConfirmReviewAsync` transitions with all-4-entity-type confirmation checking; widened the Published-only adaptive-learning gate across all 3 sibling services (discovering and closing a pre-existing gap in `KeywordDefinitionService`, which had no gate at all); real-wired `useCourseLifecycle.ts` against Story 3.8's endpoints; built the Review-as-Student cross-feature preview via a new shared `ContentNodeReadingPane` extraction plus `ReviewAsStudentPreview`; verified Task 3's Draft-resume-coherence concern and Task 6's publish-gating concern, both already correct/flagged rather than needing new code. Task 3 surfaced a real, documented gap (no Draft-resume capability exists in this app at all) rather than silently expanding scope to fix it. Full regression: 666 backend tests, 503 frontend tests, both 0 failures; `dotnet build`/`tsc --noEmit` both clean (aside from 7 pre-existing unrelated `FlashcardsModal.tsx` errors). Status set to `review`, ready for code-review cycle.
- 2026-08-13: `bmad-code-review` (Blind Hunter/Acceptance Auditor) found one High-severity real bug ("Review as Student" permanently unreachable after the first close for any course past Draft) and one Medium-severity test-coverage gap (`ReviewAsStudentPreview.tsx` had zero direct tests), plus two Low-severity documentation/test fixes. All patched with regression tests. Full regression re-run: 667 backend tests, 512 frontend tests, both 0 failures; builds clean. Status set to `done`.
