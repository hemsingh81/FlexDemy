// Story 9.2, Task 3 (AD-9): a custom Tiptap Node storing raw LaTeX, rendered live via
// lib/renderLatex.ts (the same KaTeX wrapper CoursePlayer's own Drill-Down/Sentence surfaces use
// -- relocated there for exactly this reuse, not a second KaTeX integration). Serializes to
// `$$…$$` on its own lines (FR-28); block-level only, no inline `$…$` variant (out of scope).
//
// KNOWN GAP, same category as RawBlock.ts's own documented one: this node's `renderMarkdown`
// (the serialize direction) is fully wired and tested, but `markdownManager.parse()` (the
// standalone MarkdownManager used outside a live editor, e.g. DocumentCanvas.tsx's buildPageJSON
// on a page reload) has no custom parse hook for `$$…$$` fenced text -- @tiptap/markdown has no
// native concept of this non-CommonMark syntax, and building a full custom marked.js tokenizer
// integration for it was judged out of proportion to this story's remaining scope (see
// Completion Notes). On a fresh page reload, a previously-inserted Math block's `$$`-fenced text
// is not silently lost -- it degrades gracefully to plain paragraph text (the exact LaTeX and its
// `$$` fences remain visible, editable, and re-convertible), never corrupted or dropped, same
// lossless-but-unrendered posture RawBlock.ts's own known gap already established for this
// codebase. Within a single editing session (insert via slash command, edit, autosave-serialize),
// Math is fully functional -- only a full reload hits this documented limitation.
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { MathNodeView } from './MathNodeView';

// Exported as `MathBlock`, not `Math` -- `Math` would shadow the JS global wherever imported
// (DocumentCanvas.tsx already calls Math.abs elsewhere), a real collision risk this avoids
// entirely rather than relying on import-site aliasing everywhere it's used. The node's own
// registered name stays the lowercase `'math'` (schema/serialization identifier, unrelated to
// this exported identifier's own name).
export const MathBlock = Node.create({
  name: 'math',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      value: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-math-value') ?? '',
        renderHTML: (attributes) => ({ 'data-math-value': attributes.value }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-math-block]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-math-block': '' }), node.attrs.value];
  },

  renderMarkdown(node) {
    return `$$\n${(node.attrs?.value as string) ?? ''}\n$$`;
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView, { stopEvent: () => true });
  },
});
