import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authService from '@/src/services/authService';
import {
  getCountries,
  getStates,
  getCities,
  getBoards,
  getClassLevels,
  getSubjects,
  createCountry,
  updateCountry,
  deleteCountry,
  createState,
  updateState,
  deleteState,
  createCity,
  updateCity,
  deleteCity,
  createBoard,
  updateBoard,
  deleteBoard,
  createClassLevel,
  updateClassLevel,
  deleteClassLevel,
  createSubject,
  updateSubject,
  deleteSubject,
  MasterDataError,
} from '@/src/services/masterDataService';

describe('masterDataService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authService, 'getToken').mockReturnValue('fake-jwt');
  });

  it('getCountries fetches the countries route with a bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'ctry_1', name: 'India', isoCode: 'IN', isActive: true }],
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getCountries();

    expect(result).toEqual([{ id: 'ctry_1', name: 'India', isoCode: 'IN', isActive: true }]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/master-data/countries');
    expect(options.headers.Authorization).toBe('Bearer fake-jwt');
  });

  it('getStates sends the countryId as parentId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    await getStates('ctry_1');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/master-data/states?parentId=ctry_1');
  });

  it('getCities sends the stateId as parentId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    await getCities('state_1');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/master-data/cities?parentId=state_1');
  });

  it('getBoards omits parentId when no stateId is given (returns national + every state board)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    await getBoards();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/master-data/boards');
    expect(url).not.toContain('parentId');
  });

  it('getBoards sends the stateId as parentId when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    await getBoards('state_1');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/master-data/boards?parentId=state_1');
  });

  it('getClassLevels and getSubjects hit their routes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    await getClassLevels();
    await getSubjects();

    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/master-data/class-levels');
    expect(fetchMock.mock.calls[1][0]).toContain('/api/v1/master-data/subjects');
  });

  it('throws MasterDataError with the backend detail on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: 'Not authorized.' }) })
    );

    await expect(getCountries()).rejects.toThrow(MasterDataError);
    await expect(getCountries()).rejects.toThrow('Not authorized.');
  });

  it('throws a generic MasterDataError when the network request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(getCountries()).rejects.toThrow(MasterDataError);
  });

  it('getCountries(true) requests includeInactive=true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    await getCountries(true);

    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/master-data/countries?includeInactive=true');
  });

  it('getStates(id, true) appends includeInactive alongside parentId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    await getStates('ctry_1', true);

    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/master-data/states?parentId=ctry_1&includeInactive=true');
  });

  it('getBoards(undefined, true) uses includeInactive as the only query param', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    await getBoards(undefined, true);

    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/master-data/boards?includeInactive=true');
  });

  it('getBoards(stateId, true) combines parentId and includeInactive', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    await getBoards('state_1', true);

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/api/v1/master-data/boards?parentId=state_1&includeInactive=true'
    );
  });

  describe('Master-only create/update pairs', () => {
    it('createCountry POSTs the exact backend request shape', async () => {
      const country = { id: 'ctry_1', name: 'India', isoCode: 'IN', isActive: true };
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => country });
      vi.stubGlobal('fetch', fetchMock);

      const result = await createCountry({ name: 'India', isoCode: 'IN' });

      expect(result).toEqual(country);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/master-data/countries');
      expect(options.method).toBe('POST');
      expect(options.headers.Authorization).toBe('Bearer fake-jwt');
      expect(JSON.parse(options.body)).toEqual({ name: 'India', isoCode: 'IN' });
    });

    it('updateCountry PUTs to the id route with isActive included', async () => {
      const country = { id: 'ctry_1', name: 'India', isoCode: 'IN', isActive: false };
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => country });
      vi.stubGlobal('fetch', fetchMock);

      const result = await updateCountry('ctry_1', { name: 'India', isoCode: 'IN', isActive: false });

      expect(result).toEqual(country);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/master-data/countries/ctry_1');
      expect(options.method).toBe('PUT');
      expect(JSON.parse(options.body)).toEqual({ name: 'India', isoCode: 'IN', isActive: false });
    });

    it('createState POSTs countryId/name/code', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ id: 'state_1', countryId: 'ctry_1', name: 'Delhi', code: 'DL', isActive: true }) });
      vi.stubGlobal('fetch', fetchMock);

      await createState({ countryId: 'ctry_1', name: 'Delhi', code: 'DL' });

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/master-data/states');
      expect(JSON.parse(options.body)).toEqual({ countryId: 'ctry_1', name: 'Delhi', code: 'DL' });
    });

    it('updateState PUTs to the id route', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ id: 'state_1', countryId: 'ctry_1', name: 'Delhi', code: 'DL', isActive: false }) });
      vi.stubGlobal('fetch', fetchMock);

      await updateState('state_1', { countryId: 'ctry_1', name: 'Delhi', code: 'DL', isActive: false });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/master-data/states/state_1');
    });

    it('createCity POSTs stateId/name', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ id: 'city_1', stateId: 'state_1', name: 'New Delhi', isActive: true }) });
      vi.stubGlobal('fetch', fetchMock);

      await createCity({ stateId: 'state_1', name: 'New Delhi' });

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/master-data/cities');
      expect(JSON.parse(options.body)).toEqual({ stateId: 'state_1', name: 'New Delhi' });
    });

    it('updateCity PUTs to the id route', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ id: 'city_1', stateId: 'state_1', name: 'New Delhi', isActive: false }) });
      vi.stubGlobal('fetch', fetchMock);

      await updateCity('city_1', { stateId: 'state_1', name: 'New Delhi', isActive: false });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/master-data/cities/city_1');
    });

    it('createBoard POSTs a null stateId for national boards', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ id: 'brd_1', name: 'CBSE', code: 'CBSE', stateId: null, isActive: true }) });
      vi.stubGlobal('fetch', fetchMock);

      await createBoard({ name: 'CBSE', code: 'CBSE', stateId: null });

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/master-data/boards');
      expect(JSON.parse(options.body)).toEqual({ name: 'CBSE', code: 'CBSE', stateId: null });
    });

    it('updateBoard PUTs to the id route', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ id: 'brd_1', name: 'CBSE', code: 'CBSE', stateId: null, isActive: false }) });
      vi.stubGlobal('fetch', fetchMock);

      await updateBoard('brd_1', { name: 'CBSE', code: 'CBSE', stateId: null, isActive: false });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/master-data/boards/brd_1');
    });

    it('createClassLevel POSTs name/sortOrder/subjectIds', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ id: 'cl_1', name: 'Class 10', sortOrder: 10, isActive: true, subjectIds: ['sub_phy'] }) });
      vi.stubGlobal('fetch', fetchMock);

      await createClassLevel({ name: 'Class 10', sortOrder: 10, subjectIds: ['sub_phy'] });

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/master-data/class-levels');
      expect(JSON.parse(options.body)).toEqual({ name: 'Class 10', sortOrder: 10, subjectIds: ['sub_phy'] });
    });

    it('updateClassLevel PUTs to the id route with subjectIds included', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ id: 'cl_1', name: 'Class 10', sortOrder: 10, isActive: false, subjectIds: [] }) });
      vi.stubGlobal('fetch', fetchMock);

      await updateClassLevel('cl_1', { name: 'Class 10', sortOrder: 10, isActive: false, subjectIds: [] });

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/master-data/class-levels/cl_1');
      expect(JSON.parse(options.body)).toEqual({ name: 'Class 10', sortOrder: 10, isActive: false, subjectIds: [] });
    });

    it('createSubject POSTs name/stream', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ id: 'sub_1', name: 'Physics', stream: 'Science', isActive: true }) });
      vi.stubGlobal('fetch', fetchMock);

      await createSubject({ name: 'Physics', stream: 'Science' });

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/master-data/subjects');
      expect(JSON.parse(options.body)).toEqual({ name: 'Physics', stream: 'Science' });
    });

    it('updateSubject PUTs to the id route', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ id: 'sub_1', name: 'Physics', stream: 'Science', isActive: false }) });
      vi.stubGlobal('fetch', fetchMock);

      await updateSubject('sub_1', { name: 'Physics', stream: 'Science', isActive: false });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/master-data/subjects/sub_1');
    });

    it('throws MasterDataError with the backend detail on a non-ok create response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: 'A country with this ISO code already exists.' }) })
      );

      await expect(createCountry({ name: 'India', isoCode: 'IN' })).rejects.toThrow(MasterDataError);
      await expect(createCountry({ name: 'India', isoCode: 'IN' })).rejects.toThrow(
        'A country with this ISO code already exists.'
      );
    });
  });

  describe('Master-only delete calls', () => {
    const deleters: [string, (id: string) => Promise<void>, string][] = [
      ['deleteCountry', deleteCountry, 'countries/ctry_1'],
      ['deleteState', deleteState, 'states/state_1'],
      ['deleteCity', deleteCity, 'cities/city_1'],
      ['deleteBoard', deleteBoard, 'boards/brd_1'],
      ['deleteClassLevel', deleteClassLevel, 'class-levels/cl_1'],
      ['deleteSubject', deleteSubject, 'subjects/sub_1'],
    ];

    it.each(deleters)('%s sends a DELETE to the id route with a bearer token', async (_name, fn, pathSuffix) => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);
      const id = pathSuffix.split('/')[1];

      await fn(id);

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain(`/api/v1/master-data/${pathSuffix}`);
      expect(options.method).toBe('DELETE');
      expect(options.headers.Authorization).toBe('Bearer fake-jwt');
    });

    it('deleteCountry resolves to undefined with no body parsing on success', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);

      await expect(deleteCountry('ctry_1')).resolves.toBeUndefined();
    });

    it('throws MasterDataError with the backend detail on a non-ok delete response (e.g. FK-dependent rows)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: 'Cannot delete: in use by existing records.' }) })
      );

      await expect(deleteCountry('ctry_1')).rejects.toThrow(MasterDataError);
      await expect(deleteCountry('ctry_1')).rejects.toThrow('Cannot delete: in use by existing records.');
    });

    it('throws a generic MasterDataError when the network request itself fails on delete', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

      await expect(deleteCountry('ctry_1')).rejects.toThrow(MasterDataError);
    });
  });
});
