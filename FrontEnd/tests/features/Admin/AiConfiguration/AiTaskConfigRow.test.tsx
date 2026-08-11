import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiTaskConfigRow } from '@/src/features/Admin/AiConfiguration/AiTaskConfigRow';
import type { AiTaskConfig } from '@/src/features/Admin/AiConfiguration/useAiTaskConfig';

const TASK: AiTaskConfig = {
  taskId: 'defineKeyword',
  provider: 'Groq',
  model: 'llama-3.1-8b-instant',
  fallbackProvider: 'OpenRouter',
  fallbackModel: 'gpt-4o-mini',
  budgetThreshold: 20,
  currentSpend: 5.6,
};

describe('AiTaskConfigRow', () => {
  it('a failed save shows an inline error and does not show "Saved!"', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('Budget threshold must be zero or greater.'));
    render(<AiTaskConfigRow task={TASK} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByTestId('save-error')).toHaveTextContent('Budget threshold must be zero or greater.');
    expect(screen.queryByRole('button', { name: /saved/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
  });

  it('a subsequent edit clears a stale save error', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('Network error.'));
    render(<AiTaskConfigRow task={TASK} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByTestId('save-error')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Provider'), 'OpenRouter');

    expect(screen.queryByTestId('save-error')).not.toBeInTheDocument();
  });

  it('a successful save still shows "Saved!" as before', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AiTaskConfigRow task={TASK} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByRole('button', { name: /saved/i })).toBeInTheDocument();
    expect(screen.queryByTestId('save-error')).not.toBeInTheDocument();
  });

  it('disables the Save button while a save is in flight', async () => {
    const user = userEvent.setup();
    let resolveSave: () => void = () => {};
    const onSave = vi.fn().mockReturnValue(new Promise<void>((resolve) => { resolveSave = resolve; }));
    render(<AiTaskConfigRow task={TASK} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();

    resolveSave();
    expect(await screen.findByRole('button', { name: /saved/i })).toBeInTheDocument();
  });

  it('resyncs local field state when the task prop changes after mount', () => {
    const onSave = vi.fn();
    const { rerender } = render(<AiTaskConfigRow task={TASK} onSave={onSave} />);

    expect(screen.getByLabelText('Model')).toHaveValue('llama-3.1-8b-instant');

    rerender(<AiTaskConfigRow task={{ ...TASK, model: 'gpt-4o-mini', budgetThreshold: 40 }} onSave={onSave} />);

    expect(screen.getByLabelText('Model')).toHaveValue('gpt-4o-mini');
    expect(screen.getByLabelText(/budget threshold/i)).toHaveValue(40);
  });
});
