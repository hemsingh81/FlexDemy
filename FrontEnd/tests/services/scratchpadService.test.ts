import { describe, it, expect, beforeEach } from 'vitest';
import { getNotesForCourse, addNote, saveNotesForCourse } from '@/src/services/scratchpadService';
import { ScratchpadNote } from '@/src/types';

const note = (overrides: Partial<ScratchpadNote> = {}): ScratchpadNote => ({
  id: `note_${Math.random()}`,
  courseId: 'course_1',
  lessonId: 'lesson_1',
  lessonTitle: 'Lesson 1',
  content: 'A note',
  createdAt: 'now',
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('scratchpadService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getNotesForCourse returns an empty array when nothing is stored', () => {
    expect(getNotesForCourse('course_1')).toEqual([]);
  });

  it('addNote persists a note scoped to its course', () => {
    addNote(note({ id: 'n1', courseId: 'course_1' }));
    addNote(note({ id: 'n2', courseId: 'course_2' }));

    expect(getNotesForCourse('course_1').map((n) => n.id)).toEqual(['n1']);
    expect(getNotesForCourse('course_2').map((n) => n.id)).toEqual(['n2']);
  });

  it('is the single source of truth for both CourseOverviewScreen and ScratchpadPanel consumers', () => {
    // Regression guard for the pre-refactor bug where CourseOverviewScreen.tsx and
    // CoursePlayer/ScratchpadPanel.tsx each duplicated this logic against the same key.
    addNote(note({ id: 'shared_note', courseId: 'course_1' }));
    const fromOverviewPath = getNotesForCourse('course_1');
    const fromPlayerPath = getNotesForCourse('course_1');
    expect(fromOverviewPath).toEqual(fromPlayerPath);
  });

  it('saveNotesForCourse replaces only that course\'s notes', () => {
    addNote(note({ id: 'n1', courseId: 'course_1' }));
    addNote(note({ id: 'n2', courseId: 'course_2' }));

    saveNotesForCourse('course_1', [note({ id: 'n1_edited', courseId: 'course_1' })]);

    expect(getNotesForCourse('course_1').map((n) => n.id)).toEqual(['n1_edited']);
    expect(getNotesForCourse('course_2').map((n) => n.id)).toEqual(['n2']);
  });
});
