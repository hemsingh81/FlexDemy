import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TutorRejectedPage } from '@/src/features/ProfileSetup/TutorRejectedPage';
import { useDomain } from '@/src/context/DomainContext';
import * as masterDataService from '@/src/services/masterDataService';
import * as profileService from '@/src/services/profileService';
import { UserProfile } from '@/src/types';

vi.mock('@/src/context/DomainContext');
vi.mock('@/src/services/masterDataService');
vi.mock('@/src/services/profileService');

const user: UserProfile = {
  id: 'usr_1',
  name: 'Hem Singh',
  email: 'hem@flexdemy.com',
  avatar: 'avatar.png',
  role: 'RejectedTutor',
  streakDays: 0,
  totalPoints: 0,
  isDarkMode: false,
  progress: {},
};

describe('TutorRejectedPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useDomain).mockReturnValue({
      user,
      courses: [],
      isLoading: false,
      ensureEnrolled: vi.fn(),
      updateUser: vi.fn(),
      awardPoints: vi.fn(),
      completeLesson: vi.fn(),
      addCourse: vi.fn(),
      rolePermissions: null,
      refreshRolePermissions: vi.fn(),
    });
    vi.mocked(masterDataService.getCountries).mockResolvedValue([]);
    vi.mocked(masterDataService.getClassLevels).mockResolvedValue([]);
    vi.mocked(masterDataService.getSubjects).mockResolvedValue([]);
    vi.mocked(masterDataService.getBoards).mockResolvedValue([]);
    vi.mocked(profileService.getMyProfileStatus).mockResolvedValue({
      role: 'RejectedTutor',
      rejectionReason: 'Qualifications could not be verified.',
    });
  });

  it('fetches and shows the rejection reason, with re-apply and switch-to-student choices', async () => {
    render(<TutorRejectedPage onSignOut={vi.fn()} />);

    expect(screen.getByText("Your tutor application wasn't approved")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('"Qualifications could not be verified."')).toBeInTheDocument()
    );
    expect(screen.getByText('Re-apply as Tutor')).toBeInTheDocument();
    expect(screen.getByText('Continue as Student instead')).toBeInTheDocument();
  });

  it('choosing re-apply renders TutorProfileForm', async () => {
    const testUser = userEvent.setup();
    render(<TutorRejectedPage onSignOut={vi.fn()} />);

    await testUser.click(screen.getByText('Re-apply as Tutor'));

    await waitFor(() => expect(screen.getByText('Re-submit Application')).toBeInTheDocument());
    expect(screen.getByText('Bio')).toBeInTheDocument();
  });

  it('choosing switch-to-student renders StudentProfileForm', async () => {
    const testUser = userEvent.setup();
    render(<TutorRejectedPage onSignOut={vi.fn()} />);

    await testUser.click(screen.getByText('Continue as Student instead'));

    await waitFor(() => expect(screen.getByText('Continue as Student')).toBeInTheDocument());
    expect(screen.getByText('Class / Grade')).toBeInTheDocument();
  });

  it('sign out calls onSignOut from the initial screen', async () => {
    const onSignOut = vi.fn();
    const testUser = userEvent.setup();
    render(<TutorRejectedPage onSignOut={onSignOut} />);

    await testUser.click(screen.getByText('Sign out'));
    expect(onSignOut).toHaveBeenCalled();
  });
});
