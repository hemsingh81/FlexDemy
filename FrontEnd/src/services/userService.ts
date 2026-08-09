import { UserProfile, UserProgress, LeaderboardUser } from '../types';
import { INITIAL_USER, MOCK_LEADERBOARD } from '../data/mockData';
import { saveProgressOffline } from '../lib/offlineStorage';

const WEEKLY_GOAL_STORAGE_KEY = 'flexdemy_weekly_goal_v1';

// Async signatures match what a future REST/API client would expose
// (see ARCHITECTURE-SPINE.md AD-1) -- swapping the implementation below
// is the only change needed to go live.
export const getInitialUser = async (): Promise<UserProfile> => {
  return INITIAL_USER;
};

export const getLeaderboard = async (): Promise<LeaderboardUser[]> => {
  return MOCK_LEADERBOARD;
};

const blankProgress = (courseId: string, lastLessonId: string): UserProgress => ({
  courseId,
  completedLessonIds: [],
  lastLessonId,
  lastSentenceIndex: 0,
  assignmentScores: {},
  timeSpentSeconds: 0,
  enrolledDate: new Date().toISOString().split('T')[0],
});

export const ensureEnrolled = (user: UserProfile, courseId: string, lastLessonId = 'qc_l1'): UserProfile => {
  if (user.progress[courseId]) return user;
  return {
    ...user,
    progress: {
      ...user.progress,
      [courseId]: blankProgress(courseId, lastLessonId),
    },
  };
};

export const updateUser = (user: UserProfile, updates: Partial<UserProfile>): UserProfile => ({
  ...user,
  ...updates,
});

export const awardPoints = (user: UserProfile, points: number): UserProfile => ({
  ...user,
  totalPoints: user.totalPoints + points,
});

export const completeLesson = (user: UserProfile, courseId: string, lessonId: string): UserProfile => {
  const existingProg = user.progress[courseId] || blankProgress(courseId, lessonId);
  const isNewCompletion = !existingProg.completedLessonIds.includes(lessonId);
  const updatedCompleted = isNewCompletion
    ? [...existingProg.completedLessonIds, lessonId]
    : existingProg.completedLessonIds;

  return {
    ...user,
    totalPoints: isNewCompletion ? user.totalPoints + 100 : user.totalPoints,
    progress: {
      ...user.progress,
      [courseId]: {
        ...existingProg,
        completedLessonIds: updatedCompleted,
        lastLessonId: lessonId,
      },
    },
  };
};

// Wraps lib/offlineStorage.ts -- the only caller allowed per AD-1.
export const saveLessonProgress = (courseId: string, progress: Partial<UserProgress>) => {
  return saveProgressOffline(courseId, progress);
};

export const getWeeklyGoalHours = (): number => {
  try {
    const saved = localStorage.getItem(WEEKLY_GOAL_STORAGE_KEY);
    return saved ? Math.max(1, parseInt(saved, 10)) : 5;
  } catch (e) {
    return 5;
  }
};

export const setWeeklyGoalHours = (hours: number): void => {
  try {
    localStorage.setItem(WEEKLY_GOAL_STORAGE_KEY, String(hours));
  } catch (e) {
    console.error('Failed to save weekly goal to localStorage', e);
  }
};
