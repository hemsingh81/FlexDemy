import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { SlashCommandExtension } from '@/src/lib/editor/SlashCommandExtension';
import { PlusAffordanceButton } from '@/src/lib/editor/PlusAffordanceButton';
import type { SlashCommandItem } from '@/src/lib/editor/slashMenuTypes';

// jsdom doesn't implement elementFromPoint at all -- ProseMirror's own mousedown handler
// (posAtCoords) calls it unconditionally on click, which throws rather than degrading. This
// codebase's only prior Tiptap consumer is this story itself, so no existing polyfill precedent
// exists yet; scoped to this file rather than the shared vitest.setup.ts since it's specific to
// tests that click into a real ProseMirror-backed editable region.
if (typeof document.elementFromPoint !== 'function') {
  document.elementFromPoint = () => null;
}
if (typeof Range.prototype.getClientRects !== 'function') {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
}
if (typeof Range.prototype.getBoundingClientRect !== 'function') {
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}

const makeCommands = (): SlashCommandItem[] => [
  {
    id: 'paragraph',
    category: 'Basic',
    label: 'Paragraph',
    description: 'Start writing plain text',
    execute: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('paragraph').run();
    },
  },
  {
    id: 'code',
    category: 'Basic',
    label: 'Code',
    description: 'A fenced code block',
    execute: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('codeBlock').run();
    },
  },
];

const Harness: React.FC<{ items?: SlashCommandItem[] }> = ({ items = makeCommands() }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      SlashCommandExtension.configure({
        getItems: ({ query }) =>
          items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase())),
      }),
    ],
    content: '<p></p>',
    autofocus: 'start',
  });
  return (
    <>
      <EditorContent editor={editor} />
      <PlusAffordanceButton editor={editor} />
    </>
  );
};

