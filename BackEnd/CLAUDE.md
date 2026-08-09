# FlexDemy Backend — coding rules for AI assistants

Full rationale and the memlog behind every rule below lives in
`_specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md`
(`AD-1` … `AD-13`). This file is the condensed, actionable version — read the spine when a rule
here feels ambiguous or you need the "why."

## The shape

Clean Architecture, four projects, dependencies point inward only:

```
FlexDemy.Api            -> FlexDemy.Application, FlexDemy.Infrastructure
FlexDemy.Infrastructure -> FlexDemy.Application
FlexDemy.Application    -> FlexDemy.Domain
FlexDemy.Domain         -> (nothing)
```

Never add a project reference that points the other way. If you're in `Domain` or
`Application` and want something from `Infrastructure`, you're in the wrong layer — define
an interface in `Application` instead and implement it in `Infrastructure`.

Every layer is organized **by feature**, not by type: `Application/Courses/`,
`Application/Tutoring/`, etc. — never a flat `Services/` or `Interfaces/` folder. When you add
a new feature, create its folder in all three layers it touches (`Domain/X`,
`Application/X`, `Infrastructure/Repositories` + `Persistence/Configurations`), mirroring the
existing `Courses` slice — read `src/FlexDemy.Application/Courses/*` and
`src/FlexDemy.Infrastructure/Repositories/CourseRepository.cs` first as the reference
implementation before writing a new one from scratch.

## Rules, in the order you'll hit them

1. **A new entity goes in `Domain/{Feature}/`.** Plain C# POCO. No EF Core attributes, no
   `[Table]`/`[Column]`, nothing framework-specific.

2. **Its repository interface (`I{Entity}Repository`) goes in `Application/{Feature}/`.**
   Its implementation goes in `Infrastructure/Repositories/`. The repository only stages
   changes (`Add`/`Update`/`Remove`) — it never calls `SaveChangesAsync`.

3. **Its table mapping is a `IEntityTypeConfiguration<T>` in
   `Infrastructure/Persistence/Configurations/`.** Don't add data annotations to the
   entity. Column names come for free from the snake_case naming convention already
   registered on the `DbContext` — don't call `.HasColumnName()` unless a name genuinely
   needs to diverge from the auto-converted default.

4. **The service (`I{Feature}Service` / `{Feature}Service`) goes in `Application/{Feature}/`.**
   - Its public methods accept and return **DTOs only** (`{Entity}Dto`,
     `Create{Entity}Request`, `Update{Entity}Request`) — never a `Domain` entity.
   - Mapping between DTO and entity is a static `{Entity}Mapper` class beside it
     (`ToDto()` / `ToEntity()` extension methods). Don't reach for AutoMapper — it's not in
     this project (commercial license; see AD-3/AD-10).
   - It's a plain class registered in DI, not a MediatR handler. No mediator, no
     command/query objects. Controllers call it directly.
   - New IDs come from `IIdGenerator.NewId()`, never left for the database to generate.
   - It calls `IUnitOfWork.SaveChangesAsync()` **exactly once**, after every repository call
     for that use-case — that's the only place a use-case commits.
   - Need another feature's data? Depend on **that feature's service interface**
     (`ICourseService`), never its repository interface directly.
   - Failure is a thrown exception (`NotFoundException`, `ValidationException`,
     `ConflictException` from `Application/Common/AppException.cs`, or a new subtype of
     `AppException` if none fits) — not a `Result<T>` wrapper, not a bespoke error object.

5. **Its controller goes in `Api/Controllers/`.** Thin: parse the request into a DTO, call
   one service method, return the result. No business logic in a controller, ever. Routes
   are `/api/v1/{resource}`. You never need to catch `AppException` yourself —
   `Middleware/ExceptionHandlingMiddleware.cs` already turns it into the right
   `ProblemDetails` response.

6. **New DI registrations go in the project's own `DependencyInjection.cs`**
   (`AddApplication()` / `AddInfrastructure()`), never inline in `Program.cs` and never
   `new`'d up ad hoc inside a class that needs it.

7. **Schema changes are an EF Core migration**, authored from `src/FlexDemy.Infrastructure`:
   ```
   dotnet ef migrations add <Name> --startup-project ../FlexDemy.Api --project .
   ```
   Only one person/agent adds a migration at a time against latest `main` — two concurrent
   migrations collide on `FlexDemyDbContextModelSnapshot.cs`.

## Testing

- `FlexDemy.Application.Tests` / `.Infrastructure.Tests` / `.Api.Tests` mirror `src/` —
  put a test where its subject's path would put it, don't colocate.
- Mocking: `NSubstitute`. Assertions: xUnit's built-in `Assert`. Do not add `Moq` or
  `FluentAssertions` ≥8 — see AD-7 for why (reputational/licensing reasons, not technical).
- `Infrastructure.Tests` uses EF Core's `InMemory` provider for repository tests — fast,
  no Docker needed. It can't translate Npgsql-specific LINQ (`EF.Functions.ILike`, etc.);
  those code paths are exercised against real Postgres, not covered by these unit tests.

## Deployment

`docker-compose.yml` lives at the **repo root**, not here. See the root `README.md` /
`AGENTS.md` for the three deploy profiles (`backend`, `frontend`, `all`).

## What's deliberately not built yet

WebSockets, Redis, the AI drilldown/grading pipeline, and real JWT/OAuth2 auth are all
**Deferred** in the spine, not forgotten. Don't invent ad hoc versions of them while
implementing something else — check the spine's Deferred section, and if you're the one
finally scoping one of them, that's a spine **Update**, not a silent addition.
