import React, { useState } from 'react';
import { useCourseLifecycle, type LifecycleState } from './useCourseLifecycle';
import { useCourseContent } from '../../context/CourseContentContext';
import type { OutlineDto } from '../../services/courseContentService';

interface PublishLifecycleBarProps {
  courseId: string | null;
  // Story 11.1, Task 2 (AC #1): fired when the tutor activates a blocker link -- the parent
  // (CourseContentEditor.tsx) owns both the currently-open chapter and the Tiptap editor instance
  // (via its sibling DocumentCanvas), neither of which this component has access to, so the actual
  // chapter-switch + focus-move is delegated back up rather than attempted from here.
  onActivateBlocker: (blocker: { id: string; chapterId: string }) => void;
}

interface Blocker {
  id: string;
  chapterId: string;
  kind: 'Chapter' | 'Topic' | 'Sub-Topic' | 'Page';
  title: string;
}

// Story 11.1, Task 2 (AC #1): every Unconfirmed Chapter/Topic/Sub-Topic/Page across the WHOLE
// course (not just the currently-open Chapter) -- CourseContentContext's `outline` already carries
// every node's isConfirmed across every Chapter (Story 7.4's GetOutlineAsync is whole-course by
// design), so this needs no separate fetch. Page confirmation counts identically to node
// confirmation, per FR-44's own "node or page" scope.
const computeBlockers = (outline: OutlineDto | null): Blocker[] => {
  if (!outline) return [];
  const blockers: Blocker[] = [];
  for (const chapter of outline.chapters) {
    if (!chapter.isConfirmed) blockers.push({ id: chapter.id, chapterId: chapter.id, kind: 'Chapter', title: chapter.title || 'Untitled chapter' });
    for (const page of chapter.pages) {
      if (!page.isConfirmed) blockers.push({ id: page.id, chapterId: chapter.id, kind: 'Page', title: page.title || 'Untitled page' });
    }
    for (const topic of chapter.topics) {
      if (!topic.isConfirmed) blockers.push({ id: topic.id, chapterId: chapter.id, kind: 'Topic', title: topic.title || 'Untitled topic' });
      for (const page of topic.pages) {
        if (!page.isConfirmed) blockers.push({ id: page.id, chapterId: chapter.id, kind: 'Page', title: page.title || 'Untitled page' });
      }
      for (const subtopic of topic.subtopics) {
        if (!subtopic.isConfirmed) {
          blockers.push({ id: subtopic.id, chapterId: chapter.id, kind: 'Sub-Topic', title: subtopic.title || 'Untitled sub-topic' });
        }
        for (const page of subtopic.pages) {
          if (!page.isConfirmed) blockers.push({ id: page.id, chapterId: chapter.id, kind: 'Page', title: page.title || 'Untitled page' });
        }
      }
    }
  }
  return blockers;
};

const STAGES: { key: LifecycleState; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'inReview', label: 'In Review' },
  { key: 'reviewConfirmed', label: 'Review Confirmed' },
  { key: 'published', label: 'Published' },
];

