---
title: Accessibility Review — Course Wizard / Adaptive Learning additions
scope: New content only (Course Content Editor, tree nodes, extraction status, Adaptive Ways menu, keyword popover, exercise runner, math/chemistry/Hindi rendering, Publishing async state, new Admin sub-tabs). Pre-existing Dashboard/Assignments content out of scope (already reviewed).
reviewed against: WCAG 2.1 AA (product-wide floor per EXPERIENCE.md.Accessibility Floor)
files reviewed:
  - _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/EXPERIENCE.md
  - _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/DESIGN.md
date: 2026-08-10
---

# Accessibility Review — Course Wizard / Adaptive Learning Additions

## Verdict

The new Accessibility Floor entries (EXPERIENCE.md lines 154–157) show real, specific engineering — the tree node, Ways menu, and keyword popover all got individually reasoned-through keyboard/AT treatment, and the Hold-then-Reviewed aria-live precedent is explicitly reused rather than reinvented. But the coverage is uneven: two of the new async surfaces (extraction status, Publishing progress) never received the same treatment, one entirely new interactive pattern (the crop tool) is missing from the Accessibility Floor altogether, and the keyword popover's *dismissal* is specified in detail while its *activation* (how a keyboard user opens it in the first place) is never addressed. Math/chemistry alt-text is named as a requirement but has no authoring/generation mechanism behind it. None of the five dimensions is clean; findings below.

---

## 1. Keyboard operability

**Critical — Keyword popover has no specified keyboard activation path (may be mouse/touch-only)**
- Gap: EXPERIENCE.md's Component Patterns row ("Keyword definition popover") and Interaction Primitives both describe the popover only in terms of the "clicked word" and dismissal ("dismisses on click-elsewhere or `Escape`"). The Accessibility Floor bullet for this component (line 156) specifies focus-management and `aria-live` behavior *once triggered*, but nowhere does the spec say how a keyboard-only user triggers it — is each keyword a real focusable element (e.g., an inline `<button>`) reachable by Tab, with Enter/Space opening the popover? Given potentially dozens of keywords per passage, Tab-cycling through all of them is also a usability question the spec doesn't address (e.g., is there a non-linear way to reach a keyword, or do arrow keys move between keywords within a paragraph?).
- Section: EXPERIENCE.md, Component Patterns → "Keyword definition popover" row and Accessibility Floor → "Keyword definition popover" bullet.
- Fix: State explicitly that each keyword is rendered as a real focusable/keyboard-operable inline control (not a `span` with only an `onClick`), reachable in normal Tab order, activated by Enter/Space, matching the same "real element, not `div`/`span` onClick" discipline already applied to the Dashboard section nav and click-anywhere cards. If keyword density makes linear Tab traversal impractical, say so and specify a fallback (e.g., a per-paragraph "glossary" affordance).

**High — Thumbnail crop tool has no keyboard equivalent specified**
- Gap: The New Course Wizard (metadata) row states the Thumbnails step "includes an in-step crop tool enforcing a fixed aspect ratio before an image is accepted." Crop tools are one of the most reliably keyboard-inaccessible UI patterns (drag-handle repositioning/resizing with no numeric or arrow-key fallback). This is a wholly new interactive control introduced in this pass, yet it is entirely absent from the Accessibility Floor list, which otherwise itemizes every other new control (tree node, Ways menu, keyword popover, math/chem alt-text).
- Section: EXPERIENCE.md, Component Patterns → "New Course Wizard (metadata)" row (crop tool clause); Accessibility Floor (missing bullet).
- Fix: Add an Accessibility Floor bullet: crop handles must be independently keyboard-focusable and adjustable (arrow keys nudge position/size in fixed steps, or a numeric x/y/zoom input alternative), with the fixed-aspect-ratio constraint announced to AT so a keyboard user knows why free resize isn't available.

**Low — Exercise runner's "numeric/math" input mechanism unspecified**
- Gap: "Subject-appropriate input per exercise (numeric/math, multiple choice, short text)" doesn't say whether a "math" answer is captured via plain text/LaTeX entry (keyboard-native) or a specialized visual math-input widget (virtual keyboard/palette), which are frequently mouse-only or poorly labeled for screen readers.
- Section: EXPERIENCE.md, Component Patterns → "Exercise runner" row.
- Fix: State the input mechanism for the math/numeric case explicitly and, if a visual equation editor is used, add it to the Accessibility Floor with the same keyboard-operability language used for the crop tool fix above.

