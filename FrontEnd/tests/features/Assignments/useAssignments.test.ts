import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAssignments } from '@/src/features/Assignments/useAssignments';
import { useDomain } from '@/src/context/DomainContext';
import { Course, TopicAssignment, UserProfile } from '@/src/types';

vi.mock('@/src/context/DomainContext');

const makeAssignment = (id: string): TopicAssignment => ({
  id,
  title: `Assignment ${id}`,
  description: '',
  maxPoints: 100,
  questions: [],
});

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
      lessons: [
        { id: 'l1', title: 'Lesson 1', durationMinutes: 20, sentences: [], drilldowns: {}, assignment: makeAssignment('asg_1') },
        { id: 'l2', title: 'Lesson 2', durationMinutes: 20, sentences: [], drilldowns: {} },
      ],
    },
    {
      id: 'mod_2',
      title: 'Module 2',
      lessons: [
        { id: 'l3', title: 'Lesson 3', durationMinutes: 20, sentences: [], drilldowns: {}, assignment: makeAssignment('asg_2') },
      ],
    },
  ],
  prerequisites: [],
};

const user: UserProfile = {
  id: 'usr_1',
  name: 'Hem Singh',
  email: '',
  avatar: '',
  role: 'Student',
  streakDays: 4,
  totalPoints: 250,
  preferredVoice: '',
  ttsRate: 1,
  ttsPitch: 1,
  isDarkMode: false,
  progress: {},
};

describe('useAssignments', () => {
  it('derives the flattened list of assignments across all courses/modules/lessons and passes through awardPoints/isLoading', () => {
    const awardPoints = vi.fn();
    vi.mocked(useDomain).mockReturnValue({
      user,
      courses: [course],
      isLoading: false,
      ensureEnrolled: vi.fn(),
      updateUser: vi.fn(),
      awardPoints,
      completeLesson: vi.fn(),
      addCourse: vi.fn(),
      rolePermissions: null,
      refreshRolePermissions: vi.fn(),
    });

    const { result } = renderHook(() => useAssignments());

    expect(result.current.assignments).toEqual([makeAssignment('asg_1'), makeAssignment('asg_2')]);
    expect(result.current.awardPoints).toBe(awardPoints);
    expect(result.current.isLoading).toBe(false);
  });

  it('returns an empty assignments list when the user/courses are not yet loaded', () => {
    vi.mocked(useDomain).mockReturnValue({
      user: null,
      courses: [],
      isLoading: true,
      ensureEnrolled: vi.fn(),
      updateUser: vi.fn(),
      awardPoints: vi.fn(),
      completeLesson: vi.fn(),
      addCourse: vi.fn(),
      rolePermissions: null,
      refreshRolePermissions: vi.fn(),
    });

    const { result } = renderHook(() => useAssignments());

    expect(result.current.assignments).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });
});
