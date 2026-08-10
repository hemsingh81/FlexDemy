import React, { useState } from 'react';
import { Activity, FileCheck2, GraduationCap } from 'lucide-react';
import { TutorEducatorHubView } from './TutorEducatorHubView';
import { TutorAssignmentsSection } from './TutorAssignmentsSection';
import { DashboardSectionNav } from './DashboardSectionNav';
import {
  AssignmentSubmission,
  Course,
  GroupClassRequest,
  PublicLiveClass,
  TutorAssignment,
  TutorCalendarSlot,
  UserProfile,
} from '../../types';

const TUTOR_NAV_SECTIONS = [
  { id: 'availability-performance', label: 'Availability & Performance', icon: Activity },
  { id: 'assignments', label: 'Assignments', icon: FileCheck2 },
  { id: 'course-publishing', label: 'Course Publishing', icon: GraduationCap },
];

interface TutorDashboardViewProps {
  user: UserProfile;
  courses: Course[];
  onAddCourse: (newCourse: Course) => void;
  tutorSlots: TutorCalendarSlot[];
  onUpdateSlot: (updatedSlot: TutorCalendarSlot) => void;
  groupRequests: GroupClassRequest[];
  publicClasses: PublicLiveClass[];
  onAnnouncePublicClass: (newClass: PublicLiveClass) => void;
  tutorAssignments: TutorAssignment[];
  submissions: AssignmentSubmission[];
  onCreateAssignment: (data: Omit<TutorAssignment, 'id' | 'status' | 'createdAt'>, publish?: boolean) => void;
  onPublishAssignment: (assignmentId: string) => void;
  onUnpublishAssignment: (assignmentId: string) => void;
  onReviewSubmission: (submissionId: string) => void;
  onReEvaluateSubmission: (submissionId: string, newCorrectCount: number, newPercentage: number) => void;
  // Master/Support preview mode (FR-3): renders the full Tutor Dashboard UI in an
  // empty/demo state -- no real slots/bookings/course data, and no mutation persisted
  // against the shared mock data pool, since the viewer isn't a registered tutor.
  demo?: boolean;
}

export const TutorDashboardView: React.FC<TutorDashboardViewProps> = ({
  user,
  courses,
  onAddCourse,
  tutorSlots,
  onUpdateSlot,
  groupRequests,
  publicClasses,
  onAnnouncePublicClass,
  tutorAssignments,
  submissions,
  onCreateAssignment,
  onPublishAssignment,
  onUnpublishAssignment,
  onReviewSubmission,
  onReEvaluateSubmission,
  demo = false,
}) => {
  // Online/Offline availability status -- moved here from the retired TutorHubView,
  // which used to own this alongside the perspective switcher.
  const [isOnline, setIsOnline] = useState(true);

  const noop = () => {};

  return (
    <div className="flex flex-col lg:flex-row items-stretch lg:items-start gap-6 w-full">
      <DashboardSectionNav sections={TUTOR_NAV_SECTIONS} />

      <div className="flex-1 min-w-0 space-y-8">
        <TutorEducatorHubView
          user={user}
          courses={demo ? [] : courses}
          onAddCourse={demo ? noop : onAddCourse}
          tutorSlots={demo ? [] : tutorSlots}
          onUpdateSlot={demo ? noop : onUpdateSlot}
          groupRequests={demo ? [] : groupRequests}
          publicClasses={demo ? [] : publicClasses}
          onAnnouncePublicClass={demo ? noop : onAnnouncePublicClass}
          isOnline={isOnline}
          onToggleOnlineStatus={() => setIsOnline((v) => !v)}
        />

        {/* Assignments (merged from the former standalone Assignments tab -- PRD FR-9..FR-15).
            Empty/demo state for Master/Support preview, same rule as the rest of this page
            (base Dashboard PRD FR-3; this PRD's FR-3 Consequences). */}
        <section id="assignments" className="scroll-mt-24">
          <TutorAssignmentsSection
            user={user}
            courses={demo ? [] : courses}
            tutorAssignments={demo ? [] : tutorAssignments}
            submissions={demo ? [] : submissions}
            onCreateAssignment={demo ? noop : onCreateAssignment}
            onPublishAssignment={demo ? noop : onPublishAssignment}
            onUnpublishAssignment={demo ? noop : onUnpublishAssignment}
            onReviewSubmission={demo ? noop : onReviewSubmission}
            onReEvaluateSubmission={demo ? noop : onReEvaluateSubmission}
          />
        </section>
      </div>
    </div>
  );
};
