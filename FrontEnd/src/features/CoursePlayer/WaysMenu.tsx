import React, { useState } from 'react';
import { PenLine } from 'lucide-react';
import { useWays } from './useWays';
import { ExampleCard } from './ExampleCard';

interface WaysMenuProps {
  courseId: string;
  nodeId: string;
}

// Story 3.2/Task 3: small pill/tray, secondary visual weight relative to Drill-Down's
// "Explain more" (UX-DR11) -- deliberately not a peer button or a full panel. Matches
// mockups/key-course-player-adaptive.html's `.ways-tray`/`.way-pill` structure and the
// `ways-menu` DESIGN.md token (background #ffffff, border 1px solid #E1DED4, rounded 0.75rem).
export const WaysMenu: React.FC<WaysMenuProps> = ({ courseId, nodeId }) => {
  const { ways, isLoading, activeWayIndex, setActiveWayIndex } = useWays(courseId, nodeId);
  const [expandedExampleId, setExpandedExampleId] = useState<string | null>(null);

  const activeWay = ways[activeWayIndex] ?? null;

  return (
    <div aria-label="Alternative explanations" className="mt-3 p-4 rounded-xl bg-white border border-[#E1DED4] max-w-lg">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2.5">5 Ways to hear this</p>

      {isLoading && <p className="text-xs text-slate-500">Loading…</p>}

      {!isLoading && ways.length > 0 && (
        <>
          {/* AC#1: each Way is independently focusable, aria-current="true" on the displayed one
              -- following the mockup/AC text literally (aria-current, not aria-selected) even
              though aria-selected would be the more idiomatic pairing for role="tablist"/"tab",
              since Story 3.1's sibling level tabs already establish aria-current as this
              codebase's chosen convention for "the currently displayed one of several options". */}
          <div role="tablist" aria-label="Alternative explanation options" className="flex flex-wrap gap-1.5 mb-3">
            {ways.map((way, index) => {
              const isActive = index === activeWayIndex;
              return (
                <button
                  key={way.example.id}
                  role="tab"
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => setActiveWayIndex(index)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#BA5012] text-white border-[#BA5012]'
                      : 'bg-slate-50 text-slate-500 border-[#E1DED4] hover:bg-slate-100'
                  }`}
                >
                  Way {index + 1}
                </button>
              );
            })}
          </div>

          {activeWay && (
            <div className="space-y-3">
              <div className="text-sm leading-relaxed text-slate-800 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">Way {activeWayIndex + 1}</span>
                  {activeWay.isOverridden && (
                    <span
                      className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#179765]/10 text-[#179765] flex items-center gap-1"
                      aria-label="Tutor-edited"
                    >
                      <PenLine className="w-3 h-3" />
                      Tutor-edited
                    </span>
                  )}
                </div>
                <p>{activeWay.explanation}</p>
              </div>

              <ExampleCard
                example={activeWay.example}
                isExpanded={expandedExampleId === activeWay.example.id}
                onToggle={() =>
                  setExpandedExampleId((prev) => (prev === activeWay.example.id ? null : activeWay.example.id))
                }
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
