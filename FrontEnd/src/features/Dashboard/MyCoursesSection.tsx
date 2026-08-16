import React, { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { deleteCourse, getMyCourses, returnToDraft, CourseDraftError, type MyCourseSummaryDto } from '../../services/courseDraftService';
import { toState, type LifecycleState } from '../CourseContentEditor/useCourseLifecycle';
import { CourseContentEditor } from '../CourseContentEditor/CourseContentEditor';
import { ConfirmModal } from '../../ui/ConfirmModal';

interface MyCoursesSectionProps {
  isContentEditorOpen: boolean;
  onResumeDraft: (courseId: string) => void;
  // The course id whose Course Content Editor should render inline, directly beneath that
  // course's own row -- or null/undefined for none. Optional (defaulting to "none open") so
  // existing callers that never open the editor inline don't need to pass it.
  openDraftId?: string | null;
  onCloseContentEditor?: () => void;
  // Opens the New Course Wizard (FR-1, Story 5.1: relocated here from the Teaching stats-card
  // row). Optional/defaulted so existing callers that don't wire it up still compile and render.
  onOpenNewCourseWizard?: () => void;
}

const STATUS_LABEL: Record<LifecycleState, string> = {
  draft: 'Draft',
  inReview: 'In Review',
  reviewConfirmed: 'Review Confirmed',
  published: 'Published',
};

// Reuses the exact badge-pill shape CourseContentEditor.tsx's own file-status pills already
// established (text-[10px] font-extrabold px-2.5 py-0.5 rounded-full) -- no new visual pattern.
// Signal-green only for Published (the "done" state); every pre-publish state shares the same
// navy in-progress treatment, mirroring PublishLifecycleBar's own isCurrent/isDone color split.
const STATUS_BADGE_CLASSES: Record<LifecycleState, string> = {
  draft: 'bg-[#143358] text-white',
  inReview: 'bg-[#143358] text-white',
  reviewConfirmed: 'bg-[#143358] text-white',
  published: 'bg-[#179765]/10 text-[#179765] border border-[#179765]/20',
};

// FR-31 (CourseWizard PRD S4.11): the tutor's own "resume a course" list -- every course they
// own, any Lifecycle State, so a Draft left mid-edit (FR-22) stays reachable indefinitely instead
// of only existing in memory for the current wizard->editor session.
export const MyCoursesSection: React.FC<MyCoursesSectionProps> = ({
  isContentEditorOpen,
  onResumeDraft,
  openDraftId = null,
  onCloseContentEditor = () => undefined,
  onOpenNewCourseWizard = () => undefined,
}) => {
  const [courses, setCourses] = useState<MyCourseSummaryDto[] | null>(null);
  // Split from actionError below: a load failure means there's nothing to show at all (courses
  // stays null), so it's the only error that should hide the list. A Take Offline/Delete failure
  // happens on an already-rendered list -- the list (with the failed course still on it) must
  // stay visible alongside the error, not vanish behind it.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // FR-32: bumped after a successful Take Offline/Delete to force the refetch below -- distinct
  // from isContentEditorOpen's own refetch trigger, since these two actions never open the editor.
  const [refreshToken, setRefreshToken] = useState(0);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  // key bumps on every open, even for the same course id -- ConfirmModal now animates its own
  // close (a real delay before the real onConfirm/onCancel fires), so re-requesting delete on
  // the same course right after Cancel must mount a genuinely fresh instance (via key=) rather
  // than reuse one still mid-close, whose backdrop is still pointer-events-none from that close.
  const deleteRequestSeqRef = useRef(0);
  const [deleteTarget, setDeleteTarget] = useState<{ key: number; id: string; title: string } | null>(null);

  // Refetches on mount (isContentEditorOpen starts false) and again every time the Content
  // Editor closes -- so a course just created via the wizard, or one whose title changed during
  // editing, is reflected here without a manual refresh.
  useEffect(() => {
    if (isContentEditorOpen) return;
    let cancelled = false;
    setLoadError(null);
    getMyCourses()
      .then((result) => {
        if (!cancelled) setCourses(result);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoadError(e instanceof CourseDraftError ? e.message : 'Could not load your courses. Please try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [isContentEditorOpen, refreshToken]);

  // FR-32: Published has no delete path at all -- Take Offline (FR-25's existing Return-to-Draft)
  // is the only way to make a Published course deletable, matching the PRD's decision exactly.
  const handleTakeOffline = async (courseId: string) => {
    setMutatingId(courseId);
    setActionError(null);
    try {
      await returnToDraft(courseId);
      setRefreshToken((t) => t + 1);
    } catch (e) {
      setActionError(e instanceof CourseDraftError ? e.message : 'Could not take this course offline. Please try again.');
    } finally {
      setMutatingId(null);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    setMutatingId(id);
    setActionError(null);
    try {
      await deleteCourse(id);
      setRefreshToken((t) => t + 1);
    } catch (e) {
      setActionError(e instanceof CourseDraftError ? e.message : 'Could not delete this course. Please try again.');
    } finally {
      setMutatingId(null);
    }
  };

  return (
    <div id="course-publishing" className="scroll-mt-24 p-5 rounded-2xl bg-white border border-[#E1DED4] shadow-xs space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-[#142030]">My Courses</h3>
        <button
          type="button"
          onClick={onOpenNewCourseWizard}
          // Disabled while Course Content Editor is open -- otherwise this stays keyboard-
          // reachable and a second CourseWizard session could open on top of it (FR-1, Story
          // 5.1: carried over unchanged from the old TeachingStatsCards.tsx trigger card).
          disabled={isContentEditorOpen}
          className="px-3 py-1.5 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          <span>New Course Wizard</span>
        </button>
      </div>

      {(loadError || actionError) && (
        <p role="alert" className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {loadError || actionError}
        </p>
      )}

      {!loadError && courses === null && <p className="text-xs text-[#5E6A79]">Loading your courses…</p>}

      {!loadError && courses !== null && courses.length === 0 && (
        <p className="text-xs text-[#5E6A79]">No courses yet — use New Course Wizard above to create your first one.</p>
      )}

      {!loadError && courses !== null && courses.length > 0 && (
        // key={refreshToken}: forces a fresh mount on every refetch (Take Offline/Delete
        // success, or the Content Editor closing) so the whole grid re-plays its fade-in --
        // "refreshing the my courses grid" should visibly ease in, not silently swap.
        <ul key={refreshToken} className="space-y-2 animate-[fade-in-scale_150ms_ease-out]">
          {courses.map((course) => {
            const state = toState(course.lifecycleState);
            const isMutating = mutatingId === course.id;
            return (
              <React.Fragment key={course.id}>
              <li
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#E1DED4] bg-white"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#142030] truncate" title={course.title}>
                    {course.title}
                  </p>
                  <p className="text-[10px] text-[#5E6A79] mt-0.5">
                    Last edited {new Date(course.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${STATUS_BADGE_CLASSES[state]}`}>
                    {STATUS_LABEL[state]}
                  </span>
                  {/* Draft-only: FR-31's own scope is resuming a Draft; the backend's
                      UpdateDraftCourseAsync/file-upload paths reject a non-Draft course anyway
                      (CourseService.LoadOwnedDraftAsync), so a Resume action on a further-along
                      course would just surface a server error instead of doing anything useful. */}
                  {state === 'draft' && (
                    <button
                      type="button"
                      onClick={() => onResumeDraft(course.id)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#FAF7EC] text-[#143358] border border-[#E1DED4] hover:bg-[#143358] hover:text-white transition-colors cursor-pointer"
                    >
                      Resume
                    </button>
                  )}
                  {/* FR-32: Published has no direct delete -- Take Offline is the only path off
                      it, mirroring PublishLifecycleBar's own "Return to Draft" action/label. */}
                  {state === 'published' ? (
                    <button
                      type="button"
                      onClick={() => handleTakeOffline(course.id)}
                      disabled={isMutating}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#FAF7EC] text-[#143358] border border-[#E1DED4] hover:bg-[#143358] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      {isMutating ? 'Taking Offline…' : 'Take Offline'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ key: ++deleteRequestSeqRef.current, id: course.id, title: course.title })}
                      disabled={isMutating}
                      aria-label={`Delete ${course.title}`}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      {isMutating ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </div>
              </li>
              {course.id === openDraftId && (
                // Full-width, directly beneath this course's own row -- not squeezed to the
                // row's width or double-bordered inside this section's own card shell (fullWidth
                // drops CourseContentEditor's standalone max-w-4xl cap). A plain <li> (list-none:
                // no bullet/row styling of its own) so the surrounding <ul> stays valid markup.
                <li className="list-none">
                  <CourseContentEditor isOpen onClose={onCloseContentEditor} draftId={openDraftId} fullWidth />
                </li>
              )}
              </React.Fragment>
            );
          })}
        </ul>
      )}

      {deleteTarget && (
        <ConfirmModal
          key={deleteTarget.key}
          message={`Permanently delete "${deleteTarget.title}"? This can't be undone.`}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};
