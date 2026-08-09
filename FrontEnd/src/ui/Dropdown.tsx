import React, { useRef, useState } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';

export interface DropdownRenderState {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

interface DropdownProps {
  // The always-visible control that opens/closes the menu (an icon button, an avatar, a
  // labeled button with a chevron, ...). Receives `open` so the caller can drive its own
  // aria-expanded/chevron-rotation, and `toggle` to wire up onClick.
  trigger: (state: DropdownRenderState) => React.ReactNode;
  // The menu's content. Stays mounted at all times -- visibility is the opacity/scale
  // transition below, not a mount/unmount swap (see docs/FRONTEND_TRANSITIONS.md #2). Receives
  // `close` so individual items can dismiss the menu after acting on a selection, matching what
  // every one of the call sites this replaces already did by hand.
  menu: (state: DropdownRenderState) => React.ReactNode;
  // Which edge of the trigger the menu hangs from. Default 'right'.
  align?: 'left' | 'right';
  // Whether the menu opens below the trigger (default) or above it (e.g. a bottom-docked
  // toolbar, where opening downward would run off-screen).
  side?: 'bottom' | 'top';
  // The menu box's own classes: width, background, border, shadow, padding, text color, etc.
  // Deliberately left fully caller-controlled -- the 5 dropdowns this replaces vary widely here
  // (navy vs. white background, w-40 vs. w-64, py-1.5 vs. py-2 vs. p-3).
  menuClassName?: string;
  // Extra DOM attributes for the menu wrapper, e.g. role="listbox" (used by 2 of the 5 --  the
  // Admin sub-tab menus -- but not the others).
  menuProps?: React.HTMLAttributes<HTMLDivElement>;
  // Wrapper className; defaults to 'relative' (every call site needs the trigger+menu pair
  // positioned relative to this box).
  className?: string;
}

// Generic trigger+menu dropdown, extracted from several near-identical hand-rolled
// implementations that each did their own useRef + useClickOutside + opacity/scale transition:
// Navbar's profile menu and Admin sub-tab menu (desktop + mobile), plus PlaybackControls'
// voice-settings popover. Owns the open state, the outside-click/Escape-to-
// close wiring (via useClickOutside), and the position/transition classes; trigger and menu
// content stay fully caller-controlled via render props so wildly different menu shapes -- a
// role=listbox of option buttons, a user-info header + sign-out button, a label + native
// <select> -- all fit without teaching this component anything about any of them.
export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  menu,
  align = 'right',
  side = 'bottom',
  menuClassName,
  menuProps,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  const state: DropdownRenderState = {
    open,
    toggle: () => setOpen((v) => !v),
    close: () => setOpen(false),
  };

  const alignClass = align === 'left' ? 'left-0' : 'right-0';
  const sideClass = side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';
  const originClass =
    side === 'top'
      ? align === 'left'
        ? 'origin-bottom-left'
        : 'origin-bottom-right'
      : align === 'left'
        ? 'origin-top-left'
        : 'origin-top-right';

  return (
    <div ref={ref} className={className ?? 'relative'}>
      {trigger(state)}
      <div
        {...menuProps}
        className={`absolute ${alignClass} ${sideClass} z-50 ${originClass} transition-all duration-150 ease-out ${
          open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
        } ${menuClassName ?? ''}`}
      >
        {menu(state)}
      </div>
    </div>
  );
};
