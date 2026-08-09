import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DomainProvider, useDomain } from '@/src/context/DomainContext';

function Probe() {
  const { user, courses, isLoading, ensureEnrolled, awardPoints } = useDomain();
  const targetIdRef = React.useRef<string | undefined>(undefined);

  if (isLoading || !user) return <div>loading</div>;

  if (!targetIdRef.current) {
    targetIdRef.current = courses.find((c) => !user.progress[c.id])?.id || courses[0]?.id;
  }
  const target = courses.find((c) => c.id === targetIdRef.current) || courses[0];

  return (
    <div>
      <span data-testid="course-count">{courses.length}</span>
      <span data-testid="points">{user.totalPoints}</span>
      <span data-testid="enrolled">{target && user.progress[target.id] ? 'yes' : 'no'}</span>
      <button onClick={() => target && ensureEnrolled(target.id)}>Enroll</button>
      <button onClick={() => awardPoints(50)}>Award</button>
    </div>
  );
}

describe('DomainContext', () => {
  it('loads courses and user, then exposes mutation actions', async () => {
    const user = userEvent.setup();
    render(
      <DomainProvider>
        <Probe />
      </DomainProvider>
    );

    expect(screen.getByText('loading')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId('course-count')).toBeInTheDocument());
    expect(Number(screen.getByTestId('course-count').textContent)).toBeGreaterThan(0);
    expect(screen.getByTestId('enrolled').textContent).toBe('no');

    const pointsBefore = Number(screen.getByTestId('points').textContent);

    await user.click(screen.getByText('Enroll'));
    expect(screen.getByTestId('enrolled').textContent).toBe('yes');

    await user.click(screen.getByText('Award'));
    expect(Number(screen.getByTestId('points').textContent)).toBe(pointsBefore + 50);
  });
});
