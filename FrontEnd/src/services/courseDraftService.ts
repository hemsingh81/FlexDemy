// Story 2.4: the Course Wizard's live-wire persistence surface (Title/Description/Thumbnails).
// Same real-backend `fetch` pattern as masterDataService.ts -- see that file's header comment.
// Deliberately NOT an extension of `./coursesService.ts`, which is an unrelated, fully
// in-memory mock backing the separate public catalog/Discover screens.
import { getToken } from './authService';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';

export interface ThumbnailCropDto {
  x: number;
  y: number;
  zoom: number;
}

export interface CourseThumbnailDto {
  id: string;
  url: string;
  isPrimary: boolean;
  order: number;
  crop: ThumbnailCropDto;
}

export interface CourseDraftDto {
  id: string;
  title: string;
  shortDescription: string;
  lifecycleState: string;
  thumbnails: CourseThumbnailDto[];
  tagIds: string[];
  countryId: string | null;
  stateId: string | null;
  cityId: string | null;
  boardId: string | null;
  classLevelId: string | null;
  subjectId: string | null;
}

// Story 2.5: the fields a wizard step-commit can update, beyond title/description.
export interface UpdateDraftCourseFields {
  title: string;
  description: string;
  tagIds: string[];
  countryId: string | null;
  stateId: string | null;
  cityId: string | null;
  boardId: string | null;
  classLevelId: string | null;
  subjectId: string | null;
}

export class CourseDraftError extends Error {}

// No GET endpoint is consumed here -- resuming an existing Draft is FR-22/Story 3.9 territory,
// out of this story's scope (see useCourseDraft.ts's Dev Notes).
const write = async <T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    throw new CourseDraftError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new CourseDraftError(problem?.detail || 'Something went wrong. Please try again.');
  }

  return response.json();
};

export const createDraftCourse = (title: string, description: string): Promise<CourseDraftDto> =>
  write('/api/v1/courses/drafts', 'POST', { title, description });

// Object-param shape (not positional) -- growing this to 9 positional args (several same-typed
// optional ids like boardId/classLevelId/subjectId back-to-back) would be a real transposition
// risk with no compiler protection. Mirrors the backend's named-field UpdateDraftCourseRequest.
export const updateDraftCourse = (id: string, fields: UpdateDraftCourseFields): Promise<CourseDraftDto> =>
  write(`/api/v1/courses/drafts/${encodeURIComponent(id)}`, 'PUT', fields);

// Cannot reuse write()'s JSON helper -- a real upload needs a FormData body with no
// Content-Type header set manually (fetch sets the multipart boundary itself; a hardcoded
// 'Content-Type': 'application/json' plus JSON.stringify(body) would corrupt this request).
export const uploadThumbnail = async (courseId: string, file: File, crop: ThumbnailCropDto): Promise<CourseDraftDto> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('cropX', String(crop.x));
  formData.append('cropY', String(crop.y));
  formData.append('cropZoom', String(crop.zoom));

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/courses/drafts/${encodeURIComponent(courseId)}/thumbnails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });
  } catch (e) {
    throw new CourseDraftError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new CourseDraftError(problem?.detail || 'Something went wrong. Please try again.');
  }

  return response.json();
};

export const removeThumbnail = (courseId: string, thumbnailId: string): Promise<CourseDraftDto> =>
  write(`/api/v1/courses/drafts/${encodeURIComponent(courseId)}/thumbnails/${encodeURIComponent(thumbnailId)}`, 'DELETE');

export const reorderThumbnail = (courseId: string, thumbnailId: string, direction: 'left' | 'right'): Promise<CourseDraftDto> =>
  write(
    `/api/v1/courses/drafts/${encodeURIComponent(courseId)}/thumbnails/${encodeURIComponent(thumbnailId)}/reorder`,
    'PUT',
    { direction }
  );

export const setPrimaryThumbnail = (courseId: string, thumbnailId: string): Promise<CourseDraftDto> =>
  write(`/api/v1/courses/drafts/${encodeURIComponent(courseId)}/thumbnails/${encodeURIComponent(thumbnailId)}/primary`, 'PUT');
