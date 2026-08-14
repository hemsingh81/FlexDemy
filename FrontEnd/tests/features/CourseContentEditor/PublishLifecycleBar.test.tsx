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
  ...overrides,
});

// Publish is now a single, immediate, synchronous transition -- no per-node checklist/batch, so
// this file mocks the plain HTTP calls and exercises the stage-nav/version-history UI only.
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

// Drives the bar through Draft -> InReview -> ReviewConfirmed.
const advanceToReviewConfirmed = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Move to Review' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm Review' })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Review' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Publish' })).not.toBeDisabled());
};

describe('PublishLifecycleBar', () => {
  it('Publish is disabled at draft and inReview, enabled only at reviewConfirmed', async () => {
    render(<PublishLifecycleBar courseId="course_1" />);

    const publishButton = screen.getByRole('button', { name: 'Publish' });
    expect(publishButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Move to Review' }));
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

    fireEvent.click(screen.getByRole('button', { name: 'Move to Review' }));
    await waitFor(() => expect(currentStageText()).toContain('In Review'));
  });

  it('Publish shows a pending label and is disabled while the request is in flight', async () => {
    render(<PublishLifecycleBar courseId="course_1" />);
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
      { id: 'version_1', publishedAt: '2026-08-01T12:00:00Z', fileCount: 3 },
    ]);
    render(<PublishLifecycleBar courseId="course_1" />);

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
    render(<PublishLifecycleBar courseId="course_1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Version History' }));

    await waitFor(() => expect(screen.getByText('No published versions yet.')).toBeInTheDocument());
  });

  it('clicking Restore on a version calls restoreVersion for that version id', async () => {
    vi.mocked(courseDraftService.getVersions).mockResolvedValue([
      { id: 'version_1', publishedAt: '2026-08-01T12:00:00Z', fileCount: 3 },
    ]);
    render(<PublishLifecycleBar courseId="course_1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Version History' }));
    const restoreButton = await screen.findByRole('button', { name: 'Restore' });

    fireEvent.click(restoreButton);

    await waitFor(() => expect(courseDraftService.restoreVersion).toHaveBeenCalledWith('course_1', 'version_1'));
  });
});
