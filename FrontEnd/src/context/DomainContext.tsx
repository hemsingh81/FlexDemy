import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Course, UserProfile } from '../types';
import * as coursesService from '../services/coursesService';
import * as userService from '../services/userService';
import * as rolePermissionsService from '../services/rolePermissionsService';
import { getToken } from '../services/authService';

interface DomainContextValue {
  courses: Course[];
  user: UserProfile | null;
  isLoading: boolean;
  rolePermissions: Record<string, boolean> | null;
  ensureEnrolled: (courseId: string, lastLessonId?: string) => void;
  updateUser: (updates: Partial<UserProfile>) => void;
  awardPoints: (points: number) => void;
  completeLesson: (courseId: string, lessonId: string) => void;
  addCourse: (course: Course) => void;
  refreshRolePermissions: () => Promise<void>;
}

const DomainContext = createContext<DomainContextValue | undefined>(undefined);

export const DomainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rolePermissions, setRolePermissions] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    let cancelled = false;
    // rolePermissionsService.getMine() needs a bearer token, which doesn't exist yet at this
    // point (this effect fires on mount, before the user has signed in) -- skip the call
    // entirely rather than firing a doomed-to-401 request (and, in a test environment with a
    // real global fetch, potentially hanging on a connection to nothing). refreshRolePermissions()
    // below is what actually populates this for real, once signed in and a token exists.
    Promise.all([
      coursesService.getCourses(),
      userService.getInitialUser(),
      getToken() ? rolePermissionsService.getMine().catch(() => null) : Promise.resolve(null),
    ]).then(([c, u, rp]) => {
      if (cancelled) return;
      setCourses(c);
      setUser(u);
      setRolePermissions(rp);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const ensureEnrolled = useCallback((courseId: string, lastLessonId?: string) => {
    setUser((prev) => (prev ? userService.ensureEnrolled(prev, courseId, lastLessonId) : prev));
  }, []);

  const refreshRolePermissions = useCallback(async () => {
    try {
      const rp = await rolePermissionsService.getMine();
      setRolePermissions(rp);
    } catch (e) {
      setRolePermissions(null);
    }
  }, []);

  const updateUser = useCallback(
    (updates: Partial<UserProfile>) => {
      setUser((prev) => (prev ? userService.updateUser(prev, updates) : prev));
      // The permissions map is keyed by role -- a role change (login/register, profile
      // completion, tutor approval) makes the previously-fetched map stale, so re-fetch it
      // for the caller's new role rather than leaving it pointed at the old one.
      if (updates.role) {
        refreshRolePermissions();
      }
    },
    [refreshRolePermissions]
  );

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
      value={{
        courses,
        user,
        isLoading,
        rolePermissions,
        ensureEnrolled,
        updateUser,
        awardPoints,
        completeLesson,
        addCourse,
        refreshRolePermissions,
      }}
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
