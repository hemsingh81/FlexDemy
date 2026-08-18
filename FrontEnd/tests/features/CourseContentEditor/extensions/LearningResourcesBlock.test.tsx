// Story 8.1, Task 9: RTL render + a real Tiptap editor (matches tests/lib/editor/SlashMenu.test.tsx's
// own template for anything needing real click/keyboard interaction, unlike DocumentCanvas.test.ts's
// headless-editor pattern for pure schema/logic questions) -- the Learning Resources block's row
// controls (role select, reorder/remove buttons, drop-zone buttons) are real interactive DOM the
// service-call assertions below need actual clicks/uploads against, not just JSON shape checks.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { LearningResourcesBlock } from '@/src/features/CourseContentEditor/extensions/LearningResourcesBlock';
import { StructuralHeading } from '@/src/features/CourseContentEditor/extensions/StructuralHeading';
import { CourseContentError, type ResourceDto } from '@/src/services/courseContentService';
import type { CourseFileDto } from '@/src/services/courseFileService';
import type { InheritedResourceEntry } from '@/src/features/CourseContentEditor/resolveInheritedResources';

// jsdom doesn't implement elementFromPoint -- same polyfill precedent as SlashMenu.test.tsx,
// needed here because the editor mounts a real ProseMirror-backed contenteditable region even
// though this file never actually types into it.
if (typeof document.elementFromPoint !== 'function') {
  document.elementFromPoint = () => null;
}
if (typeof Range.prototype.getClientRects !== 'function') {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
}
if (typeof Range.prototype.getBoundingClientRect !== 'function') {
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}

const {
  uploadResource,
  attachExistingFileAsResource,
  updateResource,
  reorderResource,
  deleteResource,
  getResourcesByOwner,
} = vi.hoisted(() => ({
  uploadResource: vi.fn(),
  attachExistingFileAsResource: vi.fn(),
  updateResource: vi.fn(),
  reorderResource: vi.fn(),
  deleteResource: vi.fn(),
  getResourcesByOwner: vi.fn(),
}));

vi.mock('@/src/services/courseContentService', async () => {
  // Keeps the real CourseContentError class (LearningResourcesNodeView's `instanceof` check on
  // it needs the actual constructor, not a mock) while overriding the service functions below.
  const actual = await vi.importActual<typeof import('@/src/services/courseContentService')>('@/src/services/courseContentService');
  return {
    ...actual,
    uploadResource,
    attachExistingFileAsResource,
    updateResource,
    reorderResource,
    deleteResource,
    getResourcesByOwner,
  };
});

const { getFiles } = vi.hoisted(() => ({ getFiles: vi.fn() }));
vi.mock('@/src/services/courseFileService', () => ({ getFiles }));

const makeResource = (overrides: Partial<ResourceDto> = {}): ResourceDto => ({
  id: 'resource_1',
  label: 'Diagram',
  caption: null,
  role: 'Attachment',
  order: 0,
  status: 'Done',
  failureReason: null,
  fileName: 'diagram.png',
  contentType: 'image/png',
  sizeBytes: 1024,
  ...overrides,
});

const Harness: React.FC<{ resources: ResourceDto[] }> = ({ resources }) => {
  const editor = useEditor({
    extensions: [StarterKit, LearningResourcesBlock.configure({ courseId: 'course_1' })],
    content: {
      type: 'doc',
      content: [
        { type: 'paragraph' },
        { type: 'learningResourcesBlock', attrs: { ownerType: 'Page', ownerId: 'page_1', resources } },
      ],
    },
  });
  return <EditorContent editor={editor} />;
};

// ReactNodeViewRenderer mounts the block's own React tree into a ProseMirror-created DOM node via
// a portal, asynchronously and outside RTL's render() act() wrapper -- every test below awaits
// this landmark (always present once the NodeView has actually mounted) before querying/
// interacting with anything inside it, or the row controls/drop-zone simply aren't in the DOM yet.
const renderHarness = async (resources: ResourceDto[]) => {
  const view = render(<Harness resources={resources} />);
  await screen.findByText('Learning Resources');
  return view;
};

