// Story 2.9: the Course Content Editor's live-wire Chapter/Topic/Subtopic/ContentBlock CRUD
// surface. Same real-backend `fetch` pattern as courseDraftService.ts/courseFileService.ts --
// own file, own error class. Wire DTOs here mirror ContentTreeDtos.cs exactly -- Confirmation/
// Format are PascalCase strings ("Confirmed"/"Text", CourseMapper.cs's own .ToString() convention,
// not the lowercase unions useCourseContentTree.ts's own Chapter/Topic/Subtopic/ContentBlock types
// declare). Translating PascalCase -> lowercase is useCourseContentTree.ts's job (Task 10), not
// this file's -- everything here is a thin, honest reflection of the real HTTP contract.
import { getToken } from './authService';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';

export interface ContentBlockDto {
  id: string;
  format: string;
  confirmation: string;
  order: number;
  text: string | null;
  lang: string | null;
  notation: string | null;
  imageUrl: string | null;
  altText: string | null;
}

export interface SubtopicDto {
  id: string;
  title: string;
  confirmation: string;
  order: number;
  contentBlocks: ContentBlockDto[];
}

export interface TopicDto {
  id: string;
  title: string;
  confirmation: string;
  order: number;
  subtopics: SubtopicDto[];
  contentBlocks: ContentBlockDto[];
}

export interface ChapterDto {
  id: string;
  title: string;
  confirmation: string;
  order: number;
  topics: TopicDto[];
}

// Mirrors UpdateContentBlockRequest's tri-state contract: JSON.stringify drops any key whose
// value is `undefined`, so a field is "touched" only when set to `null` (clear it) or a real
// string (set it) -- never by merely appearing in this TS type. Leave a field's key out of the
// object entirely (the default for an optional property) to not touch it at all.
export interface EditContentBlockPatch {
  text?: string | null;
  lang?: string | null;
  notation?: string | null;
  imageUrl?: string | null;
  altText?: string | null;
  format?: string | null;
}

export class ContentTreeError extends Error {}

const request = async <T>(path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> => {
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
    throw new ContentTreeError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new ContentTreeError(problem?.detail || 'Something went wrong. Please try again.');
  }

  // 204 No Content responses (every mutator except the four Add* calls) have no JSON body.
  if (response.status === 204) return undefined as T;
  return response.json();
};

const base = (courseId: string) => `/api/v1/courses/${encodeURIComponent(courseId)}/content-tree`;

export const getTree = (courseId: string): Promise<ChapterDto[]> => request(base(courseId), 'GET');

export const addChapter = (courseId: string): Promise<ChapterDto> => request(`${base(courseId)}/chapters`, 'POST');

export const addTopic = (courseId: string, chapterId: string): Promise<TopicDto> =>
  request(`${base(courseId)}/topics`, 'POST', { chapterId });

export const addSubtopic = (courseId: string, topicId: string): Promise<SubtopicDto> =>
  request(`${base(courseId)}/subtopics`, 'POST', { topicId });

// parentType is "topic" or "subtopic" -- resolved by the caller (useCourseContentTree.ts/Task 10),
// never derivable from AddableNodeType's 'contentBlock' value alone.
export const addContentBlock = (courseId: string, parentId: string, parentType: 'topic' | 'subtopic'): Promise<ContentBlockDto> =>
  request(`${base(courseId)}/content-blocks`, 'POST', { parentId, parentType });

export const editNodeTitle = (courseId: string, id: string, title: string): Promise<void> =>
  request(`${base(courseId)}/nodes/${encodeURIComponent(id)}/title`, 'PATCH', { title });

export const editContentBlock = (courseId: string, id: string, patch: EditContentBlockPatch): Promise<void> =>
  request(`${base(courseId)}/content-blocks/${encodeURIComponent(id)}`, 'PATCH', patch);

export const deleteNode = (courseId: string, id: string): Promise<void> =>
  request(`${base(courseId)}/nodes/${encodeURIComponent(id)}`, 'DELETE');

export const reorderNode = (courseId: string, id: string, direction: 'up' | 'down'): Promise<void> =>
  request(`${base(courseId)}/nodes/${encodeURIComponent(id)}/reorder`, 'POST', { direction });

export const moveNode = (courseId: string, draggedId: string, targetId: string): Promise<void> =>
  request(`${base(courseId)}/nodes/${encodeURIComponent(draggedId)}/move`, 'POST', { targetId });

export const confirmNode = (courseId: string, id: string): Promise<void> =>
  request(`${base(courseId)}/nodes/${encodeURIComponent(id)}/confirm`, 'POST');
