import React, { useState } from 'react';
import { useExercise } from './useExercise';

interface ExerciseRunnerProps {
  courseId: string;
  nodeId: string;
}

// Story 3.3/Task 2: genuinely inline expansion within the reading pane (AC#1) -- NOT the
// SidePanel-based AssignmentQuizRunner (StudentAssignmentsSection.tsx). Direct read of that
// component confirmed it renders inside a <SidePanel> (a slide-in blade), contradicting
// epics.md/DESIGN.md's own description of it as an "expands in place" precedent. This component
// reuses that stated INTERACTION idiom (expands in place, no modal/blade), not the specific
// SidePanel-based component -- see this story's own Dev Notes for the full correction.
export const ExerciseRunner: React.FC<ExerciseRunnerProps> = ({ courseId, nodeId }) => {
  const { exercise, isLoading, submission, submit, reset } = useExercise(courseId, nodeId);
  const [answer, setAnswer] = useState('');

  // Task 3: no exercise attached (the common case, FR19's "optional") renders nothing at all --
  // no placeholder, no disabled state, fully invisible per DESIGN.md's Empty State Pattern.
  if (isLoading || !exercise) return null;

  const handleSubmit = () => {
    if (!answer.trim()) return;
    submit(answer);
  };

  const handleTryAgain = () => {
    setAnswer('');
    reset();
  };

  return (
    <div
      data-testid="exercise-runner"
      aria-label="Practice exercise"
      className="mt-7 p-5 rounded-2xl bg-[#FAF7EC] border border-[#E1DED4]"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Optional Practice</p>
          <h3 className="text-base font-bold text-[#143358] mt-0.5">Check yourself</h3>
        </div>
        {exercise.isAiProposed && (
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#143358]/10 text-[#143358]">
            AI-proposed
          </span>
        )}
      </div>

      <p className="text-sm text-slate-800 leading-relaxed mb-3.5">{exercise.questionText}</p>

      {!submission ? (
        <>
          {exercise.answerType === 'multipleChoice' && (
            <div className="flex flex-col gap-2 mb-3.5">
              {(exercise.options ?? []).map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2.5 bg-white border border-[#E1DED4] rounded-xl px-3.5 py-2.5 text-[13px] cursor-pointer"
                >
                  <input
                    type="radio"
                    name={`exercise-${exercise.id}`}
                    value={option}
                    checked={answer === option}
                    onChange={() => setAnswer(option)}
                    className="accent-[#BA5012]"
                  />
                  {option}
                </label>
              ))}
            </div>
          )}

          {/* Numeric answers use type="text", never type="number" or a visual equation editor --
              AC#1's "plain keyboard text entry" rule is about avoiding a mouse-only widget, not
              about restricting input to digits (a student may reasonably type "1/2" or similar). */}
          {(exercise.answerType === 'numeric' || exercise.answerType === 'shortText') && (
            <input
              type="text"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Type your answer"
              aria-label="Your answer"
              className="w-full mb-3.5 px-3.5 py-2.5 rounded-xl border border-[#E1DED4] bg-white text-sm"
            />
          )}

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!answer.trim()}
              className="px-4 py-2 bg-[#BA5012] hover:bg-[#BA5012]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              Submit Answer
            </button>
            <span className="text-xs text-slate-500">
              Immediate feedback, no page reload — practice only, not graded.
            </span>
          </div>
        </>
      ) : (
        <div
          className={`p-3.5 rounded-xl text-xs leading-relaxed border ${
            submission.isCorrect
              ? 'bg-[#179765]/10 text-[#0F6B49] border-[#179765]/20'
              : 'bg-white text-slate-700 border-[#E1DED4]'
          }`}
        >
          <p className="font-bold mb-1">{submission.isCorrect ? 'Correct!' : "Here's the worked solution"}</p>
          <p>{submission.feedbackText}</p>
          <button
            type="button"
            onClick={handleTryAgain}
            className="mt-2.5 text-xs font-bold text-[#143358] hover:underline cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
};
