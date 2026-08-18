// Story 7.2/7.3: extends StarterKit's stock Heading node (level-parameterized, already relied on
// for the Chapter h1 in Story 7.1) with two extra attributes:
//  - `entityId` -- the backend Topic/Subtopic/Page id once a structural heading (h2/h3/h4) has
//    been persisted. `null` means "typed locally, not yet saved" (mirrors Story 7.1's own
//    chapterId-not-yet-created state, one level down).
//  - `isConfirmed` -- Story 7.3's Page marker (h4) Confirmed/Unconfirmed badge (DESIGN.md's
//    content-page-marker token). Unused by h1-h3/h5-h6 but harmless there.
// Both round-trip through parseHTML/renderHTML as plain data-* attributes.
import Heading from '@tiptap/extension-heading';

export const StructuralHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      entityId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-entity-id'),
        renderHTML: (attributes) => (attributes.entityId ? { 'data-entity-id': attributes.entityId } : {}),
      },
      isConfirmed: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-confirmed') === 'true',
        renderHTML: (attributes) => ({ 'data-confirmed': attributes.isConfirmed ? 'true' : 'false' }),
      },
      // Story 7.3, AD-11: a "New Page" marker shows a brief "Creating…" state until its
      // synchronous create-call resolves -- a transient, never-persisted UI flag (never sent to
      // or read from the server), not carried in ChapterDocumentDto's PageDocumentDto at all.
      isCreating: {
        default: false,
        parseHTML: () => false,
        renderHTML: (attributes) => (attributes.isCreating ? { 'data-creating': 'true' } : {}),
      },
    };
  },
});
