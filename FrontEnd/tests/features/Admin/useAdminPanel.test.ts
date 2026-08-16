import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAdminPanel, ADMIN_SUBTAB_META } from '@/src/features/Admin/useAdminPanel';
import { useDomain } from '@/src/context/DomainContext';
import { UserProfile } from '@/src/types';

vi.mock('@/src/context/DomainContext');

const baseUser: UserProfile = {
  id: 'usr_1',
  name: 'Hem Singh',
  email: 'hem@flexdemy.com',
  avatar: '',
  role: 'Master',
  streakDays: 0,
  totalPoints: 0,
  isDarkMode: false,
  progress: {},
};

const mockDomain = (role: UserProfile['role']) => {
  vi.mocked(useDomain).mockReturnValue({
    user: { ...baseUser, role },
    courses: [],
    isLoading: false,
    rolePermissions: null,
    ensureEnrolled: vi.fn(),
    updateUser: vi.fn(),
    awardPoints: vi.fn(),
    completeLesson: vi.fn(),
    addCourse: vi.fn(),
    refreshRolePermissions: vi.fn(),
  });
};

describe('useAdminPanel', () => {
  it('Master sees all 7 admin sub-tabs, defaulting to masterdata', () => {
    mockDomain('Master');

    const { result } = renderHook(() => useAdminPanel());

    expect(result.current.availableSubTabs).toEqual([
      'masterdata',
      'support-users',
      'role-visibility',
      'tutor-approvals',
      'ai-configuration',
      'errors',
      'settings',
    ]);
    expect(result.current.activeSubTab).toBe('masterdata');
  });

  it('Support sees tutor-approvals, masterdata (narrowed to Tag Management), and settings, not errors', () => {
    mockDomain('Support');

    const { result } = renderHook(() => useAdminPanel());

    expect(result.current.availableSubTabs).toEqual(['tutor-approvals', 'masterdata', 'settings']);
    expect(result.current.activeSubTab).toBe('tutor-approvals');
  });

  it('a role with no admin access (Student) gets an empty availableSubTabs list', () => {
    mockDomain('Student');

    const { result } = renderHook(() => useAdminPanel());

    expect(result.current.availableSubTabs).toEqual([]);
  });

  it('setActiveSubTab switches the active tab for Master', () => {
    mockDomain('Master');

    const { result } = renderHook(() => useAdminPanel());

    act(() => {
      result.current.setActiveSubTab('role-visibility');
    });

    expect(result.current.activeSubTab).toBe('role-visibility');
  });

  it("ADMIN_SUBTAB_META has an 'errors' entry with a label and icon", () => {
    expect(ADMIN_SUBTAB_META.errors.label).toBe('Error Log');
    expect(ADMIN_SUBTAB_META.errors.icon).toBeDefined();
  });

  it("ADMIN_SUBTAB_META has a 'settings' entry with a label and icon", () => {
    expect(ADMIN_SUBTAB_META.settings.label).toBe('Settings');
    expect(ADMIN_SUBTAB_META.settings.icon).toBeDefined();
  });
});
