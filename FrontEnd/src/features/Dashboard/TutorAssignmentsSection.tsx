import React, { useState } from 'react';
import {
  FileCheck2,
  Plus,
  Radio,
  BookOpen,
  CheckCircle2,
  Users,
  Edit,
  Eye,
} from 'lucide-react';
import {
  AssignmentSubmission,
  Course,
  QuizQuestion,
  TutorAssignment,
  UserProfile,
} from '../../types';
import { SidePanel } from '../../ui/SidePanel';
import { Button } from '../../ui/Button';
import { ChoiceToggle } from './ChoiceToggle';

interface TutorAssignmentsSectionProps {
  user: UserProfile;
  courses: Course[];
  tutorAssignments: TutorAssignment[];
  submissions: AssignmentSubmission[];
  onCreateAssignment: (data: Omit<TutorAssignment, 'id' | 'status' | 'createdAt'>, publish?: boolean) => void;
  onPublishAssignment: (assignmentId: string) => void;
  onUnpublishAssignment: (assignmentId: string) => void;
  onReviewSubmission: (submissionId: string) => void;
  onReEvaluateSubmission: (submissionId: string, newCorrectCount: number, newPercentage: number) => void;
}

export const TutorAssignmentsSection: React.FC<TutorAssignmentsSectionProps> = ({
  user,
  courses,
  tutorAssignments,
  submissions,
  onCreateAssignment,
  onPublishAssignment,
  onUnpublishAssignment,
  onReviewSubmission,
  onReEvaluateSubmission,
}) => {
  const myAssignments = tutorAssignments
    .filter((a) => a.tutorId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const myCourses = courses.filter((c) => c.instructor.name === user.name);
  const courseOptions = myCourses.length > 0 ? myCourses : courses;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewingAssignment, setViewingAssignment] = useState<TutorAssignment | null>(null);

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold font-display text-[#142030] flex items-center space-x-2">
            <FileCheck2 className="w-6 h-6 text-[#143358]" />
            <span>My Assignments</span>
          </h2>
          <p className="text-xs text-[#5E6A79]">Create assignments, publish them, and review student submissions.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2.5 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold shadow-md flex items-center space-x-1.5 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Assignment</span>
        </button>
      </div>

      {myAssignments.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-[#FAF7EC] border border-dashed border-[#E1DED4] space-y-2">
          <p className="text-sm font-semibold text-[#142030]">No assignments created yet</p>
          <p className="text-xs text-[#5E6A79]">Use "Create Assignment" above to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {myAssignments.map((a) => {
            const assignmentSubmissions = submissions.filter((s) => s.assignmentId === a.id);
            const pendingCount = assignmentSubmissions.filter((s) => s.status === 'submitted').length;

            return (
              <div key={a.id} className="p-5 rounded-2xl bg-white border border-[#E1DED4] shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                    a.status === 'published'
                      ? 'bg-[#179765]/10 text-[#179765] border-[#179765]/30'
                      : 'bg-slate-100 text-slate-600 border-slate-300'
                  }`}>
                    {a.status}
                  </span>
                  <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-[#5E6A79]">
                    {a.source === 'competition' ? <Radio className="w-3 h-3 text-[#BA5012]" /> : <BookOpen className="w-3 h-3 text-[#143358]" />}
                    <span>{a.source === 'competition' ? 'Open / Competition' : a.courseTitle}</span>
                  </span>
                </div>

                <h4 className="text-sm font-bold text-[#142030]">{a.title}</h4>
                <p className="text-xs text-[#5E6A79] line-clamp-2">{a.description}</p>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-[#E1DED4]">
                  <span className="text-[#5E6A79] font-medium flex items-center space-x-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>{assignmentSubmissions.length} submitted{pendingCount > 0 ? ` · ${pendingCount} pending` : ''}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setViewingAssignment(a)}
                    className="flex-1 py-2 bg-[#FAF7EC] hover:bg-slate-200 text-[#142030] rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 border border-[#E1DED4]"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Submissions</span>
                  </button>
                  {a.status === 'draft' ? (
                    <button
                      onClick={() => onPublishAssignment(a.id)}
                      className="flex-1 py-2 bg-[#179765] hover:bg-[#179765]/90 text-white rounded-xl text-xs font-bold"
                    >
                      Publish
                    </button>
                  ) : (
                    <button
                      onClick={() => onUnpublishAssignment(a.id)}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300"
                    >
                      Unpublish
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isCreateOpen && (
        <CreateAssignmentModal
          user={user}
          courseOptions={courseOptions}
          onClose={() => setIsCreateOpen(false)}
          onCreate={(data, publish) => {
            onCreateAssignment(data, publish);
            setIsCreateOpen(false);
          }}
        />
      )}

      {viewingAssignment && (
        <SubmissionsModal
          assignment={viewingAssignment}
          submissions={submissions.filter((s) => s.assignmentId === viewingAssignment.id)}
          onClose={() => setViewingAssignment(null)}
          onReview={onReviewSubmission}
          onReEvaluate={onReEvaluateSubmission}
        />
      )}
    </div>
  );
};

// FR-10/FR-11/FR-12: title, description, target (course link or Open/Competition), MC question
// builder (reusing the existing QuizQuestion shape as the answer key), scoring/visibility
// choice, Draft vs Publish.
const CreateAssignmentModal: React.FC<{
  user: UserProfile;
  courseOptions: Course[];
  onClose: () => void;
  onCreate: (data: Omit<TutorAssignment, 'id' | 'status' | 'createdAt'>, publish: boolean) => void;
}> = ({ user, courseOptions, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isOpenCompetition, setIsOpenCompetition] = useState(false);
  const [courseId, setCourseId] = useState(courseOptions[0]?.id || '');
  const [visibilityMode, setVisibilityMode] = useState<'immediate' | 'hold'>('hold');
  const [questions, setQuestions] = useState<QuizQuestion[]>([
    { id: `q_${Date.now()}`, question: '', options: ['', ''], correctAnswerIndex: 0, explanation: '' },
  ]);

  const updateQuestion = (qId: string, patch: Partial<QuizQuestion>) => {
    setQuestions((prev) => prev.map((q) => (q.id === qId ? { ...q, ...patch } : q)));
  };

  const updateOption = (qId: string, optIdx: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, options: q.options.map((o, i) => (i === optIdx ? value : o)) } : q))
    );
  };

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      { id: `q_${Date.now()}`, question: '', options: ['', ''], correctAnswerIndex: 0, explanation: '' },
    ]);
  };

  const hasValidQuestion = questions.some((q) => q.question.trim() && q.options.every((o) => o.trim()));

  const buildData = (): Omit<TutorAssignment, 'id' | 'status' | 'createdAt'> => {
    const targetCourse = courseOptions.find((c) => c.id === courseId);
    return {
      title: title || 'Untitled Assignment',
      description,
      questions,
      source: isOpenCompetition ? 'competition' : 'tutor',
      courseId: isOpenCompetition ? undefined : courseId,
      courseTitle: isOpenCompetition ? undefined : targetCourse?.title,
      tutorId: user.id,
      tutorName: user.name,
      visibilityMode,
    };
  };

  return (
    <SidePanel
      title="Create Assignment"
      onClose={onClose}
      closeOnBackdropClick={false}
      width="lg"
      footer={({ requestClose }) => (
        <>
          <Button variant="ghost" size="sm" onClick={requestClose}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onCreate(buildData(), false)}>
            Save as Draft
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onCreate(buildData(), true)}
            disabled={!title.trim() || !hasValidQuestion}
            title={!hasValidQuestion ? 'At least one fully-filled-in question is required to publish' : undefined}
          >
            Save &amp; Publish
          </Button>
        </>
      )}
    >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-[#142030]">Title:</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="E.g., Bloch Sphere Vector Proofs"
              className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs mt-1 text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
            />
          </div>

          <div>
            <label className="font-bold text-[#142030]">Description:</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs mt-1 text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
            />
          </div>

          <div>
            <label className="font-bold text-[#142030]">Target:</label>
            <ChoiceToggle
              value={isOpenCompetition ? 'competition' : 'course'}
              onChange={(v) => setIsOpenCompetition(v === 'competition')}
              options={[
                { value: 'course', label: 'Link to a Course', icon: BookOpen, selectedClassName: 'bg-[#143358] text-white border-[#143358]' },
                { value: 'competition', label: 'Open / Competition', icon: Radio, selectedClassName: 'bg-[#BA5012] text-white border-[#BA5012]' },
              ]}
            />
            {!isOpenCompetition && (
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs mt-2 text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
              >
                {courseOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="font-bold text-[#142030]">Visibility Mode:</label>
            <ChoiceToggle
              value={visibilityMode}
              onChange={setVisibilityMode}
              options={[
                {
                  value: 'immediate',
                  label: 'Immediate',
                  description: 'Student sees the auto-score right away',
                  selectedClassName: 'bg-[#179765] text-white border-[#179765]',
                },
                {
                  value: 'hold',
                  label: 'Hold for Review',
                  description: 'You review before the score is visible',
                  selectedClassName: 'bg-[#BA5012] text-white border-[#BA5012]',
                },
              ]}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-[#142030]">Questions ({questions.length}):</label>
              <button
                type="button"
                onClick={addQuestion}
                className="px-3 py-1.5 bg-[#143358]/10 text-[#143358] hover:bg-[#143358]/20 border border-[#143358]/20 rounded-xl text-xs font-bold"
              >
                + Add Question
              </button>
            </div>

            {questions.map((q, qIdx) => (
              <div key={q.id} className="p-4 rounded-2xl bg-[#FAF7EC] border border-[#E1DED4] space-y-2">
                <p className="font-bold text-[#143358]">Question {qIdx + 1}</p>
                <input
                  type="text"
                  value={q.question}
                  onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                  placeholder="Question text"
                  className="w-full p-2 bg-white rounded-xl border border-[#E1DED4] text-xs font-semibold text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
                />
                {q.options.map((opt, optIdx) => (
                  <div key={optIdx} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name={`correct-${q.id}`}
                      checked={q.correctAnswerIndex === optIdx}
                      onChange={() => updateQuestion(q.id, { correctAnswerIndex: optIdx })}
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + optIdx)}${optIdx < 2 ? ' (required)' : ''}`}
                      className="flex-1 p-2 bg-white rounded-xl border border-[#E1DED4] text-xs text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
                    />
                  </div>
                ))}
                <input
                  type="text"
                  value={q.explanation}
                  onChange={(e) => updateQuestion(q.id, { explanation: e.target.value })}
                  placeholder="Explanation shown after submit (optional)"
                  className="w-full p-2 bg-white rounded-xl border border-[#E1DED4] text-xs text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
                />
              </div>
            ))}
          </div>
        </div>
    </SidePanel>
  );
};

