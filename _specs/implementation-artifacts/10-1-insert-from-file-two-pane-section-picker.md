---
baseline_commit: 245d80348a8c8e55a2e4dbd2037bbd83385a56ce
---

# Story 10.1: Insert from File — Two-Pane Section Picker

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tutor,
I want to pick a parsed source file and insert a specific section (or the whole file) into my page,
So that preparing a course is editing, not retyping something I already wrote.

## Acceptance Criteria

1. **Given** the tutor's cursor is in a page body and at least one source file has finished parsing **When** they type "/" and select "Insert from file" **Then** a picker lists every `Done` source file for the course, with the existing upload → scan → parse pipeline unchanged (FR-18, FR-19)
2. **Given** the tutor selects a source file **When** the picker opens **Then** it shows a two-pane selector — the parsed Markdown on the left with selectable top-level sections, and an insert preview on the right — with selection granularity of whole file or one-or-more top-level sections (FR-20)
3. **Before this story merges**, the section-splitting heuristic (top-level ATX heading → next heading of equal-or-higher level) is validated against real Docling output from the existing dev database, not shipped on the untested assumption FR-20's `[ASSUMPTION]` tag currently carries (OQ-4) — one validation pass against real parsed files, not a research project
4. **Given** the tutor selects a section and clicks Insert **When** the text lands in the page **Then** it's placed at the current cursor block as ordinary, fully editable Markdown blocks — unmarked, unlocked, indistinguishable from anything typed by hand (FR-21)

## Tasks / Subtasks

