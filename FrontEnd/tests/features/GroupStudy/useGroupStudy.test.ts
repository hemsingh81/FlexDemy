import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGroupStudy } from '@/src/features/GroupStudy/useGroupStudy';
import * as groupStudyService from '@/src/services/groupStudyService';
import { StudyGroupRoom } from '@/src/types';

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

describe('useGroupStudy', () => {
  it('loads rooms from groupStudyService and exposes isLoading', async () => {
    vi.mocked(groupStudyService.getStudyRooms).mockResolvedValue([room]);

    const { result } = renderHook(() => useGroupStudy());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.rooms).toEqual([]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.rooms).toEqual([room]);
    expect(groupStudyService.getStudyRooms).toHaveBeenCalledTimes(1);
  });

  it('starts loading with an empty rooms list when the fetch has not resolved yet', async () => {
    vi.mocked(groupStudyService.getStudyRooms).mockResolvedValue([]);

    const { result } = renderHook(() => useGroupStudy());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.rooms).toEqual([]);
  });
});
