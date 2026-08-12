import { useEffect, useState } from 'react';
import { getTags, type Tag } from '../../services/tagsService';
import {
  getBoards,
  getCities,
  getClassLevels,
  getCountries,
  getStates,
  getSubjects,
  type Board,
  type City,
  type ClassLevel,
  type Country,
  type State,
  type Subject,
} from '../../services/masterDataService';
import {
  API_BASE_URL,
  createDraftCourse,
  reorderThumbnail as reorderThumbnailRequest,
  removeThumbnail as removeThumbnailRequest,
  setPrimaryThumbnail as setPrimaryThumbnailRequest,
  updateDraftCourse,
  uploadThumbnail,
  type CourseDraftDto,
  type CourseThumbnailDto,
} from '../../services/courseDraftService';

// Course Title max length: PRD FR-6 doesn't pin an exact number ([ASSUMPTION], prd.md line 558
// recommends 120). Single named constant so it's a one-line change if the user later specifies
// a different value.
export const COURSE_TITLE_MAX_LENGTH = 120;

// Sentinel values for the Taxonomy step's State/City selects -- distinct from '' (nothing
// chosen yet, keeps the child select disabled) so a tutor can explicitly satisfy the cascade
// gate for a national board (e.g. CBSE) without picking a specific State/City, which don't
// apply to it. See StepTaxonomy.tsx and isTaxonomyStepValid below.
export const NATIONAL_STATE_VALUE = 'NATIONAL';
export const NOT_APPLICABLE_CITY_VALUE = 'NOT_APPLICABLE';

export const MAX_THUMBNAILS = 3;

export type TaxonomyField = 'countryId' | 'stateId' | 'cityId' | 'boardId' | 'classLevelId' | 'subjectId';

export interface ThumbnailCrop {
  x: number;
  y: number;
  zoom: number;
}

const DEFAULT_CROP: ThumbnailCrop = { x: 50, y: 50, zoom: 100 };

export interface CourseDraftThumbnail {
  id: string;
  url: string;
  isPrimary: boolean;
  // Explicit order, not just array position -- server-authoritative as of Story 2.4 (every
  // mutator replaces this array wholesale from the backend's response; see toThumbnails below).
  order: number;
  crop: ThumbnailCrop;
}

// Field names anticipate Story 2.4's real Draft/Course entity so its live-wire doesn't need to
// rename anything this story's step components already reference.
export interface CourseDraft {
  title: string;
  description: string;
  tagIds: string[];
  countryId: string;
  stateId: string;
  cityId: string;
  boardId: string;
  classLevelId: string;
  subjectId: string;
  thumbnails: CourseDraftThumbnail[];
}

// Factory, not a shared constant -- resetDraft() below needs a fresh object/arrays each time it
// resets, not a reused reference.
const createInitialDraft = (): CourseDraft => ({
  title: '',
  description: '',
  tagIds: ['tag_legacy_curriculum'],
  countryId: '',
  stateId: '',
  cityId: '',
  boardId: '',
  classLevelId: '',
  subjectId: '',
  thumbnails: [],
});

// Step 1 validity: trimmed, non-empty title within the max length. Exported as a pure function
// (not baked into the hook) so both CourseWizard.tsx's Next-gating and tests can call it without
// rendering.
export const isTitleStepValid = (draft: CourseDraft): boolean => {
  const trimmed = draft.title.trim();
  return trimmed.length > 0 && trimmed.length <= COURSE_TITLE_MAX_LENGTH;
};