**Otherwise clean:** Tree node CRUD/reorder, extraction retry, and Ways menu cycling are all explicitly specified as keyboard-operable with concrete equivalents (move-up/move-down for drag-reorder) — good, specific craft, not just a generic "must be accessible" assertion.

---

## 2. Screen reader / assistive tech

**Critical — `aria-live` treatment is applied to some new async surfaces, not all**
- Gap: The spec explicitly reuses the Hold-then-Reviewed `aria-live="polite"` precedent for exactly two new surfaces: the keyword popover's definition announcement and (implicitly, via the general confirmed/unconfirmed exposure rule) the tree node's state. It is **not** applied to two other new async/status surfaces that change over time without user action:
  - **Extraction status** (Queued → Parsing → Extracting → Done/Failed per file): the badge text itself is presumably present (reuses `badge-pill`), but nothing states the *transition* is announced. A screen-reader user has no way to learn a file finished extracting except by re-navigating to that row.
  - **Publishing (async batch)**: explicitly documented as running "low minutes not seconds" with a node-by-node checklist ("12 of 34 confirmed nodes generated") specifically *because* a static spinner would read as broken for sighted users over that duration — but the same reasoning isn't extended to non-visual users. Nothing specifies incremental announcement (e.g., periodic `aria-live="polite"` updates as the count increments, or at minimum an announcement on completion/failure). This is the most consequential of the two: it's the single async operation in the whole spec with the longest duration and the most detailed sighted-UX reasoning, yet the AT story is silent.
- Section: EXPERIENCE.md, Accessibility Floor (add bullets); State Patterns → "File parsing/extraction in progress," "Publishing (async batch)" rows.
- Fix: Add two Accessibility Floor bullets mirroring the Hold-then-Reviewed pattern: (a) each file's extraction-status badge change is announced via a scoped `aria-live="polite"` region (or announced in a batched/throttled way to avoid a flood if many files finish near-simultaneously); (b) the Publishing checklist's container is an `aria-live="polite"` region that announces meaningful increments (e.g., every N nodes or at defined milestones) and always announces terminal states (all done / any failure), not a play-by-play of all 200+ calls.

**Medium — Budget threshold warning: "visible warning" is under-specified for AT and risks a contrast violation**
- Gap: "Approaching (e.g. 80%) surfaces a visible warning on that AI Task's row" doesn't say whether this is text, an icon, or a color change on the row, and doesn't add an aria-live or `aria-describedby` treatment the way other new state changes got. This also connects to a DESIGN.md finding in §3 below: if implemented as colored text using `{colors.warning}`, DESIGN.md's own "Known gap" note says that exact color fails 4.5:1 for small text.
- Section: EXPERIENCE.md, State Patterns → "Budget threshold approaching / exceeded" row.
- Fix: Specify the warning is icon+text (not color-alone), and that crossing the threshold is exposed to AT (e.g., `aria-describedby` on the row referencing the warning text, or a live region if it can change while the Admin has the page open).

