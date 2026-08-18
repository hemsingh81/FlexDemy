// Story 7.2, AD-9/AD-10's Description-zone schema constraint: the paragraph(s) immediately
// following a Topic/Sub-Topic heading, up to the next Page marker or heading, are restricted to
// paragraph/bulleted-list content only (FR-4). This is enforced by the Tiptap/ProseMirror schema
// itself, not a UI-only filter -- descriptionZone's `content` expression is the only place any
// future block type (Image, Table, Math -- Stories 9.x) would need to be added to become insertable
// here; until then, ProseMirror's own schema mechanism rejects (drops) an attempted insertion of
// any other node type into this container, it is never silently accepted then stripped on save.
//
// Lives in features/CourseContentEditor/extensions/ (not lib/editor/) -- this node is specific to
// the Course Content Editor's document schema, not a generic editor mechanism (AD-10's split).
import { Node, mergeAttributes } from '@tiptap/core';

export const DescriptionZone = Node.create({
  name: 'descriptionZone',
  group: 'block',
  content: '(paragraph|bulletList)+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-description-zone]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-description-zone': '' }), 0];
  },
});
