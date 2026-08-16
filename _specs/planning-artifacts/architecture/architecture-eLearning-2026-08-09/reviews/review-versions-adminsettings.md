# Reviewer Gate — Lens: Web-Verified Versions & Reality-Checked Decisions

**Scope:** AD-8 (`ARCHITECTURE-SPINE.md` lines 91–95) — `SiteSettingsContext`'s runtime font-override mechanism: `document.documentElement.style.setProperty('--font-display', ...)` (and `--font-sans`, `--font-mono`) against Tailwind v4's `@theme` block. AD-8 names no new npm package, so this review targets the technical claim itself, not a version pin.

**Method:** (1) read `FrontEnd/src/index.css` directly to check the claim against the real, current CSS, not an assumed shape; (2) independent web search/fetch against the official Tailwind CSS v4 docs (`tailwindcss.com/docs/theme`) as of Aug 2026, rather than trusting training-data recall of `@theme` compilation behavior; (3) checked `FrontEnd/package.json` to confirm the installed `tailwindcss` version matches the spine's Stack table claim.

## Verdict

AD-8's mechanism is sound and checks out against both the real project CSS and current Tailwind v4 documentation. No defect found. One thing was worth independently verifying rather than taking on faith (see Finding 1), because a secondary source surfaced during research initially suggested the opposite of what AD-8 assumes — the primary/official doc resolved it in AD-8's favor.

## Findings

### Finding 1 (verified, not a defect) — the one claim that actually needed checking: does plain `@theme` (no `inline` modifier) emit to `:root` by default?

- **What was checked:** AD-8's whole mechanism depends on `--font-display`/`--font-sans`/`--font-mono` actually existing as literal CSS custom properties on `:root` in the compiled output — if Tailwind v4 only emitted them when using the `@theme inline` modifier (a real, documented Tailwind v4 feature), then `document.documentElement.style.setProperty()` would have nothing to override, since `index.css` uses a plain `@theme { ... }` block (line 4), not `@theme inline`.
- **Initial signal (secondary source, DeepWiki-hosted summary):** claimed the opposite — that "standard `@theme` blocks... are not emitted as CSS custom properties in the output" and only `@theme inline` emits to `:root`.
- **Resolution (primary source, official docs):** fetched `tailwindcss.com/docs/theme` directly. It states plainly: *"All of your theme variables are turned into regular CSS variables when you compile your CSS,"* and shows the compiled example output as a `:root { --font-sans: ...; --font-mono: ...; ... }` block generated from a plain `@theme` directive with no `inline` modifier. The `inline` modifier's actual purpose is unrelated to whether `:root` emission happens at all — it controls how theme values that themselves reference another custom property get resolved into utility classes.
- **Verdict:** AD-8's assumption is correct. Good that this was checked against the primary source rather than accepted from a secondary summary, since that summary was actively pointing the wrong way.

### Finding 2 (verified against real file) — `index.css`'s font variables are direct literals, not aliased, so the override has no indirection to defeat it

- `FrontEnd/src/index.css` lines 5–7 define the three font variables as direct leaf values inside `@theme`:
  ```css
  --font-display: "Fraunces", Georgia, serif;
  --font-sans: "Outfit", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  ```
  This is unlike the file's color tokens (e.g. line 14, `--color-background: var(--background)`), which alias through a second custom property defined separately under `:root` (line 42). Because the font vars have no such indirection, `setProperty('--font-display', ...)` on `document.documentElement` overrides the one and only place the value lives — there's no second layer that could silently keep resolving to the old value.
- No `!important` is present on any of the three declarations (lines 5–7), so there's nothing in the stylesheet that could out-rank an inline-style override.

### Finding 3 (verified) — cascade mechanics are correct and version-independent

- `:root` (the selector Tailwind's compiled `@theme` output uses) matches the document's root element, which in an HTML document is `<html>` — i.e. exactly `document.documentElement`. Setting a property via `.style.setProperty()` writes to that element's inline `style` attribute.
- Per the CSS cascade, an element's inline style always outranks any declaration from an external or embedded stylesheet targeting that same element (including Tailwind's `@layer theme` output), provided neither side uses `!important` — which the check in Finding 2 confirms is the case here. This is foundational, unchanged CSS Cascading and Inheritance spec behavior (`CSSStyleDeclaration.setProperty()` has been standard since the Custom Properties spec, ~2016), not something that could be "out of date" the way a library API might be — correctly, AD-8 doesn't cite a version for it and doesn't need to.
- Consumption is also correctly assumed: `FrontEnd/src/index.css` line 93 (`body { font-family: var(--font-sans); }`) and line 98 (`h1, h2, h3, .font-display { font-family: var(--font-display); }`) resolve these variables via `var()` at the point of use. Custom properties inherit down the DOM tree, so a single `setProperty()` call on `document.documentElement` propagates to every descendant that reads `var(--font-sans)`/`var(--font-display)` without AD-8 needing to touch each consuming element individually — which is what the rule text ("applies... directly... for each CSS custom property") implicitly relies on, and it holds.

### Finding 4 (minor, forward-looking, not a defect) — AD-8's font-only claim doesn't need to (and doesn't) assert the same mechanism generalizes unchanged to future color settings

- AD-8's Binds line gestures at "color/spacing/logo later, per the PRD's own generic settings table" but only makes a technical claim about fonts today — it does not assert the identical `setProperty` approach will work identically for colors, so this isn't a false claim. Flagging only as a watch-item for whoever scopes that later work: `index.css`'s color tokens (e.g. `--color-background: var(--background)`, line 14) go through a one-level indirection to a separately-defined `:root` variable (line 42), unlike the font tokens. A future color-override implementation would need to target whichever of the two names Tailwind's generated utilities actually reference (confirmed by the same official-docs check above: plain `@theme`, no `inline` modifier, is in use throughout this file) — a five-minute recheck against the compiled output when that work is actually scoped, not a problem with AD-8 as written now.

## What Checked Out (no defect)

- `document.documentElement.style.setProperty()` is a real, correct, currently-idiomatic DOM/CSSOM API for this purpose — confirmed against official Tailwind v4 docs' own recommended pattern for runtime theme overrides, not just plausible in the abstract.
- Tailwind v4's plain `@theme` block (no `inline` modifier, matching this project's actual `index.css`) does emit CSS custom properties into a compiled `:root` block by default — confirmed against `tailwindcss.com/docs/theme` directly, not assumed from training-data recall.
- `--font-display`, `--font-sans`, `--font-mono` in the real `FrontEnd/src/index.css` (lines 5–7) are exactly the three properties AD-8 names, defined as direct literals with no aliasing indirection and no `!important`, so the override mechanism has nothing to defeat it.
- `tailwindcss: ^4.1.14` in the Stack table matches the actual installed range in `FrontEnd/package.json` (`"tailwindcss": "^4.1.14"`, `"@tailwindcss/vite": "^4.1.14"`) — the version this behavior was checked against is the version actually in use.

## Summary

- **HIGH:** 0
- **MEDIUM:** 0
- **LOW:** 0 (all findings above are verification notes / forward-looking watch-items, not defects)
