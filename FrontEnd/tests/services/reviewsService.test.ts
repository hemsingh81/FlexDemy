import { describe, it, expect, beforeEach } from 'vitest';
import { getReviewsForCourse, submitReview } from '@/src/services/reviewsService';
import { CourseReview } from '@/src/types';

describe('reviewsService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns a seeded default review when nothing is stored for the course', () => {
    const reviews = getReviewsForCourse('course_1');
    expect(reviews.length).toBe(1);
    expect(reviews[0].courseId).toBe('course_1');
  });

  it('submitReview persists a review and getReviewsForCourse then returns it instead of the seed', () => {
    const review: CourseReview = {
      id: 'rev_1',
      courseId: 'course_1',
      userId: 'usr_1',
      userName: 'Test User',
      userAvatar: '',
      rating: 4,
      reviewText: 'Great course',
      createdAt: 'Just now',
    };
    submitReview(review);

    const reviews = getReviewsForCourse('course_1');
    expect(reviews).toHaveLength(1);
    expect(reviews[0].id).toBe('rev_1');
  });

  it('keeps reviews scoped per course', () => {
    submitReview({
      id: 'rev_a',
      courseId: 'course_a',
      userId: 'usr_1',
      userName: 'A',
      userAvatar: '',
      rating: 5,
      reviewText: 'a',
      createdAt: 'now',
    });

    expect(getReviewsForCourse('course_b')[0].id).toBe('seed_course_b_1');
  });
});
