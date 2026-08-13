import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCourseLifecycle, PUBLISH_POLL_INTERVAL_MS } from '@/src/features/CourseContentEditor/useCourseLifecycle';
import * as courseDraftService from '@/src/services/courseDraftService';
import type { CourseVersionDto, PublishStatusDto } from '@/src/services/courseDraftService';

vi.mock('@/src/services/courseDraftService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseDraftService')>('@/src/services/courseDraftService');
  return {
    ...actual,
    moveToReview: vi.fn(),
    confirmReview: vi.fn(),
    publishCourse: vi.fn(),
    getPublishStatus: vi.fn(),
    returnToDraft: vi.fn(),
    getVersions: vi.fn(),
    restoreVersion: vi.fn(),
  };
});

const mockShowToast = vi.fn();
vi.mock('@/src/context/ToastContext', async () => {
  const actual = await vi.importActual<typeof import('@/src/context/ToastContext')>('@/src/context/ToastContext');
  return { ...actual, useToast: () => ({ showToast: mockShowToast }) };
});

// Story 3.9/Task 4: real-wires Story 3.4's own mock setInterval state machine -- this file
// exercises the same state-machine behavior Story 3.4's own tests already established, just
// sourced from mocked HTTP responses instead of the removed mock timers.
const makeStatus = (overrides: Partial<PublishStatusDto> = {}): PublishStatusDto => ({
  lifecycleState: 'Draft',
  isPublishing: false,
  checklist: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus());
});

