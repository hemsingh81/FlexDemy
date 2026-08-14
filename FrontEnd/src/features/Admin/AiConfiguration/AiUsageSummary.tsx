import React from 'react';
import { DollarSign, Hash, TrendingUp } from 'lucide-react';
import { type AiUsageByTask } from './useAiUsage';
import { TASK_LABELS } from './AiTaskConfigRow';

interface AiUsageSummaryProps {
  // Pre-aggregated by the parent (AiConfiguration.tsx), via aggregateUsageByTask(usageData) --
  // computed once and shared with AiUsageChart.tsx, rather than each of them independently
  // re-running the same aggregation over the same raw data on every render. Always covers all 7
  // tasks, even ones with zero usage in the selected range, so "broken down by AI Task" (AC #2)
  // is never silently missing a row.
  usageByTask: AiUsageByTask[];
}

// Stat-card shell copied exactly from StudentDashboardView.tsx's hero row (~line 175-203) --
// not reinvented for this screen.
const statCardClassName = 'p-5 rounded-2xl bg-white border border-[#E1DED4] shadow-xs flex items-center space-x-4';
const iconWellClassName = (accentClass: string) => `p-3 rounded-xl border ${accentClass}`;

export const AiUsageSummary: React.FC<AiUsageSummaryProps> = ({ usageByTask: byTask }) => {
  const totalCost = byTask.reduce((sum, row) => sum + row.cost, 0);
  const totalGenerations = byTask.reduce((sum, row) => sum + row.count, 0);

  // Deterministic tie-break (taskId alphabetical) when two tasks have equal cost in range --
  // every row is a real AI_TASK_IDS member, so topTask is always defined, no fallback needed.
  const topTask = [...byTask].sort((a, b) => b.cost - a.cost || a.taskId.localeCompare(b.taskId))[0];
  // Guards against labeling a $0 task "Most Expensive" when nothing was spent in range at all --
  // unreachable with today's mock data (every task has an entry within 7 days) but a real
  // possibility once Story 1.7 wires a real endpoint and an empty period occurs.
  const hasAnyUsage = totalCost > 0 || totalGenerations > 0;

  const fallbackTasks = byTask.filter((row) => row.hasFallbackServed);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={statCardClassName}>
          <div className={iconWellClassName('bg-[#BA5012]/10 text-[#BA5012] border-[#BA5012]/20')}>
            <DollarSign className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs text-[#5E6A79] font-medium">Total Cost (range)</p>
            <p data-testid="ai-usage-stat-total-cost" className="text-2xl font-bold font-display text-[#142030]">
              ${totalCost.toFixed(1)}
            </p>
          </div>
        </div>

        <div className={statCardClassName}>
          <div className={iconWellClassName('bg-[#143358]/10 text-[#143358] border-[#143358]/20')}>
            <Hash className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs text-[#5E6A79] font-medium">Generations (range)</p>
            <p data-testid="ai-usage-stat-total-generations" className="text-2xl font-bold font-display text-[#142030]">
              {totalGenerations}
            </p>
          </div>
        </div>

        <div className={statCardClassName}>
          <div className={iconWellClassName('bg-purple-50 text-purple-700 border-purple-200')}>
            <TrendingUp className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs text-[#5E6A79] font-medium">Most Expensive Task</p>
            <p data-testid="ai-usage-stat-top-task" className="text-lg font-bold font-display text-[#142030]">
              {hasAnyUsage ? TASK_LABELS[topTask.taskId] : 'No usage in this range'}
            </p>
          </div>
        </div>
      </div>

      {fallbackTasks.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-live="polite">
          {fallbackTasks.map((row) => (
            <span
              key={row.taskId}
              data-testid={`ai-usage-fallback-badge-${row.taskId}`}
              className="rounded-full text-[11px] font-bold px-3 py-1 bg-[#D97706]/10 text-[#142030] border border-[#D97706]/30"
            >
              Fallback-served: {TASK_LABELS[row.taskId]}
            </span>
          ))}
        </div>
      )}

      {/* Per-task breakdown (AC #2: cost *and* usage/count broken down per task, all 7 shown
          even at zero). Compact list rather than a second chart -- the chart above already
          visualizes cost per task; this adds the count dimension the chart doesn't carry. */}
      <div className="space-y-1.5">
        {byTask.map((row) => (
          <div
            key={row.taskId}
            data-testid={`ai-usage-per-task-row-${row.taskId}`}
            className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-[#FAF7EC] border border-[#E1DED4]"
          >
            <span className="font-medium text-[#142030]">{TASK_LABELS[row.taskId]}</span>
            <span className="text-[#5E6A79]">
              {row.count} generation{row.count === 1 ? '' : 's'} · ${row.cost.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
