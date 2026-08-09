import { useDomain } from '../../context/DomainContext';
import { TopicAssignment } from '../../types';

export const useAssignments = () => {
  const { courses, user, isLoading, awardPoints } = useDomain();

  const assignments: TopicAssignment[] = courses.flatMap((c) =>
    c.modules.flatMap((m) => m.lessons.flatMap((l) => (l.assignment ? [l.assignment] : [])))
  );

  return {
    assignments,
    userLanguage: user?.language ?? 'en',
    awardPoints,
    isLoading,
  };
};
