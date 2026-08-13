import { useEffect, useRef, useState } from 'react';
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
  type ChecklistRowDto,
  type CourseVersionDto,
  type PublishStatusDto,
} from '../../services/courseDraftService';

export type { CourseVersionDto };

// Story 3.4/Task 1: lowercase, mirroring this codebase's established backend-PascalCase-to-
// frontend-lowercase translation convention (useCourseContentTree.ts does the identical
// translation for NodeConfirmation/ContentBlockFormat). The real backend enum
// (Domain/Courses/LifecycleState.cs) has values Published/Draft/InReview/ReviewConfirmed and no
// Publishing member -- confirmed by direct read -- so `isPublishing` below is a separate boolean,
// never a 5th LifecycleState value.
export type LifecycleState = 'draft' | 'inReview' | 'reviewConfirmed' | 'published';

export type ChecklistNodeKind = 'chapter' | 'topic' | 'subtopic';
export type ChecklistStatusKind = 'done' | 'inProgress' | 'pending' | 'failed';

// statusText is free text, statusKind is the small fixed set driving icon/color -- deliberately
// separated so a real backend (Story 3.8) can produce arbitrary detail text ("Generating Way 3 of
// 5…") without this shape needing to change. Chapter rows are structural/grouping headers only
// (never generation-tracked, since Chapters aren't FR17/18 generation targets per PRD Glossary).
export interface ChecklistRow {
  nodeId: string;
  nodeKind: ChecklistNodeKind;
  title: string;
  statusKind: ChecklistStatusKind;
  statusText: string;
}

interface UseCourseLifecycleResult {
  state: LifecycleState;
  isPublishing: boolean;
  checklist: ChecklistRow[] | null;
  triggerReviewAsStudent: () => void;
  triggerConfirmReview: () => void;
  triggerPublish: () => void;
  retryFailedNode: (nodeId: string) => void;
  // Story 3.10/Task 2-4: return-to-Draft + version history/rollback.
  triggerReturnToDraft: () => void;
  isReturningToDraft: boolean;
  versions: CourseVersionDto[] | null;
  isLoadingVersions: boolean;
  fetchVersions: () => void;
  triggerRestoreVersion: (versionId: string) => void;
  isRestoringVersion: boolean;
}

// How often to poll GET publish-status while a batch is running -- same poll-while-non-terminal
// idiom useFileUpload.ts already established (FILE_POLL_INTERVAL_MS), not a new one.
export const PUBLISH_POLL_INTERVAL_MS = 3000;

const KNOWN_STATES: readonly LifecycleState[] = ['draft', 'inReview', 'reviewConfirmed', 'published'];
const KNOWN_NODE_KINDS: readonly ChecklistNodeKind[] = ['chapter', 'topic', 'subtopic'];
const KNOWN_STATUS_KINDS: readonly ChecklistStatusKind[] = ['done', 'inProgress', 'pending', 'failed'];

// Backend serializes LifecycleState via enum.ToString() (PascalCase, e.g. "ReviewConfirmed") --
// lower-first-char here to match this hook's own lowercase union, same fallback-to-a-safe-default
// discipline useFileUpload.ts's own toStatus() established for an unrecognized value.
const toState = (raw: string): LifecycleState => {
  const lowered = raw.charAt(0).toLowerCase() + raw.slice(1);
  return (KNOWN_STATES as readonly string[]).includes(lowered) ? (lowered as LifecycleState) : 'draft';
};

// checklist[].nodeKind/statusKind are already lowercase on the wire (PublishService.cs's own
// BuildChecklistAsync/ToStatusKind build them that way directly, unlike LifecycleState above) --
// this is a defensive validate-not-translate, same unrecognized-value fallback discipline.
const toChecklistRow = (dto: ChecklistRowDto): ChecklistRow => ({
  nodeId: dto.nodeId,
  nodeKind: (KNOWN_NODE_KINDS as readonly string[]).includes(dto.nodeKind) ? (dto.nodeKind as ChecklistNodeKind) : 'topic',
  title: dto.title,
  statusKind: (KNOWN_STATUS_KINDS as readonly string[]).includes(dto.statusKind) ? (dto.statusKind as ChecklistStatusKind) : 'pending',
  statusText: dto.statusText,
});

const errorMessage = (e: unknown): string => (e instanceof CourseDraftError ? e.message : 'Something went wrong. Please try again.');

