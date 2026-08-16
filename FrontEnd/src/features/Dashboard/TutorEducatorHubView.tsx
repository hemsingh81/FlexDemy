import React from 'react';
import {
  Course,
  UserProfile,
  TutorCalendarSlot,
  GroupClassRequest,
  PublicLiveClass,
} from '../../types';
import { CourseWizard } from '../CourseWizard/CourseWizard';
import { CourseContentEditor } from '../CourseContentEditor/CourseContentEditor';
import { EducatorStudioHeader } from './EducatorStudioHeader';
import { TeachingStatsCards } from './TeachingStatsCards';
import { MyCoursesSection } from './MyCoursesSection';
import { TeachingAnalyticsChart } from './TeachingAnalyticsChart';
import { CalendarSlotsSection } from './CalendarSlotsSection';
import { AddSlotPanel } from './AddSlotPanel';
import { PublicClassEditorPanel } from './PublicClassEditorPanel';
import { useCourseCreationFlow } from './useCourseCreationFlow';
import { useNewSlotModal } from './useNewSlotModal';
import { usePublicClassEditor } from './usePublicClassEditor';

interface TutorEducatorHubViewProps {
  user: UserProfile;
  // Story 2.4: vestigial as of this story -- the old wizard's handlePublishCourse (removed
  // here) was their only caller in this file. The new CourseWizard flow persists real Course
  // rows via courseDraftService directly; it has no synthesized mock Course object to push into
  // this in-memory list, so there's nothing left in this file to call onAddCourse with. Left
  // in place rather than removed: both props are threaded through from TutorDashboardView.tsx
  // (and further up), which is outside this story's own File List -- removing the prop chain
  // is a deliberate follow-up for whichever future story next touches it, not a silent
  // out-of-scope change here.
  courses: Course[];
  onAddCourse: (newCourse: Course) => void;
  tutorSlots: TutorCalendarSlot[];
  onUpdateSlot?: (updatedSlot: TutorCalendarSlot) => void;
  groupRequests: GroupClassRequest[];
  publicClasses: PublicLiveClass[];
  onAnnouncePublicClass: (newClass: PublicLiveClass) => void;
  isOnline: boolean;
  onToggleOnlineStatus: () => void;
}

