import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContentTree, type TreeMutators } from '@/src/features/CourseContentEditor/ContentTreeNode';
import type { Chapter } from '@/src/features/CourseContentEditor/useCourseContentTree';

const makeChapters = (): Chapter[] => [
  {
    id: 'chapter_1',
    title: 'Waves',
    confirmation: 'unconfirmed',
    topics: [
      {
        id: 'topic_1',
        title: 'Wave Basics',
        confirmation: 'unconfirmed',
        contentBlocks: [{ id: 'block_1', format: 'text', confirmation: 'unconfirmed', text: 'A wave carries energy.' }],
        subtopics: [
          {
            id: 'subtopic_1',
            title: 'Wave Speed',
            confirmation: 'unconfirmed',
            contentBlocks: [{ id: 'block_2', format: 'math', confirmation: 'unconfirmed', notation: 'v = f\\lambda' }],
          },
        ],
      },
    ],
  },
  {
    id: 'chapter_2',
    title: 'Optics',
    confirmation: 'confirmed',
    topics: [],
  },
];

const makeMutators = (): TreeMutators => ({
  addNode: vi.fn(),
  editNodeTitle: vi.fn(),
  editContentBlock: vi.fn(),
  deleteNode: vi.fn(),
  reorderNode: vi.fn(),
  moveNode: vi.fn(),
  confirmNode: vi.fn(),
  requestDelete: vi.fn(),
});

describe('ContentTree', () => {
  let mutators: TreeMutators;

  beforeEach(() => {
    mutators = makeMutators();
  });

  it('renders chapters, topics, subtopics, and content blocks', () => {
    render(<ContentTree chapters={makeChapters()} mutators={mutators} onAddChapter={vi.fn()} />);

    expect(screen.getByDisplayValue('Waves')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Wave Basics')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Wave Speed')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A wave carries energy.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Optics')).toBeInTheDocument();
  });

  it('calls onAddChapter when the Add Chapter button is clicked', async () => {
    const user = userEvent.setup();
    const onAddChapter = vi.fn();
    render(<ContentTree chapters={makeChapters()} mutators={mutators} onAddChapter={onAddChapter} />);

    await user.click(screen.getByRole('button', { name: 'Add Chapter' }));
    expect(onAddChapter).toHaveBeenCalled();
  });

  it('autosaves a chapter title edit on blur, not on every keystroke', async () => {
    const user = userEvent.setup();
    render(<ContentTree chapters={makeChapters()} mutators={mutators} onAddChapter={vi.fn()} />);

    const titleInput = screen.getByLabelText('Chapter 1 title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Waves & Sound');
    expect(mutators.editNodeTitle).not.toHaveBeenCalled();

    await user.tab();
    expect(mutators.editNodeTitle).toHaveBeenCalledWith('chapter_1', 'Waves & Sound');
  });

  it('confirms a node and disables the Confirm button once confirmed', async () => {
    const user = userEvent.setup();
    render(<ContentTree chapters={makeChapters()} mutators={mutators} onAddChapter={vi.fn()} />);

    // chapter_1's own Confirm button is nested inside its NodeRowShell alongside every
    // descendant's Confirm button (they share the same accessible name) -- descendants always
    // render before a row's own controls in DOM order (NodeRowShell puts `children` before its
    // own shrink-0 controls), so the *last* "Confirm" match within chapter_1's row is its own.
    const chapter1Row = screen.getByTestId('tree-node-chapter_1');
    const chapter1ConfirmButtons = within(chapter1Row).getAllByRole('button', { name: 'Confirm' });
    await user.click(chapter1ConfirmButtons[chapter1ConfirmButtons.length - 1]);
    expect(mutators.confirmNode).toHaveBeenCalledWith('chapter_1');

    // chapter_2 has no children, so its Confirm button is unambiguous -- it starts already
    // confirmed and must be disabled.
    const chapter2Row = screen.getByTestId('tree-node-chapter_2');
    expect(within(chapter2Row).getByRole('button', { name: 'Confirm' })).toBeDisabled();
  });

  it('disables move-up on the first sibling and move-down on the last, and reorders otherwise', async () => {
    const user = userEvent.setup();
    render(<ContentTree chapters={makeChapters()} mutators={mutators} onAddChapter={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Move chapter: Waves up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move chapter: Optics down' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Move chapter: Waves down' }));
    expect(mutators.reorderNode).toHaveBeenCalledWith('chapter_1', 'down');

    await user.click(screen.getByRole('button', { name: 'Move chapter: Optics up' }));
    expect(mutators.reorderNode).toHaveBeenCalledWith('chapter_2', 'up');
  });

  it('requests deletion with the node id and title rather than deleting directly', async () => {
    const user = userEvent.setup();
    render(<ContentTree chapters={makeChapters()} mutators={mutators} onAddChapter={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Delete chapter: Waves' }));
    expect(mutators.requestDelete).toHaveBeenCalledWith('chapter_1', 'Waves');
    expect(mutators.deleteNode).not.toHaveBeenCalled();
  });

  it('adds a Topic, Subtopic, or Content Block under the correct parent', async () => {
    const user = userEvent.setup();
    render(<ContentTree chapters={makeChapters()} mutators={mutators} onAddChapter={vi.fn()} />);

    // Both chapters render their own "+ Topic" header button, so scope to chapter_1's row.
    const chapter1Row = screen.getByTestId('tree-node-chapter_1');
    await user.click(within(chapter1Row).getByRole('button', { name: 'Topic' }));
    expect(mutators.addNode).toHaveBeenCalledWith('chapter_1', 'topic');

    const topic1Row = screen.getByTestId('tree-node-topic_1');
    await user.click(within(topic1Row).getByRole('button', { name: 'Subtopic' }));
    expect(mutators.addNode).toHaveBeenCalledWith('topic_1', 'subtopic');
  });

  it('collapses and re-expands a chapter, hiding and restoring its children', async () => {
    const user = userEvent.setup();
    render(<ContentTree chapters={makeChapters()} mutators={mutators} onAddChapter={vi.fn()} />);

    expect(screen.getByLabelText('Topic 1 title')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Collapse chapter: Waves' }));
    expect(screen.queryByLabelText('Topic 1 title')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Expand chapter: Waves' }));
    expect(screen.getByLabelText('Topic 1 title')).toBeInTheDocument();
  });

  it('switches a text content block to math format via the format toggle', async () => {
    const user = userEvent.setup();
    render(<ContentTree chapters={makeChapters()} mutators={mutators} onAddChapter={vi.fn()} />);

    // block_2 (a Math block, index 0 within its own subtopic) shares the same
    // "Content block 1 format" group label, so scope to block_1's own row.
    const block1Row = screen.getByTestId('tree-node-block_1');
    const group = within(block1Row).getByRole('group', { name: 'Content block 1 format' });
    const mathButton = within(group).getByRole('button', { name: 'Math' });
    await user.click(mathButton);

    expect(mutators.editContentBlock).toHaveBeenCalledWith('block_1', { format: 'math', text: '', lang: undefined });
  });

  it('renders KaTeX output for a math content block', () => {
    render(<ContentTree chapters={makeChapters()} mutators={mutators} onAddChapter={vi.fn()} />);
    expect(screen.getByTestId('rendered-notation-block_2').querySelector('.katex')).toBeInTheDocument();
  });
});