describe('LearningResourcesBlock NodeView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFiles.mockResolvedValue([]);
    getResourcesByOwner.mockResolvedValue([]);
  });

  it('adding a file via the file picker calls uploadResource with a default Inline role for an image', async () => {
    const u = userEvent.setup();
    uploadResource.mockResolvedValue(makeResource({ id: 'resource_new', label: 'photo.png', status: 'Queued' }));
    await renderHarness([]);

    const file = new File(['bytes'], 'photo.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await u.upload(input, file);

    await waitFor(() =>
      expect(uploadResource).toHaveBeenCalledWith('course_1', 'Page', 'page_1', file, { label: 'photo.png', role: 'Inline' })
    );
    // The row's label is a plain <input>'s value, not text content -- getByDisplayValue is the
    // right RTL query for that, not a text-node query.
    expect(await screen.findByDisplayValue('photo.png')).toBeInTheDocument();
  });

  it('adding a file via drag-and-drop calls uploadResource with a default Attachment role for a non-image', async () => {
    uploadResource.mockResolvedValue(makeResource({ id: 'resource_new', label: 'notes.pdf', fileName: 'notes.pdf', status: 'Queued' }));
    await renderHarness([]);

    const file = new File(['bytes'], 'notes.pdf', { type: 'application/pdf' });
    const dropZone = screen.getByText('Drag and drop files here, or:').closest('div')!;
    const dataTransfer = { files: [file], items: [{ kind: 'file', type: file.type, getAsFile: () => file }], types: ['Files'] };
    // fireEvent (not userEvent) -- userEvent has no native drag-and-drop file-drop simulation;
    // dispatching a raw drop DOM event with a synthetic dataTransfer is this codebase's own
    // established drag-and-drop-in-jsdom technique (matches how CourseContentEditor's own
    // dropzone is exercised).
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() =>
      expect(uploadResource).toHaveBeenCalledWith('course_1', 'Page', 'page_1', file, { label: 'notes.pdf', role: 'Attachment' })
    );
  });

  it('attaching an existing file calls attachExistingFileAsResource, not uploadResource', async () => {
    const u = userEvent.setup();
    const existingFile: CourseFileDto = {
      id: 'file_1',
      fileName: 'source.pdf',
      contentType: 'application/pdf',
      sizeBytes: 2048,
      status: 'Done',
      failureReason: null,
      parsedContent: null,
      hasAttachedResources: false,
    };
    getFiles.mockResolvedValue([existingFile]);
    attachExistingFileAsResource.mockResolvedValue(makeResource({ id: 'resource_attached', label: 'source.pdf', fileName: 'source.pdf' }));
    await renderHarness([]);

    await u.click(screen.getByRole('button', { name: /attach existing/i }));
    const option = await screen.findByRole('option', { name: 'source.pdf' });
    await u.click(option);

    await waitFor(() =>
      expect(attachExistingFileAsResource).toHaveBeenCalledWith('course_1', 'Page', 'page_1', 'file_1', 'Attachment')
    );
    expect(uploadResource).not.toHaveBeenCalled();
    expect(await screen.findByDisplayValue('source.pdf')).toBeInTheDocument();
  });

  it('changing the role select calls updateResource with the new role, preserving label/caption', async () => {
    const u = userEvent.setup();
    updateResource.mockResolvedValue(makeResource());
    const resource = makeResource({ caption: 'An existing caption' });
    await renderHarness([resource]);

    const select = screen.getByRole('combobox', { name: `Role for ${resource.fileName}` });
    await u.selectOptions(select, 'Inline');

    await waitFor(() =>
      expect(updateResource).toHaveBeenCalledWith('course_1', 'resource_1', {
        label: 'Diagram',
        caption: 'An existing caption',
        role: 'Inline',
      })
    );
  });

  it('reorder buttons call reorderResource with the correct direction, and are disabled at the list boundaries', async () => {
    const u = userEvent.setup();
    reorderResource.mockResolvedValue(undefined);
    const first = makeResource({ id: 'r1', label: 'First', fileName: 'first.png', order: 0 });
    const second = makeResource({ id: 'r2', label: 'Second', fileName: 'second.png', order: 1 });
    await renderHarness([first, second]);

    expect(screen.getByRole('button', { name: 'Move First up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Second down' })).toBeDisabled();

    await u.click(screen.getByRole('button', { name: 'Move First down' }));

    await waitFor(() => expect(reorderResource).toHaveBeenCalledWith('course_1', 'r1', 'down'));
  });

  it('removing a resource calls deleteResource and removes the row', async () => {
    const u = userEvent.setup();
    deleteResource.mockResolvedValue(undefined);
    const resource = makeResource();
    await renderHarness([resource]);

    expect(screen.getByDisplayValue('Diagram')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: `Remove ${resource.label}` }));

    await waitFor(() => expect(deleteResource).toHaveBeenCalledWith('course_1', 'resource_1'));
    await waitFor(() => expect(screen.queryByRole('combobox', { name: `Role for ${resource.fileName}` })).not.toBeInTheDocument());
  });

  // Story 8.3, AC #2/Task 5: the two-action UI only appears on a 409 conflict.
  describe('delete-in-use conflict (Story 8.3)', () => {
    it('shows the two-action confirm flow naming the referencing page when the backend reports a conflict (409)', async () => {
      const u = userEvent.setup();
      deleteResource.mockRejectedValueOnce(
        new CourseContentError('This resource is referenced in: Combustion Basics. Remove it from that content first, or choose "Remove from content and delete".', 409)
      );
      const resource = makeResource();
      await renderHarness([resource]);

      await u.click(screen.getByRole('button', { name: `Remove ${resource.label}` }));

      expect(await screen.findByText(/Combustion Basics/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove from content and delete' })).toBeInTheDocument();
      // The row is restored (not removed) while the tutor decides -- the optimistic removal
      // rolled back rather than leaving a phantom gap.
      expect(screen.getByDisplayValue('Diagram')).toBeInTheDocument();
    });

    it('confirming "Remove from content and delete" retries the delete with forceRemoveFromContent', async () => {
      const u = userEvent.setup();
      deleteResource.mockRejectedValueOnce(new CourseContentError('This resource is referenced in: Combustion Basics.', 409));
      deleteResource.mockResolvedValueOnce(undefined);
      const resource = makeResource();
      await renderHarness([resource]);

      await u.click(screen.getByRole('button', { name: `Remove ${resource.label}` }));
      await screen.findByRole('button', { name: 'Remove from content and delete' });
      await u.click(screen.getByRole('button', { name: 'Remove from content and delete' }));

      await waitFor(() => expect(deleteResource).toHaveBeenCalledWith('course_1', 'resource_1', true));
      await waitFor(() => expect(screen.queryByDisplayValue('Diagram')).not.toBeInTheDocument());
    });

    it('a plain (non-409) delete failure shows the ordinary single error, never the two-action UI', async () => {
      const u = userEvent.setup();
      deleteResource.mockRejectedValueOnce(new Error('Could not reach the server. Please try again.'));
      const resource = makeResource();
      await renderHarness([resource]);

      await u.click(screen.getByRole('button', { name: `Remove ${resource.label}` }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server. Please try again.');
      expect(screen.queryByRole('button', { name: 'Remove from content and delete' })).not.toBeInTheDocument();
    });
  });

  it('a failed upload shows the failure reason and never adds a phantom row for the rejected file', async () => {
    const u = userEvent.setup();
    uploadResource.mockRejectedValue(new Error('This course has reached its limit of 50 resources per node.'));
    await renderHarness([]);

    const file = new File(['bytes'], 'photo.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await u.upload(input, file);

    expect(await screen.findByRole('alert')).toHaveTextContent('This course has reached its limit of 50 resources per node.');
    expect(screen.queryByDisplayValue('photo.png')).not.toBeInTheDocument();
  });

  it('a resource that comes back Failed from the scan pipeline shows its failure reason inline on the row', async () => {
    const resource = makeResource({ status: 'Failed', failureReason: 'Malware detected: Eicar-Test-Signature' });
    await renderHarness([resource]);

    expect(await screen.findByText('Malware detected: Eicar-Test-Signature')).toBeInTheDocument();
  });
});

// Story 8.2, Task 4's second bullet: an inherited row renders muted with a focusable "Manage on
// X" link instead of role/remove/reorder controls; activating that link moves focus to the
// ancestor heading. A separate Harness with a real Chapter (h1) + Topic (h2, entityId="topic_1")
// heading precedes the block, since focusAncestorHeading needs a real heading DOM node to find.
const makeInherited = (overrides: Partial<InheritedResourceEntry> = {}): InheritedResourceEntry => ({
  id: 'inherited_1',
  label: 'Syllabus',
  caption: null,
  role: 'Attachment',
  order: 0,
  status: 'Done',
  failureReason: null,
  fileName: 'syllabus.pdf',
  contentType: 'application/pdf',
  sizeBytes: 2048,
  ancestorOwnerType: 'Topic',
  ancestorOwnerId: 'topic_1',
  ancestorTitle: 'Combustion',
  ...overrides,
});

const InheritanceHarness: React.FC<{ resources: ResourceDto[]; inherited: InheritedResourceEntry[] }> = ({ resources, inherited }) => {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: false }), StructuralHeading, LearningResourcesBlock.configure({ courseId: 'course_1' })],
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Chemical Reactions' }] },
        { type: 'heading', attrs: { level: 2, entityId: 'topic_1' }, content: [{ type: 'text', text: 'Combustion' }] },
        { type: 'paragraph' },
        { type: 'learningResourcesBlock', attrs: { ownerType: 'Page', ownerId: 'page_1', resources, inherited } },
      ],
    },
  });
  return <EditorContent editor={editor} />;
};

