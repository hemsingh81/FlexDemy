// Story 11.4, Task 4: renders bodyMarkdown via MarkdownViewer; a resource: reference resolves
// through the shared resolveResourceUrl; loading/failed states, never a blank pane.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PageReadingPane } from '@/src/features/CoursePlayer/PageReadingPane';
import * as courseContentService from '@/src/services/courseContentService';
import type { PageDocumentDto } from '@/src/services/courseContentService';

vi.mock('@/src/services/courseContentService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseContentService')>('@/src/services/courseContentService');
  return { ...actual, resolveResourceUrl: vi.fn() };
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
});

describe('PageReadingPane', () => {
  it('renders the Page title and its bodyMarkdown via MarkdownViewer', () => {
    render(<PageReadingPane courseId="course_1" page={makePage({ bodyMarkdown: '## Heading\n\nSome paragraph text.' })} isLoading={false} failed={false} />);

    expect(screen.getByText('Lecture Notes')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Heading' })).toBeInTheDocument();
    expect(screen.getByText('Some paragraph text.')).toBeInTheDocument();
  });

  it('a resource: reference resolves to a real URL via the shared resolveResourceUrl', async () => {
    vi.mocked(courseContentService.resolveResourceUrl).mockResolvedValue('blob:resolved-url');
    render(<PageReadingPane courseId="course_1" page={makePage({ bodyMarkdown: '[Syllabus](resource:res_1)' })} isLoading={false} failed={false} />);

    const link = await screen.findByRole('link', { name: 'Syllabus' });
    await waitFor(() => expect(link).toHaveAttribute('href', 'blob:resolved-url'));
    expect(courseContentService.resolveResourceUrl).toHaveBeenCalledWith('course_1', 'res_1');
  });

  it('shows a loading state, not a blank pane, while the page is loading', () => {
    render(<PageReadingPane courseId="course_1" page={null} isLoading failed={false} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows a friendly failed state, not a blank pane, when the fetch failed', () => {
    render(<PageReadingPane courseId="course_1" page={null} isLoading={false} failed />);

    expect(screen.getByText(/could not load this page/i)).toBeInTheDocument();
  });
});
