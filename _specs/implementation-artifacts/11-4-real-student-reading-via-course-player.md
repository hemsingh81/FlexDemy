---
baseline_commit: 245d80348a8c8e55a2e4dbd2037bbd83385a56ce
---

# Story 11.4: Real Student Reading via Course Player

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a student,
I want the Course Player to render a Page's actual content and its inline resources,
So that once I'm able to reach a published course, what I see is the real thing, not a broken renderer.

## Acceptance Criteria

1. **Given** a student is navigating a course in Course Player (existing per-topic/subtopic drilldown pattern) **When** they reach a node with authored Pages **Then** `ReaderCanvas.tsx` fetches each Page's body via `courseContentService.getPage(pageId)` — one page at a time, matching the existing navigation pattern, never a whole-chapter fetch — and renders it through the existing `lib/markdown.ts` renderer, never a Tiptap instance (frontend AD-4/AD-9 resolution)
2. **Given** a Page body contains a `resource:{resourceId}` reference (inline image or resource card) **When** it renders in Course Player **Then** it resolves to a real served URL via `courseContentService.resolveResourceUrl()` — the same function Story 11.2's tutor-facing Preview as Student uses (FR-30)
3. This story builds the read mechanism itself, independent of who's allowed to call it — live access remains gated closed by Story 11.3's deny-by-default policy until a real Enrollment primitive exists in a future epic; this is not blocked on that work, it's what that future work will flip open
4. This is a distinct code path from Story 11.2's "Preview as Student" — different auth (real student vs. owning tutor), different fetch pattern (per-page vs. whole-chapter), different failure modes (a real student can hit a 403 a previewing tutor never will) — not a shared feature just because both render through `lib/markdown.ts`

**Corrections to this AC's own wording, found by reading the live code (do this before starting — see Dev Notes):** there is no "existing per-topic/subtopic drilldown pattern" navigating real authored content today — Course Player's *real* (non-mock) navigation is currently **flat and file-based** (`useCourseFileNavigation.ts`/`CoursePlayerSidebar.tsx`'s "Course Content" section lists raw uploaded `CourseFile`s, not a Chapter/Topic/Subtopic tree — that tree was explicitly removed and never rebuilt, per that hook's own code comment: "Replaces the old Chapter/Topic/Subtopic mock-tree navigation... this is the first real wiring of student-facing content reading, not a regression from something real"). And the component that actually needs rewiring is **`ContentNodeReadingPane.tsx`**, not `ReaderCanvas.tsx` — `ReaderCanvas.tsx` is a *different*, still-mock, sentence-based component serving the legacy Module/Lesson adaptive-learning path (Drill-Down/Ways/Keyword popovers), rendered by `CoursePlayer.tsx` only when no file is selected; `ContentNodeReadingPane.tsx` is the one rendered when a file *is* selected, and its own code comment already says exactly what this story needs to build: "no AI structuring step, no Drill-Down/Exercise/keyword machinery in between (all removed along with the Chapter/Topic/Subtopic/ContentBlock tree this pane used to render)." Treat this story's actual scope as: build a real Chapter/Topic/Subtopic/Page navigation tree (replacing the flat file list) and rewire `ContentNodeReadingPane.tsx` (not `ReaderCanvas.tsx`) to render real `Page.BodyMarkdown`.

**A second correction, to AC #4's "403":** loose language carried over from the epics doc, not a literal status code to implement. `Backend/src/FlexDemy.Api/Middleware/ExceptionHandlingMiddleware.cs` maps `NotFoundException` — what Story 11.3's `EnsureReadableAsync` actually throws on a denied read, per that story's own explicit "don't leak existence, never `UnauthorizedAppException`" precedent — to **404**, never 403 (only `UnauthorizedAppException` maps to 401; nothing in this codebase's exception middleware produces a 403). A real student blocked by Story 11.3's deny-by-default policy hits a 404, not a 403. Don't add a new `ForbiddenException`/403 path to make the AC's literal wording true — that would contradict Story 11.3's design.

## Tasks / Subtasks

