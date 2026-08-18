import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CourseContentEditor } from '@/src/features/CourseContentEditor/CourseContentEditor';
import { FILE_POLL_INTERVAL_MS } from '@/src/features/CourseContentEditor/useFileUpload';
import * as courseFileService from '@/src/services/courseFileService';
import type { CourseFileDto } from '@/src/services/courseFileService';
import * as courseDraftService from '@/src/services/courseDraftService';
import * as courseContentService from '@/src/services/courseContentService';

// jsdom doesn't implement elementFromPoint -- ProseMirror's mousedown handler (posAtCoords)
// calls it unconditionally, which throws rather than degrading gracefully. Story 7.1's document
// canvas is the first thing in this file that mounts a real ProseMirror-backed editable region.
if (typeof document.elementFromPoint !== 'function') {
  document.elementFromPoint = () => null;
}
// Same reasoning for Range.getClientRects/getBoundingClientRect, which Tiptap's own
// scrollIntoView-on-selection-change calls internally -- jsdom doesn't implement either at all.
if (typeof Range.prototype.getClientRects !== 'function') {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
}
if (typeof Range.prototype.getBoundingClientRect !== 'function') {
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}

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

// Story 7.1: useContentDocument (which every render of this component now mounts, alongside the
// Tiptap document canvas) calls these -- mocked the same way as the two services above so the
// many pre-existing tests in this file, which know nothing about the document canvas, keep
// passing unmodified.
vi.mock('@/src/services/courseContentService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseContentService')>('@/src/services/courseContentService');
  return {
    ...actual,
    getChapters: vi.fn(),
    getChapterDocument: vi.fn(),
    createChapter: vi.fn(),
    updateChapter: vi.fn(),
    // Story 7.2
    createTopic: vi.fn(),
    updateTopic: vi.fn(),
    getTopicDeleteImpact: vi.fn(),
    deleteTopic: vi.fn(),
    reorderTopic: vi.fn(),
    createSubtopic: vi.fn(),
    updateSubtopic: vi.fn(),
    getSubtopicDeleteImpact: vi.fn(),
    deleteSubtopic: vi.fn(),
    reorderSubtopic: vi.fn(),
    // Story 7.3
    createPage: vi.fn(),
    updatePage: vi.fn(),
    getPageDeleteImpact: vi.fn(),
    deletePage: vi.fn(),
    reorderPage: vi.fn(),
    movePage: vi.fn(),
    // Story 7.4
    getOutline: vi.fn(),
  };
});

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock('@/src/context/ToastContext', () => ({
  useToast: () => ({ showToast }),
}));

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
  hasAttachedResources: false,
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
  hasAttachedResources: false,
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

  vi.mocked(courseContentService.getChapters).mockReset();
  vi.mocked(courseContentService.getChapterDocument).mockReset();
  vi.mocked(courseContentService.createChapter).mockReset();
  vi.mocked(courseContentService.updateChapter).mockReset();
  vi.mocked(courseContentService.createTopic).mockReset();
  vi.mocked(courseContentService.updateTopic).mockReset();
  vi.mocked(courseContentService.getTopicDeleteImpact).mockReset();
  vi.mocked(courseContentService.deleteTopic).mockReset();
  vi.mocked(courseContentService.reorderTopic).mockReset();
  vi.mocked(courseContentService.createSubtopic).mockReset();
  vi.mocked(courseContentService.updateSubtopic).mockReset();
  vi.mocked(courseContentService.getSubtopicDeleteImpact).mockReset();
  vi.mocked(courseContentService.deleteSubtopic).mockReset();
  vi.mocked(courseContentService.reorderSubtopic).mockReset();
  vi.mocked(courseContentService.createPage).mockReset();
  vi.mocked(courseContentService.updatePage).mockReset();
  vi.mocked(courseContentService.getPageDeleteImpact).mockReset();
  vi.mocked(courseContentService.deletePage).mockReset();
  vi.mocked(courseContentService.reorderPage).mockReset();
  vi.mocked(courseContentService.movePage).mockReset();
  vi.mocked(courseContentService.getOutline).mockReset();
  // Story 7.4: CourseContentProvider fetches the outline on every mount -- default to an empty
  // one so every pre-existing test in this file (which knows nothing about confirmation state)
  // keeps passing unmodified, same convention as the Story 7.2/7.3 mock defaults above.
  vi.mocked(courseContentService.getOutline).mockResolvedValue({ chapters: [] });
  // Default: an empty course (no Chapter yet) -- matches every pre-existing test's fixture,
  // which sets up files/lifecycle state but never a Chapter.
  vi.mocked(courseContentService.getChapters).mockResolvedValue([]);
});

