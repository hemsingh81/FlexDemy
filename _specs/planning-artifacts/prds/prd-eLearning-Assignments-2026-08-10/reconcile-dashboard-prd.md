---
title: Input Reconciliation — Assignments PRD vs. base Dashboard PRD
created: 2026-08-10
---

# Reconciliation: `prd-eLearning-Assignments-2026-08-10/prd.md` vs. `prd-eLearning-2026-08-10/prd.md`

Base PRD: `_specs/planning-artifacts/prds/prd-eLearning-2026-08-10/prd.md` ("Dashboard — Role-Aware Merge of Dashboard + Tutor Hub & Booking"), status: final.
New PRD: `_specs/planning-artifacts/prds/prd-eLearning-Assignments-2026-08-10/prd.md` ("Assignments (Merged into Dashboard)"), status: draft.

## Finding 1 (High) — Fabricated "left-nav precedent" claim in §0

New PRD §0 states it "extends... the left-nav precedent this [base] PRD extends" — i.e., claims the base Dashboard PRD already shipped a left-side in-page section nav pattern. **This is false.** The base PRD's §4 describes Student/Tutor Dashboard as a stack of composed sections (§4.2–§4.5) with no navigation mechanism specified at all — no left nav, no anchor-jump, nothing. Base §5 Non-Goals even states "No redesign of individual widgets' visuals/interactions beyond what's needed to compose them into one page — this is a structural/routing merge, not a visual refresh," consistent with sections simply being stacked, not navigated via a dedicated left nav.

The new PRD's FR-2 instead cites `CourseOverviewScreen.tsx`'s existing anchor-jump pattern as the source of precedent — a different, unrelated component never mentioned in the base PRD. So the *actual* precedent (an existing pattern from `CourseOverviewScreen.tsx`) is real, but attributing it to "this [base] PRD" in the Document Purpose section is inaccurate and would mislead a reader checking the base document for a left-nav spec that isn't there.

**Recommendation:** Correct §0 to say the left-nav pattern is sourced from `CourseOverviewScreen.tsx` (an existing app component), not from the base Dashboard PRD, which never proposed a left nav.

## Finding 2 (High) — "Get Help from a Tutor" is not a section name used anywhere in the base PRD

New PRD FR-2 lists the Student Dashboard left-nav as: Weekly Goal, Adaptive Schedule, My Courses, Assignments, **Get Help from a Tutor**. UJ-1 in the new PRD also refers to clicking into this section by that label.

