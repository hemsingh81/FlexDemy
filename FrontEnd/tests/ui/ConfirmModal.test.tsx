import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmModal } from '@/src/ui/ConfirmModal';

describe('ConfirmModal', () => {
  it('renders the message and calls onConfirm/onCancel', async () => {
    const u = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmModal message="Delete this?" onConfirm={onConfirm} onCancel={onCancel} />);

    expect(screen.getByText('Delete this?')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalled();

    await u.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('respects custom confirm/cancel labels', () => {
    render(<ConfirmModal message="Deactivate?" confirmLabel="Deactivate" cancelLabel="Nevermind" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nevermind' })).toBeInTheDocument();
  });

  it('Escape calls onCancel', async () => {
    const u = userEvent.setup();
    const onCancel = vi.fn();
    render(<ConfirmModal message="Delete this?" onConfirm={vi.fn()} onCancel={onCancel} />);

    await u.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('moves focus into the panel (onto the first button) on mount', () => {
    render(<ConfirmModal message="Delete this?" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelButton).toHaveFocus();
  });

  it('restores focus to the previously-focused element on unmount', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Delete';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(trigger).toHaveFocus();

    const { unmount } = render(<ConfirmModal message="Delete this?" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(trigger).not.toHaveFocus();

    unmount();
    expect(trigger).toHaveFocus();

    document.body.removeChild(trigger);
  });

  it('does not throw when restoring focus to an element removed from the DOM while open', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(<ConfirmModal message="Delete this?" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    document.body.removeChild(trigger); // removed while the modal is open

    expect(() => unmount()).not.toThrow();
  });

  it('Tab cycles between Cancel and Delete without escaping the trap', async () => {
    const u = userEvent.setup();
    render(<ConfirmModal message="Delete this?" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    expect(cancelButton).toHaveFocus();

    // Shift+Tab from the first (focused) button wraps to the last.
    await u.tab({ shift: true });
    expect(deleteButton).toHaveFocus();

    // Tab from the last button wraps back to the first.
    await u.tab();
    expect(cancelButton).toHaveFocus();
  });
});
