import { useEffect, useState } from 'react';
import { useDomain } from '../../context/DomainContext';
import { LeaderboardUser } from '../../types';
import * as userService from '../../services/userService';

export const useProgressAndCertificate = () => {
  const { user, courses, isLoading: isDomainLoading } = useDomain();
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    userService.getLeaderboard().then((data) => {
      if (cancelled) return;
      setLeaderboard(data);
      setIsLeaderboardLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const userLanguage = user?.language ?? 'en';
  const isLoading = isDomainLoading || isLeaderboardLoading;

  return { user, courses, leaderboard, userLanguage, isLoading };
};
