import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

// Story 4.5: this app's first pagination component (confirmed zero existing precedent). Simple
// prev/next + page-count display is sufficient for this story's needs -- no jump-to-page input
// unless a later story asks for it. Pure/no domain knowledge, no services/hooks import -- passes
// AD-3's `ui/` test, so it lives here rather than feature-local, ready for a second screen to
// reuse without promotion later.
export const Pagination: React.FC<PaginationProps> = ({ page, pageSize, totalCount, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <span className="text-xs text-[#5E6A79]">
        Page {page} of {totalPages} ({totalCount} total)
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="p-1.5 rounded-lg border border-[#E1DED4] text-[#5E6A79] hover:bg-[#F3F0E6] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="p-1.5 rounded-lg border border-[#E1DED4] text-[#5E6A79] hover:bg-[#F3F0E6] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
