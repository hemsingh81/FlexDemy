---
baseline_commit: e64e8b260d54a2ac01680d582cacc80de715e147
---

# Story 3.4: Publishing Lifecycle UI (Mock Data)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tutor,
I want to preview my course as a student, confirm review, and see publish progress, against mock lifecycle state,
so that this UX can be validated before real backend wiring exists.

## Acceptance Criteria

1. **Given** all nodes are mock-confirmed, **when** "Review as Student" is triggered, **then** the course visually transitions to In Review. [Source: epics.md Story 3.4; PRD FR23]
2. **Given** Review is not yet Confirmed, **when** viewing any earlier state, **then** Publish is disabled. [Source: epics.md Story 3.4; PRD FR24]
3. **Given** the publish batch running (mock), **when** the checklist renders, **then** it is a node-by-node "N of M confirmed nodes generated" list, never a spinner, **and** it lives in an `aria-live="polite"` container announcing meaningful increments and terminal states, not a play-by-play. [Source: epics.md Story 3.4; UX-DR14]
4. **And** data access goes through a stable hook/service interface (`useCourseLifecycle()`) from the start, so Phase B swaps the mock implementation behind it without changing component code. [Source: epics.md Story 3.4]

## Tasks / Subtasks

- [x] Task 1: `useCourseLifecycle(courseId)` mock hook (AC: #1, #2, #3, #4)
  - [x] `FrontEnd/src/features/CourseContentEditor/useCourseLifecycle.ts` (new): `(courseId: string) => { state: LifecycleState, isPublishing: boolean, checklist: ChecklistRow[] | null, triggerReviewAsStudent: () => void, triggerConfirmReview: () => void, triggerPublish: () => void, retryFailedNode: (nodeId: string) => void }`. `LifecycleState = 'draft' | 'inReview' | 'reviewConfirmed' | 'published'` — **lowercase, mirroring this codebase's own established backend-PascalCase-to-frontend-lowercase translation convention** (Story 2.9's `useCourseContentTree.ts` does the identical translation for `NodeConfirmation`/`ContentBlockFormat`; the real backend `LifecycleState` enum values are `Published`/`Draft`/`InReview`/`ReviewConfirmed`, confirmed by direct read of `Domain/Courses/LifecycleState.cs` — note its real ordinal order is `Published=0` for an unrelated EF Core default-value workaround, irrelevant here since the wire format is the string name, not the ordinal). `isPublishing` is a **separate boolean, not a 5th `LifecycleState` value** — the real backend enum has no `Publishing` member (confirmed: it's explicitly a transient sub-state per the PRD Glossary, not persisted on `Course.LifecycleState` itself), so this hook's shape must not invent one either, or Story 3.8's real backend integration will have nowhere to source it from consistently.
  - [x] `ChecklistRow` type: `{ nodeId: string; nodeKind: 'chapter' | 'topic' | 'subtopic'; title: string; statusKind: 'done' | 'inProgress' | 'pending' | 'failed'; statusText: string }`. **`statusText` is free text, `statusKind` is the small fixed set driving icon/color** — deliberately separated so a real backend (Story 3.8) can produce arbitrary detail text (`"Generating Way 3 of 5…"`, `"Generation failed — served on-demand for now"`, per the mockup's own literal copy) without this hook's TypeScript shape needing to change. **`chapter` rows are structural/grouping headers only, never carry generation status** (Chapters are not adaptive-learning generation targets — Topic/Subtopic only, per PRD Glossary; a Chapter row exists in the checklist purely so the mockup's own Chapter→Topic→Subtopic visual grouping renders, not because a Chapter itself gets Drill-Down/Ways content generated for it). Only `topic`/`subtopic` rows count toward the "N of M" figure.
  - [x] The "N of M confirmed nodes generated" figure is **derived by the consuming component by counting `checklist` entries itself** (`topic`/`subtopic` rows where `statusKind === 'done'`, over the total count of `topic`/`subtopic` rows) — this hook does **not** expose a separate `{ done, total }` or `{ remaining, total }` counter pair. Deriving the count from the list itself (rather than a redundant parallel counter) sidesteps a real cross-story risk flagged during this epic's dependency analysis: Story 3.8's real backend tracks completion via an atomic `remaining`-counter-on-a-batch-row mechanism (AD-16) that counts *down*, not up — if this mock hook had instead exposed a `{ done, total }` pair, Story 3.8 would have to invert its own natural counting direction to match a UI contract decided here; deriving the figure from per-item status instead means Story 3.8 only ever has to report accurate per-item `statusKind`, nothing else.
  - [x] `triggerReviewAsStudent()`: only meaningful when every node is confirmed (mock: hardcode this precondition as satisfied in the fixture, or gate it — dev's choice, but the resulting `state` transition to `'inReview'` must be visible either way) — sets `state = 'inReview'`. `triggerConfirmReview()`: `'inReview' -> 'reviewConfirmed'`. `triggerPublish()`: only callable when `state === 'reviewConfirmed'`; sets `isPublishing = true` and seeds `checklist` with a mix of `pending`/`inProgress` rows, then a mock timer progressively flips rows to `done` (and exactly one to `failed`, so AC#3's failed-row UI is exercisable) until all `topic`/`subtopic` rows are terminal, at which point `isPublishing = false` and `state = 'published'`. `retryFailedNode(nodeId)` flips that one row from `failed` back to `done` (mock — real retry is Story 3.8's job).
- [x] Task 2: Sticky lifecycle stage indicator (AC: #1, #2)
  - [x] `FrontEnd/src/features/CourseContentEditor/PublishLifecycleBar.tsx` (new): `nav aria-label="Course publishing lifecycle"` per the mockup, 4 stages (Draft/In Review/Review Confirmed/Published) each rendered `.stage.done` (checkmark) for every stage before the current one, `.stage.current` with `aria-current="true"` on the active one — mirrors `mockups/key-publishing-state.html`'s exact structure. Mount this bar at the top of `CourseContentEditor.tsx` (the natural, minimal integration point for a tutor-facing lifecycle surface — this story does not otherwise restructure that file).
  - [x] Action buttons alongside the bar: "Review as Student" (calls `triggerReviewAsStudent`), "Confirm Review" (calls `triggerConfirmReview`, only enabled once `state === 'inReview'`), "Publish" (calls `triggerPublish`, **disabled at every `state` other than `'reviewConfirmed'`** — AC#2's literal requirement; a disabled `<button disabled>`, not a hidden one, so a tutor can see Publish exists but isn't available yet).
- [x] Task 3: Publishing banner + progress bar + checklist (AC: #3)
  - [x] Rendered only while `isPublishing`. Banner: `role="status" aria-live="polite"`, states the batch is running and safe to leave the tab open (mirrors the mockup's literal copy), plus the derived "N of M confirmed nodes generated" count pill (Task 1's derivation, computed here in the component, not the hook).
  - [x] Overall progress bar (`signal-green` fill) above the per-node checklist.
  - [x] Checklist rows: icon per `statusKind` (`done` -> check, `inProgress` -> spinner/ellipsis glyph, `pending` -> a plain dot, `failed` -> an alert glyph, all `signal-green`/`ink-navy`/neutral-gray/`error`-red respectively, matching the mockup's own color-per-kind scheme), `title`, `statusText`. A `failed` row additionally renders a "Retry" button (calls `retryFailedNode(nodeId)`) inline, matching the mockup's literal "Generation failed — served on-demand for now" + Retry button pattern (UX-DR15's fallback-serving rule, rendered literally in this mock UI even though there's no real fallback generation to actually serve yet).
  - [x] The whole checklist container carries `aria-live="polite"` (matches AC#3's explicit text) — **but this story does not need Epic 2's `CourseContentEditor.tsx` debounced-batching announcer mechanism** (400ms debounce / 2000ms max-wait / 10-message cap): that pattern exists there specifically because many files' statuses can change within milliseconds of each other during a real upload batch. This mock's own progression is a slower, one-row-at-a-time `setInterval`/`setTimeout` sequence (Task 1) with no realistic risk of the same flood — a plain `aria-live="polite"` region reacting to each state change is sufficient here; do not import unnecessary complexity from the Epic 2 precedent just because it exists.
- [x] Task 4: Frontend tests
  - [x] `FrontEnd/tests/features/CourseContentEditor/useCourseLifecycle.test.ts` (new): `triggerPublish()` only transitions state when starting from `reviewConfirmed`; the mock progression eventually reaches `isPublishing: false` / `state: 'published'`; `retryFailedNode` flips exactly the targeted row.
  - [x] `FrontEnd/tests/features/CourseContentEditor/PublishLifecycleBar.test.tsx` (new): Publish button is `disabled` at `draft`/`inReview` states, enabled only at `reviewConfirmed`; the active stage carries `aria-current="true"` and only one stage ever does; the checklist container has `aria-live="polite"`; a `failed` row renders a Retry button that, when clicked, updates that row's status.

## Dev Notes

- **This story resolves 3 cross-story design decisions up front, specifically to avoid Story 3.8 (the real backend) forcing a UI-contract rework later** — documented explicitly here since they were the subject of this epic's own pre-implementation dependency analysis: (1) checklist status is a free-text `statusText` + small fixed `statusKind`, not a tight status enum matching `Domain/Jobs/JobItemStatus.cs` (that enum's `Parsing`/`Extracting` vocabulary is extraction-specific and doesn't fit node-generation sub-status like "Generating Way 3 of 5"). (2) the "N of M" figure is derived from the checklist itself, not a separately-tracked `{done,total}`/`{remaining,total}` pair, so Story 3.8's `remaining`-counts-down atomic-batch-completion mechanism (AD-16) never has to be inverted to match this UI. (3) `isPublishing` is a separate boolean, never a 5th `LifecycleState` enum value, matching the real backend enum's actual shape.
- **Chapters appear in the checklist as grouping headers only, never as generation-tracked rows** — Topic/Subtopic are the only real FR17/18 generation targets (PRD Glossary). Getting this scope right here means Story 3.8's real checklist data only ever needs to supply Topic/Subtopic job status, with Chapter rows derived client-side purely for display grouping.
- **"Review as Student" in this story is a state-transition only** — it does not open a real (or even mock) student-view preview of the course. That's explicitly Story 3.9's job (the sanctioned `CourseContentEditor` -> `CoursePlayer` cross-feature import, AD-3). `[ASSUMPTION: a future enhancement could have this button open a preview reusing Stories 3.1-3.3's own mock components against the same course's mock content, which would make this story's own AC#1 more tangibly demonstrable in a live-stack check — not required by this story's literal AC text, which only asks for the visual state transition, so left as a nice-to-have rather than blocking scope.]`
- **Reduced-motion:** the checklist's incremental-fill animation (progress bar, row-status transitions) respects `prefers-reduced-motion: reduce`, per DESIGN.md's Accessibility Floor.

### Project Structure Notes

- Frontend new files: `FrontEnd/src/features/CourseContentEditor/{useCourseLifecycle.ts, PublishLifecycleBar.tsx}`, both new test files from Task 4.
- Frontend modified files: `FrontEnd/src/features/CourseContentEditor/CourseContentEditor.tsx` (mounting `PublishLifecycleBar` at the top of the existing editor surface).

### References

- [Source: _specs/planning-artifacts/epics.md — Story 3.4 (lines 640-661)]
- [Source: _specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md — FR21 §4.10 (async publish batch, per-node fallback on failure, exact "Publishing sub-state" framing), FR23 §4.11 (Review as Student, all nodes confirmed precondition), FR24 §4.11 (Review Confirmed gates Publish)]
- [Source: _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/ — UX-DR14 (checklist not spinner, aria-live="polite", survives tab-close framing), UX-DR15 (failed node falls back to on-demand, Admin-visible only), `mockups/key-publishing-state.html` (sticky lifecycle nav with `.stage.done`/`.stage.current`, publishing banner `role="status" aria-live="polite"`, progress bar, per-row Chapter/Topic/Subtopic granularity, failed-row Retry button, exact literal copy for banner/footer text)]
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md — AD-15/AD-16 (Hangfire batch execution, atomic `remaining`-counter batch completion — the real mechanism this story's derived-from-checklist "N of M" arithmetic is designed to compose cleanly with), AD-20 (content-tree entities, confirmation scope)]
- [Source: BackEnd/src/FlexDemy.Domain/Courses/LifecycleState.cs — read directly this session; confirmed real enum values `Published`/`Draft`/`InReview`/`ReviewConfirmed`, `Published` at ordinal 0 as an unrelated EF Core workaround, no `Publishing` member stored anywhere]
- [Source: FrontEnd/src/features/CourseContentEditor/{useCourseContentTree.ts, CourseContentEditor.tsx} — Epic 2's established PascalCase-to-lowercase wire-translation convention this story's `LifecycleState` mirrors; the debounced aria-live announcer pattern this story deliberately does NOT reuse wholesale, with reasoning]

## Previous Story Intelligence

Stories 3.1-3.3 (this same epic, `ready-for-dev`, not yet implemented):

- **Same real Topic/Subtopic node-id convention** — this story's checklist mock fixture should use the identical node ids Stories 3.1-3.3's fixtures already define, so a live-stack check can show one course's nodes carrying Drill-Down + Ways + Exercise + a checklist row all pointing at the same data.
- **This epic has already found and corrected 3 real discrepancies between its own shared research and the actual code** (Story 3.1: content-tree data-model gap; 3.2: keyword-affordance research error; 3.3: SidePanel-vs-inline Quiz runner). This story's own 3 up-front cross-story design decisions (checklist status shape, N-of-M arithmetic direction, `isPublishing` as a separate boolean) are this story's version of the same discipline, applied proactively rather than reactively — continue verifying rather than assuming through implementation.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npx tsc --noEmit` clean after every task and after the code-review patch (only pre-existing, unrelated `FlashcardsModal.tsx` errors remain, confirmed to predate this story).
- Full frontend regression: `npx vitest run` → 76 files / 497 tests passing (483 pre-existing after Story 3.3 + 14 new from this story; 0 failures, 0 regressions).

### Completion Notes List

- Task 1: `useCourseLifecycle(courseId)` mock hook in `useCourseContentTree.ts`'s own feature folder. Accepts `courseId: string | null` (not `string`) to match `CourseContentEditor.tsx`'s existing `draftId`-may-be-null convention (`useCourseContentTree.ts` does the same) — every trigger is a no-op while null, deviating slightly from the story's literal `(courseId: string)` note but matching the real call site's actual prop shape. `isPublishing` kept as a separate boolean, never a 5th `LifecycleState` value, matching the real backend enum's actual shape (confirmed via direct read of `LifecycleState.cs`). The "N of M" figure is derived by the component from `checklist` itself, not a separate counter pair. Mock progression deliberately fails a MIDDLE row (`subtopic_1`, not the last generatable one) so the checklist and its Retry button stay visibly on-screen for several more ticks after the failure, rather than the failure coinciding with the batch's own completion (which would hide the checklist — Task 3's own "rendered only while isPublishing" rule — before a tutor could ever see or click Retry).
- Task 2+3: `PublishLifecycleBar.tsx` built as one cohesive component per the mockup's own single sticky-header block structure (Project Structure Notes list only this one new component file alongside the hook) — sticky 4-stage nav with `aria-current="true"` on exactly one stage, three action buttons (Publish `disabled` at every state but `reviewConfirmed`, per AC#2), and — while `isPublishing` — a `role="status" aria-live="polite"` banner with the derived N-of-M count, a progress bar, and a node-by-node checklist (its own `aria-live="polite"` region, deliberately NOT reusing Epic 2's debounced-batching announcer, per the story's own Dev Notes reasoning). Chapter rows render as plain grouping-header text, never as generation-tracked checklist rows. Mounted at the top of `CourseContentEditor.tsx`'s existing surface, the file's only other change.
- Task 4: added `useCourseLifecycle.test.ts` (6 tests: initial state, draft→inReview→reviewConfirmed transitions, `triggerPublish()` no-op outside `reviewConfirmed`, full mock progression reaching `published`/`isPublishing: false` with exactly one failed row, `retryFailedNode` flips only the targeted row, no-op while `courseId` is null) and `PublishLifecycleBar.test.tsx` (5 tests: Publish disabled/enabled per state, exactly one `aria-current` stage that advances, `aria-live="polite"` present while publishing, Retry button updates its row and then disappears, checklist renders real node titles rather than a spinner).

### File List

- `FrontEnd/src/features/CourseContentEditor/useCourseLifecycle.ts` (new)
- `FrontEnd/src/features/CourseContentEditor/PublishLifecycleBar.tsx` (new)
- `FrontEnd/src/features/CourseContentEditor/CourseContentEditor.tsx` (modified)
- `FrontEnd/tests/features/CourseContentEditor/useCourseLifecycle.test.ts` (new)
- `FrontEnd/tests/features/CourseContentEditor/PublishLifecycleBar.test.tsx` (new)
- `FrontEnd/tests/features/CourseContentEditor/CourseContentEditor.test.tsx` (modified — added a draftId-switch regression test for the code-review patch)

## Senior Developer Review (AI)

**Date:** 2026-08-13
**Outcome:** Approved after patch
**Method:** `bmad-code-review` — parallel adversarial review (Blind Hunter, Acceptance Auditor)

**Acceptance Criteria audit (Acceptance Auditor):** All 4 ACs verified PASS, plus all 3 documented cross-story design decisions confirmed to hold in the actual code: lowercase `LifecycleState`, `isPublishing` as a separate boolean (cross-checked against the real `LifecycleState.cs` enum, no `Publishing` member), and the "N of M" figure derived by `PublishLifecycleBar.tsx` from the checklist itself, never a hook-exposed counter pair. No unchecked subtasks misrepresent completed work; the one documented `courseId: string | null` signature deviation is disclosed with justification.

**Action Items:**

- [x] **[High]** `useCourseLifecycle` had no effect resetting its state when `courseId` changed, and `<PublishLifecycleBar>` was mounted in `CourseContentEditor.tsx` without a `key` prop — unlike `useCourseContentTree.ts`'s own established `useEffect(..., [courseId])` convention for the identical `draftId`-may-change-while-mounted scenario. Repro: advance draft A to `inReview` (or further, including mid-publish-batch), then switch `draftId` to draft B while the editor stays open — draft B's header showed draft A's stale/in-progress lifecycle state instead of a fresh `draft` state. Found by the Blind Hunter pass. **Fix:** added `key={draftId}` to the `<PublishLifecycleBar>` render, forcing a clean remount per draft — the same fix pattern used for `DrilldownPanel` (Story 3.1) and `ExerciseRunner` (Story 3.3). Added a regression test (`CourseContentEditor.test.tsx`: "resets the publishing lifecycle state (Story 3.4) when draftId changes to a different draft").
- [x] **[High]** The Publish button's `disabled` condition only checked `state !== 'reviewConfirmed'`, but `state` itself stays `'reviewConfirmed'` for the *entire* publishing duration (it only flips to `'published'` once the batch finishes) — `isPublishing` is a separate flag the button never consulted. Repro: click Publish, then click it again (double-click, or a deliberate re-click) before the batch completes — `triggerPublish`'s own guard also only checked `state`, so the re-trigger silently re-seeded the checklist from scratch, discarding all progress already made (including any row a tutor had just retried), with the N-of-M counter and progress bar visibly jumping backward. Found by the Blind Hunter pass. **Fix:** added `isPublishing` to both the button's `disabled` condition (`PublishLifecycleBar.tsx`) and `triggerPublish`'s own internal guard (`useCourseLifecycle.ts`, belt-and-suspenders against any future caller that bypasses the button). Added regression tests in both `useCourseLifecycle.test.ts` ("triggerPublish() is a no-op while a batch is already in progress...", asserting referential equality of `checklist` across the re-trigger) and `PublishLifecycleBar.test.tsx` ("disables Publish once a batch is running...").

Full regression suite (497 tests) and `tsc --noEmit` re-verified clean after both patches.

## Change Log

- 2026-08-12: Story created via `bmad-create-story` — fourth of Epic 3's 11 stories, written as part of the full-epic write-then-implement batch. Closes Epic 3's Phase A (mock UI, Stories 3.1-3.4) — Phase B (3.5-3.11, real backend/live-wiring) begins next. Status set to `ready-for-dev`.
- 2026-08-13: All 4 tasks implemented via `bmad-dev-story`. `useCourseLifecycle` mock hook (lowercase `LifecycleState`, `isPublishing` as a separate boolean, N-of-M derived from the checklist itself — all 3 cross-story design decisions from this epic's dependency analysis applied as specified) and `PublishLifecycleBar.tsx` (stage nav + action buttons + publishing banner/progress/checklist), mounted at the top of `CourseContentEditor.tsx`. 11 new frontend tests added across 2 files. Full regression 76 files / 494 tests passing, 0 regressions; `tsc --noEmit` clean. Status set to `review`, ready for code-review cycle. This closes Epic 3's Phase A.
- 2026-08-13: `bmad-code-review` (Blind Hunter/Acceptance Auditor) found two High-severity real bugs — lifecycle state leaking across draft switches (missing `key` prop, same class of bug as Stories 3.1/3.3) and a Publish-button re-trigger mid-batch that silently discarded checklist progress. Both patched with regression tests. All 4 ACs and all 3 cross-story design decisions independently verified PASS. Full regression re-run: 76 files / 497 tests passing, `tsc --noEmit` clean. Status set to `done` — Epic 3's Phase A is complete.
