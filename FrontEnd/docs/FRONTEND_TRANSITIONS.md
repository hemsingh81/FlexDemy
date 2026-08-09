# Frontend transition conventions

> Looking for the full list of reusable `src/ui/` controls (Dropdown, Button, Spinner, ...) and
> when to reach for each one? See **[FRONTEND_CONTROLS.md](./FRONTEND_CONTROLS.md)** -- that's the
> authoritative component inventory. This doc stays focused on *transition/animation*
> conventions specifically: which CSS technique to reach for, and the shared timing/easing so
> unrelated screens don't each invent a slightly different fade.

This project has a few different UI states that appear/disappear, and each one has a standard
way to animate that so the app feels consistent instead of every screen inventing its own
show/hide behavior. Use these, in order of how common the need is:

## 1. A block of content expands or collapses in place

Examples: an Add-record form appearing below a toolbar, a per-row Edit panel opening under a
table row, a "reason for rejection" textarea revealing itself, an accordion section.

**Use `ui/Collapse.tsx`.** It wraps children in a `grid-template-rows: 0fr -> 1fr` transition
(height:auto can't be animated directly, this is the standard workaround):

```tsx
import { Collapse } from '../../ui/Collapse';

<Collapse open={isFormOpen}>
  <form>...</form>
</Collapse>
```

Do not conditionally render (`{isOpen && <Form />}`) when the content should *animate* open --
that swaps the DOM instantly with no transition. Keep the content mounted and let `Collapse`
own the open/closed visual state. If the content does expensive work while open, gate that work
on `open` internally (e.g. skip fetches while closed), not by unmounting.

## 2. A small transient control appears (dropdown, confirm popover, tooltip)

Examples: the Navbar dropdowns, `PlaybackControls`' voice-settings popover, `ui/ConfirmDialog.tsx`,
a multi-select's option list (`ui/TypeaheadMultiSelect.tsx`).

For a trigger+menu dropdown specifically, **use `ui/Dropdown.tsx`** rather than hand-rolling
`useRef` + `useClickOutside` + the transition classes again -- it already owns all three:

```tsx
import { Dropdown } from '../../ui/Dropdown';

<Dropdown
  align="right" // or 'left' -- which edge the menu hangs from
  menuClassName="w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 py-1.5"
  trigger={({ open, toggle }) => (
    <button onClick={toggle} aria-expanded={open}>...</button>
  )}
  menu={({ close }) => (
    <button onClick={() => { doSomething(); close(); }}>Option</button>
  )}
/>
```

Under the hood it toggles the same classes every dropdown in this app already used:

```tsx
className={`... origin-top transition-all duration-150 ease-out ${
  isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
}`}
```

Match this timing/easing even for a one-off popover that doesn't fit `Dropdown`'s trigger+menu
shape (a tooltip, say) -- don't introduce a different easing/duration for the same kind of
transient control.

## 3. Something is freshly mounted and should ease in (not toggled, just born)

Examples: `ConfirmDialog` itself when it first appears, a validation error banner.

Use the shared `fade-in-scale` keyframe (defined in `index.css`) via Tailwind's arbitrary
`animate-[...]` syntax:

```tsx
className="animate-[fade-in-scale_150ms_ease-out]"
```

Don't reach for the `tailwindcss-animate` plugin's `animate-in`/`fade-in`/`zoom-in-*` classes --
that plugin isn't installed in this project (Tailwind v4, CSS-config, no `tailwind.config.js`),
so those class names are silently no-ops.

## 4. A row/item is being removed from a list

Example: `MasterDataTable.tsx`'s delete flow -- mark the row "exiting" (`opacity-0 scale-[0.98]`
with a `transition-all duration-200`), then drop it from state after the transition's duration
via `setTimeout`. See `ROW_EXIT_MS` in that file for the constant to copy.

## Applying this

When adding a new admin (or any other) screen with an Add/Edit panel, a confirm step, a
dismissible list item, or a trigger+menu dropdown, reach for the matching pattern above instead
of a plain `{condition && <X />}` swap or a hand-rolled `useRef`/`useClickOutside`. See
[FRONTEND_CONTROLS.md](./FRONTEND_CONTROLS.md) for the full list of `src/ui/` controls meant to be
reused directly rather than re-implemented per-screen.
