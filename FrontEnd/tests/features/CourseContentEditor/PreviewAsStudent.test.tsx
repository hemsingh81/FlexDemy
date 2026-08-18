// Story 11.2, Task 4: page/node/course scope fetching and rendering, and resource: resolution
// through the same shared resolveResourceUrl every other renderer already uses.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PreviewAsStudent } from '@/src/features/CourseContentEditor/PreviewAsStudent';
import * as courseContentService from '@/src/services/courseContentService';
import type { ChapterDocumentDto, PageDocumentDto } from '@/src/services/courseContentService';

vi.mock('@/src/services/courseContentService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseContentService')>('@/src/services/courseContentService');
  return { ...actual, getPage: vi.fn(), getChapterDocument: vi.fn(), getChapters: vi.fn(), resolveResourceUrl: vi.fn() };
});

const makePage = (overrides: Partial<PageDocumentDto> = {}): PageDocumentDto => ({
  id: 'page_1',
  title: 'Combustion Reactions',
  bodyMarkdown: 'Fire needs oxygen.',
  isConfirmed: true,
  order: 0,
  resources: [],
  ...overrides,
});

const makeChapter = (overrides: Partial<ChapterDocumentDto> = {}): ChapterDocumentDto => ({
  id: 'chapter_1',
  courseId: 'course_1',
  title: 'Chemical Reactions',
  description: 'Chapter intro.',
  isConfirmed: true,
  topics: [],
  pages: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PreviewAsStudent', () => {
  it('page scope fetches exactly one page and renders its body', async () => {
    vi.mocked(courseContentService.getPage).mockResolvedValue(makePage());

    render(<PreviewAsStudent courseId="course_1" scope={{ kind: 'page', pageId: 'page_1' }} onClose={vi.fn()} />);

    expect(await screen.findByText('Fire needs oxygen.')).toBeInTheDocument();
    expect(courseContentService.getPage).toHaveBeenCalledWith('course_1', 'page_1');
    expect(courseContentService.getPage).toHaveBeenCalledTimes(1);
    expect(courseContentService.getChapterDocument).not.toHaveBeenCalled();
    expect(courseContentService.getChapters).not.toHaveBeenCalled();
  });

  it('node scope (a Topic) renders only its own subtree, not sibling Topics or the Chapter description', async () => {
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue(
      makeChapter({
        description: 'Chapter-level intro text.',
        topics: [
          {
            id: 'topic_1',
            title: 'Combustion',
            description: 'Combustion intro.',
            order: 0,
            isConfirmed: true,
            pages: [makePage({ id: 'page_a', title: 'Page A', bodyMarkdown: 'Body A.' })],
            subtopics: [],
          },
          {
            id: 'topic_2',
            title: 'Oxidation',
            description: 'Oxidation intro.',
            order: 1,
            isConfirmed: true,
            pages: [makePage({ id: 'page_b', title: 'Page B', bodyMarkdown: 'Body B.' })],
            subtopics: [],
          },
        ],
      })
    );

    render(
      <PreviewAsStudent
        courseId="course_1"
        scope={{ kind: 'node', chapterId: 'chapter_1', nodeType: 'Topic', nodeId: 'topic_1' }}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('Body A.')).toBeInTheDocument();
    expect(screen.queryByText('Chapter-level intro text.')).not.toBeInTheDocument();
    expect(screen.queryByText('Body B.')).not.toBeInTheDocument();
    expect(screen.queryByText('Oxidation intro.')).not.toBeInTheDocument();
  });

  it('course scope issues one getChapterDocument call per Chapter, in Chapter order, and renders all of them', async () => {
    vi.mocked(courseContentService.getChapters).mockResolvedValue([
      { id: 'chapter_1', title: 'Chapter One', order: 0 },
      { id: 'chapter_2', title: 'Chapter Two', order: 1 },
    ]);
    vi.mocked(courseContentService.getChapterDocument).mockImplementation((_courseId, chapterId) =>
      Promise.resolve(
        chapterId === 'chapter_2'
          ? makeChapter({ id: 'chapter_2', title: 'Chapter Two', description: 'Second chapter body.' })
          : makeChapter({ id: 'chapter_1', title: 'Chapter One', description: 'First chapter body.' })
      )
    );

    render(<PreviewAsStudent courseId="course_1" scope={{ kind: 'course' }} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Second chapter body.')).toBeInTheDocument());
    expect(screen.getByText('First chapter body.')).toBeInTheDocument();

    expect(courseContentService.getChapterDocument).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(courseContentService.getChapterDocument).mock.calls;
    expect(calls[0]).toEqual(['course_1', 'chapter_1']);
    expect(calls[1]).toEqual(['course_1', 'chapter_2']);
  });

  it('a resource: reference resolves to a real URL via the shared resolveResourceUrl, not left as a raw URI', async () => {
    // A paragraph whose SOLE content is one [label](resource:{id}) link promotes to a Resource
    // card (lib/markdown.ts's own parse rule, Story 9.2) -- that's the construct whose href this
    // renderer actually resolves through context; a resource: link sharing a paragraph with other
    // text stays a plain, unresolved link by the same rule.
    vi.mocked(courseContentService.getPage).mockResolvedValue(makePage({ bodyMarkdown: '[Syllabus](resource:res_1)' }));
    vi.mocked(courseContentService.resolveResourceUrl).mockResolvedValue('blob:resolved-url');

    render(<PreviewAsStudent courseId="course_1" scope={{ kind: 'page', pageId: 'page_1' }} onClose={vi.fn()} />);

    const link = await screen.findByRole('link', { name: 'Syllabus' });
    await waitFor(() => expect(link).toHaveAttribute('href', 'blob:resolved-url'));
    expect(courseContentService.resolveResourceUrl).toHaveBeenCalledWith('course_1', 'res_1');
  });

  it('shows an error state when the fetch fails, rather than a blank screen', async () => {
    vi.mocked(courseContentService.getPage).mockRejectedValue(new Error('network error'));

    render(<PreviewAsStudent courseId="course_1" scope={{ kind: 'page', pageId: 'page_1' }} onClose={vi.fn()} />);

    expect(await screen.findByText(/could not load this preview/i)).toBeInTheDocument();
  });
});
