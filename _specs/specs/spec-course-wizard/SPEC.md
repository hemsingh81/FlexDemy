---
id: SPEC-course-wizard
companions:
  - ../../planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md
  - ../../planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/addendum.md
  - ../../planning-artifacts/ux-designs/ux-eLearning-2026-08-10/EXPERIENCE.md
  - ../../planning-artifacts/ux-designs/ux-eLearning-2026-08-10/DESIGN.md
  - ../../planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md
  - ../../planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. The companions carry FR-level, AD-level, and component-level detail this kernel intentionally omits — consult them for exactly that, not just narrative color.

# New Course Wizard — AI-Assisted Course Creation & Adaptive Learning Module

## Why

A vision to realize, for two users at once. Today a FlexDemy tutor authors a course by hand — typing lessons into a flat list with no help structuring material and no way to teach an idea at more than one depth or in more than one style — and a student gets whatever single explanation the tutor happened to write, with nothing else to try if it doesn't land. This module lets a tutor turn raw material (a chapter, slides, notes) into a structured, AI-drafted course they edit and confirm rather than author from a blank page, and gives a student the ability to understand any topic the simplest way first, going deeper or trying a different explanation entirely on their own terms. The architectural bet underneath both: the AI powering this is a replaceable engine, not a foundation poured in concrete — swappable via configuration from day one, so cheap/free models in development become the best-fit model at launch with no rewrite.

## Capabilities

- **CAP-1 — Pluggable AI backbone**
  - **intent:** Every AI-driven feature in this module calls one internal, provider-agnostic AI service layer — never a vendor SDK directly — so the model/provider behind any task is a configuration choice, not a code dependency.
  - **success:** An admin changes an AI Task's provider, model, fallback, or budget threshold in config and it takes effect on the next request, with zero code deploy.

- **CAP-2 — Course metadata wizard**
  - **intent:** A tutor sets Course Title, Tags (admin-governed vocabulary, no free text), cascading Taxonomy (Country→State→City→Board→Class→Subject, admin-governed, board-dependent requirements), and up to 3 cropped Thumbnails before content authoring begins.
  - **success:** The wizard cannot advance past a step with a required field unset; state auto-persists as Draft after every step.

- **CAP-3 — AI-assisted content structuring from uploads**
  - **intent:** A tutor uploads source files (PDF/Word/TXT/Excel); the system parses (including OCR for scans) and proposes a Chapter→Topic→Subtopic→Content structure the tutor can add, edit, delete, reorder, and confirm before it counts as ready.
  - **success:** A per-file failure never blocks other files' extraction; the course cannot enter Review as Student while any node remains unconfirmed.

- **CAP-4 — Subject-aware WYSIWYG parity**
  - **intent:** Math/physics notation, chemistry (formulas and reactions as notation, structural diagrams as images), biology diagrams, and English/Hindi text render identically between the tutor's editor and the student's live view.
  - **success:** Golden-file visual-regression tests catch rendering drift between editor and student view for math, chemistry, and Hindi-script content.

- **CAP-5 — Five-level drill-down**
  - **intent:** Every Topic/Subtopic exposes 5 progressive, AI-generated depth levels of the same explanation, revealed one level at a time by student choice, tutor-overridable per level.
  - **success:** A student never sees level N+1 before expanding level N; a tutor override serves in place of AI content for that level from then on.

- **CAP-6 — Five alternative explanations ("Ways")**
  - **intent:** Every Topic/Subtopic exposes 5 AI-generated alternative explanations of the same idea, each with its own worked example, freely cyclable by student choice — secondary in UI weight to drill-down, not a peer action.
  - **success:** All 5 Ways carry both an explanation and an example; cycling between them is unordered, never gated like drill-down levels.

- **CAP-7 — Optional practice exercises**
  - **intent:** A tutor optionally attaches AI-proposable or self-authored exercises per node; students get inline, subject-appropriate practice with immediate feedback.
  - **success:** A node with no attached exercise shows no practice affordance at all — not a disabled or empty state.

- **CAP-8 — Click-any-keyword definitions**
  - **intent:** Any keyword in student-facing content is clickable for an inline, subject- and language-aware AI-generated definition; a tutor-authored override, when present, takes priority and is visually indistinguishable from an AI one.
  - **success:** The same keyword clicked in two different-subject courses can surface two different, correct definitions.

