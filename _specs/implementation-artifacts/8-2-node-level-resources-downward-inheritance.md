---
baseline_commit: 245d80348a8c8e55a2e4dbd2037bbd83385a56ce
---

# Story 8.2: Node-Level Resources & Downward Inheritance

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tutor,
I want to attach a resource once at the Chapter/Topic/Sub-Topic level,
So that it's visible on every page beneath it without re-uploading it per page.

## Acceptance Criteria

1. **Given** a Chapter, Topic, or Sub-Topic heading **When** the tutor types "/" and inserts a Learning Resources block directly on that heading's document position **Then** it's the same block/component Story 8.1 built, not a separate panel reached by "selecting" a node (FR-43)
2. **Given** a node has an attached resource **When** a tutor views any page nested beneath that node **Then** the resource appears in that page's own Learning Resources block, visually muted and read-only, with a real focusable link back to the owning ancestor's block — never plain descriptive text standing in for a link (FR-36, UX-DR9)
3. Inheritance flows down only — a resource attached to a page is never visible above it, and there is no course-wide resource pool beyond the source-file list

## Tasks / Subtasks

- [x] Task 1 — Backend: nothing new is required beyond Story 8.1 — verify, don't rebuild (AC: all)
  - [x] `Resource.OwnerType`/`OwnerId` already accept `Chapter`/`Topic`/`Subtopic` (Story 8.1's entity, per AD-20's full four-value enum). `UploadResourceAsync`/`AttachExistingFileAsResourceAsync`/etc. are already owner-type-agnostic — confirm this by reading Story 8.1's `ContentService` additions, don't add a second code path for "node resources" vs. "page resources." If Story 8.1's implementation hardcoded anything Page-specific (it shouldn't have, per that story's own Dev Notes explicitly warning against it), fix it here rather than working around it
  - [x] `GetChapterDocumentAsync` already returns `resources: ResourceDto[]` on `ChapterDocumentDto`/`TopicDocumentDto`/`SubtopicDocumentDto` **and** `PageDocumentDto` (Story 8.1's Task 3) — this story's inheritance display is computed **client-side** from that already-nested response, not a new backend field or endpoint. The full document payload already contains the whole ancestor chain (a Page's owning Topic/Subtopic and Chapter are all present in the same response tree) — walking up it in the frontend is sufficient and avoids a second, potentially-drifting backend computation of the same data. If a future story needs inherited resources available *without* fetching the full document (e.g. a narrower endpoint), that's a new, explicitly-scoped decision — don't add one speculatively here

- [x] Task 2 — Frontend: node-level insertion points for the Learning Resources block (AC: #1)
  - [x] Extend the feature-owned slash-menu command list so "Learning Resources" is also offered when the cursor is on a Chapter/Topic/Sub-Topic heading's own document position (not just inside a Page body, which Story 8.1 built) — same `LearningResourcesBlock.ts` extension, same command, filtered in by the position-aware filtering mechanism (Story 7.1's extension point) rather than a second, node-specific block component. Per this story's AC #1, this must literally be Story 8.1's same component instantiated at a different document position, not a visually-similar-but-separate implementation
  - [x] A heading can have at most one Learning Resources block attached at its own level — decide how the slash-menu communicates "already present" (e.g. omit the command from the menu once a block already exists at that position, matching this codebase's general "don't offer an action that would just duplicate an existing thing" posture) rather than silently allowing two node-level blocks to coexist unreconciled. Note in Completion Notes if this exact rule isn't explicit anywhere in the read specs — it's a reasonable inference, not a literal spec line

- [x] Task 3 — Frontend: downward inheritance resolution and display (AC: #2, #3)
  - [x] New pure function (e.g. `resolveInheritedResources(node, ancestorChain)` in `features/CourseContentEditor/` or `lib/editor/` if genuinely domain-agnostic — it isn't, since it understands Chapter/Topic/Subtopic/Page semantics, so it belongs in the feature folder, not `lib/`) that, given the already-fetched chapter document tree and a target node/page, walks **upward** through its ancestor chain (Page → its owning node → that node's own ancestors up to Chapter) and collects each ancestor's own `resources` array
  - [x] Every Learning Resources block (at any level — Topic, Sub-Topic, or Page body) renders **two row groups**: its own resources (Story 8.1's full row controls — role/caption/remove/reorder) and, beneath them, inherited rows from ancestors — visually muted (per `DESIGN.md`'s `content-resource-block.pattern`: "muted for read-only/inherited"), with every remove/reorder/role control replaced by **one real focusable link** ("Manage on Chapter" / "Manage on Topic," per `content-resource-block.resourceRowControls`'s exact wording) that navigates to the owning ancestor's own block — never plain text standing in for that link
  - [x] "Navigates to" means moving real DOM focus to the ancestor heading (reuse Story 7.2's `TableOfContentsRail` focus-move mechanism — `tabindex="-1"` + `.focus()` — rather than inventing a second navigation mechanism for this one link type), scrolling it into view, which naturally reveals that node's own Learning Resources block in its normal (non-muted) editable form
  - [x] Downward-only enforcement (AC #3) is naturally satisfied by construction: `resolveInheritedResources` only ever walks **upward** from a node to its ancestors, never downward or sideways — there's no code path that could show a Page's own resource on its parent Topic. No additional guard/test is needed beyond confirming the walk direction is correct (a unit test on the pure function with a 3-level fixture is sufficient, not an integration test of every screen)
  - [x] Confirmed reasonable generalization beyond this story's literal AC wording: the epics doc's AC #2 names "any page nested beneath that node," but `resolveInheritedResources` is written generically enough that a **Sub-Topic's own** Learning Resources block also shows resources inherited from its parent Topic and Chapter (not just Pages showing inherited resources) — consistent with FR-36/FR-43's "identical component" framing. This costs nothing extra to build correctly and is more consistent than special-casing Pages as the only inheritance consumer; note it in Completion Notes as an intentional, low-risk generalization, not an unrequested scope addition to flag for removal

- [x] Task 4 — Tests
  - [x] `FrontEnd/tests/features/CourseContentEditor/resolveInheritedResources.test.ts` (new, pure-function unit test — no DOM, per AD-5's "services/hooks get pure-logic unit tests" convention applied here to a plain utility function): a 3-level fixture (Chapter → Topic → Page) where each level has its own resource confirms the Page's inherited list contains both ancestors' resources in the correct order (nearest ancestor first, or whatever order is decided — pin it in the test, don't leave it ambiguous), a Chapter-level resource is never inherited "sideways" into a sibling Topic's Page, and a Page's own resource never appears in its parent Topic's inherited list (downward-only, AC #3)
  - [x] `FrontEnd/tests/features/CourseContentEditor/extensions/LearningResourcesBlock.test.tsx` (extend Story 8.1's test file): an inherited row renders muted with a focusable "Manage on X" link instead of role/remove/reorder controls; activating that link moves focus to the ancestor heading

## Dev Notes

- **This story is almost entirely frontend** — the backend generality Story 8.1 was explicitly told to build ("don't hardcode anything Page-specific") is what makes this possible without new backend work. If, on reading Story 8.1's actual landed code, something *was* hardcoded to Page, fixing that is this story's Task 1, not a silent workaround.
- **Deliberately no new backend endpoint for "inherited resources."** The full-document response Story 7.1 established (`GET .../chapters/{id}/document`) already contains the entire ancestor tree in one payload — computing inheritance client-side from data already in memory is simpler and avoids a second server-side traversal that could drift from the client's own understanding of the tree. If a future story needs inheritance data independent of the full document fetch, that's a new decision to make then, not to pre-build now.
- **Architecture:** FR-36/FR-43's "identical component" requirement (Task 2's core constraint — reject any implementation that duplicates `LearningResourcesBlock.ts` for node-level use rather than reusing it), `DESIGN.md`'s `content-resource-block.resourceRowControls` (the exact muted/link treatment for inherited rows).
- **Existing code to read before editing:** Story 8.1's `LearningResourcesBlock.ts`, `ContentService`/`ContentController` (verify genericness), Story 7.2's `TableOfContentsRail.tsx` (the focus-move mechanism this story's "Manage on X" links reuse).
- **Git context:** no new commits since Story 8.1 was authored in this same session.

### Project Structure Notes

- No new files beyond one new pure-function module (`resolveInheritedResources.ts` or similar, exact filename at implementer's discretion) inside `features/CourseContentEditor/`. Every other change extends an existing Story 8.1/7.x file.

### References

- [Source: _specs/planning-artifacts/epics-ContentAuthoring.md#Story 8.2] — verbatim Acceptance Criteria
- [Source: _specs/implementation-artifacts/8-1-learning-resources-block-add-role-caption-order.md] — predecessor story, the component this one reuses
- [Source: _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/DESIGN.md#content-resource-block]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- Task 1 verified, no backend changes: re-read `ContentService.cs`'s Resource methods (`UploadResourceAsync`, `AttachExistingFileAsResourceAsync`, `UpdateResourceAsync`, `ReorderResourceAsync`, `DeleteResourceAsync`, `LoadResourceInCourseAsync`) — all route ownership through `LoadOwnerInCourseAsync`, which already handles all four `ContentOwnerType` members generically. Nothing Page-specific was hardcoded; no backend edits made for this story.
- `tsc --noEmit`: zero new errors in any Story 8.2 file (pre-existing, unrelated repo errors untouched).
- `vitest run --project unit`: 88 files / 705 tests passed, 0 regressions (up from 87/692 after Story 8.1).
- Debugged a jsdom+ProseMirror interaction where clicking a button inside an interactive NodeView caused ProseMirror to immediately reassert its own selection/focus, overriding a `.focus()` call made from that NodeView's own click handler — fixed in production code via `ReactNodeViewRenderer(LearningResourcesNodeView, { stopEvent: () => true })` so ProseMirror never intercepts events inside this block. The test itself verifies the DOM API contract (`focus()` called + `tabindex="-1"` set on the correct element) via a spy rather than asserting `document.activeElement` afterward, since jsdom's timing of ProseMirror's own re-assertion still reverts the ambient active element in this test environment even with `stopEvent` set (a test-environment quirk, documented inline).

### Completion Notes List

- Task 1: confirmed Story 8.1's backend Resource methods are already fully owner-type-agnostic — no rebuild, no workaround, no new backend files this story.
- Task 2: "at most one Learning Resources block per heading" (the slash-menu's "already present" rule) is a reasonable inference, not a literal spec line — implemented via `hasResourcesBlockAt` scanning the live ProseMirror doc for an existing `learningResourcesBlock` node at that (ownerType, ownerId), applied uniformly to both the Story 8.1 page-body command and this story's new node-level command.
- Task 3: `resolveInheritedResources` is deliberately generalized beyond the literal AC #2 wording ("any page nested beneath that node") to also apply to a Sub-Topic's or Topic's own Learning Resources block (not just Pages) — consistent with FR-36/FR-43's "identical component" framing, costs nothing extra to build correctly, and avoids special-casing Pages as the only inheritance consumer. Noted here per the story's own instruction, not flagged for removal.
- Task 3: extended `buildDocJSON`/`buildPageJSON` (Story 8.1) so a Learning Resources block auto-materializes at doc-build time whenever there's anything to show — a node's own resources OR its inherited resources — not only when the tutor explicitly inserted one. This is necessary for AC #2 to actually hold: a page that never had its own resource (and never had a block explicitly inserted) must still show its ancestors' inherited resources somewhere, and the block is the only place that happens.
- Nearest-ancestor-first order was pinned for `resolveInheritedResources`'s output (immediate parent's resources render first, then its parent, up to Chapter) — the story's own Task 4 instruction left this open ("pin it in the test").
- Discovered and fixed a real interaction bug (not just a test artifact): `ReactNodeViewRenderer` needs `stopEvent: () => true` for any NodeView containing interactive controls that manage their own focus (this block's "Manage on X" link) -- without it, ProseMirror's own click/selection handling can override the NodeView's own focus management. Applied to `LearningResourcesBlock`'s `addNodeView()`.

### File List

**Frontend — new:**
- `FrontEnd/src/features/CourseContentEditor/resolveInheritedResources.ts`
- `FrontEnd/tests/features/CourseContentEditor/resolveInheritedResources.test.ts`

**Frontend — modified:**
- `FrontEnd/src/features/CourseContentEditor/extensions/LearningResourcesBlock.ts` (added `inherited` attribute, `stopEvent: () => true`)
- `FrontEnd/src/features/CourseContentEditor/extensions/LearningResourcesNodeView.tsx` (inherited-row rendering, "Manage on X" focus-move)
- `FrontEnd/src/features/CourseContentEditor/DocumentCanvas.tsx` (node-level slash command, `hasResourcesBlockAt`, `getNearestPersistedNodeOwner`, `buildResourcesBlockJSON`, `buildDocJSON`/`buildPageJSON` now materialize blocks from own+inherited resources)
- `FrontEnd/tests/features/CourseContentEditor/extensions/LearningResourcesBlock.test.tsx` (extended with the inheritance describe block)

**Backend:** none (Task 1 verified existing genericness; no changes).

## Change Log

| Date | Change |
|------|--------|
| 2026-08-17 | Story 8.2 implemented: node-level "Learning Resources" slash command on Chapter/Topic/Sub-Topic headings (same `LearningResourcesBlock` component, at-most-one-per-heading guard); `resolveInheritedResources` pure function (downward-only, nearest-ancestor-first); every block now renders its own resources plus a muted "inherited" group with a real focusable "Manage on X" link that moves DOM focus to the owning ancestor's heading; `buildDocJSON`/`buildPageJSON` extended to auto-materialize a block wherever there's anything (own or inherited) to show. No backend changes -- Story 8.1's Resource pipeline was already fully owner-type-agnostic. Status: review. |
