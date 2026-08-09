import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SupportUserCreation } from '@/src/features/Admin/SupportUserCreation';
import * as adminUsersService from '@/src/services/adminUsersService';
import { ToastProvider } from '@/src/context/ToastContext';

vi.mock('@/src/services/adminUsersService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/adminUsersService')>(
    '@/src/services/adminUsersService'
  );
  return { ...actual, createSupportUser: vi.fn(), getSupportUsers: vi.fn(), setUserActiveStatus: vi.fn() };
});

describe('SupportUserCreation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('submits the form and shows the one-time temporary password panel on success', async () => {
    vi.mocked(adminUsersService.createSupportUser).mockResolvedValue({
      user: { id: 'usr_support_1', email: 'support@flexdemy.com', firstName: 'Sam', lastName: 'Support', role: 'Support', isActive: true },
      temporaryPassword: 'Tmp-8f3k2Az',
    });

    const uiUser = userEvent.setup();
    render(<SupportUserCreation />);

    await uiUser.type(screen.getByLabelText('First Name'), 'Sam');
    await uiUser.type(screen.getByLabelText('Last Name'), 'Support');
    await uiUser.type(screen.getByLabelText('Email or Phone Number'), 'support@flexdemy.com');
    await uiUser.click(screen.getByText('Create Support Account'));

    expect(adminUsersService.createSupportUser).toHaveBeenCalledWith({
      firstName: 'Sam',
      lastName: 'Support',
      identifier: 'support@flexdemy.com',
    });

    expect(await screen.findByText('Tmp-8f3k2Az')).toBeInTheDocument();
    expect(screen.getByText(/shown only once/i)).toBeInTheDocument();

    // The form is cleared for the next account, but the panel with the password persists
    // (it isn't gated behind the still-open form).
    expect((screen.getByLabelText('First Name') as HTMLInputElement).value).toBe('');
  });

  it('copies the temporary password to the clipboard and reflects the copied state', async () => {
    vi.mocked(adminUsersService.createSupportUser).mockResolvedValue({
      user: { id: 'usr_support_1', email: 'support@flexdemy.com', firstName: 'Sam', lastName: 'Support', role: 'Support', isActive: true },
      temporaryPassword: 'Tmp-8f3k2Az',
    });

    const uiUser = userEvent.setup();
    render(<SupportUserCreation />);

    await uiUser.type(screen.getByLabelText('First Name'), 'Sam');
    await uiUser.type(screen.getByLabelText('Last Name'), 'Support');
    await uiUser.type(screen.getByLabelText('Email or Phone Number'), 'support@flexdemy.com');
    await uiUser.click(screen.getByText('Create Support Account'));

    await screen.findByText('Tmp-8f3k2Az');
    await uiUser.click(screen.getByText('Copy'));

    expect(await screen.findByText('Copied')).toBeInTheDocument();
    // user-event's setup() emulates navigator.clipboard with a real in-memory store --
    // reading it back confirms the component actually wrote the password, not just that
    // the "Copied" label flipped.
    await expect(navigator.clipboard.readText()).resolves.toBe('Tmp-8f3k2Az');
  });

  it('shows a success toast (via ToastProvider) after a Support account is created', async () => {
    vi.mocked(adminUsersService.createSupportUser).mockResolvedValue({
      user: { id: 'usr_support_1', email: 'support@flexdemy.com', firstName: 'Sam', lastName: 'Support', role: 'Support', isActive: true },
      temporaryPassword: 'Tmp-8f3k2Az',
    });

    const uiUser = userEvent.setup();
    render(
      <ToastProvider>
        <SupportUserCreation />
      </ToastProvider>
    );

    await uiUser.type(screen.getByLabelText('First Name'), 'Sam');
    await uiUser.type(screen.getByLabelText('Last Name'), 'Support');
    await uiUser.type(screen.getByLabelText('Email or Phone Number'), 'support@flexdemy.com');
    await uiUser.click(screen.getByText('Create Support Account'));

    expect(await screen.findByText('Support account created.')).toBeInTheDocument();
  });

  it('shows a validation error and does not call the service when a field is missing', async () => {
    const uiUser = userEvent.setup();
    render(<SupportUserCreation />);

    await uiUser.click(screen.getByText('Create Support Account'));

    expect(screen.getByText(/fill in every field/i)).toBeInTheDocument();
    expect(adminUsersService.createSupportUser).not.toHaveBeenCalled();
  });

  it('surfaces the service error message on failure', async () => {
    vi.mocked(adminUsersService.createSupportUser).mockRejectedValue(
      new adminUsersService.AdminUsersError('An account with this identifier already exists.')
    );

    const uiUser = userEvent.setup();
    render(<SupportUserCreation />);

    await uiUser.type(screen.getByLabelText('First Name'), 'Sam');
    await uiUser.type(screen.getByLabelText('Last Name'), 'Support');
    await uiUser.type(screen.getByLabelText('Email or Phone Number'), 'support@flexdemy.com');
    await uiUser.click(screen.getByText('Create Support Account'));

    await waitFor(() =>
      expect(screen.getByText('An account with this identifier already exists.')).toBeInTheDocument()
    );
  });

  it('toggling to "All Support Users" fetches and lists every Support account', async () => {
    vi.mocked(adminUsersService.getSupportUsers).mockResolvedValue([
      { id: 'usr_support_2', email: 'priya@flexdemy.com', firstName: 'Priya', lastName: 'Rao', role: 'Support', isActive: true },
    ]);

    const uiUser = userEvent.setup();
    render(<SupportUserCreation />);

    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    await uiUser.click(screen.getByText('All Support Users'));

    expect(await screen.findByText('Priya Rao')).toBeInTheDocument();
    expect(screen.getByText('priya@flexdemy.com')).toBeInTheDocument();
    expect(screen.queryByLabelText('First Name')).not.toBeInTheDocument();

    await uiUser.click(screen.getByText('Create New'));
    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
  });
});
