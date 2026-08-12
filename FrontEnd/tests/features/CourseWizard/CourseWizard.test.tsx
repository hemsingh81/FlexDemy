import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CourseWizard } from '@/src/features/CourseWizard/CourseWizard';
import * as courseDraftService from '@/src/services/courseDraftService';
import type { CourseDraftDto } from '@/src/services/courseDraftService';
import * as tagsService from '@/src/services/tagsService';
import * as masterDataService from '@/src/services/masterDataService';

// jsdom has no real layout engine (getBoundingClientRect is always a zero rect) and no
// URL.createObjectURL -- stub it so the Thumbnails step's file picker doesn't throw.
beforeAll(() => {
  if (!('createObjectURL' in URL)) {
    // @ts-expect-error -- jsdom doesn't implement this
    URL.createObjectURL = vi.fn(() => 'blob:mock-thumbnail');
  }
});

// Story 2.4: Next/Back/Finish now persist via courseDraftService -- mocked here so step
// navigation (this file's real focus) doesn't depend on a real backend. Thumbnail-specific
// behavior is asserted against useCourseDraft.test.ts/StepThumbnails' own coverage; here the
// mock just needs to succeed so the wizard's navigation flow can be exercised end-to-end.
vi.mock('@/src/services/courseDraftService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseDraftService')>('@/src/services/courseDraftService');
  return {
    ...actual,
    createDraftCourse: vi.fn(),
    updateDraftCourse: vi.fn(),
    uploadThumbnail: vi.fn(),
  };
});

// Story 2.5: useCourseDraft.ts now fetches real Tags/Taxonomy data on mount -- mocked here too so
// step navigation (this file's real focus) doesn't depend on a real backend.
vi.mock('@/src/services/tagsService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/tagsService')>('@/src/services/tagsService');
  return { ...actual, getTags: vi.fn() };
});
vi.mock('@/src/services/masterDataService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/masterDataService')>('@/src/services/masterDataService');
  return { ...actual, getCountries: vi.fn(), getStates: vi.fn(), getCities: vi.fn(), getBoards: vi.fn(), getClassLevels: vi.fn(), getSubjects: vi.fn() };
});

const makeDraftDto = (overrides: Partial<CourseDraftDto> = {}): CourseDraftDto => ({
  id: 'draft_mock_1',
  title: '',
  shortDescription: '',
  lifecycleState: 'Draft',
  thumbnails: [],
  tagIds: [],
  countryId: null,
  stateId: null,
  cityId: null,
  boardId: null,
  classLevelId: null,
  subjectId: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(courseDraftService.createDraftCourse).mockResolvedValue(makeDraftDto());
  vi.mocked(courseDraftService.updateDraftCourse).mockResolvedValue(makeDraftDto());
  // Fixture data mirrors the old MOCK_* constants useCourseDraft.ts used to hardcode (Story
  // 2.1), so existing taxonomy-flow assertions (country_in/CBSE/Class 10/Physics, the locked
  // tag_legacy_curriculum chip) keep working unchanged.
  vi.mocked(tagsService.getTags).mockResolvedValue([
    { id: 'tag_physics', name: 'Physics', isActive: true },
    { id: 'tag_legacy_curriculum', name: 'Legacy Curriculum (2019)', isActive: false },
  ]);
  vi.mocked(masterDataService.getCountries).mockResolvedValue([{ id: 'country_in', name: 'India', isoCode: 'IN', isActive: true }]);
  vi.mocked(masterDataService.getStates).mockResolvedValue([
    { id: 'state_mh', countryId: 'country_in', name: 'Maharashtra', code: 'MH', isActive: true },
    { id: 'state_ka', countryId: 'country_in', name: 'Karnataka', code: 'KA', isActive: true },
  ]);
  vi.mocked(masterDataService.getCities).mockResolvedValue([
    { id: 'city_mumbai', stateId: 'state_mh', name: 'Mumbai', isActive: true },
  ]);
  vi.mocked(masterDataService.getBoards).mockResolvedValue([
    { id: 'board_cbse', name: 'CBSE', code: 'CBSE', stateId: null, isActive: true },
    { id: 'board_mh_state', name: 'Maharashtra State Board', code: 'MH-SSC', stateId: 'state_mh', isActive: true },
  ]);
  vi.mocked(masterDataService.getClassLevels).mockResolvedValue([
    { id: 'class_10', name: 'Class 10', sortOrder: 1, isActive: true, subjectIds: ['subject_physics'] },
  ]);
  vi.mocked(masterDataService.getSubjects).mockResolvedValue([
    { id: 'subject_physics', name: 'Physics', stream: 'Science', isActive: true },
  ]);
  let thumbnailCount = 0;
  vi.mocked(courseDraftService.uploadThumbnail).mockImplementation(async () => {
    thumbnailCount += 1;
    const thumbnails = Array.from({ length: thumbnailCount }, (_, i) => ({
      id: `thumb_${i}`,
      url: `/uploads/course-thumbnails/thumb_${i}.jpg`,
      isPrimary: i === 0,
      order: i,
      crop: { x: 50, y: 50, zoom: 100 },
    }));
    return makeDraftDto({ thumbnails });
  });
});

