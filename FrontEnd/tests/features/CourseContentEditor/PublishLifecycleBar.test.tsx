import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { PublishLifecycleBar } from '../../../src/features/CourseContentEditor/PublishLifecycleBar';
import { CourseContentProvider } from '@/src/context/CourseContentContext';
import * as courseDraftService from '@/src/services/courseDraftService';
import type { PublishStatusDto } from '@/src/services/courseDraftService';
import * as courseContentService from '@/src/services/courseContentService';
import type { OutlineDto } from '@/src/services/courseContentService';

vi.mock('@/src/services/courseDraftService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseDraftService')>('@/src/services/courseDraftService');
  return {
    ...actual,
    moveToReview: vi.fn(),
    confirmReview: vi.fn(),
    publishCourse: vi.fn(),
    getPublishStatus: vi.fn(),
    returnToDraft: vi.fn(),
    getVersions: vi.fn(),
    restoreVersion: vi.fn(),
  };
});

vi.mock('@/src/services/courseContentService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseContentService')>('@/src/services/courseContentService');
  return { ...actual, getOutline: vi.fn() };
});

const makeStatus = (overrides: Partial<PublishStatusDto> = {}): PublishStatusDto => ({
  lifecycleState: 'Draft',
  ...overrides,
});

const EMPTY_OUTLINE: OutlineDto = { chapters: [] };

// Story 11.1, Task 2: PublishLifecycleBar now reads CourseContentContext's `outline` (via
// useCourseContent()) to compute its blocker list -- every render call needs a real
// CourseContentProvider ancestor (it throws without one) and a mocked getOutline response.
const renderBar = (props: { courseId?: string; outline?: OutlineDto; onActivateBlocker?: (blocker: { id: string; chapterId: string }) => void } = {}) => {
  const { courseId = 'course_1', outline = EMPTY_OUTLINE, onActivateBlocker = vi.fn() } = props;
  vi.mocked(courseContentService.getOutline).mockResolvedValue(outline);
  render(
    <CourseContentProvider courseId={courseId}>
      <PublishLifecycleBar courseId={courseId} onActivateBlocker={onActivateBlocker} />
    </CourseContentProvider>
  );
  return { onActivateBlocker };
};

// Publish is now a single, immediate, synchronous transition -- no per-node checklist/batch, so
// this file mocks the plain HTTP calls and exercises the stage-nav/version-history/blocker UI only.
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus());
  vi.mocked(courseDraftService.moveToReview).mockResolvedValue(undefined);
  vi.mocked(courseDraftService.confirmReview).mockResolvedValue(undefined);
  vi.mocked(courseDraftService.publishCourse).mockResolvedValue(undefined);
  vi.mocked(courseDraftService.returnToDraft).mockResolvedValue(undefined);
  vi.mocked(courseDraftService.getVersions).mockResolvedValue([]);
  vi.mocked(courseDraftService.restoreVersion).mockResolvedValue(undefined);
  vi.mocked(courseContentService.getOutline).mockResolvedValue(EMPTY_OUTLINE);
});

// Drives the bar through Draft -> InReview -> ReviewConfirmed.
const advanceToReviewConfirmed = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Move to Review' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm Review' })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Review' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Publish' })).not.toBeDisabled());
};

