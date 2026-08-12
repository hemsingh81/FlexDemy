import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useCourseDraft,
  isTitleStepValid,
  isTaxonomyStepValid,
  COURSE_TITLE_MAX_LENGTH,
  NATIONAL_STATE_VALUE,
  NOT_APPLICABLE_CITY_VALUE,
  MAX_THUMBNAILS,
  type CourseDraft,
} from '@/src/features/CourseWizard/useCourseDraft';
import * as courseDraftService from '@/src/services/courseDraftService';
import type { CourseDraftDto, CourseThumbnailDto } from '@/src/services/courseDraftService';
import * as tagsService from '@/src/services/tagsService';
import * as masterDataService from '@/src/services/masterDataService';

vi.mock('@/src/services/courseDraftService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/courseDraftService')>('@/src/services/courseDraftService');
  return {
    ...actual,
    createDraftCourse: vi.fn(),
    updateDraftCourse: vi.fn(),
    uploadThumbnail: vi.fn(),
    removeThumbnail: vi.fn(),
    reorderThumbnail: vi.fn(),
    setPrimaryThumbnail: vi.fn(),
  };
});

vi.mock('@/src/services/tagsService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/tagsService')>('@/src/services/tagsService');
  return { ...actual, getTags: vi.fn() };
});

vi.mock('@/src/services/masterDataService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/masterDataService')>('@/src/services/masterDataService');
  return { ...actual, getCountries: vi.fn(), getStates: vi.fn(), getCities: vi.fn(), getBoards: vi.fn(), getClassLevels: vi.fn(), getSubjects: vi.fn() };
});

const makeThumbnailDto = (overrides: Partial<CourseThumbnailDto> = {}): CourseThumbnailDto => ({
  id: 'thumb_1',
  url: '/uploads/course-thumbnails/thumb_1.jpg',
  isPrimary: true,
  order: 0,
  crop: { x: 50, y: 50, zoom: 100 },
  ...overrides,
});

const makeDraftDto = (overrides: Partial<CourseDraftDto> = {}): CourseDraftDto => ({
  id: 'draft_1',
  title: 'A Course',
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

const makeFile = (name: string): File => new File(['fake-bytes'], name, { type: 'image/jpeg' });

const TAGS_FIXTURE = [
  { id: 'tag_physics', name: 'Physics', isActive: true },
  { id: 'tag_legacy_curriculum', name: 'Legacy Curriculum (2019)', isActive: false },
];
const COUNTRIES_FIXTURE = [{ id: 'country_in', name: 'India', isoCode: 'IN', isActive: true }];
const BOARDS_FIXTURE = [
  { id: 'board_cbse', name: 'CBSE', code: 'CBSE', stateId: null, isActive: true },
  { id: 'board_mh_state', name: 'Maharashtra State Board', code: 'MH-SSC', stateId: 'state_mh', isActive: true },
];
const CLASS_LEVELS_FIXTURE = [{ id: 'class_10', name: 'Class 10', sortOrder: 1, isActive: true, subjectIds: ['subject_physics'] }];
const SUBJECTS_FIXTURE = [{ id: 'subject_physics', name: 'Physics', stream: 'Science', isActive: true }];
const STATES_FIXTURE = [{ id: 'state_mh', countryId: 'country_in', name: 'Maharashtra', code: 'MH', isActive: true }];
const CITIES_FIXTURE = [{ id: 'city_mumbai', stateId: 'state_mh', name: 'Mumbai', isActive: true }];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(tagsService.getTags).mockResolvedValue(TAGS_FIXTURE);
  vi.mocked(masterDataService.getCountries).mockResolvedValue(COUNTRIES_FIXTURE);
  vi.mocked(masterDataService.getBoards).mockResolvedValue(BOARDS_FIXTURE);
  vi.mocked(masterDataService.getClassLevels).mockResolvedValue(CLASS_LEVELS_FIXTURE);
  vi.mocked(masterDataService.getSubjects).mockResolvedValue(SUBJECTS_FIXTURE);
  vi.mocked(masterDataService.getStates).mockResolvedValue(STATES_FIXTURE);
  vi.mocked(masterDataService.getCities).mockResolvedValue(CITIES_FIXTURE);
});

