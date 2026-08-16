# PRD Quality Review — Admin Settings & Runtime UI Configuration (incl. Course Wizard Relocation)

## Overall verdict

This PRD is well-drafted for a small internal admin capability: FRs are testable, NFRs carry real bounds instead of adjectives, and the addendum's brownfield code citations check out exactly against the repo (verified independently — file paths, line numbers, `AdminSubTab` values, `DESIGN.md` line 273 all match). The two real risks are a factual contradiction between FR-9 and the addendum about where the curated font-pairing list lives, and a gap in the Apply path: nothing specifies what happens if a multi-Key write (FR-10) partially fails. Neither is a redesign, both are fixable in the document itself.

## Decision-readiness — strong

Trade-offs are named with what was given up, not just what was chosen. NFR-5 states last-write-wins plainly and explains the reasoning ("Deliberately kept simple for v1; revisit if multi-admin collisions become a real problem"). The addendum's "Options considered (rejected/deferred, not in PRD)" section documents four real alternatives that were weighed and rejected (free-text font input, a font-specific table, real-time push, concurrency detection) with reasons for each — this is the opposite of theater. The one `[ASSUMPTION]` (FR-11) and one `[NOTE FOR PM]` (Open Items) both point at genuine unresolved tensions, not safe checkpoints.

