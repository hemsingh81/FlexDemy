// Headless Tiptap Editor tests (no React render, no simulated keystrokes) -- the schema/logic
// concerns here (Description-zone enforcement, doc-building, position-aware menu filtering) are
// pure ProseMirror-state questions, and Story 7.1's own precedent (useContentDocument.test.ts,
// CourseContentEditor.test.tsx's "flaky userEvent.type() into an empty ProseMirror heading" note)
// is to test this kind of logic directly rather than through jsdom's incomplete
// selection/coordinate simulation of a real contenteditable region.
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { MarkdownManager } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import { StructuralHeading } from '@/src/features/CourseContentEditor/extensions/StructuralHeading';
import { DescriptionZone } from '@/src/features/CourseContentEditor/extensions/DescriptionZone';
import { RawBlock } from '@/src/features/CourseContentEditor/extensions/RawBlock';
import {
  isNestedUnderTopic,
  isInsidePageBody,
  getNearestPersistedOwner,
  buildDocJSON,
  buildDeleteMessage,
} from '@/src/features/CourseContentEditor/DocumentCanvas';
import type { ChapterDocumentDto } from '@/src/services/courseContentService';

const CONTENT_EXTENSIONS = [
  StarterKit.configure({ heading: false }),
  StructuralHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
  DescriptionZone,
  RawBlock,
];

const makeEditor = (content: unknown) => new Editor({ extensions: CONTENT_EXTENSIONS, content });

describe('DescriptionZone schema (Story 7.2, Task 2)', () => {
  it('accepts paragraph and bulletList content', () => {
    const editor = makeEditor({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 } },
        { type: 'descriptionZone', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A description.' }] }] },
      ],
    });

    expect(editor.getJSON().content?.[1]?.type).toBe('descriptionZone');
    editor.destroy();
  });

  it('rejects a node type outside (paragraph|bulletList)+ -- schema-level, not UI-only', () => {
    const editor = makeEditor({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 } },
        { type: 'descriptionZone', content: [{ type: 'paragraph' }] },
      ],
    });

    // descriptionZone's content expression is `(paragraph|bulletList)+` -- codeBlock is neither,
    // so ProseMirror's own schema.nodes.descriptionZone.contentMatch must reject it as a valid
    // child, proving the restriction lives in the schema itself and not a UI-level filter.
    const descriptionZoneType = editor.schema.nodes.descriptionZone;
    const codeBlockType = editor.schema.nodes.codeBlock;
    expect(descriptionZoneType.contentMatch.matchType(codeBlockType)).toBeNull();
    expect(descriptionZoneType.contentMatch.matchType(editor.schema.nodes.paragraph)).not.toBeNull();
    expect(descriptionZoneType.contentMatch.matchType(editor.schema.nodes.bulletList)).not.toBeNull();

    editor.destroy();
  });
});

describe('isNestedUnderTopic (Story 7.2, Task 2 -- Sub-Topic menu filtering)', () => {
  it('is false right after the Chapter title (h1), before any Topic exists', () => {
    const editor = makeEditor({ type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Chapter' }] }] });
    editor.commands.setTextSelection(editor.state.doc.content.size);

    expect(isNestedUnderTopic(editor)).toBe(false);
    editor.destroy();
  });

  it('is true once the cursor sits inside a Topic (h2) section', () => {
    const editor = makeEditor({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Chapter' }] },
        { type: 'heading', attrs: { level: 2, entityId: 'topic_1' }, content: [{ type: 'text', text: 'A Topic' }] },
        { type: 'descriptionZone', content: [{ type: 'paragraph' }] },
      ],
    });
    editor.commands.setTextSelection(editor.state.doc.content.size);

    expect(isNestedUnderTopic(editor)).toBe(true);
    editor.destroy();
  });

  it('is true inside an existing Sub-Topic section too -- a second Sub-Topic can follow the first', () => {
    const editor = makeEditor({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Chapter' }] },
        { type: 'heading', attrs: { level: 2, entityId: 'topic_1' }, content: [{ type: 'text', text: 'A Topic' }] },
        { type: 'descriptionZone', content: [{ type: 'paragraph' }] },
        { type: 'heading', attrs: { level: 3, entityId: 'subtopic_1' }, content: [{ type: 'text', text: 'A Sub-Topic' }] },
        { type: 'descriptionZone', content: [{ type: 'paragraph' }] },
      ],
    });
    editor.commands.setTextSelection(editor.state.doc.content.size);

    expect(isNestedUnderTopic(editor)).toBe(true);
    editor.destroy();
  });
});

