import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { ErrorListFilters } from '../../../services/errorsService';
import { ToggleSwitch } from '../../../ui/ToggleSwitch';
import { CATEGORY_VALUES, PRIORITY_VALUES, STATUS_VALUES, SOURCE_VALUES, humanizeEnumValue } from './errorLogConstants';

interface ErrorLogFiltersProps {
  filters: ErrorListFilters;
  onChange: (filters: ErrorListFilters) => void;
}

const selectClassName =
  'px-3 py-2 bg-white border border-[#E1DED4] rounded-xl text-sm text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#BA5012]';

// Mirrors TagManagement.tsx's own debounce shape (250ms setTimeout + useEffect) -- typing a
// search term shouldn't fire a server request per keystroke, since every filter change here
// (unlike TagManagement's client-side filter) triggers a real fetch via useErrorLog.
const SEARCH_DEBOUNCE_MS = 250;

// AC #3: Category/Priority/Status/Source/date-range/free-text filters, all ANDed server-side by
// useErrorLog -> errorsService.getErrorList. "Include Archived" defaults off.
export const ErrorLogFilters: React.FC<ErrorLogFiltersProps> = ({ filters, onChange }) => {
  const [searchInput, setSearchInput] = useState(filters.search ?? '');
  // Story 4.7/AC #2: also settable from elsewhere (clicking a Correlation ID in the detail
  // panel updates `filters.correlationId` directly) -- kept in sync via the effect below, same
  // as searchInput's own re-sync needs.
  const [correlationIdInput, setCorrelationIdInput] = useState(filters.correlationId ?? '');

  // Code-review patch: the debounce effect below only depends on [searchInput], so without this
  // ref it would close over whatever `filters` was current when the effect last (re-)ran -- if
  // another filter (Category/Priority/...) changes while the 250ms timer is still pending, the
  // timer would fire with that stale `filters` object and silently revert the other change.
  // Reading the ref at fire time instead always applies the search on top of the latest filters.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const currentFilters = filtersRef.current;
      if (searchInput.trim() !== (currentFilters.search ?? '')) {
        onChange({ ...currentFilters, search: searchInput.trim() || undefined });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const currentFilters = filtersRef.current;
      if (correlationIdInput.trim() !== (currentFilters.correlationId ?? '')) {
        onChange({ ...currentFilters, correlationId: correlationIdInput.trim() || undefined });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correlationIdInput]);

  // Re-syncs the local input when `filters.correlationId` changes from outside this component
  // (e.g. ErrorLog.tsx sets it after a Correlation ID click in the detail panel).
  useEffect(() => {
    setCorrelationIdInput(filters.correlationId ?? '');
  }, [filters.correlationId]);

  const set = <K extends keyof ErrorListFilters>(key: K, value: ErrorListFilters[K]) => onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-wrap items-end gap-3 bg-white p-4 rounded-2xl border border-[#E1DED4] shadow-2xs">
      <div className="flex flex-col gap-1">
        <label htmlFor="error-log-category" className="text-[10px] font-bold text-[#5E6A79] uppercase tracking-wide">
          Category
        </label>
        <select
          id="error-log-category"
          value={filters.category ?? ''}
          onChange={(e) => set('category', e.target.value || undefined)}
          className={selectClassName}
        >
          <option value="">All</option>
          {CATEGORY_VALUES.map((value) => (
            <option key={value} value={value}>
              {humanizeEnumValue(value)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="error-log-priority" className="text-[10px] font-bold text-[#5E6A79] uppercase tracking-wide">
          Priority
        </label>
        <select
          id="error-log-priority"
          value={filters.priority ?? ''}
          onChange={(e) => set('priority', e.target.value || undefined)}
          className={selectClassName}
        >
          <option value="">All</option>
          {PRIORITY_VALUES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="error-log-status" className="text-[10px] font-bold text-[#5E6A79] uppercase tracking-wide">
          Status
        </label>
        <select
          id="error-log-status"
          value={filters.status ?? ''}
          onChange={(e) => set('status', e.target.value || undefined)}
          className={selectClassName}
        >
          <option value="">All</option>
          {STATUS_VALUES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="error-log-source" className="text-[10px] font-bold text-[#5E6A79] uppercase tracking-wide">
          Source
        </label>
        <select
          id="error-log-source"
          value={filters.source ?? ''}
          onChange={(e) => set('source', e.target.value || undefined)}
          className={selectClassName}
        >
          <option value="">All</option>
          {SOURCE_VALUES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="error-log-from-date" className="text-[10px] font-bold text-[#5E6A79] uppercase tracking-wide">
          From
        </label>
        <input
          id="error-log-from-date"
          type="date"
          value={filters.fromDate?.slice(0, 10) ?? ''}
          onChange={(e) => set('fromDate', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
          className={selectClassName}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="error-log-to-date" className="text-[10px] font-bold text-[#5E6A79] uppercase tracking-wide">
          To
        </label>
        <input
          id="error-log-to-date"
          type="date"
          value={filters.toDate?.slice(0, 10) ?? ''}
          // Code-review patch: end-of-day, not start-of-day -- LastOccurredAt <= toDate would
          // otherwise exclude nearly the entire selected day (only records at exactly midnight
          // UTC would survive). FromDate's start-of-day + >= comparison is already correct.
          onChange={(e) => set('toDate', e.target.value ? `${e.target.value}T23:59:59.999Z` : undefined)}
          className={selectClassName}
        />
      </div>

      <div className="flex flex-col gap-1 grow min-w-[180px]">
        <label htmlFor="error-log-search" className="text-[10px] font-bold text-[#5E6A79] uppercase tracking-wide">
          Search
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5E6A79]" />
          <input
            id="error-log-search"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Message or exception type..."
            className={`${selectClassName} w-full pl-9`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1 min-w-[180px]">
        <label htmlFor="error-log-correlation-id" className="text-[10px] font-bold text-[#5E6A79] uppercase tracking-wide">
          Correlation ID
        </label>
        <input
          id="error-log-correlation-id"
          type="text"
          value={correlationIdInput}
          onChange={(e) => setCorrelationIdInput(e.target.value)}
          placeholder="Exact match..."
          className={selectClassName}
        />
      </div>

      <div className="flex items-center gap-2 pb-2">
        <ToggleSwitch
          checked={filters.includeArchived ?? false}
          onChange={(next) => set('includeArchived', next)}
          activeLabel="Archived shown"
          inactiveLabel="Archived hidden"
          ariaLabel="Include archived errors"
        />
      </div>
    </div>
  );
};
