// Story 7.1/7.2/7.3: the Tiptap-based document canvas (AD-9). Story 7.1 built the Chapter-title
// h1 and the slash-menu mechanism proof. Story 7.2 added Topic (h2) / Sub-Topic (h3) structural
// headings and their Description-zone schema constraint. This story adds the Page marker (h4),
// its basic body blocks (paragraph/sub-heading/lists/code), the raw-block fallback, and the
// Preview/Markdown toggle -- the full FR-26 command set beyond these basics is 8.1/9.x.
import React, { useEffect, useRef, useState } from 'react';
import type { Editor, JSONContent } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown, MarkdownManager } from '@tiptap/markdown';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
// TaskList/TaskItem ship inside @tiptap/extension-list, already a transitive dependency of
// StarterKit -- no new package. Both carry their own renderMarkdown/parseMarkdown (GFM
// `- [ ]`/`- [x]`), which lib/markdown.ts now parses on the read side too.
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { SlashCommandExtension } from '../../lib/editor/SlashCommandExtension';
import { PlusAffordanceButton } from '../../lib/editor/PlusAffordanceButton';
import type { SlashCommandItem } from '../../lib/editor/slashMenuTypes';
import { StructuralHeading } from './extensions/StructuralHeading';
import { DescriptionZone } from './extensions/DescriptionZone';
import { RawBlock } from './extensions/RawBlock';
import { LearningResourcesBlock } from './extensions/LearningResourcesBlock';
import { PageImage } from './extensions/Image';
import { MathBlock } from './extensions/Math';
import { Callout, CALLOUT_VARIANTS, type CalloutVariant } from './extensions/Callout';
import { Expand } from './extensions/Expand';
import { ResourceCard } from './extensions/ResourceCard';
import { resolveInheritedResources } from './resolveInheritedResources';
import { HeadingControls, collectHeadings, type HeadingEntry } from './HeadingControls';
import { BodyBlockControls } from './BodyBlockControls';
import { TableControls } from './TableControls';
import { TableOfContentsRail } from './TableOfContentsRail';
import { PagePreviewPanel, type PagePreviewMode } from './PagePreviewPanel';
import { ConfirmationGlyphs } from './ConfirmationGlyphs';
import { useContentAutosave } from './useContentAutosave';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { InsertFromFilePicker } from './InsertFromFilePicker';
import type { FileUploadEntry } from './useFileUpload';
import type { PreviewScope } from './PreviewAsStudent';
import { useCourseContent } from '../../context/CourseContentContext';
import { useToast } from '../../context/ToastContext';
import type { ContentOwnerType } from '../../types';
import {
  createTopic,
  updateTopic,
  getTopicDeleteImpact,
  deleteTopic,
  reorderTopic,
  createSubtopic,
  updateSubtopic,
  getSubtopicDeleteImpact,
  deleteSubtopic,
  reorderSubtopic,
  createPage,
  updatePage,
  getPageDeleteImpact,
  deletePage,
  reorderPage,
  movePage,
  resolveResourceUrl,
  type ChapterDocumentDto,
  type PageDocumentDto,
  type ResourceDto,
} from '../../services/courseContentService';

interface DocumentCanvasProps {
  courseId: string;
  chapterId: string | null;
  title: string;
  document: ChapterDocumentDto | null;
  isReadOnly: boolean;
  onTitleBlur: (title: string) => void;
  onReload: () => Promise<void>;
  onAnnounce: (message: string) => void;
  onAddChapter: () => void;
  // Story 10.1: the same `Done`-filtered file list CourseContentEditor.tsx's own `doneFiles`
  // variable already computes (useFileUpload.ts) -- threaded straight through rather than
  // recomputed here, so "Insert from file" always sees the exact set of files a tutor could
  // already open for review in the Uploaded Files section.
  doneFiles: FileUploadEntry[];
  // Story 10.2: notifies the parent's useFileUpload state the instant an "Insert from file" attach
  // succeeds, so its own hasAttachedResources flag (the delete-confirmation warning's own accuracy)
  // doesn't stay stale until the next poll/reload.
  onFileAttached: (fileId: string) => void;
  // Story 11.1, Task 2 (AC #1): the id of a Chapter/Topic/Sub-Topic/Page a blocker link in
  // PublishLifecycleBar (a sibling under CourseContentEditor.tsx) was just activated for -- set
  // regardless of whether that node lives on the Chapter already open here (this component doesn't
  // know or care; it just looks for the id in its own current document and focuses it if found).
  pendingFocusNodeId: string | null;
  // Fired once the focus-move above actually happens, so the parent clears pendingFocusNodeId --
  // never fired if the id isn't found in this document yet (e.g. a cross-Chapter blocker whose
  // target Chapter hasn't finished loading), leaving it pending for a later render to retry.
  onFocusHandled: () => void;
  // Story 11.2 (AC #1): "Preview as student" at node (Topic/Sub-Topic) or page scope, from a
  // heading's own HeadingControls row -- opens CourseContentEditor.tsx's own PreviewAsStudent
  // overlay, which this component doesn't render itself (it needs no Tiptap editor at all).
  onPreviewAsStudent: (scope: PreviewScope) => void;
  /** Hands this canvas's autosave flush up to the parent, so a preview launched from OUTSIDE the
   * canvas (the header's whole-course "Preview as student") can await the same save the in-canvas
   * previews do. Without it that button reads server state that may be a debounce-interval stale. */
  onRegisterFlush?: (flush: () => Promise<void>) => void;
}

// Story 7.1's "Basic" command list, still minimal beyond Paragraph -- Story 7.3's own additions
// (Sub-heading, Bulleted/Numbered list, Code) are gated to a Page body (pageBodyCommands below),
// not offered here unconditionally.
const BASIC_COMMANDS: SlashCommandItem[] = [
  {
    id: 'paragraph',
    category: 'Basic',
    label: 'Paragraph',
    description: 'Start writing plain text',
    execute: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('paragraph').run();
    },
  },
];

// The full content schema, shared verbatim between the live editor (useEditor below) and the
// standalone MarkdownManager (markdownManager below) used to parse/serialize a Page's body
// outside of any live editor instance (buildDocJSON needs this before an editor exists at all).
// Story 9.2: Math/Callout carry no configure()-time options, so a single shared instance works
// identically for both markdownManager and the live editor -- unlike Image/ResourceCard below,
// which each need a courseId-configured instance for their own NodeView, so those two are
// deliberately left OUT of this shared array (see the comment above markdownManager).
const CONTENT_EXTENSIONS = [
  StarterKit.configure({ heading: false }),
  StructuralHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
  DescriptionZone,
  RawBlock,
  MathBlock,
  Callout,
  Expand,
  // resizable: column widths are draggable via ProseMirror's own columnResizing plugin. The
  // resulting colwidth attrs are editor-only chrome -- Markdown has no column-width concept, so
  // serialization is unaffected and the standalone markdownManager sharing this array is fine.
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  TaskList,
  // nested: false -- a task list inside a task item is a shape lib/markdown.ts's own list parser
  // handles (it nests by indent like any other list), but it has no place in course content and
  // it makes the `- [ ]` round-trip meaningfully harder to reason about. Flat only.
  TaskItem.configure({ nested: false }),
];

// Story 9.1/9.2: markdownManager gets the plain stock Image and the unconfigured ResourceCard
// (default courseId: '') -- neither's NodeView is ever mounted here (markdownManager never
// creates a live editor.view/DOM at all, only calls .serialize()/.parse() on JSON), so an
// unconfigured courseId is harmless. The live editor below uses PageImage/ResourceCard.configure
// ({courseId}) instead -- two separate Editor/MarkdownManager instances, each with its own
// schema, so registering the same node names in both is not a conflict. Verified directly (both
// for Image, Story 9.1, and for Table here) that each stock/custom node's default markdown
// serialization needs no customization beyond what each extension's own renderMarkdown provides.
const markdownManager = new MarkdownManager({ extensions: [...CONTENT_EXTENSIONS, Image, ResourceCard] });

// One slash command per Confluence panel variant, generated from the variant list rather than
// hand-written six times -- adding a seventh variant is then a one-word change in Callout.ts, and
// the menu can never drift out of sync with what the node/parser actually accept.
//
// Menu order follows CALLOUT_VARIANTS (note, info, tip, success, warning, error) -- roughly
// neutral-to-severe, which is also how Confluence's own panel picker is ordered.
const CALLOUT_PANEL_LABELS: Record<CalloutVariant, { label: string; description: string }> = {
  note: { label: 'Note panel', description: 'A neutral aside worth remembering' },
  info: { label: 'Info panel', description: 'Background or context' },
  tip: { label: 'Tip panel', description: 'A shortcut or piece of advice' },
  success: { label: 'Success panel', description: 'A correct result or good practice' },
  warning: { label: 'Warning panel', description: 'A common mistake or caution' },
  error: { label: 'Error panel', description: 'Something that is wrong or must be avoided' },
};

const CALLOUT_PANEL_COMMANDS: SlashCommandItem[] = CALLOUT_VARIANTS.map((variant) => ({
  id: `callout-${variant}`,
  category: 'Media & data',
  label: CALLOUT_PANEL_LABELS[variant].label,
  description: CALLOUT_PANEL_LABELS[variant].description,
  execute: ({ editor, range }) =>
    prepareBlockTarget(editor, range)
      .insertContent({ type: 'callout', attrs: { variant }, content: [{ type: 'paragraph' }] })
      .run(),
}));

