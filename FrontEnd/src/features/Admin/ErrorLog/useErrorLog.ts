import { useEffect, useState } from 'react';
import * as errorsService from '../../../services/errorsService';

export const PAGE_SIZE = 25;

const DEFAULT_FILTERS: errorsService.ErrorListFilters = { includeArchived: false };

interface UseErrorLogResult {
  data: errorsService.ErrorRecordSummaryDto[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  filters: errorsService.ErrorListFilters;
  setFilters: (filters: errorsService.ErrorListFilters) => void;
  page: number;
  setPage: (page: number) => void;
}

// Feature-local hook (AD-2). Story 4.5: this app's first server-side-paginated list -- unlike
// TagManagement.tsx's client-side-filtered pattern (explicitly the wrong shape to copy here per
// the story's own Dev Notes), filters/page are server-side query parameters that trigger a fresh
// fetch, same useEffect-keyed-on-inputs + cancelled-guard shape as useAiUsage.ts.
export const useErrorLog = (): UseErrorLogResult => {
  const [filters, setFiltersState] = useState<errorsService.ErrorListFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<errorsService.ErrorRecordSummaryDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    errorsService
      .getErrorList(filters, page, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setData(result.items);
        setTotalCount(result.totalCount);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load the error log.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, page]);

  // A filter change resets to page 1 -- a stale page number from a wider result set could
  // silently land past the end of a narrower filtered one.
  const setFilters = (next: errorsService.ErrorListFilters) => {
    setFiltersState(next);
    setPage(1);
  };

  return { data, totalCount, isLoading, error, filters, setFilters, page, setPage };
};
