import { useEffect, useRef, useState } from 'react';
import {
  addChapter as apiAddChapter,
  addContentBlock as apiAddContentBlock,
  addSubtopic as apiAddSubtopic,
  addTopic as apiAddTopic,
  confirmNode as apiConfirmNode,
  deleteNode as apiDeleteNode,
  editContentBlock as apiEditContentBlock,
  editNodeTitle as apiEditNodeTitle,
  getTree,
  moveNode as apiMoveNode,
  reorderNode as apiReorderNode,
  type ChapterDto,
  type ContentBlockDto,
  type EditContentBlockPatch,
  type SubtopicDto,
  type TopicDto,
} from '../../services/contentTreeService';

export type NodeConfirmation = 'confirmed' | 'unconfirmed';
export type ContentBlockFormat = 'text' | 'math' | 'image';

// Field/level names anticipate Backend AD-20's four explicit entity types (Chapter, Topic,
// Subtopic, ContentBlock, each with a parent-FK one level up). AD-20 allows a Content Block to
// parent directly under either a Topic or a Subtopic, so both levels carry their own
// `contentBlocks` array.
export interface ContentBlock {
  id: string;
  format: ContentBlockFormat;
  confirmation: NodeConfirmation;
  text?: string;
  lang?: 'en' | 'hi';
  notation?: string;
  imageUrl?: string;
  altText?: string;
}

export interface Subtopic {
  id: string;
  title: string;
  confirmation: NodeConfirmation;
  contentBlocks: ContentBlock[];
}

export interface Topic {
  id: string;
  title: string;
  confirmation: NodeConfirmation;
  subtopics: Subtopic[];
  contentBlocks: ContentBlock[];
}

export interface Chapter {
  id: string;
  title: string;
  confirmation: NodeConfirmation;
  topics: Topic[];
}

export type AddableNodeType = 'topic' | 'subtopic' | 'contentBlock';

// -- Wire <-> local shape translation ------------------------------------------------------------
// Two responsibilities live here, neither a pass-through (Story 2.9/Task 10):
// (1) Confirmation/Format arrive PascalCase (CourseMapper.cs's own .ToString() convention,
//     confirmed against the real backend code -- there is no JsonStringEnumConverter anywhere in
//     FlexDemy.Api) and must become the lowercase unions this file's own types declare, so
//     ContentTreeNode.tsx's existing strict === checks against lowercase literals keep working.
// (2) parentType resolution for addNode(parentId, 'contentBlock') -- the real UI always passes the
//     literal 'contentBlock' regardless of whether parentId is a Topic or a Subtopic (confirmed
//     against ContentTreeNode.tsx's real call sites), so this hook must itself search the
//     currently-loaded tree to tell the backend which one parentId actually is.

const toConfirmation = (raw: string): NodeConfirmation => (raw.toLowerCase() === 'confirmed' ? 'confirmed' : 'unconfirmed');

const toFormat = (raw: string): ContentBlockFormat => {
  const lowered = raw.toLowerCase();
  return lowered === 'math' || lowered === 'image' ? lowered : 'text';
};

const fromFormat = (format: ContentBlockFormat): string => format.charAt(0).toUpperCase() + format.slice(1);

const toLang = (raw: string | null): 'en' | 'hi' | undefined => (raw === 'en' || raw === 'hi' ? raw : undefined);

const toContentBlock = (dto: ContentBlockDto): ContentBlock => ({
  id: dto.id,
  format: toFormat(dto.format),
  confirmation: toConfirmation(dto.confirmation),
  text: dto.text ?? undefined,
  lang: toLang(dto.lang),
  notation: dto.notation ?? undefined,
  imageUrl: dto.imageUrl ?? undefined,
  altText: dto.altText ?? undefined,
});

const toSubtopic = (dto: SubtopicDto): Subtopic => ({
  id: dto.id,
  title: dto.title,
  confirmation: toConfirmation(dto.confirmation),
  contentBlocks: dto.contentBlocks.map(toContentBlock),
});

const toTopic = (dto: TopicDto): Topic => ({
  id: dto.id,
  title: dto.title,
  confirmation: toConfirmation(dto.confirmation),
  subtopics: dto.subtopics.map(toSubtopic),
  contentBlocks: dto.contentBlocks.map(toContentBlock),
});

