import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssignmentsView } from '@/src/features/Assignments/AssignmentsView';
import { useAssignments } from '@/src/features/Assignments/useAssignments';
import { TopicAssignment } from '@/src/types';

vi.mock('@/src/features/Assignments/useAssignments');
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const assignment: TopicAssignment = {
  id: 'asg_1',
  title: 'Superposition Quiz',
  description: 'Test your understanding of superposition.',
  maxPoints: 150,
  questions: [
    {
      id: 'q1',
      question: 'What is superposition?',
      options: ['A wave', 'A state combination', 'A particle', 'A field'],
      correctAnswerIndex: 1,
      explanation: 'Superposition is a combination of states.',
    },
  ],
};

describe('AssignmentsView', () => {
  const awardPoints = vi.fn();

  beforeEach(() => {
    awardPoints.mockClear();
    vi.mocked(useAssignments).mockReturnValue({
      assignments: [assignment],
      userLanguage: 'en',
      awardPoints,
      isLoading: false,
    });
  });

  it('renders the header and the assignment picker', () => {
    render(<AssignmentsView />);
    expect(screen.getByText('Assignments & Automated Evaluations')).toBeInTheDocument();
    expect(screen.getAllByText('Superposition Quiz').length).toBeGreaterThan(0);
  });

  it('renders nothing while loading', () => {
    vi.mocked(useAssignments).mockReturnValue({
      assignments: [],
      userLanguage: 'en',
      awardPoints,
      isLoading: true,
    });
    const { container } = render(<AssignmentsView />);
    expect(container).toBeEmptyDOMElement();
  });

  it('awards points when the quiz is submitted with a passing score', async () => {
    const user = userEvent.setup();
    render(<AssignmentsView />);

    await user.click(screen.getByText('A state combination'));
    await user.click(screen.getByText('Submit Assignment for Auto-Grading'));

    expect(awardPoints).toHaveBeenCalledWith(150);
  });
});
