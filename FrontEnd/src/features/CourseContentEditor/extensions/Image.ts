// Story 9.1: a real Tiptap Image node (AD-9) -- `src` holds a `resource:{resourceId}` URI
// verbatim (AD-9/FR-30), never a raw storage URL. @tiptap/markdown's stock Image node already
// round-trips src/alt/title to/from `![alt](src "title")` with no custom serializer needed --
// verified directly: `manager.serialize([{type:'image', attrs:{src:'resource:abc', alt:'A cat'}}])`
// produces `![A cat](resource:abc)` byte-for-byte, and `manager.parse('![A cat](resource:abc)')`
// round-trips it back. This extension only adds the NodeView (the resolved-render + inline
// alt-text prompt, Task 2) and transient, client-only upload-state attrs that are never persisted
// through Markdown (parseHTML/renderHTML no-ops, matching StructuralHeading's own isCreating
// precedent).
//
// `courseId` is a configure()-time option (`extension.options.courseId` in the NodeView), not a
// per-node attribute -- it's schema-level and identical for every image in one editor session, so
// it applies uniformly to a freshly-inserted node AND a node rebuilt from a page's stored
// bodyMarkdown on reload (which never carries ownerType/ownerId/courseId in its Markdown
// representation at all). `ownerType`/`ownerId` ARE per-node attrs, but only ever meaningfully
// read while the node has no resourceId yet (the empty/not-yet-uploaded state) -- once `src` holds
// a real `resource:{id}`, they're never read again, so a reloaded node having them null is a
// non-issue.
//
// Deliberately NOT added to DocumentCanvas.tsx's markdownManager (the standalone parser/
// serializer used outside a live editor) -- that manager uses the plain stock `Image` instead
// (no NodeView, no courseId option needed, since it's never rendered to screen), avoiding a
// duplicate-node-name schema conflict between the two.
import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ImageNodeView } from './ImageNodeView';

export interface PageImageOptions {
  courseId: string;
}

export const PageImage = Image.extend<PageImageOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      courseId: '',
      inline: false,
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      isUploading: {
        default: false,
        parseHTML: () => false,
        renderHTML: () => ({}),
      },
      uploadFailed: {
        default: false,
        parseHTML: () => false,
        renderHTML: () => ({}),
      },
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

  addNodeView() {
    // stopEvent: true -- same reasoning as LearningResourcesBlock.ts: this NodeView's own alt-text
    // input and upload controls need to keep their own focus/click handling without ProseMirror
    // reclaiming it.
    return ReactNodeViewRenderer(ImageNodeView, { stopEvent: () => true });
  },
});
