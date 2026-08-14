import { useState } from 'react';
import { TutorCalendarSlot, UserProfile } from '../../types';
import { useToast } from '../../context/ToastContext';

// Extracted from TutorEducatorHubView.tsx: owns the simple "Add 1-on-1 Teaching Calendar Slot"
// side-panel form state and its save action.
export const useNewSlotModal = (user: UserProfile, onUpdateSlot?: (updatedSlot: TutorCalendarSlot) => void) => {
  const { showToast } = useToast();

  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [slotDate, setSlotDate] = useState('2026-08-09');
  const [slotStart, setSlotStart] = useState('02:00 PM');
  const [slotEnd, setSlotEnd] = useState('03:00 PM');
  const [slotTopic, setSlotTopic] = useState('Class 12th Quantum Vector Derivations');

  const open = () => setIsSlotModalOpen(true);
  const close = () => setIsSlotModalOpen(false);

  const handleSave = () => {
    if (onUpdateSlot) {
      onUpdateSlot({
        id: `slot_${Date.now()}`,
        tutorId: user.id,
        tutorName: user.name,
        tutorAvatar: user.avatar,
        date: slotDate,
        startTime: slotStart,
        endTime: slotEnd,
        durationMinutes: 60,
        isBooked: false,
        sessionType: 'one_on_one',
        ratePerMinute: 1.50,
        topic: slotTopic,
      });
    }
    showToast({ message: 'New teaching calendar slot added.', variant: 'success' });
    setIsSlotModalOpen(false);
  };

  return {
    isSlotModalOpen,
    slotDate,
    setSlotDate,
    slotStart,
    setSlotStart,
    slotEnd,
    setSlotEnd,
    slotTopic,
    setSlotTopic,
    open,
    close,
    handleSave,
  };
};
