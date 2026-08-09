import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/src/App';
import * as authService from '@/src/services/authService';
import * as masterDataService from '@/src/services/masterDataService';
import * as profileService from '@/src/services/profileService';
import * as rolePermissionsService from '@/src/services/rolePermissionsService';

// App.tsx's DomainProvider/useTutorHub pull from services/coursesService, tutorService,
// groupStudyService and userService too, but those resolve synchronously from in-memory
// mock data (no network) so they're left real here. Only the network-backed services --
// auth (login), master-data, profile-status, and role-permissions -- are mocked, matching
// this suite's pattern of mocking at the service boundary (AD-5) rather than deeper.
vi.mock('@/src/services/authService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/authService')>('@/src/services/authService');
  return { ...actual, login: vi.fn(), getToken: vi.fn(), getCurrentUser: vi.fn(), logout: vi.fn() };
});
vi.mock('@/src/services/masterDataService');
vi.mock('@/src/services/profileService');
vi.mock('@/src/services/rolePermissionsService');

const ALL_VISIBLE_PERMISSIONS: Record<string, boolean> = {
  dashboard: true,
  discover: true,
  tutor: true,
  groups: true,
  assignments: true,
  certificates: true,
  admin: true,
  'courses.create': true,
  'masterdata.manage': true,
  'tutor.approve': true,
  'admin.users.create': true,
  'admin.permissions.manage': true,
};

const signIn = async (role: string) => {
  vi.mocked(authService.login).mockResolvedValue({
    user: { id: 'usr_1', email: 'hem@flexdemy.com', firstName: 'Hem', lastName: 'Singh', role: role as any },
    token: 'fake-jwt',
  });

  const user = userEvent.setup();
  render(<App />);

  await user.type(await screen.findByPlaceholderText(/you@domain.com/), 'hem@flexdemy.com');
  await user.type(screen.getByPlaceholderText('••••••••'), 'Password@123');
  await user.click(screen.getByText('Sign In'));
};

describe('App post-auth role gate', () => {
  beforeEach(() => {
    vi.mocked(masterDataService.getCountries).mockResolvedValue([]);
    vi.mocked(masterDataService.getStates).mockResolvedValue([]);
    vi.mocked(masterDataService.getCities).mockResolvedValue([]);
    vi.mocked(masterDataService.getBoards).mockResolvedValue([]);
    vi.mocked(masterDataService.getClassLevels).mockResolvedValue([]);
    vi.mocked(masterDataService.getSubjects).mockResolvedValue([]);
    vi.mocked(profileService.getMyProfileStatus).mockResolvedValue({ role: 'RejectedTutor' as any, rejectionReason: 'Needs more experience.' });
    vi.mocked(profileService.getPendingTutorApplications).mockResolvedValue([]);
    vi.mocked(rolePermissionsService.getMine).mockResolvedValue(ALL_VISIBLE_PERMISSIONS);
    vi.mocked(rolePermissionsService.getMatrix).mockResolvedValue([]);
  });

  it('renders ProfileSetupPage when the signed-in user role is Unassigned', async () => {
    await signIn('Unassigned');

    expect(await screen.findByText("I'm a Student")).toBeInTheDocument();
    expect(screen.getByText("I'm a Tutor")).toBeInTheDocument();
  });

  it('renders PendingApprovalPage when the signed-in user role is PendingTutor', async () => {
    await signIn('PendingTutor');

    expect(await screen.findByText('Your tutor application is under review')).toBeInTheDocument();
  });

  it('renders TutorRejectedPage when the signed-in user role is RejectedTutor', async () => {
    await signIn('RejectedTutor');

    expect(await screen.findByText("Your tutor application wasn't approved")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('"Needs more experience."')).toBeInTheDocument());
  });

  it('renders the full app (Navbar) when the signed-in user role is Student', async () => {
    await signIn('Student');

    expect(await screen.findByLabelText('Search courses')).toBeInTheDocument();
    expect(screen.queryByText("I'm a Student")).not.toBeInTheDocument();
  });

  it('Master sees the Admin nav dropdown and picking a section renders AdminPanel deep-linked to it', async () => {
    await signIn('Master');

    // Admin is now a dropdown (like the profile/language menus) rather than a flat button --
    // the trigger just opens the menu, only picking an item navigates.
    const adminTriggers = await screen.findAllByText('Admin');
    const uiUser = userEvent.setup();
    await uiUser.click(adminTriggers[0]);

    const masterDataOptions = await screen.findAllByRole('option', { name: 'Master Data' });
    await uiUser.click(masterDataOptions[0]);

    // MasterDataManager's "Add Country" toolbar button confirms the masterdata sub-tab
    // specifically rendered. Scoped to the button role -- the Add-form card (MasterDataTable's
    // FormCard) also renders "Add Country" as its header title once the form is toggled open,
    // and unlike that button, the text isn't otherwise unique on the page.
    expect(await screen.findByRole('button', { name: 'Add Country' })).toBeInTheDocument();
  });

  it('shows a success toast after signing in, and another after signing out', async () => {
    await signIn('Student');

    expect(await screen.findByText('Signed in successfully.')).toBeInTheDocument();

    const uiUser = userEvent.setup();
    await uiUser.click(await screen.findByAltText('Hem Singh'));
    await uiUser.click(screen.getByText('Sign Out'));

    expect(await screen.findByText('Signed out.')).toBeInTheDocument();
  });

  it('hides the Admin nav button entirely when visibleTabs.admin is false', async () => {
    vi.mocked(rolePermissionsService.getMine).mockResolvedValue({ ...ALL_VISIBLE_PERMISSIONS, admin: false });

    await signIn('Student');

    await screen.findByLabelText('Search courses');
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });
});