// Story 3.9/Task 4: real-wires Story 3.4's own mock setInterval state machine against Story
// 3.8/3.9's real endpoints, keeping the exact same exported result shape so PublishLifecycleBar.tsx's
// JSX needs no changes -- only its hook-call site gains the one new optional param below, needed
// so CourseContentEditor.tsx (Story 3.9/Task 5) learns the instant Review-as-Student actually
// succeeds server-side, since PublishLifecycleBar owns the one instance of this hook that's
// wired to the "Review as Student" button.
//
// Failures surface via ToastContext's 'error' variant, not a new field on this hook's own return
// shape -- PublishLifecycleBar.tsx has no inline error-rendering UI of its own, and keeping it
// unchanged (this task's own explicit goal) ruled out extending the returned shape with an
// `error` field the way this codebase's usual per-screen-inline-error convention would otherwise
// call for.
export const useCourseLifecycle = (courseId: string | null, onReviewAsStudentReady?: () => void): UseCourseLifecycleResult => {
  const { showToast } = useToast();
  const [state, setState] = useState<LifecycleState>('draft');
  const [isPublishing, setIsPublishing] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistRow[] | null>(null);
  const [versions, setVersions] = useState<CourseVersionDto[] | null>(null);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  // Code-review patch: unlike triggerPublish (guarded by isPublishing), triggerReturnToDraft/
  // triggerRestoreVersion had no re-entry guard at all -- a double-click could fire two
  // concurrent requests for the same course. Kept as local flags (not derived from `state`, which
  // only changes after the request resolves) so the guard is active for the whole in-flight window.
  const [isReturningToDraft, setIsReturningToDraft] = useState(false);
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyStatus = (dto: PublishStatusDto) => {
    setState(toState(dto.lifecycleState));
    setIsPublishing(dto.isPublishing);
    setChecklist(dto.checklist ? dto.checklist.map(toChecklistRow) : null);
  };

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  // Initial load -- picks up wherever this course's real lifecycle state/checklist already is
  // (e.g. reopening the editor mid-publish), not always starting from 'draft'.
  useEffect(() => {
    stopPolling();
    setState('draft');
    setIsPublishing(false);
    setChecklist(null);
    setVersions(null);
    if (!courseId) return undefined;

    let cancelled = false;
    getPublishStatus(courseId)
      .then((dto) => {
        if (!cancelled) applyStatus(dto);
      })
      // Same "don't surface a background load failure" posture useFileUpload.ts's own initial-load
      // effect takes -- a transient failure here just leaves the just-reset 'draft'/no-checklist
      // state, corrected by the next successful load.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  // Polls while a batch is running -- same poll-while-non-terminal idiom useFileUpload.ts
  // established (FILE_POLL_INTERVAL_MS/NON_TERMINAL_STATUSES), not a new one.
  useEffect(() => {
    if (!courseId || !isPublishing) {
      stopPolling();
      return undefined;
    }
    if (!pollTimerRef.current) {
      pollTimerRef.current = setInterval(() => {
        getPublishStatus(courseId).then(applyStatus).catch(() => undefined);
      }, PUBLISH_POLL_INTERVAL_MS);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, isPublishing]);

  // Cancels the poll on unmount -- without this, a long-lived timer keeps firing setState after
  // the component is gone.
  useEffect(() => () => stopPolling(), []);

  const triggerReviewAsStudent = () => {
    if (!courseId || state === 'published') return;

    // Code-review patch: only the FIRST call (while still 'draft') needs the actual
    // Draft -> InReview transition -- every subsequent call, after a tutor has already closed
    // the preview once, must still be able to reopen it through InReview/ReviewConfirmed without
    // re-triggering (or being blocked behind) that one-time transition. Matches the backend's own
    // EnsureViewableForGenerationAsync gate, which was deliberately widened to allow repeated
    // owner previewing through both of those states, not just the instant of the transition.
    if (state !== 'draft') {
      onReviewAsStudentReady?.();
      return;
    }

    moveToReview(courseId)
      .then(() => {
        setState('inReview');
        onReviewAsStudentReady?.();
      })
      .catch((e) => showToast({ message: errorMessage(e), variant: 'error' }));
  };

  const triggerConfirmReview = () => {
    if (!courseId || state !== 'inReview') return;
    confirmReview(courseId)
      .then(() => setState('reviewConfirmed'))
      .catch((e) => showToast({ message: errorMessage(e), variant: 'error' }));
  };

  const triggerPublish = () => {
    // Also guards against a re-trigger while a batch is already running -- the backend itself now
    // rejects a duplicate trigger too (PublishService.PublishAsync's own guard), but checking here
    // avoids even making the doomed request.
    if (!courseId || state !== 'reviewConfirmed' || isPublishing) return;
    publishCourse(courseId)
      .then(() => getPublishStatus(courseId))
      .then(applyStatus)
      .catch((e) => showToast({ message: errorMessage(e), variant: 'error' }));
  };

  // No backend endpoint exists for "manually retry generation of one specific failed node" --
  // Story 3.8's job already retries transient failures automatically (Hangfire
  // [AutomaticRetry(Attempts=5)]), and a node still Failed after that has exhausted them; Story
  // 3.5's on-demand fallback already serves it the moment anyone actually views it, no retry
  // click needed. Re-polling immediately is the honest thing left for this button to do -- reveal
  // whether the row has since resolved -- rather than pretending to trigger work that doesn't
  // exist server-side.
  const retryFailedNode = (nodeId: string) => {
    if (!courseId) return;
    void nodeId;
    getPublishStatus(courseId).then(applyStatus).catch(() => undefined);
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

  // Story 3.10/Task 3: a genuine rollback -- replaces the course's current content tree with the
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
  };
};
