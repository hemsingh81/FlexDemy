import { FormEvent, useState } from 'react';
import { TutorCalendarSlot, UserProfile } from '../../types';

// Extracted from StudentTutorBookingView.tsx: owns the screen's local UI state -- the slot
// search/filter, the "confirm booking" side panel, and the "request a group pool" side panel --
// plus the derived slot lists and their save handlers.
export const useBookingState = (
  user: UserProfile,
  tutorSlots: TutorCalendarSlot[],
  onBookSlot: (slotId: string, notes?: string) => void,
  onRequestGroupClass: (topic: string, courseTitle: string) => void
) => {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState<TutorCalendarSlot | null>(null);
  const [bookingNotes, setBookingNotes] = useState<string>('');

  // New Group Request Modal
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [reqTopic, setReqTopic] = useState('');
  const [reqCourseTitle, setReqCourseTitle] = useState('');

  // Filter slots
  const filteredSlots = tutorSlots.filter((slot) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      slot.tutorName.toLowerCase().includes(q) ||
      slot.topic.toLowerCase().includes(q);
    const matchesSubject = selectedSubject === 'all' || true;
    return matchesSearch && matchesSubject;
  });

  // User's booked slots
  const myBookedSlots: TutorCalendarSlot[] = tutorSlots.filter(
    (s) => s.isBooked && (s.bookedByStudentId === user.id || s.studentName === user.name)
  );

  const handleConfirmBooking = () => {
    if (!selectedSlotForBooking) return;
    onBookSlot(selectedSlotForBooking.id, bookingNotes || '1-on-1 Tutoring Session');
    setSelectedSlotForBooking(null);
    setBookingNotes('');
  };

  const handleCreateGroupReq = (e: FormEvent) => {
    e.preventDefault();
    if (!reqTopic || !reqCourseTitle) return;
    onRequestGroupClass(reqTopic, reqCourseTitle);
    setIsGroupModalOpen(false);
    setReqTopic('');
    setReqCourseTitle('');
  };

  return {
    selectedSubject,
    setSelectedSubject,
    searchQuery,
    setSearchQuery,
    selectedSlotForBooking,
    setSelectedSlotForBooking,
    bookingNotes,
    setBookingNotes,
    isGroupModalOpen,
    setIsGroupModalOpen,
    reqTopic,
    setReqTopic,
    reqCourseTitle,
    setReqCourseTitle,
    filteredSlots,
    myBookedSlots,
    handleConfirmBooking,
    handleCreateGroupReq,
  };
};
