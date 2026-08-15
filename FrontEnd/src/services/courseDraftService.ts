// Story 2.4: the Course Wizard's live-wire persistence surface (Title/Description/Thumbnails).
// Deliberately NOT an extension of `./coursesService.ts`, which is an unrelated, fully
// in-memory mock backing the separate public catalog/Discover screens.
// Story 4.4/AD-7: write() and uploadThumbnail() now delegate to httpClient.ts's shared
// request<T>() -- kept as thin wrappers so CourseDraftError stays this file's public error type,
// while the actual fetch/correlation-ID capture logic lives in exactly one place.
import { request, HttpClientError, API_BASE_URL } from './httpClient';

// Re-exported: useCourseDraft.ts builds absolute thumbnail URLs from this constant, and this
// module was its historical source -- now sourced from httpClient.ts (the one place it's
// actually defined) rather than each caller reaching into httpClient.ts directly.
export { API_BASE_URL };

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

const asCourseDraftError = (e: unknown): CourseDraftError =>
  new CourseDraftError(e instanceof HttpClientError || e instanceof Error ? e.message : 'Something went wrong. Please try again.');

// Story 3.9: GetPublishStatus is the first GET this file consumes -- moveToReview/confirmReview/
// publish are also added here (Story 3.9/Task 1's endpoints), still no GET-by-id "resume this
// Draft" capability (that gap is documented in this story's own Dev Notes/Completion Notes, not
// silently built here).
const write = async <T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> => {
  try {
    return await request<T>(path, method, body);
  } catch (e) {
    throw asCourseDraftError(e);
  }
};

export const createDraftCourse = (title: string, description: string): Promise<CourseDraftDto> =>
  write('/api/v1/courses/drafts', 'POST', { title, description });

// Object-param shape (not positional) -- growing this to 9 positional args (several same-typed
// optional ids like boardId/classLevelId/subjectId back-to-back) would be a real transposition
// risk with no compiler protection. Mirrors the backend's named-field UpdateDraftCourseRequest.
export const updateDraftCourse = (id: string, fields: UpdateDraftCourseFields): Promise<CourseDraftDto> =>
  write(`/api/v1/courses/drafts/${encodeURIComponent(id)}`, 'PUT', fields);

// AD-7: routed through httpClient.ts's request() too (not just write()'s JSON path) -- every
// services/* HTTP call must go through the one shared helper, or FR-23's correlation-ID capture
// silently doesn't work for this call while appearing to work for every other one in this file.
// request() itself handles the FormData-vs-JSON body distinction (no Content-Type set manually
// for FormData -- fetch sets the multipart boundary itself).
export const uploadThumbnail = async (courseId: string, file: File, crop: ThumbnailCropDto): Promise<CourseDraftDto> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('cropX', String(crop.x));
  formData.append('cropY', String(crop.y));
  formData.append('cropZoom', String(crop.zoom));

  try {
    return await request<CourseDraftDto>(`/api/v1/courses/drafts/${encodeURIComponent(courseId)}/thumbnails`, 'POST', formData);
  } catch (e) {
    throw asCourseDraftError(e);
  }
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

// Publish is now a single, immediate, synchronous transition -- no per-node batch/checklist, no
// isPublishing flag. Mirrors PublishDtos.cs's PublishStatusDto exactly (camelCase).
export interface PublishStatusDto {
  lifecycleState: string;
}

// Story 3.10/Task 2-3: return-to-Draft (Published -> Draft, content untouched) plus version
// history/rollback -- mirrors IVersionService.CourseVersionDto exactly.
export const returnToDraft = (courseId: string): Promise<void> =>
  write(`/api/v1/courses/drafts/${encodeURIComponent(courseId)}/return-to-draft`, 'POST');

export interface CourseVersionDto {
  id: string;
  publishedAt: string;
  fileCount: number;
}

export const getVersions = (courseId: string): Promise<CourseVersionDto[]> =>
  write(`/api/v1/courses/drafts/${encodeURIComponent(courseId)}/versions`, 'GET');

export const restoreVersion = (courseId: string, versionId: string): Promise<void> =>
  write(`/api/v1/courses/drafts/${encodeURIComponent(courseId)}/versions/${encodeURIComponent(versionId)}/restore`, 'POST');

export const publishCourse = (courseId: string): Promise<void> =>
  write(`/api/v1/courses/${encodeURIComponent(courseId)}/publish`, 'POST');

export const getPublishStatus = (courseId: string): Promise<PublishStatusDto> =>
  write(`/api/v1/courses/${encodeURIComponent(courseId)}/publish-status`, 'GET');

// FR-31 (CourseWizard PRD S4.11): closes the "no GET-by-id 'resume this Draft' capability" gap
// flagged in this file's own historical comment above (write()'s doc comment) -- backs the
// "resume a course" list, every Lifecycle State the tutor owns, not just Draft.
export interface MyCourseSummaryDto {
  id: string;
  title: string;
  lifecycleState: string;
  updatedAt: string;
}

export const getMyCourses = (): Promise<MyCourseSummaryDto[]> => write('/api/v1/courses/mine', 'GET');

// FR-32 (CourseWizard PRD S4.11): permanent delete, Draft/InReview/ReviewConfirmed only -- the
// backend rejects a Published course itself (ValidationException), this isn't just a UI guard.
export const deleteCourse = (courseId: string): Promise<void> =>
  write(`/api/v1/courses/drafts/${encodeURIComponent(courseId)}`, 'DELETE');
