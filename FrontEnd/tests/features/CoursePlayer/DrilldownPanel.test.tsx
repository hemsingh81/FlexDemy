import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DrilldownPanel } from '../../../src/features/CoursePlayer/DrilldownPanel';

describe('DrilldownPanel', () => {
  it('locks levels beyond unlockedLevel and marks the selected level current', async () => {
    render(
      <DrilldownPanel courseId="course_1" nodeId="subtopic_1" onClose={vi.fn()} onReturnToLesson={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByText('Core Takeaways')).toBeInTheDocument());

    const level1Tab = screen.getByRole('button', { name: /L1:/ });
    const level2Tab = screen.getByRole('button', { name: /L2:/ });

    expect(level1Tab).toHaveAttribute('aria-current', 'true');
    expect(level1Tab).not.toBeDisabled();

    expect(level2Tab).toBeDisabled();
    expect(level2Tab).toHaveAttribute('aria-disabled', 'true');
  });

  it('"Explain more" advances unlockedLevel by exactly one, never revealing two levels at once', async () => {
    render(
      <DrilldownPanel courseId="course_1" nodeId="subtopic_1" onClose={vi.fn()} onReturnToLesson={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByText('Core Takeaways')).toBeInTheDocument());

    const level3Tab = screen.getByRole('button', { name: /L3:/ });
    expect(level3Tab).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Explain more' }));

    const level2Tab = screen.getByRole('button', { name: /L2:/ });
    expect(level2Tab).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /L3:/ })).toBeDisabled();
  });

  it('renders the tutor-override indicator and override content for an overridden level, not AI content', async () => {
    render(
      <DrilldownPanel courseId="course_1" nodeId="topic_2" onClose={vi.fn()} onReturnToLesson={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByText('Core Takeaways')).toBeInTheDocument());

    // Unlock through to level 3, which is the mock's overridden level.
    fireEvent.click(screen.getByRole('button', { name: 'Explain more' }));
    fireEvent.click(screen.getByRole('button', { name: 'Explain more' }));

    fireEvent.click(screen.getByRole('button', { name: /L3:/ }));

    expect(screen.getByLabelText('Tutor-edited')).toBeInTheDocument();
    expect(screen.getByText(/A wave carries energy from one place to another/)).toBeInTheDocument();
    expect(screen.queryByText(/progressively more rigorous terms/)).not.toBeInTheDocument();
  });

  it('does not render the override indicator for a non-overridden level', async () => {
    render(
      <DrilldownPanel courseId="course_1" nodeId="subtopic_1" onClose={vi.fn()} onReturnToLesson={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByText('Core Takeaways')).toBeInTheDocument());

    expect(screen.queryByLabelText('Tutor-edited')).not.toBeInTheDocument();
  });
});
