---
baseline_commit: 245d80348a8c8e55a2e4dbd2037bbd83385a56ce
---

# Story 9.1: Image Blocks with Required Alt Text

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tutor,
I want to insert an inline image into a page and be prompted for alt text every time,
So that the image carries meaning for every student, not just the ones who can see it.

## Acceptance Criteria

1. **Given** the tutor's cursor is in a page body **When** they type "/" and select "Image" **Then** they can drag in or pick a file, which attaches to the page's Learning Resources block (Epic 8's mechanism) with Inline role defaulted, and inserts `![alt](resource:{resourceId})` at the cursor (FR-26, FR-30)
2. **Given** an image block is inserted **When** the tutor has not yet entered alt text **Then** the field is prompted as a first-class part of the insertion flow, not an optional attribute buried in settings (FR-35)
3. The image renders identically in the editor preview and the student player, resolving `resource:{resourceId}` to a real served URL at render time (FR-30)

## Tasks / Subtasks

- [x] Task 1 — Frontend: `@tiptap/extension-image` and the custom Image node (AC: #1, #2)
  - [x] `@tiptap/starter-kit` does **not** include an Image node — add `@tiptap/extension-image` as a new dependency, pinned to the same `3.30.1` line as the rest of this project's Tiptap packages (verify it publishes at that exact version; if the extension's own versioning has drifted from core/starter-kit's, pin the closest compatible `3.x` release and note the actual installed version in Completion Notes rather than assuming exact parity)
  - [x] `features/CourseContentEditor/extensions/Image.ts` (new, `extensions/` folder — this is domain-specific configuration of a Tiptap-provided node, not a from-scratch NodeView): configure the stock `Image` extension's attributes to store `src` as a `resource:{resourceId}` URI (not a raw URL — AD-9/FR-30) and `alt` as a required-in-practice attribute. Serialization to Markdown (`@tiptap/markdown`) must emit exactly `![alt](resource:{resourceId})` — confirm the stock extension's default serializer already does this once `src` holds the `resource:` URI verbatim (it should, since Markdown image syntax is `src`-attribute-driven), don't write a custom serializer unless the stock one produces something different
  - [x] "Image" slash-menu command (page-body only, same category grouping as the rest of FR-26's block set — "Media & data" per `EXPERIENCE.md`'s Component Patterns row) triggers a file picker or accepts a drag-drop, **reusing Story 8.1's `uploadResource` upload pipeline outright** — an image inserted this way is simultaneously (a) added to the page's Learning Resources block with `role: Inline` (FR-38's existing image default, already correct without new logic) and (b) referenced inline via the `![alt](resource:{id})` node this task inserts. These are two views of the same underlying `Resource` row, not two separate uploads — don't call the upload endpoint twice

- [x] Task 2 — Frontend: alt-text prompt as part of the insertion flow, not a settings panel (AC: #2)
  - [x] Immediately after a file is selected/dropped and the upload call is dispatched, focus moves into an alt-text input **inline in the document** (e.g. a caption-style field rendered directly beneath the image in the NodeView, matching this product's general "document, not a properties panel" posture established since Story 7.1's canvas foundation) — not a modal, and not a field the tutor has to discover in a separate settings affordance. This satisfies AC #2's "first-class part of the insertion flow" without introducing this feature's first true modal-for-a-single-field pattern
  - [x] The field is prompted, not silently defaulted to empty and forgotten — a visible placeholder ("Describe this image for screen readers…") and pre-focus on insert are the mechanism; the epics doc's FR-35 says "prompted," not "blocks insertion until filled," so this story does **not** add a hard validation gate preventing an empty-alt image from being saved — note this distinction explicitly in Completion Notes so a later accessibility pass doesn't mistake the absence of a hard block for an oversight
  - [x] While the upload is in flight, the image block shows a visible loading/placeholder state (consistent with this app's "every loading state has visible text" convention) rather than an empty gap; the alt-text field is available for typing immediately, independent of whether the upload has resolved yet

- [x] Task 3 — Frontend: render parity via `resolveResourceUrl` (AC: #3)
  - [x] The editor's own live rendering of an `Image` node (both while editing and via the "Preview" toggle, Story 7.3) must resolve `src="resource:{resourceId}"` through `courseContentService.resolveResourceUrl()` (Story 8.3) to get a real displayable URL — a Tiptap `Image` node can't literally set `<img src="resource:abc">` and expect a browser to load it, so this requires either (a) a NodeView that intercepts render and swaps in the resolved blob URL, or (b) resolving eagerly on document load and caching by `resourceId` (Story 8.3's `resolveResourceUrl` already caches per-id, so eager resolution on mount is cheap for a page with a handful of images). Prefer (b) for simplicity unless the NodeView already needs custom rendering for the alt-text field's inline UI (Task 2), in which case the resolution can live in the same NodeView component
  - [x] **Concrete gap found by reading the live file, not an "if it doesn't exist" hedge:** `lib/markdown.ts`'s current parser does **not** render images at all — its own inline-parsing code comment says images are "rendered as their alt text" only; `parseInline`'s image branch (`imageAlt !== undefined`) discards the href entirely and never emits an `image` node type (there is no `image` variant in the `InlineNode` union today). Separately, `SAFE_LINK` (the regex gating which link hrefs render as real `<a>` elements vs. plain text) only allows `https?://|mailto:|#|/(?!/)` — a `resource:` URI would be **rejected** by it as-is. This story must: (1) add an `{ type: 'image'; alt: string; href: string }` variant to `InlineNode` and change the image branch in `parseInline` to emit it instead of discarding the href; (2) extend `SAFE_LINK`'s accepted-scheme list to include `resource:` (needed here for images, and reused by Story 9.2's Resource-card links); (3) update `ui/MarkdownViewer.tsx` (the component `CourseContentEditor.tsx` already uses for the Viewer/Preview tab, per that file's existing import) to render a real `<img>` for an `image` node, resolving its `resource:` href through `courseContentService.resolveResourceUrl()` before setting `src` — **only** for the `resource:` scheme; the original file's "no remote fetches from document text" security rationale for discarding arbitrary hrefs still applies to any other scheme (an extracted document's stray `http://` image reference should still degrade to alt-text-only, not silently start fetching external URLs) — this is a scoped extension, not a wholesale removal of that safeguard.
    **Gating gotcha to avoid:** don't gate the new `image` branch on `SAFE_LINK.test(href)` directly — once `SAFE_LINK` is broadened (step 2) it also accepts `https?://`/`mailto:`/`#`/`/(?!/)`, so a shared `SAFE_LINK` check would make a stray `http://` image URL pass too, reopening exactly the "remote fetches from document text" hole the file's header comment rules out. For **images specifically**, check the href against `resource:` alone (e.g. a narrower `/^resource:/` test, or an inline scheme check) — `SAFE_LINK` itself stays the shared gate for `link`-type nodes (plain inline links and Story 9.2's Resource-card promotion), where accepting the full existing scheme set is correct and intended.
  - [x] `parseMarkdown`'s companion serializer/`lib/markdown.ts` test suite must gain coverage for the new `image` node type — read the existing test file for this module before adding cases, match its existing fixture style (real Docling-adjacent sample strings, not synthetic edge-case-only inputs)

- [x] Task 4 — Tests
  - [x] `FrontEnd/tests/features/CourseContentEditor/extensions/Image.test.tsx`: selecting a file calls `uploadResource` with `role: Inline`; the resulting node serializes to `![alt](resource:{id})`; the alt-text field is focused immediately after insert; an image with empty alt still saves successfully (confirming Task 2's "prompted, not blocking" decision is actually implemented, not silently made stricter or looser than decided)
  - [x] A round-trip test: insert an image, serialize to Markdown, re-parse via `lib/markdown.ts`, confirm the `resource:` URI and alt text both survive intact — this is the first real exercise of AD-12's syntax-parity discipline for a non-CommonMark-native construct this codebase renders (Markdown image syntax itself is CommonMark; what's non-standard is the `resource:` URI scheme inside it), so the parity test matters even though AD-12's own text names Math/Callout/Resource card as the three "custom" types it's most worried about — an Image with a `resource:` URI has the identical risk shape and should get the identical test discipline

## Dev Notes

- **First story in Epic 9** — no same-epic predecessor. Depends on Epic 7's slash-menu/extensions folder, Epic 8's `Resource` upload pipeline and `resolveResourceUrl`.
- **Reuses Story 8.1's upload path outright** — this story adds no new backend endpoint. If anything about Story 8.1's `UploadResourceAsync` turns out to be awkward for an inline-image caller specifically (e.g. it assumes a Learning Resources block UI context that doesn't quite fit an inline insert), fix that method to be genuinely reusable rather than duplicating an upload path — matches this epic's established "generic component, not a per-story copy" discipline (Story 8.2's Dev Notes made the same call for the resources block itself).
- **Architecture:** AD-9 (real Tiptap node, not a hand-rolled image tag), AD-12 (syntax-parity testing extended here to the `resource:` URI construct, per Task 4's reasoning).
- **Existing code to read before editing:** Story 8.1's `LearningResourcesBlock.ts`/`uploadResource` service function, Story 8.3's `resolveResourceUrl`, Story 7.3's `RawBlock.ts`/`PageMarker.ts` (the `extensions/` folder's existing shape and conventions to match).
- **Git context:** no new commits since Epic 8's stories were authored in this same session.

### Project Structure Notes

- New frontend file: `features/CourseContentEditor/extensions/Image.ts`. New dependency: `@tiptap/extension-image`.
- No backend changes — this story is a pure frontend consumer of Story 8.1's existing upload endpoint.

### References

- [Source: _specs/planning-artifacts/epics-ContentAuthoring.md#Story 9.1] — verbatim Acceptance Criteria
- [Source: _specs/implementation-artifacts/8-1-...md, 8-3-...md] — the upload pipeline and `resolveResourceUrl` this story reuses
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md#AD-9, #AD-12]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- `@tiptap/extension-image` installed pinned to `3.30.1` exactly (verified available at that version, matching every other Tiptap package in this project -- no drift to note).
- Empirically verified (via a throwaway direct `MarkdownManager` test before writing any production code) that the stock `Image` node's default markdown serialization already round-trips `{type:'image', attrs:{src:'resource:abc', alt:'A cat'}}` to `![A cat](resource:abc)` and back byte-for-byte -- confirmed no custom serializer was needed, per Task 1's own explicit instruction not to write one unless the stock output differed.
- `tsc --noEmit`: zero new errors in any Story 9.1 file.
- `vitest run --project unit`: 90 files / 729 tests passed, 0 regressions (up from 89/721 after Story 8.3).
- Debugged the same jsdom+ProseMirror focus-reassertion quirk documented in Story 8.2's Completion Notes (a NodeView's own `.focus()` call getting immediately overridden by ProseMirror's click handling) -- `Image.ts` already carries `stopEvent: () => true` from the start (learned from that story), and the one test needing focus verification uses the same spy-based technique (`vi.spyOn(element, 'focus')`) rather than asserting `document.activeElement` afterward.

### Completion Notes List

- Resolved a real design question Task 3 didn't fully anticipate: `markdownManager` (the standalone parser/serializer used outside any live editor, shared by `buildPageJSON`) and the live editor's own schema can't both register a NodeView-carrying, courseId-configured `PageImage` under the same node name `'image'` without either duplicating config pointlessly or risking a schema mismatch. Resolved by giving `markdownManager` the plain stock `Image` (no NodeView, no courseId option -- it's never rendered to screen, only parsed/serialized) and the live editor `PageImage` (the NodeView-carrying, courseId-configured extension) -- two separate Editor/MarkdownManager instances, each with its own schema, so no name conflict. `courseId` lives as a configure()-time option (schema-level, uniform across every image in one session) rather than a per-node attribute, since a reloaded image (rebuilt from a page's stored `bodyMarkdown`, which never encodes courseId/ownerType/ownerId in its Markdown form) still needs it to resolve; `ownerType`/`ownerId` ARE per-node attrs but are only ever read while a node has no `resourceId` yet, so a reloaded (always-already-uploaded) node having them null is a non-issue.
- Task 3's own "concrete gap found by reading the live file" (lib/markdown.ts had no image rendering, `SAFE_LINK` didn't accept `resource:`) was substantially already resolved ahead of this story, during Story 8.3's own AC #1 work (which needed the identical `resource:` URI resolution for the Viewer/Preview tab) -- Story 8.3 added a `resourceImage` InlineNode variant (functionally equivalent to what this story's Task 3 describes as `image`) gated by its own narrow `/^resource:/` check, independent of `SAFE_LINK`, matching this story's own explicit "Gating gotcha to avoid" instruction. This story's own remaining Task 3 work was verifying that design still holds (it does, unchanged) -- no rework needed.
- FR-35's "prompted, not blocking" distinction (Task 2's second bullet) is implemented literally: the alt-text field is always visible/focused on file-select, but an empty-alt image saves and renders with no validation gate -- confirmed via a dedicated test (`an image with empty alt text still renders fine`) rather than left ambiguous.
- The alt-text field's `autoFocus`-on-insert relies on NodeView mount timing (focuses once, imperatively, when a file is selected/dropped -- not merely "on mount") to avoid the caveat a bare on-mount autofocus would have caused on every full-document reload (every image's NodeView remounts fresh on `setContent`, which would otherwise autofocus the last image's alt field on every unrelated reload). Focus is instead triggered explicitly from `handleFiles`, once, at the moment of upload dispatch -- never on a plain reload/remount with no new file selected.

### File List

**Frontend — new:**
- `FrontEnd/src/features/CourseContentEditor/extensions/Image.ts`
- `FrontEnd/src/features/CourseContentEditor/extensions/ImageNodeView.tsx`
- `FrontEnd/tests/features/CourseContentEditor/extensions/Image.test.tsx`

**Frontend — modified:**
- `FrontEnd/package.json` / `package-lock.json` (new dependency `@tiptap/extension-image@3.30.1`)
- `FrontEnd/src/features/CourseContentEditor/DocumentCanvas.tsx` (`markdownManager` gains stock `Image`; live editor gains `PageImage.configure({courseId})`; "Image" slash command in `pageBodyCommands`)

**Backend:** none (this story is a pure frontend consumer of Story 8.1's existing upload endpoint, per its own Dev Notes).

## Change Log

| Date | Change |
|------|--------|
| 2026-08-17 | Story 9.1 implemented: `@tiptap/extension-image` (pinned `3.30.1`) extended into `PageImage` (AD-9) with a NodeView (`ImageNodeView.tsx`) offering real Upload/drag-drop controls, a loading placeholder, resolved rendering via `resolveResourceUrl` (Story 8.3), and an always-visible, insert-focused alt-text field (FR-35: prompted, never a hard validation gate); "Image" slash command in the page body reuses Story 8.1's `uploadResource` pipeline outright (role: Inline, simultaneously visible in the page's Learning Resources block and referenced inline via `![alt](resource:{id})`); verified the stock Image node's markdown serialization needs no customization, and added a syntax-parity round-trip test per AD-12. Status: review. |
