---
title: FlexDemy eLearning — Trigger Map (Reconstructed)
status: inferred / reconstructed
created: 2026-08-15
---

# Trigger Map — FlexDemy eLearning

> **This is a reconstructed, not a live-elicited, Trigger Map.** FlexDemy's planning ran through the BMM module (PRDs + `EXPERIENCE.md`/`DESIGN.md`), which does not run WDS's Trigger Mapping workshop. Everything below was derived on **2026-08-15** by reading the four PRDs and the UX experience/design specs after the fact and inferring the business-goal → psychological-driving-force → persona → feature chain that the product decisions imply. Where a line is a direct quote or an unambiguous restatement of source text, it is cited plainly. Where it is a judgment call about *why* a feature exists (i.e. the psychology behind it), it is explicitly marked **[inferred]**. Treat this document as a starting hypothesis for a future live Trigger Mapping session, not as a substitute for one — no persona quote, journey beat, or driving force below was validated with a real user.
>
> Source documents referenced (short names used in the "Source" column below):
> - **Dashboard PRD** — `_specs/planning-artifacts/prds/prd-eLearning-2026-08-10/prd.md`
> - **Assignments PRD** — `_specs/planning-artifacts/prds/prd-eLearning-Assignments-2026-08-10/prd.md`
> - **CourseWizard PRD** — `_specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md`
> - **ErrorObs PRD** — `_specs/planning-artifacts/prds/prd-eLearning-ErrorObservability-2026-08-13/prd.md`
> - **EXPERIENCE.md** / **DESIGN.md** — `_specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/`

## Driving-force vocabulary used below

These are the psychological "driving forces" this map scores against — a condensed, product-relevant subset chosen **[inferred]** to fit what the source docs actually evidence, not the full generic WDS force list:

| Force | Shorthand meaning |
|---|---|
| **Reduced Anxiety** | Removing fear of loss, ambiguity, or being caught off guard (lost work, invisible grading, invisible system failures) |
| **Mastery** | Visible competence/progress, understanding-on-your-own-terms, skill growth |
| **Autonomy** | Control over pace, method, and one's own workflow without depending on someone else |
| **Efficiency / Reduced Toil** | Less manual, repetitive, or duplicated effort |
| **Trust / Fairness** | Confidence that a system (grading, publishing, triage) behaves predictably and fairly |
| **Status / Recognition** | Visible, earned achievement (points, streaks, "act here" affordances) |
| **Control / Oversight** | For admins/tutors: the ability to see, configure, and correct the system rather than being at its mercy |
| **Belonging** | Peer connection, learning-with-others |

## Business Goal → Driving Force → Persona → Feature

### 1. Collapse fragmented navigation into one coherent home
- **Business goal:** Reduce the number of places a Student or Tutor has to check to run their day (two nav tabs → one role-aware Dashboard).
- **Driving force:** Efficiency / Reduced Toil, secondarily Reduced Anxiety (nothing to "remember to check"). **[inferred — the PRD states the functional merge; the psychological "so I don't have to hunt for it" framing is Sourced directly from the JTBD language below.]**
- **Persona:** Student, Tutor.
- **Feature(s):** Dashboard Shell & Role-Based Routing (FR-1–FR-3); Dashboard nav retirement of "Tutor Hub" and "Assignments" tabs (Assignments PRD FR-1).
- **Source:** Dashboard PRD §2.1 JTBD — *"When I open the app, I want one place to see my progress and pick up where I left off, so I don't have to hunt for it"* and *"so I'm not splitting attention across separate hubs."* Also §1 Vision: *"Today a Student and a Tutor open the app to two different, disconnected homes."*

### 2. Make getting tutor help feel like a natural next step, not a context switch
- **Business goal:** Increase tutor-booking uptake by removing the friction of leaving the main screen.
- **Driving force:** Reduced Anxiety (asking for help is already emotionally loaded; friction compounds it) + Efficiency. **[inferred — "so getting help feels like a natural next step, not a context switch" is a direct quote, but the anxiety framing is our interpretation of why that phrasing matters.]**
- **Persona:** Student.
- **Feature(s):** Browse & filter tutor slots (FR-9), Book a tutor slot (FR-10), My Booked Sessions (FR-11).
- **Source:** Dashboard PRD §2.1 JTBD: *"When I need help, I want to find and book a tutor without leaving my main screen, so getting help feels like a natural next step, not a context switch."*

### 3. Give students a persistent record instead of work that "evaporates on reload"
- **Business goal:** Eliminate the anxiety/mistrust caused by assignment state not persisting.
- **Driving force:** Reduced Anxiety, Trust. Directly evidenced, not inferred.
- **Persona:** Student.
- **Feature(s):** My Submissions (FR-4), Available Assignments unified list (FR-5).
- **Source:** Assignments PRD §1 Vision: *"submit a quiz and the result evaporates on reload"*; §2.1 JTBD: *"so I don't lose track of assignments the way I do today (everything resets on reload)."*

