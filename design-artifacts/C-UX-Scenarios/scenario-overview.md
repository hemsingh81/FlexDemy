---
title: FlexDemy eLearning — UX Scenario Overview
status: backfilled-synthesis
backfilled: 2026-08-15
source-of-truth:
  - ../../_specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/DESIGN.md
  - ../../_specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/EXPERIENCE.md
---

# FlexDemy — UX Scenario Overview (WDS C-UX-Scenarios)

**This file is a backfilled synthesis, written 2026-08-15.** The `design-artifacts/C-UX-Scenarios`
folder was scaffolded by the WDS install but never populated. This overview was produced after the
fact by reading the existing, already-final UX design work at
[`_specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/`](../../_specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/)
(`DESIGN.md` — visual system — and `EXPERIENCE.md` — behavioral/experience spine, itself sourced from
four PRDs) and restating its journeys in WDS's persona + goal + outcome + driving-force shape.

**`DESIGN.md` and `EXPERIENCE.md` remain the authoritative, detailed source.** This file does not
duplicate their page-by-page specs, component behavior, state tables, or accessibility rules — it is
an index that orients a reader to which scenarios exist, then points at the fuller spec section and
any rendered mockup. Where EXPERIENCE.md numbers a journey (`UJ-#`) against a named source PRD, that
numbering is preserved here for traceability.

No `imports/` subfolder exists alongside `mockups/` in the source UX directory (only `mockups/` does,
with 3 files) — noted here since the task brief expected one; there was nothing to inventory there.

---

## How to read this index

Each scenario lists:
- **Persona** — who, per EXPERIENCE.md's Foundation (Student / Tutor / Master·Support Admin) and the named PRD persona.
- **Goal** — what the persona is trying to accomplish.
- **Driving force** — the underlying motivation/context that sets the scenario in motion (drawn from each journey's opening context and "Climax" beat in EXPERIENCE.md's Key Flows).
- **Expected outcome** — the state the persona and the system land in.
- **Step summary** — compressed, not a copy of the full numbered journey.
- **Full spec** — pointer into `EXPERIENCE.md` (Key Flows heading) and relevant `DESIGN.md` component entries.
- **Mockups** — rendered HTML references, where they exist.

---

## Group 1 — Student Learning & Course Consumption

### 1.1 Priya keeps learning and books help without leaving Dashboard
*(Dashboard PRD · UJ-1)*

