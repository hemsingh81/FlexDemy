import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from '@/src/features/Auth/LoginPage';
import { SignUpPage } from '@/src/features/Auth/SignUpPage';
import { ForgotPasswordPage } from '@/src/features/Auth/ForgotPasswordPage';
import { useAuth } from '@/src/features/Auth/useAuth';
import { AuthError } from '@/src/services/authService';

vi.mock('@/src/features/Auth/useAuth');

describe('LoginPage', () => {
  it('requires both fields before calling login', async () => {
    const login = vi.fn();
    vi.mocked(useAuth).mockReturnValue({ login, register: vi.fn() });
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    render(<LoginPage onAuthenticated={onAuthenticated} onGoToSignUp={vi.fn()} onGoToForgotPassword={vi.fn()} />);

    await user.click(screen.getByText('Sign In'));
    expect(login).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText(/you@domain.com/), 'hemsingh81@gmail.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'Password@123');
    await user.click(screen.getByText('Sign In'));

    expect(login).toHaveBeenCalledWith('hemsingh81@gmail.com', 'Password@123');
    expect(onAuthenticated).toHaveBeenCalled();
  });

  it('shows the backend error and does not authenticate on wrong credentials', async () => {
    const login = vi.fn().mockRejectedValue(new AuthError('Incorrect email/phone or password.'));
    vi.mocked(useAuth).mockReturnValue({ login, register: vi.fn() });
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    render(<LoginPage onAuthenticated={onAuthenticated} onGoToSignUp={vi.fn()} onGoToForgotPassword={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/you@domain.com/), 'hemsingh81@gmail.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrong-password');
    await user.click(screen.getByText('Sign In'));

    expect(await screen.findByText('Incorrect email/phone or password.')).toBeInTheDocument();
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('links to sign up and forgot password', async () => {
    vi.mocked(useAuth).mockReturnValue({ login: vi.fn(), register: vi.fn() });
    const onGoToSignUp = vi.fn();
    const onGoToForgotPassword = vi.fn();
    const user = userEvent.setup();
    render(<LoginPage onAuthenticated={vi.fn()} onGoToSignUp={onGoToSignUp} onGoToForgotPassword={onGoToForgotPassword} />);

    await user.click(screen.getByText('Create an account'));
    expect(onGoToSignUp).toHaveBeenCalled();

    await user.click(screen.getByText('Forgot password?'));
    expect(onGoToForgotPassword).toHaveBeenCalled();
  });
});

describe('SignUpPage', () => {
  it('rejects mismatched passwords, accepts a valid submission', async () => {
    // Types into 6 fields across two submits -- needs more than vitest's 5s default here.
    const register = vi.fn();
    vi.mocked(useAuth).mockReturnValue({ login: vi.fn(), register });
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    render(<SignUpPage onAuthenticated={onAuthenticated} onGoToLogin={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Hem'), 'Hem');
    await user.type(screen.getByPlaceholderText('Singh'), 'Singh');
    await user.type(screen.getByPlaceholderText(/you@domain.com/), 'Hem@flexdemy.com');
    const [password, confirm] = screen.getAllByPlaceholderText('••••••••');
    await user.type(password, 'password123');
    await user.type(confirm, 'different');
    await user.click(screen.getByText('Create Account'));
    expect(register).not.toHaveBeenCalled();
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();

    await user.clear(confirm);
    await user.type(confirm, 'password123');
    await user.click(screen.getByText('Create Account'));

    expect(register).toHaveBeenCalledWith('Hem', 'Singh', 'Hem@flexdemy.com', 'password123');
    expect(onAuthenticated).toHaveBeenCalled();
  }, 15000);

  it('shows the backend error on a duplicate account and does not authenticate', async () => {
    const register = vi.fn().mockRejectedValue(new AuthError("An account already exists for 'Hem@flexdemy.com'."));
    vi.mocked(useAuth).mockReturnValue({ login: vi.fn(), register });
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    render(<SignUpPage onAuthenticated={onAuthenticated} onGoToLogin={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Hem'), 'Hem');
    await user.type(screen.getByPlaceholderText('Singh'), 'Singh');
    await user.type(screen.getByPlaceholderText(/you@domain.com/), 'Hem@flexdemy.com');
    const [password, confirm] = screen.getAllByPlaceholderText('••••••••');
    await user.type(password, 'password123');
    await user.type(confirm, 'password123');
    await user.click(screen.getByText('Create Account'));

    expect(await screen.findByText("An account already exists for 'Hem@flexdemy.com'.")).toBeInTheDocument();
    expect(onAuthenticated).not.toHaveBeenCalled();
  });
});

describe('ForgotPasswordPage', () => {
  it('shows a confirmation after submitting an identifier', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordPage onGoToLogin={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/you@domain.com/), 'Hem@flexdemy.com');
    await user.click(screen.getByText('Send Reset Link'));

    expect(screen.getByText(/Hem@flexdemy.com/)).toBeInTheDocument();
  });
});
