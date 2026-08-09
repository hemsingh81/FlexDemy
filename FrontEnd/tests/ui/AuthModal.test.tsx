import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthModal } from '@/src/ui/AuthModal';
import { UserProfile } from '@/src/types';

const user: UserProfile = {
  id: 'usr_1',
  name: 'Alex Rivera',
  email: 'alex@example.com',
  avatar: '',
  role: 'student',
  streakDays: 1,
  totalPoints: 0,
  preferredVoice: '',
  ttsRate: 1,
  ttsPitch: 1,
  isDarkMode: false,
  language: 'en',
  progress: {},
};

describe('AuthModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <AuthModal isOpen={false} onClose={vi.fn()} user={user} onUpdateUser={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the sign-in heading when open', () => {
    render(<AuthModal isOpen={true} onClose={vi.fn()} user={user} onUpdateUser={vi.fn()} />);
    expect(screen.getByText('Welcome back to FlexDemy')).toBeInTheDocument();
  });
});
