import { useDomain } from '../../context/DomainContext';

export const useCourseDiscover = () => {
  const { courses, isLoading } = useDomain();
  return { courses, isLoading };
};
