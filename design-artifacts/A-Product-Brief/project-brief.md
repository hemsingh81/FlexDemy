# FlexDemy eLearning — Product Brief

> **Backfill note (2026-08-15).** The WDS (Web Design Studio) `design-artifacts/A-Product-Brief`
> scaffold was created on module install but never populated — the project's planning work had
> already happened through a different BMad module (BMM) and produced four PRDs directly, with
> no canonical brief upstream of them. This document is a **backfilled synthesis**, not new
> product discovery: it consolidates those four approved PRDs into the single entry point WDS
> expects every later design decision to trace back to. It cites its sources throughout rather
> than restating them; where the source PRDs are silent, ambiguous, or only assumption-tagged,
> this brief says so rather than resolving it. Source of truth:
>
> - **Core Platform (Dashboard)** — `_specs/planning-artifacts/prds/prd-eLearning-2026-08-10/prd.md`
> - **Assignments** — `_specs/planning-artifacts/prds/prd-eLearning-Assignments-2026-08-10/prd.md`
> - **Course Wizard & Adaptive Learning** — `_specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md`
> - **Error Observability** — `_specs/planning-artifacts/prds/prd-eLearning-ErrorObservability-2026-08-13/prd.md`
>
> Also referenced: repo root `README.md` (product tagline, stack, run instructions). A
> `docs/Style_Guide.pdf` exists at the repo root but could not be parsed by available tooling
> during this backfill (no PDF renderer available) — its content is not reflected here and should
> be reviewed separately if it carries brand/visual guidance relevant to later design phases.

## 1. Product Vision & Positioning

FlexDemy is positioned as **"My time. My academy."** (README) — an AI-powered, interactive
eLearning platform combining course discovery, a five-level adaptive concept drill-down reader,
synchronous group study rooms, a tutor booking hub, and progress tracking in one product.

Across the four source PRDs, the vision statements converge on one consistent theme: **collapse
fragmented, disconnected surfaces into one coherent home per role, and replace static,
one-size-fits-all content with adaptive, AI-assisted content** —

- The **Dashboard PRD** merges what were two disconnected homes (Dashboard and Tutor Hub) into
  one role-aware Dashboard, so a Student's whole learning life — progress, goals, courses, and
  getting tutor help — lives in one place, and a Tutor's whole teaching operation does too
  (`prd-eLearning-2026-08-10/prd.md` §1).
- The **Assignments PRD** folds a standalone, memoryless quiz tab into that same Dashboard and
  turns it into an actual assignment system: students get a persistent record of what they've
  done, and tutors get to create, publish, and grade their own assignments instead of being
  limited to lesson-embedded quizzes (`prd-eLearning-Assignments-2026-08-10/prd.md` §1).
- The **Course Wizard PRD** replaces manual, flat course authoring with an AI-assisted flow that
  proposes a structured outline from a tutor's raw material, and gives students the same topic
  explained at progressively deeper levels or in an entirely different way if the first framing
  doesn't land — with the underlying AI model treated as a swappable configuration, not a fixed
  dependency (`prd-eLearning-CourseWizard-2026-08-10/prd.md` §1, §4.1).
- The **Error Observability PRD** extends this "make the invisible visible" theme to platform
  operations: every backend and frontend error lands in one durable, queryable, auto-triaged
  store instead of vanishing into container logs (`prd-eLearning-ErrorObservability-2026-08-13/prd.md`
  §1).

The source PRDs do not state a company-level mission, market positioning statement, or
competitive differentiation beyond these product-level visions — no explicit "we exist because X"
or "unlike Y, we do Z" language appears in any of the four documents. A dedicated positioning
statement, if needed for later design phases, is a gap to fill deliberately rather than infer.

## 2. Target Users / Audience

Derived from each PRD's "Target User" section; role names are the literal `UserRole` values used
in code per the PRDs.

