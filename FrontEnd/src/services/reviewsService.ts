import { CourseReview } from '../types';

const STORAGE_REVIEWS_KEY = 'flexdemy_course_reviews_v2';

const readAll = (): CourseReview[] => {
  try {
    const raw = localStorage.getItem(STORAGE_REVIEWS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

const seedReview = (courseId: string): CourseReview => ({
  id: `seed_${courseId}_1`,
  courseId,
  userId: 'usr_peer_1',
  userName: 'Maya Lin',
  userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
  rating: 5,
  reviewText:
    'Outstanding course structure! The 5-level deep explanations and synchronized TTS narrator made complex concepts extremely easy to grasp.',
  createdAt: '2 days ago',
});

export const getReviewsForCourse = (courseId: string): CourseReview[] => {
  const forCourse = readAll().filter((r) => r.courseId === courseId);
  return forCourse.length > 0 ? forCourse : [seedReview(courseId)];
};

export const submitReview = (review: CourseReview): CourseReview[] => {
  const updated = [review, ...readAll()];
  try {
    localStorage.setItem(STORAGE_REVIEWS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save course review to localStorage', e);
  }
  return updated.filter((r) => r.courseId === review.courseId);
};
