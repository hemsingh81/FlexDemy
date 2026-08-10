---
title: Assignments (Merged into Dashboard)
status: final
created: 2026-08-10
updated: 2026-08-10
---

# PRD: Assignments (Merged into Dashboard)

## 0. Document Purpose

This PRD scopes moving "Assignments" out of its own top-level nav tab and into a new section of the role-aware Dashboard (Student/Tutor), and — unlike that prior merge — adds genuinely new capability: a submission/status model, a source taxonomy (course-linked / tutor-assigned / open-competition), and a full tutor-side create-and-score workflow that doesn't exist in the product today. It builds directly on, and should be read alongside, `_specs/planning-artifacts/prds/prd-eLearning-2026-08-10/prd.md` ("Dashboard — Role-Aware Merge of Dashboard + Tutor Hub & Booking"), which shipped the Dashboard shell and role routing this PRD extends. That base PRD did **not** ship a left-side section nav — the nav introduced here (§4.1 FR-2/FR-3) is sourced from an existing, unrelated app component, `CourseOverviewScreen.tsx`'s sticky anchor-jump pattern, not from the base PRD. It supersedes `FrontEnd/docs/FRONTEND_PRD.md` §4.8 ("Assignments & Auto-Grading Engine") and updates §4.1's nav-tab list. Per the agreed execution plan: this PRD is **Phase A**; **Phase B is frontend-only** (new mock data/service layer, no backend); backend requirements follow afterward.

**A note on cross-document FR references:** this PRD's FR numbering restarts at FR-1, independent of the base PRD's FR-1–FR-19. Where this document cites its own FRs, no document name is given; where it cites the base PRD's FRs, it says "base PRD's FR-N" explicitly. Don't assume a bare "FR-3" means the same thing in both documents — it doesn't.

## 1. Vision

Today, "Assignments" is a standalone nav tab showing a flat, course-only quiz picker with no memory — submit a quiz and the result evaporates on reload, there's no way for a tutor to assign work directly to a student, and there's no way to run a platform-wide open assignment. This merge does two things at once: folds Assignments into the Dashboard (so it's one less place to look), and turns it into an actual assignment system — students get a persistent record of what they've done and what's still open, and tutors get to create, publish, and grade their own assignments instead of being limited to whatever's embedded in a course lesson.

## 2. Target User

### 2.1 Jobs To Be Done

**Student**
- When I open my Dashboard, I want to see what I've already turned in and what's still open, in one place, so I don't lose track of assignments the way I do today (everything resets on reload).
- When I look at an available assignment, I want to know where it came from — my course, a specific tutor, or an open competition — so I know its stakes and who's grading it.

**Tutor**
- When I want to assign work beyond what's baked into a course, I want to create my own assignment with my own questions and answer key, so I'm not limited to lesson-embedded quizzes.
- When a student submits, I want control over whether they see their auto-computed score immediately or only after I've had a chance to review it, so I can catch grading edge cases before a score becomes final.

### 2.2 Non-Users (v1)

- Same exclusions as the base Dashboard PRD (§2.2 there): Unassigned/PendingTutor/RejectedTutor never reach Dashboard; Master/Support get the existing Tutor-preview toggle (unaffected by this PRD) but no dedicated Assignments-creation identity of their own.

### 2.3 Key User Journeys

- **UJ-1. Aditi checks and completes her assignments.**
  - **Persona + context:** Aditi, a Student, opens her Dashboard and wants to see what's outstanding.
  - **Entry state:** Authenticated, Student role, Dashboard tab active.
  - **Path:** Clicks "Assignments" in the new left-side section nav. Lands on **My Submissions** — her past attempts with status pills (Submitted, Reviewed). Scrolls to **Available Assignments** — a unified list spanning course-linked lesson quizzes, tutor-assigned assignments, and open-competition assignments, each carrying a source badge. Opens one she hasn't attempted — the existing multiple-choice quiz UI (question, options, submit) renders unchanged. She submits.
  - **Climax:** If the assignment's visibility is "immediate," she sees her score right away (today's auto-grade report, confetti/points, unchanged). If it's "hold for review," she instead sees a "Submitted — pending tutor review" state with no score yet.
  - **Resolution:** The attempt now appears in My Submissions with its current status; once a held submission is reviewed, its status flips to "Reviewed" and the score appears.
  - **Edge case:** Existing course/lesson quizzes always use "immediate" visibility — the hold-for-review path only exists for new tutor-created/competition assignments, so no currently-shipped behavior regresses.

