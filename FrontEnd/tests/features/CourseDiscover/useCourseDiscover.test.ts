import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCourseDiscover } from '@/src/features/CourseDiscover/useCourseDiscover';
import { useDomain } from '@/src/context/DomainContext';

vi.mock('@/src/context/DomainContext');

describe('useCourseDiscover', () => {
  it('passes through courses and isLoading from the domain context', () => {
    vi.mocked(useDomain).mockReturnValue({
      user: {} as any,
      courses: [],
      isLoading: false,
      ensureEnrolled: vi.fn(),
      updateUser: vi.fn(),
      awardPoints: vi.fn(),
      completeLesson: vi.fn(),
      addCourse: vi.fn(),
      rolePermissions: null,
      refreshRolePermissions: vi.fn(),
    });

    const { result } = renderHook(() => useCourseDiscover());

    expect(result.current).toEqual({ courses: [], isLoading: false });
  });

  it('passes through isLoading when there is no user yet', () => {
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

    const { result } = renderHook(() => useCourseDiscover());

    expect(result.current).toEqual({ courses: [], isLoading: true });
  });
});
