---
baseline_commit: 6c1d6db28fd9099678d8111e4623a9e4bb0c33e0
---

# Story 6.2: Curated font pairing picker with preview-before-apply

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Master or Support admin,
I want to preview a candidate font pairing and only apply it after confirming,
so that I can change the site's typography without accidentally breaking the brand system or affecting the live site before I'm sure.

## Acceptance Criteria

1. The Settings screen offers a fixed, pre-approved list of Font Pairings for selection — a selectable list, not a free-text field. [Source: prd.md#FR-9]
2. Selecting a candidate pairing renders a live preview, in the Settings screen, against representative site content, with no effect on the live site or any other user. [Source: prd.md#FR-12, NFR-3]
3. Navigating away from a previewed candidate without clicking Apply leaves the stored Value and Effective Value unchanged. [Source: prd.md#FR-13]
4. Clicking Apply becomes the live, site-wide Effective Value on next page load, using only fonts already available to the app, with no rebuild or redeploy. [Source: prd.md#FR-11, FR-13]
5. Any attempt to set the Font setting's Value — via the picker or a direct API call — is rejected server-side (not just in the picker UI) if it isn't one of the currently curated pairing identifiers. [Source: prd.md#FR-10]

## Tasks / Subtasks

- [x] Task 1: Backend — `FontPairingDefinition` domain entity, EF configuration, DbContext, migration, seed (AC: #1, #5)
  - [ ] Create `BackEnd/src/FlexDemy.Domain/Settings/FontPairingDefinition.cs`: `public class FontPairingDefinition : AuditableEntity` with `required string Slug`, `required string DisplayFont`, `required string BodyFont`, `required string MonoFont`. Inherits `AuditableEntity` — confirmed as this codebase's universal pattern for reference/seeded entities (`ErrorRetentionSettings`, `Tag` both do the same, no simpler-POCO exception exists anywhere). Its inherited `IsActive` **is** AD-26's "curated-but-currently-available toggle" — no separate field needed.
  - [ ] Create `BackEnd/src/FlexDemy.Infrastructure/Persistence/Configurations/FontPairingDefinitionConfiguration.cs`, mirroring `SettingConfiguration.cs`'s shape: `ToTable("font_pairing_definitions")`, `HasKey(f => f.Id)`, `HasMaxLength(64)` on `Id`, `HasMaxLength(64)` on `Slug` + `HasIndex(f => f.Slug).IsUnique()`, `HasMaxLength(128)` on `DisplayFont`/`BodyFont`/`MonoFont` (these are full CSS `font-family` value strings like `"Fraunces", Georgia, serif`, not bare names — same format as `index.css`'s own `--font-display` etc.), `HasQueryFilter(f => !f.IsDeleted)`.
  - [ ] Add `DbSet<FontPairingDefinition> FontPairingDefinitions` to `FlexDemyDbContext.cs`.
  - [ ] From `src/FlexDemy.Infrastructure`, run `dotnet ef migrations add AddFontPairingDefinitions --startup-project ../FlexDemy.Api --project .`. Confirm the generated migration only adds the new `font_pairing_definitions` table.
  - [ ] Create `BackEnd/src/FlexDemy.Application/Settings/IFontPairingDefinitionRepository.cs` (interface — same project/folder as `ISettingRepository.cs`) and `BackEnd/src/FlexDemy.Infrastructure/Repositories/FontPairingDefinitionRepository.cs` (implementation — same project/folder as `SettingRepository.cs`, per AD-4: Application defines the interface, Infrastructure implements it against EF Core). `GetAllAsync()` (all rows) and `GetBySlugAsync(string slug)`. Register both in `Infrastructure/DependencyInjection.cs` alongside `ISettingRepository`.
  - [ ] Add `EnsureFontPairingDefinitionsAsync(db, idGenerator, ct)` to `DatabaseSeeder.cs`, called from `SeedAsync` **after** `EnsureSettingsAsync` (last in the sequence). Follow `EnsureTagsAsync`'s per-item (by `Slug`) idempotent pattern, not a blanket skip. Seed **exactly one row**: `Slug = "default"`, `DisplayFont = "\"Fraunces\", Georgia, serif"`, `BodyFont = "\"Outfit\", system-ui, sans-serif"`, `MonoFont = "\"JetBrains Mono\", monospace"` (the app's current hardcoded defaults, verbatim from `index.css`'s `@theme` block) — this is **required**, not optional: `EnsureSettingsAsync` (Story 6.1) already seeded a `Setting` row whose Value is the slug `"default"`, and without a matching `FontPairingDefinition` row, that seeded Setting itself would fail Task 3's curation check. Additional curated pairings beyond this one are a `[NOTE FOR PM]` open item in the PRD (the actual curated list content is still undefined) — do not invent more; one real, correct row is this story's job, not a full curated catalog.

- [x] Task 2: Backend — `GET /api/v1/settings/font-pairings` (AC: #1)
  - [ ] Create `BackEnd/src/FlexDemy.Application/Settings/FontPairingDefinitionDto.cs`: a `FontPairingDefinitionDto(string Slug, string DisplayFont, string BodyFont, string MonoFont, bool IsActive)` record, plus a `ToDto()` mapper extension (own file or added to `SettingMapper.cs` — either is fine, but be consistent with the existing one-mapper-class-per-feature-folder convention rather than starting a second naming scheme).
  - [ ] Add `Task<IReadOnlyList<FontPairingDefinitionDto>> GetFontPairingsAsync(CancellationToken ct)` to `ISettingsService`/`SettingsService` (returns only `IsActive` rows — a decurated pairing shouldn't appear as a picker option, per AD-26's "removing a pairing from the curated list makes it immediately unavailable for new Applies").
  - [ ] Add `[HttpGet("font-pairings")]` to the **existing** `SettingsController` — not a new controller. Exact precedent: `ErrorsController.cs`'s `[HttpGet("retention-settings")]` sub-route on one controller with a class-level `[Route("api/v1/errors")]` — mirror that shape exactly for `[Route("api/v1/settings")]` + `[HttpGet("font-pairings")]`.

- [x] Task 3: Backend — `ApplyAsync` (AC: #4, #5)
  - [ ] Add `Task<SettingDto> ApplyAsync(string id, string value, CancellationToken ct)` to `ISettingsService`/`SettingsService` — this is AD-25's **exclusive** mutation path for a Setting's Value; there is no separate generic update method, now or ever in this story.
  - [ ] Curation check (FR-10, AC #5): before writing, look up the target Setting by `id` (`NotFoundException` if missing). If the Setting's `KeyType == "Font"`, resolve `value` against `IFontPairingDefinitionRepository.GetBySlugAsync` — if no match, or the match's `IsActive` is false, throw `ValidationException` ("not a currently curated font pairing" or similar). This check runs on **every** Apply unconditionally — including when the call is effectively a reactivation (`IsActive` was `false`, now `true`, same `Value`) — there is no separate "skip the check on reactivation" branch; AD-25 requires that "no CRUD or reactivation path can slip a decurated Font pairing back in unchecked," and running the same check every time is how that's satisfied. For any other `KeyType`, apply without a curation check (this story's scope is Font-specific; the curation concept doesn't generalize to hypothetical future KeyTypes yet).
  - [ ] Persist via normal EF change-tracking + one `IUnitOfWork.SaveChangesAsync()` (AD-11) — **not** a raw-SQL atomic `UPDATE...RETURNING`. That pattern doesn't exist anywhere in this codebase yet (confirmed via repo-wide search — no `RETURNING`/`SqlQuery<T>` usage; `AiTaskBudgetRepository.cs`, sometimes cited for AD-18, actually uses a plain conditional `UPDATE ... WHERE ...` checked via affected-row-count, not `RETURNING`) and this story doesn't need it: `SettingChangeHistory`/`OldValue` capture is **Story 6.3** scope, and 6.3 will very likely need to *replace* this method's plain EF-tracked load-validate-save with a hand-written atomic raw-SQL UPDATE to get a "read fresh, not stale" OldValue guarantee — that's a persistence-mechanism rewrite Story 6.3 should expect to do from scratch, not an additive change on top of this one. This story's `ApplyAsync` is simply a normal load-validate-mutate-save service method, matching `ErrorAdminService.UpdateRetentionSettingsAsync`'s shape.
  - [ ] Set `Setting.IsActive = true` as part of Apply (an Apply always results in an active, live setting).

- [x] Task 4: Backend — Apply endpoint (AC: #4, #5)
  - [ ] Add `ApplySettingRequest(string Value)` record (`Application/Settings/`).
  - [ ] Add `[HttpPut("{id}/apply")]` to `SettingsController`, calling `ISettingsService.ApplyAsync(id, request.Value, ct)`, returning the updated `SettingDto`.

- [x] Task 5: Backend tests (AC: all)
  - [ ] `FlexDemy.Application.Tests`: `SettingsServiceTests.cs` additions — `GetFontPairingsAsync` returns only `IsActive` rows; `ApplyAsync` happy path (Font KeyType, valid curated slug) updates Value and sets IsActive true; `ApplyAsync` rejects a non-curated slug with `ValidationException`; `ApplyAsync` rejects a slug belonging to a decurated (`IsActive=false`) `FontPairingDefinition`; `ApplyAsync` on a missing Setting id throws `NotFoundException`; reactivating an already-decurated Value (IsActive false→true, same Value) re-runs the curation check and rejects if that Value's pairing has since been decurated.
  - [ ] `FlexDemy.Infrastructure.Tests`: `FontPairingDefinitionRepositoryTests.cs` — `GetAllAsync`/`GetBySlugAsync` sanity tests using the `InMemory` provider, mirroring `SettingRepositoryTests.cs`'s shape. Do not attempt a unique-index-violation test — same InMemory limitation `SettingRepositoryTests.cs` already documented in Story 6.1 applies here too.
  - [ ] `FlexDemy.Api.Tests`: `SettingsControllerTests.cs` additions — `GetFontPairings` returns 200 with the service result; `ApplySetting` returns 200 with the updated DTO on success, propagates `ValidationException`/`NotFoundException` from the service (mirroring `ErrorsControllerTests`' propagation-test pattern, e.g. `Archive_propagates_ValidationException_from_the_service`).
  - [ ] `FlexDemy.Api.Tests`: `DatabaseSeederSettingsTests.cs` additions (or a new `DatabaseSeederFontPairingDefinitionsTests.cs`, your call) — fresh-DB seed produces the `"default"` `FontPairingDefinition` row; re-running doesn't duplicate it; the seeded `Setting.Value = "default"` (Story 6.1) now resolves against a real `FontPairingDefinition.Slug` after both seeders have run in sequence (a cross-seeder consistency check specific to this story).

- [x] Task 6: Frontend — `settingsService.ts` additions (AC: #1, #4, #5)
  - [ ] Add `FontPairingDefinitionDto` interface (mirroring the backend DTO) and `export const getFontPairings = (): Promise<FontPairingDefinitionDto[]> => get('/api/v1/settings/font-pairings');`.
  - [ ] Add `export const applySetting = (id: string, value: string): Promise<SettingDto> => write(`/api/v1/settings/${encodeURIComponent(id)}/apply`, 'PUT', { value });` — this requires adding the `write` helper (currently only `get` exists in this file from Story 6.1's read-only scope) via the same pattern already in `aiConfigService.ts`.

- [x] Task 7: Frontend — `SiteSettingsContext` (AC: #4)
  - [ ] Create `FrontEnd/src/context/SiteSettingsContext.tsx`, mirroring `DomainContext.tsx`'s exact provider/hook shape (`createContext<SiteSettingsContextValue | undefined>(undefined)`, an exported `SiteSettingsProvider: React.FC<{ children: React.ReactNode }>`, an exported `useSiteSettings()` hook that throws if used outside the provider).
  - [ ] On mount, fetch `settingsService.getSettings()` **and** `settingsService.getFontPairings()`. Find the active (`isActive: true`) Setting with `keyType === 'Font'`; resolve its `value` (a slug) against the fetched font-pairings list to get `DisplayFont`/`BodyFont`/`MonoFont`. If found, call `document.documentElement.style.setProperty('--font-display', displayFont)`, `.setProperty('--font-sans', bodyFont)`, `.setProperty('--font-mono', monoFont)` — these three exact CSS custom-property names, confirmed in `index.css`'s `@theme` block.
  - [ ] **Fail-safe by design, not by accident (NFR-4):** if either fetch fails, or no active Font Setting exists, or its Value doesn't resolve to any fetched font-pairing slug, skip calling `setProperty` entirely — `index.css`'s hardcoded `@theme` values remain in effect. Do not throw, do not block app render.
  - [ ] Expose a `refetch(): void` (or `Promise<void>`) function from the context value, so Task 8's Apply flow can update the *current* admin's own session immediately after a successful Apply, without waiting for a full page reload (NFR-1 only requires this for *other* users on their next page load — refreshing the applying admin's own session immediately is better UX and not a violation of anything).
  - [ ] Mount `<SiteSettingsProvider>` in `App.tsx`'s composition root (`App.tsx:46-54`), alongside `<DomainProvider>`/`<ToastProvider>` — no dependency between them, so nesting order is free; wrap the whole tree the same way the other two do.

- [x] Task 8: Frontend — curated picker, scoped Preview, Apply — extend `Settings.tsx` (AC: #1, #2, #3, #4)
  - [ ] Add a picker UI to the Font KeyType's section in `Settings.tsx`: a `<select>` (or equivalent) populated from `settingsService.getFontPairings()`, listing curated pairing slugs — **a selectable list, never a free-text input** (AC #1).
  - [ ] Selecting a candidate sets local component state (`candidateSlug`) — this does **not** call `applySetting` yet.
  - [ ] Preview area: when a candidate is selected, render sample content (a heading, a body paragraph, a monospace snippet — the mono sample is a deliberate addition beyond the PRD Glossary's "heading/paragraph/card" wording, so the preview actually exercises all three roles of a pairing) inside a wrapper whose **inline** `style` sets `'--font-display'`/`'--font-sans'`/`'--font-mono'` to the candidate pairing's font values (this part must be inline style, not a class — Tailwind can't express a runtime-dynamic value at build time). Give each child element an explicit `font-family` too — either the codebase's existing `font-display`/`font-sans`/`font-mono` Tailwind utility classes (already used in 27+ files, e.g. `TeachingStatsCards.tsx`, and they do compile to `font-family: var(--font-display)` etc., so they scope correctly under the wrapper's override) or inline `style={{ fontFamily: 'var(--font-sans)' }}`, either is fine. This explicit per-child declaration is required for the body/mono roles specifically: `index.css`'s `body { font-family: var(--font-sans); }` rule resolves at the actual `<body>` element, above the preview wrapper in the DOM, so a plain child with no font-family of its own inherits that already-resolved value rather than re-evaluating `var(--font-sans)` locally — it will silently show the site's real global font, not the candidate, unless given its own explicit rule. (The heading role is a partial exception — `index.css`'s `h1, h2, h3, .font-display { font-family: var(--font-display); }` rule re-invokes `var()` at the element itself, so it would pick up the override even without an explicit per-child rule — but declare it explicitly anyway for consistency.) This is genuinely new UI machinery in terms of the *dynamic wrapper override* — no existing scoped-preview pattern exists anywhere in this codebase to mirror for that part; the isolation guarantee comes entirely from **not** touching `document.documentElement` here (that's `SiteSettingsContext`'s job, only triggered by Apply) — satisfies AC #2/NFR-3 by construction, not by convention.
  - [ ] Navigating away (unmounting `Settings.tsx`, or deselecting the candidate) without clicking Apply: since the preview never touched `document.documentElement` or called `applySetting`, nothing needs to be explicitly "discarded" — the stored Value and Effective Value were simply never touched (AC #3 is satisfied by the mechanism's own structure, not an explicit cleanup step).
  - [ ] Apply button: calls `settingsService.applySetting(settingId, candidateSlug)`, where `settingId` is the `id` of the single Font-KeyType row already present in `Settings.tsx`'s fetched Settings list (exactly one exists today, per `DatabaseSeeder.EnsureSettingsAsync`'s single `("font.pairing","Font","default")` seed — don't hardcode an assumption of "exactly one Font row" beyond this lookup, since FR-7's extensibility could add a second one later). On success, calls `useSiteSettings()`'s `refetch()` (Task 7) so the applying admin's own page reflects the change immediately, and re-fetches `Settings.tsx`'s own list (or calls the existing `useSettings` hook's refetch, if `useAsync` exposes one — check; if not, trigger a re-render via the existing `data`/`setData` from `useAsync` directly, same pattern `useAiTaskConfig.ts` uses for its own post-save patch) so the list view's Value/IsActive/last-changed columns are current. Clear `candidateSlug` (closes the preview) after a successful Apply.
  - [ ] Apply failure (e.g. a race where the pairing was decurated between page-load and click): surface the error via the existing `role="alert"` pattern already used elsewhere in this component — do not silently swallow it.

- [x] Task 9: Frontend tests (AC: all)
  - [ ] `Settings.test.tsx` additions: the picker renders as a `<select>`/listbox (not a text input) populated from a mocked `getFontPairings`; selecting a candidate renders the preview area with the candidate's fonts, without calling `applySetting`; clicking Apply calls `applySetting` with the right `(id, slug)` and, on success, the preview clears and the list reflects the new Value; an `applySetting` rejection surfaces via `role="alert"`.
  - [ ] New `FrontEnd/tests/context/SiteSettingsContext.test.tsx`: mocks `settingsService.getSettings`/`getFontPairings`; asserts `document.documentElement.style.getPropertyValue('--font-display')` etc. are set to the resolved active pairing's fonts on a successful fetch; asserts `setProperty` is **not** called (values stay whatever `index.css` already set, i.e. untouched by this context) when the fetch fails, when no active Font Setting exists, or when the Setting's Value doesn't match any fetched pairing slug — three separate fail-safe branches, not one combined test, so a future regression in any one path is caught precisely.

### Review Findings

Combined code review ran once across Stories 6.1/6.2/6.3 together (shared files, no commit boundaries between them). This story's share of that pass:

- [x] [Review][Patch] **Critical, cross-story:** `SettingsController`'s class-level `[Authorize(Policy = FeatureKeys.SettingsManage)]` (Master/Support only, added in Story 6.1) gates every route, including the two `SiteSettingsContext.tsx` calls on every app boot (`GET /api/v1/settings`, `GET /api/v1/settings/font-pairings`) to apply the site-wide font. Every non-Master/Support visitor — nearly everyone, including anonymous visitors on the login screen, since `SiteSettingsProvider` mounts above auth gating in `App.tsx` — got 401/403, silently swallowed by the existing fail-safe `catch`, so the site-wide font (FR-11/NFR-1) never actually applied for real users, only for the admin who clicked Apply (via the explicit post-Apply `refetch()`). Triple-confirmed independently by all three review layers. Fixed: new `GET /api/v1/settings/effective-fonts` endpoint, `[AllowAnonymous]` on that one action overriding the controller's class-level policy, returning only the three resolved font-family strings (not the admin `SettingDto`/`FontPairingDefinitionDto` shapes) via a new `SettingsService.GetEffectiveFontsAsync()` that finally wires up Story 6.1's own `GetEffectiveValueAsync`. `SiteSettingsContext.tsx` rewritten to call this one endpoint instead of the two admin-gated ones; the client-side `.find()` resolution logic is gone (resolution now happens server-side). Proven with a test asserting directly on the actual attribute metadata ASP.NET Core's authorization filter reads (`GetEffectiveFonts_action_carries_AllowAnonymous_overriding_the_class_level_Authorize`), not a mocked-service test that would have passed even with the bug present. [BackEnd/src/FlexDemy.Application/Settings/EffectiveFontsDto.cs, SettingsService.cs; BackEnd/src/FlexDemy.Api/Controllers/SettingsController.cs; FrontEnd/src/context/SiteSettingsContext.tsx; FrontEnd/src/services/settingsService.ts]
- [x] [Review][Patch] Font-pairings picker (`useAsync` for `getFontPairings`) discarded fetch errors, rendering as an indistinguishable-from-empty placeholder on failure. Fixed: errors now surface via the component's existing `role="alert"` pattern. [FrontEnd/src/features/Admin/Settings/Settings.tsx]
- [x] [Review][Patch] `formatDate`-style date rendering had no guard against an unparseable string producing the literal text "Invalid Date". Fixed: falls back to a placeholder. [FrontEnd/src/features/Admin/Settings/Settings.tsx]
- [x] [Review][Defer] TOCTOU: the Font-pairing curation check (`FontPairingDefinitionRepository.GetBySlugAsync`) runs before `ApplyAsync`'s transaction opens, against a row the `FOR UPDATE` lock doesn't cover — a pairing could theoretically be decurated between the check and the commit. — deferred, no decurate endpoint exists anywhere in this diff for this race to be reachable today
- [x] [Review][Defer] `SiteSettingsContext`'s `refetch()` has no guard against a stale in-flight fetch resolving after a newer one. — deferred, only ever triggered by a single deliberate user action (a successful Apply), not a rapid-fire path
- [x] [Review][Defer] `Settings.tsx` doesn't refetch the font-pairings list after a successful Apply, so a concurrent curation-list change elsewhere would go stale until reload. — deferred, no admin-facing curate/decurate UI exists yet for this to matter in practice
- [x] [Review][Dismiss] "One-click restore isn't actually one click" (raised against 6.3, noted here since it touches this story's Apply flow) — correct behavior per FR-17 (restore must go through the same Preview+Apply steps as any other change), just an optimistic story title, not a defect.

## Dev Notes

- **Scope boundary, read carefully (same discipline as Story 6.1):** `SettingChangeHistory` and an atomic `UPDATE...RETURNING` OldValue-capture pattern are **Story 6.3 scope**, not this one — `ApplyAsync` here is a normal EF load-validate-save method. Do not build the history table or any raw-SQL plumbing now. Note for whoever picks up 6.3: no `RETURNING`/atomic-read-then-write precedent exists anywhere in this codebase today (verified by repo-wide search), so 6.3 will likely need to *replace* this method's plain EF-tracked save with a hand-written atomic UPDATE from scratch, not just bolt a history-write onto the existing one.
- `FontPairingDefinition` inherits `AuditableEntity` — confirmed as this codebase's universal entity pattern (`ErrorRetentionSettings`, `Tag` both do, no exception exists for "simple reference data"). Its inherited `IsActive` doubles as AD-26's curated/decurated toggle.
- The Font CSS custom properties are exactly `--font-display`, `--font-sans`, `--font-mono` (`FrontEnd/src/index.css`'s `@theme` block) — their values are full CSS `font-family` strings (font name + fallback stack, e.g. `"Fraunces", Georgia, serif`), not bare font names. `FontPairingDefinition.DisplayFont`/`BodyFont`/`MonoFont` should store the same full-string format so they can be passed straight into `setProperty`/inline `style` without reformatting.
- `SiteSettingsContext` and `Settings.tsx`'s Preview are two **structurally separate** mechanisms, per AD-8 — this is the single most important thing this story must get right (a prior architecture reviewer round flagged this exact confusion as the top risk): Preview never touches `document.documentElement` and never calls `applySetting`; only a successful Apply does either of those things, and only `SiteSettingsContext` (never `Settings.tsx` directly) touches `document.documentElement`.
- Task 8's Preview wrapper (dynamic `--font-*` override via inline `style`, set from server-fetched candidate data) is genuinely new UI machinery — no existing precedent to mirror for that part. The `font-display`/`font-sans`/`font-mono` Tailwind utility classes it composes with, however, already exist and are used extensively elsewhere in the codebase (they compile to `font-family: var(--font-display)` etc., same lookup mechanism as inline style) — don't assume there's "no Tailwind precedent" here, there is; the reason child elements still need an explicit `font-family` of their own is `body`'s font-family resolving above the wrapper in the DOM (see Task 8 for the full explanation), not an absence of a scoping mechanism.
- `GET /api/v1/settings/font-pairings` is a sub-route on the **existing** `SettingsController`, not a new controller — exact precedent is `ErrorsController.cs`'s `[HttpGet("retention-settings")]`.

### Project Structure Notes

- All new backend files continue the `Settings` feature-folder shape Story 6.1 established (Domain/Application/Infrastructure/Api). No new folders beyond what 6.1 already created.
- All new frontend files: `SiteSettingsContext.tsx` in the existing (if sparse) `context/` folder — confirmed only `DomainContext.tsx`/`ToastContext.tsx` exist there today, `CourseContentContext.tsx`/`SessionContext.tsx`/`AccessibilityContext.tsx` named in the architecture spine's Structural Seed do **not** actually exist yet (aspirational entries, not built) — don't be confused by the spine listing them as if already present.

### Definition of Done

- [x] Backend: `dotnet build` and `dotnet test` (all 3 test projects) pass, migration applies cleanly, no changes to unrelated files. 739 backend tests passing (446 Application + 176 Infrastructure + 117 Api), up from 719 in Story 6.1.
- [x] Frontend: `npm run lint` (`tsc --noEmit`) shows no *new* errors (same pre-existing baseline as Stories 5.1/6.1 — 2 pre-existing errors in `FlashcardsModal.tsx`/`useBookingState.ts`, both unrelated to this story).
- [x] Frontend: `npx vitest run` — full suite passes (565/565), including the new/updated tests from Task 9. Up from 557 in Story 6.1.
- [x] All 5 Acceptance Criteria verified via tests. **Not live-verified end-to-end**: no click-through in a running browser against a live backend was performed this session (same honest caveat as Story 6.1's DoD — the Docker backend was not confirmed to be running this session's migrations). What *was* verified: the migration was generated and its contents confirmed to add only the `font_pairing_definitions` table; every AC has direct unit/integration test coverage (curation rejection, reactivation re-check, Preview/Apply separation via the fact that Preview code never references `document.documentElement` or `applySetting`, and `SiteSettingsContext`'s fail-safe branches).

### References

- [Source: _specs/planning-artifacts/prds/prd-eLearning-AdminSettings-2026-08-15/prd.md#FR-9, FR-10, FR-11, FR-12, FR-13, NFR-3, NFR-4]
- [Source: _specs/planning-artifacts/epics-AdminSettings.md#Epic 6, Story 6.2]
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md#AD-25, AD-26]
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md#AD-8]
- [Source: _specs/implementation-artifacts/6-1-settings-subtab-with-the-generic-settings-data-model.md (previous story — Setting/SettingDto/ISettingsService/SettingsController/settingsService.ts/Settings.tsx/useSettings.ts all built here, extended by this story)]
- [Source: BackEnd/src/FlexDemy.Domain/ErrorObservability/ErrorRetentionSettings.cs, Domain/Tags/Tag.cs (AuditableEntity-inheriting reference-entity pattern)]
- [Source: BackEnd/src/FlexDemy.Infrastructure/Repositories/AiTaskBudgetRepository.cs (conditional `UPDATE...WHERE` + affected-row-count pattern, sometimes referenced re: AD-18 — no `RETURNING` clause exists in this file or anywhere in the codebase; confirmed NOT needed for this story's ApplyAsync, and Story 6.3 will need to write its own atomic pattern from scratch)]
- [Source: BackEnd/src/FlexDemy.Api/Controllers/ErrorsController.cs:71-83 (sub-route GET/PUT precedent for font-pairings)]
- [Source: BackEnd/src/FlexDemy.Application/Common/AppException.cs (ValidationException, NotFoundException)]
- [Source: BackEnd/src/FlexDemy.Application/ErrorObservability/ErrorAdminService.cs (non-atomic validate-then-mutate service shape to mirror for ApplyAsync)]
- [Source: FrontEnd/src/context/DomainContext.tsx (Context provider/hook pattern), App.tsx:46-54 (provider composition root)]
- [Source: FrontEnd/src/index.css (exact --font-display/--font-sans/--font-mono custom property names and values)]
- [Source: FrontEnd/src/services/aiConfigService.ts (write() helper pattern to add to settingsService.ts)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- `dotnet build` (Api + all 3 test projects): clean, 0 errors (1 pre-existing Hangfire obsolete-API warning, unrelated).
- `dotnet ef migrations add AddFontPairingDefinitions`: generated `20260815165903_AddFontPairingDefinitions.cs` — confirmed by reading it that it only creates `font_pairing_definitions` (columns + unique `slug` index), no changes to any other table.
- `dotnet test` per project: Application.Tests 446/446, Infrastructure.Tests 176/176, Api.Tests 117/117 — all passing. 739 total, +20 over Story 6.1's 719.
- `npm run lint` (`tsc --noEmit`): 2 pre-existing errors in `FlashcardsModal.tsx`/`useBookingState.ts` (unrelated to Settings/SiteSettings), no new errors from this story's files.
- `npx vitest run`: 565/565 passing across 79 files, +8 over Story 6.1's 557. Notably `App.test.tsx` — which does not mock `settingsService` — passed unchanged with `SiteSettingsProvider` now mounted in `App.tsx`'s composition root, confirming the fail-safe design (unmocked real `fetch` calls to a backend not running during tests resolve to a caught `SettingsError`, silently skipped, no test flakiness or timeout).
- **Code Review Fix Pass (2026-08-16) — critical bug found and fixed.** Three independent review layers (adversarial, edge-case, acceptance-auditor) converged on the same finding: `SettingsController` carries a class-level `[Authorize(Policy = FeatureKeys.SettingsManage)]` (Master+Support only), and `SiteSettingsContext.tsx` called two of that controller's gated routes (`GET /settings`, `GET /settings/font-pairings`) unconditionally on every app boot to apply the site-wide font. Since `SiteSettingsProvider` mounts above auth gating in `App.tsx`, every non-Master/Support visitor — Students, Tutors, and anonymous visitors on the login screen — got 401/403, silently swallowed by the Context's own fail-safe `catch`, so the applied font never actually reached a real site visitor; only the admin who clicked Apply ever saw it, via the explicit post-Apply `refetch()`. FR-11 ("takes effect... for any user") and NFR-1 ("reflected for all users") were both violated in the shipped code, undetected by 719+739 passing tests because none of them exercised the real ASP.NET Core authorization pipeline end-to-end.
  - **Fix:** added `ISettingsService.GetEffectiveFontsAsync()` (Story 6.1's already-built, already-tested `GetEffectiveValueAsync` was the missing half — it just had no caller) resolving the active Font Setting's curated pairing server-side and returning only three font-family strings (`EffectiveFontsDto` — deliberately not the admin `SettingDto`/`FontPairingDefinitionDto` shapes, keeping the anonymous surface minimal), exposed via `GET /api/v1/settings/effective-fonts` with `[AllowAnonymous]` on that one action overriding the controller's class-level `[Authorize]`. `SiteSettingsContext.applyFontPairing()` rewritten to call this single endpoint instead of resolving client-side from the two admin-gated ones.
  - **The test that would have caught this originally:** `SettingsControllerTests.cs` now asserts directly on the controller's attribute metadata (`SettingsController_carries_a_class_level_Authorize_attribute`, `GetEffectiveFonts_action_carries_AllowAnonymous_overriding_the_class_level_Authorize`, `Every_other_action_does_NOT_carry_AllowAnonymous`) — a genuine proof of reachability-with-zero-auth, not a mocked-service test that would pass regardless of whether the attribute existed. No `WebApplicationFactory`/`TestServer` integration-test infrastructure exists in this codebase yet (pre-existing, already-tracked gap — see Story 4.1's deferred-work entry); this is the pragmatic in-scope substitute.
  - Also fixed while in this code (Code Review Crew party consensus, all cheap/unambiguous): `SettingsService.ApplyAsync` now validates `Value` (non-empty, ≤256 chars) for every `KeyType`, not just `Font` — previously a bad value for a future non-Font `KeyType` would reach the raw parameterized `UPDATE` unchecked, risking a raw Postgres error leaking through the generic-exception 500 path. `SettingRepository.ApplyValueAsync` now uses `SingleOrDefaultAsync` + `NotFoundException` instead of `SingleAsync`, so a Setting deleted between `ApplyAsync`'s `GetByIdAsync` check and this raw SQL running surfaces a clean 404 instead of an unhandled `InvalidOperationException`. `Settings.tsx`'s font-pairings picker and history panel now surface their own fetch failures via `role="alert"` instead of silently rendering an indistinguishable empty state. `formatDate` now guards against an unparseable date string rendering the literal text "Invalid Date."
  - **Deliberately NOT done:** a `Yui`/craftsman-suggested cleanup of `SettingsService.ApplyAsync`'s closure-captured `oldValue`/`updatedAt` locals (returning the tuple from the `ExecuteInTransactionAsync` lambda instead) turned out to be impossible without widening `IUnitOfWork.ExecuteInTransactionAsync`'s signature to a generic `Task<T>`-returning overload — `UnitOfWork.cs`'s own comment already documents why the current pattern is safe today (no `EnableRetryOnFailure` configured), so this was judged not worth the interface-widening cost for a cosmetic-only fix. Nine other reviewer findings were deferred as currently unreachable (no decurate/deactivate/delete endpoint exists yet for any of them to matter) — see `deferred-work.md`.
  - Backend after fix: `dotnet test` 761/761 passing (up from 748: 450/180/118). Frontend after fix: `npx vitest run` 571/571 passing across 79 files (up from 568/569, the earlier run's one failure — an unrelated `App.test.tsx` flake under full-suite load — did not recur). `npm run lint`: still only the 2 pre-existing unrelated errors.

### Completion Notes List

- **Deviation from story spec (necessary, not optional):** `ISettingRepository`/`SettingRepository` needed a `GetByIdAsync(string id, ...)` method — the story's Task 3 says `ApplyAsync` should "look up the target Setting by id" but only `GetAllAsync` existed on the repository (Story 6.1's read-only scope). Added `GetByIdAsync`, mirroring `IErrorRetentionSettingsRepository`'s pattern of a tracked-entity lookup that `ApplyAsync` mutates in place (matching `ErrorAdminService.ArchiveAsync`'s established no-explicit-`Update()`-call idiom). Covered by two new `SettingRepositoryTests.cs` tests.
- `SettingsService`'s constructor gained `IFontPairingDefinitionRepository` and `IUnitOfWork` dependencies (the latter wasn't previously needed since Story 6.1 was read-only) — both resolve automatically from existing DI registrations, no new DI wiring needed beyond registering `IFontPairingDefinitionRepository` itself.
- `Task 5`'s reactivation test (`ApplyAsync_reactivating_a_Value_whose_pairing_was_since_decurated_is_rejected`) confirms the "no separate reactivation branch" design directly: the test calls `ApplyAsync` with the Setting's own existing (now-decurated) Value and asserts it's rejected by the same unconditional curation check, not a special-cased path.
- Also added a test for the non-Font `KeyType` skip-curation branch (not explicitly listed in Task 5 but implied by Task 3's "For any other `KeyType`, apply without a curation check") — `ApplyAsync_on_a_non_Font_KeyType_skips_the_curation_check`.
- Frontend: `Settings.tsx`'s per-setting-row `<div>` was restructured (flex row nested one level deeper) to make room for the Font-KeyType picker/preview block below the existing header row — verified this doesn't break any of Story 6.1's existing assertions (none depend on the wrapping div's layout classes, only on text content within the section).
- The Preview mechanism was built exactly as the story's (validator-corrected) Dev Notes specify: the wrapper's inline `style` sets `--font-display`/`--font-sans`/`--font-mono` from the candidate's fetched font strings, and each sample element (`h4`, `p`, `code`) declares its own `fontFamily: var(--font-x)` inline rather than relying on the codebase's existing `font-display`/`font-sans`/`font-mono` Tailwind utility classes — chosen for directness or that both are correct; the inline-style approach is unambiguous and needed no data-testid string coupling to a class name.
- **Not live-verified end-to-end** (see Definition of Done) — same caveat Story 6.1 documented.

### File List

**Backend — new:**
- `BackEnd/src/FlexDemy.Domain/Settings/FontPairingDefinition.cs`
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Configurations/FontPairingDefinitionConfiguration.cs`
- `BackEnd/src/FlexDemy.Application/Settings/IFontPairingDefinitionRepository.cs`
- `BackEnd/src/FlexDemy.Infrastructure/Repositories/FontPairingDefinitionRepository.cs`
- `BackEnd/src/FlexDemy.Application/Settings/FontPairingDefinitionDto.cs`
- `BackEnd/src/FlexDemy.Application/Settings/ApplySettingRequest.cs`
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Migrations/20260815165903_AddFontPairingDefinitions.cs`
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Migrations/20260815165903_AddFontPairingDefinitions.Designer.cs`
- `BackEnd/tests/FlexDemy.Infrastructure.Tests/Repositories/FontPairingDefinitionRepositoryTests.cs`
- `BackEnd/tests/FlexDemy.Api.Tests/SeedData/DatabaseSeederFontPairingDefinitionsTests.cs`

**Backend — modified:**
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/FlexDemyDbContext.cs` (added `FontPairingDefinitions` DbSet)
- `BackEnd/src/FlexDemy.Application/Settings/SettingMapper.cs` (added `FontPairingDefinition.ToDto()`)
- `BackEnd/src/FlexDemy.Application/Settings/ISettingRepository.cs` (added `GetByIdAsync`)
- `BackEnd/src/FlexDemy.Infrastructure/Repositories/SettingRepository.cs` (added `GetByIdAsync`)
- `BackEnd/src/FlexDemy.Application/Settings/ISettingsService.cs` (added `GetFontPairingsAsync`, `ApplyAsync`)
- `BackEnd/src/FlexDemy.Application/Settings/SettingsService.cs` (implemented `GetFontPairingsAsync`, `ApplyAsync`; new constructor deps)
- `BackEnd/src/FlexDemy.Api/Controllers/SettingsController.cs` (added `GetFontPairings`, `ApplySetting` endpoints)
- `BackEnd/src/FlexDemy.Api/SeedData/DatabaseSeeder.cs` (added `EnsureFontPairingDefinitionsAsync`)
- `BackEnd/src/FlexDemy.Infrastructure/DependencyInjection.cs` (registered `IFontPairingDefinitionRepository`)
- `BackEnd/tests/FlexDemy.Application.Tests/Settings/SettingsServiceTests.cs` (added `GetFontPairingsAsync`/`ApplyAsync` tests)
- `BackEnd/tests/FlexDemy.Api.Tests/Controllers/SettingsControllerTests.cs` (added `GetFontPairings`/`ApplySetting` tests)
- `BackEnd/tests/FlexDemy.Infrastructure.Tests/Repositories/SettingRepositoryTests.cs` (added `GetByIdAsync` tests)

**Frontend — new:**
- `FrontEnd/src/context/SiteSettingsContext.tsx`
- `FrontEnd/tests/context/SiteSettingsContext.test.tsx`

**Frontend — modified:**
- `FrontEnd/src/services/settingsService.ts` (added `write()` helper, `FontPairingDefinitionDto`, `getFontPairings`, `applySetting`)
- `FrontEnd/src/features/Admin/Settings/Settings.tsx` (added `FontPairingPicker` component: curated picker, scoped Preview, Apply)
- `FrontEnd/src/App.tsx` (mounted `SiteSettingsProvider` in the composition root)
- `FrontEnd/tests/features/Admin/Settings/Settings.test.tsx` (added picker/preview/apply/error tests, mocked `SiteSettingsContext`)

**Code Review Fix Pass (2026-08-16) — new:**
- `BackEnd/src/FlexDemy.Application/Settings/EffectiveFontsDto.cs`

**Code Review Fix Pass (2026-08-16) — modified:**
- `BackEnd/src/FlexDemy.Application/Settings/ISettingsService.cs`, `SettingsService.cs` (`GetEffectiveFontsAsync`; universal `Value` validation in `ApplyAsync`)
- `BackEnd/src/FlexDemy.Api/Controllers/SettingsController.cs` (`GET /effective-fonts [AllowAnonymous]` — the critical fix)
- `BackEnd/src/FlexDemy.Infrastructure/Repositories/SettingRepository.cs` (`ApplyValueAsync`: `SingleOrDefaultAsync` + `NotFoundException`)
- `BackEnd/tests/FlexDemy.Application.Tests/Settings/SettingsServiceTests.cs`, `BackEnd/tests/FlexDemy.Api.Tests/Controllers/SettingsControllerTests.cs`
- `FrontEnd/src/services/settingsService.ts` (`EffectiveFontsDto`, `getEffectiveFonts`)
- `FrontEnd/src/context/SiteSettingsContext.tsx` (rewrote `applyFontPairing()` to call `getEffectiveFonts()` instead of resolving client-side)
- `FrontEnd/src/features/Admin/Settings/Settings.tsx` (history-cache staleness fix in `handleApply`; error surfacing for font-pairings picker and history panel; `formatDate` invalid-date guard)
- `FrontEnd/tests/context/SiteSettingsContext.test.tsx` (rewritten for the new single-endpoint fetch), `FrontEnd/tests/features/Admin/Settings/Settings.test.tsx` (added staleness/error/invalid-date tests)
