# Review — ARCHITECTURE-SPINE.md, AD-14 through AD-19 (Course Wizard / AI Service Layer addition)

**Reviewer:** rubric-walker
**Date:** 2026-08-11
**Target:** `_specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md`
**Sources checked:** `_specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md`, `FrontEnd/docs/BACKEND_PRD.md` (indirectly, via AD-1–13), the actual `BackEnd/` codebase (brownfield state), `BackEnd/CLAUDE.md`
**Scope:** AD-1 through AD-13 already reviewed and finalized in a prior pass — not re-litigated here except where AD-14–19 interact with them. Focus is AD-14–19.

## Verdict

AD-14 through AD-19 correctly resolve the *plumbing* the prior pass punted (gateway shape, async execution, versioning mechanism, budget concurrency, config storage) with well-verified, license-clean tech choices, but they never define the domain model the plumbing actually operates on (the Chapter→Topic→Subtopic→Content-Block tree is still named "Module, Lesson" from the superseded PRD), leave the publish-batch's most consequential commit — the one that actually makes AD-17's version snapshot valid — unowned, and the spine's own Deferred section now contradicts the brownfield codebase it's supposed to govern (Auth is claimed "not wired up" when it's fully built), so this needs another revision pass before it's safe to drive code generation from.

---

## Findings

### Critical

**C1. No domain model for the actual content tree AD-15/16/17 operate on; the structural seed still says the superseded PRD's terms.**
- **What's wrong:** The PRD's central data structure — `Chapter → Topic → Subtopic → Content Block` (§3 Glossary; the target of FR-14, FR-15, FR-17–21, FR-23, FR-25) — has zero domain entities anywhere in the spine. A full-document grep for `Chapter|Topic|Subtopic|ContentBlock|Content Block` returns exactly one hit outside AD-14's method names (`ExplainTopicAsync`), and `Module|Lesson` returns one hit: the Structural Seed's `Domain/Courses/` line still reads `# Course, Module, Lesson entities + value objects; CourseVersion (deep-copy publish snapshot, AD-17)` — vocabulary from the Dashboard PRD's superseded FR-18 flow, not this PRD's tree. Tellingly, that same line *was* edited in this pass (to append the `CourseVersion (AD-17)` annotation) without anyone correcting the stale `Module, Lesson` half of it — direct evidence of incomplete propagation, not an intentional simplification.
- **Why it matters:** AD-17's rule — "each publish deep-copies the entire confirmed content tree plus its cached Drill-Down/Way content into a versioned snapshot" — is unenforceable as written: nothing defines what "the tree" *is* (nesting model, per-node confirmation-state field per FR-15, where Drill-Down/Way/Exercise/Keyword content attaches). AD-15's "one Hangfire job per content-node generation call" has no entity representing "a content node" to reference. Two implementers building the deep-copy logic, the per-node job, or the confirmation-state field would each invent a different shape from scratch — the exact failure mode a spine exists to prevent.
- **Fix:** Add explicit Domain entities to the structural seed (e.g. `Chapter`, `Topic`, `Subtopic`, `ContentBlock`, `DrilldownLevelContent`, `WayContent`, `Exercise`), replacing the stale `Module, Lesson` line, and name at minimum: the nesting/parent-child shape, where per-node confirmation state (FR-15) lives, and where generated vs. tutor-override content is distinguished (FR-17/FR-20's "tutor override wins" rule).

**C2. AD-16 never assigns ownership of the batch-completion commit — the step that makes AD-17's snapshot actually correct.**
- **What's wrong:** AD-16 defines commit ownership for exactly two moments: (a) the use-case that *triggers* Publish (one commit, `Draft`/`Review Confirmed` → `Publishing`), and (b) each Hangfire job item's own independent commit of its generated content. It says nothing about the third, arguably most important moment: who detects that all job items for a batch have finished, and who performs the commit that flips `Publishing` → `Published` *and* — per AD-17 — creates the deep-copy version snapshot at that point.
- **Why it matters:** AD-17 promises the snapshot captures "the entire confirmed content tree **plus its cached Drill-Down/Way content**." That cached content doesn't exist until the batch AD-15 describes finishes generating it. If the snapshot were taken at Publish-trigger time (the only commit AD-16 explicitly owns), it would capture a tree with no generated content yet — contradicting AD-17's own definition. AD-16 simply never names the use-case/mechanism (a Hangfire batch continuation? a "last job out" check inside each item? a polling job?) that performs this final transition, so this is not a minor omission — it's the step that makes AD-17's rule true or false depending on how an implementer guesses.
- **Fix:** Add a rule (extend AD-16 or add AD-16a) naming the completion-detection mechanism (Hangfire's built-in `IBatchMonitoringApi`/continuation support is the natural fit given AD-15's tech choice) and stating that its single commit both flips course status and creates the AD-17 snapshot, under AD-11's "exactly once" discipline for *that* use-case.

### High

**H1. AD-18's atomic counter is post-hoc; FR-29 requires a pre-flight block, and neither AD-14 nor AD-18 says how the two compose.**
- **What's wrong:** AD-18's mechanism — `UPDATE ... SET spent = spent + cost ... RETURNING spent` — can only run *after* an AI call completes and its actual token cost is known. FR-29 requires the opposite for the hard-threshold case: "blocks routing new requests... that would exceed it, rather than only reporting spend after the fact" (explicitly contrasted with after-the-fact reporting in the FR text itself). AD-18 never introduces a pre-flight read-then-decide step, never says which layer performs it (Infrastructure/AiGateway, before calling the provider?), and never reconciles a threshold-exceeded outcome with AD-14's Polly-based fallback chain — FR-29 explicitly allows either "blocked (or routed to a configured cheaper fallback, per FR-3)," and AD-14/AD-18 pick neither.
- **Why it matters:** This is precisely the concurrency design point the PRD itself flags as unresolved (FR-29's `[NOTE FOR PM]`) and asks the architecture pass to name explicitly. AD-18 answers "how do we keep the counter accurate" but not "how do we stop the call before it happens" — the actual ask.
- **Fix:** State the pre-flight check explicitly (e.g., read current `spent` before dispatching to a provider, short-circuit if it would cross the hard threshold) and state whether a blocked primary routes into AD-14's fallback policy or fails the request outright.

**H2. The spine's Deferred section contradicts the brownfield codebase it's supposed to govern.**
- **What's wrong:** The Deferred section (last touched in this very pass, which correctly resolved the "AI microservice pipeline" entry) still reads: *"**Auth implementation** (JWT + OAuth2 per the PRD) — the structure reserves `Users` feature folders for it, but the actual auth handler/middleware/token issuance is not wired up in this pass."* The actual `BackEnd/` codebase already has `Api/Controllers/AuthController.cs`, `Infrastructure/Security/JwtTokenService.cs`, `Infrastructure/Security/Pbkdf2PasswordHasher.cs`, and a full `FeatureAuthorizationHandler`/`FeaturePolicyProvider`/`RolePermission` RBAC system, wired into `Program.cs` (`AddAuthentication(JwtBearerDefaults...)`, `AddAuthorization()`).
- **Why it matters:** This is the exact failure mode "ratify, don't contradict brownfield" exists to catch — a reader trusting the spine's Deferred list would believe auth is unbuilt and either re-build it or design AD-19's `AiConfigController` without any auth story, when a working RBAC pattern already exists to reuse (see M3 below).
- **Fix:** Remove or rewrite the Auth Deferred entry to reflect current state (JWT + custom RBAC implemented; OAuth2 specifically — if that's still absent — is the narrower remaining gap, not "auth" wholesale).

**H3. FR-4 (per-invocation usage tracking) and FR-28 (usage/cost filterable by task *and* date range) have no AD — only a counter does.**
- **What's wrong:** AD-18's rule text describes a single running total (`spent` on what's presumably `AiTaskBudget`). The Structural Seed names two entities in one breath — `AiUsage/ # AiTaskUsage, AiTaskBudget entities (FR-29 spend tracking, AD-18)` — but AD-18 only ever discusses the counter; `AiTaskUsage` (needed for FR-4's per-invocation, per-course/tutor attribution and FR-28's date-range filtering) is named once and never specified: no schema, no write path, no statement of whether it's written inside the same per-item commit AD-16 already establishes for job items.
- **Why it matters:** A running counter cannot answer "show me usage for `explainTopic` between these two dates" (FR-28) — that requires row-level records. Without an AD, two implementers diverge on whether `AiTaskUsage` is written synchronously per call, batched, or reconstructed after the fact from logs.
- **Fix:** Add a rule (extend AD-18 or split into AD-18a) defining `AiTaskUsage` as a per-invocation log row, its write path, and its commit ownership relative to AD-11/AD-16.

### Medium

**M1. Hangfire.PostgreSql's automatic schema management isn't reconciled with AD-8's explicit-migrations-only discipline.**
- **What's wrong:** Hangfire.PostgreSql, by default, creates and self-manages its own `hangfire` schema/tables at application startup — a schema-evolution path entirely outside EF Core Migrations. AD-8 was written specifically to prevent "silent schema drift between environments" and explicitly rejects implicit tooling ("never relying on `dotnet ef`'s implicit host discovery"). AD-15 adopts Hangfire without saying whether its automatic schema installation is left on (an implicit, ungated schema change on every startup, in real tension with AD-8's stated intent) or explicitly disabled/coordinated with the existing `RUN_MIGRATIONS_ON_STARTUP` gate.
- **Fix:** State whether Hangfire's `PrepareSchemaIfNecessary` runs automatically and, if so, whether it's gated the same way EF migrations are (`RUN_MIGRATIONS_ON_STARTUP`) to avoid two independent, differently-gated schema-mutation paths hitting the same database.

**M2. No AD covers FR-21's on-demand fallback generation for a failed batch item.**
- **What's wrong:** FR-21's own testable consequence: "A single node's generation failure does not block the rest of the course from publishing; that node serves on-demand generation as a fallback until its batch entry is retried." This requires a synchronous, request-path `IAiGateway` call at student read-time (outside AD-15's Hangfire batch entirely) plus a cache write-back into whatever AD-15/17 populate. No AD names this path, its interaction with AD-18's budget check, or its latency/UX contract.
- **Fix:** Either fold this into AD-14/AD-15 explicitly (a documented synchronous fallback call, cached on first successful hit) or add it as a new AD, since it's a testable PRD capability, not an implementation detail.

**M3. AD-19's `AiConfigController` has no stated authorization mechanism, despite the brownfield codebase having two coexisting patterns to choose between.**
- **What's wrong:** AD-19 says the controller "exposes it to Admin" but doesn't say how. `Program.cs`'s own comments describe two live patterns — legacy `[Authorize(Roles = "...")]` and the newer `[Authorize(Policy = FeatureKeys.X)]` RBAC system — and `FeatureKeys.cs` currently has no AI-config-related key.
- **Fix:** State that `AiConfigController` follows the established `[Authorize(Policy = FeatureKeys.X)]` pattern (matching how other admin/write endpoints are already gated) and note the new key(s) needed (e.g. `ai.config.manage`).

**M4. "Config & secrets" convention row wasn't extended for the new AI-provider secret.**
- **What's wrong:** AD-14 (HTTP client per PRD FR-2) and AD-19 (DB-backed provider/model *selection*) together introduce a new secret-management need — the AI provider's API key(s) — that the Consistency Conventions table's "Config & secrets" row (still just `ConnectionStrings__Default`, `RUN_MIGRATIONS_ON_STARTUP`) doesn't mention at all. AD-19 explicitly moves provider/model choice to the DB but says nothing about where the corresponding key lives.
- **Fix:** Add an explicit line: AI-provider API key(s) come from env var/user-secrets (consistent with existing convention), never stored alongside the DB-backed provider/model config itself.

### Low

**L1. AD-16's job/batch IDs (via `IIdGenerator`) aren't reconciled with Hangfire's own internally-assigned job IDs.**
`BackgroundJob.Enqueue` returns Hangfire's own job ID, used for Hangfire's dashboard/retry tracking — separate from whatever ID the app's own job/batch-item entity gets via AD-9's `IIdGenerator`. AD-16 doesn't say whether the app entity stores Hangfire's ID for cross-referencing. Minor, but a real first-implementation question.

**L2. `BackEnd/CLAUDE.md` (the condensed, AI-assistant-facing rules doc) wasn't regenerated for AD-14–19.**
It still says "the AI drilldown/grading pipeline... [is] Deferred in the spine, not forgotten" (zero mention of `IAiGateway`, Hangfire, `AiConfig`, or FR-25 versioning) and separately still lists "real JWT/OAuth2 auth" as not-yet-built — the same contradiction as H2, visible in the doc engineers/agents actually read day to day rather than the full spine. Not a spine defect per se, but worth flagging since it's the operational surface of this document.

**L3. PRD Open Question §8.2 (keyword-definition caching) isn't carried into the spine's Deferred section the way sibling still-open items were.**
`Hangfire retry/backoff policy` and `Snapshot storage retention` both got explicit Deferred entries with a landing spot. The PRD's own open question about whether `defineKeyword` results should be cached per-course (directly relevant given §4.9's explicit "route to cheapest/fastest tier, high call volume" framing) got no equivalent entry — a minor consistency gap in an otherwise well-curated Deferred section.

---

## What's working well (for balance)

- Stack additions (Hangfire Core 1.8.24, Hangfire.PostgreSql 1.21.1) independently re-verified against NuGet as of this review — both accurate, current, and correctly licensed (LGPLv3, no author-overlap risk with the already-rejected MediatR/AutoMapper).
- AD-14's placement decision for `describeNotationAsync` (authoring-time, not publish-batch) directly and correctly threads FR-16's accessibility requirement through the right pipeline stage.
- AD-15/AD-16 correctly recognized and resolved the AD-11 tension (single-commit-per-use-case vs. 200+ independent per-item commits) as a carve-out rather than silently violating or over-literally complying with the older rule — good AD-to-AD reasoning.
- AD-19 correctly identifies and resolves the FR-2/FR-29 "no redeploy" requirement surviving the managed→self-hosted gateway migration, which the PRD itself calls out as a real risk (FR-2's consequences).
- License/version diligence carried over from the AD-1–13 pass is maintained at the same standard in this addition (Polly correctly flagged as license-clean vs. AD-3's MediatR concern).
