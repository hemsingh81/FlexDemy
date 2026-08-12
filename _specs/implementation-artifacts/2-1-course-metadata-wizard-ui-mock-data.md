---
baseline_commit: e64e8b260d54a2ac01680d582cacc80de715e147
---

# Story 2.1: Course Metadata Wizard UI (Mock Data)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tutor,
I want to set Course Title, Tags, Taxonomy, and Thumbnails through a 4-step wizard against mock tag/taxonomy data,
so that the flow can be validated before backend wiring exists (Stories 2.4/2.5 wire this to real data).

## Acceptance Criteria

1. The wizard renders as a 4-step flow — **Title & Description → Tags → Taxonomy → Thumbnails** — reusing the existing side-panel/blade shell (`SidePanel`, `width="lg"`) and the "Step N of 4" subtitle discipline already used by the old wizard, narrowed to just these 4 steps (no Lesson Builder / Review & Publish steps — those belong to the old wizard being superseded). [Source: epics.md Story 2.1; UX-DR1; EXPERIENCE.md "New Course Wizard (metadata)" row]
2. "Next" stays disabled whenever the current step's required field(s) are unset: Step 1 requires a trimmed, non-empty Course Title within a 120-character max (`[ASSUMPTION: PRD FR-6 doesn't specify an exact limit, recommends 120 — prd.md line 558]`); Description is optional. Step 3 requires Country, Board, Class Level, and Subject at minimum, with State/City required-ness read per-selected-Board from mock taxonomy data, never hardcoded. [Source: epics.md Story 2.1 AC#1; FR6; FR8]
3. Step 2 (Tags) renders `TypeaheadMultiSelect` (`FrontEnd/src/ui/TypeaheadMultiSelect.tsx`) populated from mock tag data — searchable type-ahead multi-select, no free-text entry. A mock tag flagged inactive but already attached to the draft renders as a visually distinct, non-removable/non-reselectable chip — never silently identical to an active, freely-removable chip. [Source: FR7; UX-DR2; EXPERIENCE.md row 75]
4. Step 3 (Taxonomy) renders 6 cascading dropdowns — Country → State → City → Board → Class Level → Subject — against mock data shaped exactly like `masterDataService.ts`'s real entities (`Country`, `State`, `City`, `Board`, `ClassLevel`, `Subject`). Each child is disabled until its parent has a selection (State/City include an explicit "National / Not Applicable" option so Board stays reachable without a specific State/City pick — see Dev Notes); changing a parent resets its now-stale descendants, mirroring `MasterDataManager.tsx`'s existing cascade-and-reset pattern. [Source: FR8; UX-DR3]
5. Step 4 (Thumbnails) accepts up to 3 images with an in-step crop tool enforcing a fixed 16:9 aspect ratio (`[ASSUMPTION: EXPERIENCE.md row 75 — 16:9 per the PRD's own recommendation]`) before an image is accepted; a 4th upload attempt is rejected inline with a clear "maximum 3 thumbnails" message, never a silent failure. Reorder, delete, and set-primary are button-based controls, not drag (drag is reserved for the Adaptive Schedule planner and Course Content Editor's tree — no other drag surface exists in this product). [Source: FR9; UX-DR4; EXPERIENCE.md "Interaction Primitives"]
6. The Thumbnails crop tool is keyboard-operable: crop position/size adjust via arrow-key nudges in fixed steps (default: 1% of crop width per arrow-key press — pick a different value only if it demonstrably feels wrong in manual testing), or an equivalent numeric x/y/zoom input alternative — never drag-only. The fixed-aspect-ratio constraint is announced to assistive tech so a keyboard user understands why free resize isn't offered. [Source: UX-DR4; EXPERIENCE.md Accessibility Floor "Thumbnail crop tool"]
7. All 4 steps' field values auto-persist to local mock state after every change — no network call is made anywhere in this story. [Source: epics.md Story 2.1 AC; FR10]
8. Data access goes through a stable hook (`useCourseDraft()`), never inline `useState`/mock-array manipulation directly in step components, so Stories 2.4/2.5 can swap the hook's internals from mock state to real `coursesService.ts`/`tagsService.ts`/`masterDataService.ts` calls without changing any step component's code. [Source: epics.md Story 2.1 "Parallelization note" + hook-boundary AC; AD-1]
9. The Dashboard's existing "New Course Wizard" trigger (`TutorEducatorHubView.tsx`'s `#course-publishing` section button) now opens this new wizard. The old inline 4-step wizard's state and JSX (`isWizardOpen`, `wizardStep`, and the `SidePanel` block rendering it) stay in the file, untouched and simply unreachable via this trigger — physically removing that code is Story 2.4's job per its own AC, not this story's. [Source: epics.md Story 2.4 AC "the old 4-step Course Creation Wizard ... is removed, not left running alongside the new wizard" (tied explicitly to Story 2.4 shipping); see Dev Notes for why this story does NOT delete it despite ARCHITECTURE-SPINE.md's Structural Seed note reading more broadly]
10. Completing Step 4 signals wizard completion via an `onComplete` callback rather than opening a 5th blade step or navigating anywhere. Course Content Editor (the real destination per UX) doesn't exist until Story 2.3, so this story's "done" state is "wizard reports completion," not a real screen transition. [Source: EXPERIENCE.md row 75 "Completing Step 4 opens Course Content Editor, not a 5th blade step"; scope boundary — see Dev Notes]

