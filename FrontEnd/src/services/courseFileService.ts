// Story 2.6: the Course Content Editor's live-wire file upload/scan-status surface. Same real
// backend `fetch` pattern as courseDraftService.ts -- own file, own error class, standalone
// FormData upload (no manually-set Content-Type -- fetch sets the multipart boundary itself).
import { getToken } from './authService';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';

export interface CourseFileDto {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  failureReason: string | null;
}

export class CourseFileError extends Error {}

export const uploadFile = async (courseId: string, file: File): Promise<CourseFileDto> => {
  const formData = new FormData();
  formData.append('file', file);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/courses/${encodeURIComponent(courseId)}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });
  } catch (e) {
    throw new CourseFileError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new CourseFileError(problem?.detail || 'Something went wrong. Please try again.');
  }

  return response.json();
};

export const getFiles = async (courseId: string): Promise<CourseFileDto[]> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/courses/${encodeURIComponent(courseId)}/files`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  } catch (e) {
    throw new CourseFileError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new CourseFileError(problem?.detail || 'Something went wrong. Please try again.');
  }

  return response.json();
};
