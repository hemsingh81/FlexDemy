import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CourseContentEditor } from '@/src/features/CourseContentEditor/CourseContentEditor';
import { FILE_POLL_INTERVAL_MS } from '@/src/features/CourseContentEditor/useFileUpload';
import * as courseFileService from '@/src/services/courseFileService';
import type { CourseFileDto } from '@/src/services/courseFileService';
import * as courseDraftService from '@/src/services/courseDraftService';

vi.mock('@/src/services/courseFileService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseFileService')>('@/src/services/courseFileService');
  return { ...actual, uploadFile: vi.fn(), getFiles: vi.fn(), deleteFile: vi.fn() };
});

// PublishLifecycleBar's own useCourseLifecycle now calls the real backend -- mocked here the
// same way as courseFileService above.
vi.mock('@/src/services/courseDraftService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseDraftService')>('@/src/services/courseDraftService');
  return { ...actual, moveToReview: vi.fn(), confirmReview: vi.fn(), publishCourse: vi.fn(), getPublishStatus: vi.fn() };
});

const makeFile = (name: string) => new File(['content'], name, { type: 'application/pdf' });

let uploadedFileSeq = 0;
const makeDtoForFile = (file: File, overrides: Partial<CourseFileDto> = {}): CourseFileDto => ({
  id: `file_${++uploadedFileSeq}`,
  fileName: file.name,
  contentType: file.type,
  sizeBytes: file.size,
  status: 'Queued',
  failureReason: null,
  parsedContent: null,
  ...overrides,
});

const makeDto = (overrides: Partial<CourseFileDto> = {}): CourseFileDto => ({
  id: 'file_x',
  fileName: 'a.pdf',
  contentType: 'application/pdf',
  sizeBytes: 7,
  status: 'Done',
  failureReason: null,
  parsedContent: null,
  ...overrides,
});

beforeEach(() => {
  uploadedFileSeq = 0;
  vi.mocked(courseFileService.uploadFile).mockReset();
  vi.mocked(courseFileService.getFiles).mockReset();
  vi.mocked(courseFileService.deleteFile).mockReset();
  vi.mocked(courseFileService.uploadFile).mockImplementation((_courseId, file) => Promise.resolve(makeDtoForFile(file)));
  vi.mocked(courseFileService.getFiles).mockResolvedValue([]);
  vi.mocked(courseFileService.deleteFile).mockResolvedValue(undefined);

  vi.mocked(courseDraftService.moveToReview).mockResolvedValue(undefined);
  vi.mocked(courseDraftService.confirmReview).mockResolvedValue(undefined);
  vi.mocked(courseDraftService.publishCourse).mockResolvedValue(undefined);
  vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue({ lifecycleState: 'Draft' });
});

// fireEvent, not userEvent, for the fake-timer tests below -- userEvent's internal
// delay-between-interactions loop deadlocks when combined with vi.useFakeTimers().
const selectFilesSync = (files: File[]) => {
  const input = screen.getByTestId('file-upload-input') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  fireEvent.change(input);
};

