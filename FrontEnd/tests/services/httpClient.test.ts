import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authService from '@/src/services/authService';
import { request, getCurrentCorrelationId, HttpClientError } from '@/src/services/httpClient';

describe('httpClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authService, 'getToken').mockReturnValue('fake-jwt');
  });

  it('request() sends a bearer token and JSON body, returns the parsed body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ id: '1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await request<{ id: string }>('/api/v1/things', 'POST', { name: 'x' });

    expect(result).toEqual({ id: '1' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/things');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer fake-jwt');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.body).toBe(JSON.stringify({ name: 'x' }));
  });

  it('request() sends a FormData body without a manually-set Content-Type header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ id: '1' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const formData = new FormData();
    formData.append('file', new File(['x'], 'x.txt'));

    await request('/api/v1/upload', 'POST', formData);

    const [, options] = fetchMock.mock.calls[0];
    expect(options.body).toBe(formData);
    expect(options.headers['Content-Type']).toBeUndefined();
  });

  it('request() returns undefined for a 204 No Content response without parsing JSON', async () => {
    const jsonSpy = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 204, headers: new Headers(), json: jsonSpy })
    );

    const result = await request('/api/v1/things/1', 'DELETE');

    expect(result).toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('request() throws HttpClientError with the backend detail on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers(),
        json: async () => ({ detail: 'Bad input.' }),
      })
    );

    await expect(request('/api/v1/things', 'POST', {})).rejects.toThrow(HttpClientError);
    await expect(request('/api/v1/things', 'POST', {})).rejects.toThrow('Bad input.');
  });

  it('request() throws a generic HttpClientError when the network request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(request('/api/v1/things', 'GET')).rejects.toThrow(HttpClientError);
  });

  it('request() throws a friendly HttpClientError, not a raw SyntaxError, when a 200 response body is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => {
          throw new SyntaxError('Unexpected end of JSON input');
        },
      })
    );

    await expect(request('/api/v1/things', 'GET')).rejects.toThrow(HttpClientError);
    await expect(request('/api/v1/things', 'GET')).rejects.not.toThrow(SyntaxError);
  });

  it('getCurrentCorrelationId() reflects the X-Correlation-Id header from the most recent response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'X-Correlation-Id': 'corr-123' }),
        json: async () => ({}),
      })
    );

    await request('/api/v1/things', 'GET');

    expect(getCurrentCorrelationId()).toBe('corr-123');
  });

  it('getCurrentCorrelationId() keeps the prior value when a later response has no header', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'X-Correlation-Id': 'corr-first' }),
        json: async () => ({}),
      })
    );
    await request('/api/v1/things', 'GET');
    expect(getCurrentCorrelationId()).toBe('corr-first');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers(), json: async () => ({}) })
    );
    await request('/api/v1/things', 'GET');

    expect(getCurrentCorrelationId()).toBe('corr-first');
  });

  it('updates the correlation-ID store even on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'X-Correlation-Id': 'corr-on-error' }),
        json: async () => ({ detail: 'Server error.' }),
      })
    );

    await expect(request('/api/v1/things', 'GET')).rejects.toThrow();

    expect(getCurrentCorrelationId()).toBe('corr-on-error');
  });
});
