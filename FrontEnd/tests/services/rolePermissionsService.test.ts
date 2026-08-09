import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authService from '@/src/services/authService';
import { getMine, getMatrix, updateMatrix, RolePermissionsError } from '@/src/services/rolePermissionsService';

describe('rolePermissionsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authService, 'getToken').mockReturnValue('fake-jwt');
  });

  it('getMine GETs /api/v1/role-permissions/mine with a bearer token', async () => {
    const permissions = { dashboard: true, discover: true, admin: false };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => permissions });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getMine();

    expect(result).toEqual(permissions);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/role-permissions/mine');
    expect(options.method).toBe('GET');
    expect(options.headers.Authorization).toBe('Bearer fake-jwt');
  });

  it('getMatrix GETs /api/v1/role-permissions', async () => {
    const matrix = [{ role: 'Student', featureKey: 'dashboard', isVisible: true }];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => matrix });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getMatrix();

    expect(result).toEqual(matrix);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/role-permissions');
    expect(options.method).toBe('GET');
  });

  it('updateMatrix PUTs the full update list and resolves with no return value on 204', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const updates = [
      { role: 'Student', featureKey: 'dashboard', isVisible: true },
      { role: 'Master', featureKey: 'admin', isVisible: true },
    ];
    await expect(updateMatrix(updates)).resolves.toBeUndefined();

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/role-permissions');
    expect(options.method).toBe('PUT');
    expect(options.headers.Authorization).toBe('Bearer fake-jwt');
    expect(JSON.parse(options.body)).toEqual(updates);
  });

  it('throws RolePermissionsError with the backend detail on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: 'Forbidden.' }) })
    );

    await expect(getMine()).rejects.toThrow(RolePermissionsError);
    await expect(getMine()).rejects.toThrow('Forbidden.');
  });

  it('throws a generic RolePermissionsError when the network request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(getMine()).rejects.toThrow(RolePermissionsError);
  });
});
