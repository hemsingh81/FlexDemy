# Frontend shared controls (`src/ui/`)

This is the authoritative list of what's already built and reusable in `src/ui/`. Before
hand-rolling a dropdown, a loading spinner, a submit button, an "are you sure?" step, an
expand/collapse panel, or an Active/Inactive switch on a new screen, check here first -- every
control below already exists because the pattern it replaces showed up at least twice in this
codebase. For *when to animate something* rather than *which component to use*, see
[FRONTEND_TRANSITIONS.md](./FRONTEND_TRANSITIONS.md).

## Dropdown (`ui/Dropdown.tsx`)

A generic trigger+menu dropdown: owns the open state, the click-outside/Escape-to-close wiring
(via `useClickOutside`), and the position + opacity/scale transition classes. Trigger and menu
content are fully caller-controlled via render props, so it hosts anything from a `role=listbox`
of option buttons to a user-info header + sign-out button to a label + native `<select>`.

```tsx
import { Dropdown } from '../../ui/Dropdown';

<Dropdown
  align="right"                 // which edge of the trigger the menu hangs from ('left' | 'right')
  side="bottom"                 // opens below (default) or above the trigger ('bottom' | 'top')
  menuClassName="w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 py-1.5"
  menuProps={{ role: 'listbox' }} // optional extra attributes on the menu wrapper
  trigger={({ open, toggle }) => (
    <button onClick={toggle} aria-expanded={open}>Options</button>
  )}
  menu={({ close }) => (
    <button role="option" onClick={() => { pick(); close(); }}>Pick me</button>
  )}
/>
```

Used by: `Navbar.tsx` (language switcher, profile menu, Admin sub-tab menu x2 -- desktop and
mobile) and `PlaybackControls.tsx` (voice-settings popover, `side="top"` since it sits above a
bottom-docked toolbar).

## Spinner (`ui/Spinner.tsx`)

Wraps `lucide-react`'s `Loader2` + `animate-spin`, with a `size` prop covering every pixel size
already in use across the app instead of each screen picking its own `w-3`/`w-3.5`/`w-4`/`w-5`.

```tsx
import { Spinner } from '../../ui/Spinner';

<Spinner />                                   // size="md" (w-4 h-4) -- the default
<Spinner size="lg" className="mr-2" />        // a "Loading..." row
<Spinner size="xl" label="Loading..." />      // standalone/full-page: adds role="status" + aria-label
```

Sizes: `xs` (w-3, ConfirmDialog's inline confirm button), `sm` (w-3.5, compact row-action
buttons), `md` (w-4, the default -- most form-submit buttons), `lg` (w-5, "Loading..." rows),
`xl` (w-8, full-page/session-check spinners). Pass `className` for one-off spacing/color the same
way the original hand-rolled spinners did (e.g. `mr-2`, `text-[#143358]`); only pass `label` when
there's no adjacent "Loading..."/"Saving..." text of its own.

Used by (non-exhaustive): `App.tsx`'s session check, `ConfirmDialog.tsx`, `LoginPage.tsx`,
`SignUpPage.tsx`, `StudentProfileForm.tsx`, `TutorProfileForm.tsx`, `SupportUserCreation.tsx`
(via `Button`'s `isLoading`), `RoleVisibilityManager.tsx`, `AdminUserStatusList.tsx`,
`TutorApprovals.tsx`.

## Button (`ui/Button.tsx`)

Wraps the "disabled while submitting + spinner-or-icon + label" button pattern that used to be
copy-pasted (identical Tailwind classes) across every Auth/ProfileSetup submit button and several
Admin "Save" buttons.

```tsx
import { Button } from '../../ui/Button';

<Button
  type="submit"
  fullWidth
  variant="secondary"                     // 'primary' (#EC7B38 orange) | 'secondary' (#143358 navy, default) | 'danger' (red-600)
  isLoading={isSubmitting}
  loadingText="Signing In..."             // optional: replaces children while loading
  icon={<LogIn className="w-4 h-4" />}    // leading icon; swapped for a Spinner while loading
  trailingIcon={<ArrowRight className="w-4 h-4" />} // hidden while loading
>
  Sign In
</Button>
```

`variant` matches the color convention `ConfirmDialog.tsx` already established (`primary` =
orange, `danger` = red); `secondary` adds the navy used for the main form-submit CTA on every
Auth/ProfileSetup screen and most Admin "Save" buttons. `size` is `'md'` (default -- the
full-width Auth/ProfileSetup shape) or `'sm'` (the compact Admin-screen shape).

Used by: `LoginPage.tsx`, `SignUpPage.tsx`, `StudentProfileForm.tsx`, `TutorProfileForm.tsx`,
`SupportUserCreation.tsx`, `RoleVisibilityManager.tsx`'s Save button.

**Deliberately not retrofitted everywhere** -- a generic `Button` isn't the right fit for
everything that renders a `<button>`:
- `Navbar.tsx`'s nav-tab buttons (active-state styling unique to the navbar, not a reusable
  variant).
