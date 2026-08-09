import React, { useState, useEffect } from 'react';
import { Star, X, MessageSquare, Send, ThumbsUp, UserCheck, Sparkles } from 'lucide-react';
import { Course, CourseReview } from '../types';

interface CourseReviewModalProps {
  course: Course;
  isOpen: boolean;
  onClose: () => void;
  onSaveReview?: (courseId: string, rating: number, reviewText: string) => void;
}

export const STORAGE_REVIEWS_KEY = 'learnsphere_course_reviews_v2';

export const getStoredReviewsForCourse = (courseId: string): CourseReview[] => {
  try {
    const raw = localStorage.getItem(STORAGE_REVIEWS_KEY);
    if (!raw) return [];
    const allReviews: CourseReview[] = JSON.parse(raw);
    return allReviews.filter((r) => r.courseId === courseId);
  } catch (e) {
    return [];
  }
};

export const saveCourseReview = (review: CourseReview) => {
  try {
    const raw = localStorage.getItem(STORAGE_REVIEWS_KEY);
    const allReviews: CourseReview[] = raw ? JSON.parse(raw) : [];
    const updated = [review, ...allReviews];
    localStorage.setItem(STORAGE_REVIEWS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    return [];
  }
};

export const CourseReviewModal: React.FC<CourseReviewModalProps> = ({
  course,
  isOpen,
  onClose,
  onSaveReview,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>('');
  const [reviewsList, setReviewsList] = useState<CourseReview[]>([]);
  const [submittedToast, setSubmittedToast] = useState<boolean>(false);

  useEffect(() => {
    if (course) {
      const stored = getStoredReviewsForCourse(course.id);
      
      // Seed default initial review if list is empty
      if (stored.length === 0) {
        const seedReview: CourseReview = {
          id: `seed_${course.id}_1`,
          courseId: course.id,
          userId: 'usr_peer_1',
          userName: 'Maya Lin',
          userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
          rating: 5,
          reviewText: `Outstanding course structure! The 5-level deep explanations and synchronized TTS narrator made complex concepts extremely easy to grasp.`,
          createdAt: '2 days ago',
        };
        setReviewsList([seedReview]);
      } else {
        setReviewsList(stored);
      }
    }
  }, [course]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewText.trim()) return;

    const newReview: CourseReview = {
      id: `rev_${Date.now()}`,
      courseId: course.id,
      userId: 'usr_101',
      userName: 'Alex Rivera (You)',
      userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      rating,
      reviewText: reviewText.trim(),
      createdAt: 'Just now',
    };

    saveCourseReview(newReview);
    setReviewsList((prev) => [newReview, ...prev]);
    if (onSaveReview) {
      onSaveReview(course.id, rating, reviewText.trim());
    }

    setReviewText('');
    setSubmittedToast(true);
    setTimeout(() => setSubmittedToast(false), 3000);
  };

  if (!isOpen) return null;

  const currentDisplayRating = hoverRating || rating;
  const avgRating =
    reviewsList.length > 0
      ? (reviewsList.reduce((acc, r) => acc + r.rating, 0) / reviewsList.length).toFixed(1)
      : course.rating.toFixed(1);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-[#E1DED4] shadow-2xl p-6 space-y-6 relative max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E1DED4] pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[#EC7B38] text-white shadow-xs">
              <Star className="w-5 h-5 fill-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#142030]">Course Rating & Reviews</h3>
              <p className="text-xs text-[#5E6A79] truncate max-w-[260px] font-semibold">
                {course.title}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#5E6A79] hover:text-[#142030] rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Rating Summary Header */}
        <div className="p-4 bg-[#FAF7EC] rounded-2xl border border-[#E1DED4] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-3xl font-extrabold text-[#142030]">{avgRating}</span>
            <div>
              <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= Math.round(Number(avgRating))
                        ? 'text-amber-500 fill-amber-500'
                        : 'text-slate-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-[#5E6A79] font-medium mt-0.5 block">
                Based on {reviewsList.length} student reviews
              </span>
            </div>
          </div>

          <span className="text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-full bg-[#143358] text-white">
            Verified Student Reviews
          </span>
        </div>

        {/* Success Toast */}
        {submittedToast && (
          <div className="p-3 bg-[#179765] text-white rounded-xl text-xs font-bold text-center flex items-center justify-center space-x-2 animate-bounce">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Thank you! Your 5-star review has been published.</span>
          </div>
        )}

        {/* Submit Review Form */}
        <form onSubmit={handleSubmit} className="p-4 bg-white rounded-2xl border border-[#E1DED4] shadow-2xs space-y-4">
          <h4 className="text-xs font-extrabold text-[#142030] uppercase tracking-wider flex items-center space-x-1.5">
            <MessageSquare className="w-4 h-4 text-[#EC7B38]" />
            <span>Leave Your Review</span>
          </h4>

          {/* Interactive Star Picker */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-[#5E6A79]">Your Rating:</span>
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-1 focus:outline-none transition-transform hover:scale-125 cursor-pointer"
                >
                  <Star
                    className={`w-6 h-6 transition-colors ${
                      star <= currentDisplayRating
                        ? 'text-amber-500 fill-amber-500'
                        : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <span className="text-xs font-extrabold text-[#EC7B38] ml-2">
              {currentDisplayRating}/5
            </span>
          </div>

          {/* Review Textarea */}
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Share your experience, what you enjoyed about the lesson explanations, or tips for future students..."
            rows={3}
            className="w-full p-3 rounded-xl bg-[#FAF7EC] border border-[#E1DED4] text-xs text-[#142030] placeholder-[#5E6A79] focus:outline-none focus:ring-2 focus:ring-[#EC7B38] resize-none"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!reviewText.trim()}
              className="px-4 py-2 bg-[#143358] hover:bg-[#143358]/90 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Course Review</span>
            </button>
          </div>
        </form>

        {/* Existing Student Reviews List */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-extrabold text-[#142030] uppercase tracking-wider">
            Student Feedback ({reviewsList.length})
          </h4>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {reviewsList.map((rev) => (
              <div
                key={rev.id}
                className="p-3.5 bg-[#FAF7EC]/80 rounded-2xl border border-[#E1DED4] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <img
                      src={rev.userAvatar}
                      alt={rev.userName}
                      className="w-6 h-6 rounded-full object-cover border border-[#E1DED4]"
                    />
                    <span className="text-xs font-bold text-[#142030]">{rev.userName}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3 h-3 ${
                          s <= rev.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-xs text-[#5E6A79] leading-relaxed">
                  "{rev.reviewText}"
                </p>

                <div className="flex items-center justify-between text-[10px] text-[#5E6A79] pt-1">
                  <span>{rev.createdAt}</span>
                  <span className="flex items-center space-x-1 text-[#179765] font-semibold">
                    <UserCheck className="w-3 h-3" />
                    <span>Verified Completion</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
