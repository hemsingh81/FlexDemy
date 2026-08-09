// Master-only Support-account creation (plan §4), plus the "all Support/Tutor users" list +
// activate/deactivate screens (BackEnd AdminUsersController). Same real-backend `fetch`
// pattern as services/authService.ts -- see that file's header comment for the base-URL
// rationale.
import { getToken } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';

// Mirrors BackEnd FlexDemy.Application/Users/UserDto.cs exactly -- used for both the Support
// and Tutor "all users" lists (same shape, just filtered server-side by role).
export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

// Kept as an alias -- CreateSupportUserResponse predates the generic AdminUser type and this
// avoids a churny rename at every call site.
export type SupportUser = AdminUser;

export interface CreateSupportUserRequest {
  firstName: string;
  lastName: string;
  identifier: string;
}

// TemporaryPassword is the plaintext -- this response is the only place it's ever visible;
// Master relays it out-of-band (BackEnd CreateSupportUserResponse). Never stored or logged.
export interface CreateSupportUserResponse {
  user: SupportUser;
  temporaryPassword: string;
}

// Mirrors BackEnd FlexDemy.Application/Users/UserDto.cs's UpdateUserDetailsRequest. Email
// doubles as the login identifier -- changing it changes what the user logs in with going
// forward, which is expected/intended for an admin edit.
export interface UpdateUserDetailsRequest {
  firstName: string;
  lastName: string;
  email: string;
}

export class AdminUsersError extends Error {}

const request = async <T>(path: string, method: 'GET' | 'POST' | 'PUT', body?: unknown): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (e) {
    throw new AdminUsersError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new AdminUsersError(problem?.detail || 'Something went wrong. Please try again.');
  }

  return response.json();
};

// POST /api/v1/admin/users/support -- FeatureKeys.AdminUsersCreate (Master only).
export const createSupportUser = (data: CreateSupportUserRequest): Promise<CreateSupportUserResponse> =>
  request<CreateSupportUserResponse>('/api/v1/admin/users/support', 'POST', data);

// GET /api/v1/admin/users/support -- every Support account, active and inactive alike.
// FeatureKeys.AdminUsersCreate (Master only), same policy as creating one.
export const getSupportUsers = (): Promise<AdminUser[]> => request<AdminUser[]>('/api/v1/admin/users/support', 'GET');

// GET /api/v1/admin/users/tutors -- every approved (Role=Tutor) account, active and inactive
// alike. FeatureKeys.TutorApprove (Master + Support).
export const getTutors = (): Promise<AdminUser[]> => request<AdminUser[]>('/api/v1/admin/users/tutors', 'GET');

// PUT /api/v1/admin/users/{id}/status -- bare [Authorize] server-side; the backend checks the
// caller against the policy that matches the TARGET's role (Support target -> AdminUsersCreate,
// Tutor target -> TutorApprove), not the caller's own role, so a 403 here is a real possibility
// from the frontend's point of view even though today's UI only ever calls this from a screen
// the caller could already see.
export const setUserActiveStatus = (userId: string, isActive: boolean): Promise<AdminUser> =>
  request<AdminUser>(`/api/v1/admin/users/${userId}/status`, 'PUT', { isActive });

// PUT /api/v1/admin/users/{id}/details -- bare [Authorize] server-side, same differentiated
// per-target-role check as /status, but only wired to a policy for Support targets today
// (AdminUsersController.UpdateUserDetails). A 403/404/409 here is a real possibility from the
// frontend's point of view -- 409 specifically means the new email is already taken by another
// account.
export const updateSupportUserDetails = (userId: string, data: UpdateUserDetailsRequest): Promise<AdminUser> =>
  request<AdminUser>(`/api/v1/admin/users/${userId}/details`, 'PUT', data);
