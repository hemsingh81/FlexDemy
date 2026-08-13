import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { PublishLifecycleBar } from '../../../src/features/CourseContentEditor/PublishLifecycleBar';
import * as courseDraftService from '@/src/services/courseDraftService';
import type { PublishStatusDto } from '@/src/services/courseDraftService';

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

const makeStatus = (overrides: Partial<PublishStatusDto> = {}): PublishStatusDto => ({
  lifecycleState: 'Draft',
  isPublishing: false,
  checklist: null,
  ...overrides,
});

const CHECKLIST_IN_PROGRESS = [
  { nodeId: 'chapter_1', nodeKind: 'chapter', title: 'Chapter 1: Waves & Chemistry', statusKind: 'done', statusText: '' },
  { nodeId: 'topic_1', nodeKind: 'topic', title: 'Topic 1: Wave Motion', statusKind: 'inProgress', statusText: 'Generating Drill-Down Level 1 of 5…' },
  { nodeId: 'subtopic_1', nodeKind: 'subtopic', title: 'Subtopic 1: Introduction', statusKind: 'failed', statusText: 'Generation failed — served on-demand for now' },
] as const;

// Story 3.9/Task 4: real-wires this component's hook against Story 3.8/3.9's real endpoints --
// this file now mocks those HTTP calls instead of relying on the removed mock setInterval
// progression, but exercises the identical AC#3/AC#4 UI behaviors Story 3.4's own tests established.
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus());
  vi.mocked(courseDraftService.moveToReview).mockResolvedValue(undefined);
  vi.mocked(courseDraftService.confirmReview).mockResolvedValue(undefined);
  vi.mocked(courseDraftService.publishCourse).mockResolvedValue(undefined);
  vi.mocked(courseDraftService.returnToDraft).mockResolvedValue(undefined);
  vi.mocked(courseDraftService.getVersions).mockResolvedValue([]);
  vi.mocked(courseDraftService.restoreVersion).mockResolvedValue(undefined);
});

// Drives the bar through Draft -> InReview -> ReviewConfirmed, then optionally clicks Publish.
const advanceToReviewConfirmed = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Review as Student' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm Review' })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Review' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Publish' })).not.toBeDisabled());
};

