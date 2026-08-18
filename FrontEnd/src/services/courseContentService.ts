// Story 7.1: the ContentAuthoring PRD's data-access boundary for the Course Content Editor's
// document canvas -- Chapter/Topic/Subtopic/Page/Resource reads and writes all live here, added
// to incrementally by later stories (never replaced). Routes every call through httpClient.ts's
// shared request() (AD-1/AD-7), same as courseDraftService.ts, so correlation-ID capture keeps
// working uniformly -- never a direct fetch call.
import { request, requestBlob, HttpClientError } from './httpClient';
import type { ContentOwnerType } from '../types';

export interface ChapterSummaryDto {
  id: string;
  title: string;
  order: number;
}

// Story 8.1: a resource attached to a Chapter, Topic, Sub-Topic, or Page (AD-20's polymorphic
// OwnerType/OwnerId, same pattern as Page). No `url` field -- Story 8.3's authenticated
// `GET .../resources/{id}/content` (AD-29) is the only way to reach a resource's bytes; this DTO
// only carries what's needed to render the row itself. `status`/`failureReason` mirror
// CourseFileDto's own scan-status shape (Queued/Done/Failed via JobItemStatus.ToString()).
export interface ResourceDto {
  id: string;
  label: string;
  caption: string | null;
  role: 'Inline' | 'Attachment' | 'Both';
  order: number;
  status: string;
  failureReason: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

// Story 7.3: a Page can attach directly to a Chapter, Topic, or Subtopic (FR-2) -- each of those
// three document DTOs below carries its own `pages` list alongside its structural children.
// Story 8.1 adds `resources` to all four document DTOs below (generic across every owner type,
// per AD-20) -- optional so the many existing test fixtures built before this story don't all
// need updating; a real server response always includes it.
export interface PageDocumentDto {
  id: string;
  title: string;
  bodyMarkdown: string;
  isConfirmed: boolean;
  order: number;
  resources?: ResourceDto[];
}

// Story 7.2: real fields, replacing Story 7.1's empty placeholder. Story 7.3 adds `pages`.
export interface SubtopicDocumentDto {
  id: string;
  title: string;
  description: string;
  order: number;
  isConfirmed: boolean;
  pages: PageDocumentDto[];
  resources?: ResourceDto[];
}

export interface TopicDocumentDto {
  id: string;
  title: string;
  description: string;
  order: number;
  isConfirmed: boolean;
  subtopics: SubtopicDocumentDto[];
  pages: PageDocumentDto[];
  resources?: ResourceDto[];
}

export interface ChapterDocumentDto {
  id: string;
  courseId: string;
  title: string;
  description: string;
  isConfirmed: boolean;
  topics: TopicDocumentDto[];
  pages: PageDocumentDto[];
  resources?: ResourceDto[];
}

export interface UpdateChapterFields {
  title: string;
  description: string | null;
}

// Story 7.2: cascade-delete confirmation counts (FR-6) -- pageResources/nodeResources always 0
// until Stories 7.3/8.1 exist server-side.
export interface DeleteImpactDto {
  topics: number;
  subtopics: number;
  pages: number;
  pageResources: number;
  nodeResources: number;
}

export type ReorderDirection = 'up' | 'down';

// Story 7.4: the whole-course, body-free outline (AD-4's CourseContentContext data source) --
// materially distinct from ChapterDocumentDto (one Chapter, full bodies). No bodyMarkdown
// anywhere in this shape.
export interface OutlinePageDto {
  id: string;
  title: string;
  isConfirmed: boolean;
  order: number;
}

export interface OutlineSubtopicDto {
  id: string;
  title: string;
  description: string;
  isConfirmed: boolean;
  order: number;
  pages: OutlinePageDto[];
}

export interface OutlineTopicDto {
  id: string;
  title: string;
  description: string;
  isConfirmed: boolean;
  order: number;
  subtopics: OutlineSubtopicDto[];
  pages: OutlinePageDto[];
}

export interface OutlineChapterDto {
  id: string;
  title: string;
  description: string;
  isConfirmed: boolean;
  order: number;
  topics: OutlineTopicDto[];
  pages: OutlinePageDto[];
}

export interface OutlineDto {
  chapters: OutlineChapterDto[];
}

// Story 8.3: `status` carries HttpClientError's own status through (0/undefined for a plain
// Error or an unknown throw) -- lets a caller detect e.g. a 409 delete-in-use conflict without
// parsing the message text.
export class CourseContentError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

const asCourseContentError = (e: unknown): CourseContentError =>
  new CourseContentError(
    e instanceof HttpClientError || e instanceof Error ? e.message : 'Something went wrong. Please try again.',
    e instanceof HttpClientError ? e.status : undefined
  );

const write = async <T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> => {
  try {
    return await request<T>(path, method, body);
  } catch (e) {
    throw asCourseContentError(e);
  }
};

const contentPath = (courseId: string, ...segments: string[]) =>
  `/api/v1/courses/${encodeURIComponent(courseId)}/content/${segments.join('/')}`;

export const getChapters = (courseId: string): Promise<ChapterSummaryDto[]> => write(contentPath(courseId, 'chapters'), 'GET');

export const getChapterDocument = (courseId: string, chapterId: string): Promise<ChapterDocumentDto> =>
  write(contentPath(courseId, 'chapters', encodeURIComponent(chapterId), 'document'), 'GET');

export const createChapter = (courseId: string, title: string): Promise<ChapterSummaryDto> =>
  write(contentPath(courseId, 'chapters'), 'POST', { title });

// PUT, not PATCH -- httpClient.ts's request() only supports GET/POST/PUT/DELETE (confirmed by
// reading it), matching this codebase's actual PUT-for-partial-update convention
// (courseDraftService.ts's updateDraftCourse is the precedent).
export const updateChapter = (courseId: string, chapterId: string, fields: UpdateChapterFields): Promise<ChapterDocumentDto> =>
  write(contentPath(courseId, 'chapters', encodeURIComponent(chapterId)), 'PUT', fields);

export const getChapterDeleteImpact = (courseId: string, chapterId: string): Promise<DeleteImpactDto> =>
  write(contentPath(courseId, 'chapters', encodeURIComponent(chapterId), 'delete-impact'), 'GET');

export const deleteChapter = (courseId: string, chapterId: string): Promise<void> =>
  write(contentPath(courseId, 'chapters', encodeURIComponent(chapterId)), 'DELETE');

export const reorderChapter = (courseId: string, chapterId: string, direction: ReorderDirection): Promise<void> =>
  write(contentPath(courseId, 'chapters', encodeURIComponent(chapterId), 'reorder'), 'PUT', { direction });

// ── Topic ──────────────────────────────────────────────────────────────────────────────────

export const createTopic = (courseId: string, chapterId: string, title: string): Promise<TopicDocumentDto> =>
  write(contentPath(courseId, 'chapters', encodeURIComponent(chapterId), 'topics'), 'POST', { title });

export const updateTopic = (courseId: string, topicId: string, fields: UpdateChapterFields): Promise<TopicDocumentDto> =>
  write(contentPath(courseId, 'topics', encodeURIComponent(topicId)), 'PUT', fields);

export const getTopicDeleteImpact = (courseId: string, topicId: string): Promise<DeleteImpactDto> =>
  write(contentPath(courseId, 'topics', encodeURIComponent(topicId), 'delete-impact'), 'GET');

export const deleteTopic = (courseId: string, topicId: string): Promise<void> =>
  write(contentPath(courseId, 'topics', encodeURIComponent(topicId)), 'DELETE');

export const reorderTopic = (courseId: string, topicId: string, direction: ReorderDirection): Promise<void> =>
  write(contentPath(courseId, 'topics', encodeURIComponent(topicId), 'reorder'), 'PUT', { direction });

// ── Subtopic ───────────────────────────────────────────────────────────────────────────────

export const createSubtopic = (courseId: string, topicId: string, title: string): Promise<SubtopicDocumentDto> =>
  write(contentPath(courseId, 'topics', encodeURIComponent(topicId), 'subtopics'), 'POST', { title });

export const updateSubtopic = (courseId: string, subtopicId: string, fields: UpdateChapterFields): Promise<SubtopicDocumentDto> =>
  write(contentPath(courseId, 'subtopics', encodeURIComponent(subtopicId)), 'PUT', fields);

export const getSubtopicDeleteImpact = (courseId: string, subtopicId: string): Promise<DeleteImpactDto> =>
  write(contentPath(courseId, 'subtopics', encodeURIComponent(subtopicId), 'delete-impact'), 'GET');

export const deleteSubtopic = (courseId: string, subtopicId: string): Promise<void> =>
  write(contentPath(courseId, 'subtopics', encodeURIComponent(subtopicId)), 'DELETE');

export const reorderSubtopic = (courseId: string, subtopicId: string, direction: ReorderDirection): Promise<void> =>
  write(contentPath(courseId, 'subtopics', encodeURIComponent(subtopicId), 'reorder'), 'PUT', { direction });

// ── Page (Story 7.3) ───────────────────────────────────────────────────────────────────────

export const createPage = (courseId: string, ownerType: ContentOwnerType, ownerId: string, title: string): Promise<PageDocumentDto> =>
  write(contentPath(courseId, 'pages'), 'POST', { ownerType, ownerId, title });

// Story 11.2, FR-46: a single Page on its own -- page-scope Preview as Student's own fetch, also
// reused by Story 11.4's real Course Player.
export const getPage = (courseId: string, pageId: string): Promise<PageDocumentDto> =>
  write(contentPath(courseId, 'pages', encodeURIComponent(pageId)), 'GET');

export const updatePage = (courseId: string, pageId: string, fields: { title: string; bodyMarkdown: string | null }): Promise<PageDocumentDto> =>
  write(contentPath(courseId, 'pages', encodeURIComponent(pageId)), 'PUT', fields);

export const getPageDeleteImpact = (courseId: string, pageId: string): Promise<DeleteImpactDto> =>
  write(contentPath(courseId, 'pages', encodeURIComponent(pageId), 'delete-impact'), 'GET');

export const deletePage = (courseId: string, pageId: string): Promise<void> =>
  write(contentPath(courseId, 'pages', encodeURIComponent(pageId)), 'DELETE');

export const reorderPage = (courseId: string, pageId: string, direction: ReorderDirection): Promise<void> =>
  write(contentPath(courseId, 'pages', encodeURIComponent(pageId), 'reorder'), 'PUT', { direction });

export const movePage = (courseId: string, pageId: string, ownerType: ContentOwnerType, ownerId: string): Promise<PageDocumentDto> =>
  write(contentPath(courseId, 'pages', encodeURIComponent(pageId), 'move'), 'PUT', { ownerType, ownerId });

// ── Outline (Story 7.4) ───────────────────────────────────────────────────────────────────────

export const getOutline = (courseId: string): Promise<OutlineDto> => write(contentPath(courseId, 'outline'), 'GET');

// ── Resource (Story 8.1) ──────────────────────────────────────────────────────────────────────

export interface UploadResourceFields {
  label: string;
  caption?: string | null;
  role?: 'Inline' | 'Attachment' | 'Both';
}

// Multipart -- mirrors courseFileService.ts's own uploadFile FormData shape. httpClient.ts's
// request() detects `body instanceof FormData` and skips both JSON.stringify and the
// Content-Type header for it, same as every other multipart call in this codebase.
export const uploadResource = (
  courseId: string,
  ownerType: ContentOwnerType,
  ownerId: string,
  file: File,
  fields: UploadResourceFields
): Promise<ResourceDto> => {
  const formData = new FormData();
  formData.append('ownerType', ownerType);
  formData.append('ownerId', ownerId);
  formData.append('label', fields.label);
  if (fields.caption) formData.append('caption', fields.caption);
  if (fields.role) formData.append('role', fields.role);
  formData.append('file', file);
  return write(contentPath(courseId, 'resources'), 'POST', formData);
};

export const attachExistingFileAsResource = (
  courseId: string,
  ownerType: ContentOwnerType,
  ownerId: string,
  courseFileId: string,
  role?: 'Inline' | 'Attachment' | 'Both'
): Promise<ResourceDto> =>
  write(contentPath(courseId, 'resources', 'attach-existing'), 'POST', { ownerType, ownerId, courseFileId, role });

export const updateResource = (
  courseId: string,
  resourceId: string,
  fields: { label: string; caption: string | null; role: 'Inline' | 'Attachment' | 'Both' }
): Promise<ResourceDto> => write(contentPath(courseId, 'resources', encodeURIComponent(resourceId)), 'PUT', fields);

export const getResourcesByOwner = (courseId: string, ownerType: ContentOwnerType, ownerId: string): Promise<ResourceDto[]> =>
  write(`${contentPath(courseId, 'resources')}?ownerType=${encodeURIComponent(ownerType)}&ownerId=${encodeURIComponent(ownerId)}`, 'GET');

export const reorderResource = (courseId: string, resourceId: string, direction: ReorderDirection): Promise<void> =>
  write(contentPath(courseId, 'resources', encodeURIComponent(resourceId), 'reorder'), 'PUT', { direction });

// Story 8.3, FR-31: `forceRemoveFromContent` performs "Remove from content and delete" -- strips
// every `resource:{id}` reference from every referencing page's body, then deletes, all server-
// side in one commit. Omitted/false is Story 8.1's original guarded-but-otherwise-unconditional
// delete; a 409 (CourseContentError.status === 409) means the backend found at least one
// referencing page and named it in the message -- the caller decides whether to retry with
// forceRemoveFromContent: true.
export const deleteResource = (courseId: string, resourceId: string, forceRemoveFromContent = false): Promise<void> =>
  write(
    `${contentPath(courseId, 'resources', encodeURIComponent(resourceId))}${forceRemoveFromContent ? '?forceRemoveFromContent=true' : ''}`,
    'DELETE'
  );

// ── Resource content (Story 8.3, AD-29) ──────────────────────────────────────────────────────

// Per-resourceId object-URL cache, scoped to one editor session (module-level, cleared on a full
// page reload) -- the same image/attachment referenced twice in a page, or re-resolved on every
// Preview toggle, doesn't re-fetch the same bytes repeatedly.
const resolvedResourceUrls = new Map<string, string>();

// Caller-owned cleanup: this function does not track how long a returned object URL stays alive,
// and never auto-revokes it -- a caller holding one across a component unmount should call
// URL.revokeObjectURL(url) in its own cleanup effect if it needs to reclaim memory early. Because
// resolved URLs are cached per resourceId for reuse, a caller must not revoke a URL another
// consumer might still be using; in practice this cache is expected to live for the whole editor
// session and rely on navigation/reload to reclaim it, not manual revocation.
export const resolveResourceUrl = async (courseId: string, resourceId: string): Promise<string> => {
  const cached = resolvedResourceUrls.get(resourceId);
  if (cached) return cached;

  try {
    const blob = await requestBlob(contentPath(courseId, 'resources', encodeURIComponent(resourceId), 'content'));
    const url = URL.createObjectURL(blob);
    resolvedResourceUrls.set(resourceId, url);
    return url;
  } catch (e) {
    throw asCourseContentError(e);
  }
};
