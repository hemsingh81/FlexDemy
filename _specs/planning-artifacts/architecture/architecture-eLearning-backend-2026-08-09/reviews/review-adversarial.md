---
name: 'Adversarial Review — LearnSphere Backend Architecture Spine'
type: architecture-review
reviews: 'ARCHITECTURE-SPINE.md (LearnSphere Backend, 2026-08-09)'
method: 'Two-independent-engineer (or two-independent-agent) collision test — each obeys every AD to the letter, no communication between them'
created: '2026-08-09'
---

# Adversarial Review — LearnSphere Backend Architecture Spine

## Method

For each finding below I construct two implementers — "Engineer A" building the **Courses** feature and "Engineer B" building the **Tutoring** feature — who never talk to each other and only read `ARCHITECTURE-SPINE.md`. I check whether the ADs as written force them to converge on the same concrete convention. Where they don't, I record the scenario, the specific AD text that fails to close the gap, and a concrete tightening (usually phrased as a new AD, in the spine's own Binds/Prevents/Rule shape) that would.

Findings are ordered by severity: **Critical** (breaks correctness or blocks integration), **High** (produces real bugs/inconsistency but the system still runs), **Medium** (rework/friction, not correctness), **Low** (cosmetic/convention drift).

---

## Finding 1 — [CRITICAL] Service method contracts: Domain entity or DTO in/out, and who maps?

**Scenario.** Engineer A writes `ICourseService.GetCourseAsync(Guid id)` returning the Domain type `Course`, on the theory that AD-5's "controllers do HTTP ↔ DTO mapping" means the *controller* is where `Course → CourseDto` mapping happens. `CoursesController` injects `ICourseService`, gets back a `Course`, and hand-maps it to `CourseDto` before returning it. Engineer B, building Tutoring, reads the Structural Seed literally — `CourseDto` is listed *inside* `Application/Courses/` next to `ICourseService` — and concludes DTOs are an Application-layer concern, so `ITutorService.GetSlotAsync(Guid id)` returns `TutorSlotDto` directly; all Domain↔DTO mapping happens inside `TutorService`, and `TutorController` never sees a Domain type.

Both readings are internally consistent with the spine. The collision surfaces the moment one feature needs to consume the other's service (see Finding 3): if `TutorService` calls `ICourseService.GetCourseAsync()` expecting a DTO (per its own convention) but gets back a `Course` Domain entity (per Engineer A's convention), it fails to compile/breaks at the seam — not from violating any AD, but because the spine never picked a lane.

**Why the current ADs don't stop it.** AD-4 says repositories are "behind Application interfaces" but only constrains *repository* return types indirectly (implied Domain entities, since Domain is persistence-ignorant). It says nothing about *service* interface signatures. AD-5 governs the controller↔HTTP boundary and DTO naming, but "HTTP ↔ DTO mapping" is genuinely ambiguous about whether the DTO-to-Domain hop happens in the controller or the service. AD-6 places `CourseDto` in the Application feature folder, which is suggestive but not a stated rule.

**Proposed AD-9 — Services accept/return DTOs; Domain never crosses the Application boundary outward**

- **Binds:** every `I{Feature}Service` method signature
- **Prevents:** ambiguity over where Domain↔DTO mapping happens; Domain entities leaking into controllers or across feature boundaries
- **Rule:** `I{Feature}Service` methods accept and return DTOs (or primitives/IDs) only, never Domain entities. Domain↔DTO mapping happens exclusively inside the service implementation. AD-5's "controllers do HTTP ↔ DTO mapping" is redefined narrowly: controllers translate wire shapes (route/query params, request/response bodies) to/from Application DTOs — they never see a Domain type. This also resolves Finding 3: cross-feature service calls always exchange DTOs, so no feature needs to know another feature's Domain model.

---

## Finding 2 — [CRITICAL] `IUnitOfWork.SaveChangesAsync` ownership is unassigned

**Scenario.** Engineer A's `CourseRepository.AddAsync(Course c)` calls `_context.Set<Course>().Add(c); await _context.SaveChangesAsync();` internally — the repository is self-committing, and `CourseService.CreateCourseAsync` never touches `IUnitOfWork` at all. Engineer B's `TutorSlotRepository.AddAsync` only stages the change (`_context.Set<TutorSlot>().Add(slot)`, no save); `TutorService.BookSlotAsync` explicitly calls `_unitOfWork.SaveChangesAsync()` once after its repository calls. Both satisfy AD-4 ("Infrastructure implements `IUnitOfWork` against EF Core") to the letter.

