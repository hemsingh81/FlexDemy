// Story 9.2, Task 3 (AD-9/AD-10): a real block-content container (DescriptionZone's own
// content-holding-node-with-schema-constraint pattern, no NodeView needed -- CSS-only visual
// styling, ProseMirror's native contentEditable handles the nested editing) wrapping ordinary
// block content, serializing to `> [!note]` + quoted lines (FR-28). Included in Story 7.3's
// block-type conversion set for the first time (AC #5).
//
// -- Panel-variant revision --
// Confluence offers a palette of panels (info / note / success / warning / error) rather than one
// undifferentiated note box, and a tutor writing "this is a common mistake" wants visibly different
// weight from "here is a handy shortcut". The variant is a plain node attribute, serialized into
// the existing `[!x]` marker slot -- no new Markdown syntax, and lib/markdown.ts parses the whole
// family in one branch. A bare `[!note]` written before variants existed still parses to
// variant: 'note', so nothing already authored changes meaning.
import { Node, mergeAttributes, renderNestedMarkdownContent } from '@tiptap/core';

export const CALLOUT_VARIANTS = ['note', 'info', 'tip', 'success', 'warning', 'error'] as const;
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number];

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: 'note' as CalloutVariant,
        parseHTML: (element) => {
          const raw = element.getAttribute('data-variant');
          // Anything unrecognised collapses to `note` rather than round-tripping an arbitrary
          // string into the Markdown marker, which would then fail to parse back on read.
          return (CALLOUT_VARIANTS as readonly string[]).includes(raw ?? '') ? raw : 'note';
        },
        renderHTML: (attributes) => ({ 'data-variant': attributes.variant ?? 'note' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '', class: 'callout-block' }), 0];
  },

  // Reuses @tiptap/markdown's own renderNestedMarkdownContent helper (its own doc comment shows
  // '> ' as the literal blockquote-prefix example) rather than hand-rolling child serialization
  // -- then inserts the `[!variant] ` marker into the first output line only, matching
  // lib/markdown.ts's own parse-side expectation (the marker lives on the first quoted line's
  // content, not repeated on every line).
  renderMarkdown(node, h) {
    const quoted = renderNestedMarkdownContent(node, h, '> ');
    const variant = (node.attrs.variant as CalloutVariant) ?? 'note';
    const lines = quoted.split('\n');
    if (lines.length > 0) lines[0] = lines[0].replace(/^>\s?/, `> [!${variant}] `);
    return lines.join('\n');
  },
});
