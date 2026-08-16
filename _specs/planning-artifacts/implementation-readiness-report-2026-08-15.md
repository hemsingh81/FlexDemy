---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - _specs/planning-artifacts/prds/prd-eLearning-AdminSettings-2026-08-15/prd.md
  - _specs/planning-artifacts/prds/prd-eLearning-AdminSettings-2026-08-15/addendum.md
  - _specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md
  - _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md
  - _specs/planning-artifacts/epics-AdminSettings.md
scopeNote: >
  Assessment scoped to the Admin Settings / Epic 5 track. Epics 1-4 (epics.md,
  epics-ErrorObservability.md, and their source PRDs/UX) are excluded as
  already-shipped work (all done per sprint-status.yaml). No UX design contract
  exists for this track -- bmad-ux was not run for prd-eLearning-AdminSettings-2026-08-15.
---

# Implementation Readiness Assessment Report

**Date:** 2026-08-15
**Project:** eLearning

## Document Inventory

**PRD:** `prd-eLearning-AdminSettings-2026-08-15/` (prd.md + addendum.md, finalized 2026-08-15)
**Architecture:** `architecture-eLearning-2026-08-09/` (frontend, AD-8 added) + `architecture-eLearning-backend-2026-08-09/` (backend, AD-25-AD-27 added), both updated 2026-08-15 for this track
**Epics & Stories:** `epics-AdminSettings.md` (Epic 5: Story 5.1; Epic 6: Stories 6.1-6.3), updated 2026-08-15 -- renumbered from an initial Epic 1/Epic 2 draft to continue the project's established sequential epic numbering (Epics 1-4 already shipped per sprint-status.yaml), caught during this readiness check
**UX:** none — bmad-ux was not run for this feature; absence tracked as a candidate finding

No duplicate document-format conflicts found. Epics 1-4 (`epics.md`, `epics-ErrorObservability.md`, and their source PRDs/UX) excluded from this assessment as already-shipped per `sprint-status.yaml`.

## PRD Analysis

### Functional Requirements

FR1: The "New Course Wizard" trigger is removed from the Teaching stats-card row and rendered instead in the My Courses (Tutor) section, positioned on the right-hand side of that section's header/toolbar area.
FR2: The relocated trigger opens the same New Course Wizard flow that exists today — no change to steps, validation, or the wizard's own UI.
FR3: The My Courses (Tutor) empty-state copy ("No courses yet — start with New Course Wizard above") is updated to match the trigger's new position.
FR4: A new `settings` entry is added to the Admin Panel's subtab set, visible only to users with Master or Support role — the same access level as Tutor Approvals.
FR5: The Settings screen lists every Setting grouped by KeyType, showing each one's current Value, IsActive state, and when/by whom it was last changed.
FR6: Settings are persisted with at minimum Key (unique per KeyType), Value, KeyType, IsActive, plus CreatedAt/UpdatedAt/UpdatedBy audit fields.
FR7: Introducing a new setting category requires only new Key/KeyType rows through the existing store, not a schema change.
FR8: When a Setting's IsActive is false, the system's Effective Value for that Key reverts to its hardcoded default rather than the stored Value.
FR9: The Settings screen offers a fixed, pre-approved list of Font Pairings (Display/Body/Mono roles) for selection — not a free-text font-name field.
FR10: The system rejects any attempted Value for the Font KeyType that is not one of the currently curated Font Pairing identifiers — enforced in the API/domain layer, not only in the picker UI.
FR11: An applied Font Pairing takes effect at runtime (next page load) for any font already available to the app, without a frontend rebuild or redeploy; a pairing including a font not already loaded via `index.html` is out of scope for v1.
FR12: Selecting a candidate Font Pairing renders a live preview, in the Settings screen, against representative site content, before any change is committed.
FR13: A previewed change only becomes the live, site-wide Effective Value after the admin takes a distinct "Apply" action; navigating away from an unapplied preview discards it.
FR14: Every time a Setting's Value is applied, the system records the Key, the immediately-prior Value read fresh at write time, the new Value, the admin who applied it, and a timestamp.
FR15: The Settings screen provides a way to view a given Setting's history as a reverse-chronological list.
FR16: An admin can restore a prior historical value directly from the history view, going through the same Preview, Apply, and curation-check steps as any other change; restoring a value no longer curated is rejected the same way an uncurated direct write would be.

Total FRs: 16

### Non-Functional Requirements

NFR1 (Propagation): An applied setting change is reflected for all users on their next page load/navigation; a hard real-time push is not required for v1.
NFR2 (Access control): The Settings subtab and its underlying endpoints are unreachable by any role below Support, including by direct navigation or direct API call — not just hidden from navigation.
NFR3 (Preview isolation): A Preview is visible only to the admin who triggered it and has no observable effect on any other user's session or the live Effective Value until Apply is clicked.
NFR4 (Fail-safe default): If the settings store is unreachable, returns malformed/invalid data, or times out at page load, the system renders using hardcoded defaults rather than failing to load.
NFR5 (Concurrency): Concurrent edits to the same Setting follow last-write-wins — no conflict detection between two admins editing the same Setting, deliberately kept simple for v1.

