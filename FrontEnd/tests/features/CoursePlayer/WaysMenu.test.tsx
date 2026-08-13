import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WaysMenu } from '../../../src/features/CoursePlayer/WaysMenu';

describe('WaysMenu', () => {
  it('renders 5 real, Tab-reachable Way pills with aria-current only on the active one', async () => {
    render(<WaysMenu courseId="course_1" nodeId="subtopic_1" />);

    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(5));

    const pills = screen.getAllByRole('tab');
    expect(pills).toHaveLength(5);
    expect(pills[0].tagName).toBe('BUTTON');
    expect(pills[0]).toHaveAttribute('aria-current', 'true');
    pills.slice(1).forEach((pill) => expect(pill).not.toHaveAttribute('aria-current'));
  });

  it('clicking/activating a pill updates the displayed explanation and example', async () => {
    render(<WaysMenu courseId="course_1" nodeId="subtopic_1" />);

    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(5));

    const pills = screen.getAllByRole('tab');
    fireEvent.click(pills[2]);

    expect(pills[2]).toHaveAttribute('aria-current', 'true');
    expect(pills[0]).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Worked example (Way 3)')).toBeInTheDocument();
  });

  it('shows the tutor-override indicator only for a Way flagged isOverridden', async () => {
    render(<WaysMenu courseId="course_1" nodeId="topic_2" />);

    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(5));

    expect(screen.queryByLabelText('Tutor-edited')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('tab')[1]);

    expect(screen.getByLabelText('Tutor-edited')).toBeInTheDocument();
  });
});
