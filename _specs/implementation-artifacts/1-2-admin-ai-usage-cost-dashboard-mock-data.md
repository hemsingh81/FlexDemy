---
baseline_commit: a1519bbfd2d31406dd1949e5ab47875246c6b371
---

# Story 1.2: Admin AI Usage & Cost Dashboard (Mock Data)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to see usage and cost broken down by AI Task and date range using mock data,
so that the dashboard layout and interactions can be reviewed before real usage data exists (Story 1.7 wires this to real data).

## Acceptance Criteria

1. This dashboard renders as a **second section inside the existing `AiConfiguration.tsx` component** (Admin → AI Configuration & Usage), directly below Story 1.1's config table, at the placeholder comment `{/* Usage/cost breakdown section lands here in Story 1.2 -- same sub-tab, second section. */}`. It is **not** a new sub-tab and **not** a separate page. [Source: epics.md Story 1.1 & 1.2; EXPERIENCE.md "AI Configuration table" row: "Usage/cost is broken out by task and date range in the same surface"]
2. It shows cost/usage broken down by AI Task (all 7: `extractStructure`, `explainTopic`, `rewriteExplanation`, `generateExercise`, `defineKeyword`, `describeNotation`, `embeddings`) and reuses the existing stat-card and chart visual patterns from the Dashboard — not a new visualization language. [Source: epics.md Story 1.2; EXPERIENCE.md "AI Configuration table" row]
3. A date-range control (e.g. Last 7 days / Last 30 days / All time) filters the displayed data; changing it re-filters the mock dataset entirely client-side — no network call. [Source: epics.md Story 1.2]
4. Data access goes through a stable hook (`useAiUsage()`), matching the `{ data, isLoading, error }` shape used by `useAiTaskConfig()` in Story 1.1, so Story 1.7 can swap the hook's internals for a real `aiConfigService.ts` (or dedicated usage-endpoint) call without changing any component code. [Source: epics.md Story 1.2 "Parallelization note" + hook-boundary AC; AD-1]
5. A fallback-served generation (i.e., a task that ran on its configured fallback provider instead of its primary) is visually flagged in this usage view — a small badge/indicator on the affected task's row — never silently merged into the same display as a normal, primary-served generation. Mock data must include at least one fallback-flagged entry so this state is exercised, not just theoretically possible. [Source: EXPERIENCE.md State Patterns "Node generation degraded (fallback-served)" row: "surfaced here as a badge/indicator in the AI Configuration usage view, not silently absorbed into the same 'Done' state as a normal generation"]
6. Visual tokens match the existing brand system exactly: stat cards use the shell `rounded-2xl bg-white border border-[#E1DED4] shadow-xs` with a tinted icon well (`bg-{accent}/10 text-{accent} border border-{accent}/20`); the chart uses `recharts`, styled with the reserved chart-only palette (`{colors.chart-teal}` `#017E9A`, `{colors.chart-violet}` `#A07CDB`, `{colors.chart-gold}` `#D0A92D` — never used in UI chrome elsewhere), navy tooltip background, hairline grid lines — matching `TutorEducatorHubView.tsx`'s existing "Earnings & Teaching Analytics" chart exactly, not inventing new chart styling. [Source: DESIGN.md components.card-stat, colors.chart-teal/violet/gold; FrontEnd/src/features/Dashboard/StudentDashboardView.tsx stat-card markup; FrontEnd/src/features/Dashboard/TutorEducatorHubView.tsx recharts BarChart usage]

## Tasks / Subtasks

