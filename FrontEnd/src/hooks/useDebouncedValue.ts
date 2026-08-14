import { useEffect, useState } from 'react';

// Cross-feature shared hook (ARCHITECTURE-SPINE.md AD-3 hooks/ convention). Delays reflecting a
// fast-changing value (e.g. a search input) until it's stopped changing for `delayMs` -- factors
// out the identical `setTimeout` + `useEffect` debounce ErrorLogFilters.tsx and
// TagManagement.tsx each hand-rolled inline. Callers that need to act on the debounced value
// (rather than just render it) still own that reaction themselves -- this hook only owns the
// timing mechanism.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debounced;
}
