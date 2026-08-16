---
name: 'Adversarial Review — AD-25/AD-26 (Admin Settings) vs. FlexDemy Backend Architecture Spine'
type: architecture-review
reviews: 'ARCHITECTURE-SPINE.md AD-25/AD-26 (FlexDemy Backend, 2026-08-09, updated 2026-08-15), cross-checked against prd-eLearning-AdminSettings-2026-08-15/prd.md'
method: 'Two-independent-engineer collision test — each obeys every AD to the letter, no communication between them'
created: '2026-08-15'
---

# Adversarial Review — AD-25 (Settings) / AD-26 (FontPairingDefinition)

## Method

For each finding below I construct two implementers who never talk to each other, read only `ARCHITECTURE-SPINE.md` (AD-1 through AD-26) and `prd-eLearning-AdminSettings-2026-08-15/prd.md`, and each produce code that is individually defensible under the ADs' literal text. I check whether AD-25/AD-26 — and their stated interaction with AD-9, AD-10, AD-11, AD-20 — force convergence. Where they don't, I record the scenario, the exact text gap, and a concrete tightening in the spine's own Binds/Prevents/Rule shape.

Severity: **Critical** (breaks correctness, security, or blocks integration), **High** (real bug/inconsistency, system still runs), **Medium** (rework/friction), **Low** (cosmetic).

---

## Finding 1 — [CRITICAL] The curated-check is pinned to "Apply," but nothing pins every value-changing write to go *through* Apply — a curation bypass side door

**Scenario.** AD-25's rule gives `ISettingsService` "CRUD + Apply per AD-2/AD-3/AD-10's existing plain-service/DTO-boundary conventions," and separately says FR-10's curation check lives "inside its Apply method." Nothing says Apply is the *only* method that can make a Font-KeyType Value live.

- **Engineer A (builds FR-17 restore)** reads FR-17 literally — "restoring is not a distinct, unaudited or unvalidated code path" — and implements `RestoreAsync(historyEntryId)` as a thin wrapper that loads the historical entry and calls `ApplyAsync(new ApplyRequest { Key = ..., Value = entry.NewValue })` internally. Curation check fires automatically. Fully compliant.
- **Engineer B (builds the generic CRUD surface AD-25 also promises)** reads AD-25's "CRUD + Apply" as *two separate capabilities* — Update is the plain CRUD write (matching every other feature's `Update{Entity}Request` per AD-10), and Apply is a distinct, curation-checked action reserved for the Font-picker's explicit "Apply" button flow. Engineer B builds `UpdateAsync(UpdateSettingRequest)` against `ISettingRepository` directly for ordinary field edits (e.g. flipping `IsActive`), because AD-25 never says Update must also run the curation check — only Apply is named as owning it.

Both readings are individually defensible. The collision: FR-8 says `IsActive=false` reverts to the hardcoded default, and by symmetry `IsActive=true` makes the stored `Value` live again. If a Font Pairing is removed from the curated list (FR-10's own consequence: "makes it immediately unavailable for new Applies and restores") while a Setting row referencing it is currently `IsActive=false`, Engineer B's generic `UpdateAsync` lets an admin flip `IsActive` back to `true` and silently re-activate a now-decurated pairing — with zero curation check, because that write never touches `ApplyAsync`. This directly violates FR-10's explicit, testable requirement ("regardless of which client made the request") and NFR-2's "not just hidden from navigation" spirit: the bypass isn't a missing auth check, it's a missing *validation* check reachable through an AD-sanctioned CRUD path.

**Why AD-25 doesn't stop it.** AD-25's rule text says the check is "ordinary validation logic inside its Apply method" — true, but it never states that Apply is the *exclusive* gate for any operation that changes what Value is effectively live (new Value, restored Value, or reactivated Value via `IsActive`). "CRUD + Apply" reads as two coequal surfaces, not one gated surface with CRUD limited to non-value-affecting fields.

**Proposed tightening (extends AD-25).**

- **Binds:** `ISettingsService`'s write surface
- **Prevents:** a generic CRUD/Update or Restore path re-introducing a Value as effectively live without FR-10's curation check
- **Rule:** exactly one method — `ApplyAsync(ApplyRequest)` — is capable of (a) changing a Setting's `Value`, or (b) flipping `IsActive` from `false` to `true`. It is the sole place the curation check (AD-25) runs. `RestoreAsync(historyEntryId)` is a thin wrapper that resolves the historical `Value` and calls `ApplyAsync` — it never writes through `ISettingRepository` directly. A narrower `DeactivateAsync` (IsActive `true`→`false` only) may bypass the check since it never re-introduces a value (FR-8's hardcoded-default fallback is always curation-safe). No `UpdateAsync` exists on the Font-KeyType path for `Value`/`IsActive`; other KeyTypes without a curated list are unaffected by this restriction.

