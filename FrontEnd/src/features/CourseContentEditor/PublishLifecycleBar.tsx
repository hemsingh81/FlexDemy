import React, { useState } from 'react';
import { useCourseLifecycle, type LifecycleState } from './useCourseLifecycle';

interface PublishLifecycleBarProps {
  courseId: string | null;
  // Story 3.9/Task 5: fires the instant "Review as Student" actually succeeds server-side, so
  // CourseContentEditor.tsx can open its cross-feature preview -- this component owns the one
  // useCourseLifecycle instance wired to that button, so it's the natural place to thread this
  // through rather than duplicating a second lifecycle-tracking hook instance elsewhere. Optional
  // and additive -- omitting it leaves every other consumer of this component unaffected.
  onReviewAsStudentReady?: () => void;
}

const STAGES: { key: LifecycleState; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'inReview', label: 'In Review' },
  { key: 'reviewConfirmed', label: 'Review Confirmed' },
  { key: 'published', label: 'Published' },
];

// Story 3.4/Task 2+3: sticky lifecycle stage indicator + action buttons, plus (while a mock
// publish batch is running) the publishing banner/progress bar/checklist -- all in one component,
// mirroring mockups/key-publishing-state.html's own single sticky-header block structure.
export const PublishLifecycleBar: React.FC<PublishLifecycleBarProps> = ({ courseId, onReviewAsStudentReady }) => {
  const {
    state,
    isPublishing,
    checklist,
    triggerReviewAsStudent,
    triggerConfirmReview,
    triggerPublish,
    retryFailedNode,
    triggerReturnToDraft,
    isReturningToDraft,
    versions,
    isLoadingVersions,
    fetchVersions,
    triggerRestoreVersion,
    isRestoringVersion,
  } = useCourseLifecycle(courseId, onReviewAsStudentReady);
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

  const countableRows = (checklist ?? []).filter((row) => row.nodeKind !== 'chapter');
  const doneCount = countableRows.filter((row) => row.statusKind === 'done').length;
  const totalCount = countableRows.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

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
        {/* Code-review patch: enabled through every pre-Published state, not just 'draft' -- the
            backend's own EnsureViewableForGenerationAsync gate (AdaptiveLearningService.cs et al)
            was widened to allow the owning tutor to preview repeatedly through InReview/
            ReviewConfirmed, not just once at the instant Draft -> InReview happens. Disabled only
            once actually Published, when a real CoursePlayer view already serves this content live. */}
        <button
          type="button"
          onClick={triggerReviewAsStudent}
          disabled={state === 'published'}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FAF7EC] text-[#143358] border border-[#E1DED4] hover:bg-[#143358] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#FAF7EC] disabled:hover:text-[#143358] transition-all cursor-pointer"
        >
          Review as Student
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
            disabled while isPublishing: `state` itself stays 'reviewConfirmed' for the whole
            publishing duration (it only flips to 'published' once the batch finishes), so without
            this a double-click/re-click mid-batch would re-seed the checklist from scratch. */}
        <button
          type="button"
          onClick={triggerPublish}
          disabled={state !== 'reviewConfirmed' || isPublishing}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#143358] text-white hover:bg-[#143358]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          Publish
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
                    · {version.chapterCount} chapter{version.chapterCount === 1 ? '' : 's'}, {version.topicCount} topic
                    {version.topicCount === 1 ? '' : 's'}
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

      {isPublishing && (
        <div className="mt-3.5 space-y-3">
          {/* AC#3: not a spinner -- a role="status" aria-live="polite" banner stating the batch
              is running and safe to leave the tab, plus the derived "N of M" figure computed here
              from the checklist itself, not a separate hook-supplied counter. */}
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#143358]/5 border border-[#143358]/10"
          >
            <span className="text-xs text-[#143358] font-medium">
              Publishing — generating Drill-Down &amp; Ways content for every confirmed node
              <span className="text-slate-500"> · safe to close this tab, it keeps running server-side</span>
            </span>
            <span className="text-xs font-bold text-[#143358] whitespace-nowrap">
              {doneCount} of {totalCount} confirmed nodes generated
            </span>
          </div>

          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-[#179765] transition-all motion-reduce:transition-none" style={{ width: `${progressPct}%` }} />
          </div>

          {/* AC#3: node-by-node checklist, never a spinner; the whole container is its own
              aria-live="polite" region announcing meaningful increments/terminal states -- not
              Epic 2's debounced-batching announcer (that pattern exists there for a realistic
              many-files-within-milliseconds flood risk this slower, one-row-per-tick mock
              progression doesn't have). */}
          <div aria-live="polite" className="space-y-1.5 max-h-72 overflow-y-auto">
            {(checklist ?? []).map((row) =>
              row.nodeKind === 'chapter' ? (
                <p key={row.nodeId} className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 pt-1.5">
                  {row.title}
                </p>
              ) : (
                <div key={row.nodeId} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <span
                    aria-hidden="true"
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                      row.statusKind === 'done'
                        ? 'bg-[#179765] text-white'
                        : row.statusKind === 'inProgress'
                          ? 'bg-[#143358] text-white'
                          : row.statusKind === 'failed'
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-100 text-slate-400 border border-[#E1DED4]'
                    }`}
                  >
                    {row.statusKind === 'done' ? '✓' : row.statusKind === 'inProgress' ? '…' : row.statusKind === 'failed' ? '!' : '·'}
                  </span>
                  <span className="flex-1 text-slate-800">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 mr-1.5">
                      {row.nodeKind === 'topic' ? 'Topic' : 'Subtopic'}
                    </span>
                    {row.title}
                  </span>
                  <span
                    className={`text-[11px] font-medium whitespace-nowrap ${
                      row.statusKind === 'failed' ? 'text-red-600' : row.statusKind === 'inProgress' ? 'text-[#143358]' : 'text-slate-500'
                    }`}
                  >
                    {row.statusText}
                    {row.statusKind === 'failed' && (
                      <button
                        type="button"
                        onClick={() => retryFailedNode(row.nodeId)}
                        className="ml-2 text-[11px] font-bold text-red-600 underline cursor-pointer"
                      >
                        Retry
                      </button>
                    )}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};
