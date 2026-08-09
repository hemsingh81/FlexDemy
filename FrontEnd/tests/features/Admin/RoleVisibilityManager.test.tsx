import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoleVisibilityManager } from '@/src/features/Admin/RoleVisibilityManager';
import * as rolePermissionsService from '@/src/services/rolePermissionsService';

vi.mock('@/src/services/rolePermissionsService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/rolePermissionsService')>(
    '@/src/services/rolePermissionsService'
  );
  return { ...actual, getMatrix: vi.fn(), updateMatrix: vi.fn() };
});

// Only two roles/keys populated with isVisible:true -- every other combination in the 4 x 12
// grid is implicitly false, matching the backend's fail-closed matrix response shape
// (RolePermissionService.GetMatrixAsync always returns the full grid).
const matrix = [
  { role: 'Student', featureKey: 'dashboard', isVisible: true },
  { role: 'Master', featureKey: 'admin.permissions.manage', isVisible: true },
];

describe('RoleVisibilityManager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(rolePermissionsService.getMatrix).mockResolvedValue(matrix as any);
    vi.mocked(rolePermissionsService.updateMatrix).mockResolvedValue(undefined);
  });

  it('renders a checkbox grid reflecting the fetched matrix', async () => {
    render(<RoleVisibilityManager />);

    const studentDashboard = await screen.findByLabelText('Student - Dashboard');
    expect((studentDashboard as HTMLInputElement).checked).toBe(true);

    const tutorDashboard = screen.getByLabelText('Tutor - Dashboard');
    expect((tutorDashboard as HTMLInputElement).checked).toBe(false);
  });

  it("disables Master's own row so it can't be unchecked from this screen", async () => {
    render(<RoleVisibilityManager />);

    const masterAdmin = await screen.findByLabelText('Master - Admin Panel');
    expect(masterAdmin).toBeDisabled();
  });

  it('toggling a non-Master cell and saving calls updateMatrix with the full 4 x 12 grid, reflecting the toggle', async () => {
    const uiUser = userEvent.setup();
    render(<RoleVisibilityManager />);

    const studentDiscover = await screen.findByLabelText('Student - Discover');
    expect((studentDiscover as HTMLInputElement).checked).toBe(false);

    await uiUser.click(studentDiscover);
    await uiUser.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(rolePermissionsService.updateMatrix).toHaveBeenCalled());
    const payload = vi.mocked(rolePermissionsService.updateMatrix).mock.calls[0][0];

    // 4 roles x 12 feature keys.
    expect(payload).toHaveLength(48);
    expect(payload).toContainEqual({ role: 'Student', featureKey: 'discover', isVisible: true });
    expect(payload).toContainEqual({ role: 'Student', featureKey: 'dashboard', isVisible: true });
    expect(payload).toContainEqual({ role: 'Master', featureKey: 'admin.permissions.manage', isVisible: true });
    expect(payload).toContainEqual({ role: 'Tutor', featureKey: 'dashboard', isVisible: false });
  });

  it('shows a "Saved" confirmation after a successful save', async () => {
    const uiUser = userEvent.setup();
    render(<RoleVisibilityManager />);

    await screen.findByLabelText('Student - Dashboard');
    await uiUser.click(screen.getByText('Save Changes'));

    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('surfaces the service error message on save failure', async () => {
    vi.mocked(rolePermissionsService.updateMatrix).mockRejectedValue(
      new rolePermissionsService.RolePermissionsError('Forbidden.')
    );

    const uiUser = userEvent.setup();
    render(<RoleVisibilityManager />);

    await screen.findByLabelText('Student - Dashboard');
    await uiUser.click(screen.getByText('Save Changes'));

    expect(await screen.findByText('Forbidden.')).toBeInTheDocument();
  });

  describe('Admin permission tree', () => {
    it('nests the 4 admin-child permissions under Admin Panel, expanded by default', async () => {
      render(<RoleVisibilityManager />);

      // Both the parent row's checkbox and every child row's checkbox are reachable by label
      // once the matrix has loaded -- expanded is the default state.
      await screen.findByLabelText('Master - Admin Panel');
      expect(screen.getByLabelText('Student - Manage Master Data')).toBeInTheDocument();
      expect(screen.getByLabelText('Student - Approve Tutors')).toBeInTheDocument();
      expect(screen.getByLabelText('Student - Create Support Users')).toBeInTheDocument();
      expect(screen.getByLabelText('Student - Manage Role Permissions')).toBeInTheDocument();
    });

    it('collapsing the Admin Panel row via the chevron hides its 4 children, and expanding restores them', async () => {
      const uiUser = userEvent.setup();
      render(<RoleVisibilityManager />);

      await screen.findByLabelText('Student - Manage Master Data');

      await uiUser.click(screen.getByLabelText('Collapse Admin Panel permissions'));
      expect(screen.queryByLabelText('Student - Manage Master Data')).not.toBeInTheDocument();

      await uiUser.click(screen.getByLabelText('Expand Admin Panel permissions'));
      expect(screen.getByLabelText('Student - Manage Master Data')).toBeInTheDocument();
    });

    it("does not retroactively disable a role's already-saved children on load, even if Admin is off for that role", async () => {
      vi.mocked(rolePermissionsService.getMatrix).mockResolvedValue([
        { role: 'Student', featureKey: 'admin', isVisible: false },
        { role: 'Student', featureKey: 'tutor.approve', isVisible: true },
      ] as any);

      render(<RoleVisibilityManager />);

      const studentTutorApprove = await screen.findByLabelText('Student - Approve Tutors');
      // Server state is left exactly as fetched -- still checked, just visually flagged.
      expect((studentTutorApprove as HTMLInputElement).checked).toBe(true);
      expect(studentTutorApprove).toBeDisabled();
      expect(studentTutorApprove.title).toBe('Requires Admin access');
    });

    it('unchecking Admin for a role in the pending edit state auto-unchecks and disables that role\'s 4 children', async () => {
      vi.mocked(rolePermissionsService.getMatrix).mockResolvedValue([
        { role: 'Student', featureKey: 'admin', isVisible: true },
        { role: 'Student', featureKey: 'tutor.approve', isVisible: true },
        { role: 'Student', featureKey: 'masterdata.manage', isVisible: true },
      ] as any);

      const uiUser = userEvent.setup();
      render(<RoleVisibilityManager />);

      const studentAdmin = await screen.findByLabelText('Student - Admin Panel');
      const studentTutorApprove = screen.getByLabelText('Student - Approve Tutors');
      const studentMasterData = screen.getByLabelText('Student - Manage Master Data');
      expect((studentTutorApprove as HTMLInputElement).checked).toBe(true);
      expect((studentMasterData as HTMLInputElement).checked).toBe(true);
      expect(studentTutorApprove).not.toBeDisabled();

      await uiUser.click(studentAdmin);

      expect((studentTutorApprove as HTMLInputElement).checked).toBe(false);
      expect((studentMasterData as HTMLInputElement).checked).toBe(false);
      expect(studentTutorApprove).toBeDisabled();
      expect(studentMasterData).toBeDisabled();

      await uiUser.click(screen.getByText('Save Changes'));
      await waitFor(() => expect(rolePermissionsService.updateMatrix).toHaveBeenCalled());
      const payload = vi.mocked(rolePermissionsService.updateMatrix).mock.calls[0][0];
      expect(payload).toContainEqual({ role: 'Student', featureKey: 'admin', isVisible: false });
      expect(payload).toContainEqual({ role: 'Student', featureKey: 'tutor.approve', isVisible: false });
      expect(payload).toContainEqual({ role: 'Student', featureKey: 'masterdata.manage', isVisible: false });
    });

    it("re-checking Admin for a role doesn't force its children back on -- they stay off until explicitly re-checked", async () => {
      vi.mocked(rolePermissionsService.getMatrix).mockResolvedValue([
        { role: 'Student', featureKey: 'admin', isVisible: true },
        { role: 'Student', featureKey: 'tutor.approve', isVisible: true },
      ] as any);

      const uiUser = userEvent.setup();
      render(<RoleVisibilityManager />);

      const studentAdmin = await screen.findByLabelText('Student - Admin Panel');
      const studentTutorApprove = screen.getByLabelText('Student - Approve Tutors');

      await uiUser.click(studentAdmin); // off -> children auto-off
      await uiUser.click(studentAdmin); // back on

      expect((studentAdmin as HTMLInputElement).checked).toBe(true);
      expect((studentTutorApprove as HTMLInputElement).checked).toBe(false);
      expect(studentTutorApprove).not.toBeDisabled();
    });
  });
});