| Role | Summary | Primary source |
|---|---|---|
| **Student** (`UserRole.Student`) | Learns via courses, drill-down/alternative explanations, exercises, and keyword lookups; books tutor help; joins group study and masterclasses; submits and tracks assignments. | All four PRDs |
| **Tutor / Creator** (`UserRole.Tutor`) | Manages teaching operations (availability, slot calendar, earnings); authors courses via the AI-assisted wizard; creates, publishes, and grades assignments. | Dashboard, Assignments, Course Wizard PRDs |
| **Admin — Master** | Full administrative role: AI provider/model configuration and budget control, tag/taxonomy governance, and — uniquely — sole access to the Error Log (`FeatureKeys.ErrorsManage`, Master-only). Defaults to the Student Dashboard with an admin-only toggle to preview an empty/demo Tutor Dashboard. | Course Wizard, Error Observability PRDs; Dashboard PRD FR-3 |
| **Admin — Support** | Shares Master's Dashboard preview-toggle behavior but is explicitly excluded from the Error Log in v1 (`ErrorObservability PRD` §2.2, FR-19) and has no dedicated Assignments-creation identity of its own (`Assignments PRD` §2.2). | Dashboard, Assignments, Error Observability PRDs |
| **Unassigned / PendingTutor / RejectedTutor** | Explicitly named non-users for v1 across the Dashboard and Assignments PRDs — intercepted by onboarding/approval gating before reaching the main app shell; out of scope for these PRDs, not absent from the system. | Dashboard PRD §2.2, Assignments PRD §2.2 |

Two narrower non-user callouts worth carrying forward: the Course Wizard PRD scopes course
*creation* as tutor-only (students cannot build course structure, §2.2), and institutional/bulk
API consumers are explicitly out of scope for v1 (single-tutor, wizard-driven upload only).

## 3. Problem Statement

Synthesized from each PRD's Vision/§1 section — these are the stated pain points the platform is
built to close, not inferred market pain:

1. **Fragmented navigation, split roles.** A Student had to leave Dashboard and switch to a
   separate Tutor Hub tab just to book help; that tab also carried a leftover manual
   "preview the other role" toggle. Tutors had the mirror problem — their teaching operations
   lived disconnected from the rest of the app (Dashboard PRD §1).
2. **Assignments had no memory and no tutor authorship.** The standalone Assignments tab was a
   flat, course-only quiz picker; a submitted result evaporated on reload, tutors had no way to
   assign work directly to a student, and there was no way to run a platform-wide open assignment
   (Assignments PRD §1).
3. **One explanation, no adaptation.** A tutor authored courses by typing lessons into a flat
   list with no structuring help and no way to teach the same idea at more than one depth or in
   more than one style; a student got whatever single explanation the tutor happened to write,
   with nothing else to try if it didn't click except asking a human (Course Wizard PRD §1).
4. **No operational visibility into failures.** When something broke — an unhandled exception, a
   background job exhausting retries, a self-hosted dependency going down, a frontend crash —
   the only trace was a container's stdout log, if that; two exception types were never logged
   anywhere at all, and frontend runtime errors had no capture mechanism whatsoever. This was
   confirmed directly: diagnosing a real production issue required manually reading Docker
   container logs by hand, because no other option existed (Error Observability PRD §1).

## 4. Success Criteria / Key Metrics

Each source PRD states its own metrics; none of the four leaves this section fully unquantified,
though several individual figures are themselves marked as unconfirmed placeholders in the
source (noted below). No cross-PRD, platform-level success metric is defined anywhere in the
source material — each PRD's metrics are scoped to its own feature area only.

**Dashboard PRD**
- SM-1 (primary): 100% feature parity — every FR in §4.2–§4.5 reachable and functional from the
  merged Dashboard, zero regressions.
- SM-2 (secondary): top-level nav simplified from 7 tabs to 6.
- SM-C1 (counter-metric): role purity — no Tutor-only widget shown to a Student or vice versa,
  even to reduce code branching.

**Assignments PRD**
- SM-1 (primary): every FR in §4.1–§4.7 reachable and functional; existing course-quiz auto-grade
  flow unchanged.
- SM-2 (secondary): nav simplified further, 6 tabs to 5.
- SM-C1 (counter-metric): Source badge (Course/Tutor/Competition) must never be dropped or
  de-emphasized for the sake of a simpler list.

**Course Wizard PRD**
- SM-1/SM-2 (primary): % of topic views engaging Drill-Down or Alternative-Explanation mode; and
  student self-reported "I understood this" rate per topic.
- SM-3/SM-4 (secondary): % of AI-extracted structure confirmed with no/minor tutor edits;
  Draft → Published conversion rate.
- SM-5 (cost/operational): cost per generated topic, tracked dev-free-tier vs. production
  paid-tier, held within an admin-configured budget threshold.
- SM-C1–SM-C3 (counter-metrics): extraction-acceptance rate must not be chased by generating
  vaguer structures; engagement must not be chased by deliberately weakening Level-1/Way-1
  explanations; cost targets must not be hit by silently degrading model quality.

