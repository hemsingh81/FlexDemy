// AC #4 (Story 7.1): a "+" click affordance at the start of every empty line, visible on hover
// AND keyboard focus (never hover-only), opening the identical "/" menu without typing "/".
//
// Deliberately rendered as a real React sibling of <EditorContent>, NOT a ProseMirror decoration
// placed inside the heading/paragraph's own DOM. A decoration-based first attempt put the button
// as a DOM descendant of the heading -- browsers include a focusable descendant's own accessible
// name in its ancestor's content-based accessible name computation, which silently corrupted the
// Chapter-title heading's accessible name (e.g. "Chapter Title" + the button's own "Insert
// block" label) and polluted the heading's `textContent`. Living outside the editable subtree
// avoids both problems entirely, and lets a plain CSS :hover/:focus on the button itself do the
// "visible on hover and keyboard focus" work directly, with no ARIA workarounds needed.
import React, { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';

interface PlusAffordanceButtonProps {
  editor: Editor | null;
}

interface Position {
  top: number;
  left: number;
}

export const PlusAffordanceButton: React.FC<PlusAffordanceButtonProps> = ({ editor }) => {
  const [position, setPosition] = useState<Position | null>(null);
  const [insertPos, setInsertPos] = useState<number | null>(null);

  useEffect(() => {
    if (!editor) return undefined;

    const recompute = () => {
      const { $from } = editor.state.selection;
      const node = $from.parent;

      if (!node.isTextblock || node.content.size > 0) {
        setPosition(null);
        setInsertPos(null);
        return;
      }

      const pos = $from.pos;
      // jsdom's incomplete Range/coordsAtPos support (no real layout) means this can throw or
      // return degenerate zero coordinates in tests -- the button itself still renders and is
      // still clickable either way, only its exact pixel position is affected.
      try {
        const coords = editor.view.coordsAtPos(pos);
        setPosition({ top: coords.top, left: coords.left });
        setInsertPos(pos);
      } catch {
        setPosition({ top: 0, left: 0 });
        setInsertPos(pos);
      }
    };

    recompute();
    editor.on('selectionUpdate', recompute);
    editor.on('transaction', recompute);
    return () => {
      editor.off('selectionUpdate', recompute);
      editor.off('transaction', recompute);
    };
  }, [editor]);

  if (!editor || !position || insertPos === null) return null;

  return (
    <button
      type="button"
      aria-label="Insert block"
      style={{ position: 'fixed', top: position.top, left: position.left - 28 }}
      className="plus-affordance z-10 inline-flex items-center justify-center w-5 h-5 rounded-full border border-border bg-card text-muted-foreground opacity-0 transition-opacity hover:opacity-100 hover:text-accent hover:border-accent focus:opacity-100 focus:text-accent focus:border-accent"
      // Opens the identical menu the "/" trigger opens -- reuses the exact same code path
      // (SlashCommandExtension's Suggestion plugin watches document transactions for a "/"
      // match) rather than a second, parallel "open menu" implementation. onMouseDown (not
      // onClick) + preventDefault so the editor never loses focus/selection on click.
      onMouseDown={(event) => {
        event.preventDefault();
        editor.chain().focus().insertContentAt(insertPos, '/').run();
      }}
    >
      +
    </button>
  );
};
