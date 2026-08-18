# Validation Report — Tutor Content Authoring — Wizard, Pages & Per-Page Resources

- **PRD:** `_specs/planning-artifacts/prds/prd-eLearning-ContentAuthoring-2026-08-16/prd.md`
- **Rubric:** `.claude/skills/bmad-prd/assets/prd-validation-checklist.md`
- **Run at:** 2026-08-16
- **Grade:** Fair

## Overall verdict

This is a rigorous, decision-dense PRD: the design decisions carry real rationale and named costs, the brownfield grounding (§1.1's verified-against-`main` table) is unusually honest, and the FRs are testable enough to slice directly into the Appendix C story list. The rubric pass found the risk mechanical rather than conceptual — a self-contradicting DD count in §0, an Assumptions Index that only half round-trips to inline tags, a dangling Appendix A cross-reference (FR-42), and one FR (FR-48) that never lands in a story.

The adversarial pass materially shifts that picture. It cross-checked the PRD's claims against the actual codebase (`git show f3131d9`, `CourseService.MoveToReviewAsync`, `LifecycleState`) and surfaced substantive gaps the rubric pass couldn't see from the document alone: FR-45's new confirmation gate never reconciles with the file-parsed check that exists in code today; a brand-new `Confirmation` concept collides in name with the existing `ReviewConfirmed` lifecycle state; the publish/versioning pipeline (heavily rewritten in the same commit that removed the old content tree) is never addressed for the new Page/Resource graph; and Appendix B's entire API is gated to tutor-owned-Draft with no stated access path for student or reviewer consumption of the same resources — a real authorization gap. It also flagged an SVG upload path (FR-42) with no XSS discussion despite FR-48's no-raw-HTML guarantee. These argue for a resolution pass before this PRD is treated as build-ready, even though none of them individually break the PRD's structure.

## Dimension verdicts

- Decision-readiness — strong
- Substance over theater — strong
- Strategic coherence — adequate
- Done-ness clarity — adequate
- Scope honesty — strong
- Downstream usability — adequate
- Shape fit — strong

## Findings by severity

### High (2)

**[Downstream usability]** — §0's DD count contradicts the document's own content (§0 vs §6.1)
§0 states "Named design decisions are DD-1 … DD-10," but only DD-1 through DD-7 exist anywhere in the PRD, and §6.1 correctly scopes MVP as "DD-1 … DD-7."
Fix: Correct §0 to "DD-1 … DD-7."

**[Done-ness clarity]** — FR-42's code/text extension allowlist is never delivered (§4.5, Appendix A)
FR-42 points to Appendix A for a "bounded extension allowlist" that Appendix A does not contain. An engineer cannot determine what a resource upload should accept or reject for this file class.
Fix: Add the allowlist to Appendix A, or state it inline in FR-42 and drop the cross-reference.

### Medium (5)

**[Decision-readiness]** — No [NOTE FOR PM] callouts anywhere in the document (§ whole doc)
The two real PM-facing decisions (§6.3 migration option, OQ-6 confirmation granularity) are only reachable by reading prose end-to-end.
Fix: Tag §6.3's option choice and OQ-6 with [NOTE FOR PM].

**[Strategic coherence]** — No counter-metric for M-3 (§7)
M-3 rewards Insert-from-file usage but doesn't measure whether extracted text is reshaped afterward, letting a tutor who never edits score well while defeating DD-6's premise.
Fix: Add a guardrail metric, e.g. "% of extracted pages with at least one post-insert edit beyond the extraction."

**[Scope honesty]** — Assumptions Index only half round-trips to inline tags (§9)
A-3 through A-6 are indexed without a corresponding inline [ASSUMPTION: …] marker.
Fix: Add inline markers at the sections A-3…A-6 cite, or note in §9 that some entries are body-implicit.

**[Downstream usability]** — FR-48 is not assigned to any story in Appendix C
Every other in-scope FR appears in at least one story's FR list; FR-48 ("Safety and scale") does not appear in C-1…C-11.
Fix: Add FR-48 explicitly to C-1 and C-7, or note it's a cross-cutting acceptance criterion.

**[Adversarial]** — (See below — adversarial findings are reported without severity per its review method; treat all as worth triaging, several are functionally high-impact: the FR-45/MoveToReviewAsync gate conflict, the Confirmation naming collision, the Appendix B authorization gap, and the missing publish/versioning story stand out.)

### Low (3)

**[Done-ness clarity]** — FR-16's partial-scaffold detection doesn't cover the sub-topic branch (§4.2)
Doesn't say what happens when a topic has sub-topics and the topic itself has none.
Fix: Extend FR-16's parenthetical to state the rule for topics that have sub-topics.

**[Shape fit]** — Appendix A edges toward architecture-phase decisions (Appendix A)
The repository-pattern call and CLR-default ordinal rationale are implementation choices, self-labelled as a "sketch."
Fix: None required; consider a one-line disclaimer that Appendix A is non-binding on the architecture phase.

**[Substance over theater]** — No findings; dimension is strong.

### Unranked — Adversarial review (17 findings)

Reported by method as a flat list, no severity ranking. Full text in `review-adversarial-general.md`; the most consequential:

1. §1.1's "what exists today" table understates `f3131d9`'s actual scope (the AI gateway slice and rewritten Publish/VersionService are omitted).
2. FR-45's confirmation gate never reconciles with `CourseService.MoveToReviewAsync`'s existing file-parsed check.
3. "Confirmation" (FR-44, per-node/page) collides in name with the existing `LifecycleState.ReviewConfirmed` (course-level, reviewer-driven).
4. DD-2's "flat page sequence" claim is contradicted by FR-5's node-level Description cards.
5. FR-10's "What you'll learn" bullet list has no field in Appendix A's data model.
6. FR-42's Appendix A extension allowlist doesn't exist (corroborates the rubric's high finding).
7. FR-8 + DD-7 leave in-body resource references dangling after a page move across ancestries.
8. FR-6's cascade-delete wording omits node-owned resources' fate.
9. FR-42 permits SVG uploads with no XSS/script-surface discussion.
10. Appendix B has no access path for student/reviewer resource consumption — every route is tutor-owned-Draft-only.
11. §6.3 understates migration risk: DD-5 can blank live Draft courses before the backfill (C-11) ships.
12. The recommended migration option (§6.3 option 1) silently depends on FR-20's unverified `[ASSUMPTION]` / OQ-4.
13. The publish/versioning pipeline is never addressed for the new Page/Resource graph.
14. FR-44 doesn't define confirmation-reset behavior for a page move touching two nodes.
15. The reviewer-rejection path (InReview → Draft) is never addressed.
16. M-2/M-3/M-4 lack a measurement window, cohort, or denominator rule.
17. DD-6's copy-on-insert stance creates unflagged content staleness after a source re-upload.

## Mechanical notes

- DD count mismatch: §0 says "DD-1 … DD-10"; only DD-1…DD-7 exist; §6.1 has it right.
- Assumptions Index roundtrip is partial: only A-1 (FR-20) and A-2 (FR-44) have inline tags; A-3…A-6 don't.
- Broken cross-reference: FR-42 → Appendix A allowlist that isn't there.
- FR/JTBD/UJ/OQ/A/M ID continuity is otherwise clean, no gaps or duplicates.
- No [NON-GOAL for MVP] inline tags used, but §5/§6.2 cover the same ground in prose.
- Glossary usage is consistent across the 13 defined terms.

## Reviewer files

- `review-rubric.md`
- `review-adversarial-general.md`
