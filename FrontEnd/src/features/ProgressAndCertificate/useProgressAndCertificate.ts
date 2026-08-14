import { useDomain } from '../../context/DomainContext';
import { LeaderboardUser } from '../../types';
import * as userService from '../../services/userService';
import { useAsync } from '../../hooks/useAsync';

export const useProgressAndCertificate = () => {
  const { user, courses, isLoading: isDomainLoading } = useDomain();
  const { data: leaderboard, isLoading: isLeaderboardLoading } = useAsync<LeaderboardUser[]>(
    () => userService.getLeaderboard(),
    [],
    []
  );

  const isLoading = isDomainLoading || isLeaderboardLoading;

  return { user, courses, leaderboard, isLoading };
};