### Findings
- **low** Rejection reasoning lives only in addendum.md, not in prd.md (§0, §4.4 FR-9) — A decision-maker who pushes back on "why not let admins type any font name?" gets the answer only if they also open addendum.md; FR-9 itself just states the requirement without the DESIGN.md-violation reasoning that justifies it (that reasoning is in addendum.md's "Options considered" section). *Fix:* Pull one sentence of the free-text rejection into FR-9's description in prd.md itself, since it's the kind of objection a reader of the PRD alone would raise.

## Substance over theater — strong

No findings. Personas are minimal and load-bearing (a single named persona, Priya, drives UJ-1; the tutor-relocation flow is explicitly declared "no full journey — a one-step UI move, not a new flow" rather than padded with a manufactured UJ). NFRs are specific and falsifiable (NFR-2: "unreachable by any role below Support, including by direct navigation or direct API call — not just hidden from navigation") rather than boilerplate. The Vision statement (§1) is concrete to this product (names the actual hardcoded fonts, the actual file, the actual gap) and explicitly disclaims novelty: "rather than introducing new architectural patterns" (§0).

## Strategic coherence — adequate

### Findings
- **medium** No shared thesis across the two bundled features (§0, §4.1 vs §4.2–4.6) — §0 states plainly "This PRD scopes two bundled changes," but nothing ties the Course Wizard relocation to the Admin Settings thesis (self-service, deploy-free UI change with an audit trail). They're bundled for shipping convenience, not because one serves the other. This is disclosed honestly, so it isn't scope dishonesty, but it does mean the PRD has two theses, not one. *Fix:* Either split into two PRDs, or add a sentence in §0 naming the actual bundling reason (e.g., shared sprint, shared reviewer) so the reader isn't left inferring it.
- **medium** Success Metrics (§6) cover only the Admin Settings half — All three bullets in §6 (deploy-cycle-time reduction, zero engineering tickets, the counter-metric) measure the Settings feature. The Course Wizard relocation (§4.1, FR-1–FR-3) has no success signal at all — not even an informal one like "fewer support questions about where course creation lives." *Fix:* Add one line to §6 for the relocation, or note explicitly that it's not being measured and why.

## Done-ness clarity — adequate

FRs are the PRD's strongest section: every FR in §4 has at least one testable, falsifiable consequence, and NFRs carry bounds ("next page load," "unreachable... including by direct API call," "hardcoded defaults") rather than adjectives like "reasonable" or "user-friendly," which do not appear anywhere in the document.

### Findings
- **high** No specified behavior for a failed or partial Apply (§4.5 FR-13, §4.4 FR-10) — FR-10 says confirming a Font Pairing "updates the Value(s) for the Font KeyType's Key(s)" (plural — Display/Body/Mono are separate Key rows per the Glossary's KeyType definition). Nothing in FR-10, FR-13, or the NFRs (§5) specifies what happens if that multi-row write fails partway (e.g., Display's Key updates but Body's does not), or what happens if Apply fails outright (network drop, DB constraint violation). NFR-4 covers the read path ("If the settings store is unreachable at page load...") but nothing covers the write path. *Fix:* Add an FR or NFR requiring the multi-Key Apply to be atomic (all rows for a Font Pairing update together or not at all), plus a stated behavior for a failed Apply (error surfaced to admin, live site unchanged).
- **medium** FR-9's actual content is undefined, which blocks testing FR-9/FR-10 as written (§4.4, §7) — The curated Font Pairing list itself doesn't exist yet ("the actual initial curated Font Pairing list... is not defined anywhere yet," addendum §"Open follow-up for design"). This is disclosed via the `[NOTE FOR PM]` in Open Items, so it isn't hidden — but it means "done" for FR-9 and FR-10 is not yet knowable from this PRD alone. *Fix:* No PRD change needed beyond what's already flagged; confirm the design pass is tracked as a blocking dependency before FR-9/FR-10 stories are pulled into a sprint.

## Scope honesty — adequate

`[ASSUMPTION]` and `[NOTE FOR PM]` are used, and the one inline `[ASSUMPTION]` (FR-11) round-trips correctly to the Open Items index. Open-items density is low (one assumption, one PM note), which is appropriate — this reads as a largely-settled PRD (the `.memlog.md` shows the concurrency-detection FR was deliberately cut and last-write-wins substituted after user direction), not a PRD papering over unresolved questions.

### Findings
- **medium** No dedicated Non-Goals section or `[NON-GOAL for MVP]` tags anywhere in the document — Real non-goals exist and are individually true (UI for colors/spacing/logo is future work per §1; real-time push deferred per NFR-1; conflict detection deferred per NFR-5; free-text fonts excluded per FR-9; loading new font families out of scope per FR-11's assumption) but they're scattered across the Vision paragraph, two different NFRs, an FR's implicit requirement, and one assumption tag — never consolidated. A reader trying to answer "what is explicitly NOT in v1?" has to reconstruct the list themselves from five different locations. *Fix:* Add a short Non-Goals subsection (or list) under §1 or §7 that names these five items in one place, each tagged `[NON-GOAL for MVP]`.

## Downstream usability — adequate

Glossary (§3) terms — Setting, KeyType, Effective Value, Font Pairing, Preview, Change History — are used with consistent capitalization throughout §4–§5. FR IDs (FR-1–FR-16) and NFR IDs (NFR-1–NFR-5) are contiguous with no gaps or duplicates (verified by grep across prd.md); no leftover "FR-17" or stray references remain from the renumbering noted in `.memlog.md`. UJ-1 has a named, contextualized protagonist (Priya).

### Findings
- **high** FR-9 and the addendum directly contradict each other about where the curated font list lives (§4.4 FR-9 vs. addendum "Open follow-up for design") — FR-9's consequence states: "Every pairing in the list was vetted by design ahead of time (**addendum tracks the initial approved list**)." The addendum itself says the opposite: "The actual initial curated Font Pairing list... **is not defined anywhere yet** — needs a short design pass before FR-10 can be implemented." An engineer trusting FR-9's parenthetical will look in addendum.md for a list that isn't there. The Open Items `[NOTE FOR PM]` (§7) has the correct information, but FR-9 itself is stale relative to it. *Fix:* Change FR-9's parenthetical from "(addendum tracks the initial approved list)" to "(list TBD — see `[NOTE FOR PM]` in Open Items, §7)" or equivalent, so the two documents agree.

## Shape fit — strong

Correct shape for an internal, single-operator-role admin capability bundled with a minor UI relocation: capability-spec structure with one full UJ (not four-plus manufactured personas), and the relocation is explicitly called out as not warranting a journey. Brownfield code references in addendum.md were independently spot-checked against the repository and are exact: `TeachingStatsCards.tsx`'s "Course Creation" label and `Plus` icon, `TutorEducatorHubView.tsx` lines 81/91 for `<TeachingStatsCards>`/`<MyCoursesSection>`, `useAdminPanel.ts`'s `AdminSubTab` union (`masterdata`, `support-users`, `role-visibility`, `tutor-approvals`, `ai-configuration`, `errors`), `index.css`'s `--font-display`/`--font-sans`/`--font-mono` values, `useCourseCreationFlow.ts`'s `openWizard`, and `DESIGN.md` line 273's exact rule text. The cross-reference to the existing CourseWizard PRD (§4.1) also resolves to a real document (`prd-eLearning-CourseWizard-2026-08-10`). This is unusually well-grounded for a brownfield PRD.

## Mechanical notes

- Glossary drift: none found — Setting/KeyType/Value/Effective Value/Font Pairing/Preview/Change History are used consistently in the same case and form throughout.
- ID continuity: clean. FR-1–FR-16 and NFR-1–NFR-5 are contiguous with no gaps, duplicates, or dangling references (grep-verified).
- Assumptions Index roundtrip: the single inline `[ASSUMPTION]` (FR-11, §4.4) is correctly mirrored in the Open Items index (§7). Clean roundtrip.
- The `[NOTE FOR PM]` in Open Items (§7, re: the undefined curated font list) is not cross-referenced by FR number from FR-9 itself (§4.4) — a reader landing on FR-9 has no inline signal that the list is still open; they'd only discover it by reading all the way to §7. Worth a one-line pointer from FR-9 to the Open Items note, independent of the FR-9/addendum contradiction noted above under Downstream usability.
- Downstream usability matters less here than for a chain-top PRD: no UX design or architecture document specific to this feature exists yet in `_specs/planning-artifacts/` (the existing `ux-eLearning-2026-08-10` and `architecture-eLearning-2026-08-09` directories predate this PRD and aren't scoped to it), so this currently reads as a standalone-to-date document rather than one already feeding a downstream workflow.
