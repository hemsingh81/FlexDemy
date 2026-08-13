# Epic 3 Dependency Analysis

Written after all 11 Epic 3 stories (3.1-3.11) were drafted, per explicit user direction to analyze
cross-story dependencies before implementation starts and update the stories to minimize rework.
Most of this analysis is already embedded directly in each affected story's own Dev Notes (search
each story for "this epic's own dependency-analysis pass" / "cross-story dependency" for the
in-context version); this document is the consolidated, quick-reference summary.

## Recommended implementation order: numeric (3.1 → 3.11), no reordering needed

Every cross-story forward-dependency found during story-writing was resolved by **relocating which
story owns a shared piece**, not by reordering implementation — so the epic's own stated Phase
A → Phase B structure (epics.md: mock UI first as a review checkpoint, then real backend/live-wire)
holds, and stories can be implemented 3.1 through 3.11 in order with no story blocked on a
later-numbered one.

The one genuine forward-dependency found (Story 3.8's batch-completion step needing a version
snapshot, which is "Story 3.10's territory" by story title) was resolved by having **Story 3.8
itself own `CourseVersion`/`IVersionService.CreateSnapshotAsync`** (per backend AD-16's own text,
which ties batch completion directly to finalizing the version snapshot) — Story 3.10 then only
*extends* that same interface with restore/rollback, never needing anything from 3.8 that 3.8
doesn't already build for its own purposes. See Story 3.8 Task 4 / Story 3.10 Task 1.

## Key cross-story decisions, made once and reused

1. **Content-tree data model.** The student player (Story 3.1) bridges onto Epic 2's real
   `Chapter`/`Topic`/`Subtopic`/`ContentBlock` tree, not the pre-existing separate Lesson/Module
   mock model — decided explicitly with the user before writing any story, since every later story
   (3.2-3.11) depends on all Epic 3 surfaces agreeing on one node-id scheme. Confirmed correct
   against `epics.md`'s own "open a Topic/Subtopic" wording.

2. **`(courseId, nodeId)` hook signature convention.** Every Phase A mock hook
   (`useDrilldownContent`, `useWays`, `useKeywordDefinition`, `useExercise`) and every Phase B
   service method takes the same real Topic/Subtopic id from decision #1 — decided once in Story
   3.1, followed without exception through 3.9. No hook signature changes across any story.

3. **"Confirmed node" has two scopes — every story uses the right one.** FR-15 confirmation exists
   on all 4 entity types (Chapter/Topic/Subtopic/ContentBlock) and gates Review-as-Student (3.9,
   all 4 types checked) and the pre-existing structural-edit-reset logic (Epic 2, unchanged). FR-17/
   18/19's *generation* targets are Topic/Subtopic only (PRD Glossary) — Stories 3.5, 3.6, and 3.8
   all filter to just those two types. Story 3.4's mock checklist and Story 3.8's real one both
   render Chapter rows as structural grouping headers only, never as generation-tracked items —
   decided once in 3.4, reused as-is by 3.8.