**Low — Node reversion to Unconfirmed isn't explicitly an announcement moment**
- Gap: A structural/AI-content-affecting edit silently reverts a node's confirmed state back to unconfirmed. The confirmed/unconfirmed *state* is covered by the Accessibility Floor's general "exposed to assistive tech" rule, but the *transition itself* (which may surprise a tutor who didn't realize their edit un-confirmed a node) isn't called out as something that should be announced.
- Section: EXPERIENCE.md, Component Patterns → "Course Content Editor — tree node" row.
- Fix: Note that an auto-revert-to-unconfirmed triggered by editing is announced (visually and via `aria-live`) at the moment it happens, not just reflected passively in the node's persistent state indicator.

---

## 3. Color/contrast

Mostly clean: the Ways menu, keyword popover, and exercise runner are explicitly called out in DESIGN.md's Do's and Don'ts as using "this spec's real tokens from the start" (white/hairline/ink-navy/citrus-amber/signal-green), and the extraction-status badge and tree-node confirmed accent both explicitly reuse already-AA-vetted tokens with a non-color-alone pairing (icon/check). Two real findings:

**High — DrilldownPanel.tsx's unremediated off-brand colors now sit under the new feature's primary content**
- Gap: DESIGN.md explicitly confirms (by reading live code) that `DrilldownPanel.tsx` uses off-brand indigo/emerald Tailwind colors that were never swept for AA contrast, unlike every other Tutor-facing surface. The spec flags this as a "known gap, not remediated in this pass" and notes that wiring it to real AI content (this exact feature) is "the natural point to also apply that same color sweep" — but the sweep itself is deferred, not done. This means the flagship new adaptive-learning surface (5-level Drill-Down, now driven by real AI content instead of mock data) ships on a color scheme with no confirmed AA contrast ratios.
- Section: EXPERIENCE.md, Component Patterns → "Drill-Down panel" row; DESIGN.md, Do's and Don'ts (last bullet).
- Fix: Since this pass is explicitly wiring DrilldownPanel to real content, either (a) fold the color remediation into this same change so the new AI content doesn't ship on unverified colors, or (b) if genuinely out of scope, add an explicit blocking follow-up item (not just a "flagged so it isn't missed twice" note) with an owner/gate before this ships to production, since it's a direct WCAG AA product-wide floor violation risk, not a cosmetic inconsistency.

**Medium — `{colors.warning}` reused for the new Budget threshold state carries a pre-existing, unresolved AA gap**
- Gap: DESIGN.md's Colors section already documents that `{colors.warning}` (#D97706) fails the 4.5:1 text threshold against white (~3.19:1) and flags "any small-text `warning` usage" as needing a darker text-only variant "before shipping." The new Budget threshold approaching/exceeded state (EXPERIENCE.md State Patterns) is exactly this kind of usage — a small warning label on an Admin table row — and the spec doesn't connect these two facts or resolve the gap for this specific new usage.
- Section: DESIGN.md, Colors → `{colors.warning}` known-gap note; EXPERIENCE.md, State Patterns → "Budget threshold approaching / exceeded" row.
- Fix: Either confirm the Budget threshold warning is rendered as icon/badge-fill (not small text, which stays within the already-cleared 3:1 non-text threshold) or spec a darker text-only warning variant for this specific usage before implementation.

---

## 4. Math/chemistry/Hindi content

**High — Math/chemistry alt-text requirement has no authoring or generation mechanism**
- Gap: The Accessibility Floor states rendered KaTeX/mhchem notation "carry appropriate `alt`/`aria-label` fallback text where the visual rendering itself isn't screen-reader-parseable." This names the requirement correctly but doesn't say where the alt text comes from. Given this content is AI-extracted/generated (per the New Course Wizard PRD's `extractStructure` pipeline and `explainTopic`/`rewriteExplanation` generation), the natural place for this to be produced is as part of that AI pipeline — but the AI Configuration table (Admin → AI Configuration & Usage) lists exactly six AI Tasks (`extractStructure`, `explainTopic`, `rewriteExplanation`, `generateExercise`, `defineKeyword`, embeddings) and none of them is "generate spoken-math alt text." Without a named pipeline step, model/provider assignment, or budget line for this, there's a real risk it either doesn't get built or falls on the tutor to author manually per equation with no UI support described anywhere for doing so.
- Section: EXPERIENCE.md, Accessibility Floor (math/chem/Hindi bullet); Component Patterns → "AI Configuration table" row (missing task).
- Fix: Either add a 7th AI Task (e.g., `describeNotation`) to the AI Configuration table so alt-text generation is a first-class, budgeted, model-assigned pipeline step alongside the other five, or explicitly decide it's tutor-authored and design the authoring affordance (e.g., an optional alt-text field on math/chem content blocks in the tree editor) — but don't leave it as an unbacked assertion.