const toChapter = (dto: ChapterDto): Chapter => ({
  id: dto.id,
  title: dto.title,
  confirmation: toConfirmation(dto.confirmation),
  topics: dto.topics.map(toTopic),
});

// Searches the currently-loaded tree for which array `parentId` actually belongs to -- null if
// it isn't found anywhere (the caller no-ops rather than guessing).
const findContentBlockParentType = (chapters: Chapter[], parentId: string): 'topic' | 'subtopic' | null => {
  for (const chapter of chapters) {
    for (const topic of chapter.topics) {
      if (topic.id === parentId) return 'topic';
      for (const subtopic of topic.subtopics) {
        if (subtopic.id === parentId) return 'subtopic';
      }
    }
  }
  return null;
};

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');

interface UseCourseContentTreeResult {
  data: Chapter[];
  isLoading: boolean;
  error: string | null;
  // Chapters have no parent, so they get their own mutator rather than overloading addNode with
  // a nullable parentId -- FR-14 covers "any Chapter, Topic, Subtopic, or Content Block" as
  // addable, so this is required, not optional.
  addChapter: () => void;
  addNode: (parentId: string, type: AddableNodeType) => void;
  editNodeTitle: (id: string, title: string) => void;
  // Widened to include 'format' (Story 2.9's Task 4 amendment) -- a tutor converts a Text block to
  // Math (or back) via an edit patch; Story 2.10 is the first real caller of this field.
  editContentBlock: (id: string, patch: Partial<Pick<ContentBlock, 'text' | 'lang' | 'notation' | 'imageUrl' | 'altText' | 'format'>>) => void;
  deleteNode: (id: string) => void;
  reorderNode: (id: string, direction: 'up' | 'down') => void;
  // Drag-and-drop's mutator: moves `draggedId` to sit at `targetId`'s current position, only if
  // they share the same parent array (a no-op otherwise). AC#3/Task 5 also require drag as an
  // additional input method alongside the keyboard up/down buttons.
  moveNode: (draggedId: string, targetId: string) => void;
  confirmNode: (id: string) => void;
  // No Draft-only "abandon" concept exists for the content tree the way it does for Course itself
  // -- this reloads the real persisted tree from the server, called by the caller when the screen
  // closes or switches to a different draft (mirrors useFileUpload's resetFiles()).
  resetTree: () => void;
  // Refetches in place (no flash back to empty first, unlike resetTree) -- called by
  // CourseContentEditor.tsx when a file's upload/extraction finishes, so newly materialized
  // content actually appears without the tutor closing and reopening the editor.
  refetch: () => void;
}

