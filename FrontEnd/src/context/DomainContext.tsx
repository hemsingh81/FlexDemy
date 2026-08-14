import React, { createContext, useCallback, useContext } from 'react';
import { Course, UserProfile } from '../types';
import * as coursesService from '../services/coursesService';
import * as userService from '../services/userService';
import * as rolePermissionsService from '../services/rolePermissionsService';
import { getToken } from '../services/authService';
import { useAsync } from '../hooks/useAsync';

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

interface InitialDomainData {
  courses: Course[];
  user: UserProfile | null;
  rolePermissions: Record<string, boolean> | null;
}

const EMPTY_INITIAL_DATA: InitialDomainData = { courses: [], user: null, rolePermissions: null };

export const DomainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // rolePermissionsService.getMine() needs a bearer token, which doesn't exist yet at this
  // point (this fetch fires on mount, before the user has signed in) -- skip the call entirely
  // rather than firing a doomed-to-401 request (and, in a test environment with a real global
  // fetch, potentially hanging on a connection to nothing). refreshRolePermissions() below is
  // what actually populates this for real, once signed in and a token exists.
  const { data, setData, isLoading } = useAsync<InitialDomainData>(
    () =>
      Promise.all([
        coursesService.getCourses(),
        userService.getInitialUser(),
        getToken() ? rolePermissionsService.getMine().catch(() => null) : Promise.resolve(null),
      ]).then(([c, u, rp]) => ({ courses: c, user: u, rolePermissions: rp })),
    EMPTY_INITIAL_DATA,
    []
  );
  const { courses, user, rolePermissions } = data;

  const ensureEnrolled = useCallback((courseId: string, lastLessonId?: string) => {
    setData((prev) => (prev.user ? { ...prev, user: userService.ensureEnrolled(prev.user, courseId, lastLessonId) } : prev));
  }, [setData]);

  const refreshRolePermissions = useCallback(async () => {
    try {
      const rp = await rolePermissionsService.getMine();
      setData((prev) => ({ ...prev, rolePermissions: rp }));
    } catch (e) {
      setData((prev) => ({ ...prev, rolePermissions: null }));
    }
  }, [setData]);

  const updateUser = useCallback(
    (updates: Partial<UserProfile>) => {
      setData((prev) => (prev.user ? { ...prev, user: userService.updateUser(prev.user, updates) } : prev));
      // The permissions map is keyed by role -- a role change (login/register, profile
      // completion, tutor approval) makes the previously-fetched map stale, so re-fetch it
      // for the caller's new role rather than leaving it pointed at the old one.
      if (updates.role) {
        refreshRolePermissions();
      }
    },
    [setData, refreshRolePermissions]
  );

  const awardPoints = useCallback((points: number) => {
    setData((prev) => (prev.user ? { ...prev, user: userService.awardPoints(prev.user, points) } : prev));
  }, [setData]);

  const completeLesson = useCallback((courseId: string, lessonId: string) => {
    setData((prev) => (prev.user ? { ...prev, user: userService.completeLesson(prev.user, courseId, lessonId) } : prev));
  }, [setData]);

  const addCourse = useCallback((newCourse: Course) => {
    coursesService.addCourse(newCourse).then((c) => setData((prev) => ({ ...prev, courses: c })));
  }, [setData]);

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
