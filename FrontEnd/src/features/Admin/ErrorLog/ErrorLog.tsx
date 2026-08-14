import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Spinner } from '../../../ui/Spinner';
import { Pagination } from '../../../ui/Pagination';
import { useErrorLog, PAGE_SIZE } from './useErrorLog';
import { ErrorLogFilters } from './ErrorLogFilters';
import { ErrorLogTable } from './ErrorLogTable';
import { ErrorDetailPanel } from './ErrorDetailPanel';

// Admin -> Error Log sub-tab (ErrorObservability PRD FR-11/FR-12/FR-13/FR-19, Story 4.5). The
// Epic 4 release checkpoint (Dev Notes) -- the first point an admin can see anything Stories
// 4.1-4.4 have been capturing, including Story 4.4's anonymous endpoint's own reports (AC #5).
export const ErrorLog: React.FC = () => {
  const { data, totalCount, isLoading, error, filters, setFilters, page, setPage } = useErrorLog();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Story 4.7/AC #1, #3: filters to exactly the records sharing this trace. useErrorLog's own
  // setFilters already resets to page 1 on any filter change, so no extra handling needed here.
  //
  // Code-review patch: replaces (not spreads) the current filters -- AC #1 requires the resulting
  // view to show only records sharing the exact Correlation ID, and AC #3's own worked example
  // (a scan->parse->extract chain) requires every sibling record to appear together. A chain's
  // stages plausibly differ in Category/Priority/Status, so keeping any prior filter active (as
  // `{ ...filters, correlationId }` previously did) could silently hide trace members that don't
  // also match it. includeArchived is forced true for the same reason -- an Archived member of
  // the trace is still part of "every other error it produced."
  const handleCorrelationIdClick = (correlationId: string) => {
    setFilters({ correlationId, includeArchived: true });
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-[#E1DED4] rounded-2xl p-8 shadow-xs">
        <div className="flex items-center gap-2.5 mb-4">
          <AlertTriangle className="w-5 h-5 text-[#BA5012]" aria-hidden="true" />
          <h3 className="font-serif text-xl font-bold text-[#142030]">Error Log</h3>
        </div>

        <div className="space-y-4">
          <ErrorLogFilters filters={filters} onChange={setFilters} />

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-[#5E6A79]">
              <Spinner size="lg" className="mr-2" />
              <span className="text-sm">Loading errors...</span>
            </div>
          ) : error ? (
            <p role="alert" className="text-xs font-semibold text-red-600">
              {error}
            </p>
          ) : (
            <div className="bg-white border border-[#E1DED4] rounded-2xl overflow-hidden">
              <ErrorLogTable rows={data} onRowClick={setSelectedId} />
            </div>
          )}

          {!isLoading && !error && <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />}
        </div>
      </section>

      {selectedId && (
        <ErrorDetailPanel id={selectedId} onClose={() => setSelectedId(null)} onCorrelationIdClick={handleCorrelationIdClick} />
      )}
    </div>
  );
};