export const TutorEducatorHubView: React.FC<TutorEducatorHubViewProps> = ({
  user,
  courses: _courses,
  onAddCourse: _onAddCourse,
  tutorSlots,
  onUpdateSlot,
  groupRequests: _groupRequests,
  publicClasses,
  onAnnouncePublicClass,
  isOnline,
  onToggleOnlineStatus,
}) => {
  // New Course Wizard (Story 2.1) -> Course Content Editor (Story 2.2) hand-off.
  const courseCreationFlow = useCourseCreationFlow();

  // Add 1-on-1 Teaching Calendar Slot side panel.
  const newSlotModal = useNewSlotModal(user, onUpdateSlot);

  // Create/Edit Public Live Class side panel.
  const publicClassEditor = usePublicClassEditor(user, tutorSlots, publicClasses, onAnnouncePublicClass, onUpdateSlot);

  return (
    <div id="availability-performance" className="scroll-mt-24 space-y-8 w-full">

      <EducatorStudioHeader isOnline={isOnline} onToggleOnlineStatus={onToggleOnlineStatus} />

      {/* Only the New Course Wizard's own hand-off (a freshly-created course, not yet in the My
          Courses list below) renders here, at the top -- immediately visible without the tutor
          having to scroll, same reasoning FR-30 originally established. Resuming an *existing*
          course from My Courses now renders its own editor instance inline, directly beneath the
          clicked row (see MyCoursesSection below) -- gated by contentEditorOrigin so the two
          entry points never both try to show an editor at once for the same shared state. */}
      <CourseContentEditor
        isOpen={courseCreationFlow.isContentEditorOpen && courseCreationFlow.contentEditorOrigin === 'wizard'}
        onClose={courseCreationFlow.closeContentEditor}
        draftId={courseCreationFlow.contentEditorDraftId}
      />

      <TeachingStatsCards />

      {/* FR-31 (CourseWizard PRD S4.11): the "resume a course" list -- placed directly beneath
          the stat cards above, the natural "manage your courses" spot until a UX pass decides
          otherwise (deferred per the PRD's own Notes on FR-31). Owns rendering its own inline
          Course Content Editor instance (openDraftId/onCloseContentEditor) for the Resume path
          -- see the comment on the top-level instance above. Also owns the New Course Wizard
          trigger in its own header (FR-1, Story 5.1: relocated here from TeachingStatsCards
          above). */}
      <MyCoursesSection
        isContentEditorOpen={courseCreationFlow.isContentEditorOpen}
        onResumeDraft={courseCreationFlow.openContentEditorForCourse}
        openDraftId={courseCreationFlow.contentEditorOrigin === 'resume' ? courseCreationFlow.contentEditorDraftId : null}
        onCloseContentEditor={courseCreationFlow.closeContentEditor}
        onOpenNewCourseWizard={courseCreationFlow.openWizard}
      />

      <TeachingAnalyticsChart />

      <CalendarSlotsSection
        tutorSlots={tutorSlots}
        publicClasses={publicClasses}
        onOpenNewPublicClassModal={publicClassEditor.openNew}
        onOpenAddSlotModal={newSlotModal.open}
        onSlotClick={publicClassEditor.openForSlot}
        onEditPublicClass={publicClassEditor.openForClassItem}
      />

      {/* New Course Wizard (Story 2.1) -- mock-data only, replaces the old wizard as the
          Dashboard's course-creation entry point */}
      <CourseWizard
        isOpen={courseCreationFlow.isNewCourseWizardOpen}
        onClose={courseCreationFlow.closeWizard}
        onComplete={courseCreationFlow.handleWizardComplete}
      />

      <AddSlotPanel
        isOpen={newSlotModal.isSlotModalOpen}
        slotDate={newSlotModal.slotDate}
        onSlotDateChange={newSlotModal.setSlotDate}
        slotStart={newSlotModal.slotStart}
        onSlotStartChange={newSlotModal.setSlotStart}
        slotEnd={newSlotModal.slotEnd}
        onSlotEndChange={newSlotModal.setSlotEnd}
        slotTopic={newSlotModal.slotTopic}
        onSlotTopicChange={newSlotModal.setSlotTopic}
        onClose={newSlotModal.close}
        onSave={newSlotModal.handleSave}
      />

      <PublicClassEditorPanel
        isOpen={publicClassEditor.isPublicClassModalOpen}
        editingPublicClass={publicClassEditor.editingPublicClass}
        selectedSlotForEdit={publicClassEditor.selectedSlotForEdit}
        pcTitle={publicClassEditor.pcTitle}
        onPcTitleChange={publicClassEditor.setPcTitle}
        pcDescription={publicClassEditor.pcDescription}
        onPcDescriptionChange={publicClassEditor.setPcDescription}
        pcSubject={publicClassEditor.pcSubject}
        onPcSubjectChange={publicClassEditor.setPcSubject}
        pcDate={publicClassEditor.pcDate}
        onPcDateChange={publicClassEditor.setPcDate}
        pcTime={publicClassEditor.pcTime}
        onPcTimeChange={publicClassEditor.setPcTime}
        pcDuration={publicClassEditor.pcDuration}
        onPcDurationChange={publicClassEditor.setPcDuration}
        pcFlatPrice={publicClassEditor.pcFlatPrice}
        onPcFlatPriceChange={publicClassEditor.setPcFlatPrice}
        pcPricePerMinute={publicClassEditor.pcPricePerMinute}
        onPcPricePerMinuteChange={publicClassEditor.setPcPricePerMinute}
        pcMeetingUrl={publicClassEditor.pcMeetingUrl}
        onPcMeetingUrlChange={publicClassEditor.setPcMeetingUrl}
        pcSessionType={publicClassEditor.pcSessionType}
        onPcSessionTypeChange={publicClassEditor.setPcSessionType}
        onClose={publicClassEditor.close}
        onSubmit={publicClassEditor.handleSave}
      />

    </div>
  );
};