describe('CourseContentEditor', () => {
  it('renders nothing when isOpen is false', () => {
    render(<CourseContentEditor isOpen={false} onClose={vi.fn()} draftId={null} />);
    expect(screen.queryByText('Course Content Editor')).not.toBeInTheDocument();
  });

  it('multiple selected files each render as their own independent row, not a combined bar', async () => {
    const u = userEvent.setup();
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

    await u.upload(screen.getByTestId('file-upload-input') as HTMLInputElement, [
      makeFile('chapter1.pdf'),
      makeFile('chapter2.docx'),
    ]);

    expect(screen.getByText('chapter1.pdf')).toBeInTheDocument();
    expect(screen.getByText('chapter2.docx')).toBeInTheDocument();
    // Two independent status badges -- one per file, not a single shared progress element.
    expect(screen.getAllByText('Queued')).toHaveLength(2);
  });

  // Bug fix: the dropzone previously looked like a drag-and-drop target (dashed border,
  // "+ Add files") but had zero onDrop/onDragOver wiring -- dropped files silently vanished.
  it('dragging and dropping files onto the dropzone uploads them, same as the file picker', async () => {
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

    const dropzone = screen.getByRole('button', { name: /add files/i });
    await act(async () => {
      fireEvent.drop(dropzone, { dataTransfer: { files: [makeFile('dropped-chapter.pdf')] } });
    });

    expect(screen.getByText('dropped-chapter.pdf')).toBeInTheDocument();
    expect(screen.getByText('Queued')).toBeInTheDocument();
  });

  it('dropping zero files (e.g. a non-file drag) is a no-op, not an error', async () => {
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

    const dropzone = screen.getByRole('button', { name: /add files/i });
    fireEvent.drop(dropzone, { dataTransfer: { files: [] } });

    expect(courseFileService.uploadFile).not.toHaveBeenCalled();
  });

  // Real, pre-existing bug (found via live testing against a real Chromium browser): in real
  // browsers `input.files` is a *live* FileList tied to the input's own `.value` -- resetting
  // `.value` clears that same FileList object immediately, in the same synchronous tick.
  it('selecting a file via the native picker still uploads it even though real browsers clear input.files the instant .value resets', async () => {
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
    const input = screen.getByTestId('file-upload-input') as HTMLInputElement;
    const file = makeFile('picked-via-native-dialog.pdf');
    let valueWasReset = false;
    const liveFileList = {
      [Symbol.iterator]: function* () {
        if (!valueWasReset) yield file;
      },
      get length() {
        return valueWasReset ? 0 : 1;
      },
      0: file,
    } as unknown as FileList;
    Object.defineProperty(input, 'files', {
      configurable: true,
      get: () => liveFileList,
    });
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => '',
      set: () => {
        valueWasReset = true;
      },
    });

    await act(async () => {
      fireEvent.change(input);
    });

    expect(screen.getByText('picked-via-native-dialog.pdf')).toBeInTheDocument();
    expect(screen.getByText('Queued')).toBeInTheDocument();
  });

  it('shows a visible error when files are added before the course draft has been saved', async () => {
    const u = userEvent.setup();
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId={null} />);

    await u.upload(screen.getByTestId('file-upload-input') as HTMLInputElement, [makeFile('too-early.pdf')]);

    expect(await screen.findByRole('alert')).toHaveTextContent('Your course draft has not been saved yet. Please try again.');
    expect(screen.queryByText('too-early.pdf')).not.toBeInTheDocument();
    expect(courseFileService.uploadFile).not.toHaveBeenCalled();
  });

  it('resets the file list when draftId changes to a different draft', async () => {
    const u = userEvent.setup();
    const { rerender } = render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

    await u.upload(screen.getByTestId('file-upload-input') as HTMLInputElement, [makeFile('first-course.pdf')]);
    expect(screen.getByText('first-course.pdf')).toBeInTheDocument();

    rerender(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-2" />);
    expect(screen.queryByText('first-course.pdf')).not.toBeInTheDocument();
  });

  it('resets the file list when closed', async () => {
    const u = userEvent.setup();
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

    await u.upload(screen.getByTestId('file-upload-input') as HTMLInputElement, [makeFile('a-course.pdf')]);
    expect(screen.getByText('a-course.pdf')).toBeInTheDocument();

    await u.click(screen.getByLabelText('Close Course Content Editor'));
    expect(screen.queryByText('a-course.pdf')).not.toBeInTheDocument();
  });

  it('resets the publishing lifecycle state when draftId changes to a different draft', async () => {
    const u = userEvent.setup();
    const { rerender } = render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

    const lifecycleNav = screen.getByRole('navigation', { name: 'Course publishing lifecycle' });
    await u.click(screen.getByRole('button', { name: 'Move to Review' }));
    await waitFor(() => expect(lifecycleNav.querySelectorAll('[aria-current="true"]')[0].textContent).toContain('In Review'));

    // useCourseLifecycle has no effect keyed on courseId to reset its own state -- without
    // PublishLifecycleBar being keyed by draftId in CourseContentEditor.tsx, switching drafts
    // here would otherwise keep showing draft-1's "In Review" stage under draft-2's header.
    rerender(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-2" />);

    const lifecycleNavAfter = screen.getByRole('navigation', { name: 'Course publishing lifecycle' });
    expect(lifecycleNavAfter.querySelectorAll('[aria-current="true"]')[0].textContent).toContain('Draft');
  });

  describe('with fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('status badge classes follow the navy/green/red convention per state', async () => {
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await act(async () => {
        selectFilesSync([makeFile('a.pdf')]);
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByText('Queued')).toHaveClass('bg-[#143358]');

      vi.mocked(courseFileService.getFiles).mockResolvedValue([makeDto({ id: 'file_1', fileName: 'a.pdf', status: 'Done', parsedContent: 'Some text' })]);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FILE_POLL_INTERVAL_MS);
      });
      expect(screen.getByText('Done')).toHaveClass('bg-[#179765]/10');
    });

    it("retrying a failed file only changes that file's row", async () => {
      vi.mocked(courseFileService.uploadFile)
        .mockImplementationOnce((_c, file) => Promise.resolve(makeDtoForFile(file)))
        .mockImplementationOnce((_c, file) => Promise.resolve(makeDtoForFile(file)))
        .mockImplementationOnce((_c, file) => Promise.resolve(makeDtoForFile(file)))
        .mockImplementationOnce(() => Promise.reject(new courseFileService.CourseFileError('Unsupported file type.')));
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      const files = Array.from({ length: 4 }, (_, i) => makeFile(`file-${i + 1}.pdf`));
      await act(async () => {
        selectFilesSync(files);
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByText('file-4.pdf').closest('div')?.parentElement).toHaveTextContent('Failed');

      // The 3 successful uploads reach "Done" via the poll.
      vi.mocked(courseFileService.getFiles).mockResolvedValue(
        ['file_1', 'file_2', 'file_3'].map((id, i) => makeDto({ id, fileName: `file-${i + 1}.pdf`, status: 'Done' }))
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FILE_POLL_INTERVAL_MS);
      });
      expect(screen.getAllByText('Done')).toHaveLength(3);

      await act(async () => {
        fireEvent.click(screen.getByLabelText('Retry file 4: file-4.pdf'));
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByText('Queued')).toBeInTheDocument();
      // The other 3 files remain Done -- untouched by retrying the 4th.
      expect(screen.getAllByText('Done')).toHaveLength(3);
    });

    it('batches near-simultaneous status-change announcements into one aria-live update', async () => {
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await act(async () => {
        selectFilesSync([makeFile('a.pdf'), makeFile('b.pdf')]);
        await vi.advanceTimersByTimeAsync(0);
      });

      vi.mocked(courseFileService.getFiles).mockResolvedValue([
        makeDto({ id: 'file_1', fileName: 'a.pdf', status: 'Failed', failureReason: 'Unsupported file type.' }),
        makeDto({ id: 'file_2', fileName: 'b.pdf', status: 'Failed', failureReason: 'Unsupported file type.' }),
      ]);

      const announcer = screen.getByTestId('content-editor-announcer');
      // Past the poll tick AND the announcement debounce window that follows it.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FILE_POLL_INTERVAL_MS + 500);
      });

      // Both files transitioned to "failed" in the same poll response -- one batched
      // announcement mentioning both, not two separate ones.
      expect(announcer.textContent).toContain('a.pdf');
      expect(announcer.textContent).toContain('b.pdf');
    });
  });

  describe('file status badge', () => {
    it('shows a spinner on the Queued and Parsing badges, the two non-terminal statuses', async () => {
      vi.mocked(courseFileService.getFiles).mockResolvedValue([
        makeDto({ id: 'file_1', fileName: 'queued.pdf', status: 'Queued' }),
        makeDto({ id: 'file_2', fileName: 'parsing.pdf', status: 'Parsing' }),
      ]);
      const { container } = render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

      await screen.findByText('queued.pdf');
      const queuedBadge = screen.getByText('Queued').closest('span');
      const parsingBadge = screen.getByText('Parsing').closest('span');
      expect(queuedBadge?.querySelector('svg.animate-spin')).toBeInTheDocument();
      expect(parsingBadge?.querySelector('svg.animate-spin')).toBeInTheDocument();
      // Exactly these two spinners -- no stray spinner anywhere else in the file list.
      expect(container.querySelectorAll('svg.animate-spin')).toHaveLength(2);
    });

    it('shows no spinner on the terminal Done or Failed badges', async () => {
      vi.mocked(courseFileService.getFiles).mockResolvedValue([
        makeDto({ id: 'file_1', fileName: 'done.pdf', status: 'Done', parsedContent: 'text' }),
        makeDto({ id: 'file_2', fileName: 'failed.pdf', status: 'Failed', failureReason: 'Unsupported file type.' }),
      ]);
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

      // 'done.pdf' legitimately appears twice once Done (file row + its own content card header,
      // same as the 'Course Content raw-text view' describe block below) -- sync on the badge
      // text itself, which is unique, instead.
      await screen.findByText('Done');
      expect(screen.getByText('Done').closest('span')?.querySelector('svg.animate-spin')).not.toBeInTheDocument();
      expect(screen.getByText('Failed').closest('span')?.querySelector('svg.animate-spin')).not.toBeInTheDocument();
    });

    it('lets a Failed file be deleted outright, alongside Retry, with no confirm step', async () => {
      const u = userEvent.setup();
      vi.mocked(courseFileService.getFiles).mockResolvedValue([
        makeDto({ id: 'file_1', fileName: 'corrupted.pdf', status: 'Failed', failureReason: 'Could not parse this file.' }),
      ]);
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByText('corrupted.pdf');

      // Both actions available on a Failed row -- Delete doesn't replace Retry, it sits beside it.
      expect(screen.getByLabelText('Retry file 1: corrupted.pdf')).toBeInTheDocument();
      await u.click(screen.getByLabelText('Delete file 1: corrupted.pdf'));

      // No ConfirmModal -- unlike a Done file's delete (which destroys real extracted content),
      // a Failed file never had any, so this goes straight through.
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await waitFor(() => expect(courseFileService.deleteFile).toHaveBeenCalledWith('draft-1', 'file_1'));
      await waitFor(() => expect(screen.queryByText('corrupted.pdf')).not.toBeInTheDocument());
    });

    it('does not offer Delete on Queued, Parsing, or Done rows -- only Failed', async () => {
      vi.mocked(courseFileService.getFiles).mockResolvedValue([
        makeDto({ id: 'file_1', fileName: 'queued.pdf', status: 'Queued' }),
        makeDto({ id: 'file_2', fileName: 'parsing.pdf', status: 'Parsing' }),
        makeDto({ id: 'file_3', fileName: 'done.pdf', status: 'Done', parsedContent: 'text' }),
      ]);
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

      await screen.findByText('queued.pdf');
      expect(screen.queryByLabelText(/^Delete file \d+:/)).not.toBeInTheDocument();
      // Done files still get their own separate, ConfirmModal-gated delete from the Course
      // Content card below -- that one's accessible name is `Delete ${fileName}`, a distinct
      // pattern from the row-level `Delete file N: ${fileName}` this test is checking for.
      expect(screen.getByLabelText('Delete done.pdf')).toBeInTheDocument();
    });
  });

  describe('Course Content raw-text view', () => {
    it('shows each Done files raw parsed text under its file name, with no AI structuring step', async () => {
      vi.mocked(courseFileService.getFiles).mockResolvedValue([
        makeDto({ id: 'file_1', fileName: 'lecture-notes.pdf', status: 'Done', parsedContent: 'This is the raw parsed text.' }),
      ]);
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

      // "lecture-notes.pdf" legitimately appears twice -- once in the Uploaded Files list above,
      // once as the content card's own header below it.
      expect((await screen.findAllByText('lecture-notes.pdf')).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('This is the raw parsed text.')).toBeInTheDocument();
    });

    it('does not show a Course Content section while no file has reached Done', async () => {
      vi.mocked(courseFileService.getFiles).mockResolvedValue([makeDto({ id: 'file_1', status: 'Parsing', parsedContent: null })]);
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

      await screen.findByText('a.pdf');
      expect(screen.queryByText('Course Content')).not.toBeInTheDocument();
    });

    it('falls back to a placeholder message when a Done file has no extracted text', async () => {
      vi.mocked(courseFileService.getFiles).mockResolvedValue([makeDto({ id: 'file_1', fileName: 'empty.pdf', status: 'Done', parsedContent: null })]);
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

      expect(await screen.findByText('No text was extracted from this file.')).toBeInTheDocument();
    });

    it('deleting a file opens ConfirmModal and only calls deleteFile on confirm', async () => {
      const u = userEvent.setup();
      vi.mocked(courseFileService.getFiles).mockResolvedValue([
        makeDto({ id: 'file_1', fileName: 'lecture-notes.pdf', status: 'Done', parsedContent: 'Some text.' }),
      ]);
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByText('Some text.');

      await u.click(screen.getByLabelText('Delete lecture-notes.pdf'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(courseFileService.deleteFile).not.toHaveBeenCalled();

      await u.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByText('Some text.')).toBeInTheDocument();

      await u.click(screen.getByLabelText('Delete lecture-notes.pdf'));
      await u.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(courseFileService.deleteFile).toHaveBeenCalledWith('draft-1', 'file_1'));
      await waitFor(() => expect(screen.queryByText('Some text.')).not.toBeInTheDocument());
    });

    it('Escape cancels the delete confirmation without closing the whole editor', async () => {
      const u = userEvent.setup();
      const onClose = vi.fn();
      vi.mocked(courseFileService.getFiles).mockResolvedValue([
        makeDto({ id: 'file_1', fileName: 'lecture-notes.pdf', status: 'Done', parsedContent: 'Some text.' }),
      ]);
      render(<CourseContentEditor isOpen onClose={onClose} draftId="draft-1" />);
      await screen.findByText('Some text.');

      await u.click(screen.getByLabelText('Delete lecture-notes.pdf'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await u.keyboard('{Escape}');

      // ConfirmModal now fades out over EXIT_MS before actually unmounting (ConfirmModal.tsx) --
      // no longer instant.
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByText('Some text.')).toBeInTheDocument(); // not deleted
      expect(screen.getByText('Course Content Editor')).toBeInTheDocument(); // editor still open
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('screen presentation', () => {
    it('Normal is not a fixed full-viewport overlay, and keeps the bordered/rounded card shell', () => {
      const { container } = render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

      const root = container.querySelector('[aria-label="Course Content Editor"]');
      expect(root).not.toHaveClass('fixed');
      expect(root).not.toHaveClass('inset-0');
      expect(root).toHaveClass('rounded-2xl');
      expect(root).toHaveClass('border');
    });

    it('Maximize turns it into a true full-viewport takeover, above the Navbar, with no card-shell chrome', async () => {
      const u = userEvent.setup();
      const { container } = render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await u.click(screen.getByRole('button', { name: 'Maximize Course Content Editor' }));

      const root = container.querySelector('[aria-label="Course Content Editor"]');
      expect(root).toHaveClass('fixed');
      expect(root).toHaveClass('inset-0');
      expect(root).toHaveClass('z-50');
      expect(root).not.toHaveClass('rounded-2xl');
      expect(root).not.toHaveClass('border');
    });

    it('Maximize keeps the header out of the scrollable body, which becomes its own overflow-y-auto region', async () => {
      const u = userEvent.setup();
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await u.click(screen.getByRole('button', { name: 'Maximize Course Content Editor' }));

      // The header wrapper (title/Close/Maximize-Restore row + PublishLifecycleBar) lives one
      // level up from the heading itself, not on the heading's own row.
      const heading = screen.getByText('Course Content Editor');
      const headerWrapper = heading.closest('div')?.parentElement;
      expect(headerWrapper).toHaveClass('shrink-0');

      // The body content div (starting with "Uploaded Files") is the sibling scroll region.
      const uploadedFilesHeading = screen.getByText('Uploaded Files');
      const scrollRegion = uploadedFilesHeading.closest('div')?.parentElement;
      expect(scrollRegion).toHaveClass('flex-1');
      expect(scrollRegion).toHaveClass('overflow-y-auto');
    });
  });

  describe('maximize / restore', () => {
    it('defaults to Normal: centered capped-width card, no sticky header', () => {
      const { container } = render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

      const root = container.querySelector('[aria-label="Course Content Editor"]');
      expect(root).toHaveClass('max-w-4xl');
      expect(root).toHaveClass('shadow-lg');
      expect(root).not.toHaveClass('fixed');
      const heading = screen.getByText('Course Content Editor');
      expect(heading.closest('div')?.parentElement).not.toHaveClass('sticky');
      expect(screen.getByRole('button', { name: 'Maximize Course Content Editor' })).toBeInTheDocument();
    });

    it('fullWidth drops the centered max-w-4xl cap on Normal, e.g. when embedded in MyCoursesSection', () => {
      const { container } = render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" fullWidth />);

      const root = container.querySelector('[aria-label="Course Content Editor"]');
      expect(root).toHaveClass('w-full');
      expect(root).not.toHaveClass('max-w-4xl');
      // Still a bordered/shadowed Normal card otherwise -- fullWidth only changes the width rule.
      expect(root).toHaveClass('rounded-2xl');
      expect(root).toHaveClass('shadow-lg');
    });

    it('fullWidth has no effect on Maximized -- already as wide as it gets', async () => {
      const u = userEvent.setup();
      const { container } = render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" fullWidth />);

      await u.click(screen.getByRole('button', { name: 'Maximize Course Content Editor' }));

      const root = container.querySelector('[aria-label="Course Content Editor"]');
      expect(root).toHaveClass('fixed');
      expect(root).toHaveClass('inset-0');
    });

    it('clicking Maximize expands to a full-viewport takeover, no width cap', async () => {
      const u = userEvent.setup();
      const { container } = render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

      await u.click(screen.getByRole('button', { name: 'Maximize Course Content Editor' }));

      const root = container.querySelector('[aria-label="Course Content Editor"]');
      expect(root).toHaveClass('fixed');
      expect(root).toHaveClass('inset-0');
      expect(root).not.toHaveClass('max-w-4xl');
      expect(root).not.toHaveClass('shadow-lg');
      expect(screen.getByRole('button', { name: 'Restore Course Content Editor' })).toBeInTheDocument();
    });

    it('Normal and Maximized use genuinely different zoom keyframes, so the toggle actually restarts the animation', async () => {
      const u = userEvent.setup();
      const { container } = render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      const root = () => container.querySelector('[aria-label="Course Content Editor"]');

      // Normal (including the default first open): zoom-out, not fade-in-scale.
      expect(root()).toHaveClass('animate-[zoom-out_150ms_ease-out]');
      expect(root()).not.toHaveClass('animate-[fade-in-scale_150ms_ease-out]');

      await u.click(screen.getByRole('button', { name: 'Maximize Course Content Editor' }));

      // Maximized: fade-in-scale (the zoom-in direction), not zoom-out -- a genuinely different
      // class value, not the same one reapplied, which is what makes the browser restart the
      // animation on toggle instead of it only ever playing once on the very first mount.
      expect(root()).toHaveClass('animate-[fade-in-scale_150ms_ease-out]');
      expect(root()).not.toHaveClass('animate-[zoom-out_150ms_ease-out]');

      await u.click(screen.getByRole('button', { name: 'Restore Course Content Editor' }));

      expect(root()).toHaveClass('animate-[zoom-out_150ms_ease-out]');
      expect(root()).not.toHaveClass('animate-[fade-in-scale_150ms_ease-out]');
    });

    it('clicking Restore after Maximize returns to the centered Normal layout', async () => {
      const u = userEvent.setup();
      const { container } = render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await u.click(screen.getByRole('button', { name: 'Maximize Course Content Editor' }));

      await u.click(screen.getByRole('button', { name: 'Restore Course Content Editor' }));

      const root = container.querySelector('[aria-label="Course Content Editor"]');
      expect(root).toHaveClass('max-w-4xl');
      expect(root).toHaveClass('shadow-lg');
      expect(root).not.toHaveClass('fixed');
    });

    it('resets to Normal on every fresh open, not carrying over a prior Maximize', async () => {
      const u = userEvent.setup();
      const onClose = vi.fn();
      const { container, rerender } = render(<CourseContentEditor isOpen onClose={onClose} draftId="draft-1" />);
      await u.click(screen.getByRole('button', { name: 'Maximize Course Content Editor' }));

      rerender(<CourseContentEditor isOpen={false} onClose={onClose} draftId="draft-1" />);
      rerender(<CourseContentEditor isOpen onClose={onClose} draftId="draft-1" />);

      const root = container.querySelector('[aria-label="Course Content Editor"]');
      expect(root).toHaveClass('max-w-4xl');
      expect(root).not.toHaveClass('fixed');
    });
  });
});
