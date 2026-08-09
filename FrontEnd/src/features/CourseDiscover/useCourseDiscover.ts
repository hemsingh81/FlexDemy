import { useDomain } from '../../context/DomainContext';

export const useCourseDiscover = () => {
  const { courses, user, isLoading } = useDomain();
  return { courses, userLanguage: user?.language, isLoading };
};
