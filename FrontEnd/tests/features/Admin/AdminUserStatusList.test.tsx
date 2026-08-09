import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminUserStatusList } from '@/src/features/Admin/AdminUserStatusList';
import * as adminUsersService from '@/src/services/adminUsersService';

const users: adminUsersService.AdminUser[] = [
  { id: 'usr_1', email: 'sam@flexdemy.com', firstName: 'Sam', lastName: 'Support', role: 'Support', isActive: true },
  { id: 'usr_2', email: 'tara@flexdemy.com', firstName: 'Tara', lastName: 'Tutor', role: 'Tutor', isActive: false },
];

describe('AdminUserStatusList', () => {
  it('shows an empty state via the caller-provided label when there are no users', async () => {
    render(<AdminUserStatusList fetchUsers={vi.fn().mockResolvedValue([])} emptyLabel="No Support accounts yet." />);

    expect(await screen.findByText('No Support accounts yet.')).toBeInTheDocument();
  });

  it('renders every user with their name, email and active/inactive badge', async () => {
    render(<AdminUserStatusList fetchUsers={vi.fn().mockResolvedValue(users)} emptyLabel="No users." />);

    expect(await screen.findByText('Sam Support')).toBeInTheDocument();
    expect(screen.getByText('sam@flexdemy.com')).toBeInTheDocument();
    expect(screen.getByText('Tara Tutor')).toBeInTheDocument();
    expect(screen.getByText('tara@flexdemy.com')).toBeInTheDocument();

    const badges = screen.getAllByRole('button', { name: /Active|Inactive/ });
    expect(badges[0]).toHaveTextContent('Active');
    expect(badges[1]).toHaveTextContent('Inactive');
  });

  it('clicking the badge calls setUserActiveStatus with the flipped value and reloads the list', async () => {
    const fetchUsers = vi.fn().mockResolvedValue(users);
    const setStatusSpy = vi.spyOn(adminUsersService, 'setUserActiveStatus').mockResolvedValue({
      ...users[0],
      isActive: false,
    });

    const uiUser = userEvent.setup();
    render(<AdminUserStatusList fetchUsers={fetchUsers} emptyLabel="No users." />);

    await screen.findByText('Sam Support');
    await uiUser.click(screen.getByRole('button', { name: 'Active' }));

    expect(setStatusSpy).toHaveBeenCalledWith('usr_1', false);
    await waitFor(() => expect(fetchUsers).toHaveBeenCalledTimes(2));

    setStatusSpy.mockRestore();
  });

  it('shows an inline error message (not a silent failure) when the service call fails, e.g. a 403', async () => {
    const fetchUsers = vi.fn().mockResolvedValue(users);
    const setStatusSpy = vi
      .spyOn(adminUsersService, 'setUserActiveStatus')
      .mockRejectedValue(new adminUsersService.AdminUsersError('Forbidden.'));

    const uiUser = userEvent.setup();
    render(<AdminUserStatusList fetchUsers={fetchUsers} emptyLabel="No users." />);

    await screen.findByText('Sam Support');
    await uiUser.click(screen.getByRole('button', { name: 'Active' }));

    expect(await screen.findByText('Forbidden.')).toBeInTheDocument();

    setStatusSpy.mockRestore();
  });

  describe('edit (Support-user editing only, gated by the `editable` prop)', () => {
    it('does not render an Edit action when `editable` is not set (e.g. the Tutors list)', async () => {
      render(<AdminUserStatusList fetchUsers={vi.fn().mockResolvedValue(users)} emptyLabel="No users." />);

      await screen.findByText('Sam Support');
      expect(screen.queryByLabelText('Edit Sam Support')).not.toBeInTheDocument();
    });

    it('clicking Edit reveals an inline panel (Collapse + FormCard, not a modal) prefilled with the row\'s current FirstName/LastName/Email', async () => {
      const uiUser = userEvent.setup();
      render(<AdminUserStatusList fetchUsers={vi.fn().mockResolvedValue(users)} emptyLabel="No users." editable />);

      await screen.findByText('Sam Support');
      await uiUser.click(screen.getByLabelText('Edit Sam Support'));

      // The edit panel is a sibling <tr> directly below the row it belongs to -- same shape as
      // MasterDataTable.tsx's per-row edit panel -- so every row's panel is always in the DOM
      // (Collapse-hidden when not the one being edited); scope queries to the right row's panel
      // rather than the page-global screen, since e.g. "First Name" now exists in both rows'
      // (hidden) panels simultaneously.
      const editPanelRow = screen.getByText('Sam Support').closest('tr')!.nextElementSibling as HTMLElement;
      expect(within(editPanelRow).getByText('Edit Sam Support')).toBeInTheDocument();
      expect((within(editPanelRow).getByLabelText('First Name') as HTMLInputElement).value).toBe('Sam');
      expect((within(editPanelRow).getByLabelText('Last Name') as HTMLInputElement).value).toBe('Support');
      expect((within(editPanelRow).getByLabelText('Email') as HTMLInputElement).value).toBe('sam@flexdemy.com');
    });

    it('submitting with a blank required field shows an error and does not call the service; correcting it and resubmitting succeeds', async () => {
      const updateSpy = vi.spyOn(adminUsersService, 'updateSupportUserDetails').mockResolvedValue({
        ...users[0],
        firstName: 'Samantha',
      });
      const uiUser = userEvent.setup();
      render(<AdminUserStatusList fetchUsers={vi.fn().mockResolvedValue(users)} emptyLabel="No users." editable />);

      await screen.findByText('Sam Support');
      await uiUser.click(screen.getByLabelText('Edit Sam Support'));
      const editPanelRow = screen.getByText('Sam Support').closest('tr')!.nextElementSibling as HTMLElement;

      await uiUser.clear(within(editPanelRow).getByLabelText('First Name'));
      await uiUser.click(within(editPanelRow).getByText('Save'));

      expect(await within(editPanelRow).findByText('Please fill in all required fields.')).toBeInTheDocument();
      expect(updateSpy).not.toHaveBeenCalled();

      await uiUser.type(within(editPanelRow).getByLabelText('First Name'), 'Samantha');
      await uiUser.click(within(editPanelRow).getByText('Save'));

      await waitFor(() =>
        expect(updateSpy).toHaveBeenCalledWith('usr_1', {
          firstName: 'Samantha',
          lastName: 'Support',
          email: 'sam@flexdemy.com',
        })
      );

      updateSpy.mockRestore();
    });

    it('saving calls updateSupportUserDetails, closes the panel, and refreshes the list', async () => {
      const fetchUsers = vi.fn().mockResolvedValue(users);
      const updateSpy = vi.spyOn(adminUsersService, 'updateSupportUserDetails').mockResolvedValue({
        ...users[0],
        firstName: 'Samantha',
      });
      const uiUser = userEvent.setup();
      render(<AdminUserStatusList fetchUsers={fetchUsers} emptyLabel="No users." editable />);

      await screen.findByText('Sam Support');
      await uiUser.click(screen.getByLabelText('Edit Sam Support'));
      const editPanelRow = screen.getByText('Sam Support').closest('tr')!.nextElementSibling as HTMLElement;
      await uiUser.click(within(editPanelRow).getByText('Save'));

      await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(fetchUsers).toHaveBeenCalledTimes(2));

      updateSpy.mockRestore();
    });

    it('shows the service error (e.g. a 409 duplicate email) inline and keeps the panel open', async () => {
      const updateSpy = vi
        .spyOn(adminUsersService, 'updateSupportUserDetails')
        .mockRejectedValue(new adminUsersService.AdminUsersError("An account already exists for 'taken@x.com'."));
      const uiUser = userEvent.setup();
      render(<AdminUserStatusList fetchUsers={vi.fn().mockResolvedValue(users)} emptyLabel="No users." editable />);

      await screen.findByText('Sam Support');
      await uiUser.click(screen.getByLabelText('Edit Sam Support'));
      const editPanelRow = screen.getByText('Sam Support').closest('tr')!.nextElementSibling as HTMLElement;
      await uiUser.clear(within(editPanelRow).getByLabelText('Email'));
      await uiUser.type(within(editPanelRow).getByLabelText('Email'), 'taken@x.com');
      await uiUser.click(within(editPanelRow).getByText('Save'));

      expect(await within(editPanelRow).findByText("An account already exists for 'taken@x.com'.")).toBeInTheDocument();
      expect(within(editPanelRow).getByText('Edit Sam Support')).toBeInTheDocument();

      updateSpy.mockRestore();
    });

    it('Cancel closes the panel without calling the service', async () => {
      const updateSpy = vi.spyOn(adminUsersService, 'updateSupportUserDetails');
      const uiUser = userEvent.setup();
      render(<AdminUserStatusList fetchUsers={vi.fn().mockResolvedValue(users)} emptyLabel="No users." editable />);

      await screen.findByText('Sam Support');
      await uiUser.click(screen.getByLabelText('Edit Sam Support'));
      const editPanelRow = screen.getByText('Sam Support').closest('tr')!.nextElementSibling as HTMLElement;
      await uiUser.click(within(editPanelRow).getByText('Cancel'));

      // Clicking Edit again re-opens a freshly-reset panel -- if Cancel had left it "open" this
      // would find the panel already showing stale state instead of a clean prefill.
      await uiUser.click(screen.getByLabelText('Edit Sam Support'));
      expect((within(editPanelRow).getByLabelText('First Name') as HTMLInputElement).value).toBe('Sam');
      expect(updateSpy).not.toHaveBeenCalled();

      updateSpy.mockRestore();
    });
  });
});