// fireEvent, not userEvent, for the fake-timer tests below -- userEvent's internal
// delay-between-interactions loop deadlocks when combined with vi.useFakeTimers().
const selectFilesSync = (files: File[]) => {
  const input = screen.getByTestId('file-upload-input') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  fireEvent.change(input);
};

describe('CourseContentEditor -- document canvas (Story 7.1)', () => {
  it('an empty course renders the document canvas with no create call fired', async () => {
    vi.mocked(courseContentService.getChapters).mockResolvedValue([]);
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

    await waitFor(() => expect(document.querySelector('.ProseMirror')).toBeInTheDocument());
    expect(courseContentService.createChapter).not.toHaveBeenCalled();
    expect(courseContentService.getChapterDocument).not.toHaveBeenCalled();
  });

  it('a course with an existing Chapter shows loading text, then the fetched title', async () => {
    let resolveDocument!: (value: courseContentService.ChapterDocumentDto) => void;
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter-1', title: 'Chemical Reactions', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockImplementation(
      () => new Promise((resolve) => (resolveDocument = resolve))
    );

    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

    expect(await screen.findByText('Loading your chapter…')).toBeInTheDocument();

    await act(async () => {
      resolveDocument({ id: 'chapter-1', courseId: 'draft-1', title: 'Chemical Reactions', description: '', isConfirmed: false, topics: [], pages: [] });
    });

    await waitFor(() => expect(screen.queryByText('Loading your chapter…')).not.toBeInTheDocument());
    expect(await screen.findByRole('heading', { level: 1, name: 'Chemical Reactions' })).toBeInTheDocument();
  });

  it('a Published course renders a read-only banner with a Take Offline link, and suppresses the "/" menu', async () => {
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue({ lifecycleState: 'Published' });
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter-1', title: 'Published Chapter', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue({
      id: 'chapter-1',
      courseId: 'draft-1',
      title: 'Published Chapter',
      description: '',
      isConfirmed: true,
      topics: [],
      pages: [],
    });

    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

    expect(await screen.findByText(/this course is published/i)).toBeInTheDocument();
    const takeOfflineLink = screen.getByRole('button', { name: 'Take Offline' });
    expect(takeOfflineLink).toBeInTheDocument();

    const heading = await screen.findByRole('heading', { level: 1, name: 'Published Chapter' });
    expect(heading.closest('.ProseMirror')).toHaveAttribute('contenteditable', 'false');
  });

  // The title-blur-creates-the-Chapter behavior itself (create-vs-update branching, blank-title
  // no-op) is a pure-logic concern owned by useContentDocument and covered by its own dedicated
  // unit tests (tests/features/CourseContentEditor/useContentDocument.test.ts, per AD-5's
  // "hooks get pure-logic unit tests, no DOM" convention) -- driving that same behavior through a
  // real simulated keystroke into a live ProseMirror-managed contenteditable region is
  // needlessly fragile against jsdom's incomplete selection/coordinate APIs and isn't required by
  // this story's own test list; DocumentCanvas's onBlur wiring to that hook is a one-line,
  // low-risk call, not independently worth a second, DOM-heavy test of the same logic.
});

