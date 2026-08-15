---
title: FlexDemy Design System
status: final
created: 2026-08-10
updated: 2026-08-15
name: FlexDemy
description: A crisp, high-contrast light-theme design system for an adaptive AI eLearning platform, built on Tailwind v4 tokens with a warm-navy/amber brand pairing, and a hard full-width + responsive layout rule.
colors:
  ink-navy: '#143358'
  citrus-amber: '#BA5012'
  citrus-amber-on-dark: '#EC7B38'
  signal-green: '#179765'
  parchment: '#FAF7EC'
  hairline: '#E1DED4'
  ink: '#142030'
  muted: '#5E6A79'
  canvas: '#FCFAF4'
  surface-secondary: '#F3F0E6'
  dark-canvas: '#0B1421'
  error: '#DC2626'
  error-surface: '#FEF2F2'
  warning: '#D97706'
  chart-teal: '#017E9A'
  chart-violet: '#A07CDB'
  chart-gold: '#D0A92D'
typography:
  display-hero:
    fontFamily: Fraunces
    fontSize: 2.25rem
    fontWeight: '800'
    lineHeight: '1.15'
    letterSpacing: -0.02em
  display-h2:
    fontFamily: Fraunces
    fontSize: 1.5rem
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  display-h3:
    fontFamily: Fraunces
    fontSize: 1.25rem
    fontWeight: '700'
    lineHeight: '1.3'
    letterSpacing: -0.02em
  body:
    fontFamily: Outfit
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Outfit
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: '1.4'
  label:
    fontFamily: Outfit
    fontSize: 0.75rem
    fontWeight: '700'
    lineHeight: '1.3'
  eyebrow:
    fontFamily: Outfit
    fontSize: 0.625rem
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: 0.04em
rounded:
  sm: 0.5rem
  DEFAULT: 0.75rem
  md: 0.75rem # alias of DEFAULT, kept for components that name a size scale (sm/md/lg) rather than DEFAULT/lg/xl
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  card-padding: 1.25rem
  card-padding-lg: 2rem
  card-gap: 1rem
  section-gap: 2rem
  icon-well: 0.75rem
