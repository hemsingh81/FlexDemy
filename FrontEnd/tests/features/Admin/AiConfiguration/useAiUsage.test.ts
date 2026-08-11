import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { AI_TASK_IDS } from '@/src/features/Admin/AiConfiguration/useAiTaskConfig';
import { aggregateUsageByTask, useAiUsage } from '@/src/features/Admin/AiConfiguration/useAiUsage';
import * as aiUsageService from '@/src/services/aiUsageService';
import { AiUsageError } from '@/src/services/aiUsageService';

vi.mock('@/src/services/aiUsageService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/aiUsageService')>('@/src/services/aiUsageService');
  return { ...actual, getUsage: vi.fn() };
});

const makeEntry = (taskId: string, overrides: Partial<aiUsageService.AiUsageEntryDto> = {}): aiUsageService.AiUsageEntryDto => ({
  taskId,
  date: '2026-08-01',
  cost: 1.5,
  isFallbackServed: false,
  ...overrides,
});

describe('useAiUsage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fetches on mount for the default "last30" range', async () => {
    vi.mocked(aiUsageService.getUsage).mockResolvedValue([makeEntry('explainTopic')]);

    const { result } = renderHook(() => useAiUsage());

    expect(result.current.dateRange).toBe('last30');
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(aiUsageService.getUsage).toHaveBeenCalledWith('last30');
    expect(result.current.data).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('a failed fetch populates error and leaves data empty', async () => {
    vi.mocked(aiUsageService.getUsage).mockRejectedValue(new AiUsageError('Could not reach the server. Please try again.'));

    const { result } = renderHook(() => useAiUsage());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Could not reach the server. Please try again.');
    expect(result.current.data).toEqual([]);
  });

  it('setDateRange triggers a fresh fetch with the new range and replaces data', async () => {
    vi.mocked(aiUsageService.getUsage).mockResolvedValue([makeEntry('explainTopic')]);

    const { result } = renderHook(() => useAiUsage());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.mocked(aiUsageService.getUsage).mockResolvedValue([makeEntry('defineKeyword'), makeEntry('embeddings')]);

    act(() => {
      result.current.setDateRange('last7');
    });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(aiUsageService.getUsage).toHaveBeenLastCalledWith('last7');
    expect(result.current.data).toHaveLength(2);
  });

  it('a response containing an unrecognized taskId is filtered out instead of crashing or being cast unsafely', async () => {
    vi.mocked(aiUsageService.getUsage).mockResolvedValue([makeEntry('explainTopic'), makeEntry('someFutureTask')]);

    const { result } = renderHook(() => useAiUsage());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data.some((row) => (row.taskId as string) === 'someFutureTask')).toBe(false);
  });

  describe('aggregateUsageByTask', () => {
    it('returns one row per AI Task, in the documented order, even for tasks with zero usage in range', () => {
      const rows = aggregateUsageByTask([]);

      expect(rows.map((row) => row.taskId)).toEqual(AI_TASK_IDS);
      rows.forEach((row) => {
        expect(row.cost).toBe(0);
        expect(row.count).toBe(0);
        expect(row.hasFallbackServed).toBe(false);
      });
    });

    it('sums cost and count per task, and flags a task with any fallback-served entry', () => {
      const rows = aggregateUsageByTask([
        { taskId: 'extractStructure', date: '2026-01-01', cost: 1.5, isFallbackServed: false },
        { taskId: 'extractStructure', date: '2026-01-02', cost: 2.5, isFallbackServed: false },
        { taskId: 'describeNotation', date: '2026-01-01', cost: 0.9, isFallbackServed: true },
      ]);

      const extractStructure = rows.find((row) => row.taskId === 'extractStructure');
      expect(extractStructure?.cost).toBe(4);
      expect(extractStructure?.count).toBe(2);
      expect(extractStructure?.hasFallbackServed).toBe(false);

      const describeNotation = rows.find((row) => row.taskId === 'describeNotation');
      expect(describeNotation?.hasFallbackServed).toBe(true);
    });
  });
});