## Tasks / Subtasks

- [x] Task 1: New feature entry point & Dashboard trigger rewiring (AC: #1, #9)
  - [x] Create `FrontEnd/src/features/CourseWizard/` (new folder, per ARCHITECTURE-SPINE.md's Structural Seed).
  - [x] Create `CourseWizard.tsx` — top component, renders inside `SidePanel` (`width="lg"`, `subtitle={\`Step ${step} of 4\`}`, `closeOnBackdropClick={false}`, matching the old wizard's shell usage), owns step state (`1 | 2 | 3 | 4`), renders a 4-cell step-progress bar relabeled for this wizard's steps (Title & Description / Tags / Taxonomy / Thumbnails), and a footer with Back/Next (Next disabled per AC#2) and a final-step "Finish"/"Create Course" action calling `onComplete`.
  - [x] In `FrontEnd/src/features/Dashboard/TutorEducatorHubView.tsx`: add new local state to open/close the new wizard (e.g. `isNewCourseWizardOpen`), separate from the existing `isWizardOpen`/`wizardStep`. Rewire the `#course-publishing` button's `onClick` (currently `setWizardStep(1); setIsWizardOpen(true);`, ~line 412-421) to open the new wizard instead. **Do not** remove `isWizardOpen`, `wizardStep`, or the old wizard's `SidePanel` JSX (~lines 636-793) or its footer/handlers — they stay dead-but-present until Story 2.4.
  - [x] Render `<CourseWizard isOpen={isNewCourseWizardOpen} onClose={...} onComplete={...} />` from `TutorEducatorHubView.tsx`.

- [x] Task 2: Mock data + hook (AC: #7, #8)
  - [x] Create `FrontEnd/src/features/CourseWizard/useCourseDraft.ts` — feature-local hook (AD-2). Exposes `{ data, isLoading, error }` plus mutators (`updateTitle`, `updateDescription`, `toggleTag`, `updateTaxonomy`, `addThumbnail`, `removeThumbnail`, `reorderThumbnail`, `setPrimaryThumbnail`), matching AD-1's standard hook shape even though it's backed by local mock state, not a service call, in this story. Field names should anticipate Story 2.4's real Draft/Course entity (`title`, `description`, `tagIds`, `countryId`/`stateId`/`cityId`/`boardId`/`classLevelId`/`subjectId`, `thumbnails: { url, isPrimary, order }[]`) — don't invent names 2.4/2.5 will have to rename.
  - [x] Mock tag fixture: a small array mirroring the real `Tag` shape (`id`, `name`, `isActive`) from `TagManagement`/`tagsService.ts` — include at least one `isActive: false` tag pre-attached to the mock draft, to exercise AC#3's locked-chip case.
  - [x] Mock taxonomy fixture: small arrays shaped exactly like `masterDataService.ts`'s `Country`/`State`/`City`/`Board`/`ClassLevel`/`Subject` interfaces — include at least one national board (`stateId: null`) and one state-scoped board, so AC#4's per-board State/City required-ness has both cases to exercise.

- [x] Task 3: Step 1 — Title & Description (AC: #1, #2)
  - [x] Single-line Course Title input: trim on validation, non-empty required, 120-char max enforced client-side (`maxLength` + validity check, not just the HTML attribute).
  - [x] Optional multi-line description/subtitle field, no length gate on Next.
  - [x] Next disabled while title is empty/whitespace-only or exceeds 120 chars.

- [x] Task 4: Step 2 — Tags (AC: #3)
  - [x] Render active mock tags via `TypeaheadMultiSelect`, wired to `toggleTag`.
  - [x] Add locked-chip rendering for inactive-but-attached tags. Extend `TypeaheadMultiSelect` generically with an optional `lockedValues?: TypeaheadOption[]` prop — **full `{value, label}` objects, not bare ids**: `selectedOptions` today is derived by looking up `selected` ids inside `options`, and the inactive tag is deliberately excluded from `options` (it must not be re-selectable), so its label can't be resolved by id alone. Render `lockedValues` as additional chips alongside `selectedOptions`, without a remove control, visually distinct. Prefer this over forking the component into a feature-local copy — it's already reused by `MasterDataManager.tsx`, so keep it a single shared primitive per AD-3, and keep the new prop domain-agnostic ("locked", not "tag" or "deactivated").

- [x] Task 5: Step 3 — Taxonomy (AC: #2, #4)
  - [x] 6 cascading `<select>` elements — Country → State → City → Board → Class Level → Subject — styled with the same `selectClassName` convention as `MasterDataManager.tsx`.
  - [x] Each child select is disabled (and its value reset) until its parent has a selection, mirroring `MasterDataManager.tsx`'s `useEffect`-on-parent-change cascade/reset pattern — **except** State and City must each offer an explicit "National / Not Applicable" option so the cascade's "parent chosen" gate can be satisfied without forcing a specific State/City pick (see Dev Notes: Board must stay reachable for national boards, which have no State).
  - [x] State/City required-ness is computed from the selected Board's mock `stateId` (non-null national vs. state-scoped board), not hardcoded true/false. This required-ness is enforced only at the Next-button validation gate (AC#2) — it never disables the Board select itself.

- [x] Task 6: Step 4 — Thumbnails (AC: #5, #6)
  - [x] File picker accepting image files, capped at 3 accepted thumbnails; a 4th attempted upload shows an inline "maximum 3 thumbnails" message and does not add it to the list.
  - [x] Hand-rolled crop tool (no crop library exists in `package.json` today — do not add one without checking with the user first; this is a small enough scope to build directly): fixed 16:9 crop region, draggable for mouse users, plus keyboard support (arrow keys nudge position in fixed steps, or numeric x/y/zoom inputs as the accessible alternative) and an `aria-label`/visible copy stating the fixed-ratio constraint.
  - [x] Button-based reorder (e.g. move-left/move-right), delete, and set-primary controls per thumbnail — no drag interaction anywhere in this step.

- [x] Task 7: Wizard completion (AC: #7, #10)
  - [x] Verify no field value is lost navigating Back then Next across any step pair (mock state persists in the hook, not per-step local state).
  - [x] Step 4's "Finish" action calls `onComplete(draftId)` (or the full draft object — dev's call) rather than rendering or navigating to any Course Content Editor UI, since that surface doesn't exist until Story 2.3.

- [x] Task 8: Tests (AD-5)
  - [x] `FrontEnd/tests/features/CourseWizard/useCourseDraft.test.ts` — pure-logic: initial mock shape (including the pre-attached inactive tag and both board types), each mutator only touches its targeted field, thumbnail cap/reorder/set-primary logic.
  - [x] `FrontEnd/tests/features/CourseWizard/CourseWizard.test.tsx` — render/interaction: Next-disabled gating on Step 1 (empty title, over-120-char title) and Step 3 (missing Country/Board/Class/Subject, State/City required-vs-not by board); cascading dropdown disable/reset on parent change; locked/non-removable rendering for the inactive attached tag; 4th-thumbnail rejection message; arrow-key/numeric crop adjustment actually changes crop state; `onComplete` fires with no Course Content Editor render.
  - [x] Update `FrontEnd/tests/features/Dashboard/TutorEducatorHubView.test.tsx` — add a test asserting the `#course-publishing` "New Course Wizard" button now opens the new `CourseWizard` component (not the old inline `SidePanel`'s Step-1-of-4 content).
  - [x] Import all modules under test via `@/src/*` absolute alias, per AD-5 — no relative `../../../` chains.

### Review Findings

- [x] [Review][Patch] Wizard draft state never resets between separate "New Course Wizard" sessions — `CourseWizard` is always mounted (`isOpen` prop, early `return null`) rather than conditionally rendered, so `useCourseDraft()`'s state persists across close/reopen; finishing one course and opening the wizard again shows the previous course's title/tags/taxonomy/thumbnails. [FrontEnd/src/features/CourseWizard/CourseWizard.tsx, useCourseDraft.ts]
- [x] [Review][Patch] Thumbnail blob URLs are never revoked, and clicking "Add thumbnail" again while a crop is pending silently discards the in-progress crop (the empty-slot button isn't disabled while `pendingFileUrl` is set, so a new file selection overwrites it with no revoke). [FrontEnd/src/features/CourseWizard/StepThumbnails.tsx, useCourseDraft.ts]
- [x] [Review][Patch] Crop tool's drag handler and numeric X/Y/Zoom inputs can inject `NaN` into crop state — `clamp()` doesn't guard against it, and a zero-size `getBoundingClientRect()` (drag) or a transient non-numeric input value (Zoom/X/Y) both feed straight through. [FrontEnd/src/features/CourseWizard/ThumbnailCropTool.tsx]
- [x] [Review][Patch] Crop tool's `window` `mousemove`/`mouseup` listeners have no unmount safety cleanup — closing the wizard mid-drag (e.g. Escape) can leave a stale listener attached to `window`. [FrontEnd/src/features/CourseWizard/ThumbnailCropTool.tsx]
- [x] [Review][Patch] `sprint-status.yaml`'s `last_updated:` field is now a non-date annotated string (`2026-08-11 (2-1 → review)`) instead of a clean date, breaking the file's own established convention (annotations belong in the `#`-comment above, not the live YAML value). [_specs/implementation-artifacts/sprint-status.yaml]
- [x] [Review][Patch] Taxonomy's state-scoped-board warning never reflects actual validity — it shows whenever a state-scoped board is selected, staying visible even after valid State/City are supplied, and doesn't explain to the tutor why Next stays disabled when City still holds the "Not Applicable" sentinel. [FrontEnd/src/features/CourseWizard/StepTaxonomy.tsx]
- [x] [Review][Patch] Step 2's Next-gating is hardcoded `true` with no explanatory comment, unlike Steps 1 and 3 which both document their validity reasoning inline. [FrontEnd/src/features/CourseWizard/CourseWizard.tsx]
- [x] [Review][Patch] `NUDGE_STEP`'s comment describes only the X-axis meaning ("percentage of the crop region's width") though the same constant also drives Y-axis nudges. [FrontEnd/src/features/CourseWizard/ThumbnailCropTool.tsx]
- [x] [Review][Patch] `CourseDraftThumbnail` is missing the `order` field this story's own Task 2 specified (`thumbnails: { url, isPrimary, order }[]`) — ordering is only implicit via array position today, which Story 2.4's real entity swap will need to translate rather than reuse directly. [FrontEnd/src/features/CourseWizard/useCourseDraft.ts]
- [x] [Review][Defer] Mock taxonomy fixtures (`Country`/`State`/`City`/`Board`/`ClassLevel`/`Subject`) don't model `isActive` filtering the way the Tags step does — deferred: no AC requires it in this mock-only story, and every mock taxonomy entity today is `isActive: true`; becomes directly relevant once Story 2.5 live-wires real master data that can include inactive entities.
- [x] [Review][Defer] No image-type validation on thumbnail uploads — `accept="image/*"` is a soft UI hint only, not enforced in `handleFileSelected` — deferred: no AC requires file validation in this mock-only story; real upload validation is a live-wire concern.
- [x] [Review][Defer] No file-size cap on thumbnail uploads — deferred: same reasoning as the image-type gap above, not required by any AC in this mock-only story.
- [x] [Review][Defer] `TypeaheadMultiSelect`'s new `lockedValues` prop has no dedup guard against a `selected`/`options` overlap — deferred: unreachable today since `StepTags.tsx`'s active/locked tag sets are mutually exclusive by construction (a tag is either active or inactive, never both); worth hardening if a future caller of this shared `ui/` primitive doesn't maintain that invariant.
- [x] [Review][Defer] `isTaxonomyStepValid` silently treats an unrecognized `boardId` as valid (falls through to `true` when the board lookup fails) — deferred: unreachable via the UI today since `boardId` only ever comes from the rendered `<option>` list, always a subset of the `boards` array passed in; a defensive-programming gap only if a future caller sets hook state directly.

Dismissed as noise (verified, not real defects for this story's scope): `onComplete`'s `draftId` argument being ignored by `TutorEducatorHubView`'s current handler is exactly what AC#10 scopes this story to — the contract is "`onComplete` fires," not "the caller does something with the argument yet," since Course Content Editor doesn't exist until Story 2.3; and the cascade-reset being implemented as inline state-transition logic rather than a `useEffect`-on-parent-change pattern is functionally equivalent and already covered by tests — `MasterDataManager.tsx`'s `useEffect` exists specifically to trigger an async service refetch, which doesn't apply to this hook's synchronous mock state, so mirroring it here would add an unnecessary effect.

## Dev Notes

- **This is a mock-data-only story.** No backend call, no `coursesService.ts`/`tagsService.ts` live wiring — Tags go live in Story 2.5, Taxonomy in Story 2.5, Title/Description/Thumbnails persistence in Story 2.4. The entire point of Task 2's hook boundary is that those stories change only `useCourseDraft.ts`'s internals and touch zero step-component code.
- **Old-wizard-removal discrepancy — resolved in favor of epics.md's ACs.** `ARCHITECTURE-SPINE.md`'s Structural Seed says the "remove it now" thing **twice**: at the `CourseWizard/` folder entry ("fully SUPERSEDES the old 4-step wizard... removed as part of this feature, not left running alongside the new one") and again at the `TutorHub/` folder entry ("TutorEducatorHubView's old 4-step Course Creation Wizard is removed, not kept, per CourseWizard/'s note above"). Read in isolation either could mean "remove it now, in 2.1." But `epics.md`'s own Story 2.4 AC explicitly ties removal to *that* story: "Given the new wizard is now persisting real Draft state / When this story ships / Then the old 4-step Course Creation Wizard... is removed." Since this story (2.1) is mock-only and has no persistence yet, deleting the old (real, if flawed) wizard now would leave tutors with zero working course-creation path until 2.4 ships. Follow epics.md's per-story ACs (the authoritative source): rewire the trigger only, leave the old code physically in place. If a dev agent independently finds either spine reference and is tempted to delete the old wizard now, this note is why not.
- **Taxonomy cascade must not make national boards unreachable.** A literal strict "child disabled until parent chosen" cascade (Country→State→City→Board) makes it impossible to ever select a national board (`stateId: null`), because Board would stay disabled until City has a value, and national boards have no State/City to choose. `masterDataService.ts`'s `getBoards(stateId?)` is deliberately callable with no argument for "all boards, filter client-side," and `MasterDataManager.tsx`'s own State selector already treats "no state" as a valid, non-blocking choice — this story's Taxonomy step must do the same: give State and City an explicit "National / Not Applicable" option that satisfies the cascade gate without picking a specific entity, keeping Board always reachable. State/City *required-ness* (AC#2) is a Next-button validation concern only, never a Board-disabling concern.
- **Crop tool is genuinely new build.** Confirmed via codebase search: no existing crop/upload component, no crop library in `package.json`. Don't add a new dependency (e.g. `react-easy-crop`) without checking with the user first — this story's AC only needs a fixed-16:9, keyboard-operable crop region, which is buildable directly with a positioned overlay + transform math and a handful of `useState` values (x/y offset, zoom), no library required.
- **Tags step's locked-chip requirement is a real `TypeaheadMultiSelect` API decision, not just styling.** The component currently has no concept of a selected-but-non-removable option. Keep the extension generic (e.g. `lockedValues`) so it stays a legitimate `ui/`-layer primitive per AD-3 (no "tag" or "deactivated" domain concept inside `ui/`) — the domain meaning ("this tag was deactivated after being attached") lives in `CourseWizard`'s usage of the prop, not in the primitive itself.
- **Taxonomy mock data must match `masterDataService.ts`'s real shapes exactly** (`Country`, `State`, `City`, `Board` with nullable `stateId`, `ClassLevel`, `Subject`) — this is what lets Story 2.5 swap the mock arrays for real `masterDataService.ts` calls behind `useCourseDraft()` without the Taxonomy step's rendering code changing at all.
- **120-char title limit is a PRD-flagged assumption** (`prd.md` line 558: "Course Title max length not specified; recommend 120 characters"), not a confirmed number — implement it as a single named constant so it's a one-line change if the user later specifies a different value.
- **No new state-management library** — `useState` only inside `useCourseDraft.ts`, matching AD-4's "no redux/zustand/jotai" rule. This hook is feature-local (single-feature state), not a `Context` candidate — `CourseContentContext` (a different, not-yet-built entity for the Chapter/Topic/Subtopic tree) is Story 2.9's concern, not this one's.
- **Scope boundary on Step 4 → Course Content Editor handoff:** don't build any placeholder Course Content Editor UI or route in this story. `onComplete` firing (verified by a test) is the entire contract Story 2.3 needs to build against later.

### Project Structure Notes

- New folder: `FrontEnd/src/features/CourseWizard/` (component + feature-local hook colocated, matching `CoursePlayer/`'s and `Admin/AiConfiguration/`'s existing pattern). [Source: architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md Structural Seed + "Design Paradigm"]
- Modified, not new: `FrontEnd/src/features/Dashboard/TutorEducatorHubView.tsx` (~1050 lines total — add new open/close state + new wizard render, rewire one button's `onClick`; read the whole file before editing; do not restructure the old wizard's existing code) and `FrontEnd/tests/features/Dashboard/TutorEducatorHubView.test.tsx` (add one test for the rewired trigger).
- Possible extension, not new: `FrontEnd/src/ui/TypeaheadMultiSelect.tsx` (optional generic locked-chip support, see Dev Notes) — if extended, its own existing consumer (`MasterDataManager.tsx`) must keep working unchanged (the new prop must be optional and backward-compatible).
- Naming conventions (ratified, not invented): `PascalCase.tsx` components, `camelCase.ts` hooks starting with `use`, feature-local hooks live inside the feature folder (not `src/hooks/`), mock/constant fixtures `SCREAMING_SNAKE_CASE`. [Source: architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md "Consistency Conventions" table]
- Tests mirror `src/` path-for-path under `FrontEnd/tests/`, not colocated: new tests land at `FrontEnd/tests/features/CourseWizard/*.test.ts(x)`. [Source: ARCHITECTURE-SPINE.md AD-5]

### References

- [Source: _specs/planning-artifacts/epics.md — Epic 2, Story 2.1 (full AC + Dev Notes context, "Parallelization note"), Story 2.4 AC (old-wizard removal timing)]
- [Source: _specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md — FR6 (Title), FR7 (Tags), FR8 (Taxonomy), FR9 (Thumbnails), FR10 (wizard progress/auto-persist); line 558 (120-char title assumption)]
- [Source: _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/EXPERIENCE.md — Component Patterns "New Course Wizard (metadata)" row (line 75); Interaction Primitives (drag reserved for exactly two surfaces); Accessibility Floor "Thumbnail crop tool"]
- [Source: _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/DESIGN.md — components.side-panel, components.input]
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md — AD-1 (repository/hook boundary), AD-2 (feature-local hooks), AD-3 (dependency direction, `ui/` purity), AD-4 (no new state library, Context scope), AD-5 (test conventions), Consistency Conventions table, Structural Seed (`CourseWizard/` folder, old-wizard superseding note)]
- [Source: FrontEnd/src/features/Dashboard/TutorEducatorHubView.tsx — existing old wizard (`isWizardOpen`, `wizardStep`, `SidePanel` usage, `#course-publishing` trigger button ~line 410-422) to read fully before editing]
- [Source: FrontEnd/src/ui/TypeaheadMultiSelect.tsx — existing generic type-ahead multi-select to reuse for Tags]
- [Source: FrontEnd/src/features/Admin/MasterDataManager.tsx — existing cascading-dropdown pattern (`selectClassName`, parent-change `useEffect` reset) to mirror for Taxonomy]
- [Source: FrontEnd/src/services/masterDataService.ts — real `Country`/`State`/`City`/`Board`/`ClassLevel`/`Subject` shapes the mock taxonomy fixture must match]
- [Source: FrontEnd/src/features/Admin/AiConfiguration/ + _specs/implementation-artifacts/1-1-admin-ai-configuration-ui-mock-data.md — precedent for this story's mock-data-only + stable-hook-boundary pattern]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npx tsc --noEmit` — same 6 pre-existing errors in `src/features/CoursePlayer/FlashcardsModal.tsx` (unrelated, untouched file — stale `DrilldownTopic` type reference, already noted in Story 1.1). Zero errors in any file this story created or modified.
- `npx vitest run tests/features/CourseWizard/useCourseDraft.test.ts` — 15 passing (hook mutators, `isTitleStepValid`, `isTaxonomyStepValid`).
- `npx vitest run tests/features/CourseWizard/CourseWizard.test.tsx` — 10 passing (Next-gating on Steps 1/3, cascading Taxonomy disable/reset, locked-tag chip rendering, 4th-thumbnail rejection, keyboard+numeric crop adjustment, Back/Next state preservation, `onComplete` firing with no Course Content Editor render).
- `npx vitest run tests/features/Dashboard/TutorEducatorHubView.test.tsx tests/features/Admin/TagManagement tests/features/Admin/MasterDataTable.test.tsx` — 27 passing, confirming the rewired trigger opens the new wizard (not the old one) and that `TypeaheadMultiSelect`'s existing consumers (`MasterDataManager.tsx` via `TagManagement.tsx`/`MasterDataTable.tsx`) are unaffected by its new optional `lockedValues` prop.
- `npx vitest run` (full suite) — 62 files, 359 tests, all passing. No regressions.
- **Code review fix pass:** `npx vitest run tests/features/CourseWizard` — RED confirmed not applicable (fixes were additive/corrective, not red-green per finding); GREEN after all 9 patches applied: 32 passing (7 new tests covering `resetDraft`, `order` tracking, blob-URL revocation, and the board-warning clearing). Full suite re-run: 62 files, 366 tests, all passing. Lint re-run: same 6 pre-existing `FlashcardsModal.tsx` errors only.

### Completion Notes List

- All 10 ACs implemented and covered by tests.
- A real structural tension in FR-8 (State/City required-ness is board-dependent, but Board is displayed *after* State/City in cascade order) was resolved exactly as the story's Dev Notes directed: State and City each carry an explicit "National / Not Applicable" sentinel option so the cascade's "parent chosen" gate is always satisfiable, and the actual required-ness (does the chosen Board need a *real*, non-sentinel State/City) is enforced only at the Next-button gate (`isTaxonomyStepValid`), never by disabling Board. Board's own option list is filtered to national boards plus any board matching the selected real State, so a state-scoped board only becomes selectable once a real State is chosen — verified by a dedicated test.
- The old 5-step wizard in `TutorEducatorHubView.tsx` was left fully in place (state, JSX, handlers) per the story's resolved Dev Notes discrepancy — only its trigger button's `onClick` was rewired to open the new `CourseWizard` instead. Confirmed via test that the old wizard's dialog/content no longer renders from that trigger.
- `TypeaheadMultiSelect.tsx` was extended with an optional, domain-agnostic `lockedValues?: TypeaheadOption[]` prop (full `{value,label}` objects, per the QA-fixed story Dev Notes) rather than forked into a feature-local copy; its existing consumer (`MasterDataManager.tsx`'s ClassLevel Subjects field) is unaffected since the prop defaults to `[]` and is purely additive.
- Crop tool was hand-rolled (transform-based positioning, arrow-key nudge at 1%/press, numeric x/y/zoom fallback, `aria-describedby` announcing the fixed-ratio constraint) — no new dependency added, per Dev Notes.
- `addThumbnail`/`removeThumbnail`/`reorderThumbnail`/`setPrimaryThumbnail` implemented exactly as the story's named mutator list specified; a planned `updateThumbnailCrop` mutator was dropped since it wasn't in that list and nothing needed it (crop is fixed at add-time via the crop tool's confirm step) — kept the hook to only what the story and its consumers actually use.
- ✅ Resolved review finding: `useCourseDraft` gained a `resetDraft()` mutator (revokes any live thumbnail blob URLs, then restores a fresh initial draft), called from `CourseWizard`'s close and finish handlers — a second "New Course Wizard" session now starts blank instead of pre-filled with the previous one's data.
- ✅ Resolved review finding: thumbnail blob URLs are now revoked on `removeThumbnail`, on crop-cancel, on a rejected crop-confirm, and on step-unmount (ref-based cleanup) — not just left to accumulate for the tab's lifetime.
- ✅ Resolved review finding: the empty-slot "Add thumbnail" button now disables while a crop is pending, so a second file pick can no longer silently discard an in-progress crop.
- ✅ Resolved review finding: `ThumbnailCropTool`'s `clamp()` is now NaN-safe, and the drag handler skips updates entirely on a zero-size `getBoundingClientRect()`, closing the path that could corrupt crop state.
- ✅ Resolved review finding: the crop tool's `window` drag listeners are now torn down on unmount via a ref-tracked cleanup, not just on `mouseup`.
- ✅ Resolved review finding: `sprint-status.yaml`'s `last_updated` field reverted to a clean date; the review's own annotation stays in the `#`-comment above, matching the file's established convention.
- ✅ Resolved review finding: the Taxonomy step's state-scoped-board warning now only shows while its State/City requirement is actually unmet, instead of persisting for the board's entire selected lifetime.
- ✅ Resolved review finding: Step 2's always-`true` Next-gating now carries an explanatory comment alongside Steps 1 and 3's.
- ✅ Resolved review finding: `CourseDraftThumbnail` gained the `order` field this story's own Task 2 specified, kept in sync with array position via a `withOrder` helper on every add/remove/reorder.
- ✅ Resolved review finding: `NUDGE_STEP`'s comment now credits both the X and Y axes it drives, not just X.
- Deferred (see `deferred-work.md`): mock taxonomy `isActive` filtering, thumbnail image-type/size validation, `TypeaheadMultiSelect`'s `lockedValues`/`selected` dedup guard, and `isTaxonomyStepValid`'s silent pass-through for an unrecognized `boardId` — none reachable or required by an AC in this mock-only story.

### File List

**New:**
- `FrontEnd/src/features/CourseWizard/useCourseDraft.ts`
- `FrontEnd/src/features/CourseWizard/CourseWizard.tsx`
- `FrontEnd/src/features/CourseWizard/StepTitleDescription.tsx`
- `FrontEnd/src/features/CourseWizard/StepTags.tsx`
- `FrontEnd/src/features/CourseWizard/StepTaxonomy.tsx`
- `FrontEnd/src/features/CourseWizard/StepThumbnails.tsx`
- `FrontEnd/src/features/CourseWizard/ThumbnailCropTool.tsx`
- `FrontEnd/tests/features/CourseWizard/useCourseDraft.test.ts`
- `FrontEnd/tests/features/CourseWizard/CourseWizard.test.tsx`

**Modified:**
- `FrontEnd/src/features/Dashboard/TutorEducatorHubView.tsx` — added `isNewCourseWizardOpen` state, rendered `<CourseWizard />`, rewired the `#course-publishing` "New Course Wizard" button to open it; old wizard's state/JSX/handlers left untouched.
- `FrontEnd/src/ui/TypeaheadMultiSelect.tsx` — added optional `lockedValues?: TypeaheadOption[]` prop rendering non-removable locked chips.
- `FrontEnd/tests/features/Dashboard/TutorEducatorHubView.test.tsx` — added a test asserting the rewired trigger opens the new `CourseWizard`, not the old inline wizard.
- `_specs/implementation-artifacts/sprint-status.yaml` — `2-1-course-metadata-wizard-ui-mock-data` → `review` (updated at Step 9).

## Change Log

- 2026-08-11: Story implemented — New Course Wizard (`CourseWizard/`) built end-to-end against mock data: Title/Description validation, Tags via `TypeaheadMultiSelect` with a new locked-chip capability, 6-level cascading Taxonomy with a National/Not-Applicable resolution for the FR-8 board-dependent-requirement ordering tension, and a hand-rolled keyboard-accessible 16:9 Thumbnails crop tool. Dashboard trigger rewired to the new wizard; old wizard left in place per Story 2.4's ownership of its removal. All 10 ACs covered by tests; full suite green (359/359); no regressions.
- 2026-08-11: Addressed code review findings — 9 patch items resolved (draft-never-resets on reopen, thumbnail blob-URL leaks + silent in-progress-crop discard, NaN-unsafe crop state, crop-drag listener leak, `sprint-status.yaml` date-field regression, stale board-location warning, two documentation nits, and the missing `order` field on `CourseDraftThumbnail`). 4 items deferred (mock taxonomy `isActive` filtering, thumbnail upload type/size validation, `TypeaheadMultiSelect` locked-value dedup guard, unrecognized-`boardId` pass-through), 2 dismissed as non-issues after verification (`onComplete`'s unused `draftId` argument is exactly what AC#10 scopes this story to; the inline cascade-reset vs. a `useEffect` pattern is functionally equivalent and the referenced pattern's actual purpose — triggering an async refetch — doesn't apply to this synchronous mock hook). Full suite green (366/366); no regressions. Story closed to `done`.