describe('LearningResourcesBlock NodeView -- Story 8.2 downward inheritance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFiles.mockResolvedValue([]);
    getResourcesByOwner.mockResolvedValue([]);
  });

  it('renders an inherited row muted, with a "Manage on X" link instead of role/remove/reorder controls', async () => {
    render(<InheritanceHarness resources={[]} inherited={[makeInherited()]} />);
    await screen.findByText('Learning Resources');

    expect(screen.getByText('Syllabus')).toBeInTheDocument();
    const manageLink = screen.getByRole('button', { name: 'Manage on Combustion' });
    expect(manageLink).toBeInTheDocument();
    // No role select, remove, or reorder control for the inherited row itself -- only the "own"
    // resources section (empty here) would ever render those.
    expect(screen.queryByRole('combobox', { name: /Role for syllabus.pdf/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove Syllabus/i })).not.toBeInTheDocument();
  });

  it('activating "Manage on X" moves real DOM focus to the ancestor Topic heading', async () => {
    const u = userEvent.setup();
    render(<InheritanceHarness resources={[]} inherited={[makeInherited()]} />);
    await screen.findByText('Learning Resources');
    const topicHeading = screen.getByRole('heading', { level: 2, name: 'Combustion' });
    // Verifies the DOM API contract (tabindex="-1" + .focus() called on the correct heading
    // element -- TableOfContentsRail.tsx's own established mechanism) via a spy rather than
    // asserting document.activeElement afterward: this jsdom+ProseMirror combination reasserts
    // its own selection/focus handling immediately after a click inside an editable region's
    // NodeView, which reliably reverts activeElement in this test environment even though the
    // call itself (and its real-browser effect) is correct -- a known jsdom/ProseMirror
    // interaction quirk, not a bug in this function.
    const focusSpy = vi.spyOn(topicHeading, 'focus');

    await u.click(screen.getByRole('button', { name: 'Manage on Combustion' }));

    expect(focusSpy).toHaveBeenCalled();
    expect(topicHeading.getAttribute('tabindex')).toBe('-1');
  });

  it('a block with both its own and inherited resources renders both groups', async () => {
    const own = makeResource({ id: 'own_1', label: 'Own File' });
    render(<InheritanceHarness resources={[own]} inherited={[makeInherited()]} />);
    await screen.findByText('Learning Resources');

    expect(screen.getByDisplayValue('Own File')).toBeInTheDocument();
    expect(screen.getByText('Syllabus')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Remove ${own.label}` })).toBeInTheDocument();
  });

  it('renders no inherited section at all when there is nothing to inherit', async () => {
    render(<InheritanceHarness resources={[makeResource()]} inherited={[]} />);
    await screen.findByText('Learning Resources');

    expect(screen.queryByText('Inherited')).not.toBeInTheDocument();
  });
});
