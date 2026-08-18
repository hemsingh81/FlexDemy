// Story 10.1, Task 4 / Story 10.2, Task 3: file list / section selection / insert-preview / commit
// behavior for the two-pane picker, plus the "Also attach this file as a resource" checkbox and its
// own independent attachExistingFileAsResource call. "Only Done files" is enforced by the caller
// (DocumentCanvas.tsx only passes its already-`doneFiles`-filtered list per AC #1's precondition,
// verified in DocumentCanvas.tsx's own wiring) -- this component's own contract is simply "renders
// exactly the files it is given," which this suite verifies directly.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InsertFromFilePicker } from '@/src/features/CourseContentEditor/InsertFromFilePicker';
import type { FileUploadEntry } from '@/src/features/CourseContentEditor/useFileUpload';
import type { ResourceDto } from '@/src/services/courseContentService';

const { attachExistingFileAsResource, showToast } = vi.hoisted(() => ({
  attachExistingFileAsResource: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('@/src/services/courseContentService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseContentService')>('@/src/services/courseContentService');
  return { ...actual, attachExistingFileAsResource };
});

vi.mock('@/src/context/ToastContext', () => ({
  useToast: () => ({ showToast }),
}));

// Real-shaped sample (mirrors the structure validated in Task 0 against real Docling output --
// see splitIntoSections.test.ts for the actual real strings pulled from the dev database): two
// top-level H2 sections, the second one a representative mixed-content section (heading +
// paragraph + list).
const SAMPLE_MARKDOWN = `## Chapter 1: Introduction

Photosynthesis is the process by which plants convert light energy into chemical energy.

## Chapter 2: Key Concepts

Chlorophyll absorbs light most efficiently in these wavelengths:

- Red light
- Blue light
- Violet light`;

const makeFile = (overrides: Partial<FileUploadEntry> = {}): FileUploadEntry => ({
  id: 'file_1',
  name: 'biology-notes.pdf',
  sizeBytes: 2048,
  status: 'done',
  parsedContent: SAMPLE_MARKDOWN,
  ...overrides,
});

const makeResource = (overrides: Partial<ResourceDto> = {}): ResourceDto => ({
  id: 'resource_1',
  label: 'biology-notes.pdf',
  caption: null,
  role: 'Attachment',
  order: 0,
  status: 'Done',
  failureReason: null,
  fileName: 'biology-notes.pdf',
  contentType: 'application/pdf',
  sizeBytes: 2048,
  ...overrides,
});

interface RenderOverrides {
  files?: FileUploadEntry[];
}

const renderPicker = (overrides: RenderOverrides = {}) => {
  const onInsert = vi.fn();
  const onResourceAttached = vi.fn();
  const onClose = vi.fn();
  render(
    <InsertFromFilePicker
      files={overrides.files ?? [makeFile()]}
      courseId="course_1"
      pageOwner={{ ownerType: 'Page', ownerId: 'page_1' }}
      onInsert={onInsert}
      onResourceAttached={onResourceAttached}
      onClose={onClose}
    />
  );
  return { onInsert, onResourceAttached, onClose };
};

describe('InsertFromFilePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The attach checkbox defaults to checked, so almost every "click Insert" test triggers this
    // call whether or not it's the thing under test -- default it to a resolved promise; the
    // handful of tests that specifically exercise attach success/failure override this themselves.
    attachExistingFileAsResource.mockResolvedValue(makeResource());
  });

  it('shows exactly the files it is given', () => {
    renderPicker({ files: [makeFile({ id: 'a', name: 'first.pdf' }), makeFile({ id: 'b', name: 'second.pdf' })] });

    expect(screen.getByRole('option', { name: 'first.pdf' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'second.pdf' })).toBeInTheDocument();
  });

  it('opening a file defaults to "Whole file" selected and previews the whole parsed content', async () => {
    const u = userEvent.setup();
    renderPicker();

    await u.click(screen.getByRole('option', { name: 'biology-notes.pdf' }));

    expect(screen.getByRole('checkbox', { name: 'Whole file' })).toBeChecked();
    expect(screen.getByRole('heading', { name: 'Chapter 1: Introduction' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chapter 2: Key Concepts' })).toBeInTheDocument();
    expect(screen.getByText('Red light')).toBeInTheDocument();
  });

  it('lists each top-level section as its own selectable checkbox', async () => {
    const u = userEvent.setup();
    renderPicker();

    await u.click(screen.getByRole('option', { name: 'biology-notes.pdf' }));

    expect(screen.getByRole('checkbox', { name: /Chapter 1: Introduction/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Chapter 2: Key Concepts/ })).toBeInTheDocument();
  });

  it('selecting a section switches off "Whole file" and updates the preview to only that section', async () => {
    const u = userEvent.setup();
    renderPicker();

    await u.click(screen.getByRole('option', { name: 'biology-notes.pdf' }));
    await u.click(screen.getByRole('checkbox', { name: /Chapter 2: Key Concepts/ }));

    expect(screen.getByRole('checkbox', { name: 'Whole file' })).not.toBeChecked();
    expect(screen.queryByText(/Photosynthesis is the process/)).not.toBeInTheDocument();
    expect(screen.getByText('Red light')).toBeInTheDocument();
  });

  it('Insert is disabled until a file (whole-file or a section) is actually selected', () => {
    renderPicker();
    expect(screen.getByRole('button', { name: 'Insert' })).toBeDisabled();
  });

  it('clicking Insert with "Whole file" selected calls onInsert with the full parsed content', async () => {
    const u = userEvent.setup();
    const { onInsert } = renderPicker();

    await u.click(screen.getByRole('option', { name: 'biology-notes.pdf' }));
    await u.click(screen.getByRole('button', { name: 'Insert' }));

    expect(onInsert).toHaveBeenCalledTimes(1);
    const inserted = onInsert.mock.calls[0][0] as string;
    expect(inserted).toContain('Chapter 1: Introduction');
    expect(inserted).toContain('Chapter 2: Key Concepts');
  });

  it('clicking Insert with one section selected calls onInsert with only that section, as genuinely ordinary Markdown (mixed heading+paragraph+list)', async () => {
    const u = userEvent.setup();
    const { onInsert } = renderPicker();

    await u.click(screen.getByRole('option', { name: 'biology-notes.pdf' }));
    await u.click(screen.getByRole('checkbox', { name: /Chapter 2: Key Concepts/ }));
    await u.click(screen.getByRole('button', { name: 'Insert' }));

    const inserted = onInsert.mock.calls[0][0] as string;
    expect(inserted).not.toContain('Chapter 1: Introduction');
    expect(inserted).toContain('## Chapter 2: Key Concepts');
    expect(inserted).toContain('Chlorophyll absorbs light');
    expect(inserted).toContain('- Red light');
  });

  it('clicking Cancel/Close calls onClose without calling onInsert', async () => {
    const u = userEvent.setup();
    const { onInsert, onClose } = renderPicker();

    await u.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onInsert).not.toHaveBeenCalled();
  });

  // -- Story 10.2, AC #1/Task 1: "Also attach this file as a resource" ---------------------------

  it('the attach checkbox defaults to checked once a file is opened', async () => {
    const u = userEvent.setup();
    renderPicker();

    await u.click(screen.getByRole('option', { name: 'biology-notes.pdf' }));

    expect(screen.getByRole('checkbox', { name: 'Also attach this file to this page as a resource' })).toBeChecked();
  });

  it('Insert with the attach checkbox left checked calls attachExistingFileAsResource for the selected file, and onResourceAttached on success', async () => {
    const u = userEvent.setup();
    attachExistingFileAsResource.mockResolvedValue(makeResource());
    const { onInsert, onResourceAttached } = renderPicker({ files: [makeFile({ id: 'file_42' })] });

    await u.click(screen.getByRole('option', { name: 'biology-notes.pdf' }));
    await u.click(screen.getByRole('button', { name: 'Insert' }));

    // Text insertion commits immediately, independent of the (async) attach call.
    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(attachExistingFileAsResource).toHaveBeenCalledWith('course_1', 'Page', 'page_1', 'file_42', 'Attachment');
    await waitFor(() => expect(onResourceAttached).toHaveBeenCalledWith('file_42', makeResource()));
  });

  it('unchecking "Also attach this file..." and inserting does not call attachExistingFileAsResource', async () => {
    const u = userEvent.setup();
    const { onInsert } = renderPicker();

    await u.click(screen.getByRole('option', { name: 'biology-notes.pdf' }));
    await u.click(screen.getByRole('checkbox', { name: 'Also attach this file to this page as a resource' }));
    await u.click(screen.getByRole('button', { name: 'Insert' }));

    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(attachExistingFileAsResource).not.toHaveBeenCalled();
  });

  it('a failed attach call shows its own error toast without discarding the already-inserted text', async () => {
    const u = userEvent.setup();
    attachExistingFileAsResource.mockRejectedValue(new Error('network error'));
    const { onInsert, onResourceAttached } = renderPicker();

    await u.click(screen.getByRole('option', { name: 'biology-notes.pdf' }));
    await u.click(screen.getByRole('button', { name: 'Insert' }));

    // The text insertion already happened -- a later attach failure must not roll it back or
    // otherwise be reflected in onInsert's own call.
    expect(onInsert).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' })));
    expect(onResourceAttached).not.toHaveBeenCalled();
  });

  it('clicking Insert closes the picker immediately, without waiting for the attach call to resolve', async () => {
    const u = userEvent.setup();
    let resolveAttach: (value: ResourceDto) => void = () => undefined;
    attachExistingFileAsResource.mockReturnValue(new Promise<ResourceDto>((resolve) => (resolveAttach = resolve)));
    const { onClose } = renderPicker();

    await u.click(screen.getByRole('option', { name: 'biology-notes.pdf' }));
    await u.click(screen.getByRole('button', { name: 'Insert' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    resolveAttach(makeResource());
  });
});
