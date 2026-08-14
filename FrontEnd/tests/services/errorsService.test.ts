import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authService from '@/src/services/authService';
import { reportError, getErrorList, getErrorDetail } from '@/src/services/errorsService';

const basePayload = {
  message: 'boom',
  stack: 'Error: boom\n  at x',
  url: 'https://app.example.com/dashboard',
  userAgent: 'test-agent',
  timestamp: '2026-08-14T00:00:00.000Z',
};

describe('errorsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authService, 'getToken').mockReturnValue('fake-jwt');
  });

  it('reportError() POSTs to /api/v1/errors/client with the given payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202, headers: new Headers(), json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    await reportError(basePayload);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/errors/client');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body).toMatchObject(basePayload);
  });

  // Ordered before the "includes" test below: both share httpClient.ts's module-level
  // correlation-ID store (not reset between tests, matching how it behaves for real across an
  // app session), so this must run while the store is still unset.
  it('reportError() omits correlationId from the payload when the store has no value', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202, headers: new Headers(), json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    await reportError(basePayload);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.correlationId).toBeUndefined();
  });

  it('reportError() includes the current correlation ID when the store holds a value', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'X-Correlation-Id': 'corr-abc' }),
        json: async () => ({}),
      })
    );
    // A prior request establishes the store's current value, same as httpClient.ts would from
    // any earlier page/response -- errorsService.ts doesn't set this itself.
    const { request } = await import('@/src/services/httpClient');
    await request('/api/v1/warm-up', 'GET');

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202, headers: new Headers(), json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    await reportError(basePayload);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.correlationId).toBe('corr-abc');
  });

  it('reportError() never throws when the network request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(reportError(basePayload)).resolves.toBeUndefined();
  });

  it('reportError() never throws when the backend returns a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, headers: new Headers(), json: async () => ({ detail: 'boom' }) })
    );

    await expect(reportError(basePayload)).resolves.toBeUndefined();
  });

  // Story 4.5: admin list/detail reads, both via httpClient.ts's shared request().
  describe('getErrorList', () => {
    it('GETs /api/v1/errors with filters and paging encoded as query params', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ items: [], totalCount: 0, page: 2, pageSize: 25 }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await getErrorList({ category: 'ValidationError', priority: 'P0', includeArchived: true, search: 'timeout' }, 2, 25);

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/errors?');
      expect(url).toContain('category=ValidationError');
      expect(url).toContain('priority=P0');
      expect(url).toContain('includeArchived=true');
      expect(url).toContain('search=timeout');
      expect(url).toContain('page=2');
      expect(url).toContain('pageSize=25');
    });

    it('omits unset filters from the query string', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ items: [], totalCount: 0, page: 1, pageSize: 25 }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await getErrorList({}, 1, 25);

      const [url] = fetchMock.mock.calls[0];
      expect(url).not.toContain('category=');
      expect(url).not.toContain('priority=');
      expect(url).not.toContain('includeArchived=');
    });

    it('returns the parsed paged result', async () => {
      const paged = {
        items: [{ id: 'err_1', category: 'ValidationError', priority: 'P0', status: 'New', message: 'boom', source: 'Backend', occurrenceCount: 1, lastOccurredAt: '2026-08-14T00:00:00Z' }],
        totalCount: 1,
        page: 1,
        pageSize: 25,
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers(), json: async () => paged }));

      const result = await getErrorList({}, 1, 25);

      expect(result).toEqual(paged);
    });
  });

  describe('getErrorDetail', () => {
    it('GETs /api/v1/errors/:id', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers(), json: async () => ({ id: 'err_1' }) });
      vi.stubGlobal('fetch', fetchMock);

      await getErrorDetail('err_1');

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/errors/err_1');
    });

    it('URL-encodes the id', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers(), json: async () => ({}) });
      vi.stubGlobal('fetch', fetchMock);

      await getErrorDetail('err/1');

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/errors/err%2F1');
    });
  });
});
