import React, { useState } from 'react';
import { User, Mail, Lock, UserPlus, ArrowRight } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { useAuth } from './useAuth';
import { AuthError } from '../../services/authService';
import { Button } from '../../ui/Button';

interface SignUpPageProps {
  onAuthenticated: () => void;
  onGoToLogin: () => void;
}

export const SignUpPage: React.FC<SignUpPageProps> = ({ onAuthenticated, onGoToLogin }) => {
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !identifier.trim() || !password.trim()) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await register(firstName.trim(), lastName.trim(), identifier, password);
      onAuthenticated();
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Unable to create your account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Join FlexDemy and start learning today">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#142030]">First Name</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-3 text-[#5E6A79]" />
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Hem"
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#E1DED4] rounded-xl text-sm text-[#142030] placeholder-[#5E6A79] focus:outline-none focus:ring-2 focus:ring-[#EC7B38]"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#142030]">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Singh"
              className="w-full px-3 py-2.5 bg-white border border-[#E1DED4] rounded-xl text-sm text-[#142030] placeholder-[#5E6A79] focus:outline-none focus:ring-2 focus:ring-[#EC7B38]"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-[#142030]">Email or Phone Number</label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-3 text-[#5E6A79]" />
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@domain.com or +1 555 000 1234"
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E1DED4] rounded-xl text-sm text-[#142030] placeholder-[#5E6A79] focus:outline-none focus:ring-2 focus:ring-[#EC7B38]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#142030]">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-[#5E6A79]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#E1DED4] rounded-xl text-sm text-[#142030] placeholder-[#5E6A79] focus:outline-none focus:ring-2 focus:ring-[#EC7B38]"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#142030]">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 bg-white border border-[#E1DED4] rounded-xl text-sm text-[#142030] placeholder-[#5E6A79] focus:outline-none focus:ring-2 focus:ring-[#EC7B38]"
            />
          </div>
        </div>

        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

        <Button
          type="submit"
          fullWidth
          isLoading={isSubmitting}
          loadingText="Creating Account..."
          icon={<UserPlus className="w-4 h-4" />}
          trailingIcon={<ArrowRight className="w-4 h-4" />}
        >
          Create Account
        </Button>
      </form>

      <p className="text-center text-xs text-[#5E6A79]">
        Already have an account?{' '}
        <button type="button" onClick={onGoToLogin} className="font-bold text-[#EC7B38] hover:underline">
          Sign in
        </button>
      </p>
    </AuthLayout>
  );
};