**Error Observability PRD**
- SM-1 (primary): 100% of previously-uncaptured failure modes produce an ErrorRecord within one
  release cycle of shipping.
- SM-2 (primary): median time from error occurrence to admin-queryable visibility under 1 minute.
- SM-3 (secondary): % of P0/P1 records reaching Resolved within 24 hours (a process metric,
  dependent on admin behavior, not pure system capability).
- SM-C1 (counter-metric): a falling active-error count achieved by archiving/resolving without
  actually fixing anything is a false signal, not success.

**Caveat carried from source:** several supporting numeric targets that feed these metrics are
explicitly tagged `[ASSUMPTION: confirm before build]` in the Course Wizard and Error
Observability PRDs — e.g. `defineKeyword` p95 latency, error-capture overhead budgets (~50ms/
~200ms), the Error Log's ~100k-record/~2s scalability target, and the 180-day retention default.
These are placeholders the source PRDs added to have *something* testable, not confirmed targets;
treat them as provisional if referenced in later design work.

## 5. Scope

### 5.1 In scope, by PRD area

**Core Platform / Dashboard** — one role-routed "Dashboard" nav entry replacing separate
Dashboard and Tutor Hub tabs; Student view (welcome/streak banner, stat cards, 7-day activity
calendar, Weekly Goal ring, Adaptive Schedule, My Courses, tutor-slot browsing/booking, Group
Study Pool, Public Live Masterclass browsing, Study Rooms quick-join); Tutor view (online/offline
toggle, performance analytics, slot calendar management, Course Creation Wizard entry, public-class
broadcast roster); a narrow Master/Support empty-demo Tutor Dashboard preview toggle. Frontend-only
in this phase — data stays on existing mock services.

**Assignments** — Assignments retired as a top-level nav tab and folded into a new left-side
section nav on the Dashboard; Student side (My Submissions, unified Available Assignments list
spanning Course/Tutor/Competition sources, Immediate vs. Hold submission visibility); Tutor side
(assignment creation with Draft/Publish states, multiple-choice question authoring, Immediate/Hold
visibility choice, Submissions review, Review and Re-evaluate actions); CoursePlayer's "Take Quiz"
entry point rewired into the new flow (with an adjacent deep-link bug fix). Frontend-only, new
mock service layer.

**Course Wizard & Adaptive Learning** — a provider-agnostic internal AI Service Layer (the
architectural centerpiece); a four-step metadata wizard (Title, Tags, Taxonomy via existing
MasterDataManager, Thumbnails); multi-file upload with parsing/OCR pre-step and AI structure
extraction (Chapter → Topic → Subtopic → Content); full tutor editing/confirmation control;
subject-aware WYSIWYG rendering (math/physics, chemistry, biology, English, Hindi); four
adaptive-learning mechanisms (5-level Drill-Down, 5 alternative "Ways," optional exercises,
click-any-keyword definitions); pre-generation-at-publish and caching; a Draft → In Review →
Review Confirmed → Published lifecycle with post-publish versioning; admin Tag CRUD; admin AI
configuration, usage/cost visibility, and budget-threshold enforcement.

**Error Observability** — backend capture of every unhandled exception, every `AppException`
subtype, and Hangfire background-job terminal failures; frontend capture (React error boundary,
`window.onerror`/`unhandledrejection`, a dedicated unauthenticated reporting endpoint);
fingerprinted `ErrorRecord` storage with occurrence counting; rule-based (not AI-based)
auto-categorization and auto-priority (P0–P3); a Master-only Admin Error Log UI with server-side
pagination, filtering, and detail view; lifecycle actions (Archive, Resolve, auto-Reopen on
regression, one-way Increase Priority); admin-configurable retention/purge policy; end-to-end
Correlation ID tracing across HTTP requests, background-job chains, and frontend error reports.

### 5.2 Explicitly out of scope (compiled from each PRD's Non-Goals)

- Any new capability beyond consolidating existing Dashboard/Tutor Hub behavior (Dashboard PRD is
  a restructuring, not a scope expansion); dual-role Student/Tutor UX; visual redesign of
  individual widgets beyond composing them into one page.
- Free-text/essay auto-grading and AI rubric/plagiarism evaluation for assignments; notifications
  on assignment review/publish; versioned/live-editable Published assignments; wiring the existing
  decorative (non-functional) file-upload field.
