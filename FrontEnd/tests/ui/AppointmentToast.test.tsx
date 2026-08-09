import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppointmentToast } from '@/src/ui/AppointmentToast';
import { TutorCalendarSlot } from '@/src/types';

const slot: TutorCalendarSlot = {
  id: 'slot_1',
  tutorId: 'tutor_1',
  tutorName: 'Dr. Rostova',
  tutorAvatar: '',
  date: '2026-08-09',
  startTime: '10:00 AM',
  endTime: '10:30 AM',
  durationMinutes: 30,
  isBooked: true,
  sessionType: 'one_on_one',
  ratePerMinute: 1.5,
};

describe('AppointmentToast', () => {
  it('renders nothing when there are no booked slots', () => {
    const { container } = render(<AppointmentToast bookedSlots={[]} onJoinSession={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the tutor name when a slot is booked', () => {
    render(<AppointmentToast bookedSlots={[slot]} onJoinSession={vi.fn()} />);
    expect(screen.getByText(/Dr\. Rostova/)).toBeInTheDocument();
  });
});
