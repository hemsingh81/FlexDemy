import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navbar } from '@/src/ui/Navbar';
import { UserProfile } from '@/src/types';
import { AdminSubTab } from '@/src/features/Admin/useAdminPanel';

const ALL_ADMIN_SUB_TABS: AdminSubTab[] = ['masterdata', 'support-users', 'role-visibility', 'tutor-approvals'];

const user: UserProfile = {
  id: 'usr_1',
  name: 'Hem Singh',
  email: '',
  avatar: '',
  role: 'Student',
  streakDays: 1,
  totalPoints: 0,
  isDarkMode: false,
  progress: {},
};

const allVisible: Record<string, boolean> = {
  dashboard: true,
  discover: true,
  groups: true,
  certificates: true,
  admin: true,
};

// Shared defaults for the Admin-dropdown props every Navbar render needs now -- individual
// tests override only what they care about (visibleTabs, availableAdminSubTabs, etc.).
const defaultProps = {
  user,
  activeTab: 'discover' as const,
  setActiveTab: vi.fn(),
  visibleTabs: allVisible,
  availableAdminSubTabs: ALL_ADMIN_SUB_TABS,
  activeAdminSubTab: 'masterdata' as AdminSubTab,
  onSelectAdminSubTab: vi.fn(),
  onSignOut: vi.fn(),
  onToggleTheme: vi.fn(),
  isDarkMode: false,
  onSearchClick: vi.fn(),
};

describe('Navbar', () => {
  it('calls setActiveTab when a nav item is clicked', async () => {
    const setActiveTab = vi.fn();
    const uiUser = userEvent.setup();
    render(<Navbar {...defaultProps} setActiveTab={setActiveTab} />);

    await uiUser.click(screen.getAllByText('Dashboard')[0]);
    expect(setActiveTab).toHaveBeenCalledWith('dashboard');
  });

  it('renders with the signed-in user context available', () => {
    render(<Navbar {...defaultProps} />);
    // Smoke check: the nav renders with the signed-in user's context available.
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
  });

  it('closes the profile dropdown on outside click, and sign out stays reachable while open', async () => {
    const onSignOut = vi.fn();
    const uiUser = userEvent.setup();
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <Navbar {...defaultProps} onSignOut={onSignOut} />
      </div>
    );

    await uiUser.click(screen.getByAltText('Hem Singh'));
    const signOutButton = screen.getByText('Sign Out');
    expect(signOutButton.closest('div')?.className).toMatch(/opacity-100/);

    await uiUser.click(screen.getByTestId('outside'));
    expect(signOutButton.closest('div')?.className).toMatch(/opacity-0/);

    // Reopen and use the action while visible, to confirm outside-click-to-close
    // doesn't interfere with the dropdown's own buttons.
    await uiUser.click(screen.getByAltText('Hem Singh'));
    await uiUser.click(screen.getByText('Sign Out'));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('shows the Admin nav dropdown trigger when visibleTabs.admin is true', () => {
    render(<Navbar {...defaultProps} visibleTabs={{ ...allVisible, admin: true }} />);

    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
  });

  it('hides the Admin nav dropdown (desktop and mobile) when visibleTabs.admin is false', () => {
    render(<Navbar {...defaultProps} visibleTabs={{ ...allVisible, admin: false }} />);

    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('hides any nav tab whose visibleTabs entry is false, e.g. groups', () => {
    render(<Navbar {...defaultProps} visibleTabs={{ ...allVisible, groups: false }} />);

    expect(screen.queryByText('Groups')).not.toBeInTheDocument();
  });

  it('clicking the Admin trigger opens a dropdown listing every available admin section, without navigating by itself', async () => {
    const setActiveTab = vi.fn();
    const uiUser = userEvent.setup();
    render(<Navbar {...defaultProps} setActiveTab={setActiveTab} visibleTabs={{ ...allVisible, admin: true }} />);

    // Like the profile/language menus, the option list is always in the DOM -- open/closed is
    // an opacity/scale transition, not a mount/unmount -- so assert on that transition rather
    // than presence.
    const masterDataOption = screen.getAllByRole('option', { name: 'Master Data' })[0];
    expect(masterDataOption.closest('[role="listbox"]')?.className).toMatch(/opacity-0/);

    await uiUser.click(screen.getAllByText('Admin')[0]);

    expect(masterDataOption.closest('[role="listbox"]')?.className).toMatch(/opacity-100/);
    expect(screen.getAllByRole('option', { name: 'Support Users' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option', { name: 'Role Visibility' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option', { name: 'Tutor Approvals' }).length).toBeGreaterThan(0);
    // The trigger itself never calls setActiveTab -- only picking an item does (see below).
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it('clicking an Admin dropdown item deep-links: navigates to the admin tab and selects that sub-tab', async () => {
    const setActiveTab = vi.fn();
    const onSelectAdminSubTab = vi.fn();
    const uiUser = userEvent.setup();
    render(
      <Navbar
        {...defaultProps}
        setActiveTab={setActiveTab}
        visibleTabs={{ ...allVisible, admin: true }}
        onSelectAdminSubTab={onSelectAdminSubTab}
      />
    );

    await uiUser.click(screen.getAllByText('Admin')[0]);
    await uiUser.click(screen.getAllByRole('option', { name: 'Role Visibility' })[0]);

    expect(onSelectAdminSubTab).toHaveBeenCalledWith('role-visibility');
  });

  it("filters the Admin dropdown to the caller's available sub-tabs, e.g. Support only sees Tutor Approvals", async () => {
    const uiUser = userEvent.setup();
    render(
      <Navbar
        {...defaultProps}
        visibleTabs={{ ...allVisible, admin: true }}
        availableAdminSubTabs={['tutor-approvals']}
      />
    );

    await uiUser.click(screen.getAllByText('Admin')[0]);

    expect(screen.getAllByRole('option', { name: 'Tutor Approvals' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('option', { name: 'Master Data' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Support Users' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Role Visibility' })).not.toBeInTheDocument();
  });
});
