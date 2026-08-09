import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authService from '@/src/services/authService';
import {
  completeStudentProfile,
  submitTutorApplication,
  getMyProfileStatus,
  getPendingTutorApplications,
  reviewTutorApplication,
  ProfileError,
} from '@/src/services/profileService';

describe('profileService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authService, 'getToken').mockReturnValue('fake-jwt');
  });

  it('completeStudentProfile POSTs to /api/v1/profiles/student with a bearer token', async () => {
    const studentProfile = {
      id: 'sp_1',
      userId: 'usr_1',
      classLevelId: 'cl_1',
      boardId: 'brd_1',
      countryId: 'ctry_1',
      stateId: 'state_1',
      cityId: 'city_1',
      subjectIds: ['sub_1'],
      createdAt: '2026-08-09T00:00:00Z',
      updatedAt: '2026-08-09T00:00:00Z',
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => studentProfile });
    vi.stubGlobal('fetch', fetchMock);

    const request = {
      classLevelId: 'cl_1',
      boardId: 'brd_1',
      countryId: 'ctry_1',
      stateId: 'state_1',
      cityId: 'city_1',
      subjectIds: ['sub_1'],
    };
    const result = await completeStudentProfile(request);

    expect(result).toEqual(studentProfile);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/profiles/student');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer fake-jwt');
    expect(JSON.parse(options.body)).toEqual(request);
  });

  it('submitTutorApplication POSTs to /api/v1/profiles/tutor', async () => {
    const tutorProfile = {
      id: 'tp_1',
      userId: 'usr_1',
      subjectIds: ['sub_1'],
      countryId: 'ctry_1',
      stateId: 'state_1',
      cityId: 'city_1',
      bio: 'Experienced tutor',
      qualifications: 'M.Sc. Physics',
      reviewedByUserId: null,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: '2026-08-09T00:00:00Z',
      updatedAt: '2026-08-09T00:00:00Z',
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => tutorProfile });
    vi.stubGlobal('fetch', fetchMock);

    const request = {
      subjectIds: ['sub_1'],
      countryId: 'ctry_1',
      stateId: 'state_1',
      cityId: 'city_1',
      bio: 'Experienced tutor',
      qualifications: 'M.Sc. Physics',
    };
    const result = await submitTutorApplication(request);

    expect(result).toEqual(tutorProfile);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/profiles/tutor');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual(request);
  });

  it('getMyProfileStatus GETs /api/v1/profiles/me/status', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ role: 'RejectedTutor', rejectionReason: 'Incomplete qualifications.' }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getMyProfileStatus();

    expect(result).toEqual({ role: 'RejectedTutor', rejectionReason: 'Incomplete qualifications.' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/profiles/me/status');
    expect(options.method).toBe('GET');
  });

  it('throws ProfileError with the backend detail on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: 'Profile already completed.' }) })
    );

    await expect(getMyProfileStatus()).rejects.toThrow(ProfileError);
    await expect(getMyProfileStatus()).rejects.toThrow('Profile already completed.');
  });

  it('throws a generic ProfileError when the network request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(getMyProfileStatus()).rejects.toThrow(ProfileError);
  });

  it('getPendingTutorApplications GETs /api/v1/profiles/tutor-applications/pending', async () => {
    const applications = [
      {
        profile: {
          id: 'tp_1',
          userId: 'usr_1',
          subjectIds: ['sub_1'],
          countryId: 'ctry_1',
          stateId: 'state_1',
          cityId: 'city_1',
          bio: 'Bio',
          qualifications: 'Quals',
          reviewedByUserId: null,
          reviewedAt: null,
          rejectionReason: null,
          createdAt: '2026-08-09T00:00:00Z',
          updatedAt: null,
        },
        userId: 'usr_1',
        firstName: 'Amara',
        lastName: 'Okafor',
        email: 'amara@flexdemy.com',
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => applications });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getPendingTutorApplications();

    expect(result).toEqual(applications);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/profiles/tutor-applications/pending');
    expect(options.method).toBe('GET');
  });

  it('reviewTutorApplication POSTs approve/rejectionReason to the review route', async () => {
    const tutorProfile = {
      id: 'tp_1',
      userId: 'usr_1',
      subjectIds: ['sub_1'],
      countryId: 'ctry_1',
      stateId: 'state_1',
      cityId: 'city_1',
      bio: 'Bio',
      qualifications: 'Quals',
      reviewedByUserId: 'usr_master',
      reviewedAt: '2026-08-09T01:00:00Z',
      rejectionReason: null,
      createdAt: '2026-08-09T00:00:00Z',
      updatedAt: '2026-08-09T01:00:00Z',
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => tutorProfile });
    vi.stubGlobal('fetch', fetchMock);

    const result = await reviewTutorApplication('usr_1', { approve: true, rejectionReason: null });

    expect(result).toEqual(tutorProfile);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/profiles/tutor-applications/usr_1/review');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ approve: true, rejectionReason: null });
  });
});
