// Story 7.2, Task 5 (AC #4): keyboard-accessible move-up/move-down + delete controls for every
// Topic (h2) / Sub-Topic (h3) heading, plus drag-and-drop as the secondary path (native HTML5 DnD
// -- this codebase has no drag library dependency anywhere, AdaptiveSchedule.tsx's lesson-planner
// reorder is the existing precedent). Rendered as real React siblings of <EditorContent>,
// positioned via editor.view.coordsAtPos() -- the same pattern PlusAffordanceButton.tsx already
// established in Story 7.1, for the same reason: a control living inside the editable subtree as a
// ProseMirror decoration risks polluting the heading's own accessible name/textContent.
//
// Chapter headings (h1) are NOT included here -- Story 7.1/7.2 never built a chapter-list view a
// Chapter reorder control could render inside (this story's document canvas only ever shows one
// Chapter at a time; see Task 8/TableOfContentsRail's "Add chapter" for the only cross-chapter
// affordance this story adds). The backend ReorderChapterAsync/DeleteChapterAsync are complete and
// ready to wire up once a future story adds a chapter-list surface.
import React, { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { ArrowDown, ArrowUp, Code2, Eye, FolderInput, GraduationCap, Trash2 } from 'lucide-react';
import { IconButton } from '../../ui/IconButton';

export type HeadingKind = 'topic' | 'subtopic' | 'page';

export interface HeadingEntry {
  kind: HeadingKind;
  entityId: string;
  pos: number;
  title: string;
  /** The nearest preceding Topic's entityId -- undefined for a `topic` entry itself. Used to keep
   * drag-and-drop reorder scoped to real siblings (the backend's reorder swap is scoped to a
   * shared parent; dragging a Sub-Topic onto one nested under a *different* Topic has no
   * well-defined single up/down hop sequence, so callers restrict drag-reorder to matching
   * parentTopicId). */
  parentTopicId?: string;
  /** Story 7.3: a Page's owner scope key ("Topic:id" / "Subtopic:id"/ "Chapter") -- same purpose
   * as parentTopicId above, one level more general since a Page can attach to any of the three
   * node kinds. Known limitation: computed by walking the live document's heading order, so a
   * Page hand-dragged to sit after one of its owner's own Sub-Topics in the flat document is
   * misattributed to that Sub-Topic for drag-scoping purposes (not for creation, which always
   * captures the real owner explicitly at insert time via getNearestPersistedOwner) -- this only
   * ever affects which pages a drag treats as "siblings," never which owner a Page is actually
   * saved under. */
  ownerKey?: string;
}

interface HeadingControlsProps {
  editor: Editor | null;
  onMove: (entry: HeadingEntry, direction: 'up' | 'down') => void;
  onDelete: (entry: HeadingEntry) => void;
  onDragReorder: (dragged: HeadingEntry, droppedOn: HeadingEntry) => void;
  /** Story 7.3: only rendered for `page`-kind entries. */
  onPreview?: (entry: HeadingEntry) => void;
  onEditMarkdown?: (entry: HeadingEntry) => void;
  /** Story 7.3, Task 7 (FR-8): opens the "Move page to…" picker. */
  onMoveTo?: (entry: HeadingEntry) => void;
  /** Story 11.2 (AC #1): "Preview as student" at node scope (topic/subtopic) or page scope --
   * available on every entry kind, unlike Preview/Edit-as-Markdown/Move-to above which are
   * page-only. Distinct from the existing page-only `onPreview` (Story 7.3's in-place
   * Preview/Markdown toggle) -- this opens the full, separate Preview-as-Student surface. */
  onPreviewAsStudent?: (entry: HeadingEntry) => void;
}

interface PositionedEntry extends HeadingEntry {
  top: number;
}

// Walks the live document collecting every persisted (entityId-bearing) Topic/Sub-Topic/Page
// heading -- a heading typed but not yet saved (no entityId) has nothing to reorder/delete yet
// (Topic/Sub-Topic), or is still mid-flight (Page, AD-11's synchronous create), so it gets no
// controls either way.
const collectHeadings = (editor: Editor): HeadingEntry[] => {
  const entries: HeadingEntry[] = [];
  let currentTopicId: string | undefined;
  let currentOwnerKey = 'Chapter';
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading' && node.attrs.level === 2) {
      currentTopicId = node.attrs.entityId ?? undefined;
      currentOwnerKey = node.attrs.entityId ? `Topic:${node.attrs.entityId}` : 'Chapter';
      if (node.attrs.entityId) entries.push({ kind: 'topic', entityId: node.attrs.entityId, pos, title: node.textContent });
    } else if (node.type.name === 'heading' && node.attrs.level === 3) {
      if (node.attrs.entityId) entries.push({ kind: 'subtopic', entityId: node.attrs.entityId, pos, title: node.textContent, parentTopicId: currentTopicId });
      currentOwnerKey = node.attrs.entityId ? `Subtopic:${node.attrs.entityId}` : currentOwnerKey;
    } else if (node.type.name === 'heading' && node.attrs.level === 4 && node.attrs.entityId) {
      entries.push({ kind: 'page', entityId: node.attrs.entityId, pos, title: node.textContent, ownerKey: currentOwnerKey });
    }
    return true;
  });
  return entries;
};