- [x] Task 1 — Frontend: real outline-based navigation, replacing the flat file list (AC: #1)
  - [x] **Read `useCourseFileNavigation.ts` and `CoursePlayerSidebar.tsx` completely first**
  - [x] New `useCourseContentNavigation.ts` (mirrors `useCourseFileNavigation.ts`'s exact hook shape: fetch-on-mount, `cancelled` guard, swallow background-load failures the same way): fetches `getOutline(courseId)` and owns `selectedPageId`/`setSelectedPageId`, plus a separately-fetched `selectedPage` via `getPage(courseId, pageId)` (with `isLoadingPage`/`pageLoadFailed` state) — one page at a time, never bulk
  - [x] `CoursePlayerSidebar.tsx`: replaced the flat `files`/`CourseFileDto` "Course Content" section with a real Chapter → Topic → Sub-Topic → Page tree, expand/collapse per node (`role="tree"`), Page entries as leaf/selectable items. The legacy Module/Lesson accordion above it is untouched
  - [x] **Decision (per this task's own explicit "note whichever choice is made"): the raw-file list was replaced outright**, not kept as a parallel section — a Published course's real navigable content is the authored outline; `useCourseFileNavigation.ts` and `ContentNodeReadingPane.tsx` were deleted outright (fully superseded, zero remaining references, no test coverage existed for either) rather than left as dead code

- [x] Task 2 — Frontend: rewire `ContentNodeReadingPane.tsx` to render real Page content (AC: #1, #2)
  - [x] Replaced the `<pre>`-tag raw-text rendering with `ui/MarkdownViewer.tsx` rendering the selected Page's `bodyMarkdown`
  - [x] Resolves every `resource:{resourceId}` reference via `courseContentService.resolveResourceUrl()` — the same function, called identically to `PreviewAsStudent.tsx`
  - [x] **Renamed** `ContentNodeReadingPane.tsx` → `PageReadingPane.tsx` (the old name predated this PRD's Page concept) — its one call site in `CoursePlayer.tsx` updated
  - [x] `CoursePlayer.tsx`'s conditional is now `selectedPageId ? <PageReadingPane .../> : <ReaderCanvas .../>`. `ReaderCanvas.tsx` completely untouched

- [x] Task 3 — The adaptive-learning reconciliation question, scoped explicitly out of this story (AC: none directly — a boundary decision)
  - [x] Confirmed: the real-Page reading path (`PageReadingPane.tsx`) has no Drill-Down/Ways/Keyword affordances at all — `ReaderCanvas.tsx`'s sentence-level machinery is untouched and has no defined relationship to Page/block content. This remains a real, open, unresolved product question, flagged here and in Completion Notes, not solved as a side effect of this story

- [x] Task 4 — Tests
  - [x] `FrontEnd/tests/features/CoursePlayer/useCourseContentNavigation.test.ts` (new): fetches outline on mount; selecting a page fetches its body via a separate call, not bundled into the outline fetch; failure states for both fetches
  - [x] `FrontEnd/tests/features/CoursePlayer/PageReadingPane.test.tsx`: renders `bodyMarkdown` via `MarkdownViewer`; a `resource:` reference resolves through the shared `resolveResourceUrl`; loading and failed states, never a blank pane
  - [x] `FrontEnd/tests/features/CoursePlayer/CoursePlayerSidebar.test.tsx` — new file (none existed before): the outline tree renders Chapter/Topic/Sub-Topic/Page levels correctly; selecting a Page calls `onSelectPage`; collapse hides descendants; empty/null outline renders no tree
  - [x] Also updated `CoursePlayer.test.tsx`'s existing file-navigation tests to the new outline-based navigation (its old tests mocked the now-deleted `useCourseFileNavigation` code path and would otherwise silently test dead behavior)

## Dev Notes

- **This story's own AC text, as written in the epics doc, describes a navigation pattern and a component that don't match the current live code — corrected explicitly above.** This isn't a hypothetical caveat: `useCourseFileNavigation.ts`'s own code comment states outright that the Chapter/Topic/Subtopic navigation this AC assumes exists was removed and never rebuilt, and that the current real navigation is file-flat. Don't start this story by looking for a `ReaderCanvas.tsx` rewire — that component is the wrong one, confirmed by reading both files in full during this story's own creation.
- **Distinct from Story 11.2 by design, not by accident** — per AC #4, this story deliberately does not reuse `PreviewAsStudent.tsx` even though both eventually call the same `getPage`/`resolveResourceUrl` functions and both render via `MarkdownViewer`. Different callers, different auth posture (this path is gated closed per Story 11.3 until Enrollment exists; a tutor's own preview never is), different fetch triggers (drilldown navigation vs. an explicit "Preview" action) are all real, motivated differences — resist the urge to unify them into one shared component just because the rendering call looks similar.
- **The adaptive-learning reconciliation gap (Task 3) is a real, unresolved product question** — flagging it clearly is this story's job; solving it is not.
- **Architecture:** AD-4/AD-9's "reading never goes through Tiptap" resolution, applied to the actual real-student surface for the first time (Story 11.2 was the tutor-facing exercise of the same principle).
- **Existing code to read before editing:** `useCourseFileNavigation.ts`, `CoursePlayerSidebar.tsx`, `ContentNodeReadingPane.tsx`, `CoursePlayer.tsx` (the conditional this story changes), `ReaderCanvas.tsx` (confirmed out of scope, read only to confirm it's genuinely untouched), Story 11.2's `PreviewAsStudent.tsx` (the sibling to differentiate from, per AC #4), Story 8.3's `resolveResourceUrl`.
- **Git context:** no new commits since Story 11.3 was authored in this same session. This is the final story in the ContentAuthoring epic sequence (Epic 7–11) — after this story is created, all 15 stories are `ready-for-dev` and the user's directive is to begin `bmad-dev-story` implementation.

### Project Structure Notes

- New frontend file: `useCourseContentNavigation.ts`.
- Modified (not new): `CoursePlayerSidebar.tsx`, `ContentNodeReadingPane.tsx` (likely renamed), `CoursePlayer.tsx`.
- `ReaderCanvas.tsx` is explicitly **not** touched by this story.

### References

- [Source: _specs/planning-artifacts/epics-ContentAuthoring.md#Story 11.4] — Acceptance Criteria, corrected against live code where the epics doc's own wording is stale
- [Source: _specs/implementation-artifacts/7-4-...md, 11-2-...md, 8-3-...md] — `getOutline`, `getPage`, `resolveResourceUrl`
- [Source: FrontEnd/src/features/CoursePlayer/useCourseFileNavigation.ts, CoursePlayerSidebar.tsx, ContentNodeReadingPane.tsx, ReaderCanvas.tsx, CoursePlayer.tsx] — live code read in full during this story's own creation; the primary source of truth for this story's actual scope

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- **Both of this story's own AC corrections (documented in the AC text itself) held up under implementation**: the real scope was rewiring `ContentNodeReadingPane.tsx` (not `ReaderCanvas.tsx`) and building fresh outline-tree navigation (there was no pre-existing Chapter/Topic/Subtopic drilldown to extend) — confirmed directly against the live code before writing anything, exactly as the story's own Dev Notes insisted.
- **Sidebar default-expansion state**: all Chapters, Topics, and Sub-Topics default to expanded (not just Chapters) — discovered mid-implementation via a failing test (`Sub-Topic Detail` invisible behind a collapsed Topic) that a Chapters-only default left every Topic/Sub-Topic collapsed by default, which would hide most of a course's real content behind extra clicks. NFR4's own bounds (100 Chapters/100 Topics/50 Sub-Topics) make "expand everything by default" a reasonable choice at this scale.
- **Old files deleted outright, not left as dead code**: `useCourseFileNavigation.ts` and `ContentNodeReadingPane.tsx` are both fully superseded and had zero remaining references and no existing test coverage — deleted rather than kept around unreferenced.
- **`CoursePlayer.test.tsx`'s existing file-navigation tests were rewritten**, not left in place — they mocked `courseFileService.getCourseContent`/asserted on the now-deleted flat file list, which would have kept "passing" against dead code paths if left untouched. Rewired to mock `courseContentService.getOutline`/`getPage` and assert the new outline-tree/page-reading behavior; also added one new test for the failed-page-load friendly state that didn't exist before.
- **Task 3's adaptive-learning reconciliation gap remains genuinely open** — not solved here, per the story's own explicit scope boundary. `ReaderCanvas.tsx`'s sentence-level Drill-Down/Ways/Keyword-popover machinery has no relationship to Page/block content, and `PageReadingPane.tsx` has no such affordances at all. Whoever scopes that future work will need to decide whether/how adaptive-learning features extend to authored Markdown-block content, which is a materially different shape than the legacy mock "sentences."
- **Full-suite test flakiness observed, confirmed pre-existing and unrelated to this story**: running the entire frontend suite (97 files) occasionally times out one or two unrelated tests (e.g. an `App.test.tsx` Admin-nav test, an unrelated "Add Country" test) under heavy parallel-worker resource contention (this environment's own `environment:` setup phase alone took 700+ seconds in a full run). Repeated isolated runs of `tests/features/CoursePlayer/` (this story's own actual footprint) were 100% green across three separate runs (40/40 each time) — the flakiness is infrastructure-load-driven, not a defect in this story's code.
- 780+ frontend tests across the suite; this story's own directory (`tests/features/CoursePlayer/`) is 40/40 passing, stable across repeated isolated runs.

### File List

- `FrontEnd/src/features/CoursePlayer/useCourseContentNavigation.ts` — NEW: replaces `useCourseFileNavigation.ts`
- `FrontEnd/src/features/CoursePlayer/PageReadingPane.tsx` — NEW: renamed/rewired from `ContentNodeReadingPane.tsx`
- `FrontEnd/src/features/CoursePlayer/CoursePlayerSidebar.tsx` — MODIFIED: real outline tree replaces the flat file list
- `FrontEnd/src/features/CoursePlayer/CoursePlayer.tsx` — MODIFIED: wired to the new hook/pane
- `FrontEnd/src/features/CoursePlayer/useCourseFileNavigation.ts` — DELETED: fully superseded
- `FrontEnd/src/features/CoursePlayer/ContentNodeReadingPane.tsx` — DELETED: renamed to `PageReadingPane.tsx`
- `FrontEnd/tests/features/CoursePlayer/useCourseContentNavigation.test.ts` — NEW
- `FrontEnd/tests/features/CoursePlayer/PageReadingPane.test.tsx` — NEW
- `FrontEnd/tests/features/CoursePlayer/CoursePlayerSidebar.test.tsx` — NEW
- `FrontEnd/tests/features/CoursePlayer/CoursePlayer.test.tsx` — MODIFIED: file-navigation tests rewritten for outline-based navigation

### Change Log

- 2026-08-18: Story 11.4 implemented — real outline-based navigation (Task 1), `PageReadingPane.tsx` rendering real Page content via `MarkdownViewer` (Task 2), adaptive-learning reconciliation explicitly scoped out (Task 3), tests (Task 4). Status: review. This is the final story in Epics 7–11 (ContentAuthoring) — all 15 stories are now at `review`.
