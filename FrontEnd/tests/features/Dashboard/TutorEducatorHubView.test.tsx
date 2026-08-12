import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TutorEducatorHubView } from '@/src/features/Dashboard/TutorEducatorHubView';
import { UserProfile } from '@/src/types';
import * as courseDraftService from '@/src/services/courseDraftService';
import * as tagsService from '@/src/services/tagsService';
import * as masterDataService from '@/src/services/masterDataService';

// Story 2.4: CourseWizard's Next/Finish now persist via courseDraftService -- mocked so this
// file's real focus (wiring the wizard trigger into the hub) doesn't depend on a real backend.
vi.mock('@/src/services/courseDraftService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseDraftService')>('@/src/services/courseDraftService');
  return { ...actual, createDraftCourse: vi.fn(), updateDraftCourse: vi.fn() };
});

// Story 2.5: useCourseDraft.ts now fetches real Tags/Taxonomy data on mount -- mocked so this
// file's tests don't depend on a real backend either.
vi.mock('@/src/services/tagsService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/tagsService')>('@/src/services/tagsService');
  return { ...actual, getTags: vi.fn() };
});
vi.mock('@/src/services/masterDataService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/masterDataService')>('@/src/services/masterDataService');
  return { ...actual, getCountries: vi.fn(), getStates: vi.fn(), getCities: vi.fn(), getBoards: vi.fn(), getClassLevels: vi.fn(), getSubjects: vi.fn() };
});

beforeEach(() => {
  vi.clearAllMocks();
  const draftDto = {
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
  };
  vi.mocked(courseDraftService.createDraftCourse).mockResolvedValue(draftDto);
  vi.mocked(courseDraftService.updateDraftCourse).mockResolvedValue(draftDto);
  vi.mocked(tagsService.getTags).mockResolvedValue([]);
  // Fixture data mirrors the old MOCK_* constants useCourseDraft.ts used to hardcode (Story 2.1),
  // so existing taxonomy-flow assertions (country_in/CBSE/Class 10/Physics) keep working.
  vi.mocked(masterDataService.getCountries).mockResolvedValue([{ id: 'country_in', name: 'India', isoCode: 'IN', isActive: true }]);
  vi.mocked(masterDataService.getStates).mockResolvedValue([
    { id: 'state_mh', countryId: 'country_in', name: 'Maharashtra', code: 'MH', isActive: true },
  ]);
  vi.mocked(masterDataService.getCities).mockResolvedValue([{ id: 'city_mumbai', stateId: 'state_mh', name: 'Mumbai', isActive: true }]);
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
});

const user: UserProfile = {
  id: 'tutor_1',
  name: 'Dr. Elena Rostova',
  email: '',
  avatar: '',
  role: 'Tutor',
  streakDays: 4,
  totalPoints: 250,
  isDarkMode: false,
  progress: {},
};

