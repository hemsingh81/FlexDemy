---
baseline_commit: 245d80348a8c8e55a2e4dbd2037bbd83385a56ce
---

# Story 11.1: Move-to-Review Confirmation Gate

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tutor,
I want to see exactly what's blocking my course from moving to Review,
So that I know precisely what to fix instead of a generic "content not ready" message.

## Acceptance Criteria

1. **Given** any node or page in the course is Unconfirmed **When** the tutor attempts to move the course to Review **Then** the move is blocked and the lifecycle bar lists every blocker as a direct link into the outline (FR-45)
2. **Given** the confirmation-based gate is live **When** it evaluates a Move-to-Review attempt **Then** it fully replaces `MoveToReviewAsync`'s old file-parsed check — that check is removed outright, not kept as a redundant guard, since it's meaningless once uploaded files stop being content (FR-45, backend AD-29's neighbor)

## Tasks / Subtasks

- [x] Task 1 — Backend: replace `MoveToReviewAsync`'s gate condition (AC: #2)
  - [x] **Read `Backend/src/FlexDemy.Application/Courses/CourseService.cs`'s `MoveToReviewAsync` implementation and `ICourseService.cs`'s doc comment on it completely before editing** — its current condition (confirmed by reading the live interface doc comment) is "`LifecycleState == Draft` and at least one uploaded file successfully parsed (`Status == Done`)," throwing `ValidationException` otherwise
  - [x] Replace that file-parsed condition **outright** — delete the check, don't leave it running alongside the new one (AC #2's explicit "removed outright, not kept as a redundant guard," since a `CourseFile`'s parse status has no relationship to whether the course's actual content — the outline — is ready). `ICourseFileRepository` was CourseService's only remaining use of that dependency — removed from its constructor outright too, not left as an unused parameter
  - [x] New condition: no `Chapter`, `Topic`, `Subtopic`, or `Page` belonging to this course has `IsConfirmed == false`. Query this via `IContentRepository` — new `HasUnconfirmedContentAsync(courseId)`, a whole-course Chapter→Topic→Subtopic→Page walk composed from the repository's existing per-parent query methods (same traversal shape as `ContentService.GetOutlineAsync`/`GetAllPagesInCourseAsync`'s own precedent), short-circuiting as soon as one Unconfirmed item is found. `CourseService` depends on `IContentRepository` directly (not `IContentService`) specifically to avoid a circular DI dependency, since `ContentService` already depends on `ICourseService` — throw `ValidationException` if any are found
  - [x] The `LifecycleState == Draft` precondition is unchanged — this story only replaces the *content-readiness* half of the check, not the lifecycle-state half
  - [x] Tests: a course with every node Confirmed moves to Review successfully; a course with one Unconfirmed Sub-Topic (buried three levels deep) is rejected; a course whose only Unconfirmed item is on a `Page` (not a heading) is also rejected — Page confirmation counts identically to node confirmation for this gate, per FR-44's own scope covering "node or page"; a course with zero content at all (no Chapters) — **decided: an empty course vacuously passes** (nothing exists to be Unconfirmed) — FR-45 only gates on *existing* Unconfirmed items; whether an empty course should be rejected for a separate reason is an out-of-scope product question this story doesn't take a position on. Tested at both the repository level (`ContentRepositoryTests.cs`, real EF Core InMemory data) and the service level (`CourseServiceTests.cs`, mocked)

