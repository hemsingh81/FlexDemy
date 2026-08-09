import { useCallback, useEffect, useState } from 'react';
import { Course, CourseReview, ScratchpadNote } from '../../types';
import { getReviewsForCourse } from '../../services/reviewsService';
import { addNote, getNotesForCourse } from '../../services/scratchpadService';

// Feature-local hook for CourseOverview (AD-2): wraps the reviewsService and
// scratchpadService calls that CourseOverviewScreen needs, so the component
// itself stays focused on rendering.
export const useCourseOverview = (course: Course) => {
  const [reviewsList, setReviewsList] = useState<CourseReview[]>([]);
  const [notesList, setNotesList] = useState<ScratchpadNote[]>([]);

  const refreshReviews = useCallback(() => {
    setReviewsList(getReviewsForCourse(course.id));
  }, [course.id]);

  const refreshNotes = useCallback(() => {
    const loaded = getNotesForCourse(course.id);
    if (loaded.length === 0) {
      // Client-side fallback only (not persisted) so a course always shows a
      // starter note, matching prior behavior — actual persistence lives in
      // scratchpadService per AD-1.
      const firstLesson = course.modules[0]?.lessons[0];
      setNotesList([
        {
          id: `note_seed_${course.id}_1`,
          courseId: course.id,
          lessonId: firstLesson?.id || 'l1',
          lessonTitle: firstLesson?.title || 'Key Concepts',
          paragraphIndex: 0,
          content: `Remember to review the core formulas and definitions in Module 1 before taking the chapter assignment.`,
          createdAt: 'Saved during study session',
          updatedAt: 'Saved during study session',
        },
      ]);
    } else {
      setNotesList(loaded);
    }
  }, [course]);

  useEffect(() => {
    refreshReviews();
    refreshNotes();
  }, [refreshReviews, refreshNotes]);

  const addCourseNote = useCallback(
    (note: ScratchpadNote) => {
      addNote(note);
      setNotesList(getNotesForCourse(course.id));
    },
    [course.id]
  );

  return { reviewsList, notesList, refreshReviews, addCourseNote };
};
