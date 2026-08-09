import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GroupStudyView } from '@/src/features/GroupStudy/GroupStudyView';
import { useGroupStudy } from '@/src/features/GroupStudy/useGroupStudy';
import { StudyGroupRoom } from '@/src/types';

vi.mock('@/src/features/GroupStudy/useGroupStudy');

const room: StudyGroupRoom = {
  id: 'room_1',
  name: 'Quantum Physics Enthusiasts',
  courseTitle: 'Quantum Computing',
  hostName: 'Alex Rivera',
  activeCount: 4,
  currentLessonTitle: 'Superposition and Bloch Sphere',
  currentSentenceText: 'A qubit can exist in a superposition of states.',
  isSyncPlaying: true,
  members: [{ name: 'Alex Rivera', avatar: '', isHost: true }],
  chatMessages: [{ id: 'msg_1', sender: 'Alex Rivera (You)', text: 'Hi everyone!', timestamp: '10:00 AM' }],
  whiteboardElements: [],
};

describe('GroupStudyView', () => {
  beforeEach(() => {
    vi.mocked(useGroupStudy).mockReturnValue({ rooms: [room], userLanguage: 'en', isLoading: false });
  });

  it('renders the group study rooms heading', () => {
    render(<GroupStudyView />);
    expect(screen.getByText('Synchronous Group Study Rooms')).toBeInTheDocument();
  });

  it('renders nothing while loading', () => {
    vi.mocked(useGroupStudy).mockReturnValue({ rooms: [], userLanguage: 'en', isLoading: true });
    const { container } = render(<GroupStudyView />);
    expect(container).toBeEmptyDOMElement();
  });
});
