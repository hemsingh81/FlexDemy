import { AssignmentSubmission, AssignmentSource, TutorAssignment, VisibilityMode, QuizQuestion } from '../types';
import { MOCK_TUTOR_ASSIGNMENTS, MOCK_ASSIGNMENT_SUBMISSIONS } from '../data/mockData';

let tutorAssignments: TutorAssignment[] = MOCK_TUTOR_ASSIGNMENTS;
let submissions: AssignmentSubmission[] = MOCK_ASSIGNMENT_SUBMISSIONS;

export const getTutorAssignments = async (): Promise<TutorAssignment[]> => {
  return tutorAssignments;
};

export const createAssignment = async (
  data: Omit<TutorAssignment, 'id' | 'status' | 'createdAt'>
): Promise<TutorAssignment[]> => {
  const newAssignment: TutorAssignment = {
    ...data,
    id: `tasg_${Date.now()}`,
    status: 'draft',
    createdAt: new Date().toISOString().split('T')[0],
  };
  tutorAssignments = [newAssignment, ...tutorAssignments];
  return tutorAssignments;
};

export const publishAssignment = async (assignmentId: string): Promise<TutorAssignment[]> => {
  tutorAssignments = tutorAssignments.map((a) =>
    a.id === assignmentId ? { ...a, status: 'published' } : a
  );
  return tutorAssignments;
};

export const unpublishAssignment = async (assignmentId: string): Promise<TutorAssignment[]> => {
  tutorAssignments = tutorAssignments.map((a) =>
    a.id === assignmentId ? { ...a, status: 'draft' } : a
  );
  return tutorAssignments;
};

export const getSubmissions = async (): Promise<AssignmentSubmission[]> => {
  return submissions;
};

// Grades a set of MC answers against a question set -- the single shared grading mechanic
// (PRD Cross-Cutting NFR: reuse, don't duplicate, across all three Sources).
export const gradeAnswers = (
  questions: QuizQuestion[],
  answers: Record<string, number>
): { correctCount: number; totalQuestions: number; percentage: number } => {
  const correctCount = questions.filter((q) => answers[q.id] === q.correctAnswerIndex).length;
  const totalQuestions = questions.length;
  const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  return { correctCount, totalQuestions, percentage };
};

export const submitAssignment = async (params: {
  assignmentId: string;
  assignmentSource: AssignmentSource;
  assignmentTitle: string;
  studentId: string;
  studentName: string;
  answers: Record<string, number>;
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  visibilityMode: VisibilityMode;
}): Promise<AssignmentSubmission[]> => {
  const now = new Date().toISOString().split('T')[0];
  const newSubmission: AssignmentSubmission = {
    id: `sub_${Date.now()}`,
    assignmentId: params.assignmentId,
    assignmentSource: params.assignmentSource,
    assignmentTitle: params.assignmentTitle,
    studentId: params.studentId,
    studentName: params.studentName,
    answers: params.answers,
    correctCount: params.correctCount,
    totalQuestions: params.totalQuestions,
    percentage: params.percentage,
    // Immediate visibility (all Course-source, plus Tutor/Competition set to Immediate) skips
    // straight to Reviewed -- there's no pending-review step, the score is final and visible
    // the moment it's computed (PRD FR-7). Hold-visibility starts as Submitted (PRD FR-8).
    status: params.visibilityMode === 'immediate' ? 'reviewed' : 'submitted',
    submittedAt: now,
    reviewedAt: params.visibilityMode === 'immediate' ? now : undefined,
  };
  submissions = [newSubmission, ...submissions];
  return submissions;
};

export const reviewSubmission = async (submissionId: string): Promise<AssignmentSubmission[]> => {
  submissions = submissions.map((s) =>
    s.id === submissionId
      ? { ...s, status: 'reviewed', reviewedAt: new Date().toISOString().split('T')[0] }
      : s
  );
  return submissions;
};

export const reEvaluateSubmission = async (
  submissionId: string,
  newPercentage: number,
  newCorrectCount: number
): Promise<AssignmentSubmission[]> => {
  submissions = submissions.map((s) =>
    s.id === submissionId
      ? { ...s, percentage: newPercentage, correctCount: newCorrectCount }
      : s
  );
  return submissions;
};
