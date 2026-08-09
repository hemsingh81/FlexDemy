import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CourseOverviewScreen } from '@/src/features/CourseOverview/CourseOverviewScreen';
import * as reviewsService from '@/src/services/reviewsService';
import * as scratchpadService from '@/src/services/scratchpadService';
import { Course, CourseReview, ScratchpadNote, UserProgress } from '@/src/types';

vi.mock('@/src/services/reviewsService');
vi.mock('@/src/services/scratchpadService');

const course: Course = {
  id: 'course_1',
  title: 'Quantum Foundations',
  shortDescription: '',
  fullDescription: '',
  subject: 'physics',
  level: 'Beginner',
  type: 'interactive',
  instructor: { name: 'Dr. Rostova', role: 'Professor', avatar: '' },
  rating: 4.5,
  enrolledCount: 10,
  estimatedHours: 5,
  thumbnail: '',
  badgeIcon: '',
  modules: [
    {
      id: 'mod_1',
      title: 'Module 1',
      lessons: [
        { id: 'l1', title: 'Lesson 1', durationMinutes: 20, sentences: [], drilldowns: {} },
        { id: 'l2', title: 'Lesson 2', durationMinutes: 15, sentences: [], drilldowns: {} },
      ],
    },
  ],
  prerequisites: [],
};

const progress: UserProgress = {
  courseId: 'course_1',
  completedLessonIds: ['l1'],
  lastLessonId: 'l1',
  lastSentenceIndex: 0,
  assignmentScores: {},
  timeSpentSeconds: 600,
  enrolledDate: '2026-01-01',
};

const seededReview: CourseReview = {
  id: 'rev_1',
  courseId: 'course_1',
  userId: 'usr_peer_1',
  userName: 'Maya Lin',
  userAvatar: '',
  rating: 5,
  reviewText: 'Great course!',
  createdAt: '2 days ago',
};

const seededNote: ScratchpadNote = {
  id: 'note_1',
  courseId: 'course_1',
  lessonId: 'l1',
  lessonTitle: 'Lesson 1',
  paragraphIndex: 0,
  content: 'My saved note',
  createdAt: 'Yesterday',
  updatedAt: 'Yesterday',
};

describe('CourseOverviewScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reviewsService.getReviewsForCourse).mockReturnValue([seededReview]);
    vi.mocked(reviewsService.submitReview).mockReturnValue([seededReview]);
    vi.mocked(scratchpadService.getNotesForCourse).mockReturnValue([seededNote]);
    vi.mocked(scratchpadService.addNote).mockReturnValue([seededNote]);
  });

  it('renders course details and loads reviews/notes via the services', () => {
    render(
      <CourseOverviewScreen
        course={course}
        progress={progress}
        onStartLesson={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText('Quantum Foundations')).toBeInTheDocument();
    expect(reviewsService.getReviewsForCourse).toHaveBeenCalledWith('course_1');
    expect(scratchpadService.getNotesForCourse).toHaveBeenCalledWith('course_1');
    expect(screen.getByText('My saved note')).toBeInTheDocument();
    expect(screen.getByText('Maya Lin')).toBeInTheDocument();
  });

  it('calls onBack when the back button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(
      <CourseOverviewScreen
        course={course}
        progress={progress}
        onStartLesson={vi.fn()}
        onBack={onBack}
      />
    );

    await user.click(screen.getByText('Back to Courses'));
    expect(onBack).toHaveBeenCalled();
  });

  it('calls onStartLesson with the course id and last lesson when resuming', async () => {
    const user = userEvent.setup();
    const onStartLesson = vi.fn();
    render(
      <CourseOverviewScreen
        course={course}
        progress={progress}
        onStartLesson={onStartLesson}
        onBack={vi.fn()}
      />
    );

    await user.click(screen.getByText('Resume Course Learning'));
    expect(onStartLesson).toHaveBeenCalledWith('course_1', 'l1');
  });

  it('adds a quick study note through scratchpadService.addNote', async () => {
    const user = userEvent.setup();
    vi.mocked(scratchpadService.getNotesForCourse)
      .mockReturnValueOnce([seededNote])
      .mockReturnValue([{ ...seededNote, id: 'note_2', content: 'A new insight' }, seededNote]);

    render(
      <CourseOverviewScreen
        course={course}
        progress={progress}
        onStartLesson={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await user.type(
      screen.getByPlaceholderText(/Jot down a key insight/i),
      'A new insight'
    );
    await user.click(screen.getByText('Save Course Note'));

    expect(scratchpadService.addNote).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: 'course_1', content: 'A new insight' })
    );
    expect(screen.getByText('A new insight')).toBeInTheDocument();
  });
});