// FR-13/FR-14/FR-15: per-assignment submissions list, Review action (Hold), Re-evaluate action
// (already-Reviewed).
const SubmissionsModal: React.FC<{
  assignment: TutorAssignment;
  submissions: AssignmentSubmission[];
  onClose: () => void;
  onReview: (submissionId: string) => void;
  onReEvaluate: (submissionId: string, newCorrectCount: number, newPercentage: number) => void;
}> = ({ assignment, submissions, onClose, onReview, onReEvaluate }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const sorted = [...submissions].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  const startReEvaluate = (s: AssignmentSubmission) => {
    setEditingId(s.id);
    setEditValue(String(s.percentage));
  };

  const saveReEvaluate = (s: AssignmentSubmission) => {
    const newPercentage = Math.max(0, Math.min(100, Number(editValue) || 0));
    const newCorrectCount = Math.round((newPercentage / 100) * s.totalQuestions);
    onReEvaluate(s.id, newCorrectCount, newPercentage);
    setEditingId(null);
  };

  return (
    <SidePanel
      title={assignment.title}
      subtitle={`${sorted.length} submission${sorted.length === 1 ? '' : 's'}`}
      onClose={onClose}
      closeOnBackdropClick
    >
        {sorted.length === 0 ? (
          <p className="text-center text-xs text-slate-500 py-8">No submissions yet for this assignment.</p>
        ) : (
          <div className="space-y-3">
            {sorted.map((s) => (
              <div key={s.id} className="p-4 rounded-2xl bg-[#FAF7EC] border border-[#E1DED4] space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#142030]">{s.studentName}</p>
                    <p className="text-[10px] text-slate-500">{s.submittedAt}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                    s.status === 'reviewed'
                      ? 'bg-[#179765]/10 text-[#179765] border-[#179765]/30'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {s.status}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  {editingId === s.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-20 p-1.5 rounded-lg bg-white border border-[#E1DED4] text-xs text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
                      />
                      <span className="text-xs text-slate-600">%</span>
                      <button
                        onClick={() => saveReEvaluate(s)}
                        className="px-3 py-1.5 bg-[#143358] text-white rounded-lg text-xs font-bold"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm font-extrabold text-[#142030]">
                      {s.correctCount} / {s.totalQuestions} correct · {s.percentage}%
                    </span>
                  )}

                  {editingId !== s.id && (
                    <div className="flex items-center space-x-2">
                      {s.status === 'submitted' && (
                        <button
                          onClick={() => onReview(s.id)}
                          className="px-3 py-1.5 bg-[#179765] hover:bg-[#179765]/90 text-white rounded-lg text-xs font-bold flex items-center space-x-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Review &amp; Publish</span>
                        </button>
                      )}
                      {s.status === 'reviewed' && (
                        <button
                          onClick={() => startReEvaluate(s)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center space-x-1"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Re-evaluate</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
    </SidePanel>
  );
};