// Step 3 validity: Country/Board/Class Level/Subject are always required (FR-8). State/City are
// only required when the selected Board is state-scoped (non-null stateId) -- enforced here at
// the Next-button gate only, never by disabling the Board select itself (see Dev Notes on the
// Taxonomy cascade in the story file).
export const isTaxonomyStepValid = (draft: CourseDraft, boards: Board[]): boolean => {
  if (!draft.countryId || !draft.boardId || !draft.classLevelId || !draft.subjectId) return false;

  const board = boards.find((b) => b.id === draft.boardId);
  if (board?.stateId) {
    const hasRealState = Boolean(draft.stateId) && draft.stateId !== NATIONAL_STATE_VALUE;
    const hasRealCity = Boolean(draft.cityId) && draft.cityId !== NOT_APPLICABLE_CITY_VALUE;
    return hasRealState && hasRealCity;
  }
  return true;
};

interface UseCourseDraftResult {
  data: CourseDraft;
  isLoading: boolean;
  error: string | null;
  // The real, server-issued Course id once Step 1's Next has run commitStep() at least once;
  // null before that. This IS the wizard's draftId (CourseWizard.tsx's onComplete argument).
  draftId: string | null;
  tags: Tag[];
  lockedTags: Tag[];
  countries: Country[];
  states: State[];
  cities: City[];
  boards: Board[];
  classLevels: ClassLevel[];
  subjects: Subject[];
  updateTitle: (title: string) => void;
  updateDescription: (description: string) => void;
  toggleTag: (tagId: string) => void;
  updateTaxonomy: (field: TaxonomyField, value: string) => void;
  // Persists Title/Description as a real Draft -- creates on first call, updates thereafter.
  // Idempotent (a harmless re-PUT of unchanged data on steps that don't touch title/description)
  // -- called by CourseWizard.tsx on every Next/Back/Finish (AC#1: "auto-persists after every
  // step"). Returns { ok: false } (not a throw) on failure so the caller can decide what to do.
  commitStep: () => Promise<{ ok: boolean }>;
  addThumbnail: (file: File, crop?: ThumbnailCrop) => Promise<{ accepted: boolean; reason?: string }>;
  removeThumbnail: (id: string) => Promise<void>;
  reorderThumbnail: (id: string, direction: 'left' | 'right') => Promise<void>;
  setPrimaryThumbnail: (id: string) => Promise<void>;
  // Clears the draft back to a fresh, empty local state -- called on wizard close/finish so a
  // second "New Course Wizard" session doesn't start pre-filled with the previous course's
  // data. Deliberately does NOT delete the persisted Draft row server-side -- see Dev Notes.
  resetDraft: () => void;
}

// Maps a server-relative thumbnail URL to an absolute one the <img> tag can actually load (the
// API is a different origin than the frontend dev server) -- keeps StepThumbnails.tsx's
// rendering code (`<img src={thumb.url}>`) unchanged.
const toCourseDraftThumbnail = (dto: CourseThumbnailDto): CourseDraftThumbnail => ({
  id: dto.id,
  url: `${API_BASE_URL}${dto.url}`,
  isPrimary: dto.isPrimary,
  order: dto.order,
  crop: { x: dto.crop.x, y: dto.crop.y, zoom: dto.crop.zoom },
});

const toThumbnails = (dtos: CourseThumbnailDto[]): CourseDraftThumbnail[] =>
  [...dtos].sort((a, b) => a.order - b.order).map(toCourseDraftThumbnail);

