import React, { useEffect, useRef, useState } from 'react';
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
  // Opt-in: lets the admin drag the panel's left edge to widen/narrow it (e.g. for reading a
  // long stack trace). Off by default -- most panels (forms, confirmations) have no content that
  // benefits from a wider view, so this only applies where a caller explicitly asks for it.
  resizable?: boolean;
}

const WIDTH_PRESETS: Record<'md' | 'lg', number> = { md: 480, lg: 640 };
const MIN_RESIZE_WIDTH = 420;
const MAX_RESIZE_WIDTH = 1000;

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
  resizable = false,
}) => {
  const [panelWidth, setPanelWidth] = useState(() => WIDTH_PRESETS[width]);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Global mousemove/mouseup (not handlers on the drag handle itself) -- the pointer routinely
  // leaves the 6px-wide handle mid-drag, and a handle-scoped listener would drop the drag the
  // moment that happens.
  useEffect(() => {
    if (!resizable) return undefined;

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingRef.current) return;
      // Docked to the right edge, so dragging the left border further left (smaller clientX)
      // should widen the panel.
      const nextWidth = window.innerWidth - event.clientX;
      const clampedWidth = Math.min(MAX_RESIZE_WIDTH, Math.max(MIN_RESIZE_WIDTH, nextWidth));
      setPanelWidth(Math.min(clampedWidth, window.innerWidth));
    };
    const stopDragging = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopDragging);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopDragging);
    };
  }, [resizable]);

  const startDragging = () => {
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

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
        style={resizable ? { width: panelWidth, maxWidth: '100vw' } : undefined}
        className={`relative h-full w-full bg-white shadow-2xl flex flex-col animate-[slide-in-right_220ms_ease-out] ${
          resizable ? '' : width === 'lg' ? 'sm:w-[640px]' : 'sm:w-[480px]'
        }`}
      >
        {resizable && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panel"
            onMouseDown={startDragging}
            className="hidden sm:block absolute left-0 top-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-[#BA5012]/30 active:bg-[#BA5012]/50 transition-colors z-10"
          />
        )}

        {/* Header -- same bg-[#FAF7EC] as the footer below, so the docked blade reads as one
            consistent chrome instead of a white header against a tinted footer. */}
        <div className="shrink-0 flex items-start justify-between gap-3 px-6 py-5 border-b border-[#E1DED4] bg-[#FAF7EC]">
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
