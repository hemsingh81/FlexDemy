import React, { useEffect, useRef } from 'react';

interface KeywordPopoverProps {
  keyword: string;
  definition: string | null;
  isOverridden: boolean;
  isLoading: boolean;
  onDismiss: () => void;
}

// Story 3.2/Task 4: anchored, lightweight popover (`keyword-popover` DESIGN.md token: white
// background, 1px solid #E1DED4 border, rounded.DEFAULT, shadow-md) -- not a modal/side-panel.
// Deliberately never moves focus into itself: UX-DR13 requires focus to stay on the reading
// text's keyword button the whole time this is open. Announces its content via
// aria-live="polite" instead of relying on focus movement, mirroring
// CourseContentEditor.tsx's established aria-live announcer pattern in spirit (single immediate
// announcement here, not that pattern's debounced batching -- only one keyword is ever active).
export const KeywordPopover: React.FC<KeywordPopoverProps> = ({
  keyword,
  definition,
  isOverridden,
  isLoading,
  onDismiss,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    // Click-elsewhere dismiss -- the trigger button lives as a sibling inside the same wrapping
    // <span> as this popover (see KeywordText.tsx), so checking against that shared parent
    // correctly excludes both the popover itself AND its own trigger button from counting as
    // "outside" (re-clicking the trigger toggles closed via KeywordText's own onClick instead).
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.parentElement?.contains(event.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onDismiss]);

  return (
    <div
      ref={popoverRef}
      role="tooltip"
      className="absolute z-20 top-full left-0 mt-1.5 w-64 p-3 rounded-lg bg-white border border-[#E1DED4] shadow-md text-left normal-case"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-extrabold text-slate-900">{keyword}</span>
        {isOverridden && (
          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#179765]/10 text-[#179765]">
            Tutor-edited
          </span>
        )}
      </div>
      <div aria-live="polite" className="text-xs text-slate-700 leading-relaxed">
        {isLoading ? 'Loading…' : (definition ?? 'Definition unavailable')}
      </div>
    </div>
  );
};
