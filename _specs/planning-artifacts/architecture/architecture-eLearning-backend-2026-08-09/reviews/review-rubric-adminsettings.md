# Rubric Review — AD-25 / AD-26 (Admin Settings)

**Reviewed:** `ARCHITECTURE-SPINE.md`, AD-25 and AD-26, against `prd-eLearning-AdminSettings-2026-08-15/prd.md` and `addendum.md`, in the context of the full spine (AD-1–AD-26) and the live codebase (`BackEnd/src`).

**Verdict: Needs Revision.** The entity/table shape is sound and the AD-20 reconciliation genuinely holds up, but AD-25/AD-26 leave one hard NFR (access control, explicitly flagged by the review brief as the thing to check) completely unenforced at the Rule level, and contain one literal contradiction of FR-6's text plus several FR-7/FR-15 divergence points a future engineer would have no rule to converge on.

---

## 1. NFR-2 (access control) is left unstated — the central finding

PRD NFR-2: *"The Settings subtab and its underlying endpoints SHALL be unreachable by any role below Support, including by direct navigation or direct API call — not just hidden from navigation."*

Neither AD-25 nor AD-26's **Rule** text mentions authorization at all. The only trace of it is a bare inline comment in the Structural Seed table:

```
SettingsController.cs       # AD-25/AD-26: Master+Support gated per PRD NFR-2
```

This is an assertion, not a rule — it names no mechanism. Compare AD-24, which pins the equivalent decision down precisely: `[Authorize(Policy = FeatureKeys.ErrorsManage)]` at class level, plus an explicit two-controller split rationale. AD-25/26 have no equivalent.

This gap is real, not hypothetical, verified against the live codebase:

- `BackEnd/src/FlexDemy.Application/Permissions/FeatureKeys.cs` has no Settings-related key today. A future engineer must invent one, and nothing tells them to.
- The PRD's own cited precedent is a trap: FR-4 says Settings gets "the same access level as Tag Management." But `TagsController.cs` gates its write actions with `[Authorize(Policy = FeatureKeys.MasterDataManage)]`, and `RolePermissionSeedData.cs` seeds `MasterDataManage` **Master-only**. Support can see the Tag Management tab but cannot actually write through it at the API layer. If a future engineer follows "same as Tag Management" literally, Settings writes end up Master-only — directly violating NFR-2, which requires Support to have full functional (not just navigational) access.
- The codebase already has the correct precedent, just not cited: `FeatureKeys.TutorApprove` is seeded for **both** `UserRole.Master` and `UserRole.Support` (`RolePermissionSeedData.cs` lines 53–54) — this is the shape Settings needs, and AD-25/26 should say so explicitly (a new `FeatureKeys.SettingsManage`, seeded for Master + Support, `[Authorize(Policy = FeatureKeys.SettingsManage)]` at `SettingsController` class level, per AD-5's controller convention).

**Fix:** add a Rule clause naming the new `FeatureKeys` constant, its seed rows (Master + Support), and the class-level `[Authorize(Policy=...)]` — the same specificity AD-24 already uses for `ErrorsManage`.

## 2. AD-25's "Key (unique)" contradicts FR-6's actual text

FR-6: *"Key (stable identifier, **unique per KeyType**)."* AD-25's Rule says: *"holds Key (unique), Value, KeyType..."* — unqualified. Read literally, this is a single global-unique index on `Key` alone, not the composite `(Key, KeyType)` scope the PRD specifies. Two engineers can genuinely diverge here: one adds a global unique index (silently forbidding any two future KeyTypes from ever sharing a Key string — narrower than what FR-6 promises), another adds the composite index FR-6 actually describes.

This compounds into `SettingChangeHistory`: AD-25 defines it as `(Key, OldValue, NewValue, ChangedBy, ChangedAt)` — no `KeyType` and no `SettingId` FK. The moment Key uniqueness is correctly scoped per-KeyType (per FR-6), "look up history by Key" becomes ambiguous across KeyTypes. `SettingChangeHistory` needs either a `SettingId` FK or a `(Key, KeyType)` composite, and AD-25 specifies neither.

**Fix:** change AD-25's Rule to "Key (unique per KeyType)" verbatim, and add `KeyType` (or a `SettingId` FK) to `SettingChangeHistory`'s column list.

## 3. FR-15's "read fresh, not client-supplied" isn't translated into a rule

FR-15 requires the recorded "old Value" to be *"read fresh from the store at the moment of the write (not the admin's possibly-stale page-load snapshot)."* This is exactly the class of gap the spine elsewhere catches deliberately (cf. AD-18's atomic pre-flight-reserve fix for a structurally similar before/after race). AD-25 only says `ISettingsService` "owns FR-10's ... check ... inside its Apply method" — FR-10 (curation), not FR-15 (history freshness), is the one thing called out. Nothing in AD-25 tells a future engineer that `Apply` must re-read the persisted `Value` from the repository rather than trust an `oldValue` field the client might pass in `ApplyRequest`. Left silent, this is a plausible, testable divergence (FR-15's own Consequences section is literally a test case: "Applying a Font Pairing change produces exactly one new change-history entry with the correct before/after values").

**Fix:** one sentence in AD-25's Rule: Apply reads the Setting's current `Value` from `ISettingRepository` (not from the request DTO) immediately before staging the update, so the history row's "old value" is always the just-prior persisted value.

## 4. FR-7's "no migration" isn't pinned to a representation for KeyType

FR-7 requires a new KeyType to be introducible "by data alone; no migration is required." AD-25 lists `KeyType` as a field but never states its underlying type. This matters because the codebase's own established convention for category-like fields — `ErrorCategory`, `ErrorPriority`, `ErrorSource`, `ErrorStatus` (all `Domain/ErrorObservability/*.cs`) — is a fixed C# `enum`. If a future engineer follows that local precedent for `KeyType` (the natural move, since AD-6/AD-24 explicitly tell them to mirror existing feature folders), adding `Color` or `Spacing` later requires a code change and redeploy — which doesn't literally break "no schema migration" but does break FR-7's actual intent ("by data alone"). AD-25 should say explicitly that `KeyType` is a plain string/varchar column, not a C# enum, precisely because the rest of this spine's own conventions would otherwise pull an implementer toward an enum.

**Fix:** add "`KeyType` is a string column, not a C# enum — a new KeyType is a new value written by data, matching FR-7's no-migration requirement" to AD-25's Rule.

## 5. No seeding rule for the initial Font Setting row

AD-26 is explicit that `FontPairingDefinition` rows are "Seeded via `DatabaseSeeder`, the same mechanism as `ErrorRetentionSettings`/`AiTaskConfig`." AD-25 never says the same for the one `Setting` row that actually carries the live Font Pairing (`KeyType=Font`, `Value=<default slug>`, `IsActive=true`). UJ-1 in the PRD assumes this row already exists and is visible ("Sees the current Font/Typography setting ... with its IsActive state and last-changed info") on an admin's very first visit. Without an explicit seeding rule, one engineer seeds it via `DatabaseSeeder` (consistent with AD-19/AD-26's own precedent), another builds a lazy create-on-first-read path — a real, silent divergence in exactly the spot this spine is careful about elsewhere.

**Fix:** extend AD-25's Rule (or add a sentence to AD-26, since it already owns the seeding statement) to also seed the initial Font `Setting` row via `DatabaseSeeder`.

## Secondary / minor notes

- **`Value`'s storage type is only inferable, not stated.** AD-25 never says `Value` is a scalar string column; it's only inferable from AD-26's aside ("the generic Setting table's scalar Value column (JSON-in-a-string)"). Worth stating directly in AD-25 rather than leaving it to be reverse-engineered from AD-26's *Prevents* clause.
- **No named method for the picker to fetch curated pairings.** AD-26 says the Settings screen "reads [FontPairingDefinition] to populate the picker," and the Structural Seed lists `IFontPairingDefinitionRepository` in `Application/Settings/`, but no service method is named (`ISettingsService`'s stated surface is "CRUD + Apply"). Minor — inferable, but worth a one-line mention (e.g., `ISettingsService.GetCuratedFontPairingsAsync()`) so two engineers don't independently decide whether this hangs off `ISettingsService` or a separate `IFontPairingDefinitionService`.
- **AD-20 reconciliation: holds up.** AD-25 claims AD-20 is scoped to "structured, hierarchical domain content (the course tree)," not this flat admin-config table. Checked against AD-20's own *Binds* line ("`Domain/Courses/`, and every AD above that references 'the confirmed content tree'") — the scoping is accurate, not just asserted; AD-25's carve-out doesn't structurally weaken AD-20. One pre-existing wrinkle AD-25 inherits rather than causes: AD-20's Rule text justifies itself via "matching Domain's existing 'explicit entities, not a generic shape' pattern (AD-1's own framing)" — but AD-1 is actually about dependency direction, not data-modeling shape, so that citation is loose. Not AD-25/26's defect to fix, but AD-25 leans on AD-20's authority, and that authority's own self-citation is shakier than it reads.
- **Deferred section:** no conflict. "Real-time settings push" correctly resolves NFR-1 in the Settings feature's favor and points back to the existing WebSocket Deferred item rather than inventing a second one. No other Deferred item creates a Settings-specific divergence risk.
- **Named tech:** AD-25/26 introduce no new packages/services — nothing to web-verify.
- **FR-6, FR-8, FR-9, FR-10, FR-11, FR-16, FR-17 coverage:** all structurally addressed (generic table shape, IsActive semantics implied by entity fields, curated-list enforcement inside `ISettingsService.Apply`, atomic single-row Font Setting per FR-11, `SettingChangeHistory` for FR-16, restore-reuses-Apply satisfying FR-17's "not a distinct unaudited path"). No gaps found beyond the Key-uniqueness/history-FK issue in Finding 2.

## Recommended actions before this is build-ready

1. Add an explicit `FeatureKeys.SettingsManage` (or similarly named) policy to AD-25's Rule, seeded for Master + Support (mirroring `TutorApprove`, not `MasterDataManage`/Tag-Management), applied as `[Authorize(Policy = ...)]` at `SettingsController` class level.
2. Fix "Key (unique)" → "Key (unique per KeyType)" in AD-25, and add `KeyType`/`SettingId` to `SettingChangeHistory`.
3. State explicitly that `Apply` reads the Setting's current persisted Value before writing history (FR-15 freshness).
4. State explicitly that `KeyType` is a string column, not a C# enum (FR-7 no-migration).
5. Extend the `DatabaseSeeder` seeding rule to cover the initial Font `Setting` row, not just `FontPairingDefinition`.

None of these require restructuring AD-25/AD-26's entity shape — they're additions to the existing Rule text, not a redesign.