describe('useCourseDraft', () => {
  it('starts with the pre-attached inactive tag and empty taxonomy/thumbnails, then loads real tags/boards', async () => {
    const { result } = renderHook(() => useCourseDraft());

    expect(result.current.data.tagIds).toEqual(['tag_legacy_curriculum']);
    expect(result.current.data.thumbnails).toEqual([]);
    expect(result.current.data.countryId).toBe('');
    expect(result.current.draftId).toBeNull();

    await waitFor(() => expect(result.current.tags.length).toBeGreaterThan(0));

    // Locked (inactive but attached) tag is surfaced separately from the selectable list.
    expect(result.current.lockedTags.map((t) => t.id)).toEqual(['tag_legacy_curriculum']);
    expect(result.current.tags.every((t) => t.isActive)).toBe(true);
    expect(result.current.tags.some((t) => t.id === 'tag_legacy_curriculum')).toBe(false);
  });

  it('fetches tags/countries/boards/classLevels/subjects once on mount', async () => {
    renderHook(() => useCourseDraft());

    await waitFor(() => {
      expect(tagsService.getTags).toHaveBeenCalledTimes(1);
      expect(masterDataService.getCountries).toHaveBeenCalledTimes(1);
      expect(masterDataService.getBoards).toHaveBeenCalledWith();
      expect(masterDataService.getClassLevels).toHaveBeenCalledTimes(1);
      expect(masterDataService.getSubjects).toHaveBeenCalledTimes(1);
    });
    expect(masterDataService.getStates).not.toHaveBeenCalled();
    expect(masterDataService.getCities).not.toHaveBeenCalled();
  });

  it('includes both a national board (stateId null) and a state-scoped board once loaded', async () => {
    const { result } = renderHook(() => useCourseDraft());

    await waitFor(() => expect(result.current.boards.length).toBeGreaterThan(0));
    const national = result.current.boards.find((b) => b.stateId === null);
    const stateScoped = result.current.boards.find((b) => b.stateId !== null);

    expect(national).toBeTruthy();
    expect(stateScoped).toBeTruthy();
  });

  it('fetches states when countryId is set, and clears them when it is unset', async () => {
    const { result } = renderHook(() => useCourseDraft());

    act(() => result.current.updateTaxonomy('countryId', 'country_in'));
    await waitFor(() => expect(result.current.states).toEqual(STATES_FIXTURE));
    expect(masterDataService.getStates).toHaveBeenCalledWith('country_in');

    act(() => result.current.updateTaxonomy('countryId', ''));
    await waitFor(() => expect(result.current.states).toEqual([]));
  });

  it('fetches cities when stateId is set, and clears them when it is unset', async () => {
    const { result } = renderHook(() => useCourseDraft());

    act(() => result.current.updateTaxonomy('countryId', 'country_in'));
    act(() => result.current.updateTaxonomy('stateId', 'state_mh'));
    await waitFor(() => expect(result.current.cities).toEqual(CITIES_FIXTURE));
    expect(masterDataService.getCities).toHaveBeenCalledWith('state_mh');

    act(() => result.current.updateTaxonomy('stateId', ''));
    await waitFor(() => expect(result.current.cities).toEqual([]));
  });

  it('updateTitle only touches title, leaving other fields untouched', () => {
    const { result } = renderHook(() => useCourseDraft());

    act(() => result.current.updateDescription('Some description'));
    act(() => result.current.updateTitle('Intro to Physics'));

    expect(result.current.data.title).toBe('Intro to Physics');
    expect(result.current.data.description).toBe('Some description');
  });

  it('toggleTag adds then removes a tag without touching the pre-attached locked tag', () => {
    const { result } = renderHook(() => useCourseDraft());

    act(() => result.current.toggleTag('tag_physics'));
    expect(result.current.data.tagIds).toContain('tag_physics');
    expect(result.current.data.tagIds).toContain('tag_legacy_curriculum');

    act(() => result.current.toggleTag('tag_physics'));
    expect(result.current.data.tagIds).not.toContain('tag_physics');
    expect(result.current.data.tagIds).toContain('tag_legacy_curriculum');
  });

  it('updateTaxonomy resets stale descendants when a parent changes', () => {
    const { result } = renderHook(() => useCourseDraft());

    act(() => result.current.updateTaxonomy('countryId', 'country_in'));
    act(() => result.current.updateTaxonomy('stateId', 'state_mh'));
    act(() => result.current.updateTaxonomy('cityId', 'city_mumbai'));
    act(() => result.current.updateTaxonomy('boardId', 'board_mh_state'));
    act(() => result.current.updateTaxonomy('classLevelId', 'class_10'));
    act(() => result.current.updateTaxonomy('subjectId', 'subject_physics'));

    expect(result.current.data.subjectId).toBe('subject_physics');

    // Changing State (a mid-cascade parent) resets city/board/classLevel/subject, but not country.
    act(() => result.current.updateTaxonomy('stateId', 'state_ka'));
    expect(result.current.data).toMatchObject({
      countryId: 'country_in',
      stateId: 'state_ka',
      cityId: '',
      boardId: '',
      classLevelId: '',
      subjectId: '',
    });
  });

  describe('commitStep', () => {
    it('creates a draft on the first call and updates it (with tagIds/taxonomy) on subsequent calls', async () => {
      vi.mocked(courseDraftService.createDraftCourse).mockResolvedValue(makeDraftDto({ id: 'draft_new' }));
      vi.mocked(courseDraftService.updateDraftCourse).mockResolvedValue(makeDraftDto({ id: 'draft_new' }));
      const { result } = renderHook(() => useCourseDraft());
      act(() => result.current.updateTitle('My Course'));

      await act(async () => {
        await result.current.commitStep();
      });

      expect(courseDraftService.createDraftCourse).toHaveBeenCalledWith('My Course', '');
      expect(result.current.draftId).toBe('draft_new');

      act(() => result.current.toggleTag('tag_physics'));
      act(() => result.current.updateTaxonomy('countryId', 'country_in'));
      await act(async () => {
        await result.current.commitStep();
      });

      expect(courseDraftService.updateDraftCourse).toHaveBeenCalledWith('draft_new', {
        title: 'My Course',
        description: '',
        tagIds: ['tag_legacy_curriculum', 'tag_physics'],
        countryId: 'country_in',
        stateId: null,
        cityId: null,
        boardId: null,
        classLevelId: null,
        subjectId: null,
      });
      expect(courseDraftService.createDraftCourse).toHaveBeenCalledTimes(1);
    });

    it('sends null (not the sentinel string) for stateId/cityId when a national board sentinel is selected', async () => {
      vi.mocked(courseDraftService.createDraftCourse).mockResolvedValue(makeDraftDto({ id: 'draft_new' }));
      vi.mocked(courseDraftService.updateDraftCourse).mockResolvedValue(makeDraftDto({ id: 'draft_new' }));
      const { result } = renderHook(() => useCourseDraft());
      act(() => result.current.updateTitle('My Course'));
      await act(async () => {
        await result.current.commitStep();
      });

      act(() => result.current.updateTaxonomy('countryId', 'country_in'));
      act(() => result.current.updateTaxonomy('stateId', NATIONAL_STATE_VALUE));
      act(() => result.current.updateTaxonomy('cityId', NOT_APPLICABLE_CITY_VALUE));
      await act(async () => {
        await result.current.commitStep();
      });

      const call = vi.mocked(courseDraftService.updateDraftCourse).mock.calls[0][1];
      expect(call.stateId).toBeNull();
      expect(call.cityId).toBeNull();
    });

    it('returns ok:false and sets error on failure, without setting draftId', async () => {
      vi.mocked(courseDraftService.createDraftCourse).mockRejectedValue(new Error('Server exploded'));
      const { result } = renderHook(() => useCourseDraft());

      let outcome: { ok: boolean } | undefined;
      await act(async () => {
        outcome = await result.current.commitStep();
      });

      expect(outcome?.ok).toBe(false);
      expect(result.current.error).toBe('Server exploded');
      expect(result.current.draftId).toBeNull();
    });
  });

  describe('thumbnail mutators (require an established draftId)', () => {
    const establishDraft = async (result: { current: ReturnType<typeof useCourseDraft> }) => {
      vi.mocked(courseDraftService.createDraftCourse).mockResolvedValue(makeDraftDto({ id: 'draft_1' }));
      await act(async () => {
        await result.current.commitStep();
      });
    };

    it('addThumbnail uploads and populates thumbnails from the response', async () => {
      const { result } = renderHook(() => useCourseDraft());
      await establishDraft(result);
      const dto = makeDraftDto({ thumbnails: [makeThumbnailDto()] });
      vi.mocked(courseDraftService.uploadThumbnail).mockResolvedValue(dto);

      let outcome: { accepted: boolean; reason?: string } | undefined;
      await act(async () => {
        outcome = await result.current.addThumbnail(makeFile('a.jpg'));
      });

      expect(outcome?.accepted).toBe(true);
      expect(courseDraftService.uploadThumbnail).toHaveBeenCalledWith('draft_1', expect.any(File), expect.objectContaining({ x: 50 }));
      expect(result.current.data.thumbnails).toHaveLength(1);
      expect(result.current.data.thumbnails[0].url).toContain('/uploads/course-thumbnails/thumb_1.jpg');
    });

    it('addThumbnail rejects locally at the cap without calling the service', async () => {
      const { result } = renderHook(() => useCourseDraft());
      await establishDraft(result);
      vi.mocked(courseDraftService.uploadThumbnail).mockImplementation(async (_id, _file, crop) =>
        makeDraftDto({
          thumbnails: [makeThumbnailDto({ id: `t_${crop.x}`, order: 0 })],
        })
      );

      // Fill up to the cap via 3 successful uploads, each returning one more thumbnail.
      for (let i = 0; i < MAX_THUMBNAILS; i++) {
        const thumbnails = Array.from({ length: i + 1 }, (_, idx) => makeThumbnailDto({ id: `t${idx}`, order: idx, isPrimary: idx === 0 }));
        vi.mocked(courseDraftService.uploadThumbnail).mockResolvedValueOnce(makeDraftDto({ thumbnails }));
        // eslint-disable-next-line no-await-in-loop -- sequential by design, each depends on the previous state
        await act(async () => {
          await result.current.addThumbnail(makeFile(`f${i}.jpg`));
        });
      }
      expect(result.current.data.thumbnails).toHaveLength(MAX_THUMBNAILS);

      let rejected: { accepted: boolean; reason?: string } | undefined;
      await act(async () => {
        rejected = await result.current.addThumbnail(makeFile('overflow.jpg'));
      });

      expect(rejected?.accepted).toBe(false);
      expect(rejected?.reason).toMatch(/maximum/i);
      expect(courseDraftService.uploadThumbnail).toHaveBeenCalledTimes(MAX_THUMBNAILS);
    });

    it('addThumbnail surfaces a service failure as a rejection reason', async () => {
      const { result } = renderHook(() => useCourseDraft());
      await establishDraft(result);
      vi.mocked(courseDraftService.uploadThumbnail).mockRejectedValue(new Error('Unsupported content type'));

      let outcome: { accepted: boolean; reason?: string } | undefined;
      await act(async () => {
        outcome = await result.current.addThumbnail(makeFile('bad.pdf'));
      });

      expect(outcome?.accepted).toBe(false);
      expect(outcome?.reason).toBe('Unsupported content type');
      expect(result.current.error).toBe('Unsupported content type');
    });

    it('removeThumbnail replaces thumbnails from the response', async () => {
      const { result } = renderHook(() => useCourseDraft());
      await establishDraft(result);
      vi.mocked(courseDraftService.removeThumbnail).mockResolvedValue(makeDraftDto({ thumbnails: [] }));

      await act(async () => {
        await result.current.removeThumbnail('thumb_1');
      });

      expect(courseDraftService.removeThumbnail).toHaveBeenCalledWith('draft_1', 'thumb_1');
      expect(result.current.data.thumbnails).toEqual([]);
    });

    it('reorderThumbnail replaces thumbnails from the response', async () => {
      const { result } = renderHook(() => useCourseDraft());
      await establishDraft(result);
      const reordered = [makeThumbnailDto({ id: 't1', order: 0 }), makeThumbnailDto({ id: 't0', order: 1, isPrimary: false })];
      vi.mocked(courseDraftService.reorderThumbnail).mockResolvedValue(makeDraftDto({ thumbnails: reordered }));

      await act(async () => {
        await result.current.reorderThumbnail('t0', 'right');
      });

      expect(courseDraftService.reorderThumbnail).toHaveBeenCalledWith('draft_1', 't0', 'right');
      expect(result.current.data.thumbnails.map((t) => t.id)).toEqual(['t1', 't0']);
    });

    it('setPrimaryThumbnail replaces thumbnails from the response', async () => {
      const { result } = renderHook(() => useCourseDraft());
      await establishDraft(result);
      const updated = [makeThumbnailDto({ id: 't0', isPrimary: false }), makeThumbnailDto({ id: 't1', order: 1, isPrimary: true })];
      vi.mocked(courseDraftService.setPrimaryThumbnail).mockResolvedValue(makeDraftDto({ thumbnails: updated }));

      await act(async () => {
        await result.current.setPrimaryThumbnail('t1');
      });

      expect(courseDraftService.setPrimaryThumbnail).toHaveBeenCalledWith('draft_1', 't1');
      expect(result.current.data.thumbnails.find((t) => t.id === 't1')?.isPrimary).toBe(true);
    });
  });

  it('resetDraft clears local state back to the initial shape without calling any delete endpoint', async () => {
    vi.mocked(courseDraftService.createDraftCourse).mockResolvedValue(makeDraftDto({ id: 'draft_1' }));
    const { result } = renderHook(() => useCourseDraft());

    act(() => result.current.updateTitle('Some Course'));
    act(() => result.current.toggleTag('tag_physics'));
    act(() => result.current.updateTaxonomy('countryId', 'country_in'));
    await act(async () => {
      await result.current.commitStep();
    });

    act(() => result.current.resetDraft());

    expect(result.current.data.title).toBe('');
    expect(result.current.data.countryId).toBe('');
    expect(result.current.data.thumbnails).toEqual([]);
    expect(result.current.draftId).toBeNull();
    // Same fresh-draft shape as a brand-new hook instance, including the pre-attached locked tag.
    expect(result.current.data.tagIds).toEqual(['tag_legacy_curriculum']);
  });
});

