// Dynamic role-permission matrix (plan §3). Same real-backend `fetch` pattern as
// services/authService.ts -- see that file's header comment for the base-URL rationale.
// GetMine is any authenticated role; the full matrix GET/PUT is Master-only
// (FeatureKeys.AdminPermissionsManage), enforced server-side -- a non-Master caller gets a
// 403 from the backend the same way any other policy-gated write does.
import { getToken } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';

// One row of the admin checkbox matrix (BackEnd RolePermissionRowDto). Role is a plain
// string (Student/Tutor/Support/Master -- the 4 "managed" roles; Unassigned/PendingTutor/
// RejectedTutor never appear here, RolePermissionService.ManagedRoles excludes them).
export interface RolePermissionRow {
  role: string;
  featureKey: string;
  isVisible: boolean;
}

export interface UpdatePermissionRequest {
  role: string;
  featureKey: string;
  isVisible: boolean;
}

export class RolePermissionsError extends Error {}

const request = async <T>(path: string, method: 'GET' | 'PUT', body?: unknown): Promise<T | undefined> => {
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
    throw new RolePermissionsError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new RolePermissionsError(problem?.detail || 'Something went wrong. Please try again.');
  }

  // PUT returns 204 No Content -- only GET responses have a JSON body to parse.
  if (response.status === 204) return undefined;
  return response.json();
};

// GET /api/v1/role-permissions/mine -- the caller's own feature-key -> visible map, read
// from their Role claim server-side (not baked into the JWT, so a permission change is
// visible on the next fetch rather than waiting out the token's lifetime).
export const getMine = (): Promise<Record<string, boolean>> =>
  request<Record<string, boolean>>('/api/v1/role-permissions/mine', 'GET') as Promise<Record<string, boolean>>;

// GET /api/v1/role-permissions -- full roles x feature-keys grid for RoleVisibilityManager.
export const getMatrix = (): Promise<RolePermissionRow[]> =>
  request<RolePermissionRow[]>('/api/v1/role-permissions', 'GET') as Promise<RolePermissionRow[]>;

// PUT /api/v1/role-permissions -- one bulk upsert call for every changed cell.
export const updateMatrix = async (updates: UpdatePermissionRequest[]): Promise<void> => {
  await request('/api/v1/role-permissions', 'PUT', updates);
};
