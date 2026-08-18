import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoursePlayer } from '@/src/features/CoursePlayer/CoursePlayer';
import * as userService from '@/src/services/userService';
import * as scratchpadService from '@/src/services/scratchpadService';
import * as courseContentService from '@/src/services/courseContentService';
import type { OutlineDto, PageDocumentDto } from '@/src/services/courseContentService';
import { Course } from '@/src/types';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('@/src/services/userService');
vi.mock('@/src/services/scratchpadService');
vi.mock('@/src/services/courseContentService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseContentService')>('@/src/services/courseContentService');
  return { ...actual, getOutline: vi.fn(), getPage: vi.fn(), resolveResourceUrl: vi.fn() };
});
vi.mock('@/src/features/CourseOverview/CourseReviewModal', () => ({
  CourseReviewModal: () => null,
}));

const EMPTY_OUTLINE: OutlineDto = { chapters: [] };

// jsdom does not implement scrollIntoView; ReaderCanvas calls it to keep the
// active sentence in view.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(scratchpadService.getNotesForCourse).mockReturnValue([]);
  vi.mocked(courseContentService.getOutline).mockResolvedValue(EMPTY_OUTLINE);
});

const makeOutlineWithOnePage = (): OutlineDto => ({
  chapters: [
    {
      id: 'chapter_1',
      title: 'Waves',
      description: '',
      isConfirmed: true,
      order: 0,
      pages: [{ id: 'page_1', title: 'Lecture Notes', isConfirmed: true, order: 0 }],
      topics: [],
    },
  ],
});

const makePageDto = (overrides: Partial<PageDocumentDto> = {}): PageDocumentDto => ({
  id: 'page_1',
  title: 'Lecture Notes',
  bodyMarkdown: 'A wave transfers energy without transferring matter.',
  isConfirmed: true,
  order: 0,
  resources: [],
  ...overrides,
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

  // Story 11.4, AC #1: real Chapter/Topic/Sub-Topic/Page outline navigation, replacing the old
  // flat uploaded-file list.
  it('fetches this course real outline and lists its Pages in the sidebar tree', async () => {
    vi.mocked(courseContentService.getOutline).mockResolvedValue(makeOutlineWithOnePage());
    render(
      <CoursePlayer
        course={course}
        onBackToDashboard={vi.fn()}
        onOpenAssignment={vi.fn()}
        onCompleteLesson={vi.fn()}
      />
    );

    await waitFor(() => expect(courseContentService.getOutline).toHaveBeenCalledWith('course_1'));
    expect(await screen.findByText('Waves')).toBeInTheDocument();
    expect(await screen.findByText('Lecture Notes')).toBeInTheDocument();
  });

  it('selecting a Page fetches its body via getPage (one page at a time) and renders it through MarkdownViewer', async () => {
    const user = userEvent.setup();
    vi.mocked(courseContentService.getOutline).mockResolvedValue(makeOutlineWithOnePage());
    vi.mocked(courseContentService.getPage).mockResolvedValue(makePageDto());
    render(
      <CoursePlayer
        course={course}
        onBackToDashboard={vi.fn()}
        onOpenAssignment={vi.fn()}
        onCompleteLesson={vi.fn()}
      />
    );

    // Legacy sentence-based reading pane is shown by default.
    expect(screen.getByText('Welcome to the lesson.')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Lecture Notes' }));

    expect(courseContentService.getPage).toHaveBeenCalledWith('course_1', 'page_1');
    expect(await screen.findByText('A wave transfers energy without transferring matter.')).toBeInTheDocument();
    expect(screen.queryByText('Welcome to the lesson.')).not.toBeInTheDocument();
  });

  it('shows a friendly state, not a blank pane, when the selected Page fails to load', async () => {
    const user = userEvent.setup();
    vi.mocked(courseContentService.getOutline).mockResolvedValue(makeOutlineWithOnePage());
    vi.mocked(courseContentService.getPage).mockRejectedValue(new Error('not found'));
    render(
      <CoursePlayer
        course={course}
        onBackToDashboard={vi.fn()}
        onOpenAssignment={vi.fn()}
        onCompleteLesson={vi.fn()}
      />
    );

    await user.click(await screen.findByRole('button', { name: 'Lecture Notes' }));

    expect(await screen.findByText(/could not load this page/i)).toBeInTheDocument();
  });

  it('does not render the outline tree section when the course has no authored content yet', async () => {
    render(
      <CoursePlayer
        course={course}
        onBackToDashboard={vi.fn()}
        onOpenAssignment={vi.fn()}
        onCompleteLesson={vi.fn()}
      />
    );

    await waitFor(() => expect(courseContentService.getOutline).toHaveBeenCalled());
    expect(screen.queryByRole('tree', { name: 'Course content' })).not.toBeInTheDocument();
  });
});
