import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmModal } from '@/src/ui/ConfirmModal';

describe('ConfirmModal', () => {
  it('renders the message', () => {
    render(<ConfirmModal message="Delete this?" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Delete this?')).toBeInTheDocument();
  });

  // The real onConfirm/onCancel (which the caller uses to unmount this component) fires after a
  // brief fade plays, not synchronously -- FRONTEND_TRANSITIONS.md #4's "mark exiting, then act"
  // technique, applied to a whole modal instead of a list row.
  it('calls onConfirm after the close fade when Delete is clicked', async () => {
    const u = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmModal message="Delete this?" onConfirm={onConfirm} onCancel={vi.fn()} />);

    await u.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).not.toHaveBeenCalled(); // not yet -- the fade hasn't finished
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
  });

  it('calls onCancel after the close fade when Cancel is clicked', async () => {
    const u = userEvent.setup();
    const onCancel = vi.fn();
    render(<ConfirmModal message="Delete this?" onConfirm={vi.fn()} onCancel={onCancel} />);

    await u.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).not.toHaveBeenCalled();
    await waitFor(() => expect(onCancel).toHaveBeenCalled());
  });

  // fireEvent, not userEvent, here -- userEvent's internal delay-between-interactions loop
  // deadlocks when combined with vi.useFakeTimers() (same established convention as
  // CourseContentEditor.test.tsx's own fake-timer tests).
  it('a later Cancel supersedes an earlier pending Confirm -- only onCancel fires, not both', () => {
    vi.useFakeTimers();
    try {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      render(<ConfirmModal message="Delete this?" onConfirm={onConfirm} onCancel={onCancel} />);

      fireEvent.click(screen.getByRole('button', { name: 'Delete' })); // schedules onConfirm
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); // supersedes it with onCancel
      vi.advanceTimersByTime(200);

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('fades in on mount and starts fading out as soon as Cancel/Delete is clicked', async () => {
    const u = userEvent.setup();
    render(<ConfirmModal message="Delete this?" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('dialog')).toHaveClass('animate-[fade-in-scale_150ms_ease-out]');

    await u.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('dialog')).toHaveClass('opacity-0');
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
    await waitFor(() => expect(onCancel).toHaveBeenCalled());
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
