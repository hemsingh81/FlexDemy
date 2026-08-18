import { useEffect, useState } from 'react';
import { getOutline, getPage, type OutlineDto, type PageDocumentDto } from '../../services/courseContentService';

// Story 11.4, AC #1: replaces useCourseFileNavigation.ts's flat, file-based navigation with a real
// Chapter/Topic/Sub-Topic/Page tree -- mirrors that hook's exact shape (fetch-on-mount, `cancelled`
// guard, swallow background-load failures the same way) for the outline fetch. Unlike the flat file
// list (whose "selected" item was already fully loaded, since getCourseContent fetches every
// file's parsedContent up front), a selected Page's own body is fetched separately, one page at a
// time (AC #1's explicit "never a whole-chapter fetch") -- the outline itself (Story 7.4's
// endpoint) is deliberately body-free.
export const useCourseContentNavigation = (courseId: string) => {
  const [outline, setOutline] = useState<OutlineDto | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<PageDocumentDto | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [pageLoadFailed, setPageLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getOutline(courseId)
      .then((dto) => {
        if (!cancelled) setOutline(dto);
      })
      // A transient/denied outline fetch leaves the tree empty rather than surfacing as an
      // unhandled rejection -- same silent-swallow posture useCourseFileNavigation.ts's own file
      // fetch already has (this story's AC #3: live access is gated closed by Story 11.3's
      // deny-by-default policy until Enrollment exists, so a real student's outline fetch failing
      // today is expected, not a bug to work around here).
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    if (!selectedPageId) {
      setSelectedPage(null);
      setPageLoadFailed(false);
      return undefined;
    }
    let cancelled = false;
    setSelectedPage(null);
    setPageLoadFailed(false);
    setIsLoadingPage(true);
    getPage(courseId, selectedPageId)
      .then((dto) => {
        if (!cancelled) setSelectedPage(dto);
      })
      .catch(() => {
        if (!cancelled) setPageLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPage(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, selectedPageId]);

  return { outline, selectedPageId, setSelectedPageId, selectedPage, isLoadingPage, pageLoadFailed };
};
