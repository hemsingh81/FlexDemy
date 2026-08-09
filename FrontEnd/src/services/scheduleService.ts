import { Course } from '../types';

export type ScheduleDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface ScheduledLessonItem {
  id: string;
  day: ScheduleDay;
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  durationMinutes: number;
  completed: boolean;
}

const SCHEDULE_STORAGE_KEY = 'flexdemy_adaptive_schedule_v1';

const seedSchedule = (courses: Course[]): ScheduledLessonItem[] => {
  const c1 = courses[0];
  if (!c1) return [];
  const l1 = c1.modules[0]?.lessons[0];
  const l2 = c1.modules[0]?.lessons[1] || l1;

  return [
    {
      id: 'sch_1',
      day: 'Mon',
      courseId: c1.id,
      courseTitle: c1.title,
      lessonId: l1?.id || 'l1',
      lessonTitle: l1?.title || 'Key Concepts',
      durationMinutes: l1?.durationMinutes || 25,
      completed: true,
    },
    {
      id: 'sch_2',
      day: 'Wed',
      courseId: c1.id,
      courseTitle: c1.title,
      lessonId: l2?.id || 'l2',
      lessonTitle: l2?.title || 'Advanced Principles',
      durationMinutes: l2?.durationMinutes || 30,
      completed: false,
    },
  ];
};

export const getSchedule = (courses: Course[]): ScheduledLessonItem[] => {
  try {
    const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    if (courses.length > 0) {
      const seeded = seedSchedule(courses);
      localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return [];
  } catch (e) {
    console.error(e);
    return [];
  }
};

export const saveSchedule = (items: ScheduledLessonItem[]): void => {
  try {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error(e);
  }
};
