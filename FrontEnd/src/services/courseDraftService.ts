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

// Story 3.9: GetPublishStatus is the first GET this file consumes -- moveToReview/confirmReview/
// publish are also added here (Story 3.9/Task 1's endpoints), still no GET-by-id "resume this
// Draft" capability (that gap is documented in this story's own Dev Notes/Completion Notes, not
// silently built here).
const write = async <T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
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

  // 204 No Content (move-to-review/confirm-review/publish) has no JSON body -- same handling
  // contentTreeService.ts's own request() helper already established.
  if (response.status === 204) return undefined as T;
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

// Story 3.9/Task 1: the real Draft -> InReview -> ReviewConfirmed transitions.
export const moveToReview = (courseId: string): Promise<void> =>
  write(`/api/v1/courses/drafts/${encodeURIComponent(courseId)}/move-to-review`, 'POST');

export const confirmReview = (courseId: string): Promise<void> =>
  write(`/api/v1/courses/drafts/${encodeURIComponent(courseId)}/confirm-review`, 'POST');

// Story 3.8/Task 5: the real publish trigger + checklist status read -- mirrors
// PublishDtos.cs/ChecklistRowDto.cs exactly (camelCase, ASP.NET Core's default JSON policy, same
// as every other DTO in this file).
export interface ChecklistRowDto {
  nodeId: string;
  nodeKind: string;
  title: string;
  statusKind: string;
  statusText: string;
}

export interface PublishStatusDto {
  lifecycleState: string;
  isPublishing: boolean;
  checklist: ChecklistRowDto[] | null;
}

// Story 3.10/Task 2-3: return-to-Draft (Published -> Draft, content untouched) plus version
// history/rollback -- mirrors IVersionService.CourseVersionDto exactly.
export const returnToDraft = (courseId: string): Promise<void> =>
  write(`/api/v1/courses/drafts/${encodeURIComponent(courseId)}/return-to-draft`, 'POST');

export interface CourseVersionDto {
  id: string;
  publishedAt: string;
  chapterCount: number;
  topicCount: number;
}

export const getVersions = (courseId: string): Promise<CourseVersionDto[]> =>
  write(`/api/v1/courses/drafts/${encodeURIComponent(courseId)}/versions`, 'GET');

export const restoreVersion = (courseId: string, versionId: string): Promise<void> =>
  write(`/api/v1/courses/drafts/${encodeURIComponent(courseId)}/versions/${encodeURIComponent(versionId)}/restore`, 'POST');

export const publishCourse = (courseId: string): Promise<void> =>
  write(`/api/v1/courses/${encodeURIComponent(courseId)}/publish`, 'POST');

export const getPublishStatus = (courseId: string): Promise<PublishStatusDto> =>
  write(`/api/v1/courses/${encodeURIComponent(courseId)}/publish-status`, 'GET');
