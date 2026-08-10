---
title: Input Reconciliation — Assignments PRD vs. DESIGN.md / EXPERIENCE.md
status: draft
created: 2026-08-10
---

# Reconciliation: prd-eLearning-Assignments-2026-08-10 vs. ux-eLearning-2026-08-10 spines

Source PRD: `_specs/planning-artifacts/prds/prd-eLearning-Assignments-2026-08-10/prd.md`
Spines checked: `DESIGN.md`, `EXPERIENCE.md` (both dated 2026-08-10, `status: draft`)

## 1. Component Patterns / State Patterns tables vs. PRD Assignments behavior

**Accurate, no drift found on the three specifically-flagged mechanics:**
- Immediate vs. Hold (FR-7/FR-8): `EXPERIENCE.md` Component Patterns "Quiz runner" row and State Patterns "Hold-visibility submitted" / "Immediate-visibility submitted" rows correctly capture the full-reveal-vs-no-reveal branch, including the FR-8 nuance that Hold withholds *per-question* correctness (not just the score) — matches "no score element rendered" / prevents inferring the score.
- Review vs. Re-evaluate (FR-14/FR-15): Component Patterns "Submissions review modal" row ("Review = one-time confirm-and-reveal... Re-evaluate = a separate, always-available manual override... never the same button") correctly mirrors the PRD's explicit FR-14 Out-of-Scope note that Review is confirm-and-publish only, with score editing reserved for the distinct Re-evaluate action.
- Three-Source badge (FR-5): "Available Assignment card" row ("Source badge (Course/Tutor/Competition) always visible... 'Attempt' CTA swaps to a status pill once a submission exists — never both") accurately reflects FR-5 and the SM-C1 counter-metric (badge must never be de-emphasized).

**Gap — mastery points/confetti timing entirely omitted (see also §4):** Neither table represents FR-14's points-award-on-publish behavior or FR-15's points-delta-on-Re-evaluate behavior. Not contradicted, just absent — see §4 for detail, since this is also directly the target of check #4.

**Minor omission:** FR-13's consequence that Submitted (pending) rows must be "visually distinguished from Reviewed ones so the tutor can spot pending work at a glance" isn't captured in either table (Component Patterns' "Submissions review modal" row describes the two actions but not the pending/reviewed visual distinction). Low-severity — likely intended to live in a future Composition/mockup pass, but currently not stated anywhere in either spine.

## 2. Key Flows UJ-1 (Aditi) / UJ-2 (Raj, assignments) vs. PRD text

Content-wise, both flows are faithfully condensed from the PRD's §2.3 UJ-1/UJ-2 — no material drift found. Path, Climax, Resolution, and Edge case all line up sentence-for-sentence (trimmed rationale clauses like "if he disagrees with the auto-grade," not substance).

**Structural issue — duplicate UJ-1/UJ-2 labels:** `EXPERIENCE.md`'s "Key Flows" section contains two journeys titled "UJ-1" (Priya, from the base Dashboard PRD; Aditi, from this Assignments PRD) and two titled "UJ-2" (Raj/Dashboard-teaching-day, base PRD; Raj/assignments-creation, this PRD). Each source PRD numbers its own journeys independently (confirmed in this PRD's header note: "this PRD's FR numbering restarts at FR-1... Don't assume a bare 'FR-3' means the same thing in both documents") — the same caution applies to UJ numbers, but `EXPERIENCE.md` does not disambiguate them (e.g., no PRD-prefix or UJ-1a/UJ-1b scheme). A reader citing "UJ-2" against this spine has a 50% chance of resolving to the wrong journey. Recommend distinguishing labels (e.g., "UJ-1 (Dashboard PRD)" / "UJ-1 (Assignments PRD)") in a later pass.

## 3. Information Architecture