4. **Publish checklist status is free text (`statusText`) + a small fixed `statusKind` enum**, not
   a tight status contract matching `Domain/Jobs/JobItemStatus.cs` (whose `Parsing`/`Extracting`
   vocabulary is extraction-specific and doesn't fit node-generation sub-status like "Generating Way
   3 of 5"). A **new, purpose-built `PublishItemStatus` enum** backs `statusKind`. Decided in Story
   3.4 (mock), directly reused by Story 3.8 (real) with no reshaping.

5. **The "N of M" publish-progress figure is derived by counting checklist rows client-side**, not
   tracked as a separate `{done,total}`/`{remaining,total}` pair — sidesteps having to decide (and
   later possibly invert) an arithmetic direction against Story 3.8's real `PublishBatch.Remaining`
   counter, which counts *down* per AD-16. Decided in Story 3.4, holds unchanged through 3.8.

6. **`isPublishing` is a separate boolean, never a 5th `LifecycleState` value** — confirmed against
   the real `LifecycleState.cs` enum (`Published`/`Draft`/`InReview`/`ReviewConfirmed`, no
   `Publishing` member, by design per the PRD Glossary's "transient sub-state" framing). Decided in
   Story 3.4, matches the real backend shape Story 3.8/3.9 later build against.

7. **Tutor-override storage pattern**: a `GeneratedContentJson`/`OverrideContentJson` two-column
   shape (override always wins when both present, checked at the DTO-mapping layer so every read
   path gets the rule for free). Established in Story 3.5 for Drill-Down/Ways, reused as-is by
   Story 3.7 for keyword definitions (Story 3.6/exercises uses a narrower single-`CorrectAnswer`
   shape instead, since an exercise isn't really "AI content with an optional override" the same
   way — it's authored-or-accepted once, not continuously regenerable).

8. **One exercise per node, not "one or more."** PRD FR19's literal text says "one or more"; Story
   3.3 (mock UI, written first) modeled zero-or-one. Story 3.6 (real backend) matches 3.3's
   already-committed shape rather than reopening it — a deliberate, recorded MVP scope narrowing,
   not a silent divergence from the PRD. Flagged as a clean, additive extension point if multi-
   exercise-per-node is ever needed later (same pattern as `CourseThumbnail.Order`).

9. **Read-path lifecycle gating widens once, in Story 3.9.** Stories 3.5/3.6/3.7's generation/read
   methods start `Published`-only (correct for a real student). Story 3.9 widens all three to also
   allow the owning tutor to read/generate for `Draft`/`InReview`/`ReviewConfirmed` states (Review-
   as-Student's whole purpose) — flagged as an open `[ASSUMPTION]` in 3.5 rather than silently
   assumed, resolved explicitly in 3.9's own Task 2 rather than discovered as a gap during 3.9's
   implementation.

10. **The "Quiz runner reuse" instruction in epics.md/UX docs is corrected, not followed literally.**
    The actual existing "Quiz runner" (`AssignmentQuizRunner`) renders inside a `SidePanel` slide-in
    blade, not truly inline — confirmed by direct read. Story 3.3 builds a genuinely inline
    `ExerciseRunner`, matching the *stated design intent* ("expands in place, not a modal") rather
    than literally reusing the SidePanel-based component.

11. **The "keyword affordance already exists as a fake" claim in this epic's own shared research was
    wrong, corrected in Story 3.1's Dev Notes before it could propagate.** `ReaderCanvas.tsx`'s
    `handleAskLevelLLM` is a separate, untouched per-level chat mechanic — Story 3.2's keyword
    popover is genuinely net-new UI, not a replacement for anything.

## Residual risks carried into implementation (not resolved by this pass, deliberately)

- **Story 3.1's content-tree bridge (Task 1+2) and Story 3.8 (batch job + atomic completion) are
  both explicitly flagged as sizing risks** in their own story files, matching epics.md's own
  treatment of 3.8. If either doesn't fit one dev session, each story states its own natural split
  point.
- **A real student-facing, published-only content-tree READ endpoint does not exist yet anywhere**
  (Epic 2's `ContentTreeController` is tutor-Draft-only). Story 3.1 mocks around this; Story 3.5 is
  the natural place to build it, but doing so is not yet an explicit task in any story — flag during
  Story 3.5's own implementation if it turns out to be required before that story's AC#4 (on-demand
  fallback) can be exercised against a real course.
- **The exact ownership-check method for "tutor owns this course, regardless of its current
  `LifecycleState`"** (needed by Stories 3.5/3.6/3.7's override-setting methods, since a tutor sets
  overrides on Published courses too, not only Drafts) is flagged as a possible gap in `ICourseService`
  in Story 3.5's own Task 3 — if it doesn't already exist, whichever story is implemented first among
  3.5/3.6/3.7 should add it once, and the other two should reuse it rather than each adding their own.
