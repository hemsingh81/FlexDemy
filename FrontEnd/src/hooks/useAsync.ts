import { useEffect, useState, type Dispatch, type SetStateAction, type DependencyList } from 'react';

export interface UseAsyncResult<T> {
  data: T;
  // Exposed (not just `data`) so a hook can still apply local optimistic/patch updates after the
  // initial load -- e.g. useAiTaskConfig.updateTaskConfig patches one row via setData, and
  // useTutorHub/useAssignmentsHub's various mutators patch one field of a combined-object `data`
  // this same way, exactly as they could with their own hand-rolled useState before.
  setData: Dispatch<SetStateAction<T>>;
  isLoading: boolean;
  error: string | null;
}

const defaultErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Something went wrong. Please try again.';

// Cross-feature shared hook (ARCHITECTURE-SPINE.md AD-3 hooks/ convention). Factors out the
// `let cancelled = false; setIsLoading(true); ...; .catch(...); .finally(() => { if (!cancelled)
// setIsLoading(false) }); return () => { cancelled = true; }` boilerplate that was hand-rolled
// near-identically across a dozen feature hooks (useErrorLog, useAiUsage, useAiTaskConfig,
// useGroupStudy, useProgressAndCertificate, useTutorHub, useAssignmentsHub, useProfileSetup,
// DomainContext -- see each call site for how the raw fetch is shaped for this hook).
//
// `fetchFn` re-runs whenever `deps` changes (same contract as a plain useEffect dependency
// array -- pass `[]` for a mount-only fetch). A stale response that resolves after `deps` has
// already changed again (or the component unmounted) is silently dropped rather than clobbering
// newer state.
//
// Deliberately NOT used everywhere the cancelled-guard shape appears: useFileUpload.ts and
// useCourseLifecycle.ts each interleave a one-shot fetch with a setInterval poll sharing the same
// state, and useCourseDraft.ts deliberately funnels several independent async operations
// (commitStep, addThumbnail, two cascading taxonomy fetches, ...) into ONE shared `error` field --
// this hook's one-fetch-owns-its-own-error contract can't express that without duplicating the
// shared field right back out again. See those hooks' own comments.
export function useAsync<T>(
  fetchFn: () => Promise<T>,
  initialData: T,
  deps: DependencyList,
  onError: (err: unknown) => string = defaultErrorMessage
): UseAsyncResult<T> {
  const [data, setData] = useState<T>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchFn()
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(onError(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, isLoading, error };
}
