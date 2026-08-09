import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Course, UserProfile } from '../types';
import * as coursesService from '../services/coursesService';
import * as userService from '../services/userService';

interface DomainContextValue {
  courses: Course[];
  user: UserProfile | null;
  isLoading: boolean;
  ensureEnrolled: (courseId: string, lastLessonId?: string) => void;
  updateUser: (updates: Partial<UserProfile>) => void;
  awardPoints: (points: number) => void;
  completeLesson: (courseId: string, lessonId: string) => void;
  addCourse: (course: Course) => void;
}

const DomainContext = createContext<DomainContextValue | undefined>(undefined);

export const DomainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([coursesService.getCourses(), userService.getInitialUser()]).then(([c, u]) => {
      if (cancelled) return;
      setCourses(c);
      setUser(u);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const ensureEnrolled = useCallback((courseId: string, lastLessonId?: string) => {
    setUser((prev) => (prev ? userService.ensureEnrolled(prev, courseId, lastLessonId) : prev));
  }, []);

  const updateUser = useCallback((updates: Partial<UserProfile>) => {
    setUser((prev) => (prev ? userService.updateUser(prev, updates) : prev));
  }, []);

  const awardPoints = useCallback((points: number) => {
    setUser((prev) => (prev ? userService.awardPoints(prev, points) : prev));
  }, []);

  const completeLesson = useCallback((courseId: string, lessonId: string) => {
    setUser((prev) => (prev ? userService.completeLesson(prev, courseId, lessonId) : prev));
  }, []);

  const addCourse = useCallback((newCourse: Course) => {
    coursesService.addCourse(newCourse).then(setCourses);
  }, []);

  return (
    <DomainContext.Provider
      value={{ courses, user, isLoading, ensureEnrolled, updateUser, awardPoints, completeLesson, addCourse }}
    >
      {children}
    </DomainContext.Provider>
  );
};

export const useDomain = (): DomainContextValue => {
  const ctx = useContext(DomainContext);
  if (!ctx) throw new Error('useDomain must be used within a DomainProvider');
  return ctx;
};
