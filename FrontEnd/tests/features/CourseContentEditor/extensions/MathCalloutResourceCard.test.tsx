// Story 9.2, Task 6: NodeView interaction tests (real Tiptap editor + RTL render, same template
// as LearningResourcesBlock.test.tsx/Image.test.tsx) plus the AD-12 syntax-parity round-trip
// tests -- Tiptap-serialize (via markdownManager) -> lib/markdown.ts-parse -> assert structural
// equality against the expected AST shape, not just "it didn't throw".
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditor, EditorContent } from '@tiptap/react';
import { Editor } from '@tiptap/core';
import { MarkdownManager } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import { MathBlock } from '@/src/features/CourseContentEditor/extensions/Math';
import { Callout } from '@/src/features/CourseContentEditor/extensions/Callout';
import { Expand } from '@/src/features/CourseContentEditor/extensions/Expand';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { ResourceCard } from '@/src/features/CourseContentEditor/extensions/ResourceCard';
import { parseMarkdown } from '@/src/lib/markdown';
import type { ResourceDto } from '@/src/services/courseContentService';

if (typeof document.elementFromPoint !== 'function') {
  document.elementFromPoint = () => null;
}
if (typeof Range.prototype.getClientRects !== 'function') {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
}
if (typeof Range.prototype.getBoundingClientRect !== 'function') {
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}

const { getResourcesByOwner, resolveResourceUrl } = vi.hoisted(() => ({
  getResourcesByOwner: vi.fn(),
  resolveResourceUrl: vi.fn(),
}));

vi.mock('@/src/services/courseContentService', () => ({ getResourcesByOwner, resolveResourceUrl }));

// Mirrors DocumentCanvas.tsx's own CONTENT_EXTENSIONS for the nodes this file round-trips. Kept
// as a local list (not imported from DocumentCanvas) so these serialization tests stay independent
// of that component's React/service imports -- but it has to gain each new node type as it lands,
// or a round-trip test silently asserts against an empty document instead of failing loudly.
const CONTENT_EXTENSIONS = [StarterKit, MathBlock, Callout, Expand, ResourceCard, TaskList, TaskItem.configure({ nested: false })];

describe('Math NodeView', () => {
  it('renders an editable LaTeX source field seeded from the node value', async () => {
    const Harness = () => {
      const editor = useEditor({
        extensions: CONTENT_EXTENSIONS,
        content: { type: 'doc', content: [{ type: 'math', attrs: { value: 'E = mc^2' } }] },
      });
      return <EditorContent editor={editor} />;
    };
    render(<Harness />);

    const textarea = await screen.findByRole('textbox', { name: 'Math source (LaTeX)' });
    expect(textarea).toHaveValue('E = mc^2');
  });

  it('typing updates the node value', async () => {
    const u = userEvent.setup();
    const Harness = () => {
      const editor = useEditor({
        extensions: CONTENT_EXTENSIONS,
        content: { type: 'doc', content: [{ type: 'math', attrs: { value: '' } }] },
      });
      return <EditorContent editor={editor} />;
    };
    render(<Harness />);

    const textarea = await screen.findByRole('textbox', { name: 'Math source (LaTeX)' });
    await u.type(textarea, 'a^2 + b^2 = c^2');

    expect(textarea).toHaveValue('a^2 + b^2 = c^2');
  });
});

