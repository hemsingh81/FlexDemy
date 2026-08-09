import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FocusSessionTimer } from '@/src/features/CoursePlayer/FocusSessionTimer';

describe('FocusSessionTimer', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <FocusSessionTimer isOpen={false} onClose={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the default 25 minute target and module title when open', () => {
    render(
      <FocusSessionTimer isOpen={true} onClose={vi.fn()} moduleTitle="Module 1" />
    );

    expect(screen.getByText('25:00')).toBeInTheDocument();
    expect(screen.getByText('Module 1')).toBeInTheDocument();
  });

  it('switches the target duration when a preset is selected while stopped', async () => {
    const user = userEvent.setup();
    render(<FocusSessionTimer isOpen={true} onClose={vi.fn()} />);

    await user.click(screen.getByText('45 Mins'));

    expect(screen.getByText('45:00')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<FocusSessionTimer isOpen={true} onClose={onClose} />);

    const closeButtons = screen.getAllByRole('button');
    // First button in the header is the close (X) icon button.
    await user.click(closeButtons[0]);

    expect(onClose).toHaveBeenCalled();
  });
});
