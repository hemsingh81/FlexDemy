import React, { useEffect, useRef, useState } from 'react';
import { Plus, RotateCcw, X } from 'lucide-react';
import { useFileUpload, type FileUploadEntry, type FileUploadStatus } from './useFileUpload';
import { useCourseContentTree, type Chapter, type NodeConfirmation } from './useCourseContentTree';
import { ContentTree, type TreeMutators } from './ContentTreeNode';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { PublishLifecycleBar } from './PublishLifecycleBar';
import { ReviewAsStudentPreview } from './ReviewAsStudentPreview';

interface CourseContentEditorProps {
  isOpen: boolean;
  onClose: () => void;
  draftId: string | null;
}

const STATUS_LABEL: Record<FileUploadStatus, string> = {
  queued: 'Queued',
  parsing: 'Parsing',
  extracting: 'Extracting',
  done: 'Done',
  failed: 'Failed',
};

// Reuses the exact badge-pill shape already used by TutorEducatorHubView.tsx's slot-status
// pills (text-[10px] font-extrabold px-2.5 py-0.5 rounded-full) -- no new visual pattern. Navy
// solid fill for the three in-progress states, per DESIGN.md's extraction-status-badge token
// ("navy = in-progress... signal-green = done... error = failed. No new color language.").
// Every state uses the raw-hex convention (matching Dev Notes' "existing-code hex, not CSS
// variables" tradeoff) -- including `failed`, which colors.error (#DC2626) resolves to Tailwind's
// stock red-600, so `bg-red-50 text-red-600 border-red-200` are exactly `#FEF2F2`/`#DC2626`/
// `#FECACA` already; spelled out in hex here purely for internal consistency with the other rows.
const STATUS_BADGE_CLASSES: Record<FileUploadStatus, string> = {
  queued: 'bg-[#143358] text-white',
  parsing: 'bg-[#143358] text-white',
  extracting: 'bg-[#143358] text-white',
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

// Flattens the whole tree into { id, label, confirmation } entries -- used only to detect
// confirmation-reset transitions for the shared aria-live announcer (see the useEffect below);
// the tree itself stays nested for rendering (see useCourseContentTree.ts's own Dev Notes on why).
interface FlatNodeConfirmation {
  id: string;
  label: string;
  confirmation: NodeConfirmation;
}

const flattenConfirmations = (chapters: Chapter[]): FlatNodeConfirmation[] => {
  const out: FlatNodeConfirmation[] = [];
  chapters.forEach((chapter) => {
    out.push({ id: chapter.id, label: chapter.title, confirmation: chapter.confirmation });
    chapter.topics.forEach((topic) => {
      out.push({ id: topic.id, label: topic.title, confirmation: topic.confirmation });
      topic.contentBlocks.forEach((block, i) => {
        out.push({ id: block.id, label: `${topic.title} content block ${i + 1}`, confirmation: block.confirmation });
      });
      topic.subtopics.forEach((subtopic) => {
        out.push({ id: subtopic.id, label: subtopic.title, confirmation: subtopic.confirmation });
        subtopic.contentBlocks.forEach((block, i) => {
          out.push({ id: block.id, label: `${subtopic.title} content block ${i + 1}`, confirmation: block.confirmation });
        });
      });
    });
  });
  return out;
};

interface FileRowProps {
  file: FileUploadEntry;
  index: number;
  onRetry: (id: string) => void;
}

const FileRow: React.FC<FileRowProps> = ({ file, index, onRetry }) => (
  <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#E1DED4] bg-white">
    <span className="text-xs font-semibold text-[#142030] truncate" title={file.name}>
      {file.name}
    </span>
    <div className="flex items-center gap-2 shrink-0">
      <span
        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${STATUS_BADGE_CLASSES[file.status]}`}
        title={file.status === 'failed' ? file.failureReason : undefined}
      >
        {STATUS_LABEL[file.status]}
      </span>
      {file.status === 'failed' && (
        <button
          type="button"
          onClick={() => onRetry(file.id)}
          // Includes the row position, not just the name -- two files sharing a name (the same
          // source re-selected, or a coincidental match) would otherwise produce indistinguishable
          // accessible names.
          aria-label={`Retry file ${index + 1}: ${file.name}`}
          className="p-1 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  </div>
);

// Full-width surface (a takeover, not a SidePanel blade) per UX-DR5 -- Course Content Editor's
// real shell going forward. This story builds only the file-upload/status-list slice of it;
// Story 2.3 extends this same top component with the Chapter/Topic/Subtopic tree beneath the
// file list.
export const CourseContentEditor: React.FC<CourseContentEditorProps> = ({ isOpen, onClose, draftId }) => {
  const { data, addFiles, retryFile, resetFiles } = useFileUpload(draftId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentTree = useCourseContentTree(draftId);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  // Story 3.9/Task 5: opened by PublishLifecycleBar's "Review as Student" button, the instant
  // Task 1's move-to-review call actually succeeds server-side (see useCourseLifecycle.ts's own
  // onReviewAsStudentReady callback) -- not on click alone, since the button is a no-op unless
  // the course was actually Draft.
  const [isReviewingAsStudent, setIsReviewingAsStudent] = useState(false);

  const [announcement, setAnnouncement] = useState('');
  const prevStatusesRef = useRef<Map<string, FileUploadStatus>>(new Map());
  const prevConfirmationsRef = useRef<Map<string, NodeConfirmation>>(new Map());
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

  // Same diff-previous-vs-current pattern as the file-status effect above, applied to each
  // node's confirmation instead -- announces only the confirmed -> unconfirmed transition (an
  // auto-revert), not every confirmation state on every render. Shares the same
  // pendingMessagesRef/flushAnnouncement mechanism, so both kinds of announcements batch together
  // through the one aria-live region.
  useEffect(() => {
    const prevConfirmations = prevConfirmationsRef.current;
    const currentIds = new Set<string>();
    let changed = false;
    flattenConfirmations(contentTree.data).forEach(({ id, label, confirmation }) => {
      currentIds.add(id);
      if (prevConfirmations.get(id) === 'confirmed' && confirmation === 'unconfirmed') {
        changed = true;
        pendingMessagesRef.current.push(`${label}: confirmation reset`);
      }
      prevConfirmations.set(id, confirmation);
    });
    // Prune entries for nodes that no longer exist (deleted since the last run) -- otherwise this
    // Map only ever grows for the life of the mounted component.
    const staleIds: string[] = [];
    prevConfirmations.forEach((_value, id) => {
      if (!currentIds.has(id)) staleIds.push(id);
    });
    staleIds.forEach((id) => prevConfirmations.delete(id));

    if (changed) {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(flushAnnouncement, STATUS_ANNOUNCE_DEBOUNCE_MS);
      if (!maxWaitTimerRef.current) {
        maxWaitTimerRef.current = setTimeout(flushAnnouncement, STATUS_ANNOUNCE_MAX_WAIT_MS);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentTree.data]);

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
    contentTree.resetTree();
    prevStatusesRef.current.clear();
    prevConfirmationsRef.current.clear();
    pendingMessagesRef.current = [];
    setAnnouncement('');
    setIsReviewingAsStudent(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  // Belt-and-suspenders alongside the draftId-keyed reset above: also clears immediately on
  // close, rather than waiting for the next open to catch up.
  const handleClose = () => {
    resetFiles();
    contentTree.resetTree();
    prevStatusesRef.current.clear();
    prevConfirmationsRef.current.clear();
    pendingMessagesRef.current = [];
    setAnnouncement('');
    setIsReviewingAsStudent(false);
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
      // both handlers fire on the same keypress (they're two independent document-level
      // listeners), cancelling the delete confirmation AND closing/resetting the whole editor at
      // once. Same reasoning for the Review-as-Student preview (Story 3.9/Task 5): Escape exits
      // just the preview first, not the whole editor underneath it.
      if (event.key === 'Escape' && deleteTarget) return;
      if (event.key === 'Escape' && isReviewingAsStudent) {
        setIsReviewingAsStudent(false);
        return;
      }
      if (event.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, deleteTarget, isReviewingAsStudent]);

  if (!isOpen) return null;

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    e.target.value = '';
    if (!fileList || fileList.length === 0) return;
    const files: File[] = Array.from(fileList);
    addFiles(files);
  };

  return (
    <div
      className="fixed inset-0 z-[55] bg-white flex flex-col"
      role="region"
      aria-label="Course Content Editor"
    >
      <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-5 border-b border-[#E1DED4]">
        <h2 className="text-lg font-extrabold text-[#142030]">Course Content Editor</h2>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close Course Content Editor"
          className="p-1.5 rounded-lg text-[#5E6A79] hover:bg-[#FAF7EC] hover:text-[#142030] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Story 3.4/Task 2: tutor-facing publishing lifecycle surface -- mounted here, the
          minimal integration point, without otherwise restructuring this file. Keyed by draftId:
          this editor can stay open and mounted while draftId itself changes (switching drafts),
          and useCourseLifecycle has no effect watching courseId to reset its own state on that
          change -- without this key, a publish batch already in progress (or a stale terminal
          state) for the PREVIOUS draft would keep rendering under the newly-selected draft's
          header instead of a fresh draft/no-checklist state. */}
      <PublishLifecycleBar key={draftId} courseId={draftId} onReviewAsStudentReady={() => setIsReviewingAsStudent(true)} />

      {/* Widened from Story 2.2's max-w-3xl (sized for a plain file list) -- the nested tree
          added by Story 2.3 needs more horizontal room. Intentional layout change, not a
          regression of the file list's centered look. */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 max-w-5xl w-full mx-auto">
        <div>
          <h3 className="text-sm font-bold text-[#142030]">Uploaded Files</h3>
          <p className="text-xs text-[#5E6A79] mt-0.5">
            Upload PDF, Word, TXT, or Excel files — each is parsed and extracted independently.
          </p>
        </div>

        <div className="space-y-2">
          {data.map((file, index) => (
            <FileRow key={file.id} file={file} index={index} onRetry={retryFile} />
          ))}
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full p-4 rounded-xl border-2 border-dashed border-[#E1DED4] flex items-center justify-center gap-2 text-[#5E6A79] hover:border-[#BA5012] hover:text-[#BA5012] transition-colors text-xs font-bold"
        >
          <Plus className="w-4 h-4" />
          <span>Add files</span>
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

        <div className="pt-4 border-t border-[#E1DED4]">
          <h3 className="text-sm font-bold text-[#142030] mb-2">Course Content</h3>
          <ContentTree
            chapters={contentTree.data}
            onAddChapter={contentTree.addChapter}
            mutators={
              {
                addNode: contentTree.addNode,
                editNodeTitle: contentTree.editNodeTitle,
                editContentBlock: contentTree.editContentBlock,
                deleteNode: contentTree.deleteNode,
                reorderNode: contentTree.reorderNode,
                moveNode: contentTree.moveNode,
                confirmNode: contentTree.confirmNode,
                requestDelete: (id, label) => setDeleteTarget({ id, label }),
              } satisfies TreeMutators
            }
          />
        </div>
      </div>

      <div aria-live="polite" aria-atomic="false" className="sr-only" data-testid="content-editor-announcer">
        {announcement}
      </div>

      {deleteTarget && (
        <ConfirmModal
          message={`Delete "${deleteTarget.label.trim() || 'this item'}" and everything inside it? This can't be undone.`}
          onConfirm={() => {
            contentTree.deleteNode(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {isReviewingAsStudent && draftId && (
        <ReviewAsStudentPreview courseId={draftId} chapters={contentTree.data} onClose={() => setIsReviewingAsStudent(false)} />
      )}
    </div>
  );
};
