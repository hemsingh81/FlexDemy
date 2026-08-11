---
baseline_commit: a1519bbfd2d31406dd1949e5ab47875246c6b371
---

# Story 1.1: Admin AI Configuration UI (Mock Data)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to see and edit AI Task provider/model/fallback/budget settings in a table UI backed by mock data,
so that the layout and interaction can be validated before backend wiring exists (Story 1.5 wires this to real data).

## Acceptance Criteria

1. The AI Configuration screen shows one row per AI Task — exactly these 7, in this order: `extractStructure`, `explainTopic`, `rewriteExplanation`, `generateExercise`, `defineKeyword`, `describeNotation`, `embeddings` — each with its own provider selector, model selector, fallback provider/model selector, and budget-threshold field, populated from local mock data. [Source: epics.md Story 1.1; EXPERIENCE.md "AI Configuration table" row]
2. Each row's fields save independently — editing and saving one row does not require or affect any other row's fields (no single "Save All" form). [Source: EXPERIENCE.md "AI Configuration table" row]
3. Saving an edited row updates local mock state only — no network call is made. The UI behaves exactly as if the save succeeded (optimistic-looking success), so this component is ready to be re-pointed at a real API in Story 1.5 with no behavioral change. [Source: epics.md Story 1.1]
4. When a task's mock spend is at or above its mock budget threshold, that row shows a warning rendered as **icon + text**, never color alone. `{colors.warning}` fails the WCAG AA 4.5:1 text-contrast floor at small sizes, so this must render as an icon/badge-fill use (which only needs to clear the 3:1 non-text floor), not small warning-colored text. The threshold-crossing state is exposed to assistive tech via `aria-describedby` on the affected row. [Source: epics.md Story 1.1; EXPERIENCE.md Accessibility Floor "Budget threshold warning (Admin)"; DESIGN.md colors.warning gap note]
5. Data access goes through a stable hook (`useAiTaskConfig()`), never inline `useState`/mock-array manipulation directly in the component tree, so Story 1.5 can swap the hook's internal implementation from mock to a real `aiConfigService.ts` call without changing any component code. [Source: epics.md Story 1.1 "Parallelization note" + hook-boundary AC; AD-1]
6. This screen renders inside the existing Admin panel as a new `ai-configuration` sub-tab, visible to the `Master` role only (not `Support`). [Source: EXPERIENCE.md Information Architecture "Admin" row: "AI Configuration & Usage is Master-only, matching its direct control over spend and model routing"]
7. This story's usage-dashboard sibling (Story 1.2) renders in the **same** `ai-configuration` sub-tab as a second section below the config table — not a separate sub-tab. Do not create two sub-tabs for these. [Source: EXPERIENCE.md "AI Configuration table" row: "Usage/cost is broken out by task and date range in the **same surface**"]

## Tasks / Subtasks

