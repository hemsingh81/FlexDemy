import { useCallback, useEffect, useState } from 'react';
import { GroupClassRequest, PublicLiveClass, TutorCalendarSlot } from '../../types';
import * as tutorService from '../../services/tutorService';
import * as groupStudyService from '../../services/groupStudyService';
import { useDomain } from '../../context/DomainContext';
import { useToast } from '../../context/ToastContext';

export const useTutorHub = () => {
  const { user, courses, addCourse } = useDomain();
  const { showToast } = useToast();

  const [tutorSlots, setTutorSlots] = useState<TutorCalendarSlot[]>([]);
  const [groupRequests, setGroupRequests] = useState<GroupClassRequest[]>([]);
  const [publicClasses, setPublicClasses] = useState<PublicLiveClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      tutorService.getTutorSlots(),
      groupStudyService.getGroupRequests(),
      groupStudyService.getPublicClasses(),
    ]).then(([slots, requests, classes]) => {
      if (cancelled) return;
      setTutorSlots(slots);
      setGroupRequests(requests);
      setPublicClasses(classes);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const bookSlot = useCallback(
    (slotId: string, notes?: string) => {
      if (!user) return;
      const slot = tutorSlots.find((s) => s.id === slotId);
      tutorService.bookSlot(slotId, user.id, user.name, notes).then((updated) => {
        setTutorSlots(updated);
        showToast({
          message: slot ? `Session booked with ${slot.tutorName}.` : 'Session booked.',
          variant: 'success',
        });
      });
    },
    [user, tutorSlots, showToast]
  );

  const updateSlot = useCallback((updatedSlot: TutorCalendarSlot) => {
    tutorService.upsertSlot(updatedSlot).then((updated) => {
      setTutorSlots(updated);
      showToast({ message: 'Availability slot saved.', variant: 'success' });
    });
  }, [showToast]);

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
          setGroupRequests(updated);
          showToast({ message: 'Group pool request published.', variant: 'success' });
        });
    },
    [user, showToast]
  );

  const subscribePublicClass = useCallback(
    (classId: string) => {
      if (!user) return;
      groupStudyService
        .subscribePublicClass(classId, user.id, user.name, user.avatar)
        .then((updated) => {
          setPublicClasses(updated);
          showToast({ message: 'Registered for masterclass.', variant: 'success' });
        });
    },
    [user, showToast]
  );

  const announcePublicClass = useCallback((newClass: PublicLiveClass) => {
    groupStudyService.announcePublicClass(newClass).then((updated) => {
      setPublicClasses(updated);
      showToast({ message: 'Public class saved.', variant: 'success' });
    });
  }, [showToast]);

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
