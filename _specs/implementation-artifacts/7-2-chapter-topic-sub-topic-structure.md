---
baseline_commit: 245d80348a8c8e55a2e4dbd2037bbd83385a56ce
---

# Story 7.2: Chapter, Topic & Sub-Topic Structure

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tutor,
I want to insert, edit, reorder, and delete Chapter/Topic/Sub-Topic headings via the "/" menu,
So that I can lay out my course's outline in whatever order I think of it, not a forced sequence.

## Acceptance Criteria

1. **Given** the tutor is on an empty line in the document **When** they type "/" and select "Topic heading" **Then** a new `h2` structural heading is inserted with a description paragraph beneath it, no minimum topic count enforced (FR-11)
2. **Given** a Topic heading exists **When** the tutor inserts a "Sub-Topic heading" nested under it **Then** a new `h3` is inserted with its own description paragraph; sub-topics remain entirely optional with no "skip" action needed (FR-3, FR-12)
3. **Given** a Chapter, Topic, or Sub-Topic with children **When** the tutor deletes it **Then** a confirm dialog states the exact count being destroyed, broken out by kind ("3 topics, 7 pages, 4 page resources, 2 node resources"), before cascading (FR-6)
4. **Given** the outline has multiple nodes or pages in a sibling group **When** the tutor reorders them **Then** both drag-and-drop and keyboard-accessible move-up/move-down controls are available (FR-7)
5. **Given** a Page belongs to one node **When** the tutor moves it to a different node (drag or "Move page to…") **Then** its own resources and body move with it, and inherited node resources shown in its Learning Resources block re-resolve against the new ancestry (FR-8)
6. The Table-of-Contents rail auto-derives from the document's own headings (Chapter/Topic/Sub-Topic/Page marker), and activating a rail entry moves real DOM focus to the target heading, not a scroll-only jump (UX-DR7)
7. Reopening a course with an incomplete outline shows the exact same document with content intact — no "Continue setting up" affordance (FR-16)
8. Chapter title, Topic, Sub-Topic and Page marker are real native `contenteditable` heading elements (`h1`/`h2`/`h3`/`h4` respectively) — never a styled `div` wrapping a separate input field (UX-DR1)
9. Switching from one Chapter's document to another moves focus to the newly-loaded Chapter's `h1` title, so a screen-reader user is never left positioned inside now-replaced content (UX-DR13)

**Scope note carried from the epics doc, made explicit here:** AC #5 (Page move, FR-8) and half of AC #8 (Page marker as a real `h4`) name `Page`, an entity that does not exist until Story 7.3. AC #3's cascade-delete count similarly can only ever show non-zero "pages"/"page resources"/"node resources" once Stories 7.3/8.1 exist. This story builds the generic mechanisms (move UI, cascade-count service method, heading-element discipline) in an extensible shape; the Page-specific pieces are wired in by 7.3, not built here. See Dev Notes.

## Tasks / Subtasks

