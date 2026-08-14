import { useCallback } from 'react';
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
import { useAsync } from '../../hooks/useAsync';

const MASTERY_POINTS_THRESHOLD = 70;
const MASTERY_POINTS_AWARD = 150;

interface AssignmentsHubData {
  tutorAssignments: TutorAssignment[];
  submissions: AssignmentSubmission[];
}

const EMPTY_ASSIGNMENTS_HUB_DATA: AssignmentsHubData = { tutorAssignments: [], submissions: [] };

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

  // Same Promise.all -> combined-object shape as useTutorHub.ts, via hooks/useAsync.ts -- the
  // mutators below patch one field of `data` at a time via setData, so this hook's own public
  // return shape (tutorAssignments/submissions as separate fields) stays unchanged even though
  // they're now backed by one combined async fetch under the hood.
  const { data, setData, isLoading } = useAsync<AssignmentsHubData>(
    () =>
      Promise.all([assignmentsService.getTutorAssignments(), assignmentsService.getSubmissions()]).then(
        ([tutorAssignments, submissions]) => ({ tutorAssignments, submissions })
      ),
    EMPTY_ASSIGNMENTS_HUB_DATA,
    []
  );
  const { tutorAssignments, submissions } = data;

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
          setData((prev) => ({ ...prev, submissions: subs }));
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
    [user, awardPoints, showToast, setData]
  );

  // publish=true implements the creation form's "Save & Publish" action (FR-12) -- creates as
  // Draft first (the only state createAssignment can produce), then immediately publishes it,
  // rather than leaving "Save & Publish" behaving identically to "Save as Draft".
  const createAssignment = useCallback(
    (newAssignment: Omit<TutorAssignment, 'id' | 'status' | 'createdAt'>, publish = false) => {
      return assignmentsService.createAssignment(newAssignment).then((assignments) => {
        if (!publish) {
          setData((prev) => ({ ...prev, tutorAssignments: assignments }));
          showToast({ message: 'Assignment saved as draft.', variant: 'success' });
          return assignments;
        }
        const created = assignments[0];
        return assignmentsService.publishAssignment(created.id).then((updated) => {
          setData((prev) => ({ ...prev, tutorAssignments: updated }));
          showToast({ message: 'Assignment published.', variant: 'success' });
          return updated;
        });
      });
    },
    [showToast, setData]
  );

  const publishAssignment = useCallback((assignmentId: string) => {
    return assignmentsService.publishAssignment(assignmentId).then((updated) => {
      setData((prev) => ({ ...prev, tutorAssignments: updated }));
      showToast({ message: 'Assignment published.', variant: 'success' });
      return updated;
    });
  }, [showToast, setData]);

  const unpublishAssignment = useCallback((assignmentId: string) => {
    return assignmentsService.unpublishAssignment(assignmentId).then((updated) => {
      setData((prev) => ({ ...prev, tutorAssignments: updated }));
      showToast({ message: 'Assignment unpublished.', variant: 'success' });
      return updated;
    });
  }, [showToast, setData]);

  // Review (PRD FR-14): confirms and publishes a Hold submission's already-computed score.
  // Points award on publish, not on original submit, for Hold-visibility assignments -- see
  // the PRD's [ASSUMPTION] at FR-14/FR-15.
  const reviewSubmission = useCallback(
    (submissionId: string) => {
      const target = submissions.find((s) => s.id === submissionId);
      return assignmentsService.reviewSubmission(submissionId).then((subs) => {
        setData((prev) => ({ ...prev, submissions: subs }));
        if (target && target.percentage >= MASTERY_POINTS_THRESHOLD) {
          awardPoints(MASTERY_POINTS_AWARD);
        }
        showToast({ message: 'Submission reviewed and published.', variant: 'success' });
        return subs;
      });
    },
    [submissions, awardPoints, showToast, setData]
  );

  // Re-evaluate (PRD FR-15): tutor manually overrides an already-Reviewed score. Adjusts the
  // student's mastery points by the delta rather than leaving prior points untouched.
  const reEvaluateSubmission = useCallback(
    (submissionId: string, newCorrectCount: number, newPercentage: number) => {
      const target = submissions.find((s) => s.id === submissionId);
      return assignmentsService
        .reEvaluateSubmission(submissionId, newPercentage, newCorrectCount)
        .then((subs) => {
          setData((prev) => ({ ...prev, submissions: subs }));
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
    [submissions, awardPoints, showToast, setData]
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
