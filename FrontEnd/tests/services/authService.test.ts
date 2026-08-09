import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  login,
  register,
  getToken,
  logout,
  initializeFromStorage,
  getCurrentUser,
  AuthError,
} from '@/src/services/authService';

const TOKEN_STORAGE_KEY = 'flexdemy_auth_token';

describe('authService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    logout();
  });

  it('login posts identifier/password and returns the user + token on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: 'usr_1', email: 'hemsingh81@gmail.com', firstName: 'Hem', lastName: 'Singh', role: 'Master' },
        token: 'fake-jwt',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await login('hemsingh81@gmail.com', 'Password@123');

    expect(result.user.email).toBe('hemsingh81@gmail.com');
    expect(result.user.role).toBe('Master');
    expect(result.token).toBe('fake-jwt');
    expect(getToken()).toBe('fake-jwt');
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
      json: async () => ({
        user: { id: 'usr_2', email: 'new@x.com', firstName: 'A', lastName: 'B', role: 'Student' },
        token: 'fake-jwt-2',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await register('A', 'B', 'new@x.com', 'password123');

    expect(result.user.role).toBe('Student');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/auth/register');
    expect(JSON.parse(options.body)).toEqual({
      firstName: 'A',
      lastName: 'B',
      identifier: 'new@x.com',
      password: 'password123',
    });
  });

  describe('token persistence (sessionStorage)', () => {
    it('login persists the token to sessionStorage under the expected key, in addition to the in-memory copy', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          user: { id: 'usr_1', email: 'hemsingh81@gmail.com', firstName: 'Hem', lastName: 'Singh', role: 'Student' },
          token: 'persisted-jwt',
        }),
      }));

      await login('hemsingh81@gmail.com', 'Password@123');

      expect(getToken()).toBe('persisted-jwt');
      expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBe('persisted-jwt');
    });

    it('initializeFromStorage rehydrates the in-memory token from a persisted sessionStorage value', () => {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, 'rehydrated-jwt');

      initializeFromStorage();

      expect(getToken()).toBe('rehydrated-jwt');
    });

    it('initializeFromStorage leaves the in-memory token null when nothing is persisted', () => {
      initializeFromStorage();

      expect(getToken()).toBeNull();
    });

    it('logout clears both the in-memory token and the persisted sessionStorage copy', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          user: { id: 'usr_1', email: 'hemsingh81@gmail.com', firstName: 'Hem', lastName: 'Singh', role: 'Student' },
          token: 'to-be-cleared-jwt',
        }),
      }));
      await login('hemsingh81@gmail.com', 'Password@123');
      expect(getToken()).toBe('to-be-cleared-jwt');

      logout();

      expect(getToken()).toBeNull();
      expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });
  });

  describe('getCurrentUser (GET /api/v1/auth/me)', () => {
    it('returns null without calling fetch when there is no token', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const result = await getCurrentUser();

      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns the current user on a successful response, sending the token as a bearer header', async () => {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, 'valid-jwt');
      initializeFromStorage();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'usr_1',
          email: 'hemsingh81@gmail.com',
          firstName: 'Hem',
          lastName: 'Singh',
          role: 'Student',
          isActive: true,
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await getCurrentUser();

      expect(result?.email).toBe('hemsingh81@gmail.com');
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/auth/me');
      expect(options.headers.Authorization).toBe('Bearer valid-jwt');
    });

    it('returns null on a 401 (expired/invalid token) -- distinguishing "no session" from a real error', async () => {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, 'stale-jwt');
      initializeFromStorage();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => null }));

      const result = await getCurrentUser();

      expect(result).toBeNull();
    });

    it('throws AuthError on a network failure', async () => {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, 'jwt');
      initializeFromStorage();
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

      await expect(getCurrentUser()).rejects.toThrow(AuthError);
    });

    it('throws AuthError on a non-401 error response', async () => {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, 'jwt');
      initializeFromStorage();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => null }));

      await expect(getCurrentUser()).rejects.toThrow(AuthError);
    });
  });
});
