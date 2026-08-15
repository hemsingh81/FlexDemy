# Design System Notes — FlexDemy eLearning

**Status:** Lightweight reference, not a canonical spec. Written 2026-08-15.

`_bmad/wds/config.yaml` sets `design_system_mode: none` for this project, meaning the
formal WDS Phase 7 (Design System) was deliberately never run. There is no BMad-authored
token spec or component library to point to under `design-artifacts/D-Design-System`. This
file exists only to backfill the empty scaffold with pointers to where design tokens and
shared UI actually live in the codebase — it is not a source of truth and should not be
treated as one. Values below are what's present in the code as of this writing; check the
files directly before relying on any of them.

## Where tokens/theming actually live

- **`FrontEnd/src/index.css`** — the real source of truth for color, font, radius, and
  shadow tokens. Uses Tailwind v4's `@theme` block plus CSS custom properties:
  - Fonts: `--font-display: "Fraunces", Georgia, serif` (headings), `--font-sans: "Outfit", system-ui, sans-serif` (body/UI), `--font-mono: "JetBrains Mono", monospace`.
  - Brand colors defined directly in `@theme`: `--color-ink-navy` (#143358), `--color-citrus-amber` (#BA5012), `--color-parchment` (#FAF7EC), `--color-signal-green` (#179765).
  - Semantic tokens (`--background`, `--foreground`, `--card`, `--primary`, `--accent`, `--muted`, `--border`, `--ring`, `--destructive`, `--success`, `--highlight`, chart colors `--chart-1`..`--chart-5`, etc.) are defined as OKLCH values under `:root` (light theme) and re-defined under `.dark` (dark theme exists in CSS but per the DESIGN.md narrative the shipped product is light-only today).
  - `--radius: 0.75rem` is the base corner-radius token.
  - Two custom shadow tokens, `--shadow-lift` and `--shadow-glow`.
- **Tailwind v4 config** is CSS-native (via `@tailwindcss/vite` + the `@theme` block above) — there is no separate `tailwind.config.js` token table to check; `index.css` *is* the config.
- Spacing follows Tailwind's default 4px scale; there's no separate spacing-token file. Common values in practice: `1.25rem` card padding, `2rem` large/hero padding, `1rem` inline gaps, `2rem` section gaps.
- **Known drift:** a fair amount of hardcoded hex (e.g. raw `#143358`) still exists directly in component files rather than referencing the CSS variables — an accepted, not-yet-cleaned-up inconsistency, not a second competing token system.
- A much more detailed (but UX-authored, not WDS-authored) description of this palette, type scale, spacing rhythm, elevation, and shape rules already exists in `_specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/DESIGN.md` — its YAML frontmatter (`colors`, `typography`, `rounded`, `spacing`, `components`) plus prose sections (Brand & Style, Colors, Typography, Layout & Spacing, Elevation & Depth, Shapes, Components, Do's and Don'ts) are the closest thing this project has to a real design-system document. Treat that file as the descriptive reference; `index.css` as the implemented reality.

## Where reusable UI components actually live

- **`FrontEnd/src/ui/`** — the shared/primitive component folder. Notable files: `Button.tsx`, `Alert.tsx`, `ConfirmDialog.tsx`, `ConfirmModal.tsx`, `Dropdown.tsx`, `FormCard.tsx`, `Navbar.tsx`, `Footer.tsx`, `Logo.tsx`, `Pagination.tsx`, `SidePanel.tsx`, `Spinner.tsx`, `ToggleSwitch.tsx`, `TypeaheadMultiSelect.tsx`, `AppointmentToast.tsx`, `OfflineProgressToast.tsx`, `PageTransition.tsx`.
- **`FrontEnd/src/features/`** — feature-scoped UI, one folder per product area (`Admin`, `Auth`, `CourseContentEditor`, `CourseDiscover`, `CourseOverview`, `CoursePlayer`, `CourseWizard`, `Dashboard`, `GroupStudy`, `ProfileSetup`, `ProgressAndCertificate`). These compose the shared `ui/` primitives rather than duplicating them, but are not themselves a generalized component library — they're feature code.
- No dedicated `design-system/` or `components/ui` (shadcn-style) folder exists; `ui/` is the closest equivalent and is hand-rolled, not generated from a token pipeline.

## Recommendation — delta to a real WDS Design System phase

If the team wants to formalize this later (flip `design_system_mode` away from `none` and
run WDS Phase 7), the gap from today's ad-hoc state is roughly:

1. **Consolidate tokens** — migrate the DESIGN.md YAML frontmatter and `index.css` variables into one canonical token source (WDS typically wants a structured token file WDS tooling can read/diff), and sweep the remaining hardcoded-hex components onto CSS variables.
2. **Formalize the component inventory** — turn `ui/` into a documented, versioned component library (props, variants, states) rather than implicit-by-usage conventions scattered across `features/`.
3. **Fill the dark-theme gap** — `.dark` tokens exist in CSS but aren't confirmed as a shipped, tested surface; a real design-system pass would decide whether dark mode is in scope and validate it.
4. **Accessibility pass** — DESIGN.md already flags a couple of known-unresolved contrast gaps (`signal-green` and `warning` as small text); a formal phase would resolve or explicitly accept these with sign-off.

Until then, `FrontEnd/src/index.css` and `_specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/DESIGN.md` remain the two files to check before touching visual styling.
