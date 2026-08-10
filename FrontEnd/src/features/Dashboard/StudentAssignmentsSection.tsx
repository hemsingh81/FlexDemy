import React, { useEffect, useState } from 'react';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Award,
  Sparkles,
  RotateCcw,
  BookOpen,
  GraduationCap,
  Radio,
  Hourglass,
  Brain,
  Target,
  Lightbulb,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  AssignmentSource,
  AssignmentSubmission,
  QuizQuestion,
  TutorAssignment,
  UserProfile,
  VisibilityMode,
} from '../../types';
import { CourseAssignmentEntry } from './useAssignmentsHub';
import { SidePanel } from '../../ui/SidePanel';
import { Button } from '../../ui/Button';

// A single Source-tagged entry the unified Available Assignments list (PRD FR-5) can render,
// regardless of whether it originated as a course-embedded quiz or a tutor-created assignment.
interface AvailableAssignmentEntry {
  id: string;
  source: AssignmentSource;
  title: string;
  description: string;
  questions: QuizQuestion[];
  visibilityMode: VisibilityMode;
  courseTitle?: string;
  tutorName?: string;
}

const SOURCE_BADGE: Record<AssignmentSource, { label: string; className: string; icon: React.ElementType }> = {
  course: { label: 'Course', className: 'bg-[#143358]/10 text-[#143358] border-[#143358]/20', icon: BookOpen },
  tutor: { label: 'Tutor', className: 'bg-[#5E6A79]/10 text-[#5E6A79] border-[#5E6A79]/20', icon: GraduationCap },
  competition: { label: 'Competition', className: 'bg-[#BA5012]/10 text-[#BA5012] border-[#BA5012]/30', icon: Radio },
};

interface StudentAssignmentsSectionProps {
  user: UserProfile;
  courseAssignments: CourseAssignmentEntry[];
  tutorAssignments: TutorAssignment[];
  submissions: AssignmentSubmission[];
  onSubmitQuiz: (params: {
    assignmentId: string;
    assignmentSource: AssignmentSource;
    assignmentTitle: string;
    questions: QuizQuestion[];
    answers: Record<string, number>;
    visibilityMode: VisibilityMode;
  }) => Promise<AssignmentSubmission>;
  // FR-16: when set, opens this specific assignment directly (CoursePlayer "Take Quiz" deep link).
  pendingOpenAssignmentId?: string;
  onConsumePendingOpenAssignment?: () => void;
}

