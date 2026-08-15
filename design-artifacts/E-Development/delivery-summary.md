# FlexDemy eLearning — Development Delivery Summary

**Backfilled synthesis — 2026-08-15.** This document was produced after the fact to index existing
epics/stories/architecture into the WDS (Web Design Studio) `design-artifacts/E-Development`
structure. The project's implementation backlog (32+ numbered story files) was authored via a
different BMad module directly under `_specs/implementation-artifacts/`, not through WDS's own
story-authoring flow.

**The numbered story files under `_specs/implementation-artifacts/` remain the single
authoritative, detailed source** for requirements, acceptance criteria, and dev notes — this
document is an index and handoff summary layer on top of them, not a replacement. It does not
reproduce story bodies, acceptance criteria text, or dev notes; where detail is needed, follow the
links back to the source file.

**Going forward:** any new story must be added to both `_specs/implementation-artifacts/sprint-status.yaml`
(the tracking source of truth) and reflected here (epic breakdown + this doc's "how to add a new
story" section) so this index doesn't drift from the real backlog. See the companion
`design-artifacts/E-Development/acceptance-criteria.md` for the per-epic pointer to where detailed
acceptance criteria actually live.

---

## 1. Source Documents

| Document | Role |
|---|---|
| `_specs/planning-artifacts/epics.md` | Epics 1-3 (New Course Wizard PRD) — FRs, NFRs, UX design requirements, full story breakdown |
| `_specs/planning-artifacts/epics-ErrorObservability.md` | Epic 4 (Error Observability PRD) — separate PRD-scoped breakdown, folded into project numbering as Epic 4 |
| `_specs/implementation-artifacts/sprint-status.yaml` | Live epic/story status tracking |
| `_specs/implementation-artifacts/deferred-work.md` | Running ledger of code-review-deferred items across all stories |
| `_specs/implementation-artifacts/epic-3-dependency-analysis.md` | Cross-story dependency analysis for Epic 3's 11 stories |
| `_specs/implementation-artifacts/epic-4-retro-2026-08-14.md` | Epic 4 retrospective |
| `_specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md` | Frontend architecture spine |
| `_specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md` | Backend architecture spine |

---

## 2. Epic-by-Epic Breakdown

**Note on story count:** the working folder currently contains **37** numbered story files
(1-1 through 4-7), across all 4 epics — all recorded as `done` in `sprint-status.yaml`.

### Epic 1 — AI Backbone & Admin Control

**Goal:** Stand up the pluggable, provider-agnostic AI Service Layer (`IAiGateway`) and the admin
surfaces that govern it — task-level provider/model/fallback config, budget enforcement,
usage/cost visibility, and tag governance — so every later epic calls AI capability through one
stable interface instead of a vendor SDK. Foundational plumbing; no tutor/student-facing value
yet (that starts in Epic 2). Execution order: Phase A mock-data UI stories first (review
checkpoint), then Phase B backend/live-wire stories.

**FRs:** FR1-FR5, FR26-FR29. **Source:** `epics.md`.

| Story | Title | Scope (one line) | Status |
|---|---|---|---|
| 1.1 | Admin AI Configuration UI (Mock Data) | AI Task provider/model/fallback/budget table UI, mock-backed | done |
| 1.2 | Admin AI Usage & Cost Dashboard (Mock Data) | Usage/cost by task and date range, mock-backed | done |
| 1.3 | Admin Tag Management UI (Mock Data) | Tag add/rename/deactivate/search CRUD, mock-backed | done |
| 1.4 | AI Service Layer Interface & Gateway Client | `IAiGateway` interface + HTTP client targeting self-hosted Portkey OSS gateway | done |
| 1.5 | AI Task Configuration Store & Live-Wire Config UI | Real `AiTaskConfig`/`AiPromptVersion` store; live-wires Story 1.1 | done |
| 1.6 | Per-Task Fallback & Retry | Polly-based fallback policy wrapping `IAiGateway` calls | done |
| 1.7 | Usage & Cost Tracking & Live-Wire Usage Dashboard | Real token/cost recording; live-wires Story 1.2 | done |
| 1.8 | Budget Threshold Enforcement | Pre-flight atomic budget reserve, blocks over-threshold requests | done |
| 1.9 | Tag Management Backend & Live-Wire Tag UI | Real Tag backend; live-wires Story 1.3 | done |

### Epic 2 — Course Authoring: Metadata, Upload, AI Extraction & Editing

**Goal:** Give a tutor the full authoring path from a blank course to a fully-structured,
tutor-confirmed content tree: metadata wizard, file upload with malware scanning and
parsing/OCR, AI-driven structure extraction, and the Course Content Editor. Execution order:
Phase A mock-data UI first, then Phase B backend/live-wire.

**FRs:** FR6-FR16. **Source:** `epics.md`.

| Story | Title | Scope (one line) | Status |
|---|---|---|---|
| 2.1 | Course Metadata Wizard UI (Mock Data) | 4-step Title/Tags/Taxonomy/Thumbnails wizard, mock-backed | done |
| 2.2 | File Upload UI (Mock Data) | Multi-file upload with independent per-file progress/status, mock-backed | done |
| 2.3 | Course Content Editor UI (Mock Data) | Chapter/Topic/Subtopic/Content-Block tree editor, mock-backed | done |
| 2.4 | Course Metadata Persistence & Live-Wire Wizard | Real Draft persistence; removes old 4-step wizard | done |
| 2.5 | Tag & Taxonomy Live Data Wiring | Live Tag + cascading taxonomy data in the wizard | done |
| 2.6 | File Upload, Malware Scanning & Secure Storage | ClamAV-backed scan-before-accept + secure storage | done |
| 2.7 | Document Parsing/OCR Pipeline | Self-hosted Docling parsing pass ahead of extraction | done |
| 2.8 | AI Structure Extraction (`extractStructure`) | Chapter→Topic→Subtopic→Content structure proposal per file | done |
| 2.9 | Content Tree CRUD Backend & Live-Wire Editor | Real Chapter/Topic/Subtopic/ContentBlock CRUD + confirmation state machine | done |
| 2.10 | Subject-Aware Alt-Text & Language Tagging | AI-generated notation alt-text + `lang="hi"` tagging | done |

### Epic 3 — Adaptive Learning Experience & Publish Lifecycle

**Goal:** Deliver student-facing adaptive mechanisms — 5-level Drill-Down, 5 Ways, optional
exercises, click-any-keyword definitions — pre-generated/cached via an async publish batch, plus
the full Draft → In Review → Review Confirmed → Published lifecycle including Review-as-Student
and versioning. Bundled as one epic (not split) because Review-as-Student and Publish are
mutually dependent. Largest epic (11 stories). Recommended/actual implementation order: 3.1→3.11,
numeric, no reordering needed (see `epic-3-dependency-analysis.md`).

**FRs:** FR17-FR25. **Source:** `epics.md`.

| Story | Title | Scope (one line) | Status |
|---|---|---|---|
| 3.1 | Student Course Player Shell UI (Mock Data) | Drill-Down Level 1+ reveal UI; `DrilldownPanel` brand-token color sweep | done |
| 3.2 | Ways Menu & Keyword Popover UI (Mock Data) | 5-Ways cycling + click-keyword definition popover, mock-backed | done |
| 3.3 | Exercise Runner UI (Mock Data) | Inline practice exercise runner, mock-backed | done |
| 3.4 | Publishing Lifecycle UI (Mock Data) | Review-as-Student, publish checklist, lifecycle stage indicator, mock-backed | done |
| 3.5 | Drill-Down & Ways AI Task Implementation | Real `explainTopic`/`rewriteExplanation` + tutor-override storage | done |
| 3.6 | Exercise Generation & Grading Backend | AI-proposed/self-authored exercises + grading | done |
| 3.7 | Keyword Definition Backend (`defineKeyword`) | Real subject/language-aware keyword definitions | done |
| 3.8 | Publish Batch Job & Pre-Generation Caching | Hangfire-driven batch pre-generation/caching + atomic completion | done |
| 3.9 | Review as Student & Lifecycle Transitions | Real lifecycle transitions; Review-as-Student wired to real player | done |
| 3.10 | Publish, Versioning & Rollback | Deep-copy version snapshot on publish; Published→Draft rollback | done |
| 3.11 | Cross-View Golden-File Visual Regression Parity | Vitest `toMatchScreenshot()` parity tests, editor vs. student view | done |

### Epic 4 — Centralized Error Observability & Management

**Goal:** Admins can see every error the system produces — backend and frontend — in one durable,
auto-categorized, auto-prioritized Admin Error Log; triage it (archive/resolve/escalate); and
trace a single failure across its full request/job chain via Correlation ID. Separately-scoped
PRD, folded into project numbering as Epic 4. Backend-first execution order (unlike Epics 1-2):
Correlation ID infrastructure + centralized capture service built and proven first; the anonymous
reporting endpoint and Master-gated admin UI shipped back-to-back with no released gap between
them.

**FRs:** FR-1 through FR-24. **Source:** `epics-ErrorObservability.md`.

| Story | Title | Scope (one line) | Status |
|---|---|---|---|
| 4.1 | Correlation ID Assignment and Propagation | Per-request Correlation ID + propagation into 4 Hangfire job enqueuers | done |
| 4.2 | ErrorRecord Data Model and Centralized Capture Service | `ErrorRecord` entity + `IErrorCaptureService` (fingerprint/categorize/prioritize) | done |
| 4.3 | Backend Error Capture Wiring | Wires global exception middleware + 4 jobs' terminal failures into capture | done |
| 4.4 | Frontend Global Error Capture and Reporting Endpoint | Error Boundary + window listeners + anonymous `POST /api/v1/errors/client` | done |
| 4.5 | Admin Error Log — List, Filter, and Detail | Server-side-paginated, filterable Master-only error list + detail view | done |
| 4.6 | Error Lifecycle Actions | Archive / Resolve / Increase Priority / auto-Reopen / retention purge | done |
| 4.7 | Correlation ID Trace View | Click a Correlation ID to see every ErrorRecord sharing it | done |

---

## 3. Current Sprint Status Snapshot

Source: `_specs/implementation-artifacts/sprint-status.yaml` (generated 2026-08-11, last updated
2026-08-14).

- **All 4 epics are `done`**: Epic 1 (9/9 stories), Epic 2 (10/10 stories), Epic 3 (11/11
  stories), Epic 4 (7/7 stories) — 37/37 stories recorded `done`.
- Epic 1-3 retrospectives are marked **optional** and have not been run. Epic 4's retrospective
  is **done** (2026-08-14).
- **4 open action items**, all from the Epic 4 retrospective, all owned by Dev (one jointly
  Dev/PM), all status `open`:
  1. Commit Epic 4's work to git — currently 7 stories of uncommitted changes sitting on one
     shared baseline.
  2. For future multi-story epics, commit each story to git on reaching `done` rather than
     batching, so each subsequent code review is a plain `git diff`.
  3. When a story extends a prior story's files, grep actual current file paths/type names into
     the story text rather than writing from memory (recurring stale-reference corrections were
     seen 4 times across Epic 4).
  4. Continue using the Acceptance Auditor review layer on every future story — it has twice
     caught a "verified" completion claim that didn't hold in the code.
- **Headline:** all planned work across 4 epics is code-complete and reviewed, but Epic 4 is not
  yet committed to git — per the retro, that is "the one open item before Epic 4 can be
  considered truly shipped rather than code-complete." Regression at last check: 915 backend /
  590 frontend tests, 0 failures.
- No Epic 5 exists in the planning artifacts as of this writing.

---

## 4. Known Deferred Work

Source: `_specs/implementation-artifacts/deferred-work.md` — a running ledger of items
surfaced during each story's code review and deliberately deferred (not fixed) at review time,
grouped by the story whose review produced them. Do not re-litigate these without new evidence;
each entry in the source file carries its own stated rationale.

By category, the ledger's ~60 entries break down roughly as:

- **Explicitly scoped to a later story and picked up on schedule** — e.g. Story 1.1's mock-data
  quirks resolved by Story 1.5's live-wire; Story 1.4's missing Polly resiliency resolved by
  Story 1.6; Story 2.x mock-only gaps resolved by their paired live-wire story. These are
  self-resolving by the epic's own Phase A → Phase B structure and mostly already closed.
- **Deliberate, reasoned scope cuts with no AC requiring the fix** — e.g. no distinctness check
  between primary/fallback AI provider config, no optimistic concurrency (`RowVersion`) on
  several admin-write entities, non-atomic duplicate-name checks on low-write-volume admin
  tables (Tags), un-batched retention purge queries. Each carries an explicit "why this is fine
  at current scale" rationale in the source file (frequently tied to the architecture spine's
  own "single container, moderate volume" framing).
