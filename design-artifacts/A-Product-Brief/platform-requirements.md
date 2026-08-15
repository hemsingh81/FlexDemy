# Platform & Technical Requirements — Backfilled Summary

> **Backfill note (2026-08-15).** Companion to `project-brief.md`. Two of the four source PRDs
> contain technical-boundary detail substantial and specific enough (exact exception types, job
> names, gateway architecture, controller-level auth rules) that folding it into the brief would
> bury the product-level narrative. This document exists only to carry that detail forward without
> losing it. It does not add new information — every line traces to a cited PRD section. The
> Dashboard and Assignments PRDs are frontend-only in this phase and contribute no comparable
> technical-boundary content of their own (see `project-brief.md` §6).

## 1. AI Service Layer (Course Wizard PRD)

Source: `_specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md` §4.1, §4.14, §5.

This is called out in the source PRD itself as its single most important requirement —
architectural, not features-list (§0).

- **Provider-agnostic gateway.** All AI-driven capability (frontend and backend) is invoked only
  through one internal AI Service Layer; feature code never calls a vendor AI SDK directly (FR-1).
  A code-review/lint check is expected to fail a PR that imports a vendor AI SDK outside the
  gateway module.
- **Named AI Tasks**, each independently configurable to a provider/model: `extractStructure`,
  `explainTopic(level)`, `rewriteExplanation(way)`, `generateExercise`, `defineKeyword`,
  `describeNotation`, plus embeddings.
