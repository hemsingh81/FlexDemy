import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useProfileSetup } from '@/src/features/ProfileSetup/useProfileSetup';
import { useDomain } from '@/src/context/DomainContext';
import * as masterDataService from '@/src/services/masterDataService';
import * as profileService from '@/src/services/profileService';
import { UserProfile } from '@/src/types';

vi.mock('@/src/context/DomainContext');
vi.mock('@/src/services/masterDataService');
// Keeps the real ProfileError class (rather than a full automock) so the hook's
// `err instanceof profileService.ProfileError` check in its catch block still holds.
vi.mock('@/src/services/profileService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/profileService')>('@/src/services/profileService');
  return { ...actual, completeStudentProfile: vi.fn(), submitTutorApplication: vi.fn(), getMyProfileStatus: vi.fn() };
});

const user: UserProfile = {
  id: 'usr_1',
  name: 'Hem Singh',
  email: 'hem@flexdemy.com',
  avatar: 'avatar.png',
  role: 'Unassigned',
  streakDays: 0,
  totalPoints: 0,
  isDarkMode: false,
  progress: {},
};

const country = { id: 'ctry_in', name: 'India', isoCode: 'IN', isActive: true };
const state1 = { id: 'state_dl', countryId: 'ctry_in', name: 'Delhi', code: 'DL', isActive: true };
const city1 = { id: 'city_ndl', stateId: 'state_dl', name: 'New Delhi', isActive: true };
const classLevel = { id: 'cl_10', name: 'Class 10', sortOrder: 10, isActive: true, subjectIds: ['sub_phy'] };
const preNursery = { id: 'cl_pn', name: 'Pre-Nursery', sortOrder: 0, isActive: true, subjectIds: [] };
const nationalBoard = { id: 'brd_cbse', name: 'CBSE', code: 'CBSE', stateId: null, isActive: true };
const stateBoard = { id: 'brd_dl', name: 'Delhi State Board', code: 'DLSB', stateId: 'state_dl', isActive: true };
const otherStateBoard = { id: 'brd_up', name: 'UP State Board', code: 'UPSB', stateId: 'state_up', isActive: true };
const subjectPhysics = { id: 'sub_phy', name: 'Physics', stream: 'Science', isActive: true };
const subjectChemistry = { id: 'sub_chem', name: 'Chemistry', stream: 'Science', isActive: true };

const updateUser = vi.fn();

