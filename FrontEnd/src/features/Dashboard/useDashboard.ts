import { useDomain } from '../../context/DomainContext';

export const useDashboard = () => {
  const { user, courses, isLoading } = useDomain();
  return { user, courses, isLoading };
};
