import { describe, it, expect, beforeEach } from 'vitest';
import { getSchedule, saveSchedule, ScheduledLessonItem } from '@/src/services/scheduleService';
import { Course } from '@/src/types';

const course: Course = {
  id: 'course_1',
  title: 'Course One',
  shortDescription: '',
  fullDescription: '',
  subject: 'stem_math',
  level: 'Beginner',
  type: 'interactive',
  instructor: { name: '', role: '', avatar: '' },
  rating: 5,
  enrolledCount: 0,
  estimatedHours: 1,
  thumbnail: '',
  badgeIcon: '',
  modules: [
    {
      id: 'mod_1',
      title: 'Module 1',
      lessons: [
        { id: 'l1', title: 'Lesson 1', durationMinutes: 25, sentences: [], drilldowns: {} },
        { id: 'l2', title: 'Lesson 2', durationMinutes: 30, sentences: [], drilldowns: {} },
      ],
    },
  ],
  prerequisites: [],
};

describe('scheduleService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('seeds a default schedule from the first course when nothing is stored', () => {
    const schedule = getSchedule([course]);
    expect(schedule.length).toBe(2);
    expect(schedule[0].courseId).toBe('course_1');
  });

  it('returns an empty schedule when there is nothing stored and no courses', () => {
    expect(getSchedule([])).toEqual([]);
  });

  it('saveSchedule persists items that getSchedule then returns verbatim', () => {
    const items: ScheduledLessonItem[] = [
      {
        id: 'sch_custom',
        day: 'Fri',
        courseId: 'course_1',
        courseTitle: 'Course One',
        lessonId: 'l1',
        lessonTitle: 'Lesson 1',
        durationMinutes: 25,
        completed: true,
      },
    ];
    saveSchedule(items);
    expect(getSchedule([course])).toEqual(items);
  });
});
