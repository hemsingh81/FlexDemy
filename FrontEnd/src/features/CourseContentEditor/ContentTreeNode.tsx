import React from 'react';
import { Plus } from 'lucide-react';
import type { Chapter } from './useCourseContentTree';
import type { TreeMutators } from './treeMutators';
import { ChapterRow } from './ChapterRow';

// This file used to hold the entire recursive Chapter->Topic->Subtopic->ContentBlock tree
// renderer (EditableField, NodeRowShell, ContentBlockRow, ExpandToggle, ChapterRow/TopicRow/
// SubtopicRow, TreeMutators) in one ~520-line file. It's now split one concern per file
// (EditableField.tsx, NodeRowShell.tsx, ExpandToggle.tsx, ContentBlockRow.tsx, SubtopicRow.tsx,
// TopicRow.tsx, ChapterRow.tsx, treeMutators.ts) -- this file keeps only the top-level `ContentTree`
// export and re-exports `TreeMutators` so CourseContentEditor.tsx's existing
// `import { ContentTree, type TreeMutators } from './ContentTreeNode'` keeps working unchanged.
//
// React.memo on the row components was considered (editing one field shouldn't need to re-render
// sibling nodes) but isn't applied: CourseContentEditor.tsx builds the `mutators` object as a
// fresh literal on every one of its own renders, and useCourseContentTree's mutation flow
// refetches and remaps the *entire* tree (fresh Chapter/Topic/Subtopic/ContentBlock objects, even
// for untouched nodes) after every edit. Both `mutators` and every node's data prop are therefore
// new references on the renders that matter, so a shallow-prop-comparing memo would never actually
// skip re-rendering a subtree -- it would only add a comparison cost. Revisit if
// CourseContentEditor.tsx's mutators construction and/or the tree-refetch strategy change.
export type { TreeMutators } from './treeMutators';

interface ContentTreeProps {
  chapters: Chapter[];
  mutators: TreeMutators;
  onAddChapter: () => void;
}

export const ContentTree: React.FC<ContentTreeProps> = ({ chapters, mutators, onAddChapter }) => (
  <div className="space-y-3">
    {chapters.map((chapter, i) => (
      <ChapterRow key={chapter.id} chapter={chapter} index={i} siblingCount={chapters.length} mutators={mutators} />
    ))}
    <button
      type="button"
      onClick={onAddChapter}
      className="w-full p-3 rounded-xl border-2 border-dashed border-[#E1DED4] flex items-center justify-center gap-2 text-[#5E6A79] hover:border-[#BA5012] hover:text-[#BA5012] transition-colors text-xs font-bold"
    >
      <Plus className="w-4 h-4" />
      <span>Add Chapter</span>
    </button>
  </div>
);