describe('PublishLifecycleBar', () => {
  it('Publish is disabled at draft and inReview, enabled only at reviewConfirmed', async () => {
    render(<PublishLifecycleBar courseId="course_1" />);

    const publishButton = screen.getByRole('button', { name: 'Publish' });
    expect(publishButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Review as Student' }));
    await waitFor(() => expect(courseDraftService.moveToReview).toHaveBeenCalledWith('course_1'));
    expect(publishButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Review' }));
    await waitFor(() => expect(publishButton).not.toBeDisabled());
  });

  it('exactly one lifecycle stage carries aria-current="true", and it advances as state transitions', async () => {
    render(<PublishLifecycleBar courseId="course_1" />);

    const nav = screen.getByRole('navigation', { name: 'Course publishing lifecycle' });
    const currentStageText = () => {
      const current = nav.querySelectorAll('[aria-current="true"]');
      expect(current).toHaveLength(1);
      return current[0].textContent;
    };

    expect(currentStageText()).toContain('Draft');

    fireEvent.click(screen.getByRole('button', { name: 'Review as Student' }));
    await waitFor(() => expect(currentStageText()).toContain('In Review'));
  });

  it('the checklist container has aria-live="polite" while publishing', async () => {
    render(<PublishLifecycleBar courseId="course_1" />);
    await advanceToReviewConfirmed();

    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(
      makeStatus({ lifecycleState: 'ReviewConfirmed', isPublishing: true, checklist: [...CHECKLIST_IN_PROGRESS] })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());

    const liveRegions = document.querySelectorAll('[aria-live="polite"]');
    expect(liveRegions.length).toBeGreaterThan(0);
  });

  it('a failed row renders a Retry button that re-polls publish status', async () => {
    render(<PublishLifecycleBar courseId="course_1" />);
    await advanceToReviewConfirmed();

    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(
      makeStatus({ lifecycleState: 'ReviewConfirmed', isPublishing: true, checklist: [...CHECKLIST_IN_PROGRESS] })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    const retryButton = await screen.findByRole('button', { name: 'Retry' });
    const callsBeforeRetry = vi.mocked(courseDraftService.getPublishStatus).mock.calls.length;

    fireEvent.click(retryButton);

    await waitFor(() => expect(vi.mocked(courseDraftService.getPublishStatus).mock.calls.length).toBeGreaterThan(callsBeforeRetry));
  });

  it('disables Publish once a batch is running, so a re-click cannot silently discard progress', async () => {
    render(<PublishLifecycleBar courseId="course_1" />);
    await advanceToReviewConfirmed();

    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(
      makeStatus({ lifecycleState: 'ReviewConfirmed', isPublishing: true, checklist: [...CHECKLIST_IN_PROGRESS] })
    );
    const publishButton = screen.getByRole('button', { name: 'Publish' });
    fireEvent.click(publishButton);

    // `state` itself stays 'reviewConfirmed' for the whole publishing duration -- only
    // `isPublishing` distinguishes "running" from "ready to publish", so the button must reflect
    // isPublishing too, not just state.
    await waitFor(() => expect(publishButton).toBeDisabled());
  });

  it('renders the checklist as a node-by-node list, not a spinner, while publishing', async () => {
    render(<PublishLifecycleBar courseId="course_1" />);
    await advanceToReviewConfirmed();

    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(
      makeStatus({ lifecycleState: 'ReviewConfirmed', isPublishing: true, checklist: [...CHECKLIST_IN_PROGRESS] })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(screen.getByText(/confirmed nodes generated/)).toBeInTheDocument());

    expect(screen.getByText('Topic 1: Wave Motion')).toBeInTheDocument();
    expect(screen.getByText('Subtopic 1: Introduction')).toBeInTheDocument();
  });

  // -- Story 3.10: Return to Draft + version history ------------------------------------------

  it('Return to Draft is not rendered while the course is still Draft', () => {
    render(<PublishLifecycleBar courseId="course_1" />);

    expect(screen.queryByRole('button', { name: 'Return to Draft' })).not.toBeInTheDocument();
  });

  it('Return to Draft renders once the course is Published', async () => {
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus({ lifecycleState: 'Published' }));
    render(<PublishLifecycleBar courseId="course_1" />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Return to Draft' })).toBeInTheDocument());
  });

  it('clicking Return to Draft calls the endpoint and the stage indicator moves back to Draft', async () => {
    vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue(makeStatus({ lifecycleState: 'Published' }));
    render(<PublishLifecycleBar courseId="course_1" />);
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
      { id: 'version_1', publishedAt: '2026-08-01T12:00:00Z', chapterCount: 2, topicCount: 5 },
    ]);
    render(<PublishLifecycleBar courseId="course_1" />);

    expect(screen.queryByLabelText('Version history')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Version History' }));

    await waitFor(() => expect(screen.getByLabelText('Version history')).toBeInTheDocument());
    expect(courseDraftService.getVersions).toHaveBeenCalledWith('course_1');
    expect(screen.getByText(/2 chapters, 5 topics/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide Version History' }));
    expect(screen.queryByLabelText('Version history')).not.toBeInTheDocument();
  });

  it('shows an empty-state message when there are no prior versions', async () => {
    vi.mocked(courseDraftService.getVersions).mockResolvedValue([]);
    render(<PublishLifecycleBar courseId="course_1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Version History' }));

    await waitFor(() => expect(screen.getByText('No published versions yet.')).toBeInTheDocument());
  });

  it('clicking Restore on a version calls restoreVersion for that version id', async () => {
    vi.mocked(courseDraftService.getVersions).mockResolvedValue([
      { id: 'version_1', publishedAt: '2026-08-01T12:00:00Z', chapterCount: 2, topicCount: 5 },
    ]);
    render(<PublishLifecycleBar courseId="course_1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Version History' }));
    const restoreButton = await screen.findByRole('button', { name: 'Restore' });

    fireEvent.click(restoreButton);

    await waitFor(() => expect(courseDraftService.restoreVersion).toHaveBeenCalledWith('course_1', 'version_1'));
  });
});
