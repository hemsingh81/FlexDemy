import type { ContentBlock } from './useCourseContentTree';

// Extracted from ContentTreeNode.tsx: the shared mutator bundle threaded down through every level
// of the Chapter/Topic/Subtopic/ContentBlock tree (ChapterRow -> TopicRow -> SubtopicRow ->
// ContentBlockRow). Re-exported from ContentTreeNode.tsx so CourseContentEditor.tsx's existing
// `import { ContentTree, type TreeMutators } from './ContentTreeNode'` keeps working unchanged.
export interface TreeMutators {
  addNode: (parentId: string, type: 'topic' | 'subtopic' | 'contentBlock') => void;
  editNodeTitle: (id: string, title: string) => void;
  editContentBlock: (id: string, patch: Partial<Pick<ContentBlock, 'text' | 'lang' | 'notation' | 'imageUrl' | 'altText' | 'format'>>) => void;
  deleteNode: (id: string) => void;
  reorderNode: (id: string, direction: 'up' | 'down') => void;
  moveNode: (draggedId: string, targetId: string) => void;
  confirmNode: (id: string) => void;
  // Chapter/Topic/Subtopic deletes route through this instead of deleteNode directly, so
  // CourseContentEditor.tsx can open ConfirmModal first (cascading, destructive).
  requestDelete: (id: string, label: string) => void;
}
