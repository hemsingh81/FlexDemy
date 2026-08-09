import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useTutorHub } from '@/src/features/TutorHub/useTutorHub';
import { useDomain } from '@/src/context/DomainContext';
import * as tutorService from '@/src/services/tutorService';
import * as groupStudyService from '@/src/services/groupStudyService';
import { GroupClassRequest, PublicLiveClass, TutorCalendarSlot, UserProfile } from '@/src/types';

vi.mock('@/src/context/DomainContext');
vi.mock('@/src/services/tutorService');
vi.mock('@/src/services/groupStudyService');

const user: UserProfile = {
  id: 'usr_1',
  name: 'Hem Singh',
  email: '',
  avatar: 'avatar.png',
  role: 'Student',
  streakDays: 4,
  totalPoints: 250,
  preferredVoice: '',
  ttsRate: 1,
  ttsPitch: 1,
  isDarkMode: false,
  progress: {},
};

const slot: TutorCalendarSlot = {
  id: 'slot_1',
  tutorId: 'tutor_1',
  tutorName: 'Dr. Elena Rostova',
  tutorAvatar: '',
  date: '2026-08-10',
  startTime: '02:00 PM',
  endTime: '03:00 PM',
  durationMinutes: 60,
  isBooked: false,
  sessionType: 'one_on_one',
  ratePerMinute: 1.5,
  topic: 'Quantum Vectors',
};

const groupRequest: GroupClassRequest = {
  id: 'req_1',
  topic: 'Gauss Law',
  courseTitle: 'Physics 101',
  requestedByStudentId: 'usr_2',
  requestedByStudentName: 'Sam',
  studentPool: [],
  status: 'pending',
  ratePerMinute: 0.9,
  maxParticipants: 5,
};

const publicClass: PublicLiveClass = {
  id: 'pub_1',
  title: 'Masterclass',
  description: 'desc',
  tutorName: 'Dr. Elena Rostova',
  tutorAvatar: '',
  tutorRole: 'Verified FlexDemy Educator',
  scheduledDate: '2026-08-11',
  scheduledTime: '04:00 PM',
  durationMinutes: 60,
  pricePerMinute: 0.5,
  flatPrice: 25,
  subscribers: [],
  status: 'upcoming',
  subject: 'physics',
};

describe('useTutorHub', () => {
  beforeEach(() => {
    vi.mocked(useDomain).mockReturnValue({
      user,
      courses: [],
      isLoading: false,
      ensureEnrolled: vi.fn(),
      updateUser: vi.fn(),
      awardPoints: vi.fn(),
      completeLesson: vi.fn(),
      addCourse: vi.fn(),
      rolePermissions: null,
      refreshRolePermissions: vi.fn(),
    });
    vi.mocked(tutorService.getTutorSlots).mockResolvedValue([slot]);
    vi.mocked(groupStudyService.getGroupRequests).mockResolvedValue([groupRequest]);
    vi.mocked(groupStudyService.getPublicClasses).mockResolvedValue([publicClass]);
  });

  it('starts loading and loads tutor slots, group requests, and public classes from the services', async () => {
    const { result } = renderHook(() => useTutorHub());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.tutorSlots).toEqual([slot]);
    expect(result.current.groupRequests).toEqual([groupRequest]);
    expect(result.current.publicClasses).toEqual([publicClass]);
    expect(tutorService.getTutorSlots).toHaveBeenCalled();
    expect(groupStudyService.getGroupRequests).toHaveBeenCalled();
    expect(groupStudyService.getPublicClasses).toHaveBeenCalled();
  });

  it('bookSlot calls tutorService.bookSlot with the current user and updates tutorSlots with the result', async () => {
    const bookedSlots = [{ ...slot, isBooked: true, bookedByStudentId: user.id, bookedByStudentName: user.name }];
    vi.mocked(tutorService.bookSlot).mockResolvedValue(bookedSlots);

    const { result } = renderHook(() => useTutorHub());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.bookSlot('slot_1', 'Need help with vectors');
    });

    expect(tutorService.bookSlot).toHaveBeenCalledWith('slot_1', user.id, user.name, 'Need help with vectors');
    await waitFor(() => expect(result.current.tutorSlots).toEqual(bookedSlots));
  });

  it('requestGroupClass builds the request shape and updates groupRequests with the result', async () => {
    const newRequest: GroupClassRequest = {
      id: 'req_new',
      topic: 'Capacitors',
      courseTitle: 'Physics 101',
      requestedByStudentId: user.id,
      requestedByStudentName: user.name,
      studentPool: [{ studentId: user.id, studentName: user.name, avatar: user.avatar }],
      status: 'pending',
      ratePerMinute: 0.9,
      maxParticipants: 5,
    };
    vi.mocked(groupStudyService.addGroupRequest).mockResolvedValue([newRequest, groupRequest]);

    const { result } = renderHook(() => useTutorHub());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.requestGroupClass('Capacitors', 'Physics 101');
    });

    expect(groupStudyService.addGroupRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'Capacitors',
        courseTitle: 'Physics 101',
        requestedByStudentId: user.id,
        requestedByStudentName: user.name,
        ratePerMinute: 0.9,
        maxParticipants: 5,
        status: 'pending',
        studentPool: [{ studentId: user.id, studentName: user.name, avatar: user.avatar }],
      })
    );
    await waitFor(() => expect(result.current.groupRequests).toEqual([newRequest, groupRequest]));
  });
});
