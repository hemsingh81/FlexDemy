import React from 'react';
import { usePageTransition } from '../hooks/usePageTransition';

interface PageTransitionProps {
  // Identifies which "screen" is currently being shown -- App.tsx passes activeTab,
  // AdminPanel.tsx passes activeSubTab. A change in this value is what triggers the crossfade.
  contentKey: string;
  children: React.ReactNode;
  className?: string;
}

// Wraps a "whichever tab is active" content area (App.tsx's <main>, AdminPanel.tsx's sub-tab
// body) so switching screens crossfades instead of instantly unmounting the old view and
// mounting the new one -- see usePageTransition.ts for why that instant swap is what reads as a
// flicker, and why this needs a delayed content swap rather than a same-tick opacity class.
//
// One shared implementation for both call sites: `children` is just whatever JSX the caller
// would otherwise have rendered directly (e.g. the `{activeTab === 'x' && <X/>}` blocks), passed
// straight through -- this component only decides *when* to swap it and *how* to fade the swap.
export const PageTransition: React.FC<PageTransitionProps> = ({ contentKey, children, className }) => {
  const { displayedContent, isVisible } = usePageTransition(contentKey, children);

  // NOTE: this literal `duration-[100ms]` class must stay in sync with
  // usePageTransition.ts's PAGE_TRANSITION_FADE_MS -- Tailwind v4 statically scans source text
  // for class names, so the value can't be interpolated from the JS constant here.
  return (
    <div
      className={`transition-opacity ease-out duration-[100ms] ${
        isVisible ? 'opacity-100' : 'opacity-0'
      } ${className ?? ''}`}
    >
      {displayedContent}
    </div>
  );
};
