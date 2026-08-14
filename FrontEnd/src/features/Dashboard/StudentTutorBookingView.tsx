import React from 'react';
import {
  TutorCalendarSlot,
  GroupClassRequest,
  PublicLiveClass,
  UserProfile,
} from '../../types';
import { BookingPerspectiveBanner } from './BookingPerspectiveBanner';
import { MyBookedSessionsSection } from './MyBookedSessionsSection';
import { AvailableSlotsSection } from './AvailableSlotsSection';
import { GroupPoolsAndMasterclassesSection } from './GroupPoolsAndMasterclassesSection';
import { BookingSidePanel } from './BookingSidePanel';
import { RequestGroupSidePanel } from './RequestGroupSidePanel';
import { useBookingState } from './useBookingState';

interface StudentTutorBookingViewProps {
  user: UserProfile;
  tutorSlots: TutorCalendarSlot[];
  onBookSlot: (slotId: string, notes?: string) => void;
  groupRequests: GroupClassRequest[];
  onRequestGroupClass: (topic: string, courseTitle: string) => void;
  publicClasses: PublicLiveClass[];
  onSubscribePublicClass: (classId: string) => void;
  tutorOnlineStatus?: boolean;
  displayMode?: 'auto' | 'table' | 'cards';
}

export const StudentTutorBookingView: React.FC<StudentTutorBookingViewProps> = ({
  user,
  tutorSlots,
  onBookSlot,
  groupRequests,
  onRequestGroupClass,
  publicClasses,
  onSubscribePublicClass,
  tutorOnlineStatus = true,
  displayMode = 'auto',
}) => {
  const booking = useBookingState(user, tutorSlots, onBookSlot, onRequestGroupClass);

  return (
    <div className="space-y-8 w-full">

      <BookingPerspectiveBanner tutorOnlineStatus={tutorOnlineStatus} />

      <MyBookedSessionsSection myBookedSlots={booking.myBookedSlots} displayMode={displayMode} />

      <AvailableSlotsSection
        filteredSlots={booking.filteredSlots}
        searchQuery={booking.searchQuery}
        onSearchQueryChange={booking.setSearchQuery}
        tutorOnlineStatus={tutorOnlineStatus}
        displayMode={displayMode}
        onSelectSlotForBooking={booking.setSelectedSlotForBooking}
      />

      <GroupPoolsAndMasterclassesSection
        groupRequests={groupRequests}
        publicClasses={publicClasses}
        onOpenGroupModal={() => booking.setIsGroupModalOpen(true)}
        onSubscribePublicClass={onSubscribePublicClass}
      />

      {booking.selectedSlotForBooking && (
        <BookingSidePanel
          slot={booking.selectedSlotForBooking}
          bookingNotes={booking.bookingNotes}
          onBookingNotesChange={booking.setBookingNotes}
          onClose={() => booking.setSelectedSlotForBooking(null)}
          onConfirm={booking.handleConfirmBooking}
        />
      )}

      {booking.isGroupModalOpen && (
        <RequestGroupSidePanel
          reqCourseTitle={booking.reqCourseTitle}
          onReqCourseTitleChange={booking.setReqCourseTitle}
          reqTopic={booking.reqTopic}
          onReqTopicChange={booking.setReqTopic}
          onClose={() => booking.setIsGroupModalOpen(false)}
          onSubmit={booking.handleCreateGroupReq}
        />
      )}

    </div>
  );
};