Correct on both points checked:
- Assignments appears only as a Dashboard section in the IA table's Student/Tutor row content ("...My Courses → Assignments → Tutor Booking..." / "...Availability & Performance → Assignments → Course Publishing"), not as its own IA row/surface — matches FR-1's tab retirement and FR-2/FR-3's section-nav placement.
- Course Player's entry: `"Start/Resume/Continue Learning," or a lesson's "Take Quiz" (→ Dashboard Assignments)` correctly reflects FR-16's rewire of `onOpenAssignment` into the Dashboard.

**Not captured (minor, arguably below IA-table altitude):** FR-16's actual testable payload — fixing the pre-existing deep-link bug so "Take Quiz" opens the specific `Lesson.assignment.id` rather than `assignments[0]` — isn't mentioned anywhere in `EXPERIENCE.md`. The IA table only needs to show the entry point exists, so this is likely fine as-is, but if a later Composition/flow doc doesn't pick up the bug-fix requirement either, it risks being dropped before implementation.

## 4. Mastery-points/confetti behavior for Hold-then-Reviewed (FR-14 [ASSUMPTION])

**Omitted, not contradicted — but omitted entirely.** The PRD's FR-14 consequence block states two specific, non-obvious behaviors:
1. Mastery points (+150 at ≥70%) are awarded at the moment the tutor publishes the Review, not retroactively at original submission time (`[ASSUMPTION]`, flagged `[NOTE FOR PM]` re: leaderboard/streak implications).
2. The confetti celebration fires for the *student*, client-side, the next time they view the now-Reviewed submission — explicitly *not* for the tutor during Review.

FR-15 adds a third: Re-evaluate adjusts the student's already-awarded points by the delta between old and new score (also `[ASSUMPTION]`, also flagged `[NOTE FOR PM]` re: the "claw back points" trust tradeoff).

None of this appears in `EXPERIENCE.md`. The State Patterns table has rows for "Hold-visibility submitted" (at the moment of submission) and "Immediate-visibility submitted," but no row for the transition state — "a Hold submission that has just been Reviewed, viewed by the student for the first time" — which is exactly where points-award-timing and delayed-confetti live. The Key Flows UJ-1 (Aditi) Resolution line ("once a held submission is reviewed, its status flips to 'Reviewed' and the score appears") gestures at the transition but stops short of the points/confetti mechanics. Re-evaluate's point-delta behavior (FR-15) is likewise absent from the "Submissions review modal" Component Patterns row, which only describes the override action, not its point-total side effect.

Since both PRD behaviors are explicitly tagged `[ASSUMPTION]` with `[NOTE FOR PM]` (i.e., genuinely unsettled, product-risk items), their complete absence from the UX spine means a downstream DESIGN/build pass has no signal that these are open, revisit-worthy product decisions — they could easily get built silently one way or the other without anyone flagging the ambiguity again. Recommend adding an explicit State Patterns row (or a `[NOTE FOR UX]`/`[OPEN QUESTION]` callout mirroring the PRD's own tagging) for the Hold→Reviewed transition and the Re-evaluate point-delta.

## 5. PRD content materially relevant but missing from the UX spines

- **FR-12 Out of Scope / no live-editable Published assignments:** The PRD states a tutor must un-publish (return to Draft) an assignment before editing it once students have submitted, and separately flags this as real workflow friction worth revisiting (`[NON-GOAL for MVP]` + `[NOTE FOR PM]`). Neither `DESIGN.md` nor `EXPERIENCE.md` mentions this constraint anywhere (Component Patterns' "Assignment creation modal" row only covers Draft-vs-Publish at creation time, not the edit-after-publish restriction). Since this directly shapes the tutor-side My Assignments UI (does an already-Published assignment show an "Edit" action, an "Unpublish" action, both, or neither?), its absence is a real gap for whoever builds that screen next.
- **Non-Goal — Course Overview's existing "assignment badges" vs. new Dashboard Source badges:** The PRD explicitly notes these are a different, untouched surface, and that their relationship to the new Source badges (Course/Tutor/Competition) is "left for a later pass" — an acknowledged open seam. `EXPERIENCE.md`'s IA table lists Course Overview's syllabus content without flagging this seam, so a reader could reasonably (and wrongly) assume the two badge systems are already reconciled. Low severity given the PRD itself defers it, but worth a one-line note given SM-C1's emphasis on Source-badge clarity.
- **FR-3 Master/Support empty-demo Assignments behavior:** PRD FR-3 consequence specifies that under the Master/Support Tutor-preview toggle, "My Assignments and Submissions render empty... since Master/Support are not registered tutors." `EXPERIENCE.md`'s Foundation section states the general Master/Support toggle exists but doesn't carry this Assignments-specific empty-state rule forward into State Patterns (whose two "Empty" tutor-side rows don't distinguish "genuinely no assignments yet" from "Master/Support preview, will never have assignments"). Minor — likely mergeable into the existing empty-state rows, but currently unstated.
- Glossary terms (Assignment Status: Draft/Published as an assignment-level status, distinct from Submission Status: Submitted/Reviewed) are used correctly and consistently throughout both spines — no gap there, called out for completeness since it was in scope to check.

## Summary Severity

| # | Finding | Severity |
|---|---|---|
| 1 | Points-award-on-publish (FR-14) and points-delta-on-Re-evaluate (FR-15) entirely unrepresented in State/Component Patterns | Medium — both are tagged `[ASSUMPTION]`+`[NOTE FOR PM]` in the PRD; silent omission risks losing the flagged ambiguity |
| 2 | Confetti-on-next-view-of-Reviewed-Hold-submission not represented | Medium — same root cause as #1 |
| 3 | Duplicate UJ-1/UJ-2 labels (Dashboard PRD vs. Assignments PRD) with no disambiguation | Low-Medium — citation ambiguity risk, not a content error |
| 4 | No-live-edit-of-Published-assignments constraint (FR-12) missing from both spines | Medium — directly affects an unbuilt tutor screen's action set |
| 5 | Course Overview "assignment badges" vs. Dashboard "Source badges" seam not flagged | Low |
| 6 | Master/Support empty-demo Assignments-specific empty state not carried into State Patterns | Low |
| 7 | FR-13 pending-vs-reviewed visual distinction not stated | Low |
