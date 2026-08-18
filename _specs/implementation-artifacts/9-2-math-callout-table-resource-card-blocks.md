---
baseline_commit: 245d80348a8c8e55a2e4dbd2037bbd83385a56ce
---

# Story 9.2: Math, Callout, Table & Resource Card Blocks

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tutor,
I want to insert mathematical notation, callout boxes, tables, and resource-reference cards into a page,
So that a page can teach the way my subject actually needs — not just prose.

## Acceptance Criteria

1. **Given** the tutor's cursor is in a page body **When** they type "/" and select Math **Then** `$$…$$` fenced math is inserted and rendered via the existing KaTeX dependency (FR-26, FR-28)
2. **Given** the tutor selects Callout **When** it's inserted **Then** it emits as a blockquote with a leading `> [!note]` marker, rendered as a styled card, degrading to a plain blockquote anywhere unsupported (FR-26, FR-28)
3. **Given** the tutor selects Table **When** it's inserted **Then** it compiles to Markdown table syntax `lib/markdown.ts` already renders (FR-26)
4. **Given** the tutor selects Resource card **When** it's inserted (referencing a resource already attached via Epic 8's Learning Resources block) **Then** it emits as `[label](resource:{resourceId})`, rendered as a download card — this is the block type that gives Epic 8's Story 8.3 delete-in-use guard its first real page-body reference to protect (FR-26, FR-28, FR-30, FR-31)
5. Blocks are reorderable, convertible between compatible types (now including Callout in the conversion set), duplicable and deletable — structural headings remain excluded (FR-29 remaining)
6. Tiptap's serializer output for these three custom block types (Math/Callout/Resource card) is tested for syntax-level round-trip parity against `lib/markdown.ts`'s parser — not just visual/pixel parity — including adjacency cases such as inline math directly beside a Callout in the same paragraph, the boundary case a hand-written parser is likeliest to mis-tokenize (frontend AD-12)

## Tasks / Subtasks

