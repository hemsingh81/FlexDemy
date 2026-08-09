// The only service that talks to a real network endpoint today (the rest of services/
// still resolve from mock data -- see ARCHITECTURE-SPINE.md Deferred: backend API contract).
// Base URL is configurable via VITE_API_BASE_URL; defaults to the Docker Compose `api`
// service's published port (8080). Running the backend locally via `dotnet run` instead
// (port 5144 by default) needs a .env.local override -- see .env.example.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export class AuthError extends Error {}

const post = async (path: string, body: unknown): Promise<AuthUser> => {
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

  return response.json();
};

export const login = (identifier: string, password: string): Promise<AuthUser> =>
  post('/api/v1/auth/login', { identifier, password });

export const register = (
  firstName: string,
  lastName: string,
  identifier: string,
  password: string
): Promise<AuthUser> => post('/api/v1/auth/register', { firstName, lastName, identifier, password });
