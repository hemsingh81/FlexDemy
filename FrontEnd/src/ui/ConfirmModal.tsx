import React, { useEffect, useRef, useState } from 'react';

interface ConfirmModalProps {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Matches FRONTEND_TRANSITIONS.md's "row/item exit" duration (MasterDataTable.tsx's own
// ROW_EXIT_MS) -- same family of transition, applied here to a whole modal instead of a row.
const EXIT_MS = 150;

// Centered confirm overlay, distinct from ConfirmDialog.tsx (that component is explicitly "not a
// modal" -- an inline row-action swap with no backdrop). This one follows DESIGN.md's
// components.modal token directly (rgba(0,0,0,0.5) backdrop, rounded.lg white panel, no blur --
// FlashcardsModal.tsx's backdrop (bg-black/60 backdrop-blur-xs) doesn't exactly match this token,
// so this follows the token spec, not that file's precise classes), combined with
// ConfirmDialog.tsx's confirm/cancel discipline (explicit labeled buttons, danger styling, no
// browser-native confirm()). A real modal, unlike ConfirmDialog: traps focus, moves focus in on
// mount, restores it to the triggering element on close -- matching this app's Assignment
// creation modal precedent.
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  // FRONTEND_TRANSITIONS.md #3 (fresh-mount ease-in) on open, and the #4 "mark exiting, then act"
  // technique on close -- the real onConfirm/onCancel (which the caller uses to unmount this
  // component) fires after the fade plays, not synchronously, so the fade is actually visible.
  const [isClosing, setIsClosing] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    // Focuses the first button directly, not the panel container -- if focus started on the
    // container, the Tab handler below (which only recognizes the first/last *button* as a
    // boundary) would never match on the very first Shift+Tab, and the trap would do nothing.
    const firstButton = panelRef.current?.querySelector<HTMLElement>('button');
    firstButton?.focus();
    return () => {
      // Guard against restoring focus to an element that was itself removed from the DOM while
      // the modal was open.
      if (previouslyFocusedRef.current?.isConnected) previouslyFocusedRef.current.focus();
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  // A later Cancel/Confirm always supersedes an earlier one's still-pending exit timer -- without
  // this, a Cancel immediately followed by a fresh Confirm (re-triggered before the first fade
  // finished) could fire the stale Cancel's callback after the real Confirm already ran.
  const requestClose = (action: () => void) => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    setIsClosing(true);
    exitTimerRef.current = setTimeout(action, EXIT_MS);
  };

  const handleCancel = () => requestClose(onCancel);
  const handleConfirm = () => requestClose(onConfirm);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCancel();
        return;
      }
      // Minimal focus trap: Tab/Shift+Tab cycles between the two buttons only.
      if (event.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>('button');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCancel]);

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 transition-opacity duration-150 ${
        isClosing ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={message}
        tabIndex={-1}
        className={`w-full max-w-sm bg-white rounded-lg shadow-2xl p-5 space-y-4 focus:outline-none ${
          isClosing ? 'transition-all duration-150 opacity-0 scale-95' : 'animate-[fade-in-scale_150ms_ease-out]'
        }`}
      >
        <p className="text-sm font-semibold text-[#142030]">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F3F0E6] text-[#142030] cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
