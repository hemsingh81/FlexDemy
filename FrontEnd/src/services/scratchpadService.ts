import { ScratchpadNote } from '../types';

// Consolidates persistence that used to be duplicated independently in
// CourseOverviewScreen.tsx and CoursePlayer/ScratchpadPanel.tsx against the
// same localStorage key (see ARCHITECTURE-SPINE.md AD-1).
const SCRATCHPAD_STORAGE_KEY = 'flexdemy_scratchpad_notes_v1';

const readAll = (): ScratchpadNote[] => {
  try {
    const raw = localStorage.getItem(SCRATCHPAD_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export const getNotesForCourse = (courseId: string): ScratchpadNote[] => {
  return readAll().filter((n) => n.courseId === courseId);
};

export const addNote = (note: ScratchpadNote): ScratchpadNote[] => {
  const updated = [note, ...readAll()];
  try {
    localStorage.setItem(SCRATCHPAD_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save scratchpad note', e);
  }
  return updated;
};

export const saveNotesForCourse = (courseId: string, notesForCourse: ScratchpadNote[]): ScratchpadNote[] => {
  const others = readAll().filter((n) => n.courseId !== courseId);
  const updated = [...notesForCourse, ...others];
  try {
    localStorage.setItem(SCRATCHPAD_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save scratchpad notes', e);
  }
  return notesForCourse;
};
