# Adversarial Review — Admin Settings & Runtime UI Configuration PRD

**Reviewed:** `prd.md` + `addendum.md` (prd-eLearning-AdminSettings-2026-08-15)
**Method:** Cynical read of both documents, cross-checked against the actual codebase files the
addendum claims to have verified (`TeachingStatsCards.tsx`, `TutorEducatorHubView.tsx`,
`TutorDashboardView.tsx`, `MyCoursesSection.tsx`, `useAdminPanel.ts`, `ErrorRetentionSettings.cs`,
`AiTaskConfig.cs`, `DESIGN.md`).

## Findings

- **FR-1 silently breaks an undocumented navigation dependency.** `TeachingStatsCards.tsx` line
  35 renders the Course Creation stat card as `<div id="course-publishing" className="scroll-mt-24"
  ...>`, and `TutorDashboardView.tsx`'s `TUTOR_NAV_SECTIONS` array has a persistent left-nav entry
  `{ id: 'course-publishing', label: 'Course Publishing', icon: GraduationCap }` that scroll-jumps
  to that exact anchor. FR-1 removes this div from the stats row entirely and neither the PRD nor
  the "verified codebase facts" section of the addendum mentions this anchor or the nav item that
  targets it. As written, either the "Course Publishing" nav link silently stops scrolling anywhere
  (dead nav item) or the `id` needs to move to `MyCoursesSection.tsx` — a consequence the PRD never
  states as a requirement and never tests for. This is exactly the kind of hidden coupling a
  "line-number verified" addendum should have caught.

- **FR-3's empty-state copy fix is unspecified.** FR-3 says the copy should be "updated to match
  the trigger's new position" but never gives the actual replacement string, unlike every other FR
  in this PRD which is precise to the pixel/field. It also doesn't address whether directional
  copy ("above"/"beside") is even needed once the trigger sits in the same card as the empty-state
  message — an engineer implementing this has to invent the copy themselves.

- **The atomic unit of a "Font Pairing" is never resolved, and the FRs contradict each other on
  it.** FR-6/FR-7 define a generic one-row-per-Key store. FR-10 says applying a pairing "updates
  the Value(s) for the Font KeyType's Key(s)" — plural, implying separate rows for Display/Body/Mono.
  But FR-8's own worked example ("Toggling Font Pairing's IsActive to false...") and FR-14/FR-15/
  FR-16 all talk about "a Setting" (singular) being toggled, change-logged, and restored. If a
  pairing really is 3+ independent Key rows, nothing in the PRD says Apply/Restore write them
  atomically (single transaction) or that Change History groups them into one restorable unit —
  which matters because FR-9's entire premise is that only vetted, complete pairings can ever be
  live. A partial apply or a restore of just one row (e.g. Body font from an old entry, Display/Mono
  left at current) would silently produce an unvetted, unapproved font combination — the exact
  outcome FR-9 exists to prevent.

- **No FR describes how IsActive is actually set to false.** FR-8 defines the *effect* of
  IsActive=false (revert to hardcoded default) and FR-5 says the list displays each setting's
  IsActive state, but no FR anywhere describes the admin-facing control that flips it. Does Apply
  always set IsActive=true? Is there a separate "Disable"/"Reset to default" action never
  mentioned in §4.4–4.6? IsActive is one of only four columns in the core data model (FR-6) and its
  write path is completely unspecified.

- **The "curated list" guardrail is UI-only, not enforced at the data/API layer.** FR-9 claims a
  vetted pairing "can never be violated through this screen" — note the careful hedge "through this
  screen." FR-6/FR-7/FR-8 describe a generic Key/Value store with no validation rule restricting
  Font-KeyType Values to the approved pairing list. NFR-2 itself flags that the endpoints must be
  locked down "not just hidden from navigation," implicitly acknowledging a direct API call is a
  live threat model — yet nothing stops a direct API call (or a future engineer editing seed data)
  from writing an arbitrary font string into a Font Key, silently breaking the `DESIGN.md`
  "no second serif/sans-serif family" rule this whole feature was supposedly built to protect.

- **Access-level precedent is inconsistent with the addendum's own stated analog.** FR-4 grants
  Settings "the same access level as Tag Management" (Master + Support — confirmed in
  `useAdminPanel.ts`, where Support's `availableSubTabs` includes `masterdata` but not
  `ai-configuration`). But the addendum names AI Configuration (`AiConfiguration.tsx`, Master-only)
  as "the closest existing analog" for the Settings screen's list/edit UX. The PRD borrows its
  interaction pattern from a Master-only screen while granting the *lower*-trust Support tier full
  read/write/apply access to a site-wide, all-users-affected setting — with zero discussion of
  why a support-triage role should be trusted to change live typography for the entire site on a
  founder's informal request (per UJ-1's own persona narrative), when the narrower-blast-radius AI
  Configuration screen is Master-only.

