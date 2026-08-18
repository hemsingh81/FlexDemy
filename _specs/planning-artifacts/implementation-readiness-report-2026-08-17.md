---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - _specs/planning-artifacts/prds/prd-eLearning-ContentAuthoring-2026-08-16/prd.md
  - _specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md
  - _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md
  - _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/DESIGN.md
  - _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/EXPERIENCE.md
  - _specs/planning-artifacts/epics-ContentAuthoring.md
scopeNote: >
  Assessment scoped to the ContentAuthoring track. Other PRDs/epics (epics.md,
  epics-AdminSettings.md, epics-ErrorObservability.md and their source PRDs) are
  excluded as already-shipped or separately-tracked work, consulted only to confirm
  the project's continuous epic-numbering sequence.
---

# Implementation Readiness Assessment Report

**Date:** 2026-08-17
**Project:** eLearning

## Document Inventory

**PRD:** `prd-eLearning-ContentAuthoring-2026-08-16/prd.md` (status: draft; created and reconciled 2026-08-16/17 this session)
**Architecture:** `architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md` (frontend, AD-9/AD-10/AD-11/AD-12 added, AD-4 amended) + `architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md` (backend, AD-28/AD-29 added, AD-17/AD-20 amended), both `status: final`, updated 2026-08-17
**UX:** `ux-eLearning-2026-08-10/` (`DESIGN.md` + `EXPERIENCE.md`, bmad-ux spine pair), both `status: final`, updated 2026-08-17
**Epics & Stories:** `epics-ContentAuthoring.md` — 5 epics (Epic 7–11), 15 stories, all 48 FRs and 14 UX-DRs covered

No whole/sharded duplicate-format conflicts found — this project uses one run-folder per document, not sharded index.md splits.

**Critical issue found and fixed during this step:** `epics-ContentAuthoring.md` was originally authored as Epic 1–6, but this project uses **one continuous epic-number sequence across all PRDs** — `epics.md` already occupies Epic 1–3, `epics-ErrorObservability.md` occupies Epic 4, `epics-AdminSettings.md` occupies Epic 5–6 (confirmed against both that file and `sprint-status.yaml`). Renumbered `epics-ContentAuthoring.md` to **Epic 7–11** (all internal cross-references, story numbers, and the FR coverage map updated to match) before this inventory was finalized — the same class of issue the AdminSettings track's own readiness check (2026-08-15) caught and fixed. The dropped "Migration" item (§6.3, not needed at this development stage) was given no epic number at all, so it can never collide with a real epic in the sequence.

## PRD Analysis

### Functional Requirements

