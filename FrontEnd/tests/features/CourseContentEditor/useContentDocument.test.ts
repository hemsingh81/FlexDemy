import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useContentDocument } from '@/src/features/CourseContentEditor/useContentDocument';
import * as courseContentService from '@/src/services/courseContentService';

vi.mock('@/src/services/courseContentService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseContentService')>('@/src/services/courseContentService');
  return { ...actual, getChapters: vi.fn(), getChapterDocument: vi.fn(), createChapter: vi.fn(), updateChapter: vi.fn() };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useContentDocument', () => {
  it('starts loading, then resolves to "empty" for a course with no Chapter and fires no create call', async () => {
    vi.mocked(courseContentService.getChapters).mockResolvedValue([]);
    const { result } = renderHook(() => useContentDocument('course_1'));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('empty'));

    expect(result.current.chapterId).toBeNull();
    expect(courseContentService.getChapterDocument).not.toHaveBeenCalled();
    expect(courseContentService.createChapter).not.toHaveBeenCalled();
  });

  it('fetches and exposes the existing Chapter document when one exists', async () => {
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter_1', title: 'Existing', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue({
      id: 'chapter_1',
      courseId: 'course_1',
      title: 'Existing',
      description: '',
      isConfirmed: false,
      topics: [],
      pages: [],
    });

    const { result } = renderHook(() => useContentDocument('course_1'));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.chapterId).toBe('chapter_1');
    expect(result.current.title).toBe('Existing');
    expect(courseContentService.getChapterDocument).toHaveBeenCalledWith('course_1', 'chapter_1');
  });

  it('saveTitle creates the Chapter on the first call when none exists yet, and does not call update', async () => {
    vi.mocked(courseContentService.getChapters).mockResolvedValue([]);
    vi.mocked(courseContentService.createChapter).mockResolvedValue({ id: 'new_chapter', title: 'My New Chapter', order: 0 });
    const { result } = renderHook(() => useContentDocument('course_1'));
    await waitFor(() => expect(result.current.status).toBe('empty'));

    await act(async () => {
      await result.current.saveTitle('My New Chapter');
    });

    expect(courseContentService.createChapter).toHaveBeenCalledWith('course_1', 'My New Chapter');
    expect(courseContentService.updateChapter).not.toHaveBeenCalled();
    expect(result.current.chapterId).toBe('new_chapter');
    expect(result.current.status).toBe('ready');
  });

  it('saveTitle updates the existing Chapter (not create) once one already exists', async () => {
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter_1', title: 'Old Title', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue({
      id: 'chapter_1',
      courseId: 'course_1',
      title: 'Old Title',
      description: '',
      isConfirmed: false,
      topics: [],
      pages: [],
    });
    vi.mocked(courseContentService.updateChapter).mockResolvedValue({
      id: 'chapter_1',
      courseId: 'course_1',
      title: 'New Title',
      description: '',
      isConfirmed: false,
      topics: [],
      pages: [],
    });
    const { result } = renderHook(() => useContentDocument('course_1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      await result.current.saveTitle('New Title');
    });

    expect(courseContentService.updateChapter).toHaveBeenCalledWith('course_1', 'chapter_1', { title: 'New Title', description: null });
    expect(courseContentService.createChapter).not.toHaveBeenCalled();
    expect(result.current.title).toBe('New Title');
  });

  it('saveTitle is a no-op for blank/whitespace-only text -- never creates an empty-titled Chapter', async () => {
    vi.mocked(courseContentService.getChapters).mockResolvedValue([]);
    const { result } = renderHook(() => useContentDocument('course_1'));
    await waitFor(() => expect(result.current.status).toBe('empty'));

    await act(async () => {
      await result.current.saveTitle('   ');
    });

    expect(courseContentService.createChapter).not.toHaveBeenCalled();
  });

  it('resets to loading and re-fetches when courseId changes', async () => {
    vi.mocked(courseContentService.getChapters).mockResolvedValue([]);
    const { result, rerender } = renderHook(({ courseId }) => useContentDocument(courseId), {
      initialProps: { courseId: 'course_1' as string | null },
    });
    await waitFor(() => expect(result.current.status).toBe('empty'));

    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter_2', title: 'Course 2 Chapter', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue({
      id: 'chapter_2',
      courseId: 'course_2',
      title: 'Course 2 Chapter',
      description: '',
      isConfirmed: false,
      topics: [],
      pages: [],
    });
    rerender({ courseId: 'course_2' });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.chapterId).toBe('chapter_2');
  });

  it('addChapter resets to a local, uncommitted empty document and bumps resetKey', async () => {
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter_1', title: 'Existing', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue({
      id: 'chapter_1',
      courseId: 'course_1',
      title: 'Existing',
      description: '',
      isConfirmed: false,
      topics: [],
      pages: [],
    });
    const { result } = renderHook(() => useContentDocument('course_1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const initialResetKey = result.current.resetKey;

    act(() => {
      result.current.addChapter();
    });

    expect(result.current.status).toBe('empty');
    expect(result.current.chapterId).toBeNull();
    expect(result.current.title).toBe('');
    expect(result.current.document).toBeNull();
    expect(result.current.resetKey).toBe(initialResetKey + 1);
    // No create call fires until the new Chapter's title is actually typed and blurred.
    expect(courseContentService.createChapter).not.toHaveBeenCalled();
  });

  it('reload re-fetches the active Chapter document from the server', async () => {
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter_1', title: 'Existing', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValueOnce({
      id: 'chapter_1',
      courseId: 'course_1',
      title: 'Existing',
      description: '',
      isConfirmed: false,
      topics: [],
      pages: [],
    });
    const { result } = renderHook(() => useContentDocument('course_1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    vi.mocked(courseContentService.getChapterDocument).mockResolvedValueOnce({
      id: 'chapter_1',
      courseId: 'course_1',
      title: 'Existing',
      description: '',
      isConfirmed: false,
      topics: [{ id: 'topic_1', title: 'A Topic', description: '', order: 0, isConfirmed: false, subtopics: [], pages: [] }],
      pages: [],
    });

    await act(async () => {
      await result.current.reload();
    });

    expect(courseContentService.getChapterDocument).toHaveBeenCalledWith('course_1', 'chapter_1');
    expect(result.current.document?.topics).toHaveLength(1);
  });

  it('reload is a no-op when no Chapter has been created yet', async () => {
    vi.mocked(courseContentService.getChapters).mockResolvedValue([]);
    const { result } = renderHook(() => useContentDocument('course_1'));
    await waitFor(() => expect(result.current.status).toBe('empty'));

    await act(async () => {
      await result.current.reload();
    });

    expect(courseContentService.getChapterDocument).not.toHaveBeenCalled();
  });

  it('lands on "error" (not stuck loading) when the initial fetch fails, and retry() re-runs it', async () => {
    vi.mocked(courseContentService.getChapters).mockRejectedValueOnce(new Error('network down'));
    const { result } = renderHook(() => useContentDocument('course_1'));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('error'));

    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter_1', title: 'Existing', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue({
      id: 'chapter_1',
      courseId: 'course_1',
      title: 'Existing',
      description: '',
      isConfirmed: false,
      topics: [],
      pages: [],
    });

    act(() => {
      result.current.retry();
    });

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.chapterId).toBe('chapter_1');
  });
});
