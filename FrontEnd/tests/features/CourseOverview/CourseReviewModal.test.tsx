import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CourseReviewModal } from '@/src/features/CourseOverview/CourseReviewModal';
import * as reviewsService from '@/src/services/reviewsService';
import { Course, CourseReview } from '@/src/types';

vi.mock('@/src/services/reviewsService');

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
  modules: [],
  prerequisites: [],
};

const existingReview: CourseReview = {
  id: 'rev_1',
  courseId: 'course_1',
  userId: 'usr_peer_1',
  userName: 'Maya Lin',
  userAvatar: '',
  rating: 5,
  reviewText: 'Great course!',
  createdAt: '2 days ago',
};

describe('CourseReviewModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reviewsService.getReviewsForCourse).mockReturnValue([existingReview]);
    vi.mocked(reviewsService.submitReview).mockReturnValue([existingReview]);
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <CourseReviewModal course={course} isOpen={false} onClose={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('loads and displays existing reviews for the course via reviewsService', () => {
    render(<CourseReviewModal course={course} isOpen={true} onClose={vi.fn()} />);

    expect(reviewsService.getReviewsForCourse).toHaveBeenCalledWith('course_1');
    expect(screen.getByText('Maya Lin')).toBeInTheDocument();
    expect(screen.getByText('"Great course!"')).toBeInTheDocument();
  });

  it('submits a new review through reviewsService.submitReview and notifies via onSaveReview', async () => {
    const user = userEvent.setup();
    const onSaveReview = vi.fn();
    const newReviewsList: CourseReview[] = [
      {
        id: 'rev_new',
        courseId: 'course_1',
        userId: 'usr_101',
        userName: 'Hem Singh (You)',
        userAvatar: '',
        rating: 5,
        reviewText: 'Loved it',
        createdAt: 'Just now',
      },
      existingReview,
    ];
    vi.mocked(reviewsService.submitReview).mockReturnValue(newReviewsList);

    render(
      <CourseReviewModal course={course} isOpen={true} onClose={vi.fn()} onSaveReview={onSaveReview} />
    );

    await user.type(
      screen.getByPlaceholderText(/Share your experience/i),
      'Loved it'
    );
    await user.click(screen.getByRole('button', { name: /Submit Course Review/i }));

    expect(reviewsService.submitReview).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: 'course_1', reviewText: 'Loved it', rating: 5 })
    );
    expect(onSaveReview).toHaveBeenCalledWith('course_1', 5, 'Loved it');
    expect(screen.getByText(/Thank you! Your 5-star review has been published/i)).toBeInTheDocument();
  });

  it('does not submit an empty review', async () => {
    const user = userEvent.setup();
    render(<CourseReviewModal course={course} isOpen={true} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Submit Course Review/i }));

    expect(reviewsService.submitReview).not.toHaveBeenCalled();
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CourseReviewModal course={course} isOpen={true} onClose={onClose} />);

    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);

    expect(onClose).toHaveBeenCalled();
  });
});
