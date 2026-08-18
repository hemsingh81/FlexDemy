import { useEffect, useState } from 'react';

// Shared "resolve a resourceId to a real served URL" state machine -- the same
// cancellation-guarded async-resolve-on-id-change shape was independently reimplemented in
// ImageNodeView.tsx, ResourceCardNodeView.tsx, and MarkdownViewer.tsx's own
// ResolvedResourceImage/ResolvedResourceCard (Story 8.3/9.1/9.2/11.2's own resolveResourceUrl
// call sites). Extracted once all four were confirmed to share the identical resolve/cancel/
// reset logic, differing only in what each caller does with the resulting url/failed state.
//
// `resolve` may be null (e.g. MarkdownViewer's own ResourceResolverContext has no provider) --
// that's treated the same as "no resourceId," never as a failure.
export const useResolvedResourceUrl = (
  resolve: ((resourceId: string) => Promise<string>) | null,
  resourceId: string | null
): { url: string | null; failed: boolean } => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!resolve || !resourceId) {
      setUrl(null);
      setFailed(false);
      return undefined;
    }
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    resolve(resourceId)
      .then((resolvedUrl) => {
        if (!cancelled) setUrl(resolvedUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [resolve, resourceId]);

  return { url, failed };
};
