import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDashboard } from '@/src/features/Dashboard/useDashboard';
import { useDomain } from '@/src/context/DomainContext';

vi.mock('@/src/context/DomainContext');

describe('useDashboard', () => {
  it('passes through user, courses, and isLoading from the domain context', () => {
    vi.mocked(useDomain).mockReturnValue({
      user: null,
      courses: [],
      isLoading: true,
      ensureEnrolled: vi.fn(),
      updateUser: vi.fn(),
      awardPoints: vi.fn(),
      completeLesson: vi.fn(),
      addCourse: vi.fn(),
      rolePermissions: null,
      refreshRolePermissions: vi.fn(),
    });

    const { result } = renderHook(() => useDashboard());

    expect(result.current).toEqual({ user: null, courses: [], isLoading: true });
  });
});
