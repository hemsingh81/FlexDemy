import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { useErrorLog } from '@/src/features/Admin/ErrorLog/useErrorLog';
import * as errorsService from '@/src/services/errorsService';

vi.mock('@/src/services/errorsService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/errorsService')>('@/src/services/errorsService');
  return { ...actual, getErrorList: vi.fn() };
});

const makeRow = (id: string): errorsService.ErrorRecordSummaryDto => ({
  id,
  category: 'ValidationError',
  priority: 'P2',
  status: 'New',
  message: 'boom',
  source: 'Backend',
  occurrenceCount: 1,
  lastOccurredAt: '2026-08-14T00:00:00Z',
});

const makePagedResult = (items: errorsService.ErrorRecordSummaryDto[], totalCount = items.length) => ({
  items,
  totalCount,
  page: 1,
  pageSize: 25,
});

describe('useErrorLog', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fetches on mount with default filters (includeArchived: false) and page 1', async () => {
    vi.mocked(errorsService.getErrorList).mockResolvedValue(makePagedResult([makeRow('err_1')]));

    const { result } = renderHook(() => useErrorLog());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(errorsService.getErrorList).toHaveBeenCalledWith(expect.objectContaining({ includeArchived: false }), 1, expect.any(Number));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('a failed fetch populates error and leaves data empty', async () => {
    vi.mocked(errorsService.getErrorList).mockRejectedValue(new Error('Something went wrong. Please try again.'));

    const { result } = renderHook(() => useErrorLog());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Something went wrong. Please try again.');
    expect(result.current.data).toEqual([]);
  });

  it('setFilters triggers a fresh fetch and resets page back to 1', async () => {
    vi.mocked(errorsService.getErrorList).mockResolvedValue(makePagedResult([makeRow('err_1')]));
    const { result } = renderHook(() => useErrorLog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setPage(3);
    });
    await waitFor(() => expect(result.current.page).toBe(3));

    vi.mocked(errorsService.getErrorList).mockResolvedValue(makePagedResult([makeRow('err_2')]));
    act(() => {
      result.current.setFilters({ ...result.current.filters, category: 'ValidationError' });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.page).toBe(1);
    expect(errorsService.getErrorList).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: 'ValidationError' }),
      1,
      expect.any(Number)
    );
  });

  it('setPage triggers a fetch for the new page with the same filters', async () => {
    vi.mocked(errorsService.getErrorList).mockResolvedValue(makePagedResult([makeRow('err_1')], 100));
    const { result } = renderHook(() => useErrorLog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setPage(2);
    });

    await waitFor(() => expect(errorsService.getErrorList).toHaveBeenLastCalledWith(expect.anything(), 2, expect.any(Number)));
  });

  it('ignores a stale response that resolves after a newer request has already started', async () => {
    let resolveFirst!: (value: ReturnType<typeof makePagedResult>) => void;
    const firstCall = new Promise<ReturnType<typeof makePagedResult>>((resolve) => {
      resolveFirst = resolve;
    });
    vi.mocked(errorsService.getErrorList).mockReturnValueOnce(firstCall);

    const { result } = renderHook(() => useErrorLog());
    expect(result.current.isLoading).toBe(true);

    vi.mocked(errorsService.getErrorList).mockResolvedValueOnce(makePagedResult([makeRow('err_fresh')]));
    act(() => {
      result.current.setPage(2);
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([makeRow('err_fresh')]);

    // The stale first request finally resolves -- must not clobber the newer result above.
    resolveFirst(makePagedResult([makeRow('err_stale')]));
    await new Promise((r) => setTimeout(r, 0));

    expect(result.current.data).toEqual([makeRow('err_fresh')]);
  });
});