describe('useCourseLifecycle', () => {
  it('starts in draft with no checklist and is not publishing, before the initial load resolves', () => {
    const { result } = renderHook(() => useCourseLifecycle('course_1'));

    expect(result.current.state).toBe('draft');
    expect(result.current.isPublishing).toBe(false);
    expect(result.current.checklist).toBeNull();
  });

  it('the initial load picks up wherever this course already is, not always draft', async () => {
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(
      makeStatus({ lifecycleState: 'ReviewConfirmed', isPublishing: true, checklist: [] })
    );

    const { result } = renderHook(() => useCourseLifecycle('course_1'));

    await waitFor(() => expect(result.current.state).toBe('reviewConfirmed'));
    expect(result.current.isPublishing).toBe(true);
    expect(courseDraftService.getPublishStatus).toHaveBeenCalledWith('course_1');
  });

  it('triggerReviewAsStudent calls moveToReview and transitions draft -> inReview on success', async () => {
    vi.mocked(courseDraftService.moveToReview).mockResolvedValue(undefined);
    const onReady = vi.fn();
    const { result } = renderHook(() => useCourseLifecycle('course_1', onReady));

    await act(async () => result.current.triggerReviewAsStudent());

    expect(courseDraftService.moveToReview).toHaveBeenCalledWith('course_1');
    expect(result.current.state).toBe('inReview');
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('triggerReviewAsStudent surfaces a failure via the toast and leaves state unchanged', async () => {
    vi.mocked(courseDraftService.moveToReview).mockRejectedValue(
      new courseDraftService.CourseDraftError('At least one node is unconfirmed.')
    );
    const { result } = renderHook(() => useCourseLifecycle('course_1'));

    await act(async () => result.current.triggerReviewAsStudent());

    expect(result.current.state).toBe('draft');
    expect(mockShowToast).toHaveBeenCalledWith({ message: 'At least one node is unconfirmed.', variant: 'error' });
  });

  // Code-review patch: a tutor who already moved a course past Draft (in an earlier visit, or by
  // closing the preview once already) must still be able to reopen the preview through InReview/
  // ReviewConfirmed -- only the one-time Draft -> InReview transition itself is skipped.
  it.each(['InReview', 'ReviewConfirmed'])(
    'triggerReviewAsStudent reopens the preview without re-calling moveToReview when state is already %s',
    async (lifecycleState) => {
      vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus({ lifecycleState }));
      const onReady = vi.fn();
      const { result } = renderHook(() => useCourseLifecycle('course_1', onReady));
      await waitFor(() => expect(result.current.state).not.toBe('draft'));

      await act(async () => result.current.triggerReviewAsStudent());

      expect(courseDraftService.moveToReview).not.toHaveBeenCalled();
      expect(onReady).toHaveBeenCalledTimes(1);
    }
  );

  it('triggerReviewAsStudent is a no-op once the course is published', async () => {
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus({ lifecycleState: 'Published' }));
    const onReady = vi.fn();
    const { result } = renderHook(() => useCourseLifecycle('course_1', onReady));
    await waitFor(() => expect(result.current.state).toBe('published'));

    await act(async () => result.current.triggerReviewAsStudent());

    expect(courseDraftService.moveToReview).not.toHaveBeenCalled();
    expect(onReady).not.toHaveBeenCalled();
  });

  it('triggerConfirmReview calls confirmReview and transitions inReview -> reviewConfirmed on success', async () => {
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus({ lifecycleState: 'InReview' }));
    vi.mocked(courseDraftService.confirmReview).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCourseLifecycle('course_1'));
    await waitFor(() => expect(result.current.state).toBe('inReview'));

    await act(async () => result.current.triggerConfirmReview());

    expect(courseDraftService.confirmReview).toHaveBeenCalledWith('course_1');
    expect(result.current.state).toBe('reviewConfirmed');
  });

  it('triggerConfirmReview is a no-op unless state is inReview', async () => {
    const { result } = renderHook(() => useCourseLifecycle('course_1'));

    await act(async () => result.current.triggerConfirmReview());

    expect(courseDraftService.confirmReview).not.toHaveBeenCalled();
    expect(result.current.state).toBe('draft');
  });

  it('triggerPublish calls publishCourse then re-fetches status, applying the checklist/isPublishing it returns', async () => {
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus({ lifecycleState: 'ReviewConfirmed' }));
    const { result } = renderHook(() => useCourseLifecycle('course_1'));
    await waitFor(() => expect(result.current.state).toBe('reviewConfirmed'));

    vi.mocked(courseDraftService.publishCourse).mockResolvedValue(undefined);
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(
      makeStatus({
        lifecycleState: 'ReviewConfirmed',
        isPublishing: true,
        checklist: [{ nodeId: 'topic_1', nodeKind: 'topic', title: 'Topic 1', statusKind: 'inProgress', statusText: 'Generating Level 1 of 5…' }],
      })
    );

    await act(async () => result.current.triggerPublish());

    expect(courseDraftService.publishCourse).toHaveBeenCalledWith('course_1');
    expect(result.current.isPublishing).toBe(true);
    expect(result.current.checklist).toEqual([
      { nodeId: 'topic_1', nodeKind: 'topic', title: 'Topic 1', statusKind: 'inProgress', statusText: 'Generating Level 1 of 5…' },
    ]);
  });

  it('triggerPublish is a no-op unless state is reviewConfirmed', async () => {
    const { result } = renderHook(() => useCourseLifecycle('course_1'));

    await act(async () => result.current.triggerPublish());

    expect(courseDraftService.publishCourse).not.toHaveBeenCalled();
  });

  it('triggerPublish is a no-op while already publishing, so a re-click never discards existing progress', async () => {
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(
      makeStatus({ lifecycleState: 'ReviewConfirmed', isPublishing: true, checklist: [] })
    );
    const { result } = renderHook(() => useCourseLifecycle('course_1'));
    await waitFor(() => expect(result.current.isPublishing).toBe(true));

    await act(async () => result.current.triggerPublish());

    expect(courseDraftService.publishCourse).not.toHaveBeenCalled();
  });

  it('polls getPublishStatus while isPublishing, and stops once it flips false', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(
      makeStatus({ lifecycleState: 'ReviewConfirmed', isPublishing: true, checklist: [] })
    );
    const { result } = renderHook(() => useCourseLifecycle('course_1'));
    await waitFor(() => expect(result.current.isPublishing).toBe(true));

    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(
      makeStatus({ lifecycleState: 'Published', isPublishing: false, checklist: [] })
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PUBLISH_POLL_INTERVAL_MS);
    });

    expect(result.current.isPublishing).toBe(false);
    expect(result.current.state).toBe('published');

    vi.mocked(courseDraftService.getPublishStatus).mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PUBLISH_POLL_INTERVAL_MS * 3);
    });
    expect(courseDraftService.getPublishStatus).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('retryFailedNode re-fetches publish status immediately -- no dedicated backend retry endpoint exists', async () => {
    const { result } = renderHook(() => useCourseLifecycle('course_1'));
    await waitFor(() => expect(courseDraftService.getPublishStatus).toHaveBeenCalledTimes(1));

    await act(async () => result.current.retryFailedNode('topic_1'));

    expect(courseDraftService.getPublishStatus).toHaveBeenCalledTimes(2);
  });

  it('every trigger is a no-op while courseId is null', async () => {
    const { result } = renderHook(() => useCourseLifecycle(null));

    await act(async () => {
      result.current.triggerReviewAsStudent();
      result.current.triggerConfirmReview();
      result.current.triggerPublish();
      result.current.retryFailedNode('topic_1');
    });

    expect(result.current.state).toBe('draft');
    expect(courseDraftService.moveToReview).not.toHaveBeenCalled();
    expect(courseDraftService.confirmReview).not.toHaveBeenCalled();
    expect(courseDraftService.publishCourse).not.toHaveBeenCalled();
    expect(courseDraftService.getPublishStatus).not.toHaveBeenCalled();
  });

  // -- Story 3.10: return-to-Draft + version history/rollback -------------------------------

  const makeVersion = (overrides: Partial<CourseVersionDto> = {}): CourseVersionDto => ({
    id: 'version_1',
    publishedAt: '2026-08-01T00:00:00Z',
    chapterCount: 2,
    topicCount: 5,
    ...overrides,
  });

  it('triggerReturnToDraft calls returnToDraft then refetches status, only when state is published', async () => {
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus({ lifecycleState: 'Published' }));
    const { result } = renderHook(() => useCourseLifecycle('course_1'));
    await waitFor(() => expect(result.current.state).toBe('published'));

    vi.mocked(courseDraftService.returnToDraft).mockResolvedValue(undefined);
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus({ lifecycleState: 'Draft' }));

    await act(async () => result.current.triggerReturnToDraft());

    expect(courseDraftService.returnToDraft).toHaveBeenCalledWith('course_1');
    expect(result.current.state).toBe('draft');
  });

  it('triggerReturnToDraft is a no-op unless state is published', async () => {
    const { result } = renderHook(() => useCourseLifecycle('course_1'));

    await act(async () => result.current.triggerReturnToDraft());

    expect(courseDraftService.returnToDraft).not.toHaveBeenCalled();
  });

  it('triggerReturnToDraft surfaces a failure via the toast', async () => {
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus({ lifecycleState: 'Published' }));
    const { result } = renderHook(() => useCourseLifecycle('course_1'));
    await waitFor(() => expect(result.current.state).toBe('published'));

    vi.mocked(courseDraftService.returnToDraft).mockRejectedValue(new courseDraftService.CourseDraftError('Something failed.'));

    await act(async () => result.current.triggerReturnToDraft());

    expect(mockShowToast).toHaveBeenCalledWith({ message: 'Something failed.', variant: 'error' });
  });

  it('fetchVersions loads the version list and toggles isLoadingVersions', async () => {
    vi.mocked(courseDraftService.getVersions).mockResolvedValue([makeVersion()]);
    const { result } = renderHook(() => useCourseLifecycle('course_1'));
    expect(result.current.versions).toBeNull();

    await act(async () => result.current.fetchVersions());

    expect(courseDraftService.getVersions).toHaveBeenCalledWith('course_1');
    expect(result.current.versions).toEqual([makeVersion()]);
    expect(result.current.isLoadingVersions).toBe(false);
  });

  it('triggerRestoreVersion calls restoreVersion then refetches status, regardless of current state', async () => {
    const { result } = renderHook(() => useCourseLifecycle('course_1'));
    await waitFor(() => expect(courseDraftService.getPublishStatus).toHaveBeenCalledTimes(1));

    vi.mocked(courseDraftService.restoreVersion).mockResolvedValue(undefined);
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus({ lifecycleState: 'Draft' }));

    await act(async () => result.current.triggerRestoreVersion('version_1'));

    expect(courseDraftService.restoreVersion).toHaveBeenCalledWith('course_1', 'version_1');
    expect(result.current.state).toBe('draft');
  });

  it('triggerRestoreVersion surfaces a failure via the toast', async () => {
    const { result } = renderHook(() => useCourseLifecycle('course_1'));
    vi.mocked(courseDraftService.restoreVersion).mockRejectedValue(new courseDraftService.CourseDraftError('Restore failed.'));

    await act(async () => result.current.triggerRestoreVersion('version_1'));

    expect(mockShowToast).toHaveBeenCalledWith({ message: 'Restore failed.', variant: 'error' });
  });

  it('the courseId-change reset also clears versions back to null', async () => {
    vi.mocked(courseDraftService.getVersions).mockResolvedValue([makeVersion()]);
    const { result, rerender } = renderHook(({ courseId }) => useCourseLifecycle(courseId), { initialProps: { courseId: 'course_1' } });
    await act(async () => result.current.fetchVersions());
    expect(result.current.versions).not.toBeNull();

    rerender({ courseId: 'course_2' });

    expect(result.current.versions).toBeNull();
  });
});
