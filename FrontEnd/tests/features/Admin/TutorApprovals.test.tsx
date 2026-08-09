import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TutorApprovals } from '@/src/features/Admin/TutorApprovals';
import * as profileService from '@/src/services/profileService';
import * as adminUsersService from '@/src/services/adminUsersService';

vi.mock('@/src/services/profileService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/profileService')>('@/src/services/profileService');
  return { ...actual, getPendingTutorApplications: vi.fn(), reviewTutorApplication: vi.fn() };
});
vi.mock('@/src/services/adminUsersService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/adminUsersService')>(
    '@/src/services/adminUsersService'
  );
  return { ...actual, getTutors: vi.fn(), setUserActiveStatus: vi.fn() };
});

const application: profileService.PendingTutorApplication = {
  profile: {
    id: 'tp_1',
    userId: 'usr_1',
    subjectIds: ['sub_1'],
    countryId: 'ctry_1',
    stateId: 'state_1',
    cityId: 'city_1',
    bio: 'Ten years teaching physics.',
    qualifications: 'M.Sc. Physics',
    reviewedByUserId: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: '2026-08-09T00:00:00Z',
    updatedAt: null,
  },
  userId: 'usr_1',
  firstName: 'Amara',
  lastName: 'Okafor',
  email: 'amara@flexdemy.com',
};

describe('TutorApprovals', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows an empty state when there are no pending applications', async () => {
    vi.mocked(profileService.getPendingTutorApplications).mockResolvedValue([]);

    render(<TutorApprovals />);

    expect(await screen.findByText('No pending tutor applications right now.')).toBeInTheDocument();
  });

  it('lists pending applications with their bio and qualifications', async () => {
    vi.mocked(profileService.getPendingTutorApplications).mockResolvedValue([application]);

    render(<TutorApprovals />);

    expect(await screen.findByText('Amara Okafor')).toBeInTheDocument();
    expect(screen.getByText('amara@flexdemy.com')).toBeInTheDocument();
    expect(screen.getByText(/Ten years teaching physics\./)).toBeInTheDocument();
    expect(screen.getByText(/M\.Sc\. Physics/)).toBeInTheDocument();
  });

  it('Approve calls reviewTutorApplication with approve:true and reloads the list', async () => {
    vi.mocked(profileService.getPendingTutorApplications)
      .mockResolvedValueOnce([application])
      .mockResolvedValueOnce([]);
    vi.mocked(profileService.reviewTutorApplication).mockResolvedValue({} as any);

    const uiUser = userEvent.setup();
    render(<TutorApprovals />);

    await screen.findByText('Amara Okafor');
    await uiUser.click(screen.getByText('Approve'));

    expect(profileService.reviewTutorApplication).toHaveBeenCalledWith('usr_1', { approve: true, rejectionReason: null });
    await waitFor(() => expect(screen.getByText('No pending tutor applications right now.')).toBeInTheDocument());
  });

  it('Reject opens an inline reason textarea (no browser prompt) and requires a reason before confirming', async () => {
    vi.mocked(profileService.getPendingTutorApplications).mockResolvedValue([application]);

    const uiUser = userEvent.setup();
    render(<TutorApprovals />);

    await screen.findByText('Amara Okafor');
    await uiUser.click(screen.getByText('Reject'));

    expect(screen.getByLabelText('Reason for rejection')).toBeInTheDocument();

    await uiUser.click(screen.getByText('Confirm Rejection'));

    expect(screen.getByText(/provide a reason/i)).toBeInTheDocument();
    expect(profileService.reviewTutorApplication).not.toHaveBeenCalled();
  });

  it('confirming rejection with a reason calls reviewTutorApplication with approve:false and the trimmed reason', async () => {
    vi.mocked(profileService.getPendingTutorApplications)
      .mockResolvedValueOnce([application])
      .mockResolvedValueOnce([]);
    vi.mocked(profileService.reviewTutorApplication).mockResolvedValue({} as any);

    const uiUser = userEvent.setup();
    render(<TutorApprovals />);

    await screen.findByText('Amara Okafor');
    await uiUser.click(screen.getByText('Reject'));
    await uiUser.type(screen.getByLabelText('Reason for rejection'), '  Needs more classroom experience.  ');
    await uiUser.click(screen.getByText('Confirm Rejection'));

    expect(profileService.reviewTutorApplication).toHaveBeenCalledWith('usr_1', {
      approve: false,
      rejectionReason: 'Needs more classroom experience.',
    });
    await waitFor(() => expect(screen.getByText('No pending tutor applications right now.')).toBeInTheDocument());
  });

  it('toggling to "All Tutors" fetches and lists every approved tutor', async () => {
    vi.mocked(profileService.getPendingTutorApplications).mockResolvedValue([]);
    vi.mocked(adminUsersService.getTutors).mockResolvedValue([
      { id: 'usr_tutor_1', email: 'amara@flexdemy.com', firstName: 'Amara', lastName: 'Okafor', role: 'Tutor', isActive: true },
    ]);

    const uiUser = userEvent.setup();
    render(<TutorApprovals />);

    await screen.findByText('No pending tutor applications right now.');
    await uiUser.click(screen.getByText('All Tutors'));

    expect(await screen.findByText('Amara Okafor')).toBeInTheDocument();
    expect(screen.getByText('amara@flexdemy.com')).toBeInTheDocument();

    await uiUser.click(screen.getByText('Pending Applications'));
    expect(await screen.findByText('No pending tutor applications right now.')).toBeInTheDocument();
  });
});
