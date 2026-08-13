import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReviewAsStudentPreview } from '@/src/features/CourseContentEditor/ReviewAsStudentPreview';
import type { Chapter } from '@/src/features/CourseContentEditor/useCourseContentTree';

// Code-review patch (Blind-Hunter/Acceptance-Auditor finding, Story 3.9): the story's own
// centerpiece new UI -- the literal site of AD-3's sanctioned cross-feature import -- shipped
// with zero direct test coverage. This file closes that gap: it asserts the preview actually
// renders the tree, that selecting a node renders the real ContentNodeReadingPane (imported from
// CoursePlayer, not duplicated), and that Open Drill-Down opens the real DrilldownPanel.
const makeChapters = (): Chapter[] => [
  {
    id: 'chapter_1',
    title: 'Chapter 1: Waves & Chemistry',
    confirmation: 'confirmed',
    topics: [
      {
        id: 'topic_1',
        title: 'Topic 1: Wave Motion',
        confirmation: 'confirmed',
        contentBlocks: [{ id: 'block_x1', format: 'text', confirmation: 'confirmed', text: 'A wave carries energy.' }],
        subtopics: [
          {
            id: 'subtopic_1',
            title: 'Subtopic 1: Introduction',
            confirmation: 'confirmed',
            contentBlocks: [{ id: 'block_x2', format: 'text', confirmation: 'confirmed', text: 'Intro text.' }],
          },
        ],
      },
    ],
  },
];

describe('ReviewAsStudentPreview', () => {
  it('renders the chapter/topic/subtopic tree as sidebar navigation', () => {
    render(<ReviewAsStudentPreview courseId="course_1" chapters={makeChapters()} onClose={vi.fn()} />);

    expect(screen.getByText('Chapter 1: Waves & Chemistry')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Topic 1: Wave Motion' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subtopic 1: Introduction' })).toBeInTheDocument();
  });

  it('shows a placeholder prompt until a node is selected', () => {
    render(<ReviewAsStudentPreview courseId="course_1" chapters={makeChapters()} onClose={vi.fn()} />);

    expect(screen.getByText(/select a topic or subtopic/i)).toBeInTheDocument();
  });

  it('selecting a topic renders the real ContentNodeReadingPane (title + Open Drill-Down)', () => {
    render(<ReviewAsStudentPreview courseId="course_1" chapters={makeChapters()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Topic 1: Wave Motion' }));

    expect(screen.getByRole('heading', { name: 'Topic 1: Wave Motion' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Drill-Down/i })).toBeInTheDocument();
    expect(screen.getByText('A wave carries energy.')).toBeInTheDocument();
  });

  it('selecting a subtopic renders its own content blocks, not the parent topic\'s', () => {
    render(<ReviewAsStudentPreview courseId="course_1" chapters={makeChapters()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Subtopic 1: Introduction' }));

    expect(screen.getByRole('heading', { name: 'Subtopic 1: Introduction' })).toBeInTheDocument();
    expect(screen.getByText('Intro text.')).toBeInTheDocument();
    expect(screen.queryByText('A wave carries energy.')).not.toBeInTheDocument();
  });

  it('Open Drill-Down opens the real DrilldownPanel for the selected node', async () => {
    render(<ReviewAsStudentPreview courseId="course_1" chapters={makeChapters()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Topic 1: Wave Motion' }));
    fireEvent.click(screen.getByRole('button', { name: /Open Drill-Down/i }));

    // DrilldownPanel.tsx's own stable heading -- confirms the real component (not a duplicate)
    // actually mounted, imported directly from features/CoursePlayer per AD-3.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Drill-Down' })).toBeInTheDocument());
  });

  it('closing DrilldownPanel returns to the reading pane without closing the whole preview', async () => {
    const onClose = vi.fn();
    render(<ReviewAsStudentPreview courseId="course_1" chapters={makeChapters()} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Topic 1: Wave Motion' }));
    fireEvent.click(screen.getByRole('button', { name: /Open Drill-Down/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Drill-Down' })).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Close panel'));

    expect(screen.queryByRole('heading', { name: 'Drill-Down' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Topic 1: Wave Motion' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('the X button calls onClose', () => {
    const onClose = vi.fn();
    render(<ReviewAsStudentPreview courseId="course_1" chapters={makeChapters()} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Exit Review as Student'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
