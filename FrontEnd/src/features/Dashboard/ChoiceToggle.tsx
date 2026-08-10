import React from 'react';

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  // Not every toggle in the app originally shipped with an icon (Visibility Mode is text-only) --
  // keep that option rather than forcing a new icon onto an option that never had one.
  icon?: React.ElementType;
  // Full control over the selected-state classes rather than a fixed navy/amber-by-index rule --
  // some toggles are semantic (Visibility Mode's Immediate=green/Hold=amber), others are a plain
  // default/alternate pair (Target's Course=navy/Competition=amber), so the caller decides.
  selectedClassName: string;
}

interface ChoiceToggleProps<T extends string> {
  options: [ChoiceOption<T>, ChoiceOption<T>];
  value: T;
  onChange: (value: T) => void;
}

// Shared two-option selector card (icon + label + description, 2-col grid) used across Dashboard's
// create/target/mode pickers -- Assignments' Target and Visibility Mode toggles, Tutor's Session
// Mode toggle. Previously each screen hand-rolled its own copy with drifting, off-brand colors
// (indigo/purple instead of the actual palette); this is the single place that pattern now lives.
export function ChoiceToggle<T extends string>({ options, value, onChange }: ChoiceToggleProps<T>) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-1">
      {options.map((opt) => {
        const Icon = opt.icon;
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`p-3 rounded-2xl border text-left font-bold transition-all flex items-center space-x-2 ${
              isSelected
                ? `${opt.selectedClassName} shadow-md`
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" />}
            <div>
              <p className="text-xs font-bold">{opt.label}</p>
              {opt.description && <p className="text-[10px] font-normal opacity-90">{opt.description}</p>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
