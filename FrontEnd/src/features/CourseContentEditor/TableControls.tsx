// Row/column controls for the table block. Column WIDTHS are draggable directly on the table
// (Table.configure({ resizable: true }) + the .column-resize-handle styling in index.css); this
// component covers the other half of "change the size of the table" -- adding and removing rows and
// columns, plus deleting the table outright.
//
// Positioned with the same React-sibling + coordsAtPos idiom as HeadingControls/BodyBlockControls
// rather than rendered inside the editable subtree: a toolbar living inside the table would become
// part of the table's own textContent and accessible name, and ProseMirror would try to manage it
// as document content.
//
// Only ONE toolbar is ever shown -- for the table the caret is currently inside. A per-table
// toolbar for every table in a long chapter would be permanent visual noise, and none of these
// commands mean anything without a cursor position inside a specific table anyway.
import React, { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Columns3, Grid2x2X, Rows3, Trash2 } from 'lucide-react';

interface TableControlsProps {
  editor: Editor | null;
}

// Walks up from the cursor looking for a table ancestor, returning the document position of the
// table node itself so the toolbar can be anchored to its top edge.
const findActiveTablePos = (editor: Editor): number | null => {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'table') return $from.before(depth);
  }
  return null;
};

export const TableControls: React.FC<TableControlsProps> = ({ editor }) => {
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    if (!editor) return undefined;

    const recompute = () => {
      const pos = findActiveTablePos(editor);
      if (pos === null) {
        setTop(null);
        return;
      }
      try {
        setTop(editor.view.coordsAtPos(pos).top);
      } catch {
        // coordsAtPos throws for a position mid-remeasure (a table being deleted while the caret is
        // still nominally inside it). Hiding the toolbar is the correct response -- the alternative
        // is anchoring it at 0 and having it fly to the top of the screen for a frame.
        setTop(null);
      }
    };

    recompute();
    editor.on('transaction', recompute);
    editor.on('selectionUpdate', recompute);
    return () => {
      editor.off('transaction', recompute);
      editor.off('selectionUpdate', recompute);
    };
  }, [editor]);

  if (!editor || top === null) return null;

  const actions: { label: string; icon: React.ReactNode; run: () => void }[] = [
    { label: 'Add row below', icon: <Rows3 className="w-3.5 h-3.5" />, run: () => editor.chain().focus().addRowAfter().run() },
    { label: 'Delete row', icon: <Rows3 className="w-3.5 h-3.5 opacity-50" />, run: () => editor.chain().focus().deleteRow().run() },
    { label: 'Add column right', icon: <Columns3 className="w-3.5 h-3.5" />, run: () => editor.chain().focus().addColumnAfter().run() },
    { label: 'Delete column', icon: <Columns3 className="w-3.5 h-3.5 opacity-50" />, run: () => editor.chain().focus().deleteColumn().run() },
    { label: 'Delete table', icon: <Trash2 className="w-3.5 h-3.5" />, run: () => editor.chain().focus().deleteTable().run() },
  ];

  return (
    <div
      // -2rem lifts it clear of the table's own top border rather than sitting on it.
      style={{ position: 'fixed', top: top - 34, left: 0 }}
      className="z-20 ml-10 flex items-center gap-0.5 rounded-lg border border-border bg-card shadow-sm px-1 py-0.5"
      role="toolbar"
      aria-label="Table"
    >
      <span aria-hidden="true" className="pl-1 pr-1.5 text-muted-foreground">
        <Grid2x2X className="w-3.5 h-3.5" />
      </span>
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          // onMouseDown + preventDefault, not onClick: clicking a button blurs the editor, which
          // collapses the ProseMirror selection -- and every one of these commands operates on the
          // cell the cursor is in. Without this the first click just moves focus and the command
          // runs against a stale/absent selection.
          onMouseDown={(event) => {
            event.preventDefault();
            action.run();
          }}
          aria-label={action.label}
          title={action.label}
          className="p-1.5 rounded text-muted-foreground hover:text-accent hover:bg-muted transition-colors"
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
};
