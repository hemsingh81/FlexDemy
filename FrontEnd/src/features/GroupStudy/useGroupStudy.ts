import { StudyGroupRoom } from '../../types';
import * as groupStudyService from '../../services/groupStudyService';
import { useAsync } from '../../hooks/useAsync';

export const useGroupStudy = () => {
  const { data: rooms, isLoading } = useAsync<StudyGroupRoom[]>(() => groupStudyService.getStudyRooms(), [], []);

  return { rooms, isLoading };
};