**Medium — No `lang` attribute / language-switching plan for Hindi (Devanagari) content mixed with English UI**
- Gap: The same Accessibility Floor bullet bundles Hindi script in with the KaTeX/mhchem alt-text requirement, but Devanagari script is a different accessibility problem: it's real, screen-reader-navigable Unicode text (not a rendering that needs an alt fallback the way KaTeX markup does), so the actual WCAG concern is SC 3.1.2 (Language of Parts) — a screen reader needs `lang="hi"` on Hindi passages/spans embedded in an otherwise English-`lang`-tagged page so it switches pronunciation/voice engine correctly, otherwise Devanagari text gets read with English phonetic rules and becomes unintelligible. This is unaddressed anywhere in either file.
- Section: EXPERIENCE.md, Accessibility Floor (math/chem/Hindi bullet).
- Fix: Split the bullet into two distinct requirements: (1) KaTeX/mhchem non-text rendering needs alt/aria-label fallback (per the finding above), and (2) Hindi/Devanagari passages need `lang="hi"` (or appropriate BCP-47 tag) applied at the content-block level so mixed-language course content is announced with correct pronunciation, satisfying WCAG 3.1.2.

---

## 5. Cognitive load / motion

**Medium — Wizard's "Step N of 4" orientation has no equivalent once handed off to Course Content Editor**
- Gap: Steps 1–4 of the New Course Wizard get a clear, persistent "Step N of 4" subtitle in the side-panel shell. Completing Step 4 hands off to Course Content Editor, a full-width surface hosting an open-ended tree edit plus the Draft/In Review/Review Confirmed/Published lifecycle — but no equivalent persistent "where am I in the overall publishing flow" indicator is specified for this stage. A tutor who benefits from the step-count orientation during metadata entry loses it exactly when the task gets longer and more complex (tree editing, confirmation, Review as Student, Publishing).
- Section: EXPERIENCE.md, Component Patterns → "New Course Wizard (metadata)" / "Course Content Editor" rows; DESIGN.md → "Course Content Editor" component row.
- Fix: Specify a persistent lifecycle-stage indicator in Course Content Editor's sticky header (Draft → In Review → Review Confirmed → Published, with the current stage visually and programmatically marked, e.g., `aria-current`), extending the same "always show where you are" discipline already applied to the metadata wizard and Dashboard section nav rather than dropping it at the handoff point.

**Low — New micro-animations aren't explicitly folded into the `prefers-reduced-motion` rule**
- Gap: The Motion bullet in Accessibility Floor names three specific animated behaviors (confetti, section-nav smooth-scroll, tab crossfade) as required to respect `prefers-reduced-motion: reduce`. New animated elements introduced in this pass — the Ways menu tray opening, the keyword popover's appear/dismiss transition, the Publishing checklist's incremental fill — aren't mentioned, and the bullet's closing line ("None of these are purely decorative... rather than being assumed exempt") implies the list is meant to be exhaustive of what needs coverage, which now reads as stale.
- Section: EXPERIENCE.md, Accessibility Floor → Motion bullet.
- Fix: Extend the Motion bullet (or add a new one) explicitly covering the Ways menu, keyword popover, and any Publishing-checklist transition animations under the same `prefers-reduced-motion` discipline.

**Low — Unsaved-edit protection on Course Content Editor is asserted, not specified**
- Gap: Interaction Primitives states unsaved-edit protection on navigating away from Course Content Editor "follows the same 'don't lose input' principle" as data-entry modals, but (unlike the modal case, which names the concrete mechanism — no backdrop-dismiss, Escape still works) doesn't name a concrete mechanism here (e.g., `beforeunload` confirmation, autosave-on-blur per node, or a leave-confirmation dialog). For a surface that can involve extensive tree editing over what the spec itself says can take real time, this is worth pinning down rather than leaving as a principle.
- Section: EXPERIENCE.md, Interaction Primitives (Course Content Editor unsaved-edit clause).
- Fix: Name the actual mechanism (autosave per-node-edit is the strongest fit given the per-node Confirm action already exists as a natural save point, vs. a page-level beforeunload warning) so implementers aren't left inferring it.

**Otherwise reasonable:** the Publishing state's node-by-node checklist (vs. a spinner), its explicit survival across tab-close/reopen (no restart, no lost state), and the per-file (not blended) extraction progress are all genuinely good anti-confusion, anti-state-loss design decisions for sighted users — the gap is specifically that this good reasoning wasn't extended to non-visual users (see §2) or paired with an equivalent orientation aid post-handoff (above).
