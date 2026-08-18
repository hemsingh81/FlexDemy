import { useEffect, useRef, useState } from 'react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

interface UseContentAutosaveResult {
  status: AutosaveStatus;
  /** Debounced -- call on every edit (Tiptap `update`). Coalesces rapid keystrokes into one save
   * after the tutor stops typing (AC #1's "debounce" path). */
  scheduleSave: () => void;
  /** Immediate, bypassing the debounce -- call on blur/close (AC #1's "or blur/close the block"
   * path), so navigating away never leaves a pending debounced save stranded. */
  flushNow: () => Promise<void>;
}

const DEBOUNCE_MS = 1500;
// How long a "Saved" confirmation stays visible before fading back to idle -- long enough to be
// noticed, short enough not to look stuck.
const SAVED_VISIBLE_MS = 2000;

// Story 7.4, AD-11: the permanent home for this codebase's debounce/status-tracking machinery --
// Stories 7.1-7.3 each shipped a direct blur-only save as an explicit stub. `onSync` is the
// caller-supplied save operation (DocumentCanvas's own boundary-detection walk, which needs deep
// Tiptap/`editor.state` access this hook has no reason to duplicate) -- this hook owns only WHEN
// it runs and HOW its outcome is surfaced (saved/saving/failed), not the sync logic itself.
export const useContentAutosave = (onSync: () => Promise<void>): UseContentAutosaveResult => {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;
  // Guards a slower-in-flight save's failure/success from clobbering a newer one's outcome --
  // same "sequence number" pattern this codebase already uses (useContentDocument.ts,
  // useCourseLifecycle.ts) for out-of-order async responses.
  const runSeqRef = useRef(0);

  useEffect(
    () => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (savedResetTimerRef.current) clearTimeout(savedResetTimerRef.current);
    },
    []
  );

  const run = async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (savedResetTimerRef.current) {
      clearTimeout(savedResetTimerRef.current);
      savedResetTimerRef.current = null;
    }
    const seq = ++runSeqRef.current;
    setStatus('saving');
    try {
      await onSyncRef.current();
      if (runSeqRef.current !== seq) return;
      setStatus('saved');
      savedResetTimerRef.current = setTimeout(() => setStatus('idle'), SAVED_VISIBLE_MS);
    } catch {
      if (runSeqRef.current !== seq) return;
      // Loud and retryable (AC #1) -- content itself was never touched by this hook, so nothing
      // to lose; the tutor's unsaved edits stay exactly where they are in the live editor.
      setStatus('failed');
    }
  };

  const scheduleSave = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => void run(), DEBOUNCE_MS);
  };

  const flushNow = () => run();

  return { status, scheduleSave, flushNow };
};
