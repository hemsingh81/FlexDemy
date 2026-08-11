---
name: 'Adversarial Review — FlexDemy Backend Architecture Spine (CourseWizard / AD-14–AD-19)'
type: architecture-review
reviews: 'ARCHITECTURE-SPINE.md (FlexDemy Backend, 2026-08-09, updated 2026-08-11)'
method: 'Two-independent-engineer collision test, focused on the AD-14–AD-19 addendum (AI Service Layer, Hangfire async jobs, version snapshots, budget counter, DB-backed AI config) and its interaction with AD-1–AD-13'
created: '2026-08-11'
---

# Adversarial Review — FlexDemy Backend Architecture Spine (AD-14 through AD-19)

## Method

For each finding I construct two implementers who never talk to each other and only read `ARCHITECTURE-SPINE.md` — most often "Engineer A" building the **publish** side of the Hangfire/AI work and "Engineer B" building the **extraction** side, or "Engineer A" building the AD-14 gateway/fallback path and "Engineer B" building the AD-19 config store. I check whether the AD text as written forces convergence on one concrete contract. Where it doesn't, both engineers can honestly claim AD-compliance while shipping code that doesn't fit together. Findings are ordered **Critical** (breaks correctness/integration) → **High** (real bugs/inconsistency, system still runs) → **Medium** (rework/friction) → **Low** (drift, easy to patch later).

---

## Finding 1 — [CRITICAL] AD-16's AD-11 carve-out only names "the publish use-case," leaving extraction job items with no legal per-item commit path

**Scenario.** AD-15 states publish and extraction "are the identical shape (per-item async work, independent status, independent retry), so both use the same job mechanism rather than two," and its own rationale for one-job-per-item is that "per-item status is tracked individually... a failed item is retryable on its own without re-running the whole batch" — a rationale that applies word-for-word to both workloads. But AD-16's **Binds** line reads "the publish use-case and its Hangfire job items," and its **Rule** only exempts "the use-case that triggers Publish" and "each Hangfire job item" *of the publish batch* from AD-11's "exactly one `SaveChangesAsync` per use-case" rule.

Engineer A (publish-job-item handler) is explicitly carved out and commits each generated content node independently — compliant with both AD-15 and AD-16.

Engineer B (extraction-job-item handler), reading AD-16 literally, is *not* named by it. Read AD-11 on its own ("only the Application service method calls `SaveChangesAsync`, exactly once per use-case... repositories never call `SaveChangesAsync` themselves"), Engineer B has two AD-compliant-looking but incompatible options: (a) buffer all N per-file extraction results into one `SaveChangesAsync` at the end of the whole batch to satisfy AD-11's literal text — which destroys the exact "failed item retryable on its own without re-running the whole batch" property AD-15 mandates for extraction just as much as for publish; or (b) commit per-file anyway, on the theory that AD-15's "identical shape" language implicitly extends AD-16 to extraction — which is a reasonable reading, but is not what AD-16's Binds/Rule text actually says, and a stricter-reading reviewer or CI lint enforcing "one SaveChangesAsync per use-case, no exceptions outside AD-16's named scope" would flag it as a violation.

Two engineers, both citing the spine, end up on two different transaction-commit strategies for what the spine itself insists is one identical mechanism.

**Why the current ADs don't stop it.** AD-16's own title and Binds line say "Publish-batch job-item commits," not "Hangfire job-item commits (AD-15)." The carve-out was written before/without folding in AD-15's later merge of publish and extraction into one mechanism, so its scope text lags AD-15's own framing.

**Proposed tightening — reword AD-16:**
- **Binds:** "the publish use-case **and the extraction use-case**, and both of their Hangfire job items (per AD-15, which governs them identically)"
- **Rule:** replace "the use-case that triggers Publish" and "Each Hangfire job item" (publish-only phrasing) with "the use-case that triggers Publish, and the use-case that triggers a file-extraction batch, each still obey AD-11 as written... Each Hangfire job item — whether a publish content-node generation call or a per-file extraction — commits its own result independently..."

---

## Finding 2 — [CRITICAL] AD-15 defines the job *mechanism* but not a shared job-item status/payload contract, leaving room for an AD-1-violating status-read path alongside a compliant one

