// Story 9.2, Task 3 (AD-9/AD-10): a real block-content container (DescriptionZone's own
// content-holding-node-with-schema-constraint pattern, no NodeView needed -- CSS-only visual
// styling, ProseMirror's native contentEditable handles the nested editing) wrapping ordinary
// block content, serializing to `> [!note]` + quoted lines (FR-28). Included in Story 7.3's
// block-type conversion set for the first time (AC #5).
import { Node, mergeAttributes, renderNestedMarkdownContent } from '@tiptap/core';

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '', class: 'callout-block' }), 0];
  },

  // Reuses @tiptap/markdown's own renderNestedMarkdownContent helper (its own doc comment shows
  // '> ' as the literal blockquote-prefix example) rather than hand-rolling child serialization
  // -- then inserts the `[!note] ` marker into the first output line only, matching
  // lib/markdown.ts's own parse-side expectation (Task 1: the marker lives on the first quoted
  // line's content, not repeated on every line).
  renderMarkdown(node, h) {
    const quoted = renderNestedMarkdownContent(node, h, '> ');
    const lines = quoted.split('\n');
    if (lines.length > 0) lines[0] = lines[0].replace(/^>\s?/, '> [!note] ');
    return lines.join('\n');
  },
});
