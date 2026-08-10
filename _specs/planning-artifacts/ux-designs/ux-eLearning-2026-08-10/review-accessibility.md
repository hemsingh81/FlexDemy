---
title: Accessibility Adversarial Review — DESIGN.md + EXPERIENCE.md
status: draft
reviewed: 2026-08-10
stakes: consumer/launch-grade rigor
scope: DESIGN.md, EXPERIENCE.md (ux-eLearning-2026-08-10)
---

# Accessibility Adversarial Review

**Overall verdict: FAIL — do not sign off the a11y floor as-is.** The spine's own two `[NOTE FOR UX]` flags (Dashboard left-nav, Assignments creation form) are well-founded and under-scoped: the risk is broader than "keyboard/focus-order not re-tested." Independently of those notes, the color-token layer that both files inherit as ground truth contains at least two load-bearing contrast failures computed directly from the documented hex values, and `prefers-reduced-motion` is entirely unaddressed for three separate motion patterns.

---

## 1. Color contrast — computed against DESIGN.md's own hex values

All ratios computed via WCAG relative-luminance formula from the literal hex values in DESIGN.md's `colors` frontmatter (lines 8–24).

### FINDING 1 — CRITICAL: `button-primary` fails AA in both directions
**Location:** DESIGN.md lines 80–85 (`components.button-primary`: background `{colors.citrus-amber}` #EC7B38, text `#ffffff`), reiterated line 146 ("the *only* accent/CTA color... every amber element is either actionable or celebratory") and line 189 ("Primary... used for the single most important action on a card or panel").

- Computed contrast, white (#FFFFFF) text on citrus-amber (#EC7B38) fill: **≈2.82:1**.
- Fails normal-text AA (4.5:1) by a wide margin.
- Also fails the large-text/UI-component floor (3:1) — button labels are `{typography.label}` (0.75rem / 12px, bold per line 85), which does not qualify as "large text" (needs ≥18.66px bold), so 4.5:1 is the applicable threshold, but even the lower 3:1 bar is missed.
- This is the platform's designated *primary* CTA fill — the button color used for "the single most important action" — so this is not an edge-case pairing, it's the highest-traffic interactive element in the system failing contrast at its default state.

### FINDING 2 — HIGH: `citrus-amber` focus ring fails non-text contrast (SC 1.4.11)
**Location:** DESIGN.md line 127 (`components.input.focusRing: '{colors.citrus-amber}'`), line 146 ("focus rings... active-icon states").
- Same underlying color (#EC7B38) against white input backgrounds: **≈2.82:1** against the adjacent white/canvas surface.
- WCAG 2.1 SC 1.4.11 (Non-text Contrast) requires 3:1 for UI component boundaries/focus indicators against adjacent colors. The documented focus-ring color fails this on its own, independent of the text-contrast failure above.
- Because amber is declared the *only* focus-ring and active-state color product-wide (line 146), this failure is systemic, not local to one component.

### FINDING 3 — MEDIUM: `warning` (#D97706) fails normal-text AA
**Location:** DESIGN.md line 21 (`warning: '#D97706'`), line 152 ("Deliberately *not* custom-branded — errors and warnings should look like standard, unambiguous system states").
- #D97706 is Tailwind's `amber-600`. Computed contrast against white: **≈3.19:1**.
- Fails 4.5:1 normal-text AA; only clears the 3:1 large-text/UI floor. This is a well-known Tailwind gotcha — `amber-600` reads as failing on white, `amber-700`/`amber-800` are the shades that clear AA for text. If `warning` is ever used for inline warning *text* (as opposed to purely large icon/badge fills), it will fail.

### FINDING 4 — MEDIUM: `signal-green` (#179765) borderline-fails as text/badge color
**Location:** DESIGN.md line 11 (`signal-green: '#179765'`), line 147 ("Success/progress exclusively. Progress bars, completion percentages, 'Confirmed' status pills"), line 193 (badge-pill "green = success/confirmed").
- Computed contrast against white: **≈3.72:1**.
- Fails 4.5:1 normal-text AA. Badge-pill text is `{typography.eyebrow}` scale (0.625rem / 10px, line 61) — well under the large-text threshold — so if "Confirmed" pill labels or completion-percentage numerals render in `signal-green` text (rather than only as an icon-well tint per the stat-card pattern, line 190), they fail AA. The spec doesn't disambiguate "green as icon/background tint" (line 190's `bg-{accent}/10` pattern, which would be fine) from "green as small text" (line 147's phrasing, which reads as text usage) — this ambiguity itself is a spec gap that should be resolved before build.

### Pairings checked and passing
- `muted` (#5E6A79) on `canvas`/`parchment`/white: ≈5.1–5.5:1 — passes AA (not AAA, but AA is the stated floor).
- `ink-navy` (#143358) / `ink` (#142030) on light backgrounds: very high contrast, no issue.
- White text on `ink-navy` (button-secondary) and white text on `error` red #DC2626 (button-danger): ≈12.8:1 and ≈4.83:1 respectively — both pass (the red case passes but only narrowly, ~4.83:1 vs. 4.5:1 required, worth noting as a fragile margin if the hex ever shifts).

### Open question raised, not answered, by the spine
DESIGN.md/EXPERIENCE.md both point to an existing "high-contrast 7:1 mode" as the inherited a11y floor's headline feature (EXPERIENCE.md line 106). Neither file states whether that mode remaps *component fills* (e.g., button-primary's amber background) or only body-text/background pairs. Given the default theme's primary CTA fails even the *base* AA bar, this is not an academic question — if the 7:1 mode only swaps text colors and leaves amber-fill buttons untouched, the failure persists even in "accessible mode."

---

## 2. The two unverified new surfaces

### Dashboard left-nav / mobile pill bar
**Location:** DESIGN.md lines 128–132 (`nav-desktop`/`nav-mobile` tokens), line 206 ("Resolved during this spec's authoring... same `scrollIntoView` mechanism... verified in-browser at a 500px viewport"); EXPERIENCE.md line 60 (Component Patterns: "Click scrolls to the section (`scrollIntoView`, smooth); active section highlights via click-state, not scroll-spy"), line 97 ("Smooth-scroll section jump... never an instant jump-cut"), line 94 ("Mouse/touch-first, no keyboard-shortcut surface... FlexDemy's primary interaction is reading/clicking, not command-driven navigation"), line 110 (`[NOTE FOR UX]`).

Risks the `[NOTE FOR UX]` doesn't fully scope:
1. **Keyboard operability unstated.** Every description of this control ("click scrolls," "click-state," "Mouse/touch-first... reading/clicking, not command-driven") is phrased in mouse/click terms. Nothing in either file confirms the nav items are real `<button>`/`<a>` elements reachable by Tab and activatable by Enter/Space, as opposed to `onClick` divs — a very common a11y anti-pattern for exactly this "custom scroll-jump nav" shape. Given the doc explicitly frames the product as click-first, this needs an explicit statement, not an inherited assumption.
2. **No focus management on the scroll jump itself.** `scrollIntoView` moves the viewport but not DOM focus. A native `<a href="#section">` anchor jump moves focus to the target automatically; this custom click-handler pattern does not, unless the target section is given `tabindex="-1"` and `.focus()` is called explicitly — neither file mentions this. Net effect: a keyboard/screen-reader user who activates the nav item stays focus-parked on the nav control while the page scrolls under them, so subsequent Tab presses continue from the nav rather than from the newly-visible section, and non-visual users get no context change at all.
3. **No screen-reader announcement of the destination.** No `aria-live` region or focus-move-triggered announcement is specified for "you have jumped to section X," so a screen-reader user gets no equivalent of the sighted "content visibly scrolled into view" cue.
4. **Active-state indication method unstated.** "Active section highlights via click-state" (EXPERIENCE.md line 60) doesn't say whether this is conveyed only by a color change (plausible given `citrus-amber`/`bg-white/15` are the documented active-state treatments, DESIGN.md lines 130, 146) or also via `aria-current`. If color-only, this is both an SC 1.4.1 (Use of Color) risk and compounds Finding 2 above if amber is the active-state color on a light surface.
5. **"Verified in-browser at a 500px viewport" (DESIGN.md line 206) is a visual/responsive-layout verification, not an accessibility verification** — it confirms the pill bar *renders* below `lg`, not that it's keyboard-reachable or operable. A reviewer skimming DESIGN.md's "verified" language could easily conflate it with EXPERIENCE.md line 110's still-open a11y note; the two claims should be kept clearly distinct in the finalize gate's disposition.

### Assignments creation modal
**Location:** EXPERIENCE.md line 65 (Component Patterns: "Assignment creation modal... Two save actions... Publish is disabled until at least one fully-filled question exists"), lines 161–166 (UJ-2 flow: title, description, course-link/Open-Competition flag, dynamic MC questions with correct-answer key, Visibility Mode, Draft/Publish).

Risks not addressed anywhere in the spine:
1. **Repeated-field label association.** A dynamic question builder produces N question blocks, each with an "option text" input × multiple options and a correct-answer radio. Nothing specifies how these are disambiguated for assistive tech (e.g., "Question 2, Option 3 text" vs. a flat list of indistinguishable "Option text" fields) — a real risk of duplicate/ambiguous accessible names.
2. **Radio-group scoping for the correct-answer selector.** "Correct-answer key" (line 164) implies one radio group per question. Nothing specifies `fieldset`/`legend` (or equivalent `aria-labelledby`) scoping per question, without which a screen reader cannot tell which question a given "correct answer" radio group belongs to once there are 2+ questions on screen.
3. **Dynamic add-question focus/announcement.** "Adds MC questions" (line 164) implies an Add-Question action that inserts a new DOM block. No focus-management rule (move focus into the new block's first field) and no `aria-live` announcement ("Question 3 added") is specified — a sighted user sees the new block appear below; a screen-reader/keyboard user gets no equivalent signal.
4. **Publish-disabled reason not communicated to AT.** "Publish is disabled until at least one fully-filled question exists" (line 65) — a disabled button with no programmatic explanation of *why* is a classic AA gap (SC 3.3.1/4.1.2). The Accessibility Floor section (EXPERIENCE.md line 109) only commits to inline red error text for validation errors in general; it doesn't say the Publish-disabled state gets an equivalent inline/live explanation, nor that the error text is wired via `aria-describedby`/`aria-invalid` to its field (the floor states *visual* treatment — color + specific wording — not the AT-association mechanism).
5. **Modal focus trap / initial focus / return focus unstated** — for this modal specifically, and for the "Modal" component generally (DESIGN.md line 194, EXPERIENCE.md line 99). Given this modal explicitly disables click-outside-dismiss "where an accidental dismiss would lose input" (EXPERIENCE.md line 99), the multi-field/dynamic-question complexity makes correct focus containment and return-focus-on-close especially high-stakes here, yet neither file specifies it for any modal in the product.

---

## 3. Hold-visibility "withhold score" state

**Location:** EXPERIENCE.md line 80 (State Patterns: "Hold-visibility submitted... No score, no per-question correct/incorrect marks, no explanations — only 'Submitted — pending tutor review.'"), line 49 (Voice and Tone: exact copy "Submitted — pending tutor review. Your score has been recorded and will appear here once your tutor reviews it.").

The copy itself is good practice — it explicitly states the reason nothing is showing, rather than leaving an ambiguous blank state, so a screen-reader user who *reaches* this text gets an equivalent explanation to a sighted user. The gap is in **how they reach it**: submit is a state transition (quiz options lock, per-question UI is replaced by this message) and neither file specifies whether this transition is announced via an `aria-live` region or whether focus moves to the new status message. A sighted user's eye is drawn to the obvious full-panel re-render; a screen-reader user tabbing/reading linearly may not encounter "Submitted — pending tutor review" at the moment of submission unless it's explicitly wired into a live region or given focus. This is the same class of gap as Finding 2.2 (Dashboard scroll-jump) — the spine documents *what* the message says but not *how AT users are alerted that a new message now exists*.

---

## 4. Confetti / `prefers-reduced-motion` — confirmed unaddressed gap

**Location:** DESIGN.md line 139 ("confetti on a passing quiz score"); EXPERIENCE.md lines 81, 87–88 (confetti at ≥70%, confetti on Hold-then-Reviewed reveal, no confetti re-fire on Re-evaluate).

A full-text search of both files for `prefers-reduced-motion`, `reduced`, `motion`, and related terms returns **zero matches**. This is a confirmed gap, not a plausible one:
- Confetti (`canvas-confetti`, per the task framing) is a whole-viewport particle animation triggered automatically on score reveal — exactly the kind of non-essential motion `prefers-reduced-motion: reduce` exists to suppress, and neither file gates it.
- Two other motion patterns in the same spine are equally ungated: the **crossfade tab transition** (EXPERIENCE.md line 16, "a crossfade transition between tabs, not a hard unmount/mount swap") and the **smooth-scroll section jump** used by both the Dashboard nav and Course Overview's sticky sub-nav (EXPERIENCE.md line 97, "never an instant jump-cut" — CSS `scroll-behavior: smooth` or equivalent, likely vestibular-trigger-relevant for some users).
- The inherited Accessibility Floor (EXPERIENCE.md lines 102–110) lists high-contrast mode, text sizing, focus audio, and keyboard shortcuts as the shipped baseline — `prefers-reduced-motion` support is not among them, and nothing in the floor section claims it's covered elsewhere. Given the product explicitly commits to *three* separate always-on motion effects, this is a real omission for a "consumer/launch-grade" bar, not a nice-to-have.

---

## 5. Other accessibility-relevant observations

- **"Click-anywhere-on-card" is a systemic version of the Dashboard-nav keyboard-operability question.** EXPERIENCE.md line 96 ("Click-anywhere-on-card opens detail (course cards, assignment cards)") is the same interaction shape as the flagged left-nav pattern — a large clickable region that isn't stated to be a real focusable/keyboard-operable element (vs. `<div onClick>`) — but it's used far more pervasively (Discover, My Courses, Available Assignments) and is *not* covered by either `[NOTE FOR UX]` flag. If the left-nav is worth re-verifying, this broader pattern is at least as load-bearing and is currently unflagged.
- **Error announcements are specified visually but not programmatically, product-wide.** The pattern in Finding 2 (Assignments modal, item 4) recurs elsewhere: "Booking race lost" (EXPERIENCE.md line 84, "surface an explicit error on the confirm action") and general form validation (line 109) are both specified as visual/textual treatments only, with no stated `aria-live`/`aria-invalid`/`aria-describedby` wiring anywhere in either file. This is a single root cause worth fixing once at the Accessibility Floor level rather than per-surface.
- **Persistent pre-session countdown toast** (EXPERIENCE.md line 89, `AppointmentToast`, "stays visible and live-updates a countdown") — a live-updating region is exactly the kind of element that, if wired as `aria-live="polite"` naively, will re-announce every tick and spam screen-reader users; if not wired as live at all, non-visual users get no update. Neither treatment is specified. Lower severity than Findings 1–4 but worth a line item given it's explicitly called out as a special/persistent case elsewhere in the doc.
- **`signal-green`/`citrus-amber` "meaning" conventions rely on color semantics** (DESIGN.md lines 146–147, 193: amber = "act here"/celebrate, green = success only) without any stated non-color reinforcement (icon, text label, `aria-current`/`aria-live` status) for the specific cases enumerated above (nav active-state, badge-pill status) — combined with Findings 1/2/4's contrast failures on those same two colors, color-semantic reliance compounds rather than mitigates the risk.
