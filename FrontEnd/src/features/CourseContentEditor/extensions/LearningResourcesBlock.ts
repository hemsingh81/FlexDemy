// Story 8.1 (FR-36, DESIGN.md's content-resource-block token): the "Learning Resources" block --
// generic and reusable at any owner level (Chapter/Topic/Sub-Topic/Page, AD-20's polymorphic
// OwnerType/OwnerId). This story only wires its insertion point into a Page body (pageBodyCommands
// in DocumentCanvas.tsx); Story 8.2 reuses this identical component at node level, no refactor.
//
// An atom node -- its resources aren't ProseMirror child content, they're a plain `resources`
// attribute (an array of ResourceDto). Resource rows are separate DB entities (Backend's
// Resource entity) keyed by (ownerType, ownerId), not text this block owns, so there's nothing
// for ProseMirror's own content model to manage.
//
// Deliberately excluded from bodyMarkdown's round-trip: a Resource lives in its own DB table,
// never as Markdown text. `renderMarkdown` is intentionally NOT implemented (unlike RawBlock's)
// -- this node is also deliberately left out of DocumentCanvas.tsx's CONTENT_EXTENSIONS (the
// schema shared with the standalone MarkdownManager), so it's never asked to serialize. Instead,
// DocumentCanvas.tsx's buildPageJSON reconstructs it directly from the page's own `resources`
// array (already present in PageDocumentDto, Story 8.1's Task 3), and performSync filters every
// learningResourcesBlock node out of a page's body before calling markdownManager.serialize on
// the rest. A documented, deliberate simplification following from that: since the block never
// round-trips through Markdown, its exact position within a page's prose isn't preserved across
// a reload -- it's always reconstructed at the end of the page's body. None of this story's ACs
// require exact position fidelity across a reload.
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import type { ResourceDto } from '../../../services/courseContentService';
import type { InheritedResourceEntry } from '../resolveInheritedResources';
import { LearningResourcesNodeView } from './LearningResourcesNodeView';

export interface LearningResourcesBlockOptions {
  // The live editor's own course -- stable for the lifetime of one DocumentCanvas mount, so a
  // configure()-time option (not a per-node attribute) is the right home for it, same reasoning
  // DocumentCanvas.tsx already applies to SlashCommandExtension's own getItems indirection.
  courseId: string;
}

export const LearningResourcesBlock = Node.create<LearningResourcesBlockOptions>({
  name: 'learningResourcesBlock',
  group: 'block',
  atom: true,
  selectable: true,

  addOptions() {
    return { courseId: '' };
  },

  addAttributes() {
    return {
      ownerType: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-owner-type'),
        renderHTML: (attributes) => (attributes.ownerType ? { 'data-owner-type': attributes.ownerType } : {}),
      },
      ownerId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-owner-id'),
        renderHTML: (attributes) => (attributes.ownerId ? { 'data-owner-id': attributes.ownerId } : {}),
      },
      // Seeded at insertion/doc-build time from the server's own PageDocumentDto.resources --
      // this attribute is this NodeView's single source of truth, kept fresh via
      // updateAttributes() after every CRUD action the row controls trigger.
      resources: {
        default: [] as ResourceDto[],
        parseHTML: () => [],
        renderHTML: () => ({}),
      },
      // Story 8.2: this owner's downward-inherited resources (nearest ancestor first), computed
      // by resolveInheritedResources.ts at doc-build/insertion time -- read-only display data,
      // never mutated by this block's own row controls (those only ever act on `resources` above).
      inherited: {
        default: [] as InheritedResourceEntry[],
        parseHTML: () => [],
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-learning-resources-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    // Never actually painted on screen (addNodeView below always takes over rendering) -- this
    // exists only as the schema's required DOM fallback (e.g. clipboard serialization).
    return ['div', mergeAttributes(HTMLAttributes, { 'data-learning-resources-block': '' })];
  },

  addNodeView() {
    // stopEvent: true -- without this, ProseMirror's own click/mousedown handling on this
    // NodeView's DOM (role <select>, text <input>s, and especially the inherited row's "Manage
    // on X" button, Story 8.2's Task 3) re-claims focus back onto the editor immediately after
    // this block's own handlers run (e.g. a "Manage on X" click's dom.focus() call would get
    // silently overridden). Every event inside this interactive block is this NodeView's own to
    // handle, never ProseMirror's.
    return ReactNodeViewRenderer(LearningResourcesNodeView, { stopEvent: () => true });
  },
});