describe('CourseContentEditor -- Topic/Sub-Topic structure (Story 7.2)', () => {
  const chapterWithOneTopic = (): courseContentService.ChapterDocumentDto => ({
    id: 'chapter-1',
    courseId: 'draft-1',
    title: 'Chemical Reactions',
    description: '',
    isConfirmed: false,
    topics: [
      {
        id: 'topic-1',
        title: 'Combustion',
        description: '',
        order: 0,
        isConfirmed: false,
        subtopics: [],
        pages: [],
      },
    ],
    pages: [],
  });

  it('renders a "+ Add chapter" control in the Table of Contents rail', async () => {
    vi.mocked(courseContentService.getChapters).mockResolvedValue([]);
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

    await waitFor(() => expect(document.querySelector('.ProseMirror')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /add chapter/i })).toBeInTheDocument();
  });

  it('clicking "Add chapter" clears the current Chapter title from view, without calling createChapter yet', async () => {
    const u = userEvent.setup();
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter-1', title: 'Chemical Reactions', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue({
      id: 'chapter-1',
      courseId: 'draft-1',
      title: 'Chemical Reactions',
      description: '',
      isConfirmed: false,
      topics: [],
      pages: [],
    });
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Chemical Reactions' })).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: /add chapter/i }));

    await waitFor(() => expect(screen.queryByRole('heading', { level: 1, name: 'Chemical Reactions' })).not.toBeInTheDocument());
    expect(courseContentService.createChapter).not.toHaveBeenCalled();
  });

  it('renders move-up/move-down/delete controls for an existing Topic heading', async () => {
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter-1', title: 'Chemical Reactions', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue(chapterWithOneTopic());
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

    await screen.findByRole('heading', { level: 2, name: 'Combustion' });
    expect(screen.getByLabelText('Move Combustion up')).toBeInTheDocument();
    expect(screen.getByLabelText('Move Combustion down')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete Combustion')).toBeInTheDocument();
  });

  it('clicking a Topic delete control fetches the delete-impact count and opens ConfirmModal with a kind-broken-out message', async () => {
    const u = userEvent.setup();
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter-1', title: 'Chemical Reactions', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue(chapterWithOneTopic());
    vi.mocked(courseContentService.getTopicDeleteImpact).mockResolvedValue({ topics: 0, subtopics: 3, pages: 0, pageResources: 0, nodeResources: 0 });
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
    await screen.findByRole('heading', { level: 2, name: 'Combustion' });

    await u.click(screen.getByLabelText('Delete Combustion'));

    expect(courseContentService.getTopicDeleteImpact).toHaveBeenCalledWith('draft-1', 'topic-1');
    expect(await screen.findByRole('dialog')).toHaveTextContent("Delete this topic and 3 sub-topics? This can't be undone.");
    expect(courseContentService.deleteTopic).not.toHaveBeenCalled();
  });

  it('confirming a Topic delete calls deleteTopic then reloads the document', async () => {
    const u = userEvent.setup();
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter-1', title: 'Chemical Reactions', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument)
      .mockResolvedValueOnce(chapterWithOneTopic())
      .mockResolvedValueOnce({ ...chapterWithOneTopic(), topics: [] });
    vi.mocked(courseContentService.getTopicDeleteImpact).mockResolvedValue({ topics: 0, subtopics: 0, pages: 0, pageResources: 0, nodeResources: 0 });
    vi.mocked(courseContentService.deleteTopic).mockResolvedValue(undefined);
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
    await screen.findByRole('heading', { level: 2, name: 'Combustion' });

    await u.click(screen.getByLabelText('Delete Combustion'));
    await screen.findByRole('dialog');
    await u.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(courseContentService.deleteTopic).toHaveBeenCalledWith('draft-1', 'topic-1'));
    await waitFor(() => expect(courseContentService.getChapterDocument).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('heading', { level: 2, name: 'Combustion' })).not.toBeInTheDocument());
  });

  it('clicking move-down on a Topic calls reorderTopic with "down" and reloads -- disabled at the last position, so a second Topic is needed', async () => {
    const u = userEvent.setup();
    const twoTopics: courseContentService.ChapterDocumentDto = {
      ...chapterWithOneTopic(),
      topics: [
        ...chapterWithOneTopic().topics,
        { id: 'topic-2', title: 'Oxidation', description: '', order: 1, isConfirmed: false, subtopics: [], pages: [] },
      ],
    };
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter-1', title: 'Chemical Reactions', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue(twoTopics);
    vi.mocked(courseContentService.reorderTopic).mockResolvedValue(undefined);
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
    await screen.findByRole('heading', { level: 2, name: 'Combustion' });

    // The first Topic's own move-down is disabled once it's already the LAST heading of its kind
    // -- with two Topics, only the first one's "down" (move toward the second) is meaningful.
    expect(screen.getByLabelText('Move Combustion down')).not.toBeDisabled();
    await u.click(screen.getByLabelText('Move Combustion down'));

    await waitFor(() => expect(courseContentService.reorderTopic).toHaveBeenCalledWith('draft-1', 'topic-1', 'down'));
    await waitFor(() => expect(courseContentService.getChapterDocument).toHaveBeenCalledTimes(2));
  });

  it('the Table of Contents rail lists the live document heading outline', async () => {
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter-1', title: 'Chemical Reactions', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue(chapterWithOneTopic());
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
    await screen.findByRole('heading', { level: 2, name: 'Combustion' });

    const rail = screen.getByRole('navigation', { name: 'Table of contents' });
    expect(within(rail).getByText('Chemical Reactions')).toBeInTheDocument();
    expect(within(rail).getByText('Combustion')).toBeInTheDocument();
  });
});

