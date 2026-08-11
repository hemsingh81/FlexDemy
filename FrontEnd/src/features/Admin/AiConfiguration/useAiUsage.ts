import { useEffect, useState } from 'react';
import * as aiUsageService from '../../../services/aiUsageService';
import { AI_TASK_IDS, type AiTaskId } from './useAiTaskConfig';

export type UsageDateRange = 'last7' | 'last30' | 'all';

export interface AiUsageEntry {
  taskId: AiTaskId;
  date: string; // ISO yyyy-mm-dd
  cost: number;
  isFallbackServed: boolean;
}

export interface AiUsageByTask {
  taskId: AiTaskId;
  cost: number;
  count: number;
  hasFallbackServed: boolean;
}

// Selector reused by both AiUsageSummary.tsx and AiUsageChart.tsx -- one aggregation
// implementation, one rounding rule, so the two views can't independently drift on how they
// compute the same numbers (each still calls this fresh per render; it's a shared function, not
// a shared memoized result). Always returns all 7 AI Tasks (iterating AI_TASK_IDS as the base,
// not the entries present in `data`), so a task with zero usage in the selected range still
// shows up as a real 0, not a silent omission.
export const aggregateUsageByTask = (data: AiUsageEntry[]): AiUsageByTask[] =>
  AI_TASK_IDS.map((taskId) => {
    const entries = data.filter((entry) => entry.taskId === taskId);
    const cost = Math.round(entries.reduce((sum, entry) => sum + entry.cost, 0) * 100) / 100;
    return {
      taskId,
      cost,
      count: entries.length,
      hasFallbackServed: entries.some((entry) => entry.isFallbackServed),
    };
  });

const isKnownTaskId = (taskId: string): taskId is AiTaskId => (AI_TASK_IDS as string[]).includes(taskId);

// Validates taskId against the closed AiTaskId union before casting -- same defensive pattern as
// useAiTaskConfig.ts's toAiTaskConfig (Story 1.5 review finding), applied here too since this
// hook now reads from the same kind of loosely-typed real API response.
const toAiUsageEntry = (dto: aiUsageService.AiUsageEntryDto): AiUsageEntry | null => {
  if (!isKnownTaskId(dto.taskId)) {
    // eslint-disable-next-line no-console
    console.warn(`useAiUsage: ignoring unrecognized AI Task id "${dto.taskId}" from the server.`);
    return null;
  }
  return { ...dto, taskId: dto.taskId };
};

interface UseAiUsageResult {
  data: AiUsageEntry[];
  isLoading: boolean;
  error: string | null;
  dateRange: UsageDateRange;
  setDateRange: (range: UsageDateRange) => void;
}

// Feature-local hook (AD-2). Story 1.7 live-wire: reads the real ai-usage endpoint instead of
// Story 1.2's mock dataset, behind the exact same { data, isLoading, error, dateRange,
// setDateRange } shape, so AiConfiguration.tsx never needs to change its own shape (only wire the
// now-real isLoading/error into the UI). Unlike useAiTaskConfig.ts's mount-only fetch, this
// effect also re-runs whenever dateRange changes, since the range is now a server-side query
// parameter (AC #4) instead of a client-side filter over an in-memory mock array.
export const useAiUsage = (): UseAiUsageResult => {
  const [dateRange, setDateRange] = useState<UsageDateRange>('last30');
  const [data, setData] = useState<AiUsageEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    aiUsageService
      .getUsage(dateRange)
      .then((dtos) => {
        if (cancelled) return;
        setData(dtos.map(toAiUsageEntry).filter((row): row is AiUsageEntry => row !== null));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load AI usage data.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateRange]);

  return { data, isLoading, error, dateRange, setDateRange };
};
