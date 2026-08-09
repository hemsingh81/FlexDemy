import React, { useState } from 'react';
import { X, Sparkles, User, Lock, Mail, Check, LogIn, ArrowRight } from 'lucide-react';
import { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdateUser: (user: Partial<UserProfile>) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState(user.email);
  const [name, setName] = useState(user.name);
  const [password, setPassword] = useState('••••••••');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSuccess(true);
    setTimeout(() => {
      onUpdateUser({ name: name || 'Alex Rivera', email: email || 'alex.rivera@learnsphere.edu' });
      setIsSuccess(false);
      onClose();
    }, 1000);
  };

  const handleDemoSwitch = (role: 'student' | 'instructor') => {
    if (role === 'student') {
      onUpdateUser({
        name: 'Alex Rivera',
        email: 'alex.rivera@learnsphere.edu',
        role: 'student',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      });
    } else {
      onUpdateUser({
        name: 'Dr. Elena Rostova',
        email: 'elena.rostova@mit.edu',
        role: 'instructor',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#161618] rounded-2xl shadow-2xl border border-[#27272A] p-6 sm:p-8 text-gray-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            {mode === 'signin' && 'Welcome back to LearnSphere'}
            {mode === 'signup' && 'Create your Learner Account'}
            {mode === 'forgot' && 'Reset Password'}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {mode === 'signin' && 'Sign in to access your interactive courses and study groups'}
            {mode === 'signup' && 'Join thousands of active learners exploring AI-assisted courses'}
            {mode === 'forgot' && 'Enter your email to receive a password reset link'}
          </p>
        </div>

        {/* Social Quick Login */}
        <div className="space-y-2 mb-6">
          <button
            onClick={() => handleDemoSwitch('student')}
            type="button"
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-[#0E0E10] hover:bg-[#1C1C1F] rounded-xl text-xs font-semibold text-gray-200 transition-colors border border-[#27272A]"
          >
            <User className="w-4 h-4 text-indigo-400" />
            <span>Continue as Demo Student (Alex Rivera)</span>
          </button>
          <button
            onClick={() => handleDemoSwitch('instructor')}
            type="button"
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-indigo-950/40 hover:bg-indigo-900/60 rounded-xl text-xs font-semibold text-indigo-300 transition-colors border border-indigo-800"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Continue as Demo Instructor (Dr. Elena Rostova)</span>
          </button>
        </div>

        <div className="relative flex py-2 items-center mb-6">
          <div className="flex-grow border-t border-[#27272A]"></div>
          <span className="flex-shrink mx-3 text-xs text-gray-500 font-medium uppercase">Or Email Sign In</span>
          <div className="flex-grow border-t border-[#27272A]"></div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full pl-9 pr-4 py-2.5 bg-[#0E0E10] border border-[#27272A] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.edu"
                className="w-full pl-9 pr-4 py-2.5 bg-[#0E0E10] border border-[#27272A] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-300">
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs text-indigo-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#0E0E10] border border-[#27272A] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSuccess}
            className="w-full py-3 px-4 bg-[#143358] hover:bg-[#143358]/90 text-white font-semibold rounded-xl text-sm shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            {isSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Authenticated Successfully!</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>
                  {mode === 'signin' && 'Sign In'}
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'forgot' && 'Send Reset Link'}
                </span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </form>

        {/* Bottom Mode Switch */}
        <div className="mt-6 text-center text-xs text-gray-400">
          {mode === 'signin' && (
            <p>
              Don't have an account yet?{' '}
              <button onClick={() => setMode('signup')} className="text-indigo-400 font-semibold hover:underline">
                Sign up free
              </button>
            </p>
          )}
          {mode === 'signup' && (
            <p>
              Already registered?{' '}
              <button onClick={() => setMode('signin')} className="text-indigo-400 font-semibold hover:underline">
                Sign in
              </button>
            </p>
          )}
          {mode === 'forgot' && (
            <button onClick={() => setMode('signin')} className="text-indigo-400 font-semibold hover:underline">
              Return to Sign In
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
