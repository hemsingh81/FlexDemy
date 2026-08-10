# Reconciliation: `FrontEnd/docs/FRONTEND_PRD.md` vs new Assignments PRD

Source documents:
- Old: `FrontEnd/docs/FRONTEND_PRD.md` (106 lines, read in full)
- New: `_specs/planning-artifacts/prds/prd-eLearning-Assignments-2026-08-10/prd.md` (read in full)

## 0. Note on the example gaps named in the task prompt

The task prompt suggested checking for "AI Learning Insight & Gap Analysis" and a "Personalized Tips" panel as possible dropped details. **Neither of these phrases, nor anything resembling them, appears anywhere in `FRONTEND_PRD.md`** (confirmed by reading the full file, not just §4.8). Old §4.8 in its entirety is only three bullets: Multiple-Choice Quizzes, File Upload, Grading Report. So there is nothing to reconcile on those two specific items — they aren't in the source doc to begin with. Flagging this explicitly so it isn't mistaken for an oversight in this reconciliation.

## 1. Concrete details in old §4.8 missing or contradicted in the new PRD

Old §4.8 verbatim:
```
- Multiple-Choice Quizzes: Interactive option picker with instant explanation feedback upon submission.
- File Upload: Drag-and-drop file attachment for code scripts (.py, .js) or essay PDFs.
- Grading Report: Auto-calculated percentage, mastery points award (+150 pts), and celebratory confetti animations.
```

Findings, bullet by bullet:

- **"Instant explanation feedback upon submission" — not carried forward as an explicit requirement.** New PRD FR-6 says opening an assignment "renders the existing multiple-choice quiz UI (question, options grid, submit) unchanged, regardless of Source," and FR-7 says immediate-visibility submission shows "today's unchanged flow (score %, confetti/points threshold at ≥70%)." Preservation of this behavior is implied by "unchanged" but the per-question explanation-feedback-on-submit behavior itself is never itemized as its own testable requirement anywhere in the new PRD (§4.2, §4.3, or the Glossary). A builder reading only the new PRD would not learn that this behavior needs to exist/persist — they'd have to already know it from the codebase.

- **File Upload — not dropped, explicitly and correctly disposed of.** New PRD §5 Non-Goals states: "No wiring of the existing decorative file-upload input (`AssignmentsView.tsx`'s upload field is already non-functional today — local state only, never submitted) — untouched by this PRD." This is a good-faith, accurate supersession of the old bullet (which described the file-upload as if functional; the new PRD corrects that it was always decorative/non-functional). Not a gap — flagged only for completeness since the task asked about it directly.

- **Grading Report — partially preserved, one value silently genericized.**
  - "Auto-calculated percentage" → preserved (FR-7: "score %").
  - "mastery points award (+150 pts)" → the new PRD only ever says "points" (FR-7, Glossary "Auto-Score" entry) and never restates or re-confirms the specific **+150 pts** figure. Not a contradiction, but a concrete numeric detail from the old PRD is silently dropped rather than carried over or explicitly deferred.
  - "celebratory confetti animations" → preserved by reference ("confetti/points threshold at ≥70%, unchanged" in FR-7), but see §2 below on tone.
  - New PRD adds a "≥70%" confetti/points threshold that does not appear anywhere in old §4.8. This is new specificity (presumably reverse-engineered from `AssignmentsView.tsx`), not a contradiction — just worth noting it's an addition, not confirmed as already-documented old-PRD behavior.

## 2. Qualitative/tone aspects dropped in the conversion to FR-based language

- Old §4.8 uses evocative, feature-marketing language ("celebratory confetti animations," "Interactive option picker with instant explanation feedback"). The new PRD converts this into flat, testable FR prose ("confetti/points threshold at ≥70%, unchanged"). This is expected and appropriate for a requirements document, but it does mean the "delight"/celebration framing that existed as an explicit design intent in the old PRD is no longer stated as an intent anywhere in the new document — it survives only as a parenthetical "unchanged" pointer back to current behavior, not as a described experience goal. If `AssignmentsView.tsx` or the confetti behavior is ever refactored (§4.6 NFR explicitly calls for refactoring the grading mechanic into a shared piece), there's no explicit requirement in the new PRD preserving the *celebratory* framing — only the score/points mechanic and the ≥70% threshold are named as things that must stay "unchanged."
- Old PRD's Executive Summary / §3 Design System establish an overall "high-density," "crisp, high-contrast," "celebratory" visual tone for the app. The new PRD is scoped tightly to functional/data-model behavior (Draft/Published, Submitted/Reviewed, Source badges) and does not restate or cross-reference these tonal/visual-system commitments for the new Assignments-section UI (My Submissions table, creation form, Submissions review view) beyond the one NFR line about WCAG 2.1 AA carry-over (§4.6). There's no explicit statement that the new tutor creation/review screens should follow the existing "crisp, high-contrast... rounded cards... indigo/amber accent" visual language from old §3 — it's presumably assumed via general app consistency, but not stated as a requirement the way accessibility carry-over was.

