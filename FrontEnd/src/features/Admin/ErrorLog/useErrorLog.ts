import { useState } from 'react';
import * as errorsService from '../../../services/errorsService';
import { useAsync } from '../../../hooks/useAsync';

export const PAGE_SIZE = 25;

const DEFAULT_FILTERS: errorsService.ErrorListFilters = { includeArchived: false };

interface ErrorLogPage {
  items: errorsService.ErrorRecordSummaryDto[];
  totalCount: number;
}

const EMPTY_PAGE: ErrorLogPage = { items: [], totalCount: 0 };

interface UseErrorLogResult {
  data: errorsService.ErrorRecordSummaryDto[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  filters: errorsService.ErrorListFilters;
  setFilters: (filters: errorsService.ErrorListFilters) => void;
  page: number;
  setPage: (page: number) => void;
  // Re-runs the current filters/page fetch in place -- e.g. after the detail side panel's
  // Archive/Resolve/Increase Priority actions change a record this list is already showing.
  refetch: () => void;
}

// Feature-local hook (AD-2). Story 4.5: this app's first server-side-paginated list -- unlike
// TagManagement.tsx's client-side-filtered pattern (explicitly the wrong shape to copy here per
// the story's own Dev Notes), filters/page are server-side query parameters that trigger a fresh
// fetch, same useEffect-keyed-on-inputs + cancelled-guard shape (via hooks/useAsync.ts) as
// useAiUsage.ts.
export const useErrorLog = (): UseErrorLogResult => {
  const [filters, setFiltersState] = useState<errorsService.ErrorListFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  // Bumped by refetch() to force useAsync's effect to re-run even though filters/page haven't
  // changed -- useAsync only re-fetches on a deps change, and a lifecycle action taken in the
  // detail panel doesn't touch either of those.
  const [refreshToken, setRefreshToken] = useState(0);

  const { data: pageResult, isLoading, error } = useAsync<ErrorLogPage>(
    () => errorsService.getErrorList(filters, page, PAGE_SIZE),
    EMPTY_PAGE,
    [filters, page, refreshToken],
    (err) => (err instanceof Error ? err.message : 'Could not load the error log.')
  );

  // A filter change resets to page 1 -- a stale page number from a wider result set could
  // silently land past the end of a narrower filtered one.
  const setFilters = (next: errorsService.ErrorListFilters) => {
    setFiltersState(next);
    setPage(1);
  };

  const refetch = () => setRefreshToken((token) => token + 1);

  return { data: pageResult.items, totalCount: pageResult.totalCount, isLoading, error, filters, setFilters, page, setPage, refetch };
};
