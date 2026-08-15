---
title: Feature Impact Analysis — FlexDemy eLearning (Reconstructed)
status: inferred / reconstructed
created: 2026-08-15
---

# Feature Impact Analysis

> Reconstructed 2026-08-15, alongside `trigger-map.md` and `personas/`. Scores major features from the four PRDs against the driving-force vocabulary defined in `trigger-map.md` and the personas in `personas/`. A feature may serve more than one force; the **Primary** column marks the strongest-evidenced one, **Secondary** marks a real but weaker one. All scoring is this reconstruction's judgment call, not a validated workshop score — see each PRD citation for the underlying text.

## Legend

**Forces:** Reduced Anxiety (RA) · Mastery (M) · Autonomy (AU) · Efficiency/Reduced Toil (EF) · Trust/Fairness (TF) · Status/Recognition (SR) · Control/Oversight (CO) · Belonging (BE)

**Personas:** Student (S) · Tutor (T) · Admin (A)

## Dashboard PRD (`prd-eLearning-2026-08-10`)

| Feature (FR) | Persona(s) | Primary Force | Secondary Force | Source |
|---|---|---|---|---|
| Single Dashboard nav entry, role-driven content (FR-1, FR-2) | S, T | EF | RA | §4.1, §1 Vision |
| Master/Support tutor-view preview toggle (FR-3) | A | CO | RA | §4.1 FR-3 |
| Welcome banner & resume CTA (FR-4) | S | RA | EF | §4.2 FR-4 |
| Progress stat cards & activity calendar (FR-5) | S | SR | M | §4.2 FR-5; EXPERIENCE.md Voice and Tone |
| Weekly Goal Card (FR-6) | S | AU | SR | §4.2 FR-6 |
| Adaptive Schedule (FR-7) | S | AU | EF | §4.2 FR-7 |
| My Courses list (FR-8) | S | M | EF | §4.2 FR-8 |
| Browse & filter tutor slots (FR-9) | S | RA | EF | §2.1 JTBD |
| Book a tutor slot (FR-10) | S | RA | TF | §2.1 JTBD; FR-10 Consequences |
| My Booked Sessions (FR-11) | S | RA | — | §4.3 FR-11 |
| Group Study Pool requests (FR-12) | S | BE | — | §2.1 JTBD |
| Public Live Masterclass browsing (FR-13) | S | BE | SR | §2.1 JTBD |
| Study Rooms quick-join (FR-14) | S | BE | — | §4.3 FR-14 |
| Online/Offline toggle (FR-15) | T | AU | CO | §4.4 FR-15 |
| Performance analytics (FR-16) | T | SR | CO | §4.4 FR-16 |
| Slot calendar management (FR-17) | T | EF | AU | §4.4 FR-17 |
| Course Creation Wizard, superseded (FR-18) | T | EF | M | §4.5 FR-18 *(superseded by CourseWizard PRD)* |
| Public-class broadcast roster (FR-19) | T | CO | SR | §4.5 FR-19 |

## Assignments PRD (`prd-eLearning-Assignments-2026-08-10`)

| Feature (FR) | Persona(s) | Primary Force | Secondary Force | Source |
|---|---|---|---|---|
| Retire standalone Assignments tab; left-side section nav (FR-1–FR-3) | S, T | EF | — | §4.1 |
| My Submissions (default view) (FR-4) | S | RA | TF | §4.2 FR-4; §1 Vision |
| Available Assignments unified list w/ Source badge (FR-5) | S | RA | TF | §2.1 JTBD; §4.2 FR-5 |
| Taking an assignment (FR-6) | S | M | RA | §4.2 FR-6 |
| Immediate-visibility submission (FR-7) | S | SR | M | §4.3 FR-7 |
| Hold-visibility submission (FR-8) | S | TF | RA | §4.3 FR-8 |
| My Assignments list (FR-9) | T | EF | CO | §4.4 FR-9 |
| Assignment creation form (FR-10) | T | AU | — | §2.1 JTBD |
| Scoring & visibility choice (FR-11) | T | CO | TF | §2.1 JTBD |
| Draft vs. Publish (FR-12) | T | CO | AU | §4.4 FR-12 |
| Submissions view per assignment (FR-13) | T | CO | EF | §4.5 FR-13 |
| Review action, Hold submissions (FR-14) | T | TF | CO | §2.1 JTBD; §4.5 FR-14 |
| Re-evaluate action (FR-15) | T | TF | CO | §4.5 FR-15 |
| CoursePlayer "Take Quiz" rewiring + deep-link fix (FR-16) | S | RA | EF | §4.7 FR-16 |

## CourseWizard PRD (`prd-eLearning-CourseWizard-2026-08-10`)

