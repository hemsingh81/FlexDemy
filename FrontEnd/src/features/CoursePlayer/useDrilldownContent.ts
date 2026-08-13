import { useEffect, useState } from 'react';
import type { DrillLevelData } from '../../types';

// Story 3.1/Task 3: extends the existing DrillLevelData shape (level/title/subtitle/content/
// keyPoints/mathFormulas?/examples) with the one new field this story adds -- AC#3's tutor-
// override display.
export type DrilldownLevel = DrillLevelData & { isOverridden: boolean };

interface UseDrilldownContentResult {
  data: DrilldownLevel[] | null;
  isLoading: boolean;
  error: string | null;
  unlockedLevel: number;
  revealNextLevel: () => void;
}

const MAX_LEVEL = 5;

const makeLevel = (level: number, isOverridden = false): DrilldownLevel => ({
  level,
  title: `Level ${level}`,
  subtitle: isOverridden ? 'Tutor-edited explanation' : `Depth ${level} of ${MAX_LEVEL}`,
  content: isOverridden
    ? 'A wave carries energy from one place to another without carrying matter along with it -- think of a stadium wave, where each seat only moves up and down.'
    : `At depth ${level}, a wave is described in progressively more rigorous terms, building on the level before it.`,
  keyPoints: [`Key point for level ${level}`, 'Energy transfer without matter transfer'],
  mathFormulas: level >= 2 ? ['v = f\\lambda'] : undefined,
  examples: [
    {
      id: `example_${level}_1`,
      title: `Worked example (Level ${level})`,
      problem: 'Given wave speed v and frequency f, find wavelength.',
      stepByStepSolution: ['Step 1: Start from v = f\\lambda.', 'Step 2: Solve for \\lambda = v / f.'],
      finalAnswer: '\\lambda = v / f',
      difficulty: level <= 2 ? 'Easy' : level <= 4 ? 'Medium' : 'Hard',
    },
  ],
  isOverridden,
});

// Mock fixture keyed by real Topic/Subtopic node id (Story 3.1's playerContent.ts fixture) -- one
// node's set is fully AI-generated (no override), the other has Level 3 tutor-overridden, so
// AC#3's override display is exercisable without any real backend.
// [ASSUMPTION: exact mock content text is a placeholder -- Story 3.5 replaces all of it with real
// AI output; this fixture only needs to cover the structural cases (locked/unlocked, overridden/
// not), not realistic pedagogical content.]
const MOCK_LEVELS: Record<string, DrilldownLevel[]> = {
  subtopic_1: [1, 2, 3, 4, 5].map((level) => makeLevel(level)),
  topic_2: [1, 2, 3, 4, 5].map((level) => makeLevel(level, level === 3)),
};

// Story 3.1/Task 3: stable (courseId, nodeId) hook interface -- Phase B (Story 3.5) swaps the mock
// body for real API calls without any component consuming this hook needing to change.
export const useDrilldownContent = (courseId: string, nodeId: string): UseDrilldownContentResult => {
  const [data, setData] = useState<DrilldownLevel[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [unlockedLevel, setUnlockedLevel] = useState(1);

  useEffect(() => {
    setIsLoading(true);
    setUnlockedLevel(1);
    // Mirrors DrilldownPanel.tsx's own pre-existing mock-async convention (a short setTimeout),
    // not a real network call.
    const timer = setTimeout(() => {
      setData(MOCK_LEVELS[nodeId] ?? null);
      setIsLoading(false);
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, nodeId]);

  // The only mechanism that advances unlockedLevel -- selecting an already-unlocked level via the
  // tab UI never changes it (AC#1: Level N+1 never shows before Level N is expanded).
  const revealNextLevel = () => {
    setUnlockedLevel((prev) => Math.min(prev + 1, MAX_LEVEL));
  };

  return { data, isLoading, error: null, unlockedLevel, revealNextLevel };
};
