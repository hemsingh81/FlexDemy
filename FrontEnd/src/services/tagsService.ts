// Real-backend Tag calls (Story 1.9, live-wiring Story 1.3's Tag Management UI). Standalone --
// deliberately not part of masterDataService.ts, matching Tag's own backend split (FR-26: "not a
// plug-in to that existing [Master Data] scaffold"). Same `get`/`write` + fetch pattern as
// services/masterDataService.ts -- this project has no shared HTTP client wrapper, each service
// file is self-contained. Write routes are Master-only server-side (FeatureKeys.MasterDataManage,
// reused -- no dedicated Tag permission key).
import { getToken } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';

export interface Tag {
  id: string;
  name: string;
  isActive: boolean;
}

export interface CreateTagRequest {
  name: string;
}

export interface UpdateTagRequest {
  name: string;
  isActive: boolean;
}

export class TagsError extends Error {}

const get = async <T>(path: string): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  } catch (e) {
    throw new TagsError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new TagsError(problem?.detail || 'Something went wrong. Please try again.');
  }

  return response.json();
};

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
    throw new TagsError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new TagsError(problem?.detail || 'Something went wrong. Please try again.');
  }

  return response.json();
};

export const getTags = (): Promise<Tag[]> => get('/api/v1/tags');

export const createTag = (data: CreateTagRequest): Promise<Tag> => write('/api/v1/tags', 'POST', data);

export const updateTag = (id: string, data: UpdateTagRequest): Promise<Tag> =>
  write(`/api/v1/tags/${encodeURIComponent(id)}`, 'PUT', data);
