import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  CourseDraftError,
  confirmReview,
  getPublishStatus,
  getVersions,
  moveToReview,
  publishCourse,
  restoreVersion,
  returnToDraft,
  type CourseVersionDto,
  type PublishStatusDto,
} from '../../services/courseDraftService';

export type { CourseVersionDto };

// Story 3.4/Task 1: lowercase, mirroring this codebase's established backend-PascalCase-to-
// frontend-lowercase translation convention. The real backend enum
// (Domain/Courses/LifecycleState.cs) has values Published/Draft/InReview/ReviewConfirmed.
export type LifecycleState = 'draft' | 'inReview' | 'reviewConfirmed' | 'published';

interface UseCourseLifecycleResult {
  state: LifecycleState;
  triggerMoveToReview: () => void;
  triggerConfirmReview: () => void;
  isPublishing: boolean;
  triggerPublish: () => void;
  // Story 3.10/Task 2-4: return-to-Draft + version history/rollback.
  triggerReturnToDraft: () => void;
  isReturningToDraft: boolean;
  versions: CourseVersionDto[] | null;
  isLoadingVersions: boolean;
  fetchVersions: () => void;
  triggerRestoreVersion: (versionId: string) => void;
  isRestoringVersion: boolean;
}

const KNOWN_STATES: readonly LifecycleState[] = ['draft', 'inReview', 'reviewConfirmed', 'published'];

// Backend serializes LifecycleState via enum.ToString() (PascalCase, e.g. "ReviewConfirmed") --
// lower-first-char here to match this hook's own lowercase union, same fallback-to-a-safe-default
// discipline useFileUpload.ts's own toStatus() established for an unrecognized value. Exported
// (FR-31) so MyCoursesSection.tsx's course list shares this exact conversion instead of a second,
// independently-drifting copy.
export const toState = (raw: string): LifecycleState => {
  const lowered = raw.charAt(0).toLowerCase() + raw.slice(1);
  return (KNOWN_STATES as readonly string[]).includes(lowered) ? (lowered as LifecycleState) : 'draft';
};

const errorMessage = (e: unknown): string => (e instanceof CourseDraftError ? e.message : 'Something went wrong. Please try again.');

// Publish is now a single, immediate, synchronous transition (no per-node generation batch) --
// PublishLifecycleBar.tsx's JSX only needed its checklist/isPublishing-polling UI removed to
// match; every other trigger here keeps the same shape it always had.
export const useCourseLifecycle = (courseId: string | null): UseCourseLifecycleResult => {
  const { showToast } = useToast();
  const [state, setState] = useState<LifecycleState>('draft');
  const [isPublishing, setIsPublishing] = useState(false);
  const [versions, setVersions] = useState<CourseVersionDto[] | null>(null);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  // Code-review patch: unlike triggerPublish (guarded by isPublishing), triggerReturnToDraft/
  // triggerRestoreVersion had no re-entry guard at all -- a double-click could fire two
  // concurrent requests for the same course. Kept as local flags (not derived from `state`, which
  // only changes after the request resolves) so the guard is active for the whole in-flight window.
  const [isReturningToDraft, setIsReturningToDraft] = useState(false);
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);

  const applyStatus = (dto: PublishStatusDto) => setState(toState(dto.lifecycleState));

  // Initial load -- picks up wherever this course's real lifecycle state already is (e.g.
  // reopening the editor after a prior session), not always starting from 'draft'.
  useEffect(() => {
    setState('draft');
    setVersions(null);
    if (!courseId) return undefined;

    let cancelled = false;
    getPublishStatus(courseId)
      .then((dto) => {
        if (!cancelled) applyStatus(dto);
      })
      // Same "don't surface a background load failure" posture useFileUpload.ts's own initial-load
      // effect takes -- a transient failure here just leaves the just-reset 'draft' state,
      // corrected by the next successful load.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const triggerMoveToReview = () => {
    if (!courseId || state !== 'draft') return;
    moveToReview(courseId)
      .then(() => setState('inReview'))
      .catch((e) => showToast({ message: errorMessage(e), variant: 'error' }));
  };

  const triggerConfirmReview = () => {
    if (!courseId || state !== 'inReview') return;
    confirmReview(courseId)
      .then(() => setState('reviewConfirmed'))
      .catch((e) => showToast({ message: errorMessage(e), variant: 'error' }));
  };

  const triggerPublish = () => {
    if (!courseId || state !== 'reviewConfirmed' || isPublishing) return;
    setIsPublishing(true);
    publishCourse(courseId)
      .then(() => getPublishStatus(courseId))
      .then(applyStatus)
      .catch((e) => showToast({ message: errorMessage(e), variant: 'error' }))
      .finally(() => setIsPublishing(false));
  };

  // Story 3.10/Task 2: Published -> Draft, content untouched -- calls the endpoint then refetches
  // lifecycle state (same refetch-after-mutate convention this codebase has used since Epic 2),
  // rather than optimistically setting state itself, since a real GET confirms the transition
  // actually took effect server-side.
  const triggerReturnToDraft = () => {
    // Code-review patch: also guards against re-entry while already in flight -- without
    // isReturningToDraft, a double-click fired two concurrent requests (state alone doesn't
    // change until the first one resolves).
    if (!courseId || state !== 'published' || isReturningToDraft) return;
    setIsReturningToDraft(true);
    returnToDraft(courseId)
      .then(() => getPublishStatus(courseId))
      .then(applyStatus)
      .catch((e) => showToast({ message: errorMessage(e), variant: 'error' }))
      .finally(() => setIsReturningToDraft(false));
  };

  const fetchVersions = () => {
    if (!courseId) return;
    setIsLoadingVersions(true);
    getVersions(courseId)
      .then(setVersions)
      .catch((e) => showToast({ message: errorMessage(e), variant: 'error' }))
      .finally(() => setIsLoadingVersions(false));
  };

  // Story 3.10/Task 3: a genuine rollback -- replaces the course's current file text with the
  // chosen version's snapshot and always lands in Draft, regardless of `state` beforehand, so
  // this has no state-based guard of its own (unlike every other trigger above). Still guards
  // against re-entry while already in flight (code-review patch, same reasoning as
  // triggerReturnToDraft) -- restoring is not idempotent to run twice concurrently.
  const triggerRestoreVersion = (versionId: string) => {
    if (!courseId || isRestoringVersion) return;
    setIsRestoringVersion(true);
    restoreVersion(courseId, versionId)
      .then(() => getPublishStatus(courseId))
      .then(applyStatus)
      .catch((e) => showToast({ message: errorMessage(e), variant: 'error' }))
      .finally(() => setIsRestoringVersion(false));
  };

  return {
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
  };
};
