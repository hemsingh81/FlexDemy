import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressAndCertificate } from '@/src/features/ProgressAndCertificate/ProgressAndCertificate';
import { useProgressAndCertificate } from '@/src/features/ProgressAndCertificate/useProgressAndCertificate';
import { Course, LeaderboardUser, UserProfile } from '@/src/types';

vi.mock('@/src/features/ProgressAndCertificate/useProgressAndCertificate');

const course: Course = {
  id: 'course_1',
  title: 'Quantum Foundations',
  shortDescription: '',
  fullDescription: '',
  subject: 'physics',
  level: 'Beginner',
  type: 'interactive',
  instructor: { name: 'Dr. Rostova', role: 'Professor', avatar: '' },
  rating: 5,
  enrolledCount: 10,
  estimatedHours: 5,
  thumbnail: '',
  badgeIcon: '',
  modules: [
    {
      id: 'mod_1',
      title: 'Module 1',
      lessons: [{ id: 'l1', title: 'Lesson 1', durationMinutes: 20, sentences: [], drilldowns: {}, isCompleted: true }],
    },
  ],
  prerequisites: [],
};

const user: UserProfile = {
  id: 'usr_1',
  name: 'Alex Rivera',
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

const leaderboard: LeaderboardUser[] = [
  { rank: 1, name: 'Sam', avatar: '', points: 500, streakDays: 10, weeklyHours: 5, badge: 'Gold' },
];

describe('ProgressAndCertificate', () => {
  beforeEach(() => {
    vi.mocked(useProgressAndCertificate).mockReturnValue({
      user,
      courses: [course],
      leaderboard,
      userLanguage: 'en',
      isLoading: false,
    });
  });

  it('renders the certificate header and the leaderboard entries', () => {
    render(<ProgressAndCertificate />);
    expect(screen.getByText('Certificates & Global Leaderboard')).toBeInTheDocument();
    expect(screen.getByText('Sam')).toBeInTheDocument();
  });

  it('renders nothing while loading', () => {
    vi.mocked(useProgressAndCertificate).mockReturnValue({
      user: null,
      courses: [],
      leaderboard: [],
      userLanguage: 'en',
      isLoading: true,
    });
    const { container } = render(<ProgressAndCertificate />);
    expect(container).toBeEmptyDOMElement();
  });
});
