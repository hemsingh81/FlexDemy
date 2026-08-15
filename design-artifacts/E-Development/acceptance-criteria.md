# Acceptance Criteria Index

**Backfilled 2026-08-15.** This file does not restate or re-derive acceptance criteria — it points
to where each story's real, detailed, Given/When/Then acceptance criteria actually live. Two
places carry AC-level detail, and they serve different purposes:

1. **`_specs/planning-artifacts/epics.md`** (Epics 1-3) and
   **`_specs/planning-artifacts/epics-ErrorObservability.md`** (Epic 4) — the epic-level
   PRD-derived AC as originally drafted, per story, in Given/When/Then form. This is the
   requirements-intent source.
2. **`_specs/implementation-artifacts/{epic}-{story}-{title}.md`** — the per-story implementation
   file for each of the 37 stories. This is the authoritative, current source: it carries the
   as-built AC (sometimes corrected/refined from the epics.md draft during implementation — see
   each file's own Dev Notes for call-outs like "story text corrected X"), plus Dev Notes,
   completion notes, and code-review history. **When the two sources disagree, the
   implementation-artifacts file wins** — it reflects what was actually reviewed and shipped.

For cross-cutting caveats and edge cases not captured in either AC list, also check
`_specs/implementation-artifacts/deferred-work.md` (explicitly deferred items, by story) and, for
Epic 3 specifically, `_specs/implementation-artifacts/epic-3-dependency-analysis.md` (decisions
that reshaped which story owns which AC across the epic).

---

## Epic 1 — AI Backbone & Admin Control

Epic-level AC drafts: `_specs/planning-artifacts/epics.md`, "Epic 1" section (Stories 1.1-1.9).

As-built AC, per story, in `_specs/implementation-artifacts/`:

- `1-1-admin-ai-configuration-ui-mock-data.md`
- `1-2-admin-ai-usage-cost-dashboard-mock-data.md`
- `1-3-admin-tag-management-ui-mock-data.md`
- `1-4-ai-service-layer-interface-gateway-client.md`
- `1-5-ai-task-configuration-store-live-wire-config-ui.md`
- `1-6-per-task-fallback-retry.md`
- `1-7-usage-cost-tracking-live-wire-usage-dashboard.md`
- `1-8-budget-threshold-enforcement.md`
- `1-9-tag-management-backend-live-wire-tag-ui.md`

## Epic 2 — Course Authoring: Metadata, Upload, AI Extraction & Editing

Epic-level AC drafts: `_specs/planning-artifacts/epics.md`, "Epic 2" section (Stories 2.1-2.10).

As-built AC, per story, in `_specs/implementation-artifacts/`:

- `2-1-course-metadata-wizard-ui-mock-data.md`
- `2-2-file-upload-ui-mock-data.md`
- `2-3-course-content-editor-ui-mock-data.md`
- `2-4-course-metadata-persistence-live-wire-wizard.md`
- `2-5-tag-taxonomy-live-data-wiring.md`
- `2-6-file-upload-malware-scanning-secure-storage.md`
- `2-7-document-parsing-ocr-pipeline.md`
- `2-8-ai-structure-extraction-extractstructure.md`
- `2-9-content-tree-crud-backend-live-wire-editor.md`
- `2-10-subject-aware-alt-text-language-tagging.md`

## Epic 3 — Adaptive Learning Experience & Publish Lifecycle

Epic-level AC drafts: `_specs/planning-artifacts/epics.md`, "Epic 3" section (Stories 3.1-3.11).
Also read `_specs/implementation-artifacts/epic-3-dependency-analysis.md` before trusting any
single story's AC in isolation — several ACs were relocated between stories during story-writing
(e.g. version-snapshot ownership moved to Story 3.8; see that file's "Key cross-story decisions"
section for the full list) and are documented there, not in epics.md.

As-built AC, per story, in `_specs/implementation-artifacts/`:

- `3-1-student-course-player-shell-ui-mock-data.md`
- `3-2-ways-menu-keyword-popover-ui-mock-data.md`
- `3-3-exercise-runner-ui-mock-data.md`
- `3-4-publishing-lifecycle-ui-mock-data.md`
- `3-5-drill-down-ways-ai-task-implementation.md`
- `3-6-exercise-generation-grading-backend.md`
- `3-7-keyword-definition-backend-definekeyword.md`
- `3-8-publish-batch-job-pre-generation-caching.md`
- `3-9-review-as-student-lifecycle-transitions.md`
- `3-10-publish-versioning-rollback.md`
- `3-11-cross-view-golden-file-visual-regression-parity.md`

## Epic 4 — Centralized Error Observability & Management

Epic-level AC drafts: `_specs/planning-artifacts/epics-ErrorObservability.md`, "Epic 4" section
(Stories 4.1-4.7) — note this is a separate file from `epics.md`, kept intentionally distinct
because Epic 4 originated from its own PRD (`prd-eLearning-ErrorObservability-2026-08-13`); it was
folded into the project's epic numbering as Epic 4 but never merged into `epics.md` itself.

As-built AC, per story, in `_specs/implementation-artifacts/`:

- `4-1-correlation-id-assignment-and-propagation.md`
- `4-2-errorrecord-data-model-and-centralized-capture-service.md`
- `4-3-backend-error-capture-wiring.md`
- `4-4-frontend-global-error-capture-and-reporting-endpoint.md`
- `4-5-admin-error-log-list-filter-and-detail.md`
- `4-6-error-lifecycle-actions.md`
- `4-7-correlation-id-trace-view.md`

Also see `_specs/implementation-artifacts/epic-4-retro-2026-08-14.md` for cross-story review
findings (e.g. the Acceptance Auditor layer catching two instances of a story's own completion
notes overstating what was actually verified — Stories 4.6 and 4.7) that qualify how much to trust
a story's self-reported AC-verification status at face value.

---

## New Stories

Per `delivery-summary.md` §6 ("How to add a new story"): when a new story is added, add its
implementation-artifacts filename to the relevant epic's list above (or add a new epic section, if
applicable) in the same commit/change that adds the story itself.