describe('SlashCommandExtension', () => {
  it('opens a listbox on "/" and lists the configured commands', async () => {
    const u = userEvent.setup();
    render(<Harness />);

    await u.click(document.querySelector('.ProseMirror')!);
    await u.type(document.querySelector('.ProseMirror')!, '/');

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /paragraph/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /code/i })).toBeInTheDocument();
  });

  it('filters options as the query narrows, and shows "No matching blocks" for a zero-match query', async () => {
    const u = userEvent.setup();
    render(<Harness />);

    await u.type(document.querySelector('.ProseMirror')!, '/cod');

    await waitFor(() => expect(screen.getByRole('option', { name: /code/i })).toBeInTheDocument());
    expect(screen.queryByRole('option', { name: /^paragraph$/i })).not.toBeInTheDocument();

    await u.type(document.querySelector('.ProseMirror')!, 'zzz');
    await waitFor(() => expect(screen.getByText('No matching blocks')).toBeInTheDocument());
  });

  it('Enter commits the highlighted option, moves focus into the new block, and announces it', async () => {
    const u = userEvent.setup();
    render(<Harness />);

    await u.type(document.querySelector('.ProseMirror')!, '/paragraph{Enter}');

    // The listbox closes on commit.
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    // aria-live announcement fires (SlashCommandExtension's shared announcer region).
    await waitFor(() => expect(document.body.textContent).toContain('Paragraph inserted'));
  });

  it('Escape closes without inserting and strips the typed "/"+query', async () => {
    const u = userEvent.setup();
    render(<Harness />);
    const editable = document.querySelector('.ProseMirror')!;

    await u.type(editable, '/para');
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());

    await u.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(editable.textContent).toBe('');
  });

  it('Tab does not act as menu navigation -- it exits the suggestion without inserting', async () => {
    const u = userEvent.setup();
    render(<Harness />);
    const editable = document.querySelector('.ProseMirror')!;

    await u.type(editable, '/para');
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());

    await u.keyboard('{Tab}');

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });

  it('ArrowDown/ArrowUp move the highlighted option, reflected via aria-selected', async () => {
    const u = userEvent.setup();
    render(<Harness />);
    const editable = document.querySelector('.ProseMirror')!;

    await u.type(editable, '/');
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());

    const paragraphOption = screen.getByRole('option', { name: /paragraph/i });
    const codeOption = screen.getByRole('option', { name: /code/i });
    expect(paragraphOption).toHaveAttribute('aria-selected', 'true');

    await u.keyboard('{ArrowDown}');
    expect(codeOption).toHaveAttribute('aria-selected', 'true');
    expect(paragraphOption).toHaveAttribute('aria-selected', 'false');

    await u.keyboard('{ArrowUp}');
    expect(paragraphOption).toHaveAttribute('aria-selected', 'true');
  });

  it('clicking the "+" affordance on an empty line opens the identical menu, without typing "/"', async () => {
    const u = userEvent.setup();
    render(<Harness />);

    const plusButton = await screen.findByRole('button', { name: 'Insert block' });
    await u.click(plusButton);

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /paragraph/i })).toBeInTheDocument();
  });

  // Exercised directly against SlashMenuList's imperative handle (not through a full
  // editor+Suggestion round-trip): a real IME candidate-window Enter is native browser behavior
  // jsdom doesn't reproduce faithfully, and routing a synthetic isComposing keydown through
  // ProseMirror's own keymap conflates this handler's own no-op with StarterKit's unrelated
  // default Enter handling (which still runs when this handler declines the event). This is the
  // one place testing the mechanism in isolation is more reliable than testing it end-to-end.
  it('SlashMenuList.onKeyDown no-ops (returns false) while IME composition is in progress', async () => {
    const onSelect = vi.fn();
    const items = makeCommands();
    const ref = React.createRef<import('@/src/lib/editor/SlashMenuList').SlashMenuListHandle>();
    const { SlashMenuList } = await import('@/src/lib/editor/SlashMenuList');
    render(<SlashMenuList ref={ref} items={items} query="" onSelect={onSelect} onHighlightChange={vi.fn()} />);

    const composingEnter = new KeyboardEvent('keydown', { key: 'Enter' });
    Object.defineProperty(composingEnter, 'isComposing', { value: true });

    const handled = ref.current!.onKeyDown(composingEnter);

    expect(handled).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

// Regression suite for the arrow-key traversal order. The bug: the menu renders items GROUPED by
// category, but every selection path indexed into the flat `items` array as supplied. When the two
// orders disagree -- which they do for the real command list, where a "Structure" command sits at
// array index 1 but renders several rows further down -- one ArrowDown from the top jumped the
// highlight to a visually distant row, and Enter then inserted a block the tutor never picked.
//
// INTERLEAVED ON PURPOSE: the array below alternates categories so that flat order and grouped
// order cannot coincide. A fixture already grouped by category would pass either way and prove
// nothing.
const interleavedCommands = (): SlashCommandItem[] => [
  { id: 'a1', category: 'Alpha', label: 'Alpha One', description: 'a', execute: () => {} },
  { id: 'b1', category: 'Beta', label: 'Beta One', description: 'b', execute: () => {} },
  { id: 'a2', category: 'Alpha', label: 'Alpha Two', description: 'a', execute: () => {} },
  { id: 'b2', category: 'Beta', label: 'Beta Two', description: 'b', execute: () => {} },
];
// Grouped render order is therefore: Alpha One, Alpha Two, Beta One, Beta Two.

describe('SlashMenuList traversal order', () => {
  const openMenu = async (u: ReturnType<typeof userEvent.setup>) => {
    render(<Harness items={interleavedCommands()} />);
    await waitFor(() => expect(document.querySelector('.ProseMirror')).toBeInTheDocument());
    await u.type(document.querySelector('.ProseMirror')!, '/');
    return screen.findByRole('listbox');
  };

  it('renders options grouped by category, not in the order supplied', async () => {
    const u = userEvent.setup();
    const menu = await openMenu(u);
    const labels = within(menu)
      .getAllByRole('option')
      .map((option) => option.textContent?.split('a')[0] ?? '');
    // Sanity: the fixture really is interleaved, so DOM order differs from array order.
    expect(within(menu).getAllByRole('option').map((o) => o.getAttribute('id'))).toEqual([
      'slash-menu-option-a1',
      'slash-menu-option-a2',
      'slash-menu-option-b1',
      'slash-menu-option-b2',
    ]);
    expect(labels.length).toBe(4);
  });

  it('ArrowDown moves the highlight to the next VISIBLE row, not the next array entry', async () => {
    const u = userEvent.setup();
    const menu = await openMenu(u);
    const options = within(menu).getAllByRole('option');

    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    await u.keyboard('{ArrowDown}');

    // The second rendered row is "Alpha Two" (id a2). Before the fix this selected `items[1]`,
    // which is "Beta One" -- the THIRD rendered row.
    await waitFor(() => expect(within(menu).getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true'));
    expect(within(menu).getAllByRole('option')[1]).toHaveAttribute('id', 'slash-menu-option-a2');
    expect(within(menu).getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'false');
  });

  it('Enter commits the visually-highlighted option, not the same-indexed array entry', async () => {
    const u = userEvent.setup();
    const items = interleavedCommands();
    const executed: string[] = [];
    const spied = items.map((item) => ({ ...item, execute: () => executed.push(item.id) }));

    render(<Harness items={spied} />);
    await waitFor(() => expect(document.querySelector('.ProseMirror')).toBeInTheDocument());
    await u.type(document.querySelector('.ProseMirror')!, '/');
    await screen.findByRole('listbox');

    await u.keyboard('{ArrowDown}');
    await u.keyboard('{Enter}');

    // "Alpha Two" is the row below the top one. The pre-fix behaviour committed 'b1'.
    expect(executed).toEqual(['a2']);
  });

  it('wraps from the last visible row back to the first', async () => {
    const u = userEvent.setup();
    const menu = await openMenu(u);

    for (let i = 0; i < 4; i += 1) await u.keyboard('{ArrowDown}');

    await waitFor(() => expect(within(menu).getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true'));
  });
});
