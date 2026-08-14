import { useCallback } from 'react';
import { GroupClassRequest, PublicLiveClass, TutorCalendarSlot } from '../../types';
import * as tutorService from '../../services/tutorService';
import * as groupStudyService from '../../services/groupStudyService';
import { useDomain } from '../../context/DomainContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';

interface TutorHubData {
  tutorSlots: TutorCalendarSlot[];
  groupRequests: GroupClassRequest[];
  publicClasses: PublicLiveClass[];
}

const EMPTY_TUTOR_HUB_DATA: TutorHubData = { tutorSlots: [], groupRequests: [], publicClasses: [] };

export const useTutorHub = () => {
  const { user, courses, addCourse } = useDomain();
  const { showToast } = useToast();

  // Same Promise.all -> combined-object shape as useAssignmentsHub.ts, via hooks/useAsync.ts --
  // the mutators below patch one field of `data` at a time via setData, so this hook's own
  // public return shape (tutorSlots/groupRequests/publicClasses as separate fields) stays
  // unchanged even though they're now backed by one combined async fetch under the hood.
  const { data, setData, isLoading } = useAsync<TutorHubData>(
    () =>
      Promise.all([
        tutorService.getTutorSlots(),
        groupStudyService.getGroupRequests(),
        groupStudyService.getPublicClasses(),
      ]).then(([tutorSlots, groupRequests, publicClasses]) => ({ tutorSlots, groupRequests, publicClasses })),
    EMPTY_TUTOR_HUB_DATA,
    []
  );
  const { tutorSlots, groupRequests, publicClasses } = data;

  const bookSlot = useCallback(
    (slotId: string, notes?: string) => {
      if (!user) return;
      const slot = tutorSlots.find((s) => s.id === slotId);
      tutorService.bookSlot(slotId, user.id, user.name, notes).then((updated) => {
        setData((prev) => ({ ...prev, tutorSlots: updated }));
        showToast({
          message: slot ? `Session booked with ${slot.tutorName}.` : 'Session booked.',
          variant: 'success',
        });
      });
    },
    [user, tutorSlots, showToast, setData]
  );

  const updateSlot = useCallback((updatedSlot: TutorCalendarSlot) => {
    tutorService.upsertSlot(updatedSlot).then((updated) => {
      setData((prev) => ({ ...prev, tutorSlots: updated }));
      showToast({ message: 'Availability slot saved.', variant: 'success' });
    });
  }, [showToast, setData]);

  const requestGroupClass = useCallback(
    (topic: string, courseTitle: string) => {
      if (!user) return;
      groupStudyService
        .addGroupRequest({
          id: `req_${Date.now()}`,
          topic,
          courseTitle,
          requestedByStudentId: user.id,
          requestedByStudentName: user.name,
          ratePerMinute: 0.9,
          maxParticipants: 5,
          status: 'pending',
          studentPool: [{ studentId: user.id, studentName: user.name, avatar: user.avatar }],
        })
        .then((updated) => {
          setData((prev) => ({ ...prev, groupRequests: updated }));
          showToast({ message: 'Group pool request published.', variant: 'success' });
        });
    },
    [user, showToast, setData]
  );

  const subscribePublicClass = useCallback(
    (classId: string) => {
      if (!user) return;
      groupStudyService
        .subscribePublicClass(classId, user.id, user.name, user.avatar)
        .then((updated) => {
          setData((prev) => ({ ...prev, publicClasses: updated }));
          showToast({ message: 'Registered for masterclass.', variant: 'success' });
        });
    },
    [user, showToast, setData]
  );

  const announcePublicClass = useCallback((newClass: PublicLiveClass) => {
    groupStudyService.announcePublicClass(newClass).then((updated) => {
      setData((prev) => ({ ...prev, publicClasses: updated }));
      showToast({ message: 'Public class saved.', variant: 'success' });
    });
  }, [showToast, setData]);

  return {
    user,
    courses,
    tutorSlots,
    groupRequests,
    publicClasses,
    isLoading,
    addCourse,
    bookSlot,
    updateSlot,
    requestGroupClass,
    subscribePublicClass,
    announcePublicClass,
  };
};
