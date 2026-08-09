import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileSetupPage } from '@/src/features/ProfileSetup/ProfileSetupPage';
import { useDomain } from '@/src/context/DomainContext';
import * as masterDataService from '@/src/services/masterDataService';
import { UserProfile } from '@/src/types';

vi.mock('@/src/context/DomainContext');
vi.mock('@/src/services/masterDataService');

const user: UserProfile = {
  id: 'usr_1',
  name: 'Hem Singh',
  email: 'hem@flexdemy.com',
  avatar: 'avatar.png',
  role: 'Unassigned',
  streakDays: 0,
  totalPoints: 0,
  preferredVoice: '',
  ttsRate: 1,
  ttsPitch: 1,
  isDarkMode: false,
  progress: {},
};

describe('ProfileSetupPage', () => {
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
  });

  it('shows a role choice screen first, and choosing Student renders StudentProfileForm', async () => {
    const testUser = userEvent.setup();
    render(<ProfileSetupPage onSignOut={vi.fn()} />);

    expect(screen.getByText("I'm a Student")).toBeInTheDocument();
    expect(screen.getByText("I'm a Tutor")).toBeInTheDocument();

    await testUser.click(screen.getByText("I'm a Student"));

    expect(screen.getByText('Complete your student profile')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Class / Grade')).toBeInTheDocument());
    expect(screen.queryByText('Bio')).not.toBeInTheDocument();
  });

  it('choosing Tutor renders TutorProfileForm instead', async () => {
    const testUser = userEvent.setup();
    render(<ProfileSetupPage onSignOut={vi.fn()} />);

    await testUser.click(screen.getByText("I'm a Tutor"));

    expect(screen.getByText('Apply to become a tutor')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Bio')).toBeInTheDocument());
    expect(screen.queryByText('Class / Grade')).not.toBeInTheDocument();
  });

  it('Back returns to the role choice screen', async () => {
    const testUser = userEvent.setup();
    render(<ProfileSetupPage onSignOut={vi.fn()} />);

    await testUser.click(screen.getByText("I'm a Student"));
    expect(screen.getByText('Complete your student profile')).toBeInTheDocument();

    await testUser.click(screen.getByText('Back'));
    expect(screen.getByText("I'm a Student")).toBeInTheDocument();
    expect(screen.getByText("I'm a Tutor")).toBeInTheDocument();
  });

  it('Sign out calls onSignOut from the role choice screen', async () => {
    const onSignOut = vi.fn();
    const testUser = userEvent.setup();
    render(<ProfileSetupPage onSignOut={onSignOut} />);

    await testUser.click(screen.getByText('Sign out'));
    expect(onSignOut).toHaveBeenCalled();
  });
});