- **UJ-2. Raj creates an assignment and grades submissions.**
  - **Persona + context:** Raj, a Tutor, wants to assign work directly to his students instead of relying only on course lesson quizzes.
  - **Entry state:** Authenticated, Tutor role, Dashboard tab active (Tutor Dashboard).
  - **Path:** Clicks "Assignments" in the Tutor Dashboard's left-side section nav. Sees **My Assignments** (Draft / Published) and clicks "Create Assignment." Fills in title, description, and either links a course or flags it "Open / Competition." Adds multiple-choice questions with a correct-answer key (the auto-scoring source of truth). Chooses a visibility mode: show the auto-computed result to the student immediately, or hold it for his review. Saves as Draft (not yet visible) or Publishes (goes live to its target audience — the linked course's students, or everyone if Open/Competition).
  - **Climax:** Students submit; Raj opens the assignment's **Submissions** view and sees each student's auto-computed score. For "hold" submissions, he reviews and publishes the result (score becomes visible to the student, status → Reviewed). For any already-reviewed submission, he can re-evaluate — manually override the score if he disagrees with the auto-grade.
  - **Resolution:** Published assignments and their submission states are exactly what students see in UJ-1's Available Assignments / My Submissions.
  - **Edge case:** A Draft assignment has zero submissions by definition — students can't see or attempt it until Published.

## 3. Glossary

- **Assignment** — A gradable unit of work: either a course/lesson-embedded quiz (existing) or a tutor-created assignment (new). Has a **Source** and, once published, an assignment-level **Status**.
- **Assignment Source** — One of **Course** (embedded in a lesson, existing behavior), **Tutor** (created by a tutor and linked to one of their courses — v1 requires a course link, no standalone/unlinked tutor assignment), or **Competition** (a tutor-created assignment flagged Open/Competition, visible platform-wide instead of course-linked). Every item in the Available Assignments list (§4.2) carries exactly one Source, shown as a badge.
- **Assignment Status** (tutor-created only) — **Draft** (not visible to students) or **Published** (visible to its Source's audience). Course-source assignments have no Draft state — they're always effectively published via their lesson.
- **Submission** — A student's attempt at an Assignment. Has a **Submission Status**: **Submitted** (awaiting review, only reachable via Hold visibility) or **Reviewed** (score finalized and visible).
- **Visibility Mode** (set per tutor-created Assignment at creation) — **Immediate** (auto-computed score shown to the student right after submit) or **Hold** (score withheld until the tutor reviews and publishes the result). Course-source assignments are always Immediate.
- **Auto-Score** — The system-computed score from comparing a student's multiple-choice answers against the tutor-supplied answer key. The only scoring mode — reuses the existing lesson-quiz grading mechanic (`AssignmentsView.tsx`'s auto-grade report), not a new engine.
- **Re-evaluate** — A tutor action on an already-Reviewed submission: manually overrides the score, saved as final. Distinct from the initial Review action.

## 4. Features

*Acceptance-criteria convention (carried from the base Dashboard PRD): FRs with no explicit Consequences block are still expected to be built and tested to the letter of their prose — this feature has no prior implementation to claim byte-parity against, so "matches current behavior" does not apply here the way it did for the Tutor Hub merge; new FRs need their own explicit acceptance criteria, which are included below.*

### 4.1 Dashboard Navigation — Section Nav & Assignments Tab Retirement
**Description:** The structural change enabling this merge. Realizes UJ-1/UJ-2 entry states.

**Functional Requirements:**

#### FR-1: Retire the standalone "Assignments" nav tab
The system removes the top-level "Assignments" nav entry; Assignments becomes a section within the role-aware Dashboard.

**Consequences (testable):**
- No "Assignments" label remains in `Navbar.tsx` (desktop or mobile).
- `DEFAULT_VISIBLE_TABS` and `activeTab` no longer carry an `'assignments'` key.

