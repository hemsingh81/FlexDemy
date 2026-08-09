import { describe, it, expect } from 'vitest';
import { getCourses, getCourseById, addCourse } from '@/src/services/coursesService';
import { Course } from '@/src/types';

const newCourse: Course = {
  id: 'course_new',
  title: 'Test Course',
  shortDescription: 'short',
  fullDescription: 'full',
  subject: 'stem_math',
  level: 'Beginner',
  type: 'interactive',
  instructor: { name: 'Jane', role: 'Instructor', avatar: '' },
  rating: 5,
  enrolledCount: 0,
  estimatedHours: 1,
  thumbnail: '',
  badgeIcon: '',
  modules: [],
  prerequisites: [],
};

describe('coursesService', () => {
  it('getCourses returns the seeded mock catalog', async () => {
    const courses = await getCourses();
    expect(courses.length).toBeGreaterThan(0);
  });

  it('getCourseById finds an existing course and returns undefined for an unknown id', async () => {
    const all = await getCourses();
    const found = await getCourseById(all[0].id);
    expect(found?.id).toBe(all[0].id);

    const missing = await getCourseById('does_not_exist');
    expect(missing).toBeUndefined();
  });

  it('addCourse prepends a new course to the catalog', async () => {
    const before = await getCourses();
    const after = await addCourse(newCourse);
    expect(after.length).toBe(before.length + 1);
    expect(after[0].id).toBe('course_new');
  });
});
