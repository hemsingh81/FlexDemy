// AD-7: the single shared low-level request helper every services/* HTTP call goes through --
// generalized from courseDraftService.ts's own write<T>() -- so correlation-ID capture (FR-23)
// happens in exactly one place instead of silently working for some services and not others.
import { getToken } from './authService';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';

// Story 8.3: `status` lets a caller distinguish e.g. a 409 Conflict (delete-in-use) from any
// other failure without parsing the message text -- 0 for a network failure (no real HTTP
// response ever came back), matching every existing catch site's `e instanceof HttpClientError`
// check (they only ever read `.message` today, so this is purely additive).
export class HttpClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Module-level, not React state -- this value doesn't drive rendering (AD-7).
let currentCorrelationId: string | null = null;

export const getCurrentCorrelationId = (): string | null => currentCorrelationId;

export interface RequestOptions {
  // Code-review patch: for genuinely [AllowAnonymous] backend routes only (e.g.
  // GET /settings/effective-fonts) -- omits the Authorization header entirely rather than
  // sending "Bearer null", which the server harmlessly ignores today but reads as misleading
  // evidence (to a future refactor) that the route actually requires a token.
  skipAuth?: boolean;
}

export const request = async <T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
  options?: RequestOptions
): Promise<T> => {
  const isFormData = body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body === undefined || isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options?.skipAuth ? {} : { Authorization: `Bearer ${getToken()}` }),
      },
      // FormData sets its own multipart boundary -- fetch handles that itself, so the body is
      // passed through untouched rather than JSON.stringify'd.
      body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
    });
  } catch (e) {
    throw new HttpClientError('Could not reach the server. Please try again.', 0);
  }

  // Read before the ok-check below so a failed request's correlation ID is captured too --
  // that's exactly the case errorsService.ts (Story 4.4) most needs it for.
  const correlationId = response.headers.get('X-Correlation-Id');
  if (correlationId) currentCorrelationId = correlationId;

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new HttpClientError(problem?.detail || 'Something went wrong. Please try again.', response.status);
  }

  // 204 No Content has no JSON body -- same handling every existing services/* helper uses.
  if (response.status === 204) return undefined as T;

  // Code-review patch: a malformed or empty-but-200 body previously threw a raw SyntaxError out
  // of response.json() here -- every other failure path in this function throws the same
  // friendly HttpClientError, so this one shouldn't be the odd one out.
  try {
    return await response.json();
  } catch (e) {
    throw new HttpClientError('Something went wrong. Please try again.', response.status);
  }
};

// Story 8.3, Task 2: the first frontend consumer of binary content -- request()'s own body is
// always response.json(), unsuitable here. Shares the same fetch/auth/correlation-ID plumbing so
// AD-7's "one shared low-level request helper" rule still covers this path (a bypassing one-off
// fetch call would silently skip the X-Correlation-Id capture above).
export const requestBlob = async (path: string): Promise<Blob> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  } catch (e) {
    throw new HttpClientError('Could not reach the server. Please try again.', 0);
  }

  const correlationId = response.headers.get('X-Correlation-Id');
  if (correlationId) currentCorrelationId = correlationId;

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new HttpClientError(problem?.detail || 'Something went wrong. Please try again.', response.status);
  }

  return response.blob();
};