- Auto-grading of Course Wizard exercises beyond immediate feedback/shown-solution; languages
  beyond English and Hindi; deep OCR accuracy tuning for heavily degraded scans; institution-level
  bulk/API course import; non-tutor course authoring; student enrollment/consumption-analytics
  dashboards; monetization/pricing mechanics; collaborative multi-tutor editing; automatic
  personalization that adapts depth/style without explicit student action.
- A full APM/distributed-tracing platform, alerting/notifications (Slack/email/PagerDuty), AI-based
  error classification, true hard-delete of error records, per-occurrence audit trails, and
  cross-error analytics/trend charts, for Error Observability — all deferred past v1; Support-role
  access to the Error Log.
- **Backend/API work is deferred out of this scoping round for the Dashboard and Assignments
  PRDs specifically** — both are explicitly Phase A/frontend-only, with backend requirements
  addressed in a separate follow-up pass to `BACKEND_PRD.md` (per each PRD's §9/§6.2). The Course
  Wizard and Error Observability PRDs, by contrast, scope full-stack work including backend
  architecture.

## 6. Key Constraints

**Technical / architectural**
- Frontend: React 19 + TypeScript + Vite + Tailwind SPA (`FrontEnd/`); Backend: ASP.NET Web API
  (C#) on PostgreSQL using Clean Architecture (`BackEnd/`) — per `README.md`.
- New work is required to build on existing conventions rather than introduce new ones: the
  backend architecture spine's Clean Architecture layering, `AppException` taxonomy, Hangfire job
  pattern, and `FeatureKeys`/role-permission RBAC (Error Observability PRD §0); the existing
  feature-folder frontend organization and component reuse (e.g. `DrilldownPanel.tsx`,
  `CourseOverviewScreen.tsx`'s anchor-jump nav pattern) rather than parallel/duplicate
  implementations.
- The Course Wizard PRD's single most load-bearing architectural requirement: every AI-driven
  capability must sit behind one internal, provider-agnostic AI Service Layer, so the model
  powering the module is a configuration choice, not a code dependency (§4.1) — see
  `platform-requirements.md` for detail.
- Accessibility: WCAG 2.1 AA is carried over as an existing app-wide commitment in the Dashboard
  and Assignments PRDs; the Course Wizard PRD explicitly flags this level as an *assumed*, not
  confirmed, conformance target (§4.14, §8 Open Question 4).

**Process / timeline**
- A recurring two-phase execution convention across PRDs: **Phase A** ships frontend-only against
  existing/new mock services; **Phase B** (backend) is addressed in a later, separate pass that
  reconciles with — rather than replaces from scratch — prior backend design already documented
  in `BACKEND_PRD.md`/`ARCHITECTURE-SPINE.md` (Dashboard PRD §9, Assignments PRD §9). The Course
  Wizard and Error Observability PRDs do not follow this split — they scope full-stack work
  directly.
- Several PRDs carry unresolved `[ASSUMPTION: confirm before build]` tags on concrete parameters
  (file size caps, thumbnail aspect ratio, retention window, latency targets, priority-escalation
  thresholds, etc.) — these are noted in-line in their source PRDs and are not resolved by this
  brief; treat them as open build-time decisions, not settled constraints.

**Compliance / security**
- Error Observability requires secret/PII redaction (structured fields and free-text
  message/stack-trace scanning) before any error record is persisted, and restricts admin access
  to the Master role specifically because stack traces/messages can incidentally carry
  user-identifying information (§4.1 FR-5, Constraints and Guardrails). The same PRD flags an
  explicit unresolved gap: no GDPR/data-subject-deletion guarantee exists over error records
  containing a specific user's data in v1.
- Course Wizard requires uploaded files to be malware/file-type scanned before processing and
  access-controlled to the course owner (and co-tutors); dev-phase AI usage involving real-ish
  student content is restricted to providers that do not train on submitted input by default.
- No compliance regime (GDPR, COPPA/student-data law, accessibility law beyond WCAG) is named as
  a binding constraint in any of the four PRDs — only the two gaps above are explicitly
  self-flagged. Absence of a stated compliance requirement should not be read as confirmation none
  applies; the source material is simply silent on it.

**Known operational limitation**
- Per `README.md`: on some networks, the Docker `api` image's `dotnet restore` step fails with a
  `NU1301 UntrustedRoot` TLS error reaching `api.nuget.org` — a local network/corporate-proxy
  certificate issue, not a defect in the Dockerfile or application code. `dotnet build`/`dotnet
  test` on the host and the `web` image's build both work fine independent of this.
