import React from 'react';
import { Loader2 } from 'lucide-react';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  xs: 'w-3 h-3', // ConfirmDialog's inline confirm-button spinner
  sm: 'w-3.5 h-3.5', // compact row-action buttons, e.g. TutorApprovals' Approve
  md: 'w-4 h-4', // the default -- most form-submit buttons
  lg: 'w-5 h-5', // "Loading..." rows (tables, forms waiting on master data)
  xl: 'w-8 h-8', // full-page/session-check spinners (App.tsx)
};

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  // Only pass this for a standalone spinner with no adjacent text of its own (e.g. a full-page
  // spinner) -- it adds role="status" + aria-label so screen readers get *something*. Spinners
  // that sit next to their own "Loading..."/"Saving..." text (the common case) should leave
  // this unset to avoid a redundant announcement.
  label?: string;
  // Opt-in: also render `label` as visible text next to the icon (stacked, centered), not just
  // the aria-label. For a full-page/blocking wait (e.g. App.tsx's session-restore screen) a
  // spinner with no visible explanation reads as the page being stuck -- use this there. Leave
  // unset (the default) for the common case of a spinner sitting next to its own text already.
  showLabel?: boolean;
}

// Thin wrapper around the `<Loader2 className="... animate-spin" />` pattern that was hand-rolled
// with a slightly different pixel size at every call site (Auth pages, ProfileSetup forms, Admin
// loading rows and action buttons, ConfirmDialog, MasterDataTable). `size` covers every size
// already in use; pass `className` for one-off spacing/color the same way the original
// hand-rolled spinners did (e.g. `mr-2`, `text-[#143358]`).
export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className, label, showLabel }) => {
  const icon = (
    <Loader2
      className={`${SIZE_CLASSES[size]} animate-spin ${className ?? ''}`}
      role={label ? 'status' : undefined}
      aria-label={label}
    />
  );

  if (!showLabel || !label) return icon;

  return (
    <div className="flex flex-col items-center gap-2">
      {icon}
      <p className="text-sm font-semibold text-[#5E6A79]" aria-hidden="true">
        {label}
      </p>
    </div>
  );
};