FR1: A course has an ordered list of Chapters. A Chapter has an ordered list of Topics. A Topic has an ordered list of Sub-Topics. Depth is fixed at three; there is no fourth level.
FR2: A Page attaches to exactly one node, which may be a Chapter, a Topic, or a Sub-Topic. Pages are ordered within their node.
FR3: Sub-Topics are optional. A Topic with pages and no sub-topics is a complete, valid, publishable structure.
FR4: Every node has: Name (required, ≤200 chars), Description (optional, ≤2000 chars, Markdown-lite: paragraphs and bullets only), optional cover image, ordered resources, confirmation state.
FR5: A node's Description renders to students as a section-opening card before that node's first page.
FR6: Deleting a node cascades to its descendants, their pages, and every resource owned by the node or any descendant node/page. Delete is confirm-gated and states the exact count being destroyed, broken out by kind.
FR7: Nodes and pages reorder within their sibling group via drag-and-drop and via keyboard-accessible move-up/move-down controls.
FR8: A page can be moved to a different node in the same course. Its own resources and body move with it; inherited node resources are re-resolved against the new ancestry (in-body resource references are NOT auto-fixed — OQ-13, open).
FR9: When a course has an empty outline, the Course Content Editor opens on one empty document, cursor active on the Chapter-title heading.
FR10: The Chapter title is the document's h1. The tutor writes the chapter overview as an ordinary paragraph immediately below it, plus an optional repeatable "What you'll learn" bullet list.
FR11: Topics are inserted via "/" (Topic heading) as an h2 with a description paragraph beneath it, anywhere in the document. No minimum count is enforced by the editor.
FR12: Sub-Topics are inserted via "/" (Sub-Topic heading) nested under a Topic heading, as an h3 with its own description paragraph. Entirely optional.
FR13: Pages are inserted via "/" (New Page) under a Topic or Sub-Topic heading, as an h4 structural marker carrying a title and per-page Confirmed/Unconfirmed state.
FR14: The "/" menu is fully keyboard-operable (Arrow Up/Down, Enter, Escape); the "+" click affordance is visible on hover AND keyboard focus. There is no step indicator.
FR15: Every insertion and edit persists on its own block-blur (autosave, FR34) — not on completing a step.
FR16: Reopening a course with an incomplete outline shows the exact same document, content intact — no "Continue setting up" affordance.
FR17: "Add chapter" inserts a new empty document the same way FR9 describes the first one. Every other creation goes through the same "/" or "+" mechanism.
FR18: The existing upload → scan → parse pipeline is unchanged.
FR19: The page editor offers "Insert from file," listing every Done source file for the course.
FR20: The picker shows the file's parsed Markdown in a two-pane selector. Selection granularity for v1 is whole file or one-or-more top-level sections. [ASSUMPTION, open — OQ-4]
FR21: Insert places the selected Markdown at the current cursor block in the page body, as ordinary editable blocks.
FR22: The picker offers "Also attach this file to this page as a resource," defaulted on.
FR23: Deleting a source file after extraction is allowed and warns only that it disappears from the picker/attached pages — never that page text will change.
FR24: Where the AI structure-extraction pipeline is reinstated, it produces a proposal the tutor accepts/edits/discards — never an authoritative write. Out of MVP scope.
FR25: A page has a Title (required, ≤200 chars) and a body.
FR26: The "/" slash-command menu offers, at minimum: Paragraph, Sub-heading, Bulleted list, Numbered list, Code, Image, Callout, Table, Math, Divider, Resource card, plus structural entries and Learning Resources block. Page-body Sub-heading is h5/h6, never h2/h3.
FR27: A Code block carries an optional language.
FR28: Three block types need renderer work: Math ($$…$$ via KaTeX), Callout (blockquote + marker), Resource card (link with resource: URI).
FR29: Blocks are reorderable, convertible between compatible types, duplicable and deletable. Structural headings excluded from conversion.
FR30: Resource references are stable IDs, resolved to a real signed/served URL at render time in both the editor preview and the student player.
FR31: Deleting a resource referenced by its page body is blocked, offering "Remove from content and delete" as an explicit second action.
FR32: "Preview" toggles edit/rendered-as-student view; "Markdown" view shows/permits direct editing of the raw body.
FR33: Raw Markdown constructs the block editor can't represent are preserved verbatim, never silently dropped.
FR34: Autosave on debounce/blur, with an explicit saved/saving/failed indicator; failed save is loud and retryable.
FR35: Alt text is a first-class, prompted field on every image block.
FR36: A page's resources live in a Learning Resources block, listing own + inherited ancestor resources.
FR37: A resource is added via drag-and-drop, file picker, or "Attach existing file" — all keyboard-operable.
FR38: Every resource has a role: Inline, Attachment, or both.
FR39: Every resource has an editable label and optional caption.
FR40: Resources are ordered within their owner; Attachment-role resources render in that order.
FR41: Uploaded resources go through the same malware-scan path as source files.
FR42: Accepted resource types for v1 per an allowlist (images, documents, code/text extensions). [ASSUMPTION, open — OQ-9]
FR43: Node-level resources use the same Learning Resources block.
FR44: Confirmation semantics — text-only preserves, structural resets the immediate parent; page-move resets both parents + the page itself. [ASSUMPTION, open — OQ-12]
FR45: "Move to Review" blocked while Unconfirmed; replaces the existing file-parsed check outright. [Blocking — OQ-7]
FR46: "Preview as student" available at page/node/course scope, same component path as the student player.
FR47: Accessibility — keyboard equivalents, aria-live, roving tabindex, prompted alt text, focus preservation.
FR48: Safety and scale — no-raw-HTML guarantee extended to SVG uploads, ownership+Draft guards, server-side bounded limits.

**Total FRs: 48**

### Non-Functional Requirements

