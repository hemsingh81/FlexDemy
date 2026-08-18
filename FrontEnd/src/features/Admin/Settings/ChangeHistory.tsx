import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Alert } from '../../../ui/Alert';
import { formatDate } from './utils';
import type { SettingChangeHistoryDto } from '../../../services/settingsService';

// Story 6.3, reworked for the composer: ONE history list covering both the Font and FontSize
// Settings, merged newest-first, rather than a separate panel per Setting. The composer changes
// both together, so splitting their histories would force an admin to cross-reference two lists to
// reconstruct a single save.
//
// Restore stages the value into the composer's dropdown rather than applying it on the spot: the
// composer's whole contract is "choose both, preview, then save", and a restore that wrote straight
// through would bypass the preview and could half-apply a pair.
export const ChangeHistory: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  history: SettingChangeHistoryDto[] | null;
  isLoading: boolean;
  error: string | null;
  // A history entry is restorable only if its newValue is still curated. Client-side courtesy so
  // the rejection isn't discovered only after saving; the backend enforces it regardless.
  isRestorable: (entry: SettingChangeHistoryDto) => boolean;
  onRestore: (entry: SettingChangeHistoryDto) => void;
  // Human-facing name for a stored slug, so history reads "Fraunces + Outfit", not "default".
  describeValue: (entry: SettingChangeHistoryDto, value: string) => string;
}> = ({ isOpen, onToggle, history, isLoading, error, isRestorable, onRestore, describeValue }) => (
  <div>
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className="flex items-center gap-1 text-[11px] font-bold text-[#143358] hover:underline cursor-pointer"
    >
      <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      {isOpen ? 'Hide history' : 'View history'}
    </button>

    {isOpen && (
      <div className="mt-2 space-y-1.5 max-h-72 overflow-y-auto animate-[fade-in-scale_150ms_ease-out]" aria-label="Version history">
        {isLoading && <p className="text-xs text-[#5E6A79]">Loading…</p>}
        {!isLoading && error && <Alert>{error}</Alert>}
        {!isLoading && !error && history?.length === 0 && <p className="text-xs text-[#5E6A79]">No changes yet.</p>}
        {!isLoading &&
          history?.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[#FAF7EC] border border-[#E1DED4] text-xs"
            >
              <span className="text-[#142030] min-w-0">
                <span className="truncate block">
                  <span className="text-[10px] font-bold text-[#5E6A79] uppercase tracking-wide mr-1.5">
                    {entry.keyType === 'FontSize' ? 'Size' : 'Font'}
                  </span>
                  {describeValue(entry, entry.oldValue)} → {describeValue(entry, entry.newValue)}
                </span>
                <span className="text-[#5E6A79]">
                  {formatDate(entry.changedAt)}
                  {entry.changedBy ? ` by ${entry.changedBy}` : ''}
                </span>
              </span>
              {isRestorable(entry) ? (
                <button
                  type="button"
                  onClick={() => onRestore(entry)}
                  className="text-[11px] font-bold text-[#143358] underline cursor-pointer shrink-0"
                >
                  Restore
                </button>
              ) : (
                <span className="text-[10px] text-[#5E6A79] shrink-0 italic">No longer curated</span>
              )}
            </div>
          ))}
      </div>
    )}
  </div>
);
