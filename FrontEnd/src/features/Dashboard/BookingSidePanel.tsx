import React from 'react';
import { TutorCalendarSlot } from '../../types';
import { SidePanel } from '../../ui/SidePanel';
import { Button } from '../../ui/Button';

interface BookingSidePanelProps {
  slot: TutorCalendarSlot;
  bookingNotes: string;
  onBookingNotesChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

// Extracted from StudentTutorBookingView.tsx: the "Confirm Tutoring Booking" side panel shown
// once a student has picked a slot to book.
export const BookingSidePanel: React.FC<BookingSidePanelProps> = ({
  slot,
  bookingNotes,
  onBookingNotesChange,
  onClose,
  onConfirm,
}) => {
  return (
    <SidePanel
      title={`Book Slot with ${slot.tutorName}`}
      subtitle="Confirm Tutoring Booking"
      onClose={onClose}
      closeOnBackdropClick={false}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={onConfirm}>
            Confirm & Pay
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="p-4 rounded-2xl bg-[#FAF7EC] border border-[#E1DED4] space-y-2 text-xs text-[#142030]">
          <div className="flex justify-between">
            <span className="text-[#5E6A79]">Date:</span>
            <span className="font-bold text-[#142030]">{slot.date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#5E6A79]">Time:</span>
            <span className="font-bold text-[#142030]">{slot.startTime} - {slot.endTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#5E6A79]">Duration:</span>
            <span className="font-bold text-[#142030]">{slot.durationMinutes} minutes</span>
          </div>
          <div className="flex justify-between border-t border-[#E1DED4] pt-2 font-bold text-[#142030] text-sm">
            <span>Total Cost:</span>
            <span className="text-[#BA5012]">${(slot.ratePerMinute * slot.durationMinutes).toFixed(2)}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#142030]">Topic / Notes for Tutor:</label>
          <textarea
            value={bookingNotes}
            onChange={(e) => onBookingNotesChange(e.target.value)}
            placeholder="E.g., I'm preparing for Class 12th board physics exam and need help deriving Bloch sphere state vectors..."
            className="w-full p-3 rounded-xl bg-white border border-[#E1DED4] text-xs text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
            rows={3}
          />
        </div>
      </div>
    </SidePanel>
  );
};