// Deletes the slash-command range and guarantees the caret is somewhere a CONTENT block can
// actually go, returning a chain ready for the command's own operation.
//
// THE BUG THIS FIXES: "Bulleted list", "Numbered list" and "Code" silently did nothing whenever
// the caret sat in a structural heading -- which, since content commands became available outside
// Page bodies, is most of the time (the Chapter title, a Topic/Sub-Topic heading, a Page marker).
// `toggleBulletList` wraps the current block in `bulletList > listItem`, and listItem's content
// expression is `paragraph block*` -- a heading is not a legal first child, so ProseMirror
// rejected the transform and returned false. No error, no insert: the typed "/bulleted" just
// vanished. Same root cause for the other list and for code.
//
// The naive fix -- setNode('paragraph') before toggling -- is WRONG here and would be worse than
// the bug: h1-h4 are not decorative headings, they ARE the Chapter/Topic/Sub-Topic/Page structure
// (StructuralHeading, carrying the entityId that ties the node to its backend row). Converting one
// to a paragraph would silently destroy a Topic and orphan everything under it.
//
// So: on a structural heading (h1-h4), insert a fresh paragraph AFTER the heading and move the
// caret into it -- the new block lands below the title, which is where a tutor typing "/" on a
// title line means it to go. On an ordinary paragraph or an in-page h5/h6, convert in place, which
// is the Notion/Confluence behaviour for a normal line.
const STRUCTURAL_HEADING_MAX_LEVEL = 4;

export const prepareBlockTarget = (editor: Editor, range: { from: number; to: number }) => {
  editor.chain().focus().deleteRange(range).run();

  const { $from } = editor.state.selection;
  const parent = $from.parent;
  const isStructuralHeading = parent.type.name === 'heading' && ((parent.attrs.level as number) ?? 1) <= STRUCTURAL_HEADING_MAX_LEVEL;

  if (isStructuralHeading) {
    const after = $from.after();
    // +1 lands the caret INSIDE the new paragraph rather than at the document position before it.
    editor.chain().insertContentAt(after, { type: 'paragraph' }).setTextSelection(after + 1).run();
  }

  return editor.chain().focus();
};

const insertStructuralHeading = (editor: Editor, range: { from: number; to: number }, level: 2 | 3) => {
  editor.chain().focus().deleteRange(range).setNode('heading', { level }).run();
  const after = editor.state.selection.$from.after();
  editor.chain().insertContentAt(after, { type: 'descriptionZone', content: [{ type: 'paragraph' }] }).run();
};

interface NearestHeadingInfo {
  level: number;
  entityId: string | null;
}

// Finds the nearest heading strictly before the cursor -- the single primitive every
// position-aware slash-menu filter in this file is built from.
//
// PERFORMANCE, and why the shape below matters: this is called several times per keystroke while
// the slash menu is open (isInsidePageBody, isNestedUnderTopic, getNearestPersistedPage,
// getNearestPersistedOwner each ask for it independently, and filterCommands re-runs all of them
// on every character typed). The previous implementation used doc.descendants with an early
// `return false` -- but `false` from a descendants callback only skips that node's CHILDREN, it
// does not stop the traversal, so every call walked the ENTIRE chapter document regardless of
// where the cursor was. On a chapter with a few hundred nodes that is several full walks per
// keystroke, which is exactly the "slash menu takes a moment to appear" lag.
//
// Two changes: nodesBetween(0, cursorPos) bounds the walk to the document actually before the
// cursor, and a one-entry memo keyed on the editor's current doc+selection collapses the several
// calls within a single keystroke down to one real walk.
let nearestHeadingMemo: { doc: unknown; pos: number; result: NearestHeadingInfo | null } | null = null;

const findNearestHeadingBefore = (editor: Editor): NearestHeadingInfo | null => {
  const { doc, selection } = editor.state;
  const cursorPos = selection.$from.pos;
  // Identity comparison on the ProseMirror doc node is safe and cheap: every edit produces a NEW
  // doc object (PM documents are persistent/immutable), so a hit here means genuinely nothing has
  // changed since the last call, not merely that the content looks equal.
  if (nearestHeadingMemo && nearestHeadingMemo.doc === doc && nearestHeadingMemo.pos === cursorPos) {
    return nearestHeadingMemo.result;
  }

  let nearest: NearestHeadingInfo | null = null;
  doc.nodesBetween(0, cursorPos, (node, pos) => {
    if (pos >= cursorPos) return false;
    if (node.type.name === 'heading') nearest = { level: node.attrs.level, entityId: node.attrs.entityId ?? null };
    return true;
  });

  nearestHeadingMemo = { doc, pos: cursorPos, result: nearest };
  return nearest;
};

// AD-10's Description-zone schema constraint means "Sub-Topic heading" has no valid insertion
// point unless the cursor is currently inside a Topic's section -- filtered out of the menu
// entirely rather than offered and rejected. Level 2 or 3 both count as "inside a Topic's
// section" (a Sub-Topic heading itself still counts, since a second Sub-Topic can follow the
// first one under the same Topic).
export const isNestedUnderTopic = (editor: Editor): boolean => {
  const nearest = findNearestHeadingBefore(editor);
  return nearest?.level === 2 || nearest?.level === 3;
};

// True when the cursor sits inside a Topic/Sub-Topic Description zone, whose schema is restricted
// to `(paragraph|bulletList)+` by DescriptionZone.ts (FR-4, enforced by ProseMirror itself). Every
// richer block is filtered out of the menu here rather than offered and then silently dropped on
// insert -- the schema would reject it either way; this just makes the menu honest about it.
export const isInsideDescriptionZone = (editor: Editor): boolean => {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'descriptionZone') return true;
  }
  return false;
};

// Story 7.3: "Sub-heading" (h5/h6) and the other page-body-only commands are only reachable once
// inside a Page's body (level 4) or an existing sub-heading section within it (level 5/6) --
// never from a Description zone (level 2/3) or the Chapter title itself.
export const isInsidePageBody = (editor: Editor): boolean => {
  const nearest = findNearestHeadingBefore(editor);
  return nearest !== null && nearest.level >= 4;
};

// Story 7.3, Task 5 (AD-11): "New Page" needs a real, already-persisted Topic/Sub-Topic to attach
// to at the moment it's inserted (its create-call fires synchronously, unlike Topic/Sub-Topic's
// own lazy blur-based creation) -- so unlike isNestedUnderTopic above, this also requires the
// nearest heading to already carry a server-assigned entityId.
export const getNearestPersistedOwner = (editor: Editor): { ownerType: ContentOwnerType; ownerId: string } | null => {
  const nearest = findNearestHeadingBefore(editor);
  if (!nearest?.entityId) return null;
  if (nearest.level === 2) return { ownerType: 'Topic', ownerId: nearest.entityId };
  if (nearest.level === 3) return { ownerType: 'Subtopic', ownerId: nearest.entityId };
  return null;
};

// Story 8.1, Task 6: the "Learning Resources" command needs a real, already-persisted Page to
// attach to (a Resource's OwnerId must be a real Page id), same AD-11 reasoning
// getNearestPersistedOwner above already applies to Topic/Sub-Topic.
// Resolves the nearest persisted node that can OWN a resource, at any level of the document.
//
// Why this exists alongside getNearestPersistedPage: image/file insertion used to be gated on
// `getNearestPersistedPage`, i.e. offered only once the cursor was inside a saved Page. That made
// "insert an image" unavailable in the majority of the document -- under the Chapter title, in a
// Topic's opening prose, anywhere a Page had not been created yet -- with no explanation, since a
// command that is filtered out of the menu simply is not there to ask about.
//
// A resource only needs SOME persisted owner, and Chapter/Topic/Sub-Topic are all valid owners in
// the resource model (ContentOwnerType). So: walk to the nearest persisted heading and use it,
// falling back to the Chapter itself, which exists as soon as the editor has anything to show.
// The stricter Page-only resolver is still used for the Learning Resources block, which is
// deliberately a per-Page shelf.
export const getNearestResourceOwner = (
  editor: Editor,
  chapterId: string | null
): { ownerType: ContentOwnerType; ownerId: string } | null => {
  const nearest = findNearestHeadingBefore(editor);
  if (nearest?.entityId) {
    if (nearest.level === 4) return { ownerType: 'Page', ownerId: nearest.entityId };
    if (nearest.level === 3) return { ownerType: 'Subtopic', ownerId: nearest.entityId };
    if (nearest.level === 2) return { ownerType: 'Topic', ownerId: nearest.entityId };
  }
  // Level 1 (the Chapter title) carries no entityId in the document JSON -- the chapter's own id
  // is held by the component, so it is passed in rather than read off the node.
  return chapterId ? { ownerType: 'Chapter', ownerId: chapterId } : null;
};

export const getNearestPersistedPage = (editor: Editor): { ownerType: ContentOwnerType; ownerId: string } | null => {
  const nearest = findNearestHeadingBefore(editor);
  if (nearest?.level === 4 && nearest.entityId) return { ownerType: 'Page', ownerId: nearest.entityId };
  return null;
};

