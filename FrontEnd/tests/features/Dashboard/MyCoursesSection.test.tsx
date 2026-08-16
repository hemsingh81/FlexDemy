import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyCoursesSection } from '@/src/features/Dashboard/MyCoursesSection';
import * as courseDraftService from '@/src/services/courseDraftService';
import { CourseDraftError, type MyCourseSummaryDto } from '@/src/services/courseDraftService';
import * as courseFileService from '@/src/services/courseFileService';

vi.mock('@/src/services/courseDraftService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseDraftService')>('@/src/services/courseDraftService');
  return { ...actual, getMyCourses: vi.fn(), deleteCourse: vi.fn(), returnToDraft: vi.fn(), getPublishStatus: vi.fn() };
});

// Rendering the real Course Content Editor inline (openDraftId below) also mounts its own
// PublishLifecycleBar/useFileUpload, which fetch on mount -- mocked here for the exact same
// "don't leak a real, unmocked network call" reason TutorEducatorHubView.test.tsx already mocks
// these two services.
vi.mock('@/src/services/courseFileService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseFileService')>('@/src/services/courseFileService');
  return { ...actual, getFiles: vi.fn() };
});

const makeCourse = (overrides: Partial<MyCourseSummaryDto> = {}): MyCourseSummaryDto => ({
  id: 'course_1',
  title: 'Intro to Physics',
  lifecycleState: 'Draft',
  updatedAt: '2026-08-10T12:00:00Z',
  ...overrides,
});

beforeEach(() => {
  vi.mocked(courseDraftService.getMyCourses).mockReset();
  vi.mocked(courseDraftService.deleteCourse).mockReset();
  vi.mocked(courseDraftService.returnToDraft).mockReset();
  vi.mocked(courseDraftService.getPublishStatus).mockReset();
  vi.mocked(courseDraftService.getPublishStatus).mockResolvedValue({ lifecycleState: 'Draft' });
  vi.mocked(courseFileService.getFiles).mockReset();
  vi.mocked(courseFileService.getFiles).mockResolvedValue([]);
});