- **Config-only provider/model swap** (FR-2): changing a task's model takes effect without a
  redeploy. `[ASSUMPTION, per source]`: implemented as a self-hosted, zero-markup OpenAI-compatible
  gateway from day one (e.g. Portkey's open-source gateway), not a managed-then-self-hosted
  migration — chosen in cost review to avoid a managed gateway's platform fee and to get
  data-residency benefit from launch. A self-hosted model runtime (e.g. Ollama-class) is a
  selectable backend for any task through the same config, not a separate integration.
- **Per-task fallback** (FR-3): retries on an alternate provider on primary rate-limit/outage;
  every fallback event is logged and visible via usage tracking, not just silently absorbed.
- **Usage/cost tracking** (FR-4) and **centralized, versioned prompt/config** (FR-5): token usage
  and computed cost recorded per task invocation (and per course/tutor where applicable); prompts
  and model config live in one versioned location, attributable to who changed what and when.
- **Budget enforcement** (FR-29): admin-set cost thresholds per task and/or platform-wide; the
  gateway warns at a configured percentage and blocks routing that would exceed a hard threshold,
  rather than only reporting spend after the fact.
- **Dependent pipeline services**, also called out as self-hosted/free-tier by cost-review
  decision rather than paid SaaS: a document parser with OCR for scanned pages (e.g. Docling,
  FR-12) ahead of `extractStructure()`; a malware/file-type scanner (e.g. ClamAV, FR-11) ahead of
  any upload being processed.
- **Generation timing**: Drill-Down and Alternative-Explanation content is pre-generated and
  cached at publish time (FR-21), not generated per student view — publishing is asynchronous, and
  a single node's generation failure doesn't block the rest of the course (falls back to
  on-demand generation for that node until retried). Keyword definitions, by contrast, are
  generated on-demand given their open-ended nature.
- **Explicit unresolved infrastructure gap** (source's own flag, §4.10 Notes): the async
  publish/generation batch requires durable job/task state and a worker execution model that
  neither existing architecture spine document currently establishes — the source PRD defers this
  decision to the architecture pass rather than assuming it "falls out" of existing patterns.
- **Data-privacy constraint on dev usage**: free/cheap-tier AI providers used during development
  are restricted to ones that do not train on submitted input by default whenever real-ish student
  content is involved; providers that do (e.g. Google AI Studio's free tier outside EU/UK/EEA) are
  usable only with synthetic, non-student content.

## 2. Error Observability — Integration Surface (Error Observability PRD)

Source: `_specs/planning-artifacts/prds/prd-eLearning-ErrorObservability-2026-08-13/prd.md`
"Integration and Dependencies", §4.8, §4.9, Cross-Cutting NFRs.

Framed in the source PRD as deliberately cross-cutting: it observes, rather than replaces, every
existing failure-producing surface in the backend — no new external third-party service is
introduced.

- **Existing surfaces this feature attaches to, named explicitly in the PRD:**
  - All 10 existing `AppException` subtypes (`NotFoundException`, `ValidationException`,
    `ConflictException`, `UnauthorizedAppException`, `AiGatewayException`,
    `AiResponseValidationException`, `AiTaskUnavailableException`, `AiTaskBudgetExceededException`,
    `DocumentParsingUnavailableException`, `FileScanUnavailableException`).
  - All 4 existing Hangfire jobs (`ScanFileJob`, `ParseFileJob`, `ExtractStructureJob`,
    `PublishNodeContentJob`) and their 4 enqueuers, each of which needs a new Correlation ID
    parameter threaded through (FR-21).
  - Two existing per-entity failure-tracking fields that stay unchanged and are *mirrored*, not
    replaced: `CourseFile.FailureReason` and `PublishBatchItem.ProgressText`.
  - The existing `FeatureKeys`/role-permission RBAC system (no new auth mechanism) and the
    existing Admin panel shell (`AdminPanel.tsx`, `useAdminPanel.ts`) for menu placement.
  - Three self-hosted external dependencies whose failures become visible for the first time
    through this feature: the document-parsing/OCR service, the AI-provider gateway, and the
    malware-scanning service — i.e., this feature is partly an observability layer over the AI
    Service Layer described in §1 above.
- **Access boundary**: a new `FeatureKeys.ErrorsManage` policy, Master-only, gates every
  list/filter/detail/lifecycle-action/retention-config endpoint (FR-19); a non-Master user hitting
  the API directly (not just the UI) receives 403 — backend policy is the real enforcement. The
  sole exception is the error-reporting endpoint itself (`POST /api/v1/errors/client`, FR-7), which
  intentionally carries no `[Authorize]` policy at all (it must remain reachable by a logged-out
  user, e.g. a crash on the login screen) and is instead protected by IP rate-limiting.
- **Correlation ID tracing** (§4.9, FR-20–24): a new outermost middleware assigns an
  `X-Correlation-Id` (reused from an inbound header if present, else a new GUID), running before
  exception-handling middleware; propagated through Hangfire job enqueuers as a job argument so a
  request's full async pipeline (e.g. upload → scan → parse → extract) can be traced as one chain
  even across job boundaries; the frontend retains the most recent value from API responses and
  attaches it to any error report. Explicitly scoped as a single app-level identifier, not a W3C
  Trace Context/OpenTelemetry span model or multi-service distributed tracing (Non-Goals).
- **Performance/scale placeholders** (source explicitly labels these as unconfirmed, added in
  review to replace vague "negligible" language): error capture adds no more than ~50ms to p99
  request latency and ~200ms to a job's total run time; the Admin Error Log list view targets
  ~2 seconds at up to ~100,000 stored records via server-side pagination and indexing (a genuinely
  new pattern — every other existing admin list in the app fetches its full result set and filters
  client-side).
- **Redaction guardrail**: known-sensitive values are redacted from both structured context (a
  deny-list of field-name substrings: `Authorization`, `ApiKey`, `Password`, `Token`) and
  free-text message/stack-trace content (a starting pattern set: Bearer tokens, common API-key
  prefixes, inline connection-string `Password=`/`Pwd=` segments) before any row is persisted.

## 3. Deployment & Stack Baseline (README)

Source: `README.md`. Included here because it is the only place stack/deployment facts are stated
platform-wide, and both technical sections above assume it.

- Frontend: React 19 + TypeScript + Vite + Tailwind SPA, served via `npm run dev` (port 3000
  locally) or, in Docker, via nginx on `:3000`.
- Backend: ASP.NET Web API (C#) on PostgreSQL, Clean Architecture, served via `dotnet run` or, in
  Docker, on `:8080`.
- Single `docker-compose.yml` at repo root with three services (`postgres`, `api`, `web`) behind
  Compose profiles (`all`, `backend`, `frontend`) so either half of the stack can run
  independently; `postgres` is reachable from other containers plus `localhost:5432` for local
  tooling only.
- Known limitation (not a code defect): on some networks the `api` image's `dotnet restore` step
  fails with a `NU1301 UntrustedRoot` TLS error against `api.nuget.org` — a local
  network/corporate-proxy certificate issue. Fix is trusting the org's root CA in the SDK build
  stage, or pointing NuGet at an internal proxy.