### 4. Give tutors authoring authority beyond lesson-embedded quizzes
- **Business goal:** Let tutors create and own assessment content, not just consume what's baked into a course.
- **Driving force:** Autonomy, Status/Recognition (tutor as an authority who can assign and grade on their own terms). **[inferred — the JTBD text evidences autonomy directly; "status" is our read on what "control over whether they see their auto-computed score immediately" signals about tutor authority.]**
- **Persona:** Tutor.
- **Feature(s):** Assignment creation form (FR-9, FR-10), Visibility Mode choice (FR-11), Draft vs Publish (FR-12).
- **Source:** Assignments PRD §2.1 JTBD: *"I want to create my own assignment with my own questions and answer key, so I'm not limited to lesson-embedded quizzes"*; *"I want control over whether they see their auto-computed score immediately or only after I've had a chance to review it, so I can catch grading edge cases before a score becomes final."*

### 5. Preserve grading trust/fairness across immediate vs. held review
- **Business goal:** Let tutors catch grading edge cases without breaking student trust in transparent, prompt feedback for the common case.
- **Driving force:** Trust / Fairness (both directions — Student trusts the score is real once shown; Tutor trusts they had a chance to correct it first).
- **Persona:** Student, Tutor.
- **Feature(s):** Immediate-visibility submission (FR-7), Hold-visibility submission (FR-8), Review action (FR-14), Re-evaluate action (FR-15).
- **Source:** Assignments PRD §3 Glossary (Visibility Mode, Re-evaluate); EXPERIENCE.md State Patterns row "Hold-visibility submitted" / "Points delta on Re-evaluate."

### 6. Turn manual, blank-page course authoring into AI-assisted structuring
- **Business goal:** Cut the time/effort cost of turning raw material into a structured, publishable course.
- **Driving force:** Efficiency / Reduced Toil, Mastery (tutor is "editing rather than building from a blank page" — competence is preserved, drudgery is removed). Directly evidenced.
- **Persona:** Tutor.
- **Feature(s):** AI Service Layer (FR-1–FR-5), Multi-file upload (FR-11), Parsing/OCR pre-step (FR-12), AI structure extraction (FR-13).
- **Source:** CourseWizard PRD §1 Vision: *"A tutor uploads what they already have... and the AI proposes a structured outline... that the tutor edits and confirms rather than authoring from a blank page."* §2.1 JTBD: *"so I'm editing rather than building from a blank page."*

### 7. Preserve tutor control/accuracy despite AI involvement
- **Business goal:** Ensure AI assistance doesn't erode a tutor's confidence that what publishes is accurate.
- **Driving force:** Control / Oversight, Reduced Anxiety (fear of AI error going live unchecked). Directly evidenced.
- **Persona:** Tutor.
- **Feature(s):** Add/modify/delete/reorder any node (FR-14), Explicit per-node confirmation (FR-15), Review as Student mode (FR-23), Confirm Review gate on Publish (FR-24).
- **Source:** CourseWizard PRD §2.1 JTBD: *"When the AI gets something wrong or incomplete, I want full control to add, edit, delete, and reorder before anything goes live, so the published course is accurate."* and *"When I'm ready to publish, I want to see exactly what a student will see first, so I catch problems before a student does."*

### 8. Let a student learn at their own depth and in their own style
- **Business goal:** Increase real understanding/completion rather than one-size-fits-all explanation.
- **Driving force:** Mastery, Autonomy (student chooses depth/style, nothing is auto-decided for them), Reduced Anxiety (simplest-first reduces overwhelm). Directly evidenced, reinforced by an explicit Non-Goal.
- **Persona:** Student.
- **Feature(s):** Five-Level Drill-Down (FR-17), Five Alternative Explanations / "Ways" (FR-18), Click-Any-Keyword (FR-20).
- **Source:** CourseWizard PRD §2.1 JTBD: *"When I don't understand something, I want the simplest possible explanation first, so I'm not overwhelmed"*; *"I want to go deeper on my own terms, one step at a time"*; *"a completely different way of hearing the same idea, so I'm not stuck with one framing."* Reinforced by §5 Non-Goals: *"the student always chooses which Drill-Down Level or Way to view; the system does not infer or auto-select on their behalf."*

### 9. Let a student check whether understanding actually "landed"
- **Business goal:** Give students a low-stakes way to self-verify comprehension without it being certification/high-stakes.
- **Driving force:** Mastery, Reduced Anxiety (practice is explicitly non-certifying, so no fear of a bad grade). **[inferred — the non-certifying framing is a direct quote; the anxiety-reduction read on why that framing matters is ours.]**
- **Persona:** Student.
- **Feature(s):** Optional Exercises (FR-19).
- **Source:** CourseWizard PRD §2.1 JTBD: *"When I want to check my understanding, I want to practice, so I know whether it actually landed."* §3 Glossary: Exercise is *"optional, practice-only (non-certifying)."*