The incompatibility is latent until a use case needs to span both features atomically — e.g. a future "book a tutor slot and decrement course capacity" operation touching both `ICourseRepository` and `ITutorSlotRepository` in one service method. Under Engineer A's convention the course-side write already committed the instant `AddAsync`/`UpdateAsync` ran; under Engineer B's convention the tutoring-side write is still pending in the `DbContext` change tracker. A single `SaveChangesAsync()` call at the end of the composed use case no longer gives atomicity — it silently becomes two separate, non-transactional commits, which is exactly the failure mode `IUnitOfWork` exists to prevent.

**Why the current ADs don't stop it.** AD-4's rule statement only says Application defines `IUnitOfWork` and Infrastructure implements it against EF Core — it never says who calls `SaveChangesAsync` or when. Nothing in the Consistency Conventions table addresses it either.

**Proposed AD-10 — Repositories stage, services commit, one `SaveChangesAsync` per use case**

- **Binds:** every repository and service implementation
- **Prevents:** repositories persisting eagerly (defeating `IUnitOfWork`), and non-atomic composition when a use case spans multiple repositories
- **Rule:** repository methods (`Add`/`Update`/`Remove`/queries) never call `SaveChangesAsync`; they only stage changes on the tracked `DbContext`. Every `I{Feature}Service` use-case method that mutates state calls `IUnitOfWork.SaveChangesAsync()` exactly once, as the final step, after all of that method's repository calls. This makes multi-repository use cases (including future cross-feature ones) atomic by construction, with no special-casing.

---

## Finding 3 — [HIGH] No rule on cross-feature-folder dependencies within a layer

**Scenario.** Engineer B's `TutorService` needs to check that a course exists and is published before allowing a slot to be booked against it. Reading AD-4 ("Application defines `I{Entity}Repository`... interfaces"), Engineer B sees no folder-scoping language and injects `ICourseRepository` straight into `TutorService`, querying `Course` rows directly. Engineer A, meanwhile, has been enforcing "course must be published and not archived" as a check inside `CourseService.GetCourseAsync` (not as a Domain invariant, since publish-state is a workflow concern, not always enforceable purely in the entity). `TutorService`'s direct repository query bypasses that check entirely — a tutor slot can now be booked against an archived course, a bug that exists nowhere in either engineer's own feature and only appears at integration time.

More generally: AD-6 is scoped explicitly to "internal folder structure... within each layer" — it says nothing about the *allowed reference graph between* feature folders in the same layer. Nothing marks `I{Entity}Repository` interfaces as private to their owning feature, and nothing says cross-feature reads must route through the other feature's service (where business rules live) rather than its repository (where they don't).

**Why the current ADs don't stop it.** AD-6's Binds line is explicit: "internal folder structure of Domain, Application, Infrastructure" — a structural/organizational rule, not a dependency-direction rule. AD-4 defines repository interfaces at the Application layer generally, without scoping visibility to the owning feature.

**Proposed AD-11 — Cross-feature reads go through the other feature's service, never its repository**

- **Binds:** Application-layer dependencies between feature folders
- **Prevents:** a feature bypassing another feature's business rules by reaching directly into its repository
- **Rule:** a feature's service may depend on another feature's `I{Feature}Service` interface for cross-feature needs, but must never inject or call another feature's `I{Entity}Repository`. Repository interfaces are private implementation details of their owning feature; only that feature's own service consumes them. If this creates a circular service-to-service dependency, extract the shared capability into `Application/Common` as its own interface consumed by both sides.

---

## Finding 4 — [HIGH] Application-layer failure signaling: exceptions vs. `Result<T>` is unpinned

**Scenario.** Engineer A has `CourseService` throw a custom `CourseNotFoundException : Exception` (defined in `Application/Courses/`) on a missing course, relying on a global `IExceptionHandler`/`UseExceptionHandler()` middleware in `Program.cs` to translate it to a 404 `ProblemDetails`. Engineer B, wary of exceptions-as-control-flow, has `TutorService` methods return `Result<TutorSlotDto>` (a custom wrapper with `IsSuccess`/`Error`), and `TutorController` manually branches on `result.IsSuccess` to build `ProblemDetails` per-endpoint. Both satisfy AD-5's letter ("Errors return RFC 7807 `ProblemDetails`... never a bespoke error envelope") — the *HTTP response* is identical `ProblemDetails` JSON in both cases, so nothing here is visibly broken until:
- `CoursesController` and `TutorController` end up with structurally different bodies (one has a slim pass-through, the other has manual `Result`-unwrapping boilerplate in every action) — inconsistent enough that a new engineer copying "the pattern" from whichever controller they saw first propagates the wrong one;
- Cross-feature calls (Finding 3) compound this: if `TutorService` calls `ICourseService` expecting a thrown exception on failure but `CourseService` was written by an engineer who chose `Result<T>` instead, the failure silently becomes a `Result` object nobody checks, or an unhandled exception crosses a boundary that expected a return value.

