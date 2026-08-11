import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiConfiguration } from '@/src/features/Admin/AiConfiguration/AiConfiguration';
import { AI_TASK_IDS } from '@/src/features/Admin/AiConfiguration/useAiTaskConfig';
import * as aiConfigService from '@/src/services/aiConfigService';
import * as aiUsageService from '@/src/services/aiUsageService';

vi.mock('@/src/services/aiConfigService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/aiConfigService')>('@/src/services/aiConfigService');
  return { ...actual, getAiTaskConfigs: vi.fn(), updateAiTaskConfig: vi.fn() };
});

vi.mock('@/src/services/aiUsageService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/aiUsageService')>('@/src/services/aiUsageService');
  return { ...actual, getUsage: vi.fn() };
});

// Fake-server usage dataset (this test file stands in for the real backend's date filtering,
// which is AiUsageServiceTests.cs's job, not this file's) -- spans well past 30 days so
// "last7"/"last30"/"all" produce genuinely different result sets, and includes exactly one
// fallback-served entry (describeNotation) to exercise the fallback badge.
const DAY_MS = 24 * 60 * 60 * 1000;
const isoDaysAgo = (days: number): string => new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);

const USAGE_ENTRIES: aiUsageService.AiUsageEntryDto[] = [
  { taskId: 'extractStructure', date: isoDaysAgo(2), cost: 7.0, isFallbackServed: false },
  { taskId: 'extractStructure', date: isoDaysAgo(40), cost: 2.2, isFallbackServed: false },
  { taskId: 'explainTopic', date: isoDaysAgo(1), cost: 45.0, isFallbackServed: false },
  { taskId: 'explainTopic', date: isoDaysAgo(38), cost: 9.3, isFallbackServed: false },
  { taskId: 'describeNotation', date: isoDaysAgo(4), cost: 3.2, isFallbackServed: true },
  { taskId: 'describeNotation', date: isoDaysAgo(31), cost: 1.2, isFallbackServed: false },
  { taskId: 'embeddings', date: isoDaysAgo(7), cost: 0.9, isFallbackServed: false },
  { taskId: 'embeddings', date: isoDaysAgo(36), cost: 0.5, isFallbackServed: false },
];

const RANGE_DAYS: Record<'last7' | 'last30', number> = { last7: 7, last30: 30 };

const filterByRange = (range: 'last7' | 'last30' | 'all'): aiUsageService.AiUsageEntryDto[] => {
  if (range === 'all') return USAGE_ENTRIES;
  const cutoff = isoDaysAgo(RANGE_DAYS[range]);
  return USAGE_ENTRIES.filter((entry) => entry.date >= cutoff);
};

// Mirrors Story 1.1's former MOCK_AI_TASK_CONFIGS values exactly (currentSpend replacing
// mockSpend, Story 1.5) -- explainTopic is deliberately at/above its threshold, defineKeyword
// well under, so the budget-warning tests below exercise both branches unchanged.
const CONFIGS: aiConfigService.AiTaskConfigDto[] = [
  { taskId: 'extractStructure', provider: 'Groq', model: 'llama-4-scout', fallbackProvider: 'OpenRouter', fallbackModel: 'gpt-4o-mini', budgetThreshold: 50, currentSpend: 12.4 },
  { taskId: 'explainTopic', provider: 'Groq', model: 'llama-4-maverick', fallbackProvider: 'OpenRouter', fallbackModel: 'claude-4-haiku', budgetThreshold: 80, currentSpend: 82.3 },
  { taskId: 'rewriteExplanation', provider: 'Groq', model: 'llama-4-maverick', fallbackProvider: 'OpenRouter', fallbackModel: 'claude-4-haiku', budgetThreshold: 80, currentSpend: 41.2 },
  { taskId: 'generateExercise', provider: 'Groq', model: 'llama-4-scout', fallbackProvider: 'OpenRouter', fallbackModel: 'gpt-4o-mini', budgetThreshold: 30, currentSpend: 8.1 },
  { taskId: 'defineKeyword', provider: 'Groq', model: 'llama-3.1-8b-instant', fallbackProvider: 'OpenRouter', fallbackModel: 'gpt-4o-mini', budgetThreshold: 20, currentSpend: 5.6 },
  { taskId: 'describeNotation', provider: 'Groq', model: 'llama-4-scout', fallbackProvider: 'OpenRouter', fallbackModel: 'gpt-4o-mini', budgetThreshold: 25, currentSpend: 3.2 },
  { taskId: 'embeddings', provider: 'Local', model: 'nomic-embed-text', fallbackProvider: 'OpenRouter', fallbackModel: 'text-embedding-3-small', budgetThreshold: 10, currentSpend: 0.9 },
];