---

## Finding 2 — [CRITICAL] AD-9 (GUIDv7 IDs via `IIdGenerator`) is never reconciled with AD-25's field list for `Setting` and `SettingChangeHistory`

**Scenario.** AD-9: "every new aggregate root's `Id` is assigned via `IIdGenerator.NewId()` before construction," IDs are `string` GUIDv7. AD-25's field list for `Setting` is "Key (unique), Value, KeyType, IsActive, CreatedAt/UpdatedAt/UpdatedBy" — **no `Id` field is named.** `SettingChangeHistory`'s field list is "Key, OldValue, NewValue, ChangedBy, ChangedAt" — also no `Id`. Contrast AD-26, which for `FontPairingDefinition` explicitly lists "**Id**/Slug" — a deliberate Id-vs-natural-key split, done correctly. AD-25 doesn't do this for `Setting`.

- **Engineer A (writes `SettingConfiguration.cs`)** takes AD-25's field list literally: the only "(unique)" field named is `Key`, so `Key` becomes the EF primary key (`HasKey(s => s.Key)`). No `Id` column exists. This satisfies AD-25's letter exactly as written.
- **Engineer B (writes `SettingsService.CreateAsync`/domain construction)** takes AD-9 literally: `Setting` is unambiguously "a new aggregate root" (AD-25 itself calls it "A `Setting` entity," it has its own repository per AD-4), so every construction path does `new Setting(id: _idGenerator.NewId(), key: ..., ...)`, expecting an `Id` property distinct from `Key`. This satisfies AD-9's letter exactly as written.

These two units are incompatible the moment they integrate: Engineer B's constructor call references a property Engineer A's entity/mapping never defined. Worse, if this reaches migration time before either notices, the schema is missing a column the other layer's code assumes exists — a build-time break at best, a silent divergent-branch schema drift at worst (mirroring exactly the "colliding migrations" failure mode AD-8/AD-13 already guard against for other entities, but AD-25 reopens it here).

