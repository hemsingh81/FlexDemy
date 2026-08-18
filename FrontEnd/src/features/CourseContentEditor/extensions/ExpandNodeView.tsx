// The Expand macro's authoring chrome: an editable summary/title field above the ordinary,
// fully-editable block content the node wraps.
//
// WHY THE BODY IS ALWAYS VISIBLE IN THE EDITOR (and only collapses for students):
// Confluence lets an author collapse the macro while editing. Doing the same here would mean
// hiding a region that ProseMirror still considers part of the document and still a valid
// selection target -- a cursor can land inside `display: none` content (via ArrowDown from the
// block above, Ctrl+A, or a restored selection after autosave), at which point the tutor is typing
// into something they cannot see. Guarding every one of those paths is a real amount of
// selection-mapping work for an affordance whose entire value is "see less while writing", which
// is the opposite of what an author needs. So: the editor always shows the body, labelled with how
// a student will actually meet it, and MarkdownViewer's native <details> does the real collapsing
// on the reading surface.
//
// The title lives in a plain <input> inside a contentEditable={false} region rather than as a
// nested content node -- see Expand.ts's own header for why the attribute shape was chosen over a
// two-slot <summary>/<content> schema.
import React from 'react';
import type { NodeViewProps } from '@tiptap/core';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { ChevronDown } from 'lucide-react';

export const ExpandNodeView: React.FC<NodeViewProps> = ({ node, updateAttributes }) => {
  const title = (node.attrs.title as string) ?? '';

  return (
    <NodeViewWrapper className="my-3 rounded-xl border border-border bg-muted/10">
      <div contentEditable={false} className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={title}
          onChange={(event) => updateAttributes({ title: event.target.value })}
          placeholder="Summary line, e.g. Show the full derivation"
          aria-label="Expand summary"
          className="flex-1 min-w-0 bg-transparent text-xs font-bold text-foreground focus:outline-none placeholder:font-normal placeholder:text-muted-foreground"
        />
        <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Collapsed for students</span>
      </div>
      <NodeViewContent className="px-3 py-2" />
    </NodeViewWrapper>
  );
};