describe('isTitleStepValid', () => {
  const base: CourseDraft = {
    title: '',
    description: '',
    tagIds: [],
    countryId: '',
    stateId: '',
    cityId: '',
    boardId: '',
    classLevelId: '',
    subjectId: '',
    thumbnails: [],
  };

  it('rejects empty/whitespace-only titles', () => {
    expect(isTitleStepValid({ ...base, title: '' })).toBe(false);
    expect(isTitleStepValid({ ...base, title: '   ' })).toBe(false);
  });

  it('accepts a trimmed non-empty title within the max length', () => {
    expect(isTitleStepValid({ ...base, title: 'Intro to Physics' })).toBe(true);
  });

  it('rejects a title over the max length', () => {
    expect(isTitleStepValid({ ...base, title: 'a'.repeat(COURSE_TITLE_MAX_LENGTH + 1) })).toBe(false);
    expect(isTitleStepValid({ ...base, title: 'a'.repeat(COURSE_TITLE_MAX_LENGTH) })).toBe(true);
  });
});

describe('isTaxonomyStepValid', () => {
  const base: CourseDraft = {
    title: '',
    description: '',
    tagIds: [],
    countryId: 'country_in',
    stateId: '',
    cityId: '',
    boardId: '',
    classLevelId: 'class_10',
    subjectId: 'subject_physics',
    thumbnails: [],
  };
  const boards = [
    { id: 'board_national', name: 'CBSE', code: 'CBSE', stateId: null, isActive: true },
    { id: 'board_state', name: 'MH State Board', code: 'MH', stateId: 'state_mh', isActive: true },
  ];

  it('is invalid while Country/Board/Class/Subject are unset', () => {
    expect(isTaxonomyStepValid({ ...base, boardId: '' }, boards)).toBe(false);
  });

  it('a national board (stateId null) does not require a real State/City', () => {
    expect(isTaxonomyStepValid({ ...base, boardId: 'board_national', stateId: NATIONAL_STATE_VALUE, cityId: NOT_APPLICABLE_CITY_VALUE }, boards)).toBe(
      true
    );
    expect(isTaxonomyStepValid({ ...base, boardId: 'board_national' }, boards)).toBe(true);
  });

  it('a state-scoped board requires a real (non-sentinel) State and City', () => {
    expect(
      isTaxonomyStepValid({ ...base, boardId: 'board_state', stateId: NATIONAL_STATE_VALUE, cityId: NOT_APPLICABLE_CITY_VALUE }, boards)
    ).toBe(false);
    expect(isTaxonomyStepValid({ ...base, boardId: 'board_state', stateId: 'state_mh', cityId: 'city_mumbai' }, boards)).toBe(true);
  });
});
