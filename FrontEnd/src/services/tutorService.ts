import { TutorCalendarSlot } from '../types';
import { MOCK_TUTOR_SLOTS } from '../data/mockData';

let tutorSlots: TutorCalendarSlot[] = MOCK_TUTOR_SLOTS;

export const getTutorSlots = async (): Promise<TutorCalendarSlot[]> => {
  return tutorSlots;
};

export const bookSlot = async (
  slotId: string,
  studentId: string,
  studentName: string,
  notes?: string
): Promise<TutorCalendarSlot[]> => {
  tutorSlots = tutorSlots.map((slot) =>
    slot.id === slotId
      ? {
          ...slot,
          isBooked: true,
          bookedByStudentId: studentId,
          bookedByStudentName: studentName,
          topic: notes || slot.topic || '1-on-1 Tutoring Session',
        }
      : slot
  );
  return tutorSlots;
};

export const upsertSlot = async (updatedSlot: TutorCalendarSlot): Promise<TutorCalendarSlot[]> => {
  const exists = tutorSlots.some((s) => s.id === updatedSlot.id);
  tutorSlots = exists
    ? tutorSlots.map((s) => (s.id === updatedSlot.id ? updatedSlot : s))
    : [updatedSlot, ...tutorSlots];
  return tutorSlots;
};
