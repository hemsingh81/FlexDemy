import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@/src/features/Dashboard/Dashboard';
import { useDashboard } from '@/src/features/Dashboard/useDashboard';
import { Course, UserProfile } from '@/src/types';

vi.mock('@/src/features/Dashboard/useDashboard');

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
      lessons: [{ id: 'l1', title: 'Lesson 1', durationMinutes: 20, sentences: [], drilldowns: {} }],
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
  progress: {
    course_1: {
      courseId: 'course_1',
      completedLessonIds: [],
      lastLessonId: 'l1',
      lastSentenceIndex: 0,
      assignmentScores: {},
      timeSpentSeconds: 0,
      enrolledDate: '2026-01-01',
    },
  },
};

describe('Dashboard', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(useDashboard).mockReturnValue({ user, courses: [course], isLoading: false });
  });

  it('renders the welcome banner with the user name', () => {
    render(<Dashboard onOpenCourse={vi.fn()} onNavigateTab={vi.fn()} />);
    expect(screen.getByText(/Welcome back, Alex Rivera/)).toBeInTheDocument();
  });

  it('renders nothing while loading', () => {
    vi.mocked(useDashboard).mockReturnValue({ user: null, courses: [], isLoading: true });
    const { container } = render(<Dashboard onOpenCourse={vi.fn()} onNavigateTab={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onOpenCourse with the course id when continuing an enrolled course', async () => {
    const onOpenCourse = vi.fn();
    const userEventInstance = userEvent.setup();
    render(<Dashboard onOpenCourse={onOpenCourse} onNavigateTab={vi.fn()} />);

    await userEventInstance.click(screen.getByText('Continue Learning'));
    expect(onOpenCourse).toHaveBeenCalledWith('course_1');
  });
});