// Covers the "don't log me out on refresh" bootstrap: App.tsx checks for a persisted token
// (authService.getToken()) on mount and, if present, validates it via authService.getCurrentUser()
// (GET /api/v1/auth/me) before deciding whether to show Login or the app -- see App.tsx's
// sessionCheck state. authService.getToken/getCurrentUser/logout are mocked directly (rather than
// via sessionStorage) so each scenario is deterministic regardless of authService's real
// sessionStorage timing.
describe('App session-restore bootstrap', () => {
  beforeEach(() => {
    vi.mocked(authService.getToken).mockReset();
    vi.mocked(authService.getCurrentUser).mockReset();
    vi.mocked(authService.logout).mockClear();
    vi.mocked(masterDataService.getCountries).mockResolvedValue([]);
    vi.mocked(masterDataService.getStates).mockResolvedValue([]);
    vi.mocked(masterDataService.getCities).mockResolvedValue([]);
    vi.mocked(masterDataService.getBoards).mockResolvedValue([]);
    vi.mocked(masterDataService.getClassLevels).mockResolvedValue([]);
    vi.mocked(masterDataService.getSubjects).mockResolvedValue([]);
    vi.mocked(profileService.getMyProfileStatus).mockResolvedValue({ role: 'Student' as any, rejectionReason: null });
    vi.mocked(profileService.getPendingTutorApplications).mockResolvedValue([]);
    vi.mocked(rolePermissionsService.getMine).mockResolvedValue(ALL_VISIBLE_PERMISSIONS);
    vi.mocked(rolePermissionsService.getMatrix).mockResolvedValue([]);
  });

  it('renders the app directly (no Login screen) when a persisted token is still valid', async () => {
    vi.mocked(authService.getToken).mockReturnValue('persisted-jwt');
    vi.mocked(authService.getCurrentUser).mockResolvedValue({
      id: 'usr_1',
      email: 'hem@flexdemy.com',
      firstName: 'Hem',
      lastName: 'Singh',
      role: 'Student' as any,
    });

    render(<App />);

    expect(await screen.findByLabelText('Search courses')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/you@domain.com/)).not.toBeInTheDocument();
  });

  it('falls through to Login and clears the token when the persisted token is expired/invalid', async () => {
    vi.mocked(authService.getToken).mockReturnValue('stale-jwt');
    vi.mocked(authService.getCurrentUser).mockResolvedValue(null);

    render(<App />);

    expect(await screen.findByPlaceholderText(/you@domain.com/)).toBeInTheDocument();
    expect(authService.logout).toHaveBeenCalled();
  });

  it('falls through to Login and clears the token when the session check errors (network failure)', async () => {
    vi.mocked(authService.getToken).mockReturnValue('some-jwt');
    vi.mocked(authService.getCurrentUser).mockRejectedValue(new authService.AuthError('Could not reach the server.'));

    render(<App />);

    expect(await screen.findByPlaceholderText(/you@domain.com/)).toBeInTheDocument();
    expect(authService.logout).toHaveBeenCalled();
  });

  it('renders Login immediately without checking the session when there is no persisted token', async () => {
    vi.mocked(authService.getToken).mockReturnValue(null);

    render(<App />);

    expect(await screen.findByPlaceholderText(/you@domain.com/)).toBeInTheDocument();
    expect(authService.getCurrentUser).not.toHaveBeenCalled();
  });
});