NFR1 (Accessibility, from FR47 + UX spine): WCAG-aligned keyboard operability, aria-live announcements, ARIA tree/combobox/listbox semantics for the outline and slash-menu, prompted alt text, focus preservation.
NFR2 (Safety, from FR48): No-raw-HTML guarantee end-to-end including sanitized SVG uploads; ownership + Draft-state guards on every mutation.
NFR3 (Reliability, from M-6): Zero content-loss from autosave; <0.5% of saves failing unrecovered. No page-level "unsaved changes" dialog exists as a fallback — autosave is the sole safety net.
NFR4 (Scale bounds, from Appendix A): 100 chapters/course, 100 topics/chapter, 50 sub-topics/topic, 200 pages/node, 50 resources/owner, 25 MB/resource, 256 KB/page body.
NFR5 (Security/Authorization, from architecture AD-29): Non-owner reads require the existing JWT + policy pattern; reviewer access (InReview/ReviewConfirmed/Published) vs. student access (Published + enrolled, deny-by-default until Enrollment exists) are distinct conditions.

**Total NFRs: 5**

### Additional Requirements

- Named design decisions DD-1 through DD-7 are load-bearing — an FR contradicting a DD is treated as a PRD bug, not a license to improvise.
- 6 Open Questions are genuinely blocking specific scope: OQ-1 (migration option — **resolved this session: no migration needed, dev-phase**), OQ-7 (FR-45 gate reconciliation — blocking for FR-45's implementation), OQ-8 (publish/versioning graph — blocking for architecture, **resolved**: backend AD-17 amendment), OQ-10 (SVG sanitization mechanism — blocking for architecture, **resolved**: backend AD-28), OQ-11 (read-path authorization — blocking for architecture, **resolved**: backend AD-29), OQ-16 (migration sequencing — **moot, no migration needed**).
- 10 non-blocking Open Questions and a 9-entry Assumptions Index (A-1 through A-9) remain open at the PRD level — not blocking for this epic set's construction, but worth tracking (OQ-2, OQ-3, OQ-5, OQ-6 `[NOTE FOR PM]`, OQ-9, OQ-12, OQ-13, OQ-14, OQ-15).
- The Vision's core constraint — "the tutor decides the shape of every page; nothing renders to a student that a tutor did not place on a page" — is a product-level invariant, not a single FR, and should be treated as a gate on any future story that touches AI-authored content.

### PRD Completeness Assessment

Strong. This PRD already went through a full BMad Validate pass (rubric + adversarial reviewers, Grade: Fair) and a subsequent Update pass earlier this session that resolved every high-severity finding and reconciled the PRD against the UX pivot. DD/FR/OQ/Assumption ID continuity is clean (verified: FR1–48 contiguous, DD1–7 contiguous, no duplicates). The remaining open items are genuinely open product/architecture questions (most now resolved by the architecture pass — OQ-7/8/10/11), not gaps in the PRD's own rigor.

## Epic Coverage Validation

### Coverage Matrix

| FR | Epic(s) | Story/ies | Status |
| --- | --- | --- | --- |
| FR1–FR7 | Epic 7 | 7.1–7.2 | ✓ Covered |
| FR8 | Epic 7 | 7.2 | ✓ Covered |
| FR9, FR14, FR17 | Epic 7 | 7.1 | ✓ Covered |
| FR10–FR13, FR16 | Epic 7 | 7.1–7.2 | ✓ Covered |
| FR15 | Epic 7 | 7.4 | ✓ Covered |
| FR18–FR23 | Epic 10 | 10.1–10.2 | ✓ Covered |
| FR24 | — | (design constraint, not a story — see note below) | ✓ Covered (as constraint) |
| FR25, FR27, FR32–FR34 | Epic 7 | 7.3–7.4 | ✓ Covered |
| FR26, FR29 | Epic 7 (basic) + Epic 9 (rest) | 7.3, 9.2 | ✓ Covered (split, both halves present) |
| FR28, FR35 | Epic 9 | 9.1–9.2 | ✓ Covered |
| FR30 | Epic 8 (editor half) + Epic 11 | 8.3, 11.4 | ✓ Covered (split, both halves present) |
| FR31 | Epic 8 | 8.3 | ✓ Covered |
| FR36–FR43 | Epic 8 | 8.1–8.3 | ✓ Covered |
| FR44 | Epic 7 (core) + Epic 11 | 7.4, 11.1 | ✓ Covered (split, both halves present) |
| FR45–FR46 | Epic 11 | 11.1–11.2 | ✓ Covered |
| FR47–FR48 | Epic 7 + Epic 8 (cross-cutting) | 7.4, 8.1 | ✓ Covered |

FR24 note: the AI structure-extraction proposal contract is explicitly out-of-MVP-build scope (§6.2) — it fixes a constraint on *future* work (extraction must never write nodes/pages authoritatively), not something with code to write in this epic set. Correctly has no story; incorrect would be silently dropping it from the doc entirely, which `epics-ContentAuthoring.md` does not do — it's named explicitly in Epic 10's summary line.

### Missing Requirements

None. All 48 FRs trace to at least one story (or, for FR24, an explicit named constraint with no code to write). No FR appears in the PRD without epic coverage, and no FR number appears in the epics document without a matching PRD source.

### Coverage Statistics

- Total PRD FRs: 48
- FRs covered in epics: 48
- Coverage percentage: 100%
- Total UX-DRs (from the epics doc's own inventory): 14, all 14 covered by at least one story (verified during story creation this session, including 4 that were caught missing and patched in before this report)

## UX Alignment Assessment

### UX Document Status

Found — `ux-eLearning-2026-08-10/` (`DESIGN.md` + `EXPERIENCE.md`, bmad-ux spine pair), `status: final`, updated 2026-08-17.

### UX ↔ PRD Alignment

Strong, and directly verified this session rather than assumed: the PRD's original §4.2 specified a 4-step wizard; UX Discovery validated a different model (single continuous document + "/" slash-command menu) across three mock rounds, and the PRD was explicitly rewritten this session to match — every "wizard"/"step"/"block palette"/"Resources panel" reference replaced, not just relabeled (see the PRD's own 2026-08-16 revision note). `EXPERIENCE.md`'s Key Flows now carry a "ContentAuthoring PRD · UJ-1/UJ-2/UJ-3" section that supersedes the PRD's own prose as the canonical description of the flow, with an explicit `[NOTE FOR UX]` disclosure each time. No open UX↔PRD divergence remains.

### UX ↔ Architecture Alignment

Strong, also directly verified: both architecture spines were updated this session specifically to implement `EXPERIENCE.md`/`DESIGN.md`'s contract — Tiptap as the editor foundation (AD-9), real native semantic headings resolving the UX spine's own "not a styled div" requirement, the full ARIA/keyboard/IME-safety contract bound explicitly by citation rather than a vague "ARIA wiring" label (AD-9/AD-10), and the generic Learning Resources block's keyboard-operable controls (role select, caption, remove/reorder — DESIGN.md's `content-resource-block.resourceRowControls`). This alignment was reviewer-gated (rubric + web-verification + adversarial) and iterated until clean.

