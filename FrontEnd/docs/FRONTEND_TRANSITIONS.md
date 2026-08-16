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

## 5. A docked side panel opens or closes

Use **`ui/SidePanel.tsx`** -- it owns both halves of the motion, so no call site hand-rolls either.
It slides in from the right on mount, and on close it slides back out *before* unmounting.

The part worth understanding: a component that has already been unmounted cannot animate. Every
call site renders the panel as `{isOpen && <SidePanel onClose={close} />}`, so if `onClose` ran
immediately the panel would vanish on the same frame and no exit animation could ever play.
SidePanel therefore treats `onClose` as "the panel has finished closing", not "the user asked to
close": a close request starts the slide-out, and `onClose` fires ~200ms later, when the animation
is done. Callers keep their existing `{isOpen && ...}` shape and get the exit for free.

Two consequences to know:

- **`onClose` is asynchronous.** In tests, assert on it with `waitFor`, not synchronously after
  the click. Anything ordered *after* the panel closes is delayed by the same ~200ms.
- **Close every path through `requestClose`, never the caller's own close handler.** A footer
  button wired straight to the parent's setter unmounts the panel instantly and blinks out while
  every other path slides -- exactly the inconsistency this design removes. `footer` and
  `children` both accept a render-prop form that hands you the API:

```tsx
<SidePanel
  title="Edit country"
  onClose={closeEdit}                       // runs after the slide-out finishes
  footer={({ requestClose }) => (
    <Button variant="ghost" onClick={requestClose}>Cancel</Button>
  )}
>
  {content}
</SidePanel>
```

A handler defined in the component body (above SidePanel) can't read that API from context -- take
it as a parameter instead, the way `ErrorDetailPanel.tsx`'s `handleDelete(recordId, requestClose)`
does.

The header X, Escape and (where enabled) the backdrop click already route through `requestClose`
internally. Repeated requests are ignored while a close is in flight, so a double-click or a held
Escape can't fire `onClose` twice.

Under `prefers-reduced-motion: reduce`, SidePanel skips the delay entirely and closes immediately --
`index.css` collapses the animation itself, so waiting it out would just be dead time.

## Applying this

When adding a new admin (or any other) screen with an Add/Edit panel, a confirm step, a
dismissible list item, a docked side panel, or a trigger+menu dropdown, reach for the matching pattern above instead
of a plain `{condition && <X />}` swap or a hand-rolled `useRef`/`useClickOutside`. See
[FRONTEND_CONTROLS.md](./FRONTEND_CONTROLS.md) for the full list of `src/ui/` controls meant to be
reused directly rather than re-implemented per-screen.