### 10. Give the platform admin vendor independence and cost control over AI spend
- **Business goal:** Avoid being dependent on one AI vendor being up, and keep AI cost bounded and visible.
- **Driving force:** Control / Oversight, Reduced Anxiety (outage resilience), Efficiency (cost discipline). Directly evidenced.
- **Persona:** Admin.
- **Feature(s):** Provider-agnostic AI gateway (FR-1), Configuration-only model swap (FR-2), Per-task fallback (FR-3), Usage/cost tracking (FR-4), AI Configuration screen (FR-27), Budget threshold enforcement (FR-29).
- **Source:** CourseWizard PRD §2.1 JTBD: *"When a new AI model becomes available or a provider has an outage, I want to change which model powers a given task from a config screen, so the module never depends on one vendor being up."* §1 Vision: *"the underlying AI is treated as a replaceable engine, not a foundation poured in concrete."*

### 11. Keep the admin-governed vocabulary (tags/taxonomy) clean so search stays reliable
- **Business goal:** Prevent duplicate/messy tags from degrading discovery for tutors and students.
- **Driving force:** Control / Oversight, Trust (in the data other personas depend on). Directly evidenced.
- **Persona:** Admin.
- **Feature(s):** Tag CRUD with deactivation and duplicate prevention (FR-26).
- **Source:** CourseWizard PRD §2.1 JTBD: *"When I manage the tag and taxonomy vocabularies, I want them clean and duplicate-free, so search and filtering stay reliable for tutors and students."*

### 12. Replace "grep the container logs by hand" with a queryable, prioritized error record
- **Business goal:** Find and fix real problems before a student/tutor has to report them; stop losing engineering attention to a firehose of unranked noise.
- **Driving force:** Control / Oversight, Reduced Anxiety (nothing invisible anymore), Efficiency (attention goes to what's ranked highest, not everything). Directly evidenced — this is the PRD's stated origin story.
- **Persona:** Admin (Master-role only in v1).
- **Feature(s):** Global unhandled-exception capture (FR-1), Frontend error capture (FR-6/FR-7), Rule-based auto-categorization (FR-9), Auto-priority assignment (FR-10), Admin Error Log UI (FR-11–FR-13).
- **Source:** ErrorObs PRD §1 Vision: *"diagnosing a real production issue this session required manually reading Docker container logs by hand, because no other option existed."* §2.1 JTBD: *"I need to see every failure across the system in one place, so I can find and fix real problems before a student or tutor has to report them"*; *"I need failures ranked by how bad they are without having to read every single one first, so I can spend my limited attention on what actually matters."*

### 13. Let the admin clear triaged noise without permanently losing the record
- **Business goal:** Support a sustainable triage workflow (act, then move on) without destroying the ability to detect a regression later.
- **Driving force:** Reduced Anxiety (nothing is truly gone, so acting on it feels safe), Control. Directly evidenced.
- **Persona:** Admin.
- **Feature(s):** Archive (FR-14), Mark as Resolved (FR-15), Auto-Reopen on regression (FR-16).
- **Source:** ErrorObs PRD §2.1 JTBD: *"when I've fixed something, I need a way to clear it out of my active queue without permanently losing the record — in case it comes back."*

### 14. Reward specific, earned achievement rather than generic hype
- **Business goal:** Sustain student motivation/retention through visible, credible progress signals.
- **Driving force:** Status / Recognition, Mastery. **[inferred — the copy/tone rule is directly sourced; the motivational-psychology framing (why specificity matters for sustained engagement) is our read.]**
- **Persona:** Student.
- **Feature(s):** Weekly Goal Card (Dashboard FR-6), Progress stat cards (FR-5), Mastery points/confetti threshold (Assignments FR-7).
- **Source:** EXPERIENCE.md Voice and Tone: *"FlexDemy celebrates specific, measurable achievement (a streak count, a point value, a passing threshold) rather than generic encouragement — the confetti and exclamation points are earned by a number crossing a line, not sprinkled by default."*

### 15. Let students learn with peers, not just individually
- **Business goal:** Increase engagement/retention via social learning options alongside solo progress.
- **Driving force:** Belonging. **[inferred — the JTBD is sourced; "belonging" as the named force is our label.]**
- **Persona:** Student.
- **Feature(s):** Group Study Pool requests (Dashboard FR-12), Public Live Masterclass browsing (FR-13), Study Rooms quick-join (FR-14).
- **Source:** Dashboard PRD §2.1 JTBD: *"When I want to learn with peers, I want to see group study and masterclass options alongside my individual progress."*

## Notes on confidence

Rows 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 are grounded in near-verbatim JTBD/Vision language from the PRDs — the driving-force *label* is inferred, but the underlying motivation is close to explicit. Rows 1, 2, 14, 15 lean more heavily on inference because the source text states the functional behavior clearly but is thinner on the *why*. No persona in this map was interviewed; all forces are the reconstructing analyst's best-fit reading of stated JTBDs, Vision sections, and EXPERIENCE.md tone/state-pattern language.
