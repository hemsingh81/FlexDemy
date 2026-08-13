import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ExampleItem } from '../../types';

interface ExampleCardProps {
  example: ExampleItem;
  isExpanded: boolean;
  onToggle: () => void;
}

// Story 3.2/Task 3: worked-example presentation extracted from DrilldownPanel.tsx (Story 3.1) so
// WaysMenu.tsx can reuse the exact same rendering rather than duplicating the JSX.
export const ExampleCard: React.FC<ExampleCardProps> = ({ example, isExpanded, onToggle }) => (
  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-slate-900">{example.title}</span>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700">
        {example.difficulty}
      </span>
    </div>

    <p className="text-xs text-slate-700 font-medium">Problem: {example.problem}</p>

    <button
      onClick={onToggle}
      className="text-xs font-bold text-[#143358] hover:underline flex items-center space-x-1"
    >
      <span>{isExpanded ? 'Hide Step-by-Step Solution' : 'Show Step-by-Step Solution'}</span>
      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
    </button>

    {isExpanded && (
      <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs space-y-2 shadow-2xs">
        <p className="font-bold text-slate-900">Solution Steps:</p>
        <ul className="space-y-1 text-slate-700 pl-2">
          {example.stepByStepSolution.map((step, idx) => (
            <li key={idx}>• {step}</li>
          ))}
        </ul>
        <div className="pt-2 border-t border-slate-100 text-[#179765] font-bold">Final Answer: {example.finalAnswer}</div>
      </div>
    )}
  </div>
);
