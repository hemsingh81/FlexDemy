import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CourseContentEditor } from '@/src/features/CourseContentEditor/CourseContentEditor';
import { FILE_POLL_INTERVAL_MS } from '@/src/features/CourseContentEditor/useFileUpload';
import * as courseFileService from '@/src/services/courseFileService';
import type { CourseFileDto } from '@/src/services/courseFileService';
import * as contentTreeService from '@/src/services/contentTreeService';
import type { ChapterDto } from '@/src/services/contentTreeService';
import * as courseDraftService from '@/src/services/courseDraftService';

vi.mock('@/src/services/courseFileService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseFileService')>('@/src/services/courseFileService');
  return { ...actual, uploadFile: vi.fn(), getFiles: vi.fn() };
});

// Story 3.9/Task 4: PublishLifecycleBar's own useCourseLifecycle now calls the real backend --
// mocked here the same way as courseFileService/contentTreeService above.
vi.mock('@/src/services/courseDraftService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseDraftService')>('@/src/services/courseDraftService');
  return { ...actual, moveToReview: vi.fn(), confirmReview: vi.fn(), publishCourse: vi.fn(), getPublishStatus: vi.fn() };
});

vi.mock('@/src/services/contentTreeService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/contentTreeService')>('@/src/services/contentTreeService');
  return {
    ...actual,
    getTree: vi.fn(),
    addChapter: vi.fn(),
    addTopic: vi.fn(),
    addSubtopic: vi.fn(),
    addContentBlock: vi.fn(),
    editNodeTitle: vi.fn(),
    editContentBlock: vi.fn(),
    deleteNode: vi.fn(),
    reorderNode: vi.fn(),
    moveNode: vi.fn(),
    confirmNode: vi.fn(),
  };
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
  ...overrides,
});

// Same fixture the old mock hook's own seed tree carried (chapter_1/topic_1/subtopic_1/
// subtopic_2/topic_2/block_1..5) -- kept identical so the "Course Content tree" describe block's
// existing testid/label-based assertions below still match, now sourced from a mocked
// contentTreeService.getTree instead of the hook's own in-memory seed.
const makeInitialFixture = (): ChapterDto[] => [
  {
    id: 'chapter_1',
    title: 'Chapter 1: Waves & Chemistry',
    confirmation: 'Confirmed',
    order: 0,
    topics: [
      {
        id: 'topic_1',
        title: 'Topic 1: Wave Motion',
        confirmation: 'Unconfirmed',
        order: 0,
        contentBlocks: [],
        subtopics: [
          {
            id: 'subtopic_1',
            title: 'Subtopic 1: Introduction',
            confirmation: 'Confirmed',
            order: 0,
            contentBlocks: [
              {
                id: 'block_1',
                format: 'Text',
                confirmation: 'Confirmed',
                order: 0,
                text: 'A wave transfers energy without transferring matter.',
                lang: 'en',
                notation: null,
                imageUrl: null,
                altText: null,
              },
              {
                id: 'block_2',
                format: 'Math',
                confirmation: 'Confirmed',
                order: 1,
                text: null,
                lang: null,
                notation: 'v = f\\lambda',
                imageUrl: null,
                altText: null,
              },
            ],
          },
          {
            id: 'subtopic_2',
            title: 'Subtopic 2: तरंग गति',
            confirmation: 'Unconfirmed',
            order: 1,
            contentBlocks: [
              {
                id: 'block_3',
                format: 'Text',
                confirmation: 'Unconfirmed',
                order: 0,
                text: 'तरंग ऊर्जा को स्थानांतरित करती है, पदार्थ को नहीं।',
                lang: 'hi',
                notation: null,
                imageUrl: null,
                altText: null,
              },
              {
                id: 'block_4',
                format: 'Image',
                confirmation: 'Unconfirmed',
                order: 1,
                text: null,
                lang: null,
                notation: null,
                imageUrl: '/mock-assets/wave-diagram.png',
                altText: 'Diagram of a transverse wave showing crest and trough.',
              },
            ],
          },
        ],
      },
      {
        id: 'topic_2',
        title: 'Topic 2: Chemical Reactions',
        confirmation: 'Confirmed',
        order: 1,
        subtopics: [],
        contentBlocks: [
          {
            id: 'block_5',
            format: 'Math',
            confirmation: 'Confirmed',
            order: 0,
            text: null,
            lang: null,
            notation: '\\ce{2H2 + O2 -> 2H2O}',
            imageUrl: null,
            // Story 2.10: non-null altText here (block_2 stays null) so one fixture covers the
            // "renders role=img + aria-label" case and the other covers the "omits aria-label" case.
            altText: 'Two hydrogen molecules react with one oxygen molecule to form two water molecules.',
          },
        ],
      },
    ],
  },
];

