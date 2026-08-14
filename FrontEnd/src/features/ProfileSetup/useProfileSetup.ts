import { useCallback, useMemo, useState } from 'react';
import { useDomain } from '../../context/DomainContext';
import * as masterDataService from '../../services/masterDataService';
import * as profileService from '../../services/profileService';
import { Country, State, City, Board, ClassLevel, Subject } from '../../services/masterDataService';
import { useAsync } from '../../hooks/useAsync';

export type ProfileSetupRole = 'Student' | 'Tutor';

// Explicit return shape (rather than relying on inference) so StudentProfileForm.tsx /
// TutorProfileForm.tsx's `ReturnType<typeof useProfileSetup>` prop type is unambiguous.
export interface ProfileSetupState {
  role: ProfileSetupRole | null;
  chooseRole: (next: ProfileSetupRole | null) => void;
  countries: Country[];
  states: State[];
  cities: City[];
  classLevels: ClassLevel[];
  subjects: Subject[];
  availableBoards: Board[];
  // Subjects narrowed to the selected ClassLevel's subjectIds (Student flow only -- Tutor
  // has no class level, so TutorProfileForm keeps using the unfiltered `subjects` above).
  // Falls back to the full `subjects` list when no class level is selected yet, or when the
  // selected one has a non-empty subjectIds list to filter against.
  availableSubjects: Subject[];
  // False when the selected class level has an empty subjectIds list (e.g. Pre-Nursery..UKG
  // in the seed data) -- those levels genuinely have no subjects to choose, so the form
  // should hide subject selection rather than show a confusing empty multi-select, and
  // submission shouldn't require at least one subject.
  subjectSelectionRequired: boolean;
  isLoadingMasterData: boolean;
  countryId: string;
  stateId: string;
  cityId: string;
  classLevelId: string;
  boardId: string;
  subjectIds: string[];
  bio: string;
  qualifications: string;
  selectCountry: (id: string) => void;
  selectState: (id: string) => void;
  selectCity: (id: string) => void;
  setClassLevelId: (id: string) => void;
  setBoardId: (id: string) => void;
  toggleSubject: (id: string) => void;
  setBio: (value: string) => void;
  setQualifications: (value: string) => void;
  isSubmitting: boolean;
  error: string;
  submitStudentProfile: () => Promise<void>;
  submitTutorApplication: () => Promise<void>;
}

interface InitialMasterData {
  countries: Country[];
  classLevels: ClassLevel[];
  subjects: Subject[];
  boards: Board[];
}

const EMPTY_MASTER_DATA: InitialMasterData = { countries: [], classLevels: [], subjects: [], boards: [] };