// Feature-local hook (AD-2). Story 2.4 live-wires Title/Description/Thumbnails; Story 2.5
// live-wires Tags/Taxonomy -- against real courseDraftService.ts/tagsService.ts/
// masterDataService.ts calls. The { data, isLoading, error } + mutator shape (AD-1) stays
// fixed, per this hook's own precedent comment from Story 2.1.
export const useCourseDraft = (): UseCourseDraftResult => {
  const [data, setData] = useState<CourseDraft>(createInitialDraft);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [classLevels, setClassLevels] = useState<ClassLevel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // One-time fetches on mount -- boards fetched with no stateId (national + every state's board
  // together), matching what StepTaxonomy.tsx's own client-side filter already expects.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([getTags(), getCountries(), getBoards(), getClassLevels(), getSubjects()])
      .then(([t, c, b, cl, s]) => {
        if (cancelled) return;
        setAllTags(t);
        setCountries(c);
        setBoards(b);
        setClassLevels(cl);
        setSubjects(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load tags/taxonomy data. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cascading fetches, keyed on the current selection -- a generic useEffect (not a per-field
  // callback like useProfileSetup.ts's selectCountry/selectState) since updateTaxonomy below is
  // one generic switch-based setter, not per-field setters.
  //
  // Code-review patch: both effects now toggle isLoading around the fetch, matching the
  // mount-fetch effect above (this hook's own Task 8 documentation already claimed this was
  // true for every fetch; it wasn't, for these two -- now it is).
  //
  // Deliberately does NOT clear `error` on a successful fetch here (an earlier version of this
  // patch did, and a test caught the resulting bug immediately): `error` is a single, hook-wide
  // field shared by every async operation (commitStep, addThumbnail, this fetch, etc.). A
  // background mount/cascade fetch resolving successfully right after an unrelated commitStep()
  // failure would silently wipe out that real, still-relevant error -- worse than the stale-
  // banner problem it was meant to fix. Only the operation that set an error is positioned to
  // know it's safe to clear it (commitStep/addThumbnail/etc. already do this at the start of
  // their own next call).
  useEffect(() => {
    if (!data.countryId) {
      setStates([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    getStates(data.countryId)
      .then((s) => {
        if (!cancelled) setStates(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load states. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data.countryId]);

  useEffect(() => {
    // Code-review patch: NATIONAL_STATE_VALUE is a UI-only sentinel (see commitStep's identical
    // guard below) -- without this check, picking "National / Not Applicable" for State fired a
    // real getCities('NATIONAL') call against the backend on every render of this effect.
    if (!data.stateId || data.stateId === NATIONAL_STATE_VALUE) {
      setCities([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    getCities(data.stateId)
      .then((c) => {
        if (!cancelled) setCities(c);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load cities. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data.stateId]);

  const activeTags = allTags.filter((t) => t.isActive);
  const lockedTags = allTags.filter((t) => !t.isActive && data.tagIds.includes(t.id));

  const updateTitle = (title: string) => setData((prev) => ({ ...prev, title }));
  const updateDescription = (description: string) => setData((prev) => ({ ...prev, description }));

  const toggleTag = (tagId: string) => {
    setData((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId) ? prev.tagIds.filter((id) => id !== tagId) : [...prev.tagIds, tagId],
    }));
  };

  // Changing a parent resets its now-stale descendants (mirrors MasterDataManager.tsx's
  // cascade-and-reset pattern).
  const updateTaxonomy = (field: TaxonomyField, value: string) => {
    setData((prev) => {
      switch (field) {
        case 'countryId':
          return { ...prev, countryId: value, stateId: '', cityId: '', boardId: '', classLevelId: '', subjectId: '' };
        case 'stateId':
          return { ...prev, stateId: value, cityId: '', boardId: '', classLevelId: '', subjectId: '' };
        case 'cityId':
          return { ...prev, cityId: value, boardId: '', classLevelId: '', subjectId: '' };
        case 'boardId':
          return { ...prev, boardId: value, classLevelId: '', subjectId: '' };
        case 'classLevelId':
          return { ...prev, classLevelId: value, subjectId: '' };
        case 'subjectId':
          return { ...prev, subjectId: value };
        default:
          return prev;
      }
    });
  };

  const commitStep = async (): Promise<{ ok: boolean }> => {
    setIsLoading(true);
    setError(null);
    try {
      // createDraftCourse (Step 1's first Next) stays title/description-only -- Tags/Taxonomy
      // haven't been reached yet on that very first call. Every subsequent commitStep() call is
      // an updateDraftCourse sending the full current selection (possibly still empty/default on
      // early calls -- harmless, matches the existing idempotent-resend pattern).
      // State/City are NOT real ids when a national board's sentinel ("National / Not
      // Applicable") is chosen -- NATIONAL_STATE_VALUE/NOT_APPLICABLE_CITY_VALUE are UI-only
      // placeholders (see StepTaxonomy.tsx) that must never be persisted as if they were a real
      // State/City reference.
      const realStateId = data.stateId && data.stateId !== NATIONAL_STATE_VALUE ? data.stateId : null;
      const realCityId = data.cityId && data.cityId !== NOT_APPLICABLE_CITY_VALUE ? data.cityId : null;
      const dto: CourseDraftDto = draftId
        ? await updateDraftCourse(draftId, {
            title: data.title,
            description: data.description,
            tagIds: data.tagIds,
            countryId: data.countryId || null,
            stateId: realStateId,
            cityId: realCityId,
            boardId: data.boardId || null,
            classLevelId: data.classLevelId || null,
            subjectId: data.subjectId || null,
          })
        : await createDraftCourse(data.title, data.description);
      setDraftId(dto.id);
      return { ok: true };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your progress. Please try again.');
      return { ok: false };
    } finally {
      setIsLoading(false);
    }
  };

  const addThumbnail = async (file: File, crop: ThumbnailCrop = DEFAULT_CROP): Promise<{ accepted: boolean; reason?: string }> => {
    if (data.thumbnails.length >= MAX_THUMBNAILS) {
      return { accepted: false, reason: `Maximum ${MAX_THUMBNAILS} thumbnails allowed. Remove one before adding another.` };
    }
    if (!draftId) {
      return { accepted: false, reason: 'Your course draft has not been saved yet. Please try again.' };
    }

    setIsLoading(true);
    setError(null);
    try {
      const dto = await uploadThumbnail(draftId, file, crop);
      setData((prev) => ({ ...prev, thumbnails: toThumbnails(dto.thumbnails) }));
      return { accepted: true };
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Could not upload this thumbnail. Please try again.';
      setError(reason);
      return { accepted: false, reason };
    } finally {
      setIsLoading(false);
    }
  };

  const removeThumbnail = async (id: string): Promise<void> => {
    if (!draftId) return;
    setIsLoading(true);
    setError(null);
    try {
      const dto = await removeThumbnailRequest(draftId, id);
      setData((prev) => ({ ...prev, thumbnails: toThumbnails(dto.thumbnails) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove this thumbnail. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const reorderThumbnail = async (id: string, direction: 'left' | 'right'): Promise<void> => {
    if (!draftId) return;
    setIsLoading(true);
    setError(null);
    try {
      const dto = await reorderThumbnailRequest(draftId, id, direction);
      setData((prev) => ({ ...prev, thumbnails: toThumbnails(dto.thumbnails) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reorder this thumbnail. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const setPrimaryThumbnail = async (id: string): Promise<void> => {
    if (!draftId) return;
    setIsLoading(true);
    setError(null);
    try {
      const dto = await setPrimaryThumbnailRequest(draftId, id);
      setData((prev) => ({ ...prev, thumbnails: toThumbnails(dto.thumbnails) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the primary thumbnail. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Deliberately does not call any delete/discard endpoint -- closing the wizard mid-draft
  // leaves a real, harmless, Draft-state orphaned Course row behind (invisible to the public
  // catalog, AC#5). Resuming/discarding an abandoned Draft is FR-22/Story 3.9 territory.
  const resetDraft = () => {
    setData(createInitialDraft());
    setDraftId(null);
    setError(null);
  };

  return {
    data,
    isLoading,
    error,
    draftId,
    tags: activeTags,
    lockedTags,
    countries,
    states,
    cities,
    boards,
    classLevels,
    subjects,
    updateTitle,
    updateDescription,
    toggleTag,
    updateTaxonomy,
    commitStep,
    addThumbnail,
    removeThumbnail,
    reorderThumbnail,
    setPrimaryThumbnail,
    resetDraft,
  };
};
