import React, { useState } from 'react';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Upload,
  Award,
  Sparkles,
  ArrowRight,
  RotateCcw,
  FileText,
  Clock,
  Brain,
  Target,
  Lightbulb,
  BookOpen,
} from 'lucide-react';
import { TopicAssignment, QuizQuestion } from '../types';
import confetti from 'canvas-confetti';

interface AssignmentsViewProps {
  assignments: TopicAssignment[];
  onAwardPoints: (points: number) => void;
  userLanguage: string;
}

export const AssignmentsView: React.FC<AssignmentsViewProps> = ({
  assignments,
  onAwardPoints,
  userLanguage,
}) => {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(
    assignments[0]?.id || ''
  );
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submittedFile, setSubmittedFile] = useState<File | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [scoreReport, setScoreReport] = useState<{
    score: number;
    total: number;
    percentage: number;
  } | null>(null);

  const currentAssignment =
    assignments.find((a) => a.id === selectedAssignmentId) || assignments[0];

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (isSubmitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSubmittedFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let correctCount = 0;
    currentAssignment.questions.forEach((q) => {
      if (answers[q.id] === q.correctAnswerIndex) {
        correctCount++;
      }
    });

    const total = currentAssignment.questions.length;
    const pct = Math.round((correctCount / total) * 100);

    setScoreReport({
      score: correctCount,
      total: total,
      percentage: pct,
    });
    setIsSubmitted(true);

    if (pct >= 70) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      onAwardPoints(150);
    }
  };

  const handleReset = () => {
    setAnswers({});
    setSubmittedFile(null);
    setIsSubmitted(false);
    setScoreReport(null);
  };

  return (
    <div className="w-full space-y-8 pb-12">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center space-x-3">
          <FileCheck2 className="w-8 h-8 text-indigo-600" />
          <span>Assignments & Automated Evaluations</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Complete topic quizzes, upload code or essay files, and receive instant rubric breakdown feedback.
        </p>
      </div>

      {/* Assignment Picker Bar */}
      <div className="flex items-center space-x-3 overflow-x-auto pb-2">
        {assignments.map((asg) => (
          <button
            key={asg.id}
            onClick={() => {
              setSelectedAssignmentId(asg.id);
              handleReset();
            }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border flex items-center space-x-2 min-w-max ${
              selectedAssignmentId === asg.id
                ? 'bg-[#143358] text-white border-[#143358] shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{asg.title}</span>
          </button>
        ))}
      </div>

      {/* Assignment Canvas */}
      {currentAssignment && (
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-8 text-slate-800">
          
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold text-slate-900">
              {currentAssignment.title}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {currentAssignment.description}
            </p>
          </div>

          {/* Quiz Questions List */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {currentAssignment.questions.map((q, qIdx) => {
              const selectedOpt = answers[q.id];
              const isCorrect = selectedOpt === q.correctAnswerIndex;

              return (
                <div
                  key={q.id}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-bold text-slate-900">
                      Question {qIdx + 1}: {q.question}
                    </p>
                    {isSubmitted && (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center space-x-1 ${
                        isCorrect ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'
                      }`}>
                        {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>{isCorrect ? 'Correct (+50 pts)' : 'Incorrect'}</span>
                      </span>
                    )}
                  </div>

                  {/* Options List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {q.options.map((opt, optIdx) => {
                      const isOptionSelected = selectedOpt === optIdx;

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelectOption(q.id, optIdx)}
                          className={`p-3.5 rounded-xl text-xs font-semibold text-left transition-all border flex items-center space-x-3 ${
                            isOptionSelected
                              ? 'bg-[#143358] text-white border-[#143358] shadow-md'
                              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-full border text-[10px] flex items-center justify-center font-bold ${
                            isOptionSelected ? 'bg-white text-indigo-600 border-white' : 'border-slate-300 text-slate-500'
                          }`}>
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation Note after submit */}
                  {isSubmitted && (
                    <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900">
                      <p className="font-bold mb-0.5">Explanation:</p>
                      <p>{q.explanation}</p>
                    </div>
                  )}

                </div>
              );
            })}

            {/* Optional File Upload */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center space-x-2">
                <Upload className="w-4 h-4 text-indigo-600" />
                <span>Upload Essay or Code Solution File (Optional)</span>
              </h3>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="assignment-file"
                />
                <label htmlFor="assignment-file" className="cursor-pointer space-y-1 block">
                  <FileText className="w-8 h-8 mx-auto text-indigo-500" />
                  <p className="text-xs font-bold text-slate-800">
                    {submittedFile ? submittedFile.name : 'Click to select file (.py, .pdf, .docx, .txt)'}
                  </p>
                  <p className="text-[10px] text-slate-500">Max file size 25MB</p>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              {isSubmitted ? (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl flex items-center space-x-2 hover:bg-slate-200"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Retry Quiz</span>
                </button>
              ) : (
                <span className="text-xs text-slate-500">Select answers for all questions before submitting</span>
              )}

              <button
                type="submit"
                disabled={isSubmitted}
                className="px-6 py-3 bg-[#143358] hover:bg-[#143358]/90 text-white font-bold text-xs rounded-xl shadow-lg shadow-[#143358]/20 disabled:opacity-50 flex items-center space-x-2 transition-all cursor-pointer"
              >
                <Award className="w-4 h-4" />
                <span>Submit Assignment for Auto-Grading</span>
              </button>
            </div>

          </form>

          {/* Score Report Box */}
          {scoreReport && (
            <div className="p-6 rounded-2xl bg-[#143358] border border-white/10 text-white space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase font-extrabold text-amber-200">Automated Grade Report</p>
                  <h3 className="text-2xl font-extrabold font-display">Your Score: {scoreReport.percentage}%</h3>
                </div>
                <div className="text-3xl font-extrabold text-[#EC7B38]">
                  {scoreReport.score} / {scoreReport.total} Correct
                </div>
              </div>
              <p className="text-xs text-slate-200">
                {scoreReport.percentage >= 70
                  ? 'Great job! You met the mastery threshold and earned +150 Mastery Points.'
                  : 'Review the explanation notes above and retry to improve your mastery score.'}
              </p>
            </div>
          )}

          {/* AI Insight Panel: Analyzes performance & identifies knowledge gaps */}
          <div className="p-6 rounded-3xl bg-[#143358] text-white border border-white/10 shadow-xl space-y-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-[#EC7B38]/15 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-2xl bg-white/10 text-amber-300 border border-white/15">
                  <Brain className="w-6 h-6 text-[#EC7B38]" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-bold font-display text-white">AI Learning Insight & Gap Analysis</h3>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#EC7B38] text-white">
                      Automated
                    </span>
                  </div>
                  <p className="text-xs text-slate-200">
                    Adaptive AI diagnostic on your performance for "{currentAssignment.title}".
                  </p>
                </div>
              </div>

              {isSubmitted && (
                <span className="text-xs font-bold px-3 py-1 rounded-xl bg-white/10 text-amber-200 border border-white/15 hidden sm:inline-block">
                  {scoreReport ? `${scoreReport.percentage}% Score Analyzed` : 'Analysis Ready'}
                </span>
              )}
            </div>

            {/* Performance Gap & Tips Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10 pt-2">
              
              {/* Identified Knowledge Gaps */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <h4 className="text-xs font-extrabold uppercase text-amber-200 tracking-wider flex items-center space-x-1.5">
                  <Target className="w-4 h-4 text-[#EC7B38]" />
                  <span>Identified Knowledge Gaps</span>
                </h4>

                {isSubmitted ? (
                  (() => {
                    const incorrects = currentAssignment.questions.filter(
                      (q) => answers[q.id] !== q.correctAnswerIndex
                    );

                    if (incorrects.length === 0) {
                      return (
                        <div className="p-3 rounded-xl bg-[#179765]/20 border border-[#179765]/30 text-xs text-emerald-200 space-y-1">
                          <p className="font-bold flex items-center space-x-1">
                            <CheckCircle2 className="w-4 h-4 text-[#179765]" />
                            <span>Zero Knowledge Gaps Found!</span>
                          </p>
                          <p className="text-[11px] text-slate-200">
                            You demonstrated 100% mastery on all topics in this quiz. Ready for the next module!
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {incorrects.map((q, idx) => (
                          <div key={q.id} className="p-2.5 rounded-xl bg-white/10 border border-white/10 text-xs space-y-1">
                            <span className="text-[10px] font-bold text-amber-200 uppercase">
                              Gap #{idx + 1}: {q.question.slice(0, 45)}...
                            </span>
                            <p className="text-[11px] text-slate-200">{q.explanation}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                ) : (
                  <div className="p-3 rounded-xl bg-white/5 text-xs text-slate-300 space-y-1">
                    <p className="font-semibold text-white">Submit the quiz above to trigger live diagnostic analysis.</p>
                    <p className="text-[11px] text-slate-300">
                      The AI will map your responses against core concepts to spot missing prerequisite steps.
                    </p>
                  </div>
                )}
              </div>

              {/* Personalized Tips for Improvement */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <h4 className="text-xs font-extrabold uppercase text-amber-200 tracking-wider flex items-center space-x-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-300" />
                  <span>Personalized Actionable Tips</span>
                </h4>

                <div className="space-y-2 text-xs text-slate-200">
                  <div className="p-2.5 rounded-xl bg-white/10 border border-white/10 flex items-start space-x-2">
                    <BookOpen className="w-4 h-4 text-[#EC7B38] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-white">Review Drilldown Explanations</p>
                      <p className="text-[11px] text-slate-200">
                        Open Level 3 & Level 4 drilldowns in the course player to see interactive step-by-step breakdowns.
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/10 border border-white/10 flex items-start space-x-2">
                    <Sparkles className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-white">Practice Worked Examples</p>
                      <p className="text-[11px] text-slate-200">
                        Solve 2 additional practice problems with auto-calculated solutions before retrying.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

    </div>
  );
};