- **NFR-2's access-control claim has no named mechanism.** "Unreachable by any role below
  Support... not just hidden from navigation" is asserted with no policy name, no reference to the
  existing `[Authorize(Policy = ...)]` / `FeatureAuthorizationHandler` pattern this codebase already
  uses, and no testable consequence in the same style as every other NFR/FR. For a security-relevant
  control on a feature that can alter what every user sees, this is thin.

- **Font-flash / FOUC risk is never discussed.** The addendum's own proposed mechanism (fetch
  settings at app load, then inject a `<style>` tag or set inline custom properties) inherently
  means either (a) blocking first paint on a settings fetch, adding latency to every page load
  forever, or (b) rendering hardcoded defaults first and swapping fonts after the fetch resolves,
  producing a visible flash-of-unstyled-font on every page load for every user. NFR-4 addresses only
  the store-unreachable failure case, not the normal-case rendering sequence — a real omission for a
  feature whose entire subject matter is typography rendering.

- **Preview isolation (NFR-3) doesn't address the admin's own multi-tab/multi-session case.** The
  proposed mechanism is a local DOM/style mutation, which isolates from *other users* fine, but the
  PRD never considers whether the same admin's second open tab (or a second device logged into the
  same account) would also see the preview candidate if any shared state (localStorage, a
  broadcast channel, etc.) is used — an unaddressed edge case for a feature that explicitly claims
  session-local isolation as a requirement.

- **"Preview is mandatory before Apply" is implied, never stated as a testable requirement.**
  FR-12/FR-13 read as a happy-path narrative (select → preview renders → Apply), but nothing in the
  FR list has a testable consequence equivalent to "the Apply action is unavailable/disabled until a
  preview has rendered for the currently selected candidate." The Vision section leans hard on
  "no Setting change reaches the live site without an explicit, separate confirmation step after
  seeing what it looks like" — but that safety property isn't actually pinned down as a requirement
  anywhere, only implied by narrative ordering.

- **Change History has no bound.** FR-15 specifies a reverse-chronological list with no pagination,
  retention, or volume cap — notable given this feature sits in the same Admin Panel as, and the
  addendum explicitly cites, `ErrorRetentionSettings`, a precedent whose entire purpose is bounding
  unbounded history. Combined with FR-16 (every restore is itself a new history entry) and the
  Vision's own framing of "iterate on brand presentation," this list has no stated ceiling.

- **Both success metrics are unmeasurable as written.** "Zero engineering tickets filed for
  typography-only changes" has no defined tracking mechanism for an absence of tickets, and no
  stated baseline for current ticket volume. "Time... drops to single-digit minutes" has no
  telemetry/instrumentation requirement anywhere in FR-1 through FR-16 — nothing logs when an admin
  "decides" to change typography, so the metric's numerator can't actually be captured.

- **The counter-metric is orphaned.** §5's "watch applied-change → revert-within-1-hour rate" names
  a monitoring intent but no FR requires logging the data needed to compute it, no owner is named,
  and no dashboard/alerting requirement exists anywhere in the document. It reads as an analyst's
  aspiration bolted onto the NFRs, not a built requirement.

- **The generic Key/Value/KeyType/IsActive model is speculative generality with no committed
  payoff.** The addendum's own rejected-alternatives list concedes a font-specific table was
  explicitly available and rejected only to avoid "a second migration when the next setting type...
  is added" — but no Color/Spacing/Logo settings feature has a PRD, a story, or a date anywhere in
  this repo; v1 ships exactly one KeyType. Per this backend's own `CLAUDE.md`, EF Core migrations
  are a routine, one-command operation (`dotnet ef migrations add`), which makes "avoid a future
  migration" a fairly thin justification for taking on a fully generic CRUD+Preview+History+Restore
  engine now, with the atomicity and IsActive-granularity ambiguities noted above as the direct cost
  of that choice.

- **The feature's core deliverable is gated on unscheduled, unowned work.** FR-9, FR-10, and FR-11
  all depend on a curated Font Pairing list that, per the PRD's own Open Items and the addendum's
  "Open follow-up for design," does not exist yet and has no owner or date attached to producing it
  ("a short design pass"). This is treated as a footnote-level `[NOTE FOR PM]` rather than a blocking
  dependency, despite the entire v1 UI (FR-9's picker) having nothing to display without it.

- **FR-11's scope-limiting assumption is doing more work than its `[ASSUMPTION]` tag suggests.**
  Restricting the curated list to fonts "already loaded via `index.html`" is presented as a minor
  confirm-before-build item, but it's actually a hard structural constraint on what "curated" can
  ever mean in v1 — any future desired pairing that isn't already `<link>`-loaded requires an
  engineering change (adding the `<link>` tag) before it can be added to the curated list, which
  somewhat undercuts the Vision's framing of this as removing the deploy-cycle dependency; only the
  *selection* of an already-available pairing is deploy-free, not the *expansion* of the curated set.
