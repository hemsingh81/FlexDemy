import React, { useState } from 'react';
import { Mail, Lock, LogIn, ArrowRight } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { useAuth } from './useAuth';
import { AuthError } from '../../services/authService';
import { Button } from '../../ui/Button';

interface LoginPageProps {
  onAuthenticated: () => void;
  onGoToSignUp: () => void;
  onGoToForgotPassword: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onAuthenticated, onGoToSignUp, onGoToForgotPassword }) => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError('Enter your email or phone number and password.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await login(identifier, password);
      onAuthenticated();
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue your courses">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-[#142030]">Email or Phone Number</label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-3 text-[#5E6A79]" />
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@domain.com or +91 84477 12345"
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E1DED4] rounded-xl text-sm text-[#142030] placeholder-[#5E6A79] focus:outline-none focus:ring-2 focus:ring-[#EC7B38]"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-[#142030]">Password</label>
            <button
              type="button"
              onClick={onGoToForgotPassword}
              className="text-xs font-semibold text-[#143358] hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-3 text-[#5E6A79]" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E1DED4] rounded-xl text-sm text-[#142030] placeholder-[#5E6A79] focus:outline-none focus:ring-2 focus:ring-[#EC7B38]"
            />
          </div>
        </div>

        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

        <Button
          type="submit"
          fullWidth
          isLoading={isSubmitting}
          loadingText="Signing In..."
          icon={<LogIn className="w-4 h-4" />}
          trailingIcon={<ArrowRight className="w-4 h-4" />}
        >
          Sign In
        </Button>
      </form>

      <p className="text-center text-xs text-[#5E6A79]">
        New here?{' '}
        <button type="button" onClick={onGoToSignUp} className="font-bold text-[#EC7B38] hover:underline">
          Create an account
        </button>
      </p>
    </AuthLayout>
  );
};
