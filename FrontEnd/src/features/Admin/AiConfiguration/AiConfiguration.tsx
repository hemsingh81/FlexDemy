import React from 'react';
import { BarChart2, Cpu } from 'lucide-react';
import { Spinner } from '../../../ui/Spinner';
import { AiTaskConfigRow } from './AiTaskConfigRow';
import { useAiTaskConfig } from './useAiTaskConfig';
import { useAiUsage } from './useAiUsage';
import { AiUsageSummary } from './AiUsageSummary';
import { AiUsageChart } from './AiUsageChart';
import { AiUsageDateRangeControl } from './AiUsageDateRangeControl';

// Admin -> AI Configuration & Usage sub-tab (New Course Wizard PRD FR-27/FR-28/FR-29). Story 1.1
// owns the config-table section below; Story 1.2 adds the usage/cost-breakdown section beneath
// it in this same component -- both live in one sub-tab, not two (EXPERIENCE.md "AI
// Configuration table" row). Story 1.5/1.7 swap useAiTaskConfig/useAiUsage's internals for real
// backend calls behind the same { data, isLoading, error } shape -- this file's structure
// doesn't need to change. Story 1.7 wires the usage section's now-real isLoading/error, using the
// same Spinner + red-600-message convention RoleVisibilityManager.tsx already established for
// this admin panel -- scoped to just this section, not the whole page, since the config-table
// section above loads independently.
export const AiConfiguration: React.FC = () => {
  const { data: configData, updateTaskConfig } = useAiTaskConfig();
  const { data: usageData, isLoading: isUsageLoading, error: usageError, dateRange, setDateRange } = useAiUsage();

  return (
    <div className="space-y-6">
      <section data-testid="ai-config-table-section" className="bg-white border border-[#E1DED4] rounded-2xl p-8 shadow-xs">
        <div className="flex items-center gap-2.5 mb-4">
          <Cpu className="w-5 h-5 text-[#BA5012]" aria-hidden="true" />
          <h3 className="font-serif text-xl font-bold text-[#142030]">AI Task Configuration</h3>
        </div>
        <div className="space-y-3">
          {configData.map((task) => (
            <AiTaskConfigRow key={task.taskId} task={task} onSave={updateTaskConfig} />
          ))}
        </div>
      </section>

      <section data-testid="ai-usage-section" className="bg-white border border-[#E1DED4] rounded-2xl p-8 shadow-xs">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <BarChart2 className="w-5 h-5 text-[#BA5012]" aria-hidden="true" />
            <h3 className="font-serif text-xl font-bold text-[#142030]">Usage & Cost</h3>
          </div>
          <AiUsageDateRangeControl value={dateRange} onChange={setDateRange} />
        </div>
        {isUsageLoading ? (
          <div className="flex items-center justify-center py-12 text-[#5E6A79]">
            <Spinner size="lg" className="mr-2" />
            <span className="text-sm">Loading usage data...</span>
          </div>
        ) : usageError ? (
          <p role="alert" className="text-xs font-semibold text-red-600">
            {usageError}
          </p>
        ) : (
          <div className="space-y-6">
            <AiUsageSummary data={usageData} />
            <AiUsageChart data={usageData} />
          </div>
        )}
      </section>
    </div>
  );
};
