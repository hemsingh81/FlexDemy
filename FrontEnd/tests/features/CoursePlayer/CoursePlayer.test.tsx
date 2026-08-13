import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

  it('renders the Course Content tree nav and switches the reading pane to a selected node\'s ContentBlocks', async () => {
    const user = userEvent.setup();
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

    expect(screen.getByText('Course Content')).toBeInTheDocument();
    expect(screen.getByText('Subtopic 1: Introduction')).toBeInTheDocument();

    await user.click(screen.getByText('Subtopic 1: Introduction'));

    // Reading pane now renders the node's ContentBlocks instead of the legacy sentence.
    // Story 3.2 wraps this block's "wave"/"energy" keywords in their own <button>s (KeywordText),
    // so the sentence text is split across child nodes rather than being one text node -- match
    // against the paragraph's full textContent instead of an exact getByText string.
    expect(
      screen.getByText(
        (_, element) => element?.tagName.toLowerCase() === 'p' && element.textContent === 'A wave transfers energy without transferring matter.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('Welcome to the lesson.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Drill-Down/ })).toBeInTheDocument();
  });

  it('dismisses an open keyword popover when the selected content node changes, so it does not silently reopen on returning', async () => {
    const user = userEvent.setup();
    render(
      <CoursePlayer
        course={course}
        onBackToDashboard={vi.fn()}
        onOpenAssignment={vi.fn()}
        onCompleteLesson={vi.fn()}
      />
    );

    await user.click(screen.getByText('Subtopic 1: Introduction'));
    await user.click(screen.getByRole('button', { name: 'wave' }));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    // Switch away to a different node (topic_2 has no keyword-tagged text) and back.
    await user.click(screen.getByText('Topic 2: Chemical Reactions'));
    await user.click(screen.getByText('Subtopic 1: Introduction'));

    // The "wave" popover must not silently reappear -- it should only ever open in direct
    // response to a click/activation, never as a side effect of navigation.
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'wave' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not carry a stale typed/selected exercise answer across a switch to a different node', async () => {
    const user = userEvent.setup();
    render(
      <CoursePlayer
        course={course}
        onBackToDashboard={vi.fn()}
        onOpenAssignment={vi.fn()}
        onCompleteLesson={vi.fn()}
      />
    );

    // Subtopic 1 has a numeric exercise -- type an answer but do not submit it.
    await user.click(screen.getByText('Subtopic 1: Introduction'));
    await waitFor(() => expect(screen.getByTestId('exercise-runner')).toBeInTheDocument());
    await user.type(screen.getByLabelText('Your answer'), '3');
    expect(screen.getByLabelText('Your answer')).toHaveValue('3');

    // Switch to Subtopic 2, which has a multipleChoice exercise -- ExerciseRunner is the same
    // JSX position, so without a key it would be the same component instance.
    await user.click(screen.getByText('Subtopic 2: तरंग गति'));
    await waitFor(() => expect(screen.getAllByRole('radio').length).toBeGreaterThan(0));

    // No option should be pre-selected, and Submit must stay disabled until the student actually
    // picks one -- neither should reflect the leftover "3" typed into the previous node's input.
    screen.getAllByRole('radio').forEach((radio) => expect(radio).not.toBeChecked());
    expect(screen.getByRole('button', { name: 'Submit Answer' })).toBeDisabled();
  });

  it('opens the DrilldownPanel for the selected content node', async () => {
    const user = userEvent.setup();
    render(
      <CoursePlayer
        course={course}
        onBackToDashboard={vi.fn()}
        onOpenAssignment={vi.fn()}
        onCompleteLesson={vi.fn()}
      />
    );

    await user.click(screen.getByText('Subtopic 1: Introduction'));
    await user.click(screen.getByRole('button', { name: /Open Drill-Down/ }));

    expect(screen.getByText('Drill-Down')).toBeInTheDocument();
  });

  it('resets DrilldownPanel local state when switching nodeId without closing it (non-blocking slide-over)', async () => {
    const user = userEvent.setup();
    render(
      <CoursePlayer
        course={course}
        onBackToDashboard={vi.fn()}
        onOpenAssignment={vi.fn()}
        onCompleteLesson={vi.fn()}
      />
    );

    // Open Drill-Down for subtopic_1 and unlock + select Level 2 (useDrilldownContent has an
    // artificial mock-async delay, so wait for it to finish loading before interacting).
    await user.click(screen.getByText('Subtopic 1: Introduction'));
    await user.click(screen.getByRole('button', { name: /Open Drill-Down/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Explain more' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Explain more' }));
    await user.click(screen.getByRole('button', { name: /L2:/ }));
    expect(screen.getByRole('button', { name: /L2:/ })).toHaveAttribute('aria-current', 'true');

    // Without closing the panel (it's a non-blocking slide-over), select a different node behind
    // it and open Drill-Down for that node instead.
    await user.click(screen.getByText('Topic 2: Chemical Reactions'));
    await user.click(screen.getByRole('button', { name: /Open Drill-Down/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Explain more' })).toBeInTheDocument());

    // The new node's panel must start fresh: Level 1 selected, Level 2 locked again -- not
    // carrying over the previous node's selectedLevelNum/unlockedLevel.
    expect(screen.getByRole('button', { name: /L1:/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /L2:/ })).toBeDisabled();
  });
});