// Story 3.4/Task 2+3: sticky lifecycle stage indicator + action buttons. Publish is a single,
// immediate, synchronous transition -- no per-node generation batch/checklist to show progress
// for anymore, so this is just the stage nav plus a Version History drawer.
export const PublishLifecycleBar: React.FC<PublishLifecycleBarProps> = ({ courseId, onActivateBlocker }) => {
  const {
    state,
    triggerMoveToReview,
    triggerConfirmReview,
    isPublishing,
    triggerPublish,
    triggerReturnToDraft,
    isReturningToDraft,
    versions,
    isLoadingVersions,
    fetchVersions,
    triggerRestoreVersion,
    isRestoringVersion,
  } = useCourseLifecycle(courseId);
  const { outline } = useCourseContent();
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isBlockerListOpen, setIsBlockerListOpen] = useState(false);

  const stageIndex = STAGES.findIndex((stage) => stage.key === state);
  const blockers = computeBlockers(outline);

  // Story 3.10/Task 4: kept minimal per this story's own [ASSUMPTION] -- a plain toggled list with
  // a Restore button per entry, not a dedicated screen, for a tutor-facing/likely-low-frequency
  // action. Fetches on first open rather than eagerly on every mount.
  const toggleVersionHistory = () => {
    const opening = !isVersionHistoryOpen;
    setIsVersionHistoryOpen(opening);
    if (opening) fetchVersions();
  };

  return (
    <div className="border-b border-[#E1DED4] bg-white px-5 py-4">
      <nav aria-label="Course publishing lifecycle" className="flex items-center flex-wrap gap-0 mb-3">
        {STAGES.map((stage, index) => {
          const isDone = index < stageIndex;
          const isCurrent = index === stageIndex;
          return (
            <React.Fragment key={stage.key}>
              <div
                aria-current={isCurrent ? 'true' : undefined}
                className={`flex items-center gap-2 pr-3.5 py-1.5 text-xs font-bold ${
                  isDone ? 'text-[#179765]' : isCurrent ? 'text-[#143358]' : 'text-slate-400'
                }`}
              >
                <span
                  className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] border ${
                    isDone
                      ? 'bg-[#179765] text-white border-[#179765]'
                      : isCurrent
                        ? 'bg-[#143358] text-white border-[#143358]'
                        : 'bg-slate-50 text-slate-400 border-[#E1DED4]'
                  }`}
                >
                  {isDone ? '✓' : isCurrent ? '●' : index + 1}
                </span>
                {stage.label}
              </div>
              {index < STAGES.length - 1 && (
                <div className={`w-7 h-0.5 ${isDone ? 'bg-[#179765]' : 'bg-[#E1DED4]'}`} />
              )}
            </React.Fragment>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={triggerMoveToReview}
          // Story 11.1, Task 2 (AC #1): client-side convenience on top of, not instead of, the
          // backend gate (Task 1) -- clicking while blockers are visible is structurally
          // impossible via this disabled state, so the server-side rejection is defense-in-depth,
          // never the primary UX.
          disabled={state !== 'draft' || blockers.length > 0}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FAF7EC] text-[#143358] border border-[#E1DED4] hover:bg-[#143358] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#FAF7EC] disabled:hover:text-[#143358] transition-all cursor-pointer"
        >
          Move to Review
        </button>
        {/* Story 11.1, Task 2 (AC #1): mirrors the Version History toggle's own shape -- shown only
            while it's actually relevant (draft, with something blocking the move). */}
        {state === 'draft' && blockers.length > 0 && (
          <button
            type="button"
            onClick={() => setIsBlockerListOpen((prev) => !prev)}
            aria-expanded={isBlockerListOpen}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FAF7EC] text-[#BA5012] border border-[#E1DED4] hover:bg-[#BA5012] hover:text-white transition-all cursor-pointer"
          >
            {isBlockerListOpen ? 'Hide blockers' : `${blockers.length} blocker${blockers.length === 1 ? '' : 's'}`}
          </button>
        )}
        <button
          type="button"
          onClick={triggerConfirmReview}
          disabled={state !== 'inReview'}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FAF7EC] text-[#143358] border border-[#E1DED4] hover:bg-[#143358] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#FAF7EC] disabled:hover:text-[#143358] transition-all cursor-pointer"
        >
          Confirm Review
        </button>
        {/* AC#2: disabled at every state other than reviewConfirmed -- a visible, disabled
            <button>, not hidden, so a tutor can see Publish exists but isn't available yet. Also
            disabled while isPublishing, guarding against a double-click firing two concurrent
            publish requests. */}
        <button
          type="button"
          onClick={triggerPublish}
          disabled={state !== 'reviewConfirmed' || isPublishing}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#143358] text-white hover:bg-[#143358]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          {isPublishing ? 'Publishing…' : 'Publish'}
        </button>
        {/* Story 3.10/Task 2: visible only once Published -- a tutor can iterate on a live course
            by returning it to Draft; the prior published state is retained as a version (Task 1,
            already handled at publish time), content itself is left exactly as-is. */}
        {state === 'published' && (
          <button
            type="button"
            onClick={triggerReturnToDraft}
            disabled={isReturningToDraft}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FAF7EC] text-[#143358] border border-[#E1DED4] hover:bg-[#143358] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#FAF7EC] disabled:hover:text-[#143358] transition-all cursor-pointer"
          >
            Return to Draft
          </button>
        )}
        <button
          type="button"
          onClick={toggleVersionHistory}
          aria-expanded={isVersionHistoryOpen}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FAF7EC] text-[#143358] border border-[#E1DED4] hover:bg-[#143358] hover:text-white transition-all cursor-pointer"
        >
          {isVersionHistoryOpen ? 'Hide Version History' : 'Version History'}
        </button>
      </div>

      {isBlockerListOpen && blockers.length > 0 && (
        <ul className="mt-3.5 space-y-1" aria-label="Content blocking Move to Review">
          {blockers.map((blocker) => (
            <li key={blocker.id}>
              <button
                type="button"
                onClick={() => onActivateBlocker(blocker)}
                className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-[#143358] bg-slate-50 border border-slate-200 hover:border-[#BA5012] hover:text-[#BA5012] transition-colors cursor-pointer"
              >
                <span className="font-bold">{blocker.kind}:</span> {blocker.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      {isVersionHistoryOpen && (
        <div className="mt-3.5 space-y-1.5 max-h-72 overflow-y-auto" aria-label="Version history">
          {isLoadingVersions && <p className="text-xs text-slate-500">Loading…</p>}
          {!isLoadingVersions && versions?.length === 0 && <p className="text-xs text-slate-500">No published versions yet.</p>}
          {!isLoadingVersions &&
            versions?.map((version) => (
              <div
                key={version.id}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              >
                <span className="text-slate-800">
                  {new Date(version.publishedAt).toLocaleString()}
                  <span className="text-slate-500 ml-1.5">
                    · {version.fileCount} file{version.fileCount === 1 ? '' : 's'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => triggerRestoreVersion(version.id)}
                  disabled={isRestoringVersion}
                  className="text-[11px] font-bold text-[#143358] underline cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isRestoringVersion ? 'Restoring…' : 'Restore'}
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
