import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

interface AlertProps {
  // 'danger' for errors/failures, 'warning' for cautionary notices, 'info' for neutral notes.
  variant?: 'danger' | 'warning' | 'info';
  children: React.ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<AlertProps['variant']>, string> = {
  danger: 'bg-red-50 border-red-200 text-red-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-[#FAF7EC] border-[#E1DED4] text-[#142030]',
};

// Bordered, iconed alert banner -- for a validation/failure message that needs to actually read
// as an alert (not a stray line of red text easy to miss), and needs to sit right above the
// control it's about, not wherever happens to be convenient. Used in MasterDataTable.tsx's
// FormCard (validation errors render inside the card, right above the fields) and its row-action
// banner (toggle/delete failures).
export const Alert: React.FC<AlertProps> = ({ variant = 'danger', children, className }) => {
  const Icon = variant === 'info' ? Info : AlertTriangle;
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold animate-[fade-in-scale_150ms_ease-out] ${VARIANT_CLASSES[variant]} ${className ?? ''}`}
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
};
