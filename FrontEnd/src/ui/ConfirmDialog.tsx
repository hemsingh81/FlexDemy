import React, { useRef } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';
import { Spinner } from './Spinner';

interface ConfirmDialogProps {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // 'danger' for destructive actions (delete), 'warning' for state changes worth a pause
  // (deactivate), 'primary' for anything else that still deserves a confirm step.
  variant?: 'danger' | 'warning' | 'primary';
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_TEXT_CLASS: Record<NonNullable<ConfirmDialogProps['variant']>, string> = {
  danger: 'text-red-600',
  warning: 'text-amber-600',
  primary: 'text-[#EC7B38]',
};

const VARIANT_BUTTON_CLASS: Record<NonNullable<ConfirmDialogProps['variant']>, string> = {
  danger: 'bg-red-600',
  warning: 'bg-amber-600',
  primary: 'bg-[#EC7B38]',
};

// Small inline "are you sure?" control (not a modal) -- swaps in for whatever action buttons it
// replaces, matching the pill-and-icon-button visual language already used across the Admin
// tables. Used for Delete in MasterDataTable.tsx; the Active/Inactive quick-toggle pill in the
// same tables intentionally stays a direct one-tap flip (see ToggleSwitch.tsx's doc comment).
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isConfirming = false,
  onConfirm,
  onCancel,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onCancel, true);

  return (
    <div
      ref={ref}
      className="flex items-center gap-1.5 animate-[fade-in-scale_150ms_ease-out]"
    >
      <span className={`text-[10px] font-bold ${VARIANT_TEXT_CLASS[variant]}`}>{message}</span>
      <button
        type="button"
        onClick={onConfirm}
        disabled={isConfirming}
        className={`px-2 py-1 rounded-lg text-[10px] font-bold text-white disabled:opacity-60 cursor-pointer ${VARIANT_BUTTON_CLASS[variant]}`}
      >
        {isConfirming ? <Spinner size="xs" /> : confirmLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={isConfirming}
        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[#F3F0E6] text-[#142030] disabled:opacity-60 cursor-pointer"
      >
        {cancelLabel}
      </button>
    </div>
  );
};