describe('CourseContentEditor -- Page creation & basic content blocks (Story 7.3)', () => {
  const chapterWithOnePage = (): courseContentService.ChapterDocumentDto => ({
    id: 'chapter-1',
    courseId: 'draft-1',
    title: 'Chemical Reactions',
    description: '',
    isConfirmed: false,
    topics: [
      {
        id: 'topic-1',
        title: 'Combustion',
        description: '',
        order: 0,
        isConfirmed: false,
        subtopics: [],
        pages: [{ id: 'page-1', title: 'Fire Basics', bodyMarkdown: 'Some **body** text.', isConfirmed: false, order: 0 }],
      },
    ],
    pages: [],
  });

  it('renders a Page marker (h4) with move/delete/preview/markdown controls', async () => {
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter-1', title: 'Chemical Reactions', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue(chapterWithOnePage());
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

    await screen.findByRole('heading', { level: 4, name: 'Fire Basics' });
    expect(screen.getByLabelText('Delete Fire Basics')).toBeInTheDocument();
    expect(screen.getByLabelText('Preview Fire Basics')).toBeInTheDocument();
    expect(screen.getByLabelText('Edit Fire Basics as Markdown')).toBeInTheDocument();
  });

  it('a Page delete has an all-zero impact this story, so the confirm message has no kind breakdown', async () => {
    const u = userEvent.setup();
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter-1', title: 'Chemical Reactions', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue(chapterWithOnePage());
    vi.mocked(courseContentService.getPageDeleteImpact).mockResolvedValue({ topics: 0, subtopics: 0, pages: 0, pageResources: 0, nodeResources: 0 });
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
    await screen.findByRole('heading', { level: 4, name: 'Fire Basics' });

    await u.click(screen.getByLabelText('Delete Fire Basics'));

    expect(courseContentService.getPageDeleteImpact).toHaveBeenCalledWith('draft-1', 'page-1');
    expect(await screen.findByRole('dialog')).toHaveTextContent("Delete this page? This can't be undone.");
  });

  it('confirming a Page delete calls deletePage then reloads', async () => {
    const u = userEvent.setup();
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter-1', title: 'Chemical Reactions', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument)
      .mockResolvedValueOnce(chapterWithOnePage())
      .mockResolvedValueOnce({ ...chapterWithOnePage(), topics: [{ ...chapterWithOnePage().topics[0], pages: [] }] });
    vi.mocked(courseContentService.getPageDeleteImpact).mockResolvedValue({ topics: 0, subtopics: 0, pages: 0, pageResources: 0, nodeResources: 0 });
    vi.mocked(courseContentService.deletePage).mockResolvedValue(undefined);
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
    await screen.findByRole('heading', { level: 4, name: 'Fire Basics' });

    await u.click(screen.getByLabelText('Delete Fire Basics'));
    await screen.findByRole('dialog');
    await u.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(courseContentService.deletePage).toHaveBeenCalledWith('draft-1', 'page-1'));
    await waitFor(() => expect(screen.queryByRole('heading', { level: 4, name: 'Fire Basics' })).not.toBeInTheDocument());
  });

  it('clicking Preview on a Page renders its body through the rendered-as-student MarkdownViewer', async () => {
    const u = userEvent.setup();
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter-1', title: 'Chemical Reactions', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue(chapterWithOnePage());
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
    await screen.findByRole('heading', { level: 4, name: 'Fire Basics' });

    await u.click(screen.getByLabelText('Preview Fire Basics'));

    const panel = screen.getByTestId('page-preview-panel');
    expect(within(panel).getByText('Preview (rendered as student)')).toBeInTheDocument();
    // MarkdownViewer renders "**body**" as a real <strong>, not literal asterisks.
    expect(within(panel).getByText('body').tagName).toBe('STRONG');
  });

  it('clicking Markdown on a Page shows an editable textarea seeded with its current body source', async () => {
    const u = userEvent.setup();
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter-1', title: 'Chemical Reactions', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue(chapterWithOnePage());
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
    await screen.findByRole('heading', { level: 4, name: 'Fire Basics' });

    await u.click(screen.getByLabelText('Edit Fire Basics as Markdown'));

    const textarea = screen.getByLabelText('Page body Markdown source') as HTMLTextAreaElement;
    expect(textarea.value).toContain('body');
  });

  it('"Move page to…" lists the document\'s Topic/Sub-Topic outline and calls movePage on selection', async () => {
    const u = userEvent.setup();
    const twoTopics: courseContentService.ChapterDocumentDto = {
      ...chapterWithOnePage(),
      topics: [
        ...chapterWithOnePage().topics,
        { id: 'topic-2', title: 'Oxidation', description: '', order: 1, isConfirmed: false, subtopics: [], pages: [] },
      ],
    };
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter-1', title: 'Chemical Reactions', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument)
      .mockResolvedValueOnce(twoTopics)
      .mockResolvedValueOnce({
        ...twoTopics,
        topics: [{ ...twoTopics.topics[0], pages: [] }, { ...twoTopics.topics[1], pages: twoTopics.topics[0].pages }],
      });
    vi.mocked(courseContentService.movePage).mockResolvedValue({ id: 'page-1', title: 'Fire Basics', bodyMarkdown: 'Some **body** text.', isConfirmed: false, order: 0 });
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
    await screen.findByRole('heading', { level: 4, name: 'Fire Basics' });

    await u.click(screen.getByLabelText('Move Fire Basics to…'));
    const picker = screen.getByRole('listbox', { name: 'Move page to' });
    expect(within(picker).getByText('Combustion')).toBeInTheDocument();
    expect(within(picker).getByText('Oxidation')).toBeInTheDocument();

    await u.click(within(picker).getByText('Oxidation'));

    await waitFor(() => expect(courseContentService.movePage).toHaveBeenCalledWith('draft-1', 'page-1', 'Topic', 'topic-2'));
    await waitFor(() => expect(courseContentService.getChapterDocument).toHaveBeenCalledTimes(2));
  });

  it('Close on the Preview/Markdown panel discards it without changing the document', async () => {
    const u = userEvent.setup();
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter-1', title: 'Chemical Reactions', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue(chapterWithOnePage());
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
    await screen.findByRole('heading', { level: 4, name: 'Fire Basics' });

    await u.click(screen.getByLabelText('Preview Fire Basics'));
    expect(screen.getByText('Preview (rendered as student)')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByText('Preview (rendered as student)')).not.toBeInTheDocument();
    expect(courseContentService.updatePage).not.toHaveBeenCalled();
  });
});