components:
  button-primary:
    background: '{colors.citrus-amber}'
    text: '#ffffff'
    rounded: '{rounded.DEFAULT}'
    padding: '0.625rem 1.25rem'
    fontWeight: '700'
  button-secondary:
    background: '{colors.ink-navy}'
    text: '#ffffff'
    rounded: '{rounded.DEFAULT}'
    padding: '0.625rem 1.25rem'
    fontWeight: '700'
  button-danger:
    background: '{colors.error}'
    text: '#ffffff'
    rounded: '{rounded.DEFAULT}'
  card-stat:
    background: '#ffffff'
    border: '1px solid {colors.hairline}'
    rounded: '{rounded.lg}'
    padding: '{spacing.card-padding}'
    shadow: shadow-xs
  card-section:
    background: '#ffffff'
    border: '1px solid {colors.hairline}'
    rounded: '{rounded.lg}'
    padding: '{spacing.card-padding-lg}'
    shadow: shadow-xs
  card-hero:
    background: '{colors.ink-navy}'
    text: '#ffffff'
    rounded: '{rounded.xl}'
    padding: '{spacing.card-padding-lg}'
    shadow: shadow-xl
  badge-pill:
    rounded: '{rounded.full}'
    fontSize: '{typography.eyebrow.fontSize}'
    fontWeight: '{typography.eyebrow.fontWeight}'
    padding: '0.25rem 0.75rem'
  modal:
    backdrop: 'rgba(0,0,0,0.5)'
    panel-rounded: '{rounded.lg}'
    panel-background: '#ffffff'
  side-panel:
    pattern: 'Azure-Portal-style docked-right blade -- header (title + close X) / scrollable body / sticky footer, not a centered dialog box'
    backdrop: 'slate-950/40, lighter than {components.modal} backdrop -- a dim, not a blackout'
    width: 'full-width on mobile; sm:480px (default) or sm:640px (wide) on larger viewports'
    animation: 'slide-in-right keyframe (translateX 100% -> 0), 220ms ease-out'
    panel-background: '#ffffff'
    footer-background: '{colors.parchment}'
  input:
    background: '#ffffff'
    border: '1px solid {colors.hairline}'
    rounded: '{rounded.DEFAULT}'
    focusRing: '{colors.citrus-amber}'
  nav-desktop:
    background: '{colors.ink-navy}'
    activeState: 'bg-white/15 border border-white/20'
  nav-mobile:
    pattern: bottom tab strip, `flex lg:hidden`, sibling to the `hidden lg:flex` desktop nav — never a bare disappearance
  dashboard-section-nav:
    background: '#ffffff'
    rounded: '{rounded.lg}'
    padding: '{spacing.icon-well}'
    activeState: 'bg-{colors.ink-navy} text-white; active icon uses {colors.citrus-amber-on-dark}, not {colors.citrus-amber} -- see Colors'
    desktopPattern: 'sticky w-56 vertical list, hidden lg:flex'
    mobilePattern: 'sticky horizontal pill bar, overflow-x-auto, flex lg:hidden'
  toast:
    background: 'success/info: #ffffff or {colors.parchment}; error: red-50 -- full-border color varies by variant, not a left accent bar'
    border: 'success: {colors.citrus-amber}/40; error: red-200; info: {colors.hairline}'
    rounded: '{rounded.DEFAULT}'
    shadow: shadow-xl
    position: 'fixed bottom-left -- the opposite corner from the persistent variant below, so the two notification systems never compete for the same corner'
    persistentVariant: 'AppointmentToast — different shell (bottom-right, not bottom-left), adds a countdown readout and stays mounted until the appointment window passes or the user dismisses it; ordinary toasts auto-dismiss, this one does not'
  course-content-editor:
    background: '#ffffff'
    border: '1px solid {colors.hairline} -- Normal only. Maximized is a borderless, edge-to-edge takeover (see maximized below).'
    rounded: '{rounded.lg} -- Normal only. Maximized has no rounding (edge-to-edge).'
    shadow: 'Normal: shadow-lg -- a floating panel over page content, not a resting peer among other cards, so it earns more elevation than any other card-shell component in the system (second only to {components.card-hero}''s shadow-xl). Maximized: none -- there''s no surrounding page visible to sit a card-shell against.'
    normal: 'Default state on every open. max-w-4xl mx-auto, centered -- the one deliberate exception to the w-full rule (see Do''s and Don''ts) -- in its standalone, top-of-page context (New Course Wizard hand-off). w-full instead, uncapped and uncentered, when embedded inline in another surface that already owns its own width (My Courses'' Resume -- see Component Patterns'' My Courses row), since capping/centering a card already nested inside another card''s padding reads as a card within a card. No sticky header either way; the card scrolls with its container like any other card.'
    maximized: 'A true full-viewport takeover -- fixed inset-0, z-50 (the same idiom as this app''s other fixed-inset-0 overlays: SidePanel, CourseReviewModal, FlashcardsModal), stacking above Navbar''s own z-50 sticky header rather than sitting below it. Reached only by an explicit Maximize click, not the opening state. Header stays put as a shrink-0 flex item while the body becomes its own flex-1 overflow-y-auto scroll region beneath it.'
    toggle: 'Icon-button pair (maximize/restore glyphs) in the header, beside Close. Always resets to Normal on a fresh open -- the choice doesn''t persist across sessions.'
  content-tree-node:
    background: '#ffffff'
    border: '1px solid {colors.hairline}'
    rounded: '{rounded.DEFAULT}'
    padding: '{spacing.card-gap}'
    confirmedState: 'subtle {colors.signal-green}-tinted left accent or check icon once confirmed -- unconfirmed stays a plain hairline border, never color-alone (see Accessibility Floor)'
  extraction-status-badge:
    pattern: 'reuses {components.badge-pill} exactly -- navy fill = in-progress (queued/parsing/extracting), {colors.signal-green} = done, {colors.error} = failed. No new color language.'
    inProgressSpinner: 'Queued/Parsing badges additionally carry a small `{components.spinner}` (xs, white, reusing the existing shared Loader2/animate-spin icon already used app-wide -- Admin tables, form-submit buttons, ConfirmModal) inline before the label text. Done/Failed carry no spinner -- they are resolved states, not in-progress ones.'
  ways-menu:
    background: '#ffffff'
    border: '1px solid {colors.hairline}'
    rounded: '{rounded.DEFAULT}'
    pattern: 'small pill/tray anchored near the Drill-Down "Explain more" action -- secondary visual weight, not a full modal or side-panel'
  keyword-popover:
    background: '#ffffff'
    border: '1px solid {colors.hairline}'
    rounded: '{rounded.DEFAULT}'
    shadow: shadow-md
    pattern: 'lightweight anchored popover at the clicked word -- not a modal or side-panel'
  exercise-runner:
    background: '{colors.parchment}'
    border: '1px solid {colors.hairline}'
    rounded: '{rounded.lg}'
    padding: '{spacing.card-padding}'
