import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TutorHubView } from '@/src/features/TutorHub/TutorHubView';
import { UserProfile } from '@/src/types';

const user: UserProfile = {
  id: 'usr_1',
  name: 'Hem Singh',
  email: '',
  avatar: '',
  role: 'student',
  streakDays: 4,
  totalPoints: 250,
  preferredVoice: '',
  ttsRate: 1,
  ttsPitch: 1,
  isDarkMode: false,
  language: 'en',
  progress: {},
};

const baseHookValue = {
  user,
  courses: [],
  tutorSlots: [],
  groupRequests: [],
  publicClasses: [],
  isLoading: false,
  addCourse: vi.fn(),
  bookSlot: vi.fn(),
  updateSlot: vi.fn(),
  requestGroupClass: vi.fn(),
  subscribePublicClass: vi.fn(),
  announcePublicClass: vi.fn(),
};

describe('TutorHubView', () => {
  it('renders nothing while loading', () => {
    const { container } = render(
      <TutorHubView tutorHub={{ ...baseHookValue, user: null, isLoading: true }} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('defaults to the student booking view', () => {
    render(<TutorHubView tutorHub={baseHookValue} />);
    expect(screen.getByText('Student Session Booking Portal')).toBeInTheDocument();
  });

  it('routes to the educator studio view when the perspective switcher is clicked', async () => {
    const u = userEvent.setup();
    render(<TutorHubView tutorHub={baseHookValue} />);

    await u.click(screen.getByText('Educator Studio'));

    expect(screen.getByText('Educator & Instructor Studio')).toBeInTheDocument();
    expect(screen.queryByText('Student Session Booking Portal')).not.toBeInTheDocument();
  });

  it('routes back to the student view when the student switcher is clicked', async () => {
    const u = userEvent.setup();
    render(<TutorHubView tutorHub={baseHookValue} />);

    await u.click(screen.getByText('Educator Studio'));
    await u.click(screen.getByText('Student View'));

    expect(screen.getByText('Student Session Booking Portal')).toBeInTheDocument();
  });
});