describe('buildDocJSON (Story 7.2, AC #7 -- reopening shows the same document)', () => {
  const document: ChapterDocumentDto = {
    id: 'chapter_1',
    courseId: 'course_1',
    title: 'Chemical Reactions',
    description: '',
    isConfirmed: false,
    topics: [
      {
        id: 'topic_1',
        title: 'Combustion',
        description: 'Burning things.',
        order: 0,
        isConfirmed: false,
        subtopics: [{ id: 'subtopic_1', title: 'Fire triangle', description: '', order: 0, isConfirmed: false, pages: [] }],
        pages: [],
      },
    ],
    pages: [],
  };

  it('rebuilds the h1/h2/h3 structure with entityId attrs carried onto Topic/Sub-Topic headings', () => {
    const json = buildDocJSON(document, document.title);
    const editor = makeEditor(json);

    const headings: { level: number; entityId: string | null; text: string }[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading') headings.push({ level: node.attrs.level, entityId: node.attrs.entityId, text: node.textContent });
      return true;
    });

    expect(headings).toEqual([
      { level: 1, entityId: null, text: 'Chemical Reactions' },
      { level: 2, entityId: 'topic_1', text: 'Combustion' },
      { level: 3, entityId: 'subtopic_1', text: 'Fire triangle' },
    ]);
    editor.destroy();
  });

  it('handles a null document (brand-new Chapter) with only the title heading', () => {
    const json = buildDocJSON(null, 'New Chapter');
    expect(json.content).toHaveLength(1);
    expect(json.content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 1 } });
  });

  it('rebuilds a Page marker (h4) with its body parsed from bodyMarkdown, attached to a Chapter, a Topic, and a Subtopic', () => {
    const withPages: ChapterDocumentDto = {
      ...document,
      pages: [{ id: 'page_chapter', title: 'Chapter Page', bodyMarkdown: 'Chapter-level content.', isConfirmed: false, order: 0 }],
      topics: [
        {
          ...document.topics[0],
          pages: [{ id: 'page_topic', title: 'Topic Page', bodyMarkdown: '- one\n- two', isConfirmed: true, order: 0 }],
          subtopics: [
            {
              ...document.topics[0].subtopics[0],
              pages: [{ id: 'page_subtopic', title: 'Subtopic Page', bodyMarkdown: '', isConfirmed: false, order: 0 }],
            },
          ],
        },
      ],
    };

    const json = buildDocJSON(withPages, withPages.title);
    const editor = makeEditor(json);

    const pageHeadings: { entityId: string; isConfirmed: boolean; text: string }[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading' && node.attrs.level === 4) {
        pageHeadings.push({ entityId: node.attrs.entityId, isConfirmed: node.attrs.isConfirmed, text: node.textContent });
      }
      return true;
    });

    expect(pageHeadings).toEqual([
      { entityId: 'page_chapter', isConfirmed: false, text: 'Chapter Page' },
      { entityId: 'page_topic', isConfirmed: true, text: 'Topic Page' },
      { entityId: 'page_subtopic', isConfirmed: false, text: 'Subtopic Page' },
    ]);

    // The Topic Page's body markdown ("- one\n- two") round-trips into a real bulletList node,
    // not literal text -- proves buildDocJSON actually parses bodyMarkdown, not just stores it.
    let sawBulletList = false;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'bulletList') sawBulletList = true;
      return true;
    });
    expect(sawBulletList).toBe(true);

    editor.destroy();
  });
});

