import React, { useState } from 'react';
import { GraduationCap, LayoutDashboard } from 'lucide-react';
import { useDashboard } from './useDashboard';
import { StudentDashboardView } from './StudentDashboardView';
import { TutorDashboardView } from './TutorDashboardView';
import { useTutorHub } from './useTutorHub';
import { useAssignmentsHub } from './useAssignmentsHub';

interface DashboardProps {
  onOpenCourse: (courseId: string, lessonId?: string) => void;
  onNavigateTab: (tab: 'groups' | 'certificates') => void;
  // Owned by App.tsx (rather than called again inside here) so AppointmentToast keeps
  // sharing the same fetched tutorSlots without a second, un-synced copy of the state --
  // same reasoning the retired TutorHubView used to document.
  tutorHub: ReturnType<typeof useTutorHub>;
  assignmentsHub: ReturnType<typeof useAssignmentsHub>;
  // FR-16: set when CoursePlayer's "Take Quiz" button navigated here for a specific lesson
  // assignment -- consumed once by StudentAssignmentsSection to open it directly.
  pendingOpenAssignmentId?: string;
  onConsumePendingOpenAssignment?: () => void;
}

// Single role-routed Dashboard entry point (merge of the former separate "Dashboard" and
// "Tutor Hub & Booking" tabs, plus the former standalone "Assignments" tab). Student/Tutor
// accounts render exactly one dashboard, chosen by the authenticated user's real role -- no
// manual perspective switch. Master/Support are the sole, narrower exception: they default to
// the Student Dashboard with an admin-only toggle to preview the Tutor Dashboard in an
// empty/demo state (PRD FR-1/FR-2/FR-3).
export const Dashboard: React.FC<DashboardProps> = ({
  onOpenCourse,
  onNavigateTab,
  tutorHub,
  assignmentsHub,
  pendingOpenAssignmentId,
  onConsumePendingOpenAssignment,
}) => {
  const { user, isLoading } = useDashboard();
  const {
    courses,
    tutorSlots,
    groupRequests,
    publicClasses,
    addCourse,
    bookSlot,
    updateSlot,
    requestGroupClass,
    subscribePublicClass,
    announcePublicClass,
    isLoading: isTutorHubLoading,
  } = tutorHub;
  const {
    courseAssignments,
    tutorAssignments,
    submissions,
    submitQuiz,
    createAssignment,
    publishAssignment,
    unpublishAssignment,
    reviewSubmission,
    reEvaluateSubmission,
    isLoading: isAssignmentsHubLoading,
  } = assignmentsHub;

  // Master/Support-only preview toggle (FR-3). Never rendered or reachable for Student/Tutor
  // accounts -- see the role check below.
  const [previewTutorView, setPreviewTutorView] = useState(false);

  if (isLoading || !user) return null;

  if (user.role === 'Tutor') {
    // Matches the retired TutorHubView's own loading gate for its educator perspective --
    // tutorHub's fetch (slots/public classes) is independent of useDashboard's. Scoped to the
    // Tutor path only: the Student Dashboard below must not pick up a new blocking dependency
    // on tutorHub's/assignmentsHub's load just because these sections were folded into it
    // (Cross-Cutting NFR, PRD §4.6) -- it renders immediately and sections fill in once ready.
    if (isTutorHubLoading || isAssignmentsHubLoading) return null;
    return (
      <TutorDashboardView
        user={user}
        courses={courses}
        onAddCourse={addCourse}
        tutorSlots={tutorSlots}
        onUpdateSlot={updateSlot}
        groupRequests={groupRequests}
        publicClasses={publicClasses}
        onAnnouncePublicClass={announcePublicClass}
        tutorAssignments={tutorAssignments}
        submissions={submissions}
        onCreateAssignment={createAssignment}
        onPublishAssignment={publishAssignment}
        onUnpublishAssignment={unpublishAssignment}
        onReviewSubmission={reviewSubmission}
        onReEvaluateSubmission={reEvaluateSubmission}
      />
    );
  }

  const canPreviewTutorView = user.role === 'Master' || user.role === 'Support';

  return (
    <div className="space-y-6 w-full">
      {canPreviewTutorView && (
        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-[#E1DED4] shadow-2xs w-full sm:w-auto">
          <button
            onClick={() => setPreviewTutorView(false)}
            className={`flex-1 sm:flex-initial py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
              !previewTutorView
                ? 'bg-[#143358] text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Student Dashboard</span>
          </button>
          <button
            onClick={() => setPreviewTutorView(true)}
            className={`flex-1 sm:flex-initial py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
              previewTutorView
                ? 'bg-[#143358] text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Preview only -- shows the Tutor Dashboard layout with no real tutor data"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Preview Tutor Dashboard</span>
          </button>
        </div>
      )}

      {canPreviewTutorView && previewTutorView ? (
        // demo mode always forces empty slots/classes regardless of tutorHub's load state
        // (see TutorDashboardView), so no loading gate is needed here.
        <TutorDashboardView
          user={user}
          courses={courses}
          onAddCourse={addCourse}
          tutorSlots={tutorSlots}
          onUpdateSlot={updateSlot}
          groupRequests={groupRequests}
          publicClasses={publicClasses}
          onAnnouncePublicClass={announcePublicClass}
          tutorAssignments={tutorAssignments}
          submissions={submissions}
          onCreateAssignment={createAssignment}
          onPublishAssignment={publishAssignment}
          onUnpublishAssignment={unpublishAssignment}
          onReviewSubmission={reviewSubmission}
          onReEvaluateSubmission={reEvaluateSubmission}
          demo
        />
      ) : (
        <StudentDashboardView
          onOpenCourse={onOpenCourse}
          onNavigateTab={onNavigateTab}
          tutorSlots={tutorSlots}
          onBookSlot={bookSlot}
          groupRequests={groupRequests}
          onRequestGroupClass={requestGroupClass}
          publicClasses={publicClasses}
          onSubscribePublicClass={subscribePublicClass}
          courseAssignments={courseAssignments}
          tutorAssignments={tutorAssignments}
          submissions={submissions}
          onSubmitQuiz={submitQuiz}
          pendingOpenAssignmentId={pendingOpenAssignmentId}
          onConsumePendingOpenAssignment={onConsumePendingOpenAssignment}
        />
      )}
    </div>
  );
};
