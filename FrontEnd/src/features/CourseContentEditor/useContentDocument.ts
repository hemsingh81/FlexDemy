import { useEffect, useRef, useState } from 'react';
import { getChapters, getChapterDocument, createChapter, updateChapter, type ChapterDocumentDto } from '../../services/courseContentService';

export type ContentDocumentStatus = 'loading' | 'empty' | 'ready' | 'error';

interface UseContentDocumentResult {
  status: ContentDocumentStatus;
  chapterId: string | null;
  /** Bumps on every "Add chapter" (Story 7.2, Task 8) so the caller can force a fresh
   * <DocumentCanvas key={resetKey}> mount -- a genuine remount is what re-triggers Tiptap's own
   * `autofocus: 'start'`, which is how AC #9's "moves focus to the newly-loaded Chapter's h1"
   * requirement is satisfied without hand-rolling a second focus-management path. */
  resetKey: number;
  title: string;
  /** The full chapter document (Topics/Sub-Topics included) once loaded -- null while `status` is
   * 'loading' or 'empty'. Story 7.1 only ever exposed `title`; this story is the first to actually
   * render `topics`, so the full DTO is needed by DocumentCanvas to rebuild its ProseMirror content
   * on reopen (AC #7) and after any structural mutation (Task 4/5's delete/reorder). */
  document: ChapterDocumentDto | null;
  /** Fires on the Chapter-title heading's blur (Story 7.1's minimal autosave stub -- FR-15's
   * "persists on block-blur, not on completing a step"). Creates the Chapter on the FIRST blur
   * with non-empty text (no chapter row exists yet for a truly empty course -- opening the
   * editor alone never creates one), or updates it on every subsequent blur. The full
   * saved/saving/failed indicator and debounce timing are Story 7.4's scope; this only needs the
   * call to genuinely fire and succeed. */
  saveTitle: (title: string) => Promise<void>;
  /** Re-fetches the active chapter's document from the server -- called after any Topic/Sub-Topic
   * create/update/delete/reorder so DocumentCanvas rebuilds its ProseMirror content from server
   * truth (canonical ids included), rather than hand-patching local state. */
  reload: () => Promise<void>;
  /** FR-17 (Task 8): starts a brand-new, local, uncommitted Chapter -- the exact same empty-first-
   * Chapter path Story 7.1 built (no create call until the title is typed and blurred), reused
   * rather than a second empty-state code path. */
  addChapter: () => void;
  /** Story 11.1, Task 2: loads a different, already-existing Chapter's document and bumps
   * `resetKey` -- the same remount-driven `autofocus: 'start'` mechanism `addChapter` already
   * relies on, reused here rather than a second focus-management path (this is the "switch to
   * an existing Chapter" capability that didn't exist before this story -- previously the only
   * way to change `chapterId` was `addChapter`'s brand-new-blank-Chapter path). A no-op if
   * already on the target chapter. Rejects on failure -- callers decide how to surface that
   * (see CourseContentEditor.tsx's `activateBlocker`, which shows a toast). */
  switchChapter: (targetChapterId: string) => Promise<void>;
  /** Re-runs the initial mount-time fetch after it lands on `status === 'error'` -- the only way
   * out of that state, since the effect itself only fires on courseId change. */
  retry: () => void;
}

// Story 7.1: on mount (and whenever courseId changes), fetches the course's chapter list. If a
// Chapter already exists, fetches its full document (AC #8's "reopening shows the same
// document"). If none exists yet, no create call fires -- the tutor sees a local, uncommitted
// empty document until they actually type a title and blur (see saveTitle above).
export const useContentDocument = (courseId: string | null): UseContentDocumentResult => {
  const [status, setStatus] = useState<ContentDocumentStatus>('loading');
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [document, setDocument] = useState<ChapterDocumentDto | null>(null);
  const [resetKey, setResetKey] = useState(0);
  // Guards a stale response from an earlier courseId landing after a newer request already
  // resolved -- same "cancelled" pattern useCourseLifecycle.ts/useFileUpload.ts already use.
  const requestSeqRef = useRef(0);
  // Bumped by retry() to re-run the effect below without depending on courseId changing --
  // courseId alone can't be the effect's only trigger once a manual re-fetch is possible.
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const seq = ++requestSeqRef.current;
    setStatus('loading');
    setChapterId(null);
    setTitle('');
    setDocument(null);

    if (!courseId) return;

    getChapters(courseId)
      .then(async (chapters) => {
        if (requestSeqRef.current !== seq) return;
        if (chapters.length === 0) {
          setStatus('empty');
          return;
        }
        const doc: ChapterDocumentDto = await getChapterDocument(courseId, chapters[0].id);
        if (requestSeqRef.current !== seq) return;
        setChapterId(doc.id);
        setTitle(doc.title);
        setDocument(doc);
        setStatus('ready');
      })
      // A failed load surfaces as a real 'error' status (rendered by CourseContentEditor.tsx as
      // a message + Retry button) rather than leaving the editor stuck on "Loading your
      // chapter…" forever with no way out -- a real risk now that a denied read (Story 11.3's
      // deny-by-default gate) or a genuine network failure both land here identically.
      .catch(() => {
        if (requestSeqRef.current === seq) setStatus('error');
      });
  }, [courseId, retryCount]);

  const retry = () => setRetryCount((prev) => prev + 1);

  const saveTitle = async (newTitle: string) => {
    if (!courseId) return;
    const trimmed = newTitle.trim();
    if (trimmed.length === 0) return;

    if (chapterId) {
      const doc = await updateChapter(courseId, chapterId, { title: trimmed, description: null });
      setTitle(doc.title);
      setDocument(doc);
    } else {
      const summary = await createChapter(courseId, trimmed);
      setChapterId(summary.id);
      setTitle(summary.title);
      setStatus('ready');
      const doc = await getChapterDocument(courseId, summary.id);
      setDocument(doc);
    }
  };

  const reload = async () => {
    if (!courseId || !chapterId) return;
    const doc = await getChapterDocument(courseId, chapterId);
    setTitle(doc.title);
    setDocument(doc);
  };

  const addChapter = () => {
    setChapterId(null);
    setTitle('');
    setDocument(null);
    setStatus('empty');
    setResetKey((prev) => prev + 1);
  };

  const switchChapter = async (targetChapterId: string) => {
    if (!courseId || targetChapterId === chapterId) return;
    const doc = await getChapterDocument(courseId, targetChapterId);
    setChapterId(doc.id);
    setTitle(doc.title);
    setDocument(doc);
    setStatus('ready');
    setResetKey((prev) => prev + 1);
  };

  return { status, chapterId, resetKey, title, document, saveTitle, reload, addChapter, switchChapter, retry };
};
