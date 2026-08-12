import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCourseContentTree } from '@/src/features/CourseContentEditor/useCourseContentTree';
import * as contentTreeService from '@/src/services/contentTreeService';
import type { ChapterDto, ContentBlockDto, SubtopicDto, TopicDto } from '@/src/services/contentTreeService';

vi.mock('@/src/services/contentTreeService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/contentTreeService')>('@/src/services/contentTreeService');
  return {
    ...actual,
    getTree: vi.fn(),
    addChapter: vi.fn(),
    addTopic: vi.fn(),
    addSubtopic: vi.fn(),
    addContentBlock: vi.fn(),
    editNodeTitle: vi.fn(),
    editContentBlock: vi.fn(),
    deleteNode: vi.fn(),
    reorderNode: vi.fn(),
    moveNode: vi.fn(),
    confirmNode: vi.fn(),
  };
});

// Wire-shape fixtures (PascalCase Confirmation/Format string values, matching CourseMapper.cs's
// own .ToString() convention -- ContentTreeDtos.cs is the real source of truth for this shape).
const makeBlockDto = (overrides: Partial<ContentBlockDto> = {}): ContentBlockDto => ({
  id: 'block_1',
  format: 'Text',
  confirmation: 'Confirmed',
  order: 0,
  text: 'A wave transfers energy without transferring matter.',
  lang: 'en',
  notation: null,
  imageUrl: null,
  altText: null,
  ...overrides,
});

const makeSubtopicDto = (overrides: Partial<SubtopicDto> = {}): SubtopicDto => ({
  id: 'subtopic_1',
  title: 'Subtopic 1',
  confirmation: 'Confirmed',
  order: 0,
  contentBlocks: [makeBlockDto()],
  ...overrides,
});

const makeTopicDto = (overrides: Partial<TopicDto> = {}): TopicDto => ({
  id: 'topic_1',
  title: 'Topic 1',
  confirmation: 'Unconfirmed',
  order: 0,
  subtopics: [makeSubtopicDto()],
  contentBlocks: [],
  ...overrides,
});

const makeChapterDto = (overrides: Partial<ChapterDto> = {}): ChapterDto => ({
  id: 'chapter_1',
  title: 'Chapter 1',
  confirmation: 'Confirmed',
  order: 0,
  topics: [makeTopicDto()],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(contentTreeService.getTree).mockResolvedValue([makeChapterDto()]);
});

