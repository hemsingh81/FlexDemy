import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { aggregateUsageByTask, type AiUsageEntry } from './useAiUsage';
import { TASK_LABELS } from './AiTaskConfigRow';

interface AiUsageChartProps {
  data: AiUsageEntry[];
}

// Same recharts BarChart styling as TutorEducatorHubView.tsx's "Earnings & Teaching Analytics"
// chart (~line 440) -- grid/axis/tooltip colors copied exactly, not reinvented. XAxis rotation
// (angle/textAnchor) is an adaptation the source chart didn't need -- month labels are short,
// task labels ("Drill-Down (explainTopic)") are not, and would overlap unrotated.
export const AiUsageChart: React.FC<AiUsageChartProps> = ({ data }) => {
  // Shared aggregation (also used by AiUsageSummary.tsx) -- always includes all 7 tasks, so a
  // task with zero usage in the selected range still renders as a $0 bar, not a silent gap.
  const chartData = aggregateUsageByTask(data).map((row) => ({
    task: TASK_LABELS[row.taskId],
    cost: row.cost,
  }));

  return (
    <div data-testid="ai-usage-chart" className="h-72 w-full pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E1DED4" />
          <XAxis dataKey="task" tick={{ fontSize: 11, fill: '#5E6A79' }} interval={0} angle={-15} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 12, fill: '#5E6A79' }} />
          <Tooltip contentStyle={{ backgroundColor: '#143358', borderRadius: '12px', color: '#fff', border: 'none' }} />
          <Bar dataKey="cost" fill="#017E9A" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