#### FR-2: Left-side section nav on Student Dashboard
Student Dashboard gains an in-page, sticky left-side nav listing its sections: Weekly Goal, Adaptive Schedule, My Courses, Assignments, and **Tutor Booking & Group Learning** (named to match the base PRD's §4.3 section exactly — it spans slot booking, Group Study Pools, and Public Live Masterclasses, not just 1-on-1 tutor help). Clicking a section scrolls to it.

**Consequences (testable):**
- Reuses the existing anchor-jump pattern from `CourseOverviewScreen.tsx` (`scrollIntoView`, active-section highlighting) rather than inventing a new navigation mechanism.
- The nav is visible without scrolling on desktop viewports and does not obscure section content.
- The Welcome banner/streak and stat cards/activity calendar (base PRD FR-4/FR-5) are hero content at the top of the page, not their own nav entries — the nav starts at Weekly Goal.

#### FR-3: Left-side section nav on Tutor Dashboard
Tutor Dashboard gains the equivalent left-side nav for its own sections (Availability & Performance, Assignments, Course Publishing — matching the base PRD's §4.4/§4.5 section names, with Assignments inserted between them).

**Consequences (testable):**
- When rendered under the base PRD's Master/Support preview toggle (base PRD FR-3, empty/demo state), the Assignments section follows the same rule as the rest of the Tutor Dashboard: My Assignments and Submissions render empty — no real assignments or submissions, since Master/Support are not registered tutors.

**Out of Scope:**
- A left-nav for the Master/Support demo/preview Tutor Dashboard view is not required to differ from FR-3 — it reuses the same nav.

### 4.2 Student — Assignments Home
**Description:** Realizes UJ-1's path through My Submissions and Available Assignments.

**Functional Requirements:**

#### FR-4: My Submissions (default view)
Student's Assignments section defaults to a list of their own submissions: assignment title, Source badge, submitted date, Submission Status (Submitted / Reviewed), and score (shown only once Reviewed, or immediately for Immediate-visibility assignments).

**Consequences (testable):**
- Sorted most-recently-submitted first.
- Empty state (no submissions yet) shows a message pointing the student at Available Assignments below, not a blank area.

#### FR-5: Available Assignments (unified list)
Below My Submissions, a list of every assignment the student can attempt, unified across all three Sources (Course, Tutor, Competition), each carrying its Source badge. Already-attempted assignments show their Submission Status instead of an "attempt" action.

**Consequences (testable):**
- Course-source items are the same lesson-embedded quizzes that exist today (`Lesson.assignment`) — no course/lesson data model change, just a new presentation layer that flattens them into this list.
- Tutor-source items only appear for assignments Published (not Draft) and targeted at a course the student is enrolled in.
- Competition-source items appear for every student regardless of enrollment.

**Out of Scope:**
- Filtering/sorting the Available Assignments list by Source or Status — v1 shows the full list; filtering can be added later without a data model change.

#### FR-6: Taking an assignment
Opening an available assignment renders the existing multiple-choice quiz UI (question, options grid, submit) unchanged, regardless of Source.

**Consequences (testable):**
- No new question format is introduced — the question/options/correct-answer shape is the existing `QuizQuestion` type, reused for tutor-created assignments' answer keys too.
- Per-question instant explanation feedback on submit (today's existing behavior) is preserved unchanged for every Source, not just Course.

### 4.3 Student — Submission Visibility Behavior
**Description:** Realizes UJ-1's climax/resolution branch. Realizes the "hold for review" half of Raj's control in UJ-2.

**Functional Requirements:**

#### FR-7: Immediate-visibility submission
For Course-source assignments (always Immediate) and Tutor/Competition assignments configured Immediate, submitting shows the auto-grade report right away — today's unchanged flow (score %, +150 mastery points, confetti threshold at ≥70%).

#### FR-8: Hold-visibility submission
For Tutor/Competition assignments configured Hold, submitting shows a "Submitted — pending tutor review" state with no score element rendered. The submission appears in My Submissions with Status = Submitted.

**Consequences (testable):**
- The student cannot see their auto-computed score for a Hold submission until the tutor completes Review (FR-14) — the score is computed and stored, but not rendered client-side before that point.

### 4.4 Tutor — Assignment Creation & Management
**Description:** Realizes UJ-2's creation path.

**Functional Requirements:**

#### FR-9: My Assignments list
Tutor's Assignments section shows every assignment they've created, with its Status (Draft / Published), plus a "Create Assignment" entry point.

**Consequences (testable):**
- Sorted most-recently-created first.
- Empty state (no assignments created yet) shows a message pointing at "Create Assignment," not a blank area.

#### FR-10: Assignment creation form
Tutor fills in title, description, target (link to one of their own courses, or flag "Open / Competition"), and one or more multiple-choice questions (question text, options, correct-answer index) — the same shape as the existing lesson-quiz question builder pattern.

**Consequences (testable):**
- At least one question with a designated correct answer is required before the assignment can be Published (not required to save as Draft).

#### FR-11: Scoring & visibility choice
At creation, the tutor sets the assignment's Visibility Mode: Immediate or Hold (§3 Glossary). Auto-score is the only scoring mode — no manual-only (ungraded) option in v1.

#### FR-12: Draft vs. Publish
Tutor saves the assignment as Draft (not visible to any student) or Publishes it (visible per its target: linked course's enrolled students, or all students if Open/Competition).

**Out of Scope:**
- Editing a Published assignment's questions/answer key after students have already submitted against it — out of scope for v1; a tutor who needs to fix a published assignment un-publishes (returns it to Draft) first. `[NON-GOAL for MVP: versioned/live-editable published assignments are a real need but not required to ship this merge.]` `[NOTE FOR PM]` Un-publishing to fix a live assignment is a real workflow cost for a tutor mid-grading cycle (e.g. a typo in a question after some students already submitted) — worth revisiting if this friction shows up in practice.

### 4.5 Tutor — Submissions Review & Scoring
**Description:** Realizes UJ-2's climax — reviewing Hold submissions and re-evaluating already-reviewed ones.

**Functional Requirements:**

#### FR-13: Submissions view (per assignment)
From an assignment in My Assignments, tutor opens its Submissions view: every student who has submitted, their Submission Status, and their auto-computed score.

**Consequences (testable):**
- Sorted most-recently-submitted first; Submitted (awaiting review) entries are visually distinguished from Reviewed ones so the tutor can spot pending work at a glance.
- Empty state (zero submissions) is distinct from the Draft-assignment case in UJ-2's edge case (Draft has zero submissions *by definition* since it isn't visible yet) — a Published assignment can also legitimately have zero submissions so far, and the empty state should not imply something is wrong.

#### FR-14: Review action (Hold submissions)
For a Submitted (Hold-visibility, awaiting review) submission, tutor reviews the auto-computed score and publishes the result — Submission Status becomes Reviewed, and the score becomes visible to the student (FR-4).

**Consequences (testable):**
- Mastery points (+150 at ≥70%, per FR-7) are awarded to the student's total at the moment the tutor publishes the review, not retroactively at original submission time — the score was computed then, but nothing was granted until now. `[ASSUMPTION: points award on publish, not on submit, for Hold-visibility assignments.]`
- The confetti celebration plays for the student the next time they view this now-Reviewed submission (client-side, same ≥70% threshold as Immediate) — it does not fire for the tutor during Review.
- `[NOTE FOR PM]` This timing choice (award-on-publish vs. award-on-submit-but-hidden) directly affects the student's running points total and when it changes — worth a second look if points ever feed a leaderboard or streak mechanic elsewhere in the app.

**Out of Scope:**
- Editing the auto-computed score *during* the Review action itself — Review is a confirm-and-publish action. Changing a score after publishing is the separate Re-evaluate action (FR-15), keeping the two actions distinct per the confirmed journey.

#### FR-15: Re-evaluate action (Reviewed submissions)
For an already-Reviewed submission, tutor can manually override the score. The new score replaces the prior one and is saved as final.

**Consequences (testable):**
- If the assignment awards mastery points, re-evaluating adjusts the student's point total by the delta between the old and new score (e.g., raising a submission across the ≥70% line awards the +150; lowering it below removes them) — the total stays consistent with the current score rather than permanently keeping points from a since-corrected grade. `[ASSUMPTION: points adjust with Re-evaluate; confirm with stakeholder — an alternative is points awarded once and never reclaimed.]`
- No confetti re-fires on Re-evaluate — it's a correction, not a new completion.
- `[NOTE FOR PM]` Clawing back already-awarded points on a downward re-evaluation is a real UX/trust tradeoff (a student sees their points drop after the fact) — flagged for a second look; the alternative (points awarded once, never reclaimed) is simpler but lets an initial over-grade permanently inflate a student's total.

### 4.6 Cross-Cutting NFRs

- **Accessibility (carry-over):** The existing app-wide WCAG 2.1 AA support applies unchanged to all new Assignments-section widgets (My Submissions table, Available Assignments cards, creation form, Submissions review view) and to the new left-side section nav, consistent with the same commitment made in the base Dashboard PRD's §4.6.
- **Reuse, don't duplicate, the grading mechanic:** The existing MC-quiz auto-grading logic in `AssignmentsView.tsx` (answer comparison, score %, confetti/points threshold) is the single implementation backing all three Sources — Phase B build should refactor it into a shared piece rather than forking a second copy for tutor-created assignments.
- **New mock service layer required:** Unlike the Tutor Hub merge, there is no existing `services/*` mock backing assignments/submissions today (`useAssignments.ts` just flattens course data) — Phase B needs a new mock service (assignment CRUD, submission state, status transitions) to support Draft/Published, Submitted/Reviewed, and Re-evaluate, since none of that state persists anywhere today.
- **Test coverage:** New Assignments-section components get `vitest`/`@testing-library` coverage equivalent to what the Dashboard merge established; the retired standalone `AssignmentsView.tsx` route's tests are relocated/adapted, not dropped.
- **Visual consistency:** New screens (creation form, Submissions review view) follow the app's existing visual system (`FRONTEND_PRD.md` §3 — rounded cards, indigo/amber accents, high-contrast light theme) rather than introducing a new visual language for this feature.

### 4.7 CoursePlayer Entry Point Rewiring
**Description:** Resolves what was originally an open question (see prior draft) by inspection: `CoursePlayer.tsx` already renders a "Take Quiz" button (`onOpenAssignment`) when the current lesson has an embedded assignment, which today just switches to the standalone Assignments tab — and, as a pre-existing bug, discards the specific assignment ID, always landing on whichever assignment happens to be first in the list.

**Functional Requirements:**

#### FR-16: Rewire "Take Quiz" into the Dashboard, and fix the deep-link bug
Since FR-1 retires the standalone Assignments tab, CoursePlayer's "Take Quiz" button is rewired to navigate into the Dashboard's Assignments section (FR-6 Taking an assignment) instead — and, while this path is being touched anyway, its pre-existing bug is fixed: the specific assignment's ID is now passed through and opens that lesson's assignment directly, not an arbitrary first item.

**Consequences (testable):**
- Clicking "Take Quiz" in a lesson routes to Dashboard → Assignments and opens the exact assignment tied to that lesson (`Lesson.assignment.id`), not `assignments[0]`.
- No second, separate quiz UI is introduced — this stays a shortcut into the same unified Available Assignments experience (FR-6), not a parallel path.

**Out of Scope:**
- Any other CoursePlayer changes beyond this one navigation rewire — it's in scope only because FR-1 forces `onOpenAssignment`'s destination to change regardless; fixing the adjacent ID bug is a low-cost, same-touch fix, not a broader CoursePlayer review.

## 5. Non-Goals (Explicit)

- No free-text/essay auto-grading, and no AI rubric/plagiarism evaluation — auto-scoring is multiple-choice-only, matching the only grading mechanic that exists today. The "Auto-Grading & Rubric Analysis" AI microservice mentioned in `BACKEND_PRD.md` §6 is explicitly Deferred per the backend architecture spine; this PRD does not un-defer it.
- No wiring of the existing decorative file-upload input (`AssignmentsView.tsx`'s upload field is already non-functional today — local state only, never submitted) — untouched by this PRD.
- No backend/API work this phase — new mock service only (§4.6); backend requirements (new Assignment/Submission entities, endpoints) are addressed in a follow-up pass to `BACKEND_PRD.md`, per the same phased approach as the Tutor Hub merge.
- No notifications (email/push) when a Hold submission is reviewed or an assignment is published.
- No versioned/live-editable Published assignments (§4.4 FR-12 Out of Scope).
- No CoursePlayer changes beyond the required navigation rewire (§4.7 FR-16) — the lesson-reading experience itself, and everything else about how a lesson launches, is untouched.
- No change to the "assignment badges" shown in the Course Overview screen's syllabus view (`FRONTEND_PRD.md` §4.4, a different surface from Dashboard) — untouched by this PRD; whether/how it should relate to the new Source badges (§4.2 FR-6) is left for a later pass.

## 6. MVP Scope

### 6.1 In Scope
- FR-1 through FR-16.
- New frontend-only mock service layer for assignments/submissions (courses stay the source of truth for Course-source items; new state for Tutor/Competition-source items and all submission records).
- Updating `FrontEnd/docs/FRONTEND_PRD.md` §4.8 (rewritten) and §4.1 (nav-tab list corrected, retirement note added) to reflect the merged structure.

### 6.2 Out of Scope for MVP
- Backend API design for the Assignment/Submission entity model and CRUD API (deferred to a follow-up `BACKEND_PRD.md` pass). Note this is narrower than a blanket "nothing exists": `BACKEND_PRD.md` §6 already documents a related-but-distinct "Auto-Grading & Rubric Analysis" AI microservice (code/essay rubric evaluation, not MC-quiz scoring), which stays Deferred per the architecture spine either way — the follow-up pass reconciles with that, it doesn't start from a truly blank slate on the grading *concept*, only on the Assignment/Submission entity model itself, which genuinely has no prior design (confirmed: no `assignments`/`submissions` table in `BACKEND_PRD.md` §3, no reserved structural home in `ARCHITECTURE-SPINE.md`, no domain code).
- Free-text scoring, file-upload grading, notifications, live-editable published assignments (§5).

## 7. Success Metrics

**Primary**
- **SM-1**: Every FR in §4.1–§4.7 is reachable and functional from the Dashboard, with the existing course-quiz auto-grade flow (FR-7 Immediate-visibility submission) unchanged from today. Validates FR-1 through FR-16.

**Secondary**
- **SM-2**: Nav simplified further — top-level tabs go from 6 (post Tutor-Hub-merge) to 5 with Assignments retired.

**Counter-metrics (do not optimize)**
- **SM-C1**: Source clarity — do not simplify the Available Assignments list by dropping or visually de-emphasizing the Source badge; a student must always be able to tell at a glance whether an assignment is Course/Tutor/Competition. Counterbalances SM-1's parity pressure toward a generic, undifferentiated list.

## 8. Open Questions

None outstanding as of this Finalize round. The one substantive open question from the first draft — whether `CoursePlayer.tsx` has its own entry point into a lesson's embedded quiz — turned out to be answerable by inspection rather than genuinely unknown; it's resolved as §4.7 FR-16, not deferred. Two narrower items remain flagged as assumptions rather than open questions, since v1 defaults are stated and buildable either way — see §9.

## 9. Assumptions Index

*This index doubles as a decision log, not purely open/unresolved assumptions — most entries are resolved decisions, tagged with how they were reached. Where practical, the same `[ASSUMPTION: ...]` tag also appears inline at the FR/Glossary site it applies to.*

- §3 Glossary (Submission) / §4.3 — Submission Status uses exactly two values (Submitted, Reviewed); no separate "Graded" state. *(Assumption — no inline tag added since the Glossary entry itself states the two values directly; flagged here for visibility.)*
- §4.4 FR-12 — Draft assignments are fully invisible to students, not shown as a "coming soon" preview. *(Assumption.)*
- §4.2 FR-6 — Tutor-created assignments reuse the exact same `QuizQuestion` (multiple-choice) shape as existing lesson quizzes; no new question type. *(Confirmed with stakeholder via UJ-2.)*
- §4.5 FR-14/FR-15 — Review and Re-evaluate are distinct actions (Review = confirm-and-publish a pending score once; Re-evaluate = override an already-published score). *(Confirmed with stakeholder.)*
- §4.5 FR-14 — Mastery points award on publish (when the tutor completes Review), not retroactively at original submission time, for Hold-visibility assignments. *(Assumption — inline-tagged at FR-14; surface for confirmation, see the accompanying `[NOTE FOR PM]`.)*
- §4.5 FR-15 — Re-evaluating a score adjusts the student's already-awarded mastery points by the delta, rather than leaving prior points untouched. *(Assumption — inline-tagged at FR-15; surface for confirmation, see the accompanying `[NOTE FOR PM]`.)*
- §4.1 FR-3 — Left-side section nav applies to both Student and Tutor Dashboards, including the Master/Support empty-demo view. *(Confirmed with stakeholder; empty-demo extension confirmed during Finalize input-reconciliation against the base Dashboard PRD.)*
- §3 Glossary (Assignment Source) — Tutor-source assignments require a course link in v1; no standalone (unlinked, non-Competition) tutor assignment exists. *(Corrected during Finalize rubric review — the initial draft's Glossary wording implied a standalone option that no FR implemented; this entry supersedes that.)*
- §4.7 FR-16 — CoursePlayer's existing "Take Quiz" entry point is rewired into the Dashboard rather than removed, and its pre-existing deep-link-ID bug is fixed in the same pass. *(Resolved during Finalize by inspecting `CoursePlayer.tsx` directly — not left as an open question.)*
