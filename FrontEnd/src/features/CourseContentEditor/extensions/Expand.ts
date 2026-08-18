// Confluence's "Expand" macro: a collapsible section with an always-visible summary line and a
// body the reader opens on demand. The single most-used Confluence block this editor was missing --
// it is how a tutor hides a worked solution, an optional deep-dive, or a long derivation without
// deleting it or pushing it onto its own page.
//
// SHAPE: the title is a plain node ATTRIBUTE, not a nested content node. A two-slot schema
// (`summary` node + `content` node, mirroring <details>/<summary>) is the more literal HTML
// analogue, but it needs a NodeView to keep the two slots editable and correctly separated, and it
// makes every existing "convert this block to that block" path (Story 7.3's conversion set) have to
// special-case a node whose first child is not ordinary block content. An attribute keeps Expand in
// the same shape as Callout -- `block+` content, no NodeView, CSS-only styling -- and the title is
// edited through its own small input in the editor chrome rather than as in-document text.
//
// SERIALIZATION: joins the existing `> [!x]` blockquote-marker family that Callout already uses,
// so no new block-level Markdown syntax is introduced and lib/markdown.ts parses both in one
// branch. `> [!expand] My title` on the first line, the body as ordinary quoted lines beneath.
// Anything that does not understand the marker degrades to a plain blockquote with its title
// visible as text -- the same graceful degradation FR-28 already specifies for callouts.
import { Node, mergeAttributes, renderNestedMarkdownContent } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ExpandNodeView } from './ExpandNodeView';

export const Expand = Node.create({
  name: 'expand',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      title: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-title') ?? '',
        renderHTML: (attributes) => ({ 'data-title': attributes.title ?? '' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-expand]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-expand': '', class: 'expand-block' }), 0];
  },

  // A content-holding NodeView (unlike Math's atom NodeView, which uses stopEvent: () => true):
  // the body must stay a normal editable ProseMirror region, so events are deliberately NOT
  // swallowed here -- only the title <input> sits behind contentEditable={false}.
  addNodeView() {
    return ReactNodeViewRenderer(ExpandNodeView);
  },

  renderMarkdown(node, h) {
    const title = ((node.attrs.title as string) ?? '').trim();
    const quoted = renderNestedMarkdownContent(node, h, '> ');
    // The title occupies its own first quoted line, and the body follows -- lib/markdown.ts's
    // `expand` branch reads exactly that split (title = first line after the marker, children =
    // everything after it). Callout differs deliberately: its marker shares the first line WITH
    // content, because a callout has no title.
    return [`> [!expand] ${title}`, quoted].join('\n');
  },
});
