import React, { useCallback, useId, useState } from 'react';
import { AlertTriangle, Check, Copy, Plus, X } from 'lucide-react';
import * as adminUsersService from '../../services/adminUsersService';
import { AdminUserStatusList } from './AdminUserStatusList';
import { Collapse } from '../../ui/Collapse';
import { FormCard, FieldsGrid, getRequiredFieldErrors, type FormField } from '../../ui/FormCard';
import { useToast } from '../../context/ToastContext';

// Master-only Support account creation (plan §5 item 5), restructured to match the Master Data
// screens' pattern exactly (see MasterDataTable.tsx: toolbar "Add {Entity}" button -> Collapse
// -> FormCard above an always-visible grid) rather than the old "Create New"/"All Support Users"
// tab toggle -- there is exactly one Support Users screen now.
//
// The one-time temporary password (CreateSupportUserResponse.temporaryPassword) is still shown
// exactly once and never retrievable again -- Master must copy/relay it out-of-band. It now
// renders in place of the create form, inside the same Collapse, immediately after a successful
// create; the panel only closes (and the value is discarded) when Master explicitly dismisses it,
// rather than auto-collapsing the moment the account is created.
const CREATE_FIELDS: FormField[] = [
  { key: 'firstName', label: 'First Name', type: 'text' },
  { key: 'lastName', label: 'Last Name', type: 'text' },
  { key: 'identifier', label: 'Email or Phone Number', type: 'text' },
];

const DEFAULT_FORM_VALUES: Record<string, string> = { firstName: '', lastName: '', identifier: '' };

export const SupportUserCreation: React.FC = () => {
  const { showToast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>(DEFAULT_FORM_VALUES);
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  // Set on a successful create; cleared (along with the password itself) whenever the panel is
  // dismissed. Not gated behind isFormOpen so it can render in place of the form -- see comment
  // above.
  const [result, setResult] = useState<adminUsersService.CreateSupportUserResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const formIdPrefix = useId();
  // Bumped after every successful create to force AdminUserStatusList to remount and refetch --
  // it has no imperative refresh handle of its own, and its internal load() is keyed off a
  // stable `fetchUsers` reference so it wouldn't otherwise notice the new row.
  const [gridKey, setGridKey] = useState(0);

  const closeForm = useCallback(() => {
    setIsFormOpen(false);
    setFormValues(DEFAULT_FORM_VALUES);
    setFormFieldErrors({});
    setFormError('');
    setResult(null);
    setCopied(false);
  }, []);

  const openForm = () => {
    setFormError('');
    setIsFormOpen(true);
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    // Clear this field's error the moment it's fixed, not just on the next submit attempt.
    if (value.trim()) {
      setFormFieldErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const requiredErrors = getRequiredFieldErrors(CREATE_FIELDS, formValues);
    if (Object.keys(requiredErrors).length > 0) {
      setFormFieldErrors(requiredErrors);
      setFormError('Please fill in all required fields.');
      return;
    }
    setFormFieldErrors({});
    setFormError('');
    setIsSaving(true);
    try {
      const response = await adminUsersService.createSupportUser({
        firstName: formValues.firstName.trim(),
        lastName: formValues.lastName.trim(),
        identifier: formValues.identifier.trim(),
      });
      setResult(response);
      setCopied(false);
      setFormValues(DEFAULT_FORM_VALUES);
      setFormFieldErrors({});
      setGridKey((k) => k + 1);
      showToast({ message: 'Support account created.', variant: 'success' });
    } catch (err) {
      setFormError(
        err instanceof adminUsersService.AdminUsersError ? err.message : 'Unable to create the account. Please try again.'
      );
    } finally {
      setIsSaving(false);
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
    <div className="space-y-4">
      <div className="bg-white border border-[#E1DED4] rounded-2xl shadow-2xs overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-[#E1DED4]">
          <h3 className="text-sm font-bold text-[#142030]">Support Users</h3>
          <button
            type="button"
            onClick={() => (isFormOpen ? closeForm() : openForm())}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#EC7B38] text-white shadow-md shadow-[#EC7B38]/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isFormOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{isFormOpen ? 'Cancel' : 'Add Support User'}</span>
          </button>
        </div>

        {/* Kept mounted (rather than `{isFormOpen && ...}`) so Collapse can animate it open/closed
            -- see docs/FRONTEND_TRANSITIONS.md. */}
        <Collapse open={isFormOpen}>
          {result ? (
            <div className="border border-amber-300 rounded-2xl m-4 overflow-hidden bg-amber-50 shadow-2xs">
              <div className="flex items-center justify-between px-4 py-3 border-b border-amber-300">
                <h4 className="text-sm font-bold text-[#142030] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Support account created</span>
                </h4>
                <button
                  type="button"
                  onClick={closeForm}
                  aria-label="Close"
                  className="p-1 rounded-lg text-[#5E6A79] hover:text-[#143358] hover:bg-white/60 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs font-semibold text-amber-800">
                  This temporary password is shown only once -- copy it now and relay it to {result.user.firstName}{' '}
                  {result.user.lastName} out-of-band. It won't be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 px-3 py-2 bg-white border border-amber-300 rounded-xl text-sm font-mono text-[#142030] break-all">
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
              <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-amber-300 bg-amber-100/50">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-amber-300 text-[#142030] cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <FormCard
              title="Add Support User"
              onCancel={closeForm}
              onSubmit={handleCreate}
              isSaving={isSaving}
              errorMessage={formError}
            >
              <FieldsGrid
                fields={CREATE_FIELDS}
                values={formValues}
                errors={formFieldErrors}
                idPrefix={formIdPrefix}
                onChange={handleFieldChange}
              />
            </FormCard>
          )}
        </Collapse>
      </div>

      <AdminUserStatusList
        key={gridKey}
        fetchUsers={adminUsersService.getSupportUsers}
        emptyLabel="No Support accounts yet."
        editable
      />
    </div>
  );
};
