import { useEffect, useState } from 'react';
import { StudyGroupRoom } from '../../types';
import * as groupStudyService from '../../services/groupStudyService';

export const useGroupStudy = () => {
  const [rooms, setRooms] = useState<StudyGroupRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    groupStudyService.getStudyRooms().then((r) => {
      if (cancelled) return;
      setRooms(r);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { rooms, isLoading };
};