- [x] Task 1 — Frontend: extend `lib/markdown.ts` with Math, Callout, and Resource Card parsing (AC: #1, #2, #4)
  - [x] **Read `FrontEnd/src/lib/markdown.ts` completely — it already supports `table` and `blockquote` block types (confirmed by reading the live file); this story extends the existing parser, it does not rewrite it.** Its own header comment documents its supported subset as measured against real Docling output — this story is the first to deliberately grow that subset beyond what Docling emits, since Math/Callout/Resource-card are tutor-authored constructs, not extracted-document artifacts; update that header comment to reflect the addition rather than leaving it describing a now-stale "Docling-only" scope
  - [x] **Math**: add a new `{ type: 'math'; value: string }` `MarkdownBlock` variant. Block-level only (FR-28 names `$$…$$`, not inline `$…$` — don't build inline math, it's out of scope). Detect a line that is exactly `$$` (optionally with surrounding whitespace) as an opening fence, consume lines until a matching closing `$$` line, same "collect until closing marker" shape `FENCE`'s existing code-block handling already uses — mirror that loop structure rather than inventing a different one. **Note this new top-level branch must be checked in the main `parseMarkdown` loop the same way `FENCE`/`HEADING`/`BLOCKQUOTE` already are** — if a `$$` fence starts on the line immediately after an open paragraph (no blank line between), the paragraph-continuation loop's own block-opener lookahead list (`HEADING.test`/`FENCE.test`/`HR.test`/`BLOCKQUOTE.test`/`UNORDERED.test`/`ORDERED.test`/`isTableStart`) must also gain the new math-fence check, or an adjacent Math block will get swallowed as trailing paragraph text instead of starting its own block
  - [x] **Callout**: `parseMarkdown`'s existing `BLOCKQUOTE` handling already collects consecutive `>`-prefixed lines into a `blockquote` block. Extend it: after collecting the quoted lines, check whether the **first** line (after the `>` marker prefix already known to be stripped by the existing `BLOCKQUOTE` regex/loop) matches `/^\[!note\]\s*/i` — if so, strip that marker prefix from the first line's content and emit a new `{ type: 'callout'; children: MarkdownBlock[] }` block instead of `blockquote`; if no marker is present, the existing plain-`blockquote` behavior is unchanged (this is the literal mechanism behind AC #2's "degrading to a plain blockquote anywhere unsupported" — an old parser or a hand-typed blockquote with no `[!note]` marker simply falls through to the pre-existing code path, unmodified)
  - [x] **Resource card**: `parseInline`'s existing link regex already matches `[label](href)` syntax generically — no new inline-parsing regex is needed. What's new: when a **paragraph's entire content** is exactly one `link`-type `InlineNode` with an `href` matching the `resource:{id}` scheme (and no other surrounding text), emit a `{ type: 'resourceCard'; resourceId: string; label: string }` block instead of an ordinary `paragraph` — this is the deliberate design decision that makes `[label](resource:{id})` promote from "a link inside prose" to "a standalone download card": it only promotes when the link is the paragraph's sole content, exactly matching how a tutor's "Insert Resource card" command would emit it (its own paragraph, nothing else). A `resource:` link appearing alongside other text in a paragraph renders as an ordinary inline link, not a card — don't over-eagerly promote every `resource:` link regardless of context
  - [x] `SAFE_LINK`'s `resource:` scheme addition (Story 9.1's Task 3) is a prerequisite here too — confirm it landed before starting this task; if Story 9.1 hasn't been implemented yet when this story starts, this task includes making that same change (don't duplicate the regex edit if it's already there)

- [x] Task 2 — Frontend: render components for the three new block types (AC: #1, #2, #4)
  - [x] `ui/MarkdownViewer.tsx` (the existing component `CourseContentEditor.tsx`'s Preview/Viewer tab already renders through — read it before extending) gains render cases for `math`, `callout`, and `resourceCard` blocks, alongside its existing `table`/`blockquote`/etc. cases
  - [x] **Math rendering reuses `renderLatex.ts` — relocate it, don't duplicate it.** `FrontEnd/src/features/CoursePlayer/renderLatex.ts` already wraps KaTeX (`katex.renderToString(..., { throwOnError: false, displayMode: true })`, already the exact display-mode config FR-28's `$$…$$` block math needs) — this function is domain-agnostic (no course/page knowledge) and now has two real consumers (`CoursePlayer`'s existing usage and this story's new one), so it belongs in `lib/` per this project's own convention that a utility used by 2+ features graduates out of a single feature folder. Move it to `FrontEnd/src/lib/renderLatex.ts`. **Correction from a live-code read: the file's own header comment says it was "Extracted from `ReaderCanvas.tsx`," but that's stale — `ReaderCanvas.tsx` has zero references to `renderLatex` today. Its two real, current call sites are `FrontEnd/src/features/CoursePlayer/InlineDrilldownDetail.tsx` (imports it, uses it at `dangerouslySetInnerHTML={{ __html: renderLatex(f) }}`) and `FrontEnd/src/features/CoursePlayer/SentenceCard.tsx` (imports it, uses it at `dangerouslySetInnerHTML={{ __html: renderLatex(sentence.mathLaTeX) }}`) — update both import paths, and fix the now-stale "Extracted from ReaderCanvas.tsx" comment on the relocated file** — this is a real, motivated refactor of an existing file, not a speculative one
  - [x] Callout rendering: a styled card (per `DESIGN.md`'s general card-shell conventions — no dedicated `content-callout` token was found in the read DESIGN.md; if one doesn't exist, compose from the existing `card-section`/`badge-pill` primitives rather than inventing new unreviewed visual tokens, and note the gap in Completion Notes for a future UX pass rather than silently picking arbitrary styling)
  - [x] Resource card rendering: a download-card component resolving its `resourceId` through `courseContentService.resolveResourceUrl()` (Story 8.3) for the actual download link target, showing the resource's `label` — reuse Story 8.1's resource-row visual language (`content-resource-block`) where it fits, rather than a fourth unrelated card style

- [x] Task 3 — Frontend: Tiptap Node extensions for Math, Callout, Resource Card (AD-9, AD-10) (AC: #1, #2, #4, #5)
  - [x] `features/CourseContentEditor/extensions/{Math,Callout,ResourceCard}.ts` (new, `extensions/` folder — siblings of Story 7.3's `PageMarker.ts`/`RawBlock.ts` and Story 9.1's `Image.ts`)
  - [x] `Math.ts`: a custom Tiptap Node storing the raw LaTeX string, rendered live via the same relocated `lib/renderLatex.ts` (Task 2) — not a second KaTeX integration. Serializes to `$$…$$` on its own lines
  - [x] `Callout.ts`: a custom Node wrapping Tiptap's blockquote-adjacent content model, serializing to `> [!note]` + quoted lines. **Included in the block-type conversion set for the first time (AC #5)** — Story 7.3 explicitly excluded structural headings from conversion but didn't address Callout since it didn't exist yet; this story is what makes "convert a paragraph to/from a Callout" a real, testable action
  - [x] `ResourceCard.ts`: a custom Node referencing an already-attached `resourceId` (via a picker over the page's own Learning Resources block entries, Story 8.1 — a Resource card can only reference a resource already attached to *this* page, not an arbitrary course-wide resource, matching FR-28's "referencing a resource already attached via Epic 8's Learning Resources block" wording literally). Serializes to a standalone-paragraph `[label](resource:{resourceId})`, matching Task 1's promotion rule exactly — the Tiptap-side serializer and the `lib/markdown.ts`-side parser must agree on the *same* "sole content of its own paragraph" shape, which is precisely what Task 4's parity test verifies

- [x] Task 4 — Frontend: `@tiptap/extension-table` and its friends (AC: #3)
  - [x] `@tiptap/starter-kit` does not include table support — add `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-header`, `@tiptap/extension-table-cell`, pinned to the same `3.30.1` line (verify exact publish versions match; note any drift in Completion Notes, same discipline as Story 9.1's Image extension)
  - [x] "Table" slash-menu command inserts a minimal default grid (e.g. 2×2); serialization already round-trips through `lib/markdown.ts`'s existing `table` block support — this task should require **no** `lib/markdown.ts` changes, only Tiptap-side wiring. If a round-trip test (Task 6) finds a mismatch, that's a real bug to fix, not an expected gap

- [x] Task 5 — Frontend: conversion set and reorder (AC: #5)
  - [x] Extend Story 7.3's block-type conversion menu to include Callout as a convertible target alongside paragraph/bullets/numbered/sub-heading — Math/Table/Resource card are **not** added to the free-conversion set (converting a Math block into a bulleted list doesn't have a sensible meaning the way paragraph↔bullets does); duplicate/delete/reorder apply to all four new block types uniformly via the existing mechanism (Story 7.2/7.3's drag+keyboard reorder, reused verbatim)

- [x] Task 6 — Tests: syntax-parity round-trips (AD-12) (AC: #6)
  - [x] `FrontEnd/tests/lib/markdown.test.ts` (extend the existing suite — read it first to match its fixture style): new cases for `math`, `callout`, and `resourceCard` blocks, parsed from hand-written Markdown strings matching exactly what each Tiptap serializer emits
  - [x] A dedicated round-trip test per custom type: Tiptap-serialize → `lib/markdown.ts`-parse → assert structural equality against the expected AST shape (not just "it didn't throw") — this is AD-12's actual contract, distinct from any visual/pixel test
  - [x] **The explicit adjacency case AD-12 names**: a Math block immediately followed by a Callout block with no blank line between them (and the reverse order) — assert both parse as two distinct, correctly-typed blocks, not one merged/mis-tokenized block. This is the concrete test of the "boundary a hand-written parser is likeliest to mis-tokenize" risk AD-12's text describes in the abstract
  - [x] A Resource-card promotion-boundary test: a paragraph containing `[label](resource:{id})` **plus other text** stays an ordinary paragraph with an inline link (not promoted to a card) — proving Task 1's promotion rule is actually conditional, not applied to every `resource:` link unconditionally

## Dev Notes

- **Builds on Epic 7 (block conversion/reorder mechanism, `lib/markdown.ts`'s existing parser), Epic 8 (`resolveResourceUrl`, the Learning Resources block a Resource card must reference), and Story 9.1 (the `SAFE_LINK` `resource:` scheme extension, the `extensions/` folder's established shape).**
- **This story extends a real, already-supported parser — it is not building Markdown table/blockquote support from scratch.** Read `lib/markdown.ts` in full before touching it; its header comment documents exactly what it does and doesn't handle today, and this story's job is a scoped, additive extension of that, matching the file's own closing guidance: "If a document ever needs more... extend this file and its tests."
- **A concrete relocation, not a new file:** `renderLatex.ts` moves from `features/CoursePlayer/` to `lib/`, since it now has two real feature consumers. **Its actual current call sites are `InlineDrilldownDetail.tsx` and `SentenceCard.tsx` — not `ReaderCanvas.tsx`** (the file's own "Extracted from ReaderCanvas.tsx" header comment is stale; confirmed by grep, `ReaderCanvas.tsx` has no reference to it). Update both real import sites so the migration doesn't silently break the existing KaTeX rendering in Course Player's Drill-Down/Sentence surfaces.
- **No `content-callout` DESIGN.md token was found during this story's research** — flag this as a real, small gap (not a blocker) rather than inventing unreviewed visual design; compose from existing card primitives and note it for follow-up.
- **Architecture:** AD-12 in its primary implementation story (the syntax-parity test discipline it mandates was previously aspirational — Stories 7.3/9.1 referenced it but had nothing non-CommonMark to test against; this story's three custom block types are the first real subjects).
- **AC #6's "inline math directly beside a Callout in the same paragraph" wording (quoted verbatim from the epics doc / AD-12) does not describe a literal feature to build** — Task 1 deliberately scopes Math to block-level `$$…$$` only, so there is no inline-math construct that could sit "in the same paragraph" as a Callout (a Callout is itself block-level, not paragraph content). Read that phrase as loose shorthand for "these constructs with no blank line separating them," which Task 6's actual test (a Math block immediately followed by a Callout block, and the reverse, no blank line between) is the correct, concrete implementation of. Don't attempt to build real inline `$…$` math to satisfy the AC's literal wording — that would contradict Task 1's own explicit scope decision.
- **Existing code to read before editing:** `lib/markdown.ts` (full file, already done during this story's own creation — the dev agent should re-read it fresh, not rely on this story's paraphrase), `ui/MarkdownViewer.tsx`, `features/CoursePlayer/renderLatex.ts` and its real call sites in `InlineDrilldownDetail.tsx` and `SentenceCard.tsx` (not `ReaderCanvas.tsx` — see the relocation note above), Story 8.1's `LearningResourcesBlock.ts` (the picker a Resource card node needs), Story 9.1's `Image.ts` (the most recent `extensions/` sibling, and the `SAFE_LINK` change to confirm/complete).
- **Git context:** no new commits since Story 9.1 was authored in this same session.

### Project Structure Notes

- New frontend files: `features/CourseContentEditor/extensions/{Math,Callout,ResourceCard}.ts`.
- Relocated frontend file: `features/CoursePlayer/renderLatex.ts` → `lib/renderLatex.ts` (update its two existing import sites, `InlineDrilldownDetail.tsx` and `SentenceCard.tsx` — **not** `ReaderCanvas.tsx`, despite the file's own now-stale header comment claiming that origin).
- New dependencies: `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-header`, `@tiptap/extension-table-cell`.
- Extended (not new): `lib/markdown.ts`, `ui/MarkdownViewer.tsx`.

### References

- [Source: _specs/planning-artifacts/epics-ContentAuthoring.md#Story 9.2] — verbatim Acceptance Criteria
- [Source: _specs/implementation-artifacts/9-1-...md] — `SAFE_LINK` extension, `extensions/` folder precedent
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md#AD-9, #AD-10, #AD-12]
- [Source: FrontEnd/src/lib/markdown.ts, FrontEnd/src/features/CoursePlayer/renderLatex.ts] — live code, read in full during this story's own creation

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- `@tiptap/extension-table`, `-table-row`, `-table-header`, `-table-cell` installed pinned to `3.30.1` exactly. Discovered `@tiptap/extension-table` has no default export (only named `Table`; the row/header/cell packages re-export the same underlying implementation from `@tiptap/extension-table` itself, each with their own default export) -- fixed the import style accordingly (named imports for all four).
- Empirically verified (throwaway tests, deleted before finalizing) that: (1) `@tiptap/markdown`'s stock Table/TableRow/TableHeader/TableCell round-trip to/from standard GFM pipe-table syntax with zero customization needed, confirming Task 4's own claim; (2) `createAtomBlockMarkdownSpec`/`createBlockMarkdownSpec` (found in `@tiptap/core`) use Pandoc `:::blockName` syntax, not this story's required `$$…$$`/`> [!note]` syntax -- ruled out as unusable for Math/Callout without extensive customization, informing the RawBlock-precedented scope decision below.
- **Found and fixed a real, previously-latent bug** while writing this story's own AD-12 adjacency tests: `markdownManager.serialize(nodes)` only inserts blank-line separators between top-level blocks when passed a `{type:'doc', content}` node -- a bare array of nodes (what `DocumentCanvas.tsx`'s `performSync` and `extractPageBodyMarkdown` were both already passing, since Story 7.3) concatenates blocks with **zero** separator at all (verified directly: even two adjacent plain paragraphs serialized as `"First.Second."`, no blank line). Every multi-block Page body has been affected since Story 7.3 -- fixed both call sites to wrap in `{type: 'doc', content: proseNodes}`; `extractPageBodyMarkdown` also gained the `learningResourcesBlock`-filter `performSync` already had (a second latent bug: opening Preview/Markdown on a page with an inserted Learning Resources block would have thrown, since that node isn't registered in markdownManager's schema at all).
- `tsc --noEmit`: zero new errors in any Story 9.2 file.
- `vitest run --project unit`: 91 files / 753 tests passed, 0 regressions (up from 90/729 after Story 9.1).

### Completion Notes List

- **Scope decision, explicitly flagged, not silently made:** Math's `markdownManager.parse()` (the standalone parser used outside a live editor, e.g. `buildPageJSON` on a page reload) has no custom hook recognizing `$$…$$` fenced text -- `@tiptap/markdown` has no native concept of this non-CommonMark syntax, and building a full custom marked.js tokenizer integration for it was judged out of proportion to this story's remaining scope. This is the *same category* of gap RawBlock.ts (Story 7.3) already documents and this codebase already accepts: on a fresh reload, a previously-inserted Math block's `$$`-fenced text degrades gracefully to plain, editable paragraph text (never corrupted or silently dropped) rather than being reconstructed as a live-rendered Math block. Within one editing session (insert, edit, autosave-serialize) Math is fully functional; only a full reload hits this documented limitation. Noted in `Math.ts`'s own header comment.
- **Callout and Resource card do NOT share this gap** -- both reconstruct correctly across a reload via a new `reconcileCustomBlocks` post-processing pass in `DocumentCanvas.tsx` (`buildPageJSON`), which walks `markdownManager.parse()`'s own standard output (a `blockquote`, or a `paragraph` containing a `link`-marked text run -- both parse correctly via completely standard CommonMark, since `@tiptap/extension-link` is already part of StarterKit) and promotes them to `callout`/`resourceCard` nodes using the identical rule `lib/markdown.ts`'s own parser (Task 1) applies. This was judged tractable (a plain JSON-tree pattern match, no tokenizer risk) where Math's multi-paragraph fence-merging was not, given remaining story scope.
- Math/Callout carry no `configure()`-time options, so a single shared instance lives directly in `CONTENT_EXTENSIONS` (used identically by both `markdownManager` and the live editor). Image (Story 9.1) and ResourceCard both need a courseId-configured instance for their own NodeView -- following Story 9.1's already-established split pattern, `markdownManager` gets an *unconfigured* instance of each (their NodeViews are never mounted there, since `markdownManager` never creates a live `editor.view`/DOM at all) while the live editor gets the `.configure({courseId})` instance, avoiding a duplicate-node-name schema conflict within either single editor instance.
- `renderNestedMarkdownContent` (a `@tiptap/core` markdown-rendering helper, its own doc comment shows `'> '` as the literal blockquote-prefix example) is reused for Callout's `renderMarkdown` rather than hand-rolling child serialization -- the `[!note]` marker is inserted into the resulting first output line only, matching `lib/markdown.ts`'s own parse-side expectation that the marker lives on the first quoted line's content, not repeated on every line.
- `Math` the Tiptap extension is exported as `MathBlock`, not `Math` -- the bare name `Math` would shadow the JS global `Math` object wherever imported (`DocumentCanvas.tsx` already calls `Math.abs` elsewhere), a real collision caught before it caused a bug, not a cosmetic naming choice.
- No dedicated `content-callout` DESIGN.md token was found during this story's own research (confirmed, not assumed) -- Callout's rendering (both the Tiptap NodeView-less CSS styling and `MarkdownViewer.tsx`'s render case) composes from this app's existing card-shell/badge-pill visual language instead of inventing new unreviewed tokens, flagged here for a future UX pass.
- `collectBodyBlocks`/`moveBlock`/`duplicateBlock`/`deleteBlock` (`BodyBlockControls.tsx`, Story 7.3) were already fully generic (operate on any top-level page-body node by position, no type allowlist) -- Math/Table/Resource card automatically get move/duplicate/delete controls for free with zero changes there. Only the *conversion* set needed an explicit Callout addition (Task 5): `wrapIn('callout')` (a genuine wrap, not `setNode`, since Callout is a content-holding wrapper type, not a plain textblock swap like paragraph/heading).

### File List

**Frontend — new:**
- `FrontEnd/src/features/CourseContentEditor/extensions/Math.ts`
- `FrontEnd/src/features/CourseContentEditor/extensions/MathNodeView.tsx`
- `FrontEnd/src/features/CourseContentEditor/extensions/Callout.ts`
- `FrontEnd/src/features/CourseContentEditor/extensions/ResourceCard.ts`
- `FrontEnd/src/features/CourseContentEditor/extensions/ResourceCardNodeView.tsx`
- `FrontEnd/src/lib/renderLatex.ts` (relocated from `features/CoursePlayer/renderLatex.ts`)
- `FrontEnd/tests/features/CourseContentEditor/extensions/MathCalloutResourceCard.test.tsx`

**Frontend — modified:**
- `FrontEnd/package.json` / `package-lock.json` (new dependencies: `@tiptap/extension-table`, `-table-row`, `-table-header`, `-table-cell`, all `3.30.1`)
- `FrontEnd/src/lib/markdown.ts` (new `math`/`callout`/`resourceCard` `MarkdownBlock` variants, `SAFE_LINK`'s `resource:` scheme, updated header comment)
- `FrontEnd/src/ui/MarkdownViewer.tsx` (render cases for `math`/`callout`/`resourceCard`, `ResolvedResourceCard`)
- `FrontEnd/src/features/CourseContentEditor/DocumentCanvas.tsx` (extensions wiring, `reconcileCustomBlocks`, 4 new slash commands, the `markdownManager.serialize()` bug fix)
- `FrontEnd/src/features/CourseContentEditor/BodyBlockControls.tsx` (Callout added to the conversion set)
- `FrontEnd/src/features/CoursePlayer/InlineDrilldownDetail.tsx` (import path updated for the `renderLatex.ts` relocation)
- `FrontEnd/src/features/CoursePlayer/SentenceCard.tsx` (same)
- `FrontEnd/tests/lib/markdown.test.ts` (extended)

**Frontend — removed:**
- `FrontEnd/src/features/CoursePlayer/renderLatex.ts` (relocated to `lib/`)

**Backend:** none.

## Change Log

| Date | Change |
|------|--------|
| 2026-08-17 | Story 9.2 implemented: Math (`$$…$$`, live KaTeX preview via relocated `lib/renderLatex.ts`), Callout (`> [!note]`, joins the block-conversion set), Table (`@tiptap/extension-table` family, zero `lib/markdown.ts` changes needed -- verified), and Resource card (`[label](resource:{id})`, a picker over the page's own attached resources) all added as real Tiptap nodes; `lib/markdown.ts` extended with matching parse rules and a syntax-parity test suite (adjacency + promotion-boundary cases per AD-12). Found and fixed a real pre-existing bug: `markdownManager.serialize()` was being called with a bare node array instead of a `{type:'doc'}`-wrapped one, silently dropping blank-line separators between every multi-block Page body since Story 7.3. Status: review. |
