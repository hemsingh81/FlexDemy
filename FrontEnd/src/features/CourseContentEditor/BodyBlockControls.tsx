// Story 7.3, Task 4 (AC #4): move-up/move-down, duplicate, delete, and type-conversion controls
// for a Page body's basic blocks (paragraph/bulleted list/numbered list/sub-heading/code/raw).
// Structural headings (h1-h4) and Description-zone content are excluded from this conversion set
// entirely -- this component only ever collects blocks that sit inside a Page's body (Task 3's
// h4 marker), never a Topic/Sub-Topic's own Description zone. Reuses the same React-sibling,
// coordsAtPos-positioned pattern as HeadingControls.tsx/PlusAffordanceButton.tsx (Story 7.1/7.2),
// for the same reason: living outside the editable subtree avoids corrupting a node's own
// accessible name/textContent.
import React, { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { ArrowDown, ArrowUp, Code2, Copy, Heading5, List, ListOrdered, Pilcrow, StickyNote, Trash2 } from 'lucide-react';

interface BodyBlock {
  pos: number;
  node: PMNode;
}

interface PositionedBlock extends BodyBlock {
  top: number;
}

// Walks only the document's direct top-level children (ProseMirror's `forEach`, not the
// recursive `descendants`) -- a list item's own inner paragraph must never be treated as its own
// movable/convertible top-level block. A block counts as "inside a Page body" once a level-4
// heading has been seen and before the next heading of level <= 4.
const collectBodyBlocks = (editor: Editor): BodyBlock[] => {
  const blocks: BodyBlock[] = [];
  let insidePageBody = false;
  editor.state.doc.forEach((node, offset) => {
    if (node.type.name === 'heading') {
      insidePageBody = node.attrs.level === 4;
      return;
    }
    if (insidePageBody && node.type.name !== 'descriptionZone') {
      blocks.push({ pos: offset, node });
    }
  });
  return blocks;
};

// Story 9.2, Task 5: Callout joins the conversion set for the first time (AC #5) -- Math/Table/
// Resource card deliberately do NOT (converting a Math block into a bulleted list has no sensible
// meaning the way paragraph<->bullets does).
const CONVERTIBLE_TYPES = new Set(['paragraph', 'bulletList', 'orderedList', 'heading', 'callout']);

interface BodyBlockControlsProps {
  editor: Editor | null;
}

export const BodyBlockControls: React.FC<BodyBlockControlsProps> = ({ editor }) => {
  const [blocks, setBlocks] = useState<PositionedBlock[]>([]);

  useEffect(() => {
    if (!editor) return undefined;

    const recompute = () => {
      const found = collectBodyBlocks(editor);
      const positioned = found.map((block) => {
        try {
          return { ...block, top: editor.view.coordsAtPos(block.pos).top };
        } catch {
          return { ...block, top: 0 };
        }
      });
      setBlocks(positioned);
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

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    const a = blocks[index];
    const b = blocks[targetIndex];
    const [first, second] = direction === 'up' ? [b, a] : [a, b];
    const from = first.pos;
    const to = second.pos + second.node.nodeSize;
    editor.chain().deleteRange({ from, to }).insertContentAt(from, [second.node.toJSON(), first.node.toJSON()]).run();
  };

  const duplicateBlock = (block: PositionedBlock) => {
    const after = block.pos + block.node.nodeSize;
    editor.chain().insertContentAt(after, block.node.toJSON()).run();
  };

  const deleteBlock = (block: PositionedBlock) => {
    editor.chain().deleteRange({ from: block.pos, to: block.pos + block.node.nodeSize }).run();
  };

  const convertBlock = (block: PositionedBlock, to: 'paragraph' | 'bulletList' | 'orderedList' | 'subheading' | 'callout') => {
    const chain = editor.chain().setNodeSelection(block.pos);
    if (to === 'paragraph') chain.setNode('paragraph').run();
    else if (to === 'bulletList') chain.toggleBulletList().run();
    else if (to === 'orderedList') chain.toggleOrderedList().run();
    else if (to === 'callout') chain.wrapIn('callout').run();
    else chain.setNode('heading', { level: 5 }).run();
  };

  return (
    <>
      {blocks.map((block, index) => {
        const isConvertible = CONVERTIBLE_TYPES.has(block.node.type.name);
        return (
          <div
            key={block.pos}
            data-testid={`body-block-controls-${index}`}
            style={{ position: 'fixed', top: block.top, left: 0 }}
            className="z-10 flex items-center gap-0.5 rounded-md border border-border bg-card px-0.5 py-0.5 opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100"
          >
            <button type="button" aria-label="Move block up" disabled={index === 0} onClick={() => moveBlock(index, 'up')} className="p-1 rounded text-muted-foreground hover:text-accent disabled:opacity-30 disabled:pointer-events-none">
              <ArrowUp className="w-3 h-3" />
            </button>
            <button type="button" aria-label="Move block down" disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 'down')} className="p-1 rounded text-muted-foreground hover:text-accent disabled:opacity-30 disabled:pointer-events-none">
              <ArrowDown className="w-3 h-3" />
            </button>
            <button type="button" aria-label="Duplicate block" onClick={() => duplicateBlock(block)} className="p-1 rounded text-muted-foreground hover:text-accent">
              <Copy className="w-3 h-3" />
            </button>
            {isConvertible && (
              <>
                <button type="button" aria-label="Convert to paragraph" onClick={() => convertBlock(block, 'paragraph')} className="p-1 rounded text-muted-foreground hover:text-accent">
                  <Pilcrow className="w-3 h-3" />
                </button>
                <button type="button" aria-label="Convert to bulleted list" onClick={() => convertBlock(block, 'bulletList')} className="p-1 rounded text-muted-foreground hover:text-accent">
                  <List className="w-3 h-3" />
                </button>
                <button type="button" aria-label="Convert to numbered list" onClick={() => convertBlock(block, 'orderedList')} className="p-1 rounded text-muted-foreground hover:text-accent">
                  <ListOrdered className="w-3 h-3" />
                </button>
                <button type="button" aria-label="Convert to sub-heading" onClick={() => convertBlock(block, 'subheading')} className="p-1 rounded text-muted-foreground hover:text-accent">
                  <Heading5 className="w-3 h-3" />
                </button>
                <button type="button" aria-label="Convert to callout" onClick={() => convertBlock(block, 'callout')} className="p-1 rounded text-muted-foreground hover:text-accent">
                  <StickyNote className="w-3 h-3" />
                </button>
              </>
            )}
            {block.node.type.name === 'codeBlock' && <Code2 className="w-3 h-3 text-muted-foreground" aria-hidden="true" />}
            <button type="button" aria-label="Delete block" onClick={() => deleteBlock(block)} className="p-1 rounded text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </>
  );
};

export { collectBodyBlocks };