// Story 8.2, Task 2: the node-level counterpart -- "Learning Resources" offered directly on a
// Chapter/Topic/Sub-Topic heading's own document position (level 1/2/3), not just inside a Page
// body. Level 1 (Chapter) needs the Chapter itself already saved (chapterId, a component prop,
// not a heading attr); level 2/3 reuse the same already-persisted-entityId requirement as every
// other AD-11 structural command in this file.
export const getNearestPersistedNodeOwner = (
  editor: Editor,
  chapterId: string | null
): { ownerType: ContentOwnerType; ownerId: string } | null => {
  const nearest = findNearestHeadingBefore(editor);
  if (nearest?.level === 1 && chapterId) return { ownerType: 'Chapter', ownerId: chapterId };
  if (nearest?.level === 2 && nearest.entityId) return { ownerType: 'Topic', ownerId: nearest.entityId };
  if (nearest?.level === 3 && nearest.entityId) return { ownerType: 'Subtopic', ownerId: nearest.entityId };
  return null;
};

// Story 8.2, Task 2: at most one Learning Resources block per heading -- omit the slash-menu
// command entirely once a block already exists at that (ownerType, ownerId) position, rather than
// allowing two node-level blocks to coexist unreconciled.
const hasResourcesBlockAt = (editor: Editor, ownerType: ContentOwnerType, ownerId: string): boolean => {
  let found = false;
  editor.state.doc.descendants((node) => {
    if (found) return false;
    if (node.type.name === 'learningResourcesBlock' && node.attrs.ownerType === ownerType && node.attrs.ownerId === ownerId) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
};

const extractHeadingText = (node: JSONContent): string =>
  (node.content ?? []).map((child) => child.text ?? '').join('');

const findServerTitle = (document: ChapterDocumentDto | null, kind: 'topic' | 'subtopic', id: string): string | undefined => {
  if (!document) return undefined;
  if (kind === 'topic') return document.topics.find((t) => t.id === id)?.title;
  for (const topic of document.topics) {
    const subtopic = topic.subtopics.find((s) => s.id === id);
    if (subtopic) return subtopic.title;
  }
  return undefined;
};

const findServerPage = (document: ChapterDocumentDto | null, id: string): PageDocumentDto | undefined => {
  if (!document) return undefined;
  const inChapter = document.pages.find((p) => p.id === id);
  if (inChapter) return inChapter;
  for (const topic of document.topics) {
    const inTopic = topic.pages.find((p) => p.id === id);
    if (inTopic) return inTopic;
    for (const subtopic of topic.subtopics) {
      const inSubtopic = subtopic.pages.find((p) => p.id === id);
      if (inSubtopic) return inSubtopic;
    }
  }
  return undefined;
};

// Story 8.1/8.2: a Learning Resources block is reconstructed at doc-build time from an owner's
// own `resources` array plus its downward-inherited ancestor resources (resolveInheritedResources)
// -- never parsed out of Markdown (see LearningResourcesBlock.ts's own header comment for why).
// Renders whenever there's anything to show at all, own or inherited -- AC #2 requires an
// inherited resource to actually appear on a descendant page's own block even if that page has
// never had a resource of its own and never had the block explicitly inserted there.
const buildResourcesBlockJSON = (
  document: ChapterDocumentDto | null,
  ownerType: ContentOwnerType,
  ownerId: string,
  resources: ResourceDto[]
): JSONContent[] => {
  const inherited = document ? resolveInheritedResources(document, ownerType, ownerId) : [];
  if (resources.length === 0 && inherited.length === 0) return [];
  return [{ type: 'learningResourcesBlock', attrs: { ownerType, ownerId, resources, inherited } }];
};

// Story 9.2: reconciles markdownManager.parse()'s output with this editor's own richer schema.
// markdownManager itself has no custom parse hook for `> [!note]`/`[label](resource:{id})` (only
// Callout/ResourceCard's own `renderMarkdown` -- the serialize direction -- are wired; see
// Math.ts's header comment for why the parse direction is a documented, RawBlock-precedented gap
// for Math specifically). Standard CommonMark parsing alone already produces a `blockquote`
// (StarterKit) and a `paragraph` containing a `link`-marked text run (StarterKit's own Link
// extension) for this same source text -- this function walks that JSON tree afterward and
// promotes the two cases lib/markdown.ts's own parser (Task 1) applies the identical rule for:
// a blockquote whose first line starts with `[!note]` becomes a `callout` (marker stripped); a
// paragraph whose SOLE content is one `resource:`-hrefed link becomes a `resourceCard`. Without
// this, a page reload would silently degrade every previously-inserted Callout/Resource card back
// into a plain blockquote/link -- this is what makes AC #2/#4's "rendered as a card" hold across
// a reload, not just at insertion time.
const reconcileCustomBlocks = (nodes: JSONContent[], ownerType: ContentOwnerType, ownerId: string): JSONContent[] =>
  nodes.map((node) => {
    if (node.type === 'blockquote' && node.content) {
      const firstChild = node.content[0];
      const firstText = firstChild?.type === 'paragraph' ? firstChild.content?.[0] : undefined;
      const marker = firstText?.type === 'text' && typeof firstText.text === 'string' ? /^\[!note\]\s?/i.exec(firstText.text) : null;
      if (marker && firstText && firstChild) {
        const strippedFirstChild: JSONContent = {
          ...firstChild,
          content: [{ ...firstText, text: firstText.text!.slice(marker[0].length) }, ...(firstChild.content?.slice(1) ?? [])],
        };
        return { type: 'callout', content: reconcileCustomBlocks([strippedFirstChild, ...node.content.slice(1)], ownerType, ownerId) };
      }
      return { ...node, content: reconcileCustomBlocks(node.content, ownerType, ownerId) };
    }

    if (node.type === 'paragraph' && node.content?.length === 1) {
      const only = node.content[0];
      const linkMark = only.marks?.find((m) => m.type === 'link');
      const href = linkMark?.attrs?.href as string | undefined;
      if (only.type === 'text' && href?.startsWith('resource:')) {
        return {
          type: 'resourceCard',
          attrs: { resourceId: href.slice('resource:'.length), label: only.text ?? '', ownerType, ownerId },
        };
      }
    }

    return node;
  });

// Story 7.3: a Page marker (h4) followed by its body, parsed from bodyMarkdown via the standalone
// markdownManager (no live editor needed at doc-build time).
// Story 8.1: a Page's Learning Resources block is appended after its parsed body -- it's never
// part of bodyMarkdown, so it's reconstructed here directly from the page's own `resources` array
// instead of being parsed out of the Markdown string. Always at the end of the page's body --
// position isn't preserved across a reload, a documented, deliberate simplification.
const buildPageJSON = (page: PageDocumentDto, document: ChapterDocumentDto | null): JSONContent[] => {
  const heading: JSONContent = {
    type: 'heading',
    attrs: { level: 4, entityId: page.id, isConfirmed: page.isConfirmed },
    content: page.title ? [{ type: 'text', text: page.title }] : undefined,
  };
  const parsed = page.bodyMarkdown.trim().length > 0 ? (markdownManager.parse(page.bodyMarkdown).content ?? []) : [];
  const bodyNodes = reconcileCustomBlocks(parsed, 'Page', page.id);
  return [heading, ...bodyNodes, ...buildResourcesBlockJSON(document, 'Page', page.id, page.resources ?? [])];
};

export const buildDocJSON = (document: ChapterDocumentDto | null, fallbackTitle: string): JSONContent => {
  const content: JSONContent[] = [
    { type: 'heading', attrs: { level: 1 }, content: fallbackTitle ? [{ type: 'text', text: fallbackTitle }] : undefined },
  ];
  if (document) content.push(...buildResourcesBlockJSON(document, 'Chapter', document.id, document.resources ?? []));
  for (const page of document?.pages ?? []) content.push(...buildPageJSON(page, document));
  for (const topic of document?.topics ?? []) {
    content.push({ type: 'heading', attrs: { level: 2, entityId: topic.id }, content: topic.title ? [{ type: 'text', text: topic.title }] : undefined });
    content.push({ type: 'descriptionZone', content: [{ type: 'paragraph', content: topic.description ? [{ type: 'text', text: topic.description }] : undefined }] });
    if (document) content.push(...buildResourcesBlockJSON(document, 'Topic', topic.id, topic.resources ?? []));
    for (const page of topic.pages) content.push(...buildPageJSON(page, document));
    for (const subtopic of topic.subtopics) {
      content.push({ type: 'heading', attrs: { level: 3, entityId: subtopic.id }, content: subtopic.title ? [{ type: 'text', text: subtopic.title }] : undefined });
      content.push({ type: 'descriptionZone', content: [{ type: 'paragraph', content: subtopic.description ? [{ type: 'text', text: subtopic.description }] : undefined }] });
      if (document) content.push(...buildResourcesBlockJSON(document, 'Subtopic', subtopic.id, subtopic.resources ?? []));
      for (const page of subtopic.pages) content.push(...buildPageJSON(page, document));
    }
  }
  return { type: 'doc', content };
};

// Story 7.2, Task 4: only mentions kinds with a non-zero count -- Chapter/Topic delete-impacts
// can report non-zero pages as of this story; Page's own delete-impact is always all-zero (no
// children of its own until Story 8.1's Resources).
export const buildDeleteMessage = (
  kind: 'topic' | 'subtopic' | 'page',
  impact: { topics: number; subtopics: number; pages: number; pageResources: number; nodeResources: number }
): string => {
  const noun = kind === 'topic' ? 'topic' : kind === 'subtopic' ? 'sub-topic' : 'page';
  const parts: string[] = [];
  if (impact.subtopics > 0) parts.push(`${impact.subtopics} sub-topic${impact.subtopics === 1 ? '' : 's'}`);
  if (impact.pages > 0) parts.push(`${impact.pages} page${impact.pages === 1 ? '' : 's'}`);
  if (impact.pageResources > 0) parts.push(`${impact.pageResources} page resource${impact.pageResources === 1 ? '' : 's'}`);
  if (impact.nodeResources > 0) parts.push(`${impact.nodeResources} node resource${impact.nodeResources === 1 ? '' : 's'}`);
  return parts.length > 0 ? `Delete this ${noun} and ${parts.join(', ')}? This can't be undone.` : `Delete this ${noun}? This can't be undone.`;
};

// Finds the first h1 node in the document and returns its text content -- the Chapter title is
// always the document's sole h1.
const getChapterTitleText = (editor: Editor): string => {
  let text = '';
  editor.state.doc.descendants((node) => {
    if (text === '' && node.type.name === 'heading' && node.attrs.level === 1) {
      text = node.textContent;
      return false;
    }
    return true;
  });
  return text;
};

export const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  courseId,
  chapterId,
  title,
  document,
  isReadOnly,
  onTitleBlur,
  onReload,
  onAnnounce,
  onAddChapter,
  doneFiles,
  onFileAttached,
  pendingFocusNodeId,
  onFocusHandled,
  onPreviewAsStudent,
  onRegisterFlush,
}) => {
  const courseContent = useCourseContent();
  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<{ entry: HeadingEntry; message: string } | null>(null);
  const [panelTarget, setPanelTarget] = useState<{ entry: HeadingEntry; mode: PagePreviewMode; bodyMarkdown: string; top: number } | null>(null);
  // Story 7.3, Task 7 (FR-8): "Move page to…" -- a picker over the document's own Topic/Sub-Topic
  // outline (satisfies FR-8's "drag or 'Move page to…'" wording via the picker half; drag-onto-
  // the-rail was the other acceptable mechanism and wasn't built, see Completion Notes).
  const [moveTarget, setMoveTarget] = useState<{ entry: HeadingEntry; top: number } | null>(null);
  // Story 10.1, Task 2: "Insert from file" opens this picker instead of inserting immediately --
  // `pos` is the cursor position (after the "/" trigger text is already deleted) the eventual
  // Insert click parses content into, same deferred-commit shape as moveTarget/panelTarget above.
  const [insertFileTarget, setInsertFileTarget] = useState<{
    pos: number;
    top: number;
    pageOwner: { ownerType: ContentOwnerType; ownerId: string };
  } | null>(null);

  // Read via a ref inside the onBlur closure so it always sees the latest props without forcing
  // useEditor to recreate the whole Tiptap instance (which would drop cursor position/undo
  // history) every time chapterId/document/title change from an unrelated reload.
  const latestRef = useRef({ courseId, chapterId, title, document, onTitleBlur, onReload });
  useEffect(() => {
    latestRef.current = { courseId, chapterId, title, document, onTitleBlur, onReload };
  });

  // SlashCommandExtension's `getItems` closure is fixed at editor-creation time (useEditor only
  // ever calls its options factory once) -- indirecting through a ref, updated every render, lets
  // the command list stay fresh (courseId/chapterId for "New Page"'s immediate create-call)
  // without recreating the whole Tiptap instance.
  const filterCommandsRef = useRef<(query: string, editor: Editor) => SlashCommandItem[]>(() => []);
  filterCommandsRef.current = (query, editor) => {
    const items = [...BASIC_COMMANDS, ...structureCommands(editor), ...pageBodyCommands(editor)];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => item.label.toLowerCase().includes(normalized) || item.description.toLowerCase().includes(normalized));
  };

  const structureCommands = (editor: Editor): SlashCommandItem[] => {
    const items: SlashCommandItem[] = [
      {
        id: 'topic-heading',
        category: 'Structure',
        label: 'Topic heading',
        description: 'Insert a new topic, no minimum count required',
        execute: ({ editor: e, range }) => insertStructuralHeading(e, range, 2),
      },
    ];
    if (isNestedUnderTopic(editor)) {
      items.push({
        id: 'subtopic-heading',
        category: 'Structure',
        label: 'Sub-Topic heading',
        description: 'Insert a new sub-topic nested under this topic',
        execute: ({ editor: e, range }) => insertStructuralHeading(e, range, 3),
      });
    }
    const owner = getNearestPersistedOwner(editor);
    if (owner) {
      items.push({
        id: 'new-page',
        category: 'Structure',
        label: 'New Page',
        description: 'Insert a page with its own content',
        execute: ({ editor: e, range }) => {
          e.chain().focus().deleteRange(range).setNode('heading', { level: 4, isCreating: true }).run();
          const pos = e.state.selection.$from.before();
          const { courseId: cid } = latestRef.current;
          createPage(cid, owner.ownerType, owner.ownerId, 'Untitled Page')
            .then((created) => {
              e.chain()
                .command(({ tr }) => {
                  tr.setNodeAttribute(pos, 'entityId', created.id);
                  tr.setNodeAttribute(pos, 'isCreating', false);
                  return true;
                })
                .run();
            })
            .catch(() => {
              // Code-review patch: this used to fail completely silently -- leaves isCreating:true
              // visible either way (a dedicated retry affordance is still out of this story's
              // scope), but now at least tells the tutor the page wasn't actually created, instead
              // of leaving a permanently-stuck "Creating…" heading with no explanation.
              showToast({ message: 'Could not create the new page. Please try again.', variant: 'error' });
            });
        },
      });
    }
    // Story 8.2, Task 2: "Learning Resources" also offered directly on a Chapter/Topic/Sub-Topic
    // heading's own position -- the identical LearningResourcesBlock component Story 8.1 built,
    // instantiated at a different document position, never a separate node-specific component.
    const nodeOwner = getNearestPersistedNodeOwner(editor, chapterId);
    if (nodeOwner && !hasResourcesBlockAt(editor, nodeOwner.ownerType, nodeOwner.ownerId)) {
      items.push({
        id: 'learning-resources-node',
        category: 'Resources',
        label: 'Learning Resources',
        description: `Attach files as resources on this ${nodeOwner.ownerType.toLowerCase()}`,
        execute: ({ editor: e, range }) => {
          const { document: doc } = latestRef.current;
          const inherited = doc ? resolveInheritedResources(doc, nodeOwner.ownerType, nodeOwner.ownerId) : [];
          e.chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: 'learningResourcesBlock',
              attrs: { ownerType: nodeOwner.ownerType, ownerId: nodeOwner.ownerId, resources: [], inherited },
            })
            .run();
        },
      });
    }
    return items;
  };

  // Renamed in spirit if not in name: these are the GENERIC content blocks, and they are offered
  // anywhere the schema can actually hold them -- not only inside a Page body, which is where they
  // were originally gated when Page was the only place content existed.
  //
  // Why that gate was wrong for a Confluence-style editor: a tutor typing "/" anywhere outside a
  // Page body (at the Chapter title, between Topics, in the chapter intro area) got a menu
  // containing nothing but "Paragraph" plus a couple of structure commands, and typing "/table" or
  // "/warning" there produced a literal "No matching blocks" box. The menu looked broken because
  // effectively it was: the blocks a tutor wanted were filtered out by position rather than by
  // whether they could legally be inserted.
  //
  // The one place that genuinely cannot hold them is a Description zone, whose schema really does
  // reject anything but paragraphs and bullet lists -- so THAT is the guard now, and it is a
  // statement about the schema rather than about document structure. Resource-bound blocks (Image,
  // Resource card, Learning Resources, Insert from file) keep their own, stricter gate further
  // down: they need a persisted Page to own the resource, which getNearestPersistedPage supplies
  // or refuses independently of this check.
  const pageBodyCommands = (editor: Editor): SlashCommandItem[] => {
    if (isInsideDescriptionZone(editor)) return [];
    const items: SlashCommandItem[] = [
      {
        id: 'subheading',
        category: 'Basic',
        label: 'Sub-heading',
        description: 'A minor heading inside this page',
        execute: ({ editor: e, range }) => prepareBlockTarget(e, range).setNode('heading', { level: 5 }).run(),
      },
      {
        id: 'bulleted-list',
        category: 'Basic',
        label: 'Bulleted list',
        description: 'Create a simple bulleted list',
        execute: ({ editor: e, range }) => prepareBlockTarget(e, range).toggleBulletList().run(),
      },
      {
        id: 'numbered-list',
        category: 'Basic',
        label: 'Numbered list',
        description: 'Create a numbered list',
        execute: ({ editor: e, range }) => prepareBlockTarget(e, range).toggleOrderedList().run(),
      },
      {
        id: 'code-block',
        category: 'Basic',
        label: 'Code',
        description: 'A code block with an optional language',
        execute: ({ editor: e, range }) => prepareBlockTarget(e, range).toggleCodeBlock().run(),
      },
      // Story 9.2, Task 3/AC #1: block-level `$$…$$` math, rendered live via KaTeX.
      {
        id: 'math',
        category: 'Media & data',
        label: 'Math',
        description: 'Mathematical notation, rendered via KaTeX',
        execute: ({ editor: e, range }) => prepareBlockTarget(e, range).insertContent({ type: 'math', attrs: { value: '' } }).run(),
      },
      // Story 9.2, Task 3/AC #2: a blockquote-based styled card, degrading to a plain blockquote
      // anywhere unsupported. Now one command per Confluence panel variant rather than a single
      // generic "Callout" -- a tutor picks the meaning ("Warning") from the menu instead of
      // inserting a neutral box and then hunting for a variant control. All six share one node
      // type and one Markdown marker family; only the `variant` attribute differs.
      ...CALLOUT_PANEL_COMMANDS,
      // Confluence's Expand macro -- the collapsible section. Seeded with a placeholder title so
      // the summary line is never blank before the tutor types one (a blank <summary> renders as
      // an unlabelled twisty a student cannot interpret).
      {
        id: 'expand',
        category: 'Media & data',
        label: 'Expand',
        description: 'A collapsible section a student opens on demand',
        execute: ({ editor: e, range }) =>
          prepareBlockTarget(e, range).insertContent({ type: 'expand', attrs: { title: 'Details' }, content: [{ type: 'paragraph' }] }).run(),
      },
      {
        id: 'task-list',
        category: 'Basic',
        label: 'Action items',
        description: 'A checklist of tasks',
        execute: ({ editor: e, range }) => prepareBlockTarget(e, range).toggleTaskList().run(),
      },
      {
        id: 'blockquote',
        category: 'Basic',
        label: 'Quote',
        description: 'Set text apart as a quotation',
        execute: ({ editor: e, range }) => prepareBlockTarget(e, range).toggleBlockquote().run(),
      },
      {
        id: 'divider',
        category: 'Basic',
        label: 'Divider',
        description: 'A horizontal rule between sections',
        execute: ({ editor: e, range }) => prepareBlockTarget(e, range).setHorizontalRule().run(),
      },
      // Story 9.2, Task 4/AC #3: a minimal default grid -- serialization round-trips through
      // lib/markdown.ts's existing table support with no changes needed there (verified directly).
      {
        id: 'table',
        category: 'Media & data',
        label: 'Table',
        description: 'A simple data table',
        execute: ({ editor: e, range }) => prepareBlockTarget(e, range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      },
    ];
    // Story 8.1, Task 6: "Learning Resources" only offered once the nearest Page marker is
    // already persisted (AD-11 -- same reasoning as "New Page" above requiring a real owner id).
    // Story 8.2: also omitted once a block already exists at this Page's own position.
    // Image and Resource card are offered at ANY level of the document, not only inside a saved
    // Page: both only need some persisted owner for the uploaded file to belong to, and
    // getNearestResourceOwner supplies the nearest one (Page / Sub-Topic / Topic, else the Chapter
    // itself). Previously both sat inside the `pageOwner` branch below, so "insert an image" was
    // simply absent from the menu anywhere a Page had not been created yet -- which is most of a
    // chapter while it is being written.
    const resourceOwner = getNearestResourceOwner(editor, latestRef.current.chapterId);
    if (resourceOwner) {
      // Story 9.1, Task 1: inserts an empty Image node -- the tutor uploads/drags a file into it
      // via its own NodeView (Upload/drag-drop controls), which reuses uploadResource outright
      // (the resulting Resource simultaneously shows up in this page's Learning Resources block
      // with role: Inline, and is referenced inline via the `![alt](resource:{id})` this node
      // serializes to -- one upload, two views of the same Resource row).
      items.push({
        id: 'image',
        category: 'Media & data',
        label: 'Image',
        description: 'Insert an image with alt text',
        execute: ({ editor: e, range }) => {
          e.chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: 'image',
              attrs: { src: '', alt: '', ownerType: resourceOwner.ownerType, ownerId: resourceOwner.ownerId },
            })
            .run();
        },
      });
      // Story 9.2, Task 3/AC #4: references a resource already attached to *this page's* own
      // Learning Resources block (its own NodeView offers the picker) -- never an arbitrary
      // course-wide resource.
      items.push({
        id: 'resource-card',
        category: 'Media & data',
        label: 'Resource card',
        description: 'Link to a file attached at this point in the document',
        execute: ({ editor: e, range }) => {
          e.chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: 'resourceCard',
              attrs: { resourceId: null, label: '', ownerType: resourceOwner.ownerType, ownerId: resourceOwner.ownerId },
            })
            .run();
        },
      });
    }

    const pageOwner = getNearestPersistedPage(editor);
    if (pageOwner && !hasResourcesBlockAt(editor, pageOwner.ownerType, pageOwner.ownerId)) {
      items.push({
        id: 'learning-resources',
        category: 'Resources',
        label: 'Learning Resources',
        description: 'Attach files as resources on this page',
        execute: ({ editor: e, range }) => {
          const { document: doc } = latestRef.current;
          const inherited = doc ? resolveInheritedResources(doc, pageOwner.ownerType, pageOwner.ownerId) : [];
          e.chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: 'learningResourcesBlock',
              attrs: { ownerType: pageOwner.ownerType, ownerId: pageOwner.ownerId, resources: [], inherited },
            })
            .run();
        },
      });
      // Story 10.1, Task 2/AC #1: "Structure" grouping per EXPERIENCE.md's own UJ-2 narration
      // ("she types '/' and picks Insert from file (Structure group)") -- it inserts multi-block
      // structural content, same grouping rationale as Topic/Sub-Topic heading and New Page above,
      // not a single resource attachment like the "Media & data"/"Resources" items around it.
      // Gated on at least one Done, parsed file existing (AC #1's explicit precondition) -- reuses
      // the exact same `doneFiles` prop CourseContentEditor.tsx's own `doneFiles` variable computes,
      // never recomputed independently here.
      if (doneFiles.length > 0) {
        items.push({
          id: 'insert-from-file',
          category: 'Structure',
          label: 'Insert from file',
          description: 'Insert Markdown from an already-parsed source file',
          execute: ({ editor: e, range }) => {
            e.chain().focus().deleteRange(range).run();
            const pos = e.state.selection.from;
            let top = 0;
            try {
              top = e.view.coordsAtPos(pos).top;
            } catch {
              top = 0;
            }
            setInsertFileTarget({ pos, top, pageOwner });
          },
        });
      }
    }
    return items;
  };

  const editor = useEditor({
    extensions: [
      ...CONTENT_EXTENSIONS,
      Markdown,
      // Story 8.1: deliberately NOT part of CONTENT_EXTENSIONS (the schema shared with the
      // standalone markdownManager) -- see LearningResourcesBlock.ts's own header comment for why.
      LearningResourcesBlock.configure({ courseId }),
      // Story 9.1: replaces markdownManager's plain Image (see CONTENT_EXTENSIONS comment above)
      // with the NodeView-carrying, courseId-configured PageImage for the live editor's own schema.
      PageImage.configure({ courseId }),
      // Story 9.2: replaces markdownManager's unconfigured ResourceCard (see CONTENT_EXTENSIONS
      // comment above) with the courseId-configured instance the live editor's own NodeView needs.
      ResourceCard.configure({ courseId }),
      // Empty-line affordance: the "/" menu is the primary way to insert anything, and nothing on
      // screen said so -- a tutor faced with a blank document had no way to discover it. Deliberately
      // NOT in CONTENT_EXTENSIONS: Placeholder is pure editor chrome (a ProseMirror decoration), and
      // the headless markdownManager must never see it.
      Placeholder.configure({
        // showOnlyCurrent (the default, stated explicitly because it is load-bearing) restricts the
        // hint to the node the CURSOR is in. It was previously defeated by includeChildren: true,
        // which paints every empty node in the document at once -- a chapter with three empty lines
        // showed three identical "Type '/'..." hints stacked on top of each other, which reads as a
        // rendering fault rather than a hint.
        //
        // Losing includeChildren also loses the per-cell hint inside tables (Placeholder only
        // reaches top-level nodes without it). That is the right trade: the table now has visible
        // gridlines, so an empty cell is already legible as an empty cell, whereas duplicated hints
        // down the page were actively confusing.
        showOnlyCurrent: true,
        includeChildren: false,
        // Per-node text, because one generic string would be wrong nearly everywhere: the structural
        // headings want to say what they ARE, and only ordinary body lines should advertise "/".
        placeholder: ({ node, pos, editor: e }) => {
          if (node.type.name === 'heading') {
            const level = (node.attrs.level as number) ?? 1;
            if (level === 1) return 'Chapter title';
            if (level === 2) return 'Topic name';
            if (level === 3) return 'Sub-Topic name';
            if (level === 4) return 'Page title';
            return 'Sub-heading';
          }
          if (node.type.name !== 'paragraph') return '';
          // A Description zone's schema rejects everything but paragraphs and bullet lists, so
          // advertising "/" inside one would promise a menu that is (correctly) almost empty.
          const resolved = e.state.doc.resolve(pos);
          for (let depth = resolved.depth; depth > 0; depth -= 1) {
            if (resolved.node(depth).type.name === 'descriptionZone') return 'Describe what a student will get from this';
          }
          return "Type '/' to insert a block";
        },
      }),
      SlashCommandExtension.configure({ getItems: ({ query, editor: e }) => filterCommandsRef.current(query, e) }),
    ],
    content: buildDocJSON(document, title),
    editable: !isReadOnly,
    autofocus: 'start',
  });

  // Story 7.4, AD-11/AC #1: every heading/body edit routes through this hook -- debounced while
  // typing, flushed immediately on blur -- replacing Stories 7.1-7.3's bare blur-only stub.
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;
  const { status: autosaveStatus, scheduleSave, flushNow } = useContentAutosave(async () => {
    if (editorRef.current) await performSync(editorRef.current);
  });

  useEffect(() => {
    onRegisterFlush?.(flushNow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterFlush, flushNow]);

  useEffect(() => {
    if (!editor) return undefined;
    const onUpdate = () => scheduleSave();
    const onBlur = () => void flushNow();
    editor.on('update', onUpdate);
    editor.on('blur', onBlur);
    return () => {
      editor.off('update', onUpdate);
      editor.off('blur', onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Keep editability in sync if the Published state resolves after the editor already mounted
  // (e.g. useCourseLifecycle's own async load) -- editable isn't reactive to prop changes on its
  // own once the editor instance exists. Also suspended while a Preview/Markdown panel is open,
  // so the (visually covered) live content beneath it can't be edited out from under it.
  useEffect(() => {
    editor?.setEditable(!isReadOnly && !panelTarget && !insertFileTarget);
  }, [editor, isReadOnly, panelTarget, insertFileTarget]);

  // Rebuilds the ProseMirror document from the freshly-reloaded server document -- fires after
  // any Topic/Sub-Topic/Page create/update/delete/reorder, never mid-typing (those actions only
  // ever land here via a completed async call, well after the user's own edit already happened).
  // Seeded with the prop value present at mount (not `null`) -- useEditor's own `content` option
  // above already applied that exact value; without this, the effect below would immediately
  // re-run setContent right after mount purely because a plain `useRef(null)` never matches a
  // non-null initial `document`, needlessly fighting the `autofocus: 'start'` placement.
  const lastAppliedDocRef = useRef<ChapterDocumentDto | null>(document);
  useEffect(() => {
    if (!editor) return;
    if (lastAppliedDocRef.current === document) return;
    lastAppliedDocRef.current = document;
    editor.commands.setContent(buildDocJSON(document, title), { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, document]);

  // Story 11.1, Task 2 (AC #1): moves real DOM focus to a blocker's target node (same
  // tabindex="-1" + .focus() mechanism TableOfContentsRail.tsx's own `activate` uses), the second
  // half of activating a blocker link after a cross-Chapter switch (if any) already remounted this
  // component with the target Chapter's document already loaded. A Chapter-kind blocker has no
  // collectHeadings entry of its own (Chapter/h1 isn't a Topic/Sub-Topic/Page) -- its id equals
  // this component's own chapterId prop, so that case focuses the document's own h1 directly.
  useEffect(() => {
    if (!editor || !pendingFocusNodeId) return;
    let pos: number | null = null;
    if (pendingFocusNodeId === chapterId) {
      editor.state.doc.forEach((node, offset) => {
        if (pos !== null) return;
        if (node.type.name === 'heading' && node.attrs.level === 1) pos = offset;
      });
    } else {
      pos = collectHeadings(editor).find((h) => h.entityId === pendingFocusNodeId)?.pos ?? null;
    }
    if (pos === null) return;
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    if (!dom) return;
    if (!dom.hasAttribute('tabindex')) dom.setAttribute('tabindex', '-1');
    dom.focus();
    onFocusHandled();
  }, [editor, pendingFocusNodeId, chapterId, onFocusHandled]);

  // Story 7.4, Task 6: the permanent home for the boundary-detection walk Story 7.3's Task 3
  // reused for Page-body scoping -- now driven by useContentAutosave (debounced typing + blur
  // flush) instead of a bare onBlur call. Structural creates (a brand-new Topic/Sub-Topic
  // typed and never yet saved) still need a full `reload()` for their canonical id; a text-only
  // update to an already-persisted entity patches CourseContentContext directly instead
  // (AD-11's explicit "never a full outline refetch" rule for this path).
  const performSync = async (blurredEditor: Editor) => {
    const { courseId: cid, chapterId: chId, title: knownTitle, document: doc, onTitleBlur: onTitle, onReload: reload } = latestRef.current;

    const currentTitle = getChapterTitleText(blurredEditor);
    // Code-review fix: this used to be fire-and-forget -- a failed title save was a genuinely
    // unhandled promise rejection, invisible to the tutor, and let performSync (and therefore
    // useContentAutosave's status) resolve as "saved" regardless. Awaiting it routes the failure
    // through the exact same try/catch useContentAutosave.run() already has, surfacing it via the
    // existing "Save failed / Retry" indicator instead of a second, bespoke error path.
    if (currentTitle !== knownTitle) await onTitle(currentTitle);

    if (!chId) return; // no Chapter saved yet -- Topics/Sub-Topics/Pages have nothing to attach to

    const flatNodes = blurredEditor.getJSON().content ?? [];
    let currentTopicId: string | null = null;
    let anyCreated = false;
    let i = 0;

    while (i < flatNodes.length) {
      const node = flatNodes[i];
      const level = node.type === 'heading' ? (node.attrs?.level as number) : null;

      if (level === 2) {
        const text = extractHeadingText(node).trim();
        const entityId = (node.attrs?.entityId as string | undefined) ?? null;
        if (!text) {
          currentTopicId = null;
        } else if (!entityId) {
          const created = await createTopic(cid, chId, text);
          currentTopicId = created.id;
          anyCreated = true;
        } else {
          currentTopicId = entityId;
          if (text !== findServerTitle(doc, 'topic', entityId)) {
            const updated = await updateTopic(cid, entityId, { title: text, description: null });
            courseContent.patchConfirmation(entityId, updated.isConfirmed);
          }
        }
        i++;
        continue;
      }

      if (level === 3) {
        const text = extractHeadingText(node).trim();
        const entityId = (node.attrs?.entityId as string | undefined) ?? null;
        if (text && currentTopicId) {
          if (!entityId) {
            await createSubtopic(cid, currentTopicId, text);
            anyCreated = true;
          } else if (text !== findServerTitle(doc, 'subtopic', entityId)) {
            const updated = await updateSubtopic(cid, entityId, { title: text, description: null });
            courseContent.patchConfirmation(entityId, updated.isConfirmed);
          }
        }
        i++;
        continue;
      }

      if (level === 4) {
        const text = extractHeadingText(node).trim();
        const entityId = (node.attrs?.entityId as string | undefined) ?? null;

        // Collect the body: every following top-level node up to (not including) the next
        // heading of level <= 4.
        const bodyNodes: JSONContent[] = [];
        let j = i + 1;
        while (j < flatNodes.length) {
          const next = flatNodes[j];
          if (next.type === 'heading' && (next.attrs?.level as number) <= 4) break;
          bodyNodes.push(next);
          j++;
        }

        // Page creation is never blur-driven (AD-11 -- it fires synchronously at insertion via
        // the "New Page" command); a still-null entityId here means that create call hasn't
        // resolved yet, or the tutor never typed a title -- either way, nothing to sync until it
        // does. A blank title is also skipped, preserving the server's placeholder title rather
        // than rejecting on an empty one.
        if (entityId && text) {
          // Story 8.1: a learningResourcesBlock never has Markdown text of its own (see
          // LearningResourcesBlock.ts) -- filtered out before serializing the rest of the body,
          // and reconstructed separately by buildPageJSON from the page's own `resources` array.
          const proseNodes = bodyNodes.filter((n) => n.type !== 'learningResourcesBlock');
          // Story 9.2: a real pre-existing bug, found and fixed while adding this story's
          // adjacency round-trip tests -- markdownManager.serialize() only inserts blank-line
          // separators between top-level blocks when given a `{type:'doc', content}` node; a
          // bare array (what this call passed before) concatenates blocks with NO separator at
          // all (verified directly: even two adjacent plain paragraphs serialized as
          // "First.Second.", no blank line). Every multi-block Page body has been affected since
          // Story 7.3 -- wrapping in a doc node here is the actual fix, not new behavior.
          const bodyMarkdown = markdownManager.serialize({ type: 'doc', content: proseNodes });
          const server = findServerPage(doc, entityId);
          if (text !== server?.title || bodyMarkdown !== server?.bodyMarkdown) {
            const updated = await updatePage(cid, entityId, { title: text, bodyMarkdown });
            courseContent.patchConfirmation(entityId, updated.isConfirmed);
          }
        }
        i = j;
        continue;
      }

      i++;
    }

    // A new Topic/Sub-Topic needs its canonical id in the live document (only a full document
    // reload can supply that); a structural create also flips the immediate parent's
    // confirmation server-side, so refresh the outline too rather than leaving it stale. A
    // text-only update already patched its own entity's confirmation above -- no full refetch.
    if (anyCreated) {
      await reload();
      await courseContent.refetch();
    }
  };

  const noun = (entry: HeadingEntry) => entry.title || (entry.kind === 'topic' ? 'Topic' : entry.kind === 'subtopic' ? 'Sub-topic' : 'Page');

  // Story 7.4, FR-44/Task 1: a Topic's parent is the (single, always-known) open Chapter; a
  // Sub-Topic's is its Topic; a Page's is whatever its ownerKey ("Topic:id"/"Subtopic:id"/
  // "Chapter") names.
  const getImmediateParentId = (entry: HeadingEntry): string | null => {
    if (entry.kind === 'topic') return chapterId;
    if (entry.kind === 'subtopic') return entry.parentTopicId ?? null;
    if (!entry.ownerKey || entry.ownerKey === 'Chapter') return chapterId;
    return entry.ownerKey.split(':')[1] ?? null;
  };

  // Story 7.4, Task 7: "a tutor may not expect their edit to have un-confirmed something" --
  // announced at the moment a structural edit's response reveals the immediate parent flipped
  // from Confirmed to Unconfirmed. Scoped to the explicit delete/move/reorder actions below,
  // where that side effect is least expected; a blur-triggered Topic/Sub-Topic *creation*
  // resetting its own obviously-just-edited parent is a far less surprising consequence of an
  // explicit "add a child" action, so it isn't given a second, redundant announcement here.
  const refreshConfirmationAndAnnounceIfReverted = async (parentId: string | null) => {
    if (!parentId) {
      await courseContent.refetch();
      return;
    }
    const wasConfirmed = courseContent.isConfirmed(parentId);
    const fresh = await courseContent.refetch();
    if (wasConfirmed === true && fresh.get(parentId) === false) {
      onAnnounce('This change un-confirmed its parent section.');
    }
  };

  const handleRequestDelete = async (entry: HeadingEntry) => {
    const impact =
      entry.kind === 'topic'
        ? await getTopicDeleteImpact(courseId, entry.entityId)
        : entry.kind === 'subtopic'
          ? await getSubtopicDeleteImpact(courseId, entry.entityId)
          : await getPageDeleteImpact(courseId, entry.entityId);
    setDeleteTarget({ entry, message: buildDeleteMessage(entry.kind, impact) });
  };

  // Code-review fix: handleConfirmDelete/handleMove/handleDragReorder/commitMove below all used
  // to have no error handling at all -- a rejected delete/reorder/move call was a genuinely
  // unhandled promise rejection, left the triggering modal/picker open with no explanation, and
  // (for handleConfirmDelete specifically) never even cleared deleteTarget since that happened
  // after the now-thrown await. Each now surfaces failure via the same showToast pattern the
  // "New Page" and cross-chapter-switch fixes elsewhere in this file already established.
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { entry } = deleteTarget;
    const parentId = getImmediateParentId(entry);
    try {
      if (entry.kind === 'topic') await deleteTopic(courseId, entry.entityId);
      else if (entry.kind === 'subtopic') await deleteSubtopic(courseId, entry.entityId);
      else await deletePage(courseId, entry.entityId);
    } catch {
      showToast({ message: `Could not delete this ${entry.kind}. Please try again.`, variant: 'error' });
      return;
    }
    setDeleteTarget(null);
    onAnnounce(`${noun(entry)} deleted`);
    await onReload();
    await refreshConfirmationAndAnnounceIfReverted(parentId);
  };

  const handleMove = async (entry: HeadingEntry, direction: 'up' | 'down') => {
    const parentId = getImmediateParentId(entry);
    try {
      if (entry.kind === 'topic') await reorderTopic(courseId, entry.entityId, direction);
      else if (entry.kind === 'subtopic') await reorderSubtopic(courseId, entry.entityId, direction);
      else await reorderPage(courseId, entry.entityId, direction);
    } catch {
      showToast({ message: `Could not move this ${entry.kind}. Please try again.`, variant: 'error' });
      return;
    }
    onAnnounce(`${noun(entry)} moved ${direction}`);
    await onReload();
    await refreshConfirmationAndAnnounceIfReverted(parentId);
  };

  const handleDragReorder = async (dragged: HeadingEntry, droppedOn: HeadingEntry) => {
    if (!editor) return;
    if (dragged.kind !== droppedOn.kind) return;
    if (dragged.kind === 'subtopic' && dragged.parentTopicId !== droppedOn.parentTopicId) return;
    if (dragged.kind === 'page' && dragged.ownerKey !== droppedOn.ownerKey) return;

    const siblings = collectHeadings(editor).filter((candidate) => {
      if (candidate.kind !== dragged.kind) return false;
      if (dragged.kind === 'subtopic') return candidate.parentTopicId === dragged.parentTopicId;
      if (dragged.kind === 'page') return candidate.ownerKey === dragged.ownerKey;
      return true;
    });
    const from = siblings.findIndex((candidate) => candidate.entityId === dragged.entityId);
    const to = siblings.findIndex((candidate) => candidate.entityId === droppedOn.entityId);
    if (from === -1 || to === -1 || from === to) return;
    const direction: 'up' | 'down' = to < from ? 'up' : 'down';
    const hops = Math.abs(to - from);
    const parentId = getImmediateParentId(dragged);

    try {
      for (let i = 0; i < hops; i++) {
        if (dragged.kind === 'topic') await reorderTopic(courseId, dragged.entityId, direction);
        else if (dragged.kind === 'subtopic') await reorderSubtopic(courseId, dragged.entityId, direction);
        else await reorderPage(courseId, dragged.entityId, direction);
      }
    } catch {
      // A partial run of hops may have already committed server-side -- reload so the tutor sees
      // real server state rather than the pre-drag order the live document still shows.
      showToast({ message: `Could not reorder this ${dragged.kind}. Please try again.`, variant: 'error' });
      await onReload();
      return;
    }
    onAnnounce(`${noun(dragged)} reordered`);
    await onReload();
    await refreshConfirmationAndAnnounceIfReverted(parentId);
  };

  const openMovePicker = (entry: HeadingEntry) => {
    if (!editor) return;
    let top = 0;
    try {
      top = editor.view.coordsAtPos(entry.pos).top;
    } catch {
      top = 0;
    }
    setMoveTarget({ entry, top });
  };

  const commitMove = async (target: { ownerType: ContentOwnerType; ownerId: string }) => {
    if (!moveTarget) return;
    const sourceParentId = getImmediateParentId(moveTarget.entry);
    try {
      await movePage(courseId, moveTarget.entry.entityId, target.ownerType, target.ownerId);
    } catch {
      showToast({ message: 'Could not move the page. Please try again.', variant: 'error' });
      return;
    }
    onAnnounce(`${noun(moveTarget.entry)} moved`);
    setMoveTarget(null);
    await onReload();
    // A move resets BOTH the source and destination immediate parents (FR-44's explicit third
    // case) -- refetch covers both; the announcement itself only ever names the source parent
    // reverting, matching this section's own "least expected" scoping (the destination gaining
    // an unconfirmed child is the expected, obvious half of a move).
    await refreshConfirmationAndAnnounceIfReverted(sourceParentId);
  };

  // Extracts a Page's current body (live, unsaved edits included) as Markdown -- used to seed
  // both the Preview and Markdown panels with exactly what's on screen, not stale server state.
  const extractPageBodyMarkdown = (entry: HeadingEntry): string => {
    if (!editor) return '';
    const flat = editor.getJSON().content ?? [];
    const index = flat.findIndex((node) => node.type === 'heading' && node.attrs?.entityId === entry.entityId && node.attrs?.level === 4);
    if (index === -1) return '';
    const body: JSONContent[] = [];
    for (let j = index + 1; j < flat.length; j++) {
      const next = flat[j];
      if (next.type === 'heading' && (next.attrs?.level as number) <= 4) break;
      body.push(next);
    }
    // Story 9.2: same two fixes as performSync's own identical call just above -- (1) a
    // learningResourcesBlock isn't registered in markdownManager's schema at all (Story 8.1's own
    // deliberate exclusion), so leaving one in here would throw when a Page with an inserted
    // Learning Resources block opens Preview/Markdown; (2) serialize() needs a `{type:'doc',
    // content}` wrapper to insert blank-line separators between blocks, not a bare array.
    const proseNodes = body.filter((n) => n.type !== 'learningResourcesBlock');
    return markdownManager.serialize({ type: 'doc', content: proseNodes });
  };

  const openPanel = (entry: HeadingEntry, mode: PagePreviewMode) => {
    if (!editor) return;
    let top = 0;
    try {
      top = editor.view.coordsAtPos(entry.pos).top;
    } catch {
      top = 0;
    }
    setPanelTarget({ entry, mode, bodyMarkdown: extractPageBodyMarkdown(entry), top });
  };

  const commitPanelMarkdown = (markdown: string) => {
    if (!editor || !panelTarget) return;
    const headingPos = collectHeadings(editor).find((h) => h.entityId === panelTarget.entry.entityId)?.pos;
    if (headingPos === undefined) {
      setPanelTarget(null);
      return;
    }
    const headingNode = editor.state.doc.nodeAt(headingPos);
    const bodyStart = headingPos + (headingNode?.nodeSize ?? 0);
    // The body ends at the next heading of level <= 4, or the end of the document.
    let bodyEnd = editor.state.doc.content.size;
    editor.state.doc.forEach((node, offset) => {
      if (offset > headingPos && node.type.name === 'heading' && node.attrs.level <= 4 && offset < bodyEnd) bodyEnd = offset;
    });

    const parsed = markdownManager.parse(markdown);
    editor.chain().deleteRange({ from: bodyStart, to: bodyEnd }).insertContentAt(bodyStart, parsed.content ?? []).run();
    setPanelTarget(null);
  };

  // Story 10.2, Task 1: appends a newly-attached resource to this Page's already-live
  // learningResourcesBlock node (mirrors LearningResourcesNodeView.tsx's own `setResources`
  // pattern via updateAttributes, just invoked from outside that NodeView), or -- if no block is
  // currently in the live document for this Page -- inserts one at the end of the Page's body,
  // seeded with just this resource (the exact same insertion shape the "Learning Resources" slash
  // command itself uses). Deliberately never a full onReload(): the tutor's just-inserted-from-file
  // text (Task 3) hasn't round-tripped to the server yet at this point, and a reload would rebuild
  // the whole doc from stale server state, silently discarding it.
  const appendAttachedResourceToPage = (
    targetEditor: Editor,
    pageOwner: { ownerType: ContentOwnerType; ownerId: string },
    resource: ResourceDto
  ) => {
    let blockPos: number | null = null;
    targetEditor.state.doc.descendants((node, pos) => {
      if (blockPos !== null) return false;
      if (node.type.name === 'learningResourcesBlock' && node.attrs.ownerType === pageOwner.ownerType && node.attrs.ownerId === pageOwner.ownerId) {
        blockPos = pos;
        return false;
      }
      return true;
    });

    if (blockPos !== null) {
      const node = targetEditor.state.doc.nodeAt(blockPos);
      const current: ResourceDto[] = node?.attrs.resources ?? [];
      targetEditor
        .chain()
        .command(({ tr }) => {
          tr.setNodeAttribute(blockPos as number, 'resources', [...current, resource]);
          return true;
        })
        .run();
      return;
    }

    const headingPos = collectHeadings(targetEditor).find((h) => h.entityId === pageOwner.ownerId)?.pos;
    if (headingPos === undefined) return;
    const headingNode = targetEditor.state.doc.nodeAt(headingPos);
    const bodyStart = headingPos + (headingNode?.nodeSize ?? 0);
    let bodyEnd = targetEditor.state.doc.content.size;
    targetEditor.state.doc.forEach((n, offset) => {
      if (offset > headingPos && n.type.name === 'heading' && n.attrs.level <= 4 && offset < bodyEnd) bodyEnd = offset;
    });
    const { document: doc } = latestRef.current;
    const inherited = doc ? resolveInheritedResources(doc, pageOwner.ownerType, pageOwner.ownerId) : [];
    targetEditor
      .chain()
      .insertContentAt(bodyEnd, {
        type: 'learningResourcesBlock',
        attrs: { ownerType: pageOwner.ownerType, ownerId: pageOwner.ownerId, resources: [resource], inherited },
      })
      .run();
  };

  // Story 10.1, Task 3 (AC #4): inserts the picker's selected Markdown as genuinely ordinary,
  // unlocked blocks -- the same markdownManager.parse()-then-insertContentAt round-trip
  // commitPanelMarkdown already uses above, so an inserted paragraph/heading/list is indistinguishable
  // from anything the tutor typed by hand (no wrapper node, no "inserted from file" marker).
  // reconcileCustomBlocks runs over the parsed result for parity with buildPageJSON's own parse
  // path, in case the inserted text happens to contain a `> [!note]`/`resource:` construct.
  const commitInsertFromFile = (markdown: string) => {
    if (!editor || !insertFileTarget) return;
    const { pageOwner } = insertFileTarget;
    const parsed = markdownManager.parse(markdown);
    const nodes = reconcileCustomBlocks(parsed.content ?? [], pageOwner.ownerType, pageOwner.ownerId);
    editor.chain().focus().insertContentAt(insertFileTarget.pos, nodes).run();
    setInsertFileTarget(null);
  };

  // Story 10.2, Task 1 (AC #1): the picker's own attachExistingFileAsResource call already
  // succeeded by the time this fires -- reflects the new Resource in the live document and marks
  // the source file's local hasAttachedResources flag, independent of (and never blocking) the
  // text insertion above.
  const handleResourceAttached = (pageOwner: { ownerType: ContentOwnerType; ownerId: string }, fileId: string, resource: ResourceDto) => {
    if (!editor) return;
    appendAttachedResourceToPage(editor, pageOwner, resource);
    onFileAttached(fileId);
  };

  return (
    <div className="flex gap-4">
      <TableOfContentsRail editor={editor ?? null} chapterId={chapterId} onAddChapter={onAddChapter} disabled={isReadOnly} />
      <div className="relative flex-1 min-w-0">
        {/* Story 7.4, AC #1: an explicit saved/saving/failed indicator, visible text (never a
            bare spinner) -- a failed save is loud and offers a retry, and never clears/discards
            the block's own unsaved content (this hook never touches the editor's own doc). */}
        {!isReadOnly && autosaveStatus !== 'idle' && (
          <div role="status" className="absolute -top-6 right-0 flex items-center gap-2 text-xs font-semibold">
            {autosaveStatus === 'saving' && <span className="text-muted-foreground">Saving…</span>}
            {autosaveStatus === 'saved' && <span className="text-[#179765]">Saved</span>}
            {autosaveStatus === 'failed' && (
              <span className="text-destructive flex items-center gap-1.5">
                Save failed
                <button type="button" onClick={() => void flushNow()} className="underline font-bold">
                  Retry
                </button>
              </span>
            )}
          </div>
        )}
        <EditorContent
          editor={editor}
          // px-10: the document used to run edge-to-edge against the rail and the viewport, which
          // is the single biggest reason it did not read like a Confluence page. The horizontal
          // breathing room is also what gives the hover controls (PlusAffordanceButton,
          // HeadingControls) somewhere to sit without overlapping the text they belong to.
          // py-8 + a max-w measure keeps long prose from stretching to unreadable line lengths on
          // a wide monitor, which is what Confluence's own fixed content column does.
          // `prose prose-slate` was removed: @tailwindcss/typography is not a dependency of this
          // project, so those classes never matched a rule -- they read as if the document were
          // typographically styled when nothing was applying. Editor typography lives in
          // index.css's own .ProseMirror rules instead.
          className="content-doc-heading max-w-none px-10 py-8 [&_.ProseMirror]:outline-none [&_.ProseMirror_h1]:font-display [&_.ProseMirror_h1]:text-3xl [&_.ProseMirror_h1]:font-extrabold [&_.ProseMirror_h1]:text-foreground [&_.ProseMirror_h2]:font-display [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:text-foreground [&_.ProseMirror_h2]:mt-6 [&_.ProseMirror_h3]:font-display [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-bold [&_.ProseMirror_h3]:text-foreground [&_.ProseMirror_h3]:mt-4"
        />
        <ConfirmationGlyphs editor={editor ?? null} chapterId={chapterId} />
        {!isReadOnly && (
          <>
            <PlusAffordanceButton editor={editor} />
            <HeadingControls
              editor={editor}
              onMove={handleMove}
              onDelete={handleRequestDelete}
              onDragReorder={handleDragReorder}
              onPreview={(entry) => openPanel(entry, 'preview')}
              onEditMarkdown={(entry) => openPanel(entry, 'markdown')}
              onMoveTo={openMovePicker}
              // AWAIT the flush before opening the preview. PreviewAsStudent re-fetches the
              // chapter/page from the SERVER (it renders through lib/markdown.ts, never the live
              // Tiptap doc), so anything still sitting in the 1.5s autosave debounce simply is not
              // there yet. Clicking the control does blur the editor, which fires flushNow -- but
              // that is a race the preview's own fetch usually won, and the tutor saw an empty
              // preview of content plainly visible behind it.
              onPreviewAsStudent={(entry) => {
                if (!chapterId) return;
                void flushNow().then(() =>
                  onPreviewAsStudent(
                    entry.kind === 'page'
                      ? { kind: 'page', pageId: entry.entityId }
                      : { kind: 'node', chapterId, nodeType: entry.kind === 'topic' ? 'Topic' : 'Subtopic', nodeId: entry.entityId }
                  )
                );
              }}
            />
            <BodyBlockControls editor={editor} />
            <TableControls editor={editor ?? null} />
          </>
        )}

        {panelTarget && (
          <div style={{ position: 'fixed', top: panelTarget.top, left: 0, right: 0 }} className="z-20 mx-4">
            <PagePreviewPanel
              mode={panelTarget.mode}
              bodyMarkdown={panelTarget.bodyMarkdown}
              onCommitMarkdown={commitPanelMarkdown}
              onClose={() => setPanelTarget(null)}
              resolveResourceUrl={(resourceId) => resolveResourceUrl(courseId, resourceId)}
            />
          </div>
        )}

        {moveTarget && editor && (
          <div style={{ position: 'fixed', top: moveTarget.top, left: 0 }} className="z-20 w-64 rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs font-bold text-foreground">Move page to…</span>
              <button type="button" onClick={() => setMoveTarget(null)} className="text-xs text-muted-foreground hover:text-foreground">
                Close
              </button>
            </div>
            <ul role="listbox" aria-label="Move page to" className="max-h-60 overflow-y-auto py-1">
              {collectHeadings(editor)
                .filter((candidate) => candidate.kind === 'topic' || candidate.kind === 'subtopic')
                .map((candidate) => (
                  <li key={candidate.entityId}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() =>
                        void commitMove({
                          ownerType: candidate.kind === 'topic' ? 'Topic' : 'Subtopic',
                          ownerId: candidate.entityId,
                        })
                      }
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 ${candidate.kind === 'subtopic' ? 'pl-6 text-muted-foreground' : 'font-semibold text-foreground'}`}
                    >
                      {candidate.title || (candidate.kind === 'topic' ? 'Untitled topic' : 'Untitled sub-topic')}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {insertFileTarget && (
          <div style={{ position: 'fixed', top: insertFileTarget.top, left: 0 }} className="z-20">
            <InsertFromFilePicker
              files={doneFiles}
              courseId={courseId}
              pageOwner={insertFileTarget.pageOwner}
              onInsert={commitInsertFromFile}
              onResourceAttached={(fileId, resource) => handleResourceAttached(insertFileTarget.pageOwner, fileId, resource)}
              onClose={() => setInsertFileTarget(null)}
            />
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmModal message={deleteTarget.message} onConfirm={() => void handleConfirmDelete()} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
};
