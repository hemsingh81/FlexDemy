# PRD Quality Review — Admin Settings & Runtime UI Configuration (Font Size amendment)

## Overall verdict

The Font Size amendment (FR-18–FR-21, NFR-6) is disciplined and mostly integrates cleanly with
the existing Font Pairing FRs — IDs are contiguous, cross-references mostly resolve, and the
PRD explicitly reuses rather than re-derives the Preview/Apply/History mechanism instead of
padding itself with a parallel spec. It has one real structural gap, though: FR-21's list of
reused mechanisms omits FR-11, the exact "resolve multiple roles from one identifier atomically"
fix the addendum says reviewers had to catch once already for Font Pairing — and Font Size's own
Glossary definition describes the identical multi-role (heading/body/UI-text) shape that made
that fix necessary. Separately, `addendum.md`'s codebase-grounding section is now stale relative
to what's actually staged in the repo (the "open question" about curated-list storage has
already been answered by code that exists today), which weakens its value as dev handoff
material. Neither issue is fatal, but both are exactly the kind of thing that bites during
implementation rather than during PRD review.

## Decision-readiness — strong

Trade-offs are named with what was given up, not just what was chosen: NFR-5 states
last-write-wins concurrency handling and explicitly says it was "deliberately kept simple for
v1; revisit if multi-admin collisions become a real problem" rather than dodging the question.
`addendum.md`'s "Options considered (rejected/deferred, not in PRD)" section documents four
real rejected alternatives (open text input, font-specific table, real-time push, concurrency
detection) with reasons, including "explicitly rejected by the user to keep v1 simple." The
access-tier decision in §4.2 is stated as a decision with its rationale ("Unlike AI
Configuration... Settings changes are fully reversible... so access extends to Support-tier
admins") rather than left implicit. §7's two `[NOTE FOR PM]` items are genuinely open (curated
list contents not yet chosen), not rhetorical.

### Findings
None — this dimension needs no findings.

## Substance over theater — strong

No persona bloat: one named protagonist (Priya) is reused across UJ-1 and the Font Size
JTBD-restatement rather than inventing a second persona to pad out the amendment. The Font Size
"journey" (§2.3) is deliberately compressed — "identical mechanics to UJ-1... the picker,
preview, Apply, and history steps are the same mechanism applied to a different curated list" —
which is the right call given the mechanism really is identical, not filler avoidance dressed up
as economy. NFRs carry product-specific thresholds, not boilerplate: NFR-1 defines "next page
load" explicitly rather than saying "fast," NFR-6 requires "visually validated... against the
app's supported breakpoints and representative content" rather than "must be legible." The
Vision statement (§1) names actual fonts, actual files (`index.css`), and the actual mechanism
being replaced — it could not be swapped into another PRD unchanged.

### Findings
None — this dimension needs no findings.

## Strategic coherence — adequate

The Admin Settings / typography arc has a clear thesis (self-service runtime config, generic
store designed for future setting types) and the Font Size FRs follow from it directly rather
than being tacked on for its own sake — §4.7's description frames it correctly as "introduces
new curated data and a new KeyType, not new machinery." Success Metrics (§6) are worded broadly
enough ("admin decides to change typography" → "change is live") to cover both Font Pairing and
Font Size without needing a second metric, and a counter-metric is present.

### Findings
- **medium** Two unrelated features bundled with no unifying thesis (§0, §1) — §0 states plainly
  this PRD scopes "two bundled changes": the typography/Settings capability and the My Courses
  wizard-trigger relocation. §1's closing line — "This PRD closes both gaps... Separately, the
  New Course Wizard trigger moves" — concedes there is no shared thesis connecting them; they
  are two different MVP scope kinds (a platform capability vs. a UX placement fix) glued
  together by document convenience, not product logic. This is disclosed honestly rather than
  hidden, which limits the damage, but a reader trying to extract "what is this PRD's bet" gets
  two unrelated answers. *Fix:* either split into two PRDs, or add one sentence naming why they
  ship together (e.g., same sprint, same engineer, no dependency) so the bundling reads as a
  deliberate scoping choice rather than a leftover from how the work was assigned.

## Done-ness clarity — adequate

Most FRs, including the new ones, carry testable consequences: FR-18–FR-21 each specify a
verifiable condition (picker is a list not a numeric input; rejected requests; independent
IsActive state; preview-before-apply behavior identical to FR-13/FR-14). NFR-6 gives a bound
("visually validated... against the app's supported breakpoints") rather than an adjective.

