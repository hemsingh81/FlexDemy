# Validation Report — FlexDemy (Content Authoring Update)

- **DESIGN.md:** `_specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/DESIGN.md`
- **EXPERIENCE.md:** `_specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/EXPERIENCE.md`
- **Run at:** 2026-08-16

## Overall verdict

A downstream consumer can source-extract cleanly for most of this pair: tokens resolve, all four mockup files are linked with clear dispositions, all five PRD sources exist on disk, section shape matches the canonical templates, and the four new ContentAuthoring components are coherent and consistently flagged wherever the superseded content-tree-node model still appears. Two real gaps keep this from "strong": ContentAuthoring PRD's UJ-2 (extraction-to-blocks) and UJ-3 (resource depth/inheritance/delete-guard) have no Key Flow mirror at all, and the new authoring surface's "empty document / first open" state exists only as flow narrative, not as a formal State Patterns row.

The accessibility pass found deeper problems than usual and materially shifts the picture. The one artifact meant to demonstrate the new interaction contradicts the spine's own semantic-heading promise (styled `<div>`s wrapping `<textarea>`s, not real `<h2>`/`<h3>` elements), the "+" click affordance named as the accessible primary entry is never rendered anywhere in that mock, and Page markers are excluded from the heading tree while still appearing in the Table-of-Contents rail — directly contradicting the "same structure a sighted tutor sees" claim. Fixable, but currently asserted more confidently in prose than demonstrated.

## Category verdicts

- Flow coverage — Thin
- Token completeness — Strong
- Component coverage — Adequate
- State coverage — Thin
- Visual reference coverage — Strong
- Bloat & overspecification — Adequate
- Inheritance discipline — Strong
- Shape fit — Strong

## Findings by severity

### High (2)

**[Flow coverage]** — ContentAuthoring PRD's UJ-2 and UJ-3 have no Key Flow entry (Key Flows §ContentAuthoring PRD)
UJ-2 (extraction-to-blocks) and UJ-3 (resource depth/inheritance/delete-guard) are never mirrored — only UJ-1 is, reinterpreted through the document model.
Fix: Add Key Flow entries for UJ-2/UJ-3 through the validated document model, or scope them out with a [NOTE FOR UX→PM].

**[State coverage]** — No State Patterns row for "empty document / first open" (State Patterns table)
Described only inside the ContentAuthoring UJ-1 Key Flow narrative, not as a table row like every other empty state.
Fix: Add an explicit "Empty — first open / no content yet" row for Course Content Editor.

### Medium (3)

**[Flow coverage]** — Extraction-into-blocks mechanic has no clear analog in EXPERIENCE.md
PRD FR-19–21's picker/selector/copy-on-insert reads only as a resource-attach action where mentioned at all.
Fix: Confirm whether extraction-to-blocks survives the validated model; document where it lives or record the descope.

**[Token completeness]** — `{components.spinner}` referenced but never defined (DESIGN.md extraction-status-badge)
Fix: Add a minimal spinner component entry, or drop the token syntax.

**[Component coverage]** — course-content-editor bullet still describes stale tree composition (DESIGN.md lines 276–277)
The correction lives only in the preceding bullet; a reader jumping straight there sees stale language.
Fix: Add a short inline pointer inside the course-content-editor bullet itself.

### Low (7)

**[Component coverage]** — State Patterns still use generic "node" language (EXPERIENCE.md lines 128–131)
Fix: Define "node" as an umbrella term for heading-or-page, or rename these rows.

**[Component coverage]** — "Course version history" has no DESIGN.md visual entry
Fix: Add a one-line visual note or fold into the existing disclaimer list.

**[Component coverage]** — Display names differ between DESIGN.md and EXPERIENCE.md for the same token
Fix: Align display names to the token name.

**[State coverage]** — No "cold-load / loading existing document" state defined
Fix: Add a loading-state row, or state it inherits the global loading pattern.

**[Bloat & overspecification]** — Multi-round remediation narrative reads like a changelog inside the living spec
Fix: Move resolved-history narrative to a changelog appendix.

**[Inheritance discipline]** — New Component Patterns rows don't self-cite their own token
Fix: Add the token citation to each new row for consistency.

**[Shape fit]** — Key Flows and Responsive & Platform sections swapped relative to canonical order
Fix: Reorder, or treat as an accepted convention if intentional.

### Unranked — Accessibility review (23 findings)

Reported by method as a flat list, no severity ranking. Full text in `review-accessibility-contentauthoring.md`; the most consequential:

1. The accessible "+" primary entry is entirely absent from the reference mock.
2. No confirmation "+" is keyboard-discoverable rather than hover-only.
3. "/" keydown isn't shown being suppressed during IME composition (Hindi/Devanagari risk).
4. Firefox's native Quick Find ("/") conflict is not addressed.
5. The mock's own heading markup (`<div>` + `<textarea>`) contradicts the "real semantic `<h2>`/`<h3>`" promise.
6. Chapter-title heading level is never specified — hierarchy possibly headless at the top.
7. Page markers excluded from the heading tree but included in the ToC rail — contradicts "same structure" claim.
8. Slash-menu's keyboard model repurposes Tab nonstandardly.
9. Zero-match state for the slash menu is undefined.
10. Escape's focus-return destination is unstated.
11. ARIA wiring for the menu is incompletely specified (only aria-activedescendant named).
12. No aria-live confirmation when a block is actually inserted.
13. Confirmed/unconfirmed heading state may not clear "never color-alone."
14. Learning Resources block: metadata edits (role, caption, remove, reorder) not confirmed keyboard-operable.
15. The mock's resource drop-zone doesn't render the buttons the spec promises.
16. "Pointer to the ancestor" for inherited resources not confirmed to be a real operable link.
17. No loading state for opening Course Content Editor on a non-empty course.
18. No error state for autosave failure — a real regression risk vs. the beforeunload dialog it replaced.
19. Editing state of a Published (read-only?) course is unaddressed.
20. Editing interaction for blocks beyond heading/paragraph (lists, tables, code, math) is unspecified.
21. Reduced-motion coverage omits the slash menu's and block-insert's own transitions.
22. ToC rail activation not confirmed to move real DOM focus vs. scroll-only.
23. Focus destination after inserting a block via the slash menu is unstated; multi-chapter switching has no defined focus-reset behavior.

## Reviewer files

- `review-rubric.md`
- `review-accessibility-contentauthoring.md`