| Feature (FR) | Persona(s) | Primary Force | Secondary Force | Source |
|---|---|---|---|---|
| Provider-agnostic AI gateway (FR-1) | A | CO | RA | §2.1 JTBD; §4.1 FR-1 |
| Config-only provider/model swap (FR-2) | A | CO | EF | §2.1 JTBD (UJ-3) |
| Per-task model + cross-provider fallback (FR-3) | A | RA | CO | §4.1 FR-3 |
| Token usage/cost tracking (FR-4) | A | CO | EF | §4.1 FR-4 |
| Centralized versioned prompt/model config (FR-5) | A | CO | EF | §4.1 FR-5 |
| Course metadata wizard steps: Title/Tags/Taxonomy/Thumbnails (FR-6–FR-9) | T | EF | AU | §4.2 |
| Step progression & draft auto-persistence (FR-10) | T | RA | EF | §4.2 FR-10 |
| Multi-file upload with per-file progress (FR-11) | T | RA | EF | §4.3 FR-11 |
| Parsing/OCR pre-step (FR-12) | T | RA | M | §4.3 FR-12 |
| AI-driven structure extraction, per-file status (FR-13) | T | EF | M | §1 Vision; §4.3 FR-13 |
| Add/modify/delete/reorder any node (FR-14) | T | AU | CO | §2.1 JTBD |
| Explicit per-node confirmation (FR-15) | T | CO | RA | §4.4 FR-15 |
| WYSIWYG parity across subjects/scripts (FR-16) | T, S | TF | M | §4.5 FR-16 |
| Five-Level Drill-Down (FR-17) | S | M | AU | §2.1 JTBD |
| Five Alternative Explanations / "Ways" (FR-18) | S | M | AU | §2.1 JTBD |
| Optional Exercises (FR-19) | S | M | RA | §2.1 JTBD |
| Click-Any-Keyword Explanation (FR-20) | S | RA | M | §2.1 JTBD |
| Pre-generate and cache at publish (FR-21) | S | RA | — | §4.10 FR-21 *(latency/reliability, indirectly serves Student RA)* |
| Save as Draft at any point (FR-22) | T | RA | AU | §4.11 FR-22 |
| Review as Student mode (FR-23) | T | RA | CO | §2.1 JTBD |
| Confirm Review gates Publish (FR-24) | T | CO | TF | §4.11 FR-24 |
| Post-publish editing with versioning (FR-25) | T | RA | CO | §4.11 FR-25 |
| Tag CRUD, deactivation, duplicate prevention (FR-26) | A | CO | TF | §2.1 JTBD |
| Per-task provider/model + fallback config (FR-27) | A | CO | — | §2.1 JTBD (UJ-3) |
| Usage/cost visibility per task (FR-28) | A | CO | EF | §4.13 FR-28 |
| Budget threshold enforcement (FR-29) | A | CO | EF | §4.13 FR-29 |
| Content Editor in page body, not viewport takeover (FR-30) | T | RA | AU | §4.11 FR-30 |
| Resume a previously saved Draft course (FR-31) | T | RA | EF | §4.11 FR-31 |
| Delete non-Published / Take Offline for Published (FR-32) | T | CO | AU | §4.11 FR-32 |

## Centralized Error Observability PRD (`prd-eLearning-ErrorObservability-2026-08-13`)

| Feature (FR) | Persona(s) | Primary Force | Secondary Force | Source |
|---|---|---|---|---|
| Global unhandled-exception capture (FR-1) | A | CO | RA | §1 Vision; §4.1 FR-1 |
| `AppException` subtype capture (FR-2) | A | CO | TF | §4.1 FR-2 |
| Background job terminal-failure capture (FR-3) | A | RA | CO | §4.1 FR-3 |
| Per-entity failure mirroring (FR-4) | A | TF | CO | §4.1 FR-4 |
| Secret/PII redaction guardrail (FR-5) | A | TF | — | §4.1 FR-5 |
| Global frontend runtime error capture (FR-6) | A | CO | RA | §4.2 FR-6; §1 Vision |
| Error reporting endpoint (FR-7) | A | CO | — | §4.2 FR-7 |
| ErrorRecord schema, fingerprinting, occurrence counting (FR-8) | A | EF | CO | §4.3 FR-8 |
| Rule-based auto-categorization (FR-9) | A | EF | TF | §2.1 JTBD |
| Auto-priority assignment, two-phase (FR-10) | A | EF | RA | §2.1 JTBD |
| Error list view, server-side paginated (FR-11) | A | EF | CO | §4.6 FR-11 |
| Filtering and search (FR-12) | A | EF | CO | §4.6 FR-12 |
| Error detail view (FR-13) | A | CO | M | §4.6 FR-13 |
| Archive (FR-14) | A | RA | CO | §2.1 JTBD |
| Mark as Resolved (FR-15) | A | RA | TF | §2.1 JTBD |
| Auto-Reopen on regression (FR-16) | A | RA | TF | §2.1 JTBD |
| Increase Priority (FR-17) | A | CO | TF | §4.7 FR-17 |
| Retention policy / purge (FR-18) | A | CO | EF | §4.7 FR-18 |
| Master-only access (FR-19) | A | TF | CO | §4.8 FR-19 |
| Correlation ID assignment, propagation, capture, trace view (FR-20–FR-24) | A | CO | EF | §4.9 |

## Force distribution — what this suggests (read cautiously)

**[inferred, directional only — not a statistically meaningful sample.]** Counting each feature's Primary force across all four PRDs: **Control/Oversight** and **Reduced Anxiety** dominate — consistent with three of the four PRDs (Dashboard's admin toggle, CourseWizard's AI-governance surfaces, and the entire ErrorObs PRD) being fundamentally about giving an Admin or Tutor confidence and control over a system that previously ran opaque or unchecked. **Mastery** and **Autonomy** concentrate almost entirely in CourseWizard's Student-facing adaptive-learning features (FR-17–FR-20). **Belonging** appears only in Dashboard's group-learning features (FR-12–FR-14) and nowhere else — a real gap if peer-learning engagement turns out to matter more than currently evidenced. **Status/Recognition** is thin and concentrated in gamification elements (points, streaks, confetti) — worth probing directly in a live Trigger Mapping session, since it is the force with the least direct JTBD-level evidence in the source PRDs.