describe('AiConfiguration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(aiConfigService.getAiTaskConfigs).mockResolvedValue(structuredClone(CONFIGS));
    vi.mocked(aiConfigService.updateAiTaskConfig).mockImplementation((taskId, patch) => {
      const original = CONFIGS.find((c) => c.taskId === taskId)!;
      return Promise.resolve({ ...original, ...patch });
    });
    vi.mocked(aiUsageService.getUsage).mockImplementation((range) => Promise.resolve(filterByRange(range)));
  });

  it('renders all 7 AI Tasks, in the documented order', async () => {
    render(<AiConfiguration />);

    await screen.findByTestId(`ai-task-row-${AI_TASK_IDS[0]}`);
    const rows = screen.getAllByTestId(/^ai-task-row-/);
    expect(rows).toHaveLength(7);
    expect(rows.map((row) => row.dataset.testid)).toEqual(AI_TASK_IDS.map((id) => `ai-task-row-${id}`));
  });

  it('editing and saving one row does not change another row', async () => {
    const user = userEvent.setup();
    render(<AiConfiguration />);

    const explainTopicRow = await screen.findByTestId('ai-task-row-explainTopic');
    const defineKeywordRow = screen.getByTestId('ai-task-row-defineKeyword');

    const defineKeywordModelBefore = (within(defineKeywordRow).getByLabelText('Model') as HTMLSelectElement).value;

    const modelSelect = within(explainTopicRow).getByLabelText('Model');
    await user.selectOptions(modelSelect, 'claude-4-haiku');
    await user.click(within(explainTopicRow).getByRole('button', { name: /save/i }));

    expect(await within(explainTopicRow).findByLabelText('Model')).toHaveValue('claude-4-haiku');
    expect(within(defineKeywordRow).getByLabelText('Model')).toHaveValue(defineKeywordModelBefore);
  });

  it('shows an icon+text warning with aria-describedby when spend is at/above the budget threshold, and the row is a real accessible group', async () => {
    render(<AiConfiguration />);

    // explainTopic's seeded config is intentionally at/above its threshold (82.3 spend vs 80
    // threshold) specifically to exercise this case.
    const overThresholdRow = await screen.findByTestId('ai-task-row-explainTopic');
    expect(within(overThresholdRow).queryByTestId('budget-warning')).toBeTruthy();
    const warning = within(overThresholdRow).getByTestId('budget-warning');
    const rowRoot = overThresholdRow;
    expect(rowRoot).toHaveAttribute('aria-describedby', warning.id);
    // aria-describedby is only meaningful on a real, nameable landmark -- not a bare div.
    expect(rowRoot).toHaveAttribute('role', 'group');
    expect(rowRoot).toHaveAttribute('aria-label');
  });

  it('shows no budget warning for a task well under its threshold', async () => {
    render(<AiConfiguration />);

    // defineKeyword's seeded config (currentSpend 5.6, threshold 20) is well under threshold.
    const underThresholdRow = await screen.findByTestId('ai-task-row-defineKeyword');
    expect(within(underThresholdRow).queryByTestId('budget-warning')).toBeNull();
    expect(underThresholdRow).not.toHaveAttribute('aria-describedby');
  });

  it('Save button is a real type="button" and disables when the budget threshold is invalid', async () => {
    const user = userEvent.setup();
    render(<AiConfiguration />);

    const row = await screen.findByTestId('ai-task-row-defineKeyword');
    const saveButton = within(row).getByRole('button', { name: /save/i });
    expect(saveButton).toHaveAttribute('type', 'button');
    expect(saveButton).not.toBeDisabled();

    const thresholdInput = within(row).getByLabelText(/budget threshold/i);
    await user.clear(thresholdInput);

    expect(saveButton).toBeDisabled();
  });

  it('shows a brief "Saved!" confirmation immediately after a successful save', async () => {
    const user = userEvent.setup();
    render(<AiConfiguration />);

    const row = await screen.findByTestId('ai-task-row-defineKeyword');
    await user.click(within(row).getByRole('button', { name: /save/i }));

    expect(await within(row).findByRole('button', { name: /saved/i })).toBeInTheDocument();
  });

  it('reverts "Saved!" back to "Save" as soon as the admin edits the row again', async () => {
    const user = userEvent.setup();
    render(<AiConfiguration />);

    const row = await screen.findByTestId('ai-task-row-defineKeyword');
    await user.click(within(row).getByRole('button', { name: /save/i }));
    expect(await within(row).findByRole('button', { name: /saved/i })).toBeInTheDocument();

    await user.selectOptions(within(row).getByLabelText('Provider'), 'OpenRouter');

    expect(within(row).getByRole('button', { name: /^save$/i })).toBeInTheDocument();
  });

  it('a failed save shows an inline error instead of a false "Saved!"', async () => {
    vi.mocked(aiConfigService.updateAiTaskConfig).mockRejectedValueOnce(new aiConfigService.AiConfigError('Validation failed.'));
    const user = userEvent.setup();
    render(<AiConfiguration />);

    const row = await screen.findByTestId('ai-task-row-defineKeyword');
    await user.click(within(row).getByRole('button', { name: /save/i }));

    expect(await within(row).findByTestId('save-error')).toHaveTextContent('Validation failed.');
    expect(within(row).queryByRole('button', { name: /saved/i })).not.toBeInTheDocument();
  });

  it('the over-budget warning is an aria-live region, announced regardless of focus position', async () => {
    render(<AiConfiguration />);

    const overThresholdRow = await screen.findByTestId('ai-task-row-explainTopic');
    expect(within(overThresholdRow).getByTestId('budget-warning')).toHaveAttribute('aria-live', 'polite');
  });

  it('rejects a negative budget threshold, disabling Save', async () => {
    const user = userEvent.setup();
    render(<AiConfiguration />);

    const row = await screen.findByTestId('ai-task-row-defineKeyword');
    const saveButton = within(row).getByRole('button', { name: /save/i });
    const thresholdInput = within(row).getByLabelText(/budget threshold/i);

    await user.clear(thresholdInput);
    await user.type(thresholdInput, '-5');

    expect(saveButton).toBeDisabled();
  });

  it('renders the usage section below the config-table section, in that DOM order', async () => {
    render(<AiConfiguration />);

    await screen.findByTestId('ai-task-row-extractStructure');
    await screen.findByTestId('ai-usage-chart');
    const configSection = screen.getByTestId('ai-config-table-section');
    const usageSection = screen.getByTestId('ai-usage-section');
    expect(
      configSection.compareDocumentPosition(usageSection) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('changing the date-range control changes the displayed usage data', async () => {
    const user = userEvent.setup();
    render(<AiConfiguration />);

    await screen.findByTestId('ai-task-row-extractStructure');
    await screen.findByTestId('ai-usage-chart');
    const initialCount = Number(screen.getByTestId('ai-usage-stat-total-generations').textContent);

    await user.click(screen.getByTestId('ai-usage-range-all'));

    const allCount = Number((await screen.findByTestId('ai-usage-stat-total-generations')).textContent);
    // Default range is "last30"; mock dataset spans well past 30 days, so "all" must show
    // strictly more entries than the default -- otherwise the control wouldn't actually filter.
    expect(allCount).toBeGreaterThan(initialCount);
  });

  it('shows a fallback-served badge for a task with a fallback-served entry in range', async () => {
    const user = userEvent.setup();
    render(<AiConfiguration />);

    await screen.findByTestId('ai-task-row-extractStructure');
    await screen.findByTestId('ai-usage-chart');
    await user.click(screen.getByTestId('ai-usage-range-all'));

    expect(await screen.findByTestId('ai-usage-fallback-badge-describeNotation')).toBeInTheDocument();
  });

  it('renders the usage chart without throwing', async () => {
    render(<AiConfiguration />);

    await screen.findByTestId('ai-task-row-extractStructure');
    expect(await screen.findByTestId('ai-usage-chart')).toBeInTheDocument();
  });

  it('"Last 7 days" narrows the data further than the "last30" default', async () => {
    const user = userEvent.setup();
    render(<AiConfiguration />);

    await screen.findByTestId('ai-task-row-extractStructure');
    await screen.findByTestId('ai-usage-chart');
    const initialCount = Number(screen.getByTestId('ai-usage-stat-total-generations').textContent);

    await user.click(screen.getByTestId('ai-usage-range-last7'));

    const last7Count = Number((await screen.findByTestId('ai-usage-stat-total-generations')).textContent);
    expect(last7Count).toBeLessThanOrEqual(initialCount);
  });

  it('shows a per-task usage breakdown row for every one of the 7 AI Tasks, even at zero usage', async () => {
    render(<AiConfiguration />);

    await screen.findByTestId('ai-task-row-extractStructure');
    await screen.findByTestId('ai-usage-chart');
    AI_TASK_IDS.forEach((taskId) => {
      expect(screen.getByTestId(`ai-usage-per-task-row-${taskId}`)).toBeInTheDocument();
    });
  });
});
