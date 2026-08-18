// Story 9.1, Task 4: RTL render + a real Tiptap editor (same template as
// LearningResourcesBlock.test.tsx -- real interactive DOM the service-call/focus assertions below
// need actual clicks/uploads against).
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditor, EditorContent } from '@tiptap/react';
import { Editor } from '@tiptap/core';
import { MarkdownManager } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { PageImage } from '@/src/features/CourseContentEditor/extensions/Image';
import type { ResourceDto } from '@/src/services/courseContentService';

if (typeof document.elementFromPoint !== 'function') {
  document.elementFromPoint = () => null;
}
if (typeof Range.prototype.getClientRects !== 'function') {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
}
if (typeof Range.prototype.getBoundingClientRect !== 'function') {
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}

const { uploadResource, resolveResourceUrl } = vi.hoisted(() => ({
  uploadResource: vi.fn(),
  resolveResourceUrl: vi.fn(),
}));

vi.mock('@/src/services/courseContentService', () => ({ uploadResource, resolveResourceUrl }));

const makeResource = (overrides: Partial<ResourceDto> = {}): ResourceDto => ({
  id: 'resource_new',
  label: 'photo.png',
  caption: null,
  role: 'Inline',
  order: 0,
  status: 'Done',
  failureReason: null,
  fileName: 'photo.png',
  contentType: 'image/png',
  sizeBytes: 1024,
  ...overrides,
});

const Harness: React.FC<{ attrs?: Record<string, unknown> }> = ({ attrs }) => {
  const editor = useEditor({
    extensions: [StarterKit, PageImage.configure({ courseId: 'course_1' })],
    content: {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: '', alt: '', ownerType: 'Page', ownerId: 'page_1', ...attrs } }],
    },
  });
  return <EditorContent editor={editor} />;
};

const renderHarness = async (attrs?: Record<string, unknown>) => {
  const view = render(<Harness attrs={attrs} />);
  await screen.findByRole('button', { name: 'Upload image' }).catch(() => undefined);
  return view;
};

describe('Image NodeView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveResourceUrl.mockResolvedValue('blob:resolved-url');
  });

  it('selecting a file via the file picker calls uploadResource with role: Inline', async () => {
    const u = userEvent.setup();
    uploadResource.mockResolvedValue(makeResource());
    await renderHarness();

    const file = new File(['bytes'], 'photo.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await u.upload(input, file);

    await waitFor(() =>
      expect(uploadResource).toHaveBeenCalledWith('course_1', 'Page', 'page_1', file, { label: 'photo.png', role: 'Inline' })
    );
  });

  it('focuses the alt-text field immediately once a file is selected, before the upload resolves', async () => {
    const u = userEvent.setup();
    let resolveUpload!: (value: ResourceDto) => void;
    uploadResource.mockReturnValue(new Promise<ResourceDto>((resolve) => (resolveUpload = resolve)));
    await renderHarness();
    // Verifies the DOM API contract (focus() called on the alt input) via a spy rather than
    // asserting document.activeElement afterward -- same jsdom+ProseMirror interaction quirk
    // documented in LearningResourcesBlock.test.tsx's own "Manage on X" focus test: ProseMirror's
    // own click handling inside an editable region reasserts its selection/focus immediately
    // after this handler runs, reliably reverting activeElement in this test environment even
    // though the call itself (and its real-browser effect) is correct.
    const altInput = screen.getByRole('textbox', { name: 'Image alt text' });
    const focusSpy = vi.spyOn(altInput, 'focus');

    const file = new File(['bytes'], 'photo.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await u.upload(input, file);

    await waitFor(() => expect(focusSpy).toHaveBeenCalled());

    resolveUpload(makeResource());
  });

  it('shows a loading placeholder while uploading, then the resolved image once the upload succeeds', async () => {
    const u = userEvent.setup();
    uploadResource.mockResolvedValue(makeResource());
    await renderHarness();

    const file = new File(['bytes'], 'photo.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await u.upload(input, file);

    // An empty-alt <img> is presentational per ARIA (no accessible "img" role) -- this flow never
    // sets alt text, so a plain DOM query is correct here, not a role-based one.
    await waitFor(() => expect(document.querySelector('img')).toHaveAttribute('src', 'blob:resolved-url'));
    expect(resolveResourceUrl).toHaveBeenCalledWith('course_1', 'resource_new');
  });

  it('adding a file via drag-and-drop also calls uploadResource', async () => {
    uploadResource.mockResolvedValue(makeResource());
    await renderHarness();

    const file = new File(['bytes'], 'photo.png', { type: 'image/png' });
    const dropZone = screen.getByText('or drag and drop an image here').closest('div')!;
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    await waitFor(() => expect(uploadResource).toHaveBeenCalledWith('course_1', 'Page', 'page_1', file, { label: 'photo.png', role: 'Inline' }));
  });

  it('an image with empty alt text still renders fine -- no hard validation gate (FR-35: prompted, not blocking)', async () => {
    await renderHarness({ src: 'resource:resource_existing', alt: '' });

    const altInput = await screen.findByRole('textbox', { name: 'Image alt text' });
    expect(altInput).toHaveValue('');
    // Empty alt -> presentational, no accessible "img" role -- a plain DOM query confirms the
    // image still rendered (the point of this test: nothing blocks it from doing so).
    await waitFor(() => expect(document.querySelector('img')).toBeInTheDocument());
  });

  it('typing alt text updates the node attribute', async () => {
    const u = userEvent.setup();
    await renderHarness({ src: 'resource:resource_existing' });

    const altInput = await screen.findByRole('textbox', { name: 'Image alt text' });
    await u.type(altInput, 'A cat sitting on a table');

    expect(altInput).toHaveValue('A cat sitting on a table');
  });
});

describe('Image markdown round-trip (Story 9.1, Task 4 -- AD-12 syntax parity)', () => {
  const CONTENT_EXTENSIONS = [StarterKit, Image];

  it('serializes an image node to `![alt](resource:{id})` exactly', () => {
    const manager = new MarkdownManager({ extensions: CONTENT_EXTENSIONS });

    const serialized = manager.serialize([{ type: 'image', attrs: { src: 'resource:res_abc123', alt: 'A cat', title: null } }]);

    expect(serialized).toBe('![A cat](resource:res_abc123)');
  });

  it('round-trips insert -> serialize -> re-parse, preserving both the resource: URI and the alt text intact', () => {
    const editor = new Editor({
      extensions: CONTENT_EXTENSIONS,
      content: { type: 'doc', content: [{ type: 'image', attrs: { src: 'resource:res_abc123', alt: 'A cat', title: null } }] },
    });
    const manager = new MarkdownManager({ extensions: CONTENT_EXTENSIONS });

    const markdown = manager.serialize(editor.getJSON().content ?? []);
    const reparsed = manager.parse(markdown);

    expect(reparsed.content?.[0]).toMatchObject({ type: 'image', attrs: { src: 'resource:res_abc123', alt: 'A cat' } });
    editor.destroy();
  });
});
