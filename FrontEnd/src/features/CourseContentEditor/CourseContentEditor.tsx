import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useFileUpload, type FileUploadEntry, type FileUploadStatus } from './useFileUpload';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { PublishLifecycleBar } from './PublishLifecycleBar';
import { Spinner } from '../../ui/Spinner';

interface CourseContentEditorProps {
  isOpen: boolean;
  onClose: () => void;
  draftId: string | null;
  // Normal state defaults to a centered max-w-4xl card (the standalone, top-of-page context).
  // MyCoursesSection renders this inline, directly beneath a specific course row, already inside
  // its own bordered card -- centering/capping there would look like a card nested inside a card,
  // narrower than it needs to be. fullWidth swaps Normal's width to w-full for that context.
  // Maximized is unaffected either way -- it's always a full-viewport takeover.
  fullWidth?: boolean;
}

const STATUS_LABEL: Record<FileUploadStatus, string> = {
  queued: 'Queued',
  parsing: 'Parsing',
  done: 'Done',
  failed: 'Failed',
};

// Reuses the exact badge-pill shape already used by TutorEducatorHubView.tsx's slot-status
// pills (text-[10px] font-extrabold px-2.5 py-0.5 rounded-full) -- no new visual pattern. Navy
// solid fill for in-progress states, per DESIGN.md's extraction-status-badge token
// ("navy = in-progress... signal-green = done... error = failed. No new color language.").
const STATUS_BADGE_CLASSES: Record<FileUploadStatus, string> = {
  queued: 'bg-[#143358] text-white',
  parsing: 'bg-[#143358] text-white',
  done: 'bg-[#179765]/10 text-[#179765] border border-[#179765]/20',
  failed: 'bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/20',
};

// Deliberately longer than TagManagement.tsx's SEARCH_DEBOUNCE_MS (250ms, debounces keystrokes)
// -- this window needs to catch several files finishing within the same few hundred ms of each
// other so their aria-live announcements batch into one update instead of flooding the region.
const STATUS_ANNOUNCE_DEBOUNCE_MS = 400;
// Ceiling on how long a status change can wait to be announced even under continuous rapid
// changes -- the debounce above resets on every new change, which alone could indefinitely
// postpone the first announcement during a busy multi-file batch.
const STATUS_ANNOUNCE_MAX_WAIT_MS = 2000;
// Caps how many file-status messages join into one announcement -- an unusually large
// simultaneous batch summarizes past this point instead of producing an unbounded string.
const MAX_BATCHED_ANNOUNCEMENT_MESSAGES = 10;

interface FileRowProps {
  file: FileUploadEntry;
  index: number;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
}

// Chip, not a full-width row -- several uploaded files now flow left-to-right and wrap, instead
// of each one claiming its own full-width line, so a many-file upload doesn't push the rest of
// the screen down needlessly.
const FileRow: React.FC<FileRowProps> = ({ file, index, onRetry, onDelete }) => (
  <div
    className="inline-flex max-w-full items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border border-[#E1DED4] bg-white"
    title={file.name}
  >
    <span className="text-xs font-semibold text-[#142030] truncate max-w-[14rem]">{file.name}</span>
    <span
      className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${STATUS_BADGE_CLASSES[file.status]}`}
      title={file.status === 'failed' ? file.failureReason : undefined}
    >
      {/* Queued/Parsing are the two non-terminal, in-progress statuses (see useFileUpload.ts's
          NON_TERMINAL_STATUSES) -- a small spinner makes the "still working" state legible at a
          glance, on top of the text label the aria-live announcements already cover; Done/Failed
          are resolved states and get no spinner. */}
      {(file.status === 'queued' || file.status === 'parsing') && <Spinner size="xs" className="text-white" />}
      {STATUS_LABEL[file.status]}
    </span>
    {file.status === 'failed' && (
      <>
        <button
          type="button"
          onClick={() => onRetry(file.id)}
          // Includes the row position, not just the name -- two files sharing a name (the same
          // source re-selected, or a coincidental match) would otherwise produce indistinguishable
          // accessible names.
          aria-label={`Retry file ${index + 1}: ${file.name}`}
          className="shrink-0 p-1 rounded-full text-red-600 hover:bg-red-50 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        {/* Delete, not just Retry -- a failed file never had any content extracted (unlike a Done
            file's ConfirmModal-gated delete below, which is destroying real extracted content),
            so removing it outright needs no confirm step, same "trivial delete" discipline as a
            leaf Content Block with no descendants. Lets a tutor drop a file that will never parse
            (wrong format, corrupted scan) instead of being stuck choosing only Retry. */}
        <button
          type="button"
          onClick={() => onDelete(file.id)}
          aria-label={`Delete file ${index + 1}: ${file.name}`}
          className="shrink-0 p-1 rounded-full text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </>
    )}
  </div>
);

interface FileContentCardProps {
  file: FileUploadEntry;
  onDelete: () => void;
}

// The raw text Docling parsed from this file, shown as-is -- no AI structuring step in between.
const FileContentCard: React.FC<FileContentCardProps> = ({ file, onDelete }) => (
  <div className="rounded-xl border border-[#E1DED4] bg-white overflow-hidden">
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#E1DED4] bg-[#FAF7EC]">
      <span className="text-xs font-bold text-[#142030] truncate" title={file.name}>
        {file.name}
      </span>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${file.name}`}
        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
    <pre className="whitespace-pre-wrap break-words text-xs text-[#142030] p-4 max-h-96 overflow-y-auto font-sans">
      {file.parsedContent || 'No text was extracted from this file.'}
    </pre>
  </div>
);

