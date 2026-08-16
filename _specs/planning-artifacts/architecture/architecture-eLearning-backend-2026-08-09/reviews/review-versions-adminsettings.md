# Review — AD-25/AD-26 reality-check against the actual codebase

**Lens:** AD-25 and AD-26 name no new library/package/version, so the applicable check isn't
web-verification — it's whether their claims about *existing code* hold up when read directly.
AD-26 explicitly cites `ErrorRetentionSettings`/`AiTaskConfig` (AD-19) as its seeding precedent;
that citation is the crux of this review.

**Scope read:** `ARCHITECTURE-SPINE.md` in full (AD-1–AD-26, Stack table, Structural Seed), plus
the real source files below.

## Verdict: PASS — both entries' code claims hold up

Every factual claim AD-25 and AD-26 make about existing code checks out against the real
source. No fabricated APIs, no misattributed patterns, no stale references.

## What was verified

1. **`ErrorRetentionSettings` exists exactly as described.**
   `BackEnd/src/FlexDemy.Domain/ErrorObservability/ErrorRetentionSettings.cs` — a single-row
   `AuditableEntity` subtype with a fixed `SingletonId` and `RetentionDays`. Confirmed.

2. **`AiTaskConfig` exists exactly as AD-19/AD-26 describe it.**
   `BackEnd/src/FlexDemy.Domain/AiConfig/AiTaskConfig.cs` — `TaskId`, `Provider`, `Model`,
   `FallbackProvider`, `FallbackModel`, `BudgetThreshold` all present (plus pricing fields not
   mentioned in AD-19/26, which is an addition, not a contradiction). Confirmed.

3. **Both are actually seeded via `DatabaseSeeder` — AD-26's central claim.**
   `BackEnd/src/FlexDemy.Api/SeedData/DatabaseSeeder.cs`'s `SeedAsync` calls both
   `EnsureAiConfigAsync` (adds `AiTaskConfig` + `AiPromptVersion` + `AiTaskBudget` rows,
   idempotent per-task) and `EnsureErrorRetentionSettingsAsync` (adds one singleton row,
   idempotent). AD-26's line — "Seeded via `DatabaseSeeder`, the same mechanism as
   `ErrorRetentionSettings`/`AiTaskConfig` (AD-19)" — is accurate on both counts: same class,
   same idempotent-per-entity pattern `FontPairingDefinition` seeding would follow.

4. **AD-25's field list for `Setting` matches the codebase's actual entity-base convention.**
   `AuditableEntity` (`BackEnd/src/FlexDemy.Domain/Common/AuditableEntity.cs`) already supplies
   `IsActive`, `CreatedAt`, `CreatedBy`, `UpdatedAt`, `UpdatedBy`, `IsDeleted` to every entity
   that inherits it (which is every existing Domain entity checked, including
   `ErrorRetentionSettings` and `AiTaskConfig`). AD-25 lists `Setting` as holding
   "IsActive, CreatedAt/UpdatedAt/UpdatedBy" — consistent with the established
   inherit-`AuditableEntity` pattern, not an invented shape. (Minor: AD-25's list omits
   `CreatedBy`, which `AuditableEntity` also provides — see Finding 1.)

5. **No naming collision / no stale reference.**
   Searched all of `BackEnd/src` for `Setting`, `FontPairing`, `KeyType`, `SettingChangeHistory`
   — zero matches. `Domain/Settings/` does not yet exist. This is consistent with AD-25/AD-26
   describing net-new work, not misdescribing something already built differently.

6. **AD-25's FR citations line up with the actual PRD.**
   Checked `prd-eLearning-AdminSettings-2026-08-15/prd.md`: FR-6 ("Persist settings
   generically"), FR-9 ("Curated font pairing picker"), FR-10 ("Server-side curation
   enforcement"), FR-15 ("Record every applied change"), FR-16 ("View a setting's change
   history") all exist and match the content AD-25/AD-26 attribute to them.

## Findings

1. **Minor / cosmetic — AD-25's field list for `Setting` under-states what it actually inherits.**
   AD-25 says the entity holds "Key (unique), Value, KeyType, IsActive,
   CreatedAt/UpdatedAt/UpdatedBy" but doesn't mention `CreatedBy` or `IsDeleted`, both of which
   `AuditableEntity` also provides and every other entity in the codebase picks up silently.
   Not a factual error (nothing AD-25 says is false), just an incomplete enumeration — worth a
   one-word fix ("...via `AuditableEntity`...") if precision matters here, but not a blocking
   issue since the pattern is unambiguous once a builder reads any sibling entity.

2. **No red flags found in the AD-26 seeding-precedent citation.** This was the review's primary
   target given the prompt's framing, and it fully holds up — both cited entities exist, both
   are seeded by the exact mechanism named, in the exact file named.

3. **Nothing in AD-25/AD-26 references a library, package, or version claim**, confirming the
   task's framing that the web-verification lens doesn't apply here — there is nothing to
   web-check in either entry.

4. **AD-25's cross-reference to AD-20** ("a bounded exception to AD-20") is an internal-consistency
   claim, not a codebase claim — reading AD-20 in the same document confirms AD-25's summary of
   AD-20's rule ("explicit entities, not generic shape," scoped to the course tree) is accurate,
   for what it's worth as a secondary check.

## Files checked

- `BackEnd/src/FlexDemy.Domain/ErrorObservability/ErrorRetentionSettings.cs`
- `BackEnd/src/FlexDemy.Domain/AiConfig/AiTaskConfig.cs`
- `BackEnd/src/FlexDemy.Api/SeedData/DatabaseSeeder.cs`
- `BackEnd/src/FlexDemy.Domain/Common/AuditableEntity.cs`
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Configurations/ErrorRetentionSettingsConfiguration.cs`
- `BackEnd/src/FlexDemy.Infrastructure/Persistence/Configurations/AiTaskConfigConfiguration.cs`
- `_specs/planning-artifacts/prds/prd-eLearning-AdminSettings-2026-08-15/prd.md`
- Full-repo grep for `Setting`, `FontPairing`, `KeyType`, `SettingChangeHistory`, `DatabaseSeeder`,
  `AiTaskConfig`, `ErrorRetentionSettings` under `BackEnd/src`