**Why the current ADs don't stop it.** AD-5 only pins the outermost HTTP error *shape* (`ProblemDetails`), not the in-process signaling mechanism between Application and Api. There is no AD governing how a service reports "not found" / "validation failed" / "conflict" to its caller.

**Proposed AD-12 — Application failures are typed exceptions, translated centrally**

- **Binds:** how `I{Feature}Service` implementations report failure
- **Prevents:** mixed `Result<T>`/exception conventions across features producing inconsistent controller code and broken cross-feature error propagation
- **Rule:** services signal failure by throwing from a small fixed vocabulary of exceptions defined once in `Application/Common/Exceptions` (e.g. `NotFoundException`, `ValidationException`, `ConflictException`) — never a feature-specific exception type, and never a `Result<T>`/`OperationResult<T>` wrapper. `LearnSphere.Api/Program.cs` registers exactly one global exception-handling middleware mapping each of these types to its `ProblemDetails` status code (404/400/409, falling through to 500). Controllers never `try`/`catch` business exceptions themselves.

---

## Finding 5 — [MEDIUM-HIGH] Design-time `DbContext` factory and migration invocation aren't pinned; concurrent migrations aren't addressed

**Scenario.** AD-8 says migrations are "authored via `dotnet ef migrations add` run against the Api project (which supplies the design-time `DbContext` factory)" — but never states *where* that factory lives, what it reads for a connection string at design time (a real DB isn't running when EF just needs to build the model), or the exact CLI invocation. Engineer A runs `cd src/LearnSphere.Api && dotnet ef migrations add AddCourses -p ../LearnSphere.Infrastructure` from inside `Api/`. Engineer B, working on Tutoring a day later without having pulled Engineer A's branch yet, runs the same shape of command from a stale checkout. Both are "run against the Api project" per AD-8's letter. Two outcomes are likely:
- Both migrations are generated against divergent `ModelSnapshot.cs` baselines (each only aware of their own feature's entity changes), producing a merge conflict in `Persistence/Migrations/*ModelSnapshot.cs` that's easy to resolve *incorrectly* (accepting one side's snapshot silently drops the other's schema change from history, even though the C# migration file itself still exists — leading to a schema drift AD-8 is explicitly supposed to prevent);
- If no `IDesignTimeDbContextFactory<LearnSphereDbContext>` is specified anywhere in the spine, one engineer may add one (reading `appsettings.Development.json` relative to Api's output dir) while the other, hitting "no design-time services were found" locally, works around it by adding a *second*, differently-configured factory or a hardcoded design-time connection string — now there are two sources of truth for design-time configuration.

**Why the current ADs don't stop it.** AD-8's rule names the *project* migrations run against but not the factory's location/contents, the exact command, or a serialization rule for two engineers adding migrations near-concurrently (a near-certain occurrence for two parallel feature teams sharing one `DbContext`).

**Proposed AD-13 — Design-time factory location and serialized migration authorship**

- **Binds:** EF Core migration authoring workflow
- **Prevents:** divergent design-time configuration and colliding/silently-dropped migrations from parallel feature work
- **Rule:** `LearnSphere.Infrastructure/Persistence` contains exactly one `LearnSphereDbContextFactory : IDesignTimeDbContextFactory<LearnSphereDbContext>`, reading the connection string the same way `Program.cs` does (env var first, falling back to `LearnSphere.Api/appsettings.Development.json`). The only sanctioned command is `dotnet ef migrations add <Name> --project src/LearnSphere.Infrastructure --startup-project src/LearnSphere.Api -o Persistence/Migrations`, run from repo root against an up-to-date local branch. An engineer must pull/rebase onto the latest merged migration before generating a new one — migrations are authored serially, never two in flight against the same stale snapshot; a PR touching `Migrations/` that isn't rebased onto the latest merged migration is not mergeable as-is.

---

## Finding 6 — [MEDIUM] Postgres connection configuration key/format and Compose service name aren't pinned

**Scenario.** The Consistency Conventions table says only "environment-variable overrides for connection strings/secrets... consumed by Docker Compose" — no env var *name*, no connection-string *format*, no Compose service *hostname*. Since `docker-compose.yml` and the Npgsql wiring in `Program.cs`/`AddInfrastructure()` are single shared artifacts (not per-feature), whichever engineer writes them first picks unilaterally, and it's a coin flip whether they use ASP.NET's idiomatic `ConnectionStrings__Default` double-underscore env var against a `Host=db;...` ADO.NET string, or a single `DATABASE_URL=postgres://user:pass@postgres:5432/db` URI-style var (common in other stacks/AI-generated boilerplate) against a differently-named Compose service (`postgres` vs `db`). If Engineer A wires `Program.cs` to `GetConnectionString("Default")` and Engineer B's `.env`/compose edit sets `DATABASE_URL` instead, the Api container starts, finds no usable connection string, and either crash-loops or silently falls back to a `localhost` default that doesn't resolve inside the container network.

**Why the current ADs don't stop it.** AD-8 covers *when* migrations apply, not *how* the connection string reaches the app. The Consistency Conventions row is deliberately generic ("environment-variable overrides") and names no key, format, or Compose service name.

**Proposed AD-14 — Pinned connection-string key and Compose topology**

- **Binds:** `docker-compose.yml`, `appsettings.*.json`, and Npgsql wiring in `AddInfrastructure()`
- **Prevents:** two independently-authored config surfaces inventing incompatible env var names/formats
- **Rule:** the connection string is supplied exclusively via `ConnectionStrings__Default`, read with `configuration.GetConnectionString("Default")`. `docker-compose.yml`'s Postgres service is named `db`; the Api service's `ConnectionStrings__Default` is `Host=db;Port=5432;Database=learnsphere;Username=${POSTGRES_USER};Password=${POSTGRES_PASSWORD}`, sourced from the same `.env` that supplies the official `postgres` image's `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`. No other env var name or URI-style connection format appears anywhere in the codebase.

---

## Finding 7 — [LOW-MEDIUM] Request validation framework/location is unspecified

**Scenario.** Engineer A puts `[Required]`/`[StringLength]` DataAnnotations directly on `CreateCourseRequest`, relying on ASP.NET's automatic `[ApiController]` model validation to short-circuit with a 400 before the controller body runs. Engineer B, wanting validation rules that reference other fields or async uniqueness checks, adds `FluentValidation` and calls a `Validate()` inside `TutorService.CreateSlotAsync`, throwing on failure (or returning a `Result`, compounding Finding 4). Now there are two validation frameworks in one solution, validation fires at two different layers (Api model-binding vs. Application), and error responses for "bad input" have different shapes/timing (before vs. after a service call) depending on which feature you hit. Nothing in AD-5 or AD-7 addresses input validation — AD-7 only pins the *test* framework/mocking library.

**Proposed tightening.** Extend AD-5 (or add a short AD-15) pinning one validation approach for the whole solution — e.g. "DataAnnotations on `Create/Update{Entity}Request` DTOs for shape/presence validation, enforced automatically by `[ApiController]`; any cross-field or data-dependent rule (uniqueness, business invariants) is enforced inside the service and reported via the AD-12 exception vocabulary, never a second validation library."

---

## Finding 8 — [LOW] `Application/Common`'s "pagination/result wrappers" have no pinned shape

**Scenario.** The Structural Seed mentions `Application/Common # IUnitOfWork, shared DTO base types, pagination/result wrappers` but defines none of them. Engineer A builds `PagedResult<T> { List<T> Items, int TotalCount, int Page, int PageSize }` for `GET /api/v1/courses`. Engineer B, never having seen Engineer A's type (different feature, parallel work), builds `PagedList<T> { IEnumerable<T> Data, int Page, int Total }` for `GET /api/v1/tutoring/slots` with different field names and semantics (`Total` = total pages vs. total items is genuinely ambiguous without a shared contract). Frontend consumers now handle two different pagination envelopes for what should be one consistent API convention, directly undermining AD-6's stated goal ("both halves of the stack read the same way").

**Proposed tightening.** Since `Application/Common` is explicitly called out as shared, add one line to AD-6 or the Consistency Conventions table pinning the actual shape, e.g.: `PagedResult<T> { IReadOnlyList<T> Items, int TotalCount, int PageNumber, int PageSize }`, defined once in `Application/Common`, used as the return type for every list-returning service method solution-wide.

---

## Summary Table

| # | Finding | Severity | Gap type |
| --- | --- | --- | --- |
| 1 | Service signatures: Domain entity vs DTO, mapping location | Critical | Missing AD |
| 2 | `IUnitOfWork.SaveChangesAsync` ownership | Critical | Missing AD |
| 3 | Cross-feature-folder dependency rules | High | Missing AD |
| 4 | Exceptions vs `Result<T>` for Application failures | High | Missing AD |
| 5 | Design-time factory + concurrent migration authorship | Medium-High | Underspecified AD-8 |
| 6 | Postgres connection env var/format/service name | Medium | Underspecified Consistency Convention |
| 7 | Validation framework/location | Low-Medium | Missing AD |
| 8 | Pagination/result wrapper shape | Low | Underspecified Structural Seed |

All eight gaps share one root cause: the spine is precise about **layering and folder structure** (AD-1, AD-2, AD-6) but leaves **cross-cutting contracts that must be identical across every feature folder** — service signatures, transaction boundaries, failure signaling, shared DTO shapes, and the one shared `docker-compose.yml`/migration history — to implicit convention. Those are exactly the seams two independent implementers (human or AI) will each resolve reasonably and differently, because the spine gives them no shared answer to point to.
