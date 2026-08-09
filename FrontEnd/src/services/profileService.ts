// Profile-completion funnel: Student profile completion (auto-approved), Tutor application
// (goes to PendingTutor for Support/Master review), and the caller's own funnel status.
// Same real-backend `fetch` pattern as services/authService.ts -- see that file's header
// comment for the base-URL rationale. All three routes are `[Authorize]` (any authenticated
// role), so every call here sends the bearer token from authService.
import { getToken, UserRole } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';

export interface StudentProfile {
  id: string;
  userId: string;
  classLevelId: string;
  boardId: string;
  countryId: string;
  stateId: string;
  cityId: string;
  subjectIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TutorProfile {
  id: string;
  userId: string;
  subjectIds: string[];
  countryId: string;
  stateId: string;
  cityId: string;
  bio: string;
  qualifications: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// RejectionReason is only populated when role is RejectedTutor (BackEnd ProfileStatusDto).
export interface ProfileStatus {
  role: UserRole;
  rejectionReason: string | null;
}

export interface CompleteStudentProfileRequest {
  classLevelId: string;
  boardId: string;
  countryId: string;
  stateId: string;
  cityId: string;
  subjectIds: string[];
}

export interface SubmitTutorApplicationRequest {
  subjectIds: string[];
  countryId: string;
  stateId: string;
  cityId: string;
  bio: string;
  qualifications: string;
}

// A pending tutor application bundled with a slice of the applicant's identity (BackEnd
// PendingTutorApplicationDto) -- consumed by features/Admin/TutorApprovals.tsx.
export interface PendingTutorApplication {
  profile: TutorProfile;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface ReviewTutorApplicationRequest {
  approve: boolean;
  rejectionReason: string | null;
}

export class ProfileError extends Error {}

const request = async <T>(path: string, method: 'GET' | 'POST', body?: unknown): Promise<T> => {
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
    throw new ProfileError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new ProfileError(problem?.detail || 'Something went wrong. Please try again.');
  }

  return response.json();
};

// POST /api/v1/profiles/student -- also the switch-to-student route for a RejectedTutor
// (the backend dispatches on the caller's current role, not on anything sent here).
export const completeStudentProfile = (data: CompleteStudentProfileRequest): Promise<StudentProfile> =>
  request('/api/v1/profiles/student', 'POST', data);

// POST /api/v1/profiles/tutor -- also the re-apply route for a RejectedTutor.
export const submitTutorApplication = (data: SubmitTutorApplicationRequest): Promise<TutorProfile> =>
  request('/api/v1/profiles/tutor', 'POST', data);

export const getMyProfileStatus = (): Promise<ProfileStatus> => request('/api/v1/profiles/me/status', 'GET');

// GET /api/v1/profiles/tutor-applications/pending -- [Authorize(Policy = FeatureKeys.TutorApprove)]
// (Support/Master only server-side; a Support caller reaching this with no other admin access
// is exactly the scenario plan §5's useAdminPanel role filtering exists for).
export const getPendingTutorApplications = (): Promise<PendingTutorApplication[]> =>
  request('/api/v1/profiles/tutor-applications/pending', 'GET');

// POST /api/v1/profiles/tutor-applications/{userId}/review -- same policy as above.
export const reviewTutorApplication = (
  userId: string,
  data: ReviewTutorApplicationRequest
): Promise<TutorProfile> => request(`/api/v1/profiles/tutor-applications/${encodeURIComponent(userId)}/review`, 'POST', data);