Total NFRs: 5

### Additional Requirements

- Success Metrics (§6): time-to-live-change and zero-tickets-filed, measured via Change History (FR15/16) plus externally-tracked ticket volume — not a build requirement, but a signal the implementation should make measurable.
- Counter-metric: applied-change → revert-within-1-hour rate, watching whether Preview (FR12) gives admins enough signal before Apply.
- Open Item (`[NOTE FOR PM]`): the initial curated Font Pairing list itself (which Display/Body/Mono combinations are pre-approved) is not specified in the PRD — needs a short design pass before FR9 can be implemented. Not resolved in the PRD or the architecture; carried as an open item into this assessment (see Findings).

### PRD Completeness Assessment

Strong. The PRD went through a 3-reviewer gate (rubric, edge-case hunter, adversarial) at finalize, with all resulting critical/high findings fixed in the document itself (font-pairing atomicity, server-side curation enforcement, nav-anchor regression, measurability). Every FR carries testable Consequences. NFRs are bounded and specific rather than generic. The one remaining open item (curated font list content) is explicitly scoped as non-blocking for the PRD itself, but it is a genuine blocker for Story 6.2 specifically — flagged for epic coverage validation below.

## Epic Coverage Validation

### Coverage Matrix

| FR Number | PRD Requirement | Epic Coverage | Status |
| --- | --- | --- | --- |
| FR1 | Relocate wizard trigger + preserve nav anchor | Epic 5, Story 5.1 | ✓ Covered |
| FR2 | Preserve existing wizard behavior | Epic 5, Story 5.1 | ✓ Covered |
| FR3 | Update empty-state copy | Epic 5, Story 5.1 | ✓ Covered |
| FR4 | Add Settings subtab (Master+Support) | Epic 6, Story 6.1 | ✓ Covered |
| FR5 | List settings by KeyType | Epic 6, Story 6.1 | ✓ Covered |
| FR6 | Generic settings persistence | Epic 6, Story 6.1 | ✓ Covered |
| FR7 | KeyType extensible without migration | Epic 6, Story 6.1 | ✓ Covered |
| FR8 | IsActive controls effective value | Epic 6, Story 6.1 | ✓ Covered |
| FR9 | Curated font pairing picker | Epic 6, Story 6.2 | ✓ Covered |
| FR10 | Server-side curation enforcement | Epic 6, Story 6.2 (also cited in 6.3's restore path) | ✓ Covered |
| FR11 | Runtime application without rebuild | Epic 6, Story 6.2 | ✓ Covered |
| FR12 | Live preview before commit | Epic 6, Story 6.2 | ✓ Covered |
| FR13 | Explicit Apply required | Epic 6, Story 6.2 | ✓ Covered |
| FR14 | Record every applied change | Epic 6, Story 6.3 | ✓ Covered |
| FR15 | View change history | Epic 6, Story 6.3 | ✓ Covered |
| FR16 | One-click restore from history | Epic 6, Story 6.3 | ✓ Covered |

### Missing Requirements

None — all 16 PRD FRs are covered by at least one story, with acceptance criteria citing the FR number. No FRs appear in the epics document that aren't in the PRD.

### Coverage Statistics

- Total PRD FRs: 16
- FRs covered in epics: 16
- Coverage percentage: 100%

## UX Alignment Assessment

### UX Document Status

Not Found. No `ux-*` folder or whole `*ux*.md` document exists scoped to `prd-eLearning-AdminSettings-2026-08-15` (the one UX contract in the project, `ux-eLearning-2026-08-10/`, covers the already-shipped Dashboard/CourseWizard/Assignments tracks only). This was a deliberate choice, made explicitly when this run started (bmad-help recommended `bmad-ux` given the feature's UI surface; the user chose to proceed straight to epics/stories instead).

### Alignment Issues

N/A — no UX document to check for alignment, since none exists.

### Warnings

**UX is implied but missing, and this feature has real UI surface:** a new Settings screen (list view, KeyType grouping), a curated font picker (FR9), a live preview area (FR12), a change-history view (FR15), and a restore flow (FR16) — plus the My Courses button relocation (FR1). The PRD's own FRs/Consequences and the architecture's AD-8 specify *behavior* (preview isolation, fail-safe defaults, curated-not-free-text) in real detail, but neither specifies *visual/interaction* detail: exact picker layout, what the preview area looks like against "representative site content," how the history list is laid out, empty/loading/error states for the Settings screen itself, or responsive behavior. This is the same gap flagged before this run started — carrying it forward as a formal finding rather than letting it go unrecorded now that the PRD/Architecture/Epics are otherwise ready. Not a blocker for backend-heavy stories (5.1, 6.1), but a real risk for the UI-detail stories (6.2, 6.3) where a dev agent will have to make visual-design judgment calls the PRD didn't make.

## Epic Quality Review

Validated against `bmad-create-epics-and-stories` standards, rigorously — every dependency checked, every AC read.

### Epic Structure Validation

- **User value focus:** Both epic titles/goals describe user outcomes, not technical milestones. "My Courses — Faster Course Creation Access" and "Admin Settings — Runtime Site Configuration" both pass — neither reads as "Database Setup" or "API Development" in disguise.
- **Epic independence:** Confirmed — Epic 5 and Epic 6 share zero files (frontend-only Dashboard component move vs. a new backend feature folder + new frontend context/screen). Either could ship first; neither requires the other.

### Story Quality Assessment

- **Story sizing:** All 4 stories deliver standalone user value and are sized for a single dev session. No "Setup all models"-style technical stories found.
- **Dependency check (within Epic 6):** Story 6.1 stands alone (creates its own `Setting` model + gated subtab). Story 6.2 uses only 6.1's output. Story 6.3 uses only 6.2's output (explicitly scoped: "Given an admin applies a change to a Setting (Story 6.2's Apply)"). Zero forward references — no story says "wait for a future story."
- **Acceptance criteria:** Consistent Given/When/Then throughout. Error/negative conditions are present, not just happy paths: Story 6.1 covers access denial, Story 6.2 covers server-side curation rejection, Story 6.3 covers the NFR4 fail-safe path (store unreachable/malformed/timeout). Story 5.1 has no explicit error-condition AC, but the story itself is a pure UI relocation with no network call — no meaningful error path exists to test.
- **Database/entity creation timing:** Correct — `Setting` is created in 6.1 (first story needing it), `FontPairingDefinition` implicitly required starting 6.2, `SettingChangeHistory` implicitly required starting 6.3. No upfront over-creation.

### Special Implementation Checks

- **Starter template:** N/A — brownfield, no starter template specified in Architecture.
- **Brownfield indicators:** Present and correct — Story 5.1 explicitly integrates with the existing `#course-publishing` nav anchor; Story 6.1 explicitly follows the existing Tutor Approvals access-gating pattern rather than inventing a new one.

### Findings by Severity

**🔴 Critical Violations:** None.

**🟠 Major Issues:** None.

**🟡 Minor Concerns:**
- Stories 6.2 and 6.3 rely on new entities (`FontPairingDefinition`, `SettingChangeHistory`) that are named in the epics document's "Additional Requirements" section but not explicitly called out inside the story's own Acceptance Criteria as "this story creates table X." The behavior described is correct and the creation timing is correct — this is a documentation-clarity gap, not a structural defect. Low risk since a dev agent building Story 6.2 will read the Additional Requirements section too, but worth tightening if the story file is ever read in isolation.

## Summary and Recommendations

### Overall Readiness Status

**READY WITH MINOR GAPS.** Nothing here blocks starting development on Epic 5 or Story 6.1 today. Two real gaps exist, both scoped to the later Epic 6 stories specifically, neither structural.

### Critical Issues Requiring Immediate Action

None. Zero critical or major violations across document consistency, FR coverage, epic quality, or dependency structure.

### Issues Found (in order of when they'll actually bite)

1. **Epic numbering was wrong and has been corrected during this assessment.** `epics-AdminSettings.md` originally restarted at "Epic 1"/"Epic 2," breaking the project's established continuous numbering (Epics 1-4 already shipped). Fixed to Epic 5/Epic 6 as part of this run — no outstanding action, noted for the record.
2. **Story 6.2 has a real, unresolved blocker: the curated Font Pairing list itself doesn't exist yet.** This was flagged as a `[NOTE FOR PM]` in the PRD and never resolved by architecture either — it needs a short design pass (which pairings, which fonts) before Story 6.2 can be implemented, not just before it can be "polished."
3. **No UX documentation exists for this feature**, despite real UI surface (font picker, live preview, history view). This is a risk, not a blocker — the PRD/Architecture specify behavior in detail but not visual/interaction detail, which pushes those judgment calls onto whoever implements Stories 6.2/6.3.
4. **Minor:** Stories 6.2/6.3 don't inline-name the new entities they depend on (documentation clarity only, see Epic Quality Review above).

### Recommended Next Steps

1. Before starting Story 6.2: get the initial curated Font Pairing list defined (a quick design decision, not a full `bmad-ux` run) — this is the one genuine implementation blocker in the whole assessment.
2. Consider running `bmad-ux` for the Settings screen (picker, preview, history) before or during Story 6.2/6.3 — optional, but it's the difference between a dev agent making visual-design calls alone versus following a spec.
3. Proceed to `bmad-sprint-planning` for Story 5.1 and Story 6.1 now — both are fully unblocked.

### Final Note

This assessment identified 1 blocking issue (undefined curated font list, scoped to Story 6.2), 1 risk (missing UX documentation), and 1 minor documentation-clarity note — across otherwise clean document consistency, 100% FR coverage, and a clean epic/story quality review. One structural defect (epic numbering) was caught and fixed during this run itself. Address the Story 6.2 blocker before implementation reaches it; the rest can proceed as-is or be tightened at the team's discretion.

---
**Assessed by:** Implementation Readiness workflow (bmad-check-implementation-readiness)
**Date:** 2026-08-15