const renderWizard = (onComplete = vi.fn(), onClose = vi.fn()) => {
  const utils = render(<CourseWizard isOpen onClose={onClose} onComplete={onComplete} />);
  return { ...utils, onComplete, onClose };
};

describe('CourseWizard', () => {
  it('renders nothing when isOpen is false', () => {
    render(<CourseWizard isOpen={false} onClose={vi.fn()} onComplete={vi.fn()} />);
    expect(screen.queryByText('New Course Wizard')).not.toBeInTheDocument();
  });

  it('Step 1: Next is disabled for an empty title, enabled once a valid title is entered', async () => {
    const u = userEvent.setup();
    renderWizard();

    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeDisabled();

    await u.type(screen.getByLabelText('Course Title:'), 'Intro to Physics');
    expect(nextButton).toBeEnabled();
  });

  it('Step 1: Next stays disabled for a whitespace-only title', async () => {
    const u = userEvent.setup();
    renderWizard();

    await u.type(screen.getByLabelText('Course Title:'), '   ');
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('advances through Step 2 (Tags) and shows the locked chip for the pre-attached inactive tag', async () => {
    const u = userEvent.setup();
    renderWizard();

    await u.type(screen.getByLabelText('Course Title:'), 'Intro to Physics');
    await u.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    expect(screen.getByText('Legacy Curriculum (2019)')).toBeInTheDocument();
    // Locked chip has no remove control.
    expect(screen.queryByLabelText('Remove Legacy Curriculum (2019)')).not.toBeInTheDocument();
  });

  it('Step 3 Taxonomy: cascading selects disable until their parent is chosen, and reset on parent change', async () => {
    const u = userEvent.setup();
    renderWizard();

    await u.type(screen.getByLabelText('Course Title:'), 'Intro to Physics');
    await u.click(screen.getByRole('button', { name: /next/i })); // -> step 2
    await u.click(screen.getByRole('button', { name: /next/i })); // -> step 3

    expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();
    const stateSelect = screen.getByLabelText('State:');
    const citySelect = screen.getByLabelText('City:');
    const boardSelect = screen.getByLabelText('Board:');

    expect(stateSelect).toBeDisabled();
    expect(citySelect).toBeDisabled();
    expect(boardSelect).toBeDisabled();

    await u.selectOptions(screen.getByLabelText('Country:'), 'country_in');
    expect(stateSelect).toBeEnabled();
    expect(citySelect).toBeDisabled();

    await u.selectOptions(stateSelect, 'state_mh');
    expect(citySelect).toBeEnabled();
    expect(boardSelect).toBeDisabled();

    await u.selectOptions(citySelect, 'city_mumbai');
    expect(boardSelect).toBeEnabled();

    // Changing State resets the now-stale City selection.
    await u.selectOptions(stateSelect, 'state_ka');
    expect((citySelect as HTMLSelectElement).value).toBe('');
  });

  it('Step 3: Next is disabled for a state-scoped board until a real State/City are chosen, and enabled for a national board without them', async () => {
    const u = userEvent.setup();
    renderWizard();

    await u.type(screen.getByLabelText('Course Title:'), 'Intro to Physics');
    await u.click(screen.getByRole('button', { name: /next/i }));
    await u.click(screen.getByRole('button', { name: /next/i }));

    const nextButton = screen.getByRole('button', { name: /next/i });
    await u.selectOptions(screen.getByLabelText('Country:'), 'country_in');
    await u.selectOptions(screen.getByLabelText('State:'), 'National / Not Applicable');
    await u.selectOptions(screen.getByLabelText('City:'), 'Not Applicable');
    await u.selectOptions(screen.getByLabelText('Board:'), 'CBSE');
    await u.selectOptions(screen.getByLabelText('Class Level:'), 'Class 10');
    await u.selectOptions(screen.getByLabelText('Subject:'), 'Physics');
    expect(nextButton).toBeEnabled();

    // Picking a real State (Maharashtra State Board only appears once its State is chosen)
    // resets the now-stale City/Board/Class/Subject -- Next disables again until they're re-set.
    await u.selectOptions(screen.getByLabelText('State:'), 'Maharashtra');
    expect(nextButton).toBeDisabled();

    // City left as "Not Applicable" (a sentinel, not a real city) -- still invalid for a
    // state-scoped board even though a real State is now chosen.
    await u.selectOptions(screen.getByLabelText('City:'), 'Not Applicable');
    await u.selectOptions(screen.getByLabelText('Board:'), 'Maharashtra State Board');
    await u.selectOptions(screen.getByLabelText('Class Level:'), 'Class 10');
    await u.selectOptions(screen.getByLabelText('Subject:'), 'Physics');
    expect(nextButton).toBeDisabled();

    // A real City finally satisfies the state-scoped board's requirement.
    await u.selectOptions(screen.getByLabelText('City:'), 'Mumbai');
    await u.selectOptions(screen.getByLabelText('Board:'), 'Maharashtra State Board');
    await u.selectOptions(screen.getByLabelText('Class Level:'), 'Class 10');
    await u.selectOptions(screen.getByLabelText('Subject:'), 'Physics');
    expect(nextButton).toBeEnabled();
  });

  it('Step 4 Thumbnails: 4th upload is rejected inline with a clear message', async () => {
    const u = userEvent.setup();
    renderWizard();

    await u.type(screen.getByLabelText('Course Title:'), 'Intro to Physics');
    await u.click(screen.getByRole('button', { name: /next/i })); // step 2
    await u.click(screen.getByRole('button', { name: /next/i })); // step 3
    await u.selectOptions(screen.getByLabelText('Country:'), 'country_in');
    await u.selectOptions(screen.getByLabelText('State:'), 'National / Not Applicable');
    await u.selectOptions(screen.getByLabelText('City:'), 'Not Applicable');
    await u.selectOptions(screen.getByLabelText('Board:'), 'CBSE');
    await u.selectOptions(screen.getByLabelText('Class Level:'), 'Class 10');
    await u.selectOptions(screen.getByLabelText('Subject:'), 'Physics');
    await u.click(screen.getByRole('button', { name: /next/i })); // step 4

    expect(screen.getByText('Step 4 of 4')).toBeInTheDocument();

    const fileInput = screen.getByTestId('thumbnail-file-input') as HTMLInputElement;
    for (let i = 0; i < 3; i++) {
      const file = new File(['x'], `thumb-${i}.png`, { type: 'image/png' });
      await u.upload(fileInput, file);
      await u.click(screen.getByRole('button', { name: /confirm crop/i }));
      // eslint-disable-next-line no-await-in-loop -- sequential by design, each upload depends on the previous state
      await waitFor(() => expect(screen.getByText(new RegExp(`${i + 1}/3`))).toBeInTheDocument());
    }

    const overflowFile = new File(['x'], 'thumb-overflow.png', { type: 'image/png' });
    await u.upload(fileInput, overflowFile);
    expect(screen.getByRole('alert')).toHaveTextContent(/maximum 3 thumbnails/i);
  });

  it('Step 4 crop tool: arrow keys adjust crop position', async () => {
    const u = userEvent.setup();
    renderWizard();

    await u.type(screen.getByLabelText('Course Title:'), 'Intro to Physics');
    await u.click(screen.getByRole('button', { name: /next/i }));
    await u.click(screen.getByRole('button', { name: /next/i }));
    await u.selectOptions(screen.getByLabelText('Country:'), 'country_in');
    await u.selectOptions(screen.getByLabelText('State:'), 'National / Not Applicable');
    await u.selectOptions(screen.getByLabelText('City:'), 'Not Applicable');
    await u.selectOptions(screen.getByLabelText('Board:'), 'CBSE');
    await u.selectOptions(screen.getByLabelText('Class Level:'), 'Class 10');
    await u.selectOptions(screen.getByLabelText('Subject:'), 'Physics');
    await u.click(screen.getByRole('button', { name: /next/i }));

    const fileInput = screen.getByTestId('thumbnail-file-input') as HTMLInputElement;
    const file = new File(['x'], 'thumb.png', { type: 'image/png' });
    await u.upload(fileInput, file);

    const cropRegion = screen.getByTestId('crop-region');
    const xInput = screen.getByLabelText('X %') as HTMLInputElement;
    const initialX = xInput.value;

    cropRegion.focus();
    await u.keyboard('{ArrowRight}');
    expect(xInput.value).not.toBe(initialX);

    // Numeric fallback also works.
    await u.clear(xInput);
    await u.type(xInput, '75');
    expect(xInput.value).toBe('75');
  });

  it('Finish calls onComplete and does not render any Course Content Editor UI', async () => {
    const u = userEvent.setup();
    const { onComplete } = renderWizard();

    await u.type(screen.getByLabelText('Course Title:'), 'Intro to Physics');
    await u.click(screen.getByRole('button', { name: /next/i }));
    await u.click(screen.getByRole('button', { name: /next/i }));
    await u.selectOptions(screen.getByLabelText('Country:'), 'country_in');
    await u.selectOptions(screen.getByLabelText('State:'), 'National / Not Applicable');
    await u.selectOptions(screen.getByLabelText('City:'), 'Not Applicable');
    await u.selectOptions(screen.getByLabelText('Board:'), 'CBSE');
    await u.selectOptions(screen.getByLabelText('Class Level:'), 'Class 10');
    await u.selectOptions(screen.getByLabelText('Subject:'), 'Physics');
    await u.click(screen.getByRole('button', { name: /next/i }));

    await u.click(screen.getByRole('button', { name: /finish/i }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith('draft_mock_1'));
    expect(screen.queryByText(/content editor/i)).not.toBeInTheDocument();
  });

  it('Next shows a Saving… state while commitStep is in flight, and Back is disabled meanwhile', async () => {
    const u = userEvent.setup();
    let resolveCreate: (dto: CourseDraftDto) => void = () => {};
    vi.mocked(courseDraftService.createDraftCourse).mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );
    renderWizard();

    await u.type(screen.getByLabelText('Course Title:'), 'Intro to Physics');
    const nextButton = screen.getByRole('button', { name: /next/i });
    await u.click(nextButton);

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();

    resolveCreate(makeDraftDto());
    await waitFor(() => expect(screen.getByText('Step 2 of 4')).toBeInTheDocument());
  });

  it('does not advance and shows an inline error when commitStep fails', async () => {
    const u = userEvent.setup();
    vi.mocked(courseDraftService.createDraftCourse).mockRejectedValue(new Error('Could not reach the server. Please try again.'));
    renderWizard();

    await u.type(screen.getByLabelText('Course Title:'), 'Intro to Physics');
    await u.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not reach the server/i));
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
  });

  it('Back navigates immediately even when a save would fail -- it is not gated on commitStep', async () => {
    const u = userEvent.setup();
    renderWizard();

    await u.type(screen.getByLabelText('Course Title:'), 'Intro to Physics');
    await u.click(screen.getByRole('button', { name: /next/i })); // -> step 2, real commitStep succeeds here
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();

    // Now make any further save attempt fail -- Back must still work despite this.
    vi.mocked(courseDraftService.updateDraftCourse).mockRejectedValue(new Error('network down'));
    await u.click(screen.getByRole('button', { name: /back/i }));

    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    expect(courseDraftService.updateDraftCourse).not.toHaveBeenCalled();
  });

  it('preserves field values navigating Back then Next across steps', async () => {
    const u = userEvent.setup();
    renderWizard();

    await u.type(screen.getByLabelText('Course Title:'), 'Intro to Physics');
    await u.click(screen.getByRole('button', { name: /next/i })); // -> step 2
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: /back/i })); // -> step 1
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    expect(screen.getByLabelText('Course Title:')).toHaveValue('Intro to Physics');

    await u.click(screen.getByRole('button', { name: /next/i })); // -> step 2 again
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
  });

  it('closing the wizard resets the draft, so a later reopen starts blank instead of pre-filled', async () => {
    const u = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<CourseWizard isOpen onClose={onClose} onComplete={vi.fn()} />);

    await u.type(screen.getByLabelText('Course Title:'), 'First Course');
    // The panel's own Close (X) button -- SidePanel's onClose, wired to CourseWizard's handleClose.
    await u.click(screen.getByLabelText('Close panel'));
    expect(onClose).toHaveBeenCalled();

    // Simulate the parent flipping isOpen back to false then true again (as TutorEducatorHubView does).
    rerender(<CourseWizard isOpen={false} onClose={onClose} onComplete={vi.fn()} />);
    rerender(<CourseWizard isOpen onClose={onClose} onComplete={vi.fn()} />);

    expect(screen.getByLabelText('Course Title:')).toHaveValue('');
  });

  it('finishing the wizard also resets the draft for the next session', async () => {
    const u = userEvent.setup();
    const { rerender } = render(<CourseWizard isOpen onClose={vi.fn()} onComplete={vi.fn()} />);

    await u.type(screen.getByLabelText('Course Title:'), 'First Course');
    await u.click(screen.getByRole('button', { name: /next/i }));
    await u.click(screen.getByRole('button', { name: /next/i }));
    await u.selectOptions(screen.getByLabelText('Country:'), 'country_in');
    await u.selectOptions(screen.getByLabelText('State:'), 'National / Not Applicable');
    await u.selectOptions(screen.getByLabelText('City:'), 'Not Applicable');
    await u.selectOptions(screen.getByLabelText('Board:'), 'CBSE');
    await u.selectOptions(screen.getByLabelText('Class Level:'), 'Class 10');
    await u.selectOptions(screen.getByLabelText('Subject:'), 'Physics');
    await u.click(screen.getByRole('button', { name: /next/i }));
    await u.click(screen.getByRole('button', { name: /finish/i }));
    // Finishing resets the draft (step back to 1) once commitStep + onComplete resolve.
    await waitFor(() => expect(screen.getByText('Step 1 of 4')).toBeInTheDocument());

    rerender(<CourseWizard isOpen={false} onClose={vi.fn()} onComplete={vi.fn()} />);
    rerender(<CourseWizard isOpen onClose={vi.fn()} onComplete={vi.fn()} />);

    expect(screen.getByLabelText('Course Title:')).toHaveValue('');
  });

  it('Step 3: the state-scoped-board warning only shows while its requirement is unmet, and clears once satisfied', async () => {
    const u = userEvent.setup();
    renderWizard();

    await u.type(screen.getByLabelText('Course Title:'), 'Intro to Physics');
    await u.click(screen.getByRole('button', { name: /next/i }));
    await u.click(screen.getByRole('button', { name: /next/i }));

    await u.selectOptions(screen.getByLabelText('Country:'), 'country_in');
    expect(screen.queryByText(/requires a specific State and City/i)).not.toBeInTheDocument();

    await u.selectOptions(screen.getByLabelText('State:'), 'Maharashtra');
    await u.selectOptions(screen.getByLabelText('City:'), 'Not Applicable');
    await u.selectOptions(screen.getByLabelText('Board:'), 'Maharashtra State Board');
    // Sentinel City still selected -- the state-scoped board's requirement is unmet.
    expect(screen.getByText(/requires a specific State and City/i)).toBeInTheDocument();

    await u.selectOptions(screen.getByLabelText('City:'), 'Mumbai');
    await u.selectOptions(screen.getByLabelText('Board:'), 'Maharashtra State Board');
    // A real City now satisfies it -- the warning must clear, not linger.
    expect(screen.queryByText(/requires a specific State and City/i)).not.toBeInTheDocument();
  });

  it('Step 4: "Add thumbnail" is disabled while a crop is pending, revoking the previous blob URL on cancel', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const u = userEvent.setup();
    renderWizard();

    await u.type(screen.getByLabelText('Course Title:'), 'Intro to Physics');
    await u.click(screen.getByRole('button', { name: /next/i }));
    await u.click(screen.getByRole('button', { name: /next/i }));
    await u.selectOptions(screen.getByLabelText('Country:'), 'country_in');
    await u.selectOptions(screen.getByLabelText('State:'), 'National / Not Applicable');
    await u.selectOptions(screen.getByLabelText('City:'), 'Not Applicable');
    await u.selectOptions(screen.getByLabelText('Board:'), 'CBSE');
    await u.selectOptions(screen.getByLabelText('Class Level:'), 'Class 10');
    await u.selectOptions(screen.getByLabelText('Subject:'), 'Physics');
    await u.click(screen.getByRole('button', { name: /next/i }));

    const fileInput = screen.getByTestId('thumbnail-file-input') as HTMLInputElement;
    await u.upload(fileInput, new File(['x'], 'thumb.png', { type: 'image/png' }));

    expect(screen.getByRole('button', { name: 'Add thumbnail' })).toBeDisabled();

    await u.click(screen.getByRole('button', { name: /cancel/i }));
    expect(revokeSpy).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Add thumbnail' })).toBeEnabled();
    revokeSpy.mockRestore();
  });
});
