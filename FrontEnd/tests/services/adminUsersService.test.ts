import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authService from '@/src/services/authService';
import {
  createSupportUser,
  getSupportUsers,
  getTutors,
  setUserActiveStatus,
  updateSupportUserDetails,
  AdminUsersError,
} from '@/src/services/adminUsersService';

describe('adminUsersService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authService, 'getToken').mockReturnValue('fake-jwt');
  });

  it('createSupportUser POSTs to /api/v1/admin/users/support with a bearer token', async () => {
    const response = {
      user: {
        id: 'usr_support_1',
        email: 'support@flexdemy.com',
        firstName: 'Sam',
        lastName: 'Support',
        role: 'Support',
        isActive: true,
      },
      temporaryPassword: 'Tmp-8f3k2Az',
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal('fetch', fetchMock);

    const request = { firstName: 'Sam', lastName: 'Support', identifier: 'support@flexdemy.com' };
    const result = await createSupportUser(request);

    expect(result).toEqual(response);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/admin/users/support');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer fake-jwt');
    expect(JSON.parse(options.body)).toEqual(request);
  });

  it('throws AdminUsersError with the backend detail on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: 'An account with this identifier already exists.' }) })
    );

    const request = { firstName: 'Sam', lastName: 'Support', identifier: 'support@flexdemy.com' };
    await expect(createSupportUser(request)).rejects.toThrow(AdminUsersError);
    await expect(createSupportUser(request)).rejects.toThrow('An account with this identifier already exists.');
  });

  it('throws a generic AdminUsersError when the network request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(
      createSupportUser({ firstName: 'Sam', lastName: 'Support', identifier: 'support@flexdemy.com' })
    ).rejects.toThrow(AdminUsersError);
  });

  it('getSupportUsers GETs /api/v1/admin/users/support with a bearer token', async () => {
    const users = [
      { id: 'usr_support_1', email: 'support@flexdemy.com', firstName: 'Sam', lastName: 'Support', role: 'Support', isActive: true },
    ];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => users });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getSupportUsers();

    expect(result).toEqual(users);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/admin/users/support');
    expect(options.method).toBe('GET');
    expect(options.headers.Authorization).toBe('Bearer fake-jwt');
  });

  it('getTutors GETs /api/v1/admin/users/tutors with a bearer token', async () => {
    const users = [
      { id: 'usr_tutor_1', email: 'tutor@flexdemy.com', firstName: 'Tara', lastName: 'Tutor', role: 'Tutor', isActive: false },
    ];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => users });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getTutors();

    expect(result).toEqual(users);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/admin/users/tutors');
    expect(options.method).toBe('GET');
  });

  it('setUserActiveStatus PUTs /api/v1/admin/users/{id}/status with the new isActive value', async () => {
    const updated = { id: 'usr_support_1', email: 'support@flexdemy.com', firstName: 'Sam', lastName: 'Support', role: 'Support', isActive: false };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => updated });
    vi.stubGlobal('fetch', fetchMock);

    const result = await setUserActiveStatus('usr_support_1', false);

    expect(result).toEqual(updated);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/admin/users/usr_support_1/status');
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({ isActive: false });
  });

  it('setUserActiveStatus surfaces a 403 from the backend as an AdminUsersError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: 'Forbidden.' }) })
    );

    await expect(setUserActiveStatus('usr_tutor_1', true)).rejects.toThrow(AdminUsersError);
  });

  it('updateSupportUserDetails PUTs /api/v1/admin/users/{id}/details with the new field values', async () => {
    const updated = {
      id: 'usr_support_1',
      email: 'sam.new@flexdemy.com',
      firstName: 'Samantha',
      lastName: 'Supportworth',
      role: 'Support',
      isActive: true,
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => updated });
    vi.stubGlobal('fetch', fetchMock);

    const request = { firstName: 'Samantha', lastName: 'Supportworth', email: 'sam.new@flexdemy.com' };
    const result = await updateSupportUserDetails('usr_support_1', request);

    expect(result).toEqual(updated);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/admin/users/usr_support_1/details');
    expect(options.method).toBe('PUT');
    expect(options.headers.Authorization).toBe('Bearer fake-jwt');
    expect(JSON.parse(options.body)).toEqual(request);
  });

  it('updateSupportUserDetails surfaces a 409 (duplicate email) from the backend as an AdminUsersError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: "An account already exists for 'taken@x.com'." }) })
    );

    await expect(
      updateSupportUserDetails('usr_support_1', { firstName: 'Sam', lastName: 'Support', email: 'taken@x.com' })
    ).rejects.toThrow(AdminUsersError);
  });
});