- **CAP-9 — Pre-generated, cached adaptive content**
  - **intent:** Drill-down and Ways content generates as an asynchronous batch job at publish time, not on demand per student view; a node whose generation fails falls back to on-demand generation rather than ever rendering empty.
  - **success:** Opening a drill-down level or a Way as a student returns cached content with no visible AI-generation latency; a failed node's generation is never visible to the student as broken.

- **CAP-10 — Draft → Review → Publish lifecycle**
  - **intent:** A course moves through Draft → In Review → Review Confirmed → Published; the tutor must experience the full course exactly as a student would (Review as Student) and explicitly confirm before Publish becomes reachable. Post-publish edits are versioned.
  - **success:** Publish is unreachable from any state before Review Confirmed. A text-only edit to an already-confirmed node skips re-review; a structural or AI-content-affecting edit does not, and reverts the node to unconfirmed.

- **CAP-11 — Admin tag governance**
  - **intent:** Admin CRUD over a shared Tag vocabulary (add, rename, deactivate, search, dedupe) — net-new work, not an extension of the existing taxonomy master-data system.
  - **success:** A deactivated tag stays attached to courses that already had it, but cannot be newly selected.

- **CAP-12 — Admin AI configuration, usage & budget control**
  - **intent:** Admin views and sets, per AI Task, the active provider/model, fallback, and budget threshold, and sees usage/cost broken out by task and date range.
  - **success:** A request that would exceed a configured budget threshold is blocked before it's made — a pre-flight check, not post-hoc spend recording.

## Constraints

- AI provider/model swap is a configuration change only, never a code change; rules out static file-only config for AI task settings.
- No paid-tier infrastructure where a genuinely free, self-hosted alternative covers the same need — the AI gateway (self-hosted Portkey OSS, zero markup, not a managed paid-fee tier), document parsing/OCR (Docling, not paid-per-page LlamaParse), and upload malware scanning (ClamAV) were all picked or revised specifically against this bar.
- WCAG 2.1 AA floor, product-wide — rules out color-alone state signaling, drag-only interactions with no keyboard equivalent, and unannounced async state changes.
- No dependency carrying the same commercial/copyleft-licensing risk already rejected for MediatR/AutoMapper — every new library (Hangfire, Polly, Vitest browser-mode, the AI gateway, Docling, ClamAV) was chosen and verified against this bar.
- Backend: Clean Architecture (Onion), inward-only dependencies, feature-folder organization, DTO-only service boundaries, one `SaveChangesAsync` per use-case except the explicit async-batch-job carve-out. Frontend: feature-folder + repository/service data-access boundary, full-width responsive layout, existing brand tokens (navy/amber/parchment, Fraunces + Outfit).
- Dev-phase AI usage on real-ish student content is restricted to providers that don't train on input by default — rules out a free tier whose default terms train on input for anything beyond synthetic test content.

## Non-goals

- Auto-generated full assessments/quizzes beyond per-topic optional exercises.
- Student enrollment, consumption-analytics, or progress-tracking dashboards.
- Monetization or pricing mechanics.
- Collaborative multi-tutor editing of the same course.
- Automatic personalization — the system never auto-selects a student's depth or style; the student always chooses.
- Bulk/API course import or non-tutor course authoring.
- Rebuilding taxonomy admin — this reuses the existing master-data system as-is.
- Extending the old 4-step Course Creation Wizard — this fully supersedes and removes it.

## Success signal

Adaptive-mode engagement and self-reported comprehension rise per topic; AI-extracted structure is confirmed with no or only minor tutor edits; Draft-to-Published conversion is healthy; cost per generated topic stays within its configured budget threshold across both the dev free-tier and production phases. None of these may be gamed: extraction-acceptance is not chased by generating vaguer structures, adaptive-mode engagement is not chased by weakening Level 1 or Way 1, and cost-per-topic is not hit by degrading model quality below what comprehension requires.

## Open Questions

- Do exercises need auto-grading, or is shown-solution/immediate-feedback sufficient?
- Should keyword definitions be cached per course to cut repeat generation cost?
- Final free-tier (dev) and best-fit (launch) model per AI Task — explicitly a build-time decision, current research will be stale by then.
- What accessibility conformance beyond the adopted WCAG 2.1 AA floor, if any?
- Exact retry/backoff policy for a failed async batch-job item.
- Course-version-snapshot storage retention policy (how many versions kept, pruning strategy).
