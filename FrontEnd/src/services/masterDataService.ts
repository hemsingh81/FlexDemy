// Master-data reference lookups (India-only location + academic hierarchy) consumed by the
// profile-completion funnel. Same real-backend `fetch` pattern as services/authService.ts --
// see that file's header comment for the base-URL rationale. Every route is `[Authorize]`
// (any authenticated role), so every call here sends the bearer token from authService.
import { getToken } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';

export interface Country {
  id: string;
  name: string;
  isoCode: string;
  isActive: boolean;
}

export interface State {
  id: string;
  countryId: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface City {
  id: string;
  stateId: string;
  name: string;
  isActive: boolean;
}

// StateId is null for national boards (CBSE, ICSE, IB, ...) -- set only for "<State> State
// Board" rows (BackEnd BoardDto).
export interface Board {
  id: string;
  name: string;
  code: string;
  stateId: string | null;
  isActive: boolean;
}

export interface ClassLevel {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  subjectIds: string[];
}

export interface Subject {
  id: string;
  name: string;
  stream: string | null;
  isActive: boolean;
}

export class MasterDataError extends Error {}

const get = async <T>(path: string): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  } catch (e) {
    throw new MasterDataError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new MasterDataError(problem?.detail || 'Something went wrong. Please try again.');
  }

  return response.json();
};

// write() backs the Master-only create/update pairs below (gated server-side by the
// masterdata.manage policy -- FeatureKeys.MasterDataManage). Same fetch/error-shape
// convention as get() above and services/profileService.ts's `request` helper.
const write = async <T>(path: string, method: 'POST' | 'PUT', body: unknown): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new MasterDataError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new MasterDataError(problem?.detail || 'Something went wrong. Please try again.');
  }

  return response.json();
};

// del() backs the Master-only delete calls below (same masterdata.manage policy gate as
// write() above). Returns void -- every route responds 204 NoContent (BackEnd
// {Entity}Controller.Delete{Entity}), so there is no body to parse.
const del = async (path: string): Promise<void> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  } catch (e) {
    throw new MasterDataError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new MasterDataError(problem?.detail || 'Something went wrong. Please try again.');
  }
};

// includeInactive is honored by the backend only for Master/Support callers (everyone else
// always gets the active-only list regardless of what's sent) -- see e.g.
// BackEnd CountriesController.GetCountries. Defaults to false so every existing call site
// (profile-completion screens) is unaffected; the Admin master-data screens pass true so
// Master/Support can see -- and reactivate -- deactivated rows.
export const getCountries = (includeInactive = false): Promise<Country[]> =>
  get(`/api/v1/master-data/countries${includeInactive ? '?includeInactive=true' : ''}`);

// parentId = countryId.
export const getStates = (countryId: string, includeInactive = false): Promise<State[]> =>
  get(
    `/api/v1/master-data/states?parentId=${encodeURIComponent(countryId)}${includeInactive ? '&includeInactive=true' : ''}`
  );

// parentId = stateId.
export const getCities = (stateId: string, includeInactive = false): Promise<City[]> =>
  get(
    `/api/v1/master-data/cities?parentId=${encodeURIComponent(stateId)}${includeInactive ? '&includeInactive=true' : ''}`
  );

// parentId = stateId, and it's optional: BoardsController/BoardRepository only filter by
// state when a parentId is supplied, so omitting it returns every board (national + every
// state's board) in one call -- callers that want "all boards, filter client-side against
// the currently selected state" (national boards have no stateId) should call this with no
// argument.
export const getBoards = (stateId?: string, includeInactive = false): Promise<Board[]> =>
  get(
    `/api/v1/master-data/boards${stateId ? `?parentId=${encodeURIComponent(stateId)}` : ''}${
      includeInactive ? `${stateId ? '&' : '?'}includeInactive=true` : ''
    }`
  );

export const getClassLevels = (includeInactive = false): Promise<ClassLevel[]> =>
  get(`/api/v1/master-data/class-levels${includeInactive ? '?includeInactive=true' : ''}`);

export const getSubjects = (includeInactive = false): Promise<Subject[]> =>
  get(`/api/v1/master-data/subjects${includeInactive ? '?includeInactive=true' : ''}`);

// -- Master-only create/update pairs (plan §5 item 1) --------------------------------------
// Request shapes mirror the backend records exactly (BackEnd Application/MasterData/*/*.cs).
// IsActive lives on every Update{Entity}Request, not a separate endpoint (matches the
// backend's "activate/deactivate is just a normal update" convention).