// Feature-local hook (AD-2), separate from useFileUpload.ts (different domain: confirmed content
// structure, not upload/parsing status). Story 2.9 swaps this hook's internals for real
// Chapter/Topic/Subtopic/ContentBlock API calls, keeping the exact same { data, isLoading, error }
// + mutator shape (AD-1) Story 2.2's mock hook established -- CourseContentEditor.tsx/
// ContentTreeNode.tsx need no changes beyond passing courseId in, since the hook itself always
// took no arguments while it was mock-only.
export const useCourseContentTree = (courseId: string | null): UseCourseContentTreeResult => {
  const [data, setData] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Code-review patch: guards against out-of-order responses -- firing two mutations in quick
  // succession (or switching drafts while a fetch is in flight) can otherwise let a slower, stale
  // fetchTree response's setData silently overwrite state a faster, later request already wrote.
  // Each call captures its own sequence number; only the most-recently-*started* call's response is
  // ever applied, regardless of resolution order.
  const requestSeqRef = useRef(0);

  const fetchTree = (id: string) => {
    const seq = ++requestSeqRef.current;
    setIsLoading(true);
    getTree(id)
      .then((dtos) => {
        if (seq === requestSeqRef.current) setData(dtos.map(toChapter));
      })
      .catch((e) => {
        if (seq === requestSeqRef.current) setError(errorMessage(e));
      })
      .finally(() => {
        if (seq === requestSeqRef.current) setIsLoading(false);
      });
  };

  useEffect(() => {
    if (!courseId) {
      setData([]);
      return;
    }
    setError(null);
    fetchTree(courseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // Every mutator: call the matching contentTreeService function, then refetch the tree -- the
  // server is the single source of truth for confirmation-reset outcomes (recommended over
  // optimistic local updates, which would have to independently reimplement FR-15's reset rules
  // just to stay in sync -- see this story's Dev Notes).
  const runMutation = (call: Promise<unknown>) => {
    setError(null);
    call.then(() => courseId && fetchTree(courseId)).catch((e) => setError(errorMessage(e)));
  };

  const addChapter = () => {
    if (!courseId) return;
    runMutation(apiAddChapter(courseId));
  };

  const addNode = (parentId: string, type: AddableNodeType) => {
    if (!courseId) return;
    if (type === 'topic') {
      runMutation(apiAddTopic(courseId, parentId));
      return;
    }
    if (type === 'subtopic') {
      runMutation(apiAddSubtopic(courseId, parentId));
      return;
    }
    const parentType = findContentBlockParentType(data, parentId);
    if (!parentType) return; // parentId isn't a Topic or Subtopic in the currently-loaded tree
    runMutation(apiAddContentBlock(courseId, parentId, parentType));
  };

  const editNodeTitle = (id: string, title: string) => {
    if (!courseId) return;
    runMutation(apiEditNodeTitle(courseId, id, title));
  };

  const editContentBlock = (
    id: string,
    patch: Partial<Pick<ContentBlock, 'text' | 'lang' | 'notation' | 'imageUrl' | 'altText' | 'format'>>
  ) => {
    if (!courseId) return;
    // Tri-state: a key's mere presence in `patch` (even set to undefined/empty) means "touched" --
    // matches UpdateContentBlockRequest's own contract (ContentTreeDtos.cs) and the real mock's
    // own Object.keys(patch)-based isTextOnly check this replaces server-side.
    const wirePatch: EditContentBlockPatch = {};
    if ('text' in patch) wirePatch.text = patch.text ?? null;
    if ('lang' in patch) wirePatch.lang = patch.lang ?? null;
    if ('notation' in patch) wirePatch.notation = patch.notation ?? null;
    if ('imageUrl' in patch) wirePatch.imageUrl = patch.imageUrl ?? null;
    if ('altText' in patch) wirePatch.altText = patch.altText ?? null;
    if ('format' in patch) wirePatch.format = patch.format ? fromFormat(patch.format) : null;
    runMutation(apiEditContentBlock(courseId, id, wirePatch));
  };

  const deleteNode = (id: string) => {
    if (!courseId) return;
    runMutation(apiDeleteNode(courseId, id));
  };

  const reorderNode = (id: string, direction: 'up' | 'down') => {
    if (!courseId) return;
    runMutation(apiReorderNode(courseId, id, direction));
  };

  const moveNode = (draggedId: string, targetId: string) => {
    if (!courseId || draggedId === targetId) return;
    runMutation(apiMoveNode(courseId, draggedId, targetId));
  };

  const confirmNode = (id: string) => {
    if (!courseId) return;
    runMutation(apiConfirmNode(courseId, id));
  };

  const resetTree = () => {
    setData([]);
    setError(null);
    if (courseId) fetchTree(courseId);
  };

  // Distinct from resetTree above: this refetches in place (no flash back to an empty tree first)
  // -- for CourseContentEditor.tsx to call once a file's upload/extraction finishes, so a newly
  // materialized chapter (GetTreeAsync materializes any pending extraction server-side on every
  // call, ContentTreeService.cs's own MaterializePendingExtractionsAsync) actually shows up
  // without the tutor having to close and reopen the editor. useFileUpload.ts's own poll has no
  // way to know this hook exists, so nothing else calls fetchTree when a file goes 'done'.
  const refetch = () => {
    if (courseId) fetchTree(courseId);
  };

  return {
    data,
    isLoading,
    error,
    addChapter,
    addNode,
    editNodeTitle,
    editContentBlock,
    deleteNode,
    reorderNode,
    moveNode,
    confirmNode,
    resetTree,
    refetch,
  };
};