**Scenario.** AD-15 requires "per-item status... tracked individually" for both publish and extraction but never states: where that status lives (a Domain-level entity/field updated by the job, vs. reading Hangfire's own internal PostgreSql-backed job/state tables directly), what the status vocabulary is, or which layer is allowed to query it. The Structural Seed's only hint is `Infrastructure/Jobs/ # Hangfire job classes, one per content-node generation call (AD-15)` — i.e., job *classes* (enqueue targets), not a named Domain job-item entity.

Engineer A (publish) needs to expose "N of 200 items done" to the Admin UI. Reading AD-15's own justification for choosing Hangfire ("its built-in retry/dashboard machinery"), Engineer A wires the status endpoint to query Hangfire's `IMonitoringApi`/`JobStorage` directly from an Application-layer (or even Api-layer) status service — the path of least resistance, and arguably what "built-in dashboard machinery" is inviting. This reaches an Infrastructure-only, Hangfire-specific type from outside Infrastructure, a direct violation of AD-1 ("nothing in an inner ring may reference an outer ring" / Infrastructure implements Application's interfaces, not the reverse).

Engineer B (extraction), independently, builds a proper `ExtractionStatus` field on a Domain-level entity, updated by the Hangfire job class, read back through a repository behind an Application interface — fully AD-1/AD-4 compliant.

Both engineers satisfy AD-15's letter ("per-item status is tracked individually"). One violates the spine's cornerstone dependency rule to get there; the other doesn't. Even setting the AD-1 question aside, their status **vocabularies** diverge with nothing to stop it — e.g. publish's `{Queued, Running, Succeeded, Failed}` vs. extraction's `{Pending, Processing, Done, Error, Cancelled}` — so any later unifying job-status surface (Admin dashboard, a shared polling endpoint) can't treat the two uniformly.

**Why the current ADs don't stop it.** AD-15 pins the mechanism (Hangfire, one job per item, same Postgres store) but is silent on the status-read boundary and on a shared status enum/DTO — the exact kind of cross-cutting contract that needs pinning once two features are told to share one mechanism.

**Proposed new AD (AD-15a, or fold into AD-15):**
- **Binds:** job-item status reads, for both publish and extraction
- **Prevents:** Hangfire-specific types crossing into Application/Api (AD-1 violation), and each workload inventing its own status vocabulary
- **Rule:** define one shared `JobItemStatus` enum (e.g. `Pending, Running, Succeeded, Failed`) in `Application/Common/`. Neither publish nor extraction code queries Hangfire's `IMonitoringApi`/`JobStorage` from outside `Infrastructure/Jobs/`; per-item status is written to a Domain-level field/entity by the job class itself and read back only through the owning feature's repository/service, per AD-4.

---

## Finding 3 — [CRITICAL] Budget "threshold" (AD-19, `AiConfig/AiTaskConfig`) and budget "spend" (AD-18, `AiUsage/AiTaskBudget`) sit in two different feature folders/tables with no stated join or duplication rule

**Scenario.** AD-18's rule text is a single atomic statement: `UPDATE ... SET spent = spent + cost WHERE task_id = ... RETURNING spent`, against what the Structural Seed comment implies is `AiTaskBudget` (under `Domain/AiUsage/`). AD-19 separately states `AiTaskConfig` (under `Domain/AiConfig/`) holds "budget threshold," writable by Admin, and is "the single source of truth for gateway behavior." Neither AD says how enforcement actually happens end-to-end, nor whether the two tables share or duplicate the threshold value.

Engineer A (AD-18, atomic counter) wants threshold enforcement in the same round trip as the increment — the natural way to avoid a check-then-act race under concurrency, which is the whole stated point of AD-18 ("atomic... not a cached running total"). To do that in one statement (`WHERE spent + cost <= threshold`), the threshold value has to live on the same row/table as `spent` — so Engineer A adds a `threshold` column directly to `AiTaskBudget`, populated at row-creation time.

Engineer B (AD-19, Admin CRUD) builds `IAiConfigService`/`AiConfigController` to let Admin edit `AiTaskConfig.budget_threshold` and treats that column as the sole editable value, with no awareness that AD-18's code path reads a *different*, already-duplicated copy on `AiTaskBudget`.

Result: Admin changes the threshold through the sanctioned AD-19 UI; the atomic counter in AD-18 keeps enforcing its own stale copy. This is precisely the "no redeploy, config change takes effect on the next call" guarantee AD-19 exists to protect — broken one layer down, DB-to-DB instead of file-to-DB, because the spine names two owners (`AiUsage` and `AiConfig`) for what is effectively one number's read path, without saying which is canonical at enforcement time.

**Why the current ADs don't stop it.** AD-18's rule text never mentions the threshold at all — only the increment. AD-19's rule text names `AiTaskConfig` as holding the threshold but never says whether `AiTaskBudget` may cache/duplicate it, nor how the atomic-increment query is supposed to read across two tables/two feature folders without breaking its own atomicity.

**Proposed tightening — add to AD-18:**
- **Rule (add):** `AiTaskBudget` holds `spent` (and `task_id`) only — it never stores its own copy of the threshold. The atomic statement enforcing budget is a single query joining `AiTaskConfig.budget_threshold` in the same round trip, e.g. `UPDATE ai_task_budget b SET spent = spent + $cost FROM ai_task_config c WHERE b.task_id = c.task_id AND b.task_id = $taskId AND b.spent + $cost <= c.budget_threshold RETURNING b.spent` — so AD-19's edits are visible to the very next call with no separate sync step, and the increment-and-enforce stays atomic.

---

## Finding 4 — [HIGH] AD-17's deep-copy snapshot and the "confirmed content tree" it copies have no single stated entity model — reuse vs. duplicate is undecided

**Scenario.** AD-17 says "each publish deep-copies the entire confirmed content tree... into a versioned snapshot," and the Structural Seed lists `CourseVersion (deep-copy publish snapshot, AD-17)` alongside `Course, Module, Lesson entities` in the same `Courses/` folder — but nowhere states whether `CourseVersion` is built from the *same* `Module`/`Lesson` C# types (a shared-table or shared-type strategy, e.g. a nullable `VersionId` discriminating live vs. snapshot rows) or is a fully separate, parallel set of snapshot-only types (`VersionedModule`, `VersionedLesson`) with independently duplicated shape.

Engineer A, owning the live/editable "confirmed content tree" (the CourseWizard editing surface), builds `Module`/`Lesson` as mutable aggregates with EF navigation properties FK'd to `CourseId`, evolving their shape over time as CourseWizard's editing UX needs change (new fields, new child types).

Engineer B, owning publish/versioning, implements AD-17's deep-copy against that same `Module`/`Lesson` shape as of the day they wrote the copy code — either by literally reusing the types (in which case every future edit Engineer A makes to `Module`/`Lesson` for live-editing reasons silently changes what a "snapshot" row means and risks live-editing-only fields leaking into historical versions) or by hand-duplicating a parallel type set frozen at that day's shape (in which case Engineer A's later schema changes to the live tree are never reflected in new snapshots without Engineer B separately updating the copy code every time — an easy-to-forget manual sync with no AD requiring it).

Either way, "the tree" — the thing AD-17 says gets deep-copied — has two independently evolving definitions: the live-editing one and the snapshot one, with no AD stating which one is authoritative or how they stay in sync.

**Why the current ADs don't stop it.** AD-17's Rule describes the *operation* (deep-copy into a snapshot, swap an active-version pointer to restore) but never names the entity strategy (shared types vs. duplicated types) or which feature owns keeping them in sync. The spine also never defines "confirmed content tree" as a concrete entity concept anywhere (no `ConfirmedContentTree` type, no `IsConfirmed` flag mentioned) — it is used as if pre-defined by the referenced CourseWizard PRD, but that definition doesn't appear in this spine.

**Proposed tightening — add to AD-17:**
- **Rule (add):** `CourseVersion` and its children are a **structurally duplicated**, snapshot-only type set (`CourseVersion`, `CourseVersionModule`, `CourseVersionLesson`, ...) in `Domain/Courses/`, deliberately not sharing C# types with the live `Course`/`Module`/`Lesson` aggregates, so live-editing schema evolution never silently redefines historical snapshots. The `{Entity}Mapper` pattern (AD-10) is extended with a `ToVersionSnapshot()` path whose maintenance — keeping the snapshot shape in step with the live tree's shape — is owned by whichever engineer changes the live `Module`/`Lesson` shape, not deferred to the versioning feature to notice later.

---

## Finding 5 — [HIGH] AD-14 never cites AD-19 as the source of "configured secondary provider/model" — the fallback-config linkage is asserted from only one side

**Scenario.** AD-14's Rule states Polly "falls back to that task's configured secondary provider/model on failure" without saying *where* that configuration is read from. AD-19's Rule states `AiTaskConfig` (fallback provider/model included) is "read by `Infrastructure/AiGateway`'s implementation at request time" — but this linkage only appears in AD-19's text; AD-14 doesn't reference AD-19 or `AiTaskConfig` at all.

Engineer A implements AD-14's Polly wrapper in isolation, following idiomatic .NET/Polly practice: fallback provider/model bound once at startup via `IOptions<AiGatewayOptions>` from `appsettings.json`, because that's what AD-14's own text gives them to work with, and Polly policies are conventionally configured that way.

Engineer B implements AD-19 in parallel: `AiTaskConfig` entity, `IAiConfigService`, `AiConfigController` for Admin, all fully wired and testable in isolation — but nothing in AD-19's scope requires Engineer B to also touch `Infrastructure/AiGateway`'s Polly policy, since that's "someone else's" (AD-14's) code.

Both AD-14 and AD-19 ship, both pass their own unit tests, both individually satisfy their AD's Rule text. The integrated system has a fully functional Admin config-editing UI that writes to a table nothing ever reads at the point Polly actually decides to fall back — exactly the silent "no redeploy" breakage AD-19's own **Prevents** clause warns about, arising precisely because the read-side obligation is written into AD-19 but never mirrored as a write-side/consumer obligation in AD-14.

**Why the current ADs don't stop it.** Cross-referencing between ADs in this spine is inconsistent — some ADs explicitly say "(AD-15)" style pointers, but AD-14's fallback sentence and AD-19's config-source sentence describe the same wiring from opposite ends without either naming the other by ID.

**Proposed tightening — add one sentence to AD-14:**
- **Rule (add):** "...falling back to that task's configured secondary provider/model, **read from `AiTaskConfig` (AD-19) via `Infrastructure/AiGateway`'s own per-call DB read — never from `appsettings.json` or an `IOptions<T>` snapshot bound at startup**, so an Admin-side threshold/provider edit (AD-19) takes effect on the very next call as AD-19 requires."

---

## Finding 6 — [HIGH] No feature folder in the Structural Seed owns extraction-job-item state, despite AD-15 naming extraction a first-class, equally-weighted workload

**Scenario.** AD-15's Binds line names "the file upload/parsing/extraction pipeline (FR-11–13)" as co-equal to publish. But the Structural Seed's Domain and Application folders list only `Courses, Tutoring, Notes, Reviews, Users, AiUsage, AiConfig, Tags` — no `Uploads/`, `Files/`, or `Extraction/` folder anywhere, for either layer.

Engineer A, picking up the extraction-job-item handler with no named home for it, and noticing extraction ultimately feeds course content, bolts an `ExtractionStatus`/related fields onto the existing `Courses/` feature folder (e.g. on `Module`/`Lesson`, or a new `Courses/UploadedFile` sub-type) — a defensible reading of "just extend the feature it belongs to."

Engineer B, working the same handler on a different day (or a second engineer picking up a related extraction ticket), instead creates a new `Domain/Extraction/` and `Application/Extraction/` feature folder per AD-6's "organized by feature area" instruction, since extraction is its own pipeline stage distinct from course content authoring.

Both are legal under AD-6, which says folders exist "by feature area" but doesn't enumerate which areas exist for AD-15's second workload. The two engineers now have two disjoint ownership stories for the same conceptual entity (an uploaded file's parse/extraction status) — a duplicate-owner clash exactly like the ones this review is asked to hunt for, caused by the Structural Seed simply omitting the folder.

**Why the current ADs don't stop it.** AD-15 elevates extraction to the same tier as publish, but the Structural Seed — the concrete artifact meant to close AD-6's ambiguity — was updated for publish/AI (`AiUsage`, `AiConfig`) and not for extraction.

**Proposed tightening — add to the Structural Seed:**
- Add `Domain/Uploads/ # UploadedFile entity, extraction status (FR-11-13, AD-15)` and a matching `Application/Uploads/` (`IUploadedFileService`, repository interface) so AD-6 has a named home to bind extraction-job-item state to, symmetric with `Courses/`'s ownership of publish-job-item state.

---

## Finding 7 — [MEDIUM] AD-19 doesn't say whether `Infrastructure/AiGateway` reads config through `IAiConfigService` or bypasses it via a direct repository — business-rule (e.g. "active prompt only") enforcement may or may not run

**Scenario.** AD-19 exposes `Application/AiConfig/IAiConfigService` for Admin CRUD *and* says config is "read by `Infrastructure/AiGateway`'s implementation at request time" — without saying which interface the gateway reads through. If `IAiConfigService` (or whatever repository sits under it) enforces business rules — e.g. "only an *activated* `AiPromptVersion` is eligible, not merely the latest one" — those rules only fire if the gateway's hot-path read goes through the same code.

Engineer A (AD-14/Infrastructure `AiGateway`) wires a lean, latency-sensitive direct `IAiConfigRepository` read into the per-call hot path, bypassing `IAiConfigService` entirely (same-layer access is not obviously prohibited by AD-4/AD-12, which scope "no repository reach-through" to cross-*feature* Application-layer calls, not Infrastructure-to-Infrastructure).

Engineer B (AD-19) puts activation-state validation (e.g. "skip a prompt version still in draft") inside `IAiConfigService`, assuming — reasonably, since AD-19 introduces the service specifically "per AD-2/AD-10's DTO-boundary convention" — that it's the one path everything goes through.

The two are compiled from the same spine text and only diverge in behavior once a prompt version exists in a non-active state: Engineer A's gateway may pick it up anyway.

**Why the current ADs don't stop it.** AD-19 states two things (a service interface for Admin, and "read at request time" for the gateway) without stating they're the same call path.

**Proposed tightening — add to AD-19:**
- **Rule (add):** "`Infrastructure/AiGateway`'s per-call config read goes through the same activation/eligibility filtering as `IAiConfigService` — either by calling it directly, or by sharing its underlying query — never a separate raw read that could skip a business rule enforced only in the service."

---

## Finding 8 — [MEDIUM] "AI Task" identity scheme (fixed code vs. AD-9's default GuidV7) is unstated, and AD-14's dispatch and AD-18/19's `task_id` may not agree

**Scenario.** AD-14 dispatches AI work through compile-time `IAiGateway` methods (`ExtractStructureAsync`, `ExplainTopicAsync`, ...). AD-18 and AD-19 key their tables by `task_id`. AD-9's default rule is that every new aggregate root's `Id` is a `GuidV7` via `IIdGenerator` — but a small, fixed-cardinality lookup concept like "AI Task" (seven known values, matching `IAiGateway`'s method set 1:1) is exactly the kind of thing that's usually a stable string/enum code in a config table, not an opaque generated GUID a caller has to look up first.

Engineer A (AD-14's usage-logging/fallback-logging code, and AD-18's atomic-increment call site) hardcodes the task identifier as the method's human-readable name (`"ExtractStructure"`) when writing to the usage/budget path, since that's the only identifier available at the call site without an extra round trip.

Engineer B (AD-19, building `AiTaskConfig`) follows AD-9's stated default literally and gives `AiTaskConfig.Id` a `GuidV7`, with `task_id` elsewhere presumed to be that same generated key — requiring a name-to-GUID lookup that AD-14's call sites never perform.

The two never agree on whether `task_id` is a human-readable stable code or a generated key, breaking the join AD-18's atomic UPDATE and AD-19's config lookup both depend on.

**Why the current ADs don't stop it.** AD-9 is written as a blanket rule ("every new aggregate root") with no stated exception for small fixed-taxonomy lookup entities, and neither AD-18 nor AD-19 pins `task_id`'s concrete type/origin.

**Proposed tightening — add to AD-19:**
- **Rule (add):** "`AiTaskConfig.task_id` (and `AiTaskBudget.task_id`) is a fixed, human-readable task code (a string constant/enum matching `IAiGateway`'s method set 1:1, e.g. `\"ExtractStructure\"`), seeded once at migration time — an explicit, spine-sanctioned exception to AD-9's `GuidV7` default, since AI Task is a closed, compile-time-known taxonomy rather than a user-created aggregate."

---

## Finding 9 — [LOW] AD-17's "cached Drill-Down/Way content" has no entity model anywhere in this spine to actually deep-copy

**Scenario.** AD-17's Rule says the deep-copy snapshot includes "the confirmed content tree **plus its cached Drill-Down/Way content**." AD-14 itself refers to Drilldown/Exercises as "future" features not yet built, and no Drilldown/Ways feature folder exists in the Structural Seed under Domain or Application. Whoever implements AD-17 today has nothing concrete to copy for that half of the rule — likely to stub it, guess a shape that gets thrown away once Drilldown actually lands, or quietly drop it (silently violating AD-17's own text) — with no AD flagging this as a forward reference that needs revisiting.

**Proposed tightening.** Add a line to AD-17 or the Deferred section: "The Drill-Down/Way portion of AD-17's deep-copy is a stub (no-op or empty collection) until that feature's entities exist under a to-be-named `Drilldown`/`Ways` folder; revisit AD-17's copy logic when that feature lands, since its entity shape doesn't exist yet."

---

## Finding 10 — [LOW] The Deferred section's Hangfire retry/backoff note repeats AD-16's publish-only framing, despite AD-15's "identical mechanism" claim

**Scenario.** The Deferred section reads: "the exact per-item retry count and backoff interval for **a failed publish job item** is not decided in this pass" — again omitting extraction, mirroring Finding 1's gap. Low severity because it's already flagged as deferred (not silently missing), but the wording invites the same publish/extraction asymmetry once someone picks it up later, possibly landing on different `[AutomaticRetry(Attempts=N)]` values for the two job types with no AD requiring them to match or differ deliberately.

**Proposed tightening.** Reword the Deferred bullet to "...for a failed publish **or extraction** job item is not decided in this pass," so the eventual decision is made once, for both, rather than twice, independently.

---

## Summary Table

| # | Finding | Severity | Gap type |
| --- | --- | --- | --- |
| 1 | AD-16's AD-11 carve-out doesn't name extraction job items | Critical | Underspecified AD-16 scope |
| 2 | AD-15 gives no shared job-item status entity/enum/read-boundary | Critical | Missing AD (job contract) |
| 3 | Budget threshold (AD-19) vs. spend (AD-18) split across two tables, no join/duplication rule | Critical | Underspecified AD-18/AD-19 interaction |
| 4 | AD-17 snapshot vs. live "confirmed content tree" — reuse vs. duplicate types undecided | High | Missing AD (entity strategy) |
| 5 | AD-14 fallback config source never cites AD-19; linkage asserted one-sided | High | Underspecified cross-reference |
| 6 | No feature folder owns extraction-job-item state | High | Underspecified Structural Seed |
| 7 | AD-19 config read path (service vs. repository) into AD-14's gateway is unpinned | Medium | Underspecified AD-19 |
| 8 | `task_id` identity scheme (fixed code vs. AD-9 GuidV7 default) unstated | Medium | Underspecified AD-9 exception |
| 9 | AD-17's Drill-Down/Way copy target has no entity model yet | Low | Forward reference to undefined feature |
| 10 | Deferred retry/backoff note omits extraction, echoing Finding 1's asymmetry | Low | Wording drift |

**Verdict.** AD-14 through AD-19 are individually well-reasoned but were each written looking inward at their own concern (the AI gateway, the job mechanism, the snapshot, the budget counter, the config store) rather than at the seams between them, so a builder who obeys any single one of these ADs to the letter can still produce a publish/extraction job-item pair with incompatible commit rules and status contracts, a version snapshot with an undefined relationship to the live content tree it copies, and an AI-fallback path that silently ignores the very Admin-editable config store the spine just added to prevent that — none of which is a violation of any individual AD as written, which is exactly what makes each one a hole worth closing with the tightened AD language proposed above.
