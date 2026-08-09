import React, { useState } from 'react';
import { Mail, Send, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from './AuthLayout';

interface ForgotPasswordPageProps {
  onGoToLogin: () => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onGoToLogin }) => {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Enter your email or phone number.');
      return;
    }
    setError('');
    // Mock-only: no backend yet, just show confirmation.
    setIsSent(true);
  };

  return (
    <AuthLayout title="Reset your password" subtitle="We'll send you a link to get back in">
      {isSent ? (
        <div className="p-4 rounded-xl bg-[#179765]/10 border border-[#179765]/30 flex items-start space-x-3">
          <CheckCircle2 className="w-5 h-5 text-[#179765] shrink-0 mt-0.5" />
          <p className="text-sm text-[#142030]">
            If an account exists for <strong>{identifier}</strong>, a reset link is on its way.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
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

          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 px-4 bg-[#143358] hover:bg-[#143358]/90 text-white font-bold rounded-xl text-sm shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Send Reset Link</span>
          </button>
        </form>
      )}

      <p className="text-center text-xs text-[#5E6A79]">
        <button type="button" onClick={onGoToLogin} className="font-bold text-[#EC7B38] hover:underline">
          Return to Sign In
        </button>
      </p>
    </AuthLayout>
  );
};