describe('PublishLifecycleBar', () => {
  it('Publish is disabled at draft and inReview, enabled only at reviewConfirmed', async () => {
    renderBar();

    const publishButton = screen.getByRole('button', { name: 'Publish' });
    expect(publishButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Move to Review' }));
    await waitFor(() => expect(courseDraftService.moveToReview).toHaveBeenCalledWith('course_1'));
    expect(publishButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Review' }));
    await waitFor(() => expect(publishButton).not.toBeDisabled());
  });

  it('exactly one lifecycle stage carries aria-current="true", and it advances as state transitions', async () => {
    renderBar();

    const nav = screen.getByRole('navigation', { name: 'Course publishing lifecycle' });
    const currentStageText = () => {
      const current = nav.querySelectorAll('[aria-current="true"]');
      expect(current).toHaveLength(1);
      return current[0].textContent;
    };

    expect(currentStageText()).toContain('Draft');

    fireEvent.click(screen.getByRole('button', { name: 'Move to Review' }));
    await waitFor(() => expect(currentStageText()).toContain('In Review'));
  });

  it('Publish shows a pending label and is disabled while the request is in flight', async () => {
    renderBar();
    await advanceToReviewConfirmed();

    let resolvePublish: () => void = () => undefined;
    vi.mocked(courseDraftService.publishCourse).mockReturnValue(
      new Promise((resolve) => {
        resolvePublish = () => resolve(undefined);
      })
    );
    const publishButton = screen.getByRole('button', { name: 'Publish' });
    fireEvent.click(publishButton);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Publishing…' })).toBeDisabled());

    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus({ lifecycleState: 'Published' }));
    resolvePublish();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument());
  });

  // -- Story 3.10: Return to Draft + version history ------------------------------------------

  it('Return to Draft is not rendered while the course is still Draft', () => {
    renderBar();

    expect(screen.queryByRole('button', { name: 'Return to Draft' })).not.toBeInTheDocument();
  });

  it('Return to Draft renders once the course is Published', async () => {
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus({ lifecycleState: 'Published' }));
    renderBar();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Return to Draft' })).toBeInTheDocument());
  });

  it('clicking Return to Draft calls the endpoint and the stage indicator moves back to Draft', async () => {
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus({ lifecycleState: 'Published' }));
    renderBar();
    const returnButton = await screen.findByRole('button', { name: 'Return to Draft' });

    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus({ lifecycleState: 'Draft' }));
    fireEvent.click(returnButton);

    await waitFor(() => expect(courseDraftService.returnToDraft).toHaveBeenCalledWith('course_1'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Return to Draft' })).not.toBeInTheDocument());
    const nav = screen.getByRole('navigation', { name: 'Course publishing lifecycle' });
    expect(nav.querySelectorAll('[aria-current="true"]')[0].textContent).toContain('Draft');
  });

  it('Version History toggles a fetched list of prior versions, closed by default', async () => {
    vi.mocked(courseDraftService.getVersions).mockResolvedValue([
      { id: 'version_1', publishedAt: '2026-08-01T12:00:00Z', fileCount: 3 },
    ]);
    renderBar();

    expect(screen.queryByLabelText('Version history')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Version History' }));

    await waitFor(() => expect(screen.getByLabelText('Version history')).toBeInTheDocument());
    expect(courseDraftService.getVersions).toHaveBeenCalledWith('course_1');
    expect(screen.getByText(/3 files/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide Version History' }));
    expect(screen.queryByLabelText('Version history')).not.toBeInTheDocument();
  });

  it('shows an empty-state message when there are no prior versions', async () => {
    vi.mocked(courseDraftService.getVersions).mockResolvedValue([]);
    renderBar();

    fireEvent.click(screen.getByRole('button', { name: 'Version History' }));

    await waitFor(() => expect(screen.getByText('No published versions yet.')).toBeInTheDocument());
  });

  it('clicking Restore on a version calls restoreVersion for that version id', async () => {
    vi.mocked(courseDraftService.getVersions).mockResolvedValue([
      { id: 'version_1', publishedAt: '2026-08-01T12:00:00Z', fileCount: 3 },
    ]);
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Version History' }));
    const restoreButton = await screen.findByRole('button', { name: 'Restore' });

    fireEvent.click(restoreButton);

    await waitFor(() => expect(courseDraftService.restoreVersion).toHaveBeenCalledWith('course_1', 'version_1'));
  });

  // -- Story 11.1: blocker list (AC #1) --------------------------------------------------------

  const OUTLINE_WITH_BLOCKERS: OutlineDto = {
    chapters: [
      {
        id: 'chapter_1',
        title: 'Chemical Reactions',
        description: '',
        isConfirmed: true,
        order: 0,
        pages: [],
        topics: [
          {
            id: 'topic_1',
            title: 'Combustion',
            description: '',
            isConfirmed: true,
            order: 0,
            pages: [],
            subtopics: [
              {
                id: 'subtopic_1',
                title: 'Combination Reactions',
                description: '',
                isConfirmed: false,
                order: 0,
                pages: [],
              },
            ],
          },
        ],
      },
    ],
  };

  it('no blocker toggle renders when everything is confirmed', async () => {
    renderBar({ outline: { chapters: [{ id: 'c1', title: 'Ch 1', description: '', isConfirmed: true, order: 0, pages: [], topics: [] }] } });

    await waitFor(() => expect(courseContentService.getOutline).toHaveBeenCalled());
    expect(screen.queryByText(/blocker/)).not.toBeInTheDocument();
  });

  it('a blocker toggle renders in draft state when an Unconfirmed node exists, and Move to Review is disabled', async () => {
    renderBar({ outline: OUTLINE_WITH_BLOCKERS });

    const toggle = await screen.findByRole('button', { name: '1 blocker' });
    expect(toggle).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move to Review' })).toBeDisabled();
  });

  it('opening the blocker toggle lists the blocker with its kind and title', async () => {
    renderBar({ outline: OUTLINE_WITH_BLOCKERS });
    const toggle = await screen.findByRole('button', { name: '1 blocker' });

    fireEvent.click(toggle);

    const list = await screen.findByRole('list', { name: 'Content blocking Move to Review' });
    expect(list).toHaveTextContent('Sub-Topic:');
    expect(list).toHaveTextContent('Combination Reactions');
  });

  it('activating a blocker link calls onActivateBlocker with its id and chapterId', async () => {
    const { onActivateBlocker } = renderBar({ outline: OUTLINE_WITH_BLOCKERS });
    fireEvent.click(await screen.findByRole('button', { name: '1 blocker' }));

    fireEvent.click(screen.getByRole('button', { name: /Combination Reactions/ }));

    expect(onActivateBlocker).toHaveBeenCalledWith(expect.objectContaining({ id: 'subtopic_1', chapterId: 'chapter_1' }));
  });

  it('Move to Review is enabled again once the outline has no more Unconfirmed content', async () => {
    renderBar({
      outline: {
        chapters: [{ id: 'c1', title: 'Ch 1', description: '', isConfirmed: true, order: 0, pages: [], topics: [] }],
      },
    });

    await waitFor(() => expect(courseContentService.getOutline).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Move to Review' })).not.toBeDisabled();
  });
});
