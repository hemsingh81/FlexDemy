import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  id?: string;
  ariaLabel?: string;
}

// Accessible Active/Inactive switch for Add/Edit forms (the quick-toggle pill elsewhere in
// Admin tables stays as-is -- this is specifically for setting status while filling out a
// form, not for a one-tap status flip on an existing row).
export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled,
  activeLabel = 'Active',
  inactiveLabel = 'Inactive',
  id,
  ariaLabel,
}) => (
  <div className="flex items-center gap-2">
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? (checked ? activeLabel : inactiveLabel)}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-[#179765]' : 'bg-[#E1DED4]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
    <span className={`text-xs font-semibold ${checked ? 'text-[#179765]' : 'text-[#5E6A79]'}`}>
      {checked ? activeLabel : inactiveLabel}
    </span>
  </div>
);
