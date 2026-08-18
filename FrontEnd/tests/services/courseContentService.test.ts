// Story 8.3, Task 5: resolveResourceUrl's per-resourceId caching, and deleteResource's
// forceRemoveFromContent query-param variant.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authService from '@/src/services/authService';
import { resolveResourceUrl, deleteResource } from '@/src/services/courseContentService';

describe('courseContentService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authService, 'getToken').mockReturnValue('fake-jwt');
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn((blob: Blob) => `blob:mock-${(blob as any).__id ?? 'x'}`) });
  });

  describe('resolveResourceUrl', () => {
    it('caches per resourceId -- a second call for the same id never re-fetches the bytes', async () => {
      const blob = new Blob(['bytes']);
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers(), blob: async () => blob });
      vi.stubGlobal('fetch', fetchMock);

      const first = await resolveResourceUrl('course_1', 'resource_1');
      const second = await resolveResourceUrl('course_1', 'resource_1');

      expect(first).toBe(second);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('fetches independently for a different resourceId', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers(), blob: async () => new Blob(['x']) });
      vi.stubGlobal('fetch', fetchMock);

      await resolveResourceUrl('course_1', 'resource_a');
      await resolveResourceUrl('course_1', 'resource_b');

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteResource', () => {
    it('omits the query param by default', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, headers: new Headers() });
      vi.stubGlobal('fetch', fetchMock);

      await deleteResource('course_1', 'resource_1');

      const [url] = fetchMock.mock.calls[0];
      expect(url).not.toContain('forceRemoveFromContent');
    });

    it('appends ?forceRemoveFromContent=true when requested', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, headers: new Headers() });
      vi.stubGlobal('fetch', fetchMock);

      await deleteResource('course_1', 'resource_1', true);

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('forceRemoveFromContent=true');
    });
  });
});
