// Story 11.4, Task 4: fetch-on-mount outline + per-selection page body, mirroring
// useCourseFileNavigation.ts's own precedent shape (this hook's replacement).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCourseContentNavigation } from '@/src/features/CoursePlayer/useCourseContentNavigation';
import * as courseContentService from '@/src/services/courseContentService';
import type { OutlineDto, PageDocumentDto } from '@/src/services/courseContentService';

vi.mock('@/src/services/courseContentService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseContentService')>('@/src/services/courseContentService');
  return { ...actual, getOutline: vi.fn(), getPage: vi.fn() };
});

const EMPTY_OUTLINE: OutlineDto = { chapters: [] };

const makeOutline = (): OutlineDto => ({
  chapters: [
    { id: 'chapter_1', title: 'Waves', description: '', isConfirmed: true, order: 0, pages: [], topics: [] },
  ],
});

const makePage = (overrides: Partial<PageDocumentDto> = {}): PageDocumentDto => ({
  id: 'page_1',
  title: 'Lecture Notes',
  bodyMarkdown: 'Body text.',
  isConfirmed: true,
  order: 0,
  resources: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(courseContentService.getOutline).mockResolvedValue(EMPTY_OUTLINE);
});

describe('useCourseContentNavigation', () => {
  it('fetches the outline on mount', async () => {
    vi.mocked(courseContentService.getOutline).mockResolvedValue(makeOutline());

    const { result } = renderHook(() => useCourseContentNavigation('course_1'));

    await waitFor(() => expect(result.current.outline).toEqual(makeOutline()));
    expect(courseContentService.getOutline).toHaveBeenCalledWith('course_1');
  });

  it('a failed outline fetch leaves outline null rather than throwing', async () => {
    vi.mocked(courseContentService.getOutline).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useCourseContentNavigation('course_1'));

    await waitFor(() => expect(courseContentService.getOutline).toHaveBeenCalled());
    expect(result.current.outline).toBeNull();
  });

  it('selecting a page fetches its body via a separate getPage call, not bundled into the outline fetch', async () => {
    vi.mocked(courseContentService.getPage).mockResolvedValue(makePage());
    const { result } = renderHook(() => useCourseContentNavigation('course_1'));

    expect(courseContentService.getPage).not.toHaveBeenCalled();

    act(() => {
      result.current.setSelectedPageId('page_1');
    });

    await waitFor(() => expect(courseContentService.getPage).toHaveBeenCalledWith('course_1', 'page_1'));
  });

  it('exposes the fetched page body once loaded', async () => {
    vi.mocked(courseContentService.getPage).mockResolvedValue(makePage({ bodyMarkdown: 'Real body.' }));
    const { result } = renderHook(() => useCourseContentNavigation('course_1'));

    act(() => {
      result.current.setSelectedPageId('page_1');
    });

    await waitFor(() => expect(result.current.selectedPage?.bodyMarkdown).toBe('Real body.'));
    expect(result.current.isLoadingPage).toBe(false);
    expect(result.current.pageLoadFailed).toBe(false);
  });

  it('a failed page fetch sets pageLoadFailed rather than throwing', async () => {
    vi.mocked(courseContentService.getPage).mockRejectedValue(new Error('not found'));
    const { result } = renderHook(() => useCourseContentNavigation('course_1'));

    act(() => {
      result.current.setSelectedPageId('page_1');
    });

    await waitFor(() => expect(result.current.pageLoadFailed).toBe(true));
    expect(result.current.selectedPage).toBeNull();
  });
});
