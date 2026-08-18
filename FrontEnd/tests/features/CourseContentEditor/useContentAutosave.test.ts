import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useContentAutosave } from '@/src/features/CourseContentEditor/useContentAutosave';

describe('useContentAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces scheduleSave -- rapid consecutive calls trigger only one save, after the debounce window', async () => {
    const onSync = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useContentAutosave(onSync));

    act(() => {
      result.current.scheduleSave();
      result.current.scheduleSave();
      result.current.scheduleSave();
    });
    expect(onSync).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it('flushNow saves immediately, bypassing the debounce window entirely', async () => {
    const onSync = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useContentAutosave(onSync));

    result.current.scheduleSave();
    await act(async () => {
      await result.current.flushNow();
    });

    expect(onSync).toHaveBeenCalledTimes(1);
    // The debounced timer scheduleSave() started must not ALSO fire a second, redundant save.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it('reports saving then saved on a successful sync, resetting to idle after a short delay', async () => {
    const onSync = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useContentAutosave(onSync));

    expect(result.current.status).toBe('idle');
    const flushPromise = act(async () => {
      await result.current.flushNow();
    });
    await flushPromise;

    expect(result.current.status).toBe('saved');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.status).toBe('idle');
  });

  it('a failed save reports the retryable failed state -- retrying via flushNow again can still succeed', async () => {
    const onSync = vi.fn().mockRejectedValueOnce(new Error('network error')).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useContentAutosave(onSync));

    await act(async () => {
      await result.current.flushNow();
    });
    expect(result.current.status).toBe('failed');

    await act(async () => {
      await result.current.flushNow();
    });
    expect(result.current.status).toBe('saved');
    expect(onSync).toHaveBeenCalledTimes(2);
  });

  it('a slower in-flight save does not clobber the status of a faster, more recent one', async () => {
    let resolveFirst!: () => void;
    const onSync = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useContentAutosave(onSync));

    // First save starts (slow), then a second flush starts and resolves before the first does.
    const firstFlush = result.current.flushNow();
    await act(async () => {
      await result.current.flushNow();
    });
    expect(result.current.status).toBe('saved');

    // The slow first save finally resolves -- must not stomp the already-"saved" status back to
    // "saving"/"saved" out of order.
    await act(async () => {
      resolveFirst();
      await firstFlush;
    });
    expect(result.current.status).toBe('saved');
  });
});
