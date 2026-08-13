---
baseline_commit: e64e8b260d54a2ac01680d582cacc80de715e147
---

# Story 3.2: Ways Menu & Keyword Popover UI (Mock Data)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a student,
I want to cycle through 5 alternative explanations and click any keyword for a definition, against mock content,
so that this UX can be validated before real generation exists.

## Acceptance Criteria

1. **Given** the Ways menu, **when** rendered, **then** it is a small, secondary-weight pill/tray near Drill-Down's "Explain more" action, not a peer button, **and** each Way is independently focusable with `aria-current` on the displayed one. [Source: epics.md Story 3.2; UX-DR11]
2. **Given** a keyword, **when** activated via Enter/Space (not click-only), **then** the definition popover keeps focus on the reading text and announces via `aria-live="polite"`. [Source: epics.md Story 3.2; UX-DR13]
3. **And** data access goes through a stable hook/service interface (`useWays()`, `useKeywordDefinition()`) from the start, so Phase B swaps the mock implementation behind it without changing component code. [Source: epics.md Story 3.2]

## Tasks / Subtasks

- [x] Task 1: `useWays(courseId, nodeId)` mock hook (AC: #1, #3)
  - [x] `FrontEnd/src/features/CoursePlayer/useWays.ts` (new): `(courseId: string, nodeId: string) => { ways: WayData[], isLoading: boolean, error: string | null, activeWayIndex: number, setActiveWayIndex: (i: number) => void }`. `nodeId` is the same real Topic/Subtopic id Story 3.1's `useDrilldownContent` uses -- both hooks key off the same node. `WayData = { explanation: string, example: ExampleItem, isOverridden: boolean }` (reuses the existing `ExampleItem` type from `FrontEnd/src/types.ts`, same shape `DrilldownPanel.tsx` already renders, so the worked-example rendering can share a component between Drill-Down and Ways rather than duplicating it -- see Task 3).
  - [x] `activeWayIndex` starts at `0` (Way 1), freely settable to any of `0..4` via `setActiveWayIndex` -- unlike Story 3.1's `unlockedLevel`, there is no gating/locking here at all (FR18's own "freely cyclable in any order" rule, distinct on purpose from Drill-Down's sequential-reveal discipline -- do not copy Story 3.1's locking logic here).
  - [x] Mock data: at least 2 node ids, each with exactly 5 `WayData` entries (never fewer -- FR18 requires every Way populated once generated), at least one `isOverridden: true` entry across the fixture.
