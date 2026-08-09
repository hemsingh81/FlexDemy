import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGroupStudy } from '@/src/features/GroupStudy/useGroupStudy';
import { useDomain } from '@/src/context/DomainContext';
import * as groupStudyService from '@/src/services/groupStudyService';
import { StudyGroupRoom, UserProfile } from '@/src/types';

vi.mock('@/src/context/DomainContext');
vi.mock('@/src/services/groupStudyService');

const room: StudyGroupRoom = {
  id: 'room_1',
  name: 'Quantum Physics Enthusiasts',
  courseTitle: 'Quantum Computing',
  hostName: 'Hem Singh',
  activeCount: 4,
  currentLessonTitle: 'Superposition and Bloch Sphere',
  currentSentenceText: 'A qubit can exist in a superposition of states.',
  isSyncPlaying: true,
  members: [{ name: 'Hem Singh', avatar: '', isHost: true }],
  chatMessages: [],
  whiteboardElements: [],
};

const user: UserProfile = {
  id: 'usr_1',
  name: 'Hem Singh',
  email: '',
  avatar: '',
  role: 'student',
  streakDays: 4,
  totalPoints: 250,
  preferredVoice: '',
  ttsRate: 1,
  ttsPitch: 1,
  isDarkMode: false,
  language: 'fr',
  progress: {},
};

describe('useGroupStudy', () => {
  it('loads rooms from groupStudyService and exposes isLoading', async () => {
    vi.mocked(useDomain).mockReturnValue({
      user,
      courses: [],
      isLoading: false,
      ensureEnrolled: vi.fn(),
      updateUser: vi.fn(),
      awardPoints: vi.fn(),
      completeLesson: vi.fn(),
      addCourse: vi.fn(),
    });
    vi.mocked(groupStudyService.getStudyRooms).mockResolvedValue([room]);

    const { result } = renderHook(() => useGroupStudy());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.rooms).toEqual([]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.rooms).toEqual([room]);
    expect(result.current.userLanguage).toBe('fr');
    expect(groupStudyService.getStudyRooms).toHaveBeenCalledTimes(1);
  });

  it('falls back to "en" when no user is present yet', async () => {
    vi.mocked(useDomain).mockReturnValue({
      user: null,
      courses: [],
      isLoading: true,
      ensureEnrolled: vi.fn(),
      updateUser: vi.fn(),
      awardPoints: vi.fn(),
      completeLesson: vi.fn(),
      addCourse: vi.fn(),
    });
    vi.mocked(groupStudyService.getStudyRooms).mockResolvedValue([]);

    const { result } = renderHook(() => useGroupStudy());

    expect(result.current.userLanguage).toBe('en');
  });
});
