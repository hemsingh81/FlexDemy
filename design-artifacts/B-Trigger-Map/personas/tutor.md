---
title: Persona — Tutor / Course Author
status: inferred / reconstructed
created: 2026-08-15
---

# Persona: Tutor / Course Author

> Reconstructed 2026-08-15 from PRD/UX text, not from live user research. `UserRole.Tutor` in code, referred to in the CourseWizard PRD as "Tutor / Creator." Named journey characters (Raj, Meera) are PRD-authored illustrative personas, not real interviewed users.

## Who they are

An approved tutor who runs a small teaching business inside FlexDemy: manages 1-on-1 booking availability, publishes courses, creates and grades assignments, and broadcasts public masterclasses. Two distinct sub-journeys appear: the day-to-day operator (Raj — availability, bookings, earnings, grading) and the course creator (Meera — turning raw material into a structured, published course). Both are the same role; the product treats them as one continuous "teaching operation" rather than separate personas.

## Goals

- Manage the whole teaching business (availability, bookings, earnings, course content) from one place, not split across hubs. *(Dashboard PRD §2.1 JTBD)*
- See a new student booking reflected immediately where they already work. *(Dashboard PRD §2.1 JTBD)*
- Assign work directly to students, not just rely on course-embedded quizzes. *(Assignments PRD §2.1 JTBD)*
- Control whether a student sees their auto-computed score immediately or only after review, to catch grading edge cases. *(Assignments PRD §2.1 JTBD)*
- Turn existing raw material (PDF/Word/slides) into a structured course draft instead of authoring from a blank page. *(CourseWizard PRD §2.1 JTBD)*
- Retain full editorial control over AI-extracted structure before anything goes live. *(CourseWizard PRD §2.1 JTBD)*
- See exactly what a student will see before publishing, to catch problems first. *(CourseWizard PRD §2.1 JTBD)*

## Pain points (as implied by what the product changes)

- **Split attention across hubs:** teaching operations lived in a separate "Tutor Hub" disconnected from the rest of the app. *(Dashboard PRD §1 Vision)*
- **No way to assign original work:** limited to whatever's embedded in a course lesson; no persistent way to publish tutor-authored assessments. *(Assignments PRD §1 Vision)*
- **No control over grading visibility:** no way to hold a score back for review before a student sees it, risking a mis-graded result becoming visible/final. *(Assignments PRD §2.1 JTBD)* **[inferred: this is the gap the feature closes.]**
- **Manual, blank-page authoring:** "a tutor turns source material into a course by hand: typing out lessons one at a time into a flat list, with no help structuring the material." *(CourseWizard PRD §1 Vision)*
- **No way to teach an idea more than one way:** the old flow offered one explanation per idea, with no built-in support for depth or alternative framing. *(CourseWizard PRD §1 Vision)*
- **Friction fixing a live mistake:** a Published assignment's questions/answer key are not live-editable — must un-publish first, a real mid-grading-cycle cost flagged explicitly by the PM note. *(Assignments PRD §4.4 FR-12 Out of Scope, `[NOTE FOR PM]`)*

## Psychological drivers

- **Autonomy** — full editorial control over AI-extracted structure (add/edit/delete/reorder any node); the AI drafts, the tutor approves. *(CourseWizard PRD §4.4 Description)*
- **Control / Oversight** — explicit per-node confirmation gates before anything reaches students; Review as Student mode before Publish becomes available. *(CourseWizard PRD FR-15, FR-23, FR-24)*
- **Reduced Anxiety** — seeing exactly what a student will see before publishing removes the fear of an inaccurate or AI-garbled course going live. *(CourseWizard PRD §2.1 JTBD)*
- **Status / Recognition** — creating original assignments (not just consuming lesson-embedded quizzes) positions the tutor as an authority who sets terms, including grading visibility. **[inferred — the capability is sourced; framing it as status/authority is our read.]**
- **Efficiency / Reduced Toil** — AI-assisted structure extraction turns authoring into an editing task rather than a from-scratch writing task. *(CourseWizard PRD §1 Vision — "the AI proposes a structured outline... that the tutor edits and confirms rather than authoring from a blank page.")*
- **Trust / Fairness** — Review vs. Re-evaluate are kept as genuinely distinct actions so a tutor can correct a grade without it reading as an arbitrary override. *(Assignments PRD §3 Glossary "Re-evaluate"; EXPERIENCE.md Component Patterns)*

## Representative scenario

*(Composited from Dashboard PRD UJ-2, Assignments PRD UJ-2, and CourseWizard PRD UJ-1/UJ-4 — not a single sourced narrative.)*

Raj starts his teaching day by flipping himself Online, reviewing bookings and adding open slots, then opens Assignments to create a new tutor-authored assignment with a Hold visibility mode so he can review scores before students see them. Separately, Meera drags a scanned PDF of her chemistry notes into the New Course Wizard; the AI proposes a Chapter→Topic→Subtopic structure with chemistry notation intact. She fixes a mis-split topic, edits a garbled OCR sentence, confirms every node, then enters Review as Student to experience the course exactly as a learner would — drilling down a level, cycling an alternative explanation, clicking a keyword — before tapping Confirm Review, which is what finally unlocks Publish.

## Source citations

- Dashboard PRD: `_specs/planning-artifacts/prds/prd-eLearning-2026-08-10/prd.md` §2.1, §2.3 UJ-2
- Assignments PRD: `_specs/planning-artifacts/prds/prd-eLearning-Assignments-2026-08-10/prd.md` §2.1, §2.3 UJ-2, §4.4
- CourseWizard PRD: `_specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md` §2.1, §2.3 UJ-1, UJ-4, §4.4
- EXPERIENCE.md: `_specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/EXPERIENCE.md` Component Patterns, Key Flows
