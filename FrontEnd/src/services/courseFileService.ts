// Story 2.6: the Course Content Editor's live-wire file upload/scan-status surface.
// Story 4.4/AD-7: both calls below now delegate to httpClient.ts's shared request<T>() instead
// of duplicating fetch logic -- retired as part of implementing correlation-ID capture (FR-23)
// so this file's calls aren't silently left off the one path that updates the shared store.
import { request, HttpClientError } from './httpClient';

export interface CourseFileDto {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  failureReason: string | null;
  parsedContent: string | null;
}

export class CourseFileError extends Error {}

const call = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (e) {
    throw new CourseFileError(e instanceof HttpClientError || e instanceof Error ? e.message : 'Something went wrong. Please try again.');
  }
};

export const uploadFile = (courseId: string, file: File): Promise<CourseFileDto> => {
  const formData = new FormData();
  formData.append('file', file);

  return call(() => request<CourseFileDto>(`/api/v1/courses/${encodeURIComponent(courseId)}/files`, 'POST', formData));
};

export const getFiles = (courseId: string): Promise<CourseFileDto[]> =>
  call(() => request<CourseFileDto[]>(`/api/v1/courses/${encodeURIComponent(courseId)}/files`, 'GET'));

export const deleteFile = (courseId: string, fileId: string): Promise<void> =>
  call(() => request<void>(`/api/v1/courses/${encodeURIComponent(courseId)}/files/${encodeURIComponent(fileId)}`, 'DELETE'));

// Student-facing read: a published course's uploaded files and their raw parsed text -- no AI
// structuring step in between. Unlike getFiles above, this isn't ownership-gated (mirrors
// coursesService.ts's own open-read GetCourseById shape).
export const getCourseContent = (courseId: string): Promise<CourseFileDto[]> =>
  call(() => request<CourseFileDto[]>(`/api/v1/courses/${encodeURIComponent(courseId)}/content`, 'GET'));