- [x] Task 1: Add the `ai-configuration` admin sub-tab (AC: #6, #7)
  - [x] In `FrontEnd/src/features/Admin/useAdminPanel.ts`: add `'ai-configuration'` to the `AdminSubTab` union type and to `ALL_SUB_TABS` (Master's array). Do **not** add it to Support's array (`['tutor-approvals']`) — Master-only per AC #6.
  - [x] Add an `ADMIN_SUBTAB_META['ai-configuration']` entry (label: "AI Configuration & Usage", pick a `lucide-react` icon consistent with the other 4 entries, e.g. `Cpu` or `Settings2` — check what's already imported in that file before adding a new icon import).
  - [x] In `FrontEnd/src/features/Admin/AdminPanel.tsx`: add `{activeSubTab === 'ai-configuration' && <AiConfiguration />}` alongside the existing 4 conditional renders, following the exact same pattern (no new switching mechanism).
- [x] Task 2: Build the mock data + hook (AC: #1, #3, #5)
  - [x] Create `FrontEnd/src/features/Admin/AiConfiguration/useAiTaskConfig.ts` — feature-local hook (per AD-2, every feature/subfeature gets one). Exposes `{ data, isLoading, error }` plus an `updateTaskConfig(taskId, patch)` mutator, matching AD-1's standard hook shape even though it's backed by local mock state, not a service call, in this story.
  - [x] Mock data: an in-memory array of 7 task config objects (`extractStructure`, `explainTopic`, `rewriteExplanation`, `generateExercise`, `defineKeyword`, `describeNotation`, `embeddings`), each with `provider`, `model`, `fallbackProvider`, `fallbackModel`, `budgetThreshold`, `mockSpend` fields. Field names should anticipate Story 1.5's real `AiTaskConfig` entity (backend AD-19) — don't invent field names Story 1.5 will have to rename.
  - [x] `updateTaskConfig` mutates only the matching row's mock object — do not reset or refetch the whole array on every edit (would defeat AC #2's per-row independence).
- [x] Task 3: Build the table UI (AC: #1, #2, #4)
  - [x] Create `FrontEnd/src/features/Admin/AiConfiguration/AiConfiguration.tsx` — top component, calls `useAiTaskConfig()`, renders `{components.card-section}` shell (white card, hairline border, `rounded-2xl`, heading row) containing the 7-row table.
  - [x] Create `AiTaskConfigRow.tsx` (or inline row rendering if the table is simple enough — use judgment, but keep the file under a reasonable size) — provider/model/fallback selects (`{components.input}` styling: white fill, hairline border, `rounded-xl`, amber focus ring — copy `MasterDataManager.tsx`'s existing `selectClassName` pattern rather than reinventing), budget-threshold numeric input, per-row Save button that calls `updateTaskConfig` directly (no page-level save).
  - [x] Threshold warning: icon (e.g. `AlertTriangle` from `lucide-react`) + short text label, using `{colors.warning}` only as an icon/fill color, never as small text color. Add `aria-describedby` linking the row to the warning's text node.
- [x] Task 4: Tests (AD-5)
  - [x] `FrontEnd/tests/features/Admin/AiConfiguration/useAiTaskConfig.test.ts` — pure-logic test: initial data shape, `updateTaskConfig` mutates only the targeted row, other rows untouched.
  - [x] `FrontEnd/tests/features/Admin/AiConfiguration/AiConfiguration.test.tsx` — render test: all 7 tasks appear in the documented order; editing and saving one row's field does not change another row's rendered values; threshold-exceeded row renders the warning icon+text and `aria-describedby` is present.
  - [x] Import both the hook and any mocked module via `@/src/*` absolute alias, per AD-5 — no relative `../../../` chains.

### Review Findings

- [x] [Review][Patch] Missing save-confirmation feedback — AC #3 says the UI "behaves exactly as if the save succeeded (optimistic-looking success)." Resolved: Save button shows "Saved!" for 1.5s after a successful save. [FrontEnd/src/features/Admin/AiConfiguration/AiTaskConfigRow.tsx]
- [x] [Review][Patch] Provider/Model/Fallback rendered as free-text `<input>` elements instead of `<select>` dropdowns. Resolved: converted all four fields to `<select>` with a closed vocabulary (`PROVIDER_OPTIONS`, `MODEL_OPTIONS`) covering every value in the mock data. [FrontEnd/src/features/Admin/AiConfiguration/AiTaskConfigRow.tsx]
- [x] [Review][Patch] Budget threshold input allows empty/negative/NaN, silently coercing to 0 on save with no guard. Resolved: threshold now tracked as a raw string with explicit validity check (`isThresholdValid`); Save is disabled while invalid; `min="0"` added. [FrontEnd/src/features/Admin/AiConfiguration/AiTaskConfigRow.tsx]
- [x] [Review][Patch] `aria-describedby` targets a non-focusable, role-less row `<div>`. Resolved: row now has `role="group"` + `aria-label` (task name), making it a real, nameable landmark for the `aria-describedby` relationship. [FrontEnd/src/features/Admin/AiConfiguration/AiTaskConfigRow.tsx]
- [x] [Review][Patch] Save button missing explicit `type="button"`. Resolved. [FrontEnd/src/features/Admin/AiConfiguration/AiTaskConfigRow.tsx]
- [x] [Review][Patch] No test covers the under-threshold case. Resolved: added a test asserting no warning/`aria-describedby` for a well-under-threshold row (`defineKeyword`). [FrontEnd/tests/features/Admin/AiConfiguration/AiConfiguration.test.tsx]
- [x] [Review][Patch] Stale comment in `useAdminPanel.ts` still said "Master sees all 4 admin sections." Resolved: corrected to 5. [FrontEnd/src/features/Admin/useAdminPanel.ts]
- [x] [Review][Defer] Draft state in `AiTaskConfigRow` doesn't resync if the `task` prop changes underneath it [FrontEnd/src/features/Admin/AiConfiguration/AiTaskConfigRow.tsx:32-38] — deferred, pre-existing pattern with no current trigger: the only way `task` changes today is via this same row's own `updateTaskConfig` call; Story 1.5's live-wire is the natural point to add resync logic
- [x] [Review][Defer] `AdminPanel.tsx` has zero dedicated render tests for any of its 5 sub-tab branches [FrontEnd/src/features/Admin/AdminPanel.tsx] — deferred, pre-existing gap predating this story, not introduced or worsened by it
- [x] [Review][Defer] Admin sub-tab role-gating relies entirely on the caller passing a correctly role-filtered `activeSubTab`/`availableSubTabs` — a theoretical bypass exists if a future caller sets `activeSubTab` directly [FrontEnd/src/features/Admin/AdminPanel.tsx] — deferred, pre-existing pattern shared identically by all 4 prior sub-tabs; the documented real safety net is backend `[Authorize(Policy = ...)]`, not client-side gating

#### Re-review (2026-08-11) — confirming the 7 fixes above

A second, independent adversarial + edge-case + acceptance-audit pass confirmed all 7 original fixes hold, but surfaced 4 new issues introduced by the fixes themselves (all now resolved) plus 1 deferred and 6 dismissed items:

- [x] [Review][Patch] `justSaved` revert timer had no unmount cleanup — a leaked timer could fire `setJustSaved` on an unmounted row. Resolved: added a `useEffect` cleanup clearing the timeout on unmount. [FrontEnd/src/features/Admin/AiConfiguration/AiTaskConfigRow.tsx]
- [x] [Review][Patch] "Saved!" stayed on the button for up to 1.5s after the admin started a *new*, unsaved edit — stale confirmation. Resolved: any field's `onChange` now calls `markDirty()`, clearing `justSaved` and canceling the pending revert timer immediately. [FrontEnd/src/features/Admin/AiConfiguration/AiTaskConfigRow.tsx]
- [x] [Review][Patch] The over-budget warning had no `aria-live` region — a screen-reader user tabbing field-to-field (not landing on the `role="group"` container itself) could miss it entirely. Resolved: added `aria-live="polite"` to the warning content. [FrontEnd/src/features/Admin/AiConfiguration/AiTaskConfigRow.tsx]
- [x] [Review][Patch] `PROVIDER_OPTIONS`/`MODEL_OPTIONS` were untyped `string[]` with no compile-time link to `AiTaskConfig.provider`/`model` (plain `string`) — a future mismatched mock/real value would silently render as an unselected `<select>` instead of a type error. Resolved: moved to `useAiTaskConfig.ts` as `AI_PROVIDERS`/`AI_MODELS` (`as const` + derived `AiProvider`/`AiModel` union types), and `AiTaskConfig`'s 4 provider/model fields now use those types instead of `string`. [FrontEnd/src/features/Admin/AiConfiguration/useAiTaskConfig.ts, AiTaskConfigRow.tsx]
- [x] [Review][Patch] Test gaps: no negative-threshold test, no test asserting "Saved!" reverts on a subsequent edit. Resolved: both added. [FrontEnd/tests/features/Admin/AiConfiguration/AiConfiguration.test.tsx]
- [x] [Review][Defer] Fallback provider/model can be saved identical to the primary provider/model (no distinctness check), silently providing no real failover [FrontEnd/src/features/Admin/AiConfiguration/AiTaskConfigRow.tsx] — deferred: no AC requires this, and Story 1.5's real backend is the natural place to validate provider/model combination sanity, not a mock-only UI.

Dismissed as noise (verified, not real defects for this story's scope): the flat (non-provider-filtered) model list is a deliberate, already-documented scope decision, not an oversight; `handleSave`'s internal validity guard is defense-in-depth, not dead code worth removing; draft-state resync and the two-numbers-on-screen (saved vs. draft) behavior are expected consequences of already-deferred/standard edit-before-save UX, not new defects; `min="0"` being JS-enforced rather than browser-enforced is standard practice, not misleading; and scientific-notation/absurdly-large threshold values are low-likelihood inputs for a mock-only dollar field not worth the added validation complexity.

## Dev Notes

- **This is a mock-data-only story.** No backend call, no `aiConfigService.ts` yet — that's Story 1.5. The entire point of Task 2's hook boundary is that Story 1.5 changes only `useAiTaskConfig.ts`'s internals (swap mock array for a `aiConfigService.getAiTaskConfigs()` call) and touches zero component code in Task 3.
- **Do not build a "Save All" form.** EXPERIENCE.md is explicit that rows save independently. A single form-level submit is a documented anti-pattern for this screen.
- **Sub-tab sharing with Story 1.2 (important, easy to get wrong):** `Admin → AI Configuration & Usage` is *one* sub-tab, not two. This story owns the sub-tab's wiring (Task 1) and the config-table section. Story 1.2 will add a second section (usage/cost breakdown) to the *same* `AiConfiguration.tsx` component tree — don't design `AiConfiguration.tsx` in a way that assumes it's the whole screen forever; leave room for a sibling section to be added below the table.
- **7 AI Tasks, exact names and order:** `extractStructure`, `explainTopic`, `rewriteExplanation`, `generateExercise`, `defineKeyword`, `describeNotation`, `embeddings`. `describeNotation` was added during the UX accessibility review (generates screen-reader alt-text for KaTeX math/chemistry notation) — it is a first-class 7th row, not an afterthought.
- **Field-name forward-compatibility with Story 1.5:** the backend's real entity is `AiTaskConfig` (+ `AiPromptVersion` for prompt/version history, out of scope for this story's UI). Backend AD-19 binds "per-task provider/model assignment, fallback assignment, budget thresholds." Keep this story's mock field names (`provider`, `model`, `fallbackProvider`, `fallbackModel`, `budgetThreshold`) so Story 1.5's live-wire doesn't have to rename anything the UI already references.
- **Budget threshold warning is a recurring gotcha in this codebase's palette:** `{colors.warning}` (`#D97706`, stock amber-600) fails 4.5:1 text contrast against white (~3.19:1) — DESIGN.md flags this explicitly as a "known gap." It's fine as an icon or badge-fill color (clears the 3:1 non-text floor) but must never be the color of small warning *text*. This is the same class of issue already fixed for `{colors.signal-green}` elsewhere — don't reintroduce it here.

### Project Structure Notes

- New files, no existing files are being modified except the two listed in Task 1 (`useAdminPanel.ts`, `AdminPanel.tsx`) — both are small, additive edits (one new union member, one new conditional render) that follow the exact existing pattern for the other 4 sub-tabs. Read both files in full before editing; do not restructure either file's existing logic.
- Follows the frontend architecture spine's feature-folder convention: this creates a new subfolder `FrontEnd/src/features/Admin/AiConfiguration/` (component + feature-local hook together), matching how `CoursePlayer/` colocates its top component with `useCoursePlayer.ts` and subcomponents. [Source: architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md "Design Paradigm" + Structural Seed]
- Naming conventions (ratified, not invented): `PascalCase.tsx` components, `camelCase.ts` hooks starting with `use`, feature-local hooks live inside the feature folder (not `src/hooks/`, which is cross-feature-only). [Source: architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md "Consistency Conventions" table]
- No new state-management library — `useState` only, matching AD-4's explicit "no redux/zustand/jotai" rule. This hook is feature-local (single-feature state per AD-2/AD-4), not a candidate for `DomainContext` or a new Context provider.

### References

- [Source: _specs/planning-artifacts/epics.md — Epic 1, Story 1.1 (full AC + Dev Notes context, "Parallelization note")]
- [Source: _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/EXPERIENCE.md — Information Architecture "Admin" row; Component Patterns "AI Configuration table" row; Accessibility Floor "Budget threshold warning (Admin)"; State Patterns "Budget threshold approaching / exceeded"]
- [Source: _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/DESIGN.md — components.card-section, components.input, colors.warning gap note]
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md — AD-1 (repository/hook boundary), AD-2 (feature-local hooks), AD-4 (no new state library), AD-5 (test conventions), Consistency Conventions table, Structural Seed]
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md — AD-19 (AiTaskConfig is DB-backed; field scope this story's mock shape anticipates)]
- [Source: FrontEnd/src/features/Admin/useAdminPanel.ts — existing `AdminSubTab` union, `ALL_SUB_TABS`, `ADMIN_SUBTAB_META`, role-gating logic to extend, not replace]
- [Source: FrontEnd/src/features/Admin/AdminPanel.tsx — existing sub-tab conditional-render pattern to follow]
- [Source: FrontEnd/src/features/Admin/MasterDataManager.tsx — existing Admin-table styling pattern (`selectClassName`, hairline border, amber focus ring) to reuse rather than reinvent]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npx vitest run tests/features/Admin/useAdminPanel.test.ts` — RED confirmed before implementing Task 1 (1 failing), GREEN after (4 passing).
- `npx vitest run tests/features/Admin/AiConfiguration/` — RED confirmed before implementing Tasks 2–3 (import-resolution failure), GREEN after (5 passing: 2 hook + 3 component).
- `npx vitest run` (full suite) — 55 files, 294 tests, all passing. No regressions.
- `npm run lint` (`tsc --noEmit`) — 6 pre-existing errors in `src/features/CoursePlayer/FlashcardsModal.tsx` (an untouched file, unrelated to this story — a stale `DrilldownTopic` type reference). Zero errors in any file this story created or modified.
- **Review follow-up pass:** `npx vitest run tests/features/Admin/AiConfiguration/AiConfiguration.test.tsx` — RED confirmed (4 tests failing) before applying the 7 patch fixes; GREEN after (15 passing, including one test-side fix — a `<select>`'s current value must be read via `.value`, not `getAttribute('value')`, which only works for `<input>`). Full suite re-run: 56 files, 304 tests, all passing. Lint re-run: same 6 pre-existing `FlashcardsModal.tsx` errors only.
- **Re-review pass (confirming the 7 fixes):** RED confirmed (2 of 4 new tests failing) before applying the 4 new patch fixes; GREEN after (25 passing across the AiConfiguration folder). Full suite re-run: 57 files, 314 tests, all passing. Lint re-run surfaced one real error the typed-options refactor exposed — an existing test used `'gpt-5-mini'`, not a member of the new `AiModel` union — fixed to `'claude-4-haiku'`. Final lint: same 6 pre-existing `FlashcardsModal.tsx` errors only.

### Completion Notes List

- All 7 ACs implemented and covered by tests. Implemented Tasks 1–4 in order, red-green per task where a test boundary existed (Task 1's sub-tab addition, and Tasks 2–3's hook/component).
- Sub-tab sharing with Story 1.2 (AC #7) handled by structuring `AiConfiguration.tsx` as a `space-y-6` stack with a comment marking where the usage/cost section lands — the config-table section doesn't assume it owns the whole screen.
- Budget-threshold warning (AC #4) verified against real seed data (`explainTopic` intentionally seeded at/above its threshold) rather than only via a contrived test fixture.
- Pre-existing, unrelated TypeScript errors in `FlashcardsModal.tsx` were found during the lint check — confirmed via `git status` that this story touched none of that file's dependencies; left as-is, out of this story's scope.
- ✅ Resolved review finding: missing save-confirmation feedback — Save button now shows "Saved!" for 1.5s.
- ✅ Resolved review finding: free-text provider/model/fallback inputs converted to `<select>` dropdowns with a closed vocabulary.
- ✅ Resolved review finding: budget-threshold input now validated (non-empty, finite, non-negative) with Save disabled while invalid.
- ✅ Resolved review finding: row now `role="group"` + `aria-label`, so `aria-describedby` targets a real, nameable landmark.
- ✅ Resolved review finding: Save button now has explicit `type="button"`.
- ✅ Resolved review finding: added an under-threshold test case (no warning, no `aria-describedby`).
- ✅ Resolved review finding: corrected `useAdminPanel.ts`'s stale "4 admin sections" comment to 5.
- ✅ Resolved review finding [re-review]: `justSaved` timer now cleaned up on unmount.
- ✅ Resolved review finding [re-review]: any field edit now clears the stale "Saved!" confirmation immediately.
- ✅ Resolved review finding [re-review]: over-budget warning is now an `aria-live="polite"` region.
- ✅ Resolved review finding [re-review]: provider/model options moved to `useAiTaskConfig.ts` as typed `as const` unions (`AiProvider`/`AiModel`), compile-time-linked to `AiTaskConfig`'s fields.
- ✅ Resolved review finding [re-review]: added a negative-threshold test and a "Saved! reverts on edit" test.

### File List

**New:**
- `FrontEnd/src/features/Admin/AiConfiguration/useAiTaskConfig.ts`
- `FrontEnd/src/features/Admin/AiConfiguration/AiConfiguration.tsx`
- `FrontEnd/src/features/Admin/AiConfiguration/AiTaskConfigRow.tsx`
- `FrontEnd/tests/features/Admin/AiConfiguration/useAiTaskConfig.test.ts`
- `FrontEnd/tests/features/Admin/AiConfiguration/AiConfiguration.test.tsx`

**Modified:**
- `FrontEnd/src/features/Admin/useAdminPanel.ts` — added `'ai-configuration'` to `AdminSubTab`, `ALL_SUB_TABS`, `ADMIN_SUBTAB_META`.
- `FrontEnd/src/features/Admin/AdminPanel.tsx` — added `AiConfiguration` import and conditional render.
- `FrontEnd/tests/features/Admin/useAdminPanel.test.ts` — updated Master's expected sub-tab list to include `'ai-configuration'`.

## Change Log

- 2026-08-11: Story implemented — `ai-configuration` Admin sub-tab added; AI Task Configuration table built against mock data with per-row independent save, hook-boundary data access (`useAiTaskConfig`), and icon+text budget-threshold warning with `aria-describedby`. All ACs covered by tests; full suite green (294/294); no regressions.
- 2026-08-11: Addressed code review findings — 7 items resolved (select dropdowns, budget-threshold validation, `role="group"` accessibility fix, `type="button"`, save-confirmation feedback, under-threshold test, stale comment). Full suite green (304/304); no regressions.
- 2026-08-11: Re-review confirmed all 7 fixes hold; addressed 4 new issues the fixes themselves introduced (unmount timer leak, stale "Saved!" state, missing `aria-live`, untyped provider/model options) plus 2 new tests. 1 item deferred (fallback/primary distinctness), 6 dismissed as non-issues after verification. Full suite green (314/314); no regressions. Story closed to `done`.
