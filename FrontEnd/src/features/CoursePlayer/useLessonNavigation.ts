import { useEffect, useMemo, useState } from 'react';
import { Course, Lesson } from '../../types';
import { saveLessonProgress } from '../../services/userService';

// Extracted from CoursePlayer.tsx: owns which lesson/paragraph is currently open, persists
// reading progress locally, and exposes the sentence-level skip/advance actions. `allLessons` is
// memoized off `course` so it isn't recomputed on every render (it previously was a plain
// `flatMap` call in the component body).
export const useLessonNavigation = (course: Course, initialLessonId?: string) => {
  const allLessons = useMemo(() => course.modules.flatMap((m) => m.lessons), [course]);

  const [currentLessonId, setCurrentLessonId] = useState<string>(
    initialLessonId || allLessons[0]?.id || ''
  );
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);

  // Save lesson reading progress locally for offline resilience
  useEffect(() => {
    if (course?.id && currentLessonId) {
      saveLessonProgress(course.id, {
        lastLessonId: currentLessonId,
        lastSentenceIndex: currentSentenceIndex,
      });
    }
  }, [course?.id, currentLessonId, currentSentenceIndex]);

  const currentLesson: Lesson = allLessons.find((l) => l.id === currentLessonId) || allLessons[0];
  const sentences = currentLesson?.sentences || [];

  const goToLesson = (lessonId: string) => {
    setCurrentLessonId(lessonId);
    setCurrentSentenceIndex(0);
  };

  const handleSkipNext = () => {
    if (currentSentenceIndex < sentences.length - 1) {
      setCurrentSentenceIndex((prev) => prev + 1);
    }
  };

  const handleSkipPrev = () => {
    if (currentSentenceIndex > 0) {
      setCurrentSentenceIndex((prev) => prev - 1);
    }
  };

  const advanceToNextLesson = () => {
    const currentIndex = allLessons.findIndex((l) => l.id === currentLesson.id);
    if (currentIndex < allLessons.length - 1) {
      setCurrentLessonId(allLessons[currentIndex + 1].id);
      setCurrentSentenceIndex(0);
    }
  };

  return {
    allLessons,
    currentLesson,
    sentences,
    currentSentenceIndex,
    setCurrentSentenceIndex,
    goToLesson,
    handleSkipNext,
    handleSkipPrev,
    advanceToNextLesson,
  };
};
