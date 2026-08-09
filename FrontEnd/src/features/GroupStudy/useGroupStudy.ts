import { useEffect, useState } from 'react';
import { StudyGroupRoom } from '../../types';
import * as groupStudyService from '../../services/groupStudyService';
import { useDomain } from '../../context/DomainContext';

export const useGroupStudy = () => {
  const { user } = useDomain();
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

  return { rooms, userLanguage: user?.language ?? 'en', isLoading };
};
