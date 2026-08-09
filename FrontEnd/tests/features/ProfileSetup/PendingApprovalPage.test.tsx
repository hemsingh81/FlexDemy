import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PendingApprovalPage } from '@/src/features/ProfileSetup/PendingApprovalPage';

describe('PendingApprovalPage', () => {
  it('shows the under-review status message and calls onSignOut', async () => {
    const onSignOut = vi.fn();
    const user = userEvent.setup();
    render(<PendingApprovalPage onSignOut={onSignOut} />);

    expect(screen.getByText('Your tutor application is under review')).toBeInTheDocument();

    await user.click(screen.getByText('Sign out'));
    expect(onSignOut).toHaveBeenCalled();
  });
});
