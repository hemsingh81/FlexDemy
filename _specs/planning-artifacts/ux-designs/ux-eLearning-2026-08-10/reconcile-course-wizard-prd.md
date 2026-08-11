# Input Reconciliation: New Course Wizard PRD vs. Updated UX Spines

*Input: `prd-eLearning-CourseWizard-2026-08-10/prd.md` + `addendum.md`. Reconciled against `EXPERIENCE.md` + `DESIGN.md` at Finalize step 2.*

## Gaps found

1. **Thumbnails management actions missing** (PRD FR-9) — preview/reorder/delete/set-primary actions, 4th-upload rejection message, and cross-course aspect-ratio consistency aren't described in the spine, only the crop tool is.
2. **Cascading delete has no confirm/warning state** (PRD FR-14) — deleting a Chapter removes all descendant nodes; the Content Tree Node pattern lists delete as a plain action with no confirmation step, unlike the product's existing destructive-action convention (Admin row delete → confirm modal).
3. **Per-node fallback during Publish not reflected in State Patterns** (PRD FR-21) — the PRD guarantees a failed node falls back to on-demand generation so "students never see an empty node," but the Publishing state pattern doesn't say what a student sees if they open such a node.
4. **Post-publish version retrieval has no UI surface** (PRD FR-25) — no version-history list/view/restore affordance described anywhere in the spine.
5. **Deactivated-but-attached tag chip state dropped** (PRD FR-7) — a tag deactivated after attachment stays attached but can't be re-selected if removed; the spine only describes exclusion from new selection, not this attached-non-reselectable state.

Total: 5 gaps, all fixable without new open questions — applying now.
