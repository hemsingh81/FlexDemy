---
baseline_commit: e64e8b260d54a2ac01680d582cacc80de715e147
---

# Story 3.3: Exercise Runner UI (Mock Data)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a student,
I want inline practice exercises with immediate feedback, against mock exercise data,
so that this UX can be validated before real generation/grading exists.

## Acceptance Criteria

1. **Given** a node with a mock exercise, **when** rendered, **then** it expands inline, reusing the existing Quiz runner's "expands in place" idiom, **and** numeric/math answers are captured as plain keyboard text entry, not a mouse-only visual equation editor. [Source: epics.md Story 3.3; UX-DR12]
2. **Given** a node with no attached exercise, **when** rendered, **then** it shows no practice affordance at all — not a disabled or empty state. [Source: epics.md Story 3.3]
3. **And** data access goes through a stable hook/service interface (`useExercise()`) from the start, so Phase B swaps the mock implementation behind it without changing component code. [Source: epics.md Story 3.3]

## Tasks / Subtasks

- [x] Task 1: `useExercise(courseId, nodeId)` mock hook (AC: #2, #3)
  - [x] `FrontEnd/src/features/CoursePlayer/useExercise.ts` (new): `(courseId: string, nodeId: string) => { exercise: Exercise | null, isLoading: boolean, error: string | null, submission: SubmissionResult | null, submit: (answer: string) => void, reset: () => void }`. Same real Topic/Subtopic `nodeId` as Stories 3.1/3.2. `exercise: null` (not a loading/error state) is the expected, common case — most nodes have no attached exercise (FR19's "optional"), and AC#2's "no affordance at all" depends on this hook correctly distinguishing "no exercise attached" from "still loading."
  - [x] `Exercise` type (new, `FrontEnd/src/types.ts` or co-located in the hook file — confirm during dev which fits this codebase's existing convention better for a CoursePlayer-only type): `{ id: string; questionText: string; answerType: 'multipleChoice' | 'numeric' | 'shortText'; options?: string[]; feedback: string; isAiProposed: boolean }`. No `correctAnswer` field exposed to the client type — mock grading (Task 1's `submit`) still needs *a* reference answer to compare against, but keep it out of the public `Exercise` shape returned to the component (a real backend, Story 3.6, would never send the answer key to the browser either — matching that constraint now avoids a breaking type change later, even though today's `submit` is mock/client-side).
  - [x] `submit(answer)` is a **mock** evaluator only — string equality (case-insensitive, trimmed) for `shortText`/`multipleChoice`, a loose numeric-equality check (parse both sides as float, compare within a small epsilon) for `numeric`. Sets `submission: { isCorrect: boolean, feedbackText: string }` (feedback always shown regardless of correctness — FR19's "immediate feedback and worked solution on completion" applies either way, not just on success). `[ASSUMPTION: real grading logic (subject-aware, tolerant of equivalent-but-differently-formatted math answers, etc.) is explicitly Story 3.6's job per epics.md — this mock evaluator only needs to be correct enough to demonstrate the UI states (correct/incorrect/feedback-shown), not pedagogically sound.]`
  - [x] Mock data: at least 3 node ids covering all 3 `answerType` values (one `multipleChoice` with 3-4 `options`, one `numeric`, one `shortText`), plus confirm at least one node id used by Stories 3.1/3.2's own fixtures has **no** exercise (`exercise: null`) so AC#2 is exercisable on a node that also has real Drill-Down/Ways content.
- [x] Task 2: `ExerciseRunner.tsx` — genuinely inline, not the existing SidePanel-based Quiz runner (AC: #1)
  - [x] **Corrected during this story's own research, not silently propagated:** epics.md/DESIGN.md both describe this as reusing "the existing Quiz runner's 'expands in place' idiom." Direct read of the only actual quiz UI in this codebase (`AssignmentQuizRunner` in `FrontEnd/src/features/Dashboard/StudentAssignmentsSection.tsx`) confirms it renders inside a `<SidePanel>` (a slide-in blade), not a true same-page inline expansion — despite EXPERIENCE.md's own Component Patterns table describing it as "Inline expansion below the Available list, not a modal." **This story builds `ExerciseRunner` as a genuinely inline expansion** (matching the *stated design intent*, which both this story's own AC#1 text and DESIGN.md agree on), not a literal reuse of the SidePanel-based `AssignmentQuizRunner` component — the "idiom" being reused is the interaction pattern (expands in place, no modal/blade), not that specific component. Do not import or wrap `AssignmentQuizRunner`/`SidePanel` for this feature.
  - [x] `FrontEnd/src/features/CoursePlayer/ExerciseRunner.tsx` (new): renders inline within the reading pane immediately after a Topic/Subtopic's content, using the `exercise-runner` DESIGN.md token (background `#FAF7EC` parchment, border `1px solid #E1DED4`, `rounded.lg` = 1rem, `padding: 1.25rem`). Footer text states practice-only framing explicitly (mirrors `mockups/key-course-player-adaptive.html`'s literal copy: "Immediate feedback, no page reload — practice only, not graded.").
  - [x] Per-`answerType` input: `multipleChoice` — `<label>`-wrapped radio inputs, one per `options` entry (mirrors the mockup); `shortText` — a plain `<input type="text">`; `numeric` — also a plain `<input type="text">` (not `type="number"`, and never a visual equation-editor widget — AC#1's explicit "plain keyboard text entry" rule covers LaTeX-like or plain-number input either way, per this story's own Dev Notes on why `type="text"` not `type="number"`).
  - [x] On submit: call `useExercise`'s `submit(answer)`, then render the returned feedback/worked-solution inline (no page reload, no modal) — correct answers get a `signal-green`-toned confirmation, incorrect get a neutral (not `error`-red-alarming) "Here's the worked solution" framing, matching this feature's own "practice only, not graded" positioning (an incorrect practice answer is not a failure state deserving error styling).
- [x] Task 3: No-exercise = no affordance at all (AC: #2)
  - [x] The reading pane's per-node rendering (from Story 3.1) conditionally renders `<ExerciseRunner>` only when `useExercise(...).exercise` is non-null and not loading — no placeholder, no disabled button, nothing rendered at all otherwise (matches DESIGN.md's "Empty — no exercise attached" State Pattern entry: "fully invisible, not disabled").
- [x] Task 4: Frontend tests
  - [x] `FrontEnd/tests/features/CoursePlayer/useExercise.test.ts` (new): a node with no fixture entry resolves `exercise: null` without an error state; `submit()` produces correct `isCorrect`/feedback for each of the 3 `answerType` mock-evaluation paths, including a case-insensitive/whitespace-trimmed `shortText` match and a numeric-tolerance `numeric` match (e.g. `"3.0"` matches a reference of `"3"`).
  - [x] `FrontEnd/tests/features/CoursePlayer/ExerciseRunner.test.tsx` (new): renders inline (assert it is NOT inside/using a `SidePanel` — e.g. assert no `role="dialog"`/portal-mounted container is involved, confirming the corrected design choice from Task 2 actually held); each `answerType` renders its own correct input control; submitting shows feedback without unmounting the question; a node with no exercise renders nothing from this component at all (assert `queryByTestId`/equivalent returns null, not a hidden/disabled element).

## Dev Notes

- **The SidePanel-vs-inline discrepancy is this story's single most important correction** — implement the genuinely inline version described in Task 2, not a literal reuse of `AssignmentQuizRunner`. If a future reviewer questions why this doesn't import the "existing Quiz runner," point to this Dev Notes entry and the direct-read evidence above.
- **`numeric` answers use `type="text"`, not `type="number"`:** a native `<input type="number">` blocks entering LaTeX-like expressions or fractions a student might reasonably type (`1/2`, `\frac{1}{2}`), and mobile numeric keyboards can be more restrictive than intended for a "plain keyboard text entry" requirement that's about avoiding a *visual equation editor*, not about restricting to digits only.
- **Reduced-motion:** the exercise's inline expand/collapse (if animated at all) respects `prefers-reduced-motion: reduce`, matching every other Epic 3 surface's accessibility floor.
- **Design token** (exact values, DESIGN.md): `exercise-runner` — background `#FAF7EC`, border `1px solid #E1DED4`, `rounded: 1rem`, `padding: 1.25rem`.

### Project Structure Notes

- Frontend new files: `FrontEnd/src/features/CoursePlayer/{useExercise.ts, ExerciseRunner.tsx}`, both new test files from Task 4.
- Frontend modified files: `FrontEnd/src/features/CoursePlayer/CoursePlayer.tsx` (wiring `ExerciseRunner` into the Story 3.1 reading pane, per node).

### References

- [Source: _specs/planning-artifacts/epics.md — Story 3.3 (lines 621-638)]
- [Source: _specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md — FR19 §4.8 (optional per-node exercises, self-authored or AI-proposed, subject-appropriate answer types, immediate feedback/worked solution; auto-grading beyond this is an open question, §8 Q1)]
- [Source: _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/ — UX-DR12 (inline, reuses Quiz runner's "expands in place" idiom, numeric/math is plain keyboard text entry not a mouse-only equation editor), DESIGN.md's `exercise-runner` token, EXPERIENCE.md's Exercise Runner Component Pattern + "Empty — no exercise attached" State Pattern ("fully invisible, not disabled"), `mockups/key-course-player-adaptive.html` (parchment background, MC options as `<label>`-wrapped radios, explicit "practice only, not graded" footer copy)]
- [Source: FrontEnd/src/features/Dashboard/StudentAssignmentsSection.tsx — read directly this session; confirmed `AssignmentQuizRunner` renders inside `<SidePanel>` (line 313), not a true inline expansion, despite being described as the "expands in place" precedent — the discrepancy this story's Task 2 explicitly resolves]

## Previous Story Intelligence

Stories 3.1/3.2 (this same epic, `ready-for-dev`, not yet implemented):

- **Same `(courseId, nodeId)` hook signature convention, same real Topic/Subtopic ids from Story 3.1's mock fixture** — reuse those node ids rather than inventing new ones, so a single mock node can be tested end-to-end with Drill-Down + Ways + Exercise all present.
- **Both prior stories in this epic found and corrected a research-pass error by reading the real source file directly** (Story 3.1: the content-tree data-model gap; Story 3.2: `handleAskLevelLLM` wrongly flagged as a keyword-affordance stand-in). This story's own correction (the SidePanel-vs-inline Quiz runner discrepancy) continues that same pattern — verify claims in this epic's shared research against real files before implementing, every time, not just when something looks suspicious.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npx tsc --noEmit` clean after every task and after the code-review patch (only pre-existing, unrelated `FlashcardsModal.tsx` errors remain, confirmed to predate this story).
- Full frontend regression: `npx vitest run` → 74 files / 483 tests passing (467 pre-existing after Story 3.2 + 16 new from this story; 0 failures, 0 regressions).

### Completion Notes List

- Task 1: `useExercise(courseId, nodeId)` mock hook + co-located `Exercise`/`SubmissionResult` types in `useExercise.ts` (matching Story 3.2's `useWays.ts`/`WayData` co-location convention). `Exercise` deliberately has no `correctAnswer` field on its public shape — the mock evaluator holds the reference answer in an internal `MOCK_EXERCISES` fixture entry never exposed to the returned `exercise` object, matching the constraint a real backend (Story 3.6) would also have to follow. Mock fixture covers `subtopic_1` (numeric), `subtopic_2` (multipleChoice, 4 options), `topic_1` (shortText); `topic_2` (which already carries Drill-Down + Ways content from Stories 3.1/3.2) deliberately has no exercise entry, so AC#2 is exercisable on a node with other real content present.
- Task 2: `ExerciseRunner.tsx` built as a genuinely inline expansion (confirmed via this story's own research correction: `AssignmentQuizRunner` renders inside a `<SidePanel>`, not truly inline — not reused). Matches the `exercise-runner` DESIGN.md token and the mockup's literal footer copy ("Immediate feedback, no page reload — practice only, not graded."). `numeric` and `shortText` both use `<input type="text">`, never `type="number"` or a visual equation editor. Correct submissions get `signal-green`-toned styling; incorrect submissions get neutral "Here's the worked solution" framing, not error/red styling, matching the practice-only positioning.
- Task 3: wired into `CoursePlayer.tsx`'s reading pane, rendered after a selected node's `ContentBlock`s. Returns `null` (nothing rendered) whenever `isLoading` or `exercise` is null — the common case, matching FR19's "optional" framing and DESIGN.md's "fully invisible, not disabled" Empty State Pattern.
- Task 4: added `useExercise.test.ts` (6 tests: no-fixture-entry → null without error, numeric tolerance grading, incorrect-still-returns-feedback, multipleChoice/shortText case-insensitive trimmed matching, `reset()` clears submission) and `ExerciseRunner.test.tsx` (8 tests: no `role="dialog"` present confirming genuine inline rendering, per-`answerType` input control, feedback shown without unmounting the question, worked-solution framing for incorrect answers, no-exercise renders nothing via `data-testid`, submit button disabled until an answer is entered).

### File List

- `FrontEnd/src/features/CoursePlayer/useExercise.ts` (new)
- `FrontEnd/src/features/CoursePlayer/ExerciseRunner.tsx` (new)
- `FrontEnd/src/features/CoursePlayer/CoursePlayer.tsx` (modified)
- `FrontEnd/tests/features/CoursePlayer/useExercise.test.ts` (new)
- `FrontEnd/tests/features/CoursePlayer/ExerciseRunner.test.tsx` (new)

## Senior Developer Review (AI)

**Date:** 2026-08-13
**Outcome:** Approved after patch
**Method:** `bmad-code-review` — parallel adversarial review (Blind Hunter, Acceptance Auditor)

**Acceptance Criteria audit (Acceptance Auditor):** All 3 ACs verified PASS: `ExerciseRunner.tsx` has zero import of `SidePanel`/`AssignmentQuizRunner`/any portal API (only comment-text references documenting the correction), renders as a plain inline `<div>` in the reading pane's JSX tree, and both `numeric`/`shortText` use the same `<input type="text">` — never `type="number"` or a widget editor (AC1). No-exercise nodes render a true `null`, not a hidden/disabled element, confirmed via a test that waits past the mock fetch delay (AC2). `ExerciseRunner` only imports and calls `useExercise`, never reaches into mock data directly (AC3). No unchecked subtasks misrepresent completed work.

**Action Items:**

- [x] **[High]** `<ExerciseRunner>` was rendered in `CoursePlayer.tsx` without a `key` prop, unlike `DrilldownPanel`'s own established convention (fixed in Story 3.1's own review). Since it's the same component instance at the same JSX position across a node switch, only `useExercise`'s internal `submission` state reset on `nodeId` change — the component's own local `answer` text/radio-selection state did not. Repro: type a numeric answer into Subtopic 1's exercise without submitting, switch to Subtopic 2 (a `multipleChoice` exercise) — the stale `answer` value left the Submit button enabled with no option actually selected, letting the student submit an answer they never gave for the new question, and (in the reverse direction) pre-filling a stale MC option's full sentence into a numeric/shortText input the student never typed. Found by the Blind Hunter pass. **Fix:** added `key={selectedContentNode.id}` to the `<ExerciseRunner>` render, forcing a clean remount per node — the same fix pattern used for `DrilldownPanel` in Story 3.1. Added a regression test (`CoursePlayer.test.tsx`: "does not carry a stale typed/selected exercise answer across a switch to a different node").
- [x] **[Medium]** `useExercise.ts`'s numeric grading used `Number.parseFloat`, which parses only a leading numeric prefix and silently ignores trailing garbage — `"3xyz"`, `"3 meters"`, and `"3,"` all parsed to `3` and would false-positive-match a reference answer of `"3"`. Found by the Blind Hunter pass, matching an edge case the story's own Task 4 description explicitly called out for review. **Fix:** replaced with a `parseStrictNumber` helper using `Number()` (which requires the whole trimmed string to be numeric) instead of `Number.parseFloat`, explicitly guarding the empty-string case (`Number("") === 0`, not `NaN`). Added a regression test covering `"3xyz"`, `"3 meters"`, and `""` all correctly grading as incorrect against a `"3"` reference.

Full regression suite (483 tests) and `tsc --noEmit` re-verified clean after both patches.

## Change Log

- 2026-08-12: Story created via `bmad-create-story` — third of Epic 3's 11 stories, written as part of the full-epic write-then-implement batch. Status set to `ready-for-dev`.
- 2026-08-13: All 4 tasks implemented via `bmad-dev-story`. `useExercise` mock hook with a client-side mock grading evaluator, `ExerciseRunner.tsx` built as a genuinely inline expansion (correcting a research-pass discrepancy about the existing Quiz runner being SidePanel-based, not inline), wired into `CoursePlayer.tsx`'s reading pane with "nothing rendered when no exercise" behavior. 14 new frontend tests added across 2 files. Full regression 74 files / 481 tests passing, 0 regressions; `tsc --noEmit` clean. Status set to `review`, ready for code-review cycle.
- 2026-08-13: `bmad-code-review` (Blind Hunter/Acceptance Auditor) found two real bugs — a stale exercise-answer state leak across node navigation (missing `key` prop, same class of bug as Story 3.1's `DrilldownPanel` fix) and a numeric-grading false-positive from `parseFloat`'s trailing-garbage tolerance. Both patched with regression tests. All 3 ACs independently verified PASS. Full regression re-run: 74 files / 483 tests passing, `tsc --noEmit` clean. Status set to `done`.
