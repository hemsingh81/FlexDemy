import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
    vi.mocked(adminUsersService.getSupportUsers).mockResolvedValue([]);
  });

  // The toolbar's toggle button and the FormCard's own footer button both read "Cancel" while
  // the form is open, so the toolbar button is looked up by scoping to its row (it's the one
  // sitting alongside the "Support Users" heading) rather than by ambiguous global text/role.
  const getToolbarButton = () => {
    const toolbar = screen.getByText('Support Users').closest('div') as HTMLElement;
    return within(toolbar).getByRole('button');
  };

  const openForm = async (uiUser: ReturnType<typeof userEvent.setup>) => {
    await uiUser.click(getToolbarButton());
  };

  const fillAndSubmit = async (uiUser: ReturnType<typeof userEvent.setup>) => {
    await openForm(uiUser);
    await uiUser.type(screen.getByLabelText('First Name'), 'Sam');
    await uiUser.type(screen.getByLabelText('Last Name'), 'Support');
    await uiUser.type(screen.getByLabelText('Email or Phone Number'), 'support@flexdemy.com');
    await uiUser.click(screen.getByText('Save'));
  };

  it('shows the grid of Support users immediately, with no tab to switch', async () => {
    vi.mocked(adminUsersService.getSupportUsers).mockResolvedValue([
      { id: 'usr_support_2', email: 'priya@flexdemy.com', firstName: 'Priya', lastName: 'Rao', role: 'Support', isActive: true },
    ]);

    render(<SupportUserCreation />);

    expect(await screen.findByText('Priya Rao')).toBeInTheDocument();
    expect(screen.getByText('priya@flexdemy.com')).toBeInTheDocument();
    // The Add form starts closed (toolbar button reads "Add Support User", not "Cancel") --
    // the form itself stays mounted (so Collapse can animate it, same as MasterDataTable.tsx)
    // but is visually collapsed, so its presence is asserted via the toolbar button's label
    // rather than the fields' absence from the DOM.
    expect(getToolbarButton()).toHaveTextContent('Add Support User');
    // No leftover view-toggle tabs.
    expect(screen.queryByText('Create New')).not.toBeInTheDocument();
    expect(screen.queryByText('All Support Users')).not.toBeInTheDocument();
  });

  it('reveals the Add Support User form when the toolbar button is clicked, and toggles it back to Cancel', async () => {
    const uiUser = userEvent.setup();
    render(<SupportUserCreation />);

    expect(getToolbarButton()).toHaveTextContent('Add Support User');

    await openForm(uiUser);

    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email or Phone Number')).toBeInTheDocument();
    expect(getToolbarButton()).toHaveTextContent('Cancel');

    await uiUser.click(getToolbarButton());

    expect(getToolbarButton()).toHaveTextContent('Add Support User');
  });

  it('submits the form and shows the one-time temporary password panel on success', async () => {
    vi.mocked(adminUsersService.createSupportUser).mockResolvedValue({
      user: { id: 'usr_support_1', email: 'support@flexdemy.com', firstName: 'Sam', lastName: 'Support', role: 'Support', isActive: true },
      temporaryPassword: 'Tmp-8f3k2Az',
    });

    const uiUser = userEvent.setup();
    render(<SupportUserCreation />);

    await fillAndSubmit(uiUser);

    expect(adminUsersService.createSupportUser).toHaveBeenCalledWith({
      firstName: 'Sam',
      lastName: 'Support',
      identifier: 'support@flexdemy.com',
    });

    expect(await screen.findByText('Tmp-8f3k2Az')).toBeInTheDocument();
    expect(screen.getByText(/shown only once/i)).toBeInTheDocument();

    // The form fields are replaced by the password panel, not shown alongside it.
    expect(screen.queryByLabelText('First Name')).not.toBeInTheDocument();

    // Dismissing the panel (Done) collapses everything back to the toolbar's closed state.
    await uiUser.click(screen.getByText('Done'));
    expect(screen.queryByText('Tmp-8f3k2Az')).not.toBeInTheDocument();
    expect(getToolbarButton()).toHaveTextContent('Add Support User');
  });

  it('copies the temporary password to the clipboard and reflects the copied state', async () => {
    vi.mocked(adminUsersService.createSupportUser).mockResolvedValue({
      user: { id: 'usr_support_1', email: 'support@flexdemy.com', firstName: 'Sam', lastName: 'Support', role: 'Support', isActive: true },
      temporaryPassword: 'Tmp-8f3k2Az',
    });

    const uiUser = userEvent.setup();
    render(<SupportUserCreation />);

    await fillAndSubmit(uiUser);

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

    await fillAndSubmit(uiUser);

    expect(await screen.findByText('Support account created.')).toBeInTheDocument();
  });

  it('refetches the grid after a successful create', async () => {
    vi.mocked(adminUsersService.getSupportUsers).mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: 'usr_support_1', email: 'support@flexdemy.com', firstName: 'Sam', lastName: 'Support', role: 'Support', isActive: true },
    ]);
    vi.mocked(adminUsersService.createSupportUser).mockResolvedValue({
      user: { id: 'usr_support_1', email: 'support@flexdemy.com', firstName: 'Sam', lastName: 'Support', role: 'Support', isActive: true },
      temporaryPassword: 'Tmp-8f3k2Az',
    });

    const uiUser = userEvent.setup();
    render(<SupportUserCreation />);

    await screen.findByText('No Support accounts yet.');

    await fillAndSubmit(uiUser);
    await screen.findByText('Tmp-8f3k2Az');

    await waitFor(() => expect(adminUsersService.getSupportUsers).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Sam Support')).toBeInTheDocument();
  });

  it('shows a validation error and does not call the service when a field is missing', async () => {
    const uiUser = userEvent.setup();
    render(<SupportUserCreation />);

    await openForm(uiUser);
    await uiUser.click(screen.getByText('Save'));

    expect(screen.getByText(/fill in all required fields/i)).toBeInTheDocument();
    expect(adminUsersService.createSupportUser).not.toHaveBeenCalled();
  });

  it('surfaces the service error message on failure', async () => {
    vi.mocked(adminUsersService.createSupportUser).mockRejectedValue(
      new adminUsersService.AdminUsersError('An account with this identifier already exists.')
    );

    const uiUser = userEvent.setup();
    render(<SupportUserCreation />);

    await fillAndSubmit(uiUser);

    await waitFor(() =>
      expect(screen.getByText('An account with this identifier already exists.')).toBeInTheDocument()
    );
  });
});
