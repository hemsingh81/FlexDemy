import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Save } from 'lucide-react';
import * as rolePermissionsService from '../../services/rolePermissionsService';
import { Spinner } from '../../ui/Spinner';
import { Button } from '../../ui/Button';
import { useToast } from '../../context/ToastContext';

// Checkbox matrix over the 4 "managed" roles (Student/Tutor/Support/Master --
// RolePermissionService.ManagedRoles on the backend already excludes
// Unassigned/PendingTutor/RejectedTutor, they're profile-completion funnel states with no
// meaningful permission set to edit here) x FeatureKeys.AllKeys (plan §5 item 5).
const ROLES = ['Student', 'Tutor', 'Support', 'Master'] as const;

// Mirrors BackEnd FlexDemy.Application/Permissions/FeatureKeys.cs exactly.
const FEATURE_KEY_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  discover: 'Discover',
  tutor: 'Tutor Hub',
  groups: 'Study Groups',
  assignments: 'Assignments',
  certificates: 'Certificates',
  admin: 'Admin Panel',
  'courses.create': 'Create Courses',
  'masterdata.manage': 'Manage Master Data',
  'tutor.approve': 'Approve Tutors',
  'admin.users.create': 'Create Support Users',
  'admin.permissions.manage': 'Manage Role Permissions',
};

const FEATURE_KEYS = Object.keys(FEATURE_KEY_LABELS);

// The real dependency structure in this app: FeatureKeys.Admin is the prerequisite for
// reaching the admin panel at all, and these 4 action keys are only meaningful/reachable once
// Admin is visible for a role -- they're conceptually children of it. Every other key
// (the remaining nav keys, plus the standalone courses.create) has no such parent and stays a
// flat top-level row.
const ADMIN_CHILD_KEYS = ['masterdata.manage', 'tutor.approve', 'admin.users.create', 'admin.permissions.manage'];

// Render order: same as before, except the 4 admin-child keys are pulled out of the flat list
// and rendered nested under 'admin' instead.
const TOP_LEVEL_KEYS = FEATURE_KEYS.filter((key) => key === 'admin' || !ADMIN_CHILD_KEYS.includes(key));

const rowKey = (role: string, featureKey: string) => `${role}|${featureKey}`;

const checkboxClassName =
  'w-4 h-4 rounded border-[#E1DED4] text-[#EC7B38] focus:ring-[#EC7B38] disabled:opacity-40 disabled:cursor-not-allowed';