describe('ResourceCard NodeView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeResource = (overrides: Partial<ResourceDto> = {}): ResourceDto => ({
    id: 'resource_1',
    label: 'Syllabus',
    caption: null,
    role: 'Attachment',
    order: 0,
    status: 'Done',
    failureReason: null,
    fileName: 'syllabus.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024,
    ...overrides,
  });

  it('shows a picker over the page\'s own attached resources when none is chosen yet', async () => {
    getResourcesByOwner.mockResolvedValue([makeResource()]);
    const Harness = () => {
      const editor = useEditor({
        extensions: [...CONTENT_EXTENSIONS, ResourceCard.configure({ courseId: 'course_1' })],
        content: { type: 'doc', content: [{ type: 'resourceCard', attrs: { resourceId: null, label: '', ownerType: 'Page', ownerId: 'page_1' } }] },
      });
      return <EditorContent editor={editor} />;
    };
    render(<Harness />);

    expect(await screen.findByRole('option', { name: 'Syllabus' })).toBeInTheDocument();
    expect(getResourcesByOwner).toHaveBeenCalledWith('course_1', 'Page', 'page_1');
  });

  it('choosing a resource from the picker sets resourceId/label and renders a download card', async () => {
    const u = userEvent.setup();
    getResourcesByOwner.mockResolvedValue([makeResource()]);
    resolveResourceUrl.mockResolvedValue('blob:resolved-url');
    const Harness = () => {
      const editor = useEditor({
        extensions: [...CONTENT_EXTENSIONS, ResourceCard.configure({ courseId: 'course_1' })],
        content: { type: 'doc', content: [{ type: 'resourceCard', attrs: { resourceId: null, label: '', ownerType: 'Page', ownerId: 'page_1' } }] },
      });
      return <EditorContent editor={editor} />;
    };
    render(<Harness />);

    await u.click(await screen.findByRole('option', { name: 'Syllabus' }));

    const link = await screen.findByRole('link', { name: /Syllabus/ });
    await waitFor(() => expect(link).toHaveAttribute('href', 'blob:resolved-url'));
  });

  it('an already-chosen resource card renders directly as a download card, no picker', async () => {
    resolveResourceUrl.mockResolvedValue('blob:resolved-url');
    const Harness = () => {
      const editor = useEditor({
        extensions: [...CONTENT_EXTENSIONS, ResourceCard.configure({ courseId: 'course_1' })],
        content: {
          type: 'doc',
          content: [{ type: 'resourceCard', attrs: { resourceId: 'resource_1', label: 'Syllabus', ownerType: 'Page', ownerId: 'page_1' } }],
        },
      });
      return <EditorContent editor={editor} />;
    };
    render(<Harness />);

    expect(await screen.findByRole('link', { name: /Syllabus/ })).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

// AD-12: syntax-level round-trip parity, not visual/pixel parity -- Tiptap-serialize (via
// markdownManager) -> lib/markdown.ts-parse -> assert structural equality against the AST shape.
describe('Syntax-parity round-trips (Story 9.2, AC #6, AD-12)', () => {
  const manager = new MarkdownManager({ extensions: CONTENT_EXTENSIONS });

  it('Math: Tiptap-serialize -> lib/markdown.ts-parse round-trips the LaTeX value intact', () => {
    const editor = new Editor({ extensions: CONTENT_EXTENSIONS, content: { type: 'doc', content: [{ type: 'math', attrs: { value: 'E = mc^2' } }] } });

    const markdown = manager.serialize(editor.getJSON());
    const reparsed = parseMarkdown(markdown);

    expect(reparsed).toEqual([{ type: 'math', value: 'E = mc^2' }]);
    editor.destroy();
  });

  it('Callout: Tiptap-serialize -> lib/markdown.ts-parse round-trips as a callout with the marker stripped', () => {
    const editor = new Editor({
      extensions: CONTENT_EXTENSIONS,
      content: { type: 'doc', content: [{ type: 'callout', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Remember to check units.' }] }] }] },
    });

    const markdown = manager.serialize(editor.getJSON());
    const reparsed = parseMarkdown(markdown);

    // A callout with no explicit variant serializes as `> [!note]` and parses back as
    // variant: 'note' -- i.e. every callout authored before panel variants existed keeps its exact
    // prior meaning, which is the compatibility guarantee the variant work rests on.
    expect(reparsed).toEqual([
      {
        type: 'callout',
        variant: 'note',
        children: [{ type: 'paragraph', content: [{ type: 'text', value: 'Remember to check units.' }] }],
      },
    ]);
    editor.destroy();
  });

  it.each(['info', 'tip', 'success', 'warning', 'error'] as const)(
    'Callout: the %s panel variant round-trips through the `> [!variant]` marker',
    (variant) => {
      const editor = new Editor({
        extensions: CONTENT_EXTENSIONS,
        content: {
          type: 'doc',
          content: [{ type: 'callout', attrs: { variant }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Panel body.' }] }] }],
        },
      });

      const markdown = manager.serialize(editor.getJSON());
      expect(markdown).toContain(`[!${variant}]`);
      expect(parseMarkdown(markdown)).toEqual([
        { type: 'callout', variant, children: [{ type: 'paragraph', content: [{ type: 'text', value: 'Panel body.' }] }] },
      ]);
      editor.destroy();
    },
  );

  it('Expand: Tiptap-serialize -> lib/markdown.ts-parse round-trips the title and body separately', () => {
    const editor = new Editor({
      extensions: CONTENT_EXTENSIONS,
      content: {
        type: 'doc',
        content: [
          {
            type: 'expand',
            attrs: { title: 'Show the full derivation' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step one follows from the law of conservation of mass.' }] }],
          },
        ],
      },
    });

    const markdown = manager.serialize(editor.getJSON());
    const reparsed = parseMarkdown(markdown);

    expect(reparsed).toEqual([
      {
        type: 'expand',
        title: 'Show the full derivation',
        children: [{ type: 'paragraph', content: [{ type: 'text', value: 'Step one follows from the law of conservation of mass.' }] }],
      },
    ]);
    editor.destroy();
  });

  it('Action items: Tiptap-serialize -> lib/markdown.ts-parse round-trips each checkbox state', () => {
    const taskItem = (text: string, checked: boolean) => ({
      type: 'taskItem',
      attrs: { checked },
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    });
    const editor = new Editor({
      extensions: CONTENT_EXTENSIONS,
      content: { type: 'doc', content: [{ type: 'taskList', content: [taskItem('Balance the equation', true), taskItem('Name the reaction type', false)] }] },
    });

    const markdown = manager.serialize(editor.getJSON());
    const reparsed = parseMarkdown(markdown);

    expect(reparsed).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [
          { content: [{ type: 'text', value: 'Balance the equation' }], children: [], checked: true },
          { content: [{ type: 'text', value: 'Name the reaction type' }], children: [], checked: false },
        ],
      },
    ]);
    editor.destroy();
  });

  it('an unrecognised `[!marker]` degrades to a plain blockquote rather than being swallowed', () => {
    // FR-28's degradation rule, asserted on the read side directly: a keyword this parser has
    // never heard of must keep its text visible, not vanish into an unrenderable block.
    const reparsed = parseMarkdown('> [!banana] Something new\n');
    expect(reparsed).toEqual([
      { type: 'blockquote', children: [{ type: 'paragraph', content: [{ type: 'text', value: '[!banana] Something new' }] }] },
    ]);
  });

  it('Resource card: Tiptap-serialize -> lib/markdown.ts-parse round-trips resourceId and label intact', () => {
    const editor = new Editor({
      extensions: CONTENT_EXTENSIONS,
      content: {
        type: 'doc',
        content: [{ type: 'resourceCard', attrs: { resourceId: 'res_abc123', label: 'Syllabus PDF', ownerType: 'Page', ownerId: 'page_1' } }],
      },
    });

    const markdown = manager.serialize(editor.getJSON());
    const reparsed = parseMarkdown(markdown);

    expect(reparsed).toEqual([{ type: 'resourceCard', resourceId: 'res_abc123', label: 'Syllabus PDF' }]);
    editor.destroy();
  });

  it('Resource card with no resourceId chosen serializes to nothing -- no stray reference persisted', () => {
    const editor = new Editor({
      extensions: CONTENT_EXTENSIONS,
      content: { type: 'doc', content: [{ type: 'resourceCard', attrs: { resourceId: null, label: '', ownerType: 'Page', ownerId: 'page_1' } }] },
    });

    const markdown = manager.serialize(editor.getJSON());

    expect(markdown.trim()).toBe('');
    editor.destroy();
  });

  // AD-12's own named boundary case, verified end-to-end through the real Tiptap serializer this
  // time (lib/markdown.test.ts already covers it via hand-written strings) -- a Math block
  // immediately followed by a Callout, and the reverse, with no blank line between.
  it('adjacency: a Math block immediately followed by a Callout serializes and re-parses as two distinct blocks', () => {
    const editor = new Editor({
      extensions: CONTENT_EXTENSIONS,
      content: {
        type: 'doc',
        content: [
          { type: 'math', attrs: { value: 'E = mc^2' } },
          { type: 'callout', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Energy-mass equivalence.' }] }] },
        ],
      },
    });

    const markdown = manager.serialize(editor.getJSON());
    const reparsed = parseMarkdown(markdown);

    expect(reparsed.map((b) => b.type)).toEqual(['math', 'callout']);
    editor.destroy();
  });

  it('adjacency: a Callout immediately followed by a Math block serializes and re-parses as two distinct blocks', () => {
    const editor = new Editor({
      extensions: CONTENT_EXTENSIONS,
      content: {
        type: 'doc',
        content: [
          { type: 'callout', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Energy-mass equivalence.' }] }] },
          { type: 'math', attrs: { value: 'E = mc^2' } },
        ],
      },
    });

    const markdown = manager.serialize(editor.getJSON());
    const reparsed = parseMarkdown(markdown);

    expect(reparsed.map((b) => b.type)).toEqual(['callout', 'math']);
    editor.destroy();
  });

  // Task 6's own promotion-boundary requirement: a resource: link sharing its paragraph with
  // other text must round-trip as an ordinary paragraph+link, never promoted to a card.
  it('promotion boundary: a paragraph mixing a resource: link with other text stays an ordinary link, not a card', () => {
    const editor = new Editor({
      extensions: CONTENT_EXTENSIONS,
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'See the ' },
              { type: 'text', text: 'Syllabus PDF', marks: [{ type: 'link', attrs: { href: 'resource:res_abc123' } }] },
              { type: 'text', text: ' for details.' },
            ],
          },
        ],
      },
    });

    const markdown = manager.serialize(editor.getJSON());
    const reparsed = parseMarkdown(markdown);

    expect(reparsed[0].type).toBe('paragraph');
    if (reparsed[0].type !== 'paragraph') return;
    const linkNode = reparsed[0].content.find((n) => n.type === 'link');
    expect(linkNode).toMatchObject({ type: 'link', href: 'resource:res_abc123' });
    editor.destroy();
  });
});
