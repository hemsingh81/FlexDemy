# Review — ARCHITECTURE-SPINE.md (LearnSphere Backend)

**Reviewer:** rubric-walker
**Date:** 2026-08-09
**Target:** `_specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md`
**Sources checked:** `FrontEnd/docs/BACKEND_PRD.md`

## Verdict

Solid Clean Architecture skeleton with unusually well-researched, verified stack versions and good license reasoning (AD-3, AD-7) — but it under-specifies the one dimension the user explicitly called out (Docker/Compose operational detail) and leaves two real ORM-mapping divergence points (Postgres snake_case columns, entity ID type) undecided, which is exactly the kind of gap that causes two AI-assisted implementation sessions to produce incompatible scaffolds. Recommend one revision pass before this is used to drive code generation.

---

## 1. Real divergence points — fixed vs. missed

Fixed well:
- Layering direction and what's allowed to reference what (AD-1) — clear, matches the four-project mermaid diagram, no contradictions found.
- Where DI wiring lives (AD-2) — prevents the classic "some registration in Program.cs, some in a random static constructor" drift.
- Mediator/no-mediator (AD-3) — a genuine, currently-live divergence point (MediatR's 2025 license change is real, verified below) with a concrete, checkable rule (`I{Feature}Service` / `{Feature}Service`, constructor injection).
- Repository/UoW boundary (AD-4) — prevents `DbContext` leaking into controllers, and correctly forces mapping into `IEntityTypeConfiguration<T>` rather than data annotations.
- Route/DTO/error-shape conventions (AD-5) — concrete naming rules, ties routes back to the PRD's existing `/api/v1/...` shapes.
- Feature-folder layout (AD-6) — consistent with a stated goal of mirroring the frontend's organization.
- Test framework/library choice (AD-7) — again grounded in real 2025 licensing events (FluentAssertions ≥8 commercial, Moq's 2024 telemetry controversy implied by "reputational baggage").

Missed (see sections 5 and 6 below for detail): container networking/connection-string wiring, Postgres naming-convention bridge, entity ID type/generation strategy, and the PRD's NGINX/port-3000 deployment note.

## 2. AD Rule enforceability

All eight ADs have a rule that is *readable and checkable by a human or AI reviewing a diff* — none are vague aspirations. One exception:

**AD-8 (Migration strategy) — rule is internally ambiguous, and as written may not do what it claims.**

> "Applied automatically on startup in Development and Docker Compose (`Program.cs` calls `db.Database.Migrate()` behind an `IsDevelopment()`/env check)"

This states the behavior should trigger in *both* Development *and* Docker Compose, but the only enforcement mechanism given is "an `IsDevelopment()`/env check" — it never says what that check actually is. ASP.NET Core's default `ASPNETCORE_ENVIRONMENT` when unset in a container is `Production`, not `Development`. If the eventual `docker-compose.yml` doesn't explicitly set `ASPNETCORE_ENVIRONMENT=Development` (nothing in the spine says it must), then a plain `IsDevelopment()` guard will silently **not** auto-migrate in Docker Compose — contradicting the rule's own stated intent, and leaving two implementers free to pick different conditions (`IsDevelopment()` only vs. some other `ASPNETCORE_RUNNING_IN_CONTAINER`-style flag). This is precisely the "AI assistant would have to guess" failure mode the review is checking for.

*Suggested fix:* either commit to a specific env var/flag (e.g., "gate on `ASPNETCORE_ENVIRONMENT != Production`" or a custom `RUN_MIGRATIONS_ON_STARTUP` flag set in `docker-compose.yml`), or state explicitly that `docker-compose.yml` sets `ASPNETCORE_ENVIRONMENT=Development` for local compose runs.

## 3. Deferred section — does anything there matter for the initial scaffold?

Reviewed each entry: WebSockets, Redis, AI pipeline, Auth implementation, Production migration strategy, CI pipeline. All six are correctly out of scope for a structure-only pass — none of them would cause two units of the initial scaffold (Domain/Application/Infrastructure/Api skeleton, empty controllers, DbContext, migrations baseline) to diverge from each other. The deferrals are appropriately scoped and each gives a one-line landing spot for later ("revisit when X is implemented"), which is the right shape.

One near-miss: Auth is deferred with "the structure reserves `Users` feature folders for it," but nothing says whether `Program.cs`'s composition root should even call `AddAuthentication()`/`AddAuthorization()` (no-op or absent) in this pass. Minor — unlikely to cause real divergence in a scaffold with no protected endpoints yet.

## 4. Stack version spot-check (web-verified 2026-08-09)

All four checkable claims independently verified as accurate:

| Claim in spine | Verification |
| --- | --- |
| .NET 10, current LTS, released Nov 2025, supported through ~Nov 2028 | Confirmed: released Nov 11, 2025; Microsoft's own release notes give EOS Nov 2028 (one source says Nov 10, another Nov 14 — spine's "Nov 2028" is accurate at the month grain it claims). |
| Npgsql.EntityFrameworkCore.PostgreSQL 10.0.3 | Confirmed on NuGet: 10.0.3 last published 2026-07-10, is the current stable (11.0.0-preview.6 exists as prerelease only). Version-matching EF Core 10.x is the correct provider-selection convention. |
| PostgreSQL 18, 18.4 latest stable, 19 in beta | Confirmed: PG18 GA'd 2025-09-25; 18.4 released 2026-05-14; PG19 Beta 1 (2026-06-04) / Beta 2 (2026-07-16), GA planned Sept 2026 — "19 still in beta" is accurate as of this review's date. |
| MediatR 13+ RPL-1.5 license / FluentAssertions ≥8 commercial license (used to justify AD-3/AD-7) | Both are real, well-known 2025 OSS licensing changes; correctly characterized. |

No suspicious or fabricated version numbers found. This is a genuine strength of the document — most architecture docs don't verify library versions this specifically, and the reasoning chain (version → license → rule) is sound.

xUnit / NSubstitute are left as "latest stable" rather than pinned — inconsistent with the precision applied elsewhere, but low-risk since neither carries a licensing landmine and both are safe to float.

## 5. Operational/environmental envelope — Docker (explicitly requested by the user)

This is the review's biggest finding. The user's stated goal was an ASP.NET Web API **deployed via Docker**, yet the spine's Docker coverage is limited to: a stack-table line, a structural-seed line (`Dockerfile`, `docker-compose.yml # api + postgres services`), and a two-node mermaid diagram (`Client → API → Postgres via Npgsql`). There is no AD governing any of the following, all of which are real divergence points for whoever writes the Dockerfile and compose file first:

- **Dockerfile strategy** — multi-stage build (SDK image for restore/build/publish, ASP.NET runtime image for the final stage) vs. single-stage; base image tags; non-root user; which project's `.csproj` gets restored first for layer caching.
- **Container networking** — what hostname the API's connection string uses for the DB. In Docker Compose this is the service name (e.g. `Host=postgres`), not `localhost` — this differs from `appsettings.Development.json` used for non-Docker local dev, and the spine's "Config & secrets" convention row doesn't distinguish the two.
- **Env var → connection string wiring** — no named convention for the connection-string env var Compose should inject (e.g. `ConnectionStrings__Default`), so nothing stops one implementation from using `DATABASE_URL` and another `ConnectionStrings__Default`.
- **Startup ordering / health checks** — nothing says the API service should `depends_on: postgres` with `condition: service_healthy`, which matters directly for AD-8's auto-migrate-on-startup (a migrate-on-boot against a Postgres container still initializing will fail intermittently).
- **Data persistence** — no mention of a named volume for the `postgres` service, so container restarts could silently wipe local dev data depending on how the compose file is written.
- **Exposed port** — the container's internal port and the host port mapping aren't specified anywhere (see §6 — the PRD says port 3000, the spine says nothing).

None of this needs to be exhaustive at spine altitude, but given Docker was the user's explicit deployment choice, at minimum one AD (or an addition to AD-8) should pin: base images, the Compose service names / hostnames, the connection-string env var name, and `depends_on`+healthcheck ordering. As written, two AI sessions asked to "write the Dockerfile and docker-compose.yml" from this spine alone would very plausibly produce incompatible container wiring.

## 6. BACKEND_PRD.md content silently dropped vs. explicitly deferred

Checked each PRD section against the spine's Deferred list:

| PRD item | Spine treatment |
| --- | --- |
| §5 WebSocket protocols | Explicitly deferred, with landing spot (SignalR/native WebSocket in Api project). Good. |
| §2/§7 Redis (WS state, rate limiting) | Explicitly deferred. Good. |
| §6 AI microservice pipeline (Gemini) | Explicitly deferred. Good. |
| §7 JWT + OAuth2 auth | Explicitly deferred, folders reserved. Good. |
| §7 Redis-backed rate limiting | Covered indirectly via the Redis deferral. Acceptable. |
| **§7 "behind an NGINX reverse proxy on port 3000"** | **Not mentioned anywhere — not deferred, not adopted, not superseded.** |

The last row is a genuine gap. Everything else the PRD specified beyond the initial scaffold got an explicit Deferred entry; this one didn't get any treatment at all. It's plausible the reverse-proxy/port detail is judged irrelevant now that the user chose Docker Compose over the PRD's "Cloud Run" option — but that's a judgment call the spine should make explicitly (e.g., "NGINX reverse proxy — not adopted; Docker Compose exposes the API container directly for this pass, revisit if a reverse proxy is needed in front of multiple services") rather than leaving a reader to wonder whether it was missed. This also ties back to §5 above: the spine never states what port the API listens on inside its container, so there's no way to check consistency against the PRD's port 3000 either way.

Entity/endpoint coverage itself is good: the PRD's 5 tables (`users`, `courses`, `course_notes`, `course_reviews`, `tutor_slots`) map cleanly onto the spine's Domain feature folders (`Courses` — including the PRD's implied Module/Lesson sub-entities from the `POST /api/v1/courses` payload — `Tutoring`, `Notes`, `Reviews`, `Users`), and the five controllers match the PRD's endpoint groups one-for-one. No entity or endpoint group was dropped.

## 7. Additional divergence points found (not on the checklist's named list, but material)

**7a. No Postgres naming-convention bridge (Major).** The PRD's SQL schema is entirely `snake_case` (`short_description`, `target_grade_tag`, `streak_days`, `booked_by_student_id`, etc.). EF Core/Npgsql's default convention maps C# `PascalCase` properties to `PascalCase` columns unless told otherwise. AD-4 assigns column mapping to `IEntityTypeConfiguration<T>` but never states whether that mapping (a) hand-specifies every `HasColumnName("snake_case")` call, or (b) the DbContext registers a project-wide snake_case naming convention (e.g. `UseSnakeCaseNamingConvention()`). Without this being pinned, the very first migration two different sessions generate against the *same* PRD schema will produce different column names. This is a concrete, checkable, easily-fixed gap — arguably belongs in AD-4 or AD-8.

**7b. No entity ID type/generation decision (Moderate).** Every PRD table uses `VARCHAR(64)` primary keys (not serial ints, not native `uuid`) — a deliberate schema choice, likely for client-generated IDs (cuid/nanoid-style, common on the frontend side of a JS-originated PRD). The spine's Domain layer says entities are "persistence-ignorant POCOs" but never says what type `Id` is (`string`? `Guid` serialized as string? `Guid` mapped to `varchar`?) or who generates it (Domain constructor vs. Infrastructure/DB default). This is a real fork point since it affects Domain entity constructors, DTO shapes, and EF configuration simultaneously.

**7c. Enum-like string columns (Minor).** `role`, `level`, `status`, `subject` are constrained-value `VARCHAR` columns in the PRD (with inline comments listing valid values) but nothing says whether Domain models them as C# `enum`s (with an EF value converter) or plain strings with validation elsewhere. Same category as 7b, lower stakes.

**7d. No `LearnSphere.Domain.Tests` project (Minor).** AD-7's test-project list is `Application.Tests`, `Infrastructure.Tests`, `Api.Tests` — Domain, which is explicitly called out elsewhere as owning "domain invariants," has no dedicated test project in the structural seed. Likely an oversight rather than a deliberate choice (nothing explains why Domain rules would be tested only indirectly through Application).

**7e. CORS not addressed (Minor).** `FrontEnd/` is a separate application that will call this API; no AD or convention addresses a CORS policy (even a placeholder "permissive in dev, explicit allow-list from config in other environments" would do). Arguably below spine altitude, but it's a real point where a controller/`Program.cs` implementer has to make an unguided call the first time a cross-origin request fails.

## 8. Does it serve "coding rules an AI assistant can follow"?

Mostly yes. AD-1 through AD-7 are concrete enough that an AI implementing `CoursesController`/`ICourseService`/`CourseRepository` end-to-end would not have to guess at layering, DI wiring, naming, DTO shape, or error format — those are genuinely unambiguous. The gaps that break this promise are specifically the ones enumerated above: an AI generating the first EF Core migration has no rule telling it whether to produce `ShortDescription` or `short_description` columns, no rule for the `Id` property's CLR type, and an AI writing the Dockerfile/compose file has no pinned base images, hostnames, or env var names to reach for — so for those specific, foreseeable first tasks, it would have to invent conventions rather than follow ones the spine already decided.

---

## Summary of Findings by Severity

**Major**
1. AD-8's migrate-on-startup rule is internally ambiguous ("Development and Docker Compose" vs. an unspecified `IsDevelopment()`/env check) and as written may not fire inside a plain Docker Compose container, contradicting its own stated intent.
2. Docker/Compose operational envelope is underspecified given this was the user's explicit deployment target — no AD covers Dockerfile strategy, container-to-container hostname/connection-string wiring, startup health-check ordering, or data volume persistence.
3. No naming-convention bridge between PascalCase C# entities and the PRD's all-snake_case Postgres schema — the first migration two sessions generate from this spine will very likely disagree on column names.

**Moderate**
4. PRD §7's NGINX reverse proxy / port 3000 deployment note is silently dropped rather than explicitly adopted, superseded, or deferred like every other PRD-beyond-scaffold item.
5. Entity ID type and generation strategy (PRD uses `VARCHAR(64)` PKs everywhere) is undecided in the Domain layer.

**Minor**
6. No `LearnSphere.Domain.Tests` project despite Domain owning domain invariants.
7. No rule for enum-like string columns (`role`, `level`, `status`, `subject`) — C# `enum` vs. string.
8. CORS policy for the separate `FrontEnd/` app is unaddressed.
9. xUnit/NSubstitute versions left as "latest stable" while every other stack entry is precisely pinned — a minor precision inconsistency, not a risk.

## What's working well (for balance)

- Stack version table is unusually well-verified — all four checkable claims confirmed accurate against current (Aug 2026) sources, including two 2025 OSS-licensing events (MediatR, FluentAssertions) correctly used to justify architectural rules rather than just decoration.
- Dependency-direction and DI-composition rules (AD-1, AD-2) are airtight and would catch the most common Clean Architecture violations in review.
- Deferred section is well-curated for everything *except* the NGINX/port-3000 item — each deferral names why and gives a concrete landing spot for later.
- PRD entity/endpoint coverage is complete — no table or endpoint group was missed in the Domain/Application/Api structural seed.
