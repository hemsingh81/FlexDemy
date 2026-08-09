import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

    it('clicking Edit opens the modal prefilled with the row\'s current FirstName/LastName/Email', async () => {
      const uiUser = userEvent.setup();
      render(<AdminUserStatusList fetchUsers={vi.fn().mockResolvedValue(users)} emptyLabel="No users." editable />);

      await screen.findByText('Sam Support');
      await uiUser.click(screen.getByLabelText('Edit Sam Support'));

      expect(screen.getByText('Edit Sam Support')).toBeInTheDocument();
      expect((screen.getByLabelText('First Name') as HTMLInputElement).value).toBe('Sam');
      expect((screen.getByLabelText('Last Name') as HTMLInputElement).value).toBe('Support');
      expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('sam@flexdemy.com');
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

      await uiUser.clear(screen.getByLabelText('First Name'));
      await uiUser.click(screen.getByText('Save'));

      expect(await screen.findByText('Please fill in all required fields.')).toBeInTheDocument();
      expect(updateSpy).not.toHaveBeenCalled();

      await uiUser.type(screen.getByLabelText('First Name'), 'Samantha');
      await uiUser.click(screen.getByText('Save'));

      await waitFor(() =>
        expect(updateSpy).toHaveBeenCalledWith('usr_1', {
          firstName: 'Samantha',
          lastName: 'Support',
          email: 'sam@flexdemy.com',
        })
      );

      updateSpy.mockRestore();
    });

    it('saving calls updateSupportUserDetails, closes the modal, and refreshes the list', async () => {
      const fetchUsers = vi.fn().mockResolvedValue(users);
      const updateSpy = vi.spyOn(adminUsersService, 'updateSupportUserDetails').mockResolvedValue({
        ...users[0],
        firstName: 'Samantha',
      });
      const uiUser = userEvent.setup();
      render(<AdminUserStatusList fetchUsers={fetchUsers} emptyLabel="No users." editable />);

      await screen.findByText('Sam Support');
      await uiUser.click(screen.getByLabelText('Edit Sam Support'));
      await uiUser.click(screen.getByText('Save'));

      await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.queryByText('Edit Sam Support')).not.toBeInTheDocument());
      await waitFor(() => expect(fetchUsers).toHaveBeenCalledTimes(2));

      updateSpy.mockRestore();
    });

    it('shows the service error (e.g. a 409 duplicate email) inline and keeps the modal open', async () => {
      const updateSpy = vi
        .spyOn(adminUsersService, 'updateSupportUserDetails')
        .mockRejectedValue(new adminUsersService.AdminUsersError("An account already exists for 'taken@x.com'."));
      const uiUser = userEvent.setup();
      render(<AdminUserStatusList fetchUsers={vi.fn().mockResolvedValue(users)} emptyLabel="No users." editable />);

      await screen.findByText('Sam Support');
      await uiUser.click(screen.getByLabelText('Edit Sam Support'));
      await uiUser.clear(screen.getByLabelText('Email'));
      await uiUser.type(screen.getByLabelText('Email'), 'taken@x.com');
      await uiUser.click(screen.getByText('Save'));

      expect(await screen.findByText("An account already exists for 'taken@x.com'.")).toBeInTheDocument();
      expect(screen.getByText('Edit Sam Support')).toBeInTheDocument();

      updateSpy.mockRestore();
    });

    it('Cancel closes the modal without calling the service', async () => {
      const updateSpy = vi.spyOn(adminUsersService, 'updateSupportUserDetails');
      const uiUser = userEvent.setup();
      render(<AdminUserStatusList fetchUsers={vi.fn().mockResolvedValue(users)} emptyLabel="No users." editable />);

      await screen.findByText('Sam Support');
      await uiUser.click(screen.getByLabelText('Edit Sam Support'));
      await uiUser.click(screen.getByText('Cancel'));

      expect(screen.queryByText('Edit Sam Support')).not.toBeInTheDocument();
      expect(updateSpy).not.toHaveBeenCalled();

      updateSpy.mockRestore();
    });
  });
});