The same gap recurs for `SettingChangeHistory`, with a sharper functional consequence: FR-17 says "selecting a prior entry from history populates it as the preview candidate" — this requires a stable, unambiguous per-row identifier to select *one* history entry by. AD-25 gives `SettingChangeHistory` no PK at all, and its own `ISettingChangeHistoryRepository` (named explicitly in the Structural Seed, implying independent aggregate status per AD-4's one-repository-per-entity pattern) has nothing to key lookups on except `Key + ChangedAt` — a natural composite key that isn't guaranteed unique (two applies to the same Key within the same tick, or any future batch/import path) and doesn't match AD-9's GUIDv7-Id convention used everywhere else.

**Why AD-25 doesn't stop it.** AD-25's Rule paragraph enumerates fields for `Setting`/`SettingChangeHistory` without ever stating whether that list is exhaustive or additive to AD-9's baseline `Id`. AD-26's own text proves the spine authors know how to make this explicit (`Id`/Slug) — AD-25 simply omits the equivalent clause.

**Proposed tightening (extends AD-25).**

- **Binds:** `Domain/Settings/Setting.cs`, `Domain/Settings/SettingChangeHistory.cs`
- **Prevents:** one engineer treating `Key` as the primary key (violating AD-9) while another assumes a GUIDv7 `Id` exists
- **Rule:** `Setting` and `SettingChangeHistory` follow AD-9 like every other entity: each has an application-generated `string Id` (GUIDv7 via `IIdGenerator`) as its primary key. `Setting.Key` is a separate, unique, indexed *business* identifier (`HasIndex(s => s.Key).IsUnique()`), never the PK. `SettingChangeHistory.Id` is the value FR-17's "select a prior entry" operates on (`RestoreAsync(historyEntryId: string)`), not a `Key + ChangedAt` composite.

---

## Finding 3 — [HIGH] The curated-list read path and slug→font-name resolution are unspecified, producing two incompatible wire contracts

**Scenario.** AD-26 says `FontPairingDefinition` is "Not exposed for admin CRUD in v1 — the Settings screen only reads it to populate the picker and to validate an incoming Apply/Restore against it." It never names an endpoint, controller, or DTO for that read. AD-25's `SettingDto` is generic (`Key/Value/KeyType/IsActive/...`); AD-26 insists the stored `Value` is "never the resolved font names duplicated into the Setting row" — a storage-layer rule that says nothing about the *DTO* returned to the frontend. But UJ-1 and FR-5 need the UI to show "Display: Fraunces, Body: Outfit, Mono: JetBrains Mono," not a bare slug.

- **Engineer A (backend, follows AD-10's generic-mapper convention + AD-26's anti-duplication spirit literally)** keeps `SettingDto.Value` as the raw slug for Font-KeyType rows and builds no enrichment. Reasoning: AD-26's "never duplicate resolved names" principle should extend from storage to the wire contract too, for the same reasons (single source of truth in `FontPairingDefinition`).
- **Engineer B (backend, building FR-9's picker and FR-5's list view against the PRD's own UX text)** enriches Font-KeyType `SettingDto`s server-side with resolved `DisplayFont`/`BodyFont`/`MonoFont` fields (a join against `FontPairingDefinition` inside `SettingMapper`), because the PRD explicitly requires the UI to render resolved names and nothing in AD-25/AD-26 forbids DTO-level enrichment — only *storage*-level duplication.

Both are AD-compliant readings of "never... duplicated into the Setting row" (a storage statement, not a DTO statement). If the frontend is built against one shape and the backend ships the other, `GET /api/v1/settings` either omits data the picker needs (Engineer A) or returns a KeyType-conditional, non-generic DTO shape that breaks AD-25's "small, flat, heterogeneous" self-description (Engineer B) — and no endpoint is named anywhere in the Structural Seed's `Api/Controllers/` list for fetching the curated pairing list itself (only `SettingsController.cs` appears; no `FontPairingsController` or sub-route). Two engineers could just as plausibly land on `GET /api/v1/settings/font-pairings` (co-located under Settings, since AD-26 places `FontPairingDefinition` in the same feature folder) versus a standalone `GET /api/v1/font-pairings` (AD-5's `/api/v1/{resource}` convention read literally, since it's structurally its own resource) — an unforced route-naming collision the frontend has to guess at.

**Why AD-25/AD-26 don't stop it.** Both ADs govern *storage* shape and *validation* ownership; neither states where slug→font-name resolution happens (Application-layer DTO enrichment vs. a separate lookup endpoint the client joins client-side) or names the read route for the curated list FR-9 depends on.

**Proposed tightening (extends AD-26).**

- **Binds:** `Application/Settings/SettingDto`, `Api/Controllers/SettingsController.cs`
- **Prevents:** divergent enriched-vs-raw DTO shapes and guessed route names between backend and frontend
- **Rule:** `SettingDto.Value` stays the raw slug for every KeyType, including Font — no KeyType-conditional enrichment. `SettingsController` exposes a dedicated read-only sub-route, `GET /api/v1/settings/font-pairings`, returning `FontPairingDefinitionDto[]` (`Slug, DisplayFont, BodyFont, MonoFont, IsActive`) for every currently-active curated pairing; the frontend resolves slug→names by joining this list client-side, both for FR-9's picker and FR-5's list view. This is the one sanctioned read path for `FontPairingDefinition` data.

---

## Finding 4 — [MEDIUM-HIGH] FR-15's "read fresh, not stale" OldValue capture has no atomicity rule, unlike AD-18's own precedent for the same shape of problem

**Scenario.** FR-15 requires history to record "the immediately-prior Value read fresh from the store at the moment of the write (not the admin's possibly-stale page-load snapshot)." AD-25 never states *how* Apply captures that fresh value relative to the write itself.

- **Engineer A** implements the obvious EF Core shape: `var setting = await _repo.GetByKeyAsync(key); var oldValue = setting.Value; setting.Value = newValue; _historyRepo.Add(new SettingChangeHistory(... oldValue, newValue ...)); await _unitOfWork.SaveChangesAsync();` — a load-then-save, satisfying AD-11 (one `SaveChangesAsync`, repositories only stage) and FR-15's letter (it *is* read fresh from the store, not from the client).
- **Engineer B**, aware that AD-18 solved an analogous "read of a mutable row must be race-free under concurrent writers" problem with a single atomic `UPDATE ... WHERE ... RETURNING` statement rather than EF's load-then-save, applies the same pattern here for the same reason: `UPDATE setting SET value = @new WHERE key = @key RETURNING value AS old_value_before_this_write` (conceptually), so the captured OldValue and the write are one atomic step.

Both individually satisfy AD-11 and FR-15. But under NFR-5's accepted last-write-wins concurrency model, two admins applying near-simultaneously against Engineer A's implementation can each load the same pre-write `Value`, both stage an update, and — depending on commit order — one history row ends up recording an `OldValue` that was never actually "immediately prior" to its own `NewValue` in commit order (the other admin's interleaved write is skipped over in the history chain). This doesn't violate NFR-5 (no conflict *detection* is promised) but it does violate FR-15's explicit "read fresh... not stale" requirement in a way Engineer B's atomic version wouldn't. AD-25 gives no basis to prefer one over the other, even though the spine already established the atomic pattern as its own house style for exactly this race shape (AD-18).

**Why AD-25 doesn't stop it.** AD-25 states FR-15's requirement is met by delegating to "ordinary validation/write logic inside Apply" without pinning the read-capture mechanism, and doesn't cross-reference AD-18's atomic-UPDATE precedent the way a reader would expect given the near-identical race shape.

**Proposed tightening (extends AD-25).**

- **Binds:** `SettingsService.ApplyAsync`'s OldValue capture
- **Prevents:** load-then-save races producing a history row whose `OldValue` isn't truly the value immediately superseded by that write
- **Rule:** `ApplyAsync` captures `OldValue` via the same statement that performs the write (an `UPDATE ... SET value = @new ... RETURNING value` read-before-write within the same round trip, or an equivalent EF Core `ExecuteUpdate`-with-prior-read-in-one-transaction pattern), mirroring AD-18's atomic-reservation shape — never a separate `Get` followed by a later `Update`/`SaveChangesAsync`.

---

## Cross-check against the prompt's specific question

> Could two engineers build FR-10's server-side check and FR-17's restore-time check incompatibly given what AD-25/AD-26 actually say?

**Yes — this is Finding 1.** AD-25 names Apply as the owner of the curation check but never states that Apply is the *only* path capable of making a Value live. FR-17 itself only requires restore to go through "the same... curation check (FR-10)" — it doesn't, and can't from the PRD alone, close off a third path (generic Update / IsActive reactivation) that AD-25 leaves open. An engineer who reads "CRUD + Apply" as two coequal capabilities (a very natural reading, since every other feature in this spine has a plain `Update` alongside domain-specific actions) will build a curation-check bypass that is fully AD-compliant and fully FR-10/FR-17-noncompliant at the same time.

---

## Summary Table

| # | Finding | Severity | Gap type |
| --- | --- | --- | --- |
| 1 | No rule that Apply is the *exclusive* gate for value-changing/reactivating writes — CRUD/Restore can bypass FR-10's curation check | Critical | Missing AD (extends AD-25) |
| 2 | AD-9's GUIDv7-Id convention never reconciled with AD-25's `Setting`/`SettingChangeHistory` field lists (which name no `Id`, unlike AD-26's `FontPairingDefinition`) | Critical | Underspecified AD-25 |
| 3 | Curated-list read endpoint and slug→font-name resolution (DTO enrichment vs. client-side join) unspecified | High | Missing AD (extends AD-26) |
| 4 | FR-15's "read fresh, not stale" OldValue capture has no atomicity rule, despite AD-18 already establishing the atomic-UPDATE pattern for the same race shape | Medium-High | Underspecified AD-25 |

All four gaps share a root cause: AD-25/AD-26 correctly resolve the *shape* question AD-20 poses (generic table vs. explicit entities) but leave three *behavioral* seams implicit — which method is the sole gate for a value-changing write, what the primary-key convention is for the two new entities, and how the curated reference data is read and resolved for display. Each seam is exactly the kind two independently-reasonable, letter-compliant engineers resolve differently, and Finding 1 in particular reopens a real validation-bypass risk of the same shape AD-24 was written to prevent for `IErrorCaptureService` (multiple call sites reimplementing/skipping one piece of shared logic) — but AD-25 never applies that already-learned lesson to itself.
