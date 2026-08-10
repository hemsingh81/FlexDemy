import React, { useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useClickOutside } from '../hooks/useClickOutside';

export interface TypeaheadOption {
  value: string;
  label: string;
}

interface TypeaheadMultiSelectProps {
  options: TypeaheadOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}

// Generic searchable chip multi-select (replaces the old plain checkbox-grid pattern for
// multi-select fields -- e.g. ClassLevel's Subjects in MasterDataManager.tsx). Framework-free
// beyond useClickOutside so it can drop into any form: type to filter, click a result to
// toggle it, selected values render as removable chips in the same field.
export const TypeaheadMultiSelect: React.FC<TypeaheadMultiSelectProps> = ({
  options,
  selected,
  onChange,
  placeholder = 'Search...',
  emptyMessage = 'No options available.',
  disabled = false,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setIsOpen(false), isOpen);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const selectedOptions = useMemo(
    () => selected.map((id) => options.find((o) => o.value === id)).filter((o): o is TypeaheadOption => Boolean(o)),
    [selected, options]
  );

  const toggleValue = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => !disabled && setIsOpen(true)}
        className={`min-h-10 w-full px-2 py-1.5 bg-white border border-[#E1DED4] rounded-xl flex flex-wrap items-center gap-1.5 transition-shadow ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text focus-within:ring-2 focus-within:ring-[#BA5012]'
        }`}
      >
        {selectedOptions.map((opt) => (
          <span
            key={opt.value}
            className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-lg bg-[#FAF7EC] border border-[#BA5012]/30 text-[11px] font-semibold text-[#142030]"
          >
            {opt.label}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleValue(opt.value);
                }}
                aria-label={`Remove ${opt.label}`}
                className="p-0.5 rounded text-[#5E6A79] hover:text-red-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
        <input
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={selectedOptions.length === 0 ? placeholder : ''}
          className="flex-1 min-w-24 outline-none text-xs text-[#142030] bg-transparent py-0.5 disabled:cursor-not-allowed"
        />
      </div>

      <div
        role="listbox"
        aria-multiselectable="true"
        className={`absolute left-0 right-0 mt-1.5 max-h-48 overflow-y-auto bg-white rounded-xl shadow-xl border border-[#E1DED4] py-1 z-20 origin-top transition-all duration-150 ease-out ${
          isOpen && !disabled ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-[#5E6A79]">{options.length === 0 ? emptyMessage : 'No matches.'}</p>
        ) : (
          filtered.map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => toggleValue(opt.value)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                  isSelected ? 'bg-[#FAF7EC] text-[#BA5012] font-semibold' : 'text-[#142030] hover:bg-[#F3F0E6]'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
