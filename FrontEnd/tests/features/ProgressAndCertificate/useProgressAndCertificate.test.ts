import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProgressAndCertificate } from '@/src/features/ProgressAndCertificate/useProgressAndCertificate';
import { useDomain } from '@/src/context/DomainContext';
import * as userService from '@/src/services/userService';
import { Course, LeaderboardUser, UserProfile } from '@/src/types';

vi.mock('@/src/context/DomainContext');
vi.mock('@/src/services/userService');

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
  modules: [],
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
  language: 'es',
  progress: {},
};

const leaderboard: LeaderboardUser[] = [
  { rank: 1, name: 'Sam', avatar: '', points: 500, streakDays: 10, weeklyHours: 5, badge: 'Gold' },
];

describe('useProgressAndCertificate', () => {
  beforeEach(() => {
    vi.mocked(useDomain).mockReturnValue({
      user,
      courses: [course],
      isLoading: false,
      ensureEnrolled: vi.fn(),
      updateUser: vi.fn(),
      awardPoints: vi.fn(),
      completeLesson: vi.fn(),
      addCourse: vi.fn(),
    });
    vi.mocked(userService.getLeaderboard).mockResolvedValue(leaderboard);
  });

  it('combines domain user/courses with the fetched leaderboard and derives userLanguage', async () => {
    const { result } = renderHook(() => useProgressAndCertificate());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toEqual(user);
    expect(result.current.courses).toEqual([course]);
    expect(result.current.leaderboard).toEqual(leaderboard);
    expect(result.current.userLanguage).toBe('es');
  });

  it('stays loading while the domain context is still loading', () => {
    vi.mocked(useDomain).mockReturnValue({
      user: null,
      courses: [],
      isLoading: true,
      ensureEnrolled: vi.fn(),
      updateUser: vi.fn(),
      awardPoints: vi.fn(),
      completeLesson: vi.fn(),
      addCourse: vi.fn(),
    });

    const { result } = renderHook(() => useProgressAndCertificate());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.userLanguage).toBe('en');
  });
});