describe('MyCoursesSection', () => {
  // -- Story 5.1: relocated New Course Wizard trigger + course-publishing scroll anchor --------

  it('renders the New Course Wizard trigger in the section header and calls onOpenNewCourseWizard when clicked', async () => {
    const u = userEvent.setup();
    const onOpenNewCourseWizard = vi.fn();
    vi.mocked(courseDraftService.getMyCourses).mockResolvedValue([]);

    render(
      <MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} onOpenNewCourseWizard={onOpenNewCourseWizard} />
    );

    const button = screen.getByRole('button', { name: 'New Course Wizard' });
    expect(button).toBeInTheDocument();
    await u.click(button);
    expect(onOpenNewCourseWizard).toHaveBeenCalledTimes(1);
  });

  it('disables the New Course Wizard trigger while the Content Editor is open', () => {
    vi.mocked(courseDraftService.getMyCourses).mockReturnValue(new Promise(() => {}));

    render(<MyCoursesSection isContentEditorOpen onResumeDraft={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'New Course Wizard' })).toBeDisabled();
  });

  it('carries the course-publishing scroll anchor (id and scroll-mt-24) on its outer card', () => {
    vi.mocked(courseDraftService.getMyCourses).mockReturnValue(new Promise(() => {}));

    const { container } = render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);

    const anchor = container.querySelector('#course-publishing');
    expect(anchor).not.toBeNull();
    expect(anchor).toHaveClass('scroll-mt-24');
  });

  it('keeps the New Course Wizard trigger rendered when the course list fails to load', async () => {
    vi.mocked(courseDraftService.getMyCourses).mockRejectedValue(new CourseDraftError('Could not load your courses.'));

    render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);

    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'New Course Wizard' })).toBeInTheDocument();
  });

  it('shows a loading state before the fetch resolves', () => {
    vi.mocked(courseDraftService.getMyCourses).mockReturnValue(new Promise(() => {}));

    render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);

    expect(screen.getByText('Loading your courses…')).toBeInTheDocument();
  });

  it('shows an explicit empty state, not a blank list, when the tutor has no courses yet', async () => {
    vi.mocked(courseDraftService.getMyCourses).mockResolvedValue([]);

    render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);

    await screen.findByText('No courses yet — use New Course Wizard above to create your first one.');
  });

  it('renders every course with a status badge, regardless of Lifecycle State', async () => {
    vi.mocked(courseDraftService.getMyCourses).mockResolvedValue([
      makeCourse({ id: 'course_draft', title: 'Draft Course', lifecycleState: 'Draft' }),
      makeCourse({ id: 'course_published', title: 'Published Course', lifecycleState: 'Published' }),
    ]);

    render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);

    await screen.findByText('Draft Course');
    expect(screen.getByText('Published Course')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
  });

  it('only shows a Resume action on a Draft course, not on further-along courses', async () => {
    vi.mocked(courseDraftService.getMyCourses).mockResolvedValue([
      makeCourse({ id: 'course_draft', title: 'Draft Course', lifecycleState: 'Draft' }),
      makeCourse({ id: 'course_review', title: 'In-Review Course', lifecycleState: 'InReview' }),
    ]);

    render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);

    await screen.findByText('Draft Course');
    expect(screen.getAllByRole('button', { name: 'Resume' })).toHaveLength(1);
  });

  it('calls onResumeDraft with the selected course id when Resume is clicked', async () => {
    const u = userEvent.setup();
    const onResumeDraft = vi.fn();
    vi.mocked(courseDraftService.getMyCourses).mockResolvedValue([
      makeCourse({ id: 'course_draft', title: 'Draft Course', lifecycleState: 'Draft' }),
    ]);

    render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={onResumeDraft} />);
    await screen.findByText('Draft Course');

    await u.click(screen.getByRole('button', { name: 'Resume' }));

    expect(onResumeDraft).toHaveBeenCalledWith('course_draft');
  });

  it('shows a friendly error message instead of a blank list when the fetch fails', async () => {
    vi.mocked(courseDraftService.getMyCourses).mockRejectedValue(new CourseDraftError('Could not reach the server.'));

    render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.');
  });

  it('does not fetch while the Content Editor is open, then refetches once it closes', async () => {
    vi.mocked(courseDraftService.getMyCourses).mockResolvedValue([]);

    const { rerender } = render(<MyCoursesSection isContentEditorOpen onResumeDraft={vi.fn()} />);
    expect(courseDraftService.getMyCourses).not.toHaveBeenCalled();

    rerender(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);

    await waitFor(() => expect(courseDraftService.getMyCourses).toHaveBeenCalledTimes(1));
  });

  // -- FR-32: Delete / Take Offline -----------------------------------------------------------

  it('offers Delete (not Take Offline) on Draft, In Review, and Review Confirmed courses', async () => {
    vi.mocked(courseDraftService.getMyCourses).mockResolvedValue([
      makeCourse({ id: 'c_draft', title: 'Draft Course', lifecycleState: 'Draft' }),
      makeCourse({ id: 'c_review', title: 'In-Review Course', lifecycleState: 'InReview' }),
      makeCourse({ id: 'c_confirmed', title: 'Confirmed Course', lifecycleState: 'ReviewConfirmed' }),
    ]);

    render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);

    await screen.findByText('Draft Course');
    expect(screen.getAllByRole('button', { name: /^Delete /i })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Take Offline' })).not.toBeInTheDocument();
  });

  it('offers Take Offline (not Delete) on a Published course', async () => {
    vi.mocked(courseDraftService.getMyCourses).mockResolvedValue([
      makeCourse({ id: 'c_published', title: 'Published Course', lifecycleState: 'Published' }),
    ]);

    render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);

    await screen.findByText('Published Course');
    expect(screen.getByRole('button', { name: 'Take Offline' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Delete /i })).not.toBeInTheDocument();
  });

  it('clicking Delete opens a confirmation and does not delete until confirmed', async () => {
    const u = userEvent.setup();
    vi.mocked(courseDraftService.getMyCourses).mockResolvedValue([
      makeCourse({ id: 'c_draft', title: 'Draft Course', lifecycleState: 'Draft' }),
    ]);

    render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);
    await screen.findByText('Draft Course');

    await u.click(screen.getByRole('button', { name: 'Delete Draft Course' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Permanently delete "Draft Course"? This can\'t be undone.');
    expect(courseDraftService.deleteCourse).not.toHaveBeenCalled();
  });

  it('cancelling the delete confirmation does not call deleteCourse', async () => {
    const u = userEvent.setup();
    vi.mocked(courseDraftService.getMyCourses).mockResolvedValue([
      makeCourse({ id: 'c_draft', title: 'Draft Course', lifecycleState: 'Draft' }),
    ]);

    render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);
    await screen.findByText('Draft Course');
    await u.click(screen.getByRole('button', { name: 'Delete Draft Course' }));

    await u.click(screen.getByRole('button', { name: 'Cancel' }));

    // ConfirmModal now fades out over EXIT_MS before actually unmounting (ConfirmModal.tsx) --
    // no longer instant.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(courseDraftService.deleteCourse).not.toHaveBeenCalled();
  });

  it('confirming delete calls deleteCourse and refetches the list', async () => {
    const u = userEvent.setup();
    vi.mocked(courseDraftService.getMyCourses)
      .mockResolvedValueOnce([makeCourse({ id: 'c_draft', title: 'Draft Course', lifecycleState: 'Draft' })])
      .mockResolvedValueOnce([]);
    vi.mocked(courseDraftService.deleteCourse).mockResolvedValue(undefined);

    render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);
    await screen.findByText('Draft Course');
    await u.click(screen.getByRole('button', { name: 'Delete Draft Course' }));

    await u.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(courseDraftService.deleteCourse).toHaveBeenCalledWith('c_draft'));
    await screen.findByText('No courses yet — use New Course Wizard above to create your first one.');
  });

  it('shows a friendly error and keeps the course listed when delete fails', async () => {
    const u = userEvent.setup();
    vi.mocked(courseDraftService.getMyCourses).mockResolvedValue([
      makeCourse({ id: 'c_draft', title: 'Draft Course', lifecycleState: 'Draft' }),
    ]);
    vi.mocked(courseDraftService.deleteCourse).mockRejectedValue(new CourseDraftError('Could not delete this course.'));

    render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);
    await screen.findByText('Draft Course');
    await u.click(screen.getByRole('button', { name: 'Delete Draft Course' }));
    await u.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete this course.');
    expect(screen.getByText('Draft Course')).toBeInTheDocument();
  });

  it('clicking Take Offline calls returnToDraft directly, with no confirmation step, and refetches', async () => {
    const u = userEvent.setup();
    vi.mocked(courseDraftService.getMyCourses)
      .mockResolvedValueOnce([makeCourse({ id: 'c_published', title: 'Published Course', lifecycleState: 'Published' })])
      .mockResolvedValueOnce([makeCourse({ id: 'c_published', title: 'Published Course', lifecycleState: 'Draft' })]);
    vi.mocked(courseDraftService.returnToDraft).mockResolvedValue(undefined);

    render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);
    await screen.findByText('Published Course');

    await u.click(screen.getByRole('button', { name: 'Take Offline' }));

    expect(courseDraftService.returnToDraft).toHaveBeenCalledWith('c_published');
    await waitFor(() => expect(screen.getByText('Draft')).toBeInTheDocument());
  });

  it('shows a friendly error when Take Offline fails', async () => {
    const u = userEvent.setup();
    vi.mocked(courseDraftService.getMyCourses).mockResolvedValue([
      makeCourse({ id: 'c_published', title: 'Published Course', lifecycleState: 'Published' }),
    ]);
    vi.mocked(courseDraftService.returnToDraft).mockRejectedValue(new CourseDraftError('Could not reach the server.'));

    render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);
    await screen.findByText('Published Course');
    await u.click(screen.getByRole('button', { name: 'Take Offline' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.');
  });

  // -- Inline Course Content Editor (openDraftId) ----------------------------------------------

  it('renders no inline editor when openDraftId is unset', async () => {
    vi.mocked(courseDraftService.getMyCourses).mockResolvedValue([
      makeCourse({ id: 'c_draft', title: 'Draft Course', lifecycleState: 'Draft' }),
    ]);

    render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);
    await screen.findByText('Draft Course');

    expect(screen.queryByRole('region', { name: 'Course Content Editor' })).not.toBeInTheDocument();
  });

  it('opens the inline editor directly beneath the matching course row, and no other row', async () => {
    vi.mocked(courseDraftService.getMyCourses).mockResolvedValue([
      makeCourse({ id: 'c_first', title: 'First Course', lifecycleState: 'Draft' }),
      makeCourse({ id: 'c_second', title: 'Second Course', lifecycleState: 'Draft' }),
    ]);

    // Mounts with the editor already closed (isContentEditorOpen=false) so the list actually
    // fetches -- MyCoursesSection deliberately skips refetching while isContentEditorOpen is
    // true (see 'does not fetch while the Content Editor is open' above), matching the real
    // app's flow: the list loads first, *then* Resume flips isContentEditorOpen/openDraftId.
    const { container, rerender } = render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);
    await screen.findByText('Second Course');

    rerender(
      <MyCoursesSection isContentEditorOpen onResumeDraft={vi.fn()} openDraftId="c_second" onCloseContentEditor={vi.fn()} />
    );

    expect(screen.getByRole('region', { name: 'Course Content Editor' })).toBeInTheDocument();

    // Doc order: First Course's row, Second Course's row, then the editor -- immediately after
    // the course it belongs to, not first, not detached from the list entirely.
    const rows = Array.from(container.querySelectorAll('li'));
    const secondCourseRowIndex = rows.findIndex((li) => li.textContent?.includes('Second Course'));
    const editorRowIndex = rows.findIndex((li) => li.querySelector('[aria-label="Course Content Editor"]'));
    expect(editorRowIndex).toBe(secondCourseRowIndex + 1);
  });

  it('renders the inline editor full width, not the standalone centered/capped card', async () => {
    vi.mocked(courseDraftService.getMyCourses).mockResolvedValue([
      makeCourse({ id: 'c_draft', title: 'Draft Course', lifecycleState: 'Draft' }),
    ]);

    const { container, rerender } = render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);
    await screen.findByText('Draft Course');

    rerender(
      <MyCoursesSection isContentEditorOpen onResumeDraft={vi.fn()} openDraftId="c_draft" onCloseContentEditor={vi.fn()} />
    );

    const editor = container.querySelector('[aria-label="Course Content Editor"]');
    expect(editor).toHaveClass('w-full');
    expect(editor).not.toHaveClass('max-w-4xl');
  });

  it('closing the inline editor calls onCloseContentEditor', async () => {
    const u = userEvent.setup();
    const onCloseContentEditor = vi.fn();
    vi.mocked(courseDraftService.getMyCourses).mockResolvedValue([
      makeCourse({ id: 'c_draft', title: 'Draft Course', lifecycleState: 'Draft' }),
    ]);

    const { rerender } = render(<MyCoursesSection isContentEditorOpen={false} onResumeDraft={vi.fn()} />);
    await screen.findByText('Draft Course');

    rerender(
      <MyCoursesSection
        isContentEditorOpen
        onResumeDraft={vi.fn()}
        openDraftId="c_draft"
        onCloseContentEditor={onCloseContentEditor}
      />
    );

    await u.click(screen.getByLabelText('Close Course Content Editor'));

    expect(onCloseContentEditor).toHaveBeenCalled();
  });
});
