import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { CourseContentProvider, useCourseContent } from '@/src/context/CourseContentContext';
import * as courseContentService from '@/src/services/courseContentService';

vi.mock('@/src/services/courseContentService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseContentService')>('@/src/services/courseContentService');
  return { ...actual, getOutline: vi.fn() };
});

const wrapper =
  (courseId: string | null): React.FC<{ children: React.ReactNode }> =>
  ({ children }) => <CourseContentProvider courseId={courseId}>{children}</CourseContentProvider>;

beforeEach(() => {
  vi.mocked(courseContentService.getOutline).mockReset();
});

describe('CourseContentContext', () => {
  it('fetches getOutline on mount for the given course id', async () => {
    vi.mocked(courseContentService.getOutline).mockResolvedValue({ chapters: [] });

    renderHook(() => useCourseContent(), { wrapper: wrapper('course_1') });

    await waitFor(() => expect(courseContentService.getOutline).toHaveBeenCalledWith('course_1'));
  });

  it('exposes per-node isConfirmed lookups nested through Chapter -> Topic -> Sub-Topic -> Page', async () => {
    vi.mocked(courseContentService.getOutline).mockResolvedValue({
      chapters: [
        {
          id: 'chapter_1',
          title: 'Chemical Reactions',
          description: '',
          isConfirmed: true,
          order: 0,
          pages: [{ id: 'page_chapter', title: 'Chapter Page', isConfirmed: false, order: 0 }],
          topics: [
            {
              id: 'topic_1',
              title: 'Combustion',
              description: '',
              isConfirmed: false,
              order: 0,
              pages: [],
              subtopics: [
                { id: 'subtopic_1', title: 'Fire triangle', description: '', isConfirmed: true, order: 0, pages: [] },
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useCourseContent(), { wrapper: wrapper('course_1') });

    await waitFor(() => expect(result.current.isConfirmed('chapter_1')).toBe(true));
    expect(result.current.isConfirmed('topic_1')).toBe(false);
    expect(result.current.isConfirmed('subtopic_1')).toBe(true);
    expect(result.current.isConfirmed('page_chapter')).toBe(false);
    expect(result.current.isConfirmed('unknown_node')).toBeUndefined();
  });

  it('patchConfirmation updates a single node without re-fetching the outline', async () => {
    vi.mocked(courseContentService.getOutline).mockResolvedValue({
      chapters: [{ id: 'chapter_1', title: 'C', description: '', isConfirmed: true, order: 0, pages: [], topics: [] }],
    });
    const { result } = renderHook(() => useCourseContent(), { wrapper: wrapper('course_1') });
    await waitFor(() => expect(result.current.isConfirmed('chapter_1')).toBe(true));
    const callsBefore = vi.mocked(courseContentService.getOutline).mock.calls.length;

    act(() => {
      result.current.patchConfirmation('chapter_1', false);
    });

    expect(result.current.isConfirmed('chapter_1')).toBe(false);
    expect(vi.mocked(courseContentService.getOutline).mock.calls.length).toBe(callsBefore);
  });

  it('refetch replaces the whole map and returns it directly for immediate before/after comparison', async () => {
    vi.mocked(courseContentService.getOutline).mockResolvedValueOnce({
      chapters: [{ id: 'chapter_1', title: 'C', description: '', isConfirmed: true, order: 0, pages: [], topics: [] }],
    });
    const { result } = renderHook(() => useCourseContent(), { wrapper: wrapper('course_1') });
    await waitFor(() => expect(result.current.isConfirmed('chapter_1')).toBe(true));

    vi.mocked(courseContentService.getOutline).mockResolvedValueOnce({
      chapters: [{ id: 'chapter_1', title: 'C', description: '', isConfirmed: false, order: 0, pages: [], topics: [] }],
    });

    let freshMap: Map<string, boolean> | undefined;
    await act(async () => {
      freshMap = await result.current.refetch();
    });

    expect(freshMap?.get('chapter_1')).toBe(false);
    expect(result.current.isConfirmed('chapter_1')).toBe(false);
  });

  it('useCourseContent throws when used outside a CourseContentProvider', () => {
    // Suppress the expected React error-boundary console noise for this one assertion.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useCourseContent())).toThrow('useCourseContent must be used within a CourseContentProvider');
    consoleError.mockRestore();
  });
});