// Feature-local hook (AD-2) for the whole ProfileSetup folder -- ProfileSetupPage uses the
// role/chooseRole step, TutorRejectedPage ignores that and drives submitStudentProfile /
// submitTutorApplication directly from its own re-apply / switch-to-student choice. Both
// pages get their own instance (mirrors useDashboard/useTutorHub: one hook call per
// top-level page that needs it, not a singleton).
export const useProfileSetup = (): ProfileSetupState => {
  const { updateUser } = useDomain();

  const [role, setRole] = useState<ProfileSetupRole | null>(null);
  const chooseRole = useCallback((next: ProfileSetupRole | null) => setRole(next), []);

  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  const [countryId, setCountryId] = useState('');
  const [stateId, setStateId] = useState('');
  const [cityId, setCityId] = useState('');
  const [classLevelId, setClassLevelIdState] = useState('');
  const [boardId, setBoardId] = useState('');
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [qualifications, setQualifications] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Country-independent lookups fetched once on mount. Boards are fetched with no parentId
  // so national boards (no StateId) come back alongside every state's board in one call --
  // availableBoards below filters that full list against the currently selected state.
  const { data: masterData, isLoading: isLoadingMasterData } = useAsync<InitialMasterData>(
    () =>
      Promise.all([
        masterDataService.getCountries(),
        masterDataService.getClassLevels(),
        masterDataService.getSubjects(),
        masterDataService.getBoards(),
      ]).then(([countries, classLevels, subjects, boards]) => ({ countries, classLevels, subjects, boards })),
    EMPTY_MASTER_DATA,
    []
  );
  const { countries, classLevels, subjects, boards } = masterData;

  const availableBoards = useMemo(
    () => boards.filter((b) => b.stateId === null || b.stateId === stateId),
    [boards, stateId]
  );

  const selectedClassLevel = useMemo(
    () => classLevels.find((cl) => cl.id === classLevelId) ?? null,
    [classLevels, classLevelId]
  );

  // See ProfileSetupState.subjectSelectionRequired above.
  const subjectSelectionRequired = !(selectedClassLevel && selectedClassLevel.subjectIds.length === 0);

  const availableSubjects = useMemo(() => {
    if (!selectedClassLevel || selectedClassLevel.subjectIds.length === 0) return subjects;
    const allowed = new Set(selectedClassLevel.subjectIds);
    return subjects.filter((s) => allowed.has(s.id));
  }, [subjects, selectedClassLevel]);

  const selectCountry = useCallback((id: string) => {
    setCountryId(id);
    setStateId('');
    setCityId('');
    setStates([]);
    setCities([]);
    if (id) {
      masterDataService.getStates(id).then(setStates);
    }
  }, []);

  const selectState = useCallback((id: string) => {
    setStateId(id);
    setCityId('');
    setCities([]);
    if (id) {
      masterDataService.getCities(id).then(setCities);
    }
  }, []);

  const selectCity = useCallback((id: string) => setCityId(id), []);

  // Wraps the raw setter so any already-selected subjects that no longer belong to the newly
  // chosen class level's subjectIds get dropped (plan Part B) -- e.g. switching from Class 10
  // (Physics selected) to Pre-Nursery (no subjects) clears Physics rather than silently
  // carrying forward a now-invalid selection.
  const setClassLevelId = useCallback(
    (id: string) => {
      setClassLevelIdState(id);
      setSubjectIds((prev) => {
        const next = classLevels.find((cl) => cl.id === id);
        if (!next) return prev;
        if (next.subjectIds.length === 0) return [];
        const allowed = new Set(next.subjectIds);
        return prev.filter((sid) => allowed.has(sid));
      });
    },
    [classLevels]
  );

  const toggleSubject = useCallback((id: string) => {
    setSubjectIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }, []);

  const submitStudentProfile = useCallback(async () => {
    if (
      !classLevelId ||
      !boardId ||
      !countryId ||
      !stateId ||
      !cityId ||
      (subjectSelectionRequired && subjectIds.length === 0)
    ) {
      setError('Please complete every field and choose at least one subject.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await profileService.completeStudentProfile({ classLevelId, boardId, countryId, stateId, cityId, subjectIds });
      updateUser({ role: 'Student' });
    } catch (err) {
      setError(err instanceof profileService.ProfileError ? err.message : 'Unable to complete your profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [classLevelId, boardId, countryId, stateId, cityId, subjectIds, subjectSelectionRequired, updateUser]);

  const submitTutorApplication = useCallback(async () => {
    if (!countryId || !stateId || !cityId || subjectIds.length === 0 || !bio.trim() || !qualifications.trim()) {
      setError('Please complete every field and choose at least one subject.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await profileService.submitTutorApplication({
        subjectIds,
        countryId,
        stateId,
        cityId,
        bio: bio.trim(),
        qualifications: qualifications.trim(),
      });
      updateUser({ role: 'PendingTutor' });
    } catch (err) {
      setError(err instanceof profileService.ProfileError ? err.message : 'Unable to submit your application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [countryId, stateId, cityId, subjectIds, bio, qualifications, updateUser]);

  return {
    role,
    chooseRole,
    countries,
    states,
    cities,
    classLevels,
    subjects,
    availableBoards,
    availableSubjects,
    subjectSelectionRequired,
    isLoadingMasterData,
    countryId,
    stateId,
    cityId,
    classLevelId,
    boardId,
    subjectIds,
    bio,
    qualifications,
    selectCountry,
    selectState,
    selectCity,
    setClassLevelId,
    setBoardId,
    toggleSubject,
    setBio,
    setQualifications,
    isSubmitting,
    error,
    submitStudentProfile,
    submitTutorApplication,
  };
};
