// Story 7.4 (AD-4): the currently-open course's outline metadata -- titles, Descriptions,
// confirmation state -- fetched via getOutline(courseId), NEVER Page bodies. Deliberately mounted
// at the point CourseContentEditor opens (CourseContentEditor.tsx wraps its own return in
// <CourseContentProvider>), not globally at App.tsx's composition root the way
// DomainContext/SessionContext are -- this data is meaningless outside an open editor session.
//
// Reconciles a real design tension (Story 7.2's TableOfContentsRail.tsx derives its own
// structure/order by walking the live Tiptap document directly, so rail order can't drift from
// native screen-reader heading-navigation, UX-DR7). Structure = Tiptap document (source of
// truth); confirmation display = this Context, keyed by node id. Never duplicate confirmation
// state a second time inside Tiptap node attrs.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getOutline, type OutlineDto } from '../services/courseContentService';
import { walkOutline } from '../lib/outlineTraversal';

interface CourseContentContextValue {
  /** undefined until the outline has loaded, or if the node id isn't known (e.g. not yet
   * persisted). */
  isConfirmed: (nodeId: string) => boolean | undefined;
  /** Re-fetches the whole outline -- used after a structural mutation (create/delete/reorder/
   * move), which flips an immediate parent's confirmation server-side but returns no payload
   * conveying that (the mutation's own HTTP response only describes the mutated entity itself).
   * NOT used by the debounced text-only autosave path -- that one patches directly (see
   * patchConfirmation) per AD-11's explicit "never a full outline refetch" rule for that path.
   * Returns the freshly-fetched map directly (not just via re-render) so a caller can compare a
   * specific node's before/after value in the same call, without waiting on React's own
   * re-render timing (Task 7's reversion-announcement check needs this). */
  refetch: () => Promise<Map<string, boolean>>;
  /** Patches one node's confirmation in place -- the debounced autosave path's own PUT response
   * already carries the authoritative value for the entity it just saved. */
  patchConfirmation: (nodeId: string, isConfirmed: boolean) => void;
  /** Story 11.1, FR-45: the raw whole-course outline (title/kind/isConfirmed per node, already
   * fetched here) -- exposed directly so PublishLifecycleBar can derive its own blocker list
   * without a second fetch. Null until the first successful refetch. */
  outline: OutlineDto | null;
}

const CourseContentContext = createContext<CourseContentContextValue | undefined>(undefined);

// Shared tree walk (FrontEnd/src/lib/outlineTraversal.ts) -- every node OutlineDto's own shape
// yields (Chapter/Topic/Subtopic/Page) carries `isConfirmed`, so this is a direct id -> flag copy.
const buildConfirmationMap = (outline: OutlineDto): Map<string, boolean> => {
  const map = new Map<string, boolean>();
  for (const visited of walkOutline(outline.chapters)) {
    const node = visited.node as { id: string; isConfirmed: boolean };
    map.set(node.id, node.isConfirmed);
  }
  return map;
};

export const CourseContentProvider: React.FC<{ courseId: string | null; children: React.ReactNode }> = ({ courseId, children }) => {
  const [confirmationById, setConfirmationById] = useState<Map<string, boolean>>(new Map());
  const [outline, setOutline] = useState<OutlineDto | null>(null);

  const refetch = useCallback(async () => {
    if (!courseId) {
      const empty = new Map<string, boolean>();
      setConfirmationById(empty);
      setOutline(null);
      return empty;
    }
    const fetched = await getOutline(courseId);
    const map = buildConfirmationMap(fetched);
    setConfirmationById(map);
    setOutline(fetched);
    return map;
  }, [courseId]);

  useEffect(() => {
    // A transient outline-fetch failure leaves confirmation glyphs/reversion-announcements
    // simply unavailable (isConfirmed() returns undefined, callers already treat that as "not
    // loaded yet") rather than crashing the whole editor or surfacing as an unhandled rejection.
    refetch().catch(() => undefined);
  }, [refetch]);

  const patchConfirmation = useCallback((nodeId: string, isConfirmed: boolean) => {
    setConfirmationById((prev) => {
      const next = new Map(prev);
      next.set(nodeId, isConfirmed);
      return next;
    });
  }, []);

  const isConfirmed = useCallback((nodeId: string) => confirmationById.get(nodeId), [confirmationById]);

  return (
    <CourseContentContext.Provider value={{ isConfirmed, refetch, patchConfirmation, outline }}>{children}</CourseContentContext.Provider>
  );
};

export const useCourseContent = (): CourseContentContextValue => {
  const ctx = useContext(CourseContentContext);
  if (!ctx) throw new Error('useCourseContent must be used within a CourseContentProvider');
  return ctx;
};
