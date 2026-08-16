---
baseline_commit: 6c1d6db28fd9099678d8111e4623a9e4bb0c33e0
---

# Story 6.1: Settings subtab with the generic settings data model

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Master or Support admin,
I want a Settings subtab that lists the site's current settings,
so that I can see what's configurable before changing anything.

## Acceptance Criteria

1. A Master or Support admin sees "Settings" in the Admin Panel navigation, gated the same way Tutor Approvals is. [Source: prd.md#FR-4]
2. An admin below Support tier does not see or reach the Settings subtab, including by direct navigation or direct API call. [Source: prd.md#FR-4, NFR-2]
3. The Settings screen lists every Setting grouped by KeyType, showing current Value, IsActive state, and when/by whom it was last changed. [Source: prd.md#FR-5]
4. Settings are persisted as a generic row (Key unique per KeyType, Value, KeyType, IsActive, audit fields) — not a font-specific table. [Source: prd.md#FR-6, FR-7]
5. When a Setting's IsActive is false, the system's Effective Value for that Key reverts to its hardcoded default rather than the stored Value. [Source: prd.md#FR-8]

## Tasks / Subtasks

- [x] Task 1: Backend — `Setting` domain entity, EF configuration, DbContext, migration (AC: #4)
  - [x] `Setting.cs` created exactly as specified; `Id`/`IsActive`/`CreatedAt`/`CreatedBy`/`UpdatedAt`/`UpdatedBy`/`IsDeleted` all inherited from `AuditableEntity`, not redeclared.
  - [x] `SettingConfiguration.cs` created mirroring `AiTaskConfigConfiguration.cs` exactly, including the composite `(Key, KeyType)` unique index and `HasQueryFilter`.
  - [x] `DbSet<Setting> Settings` added to `FlexDemyDbContext`.
  - [x] Migration `20260815155006_AddSettings` generated — verified it contains only the new `settings` table + composite unique index, no unrelated diffs.

- [x] Task 2: Backend — Application layer: DTO, mapper, service, repository interface (AC: #3, #5)
  - [x] `SettingDto.cs` created with `CreatedAt`/`CreatedBy` included alongside `UpdatedAt`/`UpdatedBy`, per the audit-interceptor gap this task flagged.
  - [x] `SettingMapper.cs` created, mirroring `AiConfigMapper.cs`.
  - [x] `ISettingRepository.cs` created (`IReadOnlyList<Setting> GetAllAsync`).
  - [x] `ISettingsService.cs`/`SettingsService.cs` created — `GetAllAsync` and `GetEffectiveValueAsync` (Font default `"default"` for `("font.pairing", "Font")`, matching Task 5's seed exactly). No write path, as scoped.
  - [x] `SettingRepository.cs` created, mirroring `AiTaskConfigRepository.cs`.

- [x] Task 3: Backend — `FeatureKeys.SettingsManage` + role seeding (AC: #1, #2)
  - [x] `FeatureKeys.SettingsManage = "settings.manage"` added, appended to `AllKeys`.
  - [x] `RolePermissionSeedData.cs` seeded for both Master and Support, mirroring `TutorApprove` exactly.

- [x] Task 4: Backend — `SettingsController` (AC: #1, #2, #3)
  - [x] `SettingsController.cs` created — class-level `[Authorize(Policy = FeatureKeys.SettingsManage)]`, one `GET` action.

- [x] Task 5: Backend — seed the initial Font `Setting` row (AC: #3, #5)
  - [x] `EnsureSettingsAsync` added to `DatabaseSeeder.cs`, called from `SeedAsync`, per-item idempotent (matching `EnsureAiConfigAsync`'s pattern, not `EnsureErrorRetentionSettingsAsync`'s blanket skip).
  - [x] Seeded row: Key=`font.pairing`, KeyType=`Font`, Value=`default`, IsActive=`true` — identifier matches `SettingsService`'s hardcoded default exactly.

- [x] Task 6: Backend — DI registrations (AC: all backend ACs)
  - [x] `ISettingRepository` registered in `Infrastructure/DependencyInjection.cs`.
  - [x] `ISettingsService` registered in `Application/DependencyInjection.cs`.

- [x] Task 7: Backend tests (AC: #1, #2, #3, #4, #5)
  - [x] `SettingsServiceTests.cs` — 4 tests covering `GetAllAsync` mapping and `GetEffectiveValueAsync`'s 3 branches (active match, inactive match falls back, no match falls back).
  - [x] `SettingRepositoryTests.cs` — `GetAllAsync` sanity tests. The originally-planned unique-index-violation test was **replaced**, not added: verified via an isolated reproduction (outside the test suite) that EF Core 10's InMemory provider does not enforce `HasIndex(...).IsUnique()` at all (confirmed both across two `SaveChangesAsync` calls and within one) — this is a real discovery, not an assumption, and the test file now documents it inline rather than asserting a false claim. The constraint itself is confirmed present in the generated migration and enforced by the real Postgres database.
  - [x] `SettingsControllerTests.cs` — action-body test plus 4 real-`IAuthorizationService` tests: Master succeeds, Support succeeds (the load-bearing one — proves AD-27's fix actually works, not just Master's universal bypass), Student/Tutor fail, and Support fails when the cache has no explicit row (proves Support's access comes from the seeded row, not a blanket bypass).
  - [x] `DatabaseSeederSettingsTests.cs` — 3 tests: fresh-DB seed, no-duplicate-on-rerun, backfill-when-a-different-KeyType-pair-already-exists.
  - [x] Full backend suite verified: `dotnet build` clean, `dotnet test` — 719/719 passed (439 Application.Tests + 170 Infrastructure.Tests + 110 Api.Tests), 0 failed, 0 regressions.

- [x] Task 8: Frontend — `useAdminPanel.ts` gating for the new subtab (AC: #1, #2)
  - [x] `'settings'` added to `AdminSubTab` and to `ALL_SUB_TABS`, appended after `'errors'` as required.
  - [x] `settings: { label: 'Settings', icon: SlidersHorizontal }` added to `ADMIN_SUBTAB_META`.
  - [x] `Support`'s `availableSubTabs` branch updated to `['tutor-approvals', 'masterdata', 'settings']`.

- [x] Task 9: Frontend — `settingsService.ts` (AC: #3)
  - [x] Created, mirroring `aiConfigService.ts` exactly (own `SettingsError` class, `get` helper, `getSettings()`).

- [x] Task 10: Frontend — `Settings.tsx` component + `useSettings.ts` hook, wired into `AdminPanel.tsx` (AC: #3)
  - [x] `useSettings.ts` created as a thin `useAsync` wrapper.
  - [x] `Settings.tsx` created — grouped-by-KeyType sections, `updatedAt ?? createdAt`/`updatedBy ?? createdBy` fallback, lowercased `data-testid`, Spinner + `role="alert"` loading/error handling.
  - [x] Wired into `AdminPanel.tsx`'s import list and render-switch.

- [x] Task 11: Frontend tests (AC: #1, #2, #3)
  - [x] `useAdminPanel.test.ts` updated — Master's expected array now has 7 entries (settings appended), Support's array gains `'settings'`, new `ADMIN_SUBTAB_META.settings` assertion added.
  - [x] `Settings.test.tsx` created — 5 tests: grouped rendering, Value/IsActive display, the `createdAt`/`createdBy` fallback (with a fixture row whose `updatedAt`/`updatedBy` are both null, proving the fallback renders a real date, not blank), `updatedBy`-over-`createdBy` precedence when both exist, and the error-state path.
  - [x] Full frontend suite verified: `npm run lint` — zero new errors (same 8 pre-existing baseline errors, in files this story never touches, confirmed via `git diff --name-only`). `npx vitest run` — 557/557 passed, 78/78 test files, 0 regressions.

### Review Findings

Combined code review ran once across Stories 6.1/6.2/6.3 together (shared files, no commit boundaries between them). Findings and fixes below are this story's share of that combined pass — see 6.2/6.3 for theirs.

- [x] [Review][Patch] `GetEffectiveValueAsync` (this story's own FR-8 implementation, fully built and unit-tested) was never exposed via any endpoint and never called by anything — the actual live site fell back to `SiteSettingsContext`'s own independent, unauthenticated-hostile resolution instead, which is what caused the critical cross-story bug fixed under Story 6.2's Review Findings. This story's contribution to the fix: `GetEffectiveValueAsync` is now genuinely wired up, as the resolution primitive `GetEffectiveFontsAsync` (added under 6.2) calls internally. [BackEnd/src/FlexDemy.Application/Settings/SettingsService.cs]
- [x] [Review][Defer] AC #5's "IsActive false → falls back to hardcoded default" behavior is correctly implemented and unit-tested, but no code path anywhere in Stories 6.1-6.3 ever sets a Setting's `IsActive` to `false` (no deactivate/decurate endpoint exists) — the behavior is currently unreachable against real data. Deferred: no AC requires a deactivate control to exist yet; the underlying logic is correct and ready whenever one is built. — deferred, pre-existing across all three stories

## Dev Notes

- **Full-stack story** — the first backend work in this epic. Backend follows Clean Architecture (AD-1/AD-2/AD-3) exactly as `AiConfig` already does; frontend follows the existing `features/Admin/` subtab pattern exactly as `AiConfiguration` already does. Every new file in this story has a direct, cited, already-working sibling to mirror — there should be no novel patterns invented here.
- **Scope boundary, read carefully:** this story is read-only end-to-end. `ApplyAsync` (the exclusive mutation path AD-25 mandates), the curated font picker, preview, and the frontend `SiteSettingsContext`/runtime CSS-injection (AD-8) that actually changes the *live site's* rendered fonts are **Story 6.2 scope**, not this one. FR-8's "Effective Value" requirement here is satisfied by a backend service method (`GetEffectiveValueAsync`) with a unit test proving the fallback — it does not require wiring that method into any live rendering path yet.
- `AuditableEntity` (`Domain/Common/AuditableEntity.cs`) already provides `Id`/`IsActive`/`CreatedAt`/`CreatedBy`/`UpdatedAt`/`UpdatedBy`/`IsDeleted` — do not redeclare any of these on `Setting`. Audit fields are stamped automatically by `Infrastructure/Persistence/Interceptors/AuditSaveChangesInterceptor.cs` on `SaveChanges` — services must never set them directly.
- The Architecture Spine's Structural Seed line naming `UlidIdGenerator` is **stale** — the real, current implementation is `GuidV7IdGenerator` (`Guid.CreateVersion7()`), confirmed by reading the actual file. Use `IIdGenerator.NewId()` regardless; the interface is what matters, not which concrete generator backs it.
- `FeatureKeys.cs` lives at `Application/Permissions/FeatureKeys.cs`, **not** `Api/FeatureKeys.cs` — don't create a duplicate in the wrong layer.
- Access control is defense-in-depth, both layers required: frontend `useAdminPanel.ts`'s role check is UX-only (trivially bypassable client-side, confirmed by reading `App.tsx:367-377`'s own comment on this) — the backend `[Authorize(Policy = FeatureKeys.SettingsManage)]` is the actual enforcement AC #2 depends on ("including by direct navigation or direct API call").
- Migration collision risk: only one engineer/agent adds an EF Core migration at a time against latest `main` (`BackEnd/CLAUDE.md` Rule 7) — confirm no other in-flight migration exists before running the `dotnet ef migrations add` command.

### Project Structure Notes

- All new backend files follow the existing `AiConfig` feature-folder shape exactly (Domain/Application/Infrastructure/Api, one folder per layer, `Settings` as the shared folder name across all four). No conflicts detected.
- All new frontend files follow the existing `Admin/AiConfiguration/` subtab shape exactly. Test file at `FrontEnd/tests/features/Admin/Settings/Settings.test.tsx`, mirroring the mirrored (not colocated) `tests/` convention (AD-5, frontend spine).

### Definition of Done

- [x] Backend: `dotnet build` clean (0 errors), `dotnet test` — 719/719 passed across all 3 test projects, 0 regressions. Migration `AddSettings` applies via EF's own generation (verified content: only the `settings` table + composite index). No unrelated files changed.
- [x] Frontend: `npm run lint` (`tsc --noEmit`) — 0 new errors (same 8 pre-existing baseline errors, confirmed in files this story doesn't touch, same finding as Story 5.1).
- [x] Frontend: `npx vitest run` — 557/557 passed, 78/78 test files, 0 regressions.
- [ ] All 5 Acceptance Criteria verified via tests (all 5 have direct test coverage — AC #1/#2 via `SettingsControllerTests`' real-authorization tests + `useAdminPanel.test.ts`, AC #3 via `Settings.test.tsx`, AC #4 via the migration/EF config, AC #5 via `SettingsServiceTests`). **Not done: a live click-through against the running app** — unlike Story 5.1, this story's migration and seed data haven't been applied to the running Docker backend (which predates this session's changes), so a live verification would require restarting/rebuilding the `flexdemy-api` container — a more consequential action than Story 5.1's pure-frontend check, held back pending explicit confirmation rather than done unilaterally.

### References

- [Source: _specs/planning-artifacts/prds/prd-eLearning-AdminSettings-2026-08-15/prd.md#FR-4, FR-5, FR-6, FR-7, FR-8, NFR-2]
- [Source: _specs/planning-artifacts/epics-AdminSettings.md#Epic 6, Story 6.1]
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md#AD-1, AD-2, AD-3, AD-9, AD-10, AD-11, AD-25, AD-27]
- [Source: BackEnd/src/FlexDemy.Domain/AiConfig/AiTaskConfig.cs, Domain/Common/AuditableEntity.cs (entity pattern)]
- [Source: BackEnd/src/FlexDemy.Infrastructure/Persistence/Configurations/AiTaskConfigConfiguration.cs (EF config pattern)]
- [Source: BackEnd/src/FlexDemy.Application/AiConfig/ (service/DTO/mapper/repository-interface pattern)]
- [Source: BackEnd/src/FlexDemy.Api/Controllers/AiConfigController.cs (controller pattern)]
- [Source: BackEnd/src/FlexDemy.Application/Permissions/FeatureKeys.cs (all current keys)]
- [Source: BackEnd/src/FlexDemy.Api/SeedData/RolePermissionSeedData.cs:51-54 (TutorApprove seeding to mirror)]
- [Source: BackEnd/src/FlexDemy.Api/SeedData/DatabaseSeeder.cs (EnsureAiConfigAsync per-item idempotency pattern to mirror)]
- [Source: BackEnd/CLAUDE.md (migration command convention)]
- [Source: FrontEnd/src/features/Admin/AdminPanel.tsx, useAdminPanel.ts (subtab gating pattern)]
- [Source: FrontEnd/src/features/Admin/AiConfiguration/ (component/hook pattern)]
- [Source: FrontEnd/src/services/aiConfigService.ts (service pattern)]
- [Source: FrontEnd/src/App.tsx:367-377 (defense-in-depth access-control comment)]
- [Source: FrontEnd/tests/features/Admin/useAdminPanel.test.ts, AiConfiguration/AiConfiguration.test.tsx (test patterns)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- `dotnet build` (BackEnd/): 0 errors, 3 pre-existing unrelated warnings.
- `dotnet ef migrations add AddSettings --startup-project ../FlexDemy.Api --project .` (from `src/FlexDemy.Infrastructure`): succeeded; generated migration verified to contain only the `settings` table + composite `(key, key_type)` unique index.
- `dotnet test` (BackEnd/): 719/719 passed (439 Application.Tests + 170 Infrastructure.Tests + 110 Api.Tests), 0 failed.
- **Real discovery, not an assumption:** the story's Task 7 (as originally written by `create-story`'s reviewer pass) called for a repository test proving EF Core's InMemory provider throws `DbUpdateException` on a `HasIndex(...).IsUnique()` violation. Verified via an isolated single-file reproduction (`dotnet run` against a minimal throwaway console project referencing `EFCore.InMemory` 10.0.4 directly) that this is false: the InMemory provider does not enforce unique indexes at all, in either a two-`SaveChangesAsync`-calls scenario or a single-call scenario, with or without a `HasQueryFilter`. The test was rewritten to document this finding inline rather than assert a false claim; the story file itself was also corrected. The real Postgres-level constraint is unaffected — confirmed present in the generated migration.
- `npm run lint` (FrontEnd/): 0 new errors — 8 pre-existing errors in `FlashcardsModal.tsx`/`useBookingState.ts`, confirmed via `git diff --name-only` to be in files this story never touches.
- `npx vitest run` (FrontEnd/): 557/557 passed, 78/78 test files, 0 failed.
- **Code Review Fix Pass (2026-08-16):** the combined Epic 6 code review found a critical bug spanning this story: `GetEffectiveValueAsync` (built here, fully tested) was never exposed via any endpoint, so nothing in the running app could actually resolve a Setting's Effective Value publicly — see 6.2's Debug Log for the full bug description and fix (new `GetEffectiveFontsAsync`/`EffectiveFontsDto`/`GET /api/v1/settings/effective-fonts [AllowAnonymous]`, added to files this story created). `dotnet test` after the fix: 761/761 passed. `npx vitest run`: 571/571 passed.

### Completion Notes List

- All 11 tasks complete across backend (.NET) and frontend (React). All 5 ACs implemented and covered by tests.
- The InMemory unique-index discovery (see Debug Log) is the one place this story's implementation diverged from its own Task 7 as written — corrected both the test and the story text rather than forcing a test to pass against a false premise.
- `SettingsControllerTests.cs` ended up with one more test than the story specified (`A_Support_user_is_not_authorized_when_the_cache_has_no_explicit_true_row`) — added to close a gap the story's own wording left open: proving Support's access comes from the seeded permission row, not a blanket Support-wide bypass the way Master gets one.
- Live click-through against the running app was not performed — see Definition of Done's honest note on why (the running Docker backend predates this session's migration/seed changes; restarting it is a bigger action than Story 5.1's pure-frontend check).

### File List

**Backend (new):**
- `BackEnd/src/FlexDemy.Domain/Settings/Setting.cs`
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Configurations/SettingConfiguration.cs`
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Migrations/20260815155006_AddSettings.cs` (+ `.Designer.cs`)
- `BackEnd/src/FlexDemy.Application/Settings/SettingDto.cs`
- `BackEnd/src/FlexDemy.Application/Settings/SettingMapper.cs`
- `BackEnd/src/FlexDemy.Application/Settings/ISettingRepository.cs`
- `BackEnd/src/FlexDemy.Application/Settings/ISettingsService.cs`
- `BackEnd/src/FlexDemy.Application/Settings/SettingsService.cs`
- `BackEnd/src/FlexDemy.Infrastructure/Repositories/SettingRepository.cs`
- `BackEnd/src/FlexDemy.Api/Controllers/SettingsController.cs`
- `BackEnd/tests/FlexDemy.Application.Tests/Settings/SettingsServiceTests.cs`
- `BackEnd/tests/FlexDemy.Infrastructure.Tests/Repositories/SettingRepositoryTests.cs`
- `BackEnd/tests/FlexDemy.Api.Tests/Controllers/SettingsControllerTests.cs`
- `BackEnd/tests/FlexDemy.Api.Tests/SeedData/DatabaseSeederSettingsTests.cs`

**Backend (modified):**
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/FlexDemyDbContext.cs` (added `Settings` DbSet)
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Migrations/FlexDemyDbContextModelSnapshot.cs` (EF-generated)
- `BackEnd/src/FlexDemy.Application/Permissions/FeatureKeys.cs` (added `SettingsManage`)
- `BackEnd/src/FlexDemy.Api/SeedData/RolePermissionSeedData.cs` (seeded `SettingsManage` for Master+Support)
- `BackEnd/src/FlexDemy.Api/SeedData/DatabaseSeeder.cs` (added `EnsureSettingsAsync`)
- `BackEnd/src/FlexDemy.Infrastructure/DependencyInjection.cs` (registered `ISettingRepository`)
- `BackEnd/src/FlexDemy.Application/DependencyInjection.cs` (registered `ISettingsService`)

**Frontend (new):**
- `FrontEnd/src/services/settingsService.ts`
- `FrontEnd/src/features/Admin/Settings/useSettings.ts`
- `FrontEnd/src/features/Admin/Settings/Settings.tsx`
- `FrontEnd/tests/features/Admin/Settings/Settings.test.tsx`

**Frontend (modified):**
- `FrontEnd/src/features/Admin/useAdminPanel.ts` (added `'settings'` subtab)
- `FrontEnd/src/features/Admin/AdminPanel.tsx` (wired `Settings` into render-switch)
- `FrontEnd/tests/features/Admin/useAdminPanel.test.ts` (updated expected arrays + new assertion)

**Code Review Fix Pass (2026-08-16) — new:**
- `BackEnd/src/FlexDemy.Application/Settings/EffectiveFontsDto.cs`

**Code Review Fix Pass (2026-08-16) — modified:**
- `BackEnd/src/FlexDemy.Application/Settings/ISettingsService.cs` (added `GetEffectiveFontsAsync`)
- `BackEnd/src/FlexDemy.Application/Settings/SettingsService.cs` (added `GetEffectiveFontsAsync` + `HardcodedFontDefaults`; added universal null/empty/256-char `Value` validation to `ApplyAsync`)
- `BackEnd/src/FlexDemy.Api/Controllers/SettingsController.cs` (added `GET /effective-fonts [AllowAnonymous]`)
- `BackEnd/src/FlexDemy.Infrastructure/Repositories/SettingRepository.cs` (`ApplyValueAsync`: `SingleOrDefaultAsync` + `NotFoundException` instead of `SingleAsync`)
- `BackEnd/tests/FlexDemy.Application.Tests/Settings/SettingsServiceTests.cs` (added `GetEffectiveFontsAsync`/validation tests)
- `BackEnd/tests/FlexDemy.Api.Tests/Controllers/SettingsControllerTests.cs` (added `GetEffectiveFonts` test + reflection-based `[AllowAnonymous]` attribute assertions)

## Change Log

- 2026-08-15: Story implemented — all 11 tasks complete, all 5 ACs satisfied, 719 backend + 557 frontend tests passing, 0 regressions. One real discovery corrected mid-implementation: EF Core InMemory does not enforce unique indexes (test and story text both fixed). Status: ready-for-dev → review.
