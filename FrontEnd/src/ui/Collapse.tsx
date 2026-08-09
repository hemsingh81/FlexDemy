import React, { useEffect, useState } from 'react';

interface CollapseProps {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}

// Smoothly expands/collapses a block of content -- used for the Add-form and per-row Edit
// panels in Admin (and anywhere else a section slides open instead of appearing/disappearing
// instantly). height:auto can't be transitioned directly, so this uses the grid-template-rows
// 0fr/1fr trick: the outer grid's single row animates between 0fr and 1fr, and the inner
// wrapper clips content to that animated height while it's closed/animating.
//
// overflow stays hidden only until the open transition finishes, then flips to visible -- so
// content that needs to escape the box once fully open (e.g. TypeaheadMultiSelect's dropdown)
// isn't permanently clipped. See docs/FRONTEND_TRANSITIONS.md.
export const Collapse: React.FC<CollapseProps> = ({ open, children, className }) => {
  const [isOverflowVisible, setIsOverflowVisible] = useState(false);

  useEffect(() => {
    if (!open) setIsOverflowVisible(false);
  }, [open]);

  return (
    <div
      className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'} ${className ?? ''}`}
      onTransitionEnd={(e) => {
        if (e.propertyName === 'grid-template-rows' && open) setIsOverflowVisible(true);
      }}
    >
      <div className={isOverflowVisible ? 'overflow-visible' : 'overflow-hidden'}>{children}</div>
    </div>
  );
};