- `MasterDataTable.tsx`'s Save/Cancel/Add buttons -- that file was very recently and carefully
  retrofitted onto `Collapse`/`ConfirmDialog`/`ToggleSwitch` with tests pinned to its exact
  structure; the pattern is already proven via 6 other call sites above, so touching it again
  wasn't worth the regression risk.
- `TutorApprovals.tsx`'s green "Approve" button -- a one-off success color that doesn't match any
  of the three variants above; forcing a 4th variant for a single call site wasn't worth it.

## Collapse (`ui/Collapse.tsx`)

Expands/collapses a block of content via the `grid-template-rows: 0fr -> 1fr` technique (see
[FRONTEND_TRANSITIONS.md #1](./FRONTEND_TRANSITIONS.md)). Used for Add-forms and per-row Edit
panels in Admin, and the tutor-rejection-reason textarea in `TutorApprovals.tsx`.

```tsx
<Collapse open={isFormOpen}>
  <form>...</form>
</Collapse>
```

## ConfirmDialog (`ui/ConfirmDialog.tsx`)

Inline "are you sure?" control (not a modal) for a destructive or state-changing action, e.g.
delete in `MasterDataTable.tsx`.

```tsx
<ConfirmDialog
  message="Really delete?"
  variant="danger" // 'danger' | 'warning' | 'primary'
  isConfirming={isDeleting}
  onConfirm={handleDelete}
  onCancel={() => setConfirming(false)}
/>
```

## ToggleSwitch (`ui/ToggleSwitch.tsx`)

Accessible Active/Inactive switch for Add/Edit forms (not for a one-tap status flip on an
existing row -- that stays a direct pill button, see the component's own doc comment).

```tsx
<ToggleSwitch checked={isActive} onChange={setIsActive} />
```

## TypeaheadMultiSelect (`ui/TypeaheadMultiSelect.tsx`)

Searchable chip multi-select: type to filter, click a result to toggle it, selected values render
as removable chips. Replaces the old plain checkbox-grid pattern for multi-select fields.

```tsx
<TypeaheadMultiSelect
  options={subjects.map((s) => ({ value: s.id, label: s.name }))}
  selected={subjectIds}
  onChange={setSubjectIds}
/>
```

## PageTransition (`ui/PageTransition.tsx`)

Crossfades a "whichever tab/sub-tab is active" content area instead of an instant unmount+mount
swap. Used by `App.tsx` (top-level tabs) and `AdminPanel.tsx` (Admin sub-tabs).

```tsx
<PageTransition contentKey={activeTab}>
  {activeTab === 'dashboard' && <Dashboard />}
  {activeTab === 'discover' && <CourseDiscover />}
</PageTransition>
```

## useClickOutside (`hooks/useClickOutside.ts`)

Not a component, but the shared hook every dropdown/popover above is built on: closes on an
outside click/tap or Escape. `Dropdown` already wraps this for you -- reach for the hook directly
only if you're building a transient control that doesn't fit `Dropdown`'s trigger+menu shape
(e.g. `TypeaheadMultiSelect` uses it directly for its own click-outside-to-close behavior).

```tsx
const ref = useRef<HTMLDivElement>(null);
useClickOutside(ref, () => setOpen(false), open);
```

## Cascading Country -> State -> City select

`ProfileSetup/useProfileSetup.ts` and `Admin/MasterDataManager.tsx`'s "Location scope" selector
both fetch a country's states and (in one case) a state's cities in response to a selection
change, but they were deliberately **not** unified into a shared hook: `useProfileSetup` drives a
3-level form (country -> state -> city, active-only lookups, no default selection -- the form
starts blank) feeding a student/tutor profile submission, while `MasterDataManager`'s scope
selector is a 2-level *filter* (country -> state only, no city) that always fetches
`includeInactive=true` and auto-selects the first country/state so the admin table underneath
always has a sensible default scope. Forcing a shared `useLocationCascade` hook to cover both
shapes (optional city level, optional auto-select-first, an `includeInactive` flag threaded
through every fetch) would have added more configuration surface than the ~15 lines of
country/state-fetching logic it would have saved in either file. If a third cascading-location
call site shows up with the same shape as one of these two, revisit.
