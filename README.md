# FlexDemy

**My time. My academy.**

An AI-powered interactive learning platform: course discovery, a 5-level concept
drilldown reader, synchronous group study rooms, a tutor booking hub, and progress
tracking.

## Layout

- `FrontEnd/` — React 19 + TypeScript + Vite + Tailwind SPA. See
  `FrontEnd/docs/FRONTEND_PRD.md` and the architecture spine under
  `_specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/`.
- `BackEnd/` — ASP.NET Web API (C#) on PostgreSQL, Clean Architecture. See
  `BackEnd/CLAUDE.md` for coding rules and the architecture spine under
  `_specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/`.

## Run locally without Docker

**Frontend:**
```
cd FrontEnd
npm install
npm run dev      # http://localhost:3000
npm test         # vitest, tests/ mirrors src/
```

**Backend** (needs a local PostgreSQL, or run just the `postgres` service via Docker —
see below):
```
cd BackEnd
dotnet build
dotnet test
dotnet run --project src/FlexDemy.Api
```

## Run with Docker

One `docker-compose.yml` at the repo root, three services (`postgres`, `api`, `web`), each
tagged with a Compose profile so you can bring up the whole stack or just one half:

```
docker compose --profile all up            # frontend (:3000) + backend (:8080) + postgres
docker compose --profile backend up        # postgres + api only
docker compose --profile frontend up       # web only (static build, no live API)
docker compose --profile backend --profile frontend up   # same as --profile all
```

`web` serves the built frontend via nginx on `:3000`; `api` listens on `:8080`; `postgres`
is only reachable from other containers plus `localhost:5432` for local tooling.

> **Known limitation:** on some machines the `api` image's `dotnet restore` step fails
> with a `NU1301 UntrustedRoot` TLS error reaching `api.nuget.org` — this is a local
> network/corporate-proxy certificate issue, not a problem with the Dockerfile or the
> code (`dotnet build`/`dotnet test` on the host, and the `web` image's build, both work
> fine). Fix is trusting your org's root CA inside the SDK build stage, or pointing NuGet
> at an internal proxy.
