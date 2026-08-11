---
baseline_commit: a1519bbfd2d31406dd1949e5ab47875246c6b371
---

# Story 1.3: Admin Tag Management UI (Mock Data)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want a Tag Management screen with add/rename/deactivate/search against mock data,
so that the CRUD flow can be validated before backend wiring exists (Story 1.9 wires this to real data).

## Acceptance Criteria

1. This screen renders inside the existing Admin panel as a new `tag-management` sub-tab, visible to **both** `Master` and `Support` roles — unlike `ai-configuration` (Story 1.1), which is Master-only. [Source: epics.md Story 1.3; EXPERIENCE.md Information Architecture "Admin" row: "Tag Management is available to Support as well as Master... since tag hygiene is routine vocabulary upkeep, not a cost lever"]
2. The screen reuses the existing `MasterDataTable` list/search/CRUD shell component (`FrontEnd/src/features/Admin/MasterDataTable.tsx`) — not a hand-rolled table. It is instantiated for a `Tag` entity the same way `MasterDataManager.tsx` instantiates it for Country/State/City/etc. [Source: epics.md Story 1.3; EXPERIENCE.md "Tag Management table" row: "Same list/search/CRUD shell as {components.card-section}-based Admin tables elsewhere (e.g. Master Data), not a new pattern"; UX-DR18]
3. Adding a tag whose name matches an existing tag's name — case-insensitively, whether that existing tag is active or inactive — is rejected with a clear inline error, not silently accepted or silently ignored. [Source: epics.md Story 1.3; FR-26: "Attempting to create a tag with a name matching an existing (active or deactivated) tag, case-insensitively, is rejected"]
4. Deactivating a tag (via `MasterDataTable`'s existing Active/Inactive toggle — no new UI needed) shows it as inactive/non-selectable but keeps it visible in the list, not removed. [Source: epics.md Story 1.3; FR-26]
5. A search input filters the visible tag list by name (case-insensitive, substring match), client-side only — no network call. [Source: epics.md Story 1.3: "against mock data"; FR-26 "search"]
6. Data access goes through mock `fetchAll`/`create`/`update` functions matching `MasterDataTable`'s existing async (Promise-returning) prop shape — the same shape every other entity in `MasterDataManager.tsx` already uses for its real backend calls. Story 1.9 swaps only these three function *implementations* (mock closures → real `tagsService.ts` calls); `MasterDataTable` itself and this story's component code never change. [Source: epics.md Story 1.3 "Parallelization note" + hook-boundary AC; AD-1 — note: this story satisfies the hook-boundary intent via `MasterDataTable`'s existing prop-injection contract rather than a new custom hook; see Dev Notes]

## Tasks / Subtasks

- [x] Task 1: Add the `tag-management` admin sub-tab (AC: #1)
  - [x] In `FrontEnd/src/features/Admin/useAdminPanel.ts`: add `'tag-management'` to the `AdminSubTab` union type and to `ALL_SUB_TABS` (Master's array). **Also** add `'tag-management'` to Support's array (currently `['tutor-approvals']` → `['tutor-approvals', 'tag-management']`) — unlike Story 1.1's `ai-configuration`, this one is Master **and** Support. Add an `ADMIN_SUBTAB_META['tag-management']` entry (label: "Tag Management", pick a `lucide-react` icon not already used by the other 5 entries, e.g. `Tags` or `Tag`).
  - [x] In `FrontEnd/src/features/Admin/AdminPanel.tsx`: add `{activeSubTab === 'tag-management' && <TagManagement />}` alongside the existing 5 conditional renders (4 original + `ai-configuration` from Story 1.1), following the exact same pattern.
- [x] Task 2: Build the mock tag data + async mock functions (AC: #3, #5, #6)
  - [x] Create `FrontEnd/src/features/Admin/TagManagement/TagManagement.tsx` (or `FrontEnd/src/features/Admin/TagManagement.tsx` if a single file is simple enough — use judgment given `MasterDataTable` does most of the work here).
  - [x] Define a `Tag` type: `{ id: string; name: string; isActive: boolean }`. Seed an in-memory mock array of 5-8 tags (mix of active and inactive) with `useState`.
  - [x] `fetchAll`: returns `Promise.resolve(...)` of the mock array filtered by the current search query (case-insensitive substring match on `name`). Wrap in `useCallback` keyed on the search query state and the mock data state — `MasterDataTable` re-triggers its internal `load()` whenever the `fetchAll` reference changes (confirmed by reading `MasterDataTable.tsx`: `load` is `useCallback` keyed on `[fetchAll]`, and a `useEffect` keyed on `[load]` calls it), so this is how search re-filtering wires up without modifying `MasterDataTable` itself. **Implementation note:** `fetchAll` is keyed only on `searchQuery` (not on the tags array) — see Completion Notes for why keying it on `tags` as well caused a real bug.
  - [x] `create`: validates the new name against every existing tag's name (active or inactive), case-insensitively; if a duplicate, `throw new Error('A tag with this name already exists.')` (`MasterDataTable`'s existing `handleCreate` already catches thrown `Error`s and surfaces `err.message` as the form's inline error — no new error-display UI needed). Otherwise appends to mock state and resolves with the created `Tag`.
  - [x] `update`: flips `isActive` (and/or updates `name`, for a rename) on the matching mock tag and resolves with the updated `Tag`. `MasterDataTable`'s existing Active/Inactive toggle already calls this for deactivation — no new toggle UI needed.
- [x] Task 3: Wire up `MasterDataTable` (AC: #2, #3, #4, #5)
  - [x] Instantiate `<MasterDataTable<Tag, { name: string }, { name: string; isActive: boolean }> entityLabel="Tag" fetchAll={...} create={...} update={...} columns={[{ key: 'name', label: 'Name' }]} fields={[{ key: 'name', label: 'Name', type: 'text' }]} buildCreatePayload={(v) => ({ name: v.name })} buildUpdatePayload={(_row, isActive, v) => ({ name: v.name, isActive })} />` — copy `MasterDataManager.tsx`'s Country instantiation (~line 151-168) as the direct template; a Tag has only one field (`name`), no parent scoping, no extra fields.
  - [x] Add a search `<input>` above the `<MasterDataTable>`, styled with `{components.input}` (same classes as `MasterDataManager.tsx`'s existing `selectClassName`-family inputs), bound to the search-query state that `fetchAll` depends on.
- [x] Task 4: Tests (AD-5)
  - [x] `FrontEnd/tests/features/Admin/TagManagement/TagManagement.test.tsx` (or matching wherever Task 2 places the component): render test asserting seeded tags appear; adding a duplicate name (case-insensitive) shows an inline error and does not add a row; deactivating a tag keeps it visible but marked inactive; typing in the search box narrows the visible rows.
  - [x] `FrontEnd/tests/features/Admin/useAdminPanel.test.ts`: extend the existing Master/Support tests — Master's `availableSubTabs` now includes `'tag-management'` (6 total), and **Support's now includes `'tag-management'` too** (`['tutor-approvals', 'tag-management']`, not just `['tutor-approvals']`) — this is the one sub-tab Support gains access to; get this test update right, it's the crux of AC #1.
  - [x] Import via `@/src/*` absolute alias, per AD-5 — no relative `../../../` chains.

## Dev Notes

- **Deliberate deviation from the "custom hook" pattern used in Stories 1.1/1.2:** those stories introduced `useAiTaskConfig()`/`useAiUsage()`, purpose-built hooks. This story instead reuses `MasterDataTable`'s existing `fetchAll`/`create`/`update` async-prop contract — the same contract every other Admin entity (Country, State, City, Board, ClassLevel, Subject) already uses for its *real* backend calls in `MasterDataManager.tsx`. That contract already is the swap-point AD-1 asks for: Story 1.9 changes only what `fetchAll`/`create`/`update` *do* internally (mock closures → real `tagsService.ts` HTTP calls), never `MasterDataTable.tsx` or this story's JSX. Don't introduce a `useTags()` wrapper hook around this — it would just add a layer between the component and the exact prop shape `MasterDataTable` already expects.
- **`MasterDataTable` has no built-in search** (confirmed by reading the file in full — no `search`/`filter` logic exists in it). Search is achieved entirely by making the `fetchAll` prop's *identity* change when the search query changes (via `useCallback` deps) — `MasterDataTable` already re-runs `load()` whenever `fetchAll` changes. This is the mechanism, not a modification to `MasterDataTable` itself.
- **Do not touch `MasterDataTable.tsx`.** It's a shared, generic, already-tested component used by 6 other entities. This story is a new *consumer* of it, not a change to it.
- **7 AI Tasks / `ai-configuration` context does not apply here** — this story is unrelated to Stories 1.1/1.2/1.4-1.8's AI Service Layer work; Tag Management is net-new, FR-26-only work, explicitly *not* an extension of the taxonomy Master Data scaffold (per the PRD's own note) even though it reuses that scaffold's *table component*.
- **Duplicate-check scope:** "case-insensitive, active or inactive" per AC #3 — check against the full mock array, not just currently-visible (search-filtered) rows.

### Project Structure Notes

- New files only, except the two listed in Task 1 (`useAdminPanel.ts`, `AdminPanel.tsx`) — both already modified once by Story 1.1 (now have 5 sub-tabs); this story adds a 6th. Read both files in full before editing; do not restructure existing logic.
- Follows the same feature-folder convention as Stories 1.1/1.2's `AiConfiguration/` subfolder — this story's own `TagManagement/` (or single-file `TagManagement.tsx`) subfolder under `FrontEnd/src/features/Admin/`.
- Naming conventions unchanged: `PascalCase.tsx` components, `camelCase.ts` types/hooks. [Source: architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md "Consistency Conventions" table]
- New backend feature folder this anticipates (Story 1.9, not this story): `Domain/Tags/` + `Application/Tags/` + `Api/Controllers/TagsController.cs` (Backend architecture spine, "New backend feature folders" note) — net-new, not an extension of the taxonomy master-data scaffold.

### References

- [Source: _specs/planning-artifacts/epics.md — Epic 1, Story 1.3 (full AC + Dev Notes context, "Parallelization note")]
- [Source: _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/EXPERIENCE.md — Information Architecture "Admin" row (Support access rationale); Component Patterns "Tag Management table" row]
- [Source: _specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md — FR-26 (full AC text: duplicate prevention, deactivation semantics)]
- [Source: FrontEnd/src/features/Admin/MasterDataTable.tsx — the exact `fetchAll`/`create`/`update`/`columns`/`fields`/`buildCreatePayload`/`buildUpdatePayload` prop contract to match; confirmed no built-in search exists; confirmed `handleCreate` catches thrown `Error`s and surfaces `err.message` as `formError`]
- [Source: FrontEnd/src/features/Admin/MasterDataManager.tsx (~line 151-168) — the Country entity's `<MasterDataTable>` instantiation, the direct template to copy for Tag (single field, no parent scoping)]
- [Source: FrontEnd/src/features/Admin/useAdminPanel.ts — existing `AdminSubTab` union, `ALL_SUB_TABS`, Support's array, `ADMIN_SUBTAB_META`, role-gating logic to extend]
- [Source: FrontEnd/src/features/Admin/AdminPanel.tsx — existing sub-tab conditional-render pattern]

## Previous Story Intelligence

Story 1.2 (`1-2-admin-ai-usage-cost-dashboard-mock-data.md`, status: done — both 1.1 and 1.2 passed a full re-review with zero open items):

- **Pattern that worked well across both prior stories and their re-reviews:** citing exact file:line references for existing code to copy, rather than describing a pattern abstractly. Carried into this story's References section (`MasterDataManager.tsx` ~line 151-168).
- **Caught in both prior stories' reviews, apply here:** any dynamic content that appears/disappears (a validation error, a status change) should be genuinely accessible — `MasterDataTable`'s existing `formError` display and toast-on-success (`useToast`) were already built with this in mind (confirmed by reading the file), so this story doesn't need to invent new accessibility handling, just not break what's already there.
- **Caught in both prior stories' reviews:** don't leave a claimed "resolved" state unverified by a real test — every AC in this story that has a testable behavior (duplicate rejection, deactivation, search filtering, Support access) has a corresponding Task 4 test line, not just a code claim.
- **New for this story, not present in 1.1/1.2:** this is the first story in the epic reusing an *existing generic component* (`MasterDataTable`) rather than building a bespoke one from scratch. Read that component fully before writing any new code — Dev Notes above already did this reading and recorded what matters (no built-in search, `fetchAll`-identity-triggers-reload, thrown-Error-becomes-form-error).

### Review Findings

- [x] [Review][Patch] `tagsRef` staleness lets creating a tag with the Add form's "Active" toggle unchecked surface a spurious "Tag not found" error (and silently ignore the intended Inactive state) [FrontEnd/src/features/Admin/TagManagement/TagManagement.tsx:41-76] — `MasterDataTable.handleCreate` calls `create()` then, when `formIsActive` is false, immediately `await update(created.id, ...)` in the same async chain. `tagsRef.current` was only kept in sync by a passive `useEffect`, which had not run yet by the time `update()` looked up the just-created id, so `update()` hit its "not found" branch. None of the 5 existing tests exercised this path. **Fixed:** `tagsRef` is now a plain ref (not synced from `tags` state at all — `tags` state was removed entirely) updated imperatively inside `create()`/`update()` themselves, so the very next call always sees the latest data regardless of React's render/effect timing. New regression test added.
- [x] [Review][Patch] Stale role-gating doc comment in `useAdminPanel.ts` [FrontEnd/src/features/Admin/useAdminPanel.ts:41-42] — says "Master sees all 5 admin sections" (should be 6, now that `tag-management` is added) and "Support sees Tutor Approvals only" (Support's array now also includes `tag-management`, which is this story's own AC #1 crux). **Fixed:** comment now says "6 admin sections" and "Support sees Tutor Approvals and Tag Management".
- [x] [Review][Patch] Search input re-triggers `MasterDataTable`'s full `isLoading` reload cycle on every keystroke, no debounce [FrontEnd/src/features/Admin/TagManagement/TagManagement.tsx:45-50] — `fetchAll`'s `useCallback` is keyed on raw `searchQuery`, so each keystroke changes its identity and re-fires `MasterDataTable`'s `load()`, flashing the whole table to its "Loading..." row on every character typed. **Fixed:** added a 250ms debounce (`debouncedSearchQuery`) between the search `<input>` and `fetchAll`'s dependency array.
- [x] [Review][Patch] `TagManagement.test.tsx`'s duplicate-rejection test doesn't assert the table's total row count stayed the same, only that "Algebra" text count is 1 [FrontEnd/tests/features/Admin/TagManagement/TagManagement.test.tsx:16-28]. **Fixed:** added a `getAllByRole('row')` count assertion (8 = 7 seeded tags + header).
- [x] [Review][Patch] `TagManagement.test.tsx`'s "accepts adding a new, non-duplicate tag" test doesn't assert the created row's Active status [FrontEnd/tests/features/Admin/TagManagement/TagManagement.test.tsx:30-40]. **Fixed:** test now asserts the new row shows the "Active" pill.
- [x] [Review][Defer] Tag Management's (and `ai-configuration`'s) role-gating is hardcoded in `useAdminPanel.ts` rather than routed through the `FeatureKeys`/`RoleVisibilityManager` system that governs every other admin capability [FrontEnd/src/features/Admin/useAdminPanel.ts:53-56] — deferred, pre-existing pattern established by Story 1.1, not introduced by this story; architecture-level question, not a mock-data-UI-story fix.
- [x] [Review][Defer] No test exists for `AdminPanel.tsx`'s sub-tab conditional-render wiring itself (no `AdminPanel.test.tsx` in the repo at all) [FrontEnd/src/features/Admin/AdminPanel.tsx] — deferred, pre-existing systemic gap predating this story (Story 1.1's `ai-configuration` branch has the same gap).
- [x] [Review][Defer] Duplicate-name/not-found validation exists only in `TagManagement.tsx`'s mock closures, with nothing guaranteeing Story 1.9's real `tagsService.ts` replicates the same case-insensitive uniqueness rule — deferred, explicitly Story 1.9's responsibility per this story's own Dev Notes.
- [x] [Review][Defer] `nextIdRef`-generated client-side tag IDs (`tag-N`) could collide with server-assigned IDs if Story 1.9's swap isn't done carefully — deferred, Story 1.9 concern, not actionable in a mock-only story.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npx vitest run tests/features/Admin/useAdminPanel.test.ts` — RED (2 failing) before `useAdminPanel.ts` edits, GREEN (4/4) after.
- `npx vitest run tests/features/Admin/TagManagement/TagManagement.test.tsx` — 1 failing (deactivate test) on first pass; root-caused and fixed (see Completion Notes); 5/5 after.
- `npx vitest run` (full suite) — 323/323 passed, 59/59 files, no regressions.
- `npx tsc --noEmit` — no new errors (6 pre-existing errors in `FlashcardsModal.tsx`, unrelated to this story and unmodified by it).

### Completion Notes List

- Implemented Tasks 1-4 exactly as scoped. `MasterDataTable` was not modified.
- **Real bug found and fixed during Task 4 testing, not just a test fix:** the first `TagManagement.tsx` implementation keyed `fetchAll`'s `useCallback` on both `searchQuery` AND the local `tags` array (per Task 2's literal wording). This meant every `create`/`update` mutation (which updates `tags`) also changed `fetchAll`'s identity, which re-triggers `MasterDataTable`'s internal `load()` (full `fetchAll()` + `isLoading` flip) on every single Add/toggle/edit — racing with `MasterDataTable`'s own optimistic local-row patch (its `handleToggleActive`/`handleSaveEdit` deliberately avoid calling `load()` for exactly this reason, per its own comments) and intermittently leaving a row's Active/Inactive toggle stuck mid-transition. Fixed by keying `fetchAll` only on `searchQuery`, and having `fetchAll`/`create`/`update` all read the current tags via a `tagsRef` (kept in sync with `tags` state via a `useEffect`) instead of closing over `tags` directly. `create`/`update` are now fully stable (`useCallback(..., [])`), so `MasterDataTable` only reloads on a genuine search-query change, matching the intended mechanism.
- Used `Tags` (lucide-react) as the sub-tab icon — not previously used by any of the other 5 Admin sub-tabs.
- Duplicate-name check in `create()` runs against the full in-memory tag array (active and inactive), per AC #3.
- Did not introduce a `useTags()` hook — see Dev Notes' "Deliberate deviation" note, which this implementation follows as written.
- **Code review (2026-08-11):** 3-layer adversarial review (Blind Hunter, Edge Case Hunter, Acceptance Auditor) found 5 patch, 4 defer, 7 dismiss (2 dismissed as already guarded by `MasterDataTable`'s own required-field validation; 1 dismissed per spec — rename has no duplicate check by design; 1 dismissed as a double-submit race already guarded by `MasterDataTable`'s Save-disabled-while-saving; 1 dismissed as out-of-scope, belonging to Story 1.1's already-closed `ai-configuration` work, not this diff; 1 dismissed as a no-delete-capability question already out of scope per FR-26's text; 1 dismissed as a comment nitpick). Applied all 5 patches: (1) fixed the real `tagsRef`-staleness bug (create-with-Active-unchecked → false "Tag not found" error — replaced the passive-`useEffect`-synced ref with one updated imperatively inside `create()`/`update()`, and removed the now-redundant `tags` state entirely), (2) fixed the stale role-gating doc comment, (3) added a 250ms debounce to the search input to stop it flashing the table to "Loading..." on every keystroke, (4)+(5) strengthened two tests (row-count assertion on duplicate rejection; Active-status assertion on create) and added a new regression test for the Active-toggle-unchecked create path. Full suite re-verified green (324/324) after patches.

### File List

- `FrontEnd/src/features/Admin/useAdminPanel.ts` (modified — `tag-management` sub-tab: union type, `ALL_SUB_TABS`, Support's array, `ADMIN_SUBTAB_META`)
- `FrontEnd/src/features/Admin/AdminPanel.tsx` (modified — `TagManagement` import + conditional render)
- `FrontEnd/src/features/Admin/TagManagement/TagManagement.tsx` (new)
- `FrontEnd/tests/features/Admin/useAdminPanel.test.ts` (modified — Master 6-tab / Support 2-tab expectations)
- `FrontEnd/tests/features/Admin/TagManagement/TagManagement.test.tsx` (new)

## Change Log

- 2026-08-11: Story implemented (Tasks 1-4), full regression suite green (323/323), status set to `review`.
- 2026-08-11: Code review complete — 5 patches applied (real `tagsRef` staleness bug fixed, stale comment fixed, search debounced, 2 tests strengthened + 1 new regression test), 4 items deferred, 7 dismissed. Full regression suite green (324/324). Status set to `done`.
