// Story 7.3, Task 6 (AC #6): raw Markdown producing constructs the block editor can't represent
// is preserved verbatim as an uneditable "raw" block, never silently dropped. Stores the exact
// original Markdown string in a `content` attribute and renders it read-only (a bordered
// "unsupported content" card) inside the block editor.
//
// Round-trip fidelity is the entire point of this node: `renderMarkdown` must emit back the exact
// original string, never a re-normalized approximation.
//
// Automatic interception of arbitrary Markdown constructs the parser doesn't recognize (e.g. an
// HTML block, a footnote) would need this node to claim a `markdownTokenName` for every possible
// unhandled `marked` token type -- there is no documented wildcard/fallback token name in
// @tiptap/markdown 3.30.1's public API (checked against its .d.ts) for "whatever nothing else
// matched." This node is fully wired for the half of the round-trip that IS directly exercisable
// without that hook -- `manager.serialize()` on an existing RawBlock node emits its stored string
// back unchanged, byte-for-byte (tested in RawBlock.test.ts) -- and is ready for explicit
// construction (e.g. a future "paste unsupported content" flow, or a real fallback hook once
// @tiptap/markdown documents one). Auto-catching unrecognized Markdown mid-parse today is a known,
// explicit gap, not a silent one.
import { Node, mergeAttributes } from '@tiptap/core';

export const RawBlock = Node.create({
  name: 'rawBlock',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      content: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-raw-content') ?? '',
        renderHTML: (attributes) => ({ 'data-raw-content': attributes.content }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-raw-block]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-raw-block': '', class: 'raw-block' }),
      ['p', { class: 'raw-block-label' }, 'Unsupported content -- edit via Markdown view'],
      ['pre', {}, node.attrs.content],
    ];
  },

  renderMarkdown(node) {
    return (node.attrs?.content as string) ?? '';
  },
});
