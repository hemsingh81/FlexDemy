import React, { useState } from 'react';
import { AlertTriangle, Check, Copy, UserPlus } from 'lucide-react';
import * as adminUsersService from '../../services/adminUsersService';
import { AdminUserStatusList } from './AdminUserStatusList';
import { Button } from '../../ui/Button';
import { useToast } from '../../context/ToastContext';

// Master-only Support account creation (plan §5 item 5). The temporary password is shown
// exactly once, in the CreateSupportUserResponse -- Master must copy/relay it out-of-band
// before navigating away; there is no way to retrieve it again afterwards.
//
// This screen has two views, toggled locally: "Create New" (the form below) and "All Support
// Users" (every existing Support account, with an active/inactive toggle -- AdminUserStatusList).
const inputClassName =
  'w-full px-3 py-2.5 bg-white border border-[#E1DED4] rounded-xl text-sm text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#EC7B38]';
const labelClassName = 'block text-xs font-semibold text-[#142030]';
const viewToggleButtonClassName = (active: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
    active ? 'bg-white text-[#142030] shadow-2xs' : 'text-[#5E6A79] hover:text-[#142030]'
  }`;

export const SupportUserCreation: React.FC = () => {
  const { showToast } = useToast();
  const [view, setView] = useState<'create' | 'all'>('create');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<adminUsersService.CreateSupportUserResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !identifier.trim()) {
      setError('Please fill in every field.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const response = await adminUsersService.createSupportUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        identifier: identifier.trim(),
      });
      setResult(response);
      setFirstName('');
      setLastName('');
      setIdentifier('');
      setCopied(false);
      showToast({ message: 'Support account created.', variant: 'success' });
    } catch (err) {
      setError(
        err instanceof adminUsersService.AdminUsersError ? err.message : 'Unable to create the account. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.temporaryPassword);
      setCopied(true);
    } catch (e) {
      // Clipboard API unavailable/denied -- the password stays visible on screen either way.
    }
  };

  return (
    <div className="space-y-6">
      <div className="inline-flex items-center gap-1 p-1 bg-[#F3F0E6] rounded-xl">
        <button type="button" onClick={() => setView('create')} className={viewToggleButtonClassName(view === 'create')}>
          Create New
        </button>
        <button type="button" onClick={() => setView('all')} className={viewToggleButtonClassName(view === 'all')}>
          All Support Users
        </button>
      </div>

      {view === 'all' ? (
        <AdminUserStatusList fetchUsers={adminUsersService.getSupportUsers} emptyLabel="No Support accounts yet." editable />
      ) : (
      <div className="max-w-xl space-y-6">
      <form onSubmit={handleSubmit} className="bg-white border border-[#E1DED4] rounded-2xl shadow-2xs p-5 space-y-4">
        <h3 className="text-sm font-bold text-[#142030] flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-[#EC7B38]" />
          <span>Create a Support account</span>
        </h3>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="support-first-name" className={labelClassName}>
              First Name
            </label>
            <input
              id="support-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClassName}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="support-last-name" className={labelClassName}>
              Last Name
            </label>
            <input
              id="support-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClassName}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="support-identifier" className={labelClassName}>
            Email or Phone Number
          </label>
          <input
            id="support-identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={inputClassName}
          />
        </div>

        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

        <Button
          type="submit"
          fullWidth
          isLoading={isSubmitting}
          loadingText="Creating..."
          icon={<UserPlus className="w-4 h-4" />}
        >
          Create Support Account
        </Button>
      </form>

      {result && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs font-semibold text-amber-800">
              This temporary password is shown only once -- copy it now and relay it to {result.user.firstName}{' '}
              {result.user.lastName} out-of-band. It won't be shown again.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-xl text-sm font-mono text-[#142030]">
              {result.temporaryPassword}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#143358] text-white cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      )}
      </div>
      )}
    </div>
  );
};
