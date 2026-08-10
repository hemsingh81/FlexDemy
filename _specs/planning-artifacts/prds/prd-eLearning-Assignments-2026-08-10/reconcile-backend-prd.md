---
title: Input Reconciliation — Backend PRD vs. Assignments PRD "no prior backend design" claim
created: 2026-08-10
subject-prd: prd-eLearning-Assignments-2026-08-10/prd.md (§5, §6.2)
---

# Reconciliation Findings

## Claim under test

`prd.md` §5 (Non-Goals) and §6.2 (Out of Scope for MVP) both assert:

> "No backend/API work this phase... backend requirements ... are addressed in a follow-up pass to `BACKEND_PRD.md`" (§5)
> "Backend API design for assignments/submissions (deferred to a follow-up `BACKEND_PRD.md` pass — **no prior backend design exists for this at all**, unlike the Tutor Hub case where partial documented intent existed)." (§6.2)

## 1. `FrontEnd/docs/BACKEND_PRD.md` — full read (169 lines)

Contradicting evidence found — the claim is **overstated, not accurate as a blanket statement**:

- **§6 "AI Microservice Pipeline" (lines 157–163)** explicitly documents:
  > **Auto-Grading & Rubric Analysis Service**: Evaluates uploaded student code or essay files against solution rubrics.

  This *is* prior backend design content directly about grading/evaluation — the PRD's own §5 even cites it by name ("The 'Auto-Grading & Rubric Analysis' AI microservice mentioned in `BACKEND_PRD.md` §6 is explicitly Deferred per the backend architecture spine; this PRD does not un-defer it"). So the PRD authors were aware of this content when they wrote §5, yet §6.2 still says "no prior backend design exists for this at all."

- **No contradicting evidence for the Assignment/Submission *data model* specifically.** Scanning all of §3 (Database Schema): `users`, `courses`, `course_notes`, `course_reviews`, `tutor_slots` — there is **no `assignments`, `submissions`, or `quizzes` table**. §4 (REST API) has no `/api/v1/assignments` or `/api/v1/submissions` endpoints. §users.role does include `'tutor'` as an enum value, which is a (minor, indirect) precondition for a tutor-created-assignment feature, but nothing assignment-specific.

- **Verdict on claim 1:** The claim is **directionally true for the CRUD/entity model** (assignment creation, Draft/Published status, submission status, visibility mode, Review/Re-evaluate — none of that is designed anywhere in `BACKEND_PRD.md`) but **factually inaccurate as an absolute statement** ("no prior backend design exists for this at all") because §6 does contain prior backend design for AI-based grading/evaluation, which is thematically the same domain (grading a student's submitted work) even though it targets code/essay rubric evaluation rather than MC-quiz assignments. The PRD should say something like "no prior design exists for the Assignment/Submission entity model or CRUD API; a related-but-distinct Auto-Grading AI microservice is documented in §6 and remains deferred," rather than the current blanket denial.

## 2. `ARCHITECTURE-SPINE.md` — structural reservation check

File: `_specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md`

- **Structural Seed** (the canonical greenfield scaffold list, lines 147–208) reserves feature folders for `Courses`, `Tutoring` (TutorSlot), `Notes`, `Reviews`, `Users` — across Domain, Application, Infrastructure, and Api/Controllers. **There is no `Assignments` (or `Submissions`) folder anywhere in Domain, Application, Infrastructure, or a corresponding `AssignmentsController.cs`.** Unlike Tutoring/TutorSlot (which got a full entity → repository → service → controller reservation), Assignments has **zero structural home** reserved.
- **Deferred section (lines 222–230)** explicitly lists:
  > "**AI microservice pipeline** (concept drilldown, auto-grading) — out of scope for this structural pass; likely its own Infrastructure-layer client calling an external AI API, or a separate service, decided when that feature is scoped."

  This corroborates that auto-grading is a recognized-but-deferred concern in the architecture spine too — consistent with (and further evidence for) finding 1: the concept isn't unknown to the architecture, it's deliberately deferred, which is a different claim than "no prior design exists at all."
- **Verdict on claim 2:** Confirmed accurate — the architecture spine reserves **no** entity/service/controller structural home for Assignments/Submissions, unlike Tutoring. This part of the PRD's "Phase A, backend follow-up" framing is well-supported.

## 3. `BackEnd/src/FlexDemy.Domain/` — code grep

Command: `grep -rn -i "assignment|submission" BackEnd/src/FlexDemy.Domain/`

- **Zero matches** in Domain source. Domain feature folders present: `Common`, `Courses` (only `Course.cs`), `MasterData`, `Notes`, `Permissions`, `Profiles`, `Reviews`, `Tutoring`, `Users` — no `Assignments`/`Submissions` folder, no entity file.
- `BackEnd/src/FlexDemy.Application/` grep for the same terms hits only build artifacts (`bin`/`obj` DLLs, irrelevant) plus one source hit: `BackEnd/src/FlexDemy.Application/Permissions/FeatureKeys.cs`, which defines `public const string Assignments = "assignments";` as a **nav/feature-flag permission key** (alongside Dashboard, Discover, Tutor, Groups, Certificates, Admin) — i.e., a UI-gating string constant, not a domain entity, DTO, service, or persisted concept. It doesn't constitute "backend design" for the Assignment entity.
- No `Quiz` references anywhere in Domain or Application source.
- **Verdict on claim 3:** Confirmed — no Assignment/Submission code exists in the backend. The only tangential hit is a permission-key string label, not a design artifact.

## Overall Conclusion

The PRD's "no prior backend design exists for this at all" (§6.2) is **not fully accurate**. `BACKEND_PRD.md` §6 does contain prior backend design touching grading/evaluation (the Auto-Grading & Rubric Analysis AI microservice) — a fact the PRD's own §5 acknowledges by name in the same document, creating an internal inconsistency between §5 (which cites the prior content) and §6.2 (which denies any prior content exists). The claim is accurate only for the narrower scope of "no Assignment/Submission entity, CRUD API, or status-model design" — which is true and well-supported by both the architecture spine's structural omission and the absence of any backend code. Recommend narrowing the §6.2 wording rather than removing the claim outright.