export const RoleVisibilityManager: React.FC = () => {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [grid, setGrid] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [isAdminExpanded, setIsAdminExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    rolePermissionsService.getMatrix().then((rows) => {
      if (cancelled) return;
      const next: Record<string, boolean> = {};
      rows.forEach((row) => {
        next[rowKey(row.role, row.featureKey)] = row.isVisible;
      });
      setGrid(next);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (role: string, featureKey: string) => {
    // UX-only safety net: don't let Master's own row be unchecked here. The real lock-out
    // protection is server-side -- FeatureAuthorizationHandler always succeeds for Master
    // regardless of what's in this table (plan §3) -- this just stops an admin from
    // confusing themselves with a grid that looks like it revoked their own access.
    if (role === 'Master') return;
    setSaved(false);
    setGrid((prev) => {
      const key = rowKey(role, featureKey);
      const nextValue = !prev[key];
      const next = { ...prev, [key]: nextValue };
      // Unchecking Admin for a role in this pending (unsaved) edit state auto-unchecks that
      // role's 4 Admin-child permissions too -- a checked child under an unchecked parent is a
      // confusing intermediate state, and a role without Admin visibility can't reach the
      // screens that would use those permissions anyway. This is a live edit-time convenience
      // only: it does NOT run retroactively against whatever the server already had on load,
      // and it isn't a new backend rule -- it just pre-empts a pointless save.
      if (featureKey === 'admin' && !nextValue) {
        ADMIN_CHILD_KEYS.forEach((childKey) => {
          next[rowKey(role, childKey)] = false;
        });
      }
      return next;
    });
  };

  const handleSave = async () => {
    setError('');
    setIsSaving(true);
    try {
      const updates: rolePermissionsService.UpdatePermissionRequest[] = ROLES.flatMap((role) =>
        FEATURE_KEYS.map((featureKey) => ({
          role,
          featureKey,
          isVisible: Boolean(grid[rowKey(role, featureKey)]),
        }))
      );
      await rolePermissionsService.updateMatrix(updates);
      setSaved(true);
      showToast({ message: 'Role permissions saved.', variant: 'success' });
    } catch (err) {
      setError(
        err instanceof rolePermissionsService.RolePermissionsError
          ? err.message
          : 'Unable to save changes. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-[#5E6A79]">
        <Spinner size="lg" className="mr-2" />
        <span className="text-sm">Loading permissions...</span>
      </div>
    );
  }

  const renderRoleCell = (role: string, featureKey: string, disabled: boolean, title?: string) => (
    <td key={role} className="px-4 py-2.5 text-center">
      <input
        type="checkbox"
        aria-label={`${role} - ${FEATURE_KEY_LABELS[featureKey]}`}
        checked={Boolean(grid[rowKey(role, featureKey)])}
        onChange={() => toggle(role, featureKey)}
        disabled={disabled}
        title={title}
        className={checkboxClassName}
      />
    </td>
  );

  return (
    <div className="bg-white border border-[#E1DED4] rounded-2xl shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-[#5E6A79] bg-[#F3F0E6]">
              <th className="px-4 py-2">Feature</th>
              {ROLES.map((role) => (
                <th key={role} className="px-4 py-2 text-center">
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TOP_LEVEL_KEYS.map((featureKey) => {
              if (featureKey !== 'admin') {
                return (
                  <tr key={featureKey} className="border-t border-[#E1DED4]">
                    <td className="px-4 py-2.5 text-[#142030] font-medium">{FEATURE_KEY_LABELS[featureKey]}</td>
                    {ROLES.map((role) => renderRoleCell(role, featureKey, role === 'Master'))}
                  </tr>
                );
              }

              return (
                <React.Fragment key="admin">
                  <tr className="border-t border-[#E1DED4]">
                    <td className="px-4 py-2.5 text-[#142030] font-medium">
                      <button
                        type="button"
                        onClick={() => setIsAdminExpanded((v) => !v)}
                        aria-expanded={isAdminExpanded}
                        aria-label={isAdminExpanded ? 'Collapse Admin Panel permissions' : 'Expand Admin Panel permissions'}
                        className="flex items-center gap-1.5 cursor-pointer"
                      >
                        {isAdminExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-[#5E6A79]" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-[#5E6A79]" />
                        )}
                        <span>{FEATURE_KEY_LABELS.admin}</span>
                      </button>
                    </td>
                    {ROLES.map((role) => renderRoleCell(role, 'admin', role === 'Master'))}
                  </tr>
                  {isAdminExpanded &&
                    ADMIN_CHILD_KEYS.map((childKey) => (
                      <tr key={childKey} className="border-t border-[#E1DED4] bg-[#FAFAF7]">
                        <td className="px-4 py-2.5 pl-9 text-[#5E6A79] font-medium">{FEATURE_KEY_LABELS[childKey]}</td>
                        {ROLES.map((role) => {
                          const parentOff = role !== 'Master' && !grid[rowKey(role, 'admin')];
                          return renderRoleCell(
                            role,
                            childKey,
                            role === 'Master' || parentOff,
                            parentOff ? 'Requires Admin access' : undefined
                          );
                        })}
                      </tr>
                    ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-4 border-t border-[#E1DED4]">
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          isLoading={isSaving}
          loadingText="Saving..."
          icon={<Save className="w-4 h-4" />}
        >
          Save Changes
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-xs font-semibold text-[#179765]">
            <Check className="w-3.5 h-3.5" />
            <span>Saved</span>
          </span>
        )}
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        <p className="text-[10px] text-[#5E6A79] sm:ml-auto">
          Master's own access can't be turned off here -- the backend enforces the real lock-out protection regardless.
        </p>
      </div>
    </div>
  );
};
