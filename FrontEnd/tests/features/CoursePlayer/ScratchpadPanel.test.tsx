import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScratchpadPanel } from '@/src/features/CoursePlayer/ScratchpadPanel';
import * as scratchpadService from '@/src/services/scratchpadService';
import { Course, Lesson, Module, ScratchpadNote } from '@/src/types';

vi.mock('@/src/services/scratchpadService');

const lesson: Lesson = {
  id: 'l1',
  title: 'Lesson 1',
  durationMinutes: 20,
  sentences: [{ id: 's1', text: 'Welcome to the lesson.' }],
  drilldowns: {},
};

const mod: Module = {
  id: 'mod_1',
  title: 'Module 1',
  lessons: [lesson],
};

const course: Course = {
  id: 'course_1',
  title: 'Quantum Foundations',
  shortDescription: '',
  fullDescription: '',
  subject: 'physics',
  level: 'Beginner',
  type: 'interactive',
  instructor: { name: 'Dr. Rostova', role: 'Professor', avatar: '' },
  rating: 5,
  enrolledCount: 10,
  estimatedHours: 5,
  thumbnail: '',
  badgeIcon: '',
  modules: [mod],
  prerequisites: [],
};

const existingNote: ScratchpadNote = {
  id: 'note_1',
  courseId: 'course_1',
  lessonId: 'l1',
  lessonTitle: 'Lesson 1',
  content: 'An existing note',
  createdAt: 'Jan 1',
  updatedAt: new Date().toISOString(),
};

describe('ScratchpadPanel', () => {
  beforeEach(() => {
    vi.mocked(scratchpadService.getNotesForCourse).mockReturnValue([existingNote]);
    vi.mocked(scratchpadService.addNote).mockReturnValue([existingNote]);
    vi.mocked(scratchpadService.saveNotesForCourse).mockReturnValue([]);
  });

  it('loads notes for the course via scratchpadService and renders them', () => {
    render(
      <ScratchpadPanel
        course={course}
        currentLesson={lesson}
        currentModule={mod}
        currentParagraphIndex={0}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(scratchpadService.getNotesForCourse).toHaveBeenCalledWith('course_1');
    expect(screen.getByText('An existing note')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <ScratchpadPanel
        course={course}
        currentLesson={lesson}
        currentModule={mod}
        currentParagraphIndex={0}
        isOpen={false}
        onClose={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('adding a note calls scratchpadService.addNote with the note content, never touching localStorage directly', async () => {
    const newNoteFromService: ScratchpadNote = { ...existingNote, id: 'note_2', content: 'A brand new note' };
    vi.mocked(scratchpadService.addNote).mockReturnValue([newNoteFromService, existingNote]);

    const user = userEvent.setup();
    render(
      <ScratchpadPanel
        course={course}
        currentLesson={lesson}
        currentModule={mod}
        currentParagraphIndex={0}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText(/Type your notes/i), 'A brand new note');
    await user.click(screen.getByText('Save Note'));

    expect(scratchpadService.addNote).toHaveBeenCalledTimes(1);
    expect(scratchpadService.addNote).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: 'course_1',
        lessonId: 'l1',
        content: 'A brand new note',
      })
    );
    expect(screen.getByText('A brand new note')).toBeInTheDocument();
  });

  it('deleting a note calls scratchpadService.saveNotesForCourse with the remaining notes', async () => {
    const user = userEvent.setup();
    render(
      <ScratchpadPanel
        course={course}
        currentLesson={lesson}
        currentModule={mod}
        currentParagraphIndex={0}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByTitle('Delete note'));

    expect(scratchpadService.saveNotesForCourse).toHaveBeenCalledWith('course_1', []);
  });
});