---

## Brand & Style

FlexDemy reads as **Confident Academic** — a serif-display, high-contrast light theme that feels like a well-funded university portal crossed with a modern SaaS product, not a startup toy or a children's app. The tagline "My time. My academy." and the "Learner-Driven Adaptive AI System" framing set the posture: personal ownership of a rigorous, AI-assisted education, delivered without gimmick.

The visual language pairs a deep, authoritative navy (`{colors.ink-navy}`) with a warm citrus amber (`{colors.citrus-amber}`) as the single accent color that means "act here." Everything else is quiet — cream/parchment surfaces, hairline borders, generous whitespace, soft rounded cards. The one place FlexDemy allows itself real warmth and celebration is *earned achievement*: streaks, mastery points, confetti on a passing quiz score. Restraint everywhere else makes those moments land.

**Full-width, always.** FlexDemy does not use a centered, max-width "content column" anywhere in the product. Every surface is `w-full`, scaling from a compact tablet to an ultra-wide monitor without artificial clipping. This is a deliberate, non-negotiable brand posture (see Layout & Spacing) — the product is meant to feel expansive and data-rich, not boxed into a blog-post-width container. `[ASSUMPTION: this "why" narrative is inferred from the existing full-width implementation + the user's explicit constraint; not independently confirmed with a brand rationale beyond "make it a hard rule."]`

## Colors