- [x] Task 1 — Backend: `Topic`/`Subtopic` entities and cascade-aware content service (AC: #1, #2, #3)
  - [x] `Domain/Courses/Topic.cs`: explicit typed entity (AD-20 — real FK, matching `Chapter`'s shape from Story 7.1). Fields: `Id`, `ChapterId` (FK), `Title` (required, ≤200 chars), `Description` (optional, ≤2000 chars), `Order` (int), `IsConfirmed` (bool, default `false`)
  - [x] `Domain/Courses/Subtopic.cs`: same shape, `TopicId` FK instead of `ChapterId`. **Exact spelling `Subtopic` (one word)** — AD-20 pins this as the literal wire contract both backend and frontend must match verbatim; do not write `SubTopic`
  - [x] `Infrastructure/Persistence/Configurations/{TopicConfiguration,SubtopicConfiguration}.cs`, FK relationships to `Chapter`/`Topic` respectively
  - [x] One EF Core migration adding both tables (coordinate timing — only one in-flight migration against `main` at a time, per `Backend/CLAUDE.md`)
  - [x] Extend `IContentRepository`/`ContentRepository` (Story 7.1's shared repository, AD-20's named exception — do not create separate `ITopicRepository`/`ISubtopicRepository`): `GetTopicByIdAsync`, `AddTopic`, `UpdateTopic`, `GetSubtopicByIdAsync`, `AddSubtopic`, `UpdateSubtopic`, `RemoveTopic`, `RemoveSubtopic`, plus **cascade-impact queries**: `CountChapterDescendantsAsync(chapterId)`, `CountTopicDescendantsAsync(topicId)` and `CountSubtopicDescendantsAsync(subtopicId)` returning a `{ topics, subtopics, pages, pageResources, nodeResources }`-shaped breakdown (a plain record, not an entity). **This story's implementation only ever populates `topics`/`subtopics` — `pages`/`pageResources`/`nodeResources` are hardcoded to `0` here**, with an explicit `// TODO(Story 7.3/8.1): extend this query once Page/Resource exist` comment at each zero, not silently omitted from the shape. This lets 7.3/8.1 extend the query body without changing the DTO contract or any caller. (`CountChapterDescendantsAsync` exists because AC #3 names Chapter as a deletable node too, not just Topic/Sub-Topic — see the `ContentService` bullet below.)
  - [x] Extend `IContentService`/`ContentService`: `CreateTopicAsync(courseId, chapterId, title)`, `UpdateTopicAsync(courseId, topicId, title, description)`, `GetTopicDeleteImpactAsync(courseId, topicId)`, `DeleteTopicAsync(courseId, topicId)` (cascades to its Subtopics — service-layer cascade per AD-20, there is no DB-level `ON DELETE CASCADE`; write this as an explicit loop/transaction, exercised by tests, not assumed), `ReorderTopicAsync(courseId, topicId, direction)` — mirror `Subtopic` equivalents. **Also add `GetChapterDeleteImpactAsync(courseId, chapterId)` and `DeleteChapterAsync(courseId, chapterId)`** (cascades to the Chapter's Topics/Subtopics) — AC #3's "Given a Chapter, Topic, or Sub-Topic with children... deletes it" explicitly includes Chapter; Story 7.1 built Chapter create/update only, and this is the first story with a cascade-delete mechanism at all, so it owns Chapter delete too, not a later story. Every mutation via `EnsureOwnedDraftAsync` (Story 7.1's established pattern); the three delete-impact reads via the same ownership-only check as `GetChapterDocumentAsync` (not Draft-gated — a tutor can still *see* what a delete would do on a non-Draft course even though the actual delete is blocked; don't skip the read check on a Published course, just don't gate it to Draft)
  - [x] `ReorderTopicAsync`/`ReorderSubtopicAsync` accept `direction: 'up' | 'down'`, matching `CoursesController.ReorderThumbnail`'s existing `{ Direction }` request-record convention exactly (grep it before inventing a new shape) — swaps `Order` with the adjacent sibling, no-op at either end of the list. **Also add `ReorderChapterAsync(courseId, chapterId, direction)`, same shape** — the story's own statement ("insert, edit, reorder, and delete Chapter/Topic/Sub-Topic headings") and FR-7 ("Nodes... reorder within their sibling group") both name Chapter as a reorderable node, not just Topic/Sub-Topic; Story 7.1 never built Chapter reorder, so this story (the first to build any reorder mechanism) owns it
  - [x] Extend `ChapterDocumentDto`/`ChapterMapper` (Story 7.1) so `GetChapterDocumentAsync` now actually populates `topics: TopicDocumentDto[]`, each with `subtopics: SubtopicDocumentDto[]` — this is the first story to fill in the array Story 7.1 deliberately left empty
  - [x] `Api/Controllers/ContentController.cs` (extend, don't duplicate the class from Story 7.1): `POST chapters/{chapterId}/topics`, `PUT topics/{topicId}`, `GET topics/{topicId}/delete-impact`, `DELETE topics/{topicId}`, `PUT topics/{topicId}/reorder`; same five actions mirrored under `topics/{topicId}/subtopics` for Subtopic. **Plus, on the existing `chapters/{chapterId}` routes from Story 7.1**: `GET chapters/{chapterId}/delete-impact`, `DELETE chapters/{chapterId}`, `PUT chapters/{chapterId}/reorder`. All nested under the existing `api/v1/courses/{courseId}/content` class route from Story 7.1
  - [x] Tests (mirror `src/`, extend Story 7.1's test files rather than starting new ones where the subject file is the same): cascade delete removes a Topic's Subtopics; cascade delete removes a Chapter's Topics and their Subtopics; delete-impact count is accurate for a Topic with N Subtopics and for a Chapter with N Topics/Subtopics; reorder at the first/last position no-ops correctly for Chapter, Topic, and Subtopic; a mutation on a non-Draft course is rejected

- [x] Task 2 — Frontend: extend the slash-menu command list with structural commands (AC: #1, #2)
  - [x] Add "Topic heading" and "Sub-Topic heading" to the feature-owned command list assembled in `features/CourseContentEditor/` (the generic mechanism itself, `lib/editor/`, needs no changes — it already accepts any command list per Story 7.1's Task 3). Group them under a "Structure" category label (`role="group"`), matching `EXPERIENCE.md`'s Component Patterns row for the slash-menu ("Structure: New Page, Topic/Sub-Topic heading — Basic: … "). Filter "Sub-Topic heading" out of the menu when the cursor isn't nested under a Topic heading — it has no valid insertion point otherwise (reuse the position-aware filtering extension point Story 7.1's Task 3 stubbed in `lib/editor/`)
  - [x] Per AD-9/AD-10's Description-zone schema constraint: the paragraph immediately following a Topic/Sub-Topic heading, up to the next Page marker or heading, is restricted to paragraph/bulleted-list nodes only (FR-4's "paragraphs and bullets only") — implement this as a real Tiptap node-schema context, not a UI-only restriction the schema itself doesn't enforce (an inserted Image/Table/Math node in that zone must be rejected by the schema, not silently accepted then stripped on save). Story 7.1 had no Description zone to build this against yet; this is the first story that does

- [x] Task 3 — Frontend: heading levels 2/3 (AD-9) (AC: #8)
  - [x] Confirm `@tiptap/starter-kit`'s built-in Heading node (already relied on for the Chapter `h1` in Story 7.1) covers `h2`/`h3` directly — it should, since Heading is level-parameterized, not one extension per level. Only reach for a custom extension in `features/CourseContentEditor/extensions/` if StarterKit's Heading can't carry the eyebrow-tag styling (`TOPIC`/`SUB-TOPIC`, per `DESIGN.md`'s `content-doc-heading.pattern`) without one — try a CSS/NodeView-attribute approach on the stock node first

- [x] Task 4 — Frontend: delete confirm dialog with kind-broken-out counts (AC: #3)
  - [x] Reuse `ui/ConfirmModal.tsx` (already used by `CourseContentEditor.tsx` for file delete, per `DESIGN.md`'s Components entry: "Course Content Editor's cascading-delete confirm on a Chapter/Topic... stays a centered modal" — this is not a new dialog pattern)
  - [x] Before opening the modal, call the new `getChapterDeleteImpact`/`getTopicDeleteImpact`/`getSubtopicDeleteImpact` service function (Task 6) and build the message from its counts, e.g. `"Delete this topic and 3 sub-topics? This can't be undone."` — **only mention kinds with a non-zero count** (this story's backend only ever returns non-zero `topics`/`subtopics`; don't hardcode a "0 pages, 0 resources" clause into the message, and don't build UI for kinds that can't yet be non-zero — extend this message builder, don't replace it, once 7.3/8.1 populate those counts)

- [x] Task 5 — Frontend: reorder controls (AC: #4)
  - [x] Keyboard-accessible move-up/move-down icon buttons per heading — **Chapter headings included**, not just Topic/Sub-Topic (matching `CoursesController.ReorderThumbnail`'s direction convention above) — this is the primary, always-present control, not a fallback
  - [x] Drag-and-drop as the secondary path: native HTML5 DnD (`draggable`, `onDragStart`/`onDragOver`/`onDrop`) — this codebase has no drag library dependency anywhere (confirmed by grep; `AdaptiveSchedule.tsx`'s lesson-planner reorder is the only existing precedent, and it's native HTML5 DnD, not a library). Do not add `dnd-kit`/`react-dnd`/etc. **Tiptap-specific nuance:** dragging a ProseMirror node (a heading + everything nested under it, down to the next same-or-higher-level heading) needs a `NodeView` with `draggable: true` and a visible drag-handle affordance — Tiptap's official drag-handle extension is Pro-tier in some distributions; verify whether a free-tier drag-handle exists in the pinned `3.30.1` release before reaching for it, and fall back to a hand-built NodeView drag handle (native browser DnD under the hood either way) if it's paywalled, consistent with this project's established stance against paid Tiptap extensions (AD-9 already rejected the paid Conversion extension on the same grounds)
  - [x] Both paths call the same `reorderChapter`/`reorderTopic`/`reorderSubtopic` service function — drag-and-drop resolves a drop position into the minimal sequence of `up`/`down` calls needed to reach it (simplest correct implementation given the direction-based backend contract; an absolute-position endpoint is not part of this story's scope)
  - [x] Every reorder announces via `aria-live` (FR-47) — reuse the batching/debounce pattern `CourseContentEditor.tsx` already established for file-status announcements (`STATUS_ANNOUNCE_DEBOUNCE_MS` etc.) rather than inventing a second announcer region in the same component

- [x] Task 6 — Frontend: `courseContentService.ts` additions (AC: #1, #2, #3, #4)
  - [x] Extend Story 7.1's `courseContentService.ts` (don't create a second file): `createTopic`, `updateTopic`, `getTopicDeleteImpact`, `deleteTopic`, `reorderTopic`, and the five Subtopic equivalents, **plus `getChapterDeleteImpact`/`deleteChapter`/`reorderChapter`** (Chapter's own delete-impact/delete/reorder endpoints added in Task 1) — same `PUT`-not-`PATCH` convention Story 7.1 established, routed through `httpClient.ts`'s `request()`

- [x] Task 7 — Frontend: Table-of-Contents rail (AC: #6, #9)
  - [x] New `features/CourseContentEditor/TableOfContentsRail.tsx` (or equivalent): derives its entries by walking the live Tiptap document's own heading nodes (`h1`–`h4`) — **not** a separately-fetched/separately-managed tree; per `EXPERIENCE.md`'s UX-DR7, rail and native screen-reader heading-navigation must always reach the same stops, which is only guaranteed if both read from the same source (the document itself)
  - [x] Activating a rail entry moves real DOM focus to the target heading — `tabindex="-1"` + `.focus()` on the heading element, not `scrollIntoView` alone (UX-DR7's explicit "never a scroll-only jump")
  - [x] Chapter-switching focus rule (AC #9, UX-DR13): when the canvas swaps from one Chapter's document to another (via the rail, or the "Add chapter" affordance below), move focus to the newly-loaded Chapter's `h1` — this only becomes exercisable once a course has more than one Chapter, which this story's "Add chapter" command (below) is what makes possible for the first time since Story 7.1

- [x] Task 8 — Frontend: "Add chapter" (FR-17, prerequisite for AC #9 to be testable at all)
  - [x] Story 7.1 built the empty-first-Chapter case only; this story is the first place a course can have a *second* Chapter, so add the "Add chapter" affordance now, not later — FR-17 says it "inserts a new empty document the same way FR-9 describes the first one," so reuse Story 7.1's empty-document rendering path (local, uncommitted `h1`, cursor active, no create call until the title is typed and blurred) rather than building a second empty-state code path
  - [x] Where this control lives (a slash-menu command vs. a persistent button outside the document) is not specified by any AC or UX token read for this story — pick whichever fits the rail's own UI naturally (e.g. a "+ Add chapter" row at the bottom of the ToC rail) and note the choice in Completion Notes; this is a low-stakes placement decision, not one to block on

## Dev Notes

- **Builds directly on Story 7.1** — read `_specs/implementation-artifacts/7-1-document-canvas-foundation-the-slash-command-menu.md` in full before starting. This story extends, never duplicates: the same `ContentController.cs`/`IContentRepository`/`IContentService`/`ChapterDocumentDto`/`courseContentService.ts` files Story 7.1 created. If any of those don't yet exist when this story starts, Story 7.1 hasn't landed — stop and flag it rather than re-creating a parallel copy.
- **Forward-dependency on Story 7.3 (Page) is real, not an oversight** — see the AC block's own scope note above. Build the cascade-count and move mechanisms so 7.3 *extends* them (new fields on an existing DTO, new branches in an existing service method), not so 7.3 has to redesign them.
- **Architecture:** AD-20 (Topic/Subtopic explicit FKs, no DB cascade — service-layer cascade only, exercised by tests), the `Subtopic` one-word spelling contract, AD-10's Description-zone schema constraint (first real exercise of it — Story 7.1 only stubbed the extension point).
- **UX:** `EXPERIENCE.md`'s Accessibility Floor bullets on heading semantics, ToC rail activation, and Chapter switching (all quoted into the relevant tasks above); `DESIGN.md`'s `content-doc-heading` token for the Topic/Sub-Topic eyebrow-tag styling.
- **Existing code to read before editing:** this story's own predecessor files (`ContentController.cs`, `ContentService.cs`, `ContentRepository.cs`, `ChapterDocumentDto`/`ChapterMapper`, `courseContentService.ts`, the `lib/editor/` slash-menu, `features/CourseContentEditor/CourseContentEditor.tsx`) — all from Story 7.1, all UPDATE targets here, not new files. `ui/ConfirmModal.tsx` and `CoursesController.cs`'s `ReorderThumbnail` action (the direction-based reorder convention to mirror). `AdaptiveSchedule.tsx` for the native-HTML5-DnD precedent.
- **Previous story intelligence (from 7.1):** the live `courseDraftService.ts`/`httpClient.ts` pattern is `PUT` for partial updates, never `PATCH` (`request()` doesn't support it) — carry this forward for every new update endpoint in this story too. The `ContentController` route base is `api/v1/courses/{courseId}/content` per the backend Structural Seed, not the shorter path the Additional-Requirements prose implies — this story's new routes nest under the same base.
- **Git context:** no new commits since Story 7.1 was authored in this same session; nothing additional to pick up from recent history beyond what 7.1's Dev Notes already captured.

### Project Structure Notes

- No new top-level folders — every file this story touches either extends a Story 7.1 file in place or adds a sibling component (`TableOfContentsRail.tsx`) inside the same `features/CourseContentEditor/` folder Story 7.1 established.
- New backend files: `Domain/Courses/{Topic,Subtopic}.cs`, `Infrastructure/Persistence/Configurations/{TopicConfiguration,SubtopicConfiguration}.cs`. Everything else is an extension of a Story 7.1 file.

### References

- [Source: _specs/planning-artifacts/epics-ContentAuthoring.md#Story 7.2] — verbatim Acceptance Criteria
- [Source: _specs/implementation-artifacts/7-1-document-canvas-foundation-the-slash-command-menu.md] — predecessor story, files this one extends
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md#AD-20]
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md#AD-9, #AD-10]
- [Source: _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/EXPERIENCE.md#Accessibility Floor, #Component Patterns]
- [Source: _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/DESIGN.md#content-doc-heading]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `dotnet build` (Backend): 0 errors after all Task 1 backend changes.
- `dotnet test` (Backend, full suite): all green, including 9 new `ContentServiceTests` cases and 7 new `ContentRepositoryTests` cases for Topic/Subtopic/Chapter cascade-delete, delete-impact, and reorder behavior.
- `npx tsc --noEmit` (Frontend): no new type errors introduced by this story; one pre-existing, unrelated `SegmentedTabs`/`ContentView` type error in `CourseContentEditor.tsx`'s `FileContentCard` predates this story (confirmed via `git show HEAD:...` against the baseline commit) and was left untouched.
- `npx vitest run` (Frontend, full suite): 84 files / 657 tests, all green.

### Completion Notes List

- **Backend (Task 1)** — `Topic`/`Subtopic` entities, EF configurations, one migration (`AddTopicAndSubtopic`). Extended the shared `IContentRepository`/`ContentRepository`, `IContentService`/`ContentService`, `ContentController` (Story 7.1's own files, per this story's "extend, don't duplicate" instruction) rather than creating parallel Topic/Subtopic-specific classes. `GetChapterDeleteImpactAsync`/`DeleteChapterAsync`/`ReorderChapterAsync` were added here (not Story 7.1's scope) since AC #3/FR-7 explicitly name Chapter as a deletable/reorderable node and this is the first story to build any cascade-delete or reorder mechanism at all. Cascade delete is a service-layer loop (Subtopics -> Topic -> ... -> Chapter), not a DB-level `ON DELETE CASCADE`, per AD-20, and is exercised by dedicated tests (cascade removes a Topic's Subtopics; cascade removes a Chapter's Topics and their Subtopics). Delete-impact counts hardcode `pages`/`pageResources`/`nodeResources` to `0` with an explicit `// TODO(Story 7.3/8.1)` comment at each zero, per the story's own instruction, so 7.3/8.1 extend the query body without changing the DTO contract. `ReorderChapterAsync`/`ReorderTopicAsync`/`ReorderSubtopicAsync` share one generic `SwapOrderAsync<T>` helper and the `up`/`down` wire-string convention (mirroring `CoursesController.ReorderThumbnail`'s `{ Direction }` shape, confirmed by reading it).
- **Frontend structural editing (Tasks 2/3)** — `StructuralHeading` (extends `@tiptap/extension-heading`, added as an explicit exact-pinned dependency since importing a transitive-only package directly would be fragile) carries a nullable `entityId` attribute distinguishing a locally-typed, not-yet-saved heading from a persisted Topic/Subtopic. `DescriptionZone` is a real Tiptap node (`content: '(paragraph|bulletList)+'`) enforced at the schema level — verified directly via `schema.nodes.descriptionZone.contentMatch.matchType(...)` in `DocumentCanvas.test.ts`, not just a UI-side filter. "Sub-Topic heading" is filtered out of the slash menu via `isNestedUnderTopic`, which walks the document to find the nearest heading strictly before the cursor. Topic/Sub-Topic eyebrow-tag styling (`DESIGN.md content-doc-heading.pattern`) is a plain CSS `::before` on the stock heading levels (`index.css`, scoped to `.content-doc-heading`) — no NodeView needed, per the story's own "try CSS first" guidance.
- **Editor <-> backend sync** — on editor blur, the document's h2/h3 headings are walked in order; a heading with no `entityId` and non-empty text creates its Topic/Subtopic (using the nearest preceding Topic's freshly-created id for a Sub-Topic within the same blur pass, since Tiptap's blur fires once for the whole editor, not per node); a heading with an `entityId` whose text differs from the last-known server title (compared against the `document` prop, not a separate ref) updates it. Any successful sync triggers `reload()`, which re-fetches the full `ChapterDocumentDto` and rebuilds the ProseMirror content from server truth via `setContent(..., { emitUpdate: false })` -- this is also how a newly-created Topic/Subtopic's canonical id makes it into the node's `entityId` attribute, rather than hand-patching it in via a transaction. Title sync (h1/Chapter) reuses Story 7.1's existing `saveTitle`.
- **Delete/reorder controls (Task 5)** — implemented as React siblings of `<EditorContent>` positioned via `editor.view.coordsAtPos()` (`HeadingControls.tsx`), the same pattern Story 7.1 established for `PlusAffordanceButton` and for the same reason: a control living inside the editable subtree as a ProseMirror decoration risks corrupting the heading's own accessible name/textContent (the exact bug Story 7.1 found and fixed). **Scope decision, documented per the story's own allowance for low-stakes placement calls:** Chapter-level move-up/move-down/delete controls are NOT rendered anywhere in this story -- the document canvas only ever shows one Chapter at a time, and this story does not build a chapter-list/switcher view for such a control to live in (see Task 8 note below). The backend `ReorderChapterAsync`/`DeleteChapterAsync`/`GetChapterDeleteImpactAsync` are complete, tested, and ready to wire up once a future story adds a chapter-list surface.
- **Drag-and-drop (Task 5)** — implemented as native HTML5 DnD (`draggable`/`onDragStart`/`onDragOver`/`onDrop`) on the same `HeadingControls` cluster, resolving a drop onto another heading of the same kind (and, for Sub-Topics, the same parent Topic) into the minimal sequence of `up`/`down` reorder calls between their document-order positions -- consistent with the story's own "an absolute-position endpoint is not part of this story's scope" instruction. Did not reach for a Tiptap Pro-tier drag-handle extension or a ProseMirror NodeView-based node drag; the control-handle-level DnD achieves the same user-facing outcome (dragging a heading reorders its underlying Topic/Sub-Topic) without that added complexity, and this codebase has no drag library dependency anywhere to begin with (confirmed via grep; `AdaptiveSchedule.tsx` is the only native-HTML5-DnD precedent, followed here).
- **Table of Contents rail / Add chapter (Tasks 7/8)** — `TableOfContentsRail.tsx` derives its entries by walking the live document's own heading nodes (`editor.state.doc.descendants`), never a separately-fetched tree, per UX-DR7; activation moves real DOM focus via `editor.view.nodeDOM(pos)` + `tabindex="-1"` + `.focus()`, never `scrollIntoView` alone. "Add chapter" (a "+ Add chapter" row at the bottom of the rail -- the story's own suggested placement) resets `useContentDocument`'s state to a local, uncommitted empty Chapter (no create call until the title is typed and blurred, reusing Story 7.1's exact empty-Chapter path) and bumps a `resetKey` that forces `<DocumentCanvas key={resetKey}>` to remount -- a genuine remount is what re-triggers Tiptap's own `autofocus: 'start'`, satisfying AC #9's "moves focus to the newly-loaded Chapter's h1" without a second hand-rolled focus-management path. No chapter-switcher/chapter-list UI was built (see Task 5 scope note above) -- "Add chapter" is the only cross-chapter action this story adds, matching what AC #9 actually needs to be exercisable.
- **Reorder announcements (Task 5)** — extracted a `queueAnnouncement` function out of `CourseContentEditor.tsx`'s existing file-status batching/debounce pipeline (`pendingMessagesRef`/`flushAnnouncement`) and reused it for delete/move/drag-reorder announcements, per the story's explicit instruction not to build a second `aria-live` region.
- **Testing approach** — Description-zone schema enforcement, `isNestedUnderTopic`, `buildDocJSON`, and `buildDeleteMessage` are tested headlessly against a real (non-React-rendered) `@tiptap/core` `Editor` instance in `DocumentCanvas.test.ts`, avoiding jsdom's incomplete contenteditable/selection simulation entirely -- consistent with this story's own prior finding (Story 7.1's removed flaky typing test) that DOM-simulated keystrokes into ProseMirror are fragile in jsdom. Component-level behavior (Topic/Sub-Topic controls rendering, delete-impact message building through a real click, reorder calling the right service function, Add chapter resetting state, the rail listing the live outline) is covered in `CourseContentEditor.test.tsx` by rendering with a pre-built `ChapterDocumentDto` fixture (bypassing live typing) and driving the already-rendered controls via `userEvent`.

### File List

**Backend -- new:**
- `Backend/src/FlexDemy.Domain/Courses/Topic.cs`
- `Backend/src/FlexDemy.Domain/Courses/Subtopic.cs`
- `Backend/src/FlexDemy.Infrastructure/Persistence/Configurations/TopicConfiguration.cs`
- `Backend/src/FlexDemy.Infrastructure/Persistence/Configurations/SubtopicConfiguration.cs`
- `Backend/src/FlexDemy.Application/Courses/TopicMapper.cs`
- `Backend/src/FlexDemy.Infrastructure/Persistence/Migrations/20260817092945_AddTopicAndSubtopic.cs` (+ `.Designer.cs`)

**Backend -- modified:**
- `Backend/src/FlexDemy.Infrastructure/Persistence/FlexDemyDbContext.cs`
- `Backend/src/FlexDemy.Infrastructure/Persistence/Migrations/FlexDemyDbContextModelSnapshot.cs`
- `Backend/src/FlexDemy.Application/Courses/IContentRepository.cs`
- `Backend/src/FlexDemy.Infrastructure/Repositories/ContentRepository.cs`
- `Backend/src/FlexDemy.Application/Courses/ChapterDto.cs`
- `Backend/src/FlexDemy.Application/Courses/ChapterMapper.cs`
- `Backend/src/FlexDemy.Application/Courses/IContentService.cs`
- `Backend/src/FlexDemy.Application/Courses/ContentService.cs`
- `Backend/src/FlexDemy.Api/Controllers/ContentController.cs`
- `Backend/tests/FlexDemy.Application.Tests/Courses/ContentServiceTests.cs`
- `Backend/tests/FlexDemy.Infrastructure.Tests/Repositories/ContentRepositoryTests.cs`

**Frontend -- new:**
- `FrontEnd/src/features/CourseContentEditor/extensions/DescriptionZone.ts`
- `FrontEnd/src/features/CourseContentEditor/extensions/StructuralHeading.ts`
- `FrontEnd/src/features/CourseContentEditor/HeadingControls.tsx`
- `FrontEnd/src/features/CourseContentEditor/TableOfContentsRail.tsx`
- `FrontEnd/tests/features/CourseContentEditor/DocumentCanvas.test.ts`

**Frontend -- modified:**
- `FrontEnd/src/features/CourseContentEditor/useContentDocument.ts`
- `FrontEnd/src/features/CourseContentEditor/DocumentCanvas.tsx`
- `FrontEnd/src/features/CourseContentEditor/CourseContentEditor.tsx`
- `FrontEnd/src/services/courseContentService.ts`
- `FrontEnd/src/index.css`
- `FrontEnd/package.json` (+ `package-lock.json`) -- added `@tiptap/extension-heading@3.30.1` (exact-pinned)
- `FrontEnd/tests/features/CourseContentEditor/useContentDocument.test.ts`
- `FrontEnd/tests/features/CourseContentEditor/CourseContentEditor.test.tsx`

## Change Log

| Date | Change |
| --- | --- |
| 2026-08-17 | Story implemented: Topic/Subtopic entities + cascade-aware delete/reorder backend (Task 1); slash-menu Structure commands + Description-zone schema enforcement (Task 2); h2/h3 heading levels with eyebrow-tag styling (Task 3); delete confirm dialog with kind-broken-out counts (Task 4); move-up/move-down + native HTML5 drag-and-drop reorder controls (Task 5); `courseContentService.ts` additions (Task 6); Table-of-Contents rail with real-focus activation (Task 7); "Add chapter" affordance (Task 8). Status set to `review`. |
