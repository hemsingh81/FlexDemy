import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

// Handed to the `footer` render-prop form (and to `children`, when given as a function) so a
// footer's own Cancel/Close button can trigger the SAME animated close as the header X, Escape and
// the backdrop. Without this, a footer button would call the parent's close handler directly, the
// parent would unmount the panel on the spot, and that one path would blink out while every other
// path slid away -- the inconsistency this API exists to remove.
export interface SidePanelCloseApi {
  requestClose: () => void;
}

type SidePanelSlot = React.ReactNode | ((api: SidePanelCloseApi) => React.ReactNode);

const renderSlot = (slot: SidePanelSlot, api: SidePanelCloseApi): React.ReactNode =>
  typeof slot === 'function' ? slot(api) : slot;

interface SidePanelProps {
  title: string;
  subtitle?: string;
  // Invoked AFTER the close animation finishes, not when the close is first requested -- the panel
  // is still on screen for PANEL_EXIT_MS. Callers keep their existing `{isOpen && <SidePanel/>}`
  // shape; the delay is what gives that pattern an exit animation at all, since an unmounted
  // component cannot animate.
  onClose: () => void;
  footer?: SidePanelSlot;
  children: SidePanelSlot;
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

// How long the panel stays mounted after a close is requested. MUST match the duration in the
// slide-out/fade-out `animate-[...]` classes below (200ms): too short truncates the animation, too
// long leaves an already-invisible panel sitting in the tree. The enter side is deliberately a
// little slower (220ms, in the class only) -- arriving content wants to feel placed, leaving
// content wants to get out of the way -- and needs no constant here because nothing in JS waits on
// it. Both durations live as literals in the class strings because Tailwind's scanner only sees
// static text; an interpolated value would silently produce no CSS at all.
const PANEL_EXIT_MS = 200;

// index.css collapses every animation to ~0ms under this preference, so waiting PANEL_EXIT_MS
// before unmounting would just be dead time on a panel that already finished "animating". Checked
// per-call rather than cached: the OS setting can change while the app is open.
// Guarded for environments without matchMedia (jsdom doesn't implement it) -- there, this simply
// reports "no preference" and the normal animated path runs.
const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  // The panel plays its exit animation while still mounted, then tells the caller to drop it.
  const [isExiting, setIsExiting] = useState(false);
  const exitTimerRef = useRef<number | null>(null);

  const requestClose = useCallback(() => {
    // Idempotent: Escape held down, a double-click on Cancel, or a backdrop click landing while the
    // panel is already sliding away must not stack up timers and fire onClose repeatedly (for a
    // caller that pops a route or writes state on close, the second call is a real bug).
    if (exitTimerRef.current !== null) return;

    if (prefersReducedMotion()) {
      onClose();
      return;
    }

    setIsExiting(true);
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      onClose();
    }, PANEL_EXIT_MS);
  }, [onClose]);

  // Covers the parent unmounting the panel mid-exit for its own reasons (navigation, a data
  // refresh) -- the pending timer would otherwise fire onClose on an unmounted tree.
  useEffect(
    () => () => {
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [requestClose]);

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

  const closeApi: SidePanelCloseApi = { requestClose };

  return (
    // pointer-events-none while exiting: the panel is still on screen and still interactive for
    // PANEL_EXIT_MS, and a click landing on a control that's visibly sliding away would act on a
    // panel the user has already dismissed.
    <div className={`fixed inset-0 z-50 flex justify-end ${isExiting ? 'pointer-events-none' : ''}`}>
      <div
        className={`absolute inset-0 bg-slate-950/40 backdrop-blur-xs ${
          isExiting ? 'animate-[fade-out_200ms_ease-in_forwards]' : 'animate-[fade-in-scale_150ms_ease-out]'
        }`}
        onClick={closeOnBackdropClick ? requestClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={resizable ? { width: panelWidth, maxWidth: '100vw' } : undefined}
        className={`relative h-full w-full bg-white shadow-2xl flex flex-col ${
          isExiting
            ? 'animate-[slide-out-right_200ms_ease-in_forwards]'
            : 'animate-[slide-in-right_220ms_ease-out]'
        } ${resizable ? '' : width === 'lg' ? 'sm:w-[640px]' : 'sm:w-[480px]'}`}
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
            onClick={requestClose}
            aria-label="Close panel"
            className="shrink-0 p-1.5 rounded-lg text-[#5E6A79] hover:bg-[#FAF7EC] hover:text-[#142030] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{renderSlot(children, closeApi)}</div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E1DED4] bg-[#FAF7EC]">
            {renderSlot(footer, closeApi)}
          </div>
        )}
      </div>
    </div>
  );
};