- **`{colors.ink-navy}` (#143358)** — Primary brand color. Nav chrome, hero/banner backgrounds, primary headings' implicit authority color, the "secondary" button fill. This is what makes FlexDemy read as academic-serious rather than playful. Never used for body text at small sizes on light backgrounds without sufficient weight — reserved for chrome, headers, and buttons.
- **`{colors.citrus-amber}` (#BA5012)** — The *only* accent/CTA color, in its **on-light role**: primary button fills (with white text on top), focus rings, and any icon/text sitting directly on white, parchment, or another light surface. Darkened from the original brand orange specifically so white text on top clears WCAG AA with a real margin (~4.95:1 against the 4.5:1 floor — deliberately not razor-thin, since rendering/anti-aliasing variance could tip a thin margin below threshold).
- **`{colors.citrus-amber-on-dark}` (#EC7B38)** — The same accent color's **on-dark role**: icon or text color placed directly on `{colors.ink-navy}` (or a translucent white overlay chip sitting on navy) — the Dashboard section nav's active icon, hero-banner badges, the top-nav streak flame, and similar. `{colors.citrus-amber}` fails badly here (~2.58:1 against navy) precisely because it was darkened for the opposite role; this is the original, brighter citrus tone, which was already correct for on-navy use (~4.535:1, clearing both the 3:1 icon/UI-component floor and the 4.5:1 text floor) and only ever failed in the on-light/white-text-on-button role. **No single hex clears AA in both roles at once** — sweeping the same hue/saturation from light to dark shows contrast-vs-white and contrast-vs-navy moving in opposite directions with no overlap at the AA floor, so this is a genuine two-token split, not an oversight to consolidate later.
- Across both roles: if something is orange, it is either the thing to click next or the thing currently on fire (streak). Not used decoratively — every amber element is either actionable or celebratory. Both values are applied to the live Tailwind/CSS/component code (`index.css`'s `@theme`/`:root` tokens and all hardcoded hex occurrences) — spec and shipped product are in sync.
- **`{colors.signal-green}` (#179765)** — Success/progress exclusively. Progress bars, completion percentages, "Confirmed" status pills, online-availability dots. Never used for anything else — green always means "this succeeded / this is good." **Known gap, not remediated in this pass:** at small text sizes (e.g. a status label rendered in this green on white) contrast is borderline against AA — this color is spec'd for icon/dot/fill use, which only needs to clear the 3:1 non-text threshold (it does), not the 4.5:1 text threshold. If any component ever renders this as small body/label *text* rather than an icon, dot, or bar fill, that specific usage needs its own darkened text-only variant — flagged, not fixed, since no such usage was confirmed as currently shipping.
- **`{colors.parchment}` (#FAF7EC)** — Warm secondary surface. Section backgrounds that need to sit visually "behind" a white card, hover states on nav items, the calm resting color for anything not asking for attention.
- **`{colors.hairline}` (#E1DED4)** — The near-universal border color. Every card, input, and divider uses this exact hairline — consistency here is load-bearing for the "crisp" feel; do not substitute Tailwind's stock `slate`/`gray` border shades.
- **`{colors.ink}` (#142030)** / **`{colors.muted}` (#5E6A79)** — Primary and secondary text ink. Ink for headings/body, muted for captions, timestamps, and secondary metadata.
- **`{colors.canvas}` (#FCFAF4)** — The page canvas behind everything (distinct from `parchment`, which is a surface color within the page).
- **`{colors.error}` / `{colors.error-surface}` / `{colors.warning}`** — Stock Tailwind red-600/red-50/amber-600. Deliberately *not* custom-branded — errors and warnings should look like standard, unambiguous system states, not a designed brand moment. **Known gap, not remediated in this pass:** `{colors.warning}` (#D97706, stock amber-600) also fails the 4.5:1 text threshold against white (~3.19:1) — same rule as `{colors.signal-green}` above: fine as an icon/badge-fill color (clears 3:1 non-text), not confirmed safe as small text. Flag any small-text `warning` usage for a darker text-only variant before shipping.
- **`{colors.chart-teal}` / `{colors.chart-violet}` / `{colors.chart-gold}`** — Reserved for multi-series data visualization only (analytics charts). Never used in UI chrome.
- **`{colors.surface-secondary}` (#F3F0E6)** — A second, slightly darker/denser secondary surface than `{colors.parchment}`, for stacking two "recessed" levels within one card (e.g. a nested list row inside an already-parchment section) without reaching for a border to separate them.
- **`{colors.dark-canvas}` (#0B1421)** — Reserved, unused in the current light-only theme. Not a dead token to remove — it's the anchor point for a future dark-mode variant of `{colors.canvas}`, kept intentionally defined so a dark theme has a starting value rather than being invented from scratch later.

## Typography

Display headings use **Fraunces** (`{typography.display-hero}` / `{typography.display-h2}` / `{typography.display-h3}`) — a serif with real weight and a tight, slightly negative letter-spacing that gives every `h1`/`h2`/`h3`/`.font-display` element academic gravity. Body and UI text use **Outfit**, a clean geometric sans, for everything that needs to disappear and let the content read.

`[NOTE FOR UX]` `FrontEnd/docs/FRONTEND_PRD.md` §3 states the fonts as "Playfair Display / Plus Jakarta" — this is stale prose that never matched the shipped CSS (`Fraunces` / `Outfit`, confirmed in `index.css`). This DESIGN.md is the corrected source of truth; that PRD line should be fixed to stop propagating the wrong names.

Scale: `{typography.eyebrow}` for uppercase micro-labels and badges → `{typography.label}` for stat labels and button text → `{typography.body-sm}` for captions → `{typography.body}` for default UI/body copy → `{typography.display-h3}` for subsection headers → `{typography.display-h2}` for section/stat headers → `{typography.display-hero}` for page-level welcome banners, scaling down on mobile (e.g. `text-2xl sm:text-3xl lg:text-4xl`). Weight convention: `font-bold` is the default for every display heading; `font-extrabold` is reserved for hero banners on navy backgrounds and big score/result callouts — extrabold is a moment, not a default.

## Layout & Spacing

**Full-width is the layout, not an option.** Every top-level surface renders inside a `w-full` container with responsive horizontal padding (`px-4 sm:px-6 lg:px-8 xl:px-12`) and **no** `max-w-*` wrapper anywhere — this holds from the top-level `<main>` down through every feature page. A screen that introduces a centered, capped-width column is a visual regression, not a stylistic choice.

**Responsive is the layout, not an option.** Every surface must render usably from small-tablet width up through ultra-wide desktop. FlexDemy is not a native mobile app and is not optimized primary-for-phone, but "responsive" here means no surface may *silently lose functionality* on a narrower viewport — see the Navbar pattern below, which is the standard every other responsive element must follow.

The spacing rhythm runs on Tailwind's 4px base scale: `{spacing.card-padding}` (20px) for standard card interiors, `{spacing.card-padding-lg}` (32px) for hero sections and large panels, `{spacing.card-gap}` (16px) between related inline elements, `{spacing.section-gap}` (32px) stacking major page sections vertically. This rhythm is consistent across the codebase — do not introduce arbitrary pixel values outside the Tailwind scale.

**The reference pattern for "responsive" is `Navbar.tsx`:** desktop nav (`hidden lg:flex`) has a *sibling* mobile nav (`flex lg:hidden`, a bottom tab strip) — the same navigational capability is always present, just reshaped per breakpoint. An element that goes `hidden lg:flex` with no `lg:hidden` sibling providing the same capability is a bug against this rule, not an accepted trade-off. See Do's and Don'ts.

## Elevation & Depth

Elevation is deliberately subtle and mostly about presence, not drama. `shadow-xs` is the default resting elevation for every card and section (stat cards, section cards) — just enough to lift white off cream. `shadow-2xs` marks quieter chrome (sidebar/nav shells). `shadow-md` marks interactive elevated elements (buttons, hover states). `shadow-xl`/`shadow-2xl` are reserved for the two things that should visually command the page: hero banners and open dropdown/modal overlays. There is no diffused/tinted "ambient glow" shadow language here (unlike softer editorial systems) — shadows are crisp and functional, signaling stacking order more than mood.

## Shapes

Corner radius scales with the size and "weight" of the container, not decoratively:
- `{rounded.DEFAULT}` (0.75rem / `rounded-xl`) — buttons, form inputs, icon wells, nav pills. The default touch/click target shape.
- `{rounded.lg}` (1rem / `rounded-2xl`) — cards, panels, modal bodies, the sidebar nav shell.
- `{rounded.xl}` (1.5rem / `rounded-3xl`) — hero banners and the largest page-level containers only.
- `{rounded.full}` — avatars, badges/pills, progress rings, circular icon buttons.

Never mix tiers arbitrarily within one composition — a card at `rounded-2xl` containing a button at `rounded-2xl` reads as visually flat; the button should step down to `rounded-xl`.

## Components

- **Buttons** — Primary (`{components.button-primary}`): amber fill, white text, used for the single most important action on a card or panel. Secondary (`{components.button-secondary}`): navy fill, white text — the default/most common button, used for "Continue," "Book," "Save," navigational actions. Danger (`{components.button-danger}`): stock red, reserved for destructive/irreversible actions. All buttons: `rounded-DEFAULT`, bold label text, `disabled:opacity-60`.
- **Stat card** (`{components.card-stat}`) — White card, hairline border, `shadow-xs`, containing a color-tinted icon well (`bg-{accent}/10 border-{accent}/20`, sized via `{spacing.icon-well}`) beside a label/value pair. The icon-well tint rotates per metric (amber/navy/purple/green) but the card shell itself never changes.
- **Section card** (`{components.card-section}`) — The workhorse container for any titled block of content: heading row (icon + `{typography.display-h3}` title, optional right-aligned meta/action), then content.
- **Hero/banner** (`{components.card-hero}`) — Navy fill, white text, the one place large-scale `{colors.citrus-amber}` glow accents (blurred circles) are allowed as background texture.
- **Badge/pill** (`{components.badge-pill}`) — Rounded-full, eyebrow-scale text, used for status labels (Draft/Published, Confirmed, source tags) and filter chips. Color varies by semantic meaning (navy = neutral/informational, green = success/confirmed, amber = attention/competition, red = error).
- **Modal** (`{components.modal}`) — Centered panel over a `black/50` backdrop blur, `rounded-2xl` white body. Never stack a second modal over an open modal. Still used for lighter, one-shot confirms elsewhere in the product (booking confirmation on the Course Overview flow, course review, Admin row delete-confirmation, Course Content Editor's cascading-delete confirm on a Chapter/Topic) that weren't in scope for the side-panel migration below — a delete-confirm is a single yes/no decision, not a data-entry flow, so it stays a centered modal even on screens whose Add/Edit/Update flows moved to `{components.side-panel}`.
- **Side panel** (`{components.side-panel}`) — The standard replacement for `{components.modal}` on every create/edit/attempt flow that opens from a Dashboard or Admin surface (Tutor: Create Assignment, Submissions review, New Course Wizard's metadata steps, Add Teaching Calendar Slot, Create & Schedule Public Live Class; Student: Attempt Assignment, Schedule Lesson, Book Slot, Request Group Pool; Admin: Add/Edit Master Data rows, Add Support User, Edit Support User, Reject Tutor Application, Tag Management row create/edit). Slides in from the right edge instead of scaling up from center — an Azure-Portal "blade" pattern, not a dialog box. Data-entry panels never dismiss on a stray backdrop click (Escape always works); read-only-ish panels (Submissions review) may allow it. Multi-step flows (New Course Wizard) keep the same header/body/footer shell across steps — only the subtitle ("Step N of 4"), body content, and footer buttons change per step. **As of the New Course Wizard PRD, the wizard's side panel covers only its first 4 steps (Title/Tags/Taxonomy/Thumbnails)** — completing Step 4 hands off to Course Content Editor as its own full-width surface (see below), not a 5th blade step; the content-authoring flow simply doesn't fit the panel's `sm:480px`/`sm:640px` width once it involves a multi-level tree editor and rendered math/chemistry/image content. A panel that swaps its whole body for a one-time result (e.g. Admin's Add Support User → temporary-password reveal) keeps the same header/footer shell and only replaces body content and footer actions, same discipline as the wizard's step-swap.
- **Course Content Editor** (`{components.course-content-editor}`) *(New Course Wizard PRD)* — Full-width page surface, not a panel or modal, reached after the wizard's Step 4 — this is the one wizard-adjacent surface that behaves like Course Player's reading pane rather than like the metadata side panel, because a Chapter→Topic→Subtopic tree with rendered math/chemistry/image content needs reading and editing room a 640px blade can't give it. White shell, hairline border, `{rounded.lg}` — a real card shell now (previously flat/borderless against the page background, an inconsistency with every other top-level card in the system; fixed alongside the Maximize/Restore toggle below). Composed from `{components.content-tree-node}` rows plus `{components.extraction-status-badge}` per uploaded file; header carries a persistent Draft→In Review→Review Confirmed→Published stage indicator (added in accessibility review, so the wizard's "Step N of 4" orientation doesn't vanish at the handoff), and **Confirm** and **Review as Student** actions live in the same header/footer area, not buried in scroll. **Maximize/Restore toggle:** defaults to Normal — a centered `max-w-4xl` card (`shadow-lg`, bordered/rounded, no sticky header — scrolls with the page like any other card), so a tutor lands with the surrounding Dashboard chrome still visible. Maximize turns it into a true full-viewport takeover — `fixed inset-0`, `z-50` (stacking above the Navbar's own `z-50` sticky header, the same idiom as this app's other fixed-inset-0 overlays: `{components.side-panel}`, `{components.modal}`), edge-to-edge with no border/rounding/shadow, header pinned at the top while the body scrolls in its own region beneath it — for a genuinely distraction-free editing session, not just a wider in-page card. Restore returns it to Normal. Always resets to Normal on a fresh open. See Do's and Don'ts for why Normal's width cap — now the default, not just a toggled-away-from state — is a deliberate exception to the `w-full` rule, not a regression of it.
- **Content tree node** (`{components.content-tree-node}`) — One row per Chapter/Topic/Subtopic/Content Block inside Course Content Editor: white card, hairline border, `{rounded.DEFAULT}`, expand/collapse + edit/delete/reorder controls, and an explicit Confirm action. Confirmed state gets a subtle `{colors.signal-green}` accent (never color-alone — see Accessibility Floor); unconfirmed stays plain. Nests visually by indentation, same "container implies hierarchy" idiom as an accordion, not a separate tree-line/connector graphic.
- **Extraction status badge** (`{components.extraction-status-badge}`) — Reuses `{components.badge-pill}` exactly, no new visual language: navy = queued/parsing/extracting (in progress), `{colors.signal-green}` = done, `{colors.error}` = failed (with an inline retry action scoped to that one file).
- **Adaptive Ways menu** (`{components.ways-menu}`) — Small white pill/tray, hairline border, `{rounded.DEFAULT}`, anchored near Drill-Down's "Explain more" action inside `DrilldownPanel.tsx` — deliberately lighter-weight than that panel itself, signaling "secondary, optional path" rather than competing with the primary drill-down action for attention.
- **Keyword definition popover** (`{components.keyword-popover}`) — White, hairline border, `{rounded.DEFAULT}`, `shadow-md`, anchored at the clicked word. Lightest-weight overlay in the system — lighter than a toast, well below modal/side-panel weight — because it's a one-line lookup, not a task.
- **Exercise runner** (`{components.exercise-runner}`) — Parchment-fill card (`{colors.parchment}`, hairline border, `{rounded.lg}`), inline within Course Player below the relevant Topic/Subtopic content — same "expands in place, not a modal" idiom as the existing Assignments Quiz runner, reusing that established pattern rather than inventing a second one.
- **Form input** (`{components.input}`) — White fill, hairline border, `rounded-xl`, amber focus ring. Error state swaps the border/ring to `{colors.error}` red — never a custom brand color for error states.
- **Navigation** — Desktop: navy top bar with pill-highlighted active state. Mobile: bottom tab strip, same set of destinations, icon + label. Any *secondary* in-page navigation (e.g. a section-jump sidebar) must follow the same swap discipline — see Do's and Don'ts.
- **Dashboard section nav** (`{components.dashboard-section-nav}`) — Secondary, in-page navigation distinct from `nav-desktop`/`nav-mobile` (the primary app-level nav): a click-to-scroll jump list for Dashboard's own sections (Weekly Study Goals, Adaptive Schedule, My Courses, Assignments, etc.). White shell, `{rounded.lg}`, amber-tinted active state. Desktop renders a `sticky` vertical list beside the content column; below `lg` it reshapes into a `sticky` horizontal scrollable pill bar rather than disappearing — the same swap discipline as the primary nav.
- **Toast** (`{components.toast}`) — White (or parchment for `info`) card, `shadow-xl`, `{rounded.DEFAULT}`, a full colored border carrying the semantic variant: `success` uses `{colors.citrus-amber}` (a deliberate departure from green-for-success, chosen for visibility against the page's white/cream chrome), `error` uses red, `info` uses the neutral hairline. Stacks bottom-left. Auto-dismisses after a few seconds by default. The one persistent exception is the booking-confirmation `AppointmentToast`, a separate component docked bottom-right (opposite corner, so the two never compete for space), which adds a countdown readout and stays mounted until its window passes or the user dismisses it — do not apply the default auto-dismiss timer to it.

## Do's and Don'ts

- **Do** build every new surface `w-full`, no `max-w-*` wrapper, ever.
- **Do** pair every `hidden lg:flex` (or any breakpoint-gated navigational element) with an explicit smaller-viewport equivalent that preserves the same capability — mirror `Navbar.tsx`'s bottom-tab pattern.
- **Do** use `{colors.hairline}` for borders and `{colors.signal-green}` only for success/progress — don't reach for Tailwind's stock `slate`/`emerald` shades as substitutes.
- **Do** keep amber (`{colors.citrus-amber}`) meaning exactly one of two things: "click this" or "celebrate this." Don't use it as a decorative accent.
- **Don't** introduce a second serif or a second sans-serif family. Fraunces for display, Outfit for everything else — no exceptions per-feature.
- **Don't** hardcode arbitrary hex values (`text-[#143358]`) in new code without a strong reason — a token layer already exists in `index.css`'s `@theme` block (`--primary`, `--accent`, etc.) but most existing components bypass it with raw hex. This DESIGN.md's `colors` frontmatter is the canonical source; new code should prefer the semantic CSS variables where practical, and existing hardcoded-hex code is a known, accepted inconsistency to migrate opportunistically, not a pattern to keep extending.
- **Resolved during this spec's authoring:** `DashboardSectionNav.tsx` previously shipped `hidden lg:flex` with no mobile/tablet equivalent. Fixed to render a second, `flex lg:hidden` horizontal sticky-top pill bar below `lg` (same sections, same `scrollIntoView` mechanism, same active-state styling logic, just reshaped) — verified in-browser at a 500px viewport. This is now the canonical example of the "pair every breakpoint-gated nav with a same-capability equivalent" rule, alongside `Navbar.tsx`.
- **Resolved during this spec's authoring, in two rounds:** (1) the live amber (#EC7B38, originally the single citrus-amber value) failed WCAG AA against white text at ~2.82:1 — remediated by darkening to `{colors.citrus-amber}` (#BA5012, ~4.95:1 with white), after an intermediate over-dark `#B04C11` attempt (~5.4:1) was flagged as no longer reading as visibly amber. (2) That fix then broke the *opposite* case: icons/text using the same amber directly on the navy background (Dashboard section nav's active icon, hero-banner badges, the streak flame) dropped to ~2.58:1 against navy, since the original #EC7B38 had been fine there (~4.535:1) and only failed in the on-light role. Rather than keep chasing one hex for two incompatible roles, split into two tokens — `{colors.citrus-amber}` for on-light/button-fill, `{colors.citrus-amber-on-dark}` (#EC7B38, the original value, now with a real semantic role instead of being a deprecated "shipped" marker) for on-navy. See Colors above. Both applied across the live Tailwind/CSS/component code; 15 on-navy icon/text instances across 12 files were swept from `{colors.citrus-amber}` to `{colors.citrus-amber-on-dark}`.
- **Resolved during this spec's authoring:** `TutorEducatorHubView.tsx`'s root container shipped `max-w-7xl mx-auto`, capping and centering the entire "Availability & Performance" Dashboard section — a direct violation of the "no max-w-* wrapper, ever" rule above. Removed; the section is now `w-full` like every other Dashboard section. (The Course Player's reading pane, `max-w-4xl` on the inner text column inside an already-`flex-1` `<main>`, is a distinct, intentional line-length-for-readability pattern and is not this bug.)
- Course card, Booking slot table/grid, and the Public Live Masterclass card are not separately defined in `{components}` — they compose from `{components.card-stat}` / `{components.card-section}` / `{components.badge-pill}` already defined above (a bordered white card shell with a status/source `badge-pill`), not a distinct visual primitive of their own.
- **Exception, revised when the toggle's default flipped to Normal:** `{components.course-content-editor}`'s Normal state — now the default on every open, not a state a tutor has to toggle away to reach — is `max-w-4xl mx-auto` **in its standalone, top-of-page context only** (the New Course Wizard hand-off), the sole surface in the system whose *resting* layout is capped rather than `w-full`. This is a wider exception than the rule originally anticipated: when Maximized was the default, every fresh open landed `w-full`-compliant and only a deliberate toggle-away produced the capped width; now the capped width *is* what a tutor sees on open, and full-width only appears once they explicitly hit Maximize. Still scoped narrowly — one surface, one component, reversible with a single click, not a precedent for capping any other top-level surface's baseline. When this same component is instead embedded inline inside another surface (`fullWidth` — My Courses' Resume, see Component Patterns), Normal drops the cap entirely and is `w-full` like everything else, because the embedding surface (not this component) already owns the width decision there — this note exists so the capped-by-default exception doesn't get miscited as universal to the component when it's really conditional on where it's mounted.
- **In scope for the New Course Wizard implementation, not deferred:** `DrilldownPanel.tsx` (confirmed by reading the live code) uses off-brand indigo/emerald Tailwind colors throughout — never swept in the earlier remediation rounds above, unlike the Course Creation Wizard panel and other Tutor modals. Decided in the accessibility review: wiring it to real AI content per the New Course Wizard PRD is the same pass that applies the `{colors.ink-navy}`/`{colors.citrus-amber}`/`{colors.signal-green}` sweep — this does not ship as a follow-up. Do not extend the indigo/emerald styling into any new component built alongside it (Ways menu, keyword popover, exercise runner all use this spec's real tokens from the start).
