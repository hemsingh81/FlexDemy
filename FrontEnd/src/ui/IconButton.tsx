import React from 'react';

export type IconButtonVariant = 'default' | 'danger';

interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  // 'default' = neutral hover-to-accent (the common case: Move/Preview/Edit/Move-to). 'danger' =
  // hover-to-destructive, for Delete-style actions.
  variant?: IconButtonVariant;
}

const VARIANT_HOVER: Record<IconButtonVariant, string> = {
  default: 'hover:text-accent',
  danger: 'hover:text-destructive',
};

// Extracted from HeadingControls.tsx, which had 7 near-identical
// `<button className="p-1 rounded text-muted-foreground hover:text-accent">` blocks (Move
// up/down, Preview, Edit-as-Markdown, Move-to, Preview-as-student, Delete) -- a small,
// icon-only, per-row action button, distinct from Button.tsx (which always carries a text
// label and loading/variant states this shape doesn't need).
export const IconButton: React.FC<IconButtonProps> = ({ icon, label, onClick, disabled = false, variant = 'default' }) => (
  <button
    type="button"
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className={`p-1 rounded text-muted-foreground ${VARIANT_HOVER[variant]} disabled:opacity-30 disabled:pointer-events-none`}
  >
    {icon}
  </button>
);
