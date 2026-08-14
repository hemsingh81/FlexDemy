import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCourseLifecycle } from '@/src/features/CourseContentEditor/useCourseLifecycle';
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

// Publish is now a single, immediate, synchronous transition -- no per-node checklist/batch to
// track, so this file no longer exercises a mock setInterval progression, just the plain
// state-machine transitions sourced from mocked HTTP responses.
const makeStatus = (overrides: Partial<PublishStatusDto> = {}): PublishStatusDto => ({
  lifecycleState: 'Draft',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus());
});

describe('useCourseLifecycle', () => {
  it('starts in draft before the initial load resolves', () => {
    const { result } = renderHook(() => useCourseLifecycle('course_1'));

    expect(result.current.state).toBe('draft');
    expect(result.current.isPublishing).toBe(false);
  });

  it('the initial load picks up wherever this course already is, not always draft', async () => {
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus({ lifecycleState: 'ReviewConfirmed' }));

    const { result } = renderHook(() => useCourseLifecycle('course_1'));

    await waitFor(() => expect(result.current.state).toBe('reviewConfirmed'));
    expect(courseDraftService.getPublishStatus).toHaveBeenCalledWith('course_1');
  });

  it('triggerMoveToReview calls moveToReview and transitions draft -> inReview on success', async () => {
    vi.mocked(courseDraftService.moveToReview).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCourseLifecycle('course_1'));

    await act(async () => result.current.triggerMoveToReview());

    expect(courseDraftService.moveToReview).toHaveBeenCalledWith('course_1');
    expect(result.current.state).toBe('inReview');
  });

  it('triggerMoveToReview surfaces a failure via the toast and leaves state unchanged', async () => {
    vi.mocked(courseDraftService.moveToReview).mockRejectedValue(
      new courseDraftService.CourseDraftError('The course has no parsed content yet.')
    );
    const { result } = renderHook(() => useCourseLifecycle('course_1'));

    await act(async () => result.current.triggerMoveToReview());

    expect(result.current.state).toBe('draft');
    expect(mockShowToast).toHaveBeenCalledWith({ message: 'The course has no parsed content yet.', variant: 'error' });
  });

  it('triggerMoveToReview is a no-op unless state is draft', async () => {
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus({ lifecycleState: 'InReview' }));
    const { result } = renderHook(() => useCourseLifecycle('course_1'));
    await waitFor(() => expect(result.current.state).toBe('inReview'));

    await act(async () => result.current.triggerMoveToReview());

    expect(courseDraftService.moveToReview).not.toHaveBeenCalled();
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

  it('triggerPublish calls publishCourse, sets isPublishing while in flight, then re-fetches status', async () => {
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus({ lifecycleState: 'ReviewConfirmed' }));
    const { result } = renderHook(() => useCourseLifecycle('course_1'));
    await waitFor(() => expect(result.current.state).toBe('reviewConfirmed'));

    vi.mocked(courseDraftService.publishCourse).mockResolvedValue(undefined);
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus({ lifecycleState: 'Published' }));

    await act(async () => result.current.triggerPublish());

    expect(courseDraftService.publishCourse).toHaveBeenCalledWith('course_1');
    expect(result.current.state).toBe('published');
    expect(result.current.isPublishing).toBe(false);
  });

  it('triggerPublish is a no-op unless state is reviewConfirmed', async () => {
    const { result } = renderHook(() => useCourseLifecycle('course_1'));

    await act(async () => result.current.triggerPublish());

    expect(courseDraftService.publishCourse).not.toHaveBeenCalled();
  });

  it('every trigger is a no-op while courseId is null', async () => {
    const { result } = renderHook(() => useCourseLifecycle(null));

    await act(async () => {
      result.current.triggerMoveToReview();
      result.current.triggerConfirmReview();
      result.current.triggerPublish();
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
    fileCount: 3,
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
