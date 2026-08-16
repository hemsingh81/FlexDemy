import React from 'react';

export interface SegmentedTab<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedTabsProps<T extends string> {
  tabs: SegmentedTab<T>[];
  value: T;
  onChange: (next: T) => void;
  // Labels the tab group for screen readers, e.g. "Content view".
  ariaLabel: string;
  className?: string;
}

// The pill-in-a-tray segmented control this app already used ad hoc (SupportUserCreation's
// Create/All toggle, TutorApprovals' Pending/All toggle, and now the Course Content Editor's
// Code/Viewer switch), factored out so those don't keep re-deriving the same class strings.
//
// role="tablist"/"tab" with aria-selected rather than a row of plain buttons: this switches which
// view of one thing is shown, which is exactly what the tab pattern describes, and it gets screen
// readers to announce "2 of 2" style position. Give the region each tab reveals a
// role="tabpanel" of its own -- this component only owns the strip, not the content below it.
export function SegmentedTabs<T extends string>({ tabs, value, onChange, ariaLabel, className }: SegmentedTabsProps<T>) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={`inline-flex items-center gap-1 p-1 bg-[#F3F0E6] rounded-xl ${className ?? ''}`}>
      {tabs.map((tab) => {
        const isActive = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              isActive ? 'bg-white text-[#142030] shadow-2xs' : 'text-[#5E6A79] hover:text-[#142030]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
