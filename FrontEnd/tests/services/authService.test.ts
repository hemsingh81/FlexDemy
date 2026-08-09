import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, register, AuthError } from '@/src/services/authService';

describe('authService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('login posts identifier/password and returns the user on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'usr_1', email: 'hemsingh81@gmail.com', firstName: 'Hem', lastName: 'Singh' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await login('hemsingh81@gmail.com', 'Password@123');

    expect(result.email).toBe('hemsingh81@gmail.com');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/auth/login');
    expect(JSON.parse(options.body)).toEqual({ identifier: 'hemsingh81@gmail.com', password: 'Password@123' });
  });

  it('login throws AuthError with the backend detail on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'Incorrect email/phone or password.' }),
    }));

    await expect(login('hemsingh81@gmail.com', 'wrong')).rejects.toThrow(AuthError);
    await expect(login('hemsingh81@gmail.com', 'wrong')).rejects.toThrow('Incorrect email/phone or password.');
  });

  it('login throws a generic AuthError when the network request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(login('hemsingh81@gmail.com', 'Password@123')).rejects.toThrow(AuthError);
  });

  it('register posts all fields to /api/v1/auth/register', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'usr_2', email: 'new@x.com', firstName: 'A', lastName: 'B' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await register('A', 'B', 'new@x.com', 'password123');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/auth/register');
    expect(JSON.parse(options.body)).toEqual({
      firstName: 'A',
      lastName: 'B',
      identifier: 'new@x.com',
      password: 'password123',
    });
  });
});
