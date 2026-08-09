import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TutorEducatorHubView } from '@/src/features/TutorHub/TutorEducatorHubView';
import { UserProfile } from '@/src/types';

const user: UserProfile = {
  id: 'tutor_1',
  name: 'Dr. Elena Rostova',
  email: '',
  avatar: '',
  role: 'Tutor',
  streakDays: 4,
  totalPoints: 250,
  preferredVoice: '',
  ttsRate: 1,
  ttsPitch: 1,
  isDarkMode: false,
  progress: {},
};

describe('TutorEducatorHubView', () => {
  it('renders the educator studio header and calendar sections', () => {
    render(
      <TutorEducatorHubView
        user={user}
        courses={[]}
        onAddCourse={vi.fn()}
        tutorSlots={[]}
        onUpdateSlot={vi.fn()}
        groupRequests={[]}
        publicClasses={[]}
        onAnnouncePublicClass={vi.fn()}
        isOnline={true}
        onToggleOnlineStatus={vi.fn()}
      />
    );

    expect(screen.getByText('Educator & Instructor Studio')).toBeInTheDocument();
    expect(screen.getByText('Interactive Calendar Slots & Public Live Classes')).toBeInTheDocument();
  });

  it('adds a teaching calendar slot via the Add Slot modal, calling onUpdateSlot', async () => {
    const onUpdateSlot = vi.fn();
    const u = userEvent.setup();

    render(
      <TutorEducatorHubView
        user={user}
        courses={[]}
        onAddCourse={vi.fn()}
        tutorSlots={[]}
        onUpdateSlot={onUpdateSlot}
        groupRequests={[]}
        publicClasses={[]}
        onAnnouncePublicClass={vi.fn()}
        isOnline={true}
        onToggleOnlineStatus={vi.fn()}
      />
    );

    await u.click(screen.getByText('+ Add 1-on-1 Slot'));
    await u.click(screen.getByText('Save Slot'));

    expect(onUpdateSlot).toHaveBeenCalledWith(
      expect.objectContaining({
        tutorId: user.id,
        tutorName: user.name,
        sessionType: 'one_on_one',
        topic: 'Class 12th Quantum Vector Derivations',
      })
    );
  });

  it('toggles online status when the live status button is clicked', async () => {
    const onToggleOnlineStatus = vi.fn();
    const u = userEvent.setup();

    render(
      <TutorEducatorHubView
        user={user}
        courses={[]}
        onAddCourse={vi.fn()}
        tutorSlots={[]}
        onUpdateSlot={vi.fn()}
        groupRequests={[]}
        publicClasses={[]}
        onAnnouncePublicClass={vi.fn()}
        isOnline={true}
        onToggleOnlineStatus={onToggleOnlineStatus}
      />
    );

    await u.click(screen.getByText('🟢 ONLINE (Accepting Calls)'));
    expect(onToggleOnlineStatus).toHaveBeenCalled();
  });
});
