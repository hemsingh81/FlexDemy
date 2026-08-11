import React from 'react';
import type { UsageDateRange } from './useAiUsage';

interface AiUsageDateRangeControlProps {
  value: UsageDateRange;
  onChange: (range: UsageDateRange) => void;
}

const OPTIONS: { value: UsageDateRange; label: string }[] = [
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

export const AiUsageDateRangeControl: React.FC<AiUsageDateRangeControlProps> = ({ value, onChange }) => (
  <div role="group" aria-label="Date range" className="inline-flex rounded-xl border border-[#E1DED4] overflow-hidden">
    {OPTIONS.map((option) => {
      const isActive = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          data-testid={`ai-usage-range-${option.value}`}
          aria-pressed={isActive}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 text-xs font-bold transition-colors ${
            isActive ? 'bg-[#143358] text-white' : 'bg-white text-[#5E6A79] hover:bg-[#FAF7EC]'
          }`}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);