- [x] Task 2: `useKeywordDefinition(courseId)` mock hook (AC: #2, #3)
  - [x] `FrontEnd/src/features/CoursePlayer/useKeywordDefinition.ts` (new): `(courseId: string) => { activeKeyword: string | null, definition: string | null, isOverridden: boolean, isLoading: boolean, error: string | null, define: (keyword: string) => void, dismiss: () => void }`. `define(keyword)` sets `activeKeyword` and (mock) resolves `definition` after a short simulated delay (matching `DrilldownPanel.tsx`'s own existing `setTimeout`-based mock-async pattern, not a real network call); `dismiss()` clears both. This is a genuinely new mechanic -- confirmed by direct read of `ReaderCanvas.tsx` that no keyword/definition code exists anywhere in this codebase today (an earlier research pass for this epic incorrectly assumed `handleAskLevelLLM`, a separate per-level chat mechanic, was a "fake" stand-in for this; it is not, and is untouched by this story).
  - [x] Mock data: a small `Record<string, { definition: string; isOverridden: boolean }>` keyed by keyword string, case-insensitive lookup; a keyword with no fixture entry resolves to `definition: null` (not an error) so the "Definition unavailable" empty state (Task 4) is exercisable.
- [x] Task 3: Ways menu UI component (AC: #1)
  - [x] `FrontEnd/src/features/CoursePlayer/WaysMenu.tsx` (new): small pill/tray, `role="tablist"` on the row of Way pills (matches `mockups/key-course-player-adaptive.html` exactly), each pill a real `<button role="tab">`, `aria-current="true"` on the active Way's pill (note: `mockups/key-course-player-adaptive.html` uses `aria-current`, not `aria-selected`, on the active pill -- follow the mockup literally since epics.md's own AC text names `aria-current` specifically, even though `aria-selected` would be the more idiomatic ARIA pairing for `role="tablist"`/`role="tab"` -- `[ASSUMPTION: matching the mockup/AC text exactly over strict ARIA-authoring-practices idiom, since both this story's AC and Story 3.1's sibling pattern (level tabs) already establish aria-current as this codebase's chosen convention for "the currently displayed one of several tab-like options" -- confirm no accessibility-review pushback during dev]`. Uses the `ways-menu` DESIGN.md token (`background: #ffffff`, `border: 1px solid #E1DED4`, `rounded: 0.75rem`, small pill/tray pattern, secondary visual weight -- explicitly not a full modal/side-panel).
  - [x] Visually and structurally secondary to Drill-Down's "Explain more" (per UX-DR11 and Story 3.1's Task 4, which already added a static nudge placeholder next to "Explain more" anticipating this component) -- wire that nudge to actually open/reveal `WaysMenu` now that it exists. The displayed Way's `explanation` + `example` render below the tray, reusing the same worked-example presentation `DrilldownPanel.tsx` already has for `ExampleItem` (extract a small shared `ExampleCard` component from `DrilldownPanel.tsx` if that's a clean lift, rather than copy-pasting the JSX -- confirm during dev whether the extraction is worth it at this scope).
- [x] Task 4: Keyword popover UI (AC: #2)
  - [x] `FrontEnd/src/features/CoursePlayer/KeywordText.tsx` (new): a small presentational component wrapping a block of rendered text, taking a `keywords: string[]` prop (the set of clickable words/phrases for this specific block -- mock-supplied per content block in the fixture, since real keyword detection is Phase B's job) and an `onDefine: (keyword: string) => void` callback. Each matched keyword renders as a real `<button>` (never `<span onClick>`, per UX-DR13's explicit rule), inline with the surrounding text, reachable in normal Tab order, activated by both click and Enter/Space (a native `<button>` gets Enter/Space for free -- confirm no `preventDefault`/custom keydown handling accidentally suppresses it).
  - [x] `FrontEnd/src/features/CoursePlayer/KeywordPopover.tsx` (new): the popover itself, anchored at the clicked keyword (`keyword-popover` DESIGN.md token: white background, `1px solid #E1DED4` border, `rounded.DEFAULT`, `shadow-md`, lightweight anchored popover, not modal/side-panel). On open: **focus stays on the reading text's keyword button** (never moves into the popover itself), the definition is announced via a `aria-live="polite"` region (matches `CourseContentEditor.tsx`'s own established debounced aria-live announcer pattern from Epic 2 for the *mechanism*, though this popover's announcement is immediate/single, not batched -- no debounce needed here since only one keyword definition is ever in flight at a time). Dismisses on `Escape` or click-elsewhere (reuse `ConfirmModal.tsx`'s or an equivalent existing overlay's dismiss-on-`Escape`/outside-click pattern rather than reimplementing it from scratch, if one is cleanly reusable). Empty state: `useKeywordDefinition`'s `definition === null` (after `isLoading` resolves) renders "Definition unavailable" text in the popover, not a blank/broken shell.
  - [x] Wire `KeywordText` into Story 3.1's ContentBlock-text rendering in `CoursePlayer.tsx`'s reading pane (the natural integration point, since that's where real content-block text is rendered as of Story 3.1) -- `[ASSUMPTION: this story does not extend keyword-clicking into DrilldownPanel/WaysMenu content in this same pass, even though FR20's literal text says "any keyword in course content" -- scoping to the main reading pane first is the smaller, still-AC-satisfying slice (the AC only requires the mechanism exist and work correctly somewhere real, not everywhere at once); extending it to Drill-Down/Ways content is a natural, low-risk follow-up once this pattern is proven, not required by this story's stated ACs.]`
- [x] Task 5: Frontend tests
  - [x] `FrontEnd/tests/features/CoursePlayer/useWays.test.ts` (new): `activeWayIndex` freely settable to any index with no gating; mock data always has exactly 5 ways per node.
  - [x] `FrontEnd/tests/features/CoursePlayer/useKeywordDefinition.test.ts` (new): `define()` sets `activeKeyword`/resolves `definition`; an unknown keyword resolves `definition: null`, not an error; `dismiss()` clears both.
  - [x] `FrontEnd/tests/features/CoursePlayer/WaysMenu.test.tsx` (new): each Way pill is a real button reachable by Tab; `aria-current="true"` on the active pill only; clicking/activating a pill updates the displayed explanation+example.
  - [x] `FrontEnd/tests/features/CoursePlayer/KeywordPopover.test.tsx` (new): activating a keyword via keyboard (`{Enter}`/`{ }` via `userEvent`, not `fireEvent.click`) opens the popover; focus remains on the keyword button after opening (assert `document.activeElement`); the popover's definition text is inside an `aria-live="polite"` region; `Escape` dismisses without moving focus unexpectedly; an unresolvable keyword shows "Definition unavailable".

## Dev Notes

- **This story's two mechanisms are deliberately asymmetric, matching FR17 vs FR18/20's own real differences** -- Ways cycles freely (no lock state, unlike Story 3.1's Drill-Down levels); the keyword popover is click/activate-triggered per-instance, not a persistent per-node data set the way Drill-Down/Ways are. Don't force a shared "content state" abstraction across all three just for symmetry.
- **Correction carried forward from Story 3.1's own Dev Notes:** the keyword popover is genuinely net-new UI, not a replacement for `ReaderCanvas.tsx`'s `handleAskLevelLLM` (a separate, untouched, pre-existing per-level chat mechanic). Do not remove or modify `handleAskLevelLLM`/`toggleVoiceRecording` as part of this story.
- **Reduced-motion:** per DESIGN.md's Accessibility Floor, both the Ways tray's open/close animation and the keyword popover's appear/dismiss transition must respect `prefers-reduced-motion: reduce` -- check how `ConfirmModal.tsx`/`SidePanel.tsx` (existing overlays) already handle this in this codebase and match that convention rather than inventing a new one.
- **Design tokens** (exact values, DESIGN.md): `ways-menu` -- background `#ffffff`, border `1px solid #E1DED4`, `rounded: 0.75rem`. `keyword-popover` -- background `#ffffff`, border `1px solid #E1DED4`, `rounded: 0.75rem`, `shadow-md`.

### Project Structure Notes

- Frontend new files: `FrontEnd/src/features/CoursePlayer/{useWays.ts, useKeywordDefinition.ts, WaysMenu.tsx, KeywordText.tsx, KeywordPopover.tsx}`, all new test files from Task 5.
- Frontend modified files: `FrontEnd/src/features/CoursePlayer/{DrilldownPanel.tsx, CoursePlayer.tsx}` (wiring the Ways nudge and keyword-wrapped text into the existing reading pane/panel from Story 3.1).

### References

- [Source: _specs/planning-artifacts/epics.md — Story 3.2 (lines 602-619)]
- [Source: _specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md — FR18 §4.7 (5 Ways, each with its own worked example, freely cyclable), FR20 §4.9 (keyword popover, subject/language-aware, tutor override takes priority)]
- [Source: _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/ — UX-DR11 (Ways is secondary to Drill-Down's "Explain more", each Way independently focusable with aria-current), UX-DR13 (keyword is a real focusable control activated by Enter/Space, popover keeps focus on reading text, announces via aria-live="polite"), DESIGN.md's `ways-menu`/`keyword-popover` token values, `mockups/key-course-player-adaptive.html` (Ways tray uses `role="tablist"`/`aria-current="true"` on the active pill; keyword control is a real `<button class="kw">`, `aria-expanded="true"` when open, popover has its own explicit close button)]
- [Source: FrontEnd/src/features/CoursePlayer/ReaderCanvas.tsx — read directly this session; confirmed no keyword/definition/glossary code exists anywhere in the file, correcting an earlier research-pass error]
- [Source: FrontEnd/src/features/CourseContentEditor/CourseContentEditor.tsx — Epic 2's established `aria-live="polite"` announcer pattern this story's popover announcement follows in spirit (not its debounce mechanics, which don't apply to a single immediate announcement)]

## Previous Story Intelligence

Story 3.1 (this same epic, `ready-for-dev`, not yet implemented):

- **`useDrilldownContent(courseId, nodeId)`'s signature is the established pattern this story's two new hooks must match exactly** — same `(courseId, nodeId)` parameter shape for `useWays`, keyed to the same real Topic/Subtopic ids Story 3.1's mock fixture already defines (reuse that same fixture's node ids, don't invent parallel ones, so a single mock node has Drill-Down content AND Ways content AND is a real place to test the "Explain more" nudge actually opening the Ways menu end-to-end).
- **Story 3.1's Task 4 already added a static, non-functional nudge placeholder next to "Explain more"** specifically anticipating this story — this story's Task 3 is what makes it real. Read `DrilldownPanel.tsx` as modified by Story 3.1 (not the pre-3.1 version) before wiring this.
- **The "verify claims against the real file, don't trust a research summary" lesson bit twice this session already** (once in Epic 2, once in this epic's own Story 3.1 research pass, where `handleAskLevelLLM` was wrongly flagged as a keyword-affordance stand-in). Continue verifying directly during implementation, especially anywhere this story's Dev Notes describe existing code from research rather than a fresh read.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npx tsc --noEmit` clean after every task and after the code-review patch (only pre-existing, unrelated `FlashcardsModal.tsx` errors remain, confirmed to predate this story).
- Full frontend regression: `npx vitest run` → 72 files / 467 tests passing (448 pre-existing after Story 3.1 + 19 new from this story; 0 failures, 0 regressions).

### Completion Notes List

- Task 1: `useWays(courseId, nodeId)` mock hook, same `(courseId, nodeId)` signature as Story 3.1's `useDrilldownContent`, keyed to the same `subtopic_1`/`topic_2` node ids so a single mock node has both Drill-Down and Ways content. `activeWayIndex` has no gating/locking (FR18's freely-cyclable rule), deliberately not copying Story 3.1's `unlockedLevel` sequential-reveal logic. Each fixture node has exactly 5 `WayData` entries; `topic_2` has one `isOverridden: true` entry.
- Task 2: `useKeywordDefinition(courseId)` mock hook — `define(keyword)` sets `activeKeyword` immediately and resolves `definition`/`isOverridden` after a short mock delay; case-insensitive fixture lookup (`wave`, `wavelength` [overridden], `frequency`); an unresolvable keyword resolves `definition: null`, not an error. `dismiss()` and a new `define()` call both clear any pending timer first, so only one definition is ever in flight.
- Task 3: extracted a shared `ExampleCard.tsx` from `DrilldownPanel.tsx`'s existing worked-example JSX (a clean lift, confirmed during dev) so `WaysMenu.tsx` reuses the identical worked-example presentation rather than duplicating it. `WaysMenu.tsx` renders a `role="tablist"` pill tray (`ways-menu` token: white bg, `1px solid #E1DED4`, `rounded-xl`) with `aria-current="true"` on the active pill, matching the mockup literally per the story's own `[ASSUMPTION]`. Wired into `DrilldownPanel.tsx`'s existing static UX-DR11 nudge (Story 3.1 left it non-functional) via a new `isWaysOpen` toggle state — the nudge is now a real `<button aria-expanded>`.
- Task 4: `KeywordText.tsx` splits a text block on mock-supplied keyword occurrences (longest-first, word-boundary, case-insensitive regex) and renders each match as a real `<button>` (never `<span onClick>`, per UX-DR13), reachable in normal Tab order with native Enter/Space activation. `KeywordPopover.tsx` is anchored via a wrapping `<span className="relative inline-block">`, never moves focus into itself (UX-DR13's explicit requirement), announces its definition via an `aria-live="polite"` region, and dismisses on `Escape` (document keydown listener) or a click outside the wrapping span (document mousedown listener) — patterned after `ConfirmModal.tsx`'s/`SidePanel.tsx`'s existing `Escape`-dismiss convention, adapted since this popover must not trap or move focus like those do. Wired into `CoursePlayer.tsx`'s `ContentBlockView` for `format === 'text'` blocks via a single shared `useKeywordDefinition(course.id)` instance (only one keyword definition is ever in flight at a time, matching the hook's own design). A new `MOCK_BLOCK_KEYWORDS` fixture in `playerContent.ts` supplies `['wave', 'energy']` for `block_1` — `wave` resolves to a real definition, `energy` deliberately does not, exercising both the populated and "Definition unavailable" empty states.
- Task 5: added `useWays.test.ts` (4 tests), `useKeywordDefinition.test.ts` (5 tests), `WaysMenu.test.tsx` (3 tests), `KeywordPopover.test.tsx` (6 tests, via a small test harness combining `KeywordText` with the real `useKeywordDefinition` hook, covering Enter/Space activation, focus retention, `aria-live` announcement, `Escape` dismiss, click-outside dismiss, and the unresolvable-keyword empty state). One pre-existing Story 3.1 test in `CoursePlayer.test.tsx` needed updating: `block_1`'s text is now split across `<button>` elements for its "wave"/"energy" keywords, so the exact-string `getByText` assertion was changed to match against the paragraph's full `textContent` instead. All other pre-existing tests pass unmodified.

### File List

- `FrontEnd/src/features/CoursePlayer/useWays.ts` (new)
- `FrontEnd/src/features/CoursePlayer/useKeywordDefinition.ts` (new)
- `FrontEnd/src/features/CoursePlayer/WaysMenu.tsx` (new)
- `FrontEnd/src/features/CoursePlayer/ExampleCard.tsx` (new — extracted from `DrilldownPanel.tsx`)
- `FrontEnd/src/features/CoursePlayer/KeywordText.tsx` (new)
- `FrontEnd/src/features/CoursePlayer/KeywordPopover.tsx` (new)
- `FrontEnd/src/features/CoursePlayer/DrilldownPanel.tsx` (modified)
- `FrontEnd/src/features/CoursePlayer/CoursePlayer.tsx` (modified)
- `FrontEnd/src/features/CoursePlayer/playerContent.ts` (modified — added `MOCK_BLOCK_KEYWORDS`)
- `FrontEnd/tests/features/CoursePlayer/useWays.test.ts` (new)
- `FrontEnd/tests/features/CoursePlayer/useKeywordDefinition.test.ts` (new)
- `FrontEnd/tests/features/CoursePlayer/WaysMenu.test.tsx` (new)
- `FrontEnd/tests/features/CoursePlayer/KeywordPopover.test.tsx` (new)
- `FrontEnd/tests/features/CoursePlayer/CoursePlayer.test.tsx` (modified — one assertion updated for keyword-split text)

## Senior Developer Review (AI)

**Date:** 2026-08-13
**Outcome:** Approved after patch
**Method:** `bmad-code-review` — parallel adversarial review (Blind Hunter, Edge Case Hunter, Acceptance Auditor)

**Acceptance Criteria audit (Acceptance Auditor):** All 3 ACs verified PASS against the actual code and tests: `WaysMenu.tsx` is a secondary-weight `role="tablist"` pill tray triggered from inline text (not a peer button) with `aria-current="true"` on exactly one pill (AC1); keyword `<button>`s support native Enter/Space activation, `KeywordPopover.tsx` never calls `.focus()` so focus stays on the trigger, and the definition renders inside `aria-live="polite"` (AC2); `useWays(courseId, nodeId)`/`useKeywordDefinition(courseId)` are the sole data-access surface consumed by their components, matching Story 3.1's hook-signature convention (AC3). `ExampleCard.tsx` confirmed genuinely shared (used by both `DrilldownPanel.tsx` and `WaysMenu.tsx`, not orphaned). No unchecked subtasks misrepresent completed work.

**Action Items:**

- [x] **[High]** The shared `useKeywordDefinition(course.id)` instance in `CoursePlayer.tsx` was not reset when `selectedNodeId` changed. `KeywordText.tsx`'s `isOpen` check is a plain string comparison between the block's own keyword occurrence and the hook's single shared `activeKeyword` — with no per-node or per-occurrence identity. Repro: open the "wave" popover while viewing Subtopic 1, switch to a different sidebar node, switch back — the popover reappeared already-open (stale `aria-expanded="true"`, stale definition data) with no click, Enter, or Space ever pressed against it in the new render. Found independently by both the Blind Hunter and Edge Case Hunter passes. **Fix:** added an effect in `CoursePlayer.tsx` that calls `keywordState.dismiss()` whenever `selectedNodeId` changes, so a popover only ever opens in direct response to an actual activation. Added a regression test (`CoursePlayer.test.tsx`: "dismisses an open keyword popover when the selected content node changes, so it does not silently reopen on returning"). Full regression suite (467 tests) and `tsc --noEmit` re-verified clean after the patch.

**Non-blocking observation (not actioned, out of this story's stated scope):** the same root cause (string-only `activeKeyword` comparison, no per-occurrence identity) means that if the *same visible* content simultaneously contained the identical keyword string twice — either two occurrences in one block's text, or two different blocks of the same selected node both tagged with the same keyword in `MOCK_BLOCK_KEYWORDS` — every matching occurrence would independently render its own open popover at once. The current mock fixture (`MOCK_BLOCK_KEYWORDS` only tags `block_1`, each keyword appearing once) never exercises this, so it wasn't actionable within this story's own scope; flagged here so Phase B (Story 3.5/3.7, real keyword-detection data) revisits identity-scoping (e.g. an occurrence id rather than raw keyword text) before duplicate keywords in real content can trigger it.

## Change Log

- 2026-08-12: Story created via `bmad-create-story` — second of Epic 3's 11 stories, written as part of the full-epic write-then-implement batch. Status set to `ready-for-dev`.
- 2026-08-13: All 5 tasks implemented via `bmad-dev-story`. `useWays`/`useKeywordDefinition` mock hooks, `WaysMenu.tsx` (wired into Story 3.1's static nudge), a shared `ExampleCard.tsx` extracted from `DrilldownPanel.tsx`, and `KeywordText.tsx`/`KeywordPopover.tsx` wired into `CoursePlayer.tsx`'s reading pane. 18 new frontend tests added across 4 files; one pre-existing Story 3.1 test updated for keyword-split text. Full regression 72 files / 466 tests passing, 0 regressions; `tsc --noEmit` clean. Status set to `review`, ready for code-review cycle.
- 2026-08-13: `bmad-code-review` (Blind Hunter/Edge Case Hunter/Acceptance Auditor) found one High-severity real bug — the shared keyword-popover state leaked across content-node navigation, causing a popover to silently reopen unrequested. Patched with a `dismiss()`-on-`selectedNodeId`-change effect in `CoursePlayer.tsx` plus a regression test. All 3 ACs independently verified PASS. Full regression re-run: 72 files / 467 tests passing, `tsc --noEmit` clean. Status set to `done`.