const NOUN: Record<HeadingKind, string> = { topic: 'topic', subtopic: 'sub-topic', page: 'page' };

export const HeadingControls: React.FC<HeadingControlsProps> = ({
  editor,
  onMove,
  onDelete,
  onDragReorder,
  onPreview,
  onEditMarkdown,
  onMoveTo,
  onPreviewAsStudent,
}) => {
  const [entries, setEntries] = useState<PositionedEntry[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    if (!editor) return undefined;

    const recompute = () => {
      const headings = collectHeadings(editor);
      const positioned = headings.map((entry) => {
        try {
          const coords = editor.view.coordsAtPos(entry.pos);
          return { ...entry, top: coords.top };
        } catch {
          return { ...entry, top: 0 };
        }
      });
      setEntries(positioned);
    };

    recompute();
    editor.on('transaction', recompute);
    editor.on('update', recompute);
    return () => {
      editor.off('transaction', recompute);
      editor.off('update', recompute);
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <>
      {entries.map((entry) => {
        // Scoped by real parent (Topic for a Sub-Topic, owner for a Page) -- a flat
        // `entries.filter(kind === entry.kind)` would wrongly treat every Sub-Topic in the whole
        // document (or every Page under every owner) as one shared first/last boundary group.
        const siblingsOfKind = entries.filter((candidate) => {
          if (candidate.kind !== entry.kind) return false;
          if (entry.kind === 'subtopic') return candidate.parentTopicId === entry.parentTopicId;
          if (entry.kind === 'page') return candidate.ownerKey === entry.ownerKey;
          return true;
        });
        const indexAmongKind = siblingsOfKind.indexOf(entry);
        const isFirstOfKind = indexAmongKind === 0;
        const isLastOfKind = indexAmongKind === siblingsOfKind.length - 1;
        const noun = entry.title || NOUN[entry.kind];

        return (
          <div
            key={entry.entityId}
            draggable
            data-testid={`heading-controls-${entry.entityId}`}
            onDragStart={() => setDraggedId(entry.entityId)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const dragged = entries.find((candidate) => candidate.entityId === draggedId);
              setDraggedId(null);
              if (dragged && dragged.entityId !== entry.entityId && dragged.kind === entry.kind) {
                onDragReorder(dragged, entry);
              }
            }}
            style={{ position: 'fixed', top: entry.top, left: 0 }}
            className="z-10 flex items-center gap-0.5 rounded-md border border-border bg-card px-0.5 py-0.5 opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100 cursor-grab active:cursor-grabbing"
          >
            <IconButton
              icon={<ArrowUp className="w-3 h-3" />}
              label={`Move ${noun} up`}
              disabled={isFirstOfKind}
              onClick={() => onMove(entry, 'up')}
            />
            <IconButton
              icon={<ArrowDown className="w-3 h-3" />}
              label={`Move ${noun} down`}
              disabled={isLastOfKind}
              onClick={() => onMove(entry, 'down')}
            />
            {entry.kind === 'page' && onPreview && (
              <IconButton icon={<Eye className="w-3 h-3" />} label={`Preview ${noun}`} onClick={() => onPreview(entry)} />
            )}
            {entry.kind === 'page' && onEditMarkdown && (
              <IconButton icon={<Code2 className="w-3 h-3" />} label={`Edit ${noun} as Markdown`} onClick={() => onEditMarkdown(entry)} />
            )}
            {entry.kind === 'page' && onMoveTo && (
              <IconButton icon={<FolderInput className="w-3 h-3" />} label={`Move ${noun} to…`} onClick={() => onMoveTo(entry)} />
            )}
            {onPreviewAsStudent && (
              <IconButton
                icon={<GraduationCap className="w-3 h-3" />}
                label={`Preview ${noun} as student`}
                onClick={() => onPreviewAsStudent(entry)}
              />
            )}
            <IconButton icon={<Trash2 className="w-3 h-3" />} label={`Delete ${noun}`} onClick={() => onDelete(entry)} variant="danger" />
          </div>
        );
      })}
    </>
  );
};

export { collectHeadings };
