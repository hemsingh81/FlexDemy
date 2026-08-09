import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeeklyGoalCard } from '@/src/features/Dashboard/WeeklyGoalCard';
import * as userService from '@/src/services/userService';

describe('WeeklyGoalCard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to a 5 hour goal and shows current progress', () => {
    render(<WeeklyGoalCard currentHoursLearned={2.5} />);
    expect(screen.getByText('Adjust Goal (5h)')).toBeInTheDocument();
    expect(screen.getAllByText(/2\.5/).length).toBeGreaterThan(0);
  });

  it('selecting a preset persists the new goal via userService', async () => {
    const setSpy = vi.spyOn(userService, 'setWeeklyGoalHours');
    const user = userEvent.setup();
    render(<WeeklyGoalCard currentHoursLearned={2.5} />);

    await user.click(screen.getByText('10h'));

    expect(screen.getByText('Adjust Goal (10h)')).toBeInTheDocument();
    expect(setSpy).toHaveBeenCalledWith(10);
  });

  it('shows the goal-achieved state once hours learned reach the target', () => {
    render(<WeeklyGoalCard currentHoursLearned={10} />);
    expect(screen.getByText('Goal Achieved!')).toBeInTheDocument();
  });
});
