# PRD Quality Review — Tutor Content Authoring — Wizard, Pages & Per-Page Resources

## Overall verdict

This is a rigorous, decision-dense PRD: the DDs carry real rationale and named costs, the brownfield grounding (§1.1's verified-against-`main` table) is unusually honest, and the FRs are testable enough to slice directly into the Appendix C story list. The risk is mechanical, not conceptual — a self-contradicting DD count in §0, an Assumptions Index that only half round-trips to inline tags, a dangling Appendix A cross-reference (FR-42), and one FR (FR-48) that never lands in a story. None of these block a build, but a chain-top PRD that explicitly tells engineers "an FR that contradicts a DD is a bug in this PRD" (§0) should not itself contain the DD-1…DD-10 vs. actual DD-1…DD-7 mismatch found here.

## Decision-readiness — strong

Decisions are stated as decisions (DD-1…DD-7), each with a named rationale and, where relevant, an explicit accepted cost — DD-3's "Cost, accepted: block identity is positional, so a block-level comment/anchor feature would need this revisited" is exactly the honest trade-off framing the rubric asks for, not a smoothed-over "balances everything." §6.3 goes further than most PRDs: it names the migration question as needing "a product decision, not an engineering default," ranks three options with a recommendation, and explicitly scopes the blocking radius ("Blocking for §6.3 only — every other part of this PRD can be built while it is open," OQ-1). Open Questions are genuinely open — OQ-3 and OQ-6 each state the tension and why the PRD chose not to resolve it rather than answering itself in the next sentence.

### Findings
- **medium** No `[NOTE FOR PM]` callouts anywhere in the document (§ whole doc) — the rubric's convention for flagging deferred decisions/unresolved tensions to a PM is absent; the two real PM-facing decisions (§6.3 migration option, OQ-6 confirmation granularity) are only reachable by reading prose and the Open Questions list end-to-end, not by grepping a callout marker. *Fix:* tag §6.3's option choice and OQ-6 with `[NOTE FOR PM]` so they're distinguishable from the lower-stakes OQ-2/OQ-3/OQ-5 items.

## Substance over theater — strong

No persona theater: there is exactly one named protagonist (Meera) reused across all four UJs, each of which drives a specific FR or edge case (UJ-3's delete-block-in-use edge case maps directly to FR-31; UJ-2's re-upload edge case maps directly to DD-6). No differentiation/innovation section was forced in — this is an internal capability expansion and reads like one. NFRs are specific, not boilerplate: FR-47 names `aria-live`, roving tabindex, and a concrete existing pattern to extend (`CourseContentEditor.tsx`'s "batched-announcement pattern"); FR-48 names a concrete guarantee ("nothing in this PRD introduces `dangerouslySetInnerHTML`") rather than "the system must be secure." The Vision (§1) is product-specific — "the tutor decides the shape of every page... Parsing and AI extraction propose; the tutor disposes" — and would not swap cleanly into an unrelated PRD.

No findings.

## Strategic coherence — adequate

The thesis is explicit and singular: "the tutor decides the shape of every page" (§1, closing line), and DD-2/DD-5/DD-6 all serve it directly (nodes hold no body; uploaded files are sources, not content; extraction is copy-on-insert so a tutor's edits can never be silently overwritten). Feature ordering in §6.1 follows the thesis (outline → wizard → pages → resources → extraction → lifecycle), not "what's easy first." Success Metrics are thesis-specific rather than activity metrics — each of M-1…M-5 states in parentheses exactly what failure mode it's catching (M-2: "whether the block palette is discoverable... or the tutor just typed prose"), which is the opposite of a DAU/MAU tell.

### Findings
- **medium** No counter-metric for M-3 (Strategic coherence, §7) — M-3 rewards Insert-from-file usage ("≥ 50% of pages... created via Insert from file"), but nothing measures whether extracted text is actually reshaped afterward. Given the thesis is "the tutor disposes," not "the tutor imports," a tutor who inserts-and-never-edits would score well on M-3 while quietly defeating DD-6's premise. *Fix:* add a guardrail metric, e.g. "% of extracted pages with at least one post-insert edit beyond the extraction," alongside M-3.

## Done-ness clarity — adequate

Most FRs carry a testable consequence: numeric bounds (FR-4's ≤200/≤2000 chars, Appendix A's "100 chapters/course... 25 MB/resource"), explicit state machines (FR-34's saved/saving/failed indicator), and named degradation behavior instead of hand-waving (FR-33: unsupported Markdown "preserved verbatim and shown as an uneditable-in-blocks 'raw' block, never silently dropped"; FR-28's Callout "degrading to a plain blockquote anywhere unsupported"). No instances of "handles gracefully" or "reasonable performance" were found.

### Findings
- **high** FR-42's code/text extension allowlist is never delivered (§4.5, Appendix A) — FR-42 says accepted code/text file types are "a bounded extension allowlist — see Appendix A," but Appendix A's data-model sketch contains no such list (only the Chapter/Topic/Subtopic/Page/Resource schema and the "Suggested bounded limits" note). An engineer cannot determine what a resource upload should accept or reject for this file class. *Fix:* either add the allowlist to Appendix A or state it inline in FR-42 and drop the cross-reference.
- **low** FR-16's partial-scaffold detection doesn't cover the sub-topic branch (§4.2) — "Continue" triggers on "a chapter with no topics, or a topic with no pages," but doesn't say what happens when a topic has sub-topics (with or without pages) and the topic itself has none — is the topic still "incomplete" for Continue purposes, or only its childless sub-topics? *Fix:* extend FR-16's parenthetical to state the rule for topics that have sub-topics.

## Scope honesty — strong

§5's Non-Goals section does real work (10 explicit items, several with a one-line reason, e.g. "Block-level anchors, per-block comments or per-block versioning. Directly precluded by DD-3"), and §6.2 separately and honestly names MVP de-scopes ("Out of scope for MVP (named, not forgotten)") rather than leaving them to be inferred from what §6.1 doesn't mention. Two inline `[ASSUMPTION: …]` tags (FR-20, FR-44) are used precisely at the two places where the PRD is guessing at something unverified rather than stating fact. Open-items density (6 OQs, 6 Assumptions-Index entries, 0 NOTE-FOR-PM) is proportionate for a 48-FR chain-top brownfield PRD — not inflated.

### Findings
- **medium** Assumptions Index only half round-trips to inline tags (§9) — see Mechanical notes; A-3 through A-6 are indexed without a corresponding inline `[ASSUMPTION: …]` marker, so a reader scanning the body for bracketed assumptions will miss four of the six.

## Downstream usability — adequate

The Glossary (§3) is used consistently — "Page," "Resource role," "Confirmation," "Node" all appear in FR text with the same meaning defined there, and Appendix A's enum (`Unconfirmed`/`Confirmed`) matches the Glossary's Confirmation entry exactly. FR IDs (FR-1…FR-48), JTBD IDs (1…7), UJ IDs (1…4), OQ IDs (1…6), and Assumption IDs (A-1…A-6) are all contiguous with no gaps or duplicates. UJs each have a named, consistent protagonist (Meera) — no floating UJs. Appendix C maps almost every MVP FR to a story with explicit dependencies.

### Findings
- **high** §0's DD count contradicts the document's own content (§0, line 26 vs. §6.1) — §0 states "Named design decisions are DD-1 … DD-10 and are the load-bearing part of this document," but only DD-1 through DD-7 exist anywhere in the PRD (confirmed by full-text search), and §6.1 itself correctly scopes MVP as "DD-1 … DD-7." For a document that says elsewhere "an FR that contradicts a DD is a bug in this PRD, not a licence to improvise," getting its own DD range wrong in the framing section undermines exactly the traceability this PRD is trying to establish for downstream readers. *Fix:* correct §0 line 26 to "DD-1 … DD-7."
- **medium** FR-48 is not assigned to any story in Appendix C (Appendix C) — every other FR in scope (FR-1…FR-23, FR-25…FR-47) appears in at least one story's FR list; FR-48 ("Safety and scale" — bounded limits, ownership guards, no-raw-HTML guarantee) does not appear in any of C-1…C-11. It's plausible it's meant to be distributed implicitly across every story, but that's not stated, and an unassigned cross-cutting FR is easy for sprint planning to drop. *Fix:* either add FR-48 explicitly to C-1 (server-side bounds) and C-7 (renderer guarantee), or add a note that it's a cross-cutting acceptance criterion applied to every story touching persistence/rendering.

## Shape fit — strong

Brownfield treatment is a standout: §1.1's table cites exact file/entity names, line counts (`CourseContentEditor.tsx`, 492 lines), and the specific commit that removed the prior content-tree implementation (`f3131d9`), and DD-1 explicitly distinguishes "re-introduces the outline" from "revert `f3131d9`" — new vs. prior implementation is never left ambiguous. As a chain-top PRD, the extra rigor in Appendix A/B/C (data model sketch, API surface sketch, story slicing with dependency edges) is appropriate rather than over-formalized, since UX design, architecture, and story creation are named consumers in §0. UJ density (one protagonist, four UJs) fits a single-operator-role authoring tool without being under-formalized for a feature with genuine UX surface (wizard + block editor + resource panel).

### Findings
- **low** Appendix A edges toward architecture-phase decisions (Appendix A) — the repository-pattern call ("One `IContentRepository` for the whole outline, not five per-entity repositories") and the CLR-default ordinal rationale for the `Confirmation` enum are implementation choices, not product requirements. The PRD self-labels these as a "sketch" and cites precedent (`Story 2.9`, the `LifecycleState` EF Core bug), which mitigates this, but a downstream architecture pass should treat Appendix A as a strong suggestion, not a foregone conclusion. *Fix:* none required; consider a one-line disclaimer that Appendix A is non-binding on the architecture phase, consistent with how DD/FR are described as binding but Appendix content is not.

## Mechanical notes

- **DD count mismatch.** §0 (line 26) claims "DD-1 … DD-10"; only DD-1…DD-7 exist in the document, and §6.1 (line 408) correctly states "DD-1 … DD-7." See Downstream usability finding above.
- **Assumptions Index roundtrip is partial.** Only two inline `[ASSUMPTION: …]` bracket tags exist in the body (FR-20 at line 276, FR-44 at line 364), corresponding to A-1 and A-2. A-3 (§4.4, re: `lib/markdown.ts` coverage), A-4 (DD-3, re: block identity), A-5 (§4.5, re: inheritance direction), and A-6 (§6.3, re: migration option preference) are indexed but have no inline bracketed marker at the sections they cite — a reader scanning the body text alone would not discover them as assumptions distinct from stated fact.
- **Broken cross-reference.** FR-42 (§4.5) points to Appendix A for the code/text file extension allowlist; Appendix A does not contain one (see Done-ness clarity finding above).
- **FR ID continuity is otherwise clean.** FR-1…FR-48 contiguous; JTBD-1…7, UJ-1…4, OQ-1…6, A-1…6, M-1…6 all contiguous, no duplicates found.
- **No `[NON-GOAL for MVP]` inline tags** are used, but §5 (Non-Goals) and §6.2 (Out of scope for MVP) together cover the same ground in full prose sections — functionally equivalent, just not tagged in that specific convention.
- **Glossary usage is consistent** across FRs/DDs/UJs — no case, plural, or synonym drift found for the 13 defined terms (Outline, Node, Description, Page, Block, Page body, Resource, Resource role, Source file, Extraction, Content Wizard, Workspace, Confirmation).