## 3. Other "Assignment" references elsewhere in FRONTEND_PRD.md not accounted for

- **§4.1 Navigation & Header — nav tab list still literally includes "Assignments," and the new PRD's own doc-update scope doesn't cover fixing it.** Current §4.1 text: "active tab links (*Home, Dashboard, Group Study, Assignments, Certificates*, plus Admin for permitted roles)... The former standalone "Tutor Hub" tab is retired — its content now lives inside the role-aware Dashboard (§4.3)." Two problems:
  1. "Assignments" is still named as a top-level nav tab in this list, which the new PRD's FR-1 explicitly retires. This line will be stale/contradictory the moment FR-1 ships.
  2. The prior Tutor Hub merge PRD set a precedent of adding an explicit retirement note in §4.1 itself (the "former standalone Tutor Hub tab is retired..." sentence quoted above). The new Assignments PRD does not follow that same precedent — its MVP doc-update scope (§6.1) states only: *"Updating `FrontEnd/docs/FRONTEND_PRD.md` §4.8 to reflect the merged structure."* §4.1 is not listed. So even after this PRD ships and §4.8 is rewritten, §4.1's nav-tab list is left inconsistent (still naming "Assignments" as a live tab) unless someone remembers to fix it outside the PRD's stated scope.

- **§4.4 Course Overview & Preview Screen — "assignment badges" in the Course Syllabus display not addressed.** §4.4 bullet 1 reads: "**1. Course Syllabus**: Modules, lesson duration, assignment badges, and instant lesson launcher." This describes a per-lesson visual badge (in the course syllabus view, not the Dashboard) indicating a lesson has an attached assignment/quiz. The new PRD never mentions this badge, doesn't say whether it's retained, renamed, or how/whether it relates to the new Source badges introduced in FR-5 (Available Assignments list). It's a different UI surface (Course Overview screen, §4.4) from anything the new PRD touches (Dashboard, §4.3), so it's plausibly just untouched/out-of-scope — but the new PRD doesn't say so explicitly, and a reader can't tell whether this was a deliberate omission or an oversight.

- **§4.9 Certificates & Leaderboard — indirectly related, not a gap.** Certificates/Leaderboard reference "points" and "streak days" which tie conceptually to the mastery-points mechanic in old §4.8's Grading Report. The new PRD doesn't touch §4.9 and doesn't need to — no assignment-specific point-total or leaderboard-integration requirement was in old §4.8 to begin with, so nothing is missing here. Noted only to confirm it was checked.

- **§6 Frontend State Management** — no `Assignment[]`/`Submission[]` entry exists in old §6's state list (only `UserProfile`, `Course[]`, `TutorSlot[]`, `StudyGroupRoom[]`). The new PRD's §4.6 NFR ("New mock service layer required... Phase B needs a new mock service") correctly identifies this gap and proposes to fill it — not a missed reference, just confirming the old doc's state-management section was already silent on assignments (consistent with old §4.8 being quiz-picker-only, no persistence).

## Summary Table

| # | Item | Old §4.8 / doc location | New PRD disposition | Verdict |
|---|---|---|---|---|
| 1 | Instant explanation feedback on quiz submit | §4.8 bullet 1 | Implied via "unchanged" (FR-6/FR-7), never itemized | Gap — implicit only |
| 2 | Decorative file upload | §4.8 bullet 2 | Explicitly named in §5 Non-Goals, correctly re-characterized | Not a gap |
| 3 | "+150 pts" specific mastery-points value | §4.8 bullet 3 | Genericized to "points," figure dropped | Minor gap |
| 4 | "≥70%" confetti/points threshold | Not in old PRD at all | Added in new FR-7 | New addition, not a contradiction |
| 5 | Celebratory/tone framing of confetti | §4.8 bullet 3 + Exec Summary tone | Reduced to flat FR + "unchanged" pointer | Tone dropped |
| 6 | Visual design-system carry-over (§3) for new screens | §3 | Only WCAG/a11y carry-over stated (§4.6); visual language not restated | Tone/scope gap |
| 7 | §4.1 nav tab list still says "Assignments"; no retirement note added there | §4.1 | New PRD's §6.1 doc-update scope only names §4.8, not §4.1 | Gap — will leave doc inconsistent |
| 8 | "assignment badges" in Course Syllabus (§4.4) | §4.4 bullet 1 | Not mentioned/addressed | Gap — unclear if in/out of scope |
| 9 | "AI Learning Insight & Gap Analysis," "Personalized Tips" panel | Not present anywhere in old doc | N/A | Not a real gap — items don't exist in source |
