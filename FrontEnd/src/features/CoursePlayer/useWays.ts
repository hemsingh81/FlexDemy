import { useEffect, useState } from 'react';
import type { ExampleItem } from '../../types';

// Story 3.2/Task 1: FR18's own "freely cyclable in any order" rule -- deliberately no
// locking/gating here, unlike Story 3.1's useDrilldownContent#unlockedLevel. Don't copy that
// hook's sequential-reveal discipline into this one.
export interface WayData {
  explanation: string;
  example: ExampleItem;
  isOverridden: boolean;
}

interface UseWaysResult {
  ways: WayData[];
  isLoading: boolean;
  error: string | null;
  activeWayIndex: number;
  setActiveWayIndex: (index: number) => void;
}

const makeWay = (index: number, isOverridden = false): WayData => ({
  explanation: isOverridden
    ? 'A tutor-written alternative: picture a wave as a stadium crowd doing "the wave" -- each seat only moves up and down, but the wave itself travels all the way around.'
    : `Way ${index + 1}: a distinct alternative explanation of the same idea, using a different angle or analogy than Way ${((index + 4) % 5) + 1}.`,
  example: {
    id: `way_example_${index}`,
    title: `Worked example (Way ${index + 1})`,
    problem: 'Given wave speed v and frequency f, find wavelength.',
    stepByStepSolution: ['Step 1: Start from v = f\\lambda.', 'Step 2: Solve for \\lambda = v / f.'],
    finalAnswer: '\\lambda = v / f',
    difficulty: index % 2 === 0 ? 'Easy' : 'Medium',
  },
  isOverridden,
});

// Mock fixture keyed by the same real Topic/Subtopic node ids Story 3.1's useDrilldownContent
// fixture uses -- both hooks key off one shared node, so a single mock node has both Drill-Down
// and Ways content, matching this story's own Previous Story Intelligence guidance.
const MOCK_WAYS: Record<string, WayData[]> = {
  subtopic_1: [0, 1, 2, 3, 4].map((i) => makeWay(i)),
  topic_2: [0, 1, 2, 3, 4].map((i) => makeWay(i, i === 1)),
};

// Story 3.2/Task 1: same (courseId, nodeId) signature Story 3.1's useDrilldownContent
// established -- Phase B (Story 3.5) swaps the mock body for real API calls without any
// component consuming this hook needing to change.
export const useWays = (courseId: string, nodeId: string): UseWaysResult => {
  const [ways, setWays] = useState<WayData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeWayIndex, setActiveWayIndex] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    setActiveWayIndex(0);
    // Mirrors useDrilldownContent's own mock-async convention (a short setTimeout), not a real
    // network call.
    const timer = setTimeout(() => {
      setWays(MOCK_WAYS[nodeId] ?? []);
      setIsLoading(false);
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, nodeId]);

  return { ways, isLoading, error: null, activeWayIndex, setActiveWayIndex };
};
