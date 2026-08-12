import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFileUpload, FILE_POLL_INTERVAL_MS } from '@/src/features/CourseContentEditor/useFileUpload';
import * as courseFileService from '@/src/services/courseFileService';
import type { CourseFileDto } from '@/src/services/courseFileService';

vi.mock('@/src/services/courseFileService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseFileService')>('@/src/services/courseFileService');
  return { ...actual, uploadFile: vi.fn(), getFiles: vi.fn() };
});

const makeFile = (name: string) => new File(['content'], name, { type: 'application/pdf' });

const makeDto = (overrides: Partial<CourseFileDto> = {}): CourseFileDto => ({
  id: 'file_1',
  fileName: 'a.pdf',
  contentType: 'application/pdf',
  sizeBytes: 7,
  status: 'Queued',
  failureReason: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  // useFileUpload now fetches existing files on mount/courseId change, so every test's initial
  // render calls getFiles at least once -- default to an empty history so a test that doesn't
  // care about it isn't affected by a resolved value left over from clearAllMocks() (which
  // clears call history but not a previously-set mockResolvedValue).
  vi.mocked(courseFileService.getFiles).mockResolvedValue([]);
});

describe('useFileUpload', () => {
  it('addFiles starts a file at "queued", then adopts the server id/status once the upload resolves', async () => {
    vi.mocked(courseFileService.uploadFile).mockResolvedValue(makeDto());
    const { result } = renderHook(() => useFileUpload('draft_1'));

    act(() => result.current.addFiles([makeFile('a.pdf')]));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].status).toBe('queued');

    await waitFor(() => expect(result.current.data[0].id).toBe('file_1'));
    expect(courseFileService.uploadFile).toHaveBeenCalledWith('draft_1', expect.any(File));
  });

  it('a rejected upload marks that entry failed with the server reason, without touching other files', async () => {
    vi.mocked(courseFileService.uploadFile).mockImplementation((_, file) =>
      file.name === 'bad.pdf'
        ? Promise.reject(new courseFileService.CourseFileError('Unsupported file type.'))
        : Promise.resolve(makeDto({ id: 'file_good', fileName: file.name }))
    );
    const { result } = renderHook(() => useFileUpload('draft_1'));

    act(() => result.current.addFiles([makeFile('bad.pdf'), makeFile('good.pdf')]));

    await waitFor(() => expect(result.current.data.find((f) => f.name === 'bad.pdf')?.status).toBe('failed'));
    expect(result.current.data.find((f) => f.name === 'bad.pdf')?.failureReason).toBe('Unsupported file type.');
    expect(result.current.data.find((f) => f.name === 'good.pdf')?.status).toBe('queued');
    await waitFor(() => expect(result.current.data.find((f) => f.name === 'good.pdf')?.id).toBe('file_good'));
  });

  it('fetches existing files on mount, merging them ahead of any locally-added ones', async () => {
    vi.mocked(courseFileService.getFiles).mockResolvedValue([makeDto({ id: 'file_existing', fileName: 'prior-session.pdf', status: 'Done' })]);
    const { result } = renderHook(() => useFileUpload('draft_1'));

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data[0]).toMatchObject({ id: 'file_existing', name: 'prior-session.pdf', status: 'done' });
  });

  it('polls getFiles while a file is non-terminal and reconciles a later failed status', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(courseFileService.uploadFile).mockResolvedValue(makeDto());
    const { result } = renderHook(() => useFileUpload('draft_1'));

    await act(async () => {
      result.current.addFiles([makeFile('a.pdf')]);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data[0].id).toBe('file_1');

    // The poll's own response, distinct from whatever mount fetched -- set only now so it's
    // unambiguous this is exercising the interval poll, not the mount-time fetch.
    vi.mocked(courseFileService.getFiles).mockResolvedValue([makeDto({ status: 'Failed', failureReason: 'Malware detected: Eicar-Test-Signature' })]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FILE_POLL_INTERVAL_MS);
    });

    expect(courseFileService.getFiles).toHaveBeenCalledWith('draft_1');
    expect(result.current.data[0].status).toBe('failed');
    expect(result.current.data[0].failureReason).toBe('Malware detected: Eicar-Test-Signature');

    vi.useRealTimers();
  });

  it('stops polling once every file has reached a terminal status', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(courseFileService.uploadFile).mockResolvedValue(makeDto({ status: 'Done' }));
    const { result } = renderHook(() => useFileUpload('draft_1'));

    await act(async () => {
      result.current.addFiles([makeFile('a.pdf')]);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data[0].status).toBe('done');

    vi.mocked(courseFileService.getFiles).mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FILE_POLL_INTERVAL_MS * 3);
    });

    expect(courseFileService.getFiles).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('retryFile re-uploads the retained File object and replaces the failed entry', async () => {
    vi.mocked(courseFileService.uploadFile).mockRejectedValueOnce(new courseFileService.CourseFileError('Unsupported file type.'));
    const { result } = renderHook(() => useFileUpload('draft_1'));

    act(() => result.current.addFiles([makeFile('a.pdf')]));
    await waitFor(() => expect(result.current.data[0].status).toBe('failed'));
    const failedId = result.current.data[0].id;

    vi.mocked(courseFileService.uploadFile).mockResolvedValueOnce(makeDto({ id: 'file_retried' }));
    act(() => result.current.retryFile(failedId));

    expect(result.current.data[0].status).toBe('queued');
    await waitFor(() => expect(result.current.data[0].id).toBe('file_retried'));
    expect(courseFileService.uploadFile).toHaveBeenLastCalledWith('draft_1', expect.objectContaining({ name: 'a.pdf' }));
  });

  it('a poll tick that lands while a retry is in flight does not overwrite the optimistic "queued" state with a stale "failed" one', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(courseFileService.uploadFile).mockRejectedValueOnce(new courseFileService.CourseFileError('Unsupported file type.'));
    const { result } = renderHook(() => useFileUpload('draft_1'));

    await act(async () => {
      result.current.addFiles([makeFile('a.pdf')]);
      await vi.advanceTimersByTimeAsync(0);
    });
    const failedId = result.current.data[0].id;
    expect(result.current.data[0].status).toBe('failed');

    // getFiles still reports the old, now-superseded row as Failed -- reconciliation must not
    // apply this to the in-flight retry's optimistic "queued" entry.
    vi.mocked(courseFileService.getFiles).mockResolvedValue([makeDto({ id: failedId, status: 'Failed', failureReason: 'Unsupported file type.' })]);
    // Retry never resolves during this test -- isolates the in-flight window.
    vi.mocked(courseFileService.uploadFile).mockImplementationOnce(() => new Promise(() => undefined));
    act(() => result.current.retryFile(failedId));
    expect(result.current.data[0].status).toBe('queued');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FILE_POLL_INTERVAL_MS);
    });

    expect(result.current.data[0].status).toBe('queued');

    vi.useRealTimers();
  });

  it('retryFile is a no-op for a file that is not failed', async () => {
    vi.mocked(courseFileService.uploadFile).mockResolvedValue(makeDto());
    const { result } = renderHook(() => useFileUpload('draft_1'));

    act(() => result.current.addFiles([makeFile('a.pdf')]));
    await waitFor(() => expect(result.current.data[0].id).toBe('file_1'));
    vi.mocked(courseFileService.uploadFile).mockClear();

    act(() => result.current.retryFile('file_1'));

    expect(courseFileService.uploadFile).not.toHaveBeenCalled();
  });

  it('addFiles sets an error and does not call uploadFile when there is no courseId yet', () => {
    const { result } = renderHook(() => useFileUpload(null));

    act(() => result.current.addFiles([makeFile('a.pdf')]));

    expect(result.current.error).toBe('Your course draft has not been saved yet. Please try again.');
    expect(courseFileService.uploadFile).not.toHaveBeenCalled();
  });

  it('resetFiles clears the list and cancels the poll', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(courseFileService.uploadFile).mockResolvedValue(makeDto());
    const { result } = renderHook(() => useFileUpload('draft_1'));

    await act(async () => {
      result.current.addFiles([makeFile('a.pdf')]);
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => result.current.resetFiles());
    expect(result.current.data).toEqual([]);

    vi.mocked(courseFileService.getFiles).mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FILE_POLL_INTERVAL_MS * 2);
    });
    expect(courseFileService.getFiles).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
