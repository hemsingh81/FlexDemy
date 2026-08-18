---
baseline_commit: 245d80348a8c8e55a2e4dbd2037bbd83385a56ce
---

# Story 11.2: Preview as Student

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tutor,
I want to preview a page, a whole node, or the whole course exactly as a student will see it,
So that I catch problems before publishing, not after.

## Acceptance Criteria

1. **Given** the tutor is viewing any page, node, or the whole course **When** they select "Preview as student" **Then** it renders through the same component path the real student player uses — never a second, drifting renderer — at the scope selected (FR-46)
2. The preview surface never goes through a Tiptap editor instance — reading always renders via the existing `lib/markdown.ts` (frontend AD-4/AD-9 resolution), fetching the whole chapter document in one call for node/course scope or a single page for page scope

## Tasks / Subtasks

- [x] Task 1 — Backend: single-page fetch endpoint (AC: #2)
  - [x] **This endpoint doesn't exist yet.** Every prior Epic 7–10 story built `GET content/chapters/{chapterId}/document` (whole-chapter, with bodies) and `GET content/chapters` (list, no bodies) — nothing returns one `Page` on its own. This story's page-scope preview needs it, and Story 11.4's real Course Player will reuse the exact same endpoint (confirmed by reading that story's own AC wording: "fetches each Page's body via `courseContentService.getPage(pageId)`") — build it generically here rather than scoping it to "preview only"
  - [x] `GET content/pages/{pageId}` → `PageDocumentDto` (the same shape already nested inside `ChapterDocumentDto`/`TopicDocumentDto`/etc. from Stories 7.3/8.1 — reuse that exact DTO type, don't define a second one), ownership-only read check for the tutor-preview caller this story adds (not Draft-gated, matching every other read on this controller); Story 11.3 will later add the reviewer/student read branches to this same route, not a second route
  - [x] `IContentService.GetPageAsync(courseId, pageId)` on the existing `ContentService`/`ContentController`, same file both epics have been extending throughout — reuses the already-existing `LoadPageInCourseAsync` ownership-chain helper and `BuildResourceDtosAsync`, both already shared by every other Page method in this file

- [x] Task 2 — Frontend: `courseContentService.getPage` (AC: #2)
  - [x] `getPage(courseId, pageId): Promise<PageDocumentDto>` added to `courseContentService.ts`

- [x] Task 3 — Frontend: the Preview-as-Student rendering surface (AC: #1, #2)
  - [x] **This is a new component, not a reuse of `CoursePlayer/ReaderCanvas.tsx`.** Read `ReaderCanvas.tsx` before assuming otherwise: it's confirmed still the pre-ContentAuthoring, mock-data sentence/drilldown reading pane (`sentences: Sentence[]`, `useInlineDrilldownState`) — it has **not** been rewired to read real `Page.BodyMarkdown` yet (that rewiring is Story 11.4's job, sequenced after this one in the epic). Building Preview-as-Student on top of a component that doesn't read real content yet would mean either blocking this story on 11.4 landing first (out of order) or quietly depending on unbuilt behavior. Instead, this story renders through the **same underlying renderer** (`lib/markdown.ts`/`ui/MarkdownViewer.tsx`, extended by every Epic 9 story to already handle Math/Callout/Table/Resource-card/Image) inside its **own** lightweight preview shell — this satisfies AC #1's "same component path... never a second, drifting renderer" at the renderer level (the actual thing that could drift is the Markdown-to-visual mapping, and that's shared), while AC #2 is explicit that this and the real Course Player are allowed to be structurally distinct surfaces reading the same content the same way
  - [x] New `features/CourseContentEditor/PreviewAsStudent.tsx`: a full-viewport overlay (`fixed inset-0 z-50`, the same idiom `CourseContentEditor`'s own Maximized state and `SidePanel`/`CourseReviewModal`/`FlashcardsModal` already use) rendering one or more Pages via `MarkdownViewer`, resolving every `resource:{id}` reference through `courseContentService.resolveResourceUrl()` (Story 8.3) exactly as the editor's own "Preview" toggle (Story 7.3) already does — reused directly, not reimplemented
  - [x] **Page scope**: fetches one Page via `getPage` (Task 2), renders it alone
  - [x] **Node scope**: fetches the owning Chapter's full document via the existing `GET .../document` endpoint, then renders only the subtree rooted at the selected node (its own Description, plus every Page/child-node beneath it in document order) — filtered client-side (`findAndFlattenNode`) from data already fetched
  - [x] **Course scope**: fetches the Chapter list (`getChapters`) then walks it, fetching each Chapter's full document **in sequence** and rendering all of them
  - [x] Entry points: added a "Preview as student" (`GraduationCap` icon) action to `HeadingControls.tsx`'s per-heading row for every kind (Topic/Sub-Topic/Page — node and page scope), and a "Preview as student" button in `CourseContentEditor.tsx`'s own header (course scope, always available while a draft exists)

- [x] Task 4 — Tests
  - [x] Backend: `GetPageAsync` returns the correct page, ownership-checked, not Draft-gated
  - [x] `FrontEnd/tests/features/CourseContentEditor/PreviewAsStudent.test.tsx`: page scope fetches exactly one page; node scope renders only the selected subtree, not sibling content; course scope issues one `getChapterDocument` call per Chapter, in Chapter order; a `resource:{id}` reference resolves to a real URL via the shared `resolveResourceUrl`, not a raw URI left unresolved in the rendered output

## Dev Notes

- **A genuinely new endpoint (`GET content/pages/{pageId}`) that Story 11.4 will also depend on** — build it generically now rather than letting 11.4 duplicate it.
- **`ReaderCanvas.tsx` is confirmed still mock-data/sentence-based by reading the live file during this story's own research** — this is not an assumption carried from the architecture spine's prose (which describes the target end state); it's a direct finding. This story does not touch `ReaderCanvas.tsx` at all; Story 11.4 does.
- **Architecture:** AD-4/AD-9's "reading never goes through Tiptap, always `lib/markdown.ts`" resolution — this story's first real tutor-facing exercise of it (Story 7.3's "Preview" toggle was the first exercise overall, this extends the same principle to a dedicated full surface).
- **Existing code to read before editing:** `ReaderCanvas.tsx` (confirmed NOT to reuse, see above), `ui/MarkdownViewer.tsx`, Story 8.3's `resolveResourceUrl`, Story 7.3's Preview-toggle implementation (the closest existing precedent for "render a Page via `lib/markdown.ts` inside the editor"), `CourseContentEditor.tsx`'s Maximized-state `fixed inset-0 z-50` pattern (the overlay idiom to reuse).
- **Git context:** no new commits since Story 11.1 was authored in this same session.

### Project Structure Notes

- New frontend file: `features/CourseContentEditor/PreviewAsStudent.tsx`.
- No new backend files — extends `ContentService.cs`/`ContentController.cs` with one new action.

### References

- [Source: _specs/planning-artifacts/epics-ContentAuthoring.md#Story 11.2] — verbatim Acceptance Criteria
- [Source: _specs/implementation-artifacts/7-3-...md, 8-3-...md] — Preview-toggle precedent, `resolveResourceUrl`
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md#AD-4, #AD-9] — per-Chapter whole-course walk, reading-never-through-Tiptap
- [Source: FrontEnd/src/features/CoursePlayer/ReaderCanvas.tsx] — live code, confirmed still mock-data-based

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- **`GET content/pages/{pageId}`** implemented exactly as scoped: `IContentService.GetPageAsync` reuses the existing `LoadPageInCourseAsync` (ownership-chain check, already shared by every other Page method) and `BuildResourceDtosAsync` — no new lookup logic, an ownership-only read (`EnsureOwnedAsync`, not Draft-gated), matching `GetChapterDocumentAsync`'s own posture.
- **Entry points**: added "Preview as student" (`GraduationCap` icon) to `HeadingControls.tsx`'s per-heading row, available on every entry kind (Topic/Sub-Topic/Page) — distinct from the existing page-only `Eye`-icon "Preview" (Story 7.3's in-place Preview/Markdown toggle), since this opens the separate, full Preview-as-Student overlay rather than an inline panel. Course scope got its own always-visible button in `CourseContentEditor.tsx`'s header.
- **Where the overlay is owned**: `PreviewAsStudent` needs no Tiptap editor at all (it fetches its own data independently), so its open/close state (`previewScope`) lives in `CourseContentEditor.tsx`, not inside `DocumentCanvas.tsx` — `DocumentCanvas` only maps a `HeadingEntry` (topic/subtopic/page, always within its own currently-open Chapter) into a `PreviewScope` and bubbles it up via a callback prop, the same sibling-bridging pattern Story 11.1's blocker-focus mechanism already established.
- **Node-scope flattening** (`findAndFlattenNode`/`flattenChapter`/`flattenTopic`/`flattenSubtopic` in `PreviewAsStudent.tsx`) walks the already-fetched `ChapterDocumentDto` client-side, in document order, matching AC's "own Description if a heading, plus every Page/child-node beneath it" — no new backend query for node scope, confirmed by the "node scope renders only its own subtree, not sibling content" test.
- All 785 frontend tests and 936 backend tests (561 Application + 234 Infrastructure + 141 Api) pass with zero regressions.

### File List

- `Backend/src/FlexDemy.Application/Courses/IContentService.cs` — MODIFIED: added `GetPageAsync`
- `Backend/src/FlexDemy.Application/Courses/ContentService.cs` — MODIFIED: implemented it
- `Backend/src/FlexDemy.Api/Controllers/ContentController.cs` — MODIFIED: new `GET pages/{pageId}` action
- `Backend/tests/FlexDemy.Application.Tests/Courses/ContentServiceTests.cs` — MODIFIED: new `GetPageAsync` tests
- `FrontEnd/src/services/courseContentService.ts` — MODIFIED: new `getPage`
- `FrontEnd/src/features/CourseContentEditor/PreviewAsStudent.tsx` — NEW: the preview overlay (page/node/course scope)
- `FrontEnd/src/features/CourseContentEditor/HeadingControls.tsx` — MODIFIED: new `onPreviewAsStudent` prop, rendered for every entry kind
- `FrontEnd/src/features/CourseContentEditor/DocumentCanvas.tsx` — MODIFIED: `onPreviewAsStudent` prop, maps `HeadingEntry` → `PreviewScope`
- `FrontEnd/src/features/CourseContentEditor/CourseContentEditor.tsx` — MODIFIED: `previewScope` state, header button, renders `PreviewAsStudent`
- `FrontEnd/tests/features/CourseContentEditor/PreviewAsStudent.test.tsx` — NEW: page/node/course scope + resource resolution + error-state tests

### Change Log

- 2026-08-18: Story 11.2 implemented — `GET content/pages/{pageId}` (Task 1), `getPage` (Task 2), `PreviewAsStudent.tsx` with page/node/course scope and entry points (Task 3), tests (Task 4). Status: review.