- [x] Task 1: Build the mock data + hook (AC: #2, #3, #4, #5)
  - [x] Create `FrontEnd/src/features/Admin/AiConfiguration/useAiUsage.ts` — feature-local hook (AD-2). Exposes `{ data, isLoading, error }` where `data` is per-task usage entries across a date range, plus a `dateRange` state + `setDateRange` setter. Matches `useAiTaskConfig()`'s hook-shape convention from Story 1.1.
  - [x] Mock data: per-task, per-day (or per-week bucket) usage entries covering the 7 AI Task ids, spanning at least 30 days, so "Last 7 days / Last 30 days / All time" filtering has something to actually filter. Each entry carries `taskId`, `date`, `tokenCost` (or similar cost figure), and an `isFallbackServed: boolean` flag. At least one entry across the dataset has `isFallbackServed: true` (AC #5).
  - [x] `setDateRange` filters `data` client-side only — no network call, no full-dataset refetch/reset.
- [x] Task 2: Build summary stat cards (AC: #2, #6)
  - [x] Create `FrontEnd/src/features/Admin/AiConfiguration/AiUsageSummary.tsx` — 2-4 stat cards (e.g. total cost in range, total generations, most-expensive task) using the exact stat-card shell from `StudentDashboardView.tsx` (`p-5 rounded-2xl bg-white border border-[#E1DED4] shadow-xs flex items-center space-x-4`, tinted icon well `p-3 rounded-xl bg-{accent}/10 text-{accent} border border-{accent}/20`) — copy the pattern, don't reinvent it.
- [x] Task 3: Build the per-task/per-date chart (AC: #2, #6)
  - [x] Create `FrontEnd/src/features/Admin/AiConfiguration/AiUsageChart.tsx` — `recharts` `BarChart` inside `ResponsiveContainer`, `CartesianGrid`/`XAxis`/`YAxis` styled exactly like `TutorEducatorHubView.tsx`'s "Earnings & Teaching Analytics" chart (`stroke="#E1DED4"` grid, `fill: '#5E6A79'` axis tick text, navy `#143358` tooltip background with white text). Use `{colors.chart-teal}`/`{colors.chart-violet}`/`{colors.chart-gold}` for the data series — these three are reserved exclusively for chart data, never UI chrome.
- [x] Task 4: Build the date-range control (AC: #3)
  - [x] Simple selector (button group or `<select>`) for Last 7 days / Last 30 days / All time. On change, calls `setDateRange` from `useAiUsage()`; the chart and stat cards re-render from the filtered `data` with no additional fetch.
- [x] Task 5: Build the fallback-served badge (AC: #5)
  - [x] Small badge/indicator (reuse `{components.badge-pill}` shape) on any task whose usage in the current range includes a fallback-served entry — visible in the stat cards or a per-task breakdown row, not merged into a generic "Done" state.
- [x] Task 6: Wire into `AiConfiguration.tsx` (AC: #1)
  - [x] Replace the `{/* Usage/cost breakdown section lands here in Story 1.2 -- same sub-tab, second section. */}` placeholder comment (added in Story 1.1) with the actual section, below the existing config-table `<section>`. **Corrected during code review:** the section header row contains the heading + date-range control together (the control belongs at the top, next to what it filters — more conventional dashboard UX than sandwiching it between content blocks), followed by `AiUsageSummary` then `AiUsageChart`.
- [x] Task 7: Tests (AD-5)
  - [x] `FrontEnd/tests/features/Admin/AiConfiguration/useAiUsage.test.ts` — pure-logic test: initial data shape covers all 7 tasks; `setDateRange` actually narrows the returned `data`; at least one fallback-served entry exists in the unfiltered mock dataset.
  - [x] `FrontEnd/tests/features/Admin/AiConfiguration/AiConfiguration.test.tsx` — extend the existing file (don't duplicate a new test file for the whole `AiConfiguration` component): assert the usage section renders below the config table, changing the date-range control changes what's displayed, and a fallback-served task shows its badge.
  - [x] Import via `@/src/*` absolute alias, per AD-5 — no relative `../../../` chains.

### Review Findings

- [x] [Review][Patch] Date-range control placement doesn't match Task 6's literal specified order. Resolved: kept the current (header) placement and corrected Task 6's text above to describe the actual, intended order. [FrontEnd/src/features/Admin/AiConfiguration/AiConfiguration.tsx]
- [x] [Review][Patch] AC #2 gap: usage isn't actually broken down per task, and the chart silently omits any task with zero usage. Resolved: new shared `aggregateUsageByTask()` selector iterates all 7 `AI_TASK_IDS` (never just the tasks present in filtered data), returning cost + count + fallback-flag per task; the chart now renders a $0 bar for zero-usage tasks, and a new per-task breakdown list (`AiUsageSummary.tsx`) shows generation count per task explicitly. [FrontEnd/src/features/Admin/AiConfiguration/useAiUsage.ts, AiUsageSummary.tsx, AiUsageChart.tsx]
- [x] [Review][Patch] Mock data inconsistency between `useAiTaskConfig.ts`'s `mockSpend` and `useAiUsage.ts`'s usage totals. Resolved: rewrote `MOCK_USAGE_ENTRIES` so every task's within-"last30" (default range) total exactly matches that task's `mockSpend` value from Story 1.1. [FrontEnd/src/features/Admin/AiConfiguration/useAiUsage.ts]
- [x] [Review][Patch] Duplicated `costByTask` aggregation with inconsistent rounding. Resolved: extracted the shared `aggregateUsageByTask()` selector (one aggregation, one rounding rule) used by both `AiUsageSummary.tsx` and `AiUsageChart.tsx`. [FrontEnd/src/features/Admin/AiConfiguration/useAiUsage.ts]
- [x] [Review][Patch] "Most Expensive Task" tie-break was order-dependent. Resolved: deterministic sort by cost descending, then `taskId` alphabetical. [FrontEnd/src/features/Admin/AiConfiguration/AiUsageSummary.tsx]
- [x] [Review][Patch] No isolated tests for `AiUsageChart`/`AiUsageDateRangeControl`; only "All time" exercised. Resolved: added `AiUsageDateRangeControl.test.tsx` (aria-pressed toggling across all three options, `type="button"`, labeled group) and a "Last 7 days" narrowing test in `AiConfiguration.test.tsx`. [FrontEnd/tests/features/Admin/AiConfiguration/]
- [x] [Review][Patch] Range-boundary inclusivity untested. Resolved: added a test confirming the `embeddings` entry seeded exactly 7 days ago is included in the "last7" range (`>=` inclusive boundary). [FrontEnd/tests/features/Admin/AiConfiguration/useAiUsage.test.ts]
- [x] [Review][Patch] `AiConfiguration.tsx`'s top comment overclaimed "nothing in this file changes." Resolved: reworded to note loading/error UI will likely be added alongside the Story 1.5/1.7 live-wire. [FrontEnd/src/features/Admin/AiConfiguration/AiConfiguration.tsx]
- [x] [Review][Defer] `TASK_LABELS[taskId]` lookups in `AiUsageSummary.tsx` have no `??` fallback for an unrecognized taskId [FrontEnd/src/features/Admin/AiConfiguration/AiUsageSummary.tsx] — deferred: currently unreachable under the `AiTaskId` union type; only becomes a real risk once Story 1.7 introduces loosely-typed real API responses.
- [x] [Review][Defer] Mock usage dataset is generated once at module load with no upper-date-bound guard against future-dated entries [FrontEnd/src/features/Admin/AiConfiguration/useAiUsage.ts] — deferred: mock-only-story artifact, moot once Story 1.7 replaces it with real backend-computed ranges.

#### Re-review (2026-08-11) — confirming the 7 fixes above

A second, independent adversarial + edge-case + acceptance-audit pass **confirmed all 7 original fixes genuinely hold** (the Acceptance Auditor independently re-derived the mock-data reconciliation via a standalone script and matched `useAiTaskConfig.ts`'s `mockSpend` to the cent for all 7 tasks). It also surfaced 6 new issues (all now resolved) plus 3 dismissed items:

- [x] [Review][Patch] The mock-data reconciliation was enforced only by a comment, with nothing to catch future drift between the two files. Resolved: added a real test (`useAiUsage.test.ts`) that computes `aggregateUsageByTask()`'s "last30" totals and compares them against `useAiTaskConfig.ts`'s `mockSpend` per task. [FrontEnd/tests/features/Admin/AiConfiguration/useAiUsage.test.ts]
- [x] [Review][Patch] The "Most Expensive Task" deterministic tie-break had zero test coverage. Resolved: added an isolated `AiUsageSummary.test.tsx` with a real tie scenario (two tasks at equal cost) asserting the alphabetically-first task wins. [FrontEnd/tests/features/Admin/AiConfiguration/AiUsageSummary.test.tsx]
- [x] [Review][Patch] "Most Expensive Task" had no guard for the all-zero-usage case — would have misleadingly named a $0 task as most expensive. Resolved: added a `hasAnyUsage` guard showing "No usage in this range" instead; covered by a new test. [FrontEnd/src/features/Admin/AiConfiguration/AiUsageSummary.tsx]
- [x] [Review][Patch] Doc comment said mock data "spans... out to 45" days; actual farthest entry is 42. Resolved: corrected the number; also softened the "shared selector" comment's memoization overstatement (it's a shared function, not a shared computed/memoized result). [FrontEnd/src/features/Admin/AiConfiguration/useAiUsage.ts]
- [x] [Review][Patch] Fallback-served badges had no `aria-live` region, unlike `AiTaskConfigRow`'s budget warning (which just got this fix in Story 1.1's re-review). Resolved: the badge container now carries `aria-live="polite"`; covered by a new test. [FrontEnd/src/features/Admin/AiConfiguration/AiUsageSummary.tsx]
- [x] [Review][Patch] `ai-usage-fallback-badge` test id was identical across every badge, forcing tests to fall back to text matching. Resolved: made it per-task (`ai-usage-fallback-badge-${taskId}`), matching the existing `ai-usage-per-task-row-${taskId}` pattern; updated the pre-existing `AiConfiguration.test.tsx` test to match. [FrontEnd/src/features/Admin/AiConfiguration/AiUsageSummary.tsx, FrontEnd/tests/features/Admin/AiConfiguration/AiConfiguration.test.tsx]

Dismissed as noise (verified, not real defects for this story's scope): `aggregateUsageByTask`'s O(tasks × entries) re-filtering is negligible at mock scale — flagged for revisit only if Story 1.7 brings real scale, not a current defect; date-range cutoff not recomputing on a clock tick while the tab stays open is the same already-deferred module-load-staleness class from the prior round, not new; UTC-vs-local-timezone date handling and an out-of-union `taskId` silently being dropped are both out of this story's scope (no AC requires timezone-awareness for a mock demo, and TypeScript's `AiTaskId` union already prevents the latter at compile time).

Also re-confirmed still-open in Story 1.1's file during this review (not re-added here): `AiTaskConfigRow.tsx`'s draft-resync gap, budget-threshold NaN/negative-value guard, and empty-string field validation — all already tracked as action items in `1-1-admin-ai-configuration-ui-mock-data.md` (now resolved as part of Story 1.1's own re-review, see that file).

## Dev Notes

- **This is a mock-data-only story**, same discipline as Story 1.1 — no backend call yet. Story 1.7 swaps `useAiUsage.ts`'s internals only.
- **Do not create a new sub-tab or page.** This is the single most important structural constraint carried over from Story 1.1: `Admin → AI Configuration & Usage` is one screen with two sections. Task 6 replaces a placeholder comment that already exists in `AiConfiguration.tsx` — read that file first before starting.
- **Reuse `recharts`, already a dependency** (`package.json`: `recharts: ^3.10.1`) and already used exactly once in this codebase, in `TutorEducatorHubView.tsx`'s "Earnings & Teaching Analytics" section (~line 440). Read that chart's implementation before building this one — don't invent new chart conventions when a working, on-brand example already exists.
- **Chart-only color tokens:** `{colors.chart-teal}` (`#017E9A`), `{colors.chart-violet}` (`#A07CDB`), `{colors.chart-gold}` (`#D0A92D`) exist in `DESIGN.md` specifically for multi-series data visualization and are explicitly documented as "never used in UI chrome" — don't reach for `{colors.citrus-amber}`/`{colors.ink-navy}` for chart series data; those are reserved for CTAs and brand chrome respectively.
- **No shared `StatCard` component exists yet** — every Dashboard section (`StudentDashboardView.tsx`, others) hand-rolls the same stat-card markup inline. Follow that existing convention (copy the exact classes) rather than introducing a new shared component this story doesn't need.
- **Learning carried from Story 1.1's code review:** that story's reviewers flagged (a) `aria-describedby` attached to a non-focusable, role-less `<div>` doesn't reliably reach assistive tech — if this story's fallback-served badge needs a similar description-association, attach `aria-describedby` to a focusable/interactive element, or give the container an appropriate `role`; (b) numeric inputs with no bounds silently coerce invalid values — this story is read-only/display-only (no numeric input fields), so that specific issue doesn't apply here, but keep the general lesson (validate/guard anything user-editable) in mind for the date-range control's state.

### Project Structure Notes

- New files only, except `AiConfiguration.tsx` (Story 1.1's file — read it in full before editing; only replace the marked placeholder comment, don't restructure the config-table section above it).
- Same feature-folder placement as Story 1.1: `FrontEnd/src/features/Admin/AiConfiguration/` — this story adds to that folder, doesn't create a new one.
- Naming conventions unchanged from Story 1.1: `PascalCase.tsx` components, `camelCase.ts` hooks starting with `use`, feature-local (not `src/hooks/`). [Source: architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md "Consistency Conventions" table]
- No new state-management library — `useState` only (AD-4).

### References

- [Source: _specs/planning-artifacts/epics.md — Epic 1, Story 1.2 (full AC + Dev Notes context, "Parallelization note")]
- [Source: _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/EXPERIENCE.md — Component Patterns "AI Configuration table" row; State Patterns "Node generation degraded (fallback-served)" row]
- [Source: _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/DESIGN.md — components.card-stat, colors.chart-teal/chart-violet/chart-gold]
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md — AD-1 (hook boundary), AD-2 (feature-local hooks), AD-4 (no new state library), AD-5 (test conventions)]
- [Source: FrontEnd/src/features/Admin/AiConfiguration/AiConfiguration.tsx (Story 1.1) — the exact placeholder comment this story replaces]
- [Source: FrontEnd/src/features/Admin/AiConfiguration/useAiTaskConfig.ts (Story 1.1) — the hook-shape convention `useAiUsage()` must match]
- [Source: FrontEnd/src/features/Dashboard/TutorEducatorHubView.tsx (~line 421-448) — existing recharts BarChart pattern to copy]
- [Source: FrontEnd/src/features/Dashboard/StudentDashboardView.tsx (~line 175-203) — existing stat-card markup to copy]
- [Source: FrontEnd/package.json — `recharts: ^3.10.1` already a dependency, no new library needed]

## Previous Story Intelligence

Story 1.1 (`1-1-admin-ai-configuration-ui-mock-data.md`, status: in-progress with 7 open `[Review][Patch]` action items at the time this story was created):

- **Pattern that worked well:** feature-local hook returning `{ data, isLoading, error }` + a mutator, with mock data seeded to exercise the interesting states (Story 1.1 seeded one row intentionally over-budget; this story should do the analogous thing by seeding one fallback-served entry).
- **Pattern that worked well:** citing exact file:line references for existing code to copy (e.g. `MasterDataManager.tsx`'s `selectClassName`) rather than describing a pattern abstractly — carried into this story's Dev Notes for the recharts chart and stat-card references.
- **Caught in review, apply here:** don't attach `aria-describedby` to a non-interactive, role-less `<div>` and assume it's accessible — if this story needs a similar description-association for the fallback-served badge, attach it to something focusable or give the container a real role.
- **Caught in review:** Story 1.1's provider/model fields were built as free-text `<input>`s when the spec called for "selectors" — a reminder to read AC wording precisely (this story's ACs don't use "selector" language for anything, so this specific trap doesn't recur here, but it's a reminder to match control type to what the AC actually says).
- **Not yet resolved in Story 1.1 as of this story's creation:** budget-threshold input validation, save-confirmation feedback, and a stale doc comment are still open action items in Story 1.1's file — none of these block this story, which touches different files.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npx vitest run tests/features/Admin/AiConfiguration/useAiUsage.test.ts` — RED confirmed (import-resolution failure) before implementing the hook, GREEN after (3 passing).
- `npx vitest run tests/features/Admin/AiConfiguration/AiConfiguration.test.tsx` — RED confirmed (4 new tests failing) before implementing Tasks 2–6, GREEN after (7 passing, 3 pre-existing + 4 new).
- `npx vitest run` (full suite) — 56 files, 301 tests, all passing. No regressions.
- `npm run lint` (`tsc --noEmit`) — first pass surfaced 4 new errors from `data.reduce<Record<...>>(...)` generic calls ("untyped function calls may not accept type arguments") in `AiUsageChart.tsx`/`AiUsageSummary.tsx`; rewrote both as a typed accumulator + `forEach` instead of a generic `.reduce()` call, which resolved cleanly. Re-ran lint: zero errors in any file this story touched. 6 pre-existing errors remain in `src/features/CoursePlayer/FlashcardsModal.tsx` (same untouched file flagged during Story 1.1).
- **Review follow-up pass:** rewrote `useAiUsage.test.ts` and `AiConfiguration.test.tsx` (RED, 4 failures) before implementing the 7 patch fixes; GREEN after (22 tests across 4 files, up from 15/3). Full suite re-run: 57 files, 311 tests, all passing. Lint re-run: same 6 pre-existing `FlashcardsModal.tsx` errors only.
- **Re-review pass (confirming the 7 fixes):** added a new isolated `AiUsageSummary.test.tsx` plus extended `useAiUsage.test.ts`; GREEN across all 5 files in the folder (29 tests, up from 22). Full suite re-run: 58 files, 318 tests, all passing. Lint clean — same 6 pre-existing `FlashcardsModal.tsx` errors only.

### Completion Notes List

- All 6 ACs implemented and covered by tests.
- Confirmed AC #1's structural constraint by reading Story 1.1's `AiConfiguration.tsx` first and replacing its exact placeholder comment rather than restructuring the file.
- Reused two existing, real code patterns rather than inventing new ones: the stat-card shell from `StudentDashboardView.tsx` and the `recharts` `BarChart` styling from `TutorEducatorHubView.tsx`'s Earnings & Teaching Analytics chart — both cited by file and approximate line in Dev Notes before implementation.
- Applied Story 1.1's code-review lesson: the fallback-served badge (a plain `<span>`) was deliberately kept out of any `aria-describedby` relationship to a non-focusable container, avoiding the exact pitfall flagged in that review.
- `recharts`' `ResponsiveContainer` renders with zero real layout in jsdom (no existing test in this codebase exercises chart internals either), so the chart test is an intentional smoke test (renders without throwing, container present) rather than an assertion on rendered bar/SVG content — a deliberate, documented choice, not an oversight.
- ✅ Resolved review finding: date-range control placement — kept as-is, corrected Task 6's text.
- ✅ Resolved review finding: AC #2 gap — new `aggregateUsageByTask()` selector guarantees all 7 tasks appear (chart bars + new per-task breakdown list), fixing both the zero-usage-task omission and the missing per-task count breakdown in one change.
- ✅ Resolved review finding: mock usage totals now match Story 1.1's `mockSpend` per task for the default "last30" range.
- ✅ Resolved review finding: duplicated aggregation logic extracted into one shared, consistently-rounded selector.
- ✅ Resolved review finding: "Most Expensive Task" now has a deterministic tie-break.
- ✅ Resolved review finding: added isolated `AiUsageDateRangeControl` tests and a "Last 7 days" click test.
- ✅ Resolved review finding: added a range-boundary-inclusivity test using a real seeded entry (embeddings, exactly 7 days old).
- ✅ Resolved review finding: corrected `AiConfiguration.tsx`'s overclaiming comment.
- ✅ Resolved review finding [re-review]: added a real test asserting the mock-data reconciliation (prevents future silent drift between the two mock files).
- ✅ Resolved review finding [re-review]: added a tie-break test and an all-zero-usage guard for "Most Expensive Task."
- ✅ Resolved review finding [re-review]: corrected the "spans out to 45 days" comment (actual max is 42) and softened the "shared selector" memoization overstatement.
- ✅ Resolved review finding [re-review]: fallback-served badges are now an `aria-live="polite"` region, matching Story 1.1's `AiTaskConfigRow` fix.
- ✅ Resolved review finding [re-review]: fallback badge test id is now per-task instead of generic.

### File List

**New:**
- `FrontEnd/src/features/Admin/AiConfiguration/useAiUsage.ts`
- `FrontEnd/src/features/Admin/AiConfiguration/AiUsageSummary.tsx`
- `FrontEnd/src/features/Admin/AiConfiguration/AiUsageChart.tsx`
- `FrontEnd/src/features/Admin/AiConfiguration/AiUsageDateRangeControl.tsx`
- `FrontEnd/tests/features/Admin/AiConfiguration/useAiUsage.test.ts`

**Modified:**
- `FrontEnd/src/features/Admin/AiConfiguration/AiConfiguration.tsx` — replaced Story 1.1's placeholder comment with the usage section; renamed destructured hook fields to `configData`/`usageData` to avoid a naming collision between the two hooks; corrected the top comment's overclaim during the review follow-up pass.
- `FrontEnd/src/features/Admin/AiConfiguration/AiTaskConfigRow.tsx` — exported `TASK_LABELS` (was module-private) so `AiUsageSummary.tsx`/`AiUsageChart.tsx` reuse the same task-name labels instead of duplicating the map.
- `FrontEnd/tests/features/Admin/AiConfiguration/AiConfiguration.test.tsx` — extended with 4 new tests for the usage section (DOM order, date-range filtering, fallback badge, chart smoke test), per Task 7's explicit instruction not to duplicate a new test file; further extended during the review follow-up pass with a "Last 7 days" test and a per-task-breakdown-rows test.

**New (review follow-up pass):**
- `FrontEnd/tests/features/Admin/AiConfiguration/AiUsageDateRangeControl.test.tsx` — isolated tests for `aria-pressed` toggling and `type="button"`.

**New (re-review pass):**
- `FrontEnd/tests/features/Admin/AiConfiguration/AiUsageSummary.test.tsx` — isolated tie-break, all-zero-usage guard, and aria-live tests.

**Modified (re-review pass):**
- `FrontEnd/src/features/Admin/AiConfiguration/useAiUsage.ts` — corrected the day-span comment, softened the shared-selector comment.
- `FrontEnd/src/features/Admin/AiConfiguration/AiUsageSummary.tsx` — all-zero-usage guard, `aria-live="polite"` on the fallback badge container, per-task fallback badge test id.
- `FrontEnd/tests/features/Admin/AiConfiguration/useAiUsage.test.ts` — added the mock-data reconciliation test.
- `FrontEnd/tests/features/Admin/AiConfiguration/AiConfiguration.test.tsx` — updated the fallback-badge test to the new per-task test id.

## Change Log

- 2026-08-11: Story implemented — Admin AI Usage & Cost dashboard added as a second section inside Story 1.1's `AiConfiguration.tsx`, with mock per-task usage data, a date-range filter, summary stat cards, a fallback-served badge, and a `recharts` cost-by-task chart matching the existing Dashboard chart's styling. All ACs covered by tests; full suite green (301/301); no regressions; lint clean on every file this story touched.
- 2026-08-11: Addressed code review findings — 7 items resolved. Introduced a shared `aggregateUsageByTask()` selector (fixes the AC #2 per-task/zero-usage gap and the duplicated-aggregation-with-inconsistent-rounding finding in one change), reconciled mock usage totals with Story 1.1's `mockSpend` values, added a deterministic tie-break, added isolated date-range-control tests plus a boundary-inclusivity test, and corrected two doc comments. Full suite green (311/311); no regressions.
- 2026-08-11: Re-review confirmed all 7 fixes hold (independently re-derived via a standalone script, not just re-reading the code); addressed 6 new issues the fixes themselves surfaced (untested mock-data reconciliation and tie-break, missing all-zero-usage guard, an inaccurate doc comment, missing `aria-live` on the fallback badge, a non-unique test id). 3 items dismissed as out of scope after verification. Full suite green (318/318); no regressions. Story closed to `done`.