- **Pre-existing/systemic gaps not introduced by the reviewed story** — e.g. `AdminPanel.tsx`
  sub-tabs lacking dedicated render tests, admin sub-tab role-gating relying on client-side
  filtering, no `WebApplicationFactory`-based integration test infrastructure anywhere in the
  backend test suite.
- **Flagged assumptions pending explicit confirmation before/at build time:**
  - `[ASSUMPTION]` — exact .NET ClamAV client library not chosen (Story 2.6 / backend AD-22).
  - `[ASSUMPTION]` — Correlation ID mints its own GUID rather than reusing
    `HttpContext.TraceIdentifier` (Story 4.1 / backend AD-23).
  - Whether docling-serve's `"FAIR"` confidence grade (not just `"POOR"`) should also fail the
    parse confidence gate (Story 2.7) — needs product confirmation against a real docling-serve
    instance.
  - The free-text secret-pattern redaction list's coverage (e.g. hyphenated `sk-...`/`sk-ant-...`
    key formats) and the Phase B spike-threshold escalation formula's exact value — both tied to
    open questions in the Error Observability PRD pending real data/product confirmation
    (Story 4.2).
- **A small number of confirmed-resolved items**, tracked for visibility only (e.g. Story 4.5's
  re-check confirming Story 4.4's flagged unsanitized-rendering risk never materialized, because
  React's default JSX escaping covers it).

For the full text and per-item rationale, read `_specs/implementation-artifacts/deferred-work.md`
directly — it is intentionally not reproduced here.

---

## 5. Architecture References

Every story above is built against two ratified architecture spines. Stories must respect their
invariants (AD-numbered rules); do not introduce a new pattern where one of these already governs
the concern.

- **Frontend:** `_specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md`
  — feature-folder architecture with a `services/` repository boundary (AD-1), thin `App.tsx`
  composition root (AD-2), one-directional dependency contract `features → ui/hooks/services/lib`
  (AD-3), Context-backed cross-cutting state (`DomainContext`, `CourseContentContext`) (AD-4),
  Vitest + Testing Library conventions (AD-5), golden-file visual-regression via Vitest browser
  mode (AD-6), and single shared Correlation ID capture in `services/httpClient.ts` (AD-7).
- **Backend:** `_specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md`
  — Clean Architecture / Onion layering (AD-1), composition-root-only DI (AD-2), no
  mediator/CQRS library (AD-3), Repository+UnitOfWork behind Application interfaces (AD-4),
  feature-folder organization (AD-6), self-hosted `IAiGateway` via Portkey OSS (AD-14), Hangfire
  async batch jobs (AD-15/AD-16), deep-copy version snapshots (AD-17), pre-flight atomic budget
  reserve (AD-18), DB-backed AI task config (AD-19), explicit 4-entity content tree (AD-20),
  self-hosted Docling parsing (AD-21) and ClamAV scanning (AD-22), and the Correlation
  ID/error-capture pair (AD-23/AD-24).

---

## 6. How to Add a New Story

- **Numbering scheme:** `{epic}-{story}`, e.g. `4-8` for the 8th story of Epic 4. Epic numbers are
  sequential project-wide (1-4 today) even though Epic 4 originated from a separate PRD file
  (`epics-ErrorObservability.md`) — a new PRD's epic gets the next unused project-wide epic
  number, not its own local numbering.
- **Where files live:** the detailed story file goes in
  `_specs/implementation-artifacts/{epic}-{story}-{kebab-case-title}.md` (e.g.
  `4-8-example-story-name.md`), matching the existing 37 files' naming convention exactly.
- **What `sprint-status.yaml` expects:** add a new entry under `development_status` keyed
  `{epic}-{story}-{kebab-case-title}` (matching the file's basename without extension) with an
  initial status of `backlog` or `ready-for-dev` per the status definitions documented at the top
  of that file; if this is the epic's first story, also add/confirm the `epic-{n}` key transitions
  to `in-progress`. Update `last_updated` at the top of the file.
- **Also update this document:** add the new story's row to the relevant epic table in Section 2
  above (number, title, one-line scope, status), so this index doesn't drift from the real
  backlog. If the story is a genuinely new epic, add a new Section-2 subsection following the same
  shape (Goal / FRs / Source / story table) and add a corresponding section to
  `design-artifacts/E-Development/acceptance-criteria.md`.
