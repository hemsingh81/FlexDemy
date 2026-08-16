import React, { useCallback, useEffect, useId, useState } from 'react';
import { Pencil } from 'lucide-react';
import * as adminUsersService from '../../services/adminUsersService';
import { Spinner } from '../../ui/Spinner';
import { SidePanel } from '../../ui/SidePanel';
import { Button } from '../../ui/Button';
import { Alert } from '../../ui/Alert';
import { FieldsGrid, getRequiredFieldErrors, type FormField } from '../../ui/FormCard';
import { useToast } from '../../context/ToastContext';

interface AdminUserStatusListProps {
  fetchUsers: () => Promise<adminUsersService.AdminUser[]>;
  emptyLabel: string;
  // Support-user editing only (BackEnd AdminUsersController.UpdateUserDetails only authorizes
  // Support targets today) -- SupportUserCreation.tsx passes this, TutorApprovals.tsx doesn't,
  // so no Edit action renders on the Tutors list until the backend is extended to cover it too.
  editable?: boolean;
}

// FirstName/LastName/Email, all required -- matches MasterDataTable.tsx's FormCard/FieldsGrid
// required-field pattern (asterisks, inline error, block submit on blank) exactly, via the
// lifted ui/FormCard.tsx rather than a second hand-copied implementation.
const EDIT_FIELDS: FormField[] = [
  { key: 'firstName', label: 'First Name', type: 'text' },
  { key: 'lastName', label: 'Last Name', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
];

// Shared "name / email / active-inactive toggle (+ optional edit)" list, reused by both
// SupportUserCreation's "All Support Users" view and TutorApprovals' "All Tutors" view -- same
// shape of data (BackEnd UserDto), same setUserActiveStatus call, just a different fetch.
// Mirrors MasterDataTable.tsx's toggle-switch visual pattern (the pill-shaped Active/Inactive
// button) rather than inventing a new one, since that component already does exactly this shape
// of UI -- it isn't reused directly because it also owns a mandatory create-form, which neither
// of these screens needs (Support/Tutor account creation happens elsewhere: the "Create New"
// form and the tutor approval flow, respectively).
export const AdminUserStatusList: React.FC<AdminUserStatusListProps> = ({ fetchUsers, emptyLabel, editable }) => {
  const { showToast } = useToast();
  const [users, setUsers] = useState<adminUsersService.AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Docked-right SidePanel edit -- same pattern as MasterDataTable.tsx's row-edit panel.
  // `editingUser` still carries the full row (not just an id) since its fields prefill the form
  // on open.
  const [editingUser, setEditingUser] = useState<adminUsersService.AdminUser | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, boolean>>({});
  const [editFormError, setEditFormError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const idPrefix = useId();
  const editFormId = `${idPrefix}-edit-form`;

  const load = useCallback(() => {
    setIsLoading(true);
    fetchUsers()
      .then((u) => {
        setUsers(u);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [fetchUsers]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (target: adminUsersService.AdminUser) => {
    setError('');
    setTogglingId(target.id);
    try {
      const nextActive = !target.isActive;
      await adminUsersService.setUserActiveStatus(target.id, nextActive);
      load();
      showToast({
        message: `${target.firstName} ${target.lastName} ${nextActive ? 'activated' : 'deactivated'}.`,
        variant: 'success',
      });
    } catch (err) {
      // Handled inline rather than silently -- a 403 is a real possibility from the frontend's
      // point of view (SetUserActiveStatus checks the caller against the policy for the
      // TARGET's role, not the caller's own role).
      setError(
        err instanceof adminUsersService.AdminUsersError ? err.message : 'Unable to update status. Please try again.'
      );
    } finally {
      setTogglingId(null);
    }
  };

  const openEdit = (target: adminUsersService.AdminUser) => {
    setEditingUser(target);
    setEditValues({ firstName: target.firstName, lastName: target.lastName, email: target.email });
    setEditFieldErrors({});
    setEditFormError('');
  };

  const closeEdit = () => {
    setEditingUser(null);
    setEditFieldErrors({});
    setEditFormError('');
  };

  const handleEditFieldChange = (key: string, value: string) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
    // Clear this field's error the moment it's fixed, not just on the next submit attempt.
    if (value.trim()) {
      setEditFieldErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const requiredErrors = getRequiredFieldErrors(EDIT_FIELDS, editValues);
    if (Object.keys(requiredErrors).length > 0) {
      setEditFieldErrors(requiredErrors);
      setEditFormError('Please fill in all required fields.');
      return;
    }
    setEditFieldErrors({});
    setEditFormError('');
    setIsSavingEdit(true);
    try {
      await adminUsersService.updateSupportUserDetails(editingUser.id, {
        firstName: editValues.firstName.trim(),
        lastName: editValues.lastName.trim(),
        email: editValues.email.trim(),
      });
      closeEdit();
      load();
      showToast({ message: 'User details updated.', variant: 'success' });
    } catch (err) {
      setEditFormError(
        err instanceof adminUsersService.AdminUsersError ? err.message : 'Unable to save changes. Please try again.'
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-[#5E6A79]">
        <Spinner size="lg" className="mr-2" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E1DED4] rounded-2xl shadow-2xs overflow-hidden">
      {error && <p className="px-4 pt-3 text-xs font-semibold text-red-600">{error}</p>}

      {users.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#5E6A79]">{emptyLabel}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-[#5E6A79] bg-[#F3F0E6]">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                    <tr key={u.id} className="border-t border-[#E1DED4]">
                      <td className="px-4 py-2.5 text-[#142030] font-medium">
                        {u.firstName} {u.lastName}
                      </td>
                      <td className="px-4 py-2.5 text-[#5E6A79]">{u.email}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggle(u)}
                            disabled={togglingId === u.id}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50 ${
                              u.isActive ? 'bg-[#179765]/15 text-[#179765]' : 'bg-red-100 text-red-600'
                            }`}
                          >
                            {u.isActive ? 'Active' : 'Inactive'}
                          </button>
                          {editable && (
                            <button
                              type="button"
                              onClick={() => openEdit(u)}
                              aria-label={`Edit ${u.firstName} ${u.lastName}`}
                              className="p-1.5 rounded-lg text-[#5E6A79] hover:text-[#143358] hover:bg-[#F3F0E6] transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editable && editingUser && (
        <SidePanel
          title={`Edit ${editingUser.firstName} ${editingUser.lastName}`}
          onClose={closeEdit}
          closeOnBackdropClick={false}
          footer={({ requestClose }) => (
            <>
              <Button variant="ghost" size="sm" type="button" onClick={requestClose}>
                Cancel
              </Button>
              <Button variant="secondary" size="sm" type="submit" form={editFormId} disabled={isSavingEdit}>
                {isSavingEdit ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        >
          <form id={editFormId} onSubmit={handleSaveEdit} className="space-y-3">
            {editFormError && <Alert variant="danger">{editFormError}</Alert>}
            <FieldsGrid
              fields={EDIT_FIELDS}
              values={editValues}
              errors={editFieldErrors}
              idPrefix={`${idPrefix}-edit`}
              onChange={handleEditFieldChange}
            />
          </form>
        </SidePanel>
      )}
    </div>
  );
};