describe('isInsidePageBody / getNearestPersistedOwner (Story 7.3, Task 3/5)', () => {
  it('is false at the Chapter title and inside a Description zone', () => {
    const editor = makeEditor({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 } },
        { type: 'heading', attrs: { level: 2, entityId: 'topic_1' } },
        { type: 'descriptionZone', content: [{ type: 'paragraph' }] },
      ],
    });
    editor.commands.setTextSelection(editor.state.doc.content.size);

    expect(isInsidePageBody(editor)).toBe(false);
    editor.destroy();
  });

  it('is true once inside a Page (h4) body, including inside an existing Sub-heading section', () => {
    const editor = makeEditor({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 } },
        { type: 'heading', attrs: { level: 4, entityId: 'page_1' } },
        { type: 'paragraph' },
        { type: 'heading', attrs: { level: 5 } },
      ],
    });
    editor.commands.setTextSelection(editor.state.doc.content.size);

    expect(isInsidePageBody(editor)).toBe(true);
    editor.destroy();
  });

  it('getNearestPersistedOwner requires the nearest Topic/Sub-Topic heading to already carry an entityId', () => {
    const unsavedTopic = makeEditor({
      type: 'doc',
      content: [{ type: 'heading', attrs: { level: 1 } }, { type: 'heading', attrs: { level: 2, entityId: null } }],
    });
    unsavedTopic.commands.setTextSelection(unsavedTopic.state.doc.content.size);
    expect(getNearestPersistedOwner(unsavedTopic)).toBeNull();
    unsavedTopic.destroy();

    const savedTopic = makeEditor({
      type: 'doc',
      content: [{ type: 'heading', attrs: { level: 1 } }, { type: 'heading', attrs: { level: 2, entityId: 'topic_1' } }],
    });
    savedTopic.commands.setTextSelection(savedTopic.state.doc.content.size);
    expect(getNearestPersistedOwner(savedTopic)).toEqual({ ownerType: 'Topic', ownerId: 'topic_1' });
    savedTopic.destroy();

    const savedSubtopic = makeEditor({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 } },
        { type: 'heading', attrs: { level: 2, entityId: 'topic_1' } },
        { type: 'heading', attrs: { level: 3, entityId: 'subtopic_1' } },
      ],
    });
    savedSubtopic.commands.setTextSelection(savedSubtopic.state.doc.content.size);
    expect(getNearestPersistedOwner(savedSubtopic)).toEqual({ ownerType: 'Subtopic', ownerId: 'subtopic_1' });
    savedSubtopic.destroy();
  });

  it('is null when the cursor is not nested under any Topic/Sub-Topic at all', () => {
    const editor = makeEditor({ type: 'doc', content: [{ type: 'heading', attrs: { level: 1 } }] });
    editor.commands.setTextSelection(editor.state.doc.content.size);

    expect(getNearestPersistedOwner(editor)).toBeNull();
    editor.destroy();
  });
});

describe('RawBlock (Story 7.3, Task 6 -- AC #6)', () => {
  it('serializes back the exact original stored string, byte-for-byte', () => {
    const manager = new MarkdownManager({ extensions: CONTENT_EXTENSIONS });
    const original = '<div class="weird">unsupported <b>html</b> block</div>';

    const serialized = manager.serialize([{ type: 'rawBlock', attrs: { content: original } }]);

    expect(serialized).toBe(original);
  });

  it('round-trips a multi-line raw string with blank lines and special Markdown characters verbatim', () => {
    const manager = new MarkdownManager({ extensions: CONTENT_EXTENSIONS });
    const original = 'Line one\n\n> not actually a quote\n\n| a | b |\n|---|---|';

    const serialized = manager.serialize([{ type: 'rawBlock', attrs: { content: original } }]);

    expect(serialized).toBe(original);
  });
});

describe('buildDeleteMessage (Story 7.2, Task 4)', () => {
  it('only mentions non-zero kinds -- pages/resources stay 0 until Stories 7.3/8.1', () => {
    expect(buildDeleteMessage('topic', { topics: 0, subtopics: 3, pages: 0, pageResources: 0, nodeResources: 0 })).toBe(
      "Delete this topic and 3 sub-topics? This can't be undone."
    );
  });

  it('falls back to a bare confirmation when every count is zero', () => {
    expect(buildDeleteMessage('subtopic', { topics: 0, subtopics: 0, pages: 0, pageResources: 0, nodeResources: 0 })).toBe(
      "Delete this sub-topic? This can't be undone."
    );
  });

  it('singularizes a count of exactly 1', () => {
    expect(buildDeleteMessage('topic', { topics: 0, subtopics: 1, pages: 0, pageResources: 0, nodeResources: 0 })).toBe(
      "Delete this topic and 1 sub-topic? This can't be undone."
    );
  });
});
