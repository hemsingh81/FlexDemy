import { useEffect, useRef, useState } from 'react';

interface UseKeywordDefinitionResult {
  activeKeyword: string | null;
  definition: string | null;
  isOverridden: boolean;
  isLoading: boolean;
  error: string | null;
  define: (keyword: string) => void;
  dismiss: () => void;
}

// Story 3.2/Task 2: a genuinely new mechanic -- confirmed by direct read of ReaderCanvas.tsx that
// no keyword/definition code exists anywhere in this codebase today. Case-insensitive lookup
// keyed by keyword string; a keyword with no fixture entry resolves to `definition: null` (not an
// error), exercising the "Definition unavailable" empty state in KeywordPopover.tsx.
const MOCK_DEFINITIONS: Record<string, { definition: string; isOverridden: boolean }> = {
  wave: {
    definition: 'A disturbance that transfers energy from one place to another without transferring matter.',
    isOverridden: false,
  },
  wavelength: {
    definition: 'A tutor-written definition: the distance from one crest of a wave to the very next crest.',
    isOverridden: true,
  },
  frequency: {
    definition: 'The number of complete wave cycles that pass a fixed point in one second, measured in hertz (Hz).',
    isOverridden: false,
  },
};

// Story 3.2/Task 2: (courseId) => { ... } -- courseId is accepted for parity with the other
// Epic 3 hooks' (courseId, ...) signature convention and because a real backend lookup (Story
// 3.7) is course-scoped, even though the mock body below doesn't need it.
export const useKeywordDefinition = (courseId: string): UseKeywordDefinitionResult => {
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);
  const [definition, setDefinition] = useState<string | null>(null);
  const [isOverridden, setIsOverridden] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const define = (keyword: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    setActiveKeyword(keyword);
    setDefinition(null);
    setIsOverridden(false);
    setIsLoading(true);

    // Mirrors useDrilldownContent's/useWays's own mock-async convention (a short setTimeout), not
    // a real network call. Only one keyword definition is ever in flight at a time (a new
    // define() call clears any pending one above), so no request-token/race guard is needed.
    timerRef.current = setTimeout(() => {
      const entry = MOCK_DEFINITIONS[keyword.toLowerCase()];
      setDefinition(entry?.definition ?? null);
      setIsOverridden(entry?.isOverridden ?? false);
      setIsLoading(false);
    }, 150);
  };

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActiveKeyword(null);
    setDefinition(null);
    setIsOverridden(false);
    setIsLoading(false);
  };

  return { activeKeyword, definition, isOverridden, isLoading, error: null, define, dismiss };
};