describe('useCourseContentTree', () => {
  it('fetches the tree for the given courseId on mount and translates PascalCase wire values to the lowercase local shape', async () => {
    const { result } = renderHook(() => useCourseContentTree('draft_1'));

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(contentTreeService.getTree).toHaveBeenCalledWith('draft_1');

    const chapter = result.current.data[0];
    expect(chapter.confirmation).toBe('confirmed');
    const topic = chapter.topics[0];
    expect(topic.confirmation).toBe('unconfirmed');
    const subtopic = topic.subtopics[0];
    expect(subtopic.confirmation).toBe('confirmed');
    const block = subtopic.contentBlocks[0];
    expect(block.format).toBe('text');
    expect(block.confirmation).toBe('confirmed');
  });

  it('does not fetch when courseId is null', () => {
    const { result } = renderHook(() => useCourseContentTree(null));

    expect(result.current.data).toHaveLength(0);
    expect(contentTreeService.getTree).not.toHaveBeenCalled();
  });

  it('editNodeTitle calls the service and refetches the tree', async () => {
    vi.mocked(contentTreeService.editNodeTitle).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCourseContentTree('draft_1'));
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    const chapterId = result.current.data[0].id;

    await act(async () => {
      result.current.editNodeTitle(chapterId, 'Renamed Chapter');
    });

    expect(contentTreeService.editNodeTitle).toHaveBeenCalledWith('draft_1', chapterId, 'Renamed Chapter');
    await waitFor(() => expect(contentTreeService.getTree).toHaveBeenCalledTimes(2)); // mount + post-edit refetch
  });

  it('editContentBlock with only text sends a patch touching only "text"', async () => {
    vi.mocked(contentTreeService.editContentBlock).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCourseContentTree('draft_1'));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    await act(async () => {
      result.current.editContentBlock('block_1', { text: 'Updated wording.' });
    });

    expect(contentTreeService.editContentBlock).toHaveBeenCalledWith('draft_1', 'block_1', { text: 'Updated wording.' });
  });

  it('editContentBlock with notation sends a patch touching only "notation"', async () => {
    vi.mocked(contentTreeService.editContentBlock).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCourseContentTree('draft_1'));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    await act(async () => {
      result.current.editContentBlock('block_1', { notation: 'E = mc^2' });
    });

    expect(contentTreeService.editContentBlock).toHaveBeenCalledWith('draft_1', 'block_1', { notation: 'E = mc^2' });
  });

  it('editContentBlock with format sends the PascalCase wire value', async () => {
    vi.mocked(contentTreeService.editContentBlock).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCourseContentTree('draft_1'));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    await act(async () => {
      result.current.editContentBlock('block_1', { format: 'math', notation: 'v = f\\lambda' });
    });

    expect(contentTreeService.editContentBlock).toHaveBeenCalledWith('draft_1', 'block_1', { format: 'Math', notation: 'v = f\\lambda' });
  });

  it('addNode with type "contentBlock" resolves parentType "topic" when parentId is a Topic', async () => {
    vi.mocked(contentTreeService.addContentBlock).mockResolvedValue(makeBlockDto());
    const { result } = renderHook(() => useCourseContentTree('draft_1'));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    await act(async () => {
      result.current.addNode('topic_1', 'contentBlock');
    });

    expect(contentTreeService.addContentBlock).toHaveBeenCalledWith('draft_1', 'topic_1', 'topic');
  });

  it('addNode with type "contentBlock" resolves parentType "subtopic" when parentId is a Subtopic', async () => {
    vi.mocked(contentTreeService.addContentBlock).mockResolvedValue(makeBlockDto());
    const { result } = renderHook(() => useCourseContentTree('draft_1'));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    await act(async () => {
      result.current.addNode('subtopic_1', 'contentBlock');
    });

    expect(contentTreeService.addContentBlock).toHaveBeenCalledWith('draft_1', 'subtopic_1', 'subtopic');
  });

  it('addNode is a no-op when parentId does not resolve to a Topic or Subtopic in the loaded tree', async () => {
    const { result } = renderHook(() => useCourseContentTree('draft_1'));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    await act(async () => {
      result.current.addNode('does_not_exist', 'contentBlock');
    });

    expect(contentTreeService.addContentBlock).not.toHaveBeenCalled();
  });

  it('deleteNode calls the service and refetches the tree', async () => {
    vi.mocked(contentTreeService.deleteNode).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCourseContentTree('draft_1'));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    await act(async () => {
      result.current.deleteNode('topic_1');
    });

    expect(contentTreeService.deleteNode).toHaveBeenCalledWith('draft_1', 'topic_1');
  });

  it('reorderNode calls the service with the given direction', async () => {
    vi.mocked(contentTreeService.reorderNode).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCourseContentTree('draft_1'));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    await act(async () => {
      result.current.reorderNode('topic_1', 'up');
    });

    expect(contentTreeService.reorderNode).toHaveBeenCalledWith('draft_1', 'topic_1', 'up');
  });

  it('moveNode calls the service, and is a no-op when draggedId equals targetId', async () => {
    vi.mocked(contentTreeService.moveNode).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCourseContentTree('draft_1'));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    await act(async () => {
      result.current.moveNode('topic_1', 'topic_1');
    });
    expect(contentTreeService.moveNode).not.toHaveBeenCalled();

    await act(async () => {
      result.current.moveNode('topic_1', 'topic_2');
    });
    expect(contentTreeService.moveNode).toHaveBeenCalledWith('draft_1', 'topic_1', 'topic_2');
  });

  it('confirmNode calls the service and refetches the tree', async () => {
    vi.mocked(contentTreeService.confirmNode).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCourseContentTree('draft_1'));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    await act(async () => {
      result.current.confirmNode('topic_1');
    });

    expect(contentTreeService.confirmNode).toHaveBeenCalledWith('draft_1', 'topic_1');
  });

  it('addChapter calls the service and refetches the tree', async () => {
    vi.mocked(contentTreeService.addChapter).mockResolvedValue(makeChapterDto({ id: 'chapter_new' }));
    const { result } = renderHook(() => useCourseContentTree('draft_1'));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    await act(async () => {
      result.current.addChapter();
    });

    expect(contentTreeService.addChapter).toHaveBeenCalledWith('draft_1');
  });

  it('a mutation failure surfaces the server error message and does not throw', async () => {
    vi.mocked(contentTreeService.editNodeTitle).mockRejectedValue(new contentTreeService.ContentTreeError('Not found.'));
    const { result } = renderHook(() => useCourseContentTree('draft_1'));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    await act(async () => {
      result.current.editNodeTitle('topic_1', 'x');
    });

    await waitFor(() => expect(result.current.error).toBe('Not found.'));
  });

  it('resetTree clears local data and refetches when a courseId is present', async () => {
    const { result } = renderHook(() => useCourseContentTree('draft_1'));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    await act(async () => {
      result.current.resetTree();
    });

    await waitFor(() => expect(contentTreeService.getTree).toHaveBeenCalledTimes(2));
    expect(result.current.data).toHaveLength(1);
  });

  // Code-review patch regression: a slower, earlier-started fetch resolving after a faster, later
  // one must not clobber the newer state with stale data.
  it('a stale, out-of-order fetch response does not overwrite a newer one', async () => {
    let resolveMountFetch!: (dtos: ChapterDto[]) => void;
    let resolveResetFetch!: (dtos: ChapterDto[]) => void;
    const mountFetch = new Promise<ChapterDto[]>((resolve) => {
      resolveMountFetch = resolve;
    });
    const resetFetch = new Promise<ChapterDto[]>((resolve) => {
      resolveResetFetch = resolve;
    });
    vi.mocked(contentTreeService.getTree).mockReturnValueOnce(mountFetch).mockReturnValueOnce(resetFetch);

    const { result } = renderHook(() => useCourseContentTree('draft_1'));
    act(() => {
      result.current.resetTree(); // starts a second, newer fetch before the mount fetch resolves
    });

    // The newer (resetTree) fetch resolves first.
    await act(async () => {
      resolveResetFetch([makeChapterDto({ id: 'chapter_newer' })]);
    });
    await waitFor(() => expect(result.current.data[0]?.id).toBe('chapter_newer'));

    // The older (mount) fetch resolves after -- must not overwrite the newer result.
    await act(async () => {
      resolveMountFetch([makeChapterDto({ id: 'chapter_stale' })]);
    });
    expect(result.current.data[0]?.id).toBe('chapter_newer');
  });
});
