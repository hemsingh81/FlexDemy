import { useEffect, useState } from 'react';

export type ExerciseAnswerType = 'multipleChoice' | 'numeric' | 'shortText';

// Story 3.3/Task 1: no `correctAnswer` field on the public type -- a real backend (Story 3.6)
// would never send the answer key to the browser either, so matching that constraint now avoids
// a breaking type change later even though today's submit() is mock/client-side.
export interface Exercise {
  id: string;
  questionText: string;
  answerType: ExerciseAnswerType;
  options?: string[];
  feedback: string;
  isAiProposed: boolean;
}

export interface SubmissionResult {
  isCorrect: boolean;
  feedbackText: string;
}

interface UseExerciseResult {
  exercise: Exercise | null;
  isLoading: boolean;
  error: string | null;
  submission: SubmissionResult | null;
  submit: (answer: string) => void;
  reset: () => void;
}

interface MockExerciseEntry {
  exercise: Exercise;
  referenceAnswer: string;
}

// Mock fixture keyed by the same real Topic/Subtopic node ids Stories 3.1/3.2 use -- covers all
// 3 answerType values. `topic_2` (which already has Drill-Down + Ways content from prior stories)
// deliberately has NO entry here, so AC#2's "no affordance at all" is exercisable on a node that
// also has real Drill-Down/Ways content, not just an otherwise-empty one.
const MOCK_EXERCISES: Record<string, MockExerciseEntry> = {
  subtopic_1: {
    exercise: {
      id: 'exercise_subtopic_1',
      questionText: 'A wave has a speed of 6 m/s and a frequency of 2 Hz. What is its wavelength, in meters?',
      answerType: 'numeric',
      feedback: 'Wavelength = speed / frequency = 6 / 2 = 3 meters.',
      isAiProposed: true,
    },
    referenceAnswer: '3',
  },
  subtopic_2: {
    exercise: {
      id: 'exercise_subtopic_2',
      questionText: 'Which of the following best describes a wave?',
      answerType: 'multipleChoice',
      options: [
        'A disturbance that transfers energy without transferring matter',
        'A particle that moves in a straight line at constant speed',
        'A chemical reaction between two substances',
        'A measure of an object\'s resistance to acceleration',
      ],
      feedback: 'A wave transfers energy from one place to another without transferring matter along with it.',
      isAiProposed: true,
    },
    referenceAnswer: 'A disturbance that transfers energy without transferring matter',
  },
  topic_1: {
    exercise: {
      id: 'exercise_topic_1',
      questionText: 'In one sentence, explain why a wave can transfer energy without transferring matter.',
      answerType: 'shortText',
      feedback:
        'A wave moves through a medium as a disturbance -- each particle oscillates around a fixed position and passes energy to its neighbor, rather than traveling with the wave itself.',
      isAiProposed: false,
    },
    referenceAnswer: 'energy',
  },
};

// Number.parseFloat only parses a leading numeric prefix and silently ignores trailing garbage
// ("3xyz" -> 3, "3 meters" -> 3, "3," -> 3), which would false-positive-grade those as correct.
// Number() requires the whole (trimmed) string to be numeric -- NaN for any of the above -- while
// still accepting the formats an exercise's numeric answer legitimately needs ("3", "3.0", "-3").
const parseStrictNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
};

const isNumericMatch = (submitted: string, reference: string): boolean => {
  const submittedValue = parseStrictNumber(submitted);
  const referenceValue = parseStrictNumber(reference);
  if (submittedValue === null || referenceValue === null) return false;
  return Math.abs(submittedValue - referenceValue) < 1e-6;
};

const isTextMatch = (submitted: string, reference: string): boolean =>
  submitted.trim().toLowerCase() === reference.trim().toLowerCase();

// Story 3.3/Task 1: a mock evaluator only -- string equality (case-insensitive, trimmed) for
// shortText/multipleChoice, a loose numeric-tolerance check for numeric. Real grading (subject-
// aware, tolerant of equivalent-but-differently-formatted math answers) is explicitly Story 3.6's
// job; this only needs to demonstrate the UI states, not be pedagogically sound.
const evaluate = (entry: MockExerciseEntry, answer: string): SubmissionResult => {
  const isCorrect =
    entry.exercise.answerType === 'numeric'
      ? isNumericMatch(answer, entry.referenceAnswer)
      : isTextMatch(answer, entry.referenceAnswer);

  // Feedback is always shown regardless of correctness (FR19's "immediate feedback and worked
  // solution on completion" applies either way, not just on success).
  return { isCorrect, feedbackText: entry.exercise.feedback };
};

// Story 3.3/Task 1: same (courseId, nodeId) signature Stories 3.1/3.2 established. `exercise:
// null` (not a loading/error state) is the expected, common case -- most nodes have no attached
// exercise (FR19's "optional") -- Phase B (Story 3.6) swaps the mock body for a real API call
// without any component consuming this hook needing to change.
export const useExercise = (courseId: string, nodeId: string): UseExerciseResult => {
  const [entry, setEntry] = useState<MockExerciseEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submission, setSubmission] = useState<SubmissionResult | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setSubmission(null);
    // Mirrors useDrilldownContent's/useWays's own mock-async convention (a short setTimeout), not
    // a real network call.
    const timer = setTimeout(() => {
      setEntry(MOCK_EXERCISES[nodeId] ?? null);
      setIsLoading(false);
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, nodeId]);

  const submit = (answer: string) => {
    if (!entry) return;
    setSubmission(evaluate(entry, answer));
  };

  const reset = () => setSubmission(null);

  return {
    exercise: entry?.exercise ?? null,
    isLoading,
    error: null,
    submission,
    submit,
    reset,
  };
};