The base PRD's actual section covering tutor booking is titled **"Student Dashboard — Tutor Booking & Group Learning"** (§4.3) and its content spans FR-9–FR-14: browse/filter tutor slots, book a slot, My Booked Sessions, **Group Study Pool** requests, **Public Live Masterclass** browsing/registration, and the Synchronous Study Room quick-join / Recent Activity rail. Nowhere does the base PRD call this section (or any subsection of it) "Get Help from a Tutor." That label:
- Doesn't match the base PRD's own heading text ("Tutor Booking & Group Learning"), which a reader would expect the new PRD's nav label to echo per the stated intent of extending the base PRD's structure.
- Undersells the section's actual scope — Group Study Pool and Public Live Masterclass are peer/group-learning features, not "help from a tutor."
- Silently drops the Welcome banner/streak (FR-4) and stat cards/activity calendar (FR-5) from §4.2 out of the nav entirely (arguably fine if they're above-the-fold hero content rather than "sections," but the new PRD doesn't say so — it's an unstated assumption).

**Recommendation:** Either rename the nav entry to match/reference the base PRD's actual section name ("Tutor Booking & Group Learning," or split it into two entries reflecting Group Study Pool and Masterclass separately), or add an explicit note in §9 Assumptions Index explaining the rename and confirming Welcome banner/stat cards are intentionally excluded from nav (not a section).

## Finding 3 (Consistent — no issue) — Tutor Dashboard section names in FR-3 match base §4.4/§4.5 exactly

New PRD FR-3 lists Tutor Dashboard left-nav as: "Availability & Performance, Assignments, Course Publishing." This matches the base PRD's actual heading text verbatim:
- Base §4.4 = "Tutor Dashboard — **Availability & Performance**"
- Base §4.5 = "Tutor Dashboard — **Course Publishing**"

No drift here — this is the one place where the new PRD's terminology precisely mirrors the base document's §4 feature-group names, with "Assignments" correctly inserted between them. Flagging this only as a positive contrast to Finding 2 (Student-side naming), since it shows the base-PRD-alignment convention was followed correctly for Tutor but not Student.

## Finding 4 (Low) — FR numbering restarts at FR-1 without cross-reference

The new PRD restarts functional-requirement numbering at FR-1 (base PRD runs FR-1 through FR-19). This is reasonable for a standalone document, but because both PRDs describe the same Dashboard surface and a reader moves between them, bare references like "FR-3" or "FR-9" are ambiguous out of context (base FR-3 = Master/Support preview toggle; new FR-3 = Tutor Dashboard left-nav; base FR-9 = browse/filter tutor slots; new FR-9 = My Assignments list). The new PRD is generally good about qualifying its own FR-3 vs. citing base FRs elsewhere, but §9's own entry ("§4.1 FR-3 — Left-side section nav applies to both...") could be misread as base-PRD FR-3 by someone skimming after just having read the base doc's FR-3 (the Master/Support toggle).

**Recommendation:** No numbering change needed, but consider prefixing cross-document FR citations (e.g., "base PRD's FR-3" vs. "this PRD's FR-3") wherever both documents' FR-3 could appear in the same reading session — the new PRD already does this correctly in a few places (e.g., §2.2 references "existing Tutor-preview toggle" descriptively rather than by number) but not universally.

## Finding 5 (Low / gap, not a hard conflict) — Master/Support empty-demo Tutor Dashboard and the new Assignments section

Base PRD FR-3 says the Master/Support preview toggle renders "the full Tutor Dashboard UI (FR-15–FR-19) in an empty/demo state." Since Tutor Dashboard now also contains the new Assignments section (My Assignments, Create Assignment, Submissions review — new PRD FR-9–FR-15), the new PRD never explicitly states that the demo/empty-state behavior extends to the new Assignments section too. New PRD §4.1 FR-3's Out of Scope note ("left-nav for Master/Support demo view... reuses the same nav") implies but does not explicitly confirm that My Assignments/Submissions render in the same empty/demo state as the rest of the Tutor Dashboard for Master/Support sessions.

**Recommendation:** Add one sentence to new PRD §4.1 (or §9) confirming the Assignments section follows the same empty/demo-state rule as the rest of the Tutor Dashboard under the base PRD's FR-3 toggle — closes a small ambiguity a build-time reader would otherwise have to infer.

## Non-findings (checked, no conflict)

- **Glossary terms**: New PRD's Assignment/Submission/Visibility Mode/Auto-Score/Re-evaluate terms do not collide with or redefine any base PRD glossary term (Dashboard, Student/Tutor Dashboard, Tutor Slot, Booking, Group Study Pool, Public Live Masterclass, Synchronous Study Room, Weekly Goal, Adaptive Schedule, Course Creation Wizard). No overlap.
- **Nav-count arithmetic (SM-2)**: Base PRD SM-2 states nav goes from 7 top-level tabs to 6 after retiring Tutor Hub (dashboard, discover, groups, assignments, certificates, admin — tutor folded in). New PRD SM-2 states "6 (post Tutor-Hub-merge) to 5" after retiring the standalone Assignments tab. Arithmetic and the underlying tab inventory are consistent between the two documents.
- **`FRONTEND_PRD.md` supersession scope**: Base PRD supersedes §4.3 and §4.6; new PRD supersedes §4.8. No overlapping section claimed by both, no conflict.
- **Status field values**: Base is `final`, new is `draft` — expected and consistent with the stated build order (new PRD explicitly builds on an already-finalized base).
