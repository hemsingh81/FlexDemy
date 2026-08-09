import { describe, it, expect, beforeEach } from 'vitest';
import {
  ensureEnrolled,
  updateUser,
  awardPoints,
  completeLesson,
  getWeeklyGoalHours,
  setWeeklyGoalHours,
} from '@/src/services/userService';
import { UserProfile } from '@/src/types';

const baseUser: UserProfile = {
  id: 'usr_1',
  name: 'Test User',
  email: 'test@example.com',
  avatar: '',
  role: 'Student',
  streakDays: 3,
  totalPoints: 100,
  preferredVoice: '',
  ttsRate: 1,
  ttsPitch: 1,
  isDarkMode: false,
  progress: {},
};

describe('userService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('ensureEnrolled adds a blank progress entry when not already enrolled', () => {
    const result = ensureEnrolled(baseUser, 'course_1', 'lesson_1');
    expect(result.progress.course_1).toBeDefined();
    expect(result.progress.course_1.completedLessonIds).toEqual([]);
    expect(result.progress.course_1.lastLessonId).toBe('lesson_1');
  });

  it('ensureEnrolled is a no-op when already enrolled', () => {
    const enrolled = ensureEnrolled(baseUser, 'course_1');
    const again = ensureEnrolled(enrolled, 'course_1');
    expect(again).toBe(enrolled);
  });

  it('updateUser merges partial updates', () => {
    const result = updateUser(baseUser, { name: 'New Name' });
    expect(result.name).toBe('New Name');
    expect(result.id).toBe(baseUser.id);
  });

  it('awardPoints adds to totalPoints', () => {
    const result = awardPoints(baseUser, 50);
    expect(result.totalPoints).toBe(150);
  });

  it('completeLesson awards 100 points on first completion', () => {
    const result = completeLesson(baseUser, 'course_1', 'lesson_1');
    expect(result.totalPoints).toBe(200);
    expect(result.progress.course_1.completedLessonIds).toEqual(['lesson_1']);
  });

  it('completeLesson does not re-award points for an already-completed lesson', () => {
    const first = completeLesson(baseUser, 'course_1', 'lesson_1');
    const second = completeLesson(first, 'course_1', 'lesson_1');
    expect(second.totalPoints).toBe(first.totalPoints);
    expect(second.progress.course_1.completedLessonIds).toEqual(['lesson_1']);
  });

  it('weekly goal defaults to 5 hours and round-trips through storage', () => {
    expect(getWeeklyGoalHours()).toBe(5);
    setWeeklyGoalHours(12);
    expect(getWeeklyGoalHours()).toBe(12);
  });
});
