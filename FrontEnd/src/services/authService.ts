// The only service that talks to a real network endpoint today (the rest of services/
// still resolve from mock data -- see ARCHITECTURE-SPINE.md Deferred: backend API contract).
// Base URL is configurable via VITE_API_BASE_URL; defaults to the Docker Compose `api`
// service's published port (8080). Running the backend locally via `dotnet run` instead
// (port 5144 by default) needs a .env.local override -- see .env.example.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';

// Unassigned/PendingTutor/RejectedTutor are the profile-completion funnel states a freshly
// registered user now passes through (App.tsx's post-auth role gate) before landing on a
// terminal Student/Tutor role (or Support/Master, never self-registered).
export type UserRole = 'Master' | 'Support' | 'Tutor' | 'Student' | 'Unassigned' | 'PendingTutor' | 'RejectedTutor';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}

export class AuthError extends Error {}

// sessionStorage (not localStorage): persists across a same-tab refresh -- fixing "don't log
// me out on refresh" -- without silently upgrading into a "remembered forever across browser
// restarts" login, which is a bigger security posture change nobody asked for. The in-memory
// `currentToken` below stays the fast-path read every existing getToken() caller already uses;
// sessionStorage is just where it's mirrored so it survives a reload.
const TOKEN_STORAGE_KEY = 'flexdemy_auth_token';

let currentToken: string | null = null;

const persistToken = (token: string): void => {
  currentToken = token;
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch (e) {
    // sessionStorage unavailable (private browsing, disabled storage, etc.) -- the in-memory
    // token still works for the rest of this tab's lifetime, it just won't survive a refresh.
  }
};

// Rehydrates the in-memory token from sessionStorage. Called once at module load (below) so
// getToken() returns the persisted token immediately -- before App.tsx's explicit session
// check even starts -- and is also exported so callers/tests can force a re-read.
export const initializeFromStorage = (): void => {
  try {
    currentToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (e) {
    currentToken = null;
  }
};

initializeFromStorage();

export const getToken = (): string | null => currentToken;

// Clears both the in-memory token and its persisted copy. Callers should invoke this whenever
// they sign the user out (Navbar's onSignOut, the profile-completion funnel pages' onSignOut,
// or a failed session-restore check) -- toggling isAuthenticated back to false alone leaves the
// old token sitting in sessionStorage, which would just re-authenticate on the next refresh.
export const logout = (): void => {
  currentToken = null;
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (e) {
    // ignore -- nothing to clear
  }
};

const post = async (path: string, body: unknown): Promise<AuthResult> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new AuthError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new AuthError(problem?.detail || 'Something went wrong. Please try again.');
  }

  const { user, token } = await response.json();
  persistToken(token);
  return { user, token };
};

export const login = (identifier: string, password: string): Promise<AuthResult> =>
  post('/api/v1/auth/login', { identifier, password });

export const register = (
  firstName: string,
  lastName: string,
  identifier: string,
  password: string
): Promise<AuthResult> => post('/api/v1/auth/register', { firstName, lastName, identifier, password });

// Validates a persisted token against the backend (GET /api/v1/auth/me, [Authorize]) and
// rehydrates the current user on page load/refresh. Returns null for "no session" (no token
// in-memory yet, or the backend says the token is expired/invalid via 401) so App.tsx's
// bootstrap can fall through to the normal logged-out state; throws AuthError for a genuine
// session-check failure (network unreachable, unexpected server error) so that case isn't
// silently treated the same as "never logged in".
export const getCurrentUser = async (): Promise<AuthUser | null> => {
  if (!currentToken) return null;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${currentToken}` },
    });
  } catch (e) {
    throw new AuthError('Could not reach the server. Please try again.');
  }

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new AuthError('Something went wrong. Please try again.');
  }

  return response.json();
};
