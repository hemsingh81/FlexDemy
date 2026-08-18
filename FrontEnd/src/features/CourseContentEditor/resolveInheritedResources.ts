// Story 8.2, Task 3: downward-only resource inheritance, computed client-side from the already-
// fetched ChapterDocumentDto tree (Dev Notes' own explicit "no new backend endpoint for inherited
// resources" decision -- the full document response already contains the whole ancestor chain in
// one payload). A pure function -- feature-owned (not `lib/editor/`, since it understands
// Chapter/Topic/Subtopic/Page semantics, not generic editor mechanics).
//
// Walks UPWARD only, from a target node to its ancestors -- there is no code path that walks
// downward or sideways, which is what makes AC #3's "inheritance flows down only" true by
// construction rather than by an extra guard.
import type { ChapterDocumentDto, ResourceDto } from '../../services/courseContentService';
import type { ContentOwnerType } from '../../types';

export interface InheritedResourceEntry extends ResourceDto {
  ancestorOwnerType: ContentOwnerType;
  ancestorOwnerId: string;
  ancestorTitle: string;
}

interface AncestorInfo {
  ownerType: ContentOwnerType;
  ownerId: string;
  title: string;
  resources: ResourceDto[];
}

// Nearest ancestor first (immediate parent, then its parent, ..., up to Chapter) -- pinned here
// as the one true order; LearningResourcesNodeView renders inherited rows in this same order.
const ancestorChainFor = (document: ChapterDocumentDto, ownerType: ContentOwnerType, ownerId: string): AncestorInfo[] => {
  const chapterAncestor: AncestorInfo = { ownerType: 'Chapter', ownerId: document.id, title: document.title, resources: document.resources ?? [] };

  if (ownerType === 'Chapter') return []; // nothing above a Chapter

  if (ownerType === 'Topic') return [chapterAncestor];

  if (ownerType === 'Subtopic') {
    const topic = document.topics.find((t) => t.subtopics.some((s) => s.id === ownerId));
    const topicAncestor: AncestorInfo | null = topic
      ? { ownerType: 'Topic', ownerId: topic.id, title: topic.title, resources: topic.resources ?? [] }
      : null;
    return topicAncestor ? [topicAncestor, chapterAncestor] : [chapterAncestor];
  }

  // ownerType === 'Page': find which node owns it by searching every level's own `pages` array.
  if (document.pages.some((p) => p.id === ownerId)) return [chapterAncestor];

  for (const topic of document.topics) {
    if (topic.pages.some((p) => p.id === ownerId)) {
      return [{ ownerType: 'Topic', ownerId: topic.id, title: topic.title, resources: topic.resources ?? [] }, chapterAncestor];
    }
    for (const subtopic of topic.subtopics) {
      if (subtopic.pages.some((p) => p.id === ownerId)) {
        return [
          { ownerType: 'Subtopic', ownerId: subtopic.id, title: subtopic.title, resources: subtopic.resources ?? [] },
          { ownerType: 'Topic', ownerId: topic.id, title: topic.title, resources: topic.resources ?? [] },
          chapterAncestor,
        ];
      }
    }
  }

  return []; // ownerId not found anywhere in the tree -- nothing to inherit from
};

export const resolveInheritedResources = (
  document: ChapterDocumentDto,
  ownerType: ContentOwnerType,
  ownerId: string
): InheritedResourceEntry[] =>
  ancestorChainFor(document, ownerType, ownerId).flatMap((ancestor) =>
    ancestor.resources.map((resource) => ({
      ...resource,
      ancestorOwnerType: ancestor.ownerType,
      ancestorOwnerId: ancestor.ownerId,
      ancestorTitle: ancestor.title,
    }))
  );
