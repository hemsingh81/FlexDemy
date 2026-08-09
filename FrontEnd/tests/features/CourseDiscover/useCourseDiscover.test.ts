import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCourseDiscover } from '@/src/features/CourseDiscover/useCourseDiscover';
import { useDomain } from '@/src/context/DomainContext';

vi.mock('@/src/context/DomainContext');

describe('useCourseDiscover', () => {
  it('passes through courses and isLoading, and derives userLanguage from the user', () => {
    vi.mocked(useDomain).mockReturnValue({
      user: { language: 'en' } as any,
      courses: [],
      isLoading: false,
      ensureEnrolled: vi.fn(),
      updateUser: vi.fn(),
      awardPoints: vi.fn(),
      completeLesson: vi.fn(),
      addCourse: vi.fn(),
    });

    const { result } = renderHook(() => useCourseDiscover());

    expect(result.current).toEqual({ courses: [], userLanguage: 'en', isLoading: false });
  });

  it('returns undefined userLanguage when there is no user', () => {
    vi.mocked(useDomain).mockReturnValue({
      user: null,
      courses: [],
      isLoading: true,
      ensureEnrolled: vi.fn(),
      updateUser: vi.fn(),
      awardPoints: vi.fn(),
      completeLesson: vi.fn(),
      addCourse: vi.fn(),
    });

    const { result } = renderHook(() => useCourseDiscover());

    expect(result.current).toEqual({ courses: [], userLanguage: undefined, isLoading: true });
  });
});
