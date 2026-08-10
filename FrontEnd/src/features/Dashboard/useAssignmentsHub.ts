import { useCallback, useEffect, useState } from 'react';
import {
  AssignmentSubmission,
  QuizQuestion,
  TopicAssignment,
  TutorAssignment,
  VisibilityMode,
} from '../../types';
import * as assignmentsService from '../../services/assignmentsService';
import { useDomain } from '../../context/DomainContext';
import { useToast } from '../../context/ToastContext';

const MASTERY_POINTS_THRESHOLD = 70;
const MASTERY_POINTS_AWARD = 150;

// Course-source assignments, flattened out of course/lesson data -- same source useAssignments.ts
// (the now-retired standalone Assignments tab's hook) used, kept here so the unified Available
// Assignments list (PRD FR-5) has a single place both Sources come from.
export interface CourseAssignmentEntry {
  source: 'course';
  courseId: string;
  courseTitle: string;
  assignment: TopicAssignment;
}

export const useAssignmentsHub = () => {
  const { user, courses, isLoading: isDomainLoading, awardPoints } = useDomain();
  const { showToast } = useToast();

  const [tutorAssignments, setTutorAssignments] = useState<TutorAssignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([assignmentsService.getTutorAssignments(), assignmentsService.getSubmissions()]).then(
      ([assignments, subs]) => {
        if (cancelled) return;
        setTutorAssignments(assignments);
        setSubmissions(subs);
        setIsLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const courseAssignments: CourseAssignmentEntry[] = courses.flatMap((c) =>
    c.modules.flatMap((m) =>
      m.lessons.flatMap((l) =>
        l.assignment
          ? [{ source: 'course' as const, courseId: c.id, courseTitle: c.title, assignment: l.assignment }]
          : []
      )
    )
  );

  const submitQuiz = useCallback(
    (params: {
      assignmentId: string;
      assignmentSource: 'course' | 'tutor' | 'competition';
      assignmentTitle: string;
      questions: QuizQuestion[];
      answers: Record<string, number>;
      visibilityMode: VisibilityMode;
    }) => {
      if (!user) return Promise.resolve(undefined as unknown as AssignmentSubmission);
      const { correctCount, totalQuestions, percentage } = assignmentsService.gradeAnswers(
        params.questions,
        params.answers
      );
      return assignmentsService
        .submitAssignment({
          assignmentId: params.assignmentId,
          assignmentSource: params.assignmentSource,
          assignmentTitle: params.assignmentTitle,
          studentId: user.id,
          studentName: user.name,
          answers: params.answers,
          correctCount,
          totalQuestions,
          percentage,
          visibilityMode: params.visibilityMode,
        })
        .then((subs) => {
          setSubmissions(subs);
          // Immediate visibility awards points right away, same as today's unchanged flow
          // (PRD FR-7). Hold-visibility withholds points until Review (FR-14).
          if (params.visibilityMode === 'immediate' && percentage >= MASTERY_POINTS_THRESHOLD) {
            awardPoints(MASTERY_POINTS_AWARD);
          }
          showToast({
            message:
              params.visibilityMode === 'immediate'
                ? `Assignment submitted — scored ${percentage}%.`
                : 'Assignment submitted — pending tutor review.',
            variant: 'success',
          });
          return subs[0];
        });
    },
    [user, awardPoints, showToast]
  );

  // publish=true implements the creation form's "Save & Publish" action (FR-12) -- creates as
  // Draft first (the only state createAssignment can produce), then immediately publishes it,
  // rather than leaving "Save & Publish" behaving identically to "Save as Draft".
  const createAssignment = useCallback(
    (data: Omit<TutorAssignment, 'id' | 'status' | 'createdAt'>, publish = false) => {
      return assignmentsService.createAssignment(data).then((assignments) => {
        if (!publish) {
          setTutorAssignments(assignments);
          showToast({ message: 'Assignment saved as draft.', variant: 'success' });
          return assignments;
        }
        const created = assignments[0];
        return assignmentsService.publishAssignment(created.id).then((updated) => {
          setTutorAssignments(updated);
          showToast({ message: 'Assignment published.', variant: 'success' });
          return updated;
        });
      });
    },
    [showToast]
  );

  const publishAssignment = useCallback((assignmentId: string) => {
    return assignmentsService.publishAssignment(assignmentId).then((updated) => {
      setTutorAssignments(updated);
      showToast({ message: 'Assignment published.', variant: 'success' });
      return updated;
    });
  }, [showToast]);

  const unpublishAssignment = useCallback((assignmentId: string) => {
    return assignmentsService.unpublishAssignment(assignmentId).then((updated) => {
      setTutorAssignments(updated);
      showToast({ message: 'Assignment unpublished.', variant: 'success' });
      return updated;
    });
  }, [showToast]);

  // Review (PRD FR-14): confirms and publishes a Hold submission's already-computed score.
  // Points award on publish, not on original submit, for Hold-visibility assignments -- see
  // the PRD's [ASSUMPTION] at FR-14/FR-15.
  const reviewSubmission = useCallback(
    (submissionId: string) => {
      const target = submissions.find((s) => s.id === submissionId);
      return assignmentsService.reviewSubmission(submissionId).then((subs) => {
        setSubmissions(subs);
        if (target && target.percentage >= MASTERY_POINTS_THRESHOLD) {
          awardPoints(MASTERY_POINTS_AWARD);
        }
        showToast({ message: 'Submission reviewed and published.', variant: 'success' });
        return subs;
      });
    },
    [submissions, awardPoints, showToast]
  );

  // Re-evaluate (PRD FR-15): tutor manually overrides an already-Reviewed score. Adjusts the
  // student's mastery points by the delta rather than leaving prior points untouched.
  const reEvaluateSubmission = useCallback(
    (submissionId: string, newCorrectCount: number, newPercentage: number) => {
      const target = submissions.find((s) => s.id === submissionId);
      return assignmentsService
        .reEvaluateSubmission(submissionId, newPercentage, newCorrectCount)
        .then((subs) => {
          setSubmissions(subs);
          if (target) {
            const wasAwarded = target.percentage >= MASTERY_POINTS_THRESHOLD;
            const nowAwarded = newPercentage >= MASTERY_POINTS_THRESHOLD;
            if (nowAwarded && !wasAwarded) awardPoints(MASTERY_POINTS_AWARD);
            if (!nowAwarded && wasAwarded) awardPoints(-MASTERY_POINTS_AWARD);
          }
          showToast({ message: 'Score updated.', variant: 'success' });
          return subs;
        });
    },
    [submissions, awardPoints, showToast]
  );

  return {
    user,
    courses,
    courseAssignments,
    tutorAssignments,
    submissions,
    isLoading: isDomainLoading || isLoading,
    submitQuiz,
    createAssignment,
    publishAssignment,
    unpublishAssignment,
    reviewSubmission,
    reEvaluateSubmission,
  };
};
