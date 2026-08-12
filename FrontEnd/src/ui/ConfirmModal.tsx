import React, { useEffect, useRef } from 'react';

interface ConfirmModalProps {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

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
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
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
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={message}
        tabIndex={-1}
        className="w-full max-w-sm bg-white rounded-lg shadow-2xl p-5 space-y-4 focus:outline-none"
      >
        <p className="text-sm font-semibold text-[#142030]">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F3F0E6] text-[#142030] cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