### Findings
- **high** FR-21's reuse list omits FR-11, the exact atomicity mechanism Font Size's own
  Glossary entry implies it needs (§4.7, §3) — `addendum.md`'s "Reviewer-gate findings applied"
  section records that three parallel reviewers already caught a structural bug in this PRD:
  Font Pairing was originally modeled as three separate per-role Setting rows
  (Display/Body/Mono), which "broke IsActive atomicity, change-history entry counting, and
  restore-vs-curated-list integrity all at once," fixed by FR-11 ("Display, Body, and Mono roles
  are resolved together from that one identifier, not stored or toggled as separate rows"). The
  Glossary's Font Size Scale definition (§3) describes the identical shape — "a named,
  pre-approved combination of relative text sizes across the app's heading/body/UI-text roles"
  — three roles resolved from one identifier, exactly like Font Pairing's Display/Body/Mono.
  But FR-21, which enumerates every mechanism Font Size reuses ("Preview (FR-13), Apply (FR-14),
  curation-check (FR-19), Change History (FR-15–FR-17), and runtime-application-without-rebuild
  (FR-12's mechanism, generalized)"), never cites FR-11. Nothing in FR-18–FR-21 states that a
  Font Size scale's heading/body/UI-text values are resolved together from a single `FontSize`
  Setting row rather than stored as three separate Keys — the precise mistake the addendum says
  was already made once for Font Pairing. *Fix:* add an explicit consequence to FR-20 or FR-21
  (or a new FR) stating that a Font Size scale's role values are resolved atomically from one
  `FontSize`-KeyType Setting row, mirroring FR-11's wording, so the fix that had to be
  rediscovered once for Font Pairing isn't left implicit for Font Size.
- **low** NFR-6 formalizes Font Size's curation-vetting requirement with SHALL language and a
  concrete check ("design QA against the app's supported breakpoints and representative content
  ... before it is added to the curated list"), but Font Pairing's equivalent guarantee — never
  violating the `DESIGN.md` "no second serif/sans-serif family" rule — lives only in prose
  inside the Glossary (§3: "vetted ahead of time by design so the existing... rule can never be
  violated") and FR-9's consequences ("Every pairing in the list is vetted by design before it
  can appear here"), with no NFR of its own. The two curated-list mechanisms are asymmetric in
  formal rigor even though the PRD treats them as parallel ("the same guardrail philosophy
  FR-9 already applies to font pairing," §1). *Fix:* either fold Font Pairing's vetting
  requirement into an NFR alongside NFR-6, or note explicitly that Font Pairing's is
  intentionally left as design-process prose because — unlike Font Size — it isn't a
  breakpoint/rendering check.

## Scope honesty — adequate

§7's two `[NOTE FOR PM]` items are well-placed at genuinely deferred decisions (curated list
contents), and `addendum.md`'s "Options considered (rejected/deferred, not in PRD)" section
de-scopes several alternatives explicitly rather than silently. Open-items density is low,
appropriate for a PRD of this stakes.

### Findings
- **low** Non-Goals exist only as embedded prose, never as a dedicated section or
  `[NON-GOAL for MVP]`-tagged callout — e.g. FR-7's consequence ("a new admin UI to *edit* that
  KeyType is separate follow-up work (out of scope here)"), FR-12's consequence ("Introducing a
  pairing that includes a font family not already loaded via `index.html` is out of scope for
  v1"), and §1's "the *UI* for colors, spacing, or logo is future work, not built here" are all
  real scope boundaries but none are collected or tagged, so a reader auditing "what's excluded"
  has to read every FR's consequences rather than scan one list. *Fix:* pull these into a short
  Non-Goals subsection (or tag them inline) so scope boundaries are scannable in one place.
- **low** No `[ASSUMPTION: …]` tags appear anywhere in the PRD, despite several judgment calls
  being made without a cited source (e.g., the Support-tier access rationale in §4.2, or FR-21's
  "generalized" extension of FR-12 to Font Size). This may be because the PRD is genuinely
  well-grounded (the addendum documents verified codebase facts throughout), but the absence of
  any Assumptions Index makes it hard for a reader to distinguish "confirmed with a stakeholder"
  from "inferred by the PRD author." *Fix:* if these were confirmed decisions, no action needed;
  if any were inferred, tag them.

## Downstream usability — adequate

Glossary terms are used consistently (Setting, KeyType, Effective Value, Preview, Change
History all map identically across FRs). FR/NFR IDs are contiguous (FR-1–FR-21, NFR-1–NFR-6)
with no gaps or duplicates, matching §0's stated range. Most cross-references resolve correctly
— FR-19 mirrors FR-10 accurately, FR-20's references to FR-5/FR-16 check out, the Glossary's
Font Size Scale entry correctly cites FR-18/FR-20.

### Findings
- **medium** `addendum.md`'s dev-handoff grounding is now stale relative to the actual staged
  implementation, which weakens it as the "architecture/dev handoff" material §0 says it is.
  Verified against the repo: `git status` shows `BackEnd/src/FlexDemy.Domain/Settings/Setting.cs`,
  `SettingsService.cs`, `SettingsController.cs`, and — notably —
  `FontPairingDefinition.cs`/`FontPairingDefinitionConfiguration.cs` plus a migration
  `AddFontPairingDefinitions` already staged. That directly answers the addendum's own "Open
  Questions for Architecture/Design" item, "Curated list storage mechanism... this addendum
  doesn't pick one, since it's an implementation choice" — it has in fact already been decided
  (a separate reference table, not a second KeyType in the generic store) and built. The
  addendum's "Precedents to model the new table on" section still points an implementer at
  `ErrorRetentionSettings` and `AiTaskConfig` "to model the new table on," when the actual
  generic Setting/SettingsService/SettingsController this PRD specified already exists and is
  what Font Size should extend. *Fix:* refresh the addendum's grounding section to point at the
  now-existing `Setting`/`SettingsService`/`SettingsController`/`FontPairingDefinition` code
  paths rather than the pre-implementation precedents, and close out the "curated list storage
  mechanism" open question with the answer the code already gives.
- **low** FR-17's consequence text hardcodes "FR-10" ("Restoring a historical Value that is no
  longer a currently curated pairing is rejected the same way as FR-10") rather than being
  written KeyType-agnostically. FR-21 asserts Font Size reuses FR-15–FR-17 wholesale, so a
  reader has to infer that FR-17's "FR-10" reference silently means "FR-19 for FontSize" — it
  isn't stated. *Fix:* generalize FR-17's wording (e.g., "...rejected by that KeyType's curation
  check") so FR-21's blanket reuse claim doesn't require the reader to mentally substitute IDs.

## Shape fit — strong

This is correctly treated as an internal-tool capability spec: one full UJ with a named
protagonist, two deliberately-compressed JTBD restatements for mechanically trivial extensions
(Tutor relocation, Font Size) rather than padded-out parallel journeys — the right formalism
level for a Master/Support-only admin screen, not over- or under-built. Brownfield references in
`addendum.md` (file paths, line numbers, the `DESIGN.md` "no second serif/sans-serif family"
rule) were spot-checked against the repo and are accurate in substance, though see the staleness
finding under Downstream usability above.

### Findings
None beyond the staleness finding already logged under Downstream usability.

## Mechanical notes

- KeyType naming is slightly asymmetric: Font Pairing's KeyType is `Font` (not `FontPairing`),
  while Font Size's is `FontSize` (matching its setting name exactly) — FR-20's "KeyType `Font`"
  vs. "KeyType `FontSize`". Functionally harmless, but the two parallel setting types don't
  follow the same naming pattern relative to their KeyType. Not a fix-required item, just worth
  a maintainer's awareness.
- Glossary drift: "Font Size" is used as three slightly different terms depending on context —
  "Font Size Scale" (Glossary term, §3), "Font Size Setting" (§4.7 heading), and "FontSize"
  (KeyType literal, FR-20/FR-21). Each usage is contextually appropriate (concept vs. section vs.
  technical identifier) and mirrors how "Font Pairing" / "Font" KeyType are already split, so
  this reads as intentional layering rather than drift — flagged only so a future editor
  confirms the pattern is deliberate.
- ID continuity: FR-1–FR-21 and NFR-1–NFR-6 are both contiguous, no gaps or duplicates, and
  match the ranges §0 declares.
- Assumptions Index: none exists, and no inline `[ASSUMPTION]` tags appear anywhere in the PRD
  (see Scope honesty finding above) — nothing to roundtrip-check, which is itself worth noting
  since most PRDs at this stakes level carry at least one.
- UJ protagonist naming: UJ-1 names Priya inline with context; the two JTBD-restatements are
  explicitly marked as not full journeys, so the "no floating UJs" check doesn't apply to them.