// Full-width surface (a takeover, not a SidePanel blade) per UX-DR5 -- Course Content Editor's
// real shell. Shows each uploaded file's raw parsed text directly, with no AI structuring step
// in between, and a permanent delete action per file.
export const CourseContentEditor: React.FC<CourseContentEditorProps> = ({ isOpen, onClose, draftId, fullWidth = false }) => {
  const { data, error: fileUploadError, addFiles, retryFile, deleteFile, resetFiles } = useFileUpload(draftId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // requestKey bumps on every open, even for the same file id -- ConfirmModal now animates its
  // own close (a real delay before the real onConfirm/onCancel fires), so re-requesting delete
  // on the same file right after Cancel must mount a genuinely fresh instance (via key=) rather
  // than reuse one still mid-close, whose backdrop is still pointer-events-none from that close.
  const deleteRequestSeqRef = useRef(0);
  const [deleteFileTarget, setDeleteFileTarget] = useState<{ key: number; id: string; name: string } | null>(null);
  // Visual feedback only while a native OS drag is over the dropzone below -- not persisted
  // anywhere, reset unconditionally on drop/leave.
  const [isDraggingFilesOver, setIsDraggingFilesOver] = useState(false);
  // Maximize/Restore toggle -- defaults to Normal, a smaller, centered, bordered/shadowed card
  // that uses ordinary page scroll, not its own internal scroll region. Maximize is the full-page
  // takeover (FR-30's original behavior), reached only by an explicit click, not the opening
  // state. Resets to Normal on every fresh open rather than persisting across sessions -- there's
  // no user-facing setting for this yet, just a per-session toggle.
  const [isMaximized, setIsMaximized] = useState(false);

  const [announcement, setAnnouncement] = useState('');
  const prevStatusesRef = useRef<Map<string, FileUploadStatus>>(new Map());
  const pendingMessagesRef = useRef<string[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushAnnouncement = () => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
    flushTimerRef.current = null;
    maxWaitTimerRef.current = null;
    if (pendingMessagesRef.current.length === 0) return;

    const messages = pendingMessagesRef.current.slice(0, MAX_BATCHED_ANNOUNCEMENT_MESSAGES);
    const overflow = pendingMessagesRef.current.length - messages.length;
    const text = overflow > 0 ? `${messages.join('. ')}. And ${overflow} more file${overflow === 1 ? '' : 's'} updated.` : messages.join('. ');
    setAnnouncement(text);
    pendingMessagesRef.current = [];
  };

  // Batches per-file status-transition announcements into one aria-live update, rather than one
  // region-mutation per file, matching ToastContext.tsx's established container-level
  // aria-live="polite"/aria-atomic="false" idiom. A max-wait ceiling (separate from the debounce,
  // which resets on every new change) guarantees a flush even under continuous rapid changes.
  useEffect(() => {
    const prevStatuses = prevStatusesRef.current;
    let changed = false;
    data.forEach((file) => {
      if (prevStatuses.get(file.id) !== file.status) {
        changed = true;
        pendingMessagesRef.current.push(`${file.name}: ${STATUS_LABEL[file.status]}`);
        prevStatuses.set(file.id, file.status);
      }
    });

    if (changed) {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(flushAnnouncement, STATUS_ANNOUNCE_DEBOUNCE_MS);
      if (!maxWaitTimerRef.current) {
        maxWaitTimerRef.current = setTimeout(flushAnnouncement, STATUS_ANNOUNCE_MAX_WAIT_MS);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(
    () => () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
      // Any status changes queued but not yet flushed at unmount are discarded, not silently
      // left dangling in the ref for a hypothetical future mount to pick up stale.
      pendingMessagesRef.current = [];
    },
    []
  );

  // Clears the file list and announcement state whenever the target draft changes, so opening
  // Course Content Editor for a second, different course never shows the previous course's
  // uploaded files. Also covers first mount (a no-op reset against already-empty state).
  useEffect(() => {
    resetFiles();
    prevStatusesRef.current.clear();
    pendingMessagesRef.current = [];
    setAnnouncement('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  // Every fresh open starts in Normal -- this component stays mounted (just rendering null)
  // while closed rather than unmounting (see `if (!isOpen) return null` below), so isMaximized
  // would otherwise silently carry a prior session's Maximize choice into the next open.
  useEffect(() => {
    if (isOpen) setIsMaximized(false);
  }, [isOpen]);

  // Belt-and-suspenders alongside the draftId-keyed reset above: also clears immediately on
  // close, rather than waiting for the next open to catch up.
  const handleClose = () => {
    resetFiles();
    prevStatusesRef.current.clear();
    pendingMessagesRef.current = [];
    setAnnouncement('');
    onClose();
  };

  // Course Content Editor is a full-width surface, not a modal (EXPERIENCE.md UX-DR5) -- Escape
  // still closes it, matching every other overlay's convention (see SidePanel.tsx), even though
  // it isn't marked role="dialog"/aria-modal (that would assert conventions -- background-inert,
  // focus-trap -- this screen doesn't actually implement).
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      // While ConfirmModal is open, its own Escape handler owns this key -- without this guard,
      // both handlers fire on the same keypress (two independent document-level listeners),
      // cancelling the delete confirmation AND closing/resetting the whole editor at once.
      if (event.key === 'Escape' && deleteFileTarget) return;
      if (event.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, deleteFileTarget]);

  if (!isOpen) return null;

  // Bug fix: in real browsers `input.files` is a *live* FileList tied to the input's own value --
  // resetting `e.target.value` clears that same FileList object immediately, in the same
  // synchronous tick, before any code below it runs. The previous version read `e.target.files`
  // into a variable, then reset `.value`, then checked that variable's length -- by then it was
  // already emptied, so this always hit the early return and addFiles() never ran, no matter what
  // file was picked. jsdom's mock file input doesn't reproduce this live-clearing behavior, which
  // is why no existing test caught it. Fix: snapshot into a real array FIRST, then reset `.value`.
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    addFiles(files);
  };

  // Bug fix: the dropzone below has always looked like a drag-and-drop target (dashed border,
  // "+ Add files") but had no drop handling at all -- dragging files onto it silently did
  // nothing. No client-side type filtering here: CourseFileService.UploadFileAsync already
  // validates content-type server-side and rejects unsupported files with a specific reason,
  // which surfaces as a normal "Failed" row (same path an invalid file picked via the native
  // picker would take).
  const handleFilesDropped = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDraggingFilesOver(false);
    const files: File[] = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    addFiles(files);
  };

  const doneFiles = data.filter((file) => file.status === 'done');

  return (
    <div
      // animate-[fade-in-scale...] (FRONTEND_TRANSITIONS.md #3): this whole component is
      // conditionally rendered by its parent (`{isOpen && <CourseContentEditor .../>}`-equivalent
      // via the early `if (!isOpen) return null` below), so every open is a fresh mount -- the
      // shared entrance keyframe just needs to be present, no local "closing" state required the
      // way ConfirmModal's mid-mount toggle needs. This same div persists across the
      // Maximize/Restore toggle below (only its classes change, not a remount), so the two
      // branches deliberately use two DIFFERENT keyframes (fade-in-scale vs zoom-out, see
      // index.css) rather than the same one twice -- a class that doesn't change value across
      // the toggle never restarts its animation, so reusing one keyframe in both branches would
      // only ever play once, on the very first open, and never again on subsequent toggles.
      //
      // Maximized: a true full-viewport takeover -- fixed inset-0, above Navbar's own z-50 stacking
      // context (same z-50 idiom as this app's other fixed-inset-0 overlays: SidePanel,
      // CourseReviewModal, FlashcardsModal), edge-to-edge with no border/rounding/shadow since
      // there's no surrounding page visible to sit a card-shell against -- fullWidth has no effect
      // here, a takeover is already as wide as it gets. Zooms in (fade-in-scale: grows from 0.95
      // to fill the screen) on every entry, whether that's the first open already-maximized (not
      // reachable today, Normal is always the opening state, but keeps the class correct if that
      // ever changes) or a Restore->Maximize click. Normal keeps the bordered/shadowed card shell
      // (rounded-2xl bg-white border border-[#E1DED4] shadow-lg, matching every other top-level
      // card in this app) either capped at max-w-4xl and centered (the standalone, top-of-page
      // default) or w-full (fullWidth, e.g. rendered inline in MyCoursesSection) -- either way it
      // scrolls with the page like any other card, and zooms out (zoom-out: shrinks from 1.05
      // down to its resting size) on every entry, whether that's the default first open or a
      // Maximize->Restore click.
      className={
        isMaximized
          ? 'fixed inset-0 z-50 flex flex-col bg-white animate-[fade-in-scale_150ms_ease-out]'
          : `w-full flex flex-col bg-white rounded-2xl border border-[#E1DED4] shadow-lg animate-[zoom-out_150ms_ease-out] ${
              fullWidth ? '' : 'max-w-4xl mx-auto'
            }`
      }
      role="region"
      aria-label="Course Content Editor"
    >
      {/* Maximized: header stays put as a shrink-0 flex item while the body below it (the
          px-6 py-6 space-y-4 div further down) becomes the flex-1 overflow-y-auto scroll region --
          simpler than a sticky-positioned header now that this is a true viewport-covering
          takeover with its own top-to-bottom flex layout, rather than a block sitting in normal
          page flow. Normal has no such split: the whole card scrolls with the page as one block,
          the way every other card here already does. */}
      <div className={isMaximized ? 'shrink-0' : undefined}>
        <div
          className={`shrink-0 flex items-center justify-between gap-3 px-6 py-5 border-b border-[#E1DED4] bg-[#F3F0E6] ${
            isMaximized ? '' : 'rounded-t-2xl'
          }`}
        >
          <h2 className="text-lg font-extrabold text-[#142030]">Course Content Editor</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsMaximized((prev) => !prev)}
              aria-label={isMaximized ? 'Restore Course Content Editor' : 'Maximize Course Content Editor'}
              className="p-1.5 rounded-lg text-[#5E6A79] hover:bg-white hover:text-[#142030] transition-colors"
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close Course Content Editor"
              className="p-1.5 rounded-lg text-[#5E6A79] hover:bg-white hover:text-[#142030] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <PublishLifecycleBar key={draftId} courseId={draftId} />
      </div>

      {/* Full width, no max-w-* cap (DESIGN.md S"Full-width is the layout, not an option" --
          every top-level surface renders w-full with no centered/capped column anywhere). This
          previously capped at max-w-5xl mx-auto, a pre-existing deviation from that rule.
          Maximized additionally makes this the flex-1 overflow-y-auto scroll region (see the
          header comment above) -- Normal has no such split, the whole card scrolls with the page
          as one block. */}
      <div className={`px-6 py-6 space-y-4 w-full ${isMaximized ? 'flex-1 overflow-y-auto' : ''}`}>
        <div>
          <h3 className="text-sm font-bold text-[#142030]">Uploaded Files</h3>
          <p className="text-xs text-[#5E6A79] mt-0.5">
            Upload PDF, Word, TXT, or Excel files — each is parsed independently.
          </p>
        </div>

        {fileUploadError && (
          <p role="alert" className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {fileUploadError}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {data.map((file, index) => (
            <FileRow key={file.id} file={file} index={index} onRetry={retryFile} onDelete={deleteFile} />
          ))}
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingFilesOver(true);
          }}
          onDragLeave={() => setIsDraggingFilesOver(false)}
          onDrop={handleFilesDropped}
          className={`w-full p-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-colors text-xs font-bold ${
            isDraggingFilesOver
              ? 'border-[#BA5012] text-[#BA5012] bg-[#BA5012]/5'
              : 'border-[#E1DED4] text-[#5E6A79] hover:border-[#BA5012] hover:text-[#BA5012]'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Add files, or drag and drop them here</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.xls,.xlsx"
          onChange={handleFilesSelected}
          className="hidden"
          aria-label="Choose files to upload"
          data-testid="file-upload-input"
        />

        {doneFiles.length > 0 && (
          <div className="pt-4 border-t border-[#E1DED4] space-y-3">
            <h3 className="text-sm font-bold text-[#142030]">Course Content</h3>
            {doneFiles.map((file) => (
              <FileContentCard
                key={file.id}
                file={file}
                onDelete={() => setDeleteFileTarget({ key: ++deleteRequestSeqRef.current, id: file.id, name: file.name })}
              />
            ))}
          </div>
        )}
      </div>

      <div aria-live="polite" aria-atomic="false" className="sr-only" data-testid="content-editor-announcer">
        {announcement}
      </div>

      {deleteFileTarget && (
        <ConfirmModal
          key={deleteFileTarget.key}
          message={`Delete "${deleteFileTarget.name}" and its content? This can't be undone.`}
          onConfirm={() => {
            deleteFile(deleteFileTarget.id);
            setDeleteFileTarget(null);
          }}
          onCancel={() => setDeleteFileTarget(null)}
        />
      )}
    </div>
  );
};
