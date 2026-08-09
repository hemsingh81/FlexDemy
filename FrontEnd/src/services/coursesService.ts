import { Course } from '../types';
import { MOCK_COURSES } from '../data/mockData';

// In-memory store standing in for a backend today. Async signatures match
// what a future REST/API client would expose (see ARCHITECTURE-SPINE.md AD-1) --
// swapping the implementation below is the only change needed to go live.
let courses: Course[] = MOCK_COURSES;

export const getCourses = async (): Promise<Course[]> => {
  return courses;
};

export const getCourseById = async (courseId: string): Promise<Course | undefined> => {
  return courses.find((c) => c.id === courseId);
};

export const addCourse = async (newCourse: Course): Promise<Course[]> => {
  courses = [newCourse, ...courses];
  return courses;
};