export const StudentAssignmentsSection: React.FC<StudentAssignmentsSectionProps> = ({
  user,
  courseAssignments,
  tutorAssignments,
  submissions,
  onSubmitQuiz,
  pendingOpenAssignmentId,
  onConsumePendingOpenAssignment,
}) => {
  const mySubmissions = submissions
    .filter((s) => s.studentId === user.id)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  const submissionByAssignmentId = new Map<string, AssignmentSubmission>(
    mySubmissions.map((s) => [s.assignmentId, s])
  );

  // Unify Course-source (existing lesson quizzes, shown regardless of enrollment -- matches
  // today's unchanged behavior) with published Tutor-source (student's enrolled courses only)
  // and Competition-source (everyone) -- PRD FR-5.
  const enrolledCourseIds = new Set(Object.keys(user.progress));

  const available: AvailableAssignmentEntry[] = [
    ...courseAssignments.map((c) => ({
      id: c.assignment.id,
      source: 'course' as const,
      title: c.assignment.title,
      description: c.assignment.description,
      questions: c.assignment.questions,
      visibilityMode: 'immediate' as const,
      courseTitle: c.courseTitle,
    })),
    ...tutorAssignments
      .filter((a) => a.status === 'published')
      .filter((a) => a.source === 'competition' || (a.courseId && enrolledCourseIds.has(a.courseId)))
      .map((a) => ({
        id: a.id,
        source: a.source,
        title: a.title,
        description: a.description,
        questions: a.questions,
        visibilityMode: a.visibilityMode,
        courseTitle: a.courseTitle,
        tutorName: a.tutorName,
      })),
  ];

  const [activeAssignment, setActiveAssignment] = useState<AvailableAssignmentEntry | null>(null);

  useEffect(() => {
    if (!pendingOpenAssignmentId) return;
    const match = available.find((a) => a.id === pendingOpenAssignmentId);
    if (match) {
      setActiveAssignment(match);
    }
    onConsumePendingOpenAssignment?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per incoming deep link
  }, [pendingOpenAssignmentId]);

  return (
    <div className="space-y-8 w-full">

      {/* My Submissions (default view) */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold font-display text-[#142030] flex items-center space-x-2">
            <FileCheck2 className="w-6 h-6 text-[#143358]" />
            <span>My Submissions</span>
          </h2>
          <p className="text-xs text-[#5E6A79]">Everything you've submitted, and its current status.</p>
        </div>

        {mySubmissions.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-[#FAF7EC] border border-dashed border-[#E1DED4] space-y-2">
            <Hourglass className="w-8 h-8 mx-auto text-[#5E6A79]" />
            <p className="text-sm font-semibold text-[#142030]">No submissions yet</p>
            <p className="text-xs text-[#5E6A79]">Browse Available Assignments below to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#E1DED4] bg-white shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF7EC] border-b border-[#E1DED4] text-[#5E6A79] font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Assignment</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1DED4]">
                {mySubmissions.map((s) => {
                  const badge = SOURCE_BADGE[s.assignmentSource];
                  return (
                    <tr key={s.id} className="hover:bg-[#FAF7EC] transition-colors">
                      <td className="py-3 px-4 font-semibold text-[#142030]">{s.assignmentTitle}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.className}`}>
                          <badge.icon className="w-3 h-3" />
                          <span>{badge.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#5E6A79]">{s.submittedAt}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                          s.status === 'reviewed'
                            ? 'bg-[#179765]/10 text-[#179765] border-[#179765]/30'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {s.status === 'reviewed' ? 'Reviewed' : 'Submitted'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#142030]">
                        {s.status === 'reviewed' ? `${s.percentage}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Available Assignments (unified list) */}
      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-extrabold text-[#142030]">Available Assignments</h3>
          <p className="text-xs text-[#5E6A79] mt-0.5">Course quizzes, tutor-assigned work, and open competitions -- all in one place.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {available.map((a) => {
            const badge = SOURCE_BADGE[a.source];
            const existingSubmission = submissionByAssignmentId.get(a.id);

            return (
              <div
                key={a.id}
                className="p-5 rounded-2xl bg-white border border-[#E1DED4] hover:border-[#143358] shadow-xs transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.className}`}>
                    <badge.icon className="w-3 h-3" />
                    <span>{badge.label}</span>
                  </span>
                  <h4 className="text-sm font-bold text-[#142030]">{a.title}</h4>
                  <p className="text-xs text-[#5E6A79] line-clamp-2">{a.description}</p>
                  {a.courseTitle && <p className="text-[10px] text-[#5E6A79]">{a.courseTitle}</p>}
                </div>

                {existingSubmission ? (
                  <span className={`w-full text-center py-2 rounded-xl text-xs font-bold border ${
                    existingSubmission.status === 'reviewed'
                      ? 'bg-[#179765]/10 text-[#179765] border-[#179765]/30'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {existingSubmission.status === 'reviewed' ? `Reviewed · ${existingSubmission.percentage}%` : 'Submitted · Pending Review'}
                  </span>
                ) : (
                  <button
                    onClick={() => setActiveAssignment(a)}
                    className="w-full py-2.5 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-1.5 transition-all"
                  >
                    <span>Attempt</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Taking an assignment (FR-6/FR-7/FR-8) */}
      {activeAssignment && (
        <AssignmentQuizRunner
          entry={activeAssignment}
          onSubmitQuiz={onSubmitQuiz}
          onClose={() => setActiveAssignment(null)}
        />
      )}
    </div>
  );
};

// Reuses the existing MC-quiz UI (question, options grid, submit, per-question explanation,
// score report) regardless of Source -- PRD FR-6. Branches on Visibility Mode at submit time
// (FR-7 Immediate vs FR-8 Hold).
const AssignmentQuizRunner: React.FC<{
  entry: AvailableAssignmentEntry;
  onSubmitQuiz: StudentAssignmentsSectionProps['onSubmitQuiz'];
  onClose: () => void;
}> = ({ entry, onSubmitQuiz, onClose }) => {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [result, setResult] = useState<AssignmentSubmission | null>(null);

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (isSubmitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submission = await onSubmitQuiz({
      assignmentId: entry.id,
      assignmentSource: entry.source,
      assignmentTitle: entry.title,
      questions: entry.questions,
      answers,
      visibilityMode: entry.visibilityMode,
    });
    setResult(submission);
    setIsSubmitted(true);
    if (submission?.status === 'reviewed' && submission.percentage >= 70) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  };

  const isHoldPending = isSubmitted && result?.status === 'submitted';
  const formId = `assignment-quiz-form-${entry.id}`;

  const footer = isHoldPending ? (
    <Button variant="secondary" size="sm" onClick={onClose}>
      Done
    </Button>
  ) : isSubmitted ? (
    <>
      <span className="text-xs text-slate-500 flex items-center space-x-1.5 mr-auto">
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Close this panel and re-attempt from Available Assignments.</span>
      </span>
      <Button variant="secondary" size="sm" onClick={onClose}>
        Done
      </Button>
    </>
  ) : (
    <>
      <span className="text-xs text-slate-500 mr-auto">Select answers for all questions before submitting</span>
      <Button variant="secondary" size="sm" type="submit" form={formId} icon={<Award className="w-4 h-4" />}>
        Submit Assignment for Auto-Grading
      </Button>
    </>
  );

  return (
    <SidePanel
      title={entry.title}
      subtitle={entry.description}
      onClose={onClose}
      closeOnBackdropClick={false}
      width="lg"
      footer={footer}
    >
      <div className="space-y-8 text-[#142030]">
      {isHoldPending ? (
        <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-center space-y-2">
          <Hourglass className="w-8 h-8 mx-auto" />
          <p className="text-sm font-bold">Submitted — pending tutor review</p>
          <p className="text-xs">Your score has been recorded and will appear here once your tutor reviews it.</p>
        </div>
      ) : (
        <form id={formId} onSubmit={handleSubmit} className="space-y-8">
          {entry.questions.map((q, qIdx) => {
            const selectedOpt = answers[q.id];
            const isCorrect = selectedOpt === q.correctAnswerIndex;

            return (
              <div key={q.id} className="p-5 rounded-2xl bg-[#FAF7EC] border border-[#E1DED4] space-y-4">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-bold text-[#142030]">
                    Question {qIdx + 1}: {q.question}
                  </p>
                  {isSubmitted && (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center space-x-1 ${
                      isCorrect ? 'bg-[#179765]/10 text-[#179765] border border-[#179765]/30' : 'bg-red-100 text-red-800 border border-red-300'
                    }`}>
                      {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      <span>{isCorrect ? 'Correct' : 'Incorrect'}</span>
                    </span>
                  )}
                </div>

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
                            : 'bg-white text-[#142030] border-[#E1DED4] hover:bg-slate-100'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full border text-[10px] flex items-center justify-center font-bold ${
                          isOptionSelected ? 'bg-white text-[#143358] border-white' : 'border-[#E1DED4] text-[#5E6A79]'
                        }`}>
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {isSubmitted && (
                  <div className="p-3.5 rounded-xl bg-[#143358]/5 border border-[#143358]/20 text-xs text-[#143358]">
                    <p className="font-bold mb-0.5">Explanation:</p>
                    <p>{q.explanation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </form>
      )}

      {/* Score Report -- Immediate visibility only (FR-7); Hold shows the pending state above instead (FR-8) */}
      {result && result.status === 'reviewed' && (
        <div className="p-6 rounded-2xl bg-[#143358] border border-white/10 text-white space-y-3 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase font-extrabold text-amber-200">Automated Grade Report</p>
              <h3 className="text-2xl font-extrabold font-display">Your Score: {result.percentage}%</h3>
            </div>
            <div className="text-3xl font-extrabold text-[#EC7B38]">
              {result.correctCount} / {result.totalQuestions} Correct
            </div>
          </div>
          <p className="text-xs text-slate-200 flex items-center space-x-1.5">
            {result.percentage >= 70 ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Great job! You met the mastery threshold and earned +150 Mastery Points.</span>
              </>
            ) : (
              <span>Review the explanation notes above and retry to improve your mastery score.</span>
            )}
          </p>
        </div>
      )}

      {/* AI Insight Panel -- carried over unchanged from the retired AssignmentsView.tsx, shown
          once a Reviewed (Immediate-visibility) result is available. */}
      {result && result.status === 'reviewed' && (
        <div className="p-6 rounded-3xl bg-[#143358] text-white border border-white/10 shadow-xl space-y-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-[#BA5012]/15 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center space-x-3 relative z-10">
            <div className="p-3 rounded-2xl bg-white/10 text-amber-300 border border-white/15">
              <Brain className="w-6 h-6 text-[#EC7B38]" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-display text-white">AI Learning Insight &amp; Gap Analysis</h3>
              <p className="text-xs text-slate-200">Adaptive AI diagnostic on your performance for "{entry.title}".</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10 pt-2">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <h4 className="text-xs font-extrabold uppercase text-amber-200 tracking-wider flex items-center space-x-1.5">
                <Target className="w-4 h-4 text-[#EC7B38]" />
                <span>Identified Knowledge Gaps</span>
              </h4>
              {(() => {
                const incorrects = entry.questions.filter((q) => answers[q.id] !== q.correctAnswerIndex);
                if (incorrects.length === 0) {
                  return (
                    <div className="p-3 rounded-xl bg-[#179765]/20 border border-[#179765]/30 text-xs text-emerald-200 space-y-1">
                      <p className="font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-4 h-4 text-[#179765]" />
                        <span>Zero Knowledge Gaps Found!</span>
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-2">
                    {incorrects.map((q, idx) => (
                      <div key={q.id} className="p-2.5 rounded-xl bg-white/10 border border-white/10 text-xs space-y-1">
                        <span className="text-[10px] font-bold text-amber-200 uppercase">Gap #{idx + 1}: {q.question.slice(0, 45)}...</span>
                        <p className="text-[11px] text-slate-200">{q.explanation}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <h4 className="text-xs font-extrabold uppercase text-amber-200 tracking-wider flex items-center space-x-1.5">
                <Lightbulb className="w-4 h-4 text-amber-300" />
                <span>Personalized Actionable Tips</span>
              </h4>
              <div className="space-y-2 text-xs text-slate-200">
                <div className="p-2.5 rounded-xl bg-white/10 border border-white/10 flex items-start space-x-2">
                  <BookOpen className="w-4 h-4 text-[#EC7B38] shrink-0 mt-0.5" />
                  <p className="font-bold text-white">Review Drilldown Explanations in the course player.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </SidePanel>
  );
};
