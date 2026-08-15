---
title: Persona — Student
status: inferred / reconstructed
created: 2026-08-15
---

# Persona: Student

> Reconstructed 2026-08-15 from PRD/UX text, not from live user research. `UserRole.Student` in code. Named journey characters (Priya, Aditi, Aarav) are PRD-authored illustrative personas, not real interviewed users — treated here as representative composites, not evidence of a real population.

## Who they are

A learner enrolled in one or more courses, working through self-paced content, occasionally booking 1-on-1 tutor help, and completing assignments that may come from a course, a tutor, or a platform-wide competition. Two structurally different journeys appear in the source material: a routine "keep learning + get help" session (Priya) and a "stuck the night before a test" session (Aarav) — both point to a learner who needs the product to work under both calm and pressured conditions.

## Goals

- See progress and pick up where they left off without hunting across tabs. *(Dashboard PRD §2.1 JTBD)*
- Get tutor help without leaving the main screen. *(Dashboard PRD §2.1 JTBD)*
- Learn with peers alongside individual progress (group study, masterclasses). *(Dashboard PRD §2.1 JTBD)*
- Keep a persistent record of what's been submitted vs. still open. *(Assignments PRD §2.1 JTBD)*
- Know where an assignment came from (course/tutor/competition) to gauge its stakes. *(Assignments PRD §2.1 JTBD)*
- Get the simplest explanation first, then go deeper only as needed, on their own terms. *(CourseWizard PRD §2.1 JTBD)*
- Get a genuinely different explanation/analogy if the first one doesn't click. *(CourseWizard PRD §2.1 JTBD)*
- Get an instant definition for an unfamiliar term without losing their place. *(CourseWizard PRD §2.1 JTBD)*
- Practice to check whether understanding actually landed, in a low-stakes way. *(CourseWizard PRD §2.1 JTBD)*

## Pain points (as implied by what the product changes)

- **Fragmented navigation:** had to switch to a separate "Tutor Hub" tab to get help — a context switch positioned as a barrier to actually asking. *(Dashboard PRD §1 Vision)*
- **Assignment work that evaporates:** submitting a quiz today has no persistent record — "everything resets on reload." *(Assignments PRD §1 Vision)*
- **No visibility into stakes:** today's flat quiz picker gives no signal about who's grading an assignment or why it matters. *(Assignments PRD §1 Vision)*
- **One-size-fits-all explanation:** "a student, in turn, gets whatever single explanation the tutor happened to write — if it doesn't click, there's nothing else to try except asking a human." *(CourseWizard PRD §1 Vision)* **[inferred: this is stated as the pre-product state, i.e. the pain this feature set answers.]**
- **Being overwhelmed by density/rigor pitched at the wrong level** — implied by the explicit design decision to always default to Level 1 (simplest) first. **[inferred]**

## Psychological drivers

- **Reduced Anxiety** — persistent records (no lost work), simplest-first explanations (no overwhelm), non-certifying practice (no stakes on trying), transparent Hold-vs-Immediate grading (no ambiguity about whether/when a score is final). *(Assignments PRD §3 Glossary; CourseWizard PRD §2.1, §3)*
- **Mastery** — progressive depth control, alternative explanations, click-to-define, immediate feedback on exercises. *(CourseWizard PRD §2.1 JTBD)*
- **Autonomy** — the student always chooses which Drill-Down level or Way to view; the system never auto-selects on their behalf. *(CourseWizard PRD §5 Non-Goals)*
- **Status / Recognition** — mastery points, streaks, and confetti tied to specific, earned thresholds (≥70%), never generic hype. *(EXPERIENCE.md Voice and Tone; Assignments PRD FR-7)*
- **Belonging** — group study pool requests and public masterclasses sit alongside individual progress rather than being a separate destination. *(Dashboard PRD §2.1 JTBD)* **[inferred label; JTBD text is direct.]**
- **Trust / Fairness** — Hold-visibility submissions never leak partial correctness before tutor review; re-evaluated scores adjust the point total consistently rather than leaving a stale over-grade. *(Assignments PRD FR-8, FR-15)*

## Representative scenario

*(Composited from Dashboard PRD UJ-1 and CourseWizard PRD UJ-2 — not a single sourced narrative.)*

Priya opens Dashboard on a weekday evening, resumes a course, checks her Weekly Goal ring, then — without leaving the page — browses tutor slots for a subject she's stuck on and books one. Later that week, Aarav opens a physics topic on momentum the night before a test: the default explanation doesn't click, so he opens "Explain a different way," cycles through alternatives until a car-crash analogy lands, taps the inline keyword "inertia" for a one-line definition without losing his place, then runs the optional exercise to confirm it landed before closing the app.

## Source citations

- Dashboard PRD: `_specs/planning-artifacts/prds/prd-eLearning-2026-08-10/prd.md` §2.1, §2.3 UJ-1
- Assignments PRD: `_specs/planning-artifacts/prds/prd-eLearning-Assignments-2026-08-10/prd.md` §2.1, §2.3 UJ-1
- CourseWizard PRD: `_specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md` §2.1, §2.3 UJ-2
- EXPERIENCE.md: `_specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/EXPERIENCE.md` Voice and Tone, State Patterns