describe('TutorEducatorHubView', () => {
  it('renders the educator studio header and calendar sections', () => {
    render(
      <TutorEducatorHubView
        user={user}
        courses={[]}
        onAddCourse={vi.fn()}
        tutorSlots={[]}
        onUpdateSlot={vi.fn()}
        groupRequests={[]}
        publicClasses={[]}
        onAnnouncePublicClass={vi.fn()}
        isOnline={true}
        onToggleOnlineStatus={vi.fn()}
      />
    );

    expect(screen.getByText('Educator & Instructor Studio')).toBeInTheDocument();
    expect(screen.getByText('Interactive Calendar Slots & Public Live Classes')).toBeInTheDocument();
  });

  it('adds a teaching calendar slot via the Add Slot modal, calling onUpdateSlot', async () => {
    const onUpdateSlot = vi.fn();
    const u = userEvent.setup();

    render(
      <TutorEducatorHubView
        user={user}
        courses={[]}
        onAddCourse={vi.fn()}
        tutorSlots={[]}
        onUpdateSlot={onUpdateSlot}
        groupRequests={[]}
        publicClasses={[]}
        onAnnouncePublicClass={vi.fn()}
        isOnline={true}
        onToggleOnlineStatus={vi.fn()}
      />
    );

    await u.click(screen.getByText('+ Add 1-on-1 Slot'));
    await u.click(screen.getByText('Save Slot'));

    expect(onUpdateSlot).toHaveBeenCalledWith(
      expect.objectContaining({
        tutorId: user.id,
        tutorName: user.name,
        sessionType: 'one_on_one',
        topic: 'Class 12th Quantum Vector Derivations',
      })
    );
  });

  it('opens the new CourseWizard (not the old inline wizard) from the "New Course Wizard" trigger', async () => {
    const u = userEvent.setup();

    render(
      <TutorEducatorHubView
        user={user}
        courses={[]}
        onAddCourse={vi.fn()}
        tutorSlots={[]}
        onUpdateSlot={vi.fn()}
        groupRequests={[]}
        publicClasses={[]}
        onAnnouncePublicClass={vi.fn()}
        isOnline={true}
        onToggleOnlineStatus={vi.fn()}
      />
    );

    await u.click(screen.getByText('New Course Wizard'));

    expect(screen.getByRole('dialog', { name: 'New Course Wizard' })).toBeInTheDocument();
    // The old inline wizard's own dialog title/first-step content must not appear.
    expect(screen.queryByRole('dialog', { name: 'Course Creation Wizard' })).not.toBeInTheDocument();
    expect(screen.queryByText('Target Grade Tag:')).not.toBeInTheDocument();
  });

  it('finishing the CourseWizard opens Course Content Editor, not just closing the wizard', async () => {
    const u = userEvent.setup();

    render(
      <TutorEducatorHubView
        user={user}
        courses={[]}
        onAddCourse={vi.fn()}
        tutorSlots={[]}
        onUpdateSlot={vi.fn()}
        groupRequests={[]}
        publicClasses={[]}
        onAnnouncePublicClass={vi.fn()}
        isOnline={true}
        onToggleOnlineStatus={vi.fn()}
      />
    );

    await u.click(screen.getByText('New Course Wizard'));
    await u.type(screen.getByLabelText('Course Title:'), 'Intro to Physics');
    await u.click(screen.getByRole('button', { name: /next/i })); // -> Tags
    await u.click(screen.getByRole('button', { name: /next/i })); // -> Taxonomy
    await u.selectOptions(screen.getByLabelText('Country:'), 'country_in');
    await u.selectOptions(screen.getByLabelText('State:'), 'National / Not Applicable');
    await u.selectOptions(screen.getByLabelText('City:'), 'Not Applicable');
    await u.selectOptions(screen.getByLabelText('Board:'), 'CBSE');
    await u.selectOptions(screen.getByLabelText('Class Level:'), 'Class 10');
    await u.selectOptions(screen.getByLabelText('Subject:'), 'Physics');
    await u.click(screen.getByRole('button', { name: /next/i })); // -> Thumbnails
    await u.click(screen.getByRole('button', { name: /finish/i }));

    // Course Content Editor is a full-width surface, not a modal dialog (UX-DR5) -- role="region".
    await waitFor(() => expect(screen.getByRole('region', { name: 'Course Content Editor' })).toBeInTheDocument());
    expect(screen.queryByRole('dialog', { name: 'New Course Wizard' })).not.toBeInTheDocument();

    // The trigger stays disabled while Course Content Editor is open, so a keyboard user can't
    // open a second CourseWizard session on top of it.
    expect(screen.getByText('New Course Wizard').closest('button')).toBeDisabled();
  });

  it('toggles online status when the live status button is clicked', async () => {
    const onToggleOnlineStatus = vi.fn();
    const u = userEvent.setup();

    render(
      <TutorEducatorHubView
        user={user}
        courses={[]}
        onAddCourse={vi.fn()}
        tutorSlots={[]}
        onUpdateSlot={vi.fn()}
        groupRequests={[]}
        publicClasses={[]}
        onAnnouncePublicClass={vi.fn()}
        isOnline={true}
        onToggleOnlineStatus={onToggleOnlineStatus}
      />
    );

    await u.click(screen.getByText('🟢 ONLINE (Accepting Calls)'));
    expect(onToggleOnlineStatus).toHaveBeenCalled();
  });
});
