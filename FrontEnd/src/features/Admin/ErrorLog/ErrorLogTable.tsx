import React from 'react';
import type { ErrorRecordSummaryDto } from '../../../services/errorsService';
import { PRIORITY_BADGE_CLASSES, STATUS_BADGE_CLASSES, humanizeEnumValue } from './errorLogConstants';

interface ErrorLogTableProps {
  rows: ErrorRecordSummaryDto[];
  onRowClick: (id: string) => void;
}

// AC #2's exact field list. Priority/Status get color-coded pill badges, reusing
// AdminUserStatusList.tsx's exact pill CSS shape (rounded-full/text-[10px]/font-bold) --
// visual/CSS reuse only, not a shared component extraction (Dev Notes) -- with colors picked per
// Priority/Status rather than that component's binary active/inactive scheme.
export const ErrorLogTable: React.FC<ErrorLogTableProps> = ({ rows, onRowClick }) => {
  if (rows.length === 0) {
    return <div className="py-12 text-center text-sm text-[#5E6A79]">No errors match the current filters.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-[#5E6A79] bg-[#F3F0E6]">
            <th className="px-4 py-2">Category</th>
            <th className="px-4 py-2">Priority</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Message</th>
            <th className="px-4 py-2">Source</th>
            <th className="px-4 py-2">Occurrences</th>
            <th className="px-4 py-2">Last Occurred</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick(row.id)}
              className="border-t border-[#E1DED4] hover:bg-[#FAF7EC] cursor-pointer transition-colors"
            >
              <td className="px-4 py-2.5 text-[#142030]">{humanizeEnumValue(row.category)}</td>
              <td className="px-4 py-2.5">
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${PRIORITY_BADGE_CLASSES[row.priority] ?? 'bg-slate-100 text-slate-600'}`}
                >
                  {row.priority}
                </span>
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${STATUS_BADGE_CLASSES[row.status] ?? 'bg-slate-100 text-slate-600'}`}
                >
                  {row.status}
                </span>
              </td>
              <td className="px-4 py-2.5 text-[#142030] max-w-md truncate" title={row.message}>
                {row.message}
              </td>
              <td className="px-4 py-2.5 text-[#5E6A79]">{row.source}</td>
              <td className="px-4 py-2.5 text-[#5E6A79]">{row.occurrenceCount}</td>
              <td className="px-4 py-2.5 text-[#5E6A79]">{new Date(row.lastOccurredAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
