import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiUsageSummary } from '@/src/features/Admin/AiConfiguration/AiUsageSummary';
import type { AiUsageEntry } from '@/src/features/Admin/AiConfiguration/useAiUsage';

describe('AiUsageSummary', () => {
  it('breaks a "Most Expensive Task" tie by taskId alphabetical order, deterministically', () => {
    // defineKeyword and extractStructure tied at cost 10 -- 'defineKeyword' sorts first.
    const data: AiUsageEntry[] = [
      { taskId: 'extractStructure', date: '2026-01-01', cost: 10, isFallbackServed: false },
      { taskId: 'defineKeyword', date: '2026-01-01', cost: 10, isFallbackServed: false },
    ];

    render(<AiUsageSummary data={data} />);

    expect(screen.getByTestId('ai-usage-stat-top-task')).toHaveTextContent('Define Keyword');
  });

  it('shows "No usage in this range" instead of misleadingly naming a task at $0', () => {
    render(<AiUsageSummary data={[]} />);

    expect(screen.getByTestId('ai-usage-stat-top-task')).toHaveTextContent('No usage in this range');
  });

  it('the fallback-served badge list is an aria-live region, matching AiTaskConfigRow\'s budget-warning pattern', () => {
    const data: AiUsageEntry[] = [
      { taskId: 'describeNotation', date: '2026-01-01', cost: 1, isFallbackServed: true },
    ];

    render(<AiUsageSummary data={data} />);

    const badge = screen.getByTestId('ai-usage-fallback-badge-describeNotation');
    expect(badge.parentElement).toHaveAttribute('aria-live', 'polite');
  });
});