export interface CreateCountryRequest {
  name: string;
  isoCode: string;
}
export interface UpdateCountryRequest {
  name: string;
  isoCode: string;
  isActive: boolean;
}
export const createCountry = (data: CreateCountryRequest): Promise<Country> =>
  write('/api/v1/master-data/countries', 'POST', data);
export const updateCountry = (id: string, data: UpdateCountryRequest): Promise<Country> =>
  write(`/api/v1/master-data/countries/${encodeURIComponent(id)}`, 'PUT', data);
export const deleteCountry = (id: string): Promise<void> =>
  del(`/api/v1/master-data/countries/${encodeURIComponent(id)}`);

export interface CreateStateRequest {
  countryId: string;
  name: string;
  code: string;
}
export interface UpdateStateRequest {
  countryId: string;
  name: string;
  code: string;
  isActive: boolean;
}
export const createState = (data: CreateStateRequest): Promise<State> =>
  write('/api/v1/master-data/states', 'POST', data);
export const updateState = (id: string, data: UpdateStateRequest): Promise<State> =>
  write(`/api/v1/master-data/states/${encodeURIComponent(id)}`, 'PUT', data);
export const deleteState = (id: string): Promise<void> =>
  del(`/api/v1/master-data/states/${encodeURIComponent(id)}`);

export interface CreateCityRequest {
  stateId: string;
  name: string;
}
export interface UpdateCityRequest {
  stateId: string;
  name: string;
  isActive: boolean;
}
export const createCity = (data: CreateCityRequest): Promise<City> =>
  write('/api/v1/master-data/cities', 'POST', data);
export const updateCity = (id: string, data: UpdateCityRequest): Promise<City> =>
  write(`/api/v1/master-data/cities/${encodeURIComponent(id)}`, 'PUT', data);
export const deleteCity = (id: string): Promise<void> =>
  del(`/api/v1/master-data/cities/${encodeURIComponent(id)}`);

// StateId is null for national boards (CBSE, ICSE, IB, ...) -- set only for "<State> State
// Board" rows, same as the Board interface above.
export interface CreateBoardRequest {
  name: string;
  code: string;
  stateId: string | null;
}
export interface UpdateBoardRequest {
  name: string;
  code: string;
  stateId: string | null;
  isActive: boolean;
}
export const createBoard = (data: CreateBoardRequest): Promise<Board> =>
  write('/api/v1/master-data/boards', 'POST', data);
export const updateBoard = (id: string, data: UpdateBoardRequest): Promise<Board> =>
  write(`/api/v1/master-data/boards/${encodeURIComponent(id)}`, 'PUT', data);
export const deleteBoard = (id: string): Promise<void> =>
  del(`/api/v1/master-data/boards/${encodeURIComponent(id)}`);

// subjectIds is the ClassLevel<->Subject relationship (plan: admin sets which subjects apply
// to each class level -- e.g. Pre-Nursery..UKG genuinely have none, so [] is a valid value,
// not an error).
export interface CreateClassLevelRequest {
  name: string;
  sortOrder: number;
  subjectIds: string[];
}
export interface UpdateClassLevelRequest {
  name: string;
  sortOrder: number;
  isActive: boolean;
  subjectIds: string[];
}
export const createClassLevel = (data: CreateClassLevelRequest): Promise<ClassLevel> =>
  write('/api/v1/master-data/class-levels', 'POST', data);
export const updateClassLevel = (id: string, data: UpdateClassLevelRequest): Promise<ClassLevel> =>
  write(`/api/v1/master-data/class-levels/${encodeURIComponent(id)}`, 'PUT', data);
export const deleteClassLevel = (id: string): Promise<void> =>
  del(`/api/v1/master-data/class-levels/${encodeURIComponent(id)}`);

export interface CreateSubjectRequest {
  name: string;
  stream: string | null;
}
export interface UpdateSubjectRequest {
  name: string;
  stream: string | null;
  isActive: boolean;
}
export const createSubject = (data: CreateSubjectRequest): Promise<Subject> =>
  write('/api/v1/master-data/subjects', 'POST', data);
export const updateSubject = (id: string, data: UpdateSubjectRequest): Promise<Subject> =>
  write(`/api/v1/master-data/subjects/${encodeURIComponent(id)}`, 'PUT', data);
export const deleteSubject = (id: string): Promise<void> =>
  del(`/api/v1/master-data/subjects/${encodeURIComponent(id)}`);
