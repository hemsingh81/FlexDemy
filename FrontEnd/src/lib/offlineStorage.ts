import { UserProgress } from '../types';

export const OFFLINE_PROGRESS_STORAGE_KEY = 'flexdemy_offline_progress_v1';

export const saveProgressOffline = (courseId: string, progress: Partial<UserProgress>) => {
  try {
    const raw = localStorage.getItem(OFFLINE_PROGRESS_STORAGE_KEY);
    const existingMap: Record<string, UserProgress> = raw ? JSON.parse(raw) : {};

    const updatedProgress: UserProgress = {
      courseId,
      completedLessonIds: progress.completedLessonIds || existingMap[courseId]?.completedLessonIds || [],
      lastLessonId: progress.lastLessonId || existingMap[courseId]?.lastLessonId || '',
      lastSentenceIndex: progress.lastSentenceIndex ?? existingMap[courseId]?.lastSentenceIndex ?? 0,
      assignmentScores: progress.assignmentScores || existingMap[courseId]?.assignmentScores || {},
      timeSpentSeconds: progress.timeSpentSeconds || existingMap[courseId]?.timeSpentSeconds || 0,
      enrolledDate: progress.enrolledDate || existingMap[courseId]?.enrolledDate || new Date().toISOString().split('T')[0],
    };

    existingMap[courseId] = updatedProgress;
    localStorage.setItem(OFFLINE_PROGRESS_STORAGE_KEY, JSON.stringify(existingMap));
    return updatedProgress;
  } catch (e) {
    console.error('Failed to save offline progress to localStorage', e);
    return null;
  }
};

export const getOfflineProgressMap = (): Record<string, UserProgress> => {
  try {
    const raw = localStorage.getItem(OFFLINE_PROGRESS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};
