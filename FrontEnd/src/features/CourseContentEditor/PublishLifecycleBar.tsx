import React, { useState } from 'react';
import { useCourseLifecycle, type LifecycleState } from './useCourseLifecycle';

interface PublishLifecycleBarProps {
  courseId: string | null;
}

const STAGES: { key: LifecycleState; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'inReview', label: 'In Review' },
  { key: 'reviewConfirmed', label: 'Review Confirmed' },
  { key: 'published', label: 'Published' },
];

// Story 3.4/Task 2+3: sticky lifecycle stage indicator + action buttons. Publish is a single,
// immediate, synchronous transition -- no per-node generation batch/checklist to show progress
// for anymore, so this is just the stage nav plus a Version History drawer.
export const PublishLifecycleBar: React.FC<PublishLifecycleBarProps> = ({ courseId }) => {
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
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);

  const stageIndex = STAGES.findIndex((stage) => stage.key === state);

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
          disabled={state !== 'draft'}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FAF7EC] text-[#143358] border border-[#E1DED4] hover:bg-[#143358] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#FAF7EC] disabled:hover:text-[#143358] transition-all cursor-pointer"
        >
          Move to Review
        </button>
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
