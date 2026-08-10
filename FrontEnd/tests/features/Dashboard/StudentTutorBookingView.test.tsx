import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentTutorBookingView } from '@/src/features/Dashboard/StudentTutorBookingView';
import { TutorCalendarSlot, UserProfile } from '@/src/types';

const user: UserProfile = {
  id: 'usr_1',
  name: 'Hem Singh',
  email: '',
  avatar: '',
  role: 'Student',
  streakDays: 4,
  totalPoints: 250,
  isDarkMode: false,
  progress: {},
};

const slot: TutorCalendarSlot = {
  id: 'slot_1',
  tutorId: 'tutor_1',
  tutorName: 'Dr. Elena Rostova',
  tutorAvatar: '',
  date: '2026-08-10',
  startTime: '02:00 PM',
  endTime: '03:00 PM',
  durationMinutes: 60,
  isBooked: false,
  sessionType: 'one_on_one',
  ratePerMinute: 1.5,
  topic: 'Quantum Vectors',
};

describe('StudentTutorBookingView', () => {
  it('renders available calendar slots', () => {
    render(
      <StudentTutorBookingView
        user={user}
        tutorSlots={[slot]}
        onBookSlot={vi.fn()}
        groupRequests={[]}
        onRequestGroupClass={vi.fn()}
        publicClasses={[]}
        onSubscribePublicClass={vi.fn()}
      />
    );

    expect(screen.getByText('Student Session Booking Portal')).toBeInTheDocument();
    expect(screen.getAllByText('Dr. Elena Rostova').length).toBeGreaterThan(0);
  });

  it('books a slot: selecting a slot, confirming, calls onBookSlot with the slot id and notes', async () => {
    const onBookSlot = vi.fn();
    const u = userEvent.setup();

    render(
      <StudentTutorBookingView
        user={user}
        tutorSlots={[slot]}
        onBookSlot={onBookSlot}
        groupRequests={[]}
        onRequestGroupClass={vi.fn()}
        publicClasses={[]}
        onSubscribePublicClass={vi.fn()}
      />
    );

    await u.click(screen.getByText('Book Slot'));
    expect(screen.getByText(`Book Slot with ${slot.tutorName}`)).toBeInTheDocument();

    await u.click(screen.getByText('Confirm & Pay'));

    expect(onBookSlot).toHaveBeenCalledWith('slot_1', '1-on-1 Tutoring Session');
  });
});
