// Story 9.2, Task 3 (AD-9): a custom Node referencing a resource already attached to *this page's*
// own Learning Resources block (Epic 8) -- never an arbitrary course-wide resource, matching
// FR-28's wording literally. Serializes to a standalone-paragraph `[label](resource:{resourceId})`
// (FR-28/FR-30/FR-31) -- the exact same "sole content of its own paragraph" shape
// lib/markdown.ts's own promotion rule (Task 1) checks for, which is what Task 4's parity test
// verifies both sides agree on.
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ResourceCardNodeView } from './ResourceCardNodeView';

export interface ResourceCardOptions {
  courseId: string;
}

export const ResourceCard = Node.create<ResourceCardOptions>({
  name: 'resourceCard',
  group: 'block',
  atom: true,
  selectable: true,

  addOptions() {
    return { courseId: '' };
  },

  addAttributes() {
    return {
      resourceId: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => ({}),
      },
      label: {
        default: '',
        parseHTML: () => '',
        renderHTML: () => ({}),
      },
      // Transient, client-only -- which page's Learning Resources block the picker (Story 8.1's
      // getResourcesByOwner) should list. Never persisted through Markdown.
      ownerType: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => ({}),
      },
      ownerId: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-resource-card]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-resource-card': '' })];
  },

  // No resourceId chosen yet -- nothing to persist (an in-progress picker never leaves a stray
  // reference in a page's saved body).
  renderMarkdown(node) {
    const resourceId = node.attrs?.resourceId as string | null | undefined;
    if (!resourceId) return '';
    const label = (node.attrs?.label as string) ?? '';
    return `[${label}](resource:${resourceId})`;
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResourceCardNodeView, { stopEvent: () => true });
  },
});