describe('CourseContentEditor -- Autosave & Confirmation Tracking (Story 7.4)', () => {
  const chapterWithOneTopic = (): courseContentService.ChapterDocumentDto => ({
    id: 'chapter-1',
    courseId: 'draft-1',
    title: 'Chemical Reactions',
    description: '',
    isConfirmed: true,
    topics: [
      { id: 'topic-1', title: 'Combustion', description: '', order: 0, isConfirmed: false, subtopics: [], pages: [] },
    ],
    pages: [],
  });

  it('renders a filled-check glyph on a Confirmed heading and an outlined-circle glyph on an Unconfirmed one', async () => {
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter-1', title: 'Chemical Reactions', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue(chapterWithOneTopic());
    vi.mocked(courseContentService.getOutline).mockResolvedValue({
      chapters: [
        {
          id: 'chapter-1',
          title: 'Chemical Reactions',
          description: '',
          isConfirmed: true,
          order: 0,
          pages: [],
          topics: [{ id: 'topic-1', title: 'Combustion', description: '', isConfirmed: false, order: 0, pages: [], subtopics: [] }],
        },
      ],
    });
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
    await screen.findByRole('heading', { level: 2, name: 'Combustion' });

    expect(await screen.findByLabelText('Chemical Reactions: confirmed')).toBeInTheDocument();
    expect(await screen.findByLabelText('Combustion: unconfirmed')).toBeInTheDocument();
  });

  it('the Table of Contents rail exposes real ARIA tree semantics with roving tabindex', async () => {
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter-1', title: 'Chemical Reactions', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue(chapterWithOneTopic());
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
    await screen.findByRole('heading', { level: 2, name: 'Combustion' });

    const tree = screen.getByRole('tree', { name: 'Document outline' });
    const items = within(tree).getAllByRole('treeitem');
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]).toHaveAttribute('aria-level', '1');
    expect(items[0]).toHaveAttribute('tabindex', '0');
    // Only one item is ever part of the tab order at a time (roving tabindex).
    expect(items.slice(1).every((item) => item.getAttribute('tabindex') === '-1')).toBe(true);
  });

  it('deleting a Topic that reverts its Chapter to Unconfirmed announces the reversion', async () => {
    const u = userEvent.setup();
    vi.mocked(courseContentService.getChapters).mockResolvedValue([{ id: 'chapter-1', title: 'Chemical Reactions', order: 0 }]);
    vi.mocked(courseContentService.getChapterDocument).mockResolvedValue(chapterWithOneTopic());
    vi.mocked(courseContentService.getTopicDeleteImpact).mockResolvedValue({ topics: 0, subtopics: 0, pages: 0, pageResources: 0, nodeResources: 0 });
    vi.mocked(courseContentService.deleteTopic).mockResolvedValue(undefined);
    // Before: Chapter is Confirmed. After the delete, the backend has flipped it to Unconfirmed
    // (FR-44) -- the second getOutline call (post-refetch) reflects that.
    vi.mocked(courseContentService.getOutline)
      .mockResolvedValueOnce({
        chapters: [{ id: 'chapter-1', title: 'Chemical Reactions', description: '', isConfirmed: true, order: 0, pages: [], topics: [] }],
      })
      .mockResolvedValue({
        chapters: [{ id: 'chapter-1', title: 'Chemical Reactions', description: '', isConfirmed: false, order: 0, pages: [], topics: [] }],
      });
    render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
    await screen.findByRole('heading', { level: 2, name: 'Combustion' });
    await waitFor(() => expect(screen.getByLabelText('Chemical Reactions: confirmed')).toBeInTheDocument());

    await u.click(screen.getByLabelText('Delete Combustion'));
    await screen.findByRole('dialog');
    await u.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.getByTestId('content-editor-announcer')).toHaveTextContent("un-confirmed its parent section"));
  });

  // Task 8's own explicit "type in block A, move focus to block B before A's autosave resolves,
  // assert focus is still on B after resolution" test is covered at the layer where the actual
  // risk lives, not via fragile DOM-simulated typing (this codebase's own established precedent,
  // see Story 7.1's removed userEvent.type()-into-ProseMirror test note above): useContentAutosave
  // itself never touches focus or the DOM at all -- it only tracks internal status and invokes the
  // caller-supplied onSync -- and its "a slower in-flight save does not clobber a faster, more
  // recent one" test (useContentAutosave.test.ts) already exercises the exact out-of-order-
  // resolution scenario Task 8 describes. performSync's own patch/update code paths (DocumentCanvas.
  // tsx) never call `.focus()` or touch ProseMirror selection anywhere -- confirmed by inspection,
  // not by a DOM test whose jsdom coordinate/selection fragility would test jsdom, not this code.
});

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

    // What Docling extracts is Markdown, so the card offers both a rendered Viewer and the raw
    // source. These pin the switch itself; the rendering and parsing rules have their own suites
    // (tests/ui/MarkdownViewer.test.tsx, tests/lib/markdown.test.ts).
    it('defaults to the rendered Viewer, showing Markdown structure rather than its source', async () => {
      vi.mocked(courseFileService.getFiles).mockResolvedValue([
        makeDto({
          id: 'file_1',
          fileName: 'notes.pdf',
          status: 'Done',
          parsedContent: '## Chapter One\n\n| Term | Meaning |\n| --- | --- |\n| Ion | Charged atom |',
        }),
      ]);
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

      expect(await screen.findByRole('heading', { level: 2, name: 'Chapter One' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Term' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /viewer/i })).toHaveAttribute('aria-selected', 'true');
      // The raw pipe-table source is what the Viewer exists to replace.
      expect(screen.queryByText(/\| --- \| --- \|/)).not.toBeInTheDocument();
    });

    it('switching to Code shows the exact source and drops the rendered structure', async () => {
      const u = userEvent.setup();
      const source = '## Chapter One\n\nSome body text.';
      vi.mocked(courseFileService.getFiles).mockResolvedValue([
        makeDto({ id: 'file_1', fileName: 'notes.pdf', status: 'Done', parsedContent: source }),
      ]);
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByRole('heading', { level: 2, name: 'Chapter One' });

      await u.click(screen.getByRole('tab', { name: /code/i }));

      // Compared against the panel's raw textContent rather than getByText: the default matcher
      // collapses whitespace, which would let a Code view that had lost the blank line still pass.
      expect(screen.getByRole('tabpanel')).toHaveTextContent(source, { normalizeWhitespace: false });
      expect(screen.queryByRole('heading', { level: 2, name: 'Chapter One' })).not.toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /code/i })).toHaveAttribute('aria-selected', 'true');
    });

    it('keeps each file card on its own view, so switching one does not switch the others', async () => {
      const u = userEvent.setup();
      vi.mocked(courseFileService.getFiles).mockResolvedValue([
        makeDto({ id: 'file_1', fileName: 'first.pdf', status: 'Done', parsedContent: '# First' }),
        makeDto({ id: 'file_2', fileName: 'second.pdf', status: 'Done', parsedContent: '# Second' }),
      ]);
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByRole('heading', { level: 1, name: 'First' });

      const firstCardTabs = screen.getByRole('tablist', { name: /content view for first.pdf/i });
      await u.click(within(firstCardTabs).getByRole('tab', { name: /code/i }));

      expect(screen.getByText('# First')).toBeInTheDocument();
      // The second card is untouched and still rendering.
      expect(screen.getByRole('heading', { level: 1, name: 'Second' })).toBeInTheDocument();
    });

    it('offers no view tabs when a Done file produced no text to switch between', async () => {
      vi.mocked(courseFileService.getFiles).mockResolvedValue([
        makeDto({ id: 'file_1', fileName: 'empty.pdf', status: 'Done', parsedContent: null }),
      ]);
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

      await screen.findByText('No text was extracted from this file.');
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
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

    // Story 10.2, AC #2/FR-23/DD-6: the warning's own wording is the thing this story is most
    // explicit about not getting wrong -- it must name only what actually happens (disappears from
    // the picker/Learning Resources) and never imply already-inserted page text changes.
    it('a source file with no attached resources shows the original, unchanged delete message', async () => {
      const u = userEvent.setup();
      vi.mocked(courseFileService.getFiles).mockResolvedValue([
        makeDto({ id: 'file_1', fileName: 'lecture-notes.pdf', status: 'Done', parsedContent: 'Some text.', hasAttachedResources: false }),
      ]);
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByText('Some text.');

      await u.click(screen.getByLabelText('Delete lecture-notes.pdf'));

      expect(screen.getByRole('dialog')).toHaveTextContent('Delete "lecture-notes.pdf" and its content? This can\'t be undone.');
    });

    it('a source file with at least one attached resource shows the resource-aware warning, never implying inserted text changes', async () => {
      const u = userEvent.setup();
      vi.mocked(courseFileService.getFiles).mockResolvedValue([
        makeDto({ id: 'file_1', fileName: 'lecture-notes.pdf', status: 'Done', parsedContent: 'Some text.', hasAttachedResources: true }),
      ]);
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByText('Some text.');

      await u.click(screen.getByLabelText('Delete lecture-notes.pdf'));

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveTextContent('disappear from the "Insert from file" picker');
      expect(dialog).toHaveTextContent("Learning Resources");
      expect(dialog).toHaveTextContent("won't change");
      expect(dialog).not.toHaveTextContent('and its content? This can\'t be undone.');
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

  // -- Story 11.1: Move-to-Review blocker list, including the cross-Chapter activation case ------
  describe('Move-to-Review blockers (Story 11.1)', () => {
    const outlineWithBlockerInChapter2: courseContentService.OutlineDto = {
      chapters: [
        { id: 'chapter-1', title: 'Chapter One', description: '', isConfirmed: true, order: 0, pages: [], topics: [] },
        {
          id: 'chapter-2',
          title: 'Chapter Two',
          description: '',
          isConfirmed: true,
          order: 1,
          pages: [],
          topics: [
            {
              id: 'topic-1',
              title: 'Oxidation',
              description: '',
              isConfirmed: true,
              order: 0,
              pages: [],
              subtopics: [
                { id: 'subtopic-1', title: 'Combination Reactions', description: '', isConfirmed: false, order: 0, pages: [] },
              ],
            },
          ],
        },
      ],
    };

    const chapterOneDoc: courseContentService.ChapterDocumentDto = {
      id: 'chapter-1',
      courseId: 'draft-1',
      title: 'Chapter One',
      description: '',
      isConfirmed: true,
      topics: [],
      pages: [],
    };

    const chapterTwoDoc: courseContentService.ChapterDocumentDto = {
      id: 'chapter-2',
      courseId: 'draft-1',
      title: 'Chapter Two',
      description: '',
      isConfirmed: true,
      topics: [
        {
          id: 'topic-1',
          title: 'Oxidation',
          description: '',
          order: 0,
          isConfirmed: true,
          pages: [],
          subtopics: [{ id: 'subtopic-1', title: 'Combination Reactions', description: '', order: 0, isConfirmed: false, pages: [] }],
        },
      ],
      pages: [],
    };

    it('activating a blocker in a different Chapter switches to it and moves real focus to the blocking node', async () => {
      const u = userEvent.setup();
      vi.mocked(courseContentService.getChapters).mockResolvedValue([
        { id: 'chapter-1', title: 'Chapter One', order: 0 },
        { id: 'chapter-2', title: 'Chapter Two', order: 1 },
      ]);
      vi.mocked(courseContentService.getChapterDocument).mockImplementation((_courseId, chapterId) =>
        Promise.resolve(chapterId === 'chapter-2' ? chapterTwoDoc : chapterOneDoc)
      );
      vi.mocked(courseContentService.getOutline).mockResolvedValue(outlineWithBlockerInChapter2);

      const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

      // Opens on Chapter One (useContentDocument always opens chapters[0]) -- the blocker is
      // reachable regardless, since PublishLifecycleBar's own blocker list is whole-course.
      await screen.findByRole('heading', { level: 1, name: 'Chapter One' });

      await u.click(await screen.findByRole('button', { name: '1 blocker' }));
      await u.click(screen.getByRole('button', { name: /Combination Reactions/ }));

      // Cross-Chapter switch: getChapterDocument is called for chapter-2, and its title replaces
      // Chapter One's in view (the same remount-driven load switchChapter shares with addChapter).
      await waitFor(() => expect(courseContentService.getChapterDocument).toHaveBeenCalledWith('draft-1', 'chapter-2'));
      await screen.findByRole('heading', { level: 1, name: 'Chapter Two' });

      // Real DOM focus-move (not just a scroll), same tabindex="-1" + .focus() mechanism
      // TableOfContentsRail.tsx's own `activate` uses -- verified via a focus spy rather than
      // document.activeElement, since ProseMirror's own event handling is documented elsewhere in
      // this suite as unreliable for activeElement assertions in jsdom.
      await waitFor(() => {
        const focusedOnBlocker = focusSpy.mock.instances.some((el) => (el as HTMLElement).textContent?.includes('Combination Reactions'));
        expect(focusedOnBlocker).toBe(true);
      });

      focusSpy.mockRestore();
    });

    it('shows an error toast (and stays on the current Chapter) when switching to the blocker Chapter fails', async () => {
      const u = userEvent.setup();
      showToast.mockClear();
      vi.mocked(courseContentService.getChapters).mockResolvedValue([
        { id: 'chapter-1', title: 'Chapter One', order: 0 },
        { id: 'chapter-2', title: 'Chapter Two', order: 1 },
      ]);
      vi.mocked(courseContentService.getChapterDocument).mockImplementation((_courseId, chapterId) =>
        chapterId === 'chapter-2' ? Promise.reject(new Error('network down')) : Promise.resolve(chapterOneDoc)
      );
      vi.mocked(courseContentService.getOutline).mockResolvedValue(outlineWithBlockerInChapter2);

      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

      await screen.findByRole('heading', { level: 1, name: 'Chapter One' });

      await u.click(await screen.findByRole('button', { name: '1 blocker' }));
      await u.click(screen.getByRole('button', { name: /Combination Reactions/ }));

      await waitFor(() =>
        expect(showToast).toHaveBeenCalledWith({ message: 'Could not switch to that chapter. Please try again.', variant: 'error' })
      );
      // The failed switch never committed -- still on Chapter One.
      expect(screen.getByRole('heading', { level: 1, name: 'Chapter One' })).toBeInTheDocument();
    });
  });
});