### Warnings

None blocking. One minor completeness note: `DESIGN.md`'s four new component tokens (`content-doc-heading`, `content-page-marker`, `content-resource-block`, `content-slash-menu`) aren't cited by an explicit acceptance-criterion sentence in any story — they're implicitly consulted when a story builds the component (standard practice), but no story literally says "match `content-slash-menu`'s tokens." Not a gap worth blocking on; flagged for awareness only.

## Epic Quality Review

Applying create-epics-and-stories standards rigorously, epic by epic and story by story.

### Epic Structure Validation

| Epic | User-centric title/goal? | Independent (doesn't require a *later* epic)? | Verdict |
| --- | --- | --- | --- |
| 7: Outline & Basic Page Authoring | ✓ | ✓ (foundational, no dependency on 8–11) | Pass |
| 8: Per-Page & Per-Node Resources | ✓ | ✓ (builds on 7 only; does not need 9/10/11 — verified Story 8.3's delete-guard is testable via Epic 7's raw-Markdown path alone, not blocked on Epic 9's blocks) | Pass |
| 9: Rich Content Blocks | ✓ | ✓ (builds on 7+8 only) | Pass |
| 10: Extraction from Uploaded Files | ✓ | ✓ (builds on 7; 10.2's resource-attach uses Epic 8, both prior) | Pass |
| 11: Confirmation Gate, Lifecycle, Preview | ✓ | ✓ (builds on 7–10; Story 11.4 explicitly ships gated-closed rather than forward-depending on the not-yet-built Enrollment work) | Pass |

No technical-milestone epics found (no "Database Setup," "API Development," or equivalent). No circular or forward epic dependencies found.

### Story Quality Assessment

- **Sizing:** All 15 stories deliver a coherent, independently-valuable capability; none is an epic-sized catch-all. Epic 7's size concern (26 FRs total for the epic) was resolved by slicing into 4 stories rather than splitting the epic — checked and still correct: none of the 4 stories has standalone user value on its own (a canvas with nothing to insert into isn't shippable), so keeping them as one epic was the right call.
- **Within-epic dependencies:** Checked every story in all 5 epics — every story depends only on stories *before* it (within its own epic) or on *prior* epics. Zero forward dependencies found. The one place a forward-looking reference exists (Story 11.4 → future Enrollment work) is explicitly *not* a forward dependency: the story ships a working, gated-closed mechanism today, not a promise contingent on unbuilt work.
- **Entity/table creation timing:** Chapter/Topic/Subtopic (Story 7.2), Page (Story 7.3), Resource (Story 8.1) are each introduced by the first story that needs them — no upfront schema dump.
- **Acceptance criteria:** Given/When/Then format used consistently across all 15 stories. Spot-checked for vagueness and missing error paths — found specific, testable criteria throughout, including explicit failure-mode ACs (autosave failure, bounded-limit rejection, malware-scan rejection, delete-blocked-while-referenced) rather than happy-path-only coverage.

### Special Implementation Checks

- **Starter template:** N/A — brownfield project, no starter template specified by either architecture spine.
- **Brownfield indicators:** Present and correct — Epic 7's stories explicitly build on existing `lib/markdown.ts`, `CourseFileService`, and the existing upload/scan/parse pipeline rather than reinventing them; Epic 10 explicitly keeps the existing pipeline "unchanged."

### Findings by Severity

**🔴 Critical Violations:** None found.
**🟠 Major Issues:** None found.
**🟡 Minor Concerns:** The DESIGN.md token-citation completeness note from UX Alignment above (not a structural defect).

## Summary and Recommendations

### Overall Readiness Status

**READY**

### Critical Issues Requiring Immediate Action

None remaining. One critical issue was found and fixed *during* this assessment, not left for the user to action separately: `epics-ContentAuthoring.md` was originally numbered Epic 1–6, colliding with this project's existing continuous epic sequence (Epic 1–3 in `epics.md`, Epic 4 in `epics-ErrorObservability.md`, Epic 5–6 in `epics-AdminSettings.md`). Renumbered to Epic 7–11 in place, all cross-references and the FR coverage map updated, before this report was finalized.

### Recommended Next Steps

1. Run `bmad-sprint-planning` to fold Epics 7–11 into the project's existing `sprint-status.yaml` alongside Epics 1–6.
2. Before Story 8.1 (or whichever story lands the SVG-sanitization work) is dev-started, confirm the exact `.NET ClamAV client` package choice — this remains an open `[ASSUMPTION]` in the backend architecture spine's Stack table, unrelated to this session's work but still unresolved.
3. Track the still-open, non-blocking PRD Open Questions (OQ-2, OQ-3, OQ-5, OQ-6, OQ-9, OQ-12–OQ-15) as they naturally come up during story implementation — none block starting Epic 7, but several (OQ-6's confirmation granularity, OQ-9's extension allowlist) are the kind of thing worth resolving before their owning story, not after.
4. When the Enrollment epic is eventually scoped (a different PRD's territory), Story 11.4's read mechanism and Story 11.3's reviewer policy branch are what it needs to build against — point that future work at this epic set rather than re-deriving the CoursePlayer/AD-29 read path from scratch.

### Final Note

This assessment found and fixed 1 critical issue (epic-numbering collision, corrected in place) and documented 1 minor completeness note (DESIGN.md token citations, non-blocking) across the 6 validation categories reviewed. FR coverage is 100% (48/48), UX-DR coverage is 100% (14/14), and epic/story structure passes every best-practice check applied (user value, independence, no forward dependencies, incremental entity creation, testable acceptance criteria). This PRD/UX/Architecture/Epics set is ready to proceed to Phase 4 implementation.
