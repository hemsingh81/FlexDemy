import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface SidePanelProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  // Data-entry panels (assignment creation, quiz attempt) never dismiss on a stray backdrop
  // click -- an accidental click shouldn't discard typed input or in-progress answers.
  // Lower-risk / mostly-read-only panels (submissions review) may allow it. Escape always
  // closes regardless of this flag -- that's a deliberate keyboard action, not a pointer slip.
  closeOnBackdropClick?: boolean;
  width?: 'md' | 'lg';
}

// Azure-Portal-style docked-right "blade": header / scrollable body / optional sticky footer,
// replacing the centered dialog-box modal for Dashboard's Assignments surfaces (create
// assignment, review submissions, attempt a quiz) -- see docs/FRONTEND_TRANSITIONS.md for the
// project's other transition conventions this complements.
export const SidePanel: React.FC<SidePanelProps> = ({
  title,
  subtitle,
  onClose,
  footer,
  children,
  closeOnBackdropClick = false,
  width = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs animate-[fade-in-scale_150ms_ease-out]"
        onClick={closeOnBackdropClick ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative h-full w-full bg-white shadow-2xl flex flex-col animate-[slide-in-right_220ms_ease-out] ${
          width === 'lg' ? 'sm:w-[640px]' : 'sm:w-[480px]'
        }`}
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-3 px-6 py-5 border-b border-[#E1DED4]">
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold text-[#142030] truncate">{title}</h3>
            {subtitle && <p className="text-xs text-[#5E6A79] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="shrink-0 p-1.5 rounded-lg text-[#5E6A79] hover:bg-[#FAF7EC] hover:text-[#142030] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E1DED4] bg-[#FAF7EC]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
