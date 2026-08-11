import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiUsageDateRangeControl } from '@/src/features/Admin/AiConfiguration/AiUsageDateRangeControl';

describe('AiUsageDateRangeControl', () => {
  it('marks only the current value as aria-pressed, and toggles correctly across all three options', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<AiUsageDateRangeControl value="last30" onChange={onChange} />);

    expect(screen.getByTestId('ai-usage-range-last30')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('ai-usage-range-last7')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('ai-usage-range-all')).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByTestId('ai-usage-range-last7'));
    expect(onChange).toHaveBeenCalledWith('last7');

    // onChange doesn't update `value` itself -- simulate the parent applying the new value.
    rerender(<AiUsageDateRangeControl value="last7" onChange={onChange} />);
    expect(screen.getByTestId('ai-usage-range-last7')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('ai-usage-range-last30')).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByTestId('ai-usage-range-all'));
    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('each button is a real type="button" element inside a labeled group', () => {
    render(<AiUsageDateRangeControl value="last30" onChange={vi.fn()} />);

    expect(screen.getByRole('group', { name: /date range/i })).toBeInTheDocument();
    ['ai-usage-range-last7', 'ai-usage-range-last30', 'ai-usage-range-all'].forEach((testId) => {
      expect(screen.getByTestId(testId)).toHaveAttribute('type', 'button');
    });
  });
});