// A minimal fake backend driving the mocked contentTreeService -- getTree always returns the
// current state of `fixture`; each mutator mock applies the same operation the real
// ContentTreeService/mock hook would, in place. Exists purely to drive this file's UI-level
// assertions end-to-end (interact -> mutate -> refetch -> re-render); the actual confirmation-
// reset/ordering business rules are already covered by ContentTreeServiceTests.cs and
// useCourseContentTree.test.ts.
// Keyed by courseId, not a single shared tree -- "resets the content tree...to a different
// draft" below depends on draft-1's edits never leaking into draft-2's own independent tree.
let fixtures: Record<string, ChapterDto[]>;

const findBlockAnywhere = (courseId: string, id: string) => {
  for (const chapter of fixtures[courseId] ?? []) {
    for (const topic of chapter.topics) {
      const inTopic = topic.contentBlocks.find((b) => b.id === id);
      if (inTopic) return inTopic;
      for (const subtopic of topic.subtopics) {
        const inSubtopic = subtopic.contentBlocks.find((b) => b.id === id);
        if (inSubtopic) return inSubtopic;
      }
    }
  }
  return undefined;
};

beforeEach(() => {
  uploadedFileSeq = 0;
  vi.mocked(courseFileService.uploadFile).mockReset();
  vi.mocked(courseFileService.getFiles).mockReset();
  vi.mocked(courseFileService.uploadFile).mockImplementation((_courseId, file) => Promise.resolve(makeDtoForFile(file)));
  vi.mocked(courseFileService.getFiles).mockResolvedValue([]);

  fixtures = { 'draft-1': makeInitialFixture(), 'draft-2': makeInitialFixture() };
  vi.mocked(contentTreeService.getTree).mockImplementation(async (courseId) => structuredClone(fixtures[courseId] ?? []));
  vi.mocked(contentTreeService.addChapter).mockImplementation(async (courseId) => fixtures[courseId][0]);
  vi.mocked(contentTreeService.addTopic).mockImplementation(async (courseId) => fixtures[courseId][0].topics[0]);
  vi.mocked(contentTreeService.addSubtopic).mockImplementation(async (courseId) => fixtures[courseId][0].topics[0].subtopics[0]);
  vi.mocked(contentTreeService.addContentBlock).mockImplementation(async (courseId) => fixtures[courseId][0].topics[0].subtopics[0].contentBlocks[0]);
  vi.mocked(contentTreeService.confirmNode).mockResolvedValue(undefined);

  vi.mocked(courseDraftService.moveToReview).mockResolvedValue(undefined);
  vi.mocked(courseDraftService.confirmReview).mockResolvedValue(undefined);
  vi.mocked(courseDraftService.publishCourse).mockResolvedValue(undefined);
  vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue({ lifecycleState: 'Draft', isPublishing: false, checklist: null });

  vi.mocked(contentTreeService.editNodeTitle).mockImplementation(async (courseId, id, title) => {
    const tree = fixtures[courseId] ?? [];
    const chapter = tree.find((c) => c.id === id);
    if (chapter) {
      chapter.title = title;
      return;
    }
    for (const c of tree) {
      const topic = c.topics.find((t) => t.id === id);
      if (topic) {
        topic.title = title;
        return;
      }
      for (const t of c.topics) {
        const subtopic = t.subtopics.find((s) => s.id === id);
        if (subtopic) {
          subtopic.title = title;
          return;
        }
      }
    }
  });

  vi.mocked(contentTreeService.editContentBlock).mockImplementation(async (courseId, id, patch) => {
    const block = findBlockAnywhere(courseId, id);
    if (!block) return;
    const isTextOnly = Object.keys(patch).every((key) => key === 'text' || key === 'lang');
    if ('text' in patch) block.text = patch.text ?? null;
    if ('lang' in patch) block.lang = patch.lang ?? null;
    if ('notation' in patch) block.notation = patch.notation ?? null;
    if ('imageUrl' in patch) block.imageUrl = patch.imageUrl ?? null;
    if ('altText' in patch) block.altText = patch.altText ?? null;
    if ('format' in patch && patch.format) block.format = patch.format;
    if (!isTextOnly && block.confirmation === 'Confirmed') block.confirmation = 'Unconfirmed';
  });

  vi.mocked(contentTreeService.deleteNode).mockImplementation(async (courseId, id) => {
    const tree = fixtures[courseId] ?? [];
    const chapterIndex = tree.findIndex((c) => c.id === id);
    if (chapterIndex !== -1) {
      tree.splice(chapterIndex, 1);
      return;
    }
    for (const chapter of tree) {
      const topicIndex = chapter.topics.findIndex((t) => t.id === id);
      if (topicIndex !== -1) {
        chapter.topics.splice(topicIndex, 1);
        return;
      }
      for (const topic of chapter.topics) {
        const blockIndex = topic.contentBlocks.findIndex((b) => b.id === id);
        if (blockIndex !== -1) {
          topic.contentBlocks.splice(blockIndex, 1);
          return;
        }
        const subtopicIndex = topic.subtopics.findIndex((s) => s.id === id);
        if (subtopicIndex !== -1) {
          topic.subtopics.splice(subtopicIndex, 1);
          return;
        }
        for (const subtopic of topic.subtopics) {
          const subBlockIndex = subtopic.contentBlocks.findIndex((b) => b.id === id);
          if (subBlockIndex !== -1) {
            subtopic.contentBlocks.splice(subBlockIndex, 1);
            return;
          }
        }
      }
    }
  });

  vi.mocked(contentTreeService.reorderNode).mockImplementation(async (courseId, id, direction) => {
    for (const chapter of fixtures[courseId] ?? []) {
      const index = chapter.topics.findIndex((t) => t.id === id);
      if (index !== -1) {
        const swapWith = direction === 'up' ? index - 1 : index + 1;
        if (swapWith >= 0 && swapWith < chapter.topics.length) {
          [chapter.topics[index], chapter.topics[swapWith]] = [chapter.topics[swapWith], chapter.topics[index]];
        }
        return;
      }
    }
  });

  vi.mocked(contentTreeService.moveNode).mockImplementation(async (courseId, draggedId, targetId) => {
    for (const chapter of fixtures[courseId] ?? []) {
      const draggedIndex = chapter.topics.findIndex((t) => t.id === draggedId);
      const targetIndex = chapter.topics.findIndex((t) => t.id === targetId);
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const [moved] = chapter.topics.splice(draggedIndex, 1);
        chapter.topics.splice(targetIndex, 0, moved);
        return;
      }
    }
  });
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

  it('resets the content tree (not just the file list) when draftId changes to a different draft', async () => {
    const u = userEvent.setup();
    const { rerender } = render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

    const titleField = within(await screen.findByTestId('tree-node-chapter_1')).getByLabelText('Chapter 1 title');
    await u.clear(titleField);
    await u.type(titleField, 'Edited for draft 1');
    await u.tab();
    await waitFor(() =>
      expect(within(screen.getByTestId('tree-node-chapter_1')).getByDisplayValue('Edited for draft 1')).toBeInTheDocument()
    );

    rerender(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-2" />);
    await waitFor(() =>
      expect(within(screen.getByTestId('tree-node-chapter_1')).getByDisplayValue('Chapter 1: Waves & Chemistry')).toBeInTheDocument()
    );
  });

  it('resets the publishing lifecycle state (Story 3.4) when draftId changes to a different draft', async () => {
    const u = userEvent.setup();
    const { rerender } = render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

    const lifecycleNav = screen.getByRole('navigation', { name: 'Course publishing lifecycle' });
    await u.click(screen.getByRole('button', { name: 'Review as Student' }));
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

      // Story 2.7/2.8's eventual "Done" outcome, surfaced here via a mocked poll response --
      // this story's own backend only ever sets Queued/Failed, but the hook's reconciliation is
      // generic over whatever status the server reports.
      vi.mocked(courseFileService.getFiles).mockResolvedValue([{ id: 'file_1', fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: 7, status: 'Done', failureReason: null }]);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FILE_POLL_INTERVAL_MS);
      });
      expect(screen.getByText('Done')).toHaveClass('bg-[#179765]/10');
    });

    it('retrying a failed file only changes that file\'s row', async () => {
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
        ['file_1', 'file_2', 'file_3'].map((id, i) => ({
          id,
          fileName: `file-${i + 1}.pdf`,
          contentType: 'application/pdf',
          sizeBytes: 7,
          status: 'Done',
          failureReason: null,
        }))
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
        { id: 'file_1', fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: 7, status: 'Failed', failureReason: 'Unsupported file type.' },
        { id: 'file_2', fileName: 'b.pdf', contentType: 'application/pdf', sizeBytes: 7, status: 'Failed', failureReason: 'Unsupported file type.' },
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

  describe('Course Content tree', () => {
    it('renders the full Chapter -> Topic -> Subtopic -> Content Block tree', async () => {
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);

      expect(within(await screen.findByTestId('tree-node-chapter_1')).getByDisplayValue('Chapter 1: Waves & Chemistry')).toBeInTheDocument();
      expect(within(screen.getByTestId('tree-node-topic_1')).getByDisplayValue('Topic 1: Wave Motion')).toBeInTheDocument();
      expect(within(screen.getByTestId('tree-node-subtopic_1')).getByDisplayValue('Subtopic 1: Introduction')).toBeInTheDocument();
      // Topic 2 carries a Content Block directly, no Subtopic.
      expect(screen.getByTestId('tree-node-block_5')).toBeInTheDocument();
    });

    it('renders KaTeX math and mhchem chemistry notation (not just avoids throwing)', async () => {
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByTestId('tree-node-chapter_1');

      const mathRendered = within(screen.getByTestId('tree-node-block_2')).getByTestId('rendered-notation-block_2');
      expect(mathRendered.querySelector('.katex')).not.toBeNull();

      const chemRendered = within(screen.getByTestId('tree-node-block_5')).getByTestId('rendered-notation-block_5');
      expect(chemRendered.querySelector('.katex')).not.toBeNull();
    });

    it('a Hindi content block carries lang="hi" on its field', async () => {
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByTestId('tree-node-chapter_1');

      const hindiField = within(screen.getByTestId('tree-node-block_3')).getByLabelText('Content block 1 text');
      expect(hindiField).toHaveAttribute('lang', 'hi');
    });

    it('deleting a Subtopic opens ConfirmModal and only deletes on confirm', async () => {
      const u = userEvent.setup();
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByTestId('tree-node-chapter_1');

      await u.click(within(screen.getByTestId('tree-node-subtopic_2')).getByLabelText(/Delete subtopic/));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await u.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByTestId('tree-node-subtopic_2')).toBeInTheDocument();

      await u.click(within(screen.getByTestId('tree-node-subtopic_2')).getByLabelText(/Delete subtopic/));
      await u.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(screen.queryByTestId('tree-node-subtopic_2')).not.toBeInTheDocument());
    });

    it('deleting a Topic opens ConfirmModal and only deletes on confirm', async () => {
      const u = userEvent.setup();
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByTestId('tree-node-chapter_1');

      await u.click(within(screen.getByTestId('tree-node-topic_2')).getByLabelText(/Delete topic/));
      await u.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(screen.queryByTestId('tree-node-topic_2')).not.toBeInTheDocument());
    });

    it('deleting a Chapter opens ConfirmModal and only deletes on confirm', async () => {
      const u = userEvent.setup();
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByTestId('tree-node-chapter_1');

      await u.click(within(screen.getByTestId('tree-node-chapter_1')).getByLabelText(/Delete chapter/));
      await u.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(screen.queryByTestId('tree-node-chapter_1')).not.toBeInTheDocument());
    });

    it('Escape cancels the delete confirmation without closing the whole editor', async () => {
      const u = userEvent.setup();
      const onClose = vi.fn();
      render(<CourseContentEditor isOpen onClose={onClose} draftId="draft-1" />);
      await screen.findByTestId('tree-node-chapter_1');

      await u.click(within(screen.getByTestId('tree-node-subtopic_2')).getByLabelText(/Delete subtopic/));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await u.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByTestId('tree-node-subtopic_2')).toBeInTheDocument(); // not deleted
      expect(screen.getByTestId('tree-node-chapter_1')).toBeInTheDocument(); // editor still open
      expect(onClose).not.toHaveBeenCalled();
    });

    it('dragging a node onto a sibling reorders it there', async () => {
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      const chapterNode = await screen.findByTestId('tree-node-chapter_1');
      const topic1Node = screen.getByTestId('tree-node-topic_1');
      const topic2Node = screen.getByTestId('tree-node-topic_2');

      const dataTransfer = {
        data: {} as Record<string, string>,
        setData(type: string, value: string) {
          this.data[type] = value;
        },
        getData(type: string) {
          return this.data[type] ?? '';
        },
        effectAllowed: '',
        dropEffect: '',
      };

      fireEvent.dragStart(topic2Node, { dataTransfer });
      fireEvent.dragOver(topic1Node, { dataTransfer });
      fireEvent.drop(topic1Node, { dataTransfer });

      await waitFor(() => {
        const topicTitleInputs = within(chapterNode).getAllByLabelText(/Topic \d title/) as HTMLInputElement[];
        expect(topicTitleInputs[0].value).toBe('Topic 2: Chemical Reactions');
      });
    });

    it('deleting a leaf Content Block deletes immediately with no modal', async () => {
      const u = userEvent.setup();
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByTestId('tree-node-chapter_1');

      await u.click(within(screen.getByTestId('tree-node-block_1')).getByLabelText(/Delete content block/));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await waitFor(() => expect(screen.queryByTestId('tree-node-block_1')).not.toBeInTheDocument());
    });

    it('keyboard move-up/move-down reorders siblings and respects boundaries', async () => {
      const u = userEvent.setup();
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      const chapterNode = await screen.findByTestId('tree-node-chapter_1');

      const topicMoveUp = within(screen.getByTestId('tree-node-topic_2')).getByLabelText(/Move topic.*up/);
      expect(topicMoveUp).toBeEnabled();
      await u.click(topicMoveUp);

      // Topic 2 is now the first Topic child under the Chapter.
      await waitFor(() => {
        const topicTitleInputs = within(chapterNode).getAllByLabelText(/Topic \d title/) as HTMLInputElement[];
        expect(topicTitleInputs[0].value).toBe('Topic 2: Chemical Reactions');
      });

      // Now at the top boundary.
      expect(within(screen.getByTestId('tree-node-topic_2')).getByLabelText(/Move topic.*up/)).toBeDisabled();
    });

    it('editing a confirmed Content Block\'s notation flips it to unconfirmed and announces the reset', async () => {
      const u = userEvent.setup();
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByTestId('tree-node-chapter_1');

      const notationField = within(screen.getByTestId('tree-node-block_2')).getByLabelText('Content block 2 notation');
      expect(within(screen.getByTestId('tree-node-block_2')).getByText('Confirmed')).toBeInTheDocument();

      await u.clear(notationField);
      await u.type(notationField, 'a^2 + b^2 = c^2');
      await u.tab(); // blur

      await waitFor(() => expect(within(screen.getByTestId('tree-node-block_2')).getByText('Unconfirmed')).toBeInTheDocument());

      await waitFor(() => expect(screen.getByTestId('content-editor-announcer').textContent).toContain('confirmation reset'), { timeout: 3000 });
    });

    it('editing a confirmed Content Block\'s plain text does NOT flip confirmation', async () => {
      const u = userEvent.setup();
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByTestId('tree-node-chapter_1');

      const textField = within(screen.getByTestId('tree-node-block_1')).getByLabelText('Content block 1 text');
      expect(within(screen.getByTestId('tree-node-block_1')).getByText('Confirmed')).toBeInTheDocument();

      await u.type(textField, ' Extra detail.');
      await u.tab();

      await waitFor(() => expect(within(screen.getByTestId('tree-node-block_1')).getByText('Confirmed')).toBeInTheDocument());
    });

    it('blurring an edited field persists it with no page-level prompt', async () => {
      const u = userEvent.setup();
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByTestId('tree-node-chapter_1');

      const titleField = within(screen.getByTestId('tree-node-chapter_1')).getByLabelText('Chapter 1 title');
      await u.clear(titleField);
      await u.type(titleField, 'Renamed Chapter');
      await u.tab();

      await waitFor(() => expect(within(screen.getByTestId('tree-node-chapter_1')).getByDisplayValue('Renamed Chapter')).toBeInTheDocument());
      expect(screen.queryByText(/leave without saving/i)).not.toBeInTheDocument();
    });

    // -- Story 2.10: alt-text a11y + format toggle -----------------------------------------------

    it('a math block with alt-text renders the notation container with role="img" and a matching aria-label', async () => {
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByTestId('tree-node-chapter_1');

      const notationContainer = within(screen.getByTestId('tree-node-block_5')).getByTestId('rendered-notation-block_5');
      expect(notationContainer).toHaveAttribute('role', 'img');
      expect(notationContainer).toHaveAttribute(
        'aria-label',
        'Two hydrogen molecules react with one oxygen molecule to form two water molecules.'
      );
    });

    it('a math block with no alt-text yet omits the aria-label attribute entirely', async () => {
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByTestId('tree-node-chapter_1');

      const notationContainer = within(screen.getByTestId('tree-node-block_2')).getByTestId('rendered-notation-block_2');
      expect(notationContainer).toHaveAttribute('role', 'img');
      // The `|| undefined` fallback must omit the attribute, not render aria-label="" -- screen
      // readers can treat an empty aria-label differently than no attribute at all.
      expect(notationContainer).not.toHaveAttribute('aria-label');
    });

    it('editing a math blocks alt-text field calls the service with an altText patch', async () => {
      const u = userEvent.setup();
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByTestId('tree-node-chapter_1');

      const altTextField = within(screen.getByTestId('tree-node-block_2')).getByLabelText('Content block 2 alt text');
      await u.type(altTextField, 'v equals f times lambda.');
      await u.tab();

      await waitFor(() =>
        expect(contentTreeService.editContentBlock).toHaveBeenCalledWith('draft-1', 'block_2', { altText: 'v equals f times lambda.' })
      );
    });

    it('the Text/Math toggle converts a Text block to Math, clearing text and preserving lang', async () => {
      const u = userEvent.setup();
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByTestId('tree-node-chapter_1');

      await u.click(within(screen.getByTestId('tree-node-block_1')).getByRole('button', { name: 'Math' }));

      await waitFor(() =>
        expect(contentTreeService.editContentBlock).toHaveBeenCalledWith('draft-1', 'block_1', { format: 'Math', text: '', lang: 'en' })
      );
    });

    // Code-review patch regression: clearing text as a side effect of the format conversion must
    // not be indistinguishable from a genuine text edit -- that previously let the backend's
    // language auto-detect silently overwrite a Hindi block's lang="hi" with "en" (detected from
    // the now-empty text) the moment it was converted to Math.
    it('the Text/Math toggle preserves a Hindi blocks lang when converting to Math', async () => {
      const u = userEvent.setup();
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByTestId('tree-node-chapter_1');

      await u.click(within(screen.getByTestId('tree-node-block_3')).getByRole('button', { name: 'Math' }));

      await waitFor(() =>
        expect(contentTreeService.editContentBlock).toHaveBeenCalledWith('draft-1', 'block_3', { format: 'Math', text: '', lang: 'hi' })
      );
    });

    it('the Text/Math toggle converts a Math block to Text, clearing notation and alt-text', async () => {
      const u = userEvent.setup();
      render(<CourseContentEditor isOpen onClose={vi.fn()} draftId="draft-1" />);
      await screen.findByTestId('tree-node-chapter_1');

      await u.click(within(screen.getByTestId('tree-node-block_2')).getByRole('button', { name: 'Text' }));

      await waitFor(() =>
        expect(contentTreeService.editContentBlock).toHaveBeenCalledWith('draft-1', 'block_2', { format: 'Text', notation: '', altText: '' })
      );
    });
  });
});