describe('useProfileSetup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useDomain).mockReturnValue({
      user,
      courses: [],
      isLoading: false,
      ensureEnrolled: vi.fn(),
      updateUser,
      awardPoints: vi.fn(),
      completeLesson: vi.fn(),
      addCourse: vi.fn(),
      rolePermissions: null,
      refreshRolePermissions: vi.fn(),
    });
    vi.mocked(masterDataService.getCountries).mockResolvedValue([country]);
    vi.mocked(masterDataService.getClassLevels).mockResolvedValue([classLevel]);
    vi.mocked(masterDataService.getSubjects).mockResolvedValue([subjectPhysics]);
    vi.mocked(masterDataService.getBoards).mockResolvedValue([nationalBoard, stateBoard, otherStateBoard]);
    vi.mocked(masterDataService.getStates).mockResolvedValue([state1]);
    vi.mocked(masterDataService.getCities).mockResolvedValue([city1]);
  });

  it('loads country-independent master data on mount', async () => {
    const { result } = renderHook(() => useProfileSetup());

    expect(result.current.isLoadingMasterData).toBe(true);

    await waitFor(() => expect(result.current.isLoadingMasterData).toBe(false));

    expect(result.current.countries).toEqual([country]);
    expect(result.current.classLevels).toEqual([classLevel]);
    expect(result.current.subjects).toEqual([subjectPhysics]);
    // availableBoards filters the full board list down to national (no stateId) boards
    // until a state is selected.
    expect(result.current.availableBoards).toEqual([nationalBoard]);
  });

  it('selecting a country fetches its states and clears any downstream state/city selection', async () => {
    const { result } = renderHook(() => useProfileSetup());
    await waitFor(() => expect(result.current.isLoadingMasterData).toBe(false));

    await act(async () => {
      result.current.selectCountry('ctry_in');
    });

    expect(masterDataService.getStates).toHaveBeenCalledWith('ctry_in');
    await waitFor(() => expect(result.current.states).toEqual([state1]));
    expect(result.current.countryId).toBe('ctry_in');
    expect(result.current.stateId).toBe('');
    expect(result.current.cityId).toBe('');
    expect(result.current.cities).toEqual([]);
  });

  it('selecting a state fetches its cities, clears the city selection, and narrows availableBoards', async () => {
    const { result } = renderHook(() => useProfileSetup());
    await waitFor(() => expect(result.current.isLoadingMasterData).toBe(false));

    await act(async () => {
      result.current.selectCountry('ctry_in');
    });
    await waitFor(() => expect(result.current.states).toEqual([state1]));

    await act(async () => {
      result.current.selectCity('city_ndl'); // pretend a city was picked before changing state
    });
    await act(async () => {
      result.current.selectState('state_dl');
    });

    expect(masterDataService.getCities).toHaveBeenCalledWith('state_dl');
    await waitFor(() => expect(result.current.cities).toEqual([city1]));
    expect(result.current.stateId).toBe('state_dl');
    expect(result.current.cityId).toBe('');
    // national board + Delhi's own state board, but not UP's.
    expect(result.current.availableBoards).toEqual([nationalBoard, stateBoard]);
  });

  it('submitStudentProfile sets an error and does not call the service when required fields are missing', async () => {
    const { result } = renderHook(() => useProfileSetup());
    await waitFor(() => expect(result.current.isLoadingMasterData).toBe(false));

    await act(async () => {
      await result.current.submitStudentProfile();
    });

    expect(profileService.completeStudentProfile).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/complete every field/i);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('submitStudentProfile calls profileService and flips the user role to Student on success', async () => {
    vi.mocked(profileService.completeStudentProfile).mockResolvedValue({
      id: 'sp_1',
      userId: 'usr_1',
      classLevelId: 'cl_10',
      boardId: 'brd_cbse',
      countryId: 'ctry_in',
      stateId: 'state_dl',
      cityId: 'city_ndl',
      subjectIds: ['sub_phy'],
      createdAt: '2026-08-09T00:00:00Z',
      updatedAt: '2026-08-09T00:00:00Z',
    });

    const { result } = renderHook(() => useProfileSetup());
    await waitFor(() => expect(result.current.isLoadingMasterData).toBe(false));

    act(() => result.current.selectCountry('ctry_in'));
    await waitFor(() => expect(result.current.states).toEqual([state1]));
    act(() => result.current.selectState('state_dl'));
    await waitFor(() => expect(result.current.cities).toEqual([city1]));
    act(() => result.current.selectCity('city_ndl'));
    act(() => result.current.setClassLevelId('cl_10'));
    act(() => result.current.setBoardId('brd_cbse'));
    act(() => result.current.toggleSubject('sub_phy'));

    await act(async () => {
      await result.current.submitStudentProfile();
    });

    expect(profileService.completeStudentProfile).toHaveBeenCalledWith({
      classLevelId: 'cl_10',
      boardId: 'brd_cbse',
      countryId: 'ctry_in',
      stateId: 'state_dl',
      cityId: 'city_ndl',
      subjectIds: ['sub_phy'],
    });
    expect(updateUser).toHaveBeenCalledWith({ role: 'Student' });
    expect(result.current.error).toBe('');
  });

  it('submitTutorApplication calls profileService and flips the user role to PendingTutor on success', async () => {
    vi.mocked(profileService.submitTutorApplication).mockResolvedValue({
      id: 'tp_1',
      userId: 'usr_1',
      subjectIds: ['sub_phy'],
      countryId: 'ctry_in',
      stateId: 'state_dl',
      cityId: 'city_ndl',
      bio: 'Bio',
      qualifications: 'Quals',
      reviewedByUserId: null,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: '2026-08-09T00:00:00Z',
      updatedAt: '2026-08-09T00:00:00Z',
    });

    const { result } = renderHook(() => useProfileSetup());
    await waitFor(() => expect(result.current.isLoadingMasterData).toBe(false));

    act(() => result.current.selectCountry('ctry_in'));
    await waitFor(() => expect(result.current.states).toEqual([state1]));
    act(() => result.current.selectState('state_dl'));
    await waitFor(() => expect(result.current.cities).toEqual([city1]));
    act(() => result.current.selectCity('city_ndl'));
    act(() => result.current.toggleSubject('sub_phy'));
    act(() => result.current.setBio('Bio'));
    act(() => result.current.setQualifications('Quals'));

    await act(async () => {
      await result.current.submitTutorApplication();
    });

    expect(profileService.submitTutorApplication).toHaveBeenCalledWith({
      subjectIds: ['sub_phy'],
      countryId: 'ctry_in',
      stateId: 'state_dl',
      cityId: 'city_ndl',
      bio: 'Bio',
      qualifications: 'Quals',
    });
    expect(updateUser).toHaveBeenCalledWith({ role: 'PendingTutor' });
  });

  describe('subject filtering by class level (Part B)', () => {
    beforeEach(() => {
      vi.mocked(masterDataService.getClassLevels).mockResolvedValue([classLevel, preNursery]);
      vi.mocked(masterDataService.getSubjects).mockResolvedValue([subjectPhysics, subjectChemistry]);
    });

    it('narrows availableSubjects to the selected class level\'s subjectIds', async () => {
      const { result } = renderHook(() => useProfileSetup());
      await waitFor(() => expect(result.current.isLoadingMasterData).toBe(false));

      expect(result.current.availableSubjects).toEqual([subjectPhysics, subjectChemistry]);

      act(() => result.current.setClassLevelId('cl_10'));

      expect(result.current.availableSubjects).toEqual([subjectPhysics]);
      expect(result.current.subjectSelectionRequired).toBe(true);
    });

    it('falls back to all subjects and marks selection not-required for a class level with an empty subjectIds list', async () => {
      const { result } = renderHook(() => useProfileSetup());
      await waitFor(() => expect(result.current.isLoadingMasterData).toBe(false));

      act(() => result.current.setClassLevelId('cl_pn'));

      expect(result.current.availableSubjects).toEqual([subjectPhysics, subjectChemistry]);
      expect(result.current.subjectSelectionRequired).toBe(false);
    });

    it('clears already-selected subjects that are no longer valid when the class level changes', async () => {
      const { result } = renderHook(() => useProfileSetup());
      await waitFor(() => expect(result.current.isLoadingMasterData).toBe(false));

      act(() => result.current.setClassLevelId('cl_10'));
      act(() => result.current.toggleSubject('sub_phy'));
      expect(result.current.subjectIds).toEqual(['sub_phy']);

      act(() => result.current.setClassLevelId('cl_pn'));

      expect(result.current.subjectIds).toEqual([]);
    });

    it('does not require a subject selection when submitting for a class level with no subjects', async () => {
      vi.mocked(profileService.completeStudentProfile).mockResolvedValue({
        id: 'sp_1',
        userId: 'usr_1',
        classLevelId: 'cl_pn',
        boardId: 'brd_cbse',
        countryId: 'ctry_in',
        stateId: 'state_dl',
        cityId: 'city_ndl',
        subjectIds: [],
        createdAt: '2026-08-09T00:00:00Z',
        updatedAt: '2026-08-09T00:00:00Z',
      });

      const { result } = renderHook(() => useProfileSetup());
      await waitFor(() => expect(result.current.isLoadingMasterData).toBe(false));

      act(() => result.current.selectCountry('ctry_in'));
      await waitFor(() => expect(result.current.states).toEqual([state1]));
      act(() => result.current.selectState('state_dl'));
      await waitFor(() => expect(result.current.cities).toEqual([city1]));
      act(() => result.current.selectCity('city_ndl'));
      act(() => result.current.setClassLevelId('cl_pn'));
      act(() => result.current.setBoardId('brd_cbse'));

      await act(async () => {
        await result.current.submitStudentProfile();
      });

      expect(profileService.completeStudentProfile).toHaveBeenCalledWith({
        classLevelId: 'cl_pn',
        boardId: 'brd_cbse',
        countryId: 'ctry_in',
        stateId: 'state_dl',
        cityId: 'city_ndl',
        subjectIds: [],
      });
      expect(result.current.error).toBe('');
    });
  });

  it('surfaces the service error message and does not update the user role on failure', async () => {
    vi.mocked(profileService.completeStudentProfile).mockRejectedValue(
      new profileService.ProfileError('Class level not found.')
    );

    const { result } = renderHook(() => useProfileSetup());
    await waitFor(() => expect(result.current.isLoadingMasterData).toBe(false));

    act(() => result.current.selectCountry('ctry_in'));
    await waitFor(() => expect(result.current.states).toEqual([state1]));
    act(() => result.current.selectState('state_dl'));
    await waitFor(() => expect(result.current.cities).toEqual([city1]));
    act(() => result.current.selectCity('city_ndl'));
    act(() => result.current.setClassLevelId('cl_10'));
    act(() => result.current.setBoardId('brd_cbse'));
    act(() => result.current.toggleSubject('sub_phy'));

    await act(async () => {
      await result.current.submitStudentProfile();
    });

    expect(result.current.error).toBe('Class level not found.');
    expect(updateUser).not.toHaveBeenCalled();
  });
});
