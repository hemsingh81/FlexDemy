import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoursePlayer } from '@/src/features/CoursePlayer/CoursePlayer';
import * as userService from '@/src/services/userService';
import * as scratchpadService from '@/src/services/scratchpadService';
import { Course } from '@/src/types';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('@/src/services/userService');
vi.mock('@/src/services/scratchpadService');
vi.mock('@/src/features/CourseOverview/CourseReviewModal', () => ({
  CourseReviewModal: () => null,
}));

// jsdom does not implement scrollIntoView; ReaderCanvas calls it to keep the
// active sentence in view.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(scratchpadService.getNotesForCourse).mockReturnValue([]);
});

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
  modules: [
    {
      id: 'mod_1',
      title: 'Module 1',
      lessons: [
        {
          id: 'l1',
          title: 'Lesson 1',
          durationMinutes: 20,
          sentences: [{ id: 's1', text: 'Welcome to the lesson.' }],
          drilldowns: {},
        },
        {
          id: 'l2',
          title: 'Lesson 2',
          durationMinutes: 15,
          sentences: [{ id: 's2', text: 'A second lesson sentence.' }],
          drilldowns: {},
        },
      ],
    },
  ],
  prerequisites: [],
};

describe('CoursePlayer', () => {
  it('renders the course title and the current lesson', () => {
    render(
      <CoursePlayer
        course={course}
        onBackToDashboard={vi.fn()}
        onOpenAssignment={vi.fn()}
        onCompleteLesson={vi.fn()}
      />
    );

    expect(screen.getByText('Quantum Foundations')).toBeInTheDocument();
    expect(screen.getAllByText('Lesson 1').length).toBeGreaterThan(0);
    expect(screen.getByText('Welcome to the lesson.')).toBeInTheDocument();
  });

  it('calls onCompleteLesson when the current lesson is marked complete, and persists progress via userService', async () => {
    const onCompleteLesson = vi.fn();
    const user = userEvent.setup();
    render(
      <CoursePlayer
        course={course}
        onBackToDashboard={vi.fn()}
        onOpenAssignment={vi.fn()}
        onCompleteLesson={onCompleteLesson}
      />
    );

    await user.click(screen.getByText('Mark Complete & Next'));

    expect(onCompleteLesson).toHaveBeenCalledWith('course_1', 'l1');
    expect(userService.saveLessonProgress).toHaveBeenCalledWith(
      'course_1',
      expect.objectContaining({ lastLessonId: 'l1' })
    );
  });

  it('routes lesson progress through userService.saveLessonProgress rather than lib/offlineStorage directly', () => {
    render(
      <CoursePlayer
        course={course}
        onBackToDashboard={vi.fn()}
        onOpenAssignment={vi.fn()}
        onCompleteLesson={vi.fn()}
      />
    );

    expect(userService.saveLessonProgress).toHaveBeenCalledWith(
      'course_1',
      expect.objectContaining({ lastLessonId: 'l1', lastSentenceIndex: 0 })
    );
  });
});