- **Persona:** Student (Priya), mid-way through several enrolled courses.
- **Goal:** Resume coursework, get unstuck via a tutor or study group, all in one sitting.
- **Driving force:** A weekday-evening study session where momentum and low friction matter more than exploring the full catalog — she already knows what she needs.
- **Expected outcome:** She has resumed a course *and* booked 1-on-1 tutor help *and* joined a study group without leaving the Dashboard tab; a confirmation toast and a "My Booked Sessions" entry confirm the booking.
- **Step summary:** Opens Dashboard → checks streak/stat cards/Weekly Goal/Adaptive Schedule → resumes a course from My Courses → browses/filters/books a tutor slot via the confirm modal → requests a Group Study Pool slot and registers for a Public Live Masterclass.
- **Edge case noted in source:** no booked sessions yet → empty state, not an error.
- **Full spec:** `EXPERIENCE.md` → "Key Flows → Dashboard PRD · UJ-1"; component behavior in "Component Patterns" (Course card, Booking slot table/grid, Public Live Masterclass card).
- **Mockups:** none rendered for Dashboard (spine authored against the live built product — see EXPERIENCE.md's "Composition reference" note).

### 1.2 Aarav doesn't get it the first way, and finds it a second way
*(New Course Wizard PRD · UJ-2)*

- **Persona:** Student (Aarav), reading a Course Player topic.
- **Goal:** Actually understand a concept the default explanation didn't land, without leaving the reading flow.
- **Driving force:** The default Level-1 Drill-Down explanation didn't click — he needs an alternate path (a different explanation style, a quick definition, or hands-on practice) without breaking his place in the text.
- **Expected outcome:** Confident understanding reached via the Adaptive Ways menu (a car-crash analogy) plus a keyword popover plus an exercise attempt with immediate feedback — entirely inside Course Player.
- **Step summary:** Reads Level 1 Drill-Down, doesn't click → notices the "Not clicking? Try a different explanation" nudge → opens Adaptive Ways, cycles to a Way that lands → taps a bolded keyword for an inline popover definition → attempts the optional exercise, gets immediate feedback.
- **Edge case noted in source:** a topic with no exercise attached shows no practice affordance at all — not a broken/disabled state.
- **Full spec:** `EXPERIENCE.md` → "Key Flows → New Course Wizard PRD · UJ-2"; component rules in "Component Patterns" (Drill-Down panel, Adaptive Ways menu, Exercise runner, Keyword definition popover) and "Accessibility Floor" (keyboard/focus rules for Ways, keyword popovers, Drill-Down).
- **Mockups:** [`mockups/key-course-player-adaptive.html`](../../_specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/mockups/key-course-player-adaptive.html).

### 1.3 Aditi checks and completes her assignments
*(Assignments PRD · UJ-1)*

- **Persona:** Student (Aditi).
- **Goal:** See what's outstanding across course/tutor/competition assignments and complete one.
- **Driving force:** A single unified place to check assignment status (rather than hunting per-course) and know whether a score is visible yet or still pending tutor review.
- **Expected outcome:** Attempt recorded in My Submissions with the correct status; score shown immediately (Immediate visibility, with confetti/points at ≥70%) or withheld pending tutor action ("Submitted — pending tutor review," Hold visibility).
- **Step summary:** Opens Dashboard → Assignments → reviews My Submissions status pills → scans unified Available Assignments list (source-badged Course/Tutor/Competition) → attempts one via the inline quiz runner → submits.
- **Edge case noted in source:** existing course/lesson quizzes always use Immediate visibility; Hold only applies to new tutor-created/competition assignments — no currently-shipped behavior regresses.
- **Full spec:** `EXPERIENCE.md` → "Key Flows → Assignments PRD · UJ-1"; "State Patterns" (Hold-visibility / Immediate-visibility submitted, Draft assignment invisibility); "Component Patterns" (Available Assignment card, Quiz runner).

---

## Group 2 — Tutor Course Authoring & Publishing

### 2.1 Meera turns a scanned chemistry chapter into a structured course
*(New Course Wizard PRD · UJ-1)*

- **Persona:** Tutor (Meera).
- **Goal:** Turn an existing scanned document into a fully structured, subject-aware course without manual chapter-by-chapter authoring.
- **Driving force:** She has source material (a scanned chapter with chemistry notation) but authoring a Chapter→Topic→Subtopic tree by hand would be prohibitively slow — she needs AI extraction to do the structural lift while she stays the reviewer/editor.
- **Expected outcome:** A confirmed Chapter→Topic→Subtopic content tree with correctly rendered chemistry notation, ready for Review as Student.
- **Step summary:** Completes Wizard Steps 1–4 (Title/Tags/Taxonomy/Thumbnails) in the side-panel → lands in Course Content Editor (Normal state) → uploads a scanned PDF, watches per-file Uploading→Parsing→Extracting status → reviews the generated tree, drags a mis-split Subtopic to the right parent, edits a garbled sentence, Confirms each node.
- **Edge case noted in source:** one file fails to parse (corrupted scan) — only that file's row shows failed/retry; the rest of the structure is untouched.
- **Full spec:** `EXPERIENCE.md` → "Key Flows → New Course Wizard PRD · UJ-1"; "Information Architecture" (Course Content Editor row); "Component Patterns" (New Course Wizard metadata, Course Content Editor — tree node, Extraction status indicator); `DESIGN.md` → Components (`course-content-editor`, `content-tree-node`, `extraction-status-badge`).
- **Mockups:** [`mockups/key-course-content-editor.html`](../../_specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/mockups/key-course-content-editor.html) *(EXPERIENCE.md flags this as rendered before the card-shell/Maximize-Restore toggle existed — visually stale)*.

### 2.2 Meera reviews her own course exactly as a student would before publishing
*(New Course Wizard PRD · UJ-4)*

- **Persona:** Tutor (Meera), continuing from 2.1 with every node confirmed.
- **Goal:** Verify the course behaves correctly for a learner before committing to Publish.
- **Driving force:** Publishing is a one-way, learner-facing action — she wants to catch a broken adaptive affordance (Drill-Down, Ways, exercise, keyword) herself rather than have a student find it first.
- **Expected outcome:** Publish becomes available for the first time in the course's lifecycle; the course enters the async Publishing state before going live.
- **Step summary:** Opens Review as Student from Course Content Editor → experiences the course as a student would (Drill-Down level, a Way, the practice exercise, a keyword) → taps Confirm Review → Publish unlocks.
- **Edge case noted in source:** finding a problem sends her back to Course Content Editor to fix it; any structural or AI-content-affecting edit reverts that node's confirmation, requiring re-confirm before Review as Student re-opens.
- **Full spec:** `EXPERIENCE.md` → "Key Flows → New Course Wizard PRD · UJ-4"; "State Patterns" (Publishing (async batch), Node pending confirmation).
- **Mockups:** [`mockups/key-publishing-state.html`](../../_specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/mockups/key-publishing-state.html).

### 2.3 Raj runs his teaching day from Dashboard
*(Dashboard PRD · UJ-2)*

- **Persona:** Tutor (Raj), approved.
- **Goal:** Get a full picture of his teaching business and publish new content, from one page.
- **Driving force:** Start-of-day operational check-in — availability, bookings, earnings, and pipeline all need a glance before he starts teaching.
- **Expected outcome:** Flips Online, new open slots are live/bookable immediately, and a newly published course appears wherever published courses are listed.
- **Step summary:** Opens Dashboard (Tutor view) → toggles Online → reviews earnings/hours/engagement stats → reviews slot calendar, adds open slots for the week → opens course publishing, publishes a course → checks the public-class broadcast roster.
- **Edge case noted in source:** Offline → his slots stay visible to him but aren't offered to students browsing.
- **Note carried from EXPERIENCE.md:** the journey text's "Course Creation Wizard" step refers to the superseded flat 4-step wizard; the current flow is the metadata side-panel (Steps 1–4) handing off to Course Content Editor — see 2.1 above for the current version of that sub-flow.
- **Full spec:** `EXPERIENCE.md` → "Key Flows → Dashboard PRD · UJ-2"; "Component Patterns" (My Courses (Tutor), Booking slot table/grid).

### 2.4 Raj creates an assignment and grades submissions
*(Assignments PRD · UJ-2)*

- **Persona:** Tutor (Raj).
- **Goal:** Create a gradeable assignment (course-linked, or open/competition) and manage its scoring lifecycle.
- **Driving force:** Needs control over when a score becomes visible to students (Immediate vs. Hold) and the ability to correct a score after the fact without re-opening the whole submission flow.
- **Expected outcome:** Published assignment and its submission states match exactly what students see in scenario 1.3; Hold submissions get reviewed-and-revealed on his schedule, and any submission can later be re-evaluated.
- **Step summary:** Opens Assignments (Tutor) → My Assignments (Draft/Published) → Create Assignment → fills title/description, links a course or flags Open/Competition, adds MC questions + answer key, chooses Visibility Mode → Saves as Draft or Publishes → opens Submissions view, reviews auto-computed scores → for Hold submissions, reviews and publishes the result; for any reviewed submission, can re-evaluate.
- **Edge case noted in source:** a Draft assignment has zero submissions by definition and is invisible to students until Published.
- **Full spec:** `EXPERIENCE.md` → "Key Flows → Assignments PRD · UJ-2"; "Component Patterns" (Assignment creation modal, Submissions review modal); "State Patterns" (Points/confetti on Hold-then-Reviewed reveal, Points delta on Re-evaluate).

---

## Group 3 — Admin / Platform Configuration

### 3.1 Rohan swaps the production AI model for one task without touching code
*(New Course Wizard PRD · UJ-3)*

- **Persona:** Master/Admin (Rohan).
- **Goal:** Change which AI provider/model handles a specific generation task (e.g. Drill-Down explanations) and see the effect immediately, with cost visibility.
- **Driving force:** Direct operational control over spend and model routing per AI task, without a deploy or code change — and confidence that a bad model swap is both reversible and observable in usage data.
- **Expected outcome:** The next generation for that task uses the new model; the Usage/cost view reflects the new model's per-task spend going forward, independent of every other task's row.
- **Step summary:** Opens Admin → AI Configuration & Usage → finds the `explainTopic` row → changes model, saves → next Drill-Down generation on any course uses it → Usage view updates.
- **Edge case noted in source:** if the newly configured model/provider is unreachable, standard fallback behavior applies and the fallback event is flagged in the same Usage view — not silently absorbed.
- **Full spec:** `EXPERIENCE.md` → "Key Flows → New Course Wizard PRD · UJ-3"; "Component Patterns" (AI Configuration table — 7 AI Tasks including `describeNotation`); "State Patterns" (Node generation degraded (fallback-served), Budget threshold approaching/exceeded).

---

## Surfaces referenced in EXPERIENCE.md without a full narrated journey

These appear in EXPERIENCE.md's Information Architecture, Component Patterns, or State Patterns tables
with a defined purpose and behavior, but — unlike Groups 1–3 above — the source docs don't carry a
numbered UJ narrative for them. Listed here for completeness/traceability, not expanded into full
scenarios, since a step-by-step journey isn't evidenced in the source.

- **Course Overview** (Student) — full detail on one course: syllabus, progress, notes, reviews; sticky scroll-jump sub-nav. See `EXPERIENCE.md` → Information Architecture row; State Patterns ("Empty — no notes yet / no reviews yet").
- **Group Study** (Student) — synchronous peer study rooms (live shared reader, whiteboard, chat), distinct from Dashboard's async Group Study Pool matchmaking. See `EXPERIENCE.md` → Information Architecture row; State Patterns (Empty room, Connection loss/reconnect, Permission-denied).
- **Certificates** (Student) — earned certificates + leaderboard. See `EXPERIENCE.md` → Information Architecture row; State Patterns ("Empty — no certificates yet").
- **Admin — Tag Management** — CRUD on the tag vocabulary used by course tagging and the New Course Wizard's Tags step; available to Support as well as Master. See `EXPERIENCE.md` → Information Architecture row; Component Patterns (Tag Management table).
- **Auth / Profile funnel** (prospective/pending users) — Login/Sign Up/Forgot Password, and blocking Pending-Approval / Rejected screens ahead of the main shell. See `EXPERIENCE.md` → Information Architecture row; State Patterns (Pending Approval, Rejected).
- **Master/Support Tutor Dashboard preview** — an admin-only toggle previewing the Tutor Dashboard layout with all data forced empty (never another tutor's real data). See `EXPERIENCE.md` → State Patterns row.

---

## Gaps

- **Centralized Error Observability & Management** (`_specs/planning-artifacts/prds/prd-eLearning-ErrorObservability-2026-08-13/prd.md`) defines its own UJ-1 — a Master admin triaging a spike in failures via a filterable Admin error log, correlation-ID tracing, categorization/priority, and lifecycle actions (Archive/Resolve/Reopen/Escalate). **This PRD is not among EXPERIENCE.md's `sources` and has no corresponding entry in DESIGN.md or EXPERIENCE.md** — no IA row, no component spec, no mockup. It is the one PRD area with product code already shipped (see recent commit "Fix error logs page") but no UX design-doc coverage, and is not represented as a scenario above because nothing in the UX source docs evidences it. Recommend either folding it into `EXPERIENCE.md`'s sources on its next revision or scoping a dedicated UX pass for it.
- No `imports/` folder exists in the source UX directory to inventory (only `mockups/`, 3 files, all covering New Course Wizard PRD surfaces — Dashboard and Assignments PRD surfaces have no rendered mockups, per EXPERIENCE.md's own "Composition reference" note that those were authored directly against the live built product).
