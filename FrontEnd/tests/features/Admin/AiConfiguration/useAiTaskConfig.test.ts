import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { AI_TASK_IDS, useAiTaskConfig } from '@/src/features/Admin/AiConfiguration/useAiTaskConfig';
import * as aiConfigService from '@/src/services/aiConfigService';
import { AiConfigError } from '@/src/services/aiConfigService';

vi.mock('@/src/services/aiConfigService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/aiConfigService')>('@/src/services/aiConfigService');
  return { ...actual, getAiTaskConfigs: vi.fn(), updateAiTaskConfig: vi.fn() };
});

const makeDto = (taskId: string, overrides: Partial<aiConfigService.AiTaskConfigDto> = {}): aiConfigService.AiTaskConfigDto => ({
  taskId,
  provider: 'Groq',
  model: 'llama-4-scout',
  fallbackProvider: 'OpenRouter',
  fallbackModel: 'gpt-4o-mini',
  budgetThreshold: 50,
  currentSpend: 0,
  ...overrides,
});

const allConfigs = () => AI_TASK_IDS.map((taskId) => makeDto(taskId));

describe('useAiTaskConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fetches all 7 rows on mount, in the documented order', async () => {
    vi.mocked(aiConfigService.getAiTaskConfigs).mockResolvedValue(allConfigs());

    const { result } = renderHook(() => useAiTaskConfig());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.map((row) => row.taskId)).toEqual(AI_TASK_IDS);
    expect(result.current.error).toBeNull();
  });

  it('a failed initial load populates error and leaves data empty', async () => {
    vi.mocked(aiConfigService.getAiTaskConfigs).mockRejectedValue(new AiConfigError('Could not reach the server. Please try again.'));

    const { result } = renderHook(() => useAiTaskConfig());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Could not reach the server. Please try again.');
    expect(result.current.data).toEqual([]);
  });

  it('updateTaskConfig patches only the targeted row from the API response, leaving others untouched', async () => {
    vi.mocked(aiConfigService.getAiTaskConfigs).mockResolvedValue(allConfigs());
    vi.mocked(aiConfigService.updateAiTaskConfig).mockResolvedValue(
      makeDto('explainTopic', { model: 'claude-4-haiku', budgetThreshold: 99 })
    );

    const { result } = renderHook(() => useAiTaskConfig());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const otherRowsBefore = result.current.data.filter((row) => row.taskId !== 'explainTopic');

    await act(async () => {
      await result.current.updateTaskConfig('explainTopic', { model: 'claude-4-haiku', budgetThreshold: 99 });
    });

    const updatedRow = result.current.data.find((row) => row.taskId === 'explainTopic');
    expect(updatedRow?.model).toBe('claude-4-haiku');
    expect(updatedRow?.budgetThreshold).toBe(99);
    const otherRowsAfter = result.current.data.filter((row) => row.taskId !== 'explainTopic');
    expect(otherRowsAfter).toEqual(otherRowsBefore);
  });

  it('a failed updateTaskConfig rejects (so the caller can show a per-row error) without corrupting data', async () => {
    vi.mocked(aiConfigService.getAiTaskConfigs).mockResolvedValue(allConfigs());
    vi.mocked(aiConfigService.updateAiTaskConfig).mockRejectedValue(new AiConfigError('Validation failed.'));

    const { result } = renderHook(() => useAiTaskConfig());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const before = result.current.data;

    await expect(
      act(async () => {
        await result.current.updateTaskConfig('explainTopic', { model: 'claude-4-haiku' });
      })
    ).rejects.toThrow('Validation failed.');

    expect(result.current.data).toEqual(before);
    // A row-scoped save failure must not corrupt the shared page-level error either.
    expect(result.current.error).toBeNull();
  });

  it('a response containing an unrecognized taskId is filtered out instead of crashing or being cast unsafely', async () => {
    vi.mocked(aiConfigService.getAiTaskConfigs).mockResolvedValue([...allConfigs(), makeDto('someFutureTask')]);

    const { result } = renderHook(() => useAiTaskConfig());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toHaveLength(7);
    expect(result.current.data.some((row) => (row.taskId as string) === 'someFutureTask')).toBe(false);
  });

  it('updateTaskConfig throws (instead of silently no-op-ing) for a taskId with no loaded row', async () => {
    vi.mocked(aiConfigService.getAiTaskConfigs).mockResolvedValue(allConfigs());

    const { result } = renderHook(() => useAiTaskConfig());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.updateTaskConfig('notARealTask' as never, { model: 'claude-4-haiku' });
      })
    ).rejects.toThrow(/No loaded config found/);
    expect(aiConfigService.updateAiTaskConfig).not.toHaveBeenCalled();
  });
});
