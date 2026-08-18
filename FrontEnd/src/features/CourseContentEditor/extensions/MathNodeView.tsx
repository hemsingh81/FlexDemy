// Story 9.2, Task 3: renders the live KaTeX preview above an editable raw-LaTeX source field --
// both visible at once (never a mode toggle), so a tutor sees the rendered result update as they
// type.
import React from 'react';
import type { NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper } from '@tiptap/react';
import { renderLatex } from '../../../lib/renderLatex';

export const MathNodeView: React.FC<NodeViewProps> = ({ node, updateAttributes }) => {
  const value = (node.attrs.value as string) ?? '';

  return (
    <NodeViewWrapper className="my-3 rounded-lg border border-border bg-muted/20 p-3" contentEditable={false}>
      <div
        className="overflow-x-auto text-center mb-2 min-h-6"
        dangerouslySetInnerHTML={{ __html: value ? renderLatex(value) : '' }}
      />
      <textarea
        value={value}
        onChange={(e) => updateAttributes({ value: e.target.value })}
        placeholder="LaTeX, e.g. E = mc^2"
        aria-label="Math source (LaTeX)"
        rows={2}
        className="w-full font-mono text-xs text-foreground bg-transparent border-t border-dashed border-border pt-2 focus:outline-none resize-y"
      />
    </NodeViewWrapper>
  );
};
