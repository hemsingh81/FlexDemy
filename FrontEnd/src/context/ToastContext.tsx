import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

// App-wide toast/notification system -- surfaces a brief confirmation after an action succeeds
// (sign in/out, create/update/delete/toggle across Admin, etc). Structured as a
// Provider+hook pair the same way context/DomainContext.tsx is, mounted once near the root
// (see App.tsx) so useToast() works from anywhere in the tree.

export type ToastVariant = 'success' | 'error' | 'info';

export interface ShowToastOptions {
  message: string;
  // Defaults to 'info'. 'success' is what every wired-up action below actually uses -- failures
  // already render inline (Alert.tsx, per-screen error state) and are deliberately NOT
  // double-reported here; 'error'/'info' exist for completeness and any future caller that
  // genuinely needs a transient (rather than inline) failure/neutral notice.
  variant?: ToastVariant;
}

// How long a toast stays on screen before auto-dismissing.
export const TOAST_AUTO_DISMISS_MS = 3500;
// The exit transition's duration -- must stay in sync with the `duration-150` class below (same
// constraint PageTransition.tsx documents for its own fade constant). Matches the timing every
// other transient control in this app already uses (Dropdown.tsx, ConfirmDialog's popovers --
// see docs/FRONTEND_TRANSITIONS.md #2), so a toast doesn't invent its own feel.
const TOAST_EXIT_MS = 150;

interface ToastRecord {
  id: string;
  message: string;
  variant: ToastVariant;
  // Two-phase mount/unmount -- the same "mount hidden, flip visible next frame, animate out
  // before actually unmounting" split used by Dropdown.tsx/Collapse.tsx/usePageTransition.ts
  // (see docs/FRONTEND_TRANSITIONS.md). A toast is pushed with visible=false, flipped to true on
  // the next animation frame so the opacity/translate CSS transition has a real starting state to
  // animate from, then flipped back to false and only removed from state once the exit
  // transition has had time to finish (TOAST_EXIT_MS) -- the same "mark exiting, drop after a
  // timeout" shape MasterDataTable.tsx's row-delete uses (its ROW_EXIT_MS).
  visible: boolean;
}

interface ToastContextValue {
  showToast: (options: ShowToastOptions) => void;
}

const noopShowToast: ToastContextValue['showToast'] = () => {};

// Defaults to a working no-op -- rather than `undefined` + "must be used within a Provider"
// (context/DomainContext.tsx's stricter convention for useDomain()). A toast is incidental
// feedback, not something the rest of the tree is functionally broken without, and a large
// number of already-existing tests render Admin screens (MasterDataTable, AdminUserStatusList,
// SupportUserCreation, RoleVisibilityManager, TutorApprovals, ...) standalone, without mounting
// the full App tree's <ToastProvider>. Those keep working exactly as before; a showToast() call
// from inside them just silently does nothing until a real <ToastProvider> is mounted higher up
// (as it is in App.tsx).
const ToastContext = createContext<ToastContextValue>({ showToast: noopShowToast });

export const useToast = (): ToastContextValue => useContext(ToastContext);

let toastIdSeq = 0;
const nextToastId = () => `toast-${++toastIdSeq}`;

const VARIANT_ICON: Record<ToastVariant, React.ElementType> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

// 'success' uses citrus-amber (not signal-green) so the confirmation toast reads as clearly
// visible/attention-grabbing against the mostly-white/cream page chrome -- an explicit choice
// (over the DESIGN.md default of green-for-success) since the subtler white/green combo wasn't
// visible enough in practice. 'error'/'info' are unchanged (red/neutral already read clearly).
const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'bg-white border-[#BA5012]/40 text-[#142030]',
  error: 'bg-red-50 border-red-200 text-red-700',
  info: 'bg-[#FAF7EC] border-[#E1DED4] text-[#142030]',
};

const VARIANT_ICON_CLASSES: Record<ToastVariant, string> = {
  success: 'text-[#BA5012]',
  error: 'text-red-600',
  info: 'text-[#5E6A79]',
};

// Fixed bottom-left -- deliberately the opposite corner from ui/AppointmentToast.tsx and
// ui/OfflineProgressToast.tsx (both bottom-right), so this general confirmation stack never
// competes for the same corner as those two rarer, longer-lived notices.
const STACK_CLASSNAME =
  'fixed bottom-6 left-6 z-[60] flex flex-col gap-2 w-[calc(100%-3rem)] max-w-sm pointer-events-none';

interface ToastItemProps {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const Icon = VARIANT_ICON[toast.variant];
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-2 px-3.5 py-3 rounded-xl border shadow-xl text-xs font-semibold transition-all duration-150 ease-out ${
        toast.visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
      } ${VARIANT_CLASSES[toast.variant]}`}
    >
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${VARIANT_ICON_CLASSES[toast.variant]}`} />
      <span className="flex-1 pt-0.5">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 p-0.5 rounded-lg text-[#5E6A79] hover:text-[#142030] hover:bg-black/5 transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  // Tracked in refs (not state) purely so the unmount-cleanup effect below can clear whatever's
  // outstanding without needing to re-run on every toast add/remove.
  const autoTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const exitTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    exitTimers.current.delete(id);
  }, []);

  // Begins the exit transition (visible -> false) and removes the toast from state once it's had
  // time to play -- same shape as MasterDataTable.tsx's delete flow (mark exiting, drop after
  // ROW_EXIT_MS). Used both by the auto-dismiss timer and the manual X button.
  const dismiss = useCallback(
    (id: string) => {
      const autoTimer = autoTimers.current.get(id);
      if (autoTimer) {
        clearTimeout(autoTimer);
        autoTimers.current.delete(id);
      }
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, visible: false } : t)));
      const exitTimer = setTimeout(() => removeToast(id), TOAST_EXIT_MS);
      exitTimers.current.set(id, exitTimer);
    },
    [removeToast]
  );

  const showToast = useCallback(
    ({ message, variant = 'info' }: ShowToastOptions) => {
      const id = nextToastId();
      setToasts((prev) => [...prev, { id, message, variant, visible: false }]);

      // Two nested rAFs -- same reasoning as hooks/usePageTransition.ts: the first lets the
      // browser commit the just-mounted opacity-0 DOM node, only the second flips it visible, so
      // the CSS transition has a real starting state to animate from instead of collapsing to a
      // no-op.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, visible: true } : t)));
        });
      });

      const autoTimer = setTimeout(() => dismiss(id), TOAST_AUTO_DISMISS_MS);
      autoTimers.current.set(id, autoTimer);
    },
    [dismiss]
  );

  useEffect(() => {
    const autos = autoTimers.current;
    const exits = exitTimers.current;
    return () => {
      autos.forEach((t) => clearTimeout(t));
      exits.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={STACK_CLASSNAME} aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