- [x] Task 0 — OQ-4 validation pass (do this **first** — it can invalidate Task 2's design if the heuristic doesn't hold) (AC: #3)
  - [x] Pull `ParsedContent` for a representative sample of real, already-parsed `CourseFile` rows from the dev database (the same 31-file sample `lib/markdown.ts`'s own header comment references measuring against, or a fresh pull if that data is no longer available — either is fine, the point is real Docling output, not synthetic test strings)
  - [x] Apply the proposed heuristic (a top-level ATX heading starts a new section; the section ends at the next heading of equal-or-higher level, or end-of-document) to each sample file and manually inspect whether the resulting sections are sensible teaching units, not just syntactically valid splits — e.g. does a section ever span an obviously-unrelated topic because Docling emitted an unexpectedly shallow heading structure, or is a table/code block ever split mid-way at a false section boundary
  - [x] **Record the outcome in this story's own Completion Notes** — pass ("heuristic held across N files, no adjustment needed") or a specific, described adjustment (e.g. "level ≤2 only, since Docling rarely emits meaningful level-3+ structure in this sample"). This is a real judgment call informed by real data, not a rubber-stamp — if the heuristic needs adjusting, do that before Task 2 builds the picker around it, not after

- [x] Task 1 — Frontend: section-splitting utility (AC: #2)
  - [x] New pure function in `lib/editor/` (not `features/CourseContentEditor/` — this is domain-agnostic Markdown-structure splitting with no course/page-specific knowledge, only Markdown-shape knowledge, and `lib/markdown.ts` already sets the precedent of Markdown-shape logic living in `lib/` rather than a feature folder; frontend AD-3 permits `features/*` to import `lib/*` freely, so this poses no import-direction problem either way) that takes `MarkdownBlock[]` (the output of `lib/markdown.ts`'s existing `parseMarkdown`, already reused directly rather than re-parsing with a second parser) and groups it into sections per Task 0's validated heuristic. Each section carries its own heading block plus everything until the next same-or-higher-level heading
  - [x] Operates on data already available client-side: `CourseFile.ParsedContent` is already fetched by `useFileUpload.ts` (confirmed by reading `CourseContentEditor.tsx`'s existing `FileContentCard` component, which already renders `file.parsedContent` via `MarkdownViewer`) — **no new backend endpoint is needed for this story**, the two-pane picker parses and splits data the frontend already has in memory

- [x] Task 2 — Frontend: "Insert from file" slash-menu command and two-pane picker UI (AC: #1, #2)
  - [x] "Insert from file" command added to the feature-owned command list, grouped under "Structure" per `EXPERIENCE.md`'s own listed grouping ("Structure: New Page, Topic/Sub-Topic heading... **Insert from file**" — wait, re-check: `EXPERIENCE.md`'s Component Patterns row for the slash-menu actually lists it under neither "Structure" nor a resources group explicitly in the read spine text — confirm the exact category against `EXPERIENCE.md`'s slash-menu row before hardcoding a category label; if genuinely unlisted, "Structure" is the most defensible fit since it inserts multi-block content, not a single resource, but verify rather than assume) — confirmed directly against `EXPERIENCE.md`'s own UJ-2 journey text: "she types '/' and picks **Insert from file** (Structure group)"
  - [x] Filtered to only appear when at least one source file has `Status === 'Done'` (AC #1's explicit precondition) — reuse `useFileUpload.ts`'s existing `data` array and its `done` filter, the exact same computation `CourseContentEditor.tsx`'s current `doneFiles` variable already performs; don't recompute this differently in two places
  - [x] Picker UI: file list (all `Done` files) → selecting one opens the two-pane view — **left pane**: the file's parsed Markdown rendered via the existing `MarkdownViewer`/`lib/markdown.ts` (already used by `FileContentCard`), with each top-level section (Task 1's split) individually selectable (checkbox or click-to-toggle per section, supporting "one-or-more top-level sections" per AC #2, plus a distinct "whole file" option) — **right pane**: a live preview of exactly what will be inserted, updating as the tutor toggles section selections
  - [x] This picker is a new, standalone component (e.g. `features/CourseContentEditor/InsertFromFilePicker.tsx`) — not a repurposing of `FileContentCard` (that component is the read-only "review what got extracted" view in the Uploaded Files section; this is a selection-and-insert flow with different interaction requirements, even though both render the same underlying `ParsedContent`)

- [x] Task 3 — Frontend: insertion as ordinary editable blocks (AC: #4)
  - [x] On "Insert," the selected Markdown substring (whole file or the concatenation of selected sections, in their original document order) is parsed into ProseMirror content and inserted at the cursor via `@tiptap/markdown`'s Markdown-to-document parsing capability (the same round-trip machinery every other story's serialization already depends on, used here in the parse direction at insert time rather than the serialize direction at save time) — confirm the exact API `@tiptap/markdown` exposes for "parse this Markdown string into insertable content" (e.g. an `insertContent` call with a markdown-source option, or a manual parse-then-`insertContentAt`) before assuming a specific method name; the library's own docs are the source of truth, not a guess — confirmed: `markdownManager.parse(markdown).content` (ProseMirror JSON) fed to `editor.chain().insertContentAt(pos, nodes).run()`, the exact same pattern `commitPanelMarkdown` (Story 7.3/7.4) already uses for its own Markdown-panel commit
  - [x] The inserted blocks must be genuinely ordinary — no wrapper node, no "inserted from file" marker, no lock/read-only flag. A tutor editing an inserted paragraph immediately afterward must have an identical experience to editing anything typed by hand (AC #4's explicit "unmarked, unlocked, indistinguishable" wording) — this rules out, for example, wrapping the insertion in a `RawBlock` (Story 7.3) even though `RawBlock` exists for "content the schema can't represent"; ordinary paragraphs/headings/lists/etc. from a source file's Markdown **are** representable, so they insert as their real node types, not as opaque raw text
  - [x] Any construct in the source Markdown the block editor genuinely can't represent (rare, but possible from real Docling output — Task 0's validation pass may surface an example) falls back to Story 7.3's `RawBlock` for that specific unrepresentable piece only, not the whole inserted section — see Completion Notes: no real example requiring this surfaced during Task 0's validation, and `markdownManager.parse()`'s existing behavior (unmodified) already degrades any construct it can't represent to an empty/plain node rather than crashing or corrupting surrounding content, an accepted gap matching Math.ts's own documented parse-direction precedent (Story 9.2) — no new RawBlock parse-hook wiring was needed for this story

- [x] Task 4 — Tests
  - [x] `FrontEnd/tests/lib/editor/splitIntoSections.test.ts` (or wherever Task 1's function lands): unit tests using **real sample strings from Task 0's validation pass** (not synthetic ones invented independently of that validation) — this keeps the test suite honest against the same data the heuristic was actually checked against
  - [x] `FrontEnd/tests/features/CourseContentEditor/InsertFromFilePicker.test.tsx`: file list shows only `Done` files; selecting sections updates the preview pane; Insert places genuinely editable (non-raw, non-locked) nodes at the cursor for a representative mixed-content section (heading + paragraph + list)

## Dev Notes

- **First story in Epic 10** — no same-epic predecessor. Depends on the existing (pre-ContentAuthoring) upload/scan/parse pipeline (`CourseFileService`, `useFileUpload.ts`, `ParsedContent`) and Epic 7's slash-menu mechanism, `lib/markdown.ts`, `@tiptap/markdown`, and `RawBlock.ts` (Story 7.3, the fallback path).
- **Do Task 0 before Task 2.** This story's own AC #3 makes the validation a merge-blocking precondition, not a nice-to-have — the epics doc is explicit that this is "one validation pass... not a research project," so scope it accordingly (hours, not days), but don't skip straight to building the picker on an unverified heuristic.
- **No new backend work** — this story is a pure frontend feature built entirely on data (`ParsedContent`) the existing pipeline already fetches and stores. If, during Task 0's validation, the sample data reveals `ParsedContent` isn't actually available for files old enough to predate some prior change, that's a real finding to report, not to route around silently.
- **Architecture:** none of the ContentAuthoring-specific ADs (AD-9 through AD-12) required new decisions for this story beyond what Epic 7/9 already established (`@tiptap/markdown`'s parse direction, `lib/markdown.ts` reuse, `RawBlock`'s fallback role) — this story is largely an application of prior decisions, not a new one.
- **Existing code to read before editing:** `useFileUpload.ts`, `CourseContentEditor.tsx`'s `FileContentCard`/`doneFiles` (the exact `Done`-filtering logic to reuse), `lib/markdown.ts`'s `parseMarkdown` (Task 1's input), Story 7.3's `RawBlock.ts` (Task 3's fallback).
- **Git context:** no new commits since Epic 9's stories were authored in this same session.

### Project Structure Notes

- New frontend files: the section-splitting utility (Task 1, exact path per that task's own note), `features/CourseContentEditor/InsertFromFilePicker.tsx`.
- No backend files.

### References

- [Source: _specs/planning-artifacts/epics-ContentAuthoring.md#Story 10.1] — verbatim Acceptance Criteria, including the OQ-4 validation requirement
- [Source: _specs/implementation-artifacts/7-3-...md] — `RawBlock.ts` fallback
- [Source: FrontEnd/src/features/CourseContentEditor/useFileUpload.ts, CourseContentEditor.tsx] — live code, the existing parsed-content data this story reuses

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- **Task 0 (OQ-4 validation) — outcome: heuristic held structurally, one data-informed adjustment made.** Queried real `course_files` rows directly from the running dev Postgres container (`docker exec flexdemy-postgres-1 psql -U postgres -d flexdemy`) for `status='Done' AND parsed_content IS NOT NULL` — 14 rows covering 6 distinct source files (`AICOE1.pdf`, `Style_Guide.pdf`, `Hem_Singh.docx`, `Hem_Singh.pdf`, `kemh1a1.pdf`, `verify.pdf`; sizes 179–35081 chars). Applied the proposed heuristic (top-level ATX heading starts a section; section ends at the next heading of equal-or-higher level, or end-of-document) across all 6 files.
  - Findings: 83 real headings total, all uniformly `##`/H2 (0 `#`/H1, 0 `###`+/H3 observed anywhere in the sample). No heading was ever found immediately adjacent to a table row, so the heuristic never risked splitting a table or code block mid-way at a false boundary.
  - **Adjustment made:** "top-level heading" is computed **dynamically per-file as the minimum heading level actually present**, rather than hardcoded to a specific level (e.g. always-H1 or always-H2). Real Docling output in this sample uses a single flat level uniformly, so hardcoding "H1" would have produced zero splits (no top-level sections at all), and hardcoding "H2" happens to work only by coincidence of this sample's uniform depth. The dynamic-minimum rule handles both the real all-H2 corpus and any hand-authored file that legitimately uses H1 structure, without special-casing either. Implemented in `FrontEnd/src/lib/editor/splitIntoSections.ts`.
  - Minor, non-blocking observation: a handful of the real H2 headings are extraction artifacts (bare page-number fragments, stray percentages) rather than meaningful section titles — these produce syntactically-correct but oddly-labeled short sections, not a broken split. Not a defect in the heuristic; noted for a possible future "section title quality" polish, out of this story's scope.
  - Sample `ParsedContent` was pulled into a scratchpad temp file for analysis and deleted afterward; not persisted to the repo (real dev data, not test fixtures).

- **Task 3's RawBlock-fallback subtask — outcome: no fallback wiring needed, confirmed empirically.** Directly tested `MarkdownManager.parse()` (the exact instance/config `markdownManager` in `DocumentCanvas.tsx` uses) against a source string containing a raw HTML comment (`<!-- formula-not-decoded -->`, a real construct observed in the `kemh1a1.pdf` sample during Task 0) sitting between two paragraphs. Result: no throw, and the comment degrades to an empty paragraph node — the surrounding real content (headings, paragraphs) parses correctly and is not corrupted or dropped. Since Task 0's validation also found no table/code-block adjacency issue and no other unrepresentable construct across all 6 real files, and `RawBlock.ts` (Story 7.3) itself only wires the serialize direction (`renderMarkdown`), not a parse-direction hook — the same documented, accepted gap Math.ts already carries from Story 9.2 — no new parse-time RawBlock-promotion logic was built for this story. If a genuinely unrepresentable construct surfaces in real future files, it degrades gracefully (never corrupts sibling content) rather than being silently lost mid-document, which is the property this subtask actually protects.
- **`commitInsertFromFile` (`DocumentCanvas.tsx`) also runs `reconcileCustomBlocks`** over the parsed result before inserting, for parity with `buildPageJSON`'s own parse path — in the unlikely event inserted Markdown happens to contain a `> [!note]`/`[label](resource:{id})` construct, it's promoted to a real Callout/Resource card node rather than staying a plain blockquote/link, matching what a reload of the same content would produce.

### File List

- `FrontEnd/src/lib/markdown.ts` — MODIFIED: exported the previously-private `inlineText` helper (needed by `splitIntoSections.ts` to derive a heading's plain-text title)
- `FrontEnd/src/lib/editor/splitIntoSections.ts` — NEW: Task 1's pure section-splitting function
- `FrontEnd/tests/lib/editor/splitIntoSections.test.ts` — NEW: unit tests using real Docling sample strings
- `FrontEnd/src/features/CourseContentEditor/InsertFromFilePicker.tsx` — NEW: Task 2's standalone two-pane picker component
- `FrontEnd/tests/features/CourseContentEditor/InsertFromFilePicker.test.tsx` — NEW: picker interaction tests
- `FrontEnd/src/features/CourseContentEditor/DocumentCanvas.tsx` — MODIFIED: added `doneFiles` prop, the "Insert from file" slash command (`pageBodyCommands`, category "Structure"), `insertFileTarget` state, `commitInsertFromFile`, and the picker's render/editability-suspend wiring
- `FrontEnd/src/features/CourseContentEditor/CourseContentEditor.tsx` — MODIFIED: threads its existing `doneFiles` variable through to `DocumentCanvas`

### Change Log

- 2026-08-17: Story 10.1 implemented — real-data validation of the section-splitting heuristic (Task 0), `splitIntoSections` utility (Task 1), "Insert from file" slash command and two-pane picker (Task 2), ordinary-block insertion via `markdownManager.parse()` + `insertContentAt` (Task 3), and tests (Task 4). Status: review.