- [x] Task 2 — Frontend: blocker list in the lifecycle bar, computed from already-available outline data (AC: #1)
  - [x] **Read `PublishLifecycleBar.tsx` completely before editing it** — it's a real, working component (Story 3.4/3.9/3.10) with an existing `Move to Review` button (`triggerMoveToReview`, disabled when `state !== 'draft'`) and a Version History drawer toggle pattern to mirror for a new "blockers" disclosure, rather than inventing a third UI idiom in the same component
  - [x] Compute the blocker list **client-side, from `CourseContentContext`'s already-fetched outline data (Story 7.4)** — every node/page in the current course with `isConfirmed === false`, across all Chapters, not just the currently-open one. Confirmed by direct inspection: `CourseContentContext`'s `refetch()` already calls `getOutline(courseId)` (whole-course by construction) and only discarded everything but a flattened confirmation `Map` — extended it to also store and expose the raw `OutlineDto` itself (`outline`), so `PublishLifecycleBar` needs no second fetch
  - [x] Render the blocker list as a disclosure (mirroring the existing Version History toggle's shape) shown whenever `state === 'draft'` and at least one blocker exists — each entry a real focusable link/button reading the node's title and kind ("Sub-Topic: Combination Reactions"), not a static list item
  - [x] Activating a blocker link moves the tutor to that node and gives it real DOM focus — reuse Story 7.2's `TableOfContentsRail` focus-move mechanism (`tabindex="-1"` + `.focus()`) rather than a third navigation implementation. If the blocking node is in a **different Chapter** than the one currently open in the editor, this also requires switching the open Chapter first — **`useContentDocument.ts` had no "switch to an existing Chapter" capability at all before this story** (only `addChapter`, which starts a brand-new blank Chapter) — added `switchChapter(targetChapterId)`, reusing the exact same `resetKey`-bump-forces-remount mechanism `addChapter` already relies on for Tiptap's own `autofocus: 'start'`. `CourseContentEditor.tsx` bridges `PublishLifecycleBar` (fires a node-and-chapter-id-carrying `onActivateBlocker` callback) and `DocumentCanvas` (owns the live editor instance) via a `pendingFocusNodeId`/`onFocusHandled` prop pair, since the two are siblings with no direct access to each other's state. A cross-Chapter activation remounts `DocumentCanvas` with the target Chapter's document already baked into the fresh editor instance, so no separate "focus the new h1, then re-focus the real target" two-step is needed — the pending-focus effect finds and focuses the real target directly on the fresh instance
  - [x] `triggerMoveToReview`'s button stays disabled while any blocker exists (a client-side convenience on top of, not instead of, Task 1's server-side gate) — clicking it while blockers are visible should be structurally impossible via the disabled state, so the backend rejection path (AC #2) is a defense-in-depth guarantee, not the primary UX

- [x] Task 3 — Tests
  - [x] Backend per Task 1's own bullets
  - [x] `FrontEnd/tests/features/CourseContentEditor/PublishLifecycleBar.test.tsx` (extend the existing test file — Story 3.4/3.9/3.10 already have coverage here, read it before adding cases): blockers render only in `draft` state with unconfirmed nodes present; `Move to Review` is disabled while blockers exist and enabled once they're all resolved; activating a blocker link moves focus to the correct node, including the cross-Chapter case — the cross-Chapter focus-move assertion itself lives in `CourseContentEditor.test.tsx` instead (`PublishLifecycleBar` alone has no access to the editor instance needed to observe a real focus-move, only to the `onActivateBlocker` callback it fires — see Completion Notes)

## Dev Notes

- **Deliberately avoids a new backend error-response shape.** An earlier design instinct for this story was to have `MoveToReviewAsync`'s failure response carry the structured blocker list itself (parsed out of a thrown exception). Rejected in favor of computing the blocker list **client-side from data already fetched** (Story 7.4's `CourseContentContext`/`GetOutlineAsync`) — simpler, avoids inventing a new structured-error convention this codebase doesn't otherwise use (`AppException` subtypes carry a message, not structured payloads, per `Backend/CLAUDE.md`'s own error-handling rule), and the backend gate (Task 1) still independently enforces the rule for defense-in-depth even though the frontend never needs to parse its failure response for details.
- **Architecture:** this story replaces one specific piece of `MoveToReviewAsync` (AD-29's neighboring concern, per the epics doc's own framing) — it does not touch AD-29's actual read-policy branches (that's Story 11.3).
- **Existing code to read before editing:** `CourseService.MoveToReviewAsync`, `ICourseService.cs`'s doc comment on it, `PublishLifecycleBar.tsx` in full (the Version History disclosure pattern this story's blocker list mirrors), `useCourseLifecycle.ts` (`triggerMoveToReview`'s existing error-handling shape), Story 7.2's `TableOfContentsRail.tsx` (focus-move mechanism), Story 7.4's `CourseContentContext.tsx`/`getOutline`.
- **Git context:** no new commits since Epic 10's stories were authored in this same session.

### Project Structure Notes

- No new files — this story extends `CourseService.cs` (backend) and `PublishLifecycleBar.tsx` (frontend), both real, existing, working files.

### References

- [Source: _specs/planning-artifacts/epics-ContentAuthoring.md#Story 11.1] — verbatim Acceptance Criteria
- [Source: _specs/implementation-artifacts/7-2-...md, 7-4-...md] — `TableOfContentsRail` focus-move, `CourseContentContext`/`getOutline`
- [Source: Backend/src/FlexDemy.Application/Courses/CourseService.cs, ICourseService.cs; FrontEnd/src/features/CourseContentEditor/PublishLifecycleBar.tsx] — live code read in full during this story's own creation

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- **Backend gate**: `CourseService.MoveToReviewAsync` now depends on `IContentRepository` (new `HasUnconfirmedContentAsync`), not `IContentService` — depending on the service interface would have created a circular DI dependency, since `ContentService` already depends on `ICourseService`. `ICourseFileRepository` was `CourseService`'s only remaining use once the old file-parsed check was deleted, so it was removed from the constructor outright rather than left as an unread parameter.
- **Chapter-switching gap discovered and closed.** Before this story, `useContentDocument.ts` had no way to load a *different, already-existing* Chapter's document at all — the only state-changing action besides the initial mount-time load was `addChapter` (starts a brand-new blank Chapter). AC #1's "switch to the blocking node's Chapter if it's not the one currently open" requirement needed this capability to exist first. Added `switchChapter(targetChapterId)`, deliberately reusing `addChapter`'s own `resetKey`-bump-forces-remount mechanism (which is what re-triggers Tiptap's `autofocus: 'start'`) rather than inventing a second focus-management path.
- **Cross-component bridge for "activate a blocker."** `PublishLifecycleBar` and `DocumentCanvas` are siblings under `CourseContentEditor.tsx`, and only `DocumentCanvas` owns the live Tiptap editor instance. Rather than lifting the editor instance up (a much larger, riskier refactor out of proportion to this story), `CourseContentEditor.tsx` holds a small `pendingFocusNodeId` state: `PublishLifecycleBar`'s `onActivateBlocker` callback triggers `switchChapter` (if the blocker's Chapter differs from the one currently open) and sets `pendingFocusNodeId`; `DocumentCanvas` gets that id as a prop and, in its own effect, looks it up via `collectHeadings` (or, for a Chapter-kind blocker, the document's own `h1`, which has no `collectHeadings` entry) and moves real focus via the same `tabindex="-1"` + `.focus()` mechanism `TableOfContentsRail.tsx`'s `activate` already uses, then calls `onFocusHandled` to clear the pending id.
- **No two-step focus sequencing was actually needed.** The story anticipated "focus the new Chapter's h1, then re-focus the specific blocking node" as two legitimate back-to-back focus moves. In practice, because a cross-Chapter switch fully remounts `DocumentCanvas` with the target Chapter's document already present at `useEditor` creation time (not fetched-then-applied after mount), the pending-focus effect finds the real target node on the very first render of the fresh instance and focuses it directly — Tiptap's own `autofocus: 'start'` and this story's own focus-move both want to move focus on the same mount, and the pending-focus effect's placement (after the doc-rebuild effect) wins by running after; no visible double-focus, no `h1`-then-node handoff was observed or needed.
- **`CourseContentContext` extended, not replaced.** Added `outline: OutlineDto | null` alongside the existing `confirmationById` map (both built from the same single `getOutline()` call in `refetch()`) rather than a second fetch or a parallel context — `PublishLifecycleBar` reads it via the existing `useCourseContent()` hook.
- Cross-Chapter focus-move is asserted in `CourseContentEditor.test.tsx` (not `PublishLifecycleBar.test.tsx`) since `PublishLifecycleBar` alone has no access to the editor needed to observe a real focus-move — it only fires the `onActivateBlocker` callback, which `PublishLifecycleBar.test.tsx`'s own tests verify is called with the right blocker. Per this codebase's established jsdom+ProseMirror testing convention, the focus assertion uses a `vi.spyOn(HTMLElement.prototype, 'focus')` + `mock.instances` check rather than `document.activeElement`/`toHaveFocus()`.
- All 780 frontend tests and 933 backend tests (558 Application + 234 Infrastructure + 141 Api) pass with zero regressions.

### File List

- `Backend/src/FlexDemy.Application/Courses/IContentRepository.cs` — MODIFIED: added `HasUnconfirmedContentAsync`
- `Backend/src/FlexDemy.Infrastructure/Repositories/ContentRepository.cs` — MODIFIED: implemented it (whole-course Chapter→Topic→Subtopic→Page walk)
- `Backend/src/FlexDemy.Application/Courses/CourseService.cs` — MODIFIED: `MoveToReviewAsync`'s gate replaced; depends on `IContentRepository`, no longer `ICourseFileRepository`
- `Backend/src/FlexDemy.Application/Courses/ICourseService.cs` — MODIFIED: `MoveToReviewAsync`'s doc comment updated
- `Backend/tests/FlexDemy.Application.Tests/Courses/CourseServiceTests.cs` — MODIFIED: `Sut`/`MakeSut` updated; old file-parsed-check tests replaced with unconfirmed-content-gate tests
- `Backend/tests/FlexDemy.Infrastructure.Tests/Repositories/ContentRepositoryTests.cs` — MODIFIED: new `HasUnconfirmedContentAsync` tests
- `FrontEnd/src/context/CourseContentContext.tsx` — MODIFIED: exposes the raw `outline`
- `FrontEnd/src/features/CourseContentEditor/useContentDocument.ts` — MODIFIED: new `switchChapter`
- `FrontEnd/src/features/CourseContentEditor/PublishLifecycleBar.tsx` — MODIFIED: blocker computation/disclosure, `onActivateBlocker` prop, `Move to Review` gated on blockers too
- `FrontEnd/src/features/CourseContentEditor/DocumentCanvas.tsx` — MODIFIED: `pendingFocusNodeId`/`onFocusHandled` props and focus-move effect
- `FrontEnd/src/features/CourseContentEditor/CourseContentEditor.tsx` — MODIFIED: `pendingFocusNodeId` state, `activateBlocker`/`clearPendingFocus`, wired to both siblings
- `FrontEnd/tests/features/CourseContentEditor/PublishLifecycleBar.test.tsx` — MODIFIED: `CourseContentProvider` wrapper + `getOutline` mock added to every render call; new blocker tests
- `FrontEnd/tests/features/CourseContentEditor/CourseContentEditor.test.tsx` — MODIFIED: new "Move-to-Review blockers" describe block, including the cross-Chapter focus-move test

### Change Log

- 2026-08-18: Story 11.1 implemented — backend Move-to-Review gate replaced (Task 1), frontend blocker list with cross-Chapter activation (Task 2), tests (Task 3). Status: review.
